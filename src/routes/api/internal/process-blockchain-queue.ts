/**
 * POST /api/internal/process-blockchain-queue
 *
 * ⚠️  SERVERLESS CRON ENDPOINT — This route is designed to be called by an
 * external scheduler every 15-30 seconds (e.g., cron-job.org or Vercel Cron).
 *
 * Authentication: requires the header  X-Cron-Secret: <CRON_SECRET env var>
 * Set CRON_SECRET to a random 32+ char string in your Vercel environment.
 *
 * HOW TO CONFIGURE EXTERNAL CRON:
 * ─────────────────────────────────────────────────────────────────────────────
 * Option A — cron-job.org (free):
 *   1. Go to https://cron-job.org → Create job
 *   2. URL: https://your-domain.vercel.app/api/internal/process-blockchain-queue
 *   3. Method: POST
 *   4. Header: X-Cron-Secret = <your CRON_SECRET value>
 *   5. Schedule: every 30 seconds (use two jobs at :00 and :30 if needed)
 *
 * Option B — Vercel Cron (Pro plan):
 *   Add to vercel.json:
 *   {
 *     "crons": [
 *       { "path": "/api/internal/process-blockchain-queue", "schedule": "* * * * *" }
 *     ]
 *   }
 *   Vercel crons fire via GET; change the handler below to also accept GET if using Vercel Cron.
 *
 * This endpoint will do nothing harmful if called too frequently — it simply
 * returns early with processed=0 when no PENDING jobs exist.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createAPIFileRoute } from "@/lib/api-route-helper";
import { processAnchorQueue } from "@/server/services/blockchain/blockchain.worker";
import { ApiResponse } from "@/server/utils/api-response";

function getCronSecret(): string | null {
    const secret = (process.env.CRON_SECRET || "").trim();
    return secret || null;
}

function validateCronAuth(request: Request, cronSecret: string): boolean {
    const authHeader = request.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
    const xCronSecret = request.headers.get("x-cron-secret") ?? "";
    const providedSecret = (xCronSecret || bearerToken).trim();
    return providedSecret.length > 0 && providedSecret === cronSecret;
}

export const Route = createAPIFileRoute("/api/internal/process-blockchain-queue")({
    POST: async ({ request }: { request: Request }) => {
        const cronSecret = getCronSecret();
        if (!cronSecret) {
            return Response.json(
                ApiResponse.error("CRON_SECRET not configured on server", 500),
                { status: 500 }
            );
        }

        if (!validateCronAuth(request, cronSecret)) {
            return Response.json(
                ApiResponse.error("Unauthorized: invalid or missing cron secret header", 401),
                { status: 401 }
            );
        }

        try {
            const summary = await processAnchorQueue();
            return Response.json(
                ApiResponse.success({
                    message: `Queue processed: ${summary.confirmed} confirmed, ${summary.failed} failed of ${summary.processed} jobs`,
                    ...summary,
                })
            );
        } catch (err: any) {
            console.error("[CRON] processAnchorQueue unexpected error:", err);
            return Response.json(
                ApiResponse.error(`Queue processor failed: ${err?.message}`, 500),
                { status: 500 }
            );
        }
    },

    GET: async ({ request }: { request: Request }) => {
        const cronSecret = getCronSecret();
        if (!cronSecret) {
            return Response.json(
                ApiResponse.error("CRON_SECRET not configured on server", 500),
                { status: 500 }
            );
        }

        if (!validateCronAuth(request, cronSecret)) {
            return Response.json(
                ApiResponse.error("Unauthorized: invalid or missing cron secret header", 401),
                { status: 401 }
            );
        }
        try {
            const summary = await processAnchorQueue();
            return Response.json(ApiResponse.success({ ...summary }));
        } catch (err: any) {
            return Response.json(
                ApiResponse.error(`Queue processor failed: ${err?.message}`, 500),
                { status: 500 }
            );
        }
    },
});
