import { ethers } from "ethers";
import { prisma } from "../../db/client";
import { BlockchainService } from "./blockchain.service";

// Maximum concurrent jobs to process per invocation
const BATCH_SIZE = 5;
// Max retry attempts before marking FAILED permanently
const MAX_ATTEMPTS = 3;
// Delay between individual chain calls (ms) to avoid nonce conflicts on Amoy
const INTER_TX_DELAY_MS = 1000;

interface JobResult {
    id: string;
    entityType: string;
    entityRef: string | null;
    status: "CONFIRMED" | "FAILED" | "RETRY";
    txHash?: string;
    error?: string;
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * processAnchorQueue
 *
 * Picks up to BATCH_SIZE PENDING blockchain jobs (oldest first), marks them
 * PROCESSING, then attempts the appropriate on-chain call for each.
 *
 * Rules:
 * - BATCH jobs must be processed BEFORE any PILL jobs in the same batch,
 *   because registerPill() requires the parent batch to be registered on-chain.
 *   We enforce this by ordering: BATCH first, then PILL, then anything else.
 * - On success: job → CONFIRMED, txHash stored, parent entity status updated.
 * - On failure: attempts++, lastError stored. If attempts >= MAX_ATTEMPTS → FAILED.
 *   Otherwise stays PENDING for the next poll.
 * - Gas Safety Margin: Estimates gas cost before transmitting. Skips the transaction
 *   (reverts job to PENDING, resets to 0 attempts/no increments, retries later)
 *   if signer's balance is below 3x the estimated cost.
 */
export async function processAnchorQueue(): Promise<{
    processed: number;
    confirmed: number;
    failed: number;
    results: JobResult[];
}> {
    // Grab oldest PENDING jobs, BATCH type first so pills don't run before their batch
    const jobs = await prisma.blockchainJob.findMany({
        where: { status: "PENDING" },
        orderBy: [
            // Sort BATCH before PILL before VERIFICATION_ANCHOR
            { entityType: "asc" },
            { createdAt: "asc" },
        ],
        take: BATCH_SIZE,
    });

    if (jobs.length === 0) {
        return { processed: 0, confirmed: 0, failed: 0, results: [] };
    }

    // Mark all as PROCESSING atomically
    await prisma.blockchainJob.updateMany({
        where: { id: { in: jobs.map((j) => j.id) } },
        data: { status: "PROCESSING" },
    });

    const provider = BlockchainService.getProvider();
    const walletAddress = BlockchainService.getWalletAddress();
    const contract = BlockchainService.getContract();

    const results: JobResult[] = [];
    let confirmed = 0;
    let failed = 0;

    for (const job of jobs) {
        const result: JobResult = {
            id: job.id,
            entityType: job.entityType,
            entityRef: job.entityRef,
            status: "RETRY",
        };

        try {
            if (job.entityType === "BATCH") {
                // Fetch the full batch with medicine for anchorBatch()
                const batch = await prisma.batch.findUnique({
                    where: { id: job.entityId },
                    include: { medicine: true },
                });

                if (!batch) {
                    throw new Error(`Batch not found: ${job.entityId}`);
                }
                if (batch.blockchainStatus === "CONFIRMED") {
                    // Already anchored (maybe by a previous run) — mark job done
                    await prisma.blockchainJob.update({
                        where: { id: job.id },
                        data: { status: "CONFIRMED", txHash: batch.txHash ?? undefined },
                    });
                    result.status = "CONFIRMED";
                    result.txHash = batch.txHash ?? undefined;
                    confirmed++;
                    continue;
                }

                // ── Gas Cost Safety Margin Check ─────────────────────────────
                let isSufficientGas = true;
                let gasSafetyErrorMsg = "";
                try {
                    const gasLimit = await contract.registerBatch.estimateGas(
                        batch.batchNumber,
                        batch.medicine.name,
                        batch.totalPillsGenerated,
                        Math.floor(new Date(batch.expiryDate).getTime() / 1000)
                    );
                    const feeData = await provider.getFeeData();
                    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 25000000000n;
                    const estimatedCost = gasLimit * gasPrice;

                    if (walletAddress) {
                        const balance = await provider.getBalance(walletAddress);
                        if (balance < estimatedCost * 3n) {
                            isSufficientGas = false;
                            gasSafetyErrorMsg = `Gas safety limit hit: Balance (${ethers.formatEther(balance)} POL) is below 3x estimated gas cost (${ethers.formatEther(estimatedCost * 3n)} POL). Job deferred.`;
                        }
                    }
                } catch (gasErr: any) {
                    // If gas estimation fails, it could be a contract revert (e.g. Batch already registered),
                    // so we do not block the transaction based on safety check; let the contract revert error bubble up.
                    console.warn("[QUEUE] Gas estimation failed for batch, proceeding to call contract directly:", gasErr?.message ?? gasErr);
                }

                if (!isSufficientGas) {
                    console.warn(`[QUEUE] ${gasSafetyErrorMsg}`);
                    await prisma.blockchainJob.update({
                        where: { id: job.id },
                        data: {
                            status: "PENDING",
                            lastError: gasSafetyErrorMsg.substring(0, 2000),
                        },
                    });
                    result.status = "RETRY";
                    result.error = gasSafetyErrorMsg;
                    continue;
                }

                const { txHash, blockNumber, gasUsed } = await BlockchainService.anchorBatch(batch);
                await prisma.blockchainJob.update({
                    where: { id: job.id },
                    data: { status: "CONFIRMED", txHash, blockNumber, gasUsed },
                });
                result.status = "CONFIRMED";
                result.txHash = txHash;
                confirmed++;
                console.log(`[QUEUE] BATCH confirmed: ${job.entityRef} → block ${blockNumber}`);

            } else if (job.entityType === "PILL") {
                const pill = await prisma.pill.findUnique({
                    where: { id: job.entityId },
                    include: { batch: true },
                });

                if (!pill) {
                    throw new Error(`Pill not found: ${job.entityId}`);
                }
                if (pill.blockchainStatus === "CONFIRMED") {
                    await prisma.blockchainJob.update({
                        where: { id: job.id },
                        data: { status: "CONFIRMED", txHash: pill.blockchainTx ?? undefined },
                    });
                    result.status = "CONFIRMED";
                    result.txHash = pill.blockchainTx ?? undefined;
                    confirmed++;
                    continue;
                }

                // Guard: parent batch must be confirmed on-chain before registering the pill.
                // If the batch is still PENDING, re-queue this pill for the next cycle.
                if (pill.batch.blockchainStatus !== "CONFIRMED") {
                    await prisma.blockchainJob.update({
                        where: { id: job.id },
                        data: {
                            status: "PENDING",
                            lastError: `Batch ${pill.batch.batchNumber} not yet confirmed on-chain. Will retry when batch is anchored.`,
                        },
                    });
                    result.status = "RETRY";
                    result.error = "Batch not yet confirmed";
                    console.log(`[QUEUE] PILL ${job.entityRef} deferred — parent batch not yet on-chain`);
                    continue;
                }

                const pillNumberInt = parseInt(pill.pillNumber, 10) || 0;

                // ── Gas Cost Safety Margin Check ─────────────────────────────
                let isSufficientGas = true;
                let gasSafetyErrorMsg = "";
                try {
                    const gasLimit = await contract.registerPill.estimateGas(
                        pill.qrCode,
                        pill.batch.batchNumber,
                        pillNumberInt
                    );
                    const feeData = await provider.getFeeData();
                    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 25000000000n;
                    const estimatedCost = gasLimit * gasPrice;

                    if (walletAddress) {
                        const balance = await provider.getBalance(walletAddress);
                        if (balance < estimatedCost * 3n) {
                            isSufficientGas = false;
                            gasSafetyErrorMsg = `Gas safety limit hit: Balance (${ethers.formatEther(balance)} POL) is below 3x estimated gas cost (${ethers.formatEther(estimatedCost * 3n)} POL). Job deferred.`;
                        }
                    }
                } catch (gasErr: any) {
                    console.warn("[QUEUE] Gas estimation failed for pill, proceeding directly:", gasErr?.message ?? gasErr);
                }

                if (!isSufficientGas) {
                    console.warn(`[QUEUE] ${gasSafetyErrorMsg}`);
                    await prisma.blockchainJob.update({
                        where: { id: job.id },
                        data: {
                            status: "PENDING",
                            lastError: gasSafetyErrorMsg.substring(0, 2000),
                        },
                    });
                    result.status = "RETRY";
                    result.error = gasSafetyErrorMsg;
                    continue;
                }

                const { txHash, blockNumber, gasUsed } = await BlockchainService.anchorPill(
                    pill.id,
                    pill.qrCode,
                    pill.batch.batchNumber,
                    pillNumberInt
                );
                await prisma.blockchainJob.update({
                    where: { id: job.id },
                    data: { status: "CONFIRMED", txHash, blockNumber, gasUsed },
                });
                result.status = "CONFIRMED";
                result.txHash = txHash;
                confirmed++;
                console.log(`[QUEUE] PILL confirmed: ${job.entityRef} → block ${blockNumber}`);

            } else {
                throw new Error(`Unknown entityType: ${job.entityType}`);
            }
        } catch (err: any) {
            const errorMsg = err?.message ?? String(err);
            const newAttempts = job.attempts + 1;
            const isFinalFailure = newAttempts >= MAX_ATTEMPTS;

            await prisma.blockchainJob.update({
                where: { id: job.id },
                data: {
                    status: isFinalFailure ? "FAILED" : "PENDING",
                    attempts: newAttempts,
                    lastError: errorMsg.substring(0, 2000), // cap for db column
                },
            });

            result.status = isFinalFailure ? "FAILED" : "RETRY";
            result.error = errorMsg;

            if (isFinalFailure) {
                failed++;
                console.error(`[QUEUE] PERMANENT FAILURE after ${newAttempts} attempts — ${job.entityType} ${job.entityRef}: ${errorMsg}`);
            } else {
                console.warn(`[QUEUE] Attempt ${newAttempts}/${MAX_ATTEMPTS} failed — ${job.entityType} ${job.entityRef}: ${errorMsg}`);
            }
        }

        results.push(result);

        // Short delay between transactions to avoid nonce/rate-limit issues on Amoy
        if (jobs.indexOf(job) < jobs.length - 1) {
            await sleep(INTER_TX_DELAY_MS);
        }
    }

    return {
        processed: jobs.length,
        confirmed,
        failed,
        results,
    };
}
