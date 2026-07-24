// Run with: npx tsx check-db-empty.ts
// Place this file in your project root (same level as prisma/), then run the command above.
// It prints the row count for every table so you can confirm the reset worked
// and see exactly what (if anything) still has data.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const models = [
    "user", "session", "manufacturer", "exportAnalytics", "manufacturerDocument",
    "documentAuditLog", "pharmacy", "medicine", "batchSequence", "dRAPRecall",
    "batch", "pill", "carton", "box", "qRDownload", "qRAsset", "auditLog",
    "verificationLog", "fraudAlert", "riskScore", "geoAnalytics", "recall",
    "adminActionLog", "surveillanceEvent", "report", "aIInsight", "liveEvent",
    "riskForecast", "notification", "blockchainTransaction", "blockchainJob",
    "drapBatchRegistry", "drapBatchScanLog",
  ];

  console.log("\n=== DATABASE ROW COUNTS ===\n");
  let totalRows = 0;
  const nonEmpty: string[] = [];

  for (const model of models) {
    try {
      // @ts-ignore - dynamic model access
      const count = await prisma[model].count();
      const marker = count > 0 ? "⚠️ " : "✅ ";
      console.log(`${marker}${model.padEnd(25)} ${count}`);
      totalRows += count;
      if (count > 0) nonEmpty.push(`${model} (${count})`);
    } catch (e: any) {
      console.log(`❌ ${model.padEnd(25)} ERROR: ${e.message}`);
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Total rows across all tables: ${totalRows}`);
  if (nonEmpty.length === 0) {
    console.log("Database is completely empty. ✅");
  } else {
    console.log(`Tables with data: ${nonEmpty.join(", ")}`);
    console.log("\nIf only 'user' shows 1 row (your admin), that's expected and correct.");
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
