import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck, ScanLine, QrCode, Activity, Globe2, Lock, ArrowRight,
  CheckCircle2, AlertTriangle, Building2, Stethoscope, Sparkles, Zap, Cpu, Shield,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/site/AnimatedCounter";
import { FloatingParticles } from "@/components/motion";
import { TiltCard } from "@/components/motion/TiltCard";
import { useRef } from "react";
import { useHeroTimeline, useStaggerReveal, useStatCounters, useGlowOnScroll } from "@/lib/gsap";
import { ease } from "@/lib/motion";
import { useAuth } from "@/lib/auth-context";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")(
  {
    head: () => ({
      meta: [
        { title: "MediVerify — Scan Karo, Safe Raho" },
        { name: "description", content: "AI + blockchain powered fake medicine detection. Verify any medicine with QR, barcode, or batch number in seconds." },
        { property: "og:title", content: "MediVerify — Scan Karo, Safe Raho" },
        { property: "og:description", content: "AI + blockchain powered fake medicine detection. Verify any medicine in seconds." },
      ],
    }),
    component: Landing,
  });


const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};

function Landing() {
  const { user, isAuthenticated } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement | null>(null);
  const statsRef = useStatCounters();
  const featuresRef = useStaggerReveal("[data-stagger]", { y: 28, stagger: 0.1 });
  const stepsRef = useStaggerReveal("[data-stagger]", { y: 24, stagger: 0.12 });
  const ctaRef = useGlowOnScroll();
  useHeroTimeline(heroRef);

  // Redirect manufacturer or pharmacy users to their respective dashboards.
  // We place this check AFTER all hook invocations to ensure hooks are called 
  // unconditionally on every render, adhering strictly to the Rules of Hooks.
  if (isAuthenticated) {
    if (user?.role === "manufacturer") {
      return <Navigate to="/dashboard/manufacturer" />;
    }
    if (user?.role === "pharmacy") {
      return <Navigate to="/dashboard/pharmacy" />;
    }
  }

  return (
    <SiteLayout>
      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <FloatingParticles />
        {/* Glow orb accents — parallax driven by GSAP */}
        <div data-orb-1 className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-primary/8 blur-[120px] glow-pulse" />
        <div data-orb-2 className="absolute -right-32 top-40 h-[400px] w-[400px] rounded-full bg-[oklch(0.55_0.16_295_/_0.06)] blur-[100px] glow-pulse" style={{ animationDelay: "1.5s" }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[200px] w-[600px] rounded-full bg-primary/4 blur-[80px]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-28 pt-24 sm:px-6 lg:px-8 lg:pb-36 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge — GSAP target */}
            <span
              data-hero-badge
              style={{ opacity: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur-md"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI + Blockchain · Verified by DRAP & WHO standards
            </span>

            <h1 data-hero-h1 style={{ opacity: 0 }} className="mt-8 heading-xl text-balance hero-depth-text">
              Is your medicine{" "}
              <span className="text-gradient-vivid">real or fake?</span>
            </h1>

            <p data-hero-sub style={{ opacity: 0 }} className="mt-6 text-[17px] leading-relaxed text-muted-foreground sm:text-lg">
              Scan. Verify. Stay Safe. MediVerify uses AI and a tamper-proof
              blockchain ledger to detect counterfeit medicines in under a
              second.
            </p>

            {/* Trust badges */}
            <div data-hero-badges style={{ opacity: 0 }} className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {[{ icon: ShieldCheck, label: "WHO Certified" }, { icon: Cpu, label: "AI Powered" }, { icon: Zap, label: "<1s Verified" }].map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur-sm">
                  <b.icon className="h-3.5 w-3.5 text-primary" />
                  <span dangerouslySetInnerHTML={{ __html: b.label }} />
                </span>
              ))}
            </div>

            <div data-hero-cta style={{ opacity: 0 }} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-gradient-primary px-8 shadow-elegant text-[14px] font-medium transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02] btn-magnetic ripple-btn">
                <Link to="/dashboard/patient">
                  <ScanLine className="mr-2 h-4 w-4" /> Verify Medicine
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8 text-[14px] font-medium border-border/60 hover:border-primary/30 transition-all duration-300 btn-magnetic">
                <Link to="/dashboard/monitoring">See Live Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>

          {/* Hero mock device — GSAP parallax target */}
          <div data-hero-mock style={{ opacity: 0 }} className="relative mx-auto mt-20 max-w-5xl">
            <div className="animated-border shadow-elegant noise-overlay">
              <div className="rounded-[var(--radius-lg)] bg-card p-3 sm:p-5">
                <div className="rounded-xl bg-gradient-to-br from-secondary/60 to-background/80 p-6 sm:p-10 relative overflow-hidden">
                  <div className="absolute inset-0 holo pointer-events-none" />
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Left panel */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-success pulse-dot" />
                        Live verification · 0.6s
                      </div>
                      <TiltCard intensity={6} glow>
                        <div
                          className="card-premium p-5 glow-genuine relative overflow-hidden"
                        >
                          {/* Scan-line sweep */}
                          <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-success/70 to-transparent shadow-[0_0_8px_1px_var(--color-success)] animate-scan-sweep pointer-events-none" />
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Batch</p>
                              <p className="font-mono text-[13px] font-medium">PNX-49281-A</p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/8 px-2.5 py-1 text-[11px] font-semibold text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Genuine
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                            <div className="rounded-xl bg-secondary/50 p-3">
                              <p className="text-muted-foreground">Manufacturer</p>
                              <p className="mt-1 font-medium">GlaxoSmithKline</p>
                            </div>
                            <div className="rounded-xl bg-secondary/50 p-3">
                              <p className="text-muted-foreground">Expiry</p>
                              <p className="mt-1 font-medium">Mar 2027</p>
                            </div>
                          </div>
                        </div>
                      </TiltCard>
                      <div
                        className="card-premium p-5"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Blockchain trail</p>
                        <ul className="mt-3 space-y-2.5 text-[13px]">
                          {["Manufactured · Karachi", "In transit · DHL", "Delivered · Servaid Pharmacy"].map((s, i) => (
                            <li
                              key={s}
                              className="flex items-center gap-2.5"
                            >
                              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">{i + 1}</span>
                              <span className="text-foreground/80">{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Right panel – QR with scan beam */}
                    <div className="relative grid place-items-center rounded-2xl border border-border/60 bg-card p-8 shadow-soft overflow-hidden">
                      <div className="absolute inset-0 grid-bg opacity-30 rounded-2xl" />
                      <div
                        className="relative grid h-44 w-44 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow float-slow overflow-hidden"
                      >
                        <QrCode className="h-24 w-24" strokeWidth={1.5} />
                        {/* Scan beam on QR */}
                        <div
                          className="absolute inset-x-0 h-[2px] bg-white/70 shadow-[0_0_8px_2px_rgba(255,255,255,0.6)] animate-scan-sweep pointer-events-none"
                        />
                      </div>
                      <p className="relative mt-6 text-[13px] text-muted-foreground text-center">
                        Point your camera at any QR · Result in &lt; 1s
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS ────────────────────────────────────────────── */}
      <section className="relative border-y border-border/40 bg-card/30">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
        <div ref={statsRef} className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { v: 4823910, suffix: "", l: "Medicines verified" },
            { v: 12740, suffix: "", l: "Counterfeits flagged" },
            { v: 320, suffix: "+", l: "Manufacturers onboarded" },
            { v: 99, suffix: "%", l: "Verification accuracy" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-3xl font-bold tracking-tight sm:text-4xl tabular-nums">
                <span data-count={s.v} data-suffix={s.suffix}>0</span>
              </div>
              <p className="mt-1.5 text-[13px] text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-label">How it works</span>
          <h2 className="mt-3 heading-lg">Three steps to certainty</h2>
          <p className="mt-4 text-[15px] text-muted-foreground">From suspicion to verified authenticity — in under a second.</p>
        </div>
        <div ref={stepsRef} className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            { i: ScanLine, n: "01", t: "Scan", d: "Use your phone camera to scan the QR or barcode, or paste the batch number." },
            { i: ShieldCheck, n: "02", t: "Verify", d: "Our AI cross-checks the manufacturer ledger and detects duplicates, expired or anomalous scans." },
            { i: CheckCircle2, n: "03", t: "Stay Safe", d: "Get an instant verdict with the full medicine journey on the blockchain." },
          ].map((step) => (
            <TiltCard key={step.t} intensity={6} glow className="h-full">
              <div data-stagger className="card-premium group p-7 h-full relative overflow-hidden">
                <div className="absolute top-4 right-5 text-[11px] font-bold text-muted-foreground/30 tabular-nums">{step.n}</div>
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant transition-transform duration-300 group-hover:scale-110 ripple-btn">
                  <step.i className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-[17px] font-semibold">{step.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{step.d}</p>
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-primary transition-all duration-500 group-hover:w-full" />
              </div>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────── */}
      <section className="relative bg-secondary/30 py-28">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="section-label">Platform</span>
            <h2 className="mt-3 heading-lg">Built for every stakeholder</h2>
            <p className="mt-4 text-[15px] text-muted-foreground">From manufacturer to patient — one immutable source of truth.</p>
          </div>
          <div ref={featuresRef} className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { i: Building2, t: "Manufacturer Portal", d: "Upload batches, generate tamper-proof QR codes, and watch real-time analytics across regions.", to: "/dashboard/manufacturer" },
              { i: Stethoscope, t: "Pharmacy Portal", d: "Verify incoming stock in bulk, log fake reports, and protect your patients automatically.", to: "/dashboard/pharmacy" },
              { i: Activity, t: "Live Monitoring", d: "Global heatmap, real-time scans, and the most flagged medicines in your country.", to: "/dashboard/monitoring" },
              { i: Lock, t: "Blockchain Ledger", d: "Every scan and shipment is anchored to an immutable cryptographic ledger.", to: "/dashboard/patient" },
              { i: AlertTriangle, t: "Fake Reporting", d: "Patients can report counterfeits. Auto-routed to DRAP for action.", to: "/report" },
              { i: Globe2, t: "Urdu + Offline", d: "Bilingual UI, SMS-based verification and offline mode for low-connectivity areas.", to: "/about" },
            ].map((f) => (
              <TiltCard key={f.t} intensity={5} glow className="h-full">
                <Link to={f.to} className="card-premium group block h-full p-6 sm:p-7 relative overflow-hidden" data-stagger>
                  <div className="absolute inset-0 holo pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/8 text-primary transition-all duration-300 group-hover:bg-gradient-primary group-hover:text-primary-foreground group-hover:shadow-elegant group-hover:scale-110">
                    <f.i className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-[16px] font-semibold">{f.t}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{f.d}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                    Explore <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                  <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-primary transition-all duration-500 group-hover:w-full" />
                </Link>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="section-label">Testimonials</span>
          <h2 className="mt-3 heading-lg">Trusted across the industry</h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {[
            { q: "MediVerify caught two counterfeit batches in our first month. It's now mandatory for every shipment we accept.", n: "Dr. Ayesha Khan", r: "Chief Pharmacist, Servaid" },
            { q: "The blockchain trail gives our patients real peace of mind. The dashboards are world-class.", n: "Hassan Raza", r: "Operations, GSK Pakistan" },
            { q: "We integrated their API in two days. Easiest health-tech onboarding I've ever done.", n: "Maria Lopez", r: "CTO, FarmaTrust" },
          ].map((t, idx) => (
            <motion.figure
              key={t.n}
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              whileInView={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={shouldReduceMotion ? { duration: 0 } : { delay: idx * 0.08, duration: 0.5, ease }}
              className="card-premium p-7"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[1, 2, 3, 4, 5].map(s => (
                  <svg key={s} className="h-4 w-4 text-warning fill-warning" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-[14px] leading-relaxed text-foreground/85">"{t.q}"</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 pt-5 border-t border-border/40">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-[12px] font-bold text-primary-foreground shadow-elegant">
                  {t.n.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-[13px] font-semibold">{t.n}</p>
                  <p className="text-[12px] text-muted-foreground">{t.r}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>

        {/* Partners */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          whileInView={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, ease }}
          className="mt-20 card-premium p-8 sm:p-10"
        >
          <p className="text-center section-label">Trusted by leading health organizations</p>
          <div className="mt-8 grid grid-cols-2 gap-6 text-center text-[15px] font-semibold tracking-tight text-muted-foreground sm:grid-cols-3 lg:grid-cols-6">
            {["WHO", "DRAP", "GSK", "Pfizer", "Servaid", "FarmaTrust"].map((p) => (
              <span key={p} className="opacity-50 transition-all duration-300 hover:opacity-100 hover:text-foreground cursor-default">{p}</span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 pb-28 sm:px-6 lg:px-8">
          <div ref={ctaRef} className="relative overflow-hidden rounded-3xl bg-gradient-primary px-8 py-20 text-center text-primary-foreground shadow-elegant sm:px-16 noise-overlay">
            <div className="absolute inset-0 grid-bg opacity-15" />

            {/* Glow orbs */}
            <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-[80px]" />
            <div className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-white/5 blur-[80px]" />

            <h2 className="relative heading-lg">Stop counterfeit medicines today.</h2>
            <p className="relative mx-auto mt-5 max-w-xl text-[15px] leading-relaxed opacity-85">
              Join 320+ manufacturers and 4,000+ pharmacies protecting patients across South Asia.
            </p>
            <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="rounded-full px-8 text-[14px] font-medium transition-all duration-300 hover:scale-[1.02]">
                <Link to="/dashboard/patient">Verify a Medicine</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/25 bg-transparent px-8 text-[14px] font-medium text-primary-foreground hover:bg-white/10 transition-all duration-300">
                <Link to="/about">Talk to our team</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
