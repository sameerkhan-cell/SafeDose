import { prisma } from "../src/server/db/client";
import { BlockchainService } from "../src/server/services/blockchain/blockchain.service";

const BATCH_NUMBER = "TM-DIAG-MRWTRYF0";
const PILL_NUMBER = "P1";

async function backfillConfirmedJobs() {
  const confirmedJobs = await prisma.blockchainJob.findMany({
    where: {
      status: "CONFIRMED",
      txHash: { not: null },
      OR: [{ gasUsed: null }, { blockNumber: null }],
    },
  });

  const provider = BlockchainService.getProvider();
  for (const job of confirmedJobs) {
    if (!job.txHash) continue;
    try {
      const receipt = await provider.getTransactionReceipt(job.txHash);
      if (!receipt) continue;
      await prisma.blockchainJob.update({
        where: { id: job.id },
        data: {
          gasUsed: receipt.gasUsed.toString(),
          blockNumber: receipt.blockNumber,
        },
      });
      console.log(`Backfilled job ${job.entityType} ${job.entityRef}: gas=${receipt.gasUsed}, block=${receipt.blockNumber}`);
    } catch (err: any) {
      console.warn(`Failed to backfill job ${job.id}:`, err?.message);
    }
  }
}

async function main() {
  await backfillConfirmedJobs();

  const batch = await prisma.batch.findFirst({
    where: { batchNumber: BATCH_NUMBER },
    include: { pills: true },
  });

  if (!batch) {
    console.error("Batch not found:", BATCH_NUMBER);
    return;
  }

  console.log("\n=== BATCH ===");
  console.log("batchNumber:", batch.batchNumber);
  console.log("txHash:", batch.txHash);
  console.log("blockchainStatus:", batch.blockchainStatus);

  const batchJob = await prisma.blockchainJob.findFirst({
    where: { entityType: "BATCH", entityId: batch.id, status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
  });
  console.log("\n=== BATCH BlockchainJob ===");
  console.log(JSON.stringify(batchJob, null, 2));

  const pill = batch.pills.find((p) => p.qrCode.includes("-P1")) ?? batch.pills[0];
  if (pill) {
    console.log("\n=== PILL P1 ===");
    console.log("pillNumber:", pill.pillNumber);
    console.log("blockchainTx:", pill.blockchainTx);
    console.log("blockchainStatus:", pill.blockchainStatus);

    const pillJob = await prisma.blockchainJob.findFirst({
      where: { entityType: "PILL", entityId: pill.id, status: "CONFIRMED" },
      orderBy: { createdAt: "desc" },
    });
    console.log("\n=== PILL BlockchainJob ===");
    console.log(JSON.stringify(pillJob, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
