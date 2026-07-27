import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Globe2, Heart, Users, Award, Sparkles } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FloatingParticles, StaggerReveal, RevealItem, FadeUp } from "@/components/motion";
import { TiltCard } from "@/components/motion/TiltCard";
import { ease } from "@/lib/motion";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About & Mission — SafeDose" }, { name: "description", content: "Our mission to eliminate counterfeit medicines worldwide." }] }),
  component: Page,
});

const TEAM = [
  { n: "Dr. Sara Ahmad", r: "Co-founder & CEO", i: "SA" },
  { n: "Bilal Niazi", r: "Co-founder & CTO", i: "BN" },
  { n: "Maryam Tariq", r: "Head of Pharma Partnerships", i: "MT" },
  { n: "Daniyal Khan", r: "Lead Blockchain Engineer", i: "DK" },
];


function Page() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative bg-hero overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <FloatingParticles />
        <div className="absolute -left-40 top-10 h-[450px] w-[450px] rounded-full bg-primary/6 blur-[120px] glow-pulse" />
        <div className="absolute -right-32 bottom-0 h-[350px] w-[350px] rounded-full bg-[oklch(0.55_0.16_295_/_0.05)] blur-[100px] glow-pulse" style={{ animationDelay: "1.5s" }} />

        <div className="relative mx-auto max-w-4xl px-5 py-24 text-center sm:px-6 lg:px-8 lg:py-28">
          <FadeUp>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="section-label"
            >
              Our mission
            </motion.span>
            <h1 className="mt-4 heading-xl text-balance">
              A world where every medicine is{" "}
              <span className="text-gradient-vivid">safe</span>.
            </h1>
            <p className="mt-6 text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
              According to the WHO, 1 in 10 medicines in low- and middle-income countries is
              substandard or falsified. We’re building the infrastructure to change that — patient
              by patient, batch by batch.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-6 lg:px-8">
        <StaggerReveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: Globe2, k: "1 in 10", v: "medicines in LMICs are fake (WHO)" },
            { i: Heart,  k: "1M+",     v: "deaths annually linked to counterfeits" },
            { i: Users,  k: "320+",    v: "manufacturer partners" },
            { i: Award,  k: "DRAP",    v: "certified verification network" },
          ].map((s) => (
            <RevealItem key={s.k} direction="scale">
              <TiltCard intensity={6} glow className="h-full">
                <div className="card-premium group p-7 text-center h-full relative overflow-hidden">
                  <div className="absolute inset-0 holo pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/8 text-primary transition-all duration-300 group-hover:bg-gradient-primary group-hover:text-primary-foreground group-hover:shadow-elegant group-hover:scale-110">
                    <s.i className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-3xl font-bold tracking-tight">{s.k}</p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">{s.v}</p>
                  <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-primary transition-all duration-500 group-hover:w-full" />
                </div>
              </TiltCard>
            </RevealItem>
          ))}
        </StaggerReveal>
      </section>

      {/* Team */}
      <section className="relative bg-secondary/25 py-24">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="section-label">Team</span>
            <h2 className="mt-3 heading-lg">The people behind SafeDose</h2>
          </div>
          <StaggerReveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((t) => (
              <RevealItem key={t.n} direction="up">
                <TiltCard intensity={7} glow className="h-full">
                  <div className="card-premium group p-7 text-center h-full relative overflow-hidden">
                    <div className="absolute inset-0 holo pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <motion.div
                      className="mx-auto grid h-18 w-18 place-items-center rounded-full bg-gradient-primary text-[18px] font-bold text-primary-foreground shadow-elegant"
                      style={{ height: "4.5rem", width: "4.5rem" }}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      {t.i}
                    </motion.div>
                    <p className="mt-4 text-[14px] font-semibold">{t.n}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{t.r}</p>
                  </div>
                </TiltCard>
              </RevealItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-3xl px-5 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="section-label">Contact</span>
          <h2 className="mt-3 heading-lg">Get in touch</h2>
        </div>
        <motion.form
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          onSubmit={(e) => e.preventDefault()}
          className="mt-10 card-premium space-y-5 p-7"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label className="text-[13px] font-medium">Name</Label>
              <Input className="mt-2 rounded-xl" required maxLength={100} />
            </div>
            <div>
              <Label className="text-[13px] font-medium">Email</Label>
              <Input className="mt-2 rounded-xl" type="email" required maxLength={255} />
            </div>
          </div>
          <div>
            <Label className="text-[13px] font-medium">Message</Label>
            <Textarea className="mt-2 min-h-28 rounded-xl" required maxLength={1000} />
          </div>
          <Button type="submit" className="w-full rounded-full bg-gradient-primary shadow-elegant text-[14px] font-medium transition-all duration-300 hover:shadow-card-hover hover:scale-[1.01] ripple-btn btn-magnetic">
            Send message
          </Button>
        </motion.form>
      </section>
    </SiteLayout>
  );
}
