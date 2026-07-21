import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";
import { BlockchainService } from "@/server/services/blockchain/blockchain.service";

export const Route = createAPIFileRoute("/api/blockchain/status")({
    GET: async () => {
        try {
            const isConfigured =
                !!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS &&
                !!process.env.BLOCKCHAIN_SIGNER_KEY;

            const signerBalance = isConfigured
                ? await BlockchainService.getSignerBalance()
                : "0.0";

            // ── Batch counts by blockchainStatus ──────────────────────────────
            const batchGroups = await prisma.batch.groupBy({
                by: ["blockchainStatus"],
                _count: { _all: true },
            });
            const batchCounts = Object.fromEntries(
                batchGroups.map((g) => [g.blockchainStatus, g._count._all])
            );

            // ── Pill counts by blockchainStatus ───────────────────────────────
            const pillGroups = await prisma.pill.groupBy({
                by: ["blockchainStatus"],
                _count: { _all: true },
            });
            const pillCounts = Object.fromEntries(
                pillGroups.map((g) => [g.blockchainStatus, g._count._all])
            );

            // ── Queue job counts by status ─────────────────────────────────────
            const jobGroups = await prisma.blockchainJob.groupBy({
                by: ["status", "entityType"],
                _count: { _all: true },
            });

            // ── Last 5 failed jobs (errors visible to admin) ──────────────────
            const recentErrors = await prisma.blockchainJob.findMany({
                where: { status: { in: ["FAILED", "PENDING"] }, lastError: { not: null } },
                orderBy: { updatedAt: "desc" },
                take: 5,
                select: {
                    id: true,
                    entityType: true,
                    entityRef: true,
                    status: true,
                    attempts: true,
                    lastError: true,
                    updatedAt: true,
                },
            });

            return Response.json(
                ApiResponse.success({
                    network: "Polygon Amoy Testnet",
                    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
                    rpcUrl: process.env.POLYGON_AMOY_RPC,
                    status: isConfigured ? "OPERATIONAL" : "PENDING_CONFIGURATION",
                    signerBalance,

                    // On-chain anchoring progress (visible during demo)
                    batches: {
                        confirmed: batchCounts["CONFIRMED"] ?? 0,
                        pending: batchCounts["PENDING"] ?? 0,
                        failed: batchCounts["FAILED"] ?? 0,
                    },
                    pills: {
                        confirmed: pillCounts["CONFIRMED"] ?? 0,
                        pending: pillCounts["PENDING"] ?? 0,
                        failed: pillCounts["FAILED"] ?? 0,
                    },

                    // Queue health
                    queue: {
                        breakdown: jobGroups.map((g) => ({
                            entityType: g.entityType,
                            status: g.status,
                            count: g._count._all,
                        })),
                    },

                    // Last errors for admin diagnosis
                    recentErrors,
                })
            );
        } catch (e: any) {
            console.error("[API] /api/blockchain/status error:", e);
            return Response.json(
                ApiResponse.error("Blockchain status check failed: " + (e?.message ?? "unknown"), 503),
                { status: 503 }
            );
        }
    },
});
