import { createAPIFileRoute } from "@/lib/api-route-helper";
import { authorizeRequest } from "@/server/middleware/auth.middleware";
import { prisma } from "@/server/db/client";

export const Route = createAPIFileRoute("/api/pharmacy/scan-locations")({
  GET: async ({ request }: { request: Request }) => {
    try {
      const payload = await authorizeRequest(request, ["PHARMACY"]);

      // Filter VerificationLog directly by the authenticated user's userId.
      // This captures ALL scan types the pharmacy performed:
      //   • Box QR codes   (code = box.qrCode)
      //   • Carton QR codes
      //   • Barcode / DRAP scans (batchCode / barcode from DrapBatchRegistry)
      //   • Manual batch-number entries
      // No need to first query the Pharmacy table or cross-join with Box/DrapBatchRegistry —
      // every scan the pharmacy staff made is already stamped with userId = payload.userId.
      const logs = await prisma.verificationLog.findMany({
        where: {
          userId: payload.userId,
          lat: { not: null },
          lng: { not: null },
        },
        select: { lat: true, lng: true, status: true, code: true, createdAt: true, location: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      return Response.json({ success: true, data: logs });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  },
});
