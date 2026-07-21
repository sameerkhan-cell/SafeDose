import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { PharmacyAdminService } from "@/server/services/admin/pharmacy-admin.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/admin/pharmacies")({
    GET: async ({ request }: { request: Request }) => {
        try {
            await authorizeRequest(request, [
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);

            const pharmacies = await PharmacyAdminService.listPharmacies();
            
            return Response.json(ApiResponse.success(pharmacies, "Pharmacies loaded successfully."));
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
