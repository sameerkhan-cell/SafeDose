import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { PharmacyService } from "@/server/services/pharmacy.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/pharmacy/license-upload")({
    POST: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, ["PHARMACY"]);
            
            const contentType = request.headers.get("content-type") || "";
            let file: File | null = null;

            if (contentType.includes("multipart/form-data")) {
                const formData = await request.formData();
                file = formData.get("file") as File | null;
            }

            if (!file) {
                return Response.json(ApiResponse.error("No file uploaded.", 400), { status: 400 });
            }

            const profile = await PharmacyService.uploadLicense(payload.userId, file);

            return Response.json(
                ApiResponse.success(profile, "License document uploaded successfully.")
            );
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
