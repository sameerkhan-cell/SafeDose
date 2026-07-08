import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";
import { ApiResponse, ApiError } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/admin/manufacturers/$id/unverify")({
    POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
            await authorizeRequest(request, [
                "ADMIN",
                "SUPER_ADMIN",
                "DRAP_ADMIN",
                "REGULATOR",
            ]);

            const existing = await prisma.manufacturer.findUnique({
                where: { id: params.id },
            });
            if (!existing) {
                throw new ApiError(404, "Manufacturer not found.");
            }

            const manufacturer = await prisma.manufacturer.update({
                where: { id: params.id },
                data: {
                    isVerified: false,
                    verificationStatus: "PENDING",
                },
            });

            return Response.json(ApiResponse.success(manufacturer, "Manufacturer unverified successfully."));
        } catch (error: any) {
            const status = error.statusCode || 500;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
