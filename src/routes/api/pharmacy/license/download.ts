import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { PharmacyService } from "@/server/services/pharmacy.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/pharmacy/license/download")({
    GET: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, [
                "PHARMACY",
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);

            const url = new URL(request.url);
            const pharmacyId = url.searchParams.get("pharmacyId");
            const fileParam = url.searchParams.get("file");

            if (!pharmacyId || !fileParam) {
                return Response.json(ApiResponse.error("Missing pharmacyId or file parameter.", 400), {
                    status: 400,
                });
            }

            const result = await PharmacyService.serveLicenseFile(
                payload.userId,
                pharmacyId,
                payload.role,
                fileParam
            );

            if (result.url) {
                return Response.redirect(result.url, 302);
            }

            return Response.json(ApiResponse.error("License file not available.", 404), { status: 404 });
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
