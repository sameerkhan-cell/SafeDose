import { createAPIFileRoute } from "@/lib/api-route-helper";
import { RecallService } from "@/server/services/recall.service";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ApiResponse } from "@/server/utils/api-response";
import { z } from "zod";

const InitiateRecallSchema = z.object({
    batchId: z.string().min(1, "Batch ID is required"),
    reason: z.string().min(1, "Reason is required"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
});

export const Route = createAPIFileRoute("/api/manufacturer/recall")({
    POST: async ({ request }: { request: Request }) => {
        try {
            const payload = await authorizeRequest(request, ["MANUFACTURER"]);
            const body = await request.json();

            const parsed = InitiateRecallSchema.safeParse(body);
            if (!parsed.success) {
                const msg = parsed.error.errors.map((e) => e.message).join("; ");
                return Response.json(ApiResponse.error(msg, 400), { status: 400 });
            }

            const result = await RecallService.initiateManufacturerRecall(
                payload.userId,
                parsed.data
            );

            return Response.json(
                ApiResponse.success(result, "Recall initiated successfully."),
                { status: 200 }
            );
        } catch (error: any) {
            const status = error.statusCode || 400;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
