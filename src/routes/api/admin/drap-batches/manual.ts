import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { DrapBatchRegistryService } from "@/server/services/admin/drap-batch-registry.service";
import { ApiResponse } from "@/server/utils/api-response";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"] as const;

export const Route = createAPIFileRoute("/api/admin/drap-batches/manual")({
    POST: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, [...ALLOWED_ROLES]);
            const body = await request.json();

            if (!body.medicineName?.trim() || !body.batchCode?.trim()) {
                return Response.json(
                    ApiResponse.error("medicineName and batchCode are required.", 400),
                    { status: 400 }
                );
            }

            const result = await DrapBatchRegistryService.findOrCreateMedicineAndBatch(
                {
                    medicineName: body.medicineName,
                    batchCode: body.batchCode,
                    barcode: body.barcode || null,
                    companyName: body.companyName || null,
                    expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
                    manufactureDate: body.manufactureDate ? new Date(body.manufactureDate) : null,
                    extraData: body.extraData || null,
                    sourceDocumentUrl: body.sourceDocumentUrl || null,
                    genericName: body.genericName || null,
                    manufacturer_name: body.manufacturer_name || null,
                    drapRegNumber: body.drapRegNumber || null,
                    approvalStatus: body.approvalStatus || "REGISTERED",
                    activeIngredients: body.activeIngredients || null,
                },
                payload.userId
            );

            if (!result.created) {
                return Response.json(
                    ApiResponse.error(result.error || "Failed to register batch code.", 400),
                    { status: 400 }
                );
            }

            return Response.json(
                ApiResponse.success({ batchId: result.batchId }, "Batch code successfully registered.")
            );
        } catch (err: any) {
            const status = err.statusCode ?? 500;
            return Response.json(ApiResponse.error(err.message, status), { status });
        }
    },
});
