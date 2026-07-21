import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Package, QrCode, Activity, Plus, Download, AlertTriangle, CheckCircle2, Link2, Clock, ArrowRight, ChevronDown, RefreshCw, Globe2, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { DASH_NAV } from "@/config/nav";
import { ease } from "@/lib/motion";
import { DashShell } from "@/components/dashboard/DashShell";
import { StatCard, MetricRow } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import {
  XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  BatchRegistrationWidget, QRManagementWidget,
} from "@/components/dashboard/manufacturer-widgets";
import { ScanLocationsMap } from "@/components/maps/ScanLocationsMap";
import { DualQRModal } from "@/components/batch-registration/DualQRModal";
import { ExtendBatchModal } from "@/components/batch-registration/ExtendBatchModal";
import { RecallHubWidget } from "@/components/regulatory/RecallHubWidget";

export const Route = createFileRoute("/dashboard/manufacturer")({
  head: () => ({
    meta: [
      { title: "Manufacturer Command Center — MediVerify" },
      { name: "description", content: "Enterprise pharmaceutical intelligence, batch registration, and blockchain medicine control center." },
    ],
  }),
  component: Page,
});

const lineData = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => ({
  m, scans: Math.round(8000 + Math.random() * 6000), genuine: Math.round(7200 + Math.random() * 5000),
}));
const barData = ["Panadol", "Ventolin", "Brufen", "Augmentin", "Risek", "Disprol", "Calpol"].map((n) => ({
  n, v: Math.round(40 + Math.random() * 200),
}));

// Hardcoded mock fallback data removed.

import { useQRStore } from "@/store/qr-store";
import { useEffect } from "react";
import { toast } from "sonner";

function getRelativeTime(dateStr: string): string {
  try {
    const ms = Date.now() - new Date(dateStr).getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return "Just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const day = Math.floor(hr / 24);
    return `${day} days ago`;
  } catch {
    return "";
  }
}

function Page() {
  const { user, isAuthenticated, signOut, isLoading, updateUser } = useAuth();
  const { batches, pills, stats, setBatches } = useQRStore();
  const [dualOpen, setDualOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [widgetVals, setWidgetVals] = useState<{ category: string; boxes: number; pillsPerBox: number } | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Recalled" | "Expired">("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [dbStats, setDbStats] = useState<{
    totalMedicines: number;
    totalBatches: number;
    totalPillsGenerated: number;
    activeBatches: number;
    expiredBatches: number;
    recalledBatches: number;
    totalBoxQRGenerated: number;
    totalPillQRGenerated: number;
    totalPDFExports: number;
    totalZIPExports: number;
    lastExportDate: string | null;
    blockchainJobs?: any[];
  } | null>(null);

  const handleExportCSV = () => {
    if (batches.length === 0) {
      toast.error("No batches to export.");
      return;
    }
    const headers = [
      "Batch Number",
      "Medicine Name",
      "Total Pills",
      "Pills Per Box",
      "Manufacturing Date",
      "Expiry Date",
      "Status",
      "Quantity of Boxes",
      "Blockchain Status",
      "Box QR Code",
    ];
    const rows = batches.map(b => [
      b.batchNumber,
      `"${(b.medicineName || "").replace(/"/g, '""')}"`,
      b.totalPills,
      b.totalPillsPerBox,
      b.manufacturingDate ? new Date(b.manufacturingDate).toLocaleDateString() : "",
      b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : "",
      b.status,
      b.quantityBoxes,
      b.qrGenerationStatus,
      b.boxQrCode,
    ]);
    const csvString = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mediverify_batches_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "manufacturer") return;

    const getToken = () => {
      try {
        const session = localStorage.getItem("mediverify_session") || sessionStorage.getItem("mediverify_session");
        return session ? JSON.parse(session).token : "";
      } catch { return ""; }
    };

    const headers = { "Authorization": `Bearer ${getToken()}` };

    // Sync verification status dynamically
    const syncUser = () => {
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

    // Load real batches from DB
    fetch("/api/manufacturer/batches", { headers })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setBatches(res.data.map((b: any) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            medicineName: b.medicine.name,
            totalPills: b.totalPillsGenerated,
            totalPillsPerBox: b.pillsPerBox,
            manufacturingDate: b.manufacturingDate,
            expiryDate: b.expiryDate,
            status: b.status, // Use decorated status from backend
            productCategory: b.category,
            manufacturerCode: b.medicine.manufacturer?.companyCode || "MFG",
            drapLicense: b.medicine.manufacturer?.licenseNumber || "DRAP-LIC-001",
            txHash: b.txHash || "0x" + "0".repeat(40),
            createdAt: b.createdAt,
            qrGenerationStatus: b.blockchainStatus?.toLowerCase() || "completed",
            boxQrCode: b.boxQRCode || `BOX-${b.batchNumber}-MFG`,
            quantityBoxes: b.quantityBoxes,
            boxesPerCarton: b.boxesPerCarton || 10,
          })));
        }
      })
      .catch(err => console.error("Failed to sync batches:", err));

    // Load real dashboard stats
    fetch("/api/manufacturer/stats", { headers })
      .then(res => res.json())
      .then(res => { if (res.success) setDbStats(res.data); })
      .catch(err => console.error("Failed to load stats:", err));

    return () => clearInterval(syncInterval);
  }, [isAuthenticated, user?.role, setBatches, signOut]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/auth/login" />;
  if (user?.role !== "manufacturer") return <Navigate to="/auth/login" />;

  // Transform real batches for the table
  const displayBatches = batches.map(b => ({
    id: b.batchNumber,
    med: b.medicineName,
    qty: b.totalPills,
    status: b.status,
    scans: 0, // Placeholder as per prototype, we'll implement scan tracking later
    flagged: 0,
    expiry: b.expiryDate,
    mfgCode: b.manufacturerCode
  }));


  const filteredBatches = statusFilter === "All"
    ? displayBatches
    : displayBatches.filter(b => {
        const s = (b.status ?? "").toLowerCase();
        if (statusFilter === "Active") return s === "active";
        if (statusFilter === "Recalled") return s === "recalled";
        if (statusFilter === "Expired") return s === "expired";
        return true;
      });

  return (
    <DashShell
      title="Manufacturer Command Center"
      subtitle={`${user?.fullName || "Your Company"} Pakistan · ${user?.isVerified ? "Verified Manufacturer" : "Unverified Manufacturer"}`}
      badge="Enterprise"
      nav={DASH_NAV}
      actions={
        <div className="flex gap-2 items-center">
          {/* Status filter dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-border/60 text-[12px] font-medium gap-1.5"
              onClick={() => setFilterOpen(v => !v)}
            >
              {statusFilter === "All" ? "Filter" : statusFilter}
              <ChevronDown className="h-3 w-3" />
            </Button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[130px] rounded-xl border border-border/60 bg-card shadow-card-hover overflow-hidden">
                {(["All", "Active", "Recalled", "Expired"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setFilterOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-[12px] font-medium hover:bg-accent transition-colors ${
                      statusFilter === s ? "text-primary bg-primary/5" : "text-foreground"
                    }`}
                  >
                    {s === "All" ? "All Statuses" : s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" onClick={() => setDualOpen(true)} className="rounded-full bg-gradient-primary shadow-elegant text-[12px] font-medium gap-1.5 transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02]">
            <Plus className="h-3.5 w-3.5" /> New Batch
          </Button>
        </div>
      }
    >
      {/* 1. Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDualOpen(true)} className="flex-1 sm:flex-none rounded-full bg-gradient-primary shadow-elegant text-[13px] font-medium transition-all duration-300 hover:shadow-card-hover hover:scale-[1.02]">
            <Plus className="mr-2 h-4 w-4" /> Register Batch
          </Button>
          <Button variant="outline" onClick={() => setDualOpen(true)} className="flex-1 sm:flex-none rounded-full text-[13px] font-medium border-border/60 hover:border-primary/30">
            <QrCode className="mr-2 h-4 w-4" /> Dual QR
          </Button>
          <Button variant="outline" onClick={() => setExtendOpen(true)} className="w-full sm:w-auto rounded-full text-[13px] font-medium border-border/60 hover:bg-success/5 hover:text-success hover:border-success/30 transition-all">
            <Plus className="mr-2 h-4 w-4" /> Generate More Pills
          </Button>
        </div>
        <Button onClick={handleExportCSV} variant="ghost" className="rounded-full text-[13px] font-medium text-muted-foreground self-end sm:self-auto">
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </motion.div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard icon={Package} label="Total Batches" value={dbStats?.totalBatches ?? batches.length ?? 0} delta={12} sparkline={[60, 72, 65, 80, 78, 90, 88, 95]} />
        <StatCard icon={QrCode} label="Total Pills Generated" value={dbStats?.totalPillsGenerated ?? stats.totalGenerated() ?? 0} delta={8} tone="success" sparkline={[50, 60, 55, 70, 80, 75, 90, 95]} />
        <StatCard icon={Activity} label="Active Batches" value={dbStats?.activeBatches ?? batches.length ?? 0} delta={4} sparkline={[40, 55, 48, 62, 70, 58, 75, 80]} />
        <StatCard icon={AlertTriangle} label="Expired / Recalled" value={(dbStats?.expiredBatches ?? 0) + (dbStats?.recalledBatches ?? 0)} delta={-9} tone="destructive" sparkline={[20, 24, 18, 30, 22, 19, 16, 14]} />
      </div>



      {/* 2. Batch Registration & 3. QR Management */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <BatchRegistrationWidget
          onRegister={(vals) => { setWidgetVals(vals); setDualOpen(true); }}
          onExtend={() => setExtendOpen(true)}
        />
        <QRManagementWidget onExtend={() => setExtendOpen(true)} />
      </div>

      {/* 6. Supply Chain + 7. Verification Analytics */}
      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
          className="card-premium p-6 lg:col-span-3"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold">Verification Trends</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Total scans vs genuine confirmations · 12 months</p>
            </div>
            <span className="rounded-full bg-success/8 px-2.5 py-1 text-[11px] font-semibold text-success">+24% YoY</span>
          </div>
          <div className="h-60">
            <ResponsiveContainer>
              <AreaChart data={lineData}>
                <defs>
                  <linearGradient id="gScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.50 0.20 265)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="oklch(0.50 0.20 265)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGenuine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.60 0.18 150)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="oklch(0.60 0.18 150)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.925 0.008 255 / 0.5)" />
                <XAxis dataKey="m" stroke="oklch(0.48 0.015 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.48 0.015 260)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-soft)", fontSize: 12 }} />
                <Area type="monotone" dataKey="scans" stroke="oklch(0.50 0.20 265)" strokeWidth={2.5} fill="url(#gScans)" name="Total Scans" />
                <Area type="monotone" dataKey="genuine" stroke="oklch(0.60 0.18 150)" strokeWidth={2} fill="url(#gGenuine)" name="Genuine" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex gap-5">
            {[{ color: "bg-primary", label: "Total scans" }, { color: "bg-success", label: "Genuine" }].map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-full ${l.color}`} />{l.label}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08, duration: 0.5, ease }}
          className="card-premium p-6 lg:col-span-2"
        >
          <div className="mb-5">
            <h3 className="text-[14px] font-semibold">Top Medicines by Scans</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">This month · K units</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={barData} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" stroke="oklch(0.48 0.015 260)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="n" stroke="oklch(0.48 0.015 260)" fontSize={11} tickLine={false} axisLine={false} width={65} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="v" fill="oklch(0.60 0.18 150)" radius={[0, 6, 6, 0]} name="Scans (K)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Supply Chain Pipeline */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ScanLocationsMap endpoint="/api/manufacturer/scan-locations" title="Scan Locations — Your Products" />
        <RecallHubWidget />
      </div>

      {/* 4. Batch Table & 5. Blockchain Timeline */}
      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
          className="card-premium overflow-hidden lg:col-span-3"
        >
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
            <div>
              <h3 className="text-[14px] font-semibold">Batch Tracking System</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Click a row to view full blockchain trail</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="rounded-full text-[11px] gap-1"><RefreshCw className="h-3 w-3" /> Refresh</Button>
              <Button variant="ghost" size="sm" className="rounded-full text-[12px]">View all</Button>
            </div>
          </div>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-[13px]">
              <thead className="bg-secondary/40 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Batch ID</th>
                  <th className="px-5 py-3 text-left">Medicine</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  <th className="px-5 py-3 text-right">Scans</th>
                  <th className="px-5 py-3 text-center">Alerts</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground text-[12px]">
                      {batches.length === 0 
                        ? "No batches registered yet — create your first batch" 
                        : "No batches match the selected status filter."}
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b, i) => (
                    <motion.tr
                      key={b.id}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.04, duration: 0.4, ease }}
                      className="group border-t border-border/30 transition-colors duration-200 hover:bg-accent/20 cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-mono text-[12px] font-semibold text-primary">{b.id}</td>
                      <td className="px-5 py-3.5 font-medium">{b.med}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{b.qty.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-medium">{b.scans.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-center">
                        {b.flagged > 0
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/8 px-2 py-0.5 text-[11px] font-semibold text-destructive">⚠ {b.flagged}</span>
                          : <span className="text-success text-[11px] font-semibold">✓ Clean</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${b.status === "Active" ? "bg-success/8 text-success" : "bg-destructive/8 text-destructive"}`}>
                          {b.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile view cards for table data */}
          <div className="md:hidden divide-y divide-border/30">
            {filteredBatches.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-[12px]">
                {batches.length === 0 
                  ? "No batches registered yet — create your first batch" 
                  : "No batches match the selected status filter."}
              </div>
            ) : (
              filteredBatches.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04, duration: 0.4, ease }}
                  className="p-4 space-y-3 active:bg-accent/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold text-primary">{b.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.status === "Active" ? "bg-success/8 text-success" : "bg-destructive/8 text-destructive"}`}>
                      {b.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold">{b.med}</p>
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-tight opacity-60">Qty</p>
                        <p className="font-semibold text-foreground">{b.qty.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-tight opacity-60">Scans</p>
                        <p className="font-semibold text-foreground">{b.scans.toLocaleString()}</p>
                      </div>
                    </div>
                    <div>
                      {b.flagged > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/8 px-2 py-0.5 text-[10px] font-bold text-destructive">⚠ {b.flagged} Alerts</span>
                      ) : (
                        <span className="text-success text-[10px] font-bold">✓ Clean</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-[12px] text-muted-foreground">
            <span>Showing {filteredBatches.length} of {displayBatches.length || batches.length || 0} batches{statusFilter !== "All" ? ` · ${statusFilter} only` : ""}</span>
            <button className="flex items-center gap-1 text-primary hover:underline font-medium">View all <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
        </motion.div>

        {/* Blockchain activity timeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5, ease }}
          className="card-premium p-6 lg:col-span-2"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold">Blockchain Activity</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Live ledger events</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success pulse-dot" />Live
            </span>
          </div>
          {(!dbStats?.blockchainJobs || dbStats.blockchainJobs.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-[12px]">No blockchain activity yet</p>
            </div>
          ) : (() => {
            const blockchainJobs = dbStats?.blockchainJobs ?? [];
            return (
            <ol className="space-y-0">
              {blockchainJobs.map((ev, i) => {
                const isBatch = ev.entityType === "BATCH";
                const isPill = ev.entityType === "PILL";

                let action = "";
                let tone = "primary";
                if (isBatch) {
                  action = `Batch ${ev.entityRef || ""} registered`;
                  tone = "success";
                } else if (isPill) {
                  action = `Pill ${ev.entityRef || ""} anchored`;
                  tone = "primary";
                } else {
                  action = `Verification ${ev.entityRef || ""} anchored`;
                  tone = "success";
                }

                const dotColor = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "destructive" ? "bg-destructive" : "bg-primary";
                const badgeCls = tone === "success" ? "bg-success/8 text-success" : tone === "warning" ? "bg-warning/8 text-warning-foreground" : tone === "destructive" ? "bg-destructive/8 text-destructive" : "bg-primary/8 text-primary";
                const shortHash = ev.txHash ? `${ev.txHash.slice(0, 6)}…${ev.txHash.slice(-4)}` : "No hash";

                return (
                  <motion.li
                    key={ev.id || i}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07, duration: 0.4, ease }}
                    className="relative flex gap-3.5 pb-5 last:pb-0"
                  >
                    {i < blockchainJobs.length - 1 && (
                      <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border/50" />
                    )}
                    <div className={`relative z-10 mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full ${dotColor} ring-4 ring-card flex items-center justify-center`}>
                      <Link2 className="h-2.5 w-2.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium leading-snug">{action}</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {ev.txHash ? (
                          <a
                            href={`https://amoy.polygonscan.com/tx/${ev.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold hover:underline ${badgeCls}`}
                          >
                            {shortHash}
                          </a>
                        ) : (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${badgeCls}`}>{shortHash}</span>
                        )}
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />{getRelativeTime(ev.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
            );
          })()}
        </motion.div>
      </div>

      {/* ⚡ Dual QR Architecture Modal */}
      <DualQRModal open={dualOpen} onClose={() => { setDualOpen(false); setWidgetVals(undefined); }} initialValues={widgetVals} />

      {/* ➕ Extend Batch Modal (Generate More Pills) */}
      <ExtendBatchModal open={extendOpen} onClose={() => setExtendOpen(false)} />
    </DashShell>
  );
}
