import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"] as const;

export const Route = createAPIFileRoute("/api/admin/drap-batches/$id")({
    PATCH: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
            await authorizeRequest(request, [...ALLOWED_ROLES]);
            const { id } = params;
            const body = await request.json();

            // Confirm the row exists
            const existing = await prisma.drapBatchRegistry.findUnique({
                where: { id },
                select: { id: true, batchCode: true },
            });
            if (!existing) {
                return Response.json(ApiResponse.error("Batch registry entry not found.", 404), { status: 404 });
            }

            // If batchCode is being changed, confirm uniqueness
            if (body.batchCode && body.batchCode.trim() !== existing.batchCode) {
                const conflict = await prisma.drapBatchRegistry.findUnique({
                    where: { batchCode: body.batchCode.trim() },
                    select: { id: true },
                });
                if (conflict) {
                    return Response.json(
                        ApiResponse.error(`Batch code "${body.batchCode.trim()}" already exists on another entry.`, 400),
                        { status: 400 }
                    );
                }
            }

            // Build the update payload — only touch fields that were provided
            const data: Record<string, any> = {};
            if (body.batchCode !== undefined)          data.batchCode          = body.batchCode?.trim() || existing.batchCode;
            if (body.barcode !== undefined)            data.barcode            = body.barcode?.trim()   || null;
            if (body.companyName !== undefined)        data.companyName        = body.companyName?.trim() || null;
            if (body.expiryDate !== undefined)         data.expiryDate         = body.expiryDate ? new Date(body.expiryDate) : null;
            if (body.manufactureDate !== undefined)    data.manufactureDate    = body.manufactureDate ? new Date(body.manufactureDate) : null;
            if (body.sourceDocumentUrl !== undefined)  data.sourceDocumentUrl  = body.sourceDocumentUrl?.trim() || null;

            const updated = await prisma.drapBatchRegistry.update({
                where: { id },
                data,
                select: { id: true, batchCode: true, barcode: true },
            });

            return Response.json(ApiResponse.success(updated, "Batch entry updated successfully."));
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },
});
