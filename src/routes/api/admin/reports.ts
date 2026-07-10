import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ReportReviewService } from "@/server/services/admin/report-review.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/admin/reports")({
    GET: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, [
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);

            const url = new URL(request.url);
            const role = url.searchParams.get("role") || undefined;
            const status = url.searchParams.get("status") || undefined;

            const reports = await ReportReviewService.listReports({ role, status });

            return Response.json(ApiResponse.success(reports, "Reports loaded successfully."));
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
