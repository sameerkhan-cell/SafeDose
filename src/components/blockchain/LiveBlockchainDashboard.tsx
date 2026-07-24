import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, ShieldCheck, AlertTriangle, Zap, Cpu,
  Globe2, Lock, XCircle, Loader2, RefreshCw,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis,
} from "recharts";
import { ease } from "@/lib/motion";

interface DashboardData {
  stats: {
    totalScans: number;
    genuine: number;
    suspicious: number;
    fake: number;
    scanRate: number;
    networkHealthy: boolean;
    integrityScore: number;
  };
  blockchain: {
    blockNumber: number;
    confirmedJobs: number;
    pendingJobs: number;
    failedJobs: number;
    signerAddress: string | null;
  };
  chartData: Array<{ t: number; genuine: number; flagged: number; time: string }>;
  feed: Array<{ id: string; msg: string; loc: string; type: "ok" | "warn" | "bad"; ago: string }>;
  nodes: Array<{ label: string; ok: boolean }>;
}

export function LiveBlockchainDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/blockchain/dashboard");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error || "Failed to load dashboard data");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border/40 bg-card/60">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1a56db]" />
          <p className="text-[13px] font-medium text-muted-foreground">Loading live blockchain telemetry…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="text-sm font-bold text-red-500">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    totalScans: 0,
    genuine: 0,
    suspicious: 0,
    fake: 0,
    scanRate: 0,
    networkHealthy: false,
    integrityScore: 100,
  };

  const bc = data?.blockchain || {
    blockNumber: 0,
    confirmedJobs: 0,
    pendingJobs: 0,
    failedJobs: 0,
    signerAddress: null,
  };

  const STATS = [
    { icon: Activity,      label: "Total Scans",    value: stats.totalScans.toLocaleString(), delta: "Live",  color: "#1a56db", glow: "#1a56db33" },
    { icon: ShieldCheck,   label: "Genuine",        value: stats.genuine.toLocaleString(),    delta: `${stats.totalScans > 0 ? ((stats.genuine / stats.totalScans) * 100).toFixed(0) : 100}%`,  color: "#16a34a", glow: "#16a34a33" },
    { icon: AlertTriangle, label: "Suspicious",     value: stats.suspicious.toLocaleString(), delta: `${stats.suspicious} flagged`,  color: "#f59e0b", glow: "#f59e0b33" },
    { icon: XCircle,       label: "Counterfeits",   value: stats.fake.toLocaleString(),       delta: `${stats.fake} blocked`, color: "#dc2626", glow: "#dc262633" },
  ];

  const nodes = data?.nodes || [];
  const feed = data?.feed || [];
  const chartData = data?.chartData || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1a56db]/10 border border-[#1a56db]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#1a56db] mb-2">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-[#1a56db]"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            Live Blockchain Dashboard
          </span>
          <h2 className="text-2xl font-bold tracking-tight">Command Center</h2>
          <p className="mt-1 text-[13px] font-medium text-foreground/80">
            Real-time MediVerify blockchain network · Block #{bc.blockNumber > 0 ? bc.blockNumber.toLocaleString() : "Connecting..."}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1">
          <div
            className="flex items-center gap-2 rounded-xl border px-4 py-2"
            style={{
              borderColor: stats.networkHealthy ? "#16a34a44" : "#f59e0b44",
              background: stats.networkHealthy ? "#16a34a0d" : "#f59e0b0d",
            }}
          >
            <motion.div
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: stats.networkHealthy ? "#16a34a" : "#f59e0b" }}
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-[12px] font-bold" style={{ color: stats.networkHealthy ? "#16a34a" : "#f59e0b" }}>
              Network: {stats.networkHealthy ? "HEALTHY (POLYGON AMOY)" : "CONNECTING..."}
            </span>
          </div>
          <span className="text-[11px] font-medium text-foreground/80">
            Integrity: <strong className="text-[#16a34a]">{stats.integrityScore}%</strong> · {bc.confirmedJobs} On-Chain Txs
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.5, ease }}
              className="relative overflow-hidden rounded-2xl border p-5"
              style={{
                borderColor: `${s.color}33`,
                background: `${s.color}08`,
                boxShadow: `0 0 30px 0 ${s.glow}`,
              }}
            >
              <div
                className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20"
                style={{ background: `radial-gradient(circle, ${s.color}, transparent 70%)` }}
              />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl border"
                    style={{ borderColor: `${s.color}44`, background: `${s.color}15` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: s.color }} />
                  </div>
                  <span
                    className="text-[10px] font-bold rounded-full px-2 py-0.5"
                    style={{ color: s.color, background: `${s.color}15` }}
                  >
                    {s.delta}
                  </span>
                </div>
                <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="mt-1 text-[12px] text-foreground/80 font-bold">{s.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Chart + Feed */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
          className="lg:col-span-3 rounded-2xl border border-border/40 bg-card/60 p-6 backdrop-blur-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold">Verification Stream</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Live scan analytics · recent events</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-medium">
              {[{ color: "#16a34a", label: "Genuine" }, { color: "#dc2626", label: "Flagged" }].map(l => (
                <span key={l.label} className="flex items-center gap-1.5 text-foreground/80">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <div className="h-52">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="df" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "var(--foreground)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                    }}
                  />
                  <Area type="monotone" dataKey="genuine" stroke="#16a34a" strokeWidth={2.5} fill="url(#dg)" name="Genuine" />
                  <Area type="monotone" dataKey="flagged" stroke="#dc2626" strokeWidth={2} fill="url(#df)" name="Flagged" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No verification scans recorded yet. Scan a medicine QR code to populate chart.
              </div>
            )}
          </div>
        </motion.div>

        {/* Live Feed */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5, ease }}
          className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/60 overflow-hidden backdrop-blur-sm"
        >
          <div className="border-b border-border/40 px-5 py-4 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Live Activity</h3>
            <motion.span
              className="flex items-center gap-1.5 text-[10px] text-[#16a34a] font-bold"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
              LIVE
            </motion.span>
          </div>
          <ul className="divide-y divide-border/20 overflow-auto" style={{ maxHeight: 260 }}>
            {feed.length > 0 ? (
              <AnimatePresence initial={false}>
                {feed.map(f => (
                  <motion.li
                    key={f.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease }}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: f.type === "ok" ? "#16a34a" : f.type === "warn" ? "#f59e0b" : "#dc2626",
                        boxShadow: `0 0 6px ${f.type === "ok" ? "#16a34a" : f.type === "warn" ? "#f59e0b" : "#dc2626"}`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[12px] font-bold text-foreground/90">{f.msg}</p>
                      <p className="flex items-center gap-1 text-[10px] font-medium text-foreground/70">
                        <Globe2 className="h-3 w-3" />{f.loc} · {f.ago}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            ) : (
              <li className="p-6 text-center text-xs text-muted-foreground">
                No recent activity feed items found.
              </li>
            )}
          </ul>
        </motion.div>
      </div>

      {/* Network Node Status */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease }}
        className="rounded-2xl border border-border/40 bg-card/60 p-5 backdrop-blur-sm"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#1a56db]" /> Network Node Status
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {nodes.filter(n => n.ok).length}/{nodes.length} nodes online
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {nodes.map((node, i) => (
            <motion.div
              key={node.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4, ease }}
              className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
              style={{
                borderColor: node.ok ? "#16a34a33" : "#dc262633",
                background: node.ok ? "#16a34a08" : "#dc262608",
              }}
            >
              <motion.span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: node.ok ? "#16a34a" : "#dc2626" }}
                animate={node.ok ? { opacity: [1, 0.4, 1] } : { opacity: [1, 0.2, 1] }}
                transition={{ duration: node.ok ? 2 : 0.6, repeat: Infinity }}
              />
              <span className="text-[11px] font-medium leading-tight truncate">{node.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
