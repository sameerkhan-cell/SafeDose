import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Shield, Network, Zap, TrendingUp, Lock } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { FloatingParticles, FadeUp } from "@/components/motion";
import { MedicineJourneyTracker } from "@/components/blockchain/MedicineJourneyTracker";
import { BlockchainTimeline } from "@/components/blockchain/BlockchainTimeline";
import { TransactionCards } from "@/components/blockchain/TransactionCard";
import { QRAuthFlow } from "@/components/blockchain/QRAuthFlow";
import { SuspiciousAlerts } from "@/components/blockchain/SuspiciousAlerts";
import { GeoMismatchMap } from "@/components/blockchain/GeoMismatchMap";
import { AnimatedCounter } from "@/components/site/AnimatedCounter";

export const Route = createFileRoute("/blockchain")({
  head: () => ({
    meta: [
      { title: "Blockchain Command Center — SafeDose" },
      { name: "description", content: "Cinematic, real-time blockchain visualization of every medicine — from manufacturer to patient. AI-powered fraud detection." },
    ],
  }),
  component: BlockchainPage,
});

const ease = [0.22, 1, 0.36, 1] as const;

const STATS = [
  { icon: Activity, label: "Live verifications", value: 2_847_193, suffix: "+", tone: "#1a56db" },
  { icon: Shield,   label: "Network integrity",  value: 99,        suffix: ".98%", tone: "#16a34a" },
  { icon: Network,  label: "Active nodes",       value: 1248,      suffix: "",    tone: "#06b6d4" },
  { icon: Lock,     label: "Tamper events",      value: 0,         suffix: "",    tone: "#f59e0b" },
];

function BlockchainPage() {
  return (
    <SiteLayout>
      {/* ─────────────── HERO ─────────────── */}
      <section className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <FloatingParticles />
        <div className="absolute -left-40 top-10 h-[420px] w-[420px] rounded-full bg-primary/8 blur-[120px] glow-pulse" />
        <div className="absolute -right-40 bottom-0 h-[360px] w-[360px] rounded-full bg-success/6 blur-[120px] glow-pulse" style={{ animationDelay: "1.5s" }} />

        <div className="relative mx-auto max-w-7xl px-5 pt-24 pb-14 sm:px-6 lg:px-8">
          <FadeUp className="text-center">
            <motion.span
              className="section-label"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease }}
            >
              <Zap className="mr-1.5 inline h-3 w-3" /> Blockchain Command Center
            </motion.span>
            <h1 className="mt-3 heading-lg">The pulse of every medicine, in real time.</h1>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-muted-foreground">
              A cinematic, AI-powered window into the SafeDose ledger — every batch, scan, hash and anomaly across the network.
            </p>
          </FadeUp>

          {/* Live stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease }}
            className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-xl"
                style={{ boxShadow: `0 0 40px ${s.tone}11` }}
              >
                <div
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
                  style={{ background: s.tone }}
                />
                <div className="relative flex items-start justify-between">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl border"
                    style={{ borderColor: `${s.tone}44`, background: `${s.tone}11` }}
                  >
                    <s.icon className="h-4 w-4" style={{ color: s.tone }} />
                  </div>
                  <motion.span
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.tone, boxShadow: `0 0 12px ${s.tone}` }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                  />
                </div>
                <p className="relative mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {s.label}
                </p>
                <p className="relative mt-1 text-2xl font-bold tabular-nums tracking-tight">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─────────────── QR AUTH FLOW ─────────────── */}
      <section className="relative mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
        <QRAuthFlow />
      </section>

      {/* ─────────────── MEDICINE JOURNEY ─────────────── */}
      <section className="relative mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
        <MedicineJourneyTracker />
      </section>

      {/* ─────────────── TRANSACTION CARDS ─────────────── */}
      <section className="relative mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="mb-8">
          <span className="section-label">
            <TrendingUp className="mr-1.5 inline h-3 w-3" /> On-chain Transactions
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Holographic transaction ledger
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground">
            Every verification is sealed in a tamper-proof block. Hover to inspect — green is genuine, orange is suspect, red is counterfeit.
          </p>
        </div>
        <TransactionCards />
      </section>

      {/* ─────────────── TIMELINE + ALERTS ─────────────── */}
      <section className="relative mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <BlockchainTimeline />
          </div>
          <div className="lg:col-span-2">
            <SuspiciousAlerts />
          </div>
        </div>
      </section>

      {/* ─────────────── GEO MISMATCH MAP ─────────────── */}
      <section className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-6 lg:px-8">
        <GeoMismatchMap />
      </section>
    </SiteLayout>
  );
}
