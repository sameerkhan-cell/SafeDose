import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/fraud/resolve-alert")({
  POST: async ({ request }: { request: Request }) => {
    try {
      await authorizeRequest(request, ["ADMIN", "REGULATOR", "MANUFACTURER"]);
      const body = await request.json();
      const id = body?.id;

      if (!id) {
        return Response.json(ApiResponse.error("Alert ID is required", 400), { status: 400 });
      }

      const updated = await prisma.fraudAlert.update({
        where: { id },
        data: { isResolved: true },
      });

      return Response.json(ApiResponse.success(updated));
    } catch (error: any) {
      const status = error.statusCode || 500;
      return Response.json(ApiResponse.error(error?.message || "Failed to resolve alert", status), { status });
    }
  },
});
