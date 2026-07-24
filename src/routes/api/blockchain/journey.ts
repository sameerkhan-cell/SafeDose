import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";
import { formatDistanceToNow } from "date-fns";

async function getBatchTxHash(batch: any): Promise<string> {
  if (batch.txHash && batch.txHash !== "0x0000000000000000000000000000000000000000") {
    return batch.txHash;
  }

  const job = await prisma.blockchainJob.findFirst({
    where: {
      entityType: "BATCH",
      OR: [{ entityId: batch.id }, { entityRef: batch.batchNumber }],
      txHash: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  return job?.txHash || "Pending Anchoring";
}

async function getPillTxHash(pill: any, fallbackBatchTx: string): Promise<string> {
  if (pill.blockchainTx && pill.blockchainTx !== "0x0000000000000000000000000000000000000000") {
    return pill.blockchainTx;
  }

  const job = await prisma.blockchainJob.findFirst({
    where: {
      entityType: "PILL",
      OR: [{ entityId: pill.id }, { entityRef: pill.qrCode }],
      txHash: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  if (job?.txHash) {
    return job.txHash;
  }

  if (fallbackBatchTx && fallbackBatchTx.startsWith("0x")) {
    return fallbackBatchTx;
  }

  return "Pending Anchoring";
}

export const Route = createAPIFileRoute("/api/blockchain/journey")({
  GET: async ({ request }: { request: Request }) => {
    try {
      const url = new URL(request.url);
      let batchId = url.searchParams.get("batchId");

      // List recent available batches for dropdown selection
      const recentBatches = await prisma.batch.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { medicine: { select: { name: true } } },
      });

      const availableBatches = recentBatches.map((b) => ({
        batchNumber: b.batchNumber,
        medicineName: b.medicine?.name || "Medicine",
        blockchainStatus: b.blockchainStatus,
      }));

      // If no batchId supplied, prefer the latest CONFIRMED batch first (ideal for demo),
      // falling back to the latest batch overall if none are confirmed.
      if (!batchId) {
        const latestConfirmedBatch = recentBatches.find((b) => b.blockchainStatus === "CONFIRMED");
        const defaultBatch = latestConfirmedBatch || recentBatches[0];

        if (!defaultBatch) {
          return Response.json(
            ApiResponse.success({
              batchNumber: null,
              stages: [],
              availableBatches: [],
              notTracked: ["QC Lab", "In Transit Courier", "Distribution Warehouse"],
              note: "No batches exist in the system.",
            })
          );
        }
        batchId = defaultBatch.batchNumber;
      }

      // Query Batch with medicine, manufacturer, boxes, pills, verifications
      const batch = await prisma.batch.findFirst({
        where: {
          OR: [{ batchNumber: batchId }, { id: batchId }],
        },
        include: {
          medicine: {
            include: { manufacturer: true },
          },
          boxes: {
            where: { pharmacyId: { not: null } },
            include: { pharmacy: true },
            take: 5,
          },
          pills: {
            take: 20,
            include: {
              verifications: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      });

      if (!batch) {
        return Response.json(
          ApiResponse.error(`Batch '${batchId}' not found`, 404),
          { status: 404 }
        );
      }

      const batchTx = await getBatchTxHash(batch);
      const stages = [];

      // Stage 1: Manufacturing
      stages.push({
        id: "stage-manufactured",
        name: "Manufactured",
        status: "COMPLETED",
        actor: batch.medicine.manufacturer.companyName || "Manufacturer",
        location: "Manufacturing Plant",
        timestamp: formatDistanceToNow(new Date(batch.createdAt), { addSuffix: true }),
        rawDate: batch.createdAt,
        txHash: batchTx,
        detail: `Batch ${batch.batchNumber} (${batch.totalPillsGenerated} units) registered on Polygon Amoy.`,
      });

      // Stage 2: Pharmacy Receipt (if any box scanned by a pharmacy)
      if (batch.boxes && batch.boxes.length > 0) {
        const firstBox = batch.boxes[0];
        const pharmacyName = firstBox.pharmacy?.name || "Licensed Pharmacy";
        const scannedAt = firstBox.pharmacyScannedAt || batch.createdAt;

        stages.push({
          id: "stage-pharmacy",
          name: "Received at Pharmacy",
          status: "COMPLETED",
          actor: pharmacyName,
          location: firstBox.pharmacy?.address || "Pharmacy Location",
          timestamp: formatDistanceToNow(new Date(scannedAt), { addSuffix: true }),
          rawDate: scannedAt,
          txHash: batchTx,
          detail: `Box received and verified by ${pharmacyName}.`,
        });
      }

      // Stage 3: Patient Verification / Purchase (if any pill verified)
      if (batch.pills && batch.pills.length > 0) {
        const verifiedPills = batch.pills.filter(p => p.qrScanned || (p.verifications && p.verifications.length > 0));
        if (verifiedPills.length > 0) {
          const firstPill = verifiedPills[0];
          const verif = firstPill.verifications[0];
          const pillTx = await getPillTxHash(firstPill, batchTx);
          const scanLocation = verif?.location || firstPill.scannedLocation || "Mobile App Scan";
          const scanTime = verif?.createdAt || firstPill.scannedAt || batch.createdAt;
          const statusText = verif?.status || firstPill.verificationStatus || "VERIFIED";

          stages.push({
            id: "stage-customer",
            name: "Verified by Customer",
            status: "COMPLETED",
            actor: "Patient / End User",
            location: scanLocation,
            timestamp: formatDistanceToNow(new Date(scanTime), { addSuffix: true }),
            rawDate: scanTime,
            txHash: pillTx,
            detail: `Pill QR code authenticated on-chain with result: ${statusText}.`,
          });
        }
      }

      return Response.json(
        ApiResponse.success({
          batchNumber: batch.batchNumber,
          medicineName: batch.medicine.name,
          manufacturerName: batch.medicine.manufacturer.companyName,
          blockchainStatus: batch.blockchainStatus,
          stages,
          availableBatches,
          notTracked: ["QC Testing Lab", "In-Transit Logistics", "Regional Warehouse"],
          note: "Intermediate logistics steps (QC Lab, In-Transit, Warehouse) are omitted because they are not tracked as separate database entities in the current schema.",
        })
      );
    } catch (error: any) {
      return Response.json(
        ApiResponse.error(error?.message || "Failed to load batch journey", 500),
        { status: 500 }
      );
    }
  },
});
