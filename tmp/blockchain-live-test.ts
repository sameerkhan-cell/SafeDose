import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../src/server/db/client";
import { BatchService } from "../src/server/services/manufacturer/batch.service";
import { processAnchorQueue } from "../src/server/services/blockchain/blockchain.worker";
import { VerificationEngine } from "../src/server/services/verification.service";

async function main() {
    console.log("=== MediVerify Live Diagnostic Run ===");

    // Find the test manufacturer (using elinaalfie22298@gmail.com which exists in DB)
    const manufacturerUser = await prisma.user.findFirst({
        where: { email: "elinaalfie22298@gmail.com" },
        include: { manufacturer: true }
    });

    if (!manufacturerUser || !manufacturerUser.manufacturer) {
        throw new Error("Manufacturer elinaalfie22298@gmail.com not found.");
    }

    console.log(`Using manufacturer: ${manufacturerUser.name} (${manufacturerUser.email})`);
    
    // Ensure manufacturer is verified and active so BatchService doesn't block it
    await prisma.manufacturer.update({
        where: { id: manufacturerUser.manufacturer.id },
        data: { isVerified: true, isSuspended: false, verificationStatus: "VERIFIED" }
    });

    const batchNumber = `TSB-${Date.now()}`;
    console.log(`\n1. Creating test batch: ${batchNumber} with 5 pills...`);
    const regData = {
        medicineName: "panadol",
        batchNumber,
        manufacturingDate: new Date("2024-01-01").toISOString(),
        expiryDate: new Date("2027-12-01").toISOString(),
        quantityBoxes: 1,
        pillsPerBox: 5,
        allowsExtension: false
    };

    const registrationResult = await BatchService.registerBatch(manufacturerUser.id, regData);
    console.log(`Batch created in DB. ID: ${registrationResult.batch.id}. Pills generated: ${registrationResult.pills.length}`);

    // Check status in DB right after creation
    let batchInDb = await prisma.batch.findUnique({ where: { id: registrationResult.batch.id } });
    console.log(`Initial Batch blockchainStatus in DB: ${batchInDb?.blockchainStatus}`);

    console.log("\n2. Processing background queue (Run 1)...");
    // Since BATCH is sorted first, Run 1 will process the Batch job + 4 of the Pill jobs (total 5 jobs)
    let run1 = await processAnchorQueue();
    console.log(`Run 1 processed ${run1.processed} jobs. Results:`, JSON.stringify(run1.results, null, 2));

    console.log("Waiting 3 seconds for confirmations and nonces to settle...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("\nProcessing background queue (Run 2)...");
    // Run 2 will process the remaining Pill job
    let run2 = await processAnchorQueue();
    console.log(`Run 2 processed ${run2.processed} jobs. Results:`, JSON.stringify(run2.results, null, 2));

    console.log("\n3. Querying DB for Batch Status...");
    batchInDb = await prisma.batch.findUnique({ where: { id: registrationResult.batch.id } });
    console.log(`Batch ID: ${batchInDb?.id}`);
    console.log(`Batch blockchainStatus: ${batchInDb?.blockchainStatus}`);
    console.log(`Batch txHash: ${batchInDb?.txHash}`);
    console.log(`PolygonScan Link: https://amoy.polygonscan.com/tx/${batchInDb?.txHash}`);

    console.log("\n4. Querying DB for Pill Status...");
    const pillsInDb = await prisma.pill.findMany({
        where: { batchId: registrationResult.batch.id },
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
