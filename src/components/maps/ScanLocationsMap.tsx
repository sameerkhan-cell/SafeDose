import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { getStoredSession } from "@/services/auth";

interface ScanPoint {
  lat: number;
  lng: number;
  status: string;
  code: string;
  createdAt: string;
  location?: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  GENUINE: "#16A34A",
  DUPLICATE: "#D97706",
  SUSPECTED: "#D97706",
  INVALID: "#DC2626",
};

export function ScanLocationsMap({ endpoint, title }: { endpoint: string; title: string }) {
  const [points, setPoints] = useState<ScanPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredSession()?.token;

    fetch(endpoint, { headers: { Authorization: `Bearer ${token ?? ""}` } })
      .then(r => r.json())
      .then(data => { if (data.success) setPoints(data.data); })
      .finally(() => setLoading(false));
  }, [endpoint]);

  const center: [number, number] = points.length > 0 ? [points[0].lat, points[0].lng] : [30.3753, 69.3451]; // Pakistan centroid fallback

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="p-4 border-b border-border/40">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {loading ? "Loading..." : points.length === 0 ? "No GPS-tagged scans yet" : `${points.length} scan${points.length !== 1 ? "s" : ""} tracked`}
        </p>
      </div>
      {points.length === 0 && !loading ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Scans will appear here once patients/pharmacies allow location access
        </div>
      ) : (
        <MapContainer center={center} zoom={points.length > 0 ? 6 : 5} style={{ height: "280px", width: "100%" }} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((p, i) => (
            <CircleMarker
              key={i}
              center={[p.lat, p.lng]}
              radius={7}
              pathOptions={{ color: STATUS_COLOR[p.status] ?? "#64748B", fillColor: STATUS_COLOR[p.status] ?? "#64748B", fillOpacity: 0.7 }}
            >
              <Popup>
                <div style={{ fontSize: 12 }}>
                  <strong>{p.status}</strong><br />
                  {p.code}<br />
                  {new Date(p.createdAt).toLocaleString()}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      )}
      <div className="flex gap-3 p-3 border-t border-border/30">
        {Object.entries(STATUS_COLOR).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px] text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
