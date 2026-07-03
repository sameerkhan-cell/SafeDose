import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ManufacturerDocumentService } from "@/server/services/manufacturer-document.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/admin/documents")({
    GET: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, [
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);
            
            const url = new URL(request.url);
            const status = url.searchParams.get("status") || undefined;

            const documents = await ManufacturerDocumentService.adminListDocuments(status);
            
            return Response.json(ApiResponse.success(documents, "Documents loaded successfully."));
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
