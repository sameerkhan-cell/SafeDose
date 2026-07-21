import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";

export const Route = createAPIFileRoute("/api/pharmacy/scan-locations")({
  GET: async ({ request }: { request: Request }) => {
    try {
      const payload = await authorizeRequest(request, ["PHARMACY"]);
      const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: payload.userId } });
      if (!pharmacy) {
        return Response.json({ success: false, error: "Pharmacy not found" }, { status: 404 });
      }

      const boxes = await prisma.box.findMany({
        where: { pharmacyId: pharmacy.id },
        select: { qrCode: true }
      });
      const boxCodes = boxes.map(b => b.qrCode);

      const logs = await prisma.verificationLog.findMany({
        where: {
          code: { in: boxCodes },
          lat: { not: null },
          lng: { not: null }
        },
        select: { lat: true, lng: true, status: true, code: true, createdAt: true, location: true },
        orderBy: { createdAt: "desc" },
        take: 200
      });

      return Response.json({ success: true, data: logs });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }
});
