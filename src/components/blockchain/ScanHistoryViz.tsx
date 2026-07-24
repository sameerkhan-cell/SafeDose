import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode, MapPin, Clock, ShieldCheck, ShieldAlert,
  AlertTriangle, CheckCircle2, XCircle, Smartphone,
  User, Store, Truck, Filter, Loader2, RefreshCw,
} from "lucide-react";
import { ease } from "@/lib/motion";

type ScanResult = "genuine" | "suspicious" | "fake" | "duplicate";
type UserType   = "customer" | "pharmacy" | "distributor" | "inspector";

interface ScanEvent {
  id: string;
  medicine:  string;
  batchId:   string;
  location:  string;
  timestamp: string;
  userType:  UserType;
  result:    ScanResult;
  device:    string;
  txHash:    string;
  scanIndex: number;
}

const RESULT_CFG: Record<ScanResult, { color: string; bg: string; border: string; glow: string; label: string; icon: typeof CheckCircle2 }> = {
  genuine:    { color: "#16a34a", bg: "#16a34a11", border: "#16a34a44", glow: "#16a34a33", label: "Genuine",    icon: CheckCircle2 },
  suspicious: { color: "#f59e0b", bg: "#f59e0b11", border: "#f59e0b44", glow: "#f59e0b33", label: "Suspicious", icon: AlertTriangle },
  fake:       { color: "#dc2626", bg: "#dc262611", border: "#dc262644", glow: "#dc262633", label: "Fake",        icon: XCircle },
  duplicate:  { color: "#dc2626", bg: "#dc262611", border: "#dc262644", glow: "#dc262633", label: "Duplicate",   icon: ShieldAlert },
};

const USER_ICONS: Record<UserType, typeof User> = {
  customer:    Smartphone,
  pharmacy:    Store,
  distributor: Truck,
  inspector:   ShieldCheck,
};

const FILTERS: { key: ScanResult | "all"; label: string }[] = [
  { key: "all",        label: "All Scans" },
  { key: "genuine",    label: "Genuine" },
  { key: "suspicious", label: "Suspicious" },
  { key: "fake",       label: "Fake" },
  { key: "duplicate",  label: "Duplicate" },
];

function PulseRing({ color }: { color: string }) {
  return (
    <>
      {[1, 1.6, 2.2].map((scale, i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: color }}
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale, opacity: 0 }}
          transition={{ duration: 1.8, delay: i * 0.4, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

export function ScanHistoryViz() {
  const [scans, setScans] = useState<ScanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter]     = useState<ScanResult | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchScans = useCallback(async () => {
    try {
      const url = filter !== "all"
        ? `/api/blockchain/scan-history?status=${filter}&take=50`
        : "/api/blockchain/scan-history?take=50";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setScans(json.data);
        if (json.data.length > 0 && !expanded) {
          setExpanded(json.data[0].id);
        }
        setError(null);
      } else {
        setError(json.error || "Failed to load scan history");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading scan history");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Initial load + re-fetch on filter change
  useEffect(() => {
    setLoading(true);
    fetchScans();
  }, [fetchScans]);

  // Real-time polling every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchScans, 15000);
    return () => clearInterval(interval);
  }, [fetchScans]);

  // Filter client-side for instant UI (API already filters, but client-side keeps state consistent)
  const visible = filter === "all" ? scans : scans.filter(s => s.result === filter);

  const totals = {
    genuine:    scans.filter(s => s.result === "genuine").length,
    suspicious: scans.filter(s => s.result === "suspicious").length,
    fake:       scans.filter(s => s.result === "fake").length,
    duplicate:  scans.filter(s => s.result === "duplicate").length,
  };

  if (loading && scans.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border/40 bg-card/60">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#06b6d4]" />
          <p className="text-[13px] font-medium text-muted-foreground">Loading scan history from blockchain ledger…</p>
        </div>
      </div>
    );
  }

  if (error && scans.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="text-sm font-bold text-red-500">{error}</p>
          <button
            onClick={fetchScans}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#06b6d4] mb-2">
          <QrCode className="h-3 w-3" /> Scan History
        </span>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Scan Timeline</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {scans.length} real scan{scans.length !== 1 ? "s" : ""} · live blockchain verification log
            </p>
          </div>
          {/* Live polling indicator */}
          <button
            onClick={fetchScans}
            className="shrink-0 flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold transition-all duration-300 border-[#16a34a]/30 bg-[#16a34a]/08 text-[#16a34a] hover:bg-[#16a34a]/15"
          >
            <motion.span
              className="h-2 w-2 rounded-full bg-[#16a34a]"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            Live · 15s refresh
          </button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["genuine", "suspicious", "fake", "duplicate"] as ScanResult[]).map(r => {
          const cfg = RESULT_CFG[r];
          const Icon = cfg.icon;
          return (
            <div
              key={r}
              className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-200"
              style={{
                borderColor: filter === r ? cfg.border : "rgba(255,255,255,0.07)",
                background: filter === r ? cfg.bg : "rgba(255,255,255,0.02)",
              }}
              onClick={() => setFilter(f => f === r ? "all" : r)}
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: cfg.color }} />
              <div>
                <p className="text-lg font-black tabular-nums" style={{ color: cfg.color }}>{totals[r]}</p>
                <p className="text-[10px] font-semibold text-muted-foreground capitalize">{r}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter pills */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-200"
            style={{
              background: filter === f.key ? (f.key === "all" ? "#1a56db22" : `${RESULT_CFG[f.key as ScanResult]?.color}22`) : "rgba(255,255,255,0.05)",
              color:      filter === f.key ? (f.key === "all" ? "#1a56db" : RESULT_CFG[f.key as ScanResult]?.color) : "var(--muted-foreground)",
              border:     `1px solid ${filter === f.key ? (f.key === "all" ? "#1a56db44" : `${RESULT_CFG[f.key as ScanResult]?.color}44`) : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-12 text-center text-muted-foreground">
          <QrCode className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm font-bold">
            {scans.length === 0 ? "No verification scans recorded yet" : `No ${filter} scans in this filter`}
          </p>
          <p className="mt-1 text-xs">
            {scans.length === 0
              ? "Scan a medicine QR code to populate the blockchain ledger."
              : "Try switching to 'All Scans' to see all entries."}
          </p>
        </div>
      )}

      {/* Timeline */}
      {visible.length > 0 && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[23px] top-0 bottom-0 w-px bg-border/20 hidden sm:block" />

          <div className="space-y-3">
            <AnimatePresence>
              {visible.map((scan, idx) => {
                const cfg = RESULT_CFG[scan.result];
                const Icon = cfg.icon;
                const UserIcon = USER_ICONS[scan.userType];
                const isExpanded = expanded === scan.id;
                const isAlert    = scan.result === "fake" || scan.result === "duplicate";

                return (
                  <motion.div
                    key={scan.id}
                    layout
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24, height: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.04, ease }}
                    className="relative sm:pl-14"
                  >
                    {/* Node */}
                    <div className="absolute left-0 top-4 hidden sm:flex h-[46px] w-[46px] items-center justify-center z-10">
                      <div
                        className="relative flex h-[46px] w-[46px] items-center justify-center rounded-full border-2"
                        style={{ borderColor: cfg.border, background: cfg.bg }}
                      >
                        {isAlert && <PulseRing color={cfg.color} />}
                        <Icon className="h-4 w-4 relative z-10" style={{ color: cfg.color }} />
                      </div>
                    </div>

                    {/* Card */}
                    <motion.div
                      className="overflow-hidden rounded-2xl border cursor-pointer"
                      style={{
                        borderColor: isExpanded ? cfg.border : "rgba(255,255,255,0.07)",
                        background:  isExpanded ? cfg.bg : "rgba(255,255,255,0.02)",
                        boxShadow:   isExpanded ? `0 0 30px 0 ${cfg.glow}` : "none",
                      }}
                      transition={{ duration: 0.4 }}
                      onClick={() => setExpanded(isExpanded ? null : scan.id)}
                      whileHover={{ scale: 1.003 }}
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-3 px-5 py-4">
                        {/* Mobile icon */}
                        <div
                          className="flex sm:hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                          style={{ borderColor: cfg.border, background: cfg.bg }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[13px] font-bold truncate">{scan.medicine}</span>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
                              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                            >
                              {cfg.label}
                            </span>
                            {isAlert && (
                              <motion.span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black"
                                style={{ background: "#dc262622", color: "#dc2626" }}
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity }}
                              >
                                ⚠ ALERT
                              </motion.span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{scan.location}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{scan.timestamp}</span>
                            <span className="flex items-center gap-1 capitalize"><UserIcon className="h-3 w-3" />{scan.userType}</span>
                          </div>
                        </div>

                        <span
                          className="hidden sm:block shrink-0 text-[10px] font-bold tabular-nums rounded-full px-2 py-1"
                          style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted-foreground)" }}
                        >
                          #{scan.scanIndex}
                        </span>
                      </div>

                      {/* Expanded */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease }}
                            className="overflow-hidden"
                          >
                            <div className="border-t px-5 py-5 space-y-4" style={{ borderColor: cfg.border }}>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {[
                                  { label: "Batch ID",   value: scan.batchId,   mono: true },
                                  { label: "Device",     value: scan.device,    mono: false },
                                  { label: "User Type",  value: scan.userType,  mono: false },
                                  { label: "Scan Index", value: `#${scan.scanIndex}`, mono: true },
                                ].map(f => (
                                  <div key={f.label} className="rounded-xl border border-border/25 bg-card/30 px-4 py-3">
                                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-bold">{f.label}</p>
                                    <p className={`text-[12px] font-bold ${f.mono ? "font-mono" : ""} capitalize`}>{f.value}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="rounded-xl border border-border/25 bg-black/20 p-3 font-mono">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1.5">TX Hash</p>
                                <p className="text-[11px] text-foreground/70 break-all">{scan.txHash}</p>
                              </div>
                              {/* Signal bar */}
                              <div className="relative h-10 overflow-hidden rounded-xl border border-border/20 bg-black/10">
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <motion.div
                                    className="h-px w-full"
                                    style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }}
                                    animate={{ scaleX: [0.3, 1, 0.3], opacity: [0.4, 1, 0.4] }}
                                    transition={{ duration: 1.6, repeat: Infinity }}
                                  />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                                    QR Signal Authenticated · {cfg.label.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
