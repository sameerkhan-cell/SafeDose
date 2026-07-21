import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { PharmacyService } from "@/server/services/pharmacy.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/pharmacy/profile")({
    GET: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, ["PHARMACY"]);
            const profile = await PharmacyService.getProfile(payload.userId);
            return Response.json(ApiResponse.success(profile, "Pharmacy profile loaded successfully."));
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },

    PUT: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, ["PHARMACY"]);
            const body = await request.json();
            const profile = await PharmacyService.updateProfile(payload.userId, body);
            return Response.json(ApiResponse.success(profile, "Pharmacy profile updated successfully."));
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
