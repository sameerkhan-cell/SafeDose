import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";
import { formatDistanceToNow } from "date-fns";

const ZERO_HASH = "0x0000000000000000000000000000000000000000";

function resolveTxHash(hash: string | null | undefined): string | null {
  if (!hash || hash === ZERO_HASH) return null;
  return hash;
}

export const Route = createAPIFileRoute("/api/blockchain/cards")({
  GET: async () => {
    try {
      const pills = await prisma.pill.findMany({
        take: 12,
        orderBy: { createdAt: "desc" },
        include: {
          batch: {
            include: {
              medicine: {
                include: { manufacturer: true },
              },
            },
          },
          verifications: {
            take: 10,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      const cards = await Promise.all(
        pills.map(async (pill) => {
          const scanCount = await prisma.verificationLog.count({
            where: { code: pill.qrCode },
          });

          const latestVerification = pill.verifications[0];
          const rawStatus: string = String(latestVerification?.status || pill.status);

          let verificationResult: "genuine" | "suspicious" | "fake" = "genuine";
          if (rawStatus === "GENUINE" || rawStatus === "ACTIVE") {
            verificationResult = "genuine";
          } else if (rawStatus === "DUPLICATE" || rawStatus === "SUSPECTED") {
            verificationResult = "suspicious";
          } else if (rawStatus === "INVALID" || rawStatus === "RECALLED" || rawStatus === "EXPIRED") {
            verificationResult = "fake";
          }

          let blockchainStatus: "confirmed" | "pending" | "failed" = "pending";
          if (pill.blockchainStatus === "CONFIRMED" || pill.batch.blockchainStatus === "CONFIRMED") {
            blockchainStatus = "confirmed";
          } else if (pill.blockchainStatus === "FAILED") {
            blockchainStatus = "failed";
          }

          const txHash =
            resolveTxHash(pill.blockchainTx) || resolveTxHash(pill.batch.txHash) || null;

          return {
            id: pill.id,
            txHash,
            batchId: pill.batch.batchNumber,
            manufacturer: pill.batch.medicine.manufacturer.companyName || "Verified Manufacturer",
            location: pill.scannedLocation || latestVerification?.location || "Manufacturing Plant",
            verificationResult,
            qrAuthentic: verificationResult === "genuine",
            timestamp: formatDistanceToNow(new Date(pill.scannedAt || pill.createdAt), { addSuffix: true }),
            blockchainStatus,
            medicineLabel: pill.batch.medicine.name,
            scansCount: scanCount > 0 ? scanCount : 1,
          };
        })
      );

      return Response.json(ApiResponse.success(cards));
    } catch (error: any) {
      return Response.json(
        ApiResponse.error(error?.message || "Failed to load transaction cards", 500),
        { status: 500 }
      );
    }
  },
});
