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

            const { buffer, fileName } = await PharmacyService.serveLicenseFile(
                payload.userId,
                pharmacyId,
                payload.role,
                fileParam
            );

            const ext = fileName.split(".").pop()?.toLowerCase();
            const contentType =
                ext === "pdf" ? "application/pdf" :
                ext === "png" ? "image/png" :
                ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                ext === "webp" ? "image/webp" : "application/octet-stream";

            return new Response(buffer, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `inline; filename="${fileName}"`,
                    "Cache-Control": "private, max-age=3600",
                },
            });
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
