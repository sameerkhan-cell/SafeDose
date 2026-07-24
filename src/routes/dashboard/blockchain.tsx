import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Activity, AlertTriangle, QrCode,
  MapPin, Hash, BarChart3, Zap, Lock, ChevronRight, Cpu, Loader2,
} from "lucide-react";
import { DASH_NAV } from "@/config/nav";
import { DashShell } from "@/components/dashboard/DashShell";
import { LiveBlockchainDashboard } from "@/components/blockchain/LiveBlockchainDashboard";
import { MedicineJourneyTracker } from "@/components/blockchain/MedicineJourneyTracker";
import { BlockchainTimeline } from "@/components/blockchain/BlockchainTimeline";
import { TransactionCards } from "@/components/blockchain/TransactionCard";
import { SuspiciousAlerts } from "@/components/blockchain/SuspiciousAlerts";
import { GeoMismatchMap } from "@/components/blockchain/GeoMismatchMap";
import { QRAuthFlow } from "@/components/blockchain/QRAuthFlow";
import { ScanHistoryViz } from "@/components/blockchain/ScanHistoryViz";
import { ease } from "@/lib/motion";
import { useAuth } from "@/lib/auth-context";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/blockchain")({
  head: () => ({
    meta: [
      { title: "Blockchain Command Center — MediVerify" },
      { name: "description", content: "Futuristic blockchain visualization system for medicine verification." },
    ],
  }),
  component: BlockchainPage,
});


type TabId =
  | "dashboard"
  | "journey"
  | "timeline"
  | "cards"
  | "alerts"
  | "geo"
  | "qr"
  | "history";

const TABS: { id: TabId; label: string; icon: typeof Hash; color: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3, color: "#1a56db" },
  { id: "journey", label: "Journey", icon: ChevronRight, color: "#16a34a" },
  { id: "timeline", label: "Timeline", icon: Hash, color: "#06b6d4" },
  { id: "cards", label: "TX Cards", icon: ShieldCheck, color: "#1a56db" },
  { id: "alerts", label: "Alerts", icon: AlertTriangle, color: "#dc2626" },
  { id: "geo", label: "Geo Map", icon: MapPin, color: "#dc2626" },
  { id: "qr", label: "QR Auth", icon: QrCode, color: "#8b5cf6" },
  { id: "history", label: "Scan Log", icon: Activity, color: "#06b6d4" },
];

// Animated ambient particle grid background
function ParticleField() {
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    dur: Math.random() * 6 + 4,
    delay: Math.random() * 4,
    color: ["#1a56db", "#06b6d4", "#16a34a", "#8b5cf6"][Math.floor(Math.random() * 4)],
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Animated grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(26,86,219,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(26,86,219,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
      {/* Moving grid pulse */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "96px 96px",
        }}
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Floating particles */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      {/* Radial vignette glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 40% at 20% 0%, rgba(26,86,219,0.15) 0%, transparent 70%),
            radial-gradient(ellipse 50% 30% at 80% 100%, rgba(6,182,212,0.10) 0%, transparent 70%)
          `,
        }}
      />
    </div>
  );
}

// Live stats ticker in the header — fetches real data from the dashboard API
function LiveTicker() {
  const [totalScans, setTotalScans] = useState<number | null>(null);
  const [onChainTx, setOnChainTx] = useState<number | null>(null);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [networkOk, setNetworkOk] = useState(true);

  useEffect(() => {
    async function fetchLiveStats() {
      try {
        const res = await fetch("/api/blockchain/dashboard");
        const json = await res.json();
        if (json.success && json.data) {
          setTotalScans(json.data.stats.totalScans);
          setOnChainTx(json.data.blockchain.confirmedJobs);
          setBlockNumber(json.data.blockchain.blockNumber);
          setNetworkOk(json.data.stats.networkHealthy);
        }
      } catch {
        // fail silently — ticker shows last value
      }
    }
    fetchLiveStats();
    const id = setInterval(fetchLiveStats, 15000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { icon: Zap,       label: "Total Scans",    value: totalScans !== null ? totalScans.toLocaleString() : "—",   color: "#06b6d4" },
    { icon: ShieldCheck, label: "On-Chain Txs", value: onChainTx !== null ? onChainTx.toLocaleString() : "—",    color: "#16a34a" },
    { icon: Lock,      label: "Block Number",   value: blockNumber && blockNumber > 0 ? `#${blockNumber.toLocaleString()}` : "Connecting…", color: "#1a56db" },
    { icon: Cpu,       label: "AI Status",      value: networkOk ? "Online" : "Degraded",                         color: networkOk ? "#16a34a" : "#f59e0b" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {stats.map(s => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded-xl border px-3.5 py-2"
            style={{ borderColor: `${s.color}33`, background: `${s.color}0d` }}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: s.color }} />
            <div>
              <p className="text-[10px] text-muted-foreground leading-none">{s.label}</p>
              <motion.p
                key={s.value}
                initial={{ y: 4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-[12px] font-black tabular-nums leading-tight"
                style={{ color: s.color }}
              >
                {s.value}
              </motion.p>
            </div>
          </div>
        );
      })}
    </div>
  );
}


function BlockchainPage() {
  const { user, isAuthenticated, signOut, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const tabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "manufacturer" && user?.role !== "pharmacy") {
      signOut();
    }
  }, [isAuthenticated, user?.role, signOut]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "manufacturer" && user?.role !== "pharmacy") {
    return <Navigate to="/auth/login" />;
  }

  function scrollToContent() {
    setTimeout(() => {
      tabRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  const CONTENT: Record<TabId, React.ReactNode> = {
    dashboard: <LiveBlockchainDashboard />,
    journey: <MedicineJourneyTracker />,
    timeline: <BlockchainTimeline />,
    cards: <TransactionCards />,
    alerts: <SuspiciousAlerts />,
    geo: <GeoMismatchMap />,
    qr: <QRAuthFlow />,
    history: <ScanHistoryViz />,
  };

  return (
    <DashShell
      title="Blockchain Command Center"
      subtitle="Immersive supply-chain verification · powered by MediVerify AI"
      badge="Blockchain"
      nav={DASH_NAV}
    >
      {/* ── Hero Banner ── */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-[#1a56db]/30"
        style={{ background: "linear-gradient(135deg, rgba(10,12,24,0.98), rgba(13,17,32,0.95))" }}
      >
        <ParticleField />
        <div className="relative z-10 px-8 py-10 sm:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border-2"
                style={{ borderColor: "#1a56db55", background: "#1a56db22", boxShadow: "0 0 30px #1a56db44" }}
              >
                <Hash className="h-6 w-6 text-[#1a56db]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#06b6d4]">
                    MediVerify
                  </span>
                  <motion.span
                    className="rounded-full bg-[#16a34a]/20 border border-[#16a34a]/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#16a34a]"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    ● Live
                  </motion.span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">
                  Blockchain Command Center
                </h1>
              </div>
            </div>
            <p className="max-w-2xl text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              End-to-end pharmaceutical supply-chain verification. Every scan, transfer, and
              fraud event is immutably recorded on-chain. AI-powered anomaly detection runs
              in real time across{" "}
              <span style={{ color: "#06b6d4" }}>6 visualization modules</span> below.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6, ease }}
            className="mt-6"
          >
            <LiveTicker />
          </motion.div>
        </div>

        {/* Bottom glow bar */}
        <div
          className="absolute bottom-0 inset-x-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #1a56db, #06b6d4, #16a34a, transparent)" }}
        />
      </div>

      {/* ── Tab Navigation ── */}
      <div
        ref={tabRef}
        className="mb-6 flex overflow-x-auto gap-2 rounded-2xl border border-border/60 bg-card p-2 shadow-sm no-scrollbar whitespace-nowrap"
      >
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); scrollToContent(); }}
              className="relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-all duration-200"
              style={{
                background: isActive ? `${tab.color}15` : "transparent",
                color: isActive ? tab.color : "var(--foreground)",
                border: `1px solid ${isActive ? `${tab.color}44` : "transparent"}`,
                boxShadow: isActive ? `0 0 10px 0 ${tab.color}11` : "none",
                opacity: isActive ? 1 : 0.7,
              }}
              whileTap={{ scale: 0.97 }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 rounded-xl"
                  style={{ border: `1px solid ${tab.color}55` }}
                  transition={{ duration: 0.25, ease }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="min-h-[600px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.35, ease }}
          >
            {CONTENT[activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Full sections (all components stacked — for scroll / SEO) ── */}
      <div className="mt-16 space-y-24">
        {/* Section divider helper */}
        {([
          {
            id: "medicine-journey",
            title: "Medicine Journey Tracker",
            sub: "Full supply-chain lifecycle recorded on-chain",
            color: "#16a34a",
            icon: ChevronRight,
            component: <MedicineJourneyTracker />,
          },
          {
            id: "blockchain-timeline",
            title: "Transaction Timeline",
            sub: "Every blockchain event — verified, flagged, and immutable",
            color: "#06b6d4",
            icon: Hash,
            component: <BlockchainTimeline />,
          },
          {
            id: "transaction-cards",
            title: "Holographic Transaction Cards",
            sub: "Premium 3D-tilt blockchain records",
            color: "#1a56db",
            icon: ShieldCheck,
            component: <TransactionCards />,
          },
          {
            id: "suspicious-alerts",
            title: "Suspicious Scan Alerts",
            sub: "AI fraud detection · real-time threat classification",
            color: "#dc2626",
            icon: AlertTriangle,
            component: <SuspiciousAlerts />,
          },
          {
            id: "geo-map",
            title: "Global Medicine Route Map",
            sub: "Geo-location mismatch fraud detection",
            color: "#dc2626",
            icon: MapPin,
            component: <GeoMismatchMap />,
          },
          {
            id: "qr-auth",
            title: "QR Authenticity Flow",
            sub: "Immersive blockchain verification simulator",
            color: "#8b5cf6",
            icon: QrCode,
            component: <QRAuthFlow />,
          },
          {
            id: "scan-history",
            title: "Scan History Log",
            sub: "Chronological blockchain scan audit trail",
            color: "#06b6d4",
            icon: Activity,
            component: <ScanHistoryViz />,
          },
        ] as const).map((section) => {
          const Icon = section.icon;
          return (
            <motion.section
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.65, ease }}
            >
              {/* Section divider */}
              <div className="mb-8 flex items-center gap-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2"
                  style={{
                    borderColor: `${section.color}55`,
                    background: `${section.color}15`,
                    boxShadow: `0 0 20px 0 ${section.color}33`,
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: section.color }} />
                </div>
                <div className="flex-1">
                  <h2 className="text-[18px] font-bold tracking-tight">{section.title}</h2>
                  <p className="text-[12px] text-muted-foreground">{section.sub}</p>
                </div>
                {/* Divider line */}
                <div
                  className="hidden sm:block flex-1 h-px rounded-full"
                  style={{ background: `linear-gradient(90deg, ${section.color}44, transparent)` }}
                />
              </div>

              {/* Section panel */}
              <div
                className="rounded-3xl border border-border/60 bg-card shadow-sm p-6 sm:p-8"
                style={{
                  borderTopColor: `${section.color}66`,
                  borderTopWidth: '3px',
                }}
              >
                {section.component}
              </div>
            </motion.section>
          );
        })}

        {/* Footer badge */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col items-center gap-3 py-8 text-center"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border-2"
            style={{ borderColor: "#1a56db55", background: "#1a56db15", boxShadow: "0 0 40px #1a56db33" }}
          >
            <ShieldCheck className="h-7 w-7 text-[#1a56db]" />
          </div>
          <p className="text-[13px] font-bold text-foreground">MediVerify Blockchain Network</p>
          <p className="text-[11px] text-muted-foreground max-w-md">
            All pharmaceutical data is immutably recorded on a permissioned blockchain.
            Tamper-proof · AI-verified · DRAP compliant.
          </p>
          <div className="flex items-center gap-2 mt-1">
            {["#1a56db", "#06b6d4", "#16a34a", "#8b5cf6", "#dc2626"].map(c => (
              <motion.span
                key={c}
                className="h-1.5 w-8 rounded-full"
                style={{ background: c }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 2 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </DashShell>
  );
}
