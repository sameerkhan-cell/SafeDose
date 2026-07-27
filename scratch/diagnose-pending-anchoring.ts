import { prisma } from "../src/server/db/client";
import { BlockchainService } from "../src/server/services/blockchain/blockchain.service";

async function main() {
  const now = new Date();

  console.log("=== 1. SIGNER WALLET ===");
  const address = BlockchainService.getWalletAddress();
  const balance = await BlockchainService.getSignerBalance();
  console.log("Address:", address ?? "(not configured)");
  console.log("Balance:", balance, "POL");

  console.log("\n=== 2. BLOCKCHAIN JOB QUEUE ===");
  const jobsByStatus = await prisma.blockchainJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log("By status:", Object.fromEntries(jobsByStatus.map((g) => [g.status, g._count._all])));

  const pendingJobs = await prisma.blockchainJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      entityType: true,
      entityRef: true,
      entityId: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  console.log(`\nPENDING jobs (${pendingJobs.length}):`);
  for (const j of pendingJobs) {
    const ageSec = Math.round((now.getTime() - j.createdAt.getTime()) / 1000);
    console.log(
      `  ${j.entityType} ${j.entityRef} | age=${ageSec}s (${Math.round(ageSec / 60)}m) | attempts=${j.attempts} | lastError=${j.lastError?.slice(0, 120) ?? "null"}`
    );
  }

  const failedJobs = await prisma.blockchainJob.findMany({
    where: { status: "FAILED" },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      entityType: true,
      entityRef: true,
      attempts: true,
      lastError: true,
      updatedAt: true,
    },
  });
  console.log(`\nFAILED jobs (${failedJobs.length} shown, max 10):`);
  for (const j of failedJobs) {
    console.log(`  ${j.entityType} ${j.entityRef} | attempts=${j.attempts}`);
    console.log(`    lastError: ${j.lastError}`);
  }

  const lastConfirmed = await prisma.blockchainJob.findFirst({
    where: { status: "CONFIRMED" },
    orderBy: { updatedAt: "desc" },
    select: { entityType: true, entityRef: true, txHash: true, updatedAt: true },
  });
  console.log("\nMost recent CONFIRMED job:", lastConfirmed);
  if (lastConfirmed) {
    const agoSec = Math.round((now.getTime() - lastConfirmed.updatedAt.getTime()) / 1000);
    console.log(`  (${agoSec}s / ${Math.round(agoSec / 3600)}h ago)`);
  }

  console.log("\n=== 4. LATEST VERIFICATION LOG + PILL ===");
  const latestLog = await prisma.verificationLog.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      pill: {
        include: {
          batch: { select: { batchNumber: true, blockchainStatus: true, txHash: true } },
        },
      },
      user: { select: { role: true, email: true } },
    },
  });
  if (!latestLog) {
    console.log("No verification logs found.");
  } else {
    console.log("Latest VerificationLog:");
    console.log("  id:", latestLog.id);
    console.log("  code:", latestLog.code);
    console.log("  status:", latestLog.status);
    console.log("  createdAt:", latestLog.createdAt.toISOString());
    console.log("  user role:", latestLog.user?.role ?? "anonymous");
    console.log("  pillId:", latestLog.pillId);
    if (latestLog.pill) {
      console.log("  pill.pillNumber:", latestLog.pill.pillNumber);
      console.log("  pill.qrCode:", latestLog.pill.qrCode);
      console.log("  pill.blockchainStatus:", latestLog.pill.blockchainStatus);
      console.log("  pill.blockchainTx:", latestLog.pill.blockchainTx);
      console.log("  batch.blockchainStatus:", latestLog.pill.batch.blockchainStatus);
      console.log("  batch.txHash:", latestLog.pill.batch.txHash);

      const pillJob = await prisma.blockchainJob.findFirst({
        where: { entityType: "PILL", entityId: latestLog.pill.id },
        orderBy: { createdAt: "desc" },
      });
      console.log("  pill BlockchainJob:", pillJob
        ? { status: pillJob.status, txHash: pillJob.txHash, lastError: pillJob.lastError?.slice(0, 100) }
        : "none");
    } else {
      console.log("  (no linked pill)");
    }
  }

  // Also get latest patient/pharmacy role scans specifically
  const latestRoleLog = await prisma.verificationLog.findFirst({
    where: { user: { role: { in: ["PATIENT", "PHARMACY"] } } },
    orderBy: { createdAt: "desc" },
    include: {
      pill: true,
      user: { select: { role: true } },
    },
  });
  if (latestRoleLog?.pill) {
    console.log("\nLatest PATIENT/PHARMACY scan pill:");
    console.log("  role:", latestRoleLog.user?.role);
    console.log("  qr:", latestRoleLog.code);
    console.log("  pill.blockchainStatus:", latestRoleLog.pill.blockchainStatus);
    console.log("  pill.blockchainTx:", latestRoleLog.pill.blockchainTx);
  }

  console.log("\n=== PILL/BATCH STATUS SUMMARY ===");
  const pillGroups = await prisma.pill.groupBy({ by: ["blockchainStatus"], _count: { _all: true } });
  const batchGroups = await prisma.batch.groupBy({ by: ["blockchainStatus"], _count: { _all: true } });
  console.log("Pills:", Object.fromEntries(pillGroups.map((g) => [g.blockchainStatus, g._count._all])));
  console.log("Batches:", Object.fromEntries(batchGroups.map((g) => [g.blockchainStatus, g._count._all])));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
