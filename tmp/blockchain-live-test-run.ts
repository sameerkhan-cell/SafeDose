import "dotenv/config";
import { prisma } from "../src/server/db/client";
import { processAnchorQueue } from "../src/server/services/blockchain/blockchain.worker";
import { VerificationEngine } from "../src/server/services/verification.service";

async function main() {
    console.log("=== MediVerify Live Diagnostic Run (Retry/Verification) ===");

    // Find the latest batch we created
    const latestBatch = await prisma.batch.findFirst({
        where: { batchNumber: { startsWith: "TSB-" } },
        orderBy: { createdAt: "desc" }
    });

    if (!latestBatch) {
        throw new Error("No TSB batch found. Please run the creation step first.");
    }

    console.log(`Latest batch in DB: ${latestBatch.batchNumber} (Status: ${latestBatch.blockchainStatus})`);

    // Reset jobs for this batch so they run fresh
    await prisma.blockchainJob.updateMany({
        where: {
            entityRef: { in: [latestBatch.batchNumber] },
            status: "FAILED"
        },
        data: { status: "PENDING", attempts: 0, lastError: null }
    });

    const pills = await prisma.pill.findMany({
        where: { batchId: latestBatch.id }
    });
    const pillRefs = pills.map(p => p.qrCode);

    await prisma.blockchainJob.updateMany({
        where: {
            entityRef: { in: pillRefs },
            status: "FAILED"
        },
        data: { status: "PENDING", attempts: 0, lastError: null }
    });

    console.log("\nProcessing background queue (Loop)...");
    
    // We will call processAnchorQueue repeatedly until all jobs for this batch & its pills are processed.
    // Total jobs: 1 batch + 5 pills = 6 jobs.
    // Each invocation of processAnchorQueue processes 5 jobs. So we need at least 2 runs.
    let hasMore = true;
    let iteration = 1;
    while (hasMore && iteration <= 5) {
        console.log(`\n--- Queue Run ${iteration} ---`);
        const summary = await processAnchorQueue();
        console.log(`Run ${iteration} processed ${summary.processed} jobs.`);
        if (summary.results.length > 0) {
            console.log("Results:", JSON.stringify(summary.results, null, 2));
        }
        
        // Check if there are still pending jobs
        const pendingCount = await prisma.blockchainJob.count({
            where: { status: { in: ["PENDING", "PROCESSING"] } }
        });
        console.log(`Remaining pending/processing jobs: ${pendingCount}`);
        hasMore = pendingCount > 0;
        
        if (hasMore) {
            console.log("Waiting 6 seconds for transaction confirmations and nonce updates...");
            await new Promise(r => setTimeout(r, 6000));
        }
        iteration++;
    }

    console.log("\n3. Querying DB for Batch Status...");
    const batchInDb = await prisma.batch.findUnique({ where: { id: latestBatch.id } });
    console.log(`Batch ID: ${batchInDb?.id}`);
    console.log(`Batch blockchainStatus: ${batchInDb?.blockchainStatus}`);
    console.log(`Batch txHash: ${batchInDb?.txHash}`);
    console.log(`PolygonScan Link: https://amoy.polygonscan.com/tx/${batchInDb?.txHash}`);

    console.log("\n4. Querying DB for Pill Status...");
    const pillsInDb = await prisma.pill.findMany({
        where: { batchId: latestBatch.id },
        take: 2
    });

    for (const pill of pillsInDb) {
        console.log(`Pill QR: ${pill.qrCode}`);
        console.log(`Pill blockchainStatus: ${pill.blockchainStatus}`);
        console.log(`Pill blockchainTx: ${pill.blockchainTx}`);
        console.log(`PolygonScan Link: https://amoy.polygonscan.com/tx/${pill.blockchainTx}`);
    }

    console.log("\n5. Testing verifyPill flow...");
    const testPill = pillsInDb[0];
    
    // Reset scanned state to simulate a fresh scan
    await prisma.pill.update({
        where: { id: testPill.id },
        data: { qrScanned: false, scannedAt: null, verificationStatus: "UNVERIFIED" }
    });

    console.log(`Verifying pill QR: ${testPill.qrCode}...`);
    const verifyResult = await VerificationEngine.verify({
        code: testPill.qrCode,
        location: "Karachi, Pakistan",
        deviceInfo: "Live Test Script"
    });

    console.log("Verification Response:", JSON.stringify(verifyResult, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
