/**
 * ScanLocationMap — Real interactive Leaflet map with OpenStreetMap tiles.
 *
 * Props (unchanged from previous version):
 *   dataUrl  – API endpoint returning geo-tagged scan points
 *   token    – optional bearer token for authenticated requests
 *   className – optional wrapper class
 *
 * Renders real zoomable/pannable OpenStreetMap tile imagery.
 * Uses CircleMarker for coloured status dots (avoids Vite icon-path issues
 * with the default PNG pin; CircleMarker is pure CSS/SVG, no images needed).
 * Falls back to Pakistan center view when no markers are present.
 */

import "leaflet/dist/leaflet.css";
import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { LatLngBounds, latLng } from "leaflet";
import { Loader2, WifiOff, RefreshCcw, MapPin } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScanPoint {
  id: string;
  lat: number;
  lng: number;
  status: string;
  type: string;
  createdAt: string;
  scannedByRole: string;
  medicineName: string | null;
}

interface Props {
  dataUrl: string;
  token?: string;
  className?: string;
}

// ── Status colour map ─────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  GENUINE:   "#16a34a",
  INVALID:   "#dc2626",
  DUPLICATE: "#f59e0b",
  SUSPECTED: "#f97316",
};

function colorFor(status: string): string {
  return STATUS_COLOR[status?.toUpperCase()] ?? "#6366f1";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Auto-fit bounds helper (must be inside MapContainer) ──────────────────────
function BoundsFitter({ points }: { points: ScanPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      // Default: center on Pakistan
      map.setView([30.3753, 69.3451], 5);
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 10);
      return;
    }
    const bounds = new LatLngBounds(
      points.map((p) => latLng(p.lat, p.lng))
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);

  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ScanLocationMap({ dataUrl, token, className }: Props) {
  const [points, setPoints] = useState<ScanPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(dataUrl, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list: ScanPoint[] = json?.data ?? [];
      setPoints(list.filter((p) => p.lat != null && p.lng != null));
    } catch (e: any) {
      setError(e.message || "Failed to load scan locations");
    } finally {
      setLoading(false);
    }
  }, [dataUrl, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex h-full min-h-[340px] items-center justify-center bg-[#0d1117] ${className ?? ""}`}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading scan map…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`flex h-full min-h-[340px] items-center justify-center bg-[#0d1117] ${className ?? ""}`}>
        <div className="flex flex-col items-center gap-3 text-destructive">
          <WifiOff className="h-8 w-8" />
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium hover:bg-destructive/20 transition-colors"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Map (empty or populated) ───────────────────────────────────────────────
  return (
    <div className={`relative h-full min-h-[340px] ${className ?? ""}`}>
      <MapContainer
        // Initial view — BoundsFitter overrides this once data is available
        center={[30.3753, 69.3451]}
        zoom={5}
        style={{ height: "100%", width: "100%", minHeight: 340 }}
        // Dark base class applied via className on the wrapper; map itself
        // is controlled by the tile layer
      >
        {/* ── OpenStreetMap tile layer (attribution is MANDATORY per OSM policy) */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {/* ── Auto-fit bounds to all markers ── */}
        <BoundsFitter points={points} />

        {/* ── One CircleMarker per geo-tagged scan ── */}
        {points.map((pt) => (
          <CircleMarker
            key={pt.id}
            center={[pt.lat, pt.lng]}
            radius={8}
            pathOptions={{
              color: colorFor(pt.status),
              fillColor: colorFor(pt.status),
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 180, fontFamily: "system-ui, sans-serif" }}>
                {/* Status badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{
                    display: "inline-block", width: 10, height: 10, borderRadius: "50%",
                    background: colorFor(pt.status), flexShrink: 0
                  }} />
                  <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: colorFor(pt.status) }}>
                    {pt.status}
                  </strong>
                </div>

                {/* Medicine name */}
                {pt.medicineName && (
                  <p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 6px" }}>{pt.medicineName}</p>
                )}

                {/* Detail rows */}
                <table style={{ fontSize: 11, borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    <tr>
                      <td style={{ color: "#888", paddingRight: 8, paddingBottom: 3 }}>Coords</td>
                      <td style={{ paddingBottom: 3 }}>{pt.lat.toFixed(4)}°, {pt.lng.toFixed(4)}°</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#888", paddingRight: 8, paddingBottom: 3 }}>Scan type</td>
                      <td style={{ paddingBottom: 3 }}>{pt.type}</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#888", paddingRight: 8, paddingBottom: 3 }}>Scanned by</td>
                      <td style={{ paddingBottom: 3 }}>{pt.scannedByRole}</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#888", paddingRight: 8 }}>Time</td>
                      <td>{formatDate(pt.createdAt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Empty-state overlay (shown over the map when no GPS scans exist yet) */}
      {points.length === 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-sm"
        >
          <MapPin className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No location-tagged scans yet</p>
          <p className="text-xs text-muted-foreground/50">Allow location access when scanning to see data here</p>
        </div>
      )}

      {/* Status legend */}
      <div className="absolute bottom-8 left-3 z-[1000] flex flex-wrap gap-1.5 pointer-events-none">
        {Object.entries(STATUS_COLOR).map(([key, color]) => (
          <div
            key={key}
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm"
            style={{ borderColor: `${color}55`, background: `${color}18`, color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {key.toLowerCase()}
          </div>
        ))}
        {points.length > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white/50 uppercase tracking-wide backdrop-blur-sm">
            {points.length} scans
          </div>
        )}
      </div>
    </div>
  );
}
