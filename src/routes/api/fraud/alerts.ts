import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/fraud/alerts")({
  GET: async ({ request }: { request: Request }) => {
    try {
      const alerts = await prisma.fraudAlert.findMany({
        where: { isResolved: false },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Enrich alerts with pill/batch info if qrCode belongs to a Pill or Batch
      const enrichedAlerts = await Promise.all(
        alerts.map(async (alert) => {
          let medicineName = "Verified Product";
          let batchNumber = alert.qrCode;

          const pill = await prisma.pill.findUnique({
            where: { qrCode: alert.qrCode },
            include: { batch: { include: { medicine: true } } },
          });

          if (pill) {
            medicineName = pill.batch.medicine.name;
            batchNumber = pill.batch.batchNumber;
          } else {
            const batch = await prisma.batch.findFirst({
              where: { batchNumber: alert.qrCode },
              include: { medicine: true },
            });
            if (batch) {
              medicineName = batch.medicine.name;
              batchNumber = batch.batchNumber;
            }
          }

          return {
            ...alert,
            medicineName,
            batchNumber,
          };
        })
      );

      return Response.json(ApiResponse.success(enrichedAlerts));
    } catch (error: any) {
      return Response.json(
        ApiResponse.error(error?.message || "Failed to fetch fraud alerts", 500),
        { status: 500 }
      );
    }
  },
});
