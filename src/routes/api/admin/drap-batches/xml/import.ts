import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { DrapBatchRegistryService } from "@/server/services/admin/drap-batch-registry.service";
import { ApiResponse } from "@/server/utils/api-response";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"] as const;

export const Route = createAPIFileRoute("/api/admin/drap-batches/xml/import")({
    POST: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, [...ALLOWED_ROLES]);

            const contentType = request.headers.get("content-type") ?? "";
            if (!contentType.includes("multipart/form-data")) {
                return Response.json(
                    ApiResponse.error("Expected multipart/form-data.", 400),
                    { status: 400 }
                );
            }

            const formData = await request.formData();
            const file = formData.get("file") as File | null;
            const nodePath = (formData.get("nodePath") as string) || "";
            const rawMapping = (formData.get("mapping") as string) || "{}";

            if (!file) {
                return Response.json(ApiResponse.error("No XML file provided.", 400), { status: 400 });
            }
            if (!nodePath) {
                return Response.json(ApiResponse.error("No nodePath provided.", 400), { status: 400 });
            }

            let mapping: any;
            try {
                mapping = JSON.parse(rawMapping);
            } catch {
                return Response.json(ApiResponse.error("Invalid mapping JSON.", 400), { status: 400 });
            }

            const xmlText = await file.text();
            const { rows, error } = DrapBatchRegistryService.parseXmlToRows(xmlText, nodePath, mapping);
            if (error) {
                return Response.json(ApiResponse.error(error, 400), { status: 400 });
            }

            if (!rows || rows.length === 0) {
                return Response.json(ApiResponse.error("No records extracted from XML file.", 400), { status: 400 });
            }

            const result = await DrapBatchRegistryService.bulkUploadFromRows(rows, payload.userId);
            return Response.json(
                ApiResponse.success(result, `XML import complete: ${result.created} created, ${result.skipped} skipped.`)
            );
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },
});
