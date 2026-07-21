/**
 * POST /api/internal/retry-blockchain-jobs
 *
 * ⚠️  ADMIN UTILITY ENDPOINT — Resets all BlockchainJob queue records in "FAILED"
 * status back to "PENDING" and resets attempts to 0. This allows the background
 * queue to re-attempt anchoring operations after gas token refunds or contract fixes.
 *
 * Authentication: requires the header  X-Cron-Secret: <CRON_SECRET env var>
 * Set CRON_SECRET to a random 32+ char string in your Vercel environment.
 */

import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";

const CRON_SECRET = process.env.CRON_SECRET || "";

export const Route = createAPIFileRoute("/api/internal/retry-blockchain-jobs")({
    POST: async ({ request }: { request: Request }) => {
        // ── Auth guard ──────────────────────────────────────────────────────
        if (!CRON_SECRET) {
            return Response.json(
                ApiResponse.error("CRON_SECRET env var not configured", 500),
                { status: 500 }
            );
        }

        const providedSecret = request.headers.get("x-cron-secret") ?? "";
        if (providedSecret !== CRON_SECRET) {
            return Response.json(
                ApiResponse.error("Unauthorized", 401),
                { status: 401 }
            );
        }

        try {
            // Find all failed jobs to know what we are resetting
            const failedJobs = await prisma.blockchainJob.findMany({
                where: { status: "FAILED" }
            });

            if (failedJobs.length === 0) {
                return Response.json(
                    ApiResponse.success({
                        message: "No failed blockchain jobs found to retry.",
                        resetCount: 0
                    })
                );
            }

            // Extract BATCH and PILL IDs to reset their DB statuses too
            const batchIds = failedJobs
                .filter(j => j.entityType === "BATCH")
                .map(j => j.entityId);
            const pillIds = failedJobs
                .filter(j => j.entityType === "PILL")
                .map(j => j.entityId);

            // Update jobs in DB
            const updateResult = await prisma.blockchainJob.updateMany({
                where: { status: "FAILED" },
                data: {
                    status: "PENDING",
                    attempts: 0,
                    lastError: null
                }
            });

            // Also reset parent statuses back to PENDING so UI reflects the retry
            if (batchIds.length > 0) {
                await prisma.batch.updateMany({
                    where: { id: { in: batchIds } },
                    data: { blockchainStatus: "PENDING" }
                });
            }

            if (pillIds.length > 0) {
                await prisma.pill.updateMany({
                    where: { id: { in: pillIds } },
                    data: { blockchainStatus: "PENDING" }
                });
            }

            return Response.json(
                ApiResponse.success({
                    message: `Successfully reset ${updateResult.count} failed jobs back to PENDING.`,
                    resetCount: updateResult.count,
                    entitiesReset: {
                        batches: batchIds.length,
                        pills: pillIds.length
                    }
                })
            );
        } catch (err: any) {
            console.error("[ADMIN] retry-blockchain-jobs failed:", err);
            return Response.json(
                ApiResponse.error(`Failed to reset jobs: ${err?.message}`, 500),
                { status: 500 }
            );
        }
    },
});
