import { createFileRoute, Navigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope, PackageCheck, AlertTriangle, Star, ScanLine, ShieldCheck, XCircle, Clock, ArrowRight, TrendingUp,
  CheckCircle2, Package, RefreshCw, Filter, Activity, UploadCloud, Truck, BrainCircuit, Map, ShieldAlert, FileText, Lock, Users,
  X, Camera, Loader2, ChevronDown, ShoppingBag, Factory, Archive, Circle, Phone, CheckCircle
} from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/library";
import { useAuth } from "@/lib/auth-context";
import { DASH_NAV } from "@/config/nav";
import { ease } from "@/lib/motion";
import { toast } from "sonner";
import { DashShell } from "@/components/dashboard/DashShell";
import { ScanLocationsMap } from "@/components/maps/ScanLocationsMap";
import { StatCard, MetricRow } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/dashboard/pharmacy")({
  head: () => ({
    meta: [
      { title: "Pharmacy Command Center — MediVerify" },
      { name: "description", content: "Enterprise pharmacy operations, inventory tracking, and AI verification portal." }
    ]
  }),
  component: Page,
});


// ──────────────────────────────────────────────────────────────────────────
// DATA MODELS
// ──────────────────────────────────────────────────────────────────────────

const ALERTS = [
  { sev: "high", t: "Suspicious batch FAKE-001 received — Supplier B", time: "2 min ago", id: "ALT-001" },
  { sev: "high", t: "Duplicate QR scan detected on VNT-01122-B", time: "8 min ago", id: "ALT-002" },
  { sev: "med", t: "Augmentin 625 stock below threshold (12 units left)", time: "1 hr ago", id: "ALT-003" },
  { sev: "med", t: "Batch AUG-77821-C flagged by DRAP — verify immediately", time: "3 hrs ago", id: "ALT-004" },
  { sev: "low", t: "5 new patient verification requests this hour", time: "1 hr ago", id: "ALT-005" },
];

const VERIF_LOGS = [
  { batch: "PNX-49281-A", med: "Panadol Extra", result: "genuine", time: "2 min ago", by: "Staff" },
  { batch: "RSK-12009-D", med: "Risek 20mg", result: "genuine", time: "5 min ago", by: "Patient" },
  { batch: "FAKE-001", med: "Unknown Generic", result: "fake", time: "9 min ago", by: "Staff" },
  { batch: "VNT-01122-B", med: "Ventolin Inhaler", result: "suspicious", time: "12 min ago", by: "Staff" },
  { batch: "BRF-33310-E", med: "Brufen 400mg", result: "genuine", time: "18 min ago", by: "Patient" },
  { batch: "AUG-77821-C", med: "Augmentin 625", result: "fake", time: "25 min ago", by: "Staff" },
];

const INVENTORY = [
  { name: "Panadol Extra", stock: 428, threshold: 100, status: "ok" },
  { name: "Ventolin Inhaler", stock: 58, threshold: 80, status: "low" },
  { name: "Risek 20mg", stock: 312, threshold: 50, status: "ok" },
  { name: "Augmentin 625", stock: 12, threshold: 80, status: "critical" },
  { name: "Brufen 400mg", stock: 195, threshold: 60, status: "ok" },
];

const DAILY_SCANS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
  d, scans: Math.round(60 + Math.random() * 120), flagged: Math.round(Math.random() * 8),
}));

const REVIEWS = [
  { n: "Ali Raza", r: 5, t: "Quick verification, gives me real peace of mind every visit." },
  { n: "Sana Mirza", r: 5, t: "Caught a fake brufen last week. Absolute lifesaver." },
  { n: "Imran Sheikh", r: 4, t: "Great UX. Would love full Urdu support across all screens." },
];

const SUPPLIERS = [
  { name: "GSK Pakistan", status: "In Transit", trust: 99, eta: "Today, 4 PM" },
  { name: "Abbott Labs", status: "Delivered", trust: 98, eta: "Yesterday" },
  { name: "Unknown Dist.", status: "Suspicious", trust: 45, eta: "Pending Verification" },
];

const RESULT_STYLE = {
  genuine: { cls: "bg-success/8 text-success border-success/20", dot: "bg-success", label: "Genuine" },
  fake: { cls: "bg-destructive/8 text-destructive border-destructive/20", dot: "bg-destructive", label: "Fake" },
  suspicious: { cls: "bg-warning/8 text-warning-foreground border-warning/20", dot: "bg-warning", label: "Suspicious" },
};


// ──────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ──────────────────────────────────────────────────────────────────────────

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
    }).catch(() => setError("Camera access denied. Please allow camera permissions."));
    return () => reader.reset();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-sm mx-4 aspect-square overflow-hidden bg-black rounded-3xl border-2 border-primary/30">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 m-12 border-2 border-primary/50 rounded-2xl pointer-events-none">
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/50 shadow-[0_0_10px_2px_rgba(var(--primary-rgb),0.5)] animate-scan-y" />
        </div>
      </div>
      <p className="text-white text-center font-bold text-sm mt-8 px-6">Point camera at the Carton or box</p>
      {error && <p className="text-destructive font-bold text-sm mt-4">{error}</p>}
      <Button onClick={onClose} className="mt-8 rounded-xl px-12" variant="secondary">Cancel</Button>
    </div>
  );
}

function PharmacyDetailRow({ icon, label, value, bold, mono }: { icon?: React.ReactNode; label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] flex-shrink-0">{label}</span>
      </div>
      <span className={`text-[11px] text-right ${bold ? "font-semibold" : ""} ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function PharmacyScanModal({ onClose, session, user }: { onClose: () => void; session: any; user: any }) {
  const [activeMode, setActiveMode] = useState<"carton" | "box" | "batch">("carton");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleVerify = async (code?: string) => {
    const verifyCode = (code ?? input).trim();
    if (!verifyCode) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Capture GPS in parallel — never blocks the scan if denied or slow.
      const coords = await getCoords();
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.token ?? ""}`
        },
        body: JSON.stringify({
          code: verifyCode,
          userId: user?.id,
          location: "Pharmacy Scanner",
          deviceInfo: "Pharmacy Dashboard",
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {})
        })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.message || "Verification failed");
      }
    } catch (err: any) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getResultConfig = () => {
    if (!result) return null;
    const isGenuine = result.resultType === "GENUINE";
    const isFake = result.resultType === "FAKE";
    const isDuplicate = result.resultType === "DUPLICATE";
    return {
      icon: isGenuine ? <CheckCircle className="text-green-500" /> : isFake ? <XCircle className="text-red-500" /> : <AlertTriangle className="text-orange-500" />,
      label: isGenuine ? "✓ Verified — Genuine" : isFake ? "FAKE DETECTED" : isDuplicate ? "ALREADY SCANNED" : result.resultType ?? "UNKNOWN",
      color: isGenuine ? "green" : isFake ? "red" : isDuplicate ? "orange" : "yellow"
    };
  };
  const config = getResultConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div>
            <h2 className="font-semibold text-base">Scan Incoming Stock</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Scan Carton QR → Box QR → verify stock</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { key: "carton", label: "Carton QR", color: "blue", desc: "Outer carton" },
              { key: "box", label: "Box QR", color: "green", desc: "Individual box" },
              { key: "batch", label: "Batch No.", color: "purple", desc: "Manual entry" }
            ].map(item => {
              const isActive = activeMode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { setActiveMode(item.key as typeof activeMode); setInput(""); setResult(null); }}
                  className={`rounded-lg border p-2 text-center transition-all cursor-pointer ${
                    isActive
                      ? `border-${item.color}-500 bg-${item.color}-500/15 ring-1 ring-${item.color}-500/40`
                      : `border-${item.color}-500/20 bg-${item.color}-500/5 hover:bg-${item.color}-500/10`
                  }`}
                >
                  <p className={`text-[10px] font-semibold text-${item.color}-500`}>{item.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{item.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
              placeholder={
                activeMode === "carton" ? "Scan Carton QR or type CARTON-..." :
                activeMode === "box" ? "Scan Box QR or type BOX-..." :
                "Type batch number e.g. PND-2024-001"
              }
              className="flex-1 h-11 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            <button onClick={() => setShowCamera(true)} className="h-11 w-11 rounded-xl border border-border bg-secondary/20 flex items-center justify-center hover:bg-secondary transition-colors flex-shrink-0 cursor-pointer">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => handleVerify()}
            disabled={loading || !input.trim()}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>) : (<><ScanLine className="h-4 w-4" /> Verify Stock</>)}
          </button>
          {error && <p className="text-red-500 text-[11px] font-medium text-center">{error}</p>}
          <p className="text-[10px] text-muted-foreground/50 text-center">
            Location access is optional and used for supply-chain tracking only.
          </p>
        </div>

        {result && config && (
          <div className="mx-5 mb-5 rounded-xl border border-border/50 overflow-hidden bg-secondary/5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={`p-4 bg-${config.color}-500/10 border-b border-${config.color}-500/20`}>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full bg-${config.color}-500/20 flex items-center justify-center`}>
                  {config.icon}
                </div>
                <div className="min-w-0">
                  <p className={`font-bold text-sm text-${config.color}-600`}>{config.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{result.message}</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2.5">
              {result.medicine && (
                <>
                  <PharmacyDetailRow label="Medicine" value={result.medicine.name} bold />
                  <PharmacyDetailRow label="Manufacturer" value={result.manufacturer?.companyName ?? "N/A"} />
                </>
              )}
              {result.batch && (
                <>
                  <PharmacyDetailRow label="Batch Number" value={result.batch.batchNumber} mono />
                  <PharmacyDetailRow label="Expiry Date" value={result.batch.expiryDate ? new Date(result.batch.expiryDate).toLocaleDateString() : "N/A"} />
                </>
              )}
              {result.cartonInfo && (
                <div className="pt-2 mt-2 border-t border-border/30">
                  <PharmacyDetailRow label="Carton ID" value={result.cartonInfo.cartonNumber} mono />
                  <PharmacyDetailRow label="Unit Count" value={`${result.cartonInfo.boxesCount} Boxes`} />
                </div>
              )}
              {result.supplyChain && (
                <div className="pt-2 mt-2 border-t border-border/30">
                  <PharmacyDetailRow label="Audit Trace" value={result.supplyChain.verifiedBy} />
                  <PharmacyDetailRow icon={<Archive className="h-3 w-3" />} label="Box Serial" value={result.supplyChain.boxNumber} />
                </div>
              )}
              {/* Blockchain Ledger Proof */}
              <div className="pt-2 mt-2 border-t border-border/30">
                <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Blockchain Ledger Proof</p>
                {result.blockchain?.txHash && result.blockchain.txHash.startsWith("0x") && result.blockchain.txHash.length > 20 ? (
                  <a
                    href={`https://amoy.polygonscan.com/tx/${result.blockchain.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] text-primary break-all hover:underline"
                    title="View on PolygonScan"
                  >
                    {result.blockchain.txHash}
                  </a>
                ) : (
                  <span className="font-mono text-[10px] text-muted-foreground italic">Pending Anchoring</span>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-border/30 bg-secondary/10 flex gap-2">
              <button
                onClick={() => { setResult(null); setInput(""); }}
                className="flex-1 h-9 rounded-lg bg-background border border-border text-[11px] font-bold hover:bg-secondary transition-colors cursor-pointer"
              >
                Scan Next {activeMode === "carton" ? "Carton" : activeMode === "box" ? "Box" : "Batch"}
              </button>
              <button
                onClick={onClose}
                className="px-4 h-9 rounded-lg bg-background border border-border text-[11px] font-bold hover:bg-secondary transition-colors text-muted-foreground cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {showCamera && (
        <LiveScanner
          mode={activeMode === "batch" ? "barcode" : "qr"}
          onResult={(code) => { setShowCamera(false); setInput(code); handleVerify(code); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

function Page() {
  const { user, session, isAuthenticated, signOut, isLoading, updateUser } = useAuth();
  const [liveLog, setLiveLog] = useState(VERIF_LOGS);
  const [showScanModal, setShowScanModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "pharmacy") {
      signOut();
    }
  }, [isAuthenticated, user?.role, signOut]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "pharmacy") return;

    const syncUser = () => {
      const token = session?.token || "";
      if (!token) return;
      
      const headers = { "Authorization": `Bearer ${token}` };
      fetch("/api/auth/me", { headers })
        .then(res => res.json())
        .then(res => {
          if (res.success && res.data) {
            updateUser({
              isVerified: res.data.isVerified,
              fullName: res.data.name,
            });
          }
        })
        .catch(err => console.error("Failed to sync user data:", err));
    };

    syncUser();
    const syncInterval = setInterval(syncUser, 10000);
    return () => clearInterval(syncInterval);
  }, [isAuthenticated, user?.role, session?.token, updateUser]);

  useEffect(() => {
    if (!session?.token) return;
    fetch("/api/pharmacy/scan-logs", {
      headers: { "Authorization": `Bearer ${session.token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          setLiveLog(data.data.map((log: any) => ({
            batch: log.code,
            med: log.pill?.batch?.medicine?.name ?? log.medicine?.name ?? "Unknown Medicine",
            result: log.status === "GENUINE" ? "genuine" : log.status === "INVALID" ? "fake" : "suspicious",
            time: new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            by: log.userId ? "Staff" : "Public"
          })));
        }
      })
      .catch(() => { });
  }, [session?.token]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/auth/login" />;
  if (user?.role !== "pharmacy") return <Navigate to="/auth/login" />;

  const handleRestrictedAction = (action: () => void) => {
    if (!user?.isVerified) {
      toast.error("License Verification Pending", {
        description: "Your DRAP Pharmacy License is pending approval. You cannot perform this action.",
      });
      return;
    }
    action();
  };

  return (
    <DashShell
      title="Pharmacy Command Center"
      subtitle={`${user?.fullName || "Servaid"} Pharmacy · Branch #218 · Karachi · ${user?.isVerified ? "Verified" : "Unverified"}`}
      badge="Enterprise"
      nav={DASH_NAV}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full border-border/60 text-[12px] font-medium gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Filter
          </Button>
          <Button
            onClick={() => handleRestrictedAction(() => setShowScanModal(true))}
            size="sm"
            disabled={!user?.isVerified}
            className="rounded-full bg-gradient-primary shadow-elegant text-[12px] font-medium gap-1.5 transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02] disabled:opacity-50"
          >
            <ScanLine className="h-3.5 w-3.5" /> Scan Stock
          </Button>
        </div>
      }
    >
      {/* Verification Warning Banner */}
      {!user?.isVerified && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-warning/20 bg-warning/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/15 flex items-center justify-center text-warning shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">DRAP License Verification Pending</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your pharmacy license is currently undergoing verification. Restricted actions (such as stock scanning and reporting) are disabled until approved.
              </p>
            </div>
          </div>
          <Button
            onClick={() => window.location.href = "/dashboard/profile"}
            size="sm"
            variant="outline"
            className="rounded-xl border-warning/20 hover:bg-warning/10 text-warning-foreground text-xs gap-1.5 shrink-0"
          >
            Complete Profile <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}

      {/* 1. Dashboard Overview / Action Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-6 flex flex-wrap gap-2.5"
      >
        <Button
          onClick={() => handleRestrictedAction(() => setShowScanModal(true))}
          disabled={!user?.isVerified}
          className="rounded-full bg-gradient-primary shadow-elegant text-[13px] font-medium transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02] disabled:opacity-50"
        >
          <ScanLine className="mr-2 h-4 w-4" /> Scan Incoming Stock
        </Button>
        {/* <Button variant="outline" className="rounded-full text-[13px] font-medium border-border/60 hover:border-primary/30">
          <FileText className="mr-2 h-4 w-4" /> Bulk Verify CSV
        </Button> */}
        <Button
          onClick={() => handleRestrictedAction(() => toast.info("Report Feature", { description: "Reporting tampered batch." }))}
          disabled={!user?.isVerified}
          variant="outline"
          className="rounded-full text-[13px] font-medium border-border/60 hover:border-destructive/30 text-destructive hover:text-destructive disabled:opacity-50"
        >
          <XCircle className="mr-2 h-4 w-4" /> Report Tampered Batch
        </Button>
      </motion.div>

      {/* Top Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={PackageCheck} label="Stock verified today" value={428} delta={6} tone="success" sparkline={[50, 62, 58, 72, 80, 75, 88, 95]} description="428 units cleared on blockchain" />
        <StatCard icon={ShieldAlert} label="Fraud Alerts (AI)" value={5} delta={-25} tone="warning" sparkline={[9, 7, 8, 6, 7, 5, 6, 5]} description="2 high priority risk factors" />
        <StatCard icon={Stethoscope} label="Patient verifications" value={1284} delta={11} sparkline={[60, 72, 65, 80, 78, 90, 88, 95]} description="Walk-in QR scans" />
        <StatCard icon={Star} label="Pharmacy Trust Score" value={98} suffix="/100" delta={2} tone="success" sparkline={[90, 92, 94, 95, 96, 96, 97, 98]} description="Top 5% in your region" />
      </div>

      {/* 2. Bulk Verify & 13. Safety Map Row */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <BulkVerifyWidget className="lg:col-span-2" />
        <ScanLocationsMap endpoint="/api/pharmacy/scan-locations" title="Patient Scan Locations" />
      </div>

      {/* 7. Analytics & 10. AI Fraud Row */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <AnalyticsWidget className="lg:col-span-2" />
        <AIFraudWidget />
      </div>

      {/* 3. Inventory & 8. Supplier Tracking Row */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <InventoryWidget />
        <SupplierTrackingWidget />
      </div>

      {/* 11. Alerts & 5. Logs Row */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <SmartAlertsWidget />
        <VerificationLogsWidget liveLog={liveLog} />
      </div>

      {/* 6. Customer Trust & 12. Performance Row */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <CustomerTrustWidget className="lg:col-span-2" />
        <PerformanceInsightsWidget />
      </div>

      {showScanModal && <PharmacyScanModal onClose={() => setShowScanModal(false)} session={session} user={user} />}
    </DashShell>
  );
}


// ──────────────────────────────────────────────────────────────────────────
// WIDGET COMPONENTS
// ──────────────────────────────────────────────────────────────────────────

function BulkVerifyWidget({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease }}
      className={`card-premium p-6 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><UploadCloud className="h-4 w-4 text-primary" /> Bulk Stock Verification</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Upload supplier manifests for automated blockchain clearance.</p>
        </div>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-secondary/20 p-10 flex flex-col items-center justify-center text-center transition-colors hover:bg-secondary/40 hover:border-primary/40 cursor-pointer">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary mb-4">
          <UploadCloud className="h-5 w-5" />
        </div>
        <h4 className="text-[14px] font-medium">Drag and drop batch files here</h4>
        <p className="text-[12px] text-muted-foreground mt-1 mb-5 max-w-sm">Supports CSV, XLSX, or JSON from authorized distributor systems. Max 10,000 SKUs per upload.</p>
        <Button size="sm" variant="outline" className="rounded-xl border-primary/30 text-primary hover:bg-primary/10">Browse Files</Button>
      </div>
    </motion.div>
  );
}

function AnalyticsWidget({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease }}
      className={`card-premium p-6 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Verification Trends</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Total scans vs flagged anomalies · this week</p>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full text-[11px] gap-1 text-muted-foreground">
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={DAILY_SCANS} barGap={4}>
            <defs>
              <linearGradient id="barScans" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.50 0.20 265)" stopOpacity={0.9} />
                <stop offset="100%" stopColor="oklch(0.50 0.20 265)" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.925 0.008 255 / 0.5)" vertical={false} />
            <XAxis dataKey="d" stroke="oklch(0.48 0.015 260)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="oklch(0.48 0.015 260)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="scans" fill="url(#barScans)" radius={[6, 6, 0, 0]} name="Total Scans" />
            <Bar dataKey="flagged" fill="oklch(0.56 0.22 22 / 0.7)" radius={[6, 6, 0, 0]} name="Flagged" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex gap-5">
        {[{ color: "bg-primary", label: "Genuine Scans" }, { color: "bg-destructive", label: "Suspicious / Fake" }].map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`h-2.5 w-2.5 rounded-full ${l.color}`} />{l.label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function AIFraudWidget() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1, duration: 0.5, ease }}
      className="card-premium overflow-hidden relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="p-6 relative z-10 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-white shadow-glow">
              <BrainCircuit className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold">AI Fraud Detection</h3>
            <p className="text-[11px] text-success font-medium flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" /> Monitoring Traffic</p>
          </div>
        </div>
        <div className="bg-background/60 rounded-xl p-4 border border-border/50 backdrop-blur-sm flex-1">
          <div className="mb-4 flex justify-between items-center border-b border-border/50 pb-3">
            <span className="text-[12px] text-muted-foreground">Fraud Risk Score</span>
            <span className="text-[14px] font-bold text-success">Low (1.2%)</span>
          </div>
          <ul className="space-y-3 text-[12px] leading-relaxed text-muted-foreground">
            <li className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              No systematic scanning anomalies detected today.
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              Pattern detected: 3 duplicates linked to "Unknown Dist." Investigate recent shipments.
            </li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

function InventoryWidget() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease }}
      className="card-premium p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Inventory Health</h3>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="space-y-4">
        {INVENTORY.map((item) => {
          const pct = Math.min(100, (item.stock / 500) * 100);
          const barColor = item.status === "ok" ? "bg-gradient-success" : item.status === "low" ? "bg-warning" : "bg-destructive";
          const labelColor = item.status === "ok" ? "text-success" : item.status === "low" ? "text-warning-foreground" : "text-destructive";
          return (
            <div key={item.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium truncate max-w-[150px]">{item.name}</span>
                <span className={`font-semibold tabular-nums ${labelColor}`}>{item.stock} <span className="text-muted-foreground font-normal text-[11px]">/ 500</span></span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/60">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease }}
                  className={`h-full rounded-full ${barColor}`}
                />
              </div>
              {item.stock < item.threshold && (
                <p className="text-[10px] text-destructive font-medium flex justify-between">
                  <span>⚠ Below threshold ({item.threshold} min)</span>
                  <span className="cursor-pointer hover:underline text-primary">Reorder</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SupplierTrackingWidget() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1, duration: 0.5, ease }}
      className="card-premium p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Supplier & Distributor Tracking</h3>
        <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">3 Active</span>
      </div>
      <div className="space-y-3">
        {SUPPLIERS.map((s, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`grid h-9 w-9 place-items-center rounded-full ${s.trust > 90 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-foreground'}`}>
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">{s.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">{s.status}</span>
                  <span className="text-[10px] text-muted-foreground">•</span>
                  <span className="text-[11px] text-muted-foreground">ETA: {s.eta}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Trust</p>
              <span className={`text-[13px] font-bold ${s.trust > 90 ? 'text-success' : 'text-warning-foreground'}`}>{s.trust}%</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function SmartAlertsWidget() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease }}
      className="card-premium overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[14px] font-semibold">Smart Alert Center</h3>
            <p className="text-[11px] text-muted-foreground">5 active · 2 high priority</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-destructive pulse-dot" />Live
        </span>
      </div>
      <ul className="divide-y divide-border/30">
        {ALERTS.map((a, idx) => {
          const sevStyle = a.sev === "high"
            ? "border-l-destructive bg-destructive/4"
            : a.sev === "med"
              ? "border-l-warning bg-warning/4"
              : "border-l-success/40 bg-secondary/30";
          const dotColor = a.sev === "high" ? "bg-destructive" : a.sev === "med" ? "bg-warning" : "bg-success";
          const tag = a.sev === "high" ? "HIGH" : a.sev === "med" ? "MED" : "LOW";
          const tagCls = a.sev === "high" ? "bg-destructive/10 text-destructive" : a.sev === "med" ? "bg-warning/10 text-warning-foreground" : "bg-success/10 text-success";
          return (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05, duration: 0.4, ease }}
              className={`flex items-start gap-3 border-l-2 px-5 py-3.5 transition-colors hover:bg-accent/10 ${sevStyle}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium leading-snug">{a.t}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${tagCls}`}>{tag}</span>
                  <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />{a.time}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">{a.id}</span>
                </div>
              </div>
              <button className="mt-1 shrink-0 rounded-lg border border-border/50 bg-card px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent">
                Review
              </button>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}

function VerificationLogsWidget({ liveLog }: { liveLog: typeof VERIF_LOGS }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1, duration: 0.5, ease }}
      className="card-premium overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Lock className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[14px] font-semibold">Verification Logs</h3>
            <p className="text-[11px] text-muted-foreground">Blockchain ledger · updates live</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success pulse-dot" />Connected
        </span>
      </div>

      <ul className="divide-y divide-border/30 max-h-[322px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {liveLog.map((log, i) => {
            const r = RESULT_STYLE[log.result as keyof typeof RESULT_STYLE];
            return (
              <motion.li
                key={`${log.batch}-${log.time}-${i}`}
                initial={{ opacity: 0, y: -12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease }}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/10"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium truncate">{log.med}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${r.cls}`}>{r.label}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{log.batch}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{log.by}</span>
                  </div>
                </div>
                <span className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />{log.time}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between bg-secondary/10">
        <span className="text-[11px] text-muted-foreground font-mono">Last Tx: 0x8f3a...d4aa</span>
        <button className="flex items-center gap-1 text-[12px] text-primary hover:underline font-medium">
          Full blockchain explorer <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function CustomerTrustWidget({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease }}
      className={`card-premium p-6 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-warning fill-warning" /> Customer Trust & Reviews</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Direct patient feedback from verifications</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[20px] font-bold">4.9</span>
          <span className="text-[12px] font-medium text-muted-foreground">/ 5.0</span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {REVIEWS.map((r, idx) => (
          <motion.div
            key={r.n}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.07, duration: 0.4, ease }}
            className="rounded-xl border border-border/40 bg-secondary/25 p-4 transition-colors hover:bg-secondary/40"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-[11px] font-bold text-primary-foreground shadow-elegant shrink-0">
                {r.n.split(" ").map(p => p[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="text-[13px] font-semibold">{r.n}</p>
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: r.r }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-warning text-warning" />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">"{r.t}"</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function PerformanceInsightsWidget() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1, duration: 0.5, ease }}
      className="card-premium p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Performance Insights</h3>
      </div>
      <div className="space-y-4">
        {[
          { icon: CheckCircle2, label: "Verification Accuracy", value: "99.8%", tone: "success" as const },
          { icon: Clock, label: "Avg System Latency", value: "0.6s", tone: "success" as const },
          { icon: Activity, label: "Blockchain Sync Uptime", value: "99.9%", tone: "success" as const },
          { icon: ShieldCheck, label: "Compliance Score", value: "96/100", tone: "primary" as const },
          { icon: Users, label: "Daily Walk-in Users", value: "+12%", tone: "primary" as const },
        ].map(m => <MetricRow key={m.label} {...m} />)}
      </div>
    </motion.div>
  );
}
