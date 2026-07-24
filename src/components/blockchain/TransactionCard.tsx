import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  Hash, MapPin, Building2, Clock, QrCode, ShieldCheck,
  AlertTriangle, XCircle, CheckCircle2, Copy, ExternalLink, Loader2, RefreshCw,
} from "lucide-react";
import { ease } from "@/lib/motion";

type CardStatus = "genuine" | "suspicious" | "fake";

interface TxCardData {
  id: string;
  txHash: string | null;
  batchId: string;
  manufacturer: string;
  location: string;
  verificationResult: CardStatus;
  qrAuthentic: boolean;
  timestamp: string;
  blockchainStatus: "confirmed" | "pending" | "failed";
  medicineLabel: string;
  scansCount: number;
}

const STATUS_CFG: Record<CardStatus, {
  color: string; bg: string; border: string;
  glow: string; label: string; icon: typeof CheckCircle2;
  gradient: string;
}> = {
  genuine: {
    color: "#16a34a", bg: "#16a34a0d", border: "#16a34a55",
    glow: "0 0 40px 0 #16a34a33, 0 0 80px 0 #16a34a11",
    label: "Genuine", icon: CheckCircle2,
    gradient: "linear-gradient(135deg, #16a34a22, #06b6d422, transparent)",
  },
  suspicious: {
    color: "#f59e0b", bg: "#f59e0b0d", border: "#f59e0b55",
    glow: "0 0 40px 0 #f59e0b33, 0 0 80px 0 #f59e0b11",
    label: "Suspicious", icon: AlertTriangle,
    gradient: "linear-gradient(135deg, #f59e0b22, #dc262622, transparent)",
  },
  fake: {
    color: "#dc2626", bg: "#dc26260d", border: "#dc262655",
    glow: "0 0 40px 0 #dc262633, 0 0 80px 0 #dc262611",
    label: "Counterfeit", icon: XCircle,
    gradient: "linear-gradient(135deg, #dc262622, #7f1d1d22, transparent)",
  },
};

function HoloCard({ card }: { card: TxCardData }) {
  const cfg = STATUS_CFG[card.verificationResult] || STATUS_CFG.genuine;
  const Icon = cfg.icon;
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-150, 150], [8, -8]), { stiffness: 200, damping: 25 });
  const rotateY = useSpring(useTransform(mouseX, [-150, 150], [-8, 8]), { stiffness: 200, damping: 25 });
  const glareX = useTransform(mouseX, [-150, 150], [0, 100]);
  const glareY = useTransform(mouseY, [-150, 150], [0, 100]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    mouseX.set(e.clientX - cx);
    mouseY.set(e.clientY - cy);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  }

  function copyHash() {
    if (!card.txHash) return;
    navigator.clipboard.writeText(card.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const blockStatusCfg = {
    confirmed: { color: "#16a34a", label: "Confirmed" },
    pending: { color: "#f59e0b", label: "Pending" },
    failed: { color: "#dc2626", label: "Failed" },
  }[card.blockchainStatus] || { color: "#16a34a", label: "Confirmed" };

  return (
    <motion.div
      ref={cardRef}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        background: "rgba(10,12,20,0.85)",
        border: `1px solid ${isHovered ? cfg.border : "rgba(255,255,255,0.08)"}`,
        boxShadow: isHovered ? cfg.glow : "none",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease",
      } as React.CSSProperties}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      initial={{ opacity: 0, y: 32, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease }}
      className="relative overflow-hidden rounded-2xl cursor-pointer"
    >
      <motion.div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: cfg.gradient, opacity: isHovered ? 1 : 0.5 }}
        animate={{ opacity: isHovered ? 1 : 0.5 }}
        transition={{ duration: 0.4 }}
      />

      {isHovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-10 rounded-2xl"
          style={{
            background: `radial-gradient(circle at ${glareX.get()}% ${glareY.get()}%, rgba(255,255,255,0.07) 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Card content */}
      <div className="relative z-20 p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl border"
              style={{ borderColor: cfg.border, background: cfg.bg }}
            >
              <Icon className="h-5 w-5" style={{ color: cfg.color }} />
            </div>
            <div>
              <p className="text-[13px] font-bold leading-tight">{card.medicineLabel}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{card.batchId}</p>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            {cfg.label}
          </span>
        </div>

        {/* Fields */}
        <div className="space-y-2.5 mb-4">
          {[
            { icon: Building2, label: "Manufacturer", value: card.manufacturer },
            { icon: MapPin, label: "Location", value: card.location },
            { icon: Clock, label: "Timestamp", value: card.timestamp },
          ].map(({ icon: FIcon, label, value }) => (
            <div key={label} className="flex items-center gap-2.5 text-[12px]">
              <FIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground w-20 shrink-0">{label}</span>
              <span className="font-medium truncate">{value}</span>
            </div>
          ))}
        </div>

        {/* QR authenticity */}
        <div
          className="mb-4 flex items-center gap-2.5 rounded-xl border p-3"
          style={{ borderColor: card.qrAuthentic ? "#16a34a44" : "#dc262644", background: card.qrAuthentic ? "#16a34a0d" : "#dc26260d" }}
        >
          <QrCode className="h-4 w-4 shrink-0" style={{ color: card.qrAuthentic ? "#16a34a" : "#dc2626" }} />
          <span className="text-[12px] font-semibold" style={{ color: card.qrAuthentic ? "#16a34a" : "#dc2626" }}>
            QR {card.qrAuthentic ? "Authentic — Hash Matched" : "INVALID — Hash Mismatch"}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">{card.scansCount}x scanned</span>
        </div>

        {/* TX Hash */}
        <div className="mb-4 rounded-xl border border-border/30 bg-black/20 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <Hash className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">TX Hash</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] text-foreground/70 truncate">
              {card.txHash ?? "Pending Anchoring"}
            </p>
            {card.txHash && (
              <button
                onClick={copyHash}
                className="shrink-0 rounded-lg border border-border/30 p-1.5 transition-colors hover:bg-white/5"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          {copied && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1 text-[10px] font-medium"
              style={{ color: cfg.color }}
            >
              ✓ Copied to clipboard
            </motion.p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: blockStatusCfg.color,
                boxShadow: `0 0 6px ${blockStatusCfg.color}`,
              }}
            />
            <span className="text-[11px] font-semibold" style={{ color: blockStatusCfg.color }}>
              {blockStatusCfg.label}
            </span>
          </div>
          {card.txHash && card.txHash.startsWith("0x") && card.txHash.length > 20 ? (
            <a
              href={`https://amoy.polygonscan.com/tx/${card.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-[#06b6d4] hover:underline"
            >
              View on explorer <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-[11px] text-muted-foreground">Ledger entry</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function TransactionCards() {
  const [cards, setCards] = useState<TxCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/blockchain/cards");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCards(json.data);
        setError(null);
      } else {
        setError(json.error || "Failed to load transaction cards");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading cards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  if (loading && cards.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border/40 bg-card/60">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1a56db]" />
          <p className="text-[13px] font-medium text-muted-foreground">Loading transaction records…</p>
        </div>
      </div>
    );
  }

  if (error && cards.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="text-sm font-bold text-red-500">{error}</p>
          <button
            onClick={fetchCards}
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1a56db]/10 border border-[#1a56db]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#1a56db] mb-2">
            <ShieldCheck className="h-3 w-3" /> Transaction Records
          </span>
          <h2 className="text-2xl font-bold tracking-tight">Holographic Transaction Cards</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Hover for 3D tilt · Each card is an immutable blockchain record
          </p>
        </div>
        <button
          onClick={fetchCards}
          className="flex items-center gap-1.5 rounded-xl border border-border/40 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-12 text-center text-muted-foreground">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm font-bold">No pill transaction cards found</p>
          <p className="mt-1 text-xs">Generate batches or perform verifications to see real holographic transaction cards.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, i) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.55, ease }}
            >
              <HoloCard card={card} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
