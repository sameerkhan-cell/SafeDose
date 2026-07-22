import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShieldCheck, Activity, CheckCircle2, Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { FloatingParticles } from "@/components/motion";
import { ease } from "@/lib/motion";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  panelHeading?: string;
  panelTagline?: string;
}


const FEATURES = [
  { icon: ShieldCheck, text: "AI-powered counterfeit detection" },
  { icon: Activity, text: "Real-time blockchain verification" },
  { icon: CheckCircle2, text: "DRAP & WHO certified standards" },
  { icon: Lock, text: "End-to-end encrypted data" },
];

export function AuthLayout({
  children,
  title,
  subtitle,
  panelHeading = "Protect Every Patient",
  panelTagline = "Join 4,000+ pharmacies and 320+ manufacturers on the most trusted medicine verification platform in South Asia.",
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-hero">
      {/* ── Left branding panel (desktop only) ── */}
      <motion.aside
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease }}
        className="hidden lg:flex lg:w-[520px] xl:w-[580px] flex-col relative overflow-hidden"
      >
        {/* Deep gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.28_0.08_265)] via-[oklch(0.22_0.06_265)] to-[oklch(0.16_0.04_265)]" />

        {/* Ambient particles */}
        <FloatingParticles />

        {/* Glow orbs */}
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px] glow-pulse" />
        <div className="absolute -bottom-32 -right-20 h-[400px] w-[400px] rounded-full bg-[oklch(0.55_0.16_295_/_0.15)] blur-[100px] glow-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-primary/8 blur-[80px] glow-pulse" style={{ animationDelay: "1s" }} />

        {/* Grid bg */}
        <div className="absolute inset-0 grid-bg opacity-20" />

        {/* Orbiting blockchain nodes */}
        <div className="absolute bottom-24 right-8 h-32 w-32 flex items-center justify-center opacity-30">
          <motion.div
            className="absolute h-4 w-4 rounded-full bg-primary shadow-[0_0_12px_4px_oklch(0.50_0.20_265_/_0.6)]"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50px 0" }}
          />
          <motion.div
            className="absolute h-3 w-3 rounded-full bg-success shadow-[0_0_8px_2px_oklch(0.60_0.18_150_/_0.6)]"
            animate={{ rotate: [120, 480] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "36px 0" }}
          />
          <div className="h-3 w-3 rounded-full bg-white/20 border border-white/30" />
        </div>

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group w-fit">
            <img src="/logo.png" alt="MediVerify" className="h-10 w-10 object-contain transition-transform duration-300 group-hover:scale-105" />
            <span className="text-[17px] font-semibold tracking-tight text-white">MediVerify</span>
            <span className="hidden xl:inline-flex items-center gap-1 rounded-full border border-[oklch(0.68_0.18_150_/_0.3)] bg-[oklch(0.60_0.18_150_/_0.12)] px-2.5 py-0.5 text-[10px] font-medium text-[oklch(0.78_0.16_150)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.68_0.18_150)] pulse-dot" />
              DRAP · WHO
            </span>
          </Link>

          {/* Centre content */}
          <div className="flex-1 flex flex-col justify-center mt-20">
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8, ease }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/60 mb-6">
                <Sparkles className="h-3 w-3 text-primary" />
                AI + Blockchain · Trusted Medicine Platform
              </span>

              <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight tracking-tight">
                {panelHeading}
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-white/55 max-w-sm">
                {panelTagline}
              </p>

              {/* Feature list */}
              <ul className="mt-10 space-y-4">
                {FEATURES.map((f, i) => (
                  <motion.li
                    key={f.text}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.08, duration: 0.5, ease }}
                    className="flex items-center gap-3.5"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/8 text-white/70">
                      <f.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[13px] text-white/70">{f.text}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Stat pills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6, ease }}
            className="flex flex-wrap gap-3 mt-8"
          >
            {[
              { v: "4.8M+", l: "Medicines verified" },
              { v: "99%", l: "Accuracy" },
              { v: "320+", l: "Manufacturers" },
            ].map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + i * 0.1, duration: 0.5, ease }}
                whileHover={{ scale: 1.05, backgroundColor: "oklch(1 0 0 / 0.08)" }}
                className="rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 backdrop-blur-md cursor-default transition-colors duration-200"
              >
                <p className="text-[15px] font-bold text-white">{s.v}</p>
                <p className="text-[11px] text-white/45">{s.l}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.aside>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 sm:px-8">
        {/* Mobile logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="lg:hidden mb-8"
        >
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="MediVerify" className="h-9 w-9 object-contain" />
            <span className="text-[15px] font-semibold">MediVerify</span>
          </Link>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease }}
          className="w-full max-w-[460px]"
        >
          <div className="animated-border shadow-elegant">
            <div className="rounded-[var(--radius-lg)] bg-card p-7 sm:p-9 relative overflow-hidden">
              {/* Holographic sheen */}
              <div className="pointer-events-none absolute inset-0 holo opacity-40" />
              {/* Top accent bar */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-primary" />
              {/* Heading */}
              <div className="mb-8">
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.5, ease }}
                  className="text-2xl font-bold tracking-tight"
                >
                  {title}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22, duration: 0.5, ease }}
                  className="mt-2 text-[13px] text-muted-foreground leading-relaxed"
                >
                  {subtitle}
                </motion.p>
              </div>

              {children}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
