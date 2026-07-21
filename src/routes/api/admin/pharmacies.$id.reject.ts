import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { PharmacyAdminService } from "@/server/services/admin/pharmacy-admin.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/admin/pharmacies/$id/reject")({
    PUT: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
            const payload = await authorizeRequest(request, [
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);
            const body = await request.json().catch(() => ({}));
            const remarks = body.remarks || "Rejected by DRAP Admin";

            const pharmacy = await PharmacyAdminService.rejectPharmacy(
                payload.userId,
                params.id,
                remarks
            );
            return Response.json(ApiResponse.success(pharmacy, "Pharmacy license rejected."));
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
