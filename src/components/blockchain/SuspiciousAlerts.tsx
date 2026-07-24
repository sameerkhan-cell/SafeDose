import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ShieldAlert, MapPin, Clock, Wifi, Copy,
  Eye, Zap, XCircle, RefreshCw, ChevronRight, CheckCircle2, Loader2,
} from "lucide-react";
import { ease } from "@/lib/motion";
import { formatDistanceToNow } from "date-fns";

type ThreatLevel = "critical" | "high" | "medium";

interface RealFraudAlert {
  id: string;
  alertType: string;
  qrCode: string;
  severity: string;
  riskScore: number;
  message: string;
  region: string | null;
  isResolved: boolean;
  metadata: string | null;
  createdAt: string;
  medicineName?: string;
  batchNumber?: string;
}

interface AlertCardData {
  id: string;
  type: "duplicate_qr" | "geo_mismatch" | "invalid_hash" | "already_sold" | "suspicious_attempt";
  threatLevel: ThreatLevel;
  medicine: string;
  batchId: string;
  description: string;
  location: string;
  timestamp: string;
  aiLabel: string;
  txHash: string;
  scanCount: number;
  timeDelta?: string;
}

const THREAT_CFG: Record<ThreatLevel, { color: string; bg: string; border: string; glow: string; label: string }> = {
  critical: { color: "#dc2626", bg: "#dc262611", border: "#dc262644", glow: "0 0 40px 0 #dc262622", label: "CRITICAL" },
  high:     { color: "#f59e0b", bg: "#f59e0b11", border: "#f59e0b44", glow: "0 0 30px 0 #f59e0b22", label: "HIGH" },
  medium:   { color: "#8b5cf6", bg: "#8b5cf611", border: "#8b5cf644", glow: "0 0 20px 0 #8b5cf622", label: "MEDIUM" },
};

const TYPE_LABELS: Record<AlertCardData["type"], string> = {
  duplicate_qr:       "Duplicate QR Scan",
  geo_mismatch:       "Geo-Location Mismatch",
  invalid_hash:       "Invalid Blockchain Hash",
  already_sold:       "Already-Sold Medicine",
  suspicious_attempt: "Suspicious Scan Pattern",
};

function mapAlertToCard(raw: RealFraudAlert): AlertCardData {
  let threatLevel: ThreatLevel = "medium";
  const sev = String(raw.severity).toUpperCase();
  if (sev === "CRITICAL") threatLevel = "critical";
  else if (sev === "HIGH") threatLevel = "high";
  else threatLevel = "medium";

  let type: AlertCardData["type"] = "suspicious_attempt";
  if (raw.alertType === "DUPLICATE_SCAN") type = "duplicate_qr";
  else if (raw.alertType === "GEO_ANOMALY") type = "geo_mismatch";

  return {
    id: raw.id,
    type,
    threatLevel,
    medicine: raw.medicineName || "Medicine Unit",
    batchId: raw.batchNumber || raw.qrCode,
    description: raw.message || `Fraud anomaly flagged for QR code ${raw.qrCode}`,
    location: raw.region || "Verified Location",
    timestamp: formatDistanceToNow(new Date(raw.createdAt), { addSuffix: true }),
    aiLabel: `AI Threat Score: ${raw.riskScore}/100 · ${raw.alertType}`,
    txHash: raw.qrCode,
    scanCount: raw.alertType === "DUPLICATE_SCAN" ? 2 : 1,
  };
}

export function SuspiciousAlerts() {
  const [alerts, setAlerts] = useState<AlertCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/fraud/alerts");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mapped = json.data.map(mapAlertToCard);
        setAlerts(mapped);
        if (mapped.length > 0 && !expanded) {
          setExpanded(mapped[0].id);
        }
        setError(null);
      } else {
        setError(json.error || "Failed to load fraud alerts");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setResolvingId(id);
      await fetch("/api/fraud/resolve-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    } finally {
      setResolvingId(null);
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border/40 bg-card/60">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#dc2626]" />
          <p className="text-[13px] font-medium text-muted-foreground">Scanning network threat feed…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dc2626]/10 border border-[#dc2626]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#dc2626]">
              <ShieldAlert className="h-3 w-3" />
              <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                Live Threat Feed
              </motion.span>
            </span>
            <span className="rounded-full bg-[#dc2626]/10 border border-[#dc2626]/30 px-2.5 py-0.5 text-[11px] font-bold text-[#dc2626]">
              {alerts.length} Active
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Suspicious Scan Alerts</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            AI-powered fraud detection · Real-time threat classification
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="flex items-center gap-1.5 rounded-xl border border-border/40 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Threat level summary bar */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {(["critical", "high", "medium"] as ThreatLevel[]).map((level) => {
          const cfg = THREAT_CFG[level];
          const count = alerts.filter((a) => a.threatLevel === level).length;
          return (
            <div
              key={level}
              className="rounded-xl border p-4 text-center"
              style={{ borderColor: cfg.border, background: cfg.bg }}
            >
              <p className="text-2xl font-black tabular-nums" style={{ color: cfg.color }}>{count}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Alert cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {alerts.map((alert) => {
            const cfg = THREAT_CFG[alert.threatLevel];
            const isExpanded = expanded === alert.id;
            const isCritical = alert.threatLevel === "critical";
            const isResolving = resolvingId === alert.id;

            return (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ duration: 0.4, ease }}
                className="overflow-hidden rounded-2xl border cursor-pointer"
                style={{
                  borderColor: isExpanded ? cfg.border : "rgba(255,255,255,0.07)",
                  background: isExpanded ? cfg.bg : "rgba(255,255,255,0.02)",
                  boxShadow: isExpanded ? cfg.glow : "none",
                }}
                onClick={() => setExpanded(isExpanded ? null : alert.id)}
              >
                {/* Alert header */}
                <div className="flex items-start gap-3 p-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2"
                    style={{ borderColor: cfg.border, background: cfg.bg }}
                  >
                    {isCritical ? (
                      <XCircle className="h-4 w-4" style={{ color: cfg.color }} />
                    ) : (
                      <AlertTriangle className="h-4 w-4" style={{ color: cfg.color }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-[12px] font-bold text-foreground">
                        {TYPE_LABELS[alert.type] || alert.type}
                      </span>
                    </div>
                    <p className="text-[12px] font-semibold text-muted-foreground">{alert.medicine}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {alert.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {alert.timestamp}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={(e) => handleResolve(alert.id, e)}
                      disabled={isResolving}
                      className="rounded-lg border border-border/30 px-2 py-1 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/40"
                    >
                      {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resolve"}
                    </button>
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground/40 transition-transform duration-200"
                      style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                    />
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t px-5 py-5" style={{ borderColor: cfg.border }}>
                        <div
                          className="flex items-center gap-2.5 rounded-xl border p-3"
                          style={{ borderColor: cfg.border, background: cfg.bg }}
                        >
                          <Zap className="h-4 w-4 shrink-0" style={{ color: cfg.color }} />
                          <span className="text-[12px] font-bold" style={{ color: cfg.color }}>
                            {alert.aiLabel}
                          </span>
                        </div>

                        <p className="text-[13px] text-muted-foreground leading-relaxed">{alert.description}</p>

                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <div className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/30 px-3 py-2.5 text-[12px]">
                            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-muted-foreground">Reference:</span>
                            <span className="font-bold font-mono">{alert.batchId}</span>
                          </div>
                          <div className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/30 px-3 py-2.5 text-[12px]">
                            <Wifi className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-muted-foreground">Alert Type:</span>
                            <span className="font-bold">{TYPE_LABELS[alert.type]}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={(e) => handleResolve(alert.id, e)}
                            disabled={isResolving}
                            className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-semibold transition-colors hover:opacity-80 border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {isResolving ? "Resolving…" : "Mark as Resolved"}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {alerts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-[#16a34a]/30 bg-[#16a34a]/5 p-10 text-center"
          >
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-[#16a34a]" />
            <p className="font-bold text-[#16a34a]">No Active Fraud Alerts</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              All security alerts resolved · Supply chain integrity nominal
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
