import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { DrapBatchRegistryService, type BatchRowInput } from "@/server/services/admin/drap-batch-registry.service";
import { ApiResponse } from "@/server/utils/api-response";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"] as const;

export const Route = createAPIFileRoute("/api/admin/drap-batches/pdf/import")({
    POST: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, [...ALLOWED_ROLES]);
            const body = await request.json();

            const rows: BatchRowInput[] = body.rows;
            if (!rows || !Array.isArray(rows) || rows.length === 0) {
                return Response.json(
                    ApiResponse.error("No valid rows provided for import.", 400),
                    { status: 400 }
                );
            }

            const result = await DrapBatchRegistryService.bulkUploadFromRows(rows, payload.userId);
            return Response.json(
                ApiResponse.success(result, `PDF import complete: ${result.created} created, ${result.skipped} skipped.`)
            );
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },
});
