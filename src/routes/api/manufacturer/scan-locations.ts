import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";

export const Route = createAPIFileRoute("/api/manufacturer/scan-locations")({
  GET: async ({ request }: { request: Request }) => {
    try {
      const payload = await authorizeRequest(request, ["MANUFACTURER"]);
      const manufacturer = await prisma.manufacturer.findUnique({ where: { userId: payload.userId } });
      if (!manufacturer) {
        return Response.json({ success: false, error: "Manufacturer not found" }, { status: 404 });
      }

      // Get all batches belonging to this manufacturer's medicines
      const batches = await prisma.batch.findMany({
        where: { medicine: { manufacturerId: manufacturer.id } },
        select: { id: true, boxQRCode: true }
      });
      const batchIds = batches.map(b => b.id);

      // Get all carton/box/pill codes belonging to these batches
      const [cartons, boxes, pills] = await Promise.all([
        prisma.carton.findMany({ where: { batchId: { in: batchIds } }, select: { qrCode: true } }),
        prisma.box.findMany({ where: { batchId: { in: batchIds } }, select: { qrCode: true } }),
        prisma.pill.findMany({ where: { batchId: { in: batchIds } }, select: { qrCode: true } }),
      ]);
      const allCodes = [
        ...cartons.map(c => c.qrCode),
        ...boxes.map(b => b.qrCode),
        ...pills.map(p => p.qrCode),
      ];

      const logs = await prisma.verificationLog.findMany({
        where: {
          code: { in: allCodes },
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
