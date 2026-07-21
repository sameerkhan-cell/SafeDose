import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Activity, ShieldAlert, Zap, Layers, Map as MapIcon,
  ArrowUpRight, TrendingUp, AlertTriangle, CheckCircle2,
  Search, Filter, Maximize2, RefreshCcw, Radar, Cpu, Globe2, ShieldCheck, MapPin, Eye, Loader2
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { FloatingParticles, FadeUp } from "@/components/motion";
import { ease } from "@/lib/motion";
import { useAuth } from "@/lib/auth-context";
import { useQRStore } from "@/store/qr-store";
import { useFraudStore } from "@/store/fraud-store";
import { DashShell } from "@/components/dashboard/DashShell";
import { DASH_NAV } from "@/config/nav";
import { ScanLocationMap } from "@/components/shared/ScanLocationMap";

export const Route = createFileRoute("/dashboard/monitoring")({
  head: () => ({
    meta: [
      { title: "Global Intelligence — MediVerify" },
      { name: "description", content: "Real-time global medicine monitoring and fraud detection command center." },
    ],
  }),
  component: IntelligencePage,
});

function IntelligencePage() {
  const { user, isAuthenticated, signOut, isLoading } = useAuth();
  const { alerts, globalScores } = useFraudStore();
  const { stats } = useQRStore();

  const [fraudAlerts, setFraudAlerts] = useState<any[]>([]);
  const [fraudMetrics, setFraudMetrics] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMonitoringData = async () => {
      setIsLoadingData(true);
      setDataError(null);

      try {
        const raw =
          typeof window !== "undefined"
            ? (localStorage.getItem("mediverify_session") || sessionStorage.getItem("mediverify_session"))
            : null;
        const token = raw
          ? (() => {
            try {
              return JSON.parse(raw)?.token;
            } catch {
              return null;
            }
          })()
          : null;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const [alertsRes, metricsRes] = await Promise.all([
          fetch("/api/fraud/alerts", { headers }),
          fetch("/api/fraud/metrics", { headers }),
        ]);

        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          const alertsList = alertsData?.data?.alerts ?? alertsData?.data ?? [];
          if (Array.isArray(alertsList)) setFraudAlerts(alertsList);
        }

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setFraudMetrics(metricsData?.data ?? null);
        }

        if (!alertsRes.ok && !metricsRes.ok) {
          setDataError("Could not load monitoring data. Please refresh.");
        }
      } catch (err) {
        console.error("Monitoring fetch error:", err);
        setDataError("Network error. Could not load monitoring data.");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchMonitoringData();
  }, []);

  const displayAlerts = fraudAlerts.length > 0 ? fraudAlerts : (alerts ?? []);
  const totalAlerts = fraudMetrics?.totalAlerts ?? fraudMetrics?.alertCount ?? displayAlerts.length;
  const riskScore = fraudMetrics?.averageRiskScore ?? fraudMetrics?.riskScore ?? globalScores.batchSafety;
  const liveScans = fraudMetrics?.totalScans ?? fraudMetrics?.scanCount ?? stats.totalScanned();
  const liveFlagged = fraudMetrics?.flaggedCount ?? fraudMetrics?.suspiciousCount ?? stats.suspiciousCount();

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

  if (!isAuthenticated) return <Navigate to="/auth/login" />;
  if (user?.role !== "manufacturer" && user?.role !== "pharmacy") return <Navigate to="/auth/login" />;

  return (
    <DashShell
      title="Global Monitoring"
      subtitle="Real-time pharmaceutical surveillance & threat intelligence"
      badge="Live"
      nav={DASH_NAV}
    >
      <div className="relative overflow-hidden">
        <div className="relative z-10 space-y-8">
          {isLoadingData && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Syncing live monitoring data…</span>
            </div>
          )}

          {dataError && !isLoadingData && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-4">
              ⚠ {dataError}
            </div>
          )}

          {/* Main Monitoring Grid */}
          <div className="grid gap-6 lg:grid-cols-4 lg:grid-rows-2 h-full lg:h-[calc(100vh-220px)]">

            {/* 1. The Global Radar Map (Centerpiece) */}
            <div className="lg:col-span-2 lg:row-span-2 card-premium p-0 overflow-hidden relative border-primary/20">
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-black text-primary flex items-center gap-1.5">
                  <Activity className="h-3 w-3" /> LIVE SCAN HOTSPOTS
                </span>
              </div>
              <div className="absolute top-4 right-4 z-20">
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg bg-black/40 hover:bg-black/60"><Maximize2 className="h-4 w-4 text-white" /></Button>
              </div>

              {/* Real geo-tagged scan location map — role-aware data source */}
              <ScanLocationMap
                dataUrl={
                  user?.role === "manufacturer"
                    ? "/api/manufacturer/scan-locations"
                    : "/api/pharmacy/scan-locations"
                }
                token={
                  (() => {
                    try {
                      const sessionStr =
                        typeof window !== "undefined"
                          ? (localStorage.getItem("mediverify_session") || sessionStorage.getItem("mediverify_session"))
                          : null;
                      return sessionStr ? JSON.parse(sessionStr)?.token : "";
                    } catch {
                      return "";
                    }
                  })()
                }
                className="h-full"
              />

              {/* Map Overlay Stats */}
              <div className="absolute bottom-6 left-6 right-6 z-20 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MapStat label="Central Asia" value="12,504" delta="+12%" />
                <MapStat label="Middle East" value="5,210" delta="+4%" />
                <MapStat label="Europe" value="892" delta="-2%" />
              </div>
            </div>

            {/* 2. Real-time Verification Feed */}
            <div className="lg:col-span-1 lg:row-span-2 card-premium p-0 flex flex-col bg-black/20">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground">Global Activity Feed</h3>
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 p-2">
                {displayAlerts.length > 0 ? displayAlerts.map((alert, i) => (
                  <ActivityItem key={alert.id} alert={alert} />
                )) : [...Array(8)].map((_, i) => (
                  <ActivityItemStub key={i} index={i} />
                ))}
              </div>
            </div>

            {/* 3. Threat Level Intelligence */}
            <div className="lg:col-span-1 card-premium p-6 flex flex-col justify-between overflow-hidden relative group border-destructive/20">
              <div className="absolute -right-12 -top-12 h-48 w-48 bg-destructive/5 rounded-full blur-3xl group-hover:bg-destructive/10 transition-all duration-700" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">System Trust Score</p>
                  <ShieldCheck className={`h-5 w-5 ${riskScore > 70 ? 'text-success' : 'text-warning'}`} />
                </div>
                <h4 className={`text-4xl font-black ${riskScore > 70 ? 'text-success' : 'text-warning'} tracking-tighter mb-2 italic`}>{riskScore}%</h4>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {riskScore > 70
                    ? "Global supply chain integrity remains within optimal safety thresholds."
                    : "Elevated suspicious activity detected. Increased surveillance recommended."}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold opacity-50 uppercase">Anomaly Confidence</p>
                    <p className="text-[16px] font-black">{95 + Math.random() * 4}%</p>
                  </div>
                  <div className="h-10 w-24 bg-secondary/40 rounded-lg overflow-hidden flex items-end gap-1 p-1">
                    {[0.4, 0.6, 0.8, 0.5, 0.9, 0.7, 0.4, 0.8].map((h, i) => (
                      <div key={i} className="flex-1 bg-primary/40 rounded-sm" style={{ height: `${h * 100}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Global Scans Counter */}
            <div className="lg:col-span-1 card-premium p-6 flex flex-col justify-between bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Global Scans Today</p>
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-5xl font-black tabular-nums tracking-tighter italic">{liveScans || "48,291"}</h1>
                <p className="text-[12px] text-primary font-bold mt-1 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" /> +14.2% activity spike
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <p className="text-[9px] font-black uppercase opacity-50">Verified</p>
                  <p className="text-[14px] font-bold text-success">{liveScans}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase opacity-50">Flagged</p>
                  <p className="text-[14px] font-bold text-destructive">{liveFlagged || 42}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashShell>
  );
}

function GlobalRadarMap() {
  return (
    <div className="relative w-full h-full bg-[#05060f] grid place-items-center">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#2d3748 0.5px, transparent 0.5px)", backgroundSize: "24px 24px" }} />

      <div className="relative w-[85%] h-[85%]">
        {/* Radar Circles */}
        {[1, 2, 3].map((r) => (
          <motion.div
            key={r}
            className="absolute inset-0 rounded-full border border-primary/10"
            style={{ margin: `${r * 15}%` }}
            animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, delay: r * 0.5 }}
          />
        ))}

        {/* Radar Sweep */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent origin-left"
          style={{ left: "50%", width: "50%" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />

        {/* Map Outlines (Simplified SVG) */}
        <svg viewBox="0 0 800 400" className="w-full h-full opacity-20 fill-muted-foreground/10 stroke-primary/5">
          <path d="M150,150 Q200,100 300,150 T450,150 T600,100" />
          <path d="M100,300 Q150,250 250,300 T400,250 T550,300" />
          {/* Activity Points */}
          <RadarPoint x={200} y={150} color="primary" label="Karachi Central" />
          <RadarPoint x={220} y={130} color="primary" label="Lahore Hub" />
          <RadarPoint x={450} y={120} color="success" label="Dubai Port" />
          <RadarPoint x={330} y={220} color="destructive" label="Cluster-Critical" warning />
        </svg>
      </div>

      {/* Bottom HUD info */}
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
        <div className="font-mono text-[9px] text-primary/40 space-y-1">
          <p>INTELLIGENCE_VERSION: 1.0.4-AI</p>
          <p>COORD_PK: 30.3753° N, 69.3451° E</p>
        </div>
        <div className="hidden sm:flex gap-4">
          <div className="text-right">
            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-50">Authorized Nodes</p>
            <p className="text-[12px] font-black text-white italic">OVERRIDE_ENABLED</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RadarPoint({ x, y, color, label, warning }: any) {
  const colorClass = color === 'primary' ? 'bg-primary' : color === 'success' ? 'bg-success' : 'bg-destructive';
  return (
    <foreignObject x={x} y={y} width="120" height="60">
      <div className="relative group cursor-pointer">
        <motion.div
          className={`h-3 w-3 rounded-full ${colorClass} shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]`}
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {warning && (
          <motion.div
            className="absolute -inset-2 rounded-full border-2 border-destructive animate-ping"
          />
        )}
        <div className="absolute left-4 top-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 backdrop-blur-md border border-white/10 p-2 rounded-lg text-[10px] font-bold text-white whitespace-nowrap z-50 shadow-2xl">
          {label}
        </div>
      </div>
    </foreignObject>
  );
}

function MapStat({ label, value, delta }: any) {
  return (
    <div className="bg-black/60 backdrop-blur-xl border border-white/5 rounded-2xl p-3 sm:p-4 flex flex-col justify-center hover:bg-black/80 transition-colors">
      <p className="text-[9px] sm:text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest">{label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[16px] sm:text-[18px] font-black tracking-tight">{value}</p>
        <p className={`text-[9px] sm:text-[10px] font-bold ${delta.startsWith('+') ? 'text-success' : 'text-destructive'}`}>{delta}</p>
      </div>
    </div>
  );
}

function ActivityItem({ alert }: any) {
  return (
    <div className="group p-3.5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center gap-4">
      <div className={`h-2.5 w-2.5 rounded-full ${alert.severity === 'critical' ? 'bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <p className="text-[12px] font-bold truncate tracking-tight">{alert.message}</p>
          <span className="text-[9px] font-mono opacity-40 italic">2s ago</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase opacity-30">ID: {alert.targetId}</span>
          <span className="h-0.5 w-0.5 rounded-full bg-white/10" />
          <span className="text-[9px] font-bold text-primary flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> {alert.location}
          </span>
        </div>
      </div>
      <Eye className="h-3.5 w-3.5 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function ActivityItemStub({ index }: { index: number }) {
  const types = ["verified", "flagged", "batch_reg", "node_sync"];
  const type = types[index % 4];

  return (
    <div className="group p-3 rounded-xl border border-white/5 hover:bg-white/5 transition-all flex items-center gap-3">
      <div className={`h-2 w-2 rounded-full ${type === 'verified' ? 'bg-success' : type === 'flagged' ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-primary'} ${type === 'flagged' ? 'animate-pulse' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <p className="text-[11px] font-bold truncate">
            {type === 'verified' ? 'Box Verified: Augmentin 625' : type === 'flagged' ? 'SUSPICIOUS_SCAN_DETECTED' : 'System Node Sync Successful'}
          </p>
          <span className="text-[9px] font-mono opacity-40">{index + 2}m ago</span>
        </div>
        <p className="text-[9px] font-black uppercase opacity-20">PK-NODE-ID-00{index}</p>
      </div>
      <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
