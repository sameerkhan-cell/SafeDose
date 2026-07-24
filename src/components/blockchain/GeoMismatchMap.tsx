import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, AlertTriangle, Clock, Shield, Wifi, Zap, Loader2, RefreshCw } from "lucide-react";
import { ease } from "@/lib/motion";

interface ScanPoint {
  id: string;
  city: string;
  country: string;
  x: number; // SVG %
  y: number; // SVG %
  type: "origin" | "suspicious" | "pharmacy" | "verified";
  timestamp?: string;
  detail?: string;
  scanCount: number;
}

interface RouteLink {
  id: string;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  status: "critical" | "warning";
  label?: string;
}

const TYPE_CFG: Record<ScanPoint["type"], { color: string; bg: string; border: string; glow: string; label: string; size: number }> = {
  origin:     { color: "#16a34a", bg: "#16a34a22", border: "#16a34a", glow: "#16a34a44", label: "Origin Scan", size: 16 },
  pharmacy:   { color: "#1a56db", bg: "#1a56db22", border: "#1a56db", glow: "#1a56db44", label: "Pharmacy", size: 12 },
  verified:   { color: "#06b6d4", bg: "#06b6d422", border: "#06b6d4", glow: "#06b6d444", label: "Verified", size: 10 },
  suspicious: { color: "#dc2626", bg: "#dc262622", border: "#dc2626", glow: "#dc262644", label: "Suspicious", size: 14 },
};

function WorldMapSVG() {
  return (
    <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" style={{ opacity: 0.18 }}>
      <defs>
        <pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M 4 0 L 0 0 0 4" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.2" />
        </pattern>
      </defs>
      <rect width="100" height="60" fill="url(#grid)" />
    </svg>
  );
}

export function GeoMismatchMap() {
  const [points, setPoints] = useState<ScanPoint[]>([]);
  const [routes, setRoutes] = useState<RouteLink[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<ScanPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMapData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/blockchain/geo-routes");
      const json = await res.json();
      if (json.success && json.data) {
        const rawPoints = json.data.points || [];
        const rawRoutes = json.data.routes || [];

        const formattedPoints: ScanPoint[] = rawPoints.map((p: any) => ({
          id: p.id,
          city: p.city,
          country: p.country,
          x: p.x,
          y: p.y,
          type: p.status === "critical" ? "suspicious" : p.status === "warning" ? "pharmacy" : "origin",
          scanCount: p.scanCount,
          detail: `Scanned ${p.scanCount} times from ${p.city}`,
        }));

        setPoints(formattedPoints);
        setRoutes(rawRoutes);
        if (formattedPoints.length > 0) {
          setSelectedPoint(formattedPoints[0]);
        }
        setError(null);
      } else {
        setError(json.error || "Failed to load map projection data");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading geo map");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dc2626]/10 border border-[#dc2626]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#dc2626] mb-2">
            <MapPin className="h-3 w-3" /> Geo-Spatial Telemetry
          </span>
          <h2 className="text-2xl font-bold tracking-tight">Geo-Mismatch Map</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Equirectangular coordinate projection · {points.length} real scan locations · {routes.length} suspicious routes
          </p>
        </div>
        <button
          onClick={fetchMapData}
          className="flex items-center gap-1.5 rounded-xl border border-border/40 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading && points.length === 0 ? (
        <div className="flex h-96 items-center justify-center rounded-2xl border border-border/40 bg-card/60">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#dc2626]" />
            <p className="text-[13px] font-medium text-muted-foreground">Projecting scan telemetry coordinates…</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Map canvas */}
          <div className="relative flex h-[420px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-[#080b14] p-4 lg:col-span-2">
            <WorldMapSVG />

            {/* SVG Overlay for Connecting Lines */}
            <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full z-10 pointer-events-none">
              {routes.map((route) => (
                <g key={route.id}>
                  <line
                    x1={route.x1}
                    y1={route.y1}
                    x2={route.x2}
                    y2={route.y2}
                    stroke="#dc2626"
                    strokeWidth="0.6"
                    strokeDasharray="1.5 1.5"
                    opacity="0.8"
                  />
                </g>
              ))}
            </svg>

            {/* Rendered Nodes */}
            <div className="relative z-20 h-full w-full">
              {points.map((pt) => {
                const cfg = TYPE_CFG[pt.type] || TYPE_CFG.origin;
                const isSelected = selectedPoint?.id === pt.id;

                return (
                  <motion.div
                    key={pt.id}
                    className="absolute cursor-pointer -transform-x-1/2 -transform-y-1/2"
                    style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                    onClick={() => setSelectedPoint(pt)}
                    whileHover={{ scale: 1.3 }}
                  >
                    <div
                      className="relative flex items-center justify-center rounded-full border"
                      style={{
                        width: cfg.size,
                        height: cfg.size,
                        borderColor: cfg.border,
                        background: cfg.bg,
                        boxShadow: isSelected ? `0 0 20px ${cfg.color}` : `0 0 8px ${cfg.glow}`,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
                    </div>
                    <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-foreground/80">
                      {pt.city}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {points.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground z-30">
                No scan coordinates registered yet. Perform a scan to plot real locations on the map.
              </div>
            )}
          </div>

          {/* Selected Point Info Panel */}
          <div className="rounded-2xl border border-border/40 bg-card/60 p-5 backdrop-blur-sm">
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#dc2626]" /> Location Telemetry
            </h3>

            {selectedPoint ? (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-border/30 bg-card/40 p-4">
                  <p className="text-base font-black text-foreground">{selectedPoint.city}</p>
                  <p className="text-muted-foreground font-semibold">{selectedPoint.country}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/25 bg-card/30 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Scans</p>
                    <p className="text-sm font-bold">{selectedPoint.scanCount}x</p>
                  </div>
                  <div className="rounded-xl border border-border/25 bg-card/30 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Status</p>
                    <p className="text-xs font-bold uppercase" style={{ color: TYPE_CFG[selectedPoint.type]?.color }}>
                      {selectedPoint.type}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/25 bg-black/20 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Details</p>
                  <p className="text-foreground/80">{selectedPoint.detail}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Select a location node on the map to view telemetry details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
