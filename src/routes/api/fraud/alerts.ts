import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/fraud/alerts")({
    GET: async ({ request }: { request: Request }) => {
        try {
            await authorizeRequest(request, ["ADMIN", "REGULATOR", "MANUFACTURER", "PHARMACY"]);

            const alerts = await prisma.fraudAlert.findMany({
                orderBy: { createdAt: "desc" },
                take: 50
            });

            return Response.json(ApiResponse.success(alerts));
        } catch (error: any) {
            const status = error.statusCode || 401;
            return Response.json(ApiResponse.error(error.message, status), { status });
        }
    },
});
