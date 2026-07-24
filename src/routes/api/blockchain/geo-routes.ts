import { createAPIFileRoute } from "@/lib/api-route-helper";
import { prisma } from "@/server/db/client";
import { ApiResponse } from "@/server/utils/api-response";

export const Route = createAPIFileRoute("/api/blockchain/geo-routes")({
  GET: async () => {
    try {
      // 1. Fetch real scan locations from VerificationLog
      const logs = await prisma.verificationLog.findMany({
        where: {
          lat: { not: null },
          lng: { not: null },
        },
        take: 50,
        orderBy: { createdAt: "desc" },
      });

      // Equirectangular projection helper
      const toSvgCoords = (lat: number, lng: number) => {
        const x = Number((((lng + 180) / 360) * 100).toFixed(2));
        const y = Number((((90 - lat) / 180) * 100).toFixed(2));
        return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
      };

      const pointsMap = new Map();
      logs.forEach((log) => {
        const city = log.location || "Unknown City";
        if (!pointsMap.has(city) && log.lat !== null && log.lng !== null) {
          const { x, y } = toSvgCoords(log.lat, log.lng);
          pointsMap.set(city, {
            id: city.toLowerCase().replace(/[^a-z0-9]/g, "-"),
            city,
            country: log.location?.includes(",") ? log.location.split(",")[1].trim() : "Location",
            lat: log.lat,
            lng: log.lng,
            x,
            y,
            status: log.status === "GENUINE" ? "normal" : log.status === "DUPLICATE" ? "warning" : "critical",
            scanCount: 1,
          });
        } else if (pointsMap.has(city)) {
          const existing = pointsMap.get(city);
          existing.scanCount += 1;
        }
      });

      const points = Array.from(pointsMap.values());

      // 2. Fetch GeoAnalytics rows for suspicious connecting routes
      const geoRows = await prisma.geoAnalytics.findMany({
        where: { suspicious: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      });

      const routes = geoRows
        .map((row, i) => {
          const fromPoint = points.find((p) => p.city === row.previousLocation);
          const toPoint = points.find((p) => p.city === row.currentLocation);
          if (!fromPoint || !toPoint) return null;

          return {
            id: `r-${row.id || i}`,
            from: fromPoint.city,
            to: toPoint.city,
            x1: fromPoint.x,
            y1: fromPoint.y,
            x2: toPoint.x,
            y2: toPoint.y,
            status: "critical",
            label: "Impossible Travel Alert",
          };
        })
        .filter(Boolean);

      return Response.json(
        ApiResponse.success({
          points,
          routes,
          totalScanLocations: points.length,
          suspiciousRoutesCount: routes.length,
        })
      );
    } catch (error: any) {
      return Response.json(
        ApiResponse.error(error?.message || "Failed to load map data", 500),
        { status: 500 }
      );
    }
  },
});
