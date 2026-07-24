import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";
import { formatDistanceToNow } from "date-fns";

// Parses userAgent string into a friendly device name
function parseDevice(ua: string | null | undefined): string {
  if (!ua) return "Web Browser";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) {
    if (/Mobile/.test(ua)) return "Android Phone";
    return "Android Tablet";
  }
  if (/MediVerify Scanner/.test(ua)) return "MediVerify Scanner";
  if (/Zebra/.test(ua)) return "Zebra Scanner";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux / Web";
  return "Web Browser";
}

function mapUserType(role: string | undefined): "customer" | "pharmacy" | "distributor" | "inspector" {
  if (!role) return "customer";
  const r = role.toLowerCase();
  if (r.includes("pharmacy")) return "pharmacy";
  if (r.includes("distributor") || r.includes("distributor")) return "distributor";
  if (r.includes("regulator") || r.includes("admin")) return "inspector";
  return "customer";
}

function mapResult(status: string): "genuine" | "suspicious" | "fake" | "duplicate" {
  switch (status) {
    case "GENUINE": return "genuine";
    case "DUPLICATE": return "duplicate";
    case "SUSPECTED": return "suspicious";
    case "INVALID":
    case "EXPIRED":
    default: return "fake";
  }
}

export const Route = createAPIFileRoute("/api/blockchain/scan-history")({
  GET: async ({ request }: { request: Request }) => {
    try {
      const url = new URL(request.url);
      const statusFilter = url.searchParams.get("status"); // optional: genuine | duplicate | suspicious | fake
      const take = parseInt(url.searchParams.get("take") || "50", 10);

      // Build where clause for status filtering
      let statusWhere: any = {};
      if (statusFilter && statusFilter !== "all") {
        const statusMap: Record<string, string[]> = {
          genuine: ["GENUINE"],
          duplicate: ["DUPLICATE"],
          suspicious: ["SUSPECTED"],
          fake: ["INVALID", "EXPIRED"],
        };
        const statuses = statusMap[statusFilter];
        if (statuses) {
          statusWhere = { status: { in: statuses } };
        }
      }

      const logs = await prisma.verificationLog.findMany({
        where: statusWhere,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, role: true } },
          pill: {
            include: {
              batch: {
                include: {
                  medicine: {
                    include: { manufacturer: { select: { companyName: true } } },
                  },
                },
              },
            },
          },
        },
      });

      const mapped = logs.map((log, index) => {
        const medName = log.pill?.batch?.medicine?.name || log.code || "Unknown Medicine";
        const batchId = log.pill?.batch?.batchNumber || log.code || "N/A";
        const txHash = log.pill?.blockchainTx || log.pill?.batch?.txHash || null;
        const result = mapResult(String(log.status));
        const userType = mapUserType(log.user?.role);
        const device = parseDevice(log.userAgent);

        return {
          id: log.id,
          medicine: medName,
          batchId,
          location: log.location || "Unknown",
          timestamp: formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }),
          rawDate: log.createdAt,
          userType,
          result,
          device,
          txHash: txHash || "0x0000…N/A",
          scanIndex: index + 1,
          lat: log.lat,
          lng: log.lng,
        };
      });

      return Response.json(ApiResponse.success(mapped));
    } catch (error: any) {
      return Response.json(
        ApiResponse.error(error?.message || "Failed to load scan history", 500),
        { status: 500 }
      );
    }
  },
});
