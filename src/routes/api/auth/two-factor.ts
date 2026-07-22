import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";

export const Route = createAPIFileRoute("/api/auth/two-factor")({
  PATCH: async ({ request }: { request: Request }) => {
    try {
      const payload = await authorizeRequest(request);
      const body = await request.json();
      const enabled = !!body.enabled;

      await prisma.user.update({
        where: { id: payload.userId },
        data: { twoFactorEnabled: enabled }
      });

      return Response.json({ success: true, data: { twoFactorEnabled: enabled } });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return Response.json({ success: false, error: err.message }, { status });
    }
  }
});
