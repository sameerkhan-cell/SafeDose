/**
 * GET /api/manufacturer/stats
 *
 * Returns aggregated dashboard statistics for the authenticated manufacturer:
 *   - totalMedicines
 *   - totalBatches
 *   - totalPillsGenerated
 *   - activeBatches
 *   - expiredBatches
 *   - recalledBatches
 */
import { createAPIFileRoute } from "@/lib/api-route-helper";
import { BatchService } from "@/server/services/manufacturer/batch.service";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ApiResponse } from "@/server/utils/api-response";
import { prisma } from "@/server/db/client";

export const Route = createAPIFileRoute("/api/manufacturer/stats")({
    GET: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, ["MANUFACTURER"]);
            const stats = await BatchService.getDashboardStats(payload.userId);
            
            // Fetch last 10 confirmed blockchain jobs for this manufacturer/global
            const confirmedJobs = await prisma.blockchainJob.findMany({
                where: { status: "CONFIRMED" },
                orderBy: { updatedAt: "desc" },
                take: 10,
            });

            return Response.json(ApiResponse.success({
                ...stats,
                blockchainJobs: confirmedJobs.map(j => ({
                    id: j.id,
                    entityType: j.entityType,
                    entityId: j.entityId,
                    entityRef: j.entityRef,
                    status: j.status,
                    txHash: j.txHash,
                    updatedAt: j.updatedAt.toISOString(),
                })),
            }));
        } catch (error: any) {
            const status = error.statusCode || 401;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
