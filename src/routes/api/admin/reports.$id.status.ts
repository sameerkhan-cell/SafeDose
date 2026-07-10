import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ReportReviewService } from "@/server/services/admin/report-review.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/admin/reports/$id/status")({
    POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
            await authorizeRequest(request, [
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);

            const body = await request.json();
            const { status } = body;

            if (!status) {
                return Response.json(
                    ApiResponse.error("status field is required in the request body.", 400),
                    { status: 400 }
                );
            }

            const updated = await ReportReviewService.updateReportStatus(params.id, status);

            return Response.json(ApiResponse.success(updated, "Report status updated."));
        } catch (error: any) {
            const statusCode = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, statusCode), { status: statusCode });
        }
    },
});
