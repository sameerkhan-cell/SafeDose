import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { DrapBatchRegistryService } from "@/server/services/admin/drap-batch-registry.service";
import { ApiResponse } from "@/server/utils/api-response";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"] as const;

const EXCEL_TYPES = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
];

function isExcelFile(file: File): boolean {
    const ext = file.name.split(".").pop()?.toLowerCase();
    return ext === "xlsx" || ext === "xls" || EXCEL_TYPES.includes(file.type);
}

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

            if (contentType.includes("multipart/form-data")) {
                const formData = await request.formData();
                const file = formData.get("file") as File | null;
                if (!file) {
                    return Response.json(
                        ApiResponse.error("No file provided. Send a CSV or Excel file in the 'file' field.", 400),
                        { status: 400 }
                    );
                }

                let rows;
                let parseError: string | undefined;

                if (isExcelFile(file)) {
                    // Excel path — parse with SheetJS
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const parsed = DrapBatchRegistryService.parseExcelToRows(buffer);
                    rows = parsed.rows;
                    parseError = parsed.error;
                } else {
                    // CSV path
                    const csvText = await file.text();
                    if (!csvText.trim()) {
                        return Response.json(ApiResponse.error("CSV file is empty.", 400), { status: 400 });
                    }
                    const parsed = DrapBatchRegistryService.parseCsvToRows(csvText);
                    rows = parsed.rows;
                    parseError = parsed.error;
                }

                if (parseError) {
                    return Response.json(ApiResponse.error(parseError, 400), { status: 400 });
                }

                if (!rows || rows.length === 0) {
                    return Response.json(ApiResponse.error("File contains no data rows.", 400), { status: 400 });
                }

                const result = await DrapBatchRegistryService.bulkUploadFromRows(rows, payload.userId);
                return Response.json(
                    ApiResponse.success(result, `Upload complete: ${result.created} created, ${result.skipped} skipped.`)
                );
            } else {
                // Raw CSV text body (Content-Type: text/plain or text/csv) — backward compat
                const csvText = await request.text();
                if (!csvText.trim()) {
                    return Response.json(ApiResponse.error("CSV body is empty.", 400), { status: 400 });
                }
                const result = await DrapBatchRegistryService.bulkUploadFromCsv(csvText, payload.userId);
                return Response.json(
                    ApiResponse.success(result, `Upload complete: ${result.created} created, ${result.skipped} skipped.`)
                );
            }
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },
});
