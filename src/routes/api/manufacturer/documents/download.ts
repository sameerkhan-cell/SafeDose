import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";
import fs from "node:fs/promises";
import path from "node:path";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN", "REGULATOR"];

export const Route = createAPIFileRoute("/api/manufacturer/documents/download")({
    GET: async ({ request }: { request: Request }) => {
        try {
            // Require logged in user
            const payload = await authorizeRequest(request, [
                "MANUFACTURER",
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);

            const url = new URL(request.url);
            const docId = url.searchParams.get("docId");

            if (!docId) {
                return Response.json(ApiResponse.error("Missing docId parameter.", 400), {
                    status: 400,
                });
            }

            // Find the document record in DB
            const document = await prisma.manufacturerDocument.findFirst({
                where: { id: docId, deletedAt: null },
            });

            if (!document) {
                return Response.json(ApiResponse.error("Document not found.", 404), {
                    status: 404,
                });
            }

            // Check authorization: Must be owner or admin/regulator
            const isAdmin = ADMIN_ROLES.includes(payload.role);
            if (!isAdmin) {
                const manufacturer = await prisma.manufacturer.findUnique({
                    where: { userId: payload.userId },
                });
                if (!manufacturer || document.manufacturerId !== manufacturer.id) {
                    return Response.json(
                        ApiResponse.error("You do not have access to this document.", 403),
                        { status: 403 }
                    );
                }
            }

            const mfgId = document.manufacturerId;
            const filePath = path.join(
                process.cwd(),
                "storage",
                "manufacturer-documents",
                mfgId,
                `doc-${docId}`
            );

            try {
                const buffer = await fs.readFile(filePath);
                const contentType = document.mimeType || "application/octet-stream";

                return new Response(buffer, {
                    headers: {
                        "Content-Type": contentType,
                        "Content-Disposition": `inline; filename="${document.documentName}"`,
                        "Cache-Control": "private, max-age=3600",
                    },
                });
            } catch (e) {
                return Response.json(
                    ApiResponse.error("Document file not found on server filesystem.", 404),
                    { status: 404 }
                );
            }
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
