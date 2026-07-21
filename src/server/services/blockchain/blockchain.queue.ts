import { prisma } from "../../db/client";

/**
 * enqueueBlockchainJobs
 *
 * Called by BatchService.registerBatch() right after the DB transaction
 * commits. Creates:
 *  - 1 BATCH job (to call anchorBatch on-chain)
 *  - N PILL jobs (to call anchorPill on-chain for each pill)
 *
 * PILL jobs intentionally start as PENDING immediately — the queue worker
 * enforces the BATCH-must-be-confirmed-first ordering before executing
 * any PILL job for that batch.
 *
 * This function is fire-and-forget (called with `void`). Any failure here
 * is logged but NEVER propagated back to the caller — batch creation
 * must always succeed even if the queue insert fails.
 */
export async function enqueueBlockchainJobs(batch: any, pills: any[]): Promise<void> {
    try {
        // 1. One job for the batch itself
        await prisma.blockchainJob.create({
            data: {
                entityType: "BATCH",
                entityId: batch.id,
                entityRef: batch.batchNumber,
                status: "PENDING",
            },
        });

        // 2. One job per pill — batch insert for performance
        if (pills && pills.length > 0) {
            // createMany doesn't support relations, so we build raw data rows
            const pillJobs = pills.map((pill: any) => ({
                entityType: "PILL",
                entityId: pill.id,
                entityRef: pill.pillQrCode ?? pill.qrCode ?? pill.id,
                status: "PENDING",
                // updatedAt is required (@@updatedAt) — prisma.createMany doesn't auto-fill it
                updatedAt: new Date(),
            }));

            // MySQL/TiDB supports createMany
            await prisma.blockchainJob.createMany({
                data: pillJobs,
                skipDuplicates: true,
            });
        }

        console.log(
            `[QUEUE] Enqueued 1 BATCH job + ${pills?.length ?? 0} PILL jobs for batch ${batch.batchNumber}`
        );
    } catch (err: any) {
        // Log but DO NOT re-throw — batch creation must not be affected
        console.error(
            `[QUEUE] Failed to enqueue blockchain jobs for batch ${batch.batchNumber}:`,
            err?.message ?? err
        );
    }
}

/**
 * logVerificationAnchorError
 *
 * Called by verification.service.ts when an anchorVerification() call fails.
 * Records the failure in the blockchain_job table with entityType="VERIFICATION_ANCHOR"
 * so the admin can see which verifications failed to anchor and why.
 */
export async function logVerificationAnchorError(
    verificationLogId: string,
    pillQR: string,
    errorMsg: string,
    isPendingAnchor: boolean
): Promise<void> {
    try {
        await prisma.blockchainJob.create({
            data: {
                entityType: "VERIFICATION_ANCHOR",
                entityId: verificationLogId,
                entityRef: pillQR,
                status: "FAILED",
                attempts: 1,
                lastError: isPendingAnchor
                    ? `PENDING_ANCHOR: Pill not yet registered on-chain (queue will handle it). Original: ${errorMsg}`.substring(0, 2000)
                    : errorMsg.substring(0, 2000),
                updatedAt: new Date(),
            },
        });
    } catch (err: any) {
        // Never let logging failures bubble up
        console.error("[QUEUE] Failed to log verification anchor error:", err?.message ?? err);
    }
}
