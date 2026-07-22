import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";

export const Route = createAPIFileRoute("/api/auth/sessions/$id")({
  DELETE: async ({ request, params }: { request: Request; params: { id: string } }) => {
    try {
      const payload = await authorizeRequest(request);
      const session = await prisma.session.findUnique({ where: { id: params.id } });

      if (!session || session.userId !== payload.userId) {
        return Response.json({ success: false, error: "Session not found or not yours." }, { status: 404 });
      }

      await prisma.session.delete({ where: { id: params.id } });

      return Response.json({ success: true, message: "Session revoked." });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return Response.json({ success: false, error: err.message }, { status });
    }
  }
});
