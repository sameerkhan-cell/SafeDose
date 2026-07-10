import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, MapPin, ShieldAlert, CheckCircle2, AlertTriangle, Clock, Shield, Loader2, Sparkles } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { DashShell } from "@/components/dashboard/DashShell";
import { DASH_NAV } from "@/config/nav";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FloatingParticles, FadeUp } from "@/components/motion";
import { TiltCard } from "@/components/motion/TiltCard";
import { ease } from "@/lib/motion";

export const Route = createFileRoute("/report")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      medicineName: (search.medicineName as string) || undefined,
      batchNumber: (search.batchNumber as string) || undefined,
      source: (search.source as string) || undefined,
    };
  },
  head: () => ({ meta: [{ title: "Report Fake Medicine — MediVerify" }, { name: "description", content: "Submit a fake medicine report. Auto-routed to DRAP for action." }] }),
  component: Page,
});

const STAGES = ["Submitted", "DRAP review", "Lab analysis", "Resolved"];

function Page() {
  const { medicineName, batchNumber, source } = Route.useSearch();
  const { isAuthenticated, isLoading } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const medicineName = (data.get("medicineName") as string) || "";
    const batchNumber = (data.get("batchNumber") as string) || "";
    const pharmacyName = (data.get("pharmacyName") as string) || "";
    const description = (data.get("description") as string) || "";

    try {
      // Get token if logged in
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem("mediverify_session") ??
            sessionStorage.getItem("mediverify_session")
          : null;
      const token = raw ? JSON.parse(raw)?.token : null;

      const res = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ medicineName, batchNumber, pharmacyName, description }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setSubmitError(result.message || "Submission failed. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const content = (
    <>
      {/* Header */}
      <section className="relative bg-hero overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <FloatingParticles />
        <div className="absolute -right-32 top-0 h-[350px] w-[350px] rounded-full bg-destructive/5 blur-[100px] glow-pulse" />
        <div className="absolute -left-20 bottom-0 h-[250px] w-[250px] rounded-full bg-warning/4 blur-[80px] glow-pulse" style={{ animationDelay: "1.5s" }} />

        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:px-6 lg:px-8">
          <FadeUp>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full bg-destructive/8 border border-destructive/15 px-4 py-1.5 text-[12px] font-semibold text-destructive"
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Counterfeit reporting
            </motion.span>
            <h1 className="mt-5 heading-lg">Report a fake medicine</h1>
            <p className="mt-3 text-[15px] text-muted-foreground">
              Your report goes directly to DRAP and the manufacturer. Anonymous and free.
            </p>
            {/* Trust row */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {[
                { icon: Shield, label: "100% anonymous" },
                { icon: Clock, label: "48hr DRAP review" },
                { icon: AlertTriangle, label: "Auto-routed to manufacturer" },
              ].map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur-sm">
                  <b.icon className="h-3.5 w-3.5 text-primary" />{b.label}
                </span>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Form */}
      <section className="mx-auto max-w-4xl px-5 pb-28 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px] -mt-4">
          <motion.form
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease }}
            onSubmit={handleSubmit}
            className="card-premium space-y-6 p-7 relative overflow-hidden"
          >
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-destructive via-warning to-primary" />
            <div className="absolute inset-0 holo pointer-events-none opacity-20" />
            
            {source === "scan" && (
              <div className="flex items-center gap-2 rounded-xl bg-primary/8 border border-primary/20 px-3.5 py-2 text-[12px] font-semibold text-primary">
                <Sparkles className="h-4 w-4 text-primary animate-pulse shrink-0" />
                <span>Auto-filled from your recent scan</span>
              </div>
            )}
            
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className="text-[13px] font-medium">Medicine name</Label>
                <Input name="medicineName" defaultValue={medicineName} className="mt-2 rounded-xl" placeholder="e.g. Augmentin 625" required maxLength={120} />
              </div>
              <div>
                <Label className="text-[13px] font-medium">Batch number</Label>
                <Input name="batchNumber" defaultValue={batchNumber} className="mt-2 rounded-xl" placeholder="e.g. AUG-77821-C" required maxLength={60} />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className="text-[13px] font-medium">Pharmacy / source</Label>
                <Input name="pharmacyName" className="mt-2 rounded-xl" placeholder="Where did you buy it?" maxLength={200} />
              </div>
              <div>
                <Label className="text-[13px] font-medium flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />City</Label>
                <Input className="mt-2 rounded-xl" placeholder="Karachi" required maxLength={80} />
              </div>
            </div>
            <div>
              <Label className="text-[13px] font-medium">Description</Label>
              <Textarea name="description" className="mt-2 min-h-32 rounded-xl" placeholder="Describe the suspicion: packaging, color, side-effects…" maxLength={1000} />
            </div>
            <div>
              <Label className="text-[13px] font-medium">Upload photos</Label>
              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border/60 bg-secondary/20 p-10 text-center text-[13px] text-muted-foreground transition-all duration-300 hover:border-primary/30 hover:bg-accent/20">
                <Upload className="h-6 w-6" />
                Click to upload medicine photos (max 5)
                <input type="file" accept="image/*" multiple className="hidden" />
              </label>
            </div>
            {submitError && (
              <p className="text-[13px] text-destructive flex items-center gap-1.5">
                <span>⚠</span> {submitError}
              </p>
            )}
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full rounded-full bg-gradient-primary shadow-elegant text-[14px] font-medium transition-all duration-300 hover:shadow-card-hover hover:scale-[1.01] ripple-btn btn-magnetic">
              {isSubmitting ? "Submitting…" : "Submit report to DRAP"}
            </Button>

            <AnimatePresence>
              {submitted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
                  className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/8 p-4 text-[13px] font-medium text-success glow-genuine"
                >
                  <div className="relative flex items-center justify-center h-8 w-8 shrink-0">
                    <motion.div className="absolute inset-0 rounded-full bg-success/20" animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2, repeat: Infinity }} />
                    <CheckCircle2 className="h-5 w-5 relative" />
                  </div>
                  <span>Report received · Tracking ID <strong>#MV-{Math.floor(Math.random() * 90000 + 10000)}</strong> · DRAP notified</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>

          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease }}
            className="card-premium p-6 h-fit"
          >
            <h3 className="text-[14px] font-semibold">Status tracker</h3>
            <ol className="mt-5 space-y-5">
              {STAGES.map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors duration-300 ${i === 0 && submitted ? "bg-gradient-primary text-primary-foreground shadow-elegant" : "bg-secondary/70 text-muted-foreground"}`}>{i + 1}</span>
                  <div>
                    <p className="text-[13px] font-medium">{s}</p>
                    <p className="text-[11px] text-muted-foreground">{i === 0 ? "Auto-acknowledged" : "Pending"}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-xl border border-border/40 bg-secondary/25 p-4 text-[12px] text-muted-foreground leading-relaxed">
              All reports are anonymous and reviewed within 48 hours by DRAP-certified pharmacists.
            </div>
          </motion.aside>
        </div>
      </section>
    </>
  );

  if (isAuthenticated) {
    return (
      <DashShell title="Submit Report" subtitle="Official counterfeit medicine reporting system" badge="Security" nav={DASH_NAV}>
        {content}
      </DashShell>
    );
  }

  return (
    <SiteLayout>
      {content}
    </SiteLayout>
  );
}
