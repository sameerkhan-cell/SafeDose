import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { DrapBatchRegistryService } from "@/server/services/admin/drap-batch-registry.service";
import { ApiResponse } from "@/server/utils/api-response";
import fs from "node:fs/promises";
import path from "node:path";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"] as const;
const ALLOWED_EXTENSIONS = [".pdf", ".xml", ".ectd", ".zip"];
const ALLOWED_TYPES = [
    "application/pdf",
    "text/xml",
    "application/xml",
    "application/octet-stream",
    "application/zip",
];

export const Route = createAPIFileRoute("/api/admin/drap-batches/document")({
    // Upload a PDF/XML/eCTD supporting document — returns documentUrl for use in manual entry form
    POST: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, [...ALLOWED_ROLES]);

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
                    ApiResponse.error("No file provided. Send the document in the 'file' field.", 400),
                    { status: 400 }
                );
            }

            const ext = path.extname(file.name).toLowerCase();
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                return Response.json(
                    ApiResponse.error(`Unsupported file type "${ext}". Allowed: PDF, XML, eCTD, ZIP.`, 400),
                    { status: 400 }
                );
            }

            const { documentUrl, driveUrl } = await DrapBatchRegistryService.storeDocument(
                file,
                payload.userId
            );

            return Response.json(
                ApiResponse.success({ documentUrl, driveUrl: driveUrl ?? null }, "Document uploaded successfully.")
            );
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },

    // Serve stored DRAP documents
    GET: async ({ request }: { request: Request }) => {
        try {
            await authorizeRequest(request, [...ALLOWED_ROLES]);
            const url = new URL(request.url);
            const fileName = url.searchParams.get("file");
            if (!fileName || fileName.includes("..") || fileName.includes("/")) {
                return Response.json(ApiResponse.error("Invalid file name.", 400), { status: 400 });
            }

            const filePath = path.join(process.cwd(), "storage", "drap-documents", fileName);
            try {
                const buffer = await fs.readFile(filePath);
                const ext = path.extname(fileName).toLowerCase();
                const mimeTypes: Record<string, string> = {
                    ".pdf": "application/pdf",
                    ".xml": "application/xml",
                    ".ectd": "application/octet-stream",
                    ".zip": "application/zip",
                };
                return new Response(buffer, {
                    headers: {
                        "Content-Type": mimeTypes[ext] ?? "application/octet-stream",
                        "Content-Disposition": `attachment; filename="${fileName}"`,
                    },
                });
            } catch {
                return Response.json(ApiResponse.error("File not found.", 404), { status: 404 });
            }
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },
});
