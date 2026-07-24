import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash, MapPin, Clock, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Link2, Cpu, Loader2, RefreshCw,
} from "lucide-react";
import { ease } from "@/lib/motion";

type TxStatus = "verified" | "transfer" | "suspicious" | "scan" | "flagged";

interface BlockchainTx {
  id: string;
  txHash: string;
  actor: string;
  role: string;
  location: string;
  timestamp: string;
  status: TxStatus;
  medicineStatus: string;
  blockNumber: number;
  confirmations: number;
  detail: string;
  gasUsed?: number;
}

const STATUS_CONFIG: Record<TxStatus, { color: string; bg: string; border: string; glow: string; icon: typeof CheckCircle2; label: string }> = {
  verified:   { color: "#16a34a", bg: "#16a34a14", border: "#16a34a44", glow: "#16a34a33", icon: CheckCircle2, label: "Verified" },
  transfer:   { color: "#1a56db", bg: "#1a56db14", border: "#1a56db44", glow: "#1a56db33", icon: Link2, label: "Transfer" },
  scan:       { color: "#06b6d4", bg: "#06b6d414", border: "#06b6d444", glow: "#06b6d433", icon: Cpu, label: "Scan" },
  suspicious: { color: "#f59e0b", bg: "#f59e0b14", border: "#f59e0b44", glow: "#f59e0b33", icon: AlertTriangle, label: "Suspicious" },
  flagged:    { color: "#dc2626", bg: "#dc262614", border: "#dc262644", glow: "#dc262633", icon: XCircle, label: "Flagged" },
};

export function BlockchainTimeline() {
  const [transactions, setTransactions] = useState<BlockchainTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/blockchain/timeline");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTransactions(json.data);
        if (json.data.length > 0 && !expanded) {
          setExpanded(json.data[0].id);
        }
        setError(null);
      } else {
        setError(json.error || "Failed to load timeline events");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading timeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  if (loading && transactions.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border/40 bg-card/60">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#06b6d4]" />
          <p className="text-[13px] font-medium text-muted-foreground">Loading blockchain transaction timeline…</p>
        </div>
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="text-sm font-bold text-red-500">{error}</p>
          <button
            onClick={fetchTimeline}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#06b6d4]">
              <Hash className="h-3 w-3" /> Blockchain Timeline
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Transaction History</h2>
          <p className="mt-1 text-[13px] font-medium text-foreground/80">
            {transactions.length} blockchain events · {transactions.filter((t) => t.status === "verified" || t.status === "scan").length} verified
          </p>
        </div>
        <button
          onClick={fetchTimeline}
          className="flex items-center gap-1.5 rounded-xl border border-border/40 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-12 text-center text-muted-foreground">
          <Hash className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm font-bold">No blockchain transactions recorded yet</p>
          <p className="mt-1 text-xs">Create a batch or scan a medicine QR code to generate real timeline events.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[23px] top-0 bottom-0 w-px bg-border/30 hidden sm:block" />

          <div className="space-y-3">
            {transactions.map((tx) => {
              const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG.transfer;
              const Icon = cfg.icon;
              const isExpanded = expanded === tx.id;
              const isAlert = tx.status === "suspicious" || tx.status === "flagged";

              return (
                <motion.div
                  key={tx.id}
                  className="relative sm:pl-14"
                >
                  {/* Node dot */}
                  <div
                    className="absolute left-0 top-4 hidden sm:flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 z-10"
                    style={{ borderColor: cfg.border, background: cfg.bg }}
                  >
                    <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                    {isAlert && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2"
                        style={{ borderColor: cfg.color }}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                      />
                    )}
                  </div>

                  {/* Card */}
                  <motion.div
                    className="overflow-hidden rounded-2xl border cursor-pointer transition-all duration-300"
                    style={{
                      borderColor: isExpanded ? cfg.border : "var(--border)",
                      background: isExpanded ? cfg.bg : "var(--card)",
                      boxShadow: isExpanded ? `0 0 30px 0 ${cfg.glow}` : "none",
                    }}
                    onClick={() => setExpanded(isExpanded ? null : tx.id)}
                    whileHover={{ scale: 1.005 }}
                    transition={{ duration: 0.2, ease }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3 px-5 py-4">
                      <div
                        className="flex sm:hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                        style={{ borderColor: cfg.border, background: cfg.bg }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-bold truncate">{tx.actor}</span>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                          >
                            {cfg.label}
                          </span>
                          {isAlert && (
                            <motion.span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: "#dc262622", color: "#dc2626" }}
                              animate={{ opacity: [1, 0.4, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                            >
                              ⚠ ALERT
                            </motion.span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11.5px] font-medium text-foreground/80">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {tx.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {tx.timestamp}
                          </span>
                          <span className="hidden sm:flex items-center gap-1 font-mono">
                            <Hash className="h-3 w-3" />{" "}
                            {tx.txHash.startsWith("0x") && tx.txHash.length > 20
                              ? `${tx.txHash.slice(0, 18)}…`
                              : tx.txHash}
                          </span>
                        </div>
                      </div>

                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <div
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {tx.confirmations.toLocaleString()}
                        </div>
                        <span className="text-[10px] font-medium text-foreground/70">confirmations</span>
                      </div>

                      <div className="text-muted-foreground/40">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                          <div className="border-t px-5 py-5 space-y-4" style={{ borderColor: cfg.border }}>
                            <p className="text-[13px] text-muted-foreground leading-relaxed">{tx.detail}</p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              {[
                                { label: "Block #", value: tx.blockNumber > 0 ? `#${tx.blockNumber.toLocaleString()}` : "Pending" },
                                { label: "Gas Used", value: tx.gasUsed != null ? tx.gasUsed.toLocaleString() : "—" },
                                { label: "Role", value: tx.role },
                                { label: "Medicine", value: tx.medicineStatus },
                              ].map((f) => (
                                <div key={f.label} className="rounded-xl border border-border/30 bg-card/60 px-3 py-2.5">
                                  <p className="text-[11px] font-bold text-foreground/70 mb-1">{f.label}</p>
                                  <p className="text-[13px] font-black font-mono text-foreground/90">{f.value}</p>
                                </div>
                              ))}
                            </div>
                            <div className="rounded-xl border border-border/30 bg-card/60 p-3">
                              <p className="text-[11px] text-foreground/70 mb-1.5 uppercase tracking-wide font-bold">Full TX Hash</p>
                              <p className="font-mono font-bold text-[12px] break-all text-foreground/90">{tx.txHash}</p>
                              {tx.txHash && tx.txHash.startsWith("0x") && tx.txHash.length > 20 && (
                                <a
                                  href={`https://amoy.polygonscan.com/tx/${tx.txHash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-xs text-[#06b6d4] hover:underline"
                                >
                                  View on PolygonScan <Link2 className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
