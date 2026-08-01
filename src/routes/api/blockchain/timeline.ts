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

        const isVerifAnchor = job.entityType === "VERIFICATION_ANCHOR";
        let actor = isBatch ? "Manufacturer (Batch Anchor)" : isPill ? "Pill Registration" : "Verification Anchor";
        let detail = job.lastError
          ? `Job status: ${job.status}. Details: ${job.lastError}`
          : `Blockchain anchoring for ${job.entityType} ${job.entityRef || job.entityId} ${isConfirmed ? "confirmed on-chain" : "processing"}.`;

        const gasUsed = parseGasUsed(job.gasUsed);

        // Determine an accurate txHash label when no real hash is available:
        // • VERIFICATION_ANCHOR rows are error-log records, never pending chain ops —
        //   the medicine itself IS on-chain; the scan simply happened before the pill
        //   was anchored. Show an honest label rather than "Pending Anchoring".
        // • FAILED BATCH/PILL jobs exhausted retries — show that clearly.
        // • Genuinely PENDING/PROCESSING jobs are the only real "Pending Anchoring" case.
        let txHashDisplay: string;
        if (resolvedHash) {
          txHashDisplay = resolvedHash;
        } else if (isVerifAnchor) {
          txHashDisplay = "Scan logged (medicine confirmed on-chain)";
        } else if (job.status === "FAILED") {
          txHashDisplay = "Anchoring failed — see details";
        } else {
          txHashDisplay = "Pending Anchoring";
        }

        return {
          id: `job-${job.id}`,
          txHash: txHashDisplay,
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

        // Determine accurate txHash label when no real hash is resolvable:
        // • No pill relation (pillId null) → DRAP barcode / off-chain scan; never blockchain-anchored.
        // • Pill relation exists but tx still null → pill genuinely pending anchoring.
        let logTxDisplay: string;
        if (resolvedHash) {
          logTxDisplay = resolvedHash;
        } else if (!log.pillId) {
          // Barcode scan (DRAP registry item) — no pill QR registered on-chain
          logTxDisplay = "Off-chain scan — DRAP registry item";
        } else {
          // Pill exists; tx not yet resolved (legitimately still pending)
          logTxDisplay = "Pending Anchoring";
        }

        return {
          id: `log-${log.id}`,
          txHash: logTxDisplay,
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
