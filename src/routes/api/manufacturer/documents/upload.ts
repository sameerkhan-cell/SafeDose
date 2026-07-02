import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ManufacturerDocumentService } from "@/server/services/manufacturer-document.service";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/manufacturer/documents/upload")({
    POST: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, ["MANUFACTURER"]);
            
            const contentType = request.headers.get("content-type") || "";
            let body: any = {};
            let file: File | null = null;

            if (contentType.includes("multipart/form-data")) {
                const formData = await request.formData();
                body = {
                    documentType: formData.get("documentType") as string,
                    documentName: formData.get("documentName") as string,
                    expiryDate: (formData.get("expiryDate") as string) || undefined,
                };
                file = formData.get("file") as File | null;
            } else {
                body = await request.json();
            }

            const document = await ManufacturerDocumentService.uploadDocument(
                payload.userId,
                body,
                file
            );

            return Response.json(
                ApiResponse.success(document, "Document uploaded successfully.")
            );
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
