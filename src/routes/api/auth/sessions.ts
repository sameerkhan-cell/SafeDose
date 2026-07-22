import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";

export const Route = createAPIFileRoute("/api/auth/sessions")({
  GET: async ({ request }: { request: Request }) => {
    try {
      const payload = await authorizeRequest(request);

      const sessions = await prisma.session.findMany({
        where: { userId: payload.userId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" }
      });

      return Response.json({ success: true, data: sessions });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return Response.json({ success: false, error: err.message }, { status });
    }
  }
});
