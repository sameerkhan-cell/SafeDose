import { createAPIFileRoute } from "@/lib/api-route-helper";
import { AnalyticsService } from "@/server/services/analytics/analytics.service";
import { ApiResponse } from "@/server/utils/api-response";
import { authorizeRequest } from "@/server/middleware/auth.middleware";

export const Route = createAPIFileRoute("/api/fraud/metrics")({
    GET: async ({ request }: { request: Request }) => {
        try {
            await authorizeRequest(request, ["ADMIN", "REGULATOR", "MANUFACTURER", "PHARMACY"]);
            const metrics = await AnalyticsService.getGlobalFraudMetrics();
            return Response.json(ApiResponse.success(metrics));
        } catch (error: any) {
            return Response.json(ApiResponse.error(error.message, 401), { status: 401 });
        }
    },
});
