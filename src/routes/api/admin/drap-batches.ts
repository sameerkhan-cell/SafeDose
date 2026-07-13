import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { DrapBatchRegistryService } from "@/server/services/admin/drap-batch-registry.service";
import { ApiResponse } from "@/server/utils/api-response";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"] as const;

export const Route = createAPIFileRoute("/api/admin/drap-batches")({
    GET: async ({ request }: { request: Request }) => {
        try {
            await authorizeRequest(request, [...ALLOWED_ROLES]);

            const url = new URL(request.url);
            const search = url.searchParams.get("search") || undefined;
            const page = parseInt(url.searchParams.get("page") ?? "1", 10);
            const pageSize = parseInt(url.searchParams.get("pageSize") ?? "50", 10);

            const data = await DrapBatchRegistryService.listBatches({ search, page, pageSize });
            return Response.json(ApiResponse.success(data));
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },

    POST: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, [...ALLOWED_ROLES]);

            const contentType = request.headers.get("content-type") ?? "";
            let csvText: string;

            if (contentType.includes("multipart/form-data")) {
                // Accept a CSV file via form-data (field name: "file")
                const formData = await request.formData();
                const file = formData.get("file") as File | null;
                if (!file) {
                    return Response.json(
                        ApiResponse.error("No file provided. Send a CSV file in the 'file' field.", 400),
                        { status: 400 }
                    );
                }
                csvText = await file.text();
            } else {
                // Accept raw CSV text body (Content-Type: text/plain or text/csv)
                csvText = await request.text();
            }

            if (!csvText.trim()) {
                return Response.json(
                    ApiResponse.error("CSV body is empty.", 400),
                    { status: 400 }
                );
            }

            const result = await DrapBatchRegistryService.bulkUploadFromCsv(csvText, payload.userId);
            return Response.json(ApiResponse.success(result, `Upload complete: ${result.created} created, ${result.skipped} skipped.`));
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },
});
