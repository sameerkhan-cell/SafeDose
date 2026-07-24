import { prisma } from "../src/server/db/client";
import { BlockchainService } from "../src/server/services/blockchain/blockchain.service";
import { processAnchorQueue } from "../src/server/services/blockchain/blockchain.worker";
import { VerificationEngine } from "../src/server/services/verification.service";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    console.log("=== RUNNING QUEUE WORKER PASS 2 ===");
    const res = await processAnchorQueue();
    console.log("Worker pass 2 result:", res);

    console.log("Waiting 15 seconds for chain confirmations...");
    await sleep(15000);

    const batch = await prisma.batch.findFirst({
        where: { batchNumber: "TM-DIAG-MRWTRYF0" },
        include: { pills: { orderBy: { pillNumber: "asc" } }, boxes: true }
    });

    console.log(`\nBatch ${batch?.batchNumber} blockchainStatus: ${batch?.blockchainStatus}, txHash: ${batch?.txHash}`);
    for (const pill of batch?.pills || []) {
        console.log(`Pill ID: ${pill.id} | QR: ${pill.qrCode} | Status: ${pill.blockchainStatus} | txHash: ${pill.blockchainTx}`);
    }

    console.log("\n=== VERIFYING NOW CONFIRMED PILL ===");
    const confirmedPill = batch?.pills[0];
    const pharmacyUser = await prisma.user.findFirst({ where: { role: "PHARMACY" } });
    const patientUser = await prisma.user.findFirst({ where: { role: "PATIENT" } });

    if (batch?.boxes[0]) {
        console.log(`Pharmacy box scan: ${batch.boxes[0].qrCode}`);
        await VerificationEngine.verify({
            code: batch.boxes[0].qrCode,
            location: "Pharmacy Lab",
            userId: pharmacyUser?.id
        });
    }

    if (confirmedPill) {
        console.log(`Patient pill scan: ${confirmedPill.qrCode}`);
        const vRes = await VerificationEngine.verify({
            code: confirmedPill.qrCode,
            location: "Patient Home",
            userId: patientUser?.id
        });
        console.log("Verification Response:", JSON.stringify(vRes, null, 2));
    }

    console.log("Waiting 15s for verification transaction confirmation...");
    await sleep(15000);

    const finalPill = await prisma.pill.findUnique({ where: { id: confirmedPill?.id } });
    const jobs = await prisma.blockchainJob.findMany({
        where: { entityRef: confirmedPill?.qrCode },
        orderBy: { createdAt: "asc" }
    });

    console.log("\nFinal Blockchain Jobs for pill:", jobs);
    const balance = await BlockchainService.getSignerBalance();
    console.log(`Final Signer POL Balance: ${balance} POL`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
