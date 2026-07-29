import { prisma } from "./src/server/db/client.js";

async function main() {
  console.log("=== Finding Gauze Swab Records ===");

  const drapRecords = await prisma.drapBatchRegistry.findMany({
    where: {
      medicine: {
        name: { contains: "Gauze" }
      }
    },
    include: {
      medicine: true
    }
  });

  console.log(`Found ${drapRecords.length} DRAP Registry records for Gauze:`);
  for (const r of drapRecords) {
    console.log(`  ID: ${r.id} | Med: ${r.medicine.name} | Batch: ${r.batchCode} | Barcode: ${r.barcode} | Mfr: ${r.companyName}`);
  }

  const batches = await prisma.batch.findMany({
    where: {
      medicine: {
        name: { contains: "Gauze" }
      }
    },
    include: {
      medicine: true
    }
  });
  console.log(`\nFound ${batches.length} Batch records for Gauze:`);
  for (const b of batches) {
    console.log(`  ID: ${b.id} | Med: ${b.medicine.name} | Batch: ${b.batchNumber}`);
  }

  const medicines = await prisma.medicine.findMany({
    where: {
      name: { contains: "Gauze" }
    }
  });
  console.log(`\nFound ${medicines.length} Medicine records for Gauze:`);
  for (const m of medicines) {
    console.log(`  ID: ${m.id} | Name: ${m.name}`);
  }

  // 1. Delete matching DrapBatchRegistry records
  if (drapRecords.length > 0) {
    const deletedDrap = await prisma.drapBatchRegistry.deleteMany({
      where: {
        medicine: {
          name: { contains: "Gauze" }
        }
      }
    });
    console.log(`\n✓ Deleted ${deletedDrap.count} DRAP Batch Registry record(s).`);
  }

  // 2. Delete matching Batch records
  if (batches.length > 0) {
    const deletedBatches = await prisma.batch.deleteMany({
      where: {
        medicine: {
          name: { contains: "Gauze" }
        }
      }
    });
    console.log(`✓ Deleted ${deletedBatches.count} Batch record(s).`);
  }

  // 3. Delete matching Medicine records
  if (medicines.length > 0) {
    const deletedMeds = await prisma.medicine.deleteMany({
      where: {
        name: { contains: "Gauze" }
      }
    });
    console.log(`✓ Deleted ${deletedMeds.count} Medicine record(s).`);
  }

  console.log("\nDone cleaning up Gauze Swab data.");
}

main().catch(console.error).finally(() => prisma.$disconnect());

