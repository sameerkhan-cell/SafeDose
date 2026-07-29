import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { DrapBatchRegistryService } from "@/server/services/admin/drap-batch-registry.service";
import { ApiResponse } from "@/server/utils/api-response";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"] as const;

export const Route = createAPIFileRoute("/api/admin/drap-batches/pdf/extract")({
    POST: async ({ request }: { request: Request }) => {
        try {
            await authorizeRequest(request, [...ALLOWED_ROLES]);

            const contentType = request.headers.get("content-type") ?? "";
            if (!contentType.includes("multipart/form-data")) {
                return Response.json(
                    ApiResponse.error("Expected multipart/form-data with a 'file' field.", 400),
                    { status: 400 }
                );
            }

            const formData = await request.formData();
            const file = formData.get("file") as File | null;
            if (!file) {
                return Response.json(
                    ApiResponse.error("No file provided. Send a PDF file in the 'file' field.", 400),
                    { status: 400 }
                );
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const result = await DrapBatchRegistryService.extractPdfTable(buffer);

            if (!result.success) {
                return Response.json(
                    ApiResponse.error(result.error || "Could not detect a table structure in this PDF — try CSV or Excel instead.", 400),
                    { status: 400 }
                );
            }

            return Response.json(ApiResponse.success(result));
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },
});
