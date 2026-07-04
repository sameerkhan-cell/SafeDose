import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ManufacturerReportService } from "@/server/services/admin/manufacturer-report.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/admin/manufacturers/$id/report")({
    GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
            await authorizeRequest(request, [
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);
            
            const report = await ManufacturerReportService.getManufacturerReport(params.id);
            
            return Response.json(ApiResponse.success(report, "Manufacturer report loaded successfully."));
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
