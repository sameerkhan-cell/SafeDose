import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";
import { formatDistanceToNow } from "date-fns";

const ZERO_HASH = "0x0000000000000000000000000000000000000000";

function resolveTxHash(hash: string | null | undefined): string | null {
  if (!hash || hash === ZERO_HASH) return null;
  return hash;
}

function parseGasUsed(gasUsed: string | null | undefined): number | null {
  if (!gasUsed) return null;
  const parsed = parseInt(gasUsed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export const Route = createAPIFileRoute("/api/blockchain/timeline")({
  GET: async () => {
    try {
      const [jobs, logs] = await Promise.all([
        prisma.blockchainJob.findMany({
          take: 30,
          orderBy: { createdAt: "desc" },
        }),
        prisma.verificationLog.findMany({
          take: 30,
          orderBy: { createdAt: "desc" },
          include: {
            user: true,
            pill: {
              include: {
                batch: {
                  include: { medicine: { include: { manufacturer: true } } },
                },
              },
            },
          },
        }),
      ]);

      const pillIds = logs.map((log) => log.pillId).filter(Boolean) as string[];
      const batchIds = [...new Set(logs.map((log) => log.pill?.batchId).filter(Boolean))] as string[];

      const [pillJobs, batchJobs] = await Promise.all([
        pillIds.length > 0
          ? prisma.blockchainJob.findMany({
              where: { entityType: "PILL", entityId: { in: pillIds }, status: "CONFIRMED" },
              orderBy: { createdAt: "desc" },
            })
          : Promise.resolve([]),
        batchIds.length > 0
          ? prisma.blockchainJob.findMany({
              where: { entityType: "BATCH", entityId: { in: batchIds }, status: "CONFIRMED" },
              orderBy: { createdAt: "desc" },
            })
          : Promise.resolve([]),
      ]);

      const pillJobByEntityId = new Map<string, (typeof pillJobs)[number]>();
      for (const job of pillJobs) {
        if (!pillJobByEntityId.has(job.entityId)) {
          pillJobByEntityId.set(job.entityId, job);
        }
      }

      const batchJobByEntityId = new Map<string, (typeof batchJobs)[number]>();
      for (const job of batchJobs) {
        if (!batchJobByEntityId.has(job.entityId)) {
          batchJobByEntityId.set(job.entityId, job);
        }
      }

      const formattedJobs = jobs.map((job) => {
        const isBatch = job.entityType === "BATCH";
        const isPill = job.entityType === "PILL";
        const isConfirmed = job.status === "CONFIRMED";
        const resolvedHash = resolveTxHash(job.txHash);

        let status: "verified" | "transfer" | "suspicious" | "scan" | "flagged" = isConfirmed
          ? "verified"
          : job.status === "FAILED"
          ? "flagged"
          : "transfer";

        let actor = isBatch ? "Manufacturer (Batch Anchor)" : isPill ? "Pill Registration" : "Verification Anchor";
        let detail = job.lastError
          ? `Job status: ${job.status}. Details: ${job.lastError}`
          : `Blockchain anchoring for ${job.entityType} ${job.entityRef || job.entityId} ${isConfirmed ? "confirmed on-chain" : "processing"}.`;

        const gasUsed = parseGasUsed(job.gasUsed);

        return {
          id: `job-${job.id}`,
          txHash: resolvedHash ?? "Pending Anchoring",
          actor,
          role: isBatch ? "Manufacturer" : isPill ? "Batch Unit" : "Verification Log",
          location: "Polygon Amoy Network",
          timestamp: formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }),
          rawDate: job.createdAt,
          status,
          medicineStatus: isConfirmed ? "Confirmed On-Chain" : job.status,
          blockNumber: isConfirmed && job.blockNumber ? job.blockNumber : 0,
          confirmations: isConfirmed ? 12 : 0,
          detail,
          ...(gasUsed !== null ? { gasUsed } : {}),
        };
      });

      const formattedLogs = logs.map((log) => {
        const medName = log.pill?.batch?.medicine?.name || log.code || "Medicine";
        const isGenuine = log.status === "GENUINE";
        const isDuplicate = log.status === "DUPLICATE";

        let status: "verified" | "transfer" | "suspicious" | "scan" | "flagged" = isGenuine
          ? "scan"
          : isDuplicate
          ? "suspicious"
          : "flagged";

        let actor = log.user?.name || (log.userId ? "Registered User" : "Public Scanner");
        let detail = `Scan code ${log.code} verified as ${log.status} at ${log.location || "Unknown Location"}.`;

        const pillJob = log.pillId ? pillJobByEntityId.get(log.pillId) : undefined;
        const batchJob = log.pill?.batchId ? batchJobByEntityId.get(log.pill.batchId) : undefined;
        const chainJob = pillJob ?? batchJob;

        const resolvedHash =
          resolveTxHash(log.pill?.blockchainTx) ||
          resolveTxHash(log.pill?.batch?.txHash) ||
          resolveTxHash(chainJob?.txHash);

        const gasUsed = parseGasUsed(chainJob?.gasUsed);
        const blockNumber = chainJob?.blockNumber ?? 0;

        return {
          id: `log-${log.id}`,
          txHash: resolvedHash ?? "Pending Anchoring",
          actor: `${medName} — ${actor}`,
          role: log.user?.role || "Public Scanner",
          location: log.location || "Unknown Location",
          timestamp: formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }),
          rawDate: log.createdAt,
          status,
          medicineStatus: String(log.status),
          blockNumber,
          confirmations: blockNumber > 0 ? 24 : 0,
          detail,
          ...(gasUsed !== null ? { gasUsed } : {}),
        };
      });

      const combined = [...formattedJobs, ...formattedLogs].sort(
        (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()
      );

      return Response.json(ApiResponse.success(combined));
    } catch (error: any) {
      return Response.json(
        ApiResponse.error(error?.message || "Failed to load timeline", 500),
        { status: 500 }
      );
    }
  },
});
