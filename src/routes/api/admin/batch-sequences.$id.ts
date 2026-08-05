import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { authorizeRequest } from "@/server/middleware/auth.middleware";

export const Route = createAPIFileRoute("/api/admin/batch-sequences/$id")({
  DELETE: async ({ request, params }: { request: Request; params: { id: string } }) => {
    try {
      await authorizeRequest(request, ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN"]);
      await prisma.batchSequence.delete({ where: { id: params.id } });
      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }
});
