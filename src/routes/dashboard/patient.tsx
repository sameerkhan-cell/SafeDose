import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanLine, QrCode, Barcode, CheckCircle2, AlertTriangle, XCircle, Loader2,
  ShieldAlert, MapPin, Calendar, Building2, Share2, Hash, Cpu, Shield, Zap,
  Pill, Bell, Clock, Filter, FileText, Activity, Plus, Star, ArrowRight,
  MessageSquare, Map, ShieldCheck, Layers, WifiOff, ChevronDown, Factory,
  ShoppingBag, Package, Archive, Circle, Phone, CheckCircle
} from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/library";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FloatingParticles, FadeUp } from "@/components/motion";
import { ease } from "@/lib/motion";
import { StatCard } from "@/components/dashboard/StatCard";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { ReportFakeMedicineModal } from "@/components/regulatory/ReportFakeMedicineModal";
import { SMSSimulatorWidget } from "@/components/accessibility/SMSSimulatorWidget";
import { MedicineAIChat } from "@/components/patient/MedicineAIChat";

export const Route = createFileRoute("/dashboard/patient")({
  head: () => ({
    meta: [
      { title: "Patient Portal — SafeDose" },
      { name: "description", content: "Verify any medicine instantly using batch number, QR code or barcode. Backed by blockchain." },
    ],
  }),
  component: VerifyPage,
});

type IVerificationResult = {
  isValid: boolean;
  type: "box" | "pill" | "unknown";
  status: "genuine" | "duplicate" | "suspected" | "invalid";
  batchDetails?: {
    name: string;
    batchNumber: string;
    manufacturer: string;
    expiry: string;
    txHash: string;
  };
  pillDetails?: {
    pillNumber: string;
    qrStatus: "active" | "suspected" | "invalidated";
  };
  fraudDetails?: {
    firstScanAt: string;
    firstScanLocation: string;
    scanCount: number;
  };
  supplyChain?: { boxNumber: string; pharmacyName: string | null; verifiedBy: string };
  pillInfo?: { pillNumber: string; boxNumber: string | null; sequencePosition: string };
  cartonInfo?: { cartonNumber: string; boxesCount: number; boxNumbers: string[] };
  manufacturer?: { licenseNumber?: string; address?: string; businessPhone?: string; businessEmail?: string; companyName?: string };
  message: string;
  medicine?: any;
};

import { useVerificationStore } from "@/store/verification-store";

function VerifyPage() {
  const { user, isAuthenticated, signOut, isLoading } = useAuth();
  const { addToHistory } = useVerificationStore();

  const [batch, setBatch] = useState("");
  const [result, setResult] = useState<IVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeScanner, setActiveScanner] = useState<"qr" | "barcode" | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role && user.role !== "customer") {
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

  // Redirect if not logged in
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  // Redirect if wrong role (must be patient)
  if (user?.role && user.role !== "customer") {
    return <Navigate to="/auth/login" />;
  }

  // Attempt GPS capture with a 5-second timeout; resolves null on any failure.
  const getCoords = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      const timer = setTimeout(() => resolve(null), 5000);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        ()    => { clearTimeout(timer); resolve(null); },
        { timeout: 5000, maximumAge: 60000 }
      );
    });

  const verify = async (val?: string) => {
    const code = (val ?? batch).trim().toUpperCase();
    if (!code) return;

    setLoading(true);
    setResult(null);
    setLoadingStep(0);

    // Cinematic multi-step loading sequence
    const steps = [0, 1, 2];
    for (let i = 0; i < steps.length; i++) {
      setLoadingStep(steps[i]);
      await new Promise(r => setTimeout(r, 350));
    }

    // Capture GPS in parallel — never blocks the scan if denied or slow.
    const coords = await getCoords();

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          location: "Patient Portal",
          deviceInfo: navigator.userAgent || "Web",
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {})
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const failResult: IVerificationResult = {
          isValid: false,
          type: "unknown",
          status: "invalid",
          message: data.message || "Verification failed. Please try again.",
        };
        setResult(failResult);
        addToHistory(code, failResult);
        return;
      }

      const d = data.data;
      const resultType = (d.resultType ?? "INVALID").toUpperCase();

      const mapped: IVerificationResult = {
        isValid: resultType === "GENUINE",
        type: d.batch ? "box" : d.pill ? "pill" : "unknown",
        status:
          resultType === "GENUINE" ? "genuine"
            : resultType === "DUPLICATE" ? "duplicate"
              : resultType === "SUSPICIOUS" || resultType === "EXPIRED" ? "suspected"
                : "invalid",
        batchDetails:
          d.batch && d.medicine && d.manufacturer
            ? {
              name: d.medicine.name,
              batchNumber: d.batch.batchNumber,
              manufacturer: d.manufacturer.companyName,
              expiry: d.batch.expiryDate
                ? new Date(d.batch.expiryDate).toLocaleDateString("en-PK", {
                  year: "numeric",
                  month: "short",
                })
                : "N/A",
              txHash: d.blockchain?.txHash || null,
            }
            : undefined,
        pillDetails:
          d.pill
            ? {
              pillNumber: d.pill.pillNumber || "N/A",
              qrStatus: d.pill.status === "ACTIVE" ? "active" : "suspected",
            }
            : undefined,
        supplyChain: d.supplyChain,
        pillInfo: d.pillInfo,
        cartonInfo: d.cartonInfo,
        manufacturer: d.manufacturer,
        message: d.message || "Verification complete.",
        medicine: d.medicine,
      };

      setResult(mapped);
      addToHistory(code, mapped);
    } catch (e) {
      const errResult: IVerificationResult = {
        isValid: false,
        type: "unknown",
        status: "invalid",
        message: "Network error. Please check your connection and try again.",
      };
      setResult(errResult);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <div className="bg-hero min-h-screen pb-24 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 grid-bg opacity-30" />
        <FloatingParticles />
        <div className="absolute -left-40 top-10 h-[400px] w-[400px] rounded-full bg-primary/6 blur-[120px] glow-pulse pointer-events-none" />
        <div className="absolute right-0 top-[20%] h-[500px] w-[500px] rounded-full bg-success/4 blur-[120px] glow-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24">

          {/* 1. Dashboard Overview / Welcome Banner */}
          <WelcomeBanner />

          {/* Quick Stat Cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={ScanLine} label="Medicines Verified" value={14} delta={12} sparkline={[2, 4, 3, 5, 4, 7, 6, 8]} />
            <StatCard icon={ShieldAlert} label="Fake Detected" value={1} delta={0} tone="warning" sparkline={[0, 0, 0, 1, 0, 0, 0, 0]} />
            <StatCard icon={MapPin} label="Safe Pharmacies Near You" value={12} delta={5} tone="success" sparkline={[5, 6, 8, 7, 9, 11, 10, 12]} />
            <StatCard icon={FileText} label="Reports Submitted" value={2} delta={-2} tone="primary" sparkline={[0, 1, 0, 0, 1, 0, 2, 0]} />
          </div>

          {/* Main Content Grid */}
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Left Column (Span 2) - Core Verification & History */}
            <div className="xl:col-span-2 space-y-6">

              {/* 2. Verify Medicine (The Hero Scanner) */}
              <FadeUp>
                <div className="gradient-border shadow-elegant">
                  <div className="rounded-[var(--radius-lg)] bg-card p-3 sm:p-5 relative overflow-hidden">
                    <div className="absolute top-4 right-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary pulse-dot" /> Live Verification System
                    </div>
                    <div className="mb-6 px-2">
                      <h2 className="text-[18px] font-bold">Verify a Medicine</h2>
                      <p className="text-[13px] text-muted-foreground mt-1">Check authenticity instantly using AI and Blockchain.</p>
                    </div>

                    <Tabs defaultValue="batch">
                      <TabsList className="w-full justify-start gap-1 rounded-xl bg-secondary/70 p-1.5 mb-5 overflow-x-auto">
                        <TabsTrigger value="batch" className="rounded-lg gap-2 text-[13px] font-medium"><Hash className="h-4 w-4" />Batch / Serial</TabsTrigger>
                        <TabsTrigger value="qr" className="rounded-lg gap-2 text-[13px] font-medium"><QrCode className="h-4 w-4" />QR Code</TabsTrigger>
                        <TabsTrigger value="barcode" className="rounded-lg gap-2 text-[13px] font-medium"><Barcode className="h-4 w-4" />Barcode</TabsTrigger>
                      </TabsList>

                      <TabsContent value="batch" className="px-2 pb-2">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Input
                            value={batch}
                            onChange={(e) => setBatch(e.target.value)}
                            placeholder="e.g. PNX-49281-A"
                            className="h-12 rounded-xl text-[15px] bg-secondary/30"
                            onKeyDown={(e) => e.key === "Enter" && verify()}
                          />
                          <Button onClick={() => verify()} className="h-12 rounded-xl bg-gradient-primary px-8 shadow-elegant text-[14px] font-medium transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02]">
                            <ScanLine className="mr-2 h-4 w-4" /> Verify Now
                          </Button>
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground/50 text-center">
                          Location access is optional and used for supply-chain tracking only.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
                          <span className="text-muted-foreground font-medium">Quick Test:</span>
                          {[
                            { id: "BOX-LHR-2025-A1", label: "Genuine Box" },
                            { id: "PILL-LHR-2025-A1-007", label: "Duplicate Pill" },
                            { id: "PILL-LHR-2025-A1-SUS", label: "Suspicious Pill" },
                            { id: "FAKE-BATCH-99", label: "Fake Code" }
                          ].map((t) => (
                            <button
                              key={t.id}
                              onClick={() => { setBatch(t.id); verify(t.id); }}
                              className="rounded-full border border-border/60 bg-secondary/50 px-3 py-1.5 font-mono text-[11px] transition-all duration-200 hover:bg-accent hover:border-primary/20 hover:text-foreground"
                            >{t.label}</button>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="qr" className="px-2 pb-2">
                        <Button onClick={() => setActiveScanner("qr")} className="w-full h-12 rounded-xl bg-gradient-primary">
                          <QrCode className="mr-2 h-4 w-4" /> Open Camera Scanner
                        </Button>
                      </TabsContent>
                      <TabsContent value="barcode" className="px-2 pb-2">
                        <Button onClick={() => setActiveScanner("barcode")} className="w-full h-12 rounded-xl bg-gradient-primary">
                          <Barcode className="mr-2 h-4 w-4" /> Open Camera Scanner
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </FadeUp>

              {/* Result & Loading States */}
              <AnimatePresence mode="wait">
                {loading && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0.96, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -12 }}
                    transition={{ duration: 0.4, ease }}
                    className="card-premium mt-6 p-10 text-center"
                  >
                    <div className="relative mx-auto h-20 w-20">
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-primary/30"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-primary/20"
                        animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 1.5, delay: 0.3, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                          className="h-14 w-14 rounded-full bg-gradient-primary shadow-elegant flex items-center justify-center"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <Shield className="h-6 w-6 text-primary-foreground" />
                        </motion.div>
                      </div>
                    </div>
                    <div className="mt-6 space-y-2">
                      {[
                        "Querying blockchain ledger…",
                        "Running AI counterfeit analysis…",
                        "Verifying supply chain integrity…",
                      ].map((step, i) => (
                        <motion.p
                          key={step}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: loadingStep >= i ? 1 : 0.25, x: 0 }}
                          transition={{ duration: 0.3, ease }}
                          className={`text-[13px] font-medium ${loadingStep >= i ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {loadingStep > i ? "✓ " : loadingStep === i ? "⟳ " : "○ "}{step}
                        </motion.p>
                      ))}
                    </div>
                  </motion.div>
                )}
                {result && !loading && (
                  <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <ResultCard status={result} batch={batch || "PNX-49281-A"} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 3. Advanced Scan History */}
              <FadeUp delay={0.1}>
                <ScanHistoryWidget />
              </FadeUp>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 8. Medicine Vault */}
                <FadeUp delay={0.2}>
                  <DigitalVaultWidget />
                </FadeUp>

                {/* 9. Health Analytics */}
                <FadeUp delay={0.25}>
                  <HealthAnalyticsWidget />
                </FadeUp>
              </div>

            </div>

            {/* Right Column (Span 1) - Safety & AI Tools */}
            <div className="space-y-6">

              {/* 6. AI Healthcare Assistant */}
              <FadeUp delay={0.3}>
                <AIAssistantWidget />
              </FadeUp>

              {/* 10. Medicine Reminders */}
              <FadeUp delay={0.35}>
                <MedicineRemindersWidget />
              </FadeUp>

              {/* 12. Safety Map */}
              <FadeUp delay={0.4}>
                <SafetyMapWidget />
              </FadeUp>

              {/* 5. Safe Pharmacies Finder */}
              <FadeUp delay={0.45}>
                <SafePharmaciesWidget />
              </FadeUp>

              {/* 7. Notifications Center */}
              <FadeUp delay={0.5}>
                <NotificationsWidget />
              </FadeUp>

              {/* 4. Fake Medicine Reporting */}
              <FadeUp delay={0.55}>
                <ReportFakeWidget onOpen={() => setShowReportModal(true)} />
              </FadeUp>

              {/* Offline & Accessibility */}
              <FadeUp delay={0.6}>
                <SMSSimulatorWidget />
                <Link to="/verify-lite" className="block p-4 rounded-2xl border border-primary/20 bg-primary/5 text-center transition-all hover:bg-primary/10">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <WifiOff className="h-4 w-4" />
                    <span className="text-[12px] font-black uppercase tracking-widest">Switch to Lite Mode</span>
                  </div>
                </Link>
              </FadeUp>

            </div>
          </div>
        </div>
      </div>

      <ReportFakeMedicineModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        prefillBatch={result?.status !== 'genuine' ? result?.batchDetails?.batchNumber : undefined}
      />
      {activeScanner && (
        <LiveScanner
          mode={activeScanner}
          onResult={(code) => { setActiveScanner(null); setBatch(code); verify(code); }}
          onClose={() => setActiveScanner(null)}
        />
      )}
    </SiteLayout>
  );
}

function LiveScanner({ mode, onResult, onClose }: { mode: "qr" | "barcode"; onResult: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    reader.decodeFromVideoDevice(null, videoRef.current, (result: any) => {
      if (result) {
        const text = result.getText();
        reader.reset();
        onResult(text);
      }
    }).catch((err: any) => {
      console.error(err);
      setError("Camera access denied. Please allow camera permissions.");
    });
    return () => reader.reset();
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-sm mx-4 aspect-square overflow-hidden bg-black rounded-3xl border-2 border-primary/30">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 m-12 border-2 border-primary/50 rounded-2xl pointer-events-none">
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/50 shadow-[0_0_10px_2px_rgba(var(--primary-rgb),0.5)] animate-scan-y" />
        </div>
      </div>
      <p className="text-white text-center font-bold text-sm mt-8 px-6">
        {mode === "qr" ? "Point camera at the QR code on the box, or pill strip" : "Point camera at the barcode on the package"}
      </p>
      {error && <p className="text-destructive font-bold text-sm mt-4">{error}</p>}
      <Button onClick={onClose} className="mt-8 rounded-xl px-12" variant="secondary">Cancel</Button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PORTAL WIDGETS
// ──────────────────────────────────────────────────────────────────────────

function WelcomeBanner() {
  const { user } = useAuth();
  return (
    <FadeUp>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Welcome, {user?.fullName || "Patient"}</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Your medicine safety score is <span className="text-success font-semibold">98/100</span>. Excellent.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="card-premium px-5 py-2.5 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-success" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-muted-foreground">Safety Status</p>
              <p className="text-[14px] font-bold text-success">Fully Protected</p>
            </div>
          </div>
        </div>
      </div>
    </FadeUp>
  );
}

function ScanHistoryWidget() {
  const { history } = useVerificationStore();

  return (
    <div className="card-premium overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-5">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Verification History</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Your recent medicine scans</p>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full text-[12px] gap-1.5"><Filter className="h-3.5 w-3.5" /> Filter</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-secondary/40 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="px-6 py-4 text-left">Medicine</th>
              <th className="px-6 py-4 text-left">Batch ID</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {[
              { med: "Panadol Extra", batch: "PNX-49281-A", status: "Genuine", date: "Today, 10:42 AM", tone: "success" },
              { med: "Augmentin 625", batch: "AUG-77821-C", status: "Genuine", date: "Yesterday, 3:15 PM", tone: "success" },
              { med: "Unknown Pill", batch: "FAKE-001", status: "Counterfeit", date: "Jan 12, 2025", tone: "destructive" },
              { med: "Brufen 400mg", batch: "BRF-33310-E", status: "Genuine", date: "Jan 10, 2025", tone: "success" },
              { med: "Amoxil 500mg", batch: "AMX-89912-B", status: "Suspicious", date: "Jan 05, 2025", tone: "warning" },
            ].map((row, i) => (
              <tr key={i} className="group border-t border-border/30 transition-colors duration-200 hover:bg-accent/30 cursor-pointer">
                <td className="px-6 py-4 font-medium flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Pill className="h-4 w-4" />
                  </div>
                  {row.med}
                </td>
                <td className="px-6 py-4 font-mono text-[13px]">{row.batch}</td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${{
                    success: "bg-success/10 text-success",
                    warning: "bg-warning/10 text-warning-foreground",
                    destructive: "bg-destructive/10 text-destructive",
                    primary: "bg-primary/10 text-primary"
                  }[row.tone]
                    }`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground text-[12px]">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border/40 px-6 py-4 flex justify-center">
        <Button variant="ghost" className="text-[13px] text-primary hover:bg-primary/10">View full history <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Button>
      </div>
    </div>
  );
}

function DigitalVaultWidget() {
  return (
    <div className="card-premium p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Digital Vault</h3>
        <Button variant="ghost" size="sm" className="text-primary text-[11px]">View All</Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: "Panadol Extra", exp: "Oct 2026", type: "Pain Relief" },
          { name: "Brufen 400", exp: "Jan 2027", type: "Anti-inflammatory" },
          { name: "Augmentin", exp: "Mar 2025", type: "Antibiotic" },
          { name: "Ventolin", exp: "Dec 2025", type: "Inhaler" }
        ].map((m, i) => (
          <div key={i} className="rounded-xl bg-secondary/30 p-4 border border-border/40 hover:bg-secondary/50 transition-colors cursor-pointer group">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Pill className="h-5 w-5" />
            </div>
            <p className="font-semibold text-[13px]">{m.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{m.type}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-3 bg-background/50 rounded px-2 py-0.5 inline-block border border-border/50">EXP: {m.exp}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthAnalyticsWidget() {
  const data = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(m => ({ m, scans: Math.round(5 + Math.random() * 15) }));
  return (
    <div className="card-premium p-6 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Health Analytics</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5">Your monthly verification trend</p>
      </div>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.50 0.20 265)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.50 0.20 265)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="scans" stroke="oklch(0.50 0.20 265)" strokeWidth={2} fillOpacity={1} fill="url(#colorScans)" />
            <XAxis dataKey="m" stroke="oklch(0.48 0.015 260)" fontSize={10} tickLine={false} axisLine={false} />
            <RechartsTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AIAssistantWidget() {
  return (
    <div className="card-premium overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="p-6 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-white shadow-glow">
              <Cpu className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold">SafeDose AI</h3>
            <p className="text-[11px] text-success font-medium flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" /> Monitoring Active</p>
          </div>
        </div>
        <div className="bg-background/60 rounded-xl p-4 border border-border/50 backdrop-blur-sm">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            "Your recent Panadol Extra scans are consistent with genuine GSK distribution. No counterfeit anomalies detected in your region today."
          </p>
        </div>
        <Button variant="outline" className="w-full mt-4 rounded-xl text-[12px] bg-card hover:bg-accent border-border/60 transition-all duration-300">
          <MessageSquare className="mr-2 h-3.5 w-3.5" /> Ask Safety Assistant
        </Button>
      </div>
    </div>
  );
}

function MedicineRemindersWidget() {
  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Reminders</h3>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full bg-secondary text-primary"><Plus className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="space-y-3">
        {[
          { time: "08:00 AM", med: "Augmentin 625", desc: "1 Tablet after breakfast", status: "taken" },
          { time: "02:00 PM", med: "Panadol Extra", desc: "2 Tablets if needed", status: "upcoming" },
          { time: "08:00 PM", med: "Augmentin 625", desc: "1 Tablet after dinner", status: "upcoming" }
        ].map((r, i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-colors">
            <div className={`flex flex-col items-center justify-center h-12 w-12 shrink-0 rounded-xl ${r.status === 'taken' ? 'bg-success/10 text-success' : 'bg-background border border-border text-foreground shadow-sm'}`}>
              <Clock className="h-3 w-3 mb-0.5 opacity-50" />
              <span className="text-[10px] font-bold">{r.time.split(' ')[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-semibold truncate ${r.status === 'taken' ? 'line-through opacity-50' : ''}`}>{r.med}</p>
              <p className="text-[11px] text-muted-foreground truncate">{r.desc}</p>
            </div>
            {r.status === 'taken' && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SafetyMapWidget() {
  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Map className="h-4 w-4 text-primary" /> Live Safety Map</h3>
      </div>
      <div className="relative h-[200px] rounded-xl overflow-hidden bg-secondary/30 border border-border/50">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <svg viewBox="0 0 100 50" className="absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none">
          <path fill="oklch(0.72 0.18 265 / 0.15)" stroke="oklch(0.72 0.18 265 / 0.4)" strokeWidth="0.3" d="M5,20 Q15,10 25,18 T45,20 Q55,12 70,18 T95,22 L95,40 Q70,45 45,38 T5,40 Z" />
        </svg>
        <div className="absolute top-1/3 left-1/4 h-3 w-3 rounded-full bg-success pulse-dot" />
        <div className="absolute top-1/2 left-1/2 h-4 w-4 rounded-full bg-destructive pulse-dot opacity-80" />
        <div className="absolute top-2/3 left-1/3 h-2 w-2 rounded-full bg-success pulse-dot" />

        <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-background/80 backdrop-blur-md border border-border/50 p-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold">Region: Lahore</p>
            <p className="text-[10px] text-muted-foreground">1 active alert nearby.</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-md px-2">View</Button>
        </div>
      </div>
    </div>
  );
}

function SafePharmaciesWidget() {
  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-success" /> Safe Pharmacies</h3>
        <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-medium uppercase tracking-wider">Nearby</span>
      </div>
      <div className="space-y-2">
        {[
          { name: "Servaid Pharmacy", dist: "0.8 km", rating: 4.9 },
          { name: "Clinix", dist: "1.2 km", rating: 4.8 },
          { name: "D Watson", dist: "2.5 km", rating: 4.9 },
        ].map((p, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary/40 transition-colors cursor-pointer border border-transparent hover:border-border/50">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-success/10 text-success">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{p.dist}</span>
                  <span className="text-[10px] text-muted-foreground">•</span>
                  <span className="flex items-center text-[10px] font-medium text-warning"><Star className="h-2.5 w-2.5 fill-warning mr-0.5" /> {p.rating}</span>
                </div>
              </div>
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground opacity-50" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsWidget() {
  return (
    <div className="card-premium p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notifications</h3>
      </div>
      <ol className="space-y-4">
        {[
          { title: "Verification Success", desc: "Panadol Extra is genuine.", time: "2 hrs ago", icon: CheckCircle2, tone: "success" },
          { title: "Alert Reported", desc: "Your report is under review.", time: "3 days ago", icon: ShieldAlert, tone: "warning" },
        ].map((ev, i, arr) => (
          <li key={i} className="relative flex gap-3.5 pb-2">
            {i < arr.length - 1 && <div className="absolute left-[13px] top-8 bottom-[-12px] w-px bg-border/50" />}
            <div className={`relative z-10 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full ${{
              success: "bg-success/10 text-success",
              warning: "bg-warning/10 text-warning-foreground",
              destructive: "bg-destructive/10 text-destructive",
              primary: "bg-primary/10 text-primary"
            }[ev.tone]
              }`}>
              <ev.icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[13px] font-medium">{ev.title}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{ev.desc}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1.5">
                <Clock className="h-3 w-3" />{ev.time}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <Button variant="ghost" className="w-full mt-4 text-[12px] text-primary">View All Alerts</Button>
    </div>
  );
}

function ReportFakeWidget({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-destructive/10 via-card to-card border border-destructive/20 p-6 relative overflow-hidden group shadow-[0_10px_30px_rgba(239,68,68,0.1)]">
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500">
        <ShieldAlert className="h-32 w-32 text-destructive" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </div>
          <h3 className="text-[15px] font-bold text-destructive">Report Counterfeit</h3>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed mb-5 pr-4">
          Help DRAP protect the community. Suspect a counterfeit? File an emergency reports with evidence.
        </p>
        <Button
          onClick={onOpen}
          variant="destructive"
          className="w-full rounded-xl shadow-lg text-[12px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] h-11"
        >
          File DRAP Report
        </Button>
      </div>
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────────────
// EXISTING VERIFICATION COMPONENTS
// ──────────────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value, valueColor = "text-foreground" }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[11px] font-medium">{label}</span></div>
      <span className={`text-[11px] font-bold text-right ${valueColor}`}>{value}</span>
    </div>
  );
}

function ScannerMock({ icon: Icon, label, onSimulate }: { icon: typeof QrCode; label: string; onSimulate: () => void }) {
  return (
    <div className="grid place-items-center rounded-xl bg-gradient-to-br from-secondary/50 to-background/80 p-10 sm:p-14">
      {/* Scanner box — overflow:hidden clips the scan line strictly inside */}
      <div className="relative h-56 w-56 rounded-2xl border-2 border-dashed border-primary/30 bg-card shadow-elegant overflow-hidden grid place-items-center group">
        <Icon className="h-24 w-24 text-primary/30 group-hover:text-primary/50 transition-colors duration-500" strokeWidth={1} />

        {/* Holo Scanning Beam */}
        <motion.div
          className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/20 to-transparent pointer-events-none"
          animate={{ top: ["-10%", "110%", "-10%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Primary Scan Line */}
        <motion.div
          className="absolute inset-x-3 h-0.5 rounded-full bg-gradient-primary shadow-[0_0_12px_3px_oklch(0.50_0.20_265_/_0.65)]"
          style={{ top: "8px" }}
          animate={{ y: [0, 208, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />

        {/* Holographic Corners */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/40 rounded-tl-xl" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/40 rounded-tr-xl" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/40 rounded-bl-xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/40 rounded-br-xl" />
      </div>

      <p className="mt-5 text-[13px] text-muted-foreground">{label}</p>
      <Button
        onClick={onSimulate}
        variant="outline"
        className="mt-4 rounded-full border-border/60 text-[13px] transition-all duration-200 hover:border-primary/30"
      >
        Simulate scan
      </Button>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; tone: string; glow: string; icon: any; badge: string }> = {
  genuine: { label: "Verified Genuine", tone: "success", glow: "glow-genuine", icon: CheckCircle2, badge: "✓ VERIFIED" },
  duplicate: { label: "Duplicate Scan", tone: "destructive", glow: "glow-fake", icon: ShieldAlert, badge: "⚠ DUPLICATE" },
  suspected: { label: "Suspicious", tone: "warning", glow: "glow-suspicious", icon: AlertTriangle, badge: "! ALERT" },
  invalid: { label: "Counterfeit", tone: "destructive", glow: "glow-fake", icon: XCircle, badge: "⚠ DANGER" },
};

function ResultCard({ status: result, batch }: { status: IVerificationResult; batch: string }) {
  const [expandedSection, setExpandedSection] = useState<"manufacturer" | "pharmacy" | null>(null);
  const toggleSection = (section: "manufacturer" | "pharmacy") => setExpandedSection(prev => prev === section ? null : section);

  const m = STATUS_META[result.status] || STATUS_META.invalid;
  const toneMap = {
    success: "bg-success/8 text-success border-success/20",
    destructive: "bg-destructive/8 text-destructive border-destructive/20",
    warning: "bg-warning/8 text-warning-foreground border-warning/20",
  };
  const toneClass = toneMap[m.tone as keyof typeof toneMap] || toneMap.success;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elegant mt-8 ${m.glow}`}
    >
      <div className={`flex items-center gap-3 border-b px-6 py-5 ${toneClass}`}>
        <m.icon className="h-6 w-6 shrink-0" />
        <div className="flex-1">
          <p className="text-[14px] font-bold uppercase tracking-wider">{m.label}</p>
          <p className="text-[12px] font-medium opacity-90">{result.message}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black bg-white/20 px-2 py-1 rounded border border-white/10 shrink-0">{result.type.toUpperCase()}</span>
          <Button size="sm" variant="ghost" className="rounded-full w-8 h-8 p-0"><Share2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2 lg:p-8">
        <div className="space-y-4">
          {result.batchDetails && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-secondary/20 border border-border/40 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Medicine Info</p>
                <div className="flex gap-4 mb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Pill className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[15px] truncate">{result.batchDetails.name}</p>
                    <p className="text-[11px] text-muted-foreground">Manufacturer: {result.batchDetails.manufacturer}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/30">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Batch ID</p>
                    <p className="font-mono text-[12px] font-bold mt-0.5">{result.batchDetails.batchNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Expiry</p>
                    <p className="text-[12px] font-bold mt-0.5">{result.batchDetails.expiry}</p>
                  </div>
                </div>
              </div>

              {/* Manufacturer Dropdown */}
              <div className="rounded-2xl border border-border/40 overflow-hidden bg-secondary/10">
                <button
                  onClick={() => toggleSection("manufacturer")}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center border border-blue-500/20"><Factory className="h-4 w-4 text-blue-500" /></div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Authenticated Producer</p>
                      <p className="text-[13px] font-bold group-hover:text-primary transition-colors">{result.batchDetails.manufacturer}</p>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${expandedSection === "manufacturer" ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {expandedSection === "manufacturer" && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
                      <div className="p-4 pt-0 space-y-2.5">
                        <div className="h-px bg-border/30 mb-3" />
                        <DetailRow icon={<Shield className="h-3.5 w-3.5" />} label="DRAP License" value={result.manufacturer?.licenseNumber ?? "Not provided"} />
                        <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={result.manufacturer?.address ?? "Not provided"} />
                        <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Contact" value={result.manufacturer?.businessPhone ?? result.manufacturer?.businessEmail ?? "Not provided"} />
                        <DetailRow icon={<CheckCircle className="h-3.5 w-3.5 text-green-500" />} label="Global Compliance" value="Verified Supply Chain" valueColor="text-green-500" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Pharmacy Dropdown */}
              {result.supplyChain?.pharmacyName && (
                <div className="rounded-2xl border border-border/40 overflow-hidden bg-secondary/10">
                  <button
                    onClick={() => toggleSection("pharmacy")}
                    className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center border border-green-500/20"><ShoppingBag className="h-4 w-4 text-green-500" /></div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Certified Retailer</p>
                        <p className="text-[13px] font-bold group-hover:text-primary transition-colors">{result.supplyChain.pharmacyName}</p>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${expandedSection === "pharmacy" ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {expandedSection === "pharmacy" && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
                        <div className="p-4 pt-0 space-y-2.5">
                          <div className="h-px bg-border/30 mb-3" />
                          <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Pharmacy" value={result.supplyChain.pharmacyName} />
                          <DetailRow icon={<Archive className="h-3.5 w-3.5" />} label="Box Serial" value={result.supplyChain.boxNumber ?? "N/A"} />
                          <DetailRow icon={<CheckCircle className="h-3.5 w-3.5 text-green-500" />} label="Status" value="Retail Verified" valueColor="text-green-500" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Supply Chain Trail */}
              {(result.pillInfo || result.cartonInfo) && (
                <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">Product Ancestry</p>
                  {result.cartonInfo && <DetailRow icon={<Package className="h-3.5 w-3.5" />} label="Industrial Carton" value={result.cartonInfo.cartonNumber} />}
                  {result.pillInfo?.boxNumber && <DetailRow icon={<Archive className="h-3.5 w-3.5" />} label="Retail Container" value={result.pillInfo.boxNumber} />}
                  {result.pillInfo && <DetailRow icon={<Circle className="h-3.5 w-3.5" />} label="Unit Position" value={result.pillInfo.sequencePosition} />}
                </div>
              )}
            </div>
          )}

          {result.fraudDetails && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-2.5">
              <p className="text-[10px] font-bold text-destructive uppercase tracking-[0.2em] flex items-center gap-2">
                <ShieldAlert className="h-3 w-3" /> Fraud Intelligence
              </p>
              <DetailRow icon={<Clock className="h-3 w-3 text-destructive" />} label="Initial Scan" value={new Date(result.fraudDetails.firstScanAt).toLocaleDateString()} valueColor="text-destructive" />
              <DetailRow icon={<MapPin className="h-3 w-3 text-destructive" />} label="Origin Hub" value={result.fraudDetails.firstScanLocation} valueColor="text-destructive" />
              <DetailRow icon={<AlertTriangle className="h-3 w-3 text-destructive" />} label="Total Scans" value={result.fraudDetails.scanCount.toString()} valueColor="text-destructive font-black" />
            </div>
          )}

          {/* Previously Scanned Warning — shown only for duplicate results */}
          {result.status === "duplicate" && (
            <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4 space-y-3">
              <p className="text-[10px] font-black text-warning-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Previously Scanned
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/80">
                {result.message}
              </p>
              <div className="space-y-3">
                <div className="rounded-xl border border-warning/20 bg-warning/8 px-3 py-2">
                  <p className="text-[11px] font-semibold text-warning-foreground">
                    If this is an unopened package, do not consume. Report to DRAP at helpline
                    {" "}<span className="font-black">1223</span>.
                  </p>
                </div>
                <Button asChild variant="destructive" className="w-full rounded-xl text-[12px] font-bold shadow-md h-10 bg-destructive hover:bg-destructive/95">
                  <Link
                    to="/report"
                    search={{
                      medicineName: result.batchDetails?.name || "",
                      batchNumber: result.batchDetails?.batchNumber || "",
                      source: "scan",
                    }}
                  >
                    Report to DRAP
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4 font-mono text-[11px] text-muted-foreground group hover:border-primary/20 transition-all">
            <p className="mb-2 text-[9px] font-black text-primary uppercase tracking-[0.15em] flex items-center gap-1.5">
              <Hash className="h-3 w-3" /> Blockchain Ledger Proof
            </p>
            {result.batchDetails?.txHash && result.batchDetails.txHash.startsWith("0x") && result.batchDetails.txHash.length > 20 ? (
              <a
                href={`https://amoy.polygonscan.com/tx/${result.batchDetails.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="break-all text-primary hover:underline opacity-80 hover:opacity-100 inline-flex items-start gap-1"
                title="View on PolygonScan (Amoy Testnet)"
              >
                <span className="break-all whitespace-pre-wrap">{result.batchDetails.txHash}</span>
              </a>
            ) : (
              <span className="break-all opacity-60 italic">{result.batchDetails?.txHash || "Pending Anchoring"}</span>
            )}
          </div>

          {/* AI Chat Experience */}
          {result.batchDetails && (
            <MedicineAIChat
              medicineContext={{
                name: result.batchDetails.name,
                manufacturer: result.batchDetails.manufacturer,
                batchNumber: result.batchDetails.batchNumber,
                expiry: result.batchDetails.expiry,
                status: result.status,
                category: result.medicine?.category,
                activeIngredients: result.medicine?.activeIngredients,
                genericName: result.medicine?.genericName,
                approvalStatus: result.medicine?.approvalStatus,
              }}
            />
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-primary" /> Supply Chain Timeline
            </p>
            <ol className="space-y-6 pl-2">
              {[
                { t: "Production", s: result.manufacturer?.companyName ?? result.batchDetails?.manufacturer ?? "Manufacturer", d: result.batchDetails?.expiry ? "Verified" : "Genesis", active: true },
                { t: "Wholesale", s: "SafeDose Logistics", d: "Transit Secure", active: true },
                { t: "Distribution", s: result.supplyChain?.pharmacyName ?? "Pharmacy Node", d: result.supplyChain?.boxNumber ? "Received" : "Processing", active: !!result.supplyChain?.pharmacyName },
                { t: result.status === 'genuine' ? "Final Checkout" : "Security Alert", s: "Patient Mobile Scan", d: "Now", active: true, color: m.tone },
              ].map((step, i, arr) => (
                <li key={i} className="relative flex gap-5">
                  <div className="flex flex-col items-center">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[11px] font-black shadow-sm transition-all ${i === arr.length - 1
                        ? (step.color === 'success' ? "bg-success text-white shadow-success/30 rotate-0" : "bg-destructive text-white shadow-destructive/30 scale-110")
                        : (step.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
                      }`}>{i + 1}</span>
                    {i < arr.length - 1 && <span className={`mt-2 h-full w-[2px] rounded-full ${step.active ? "bg-primary/20" : "bg-muted/30"}`} />}
                  </div>
                  <div className="pb-2 min-w-0">
                    <p className={`text-[14px] font-bold ${step.active ? "text-foreground" : "text-muted-foreground"}`}>{step.t}</p>
                    <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">{step.s} · {step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Field({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-secondary/15 p-3.5 transition-colors duration-200 hover:bg-secondary/25">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-[13px] font-bold ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
