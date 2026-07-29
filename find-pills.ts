import { prisma } from "./src/server/db/client";

async function findPills() {
  console.log("=== Searching database for PillVerification and Batch records ===");
  
  // Search PillVerification table
  const pills = await prisma.pillVerification.findMany({
    take: 20,
    include: {
      batch: true,
      box: true
    }
  });

  console.log(`Found ${pills.length} PillVerification records:`);
  for (const p of pills) {
    console.log(`- Pill QR: ${p.pillQR || (p as any).id} | Batch: ${p.batch?.batchNumber} | PillTx: ${p.blockchainTx} | BatchTx: ${p.batch?.blockchainTxHash}`);
  }

  // Search Batch table
  const batches = await prisma.batch.findMany({
    take: 20,
    include: {
      medicine: true
    }
  });

  console.log(`\nFound ${batches.length} Batch records:`);
  for (const b of batches) {
    console.log(`- Batch ID: ${b.id} | BatchNo: ${b.batchNumber} | Med: ${b.medicine?.name} | TxHash: ${b.blockchainTxHash}`);
  }
}

findPills().catch(console.error).finally(() => prisma.$disconnect());
