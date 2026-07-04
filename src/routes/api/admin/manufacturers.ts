import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ManufacturerReportService } from "@/server/services/admin/manufacturer-report.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/admin/manufacturers")({
    GET: async ({ request }: { request: Request }) => {
        try {
            await authorizeRequest(request, [
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);
            
            const manufacturers = await ManufacturerReportService.listManufacturers();
            
            return Response.json(ApiResponse.success(manufacturers, "Manufacturers loaded successfully."));
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
