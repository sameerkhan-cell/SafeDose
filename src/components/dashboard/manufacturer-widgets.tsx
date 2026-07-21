import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode, AlertTriangle, CheckCircle2, Clock, ArrowRight, Globe2,
  BrainCircuit, ShieldCheck, ShieldAlert, Truck, Map, FileText,
  Package, Link2, Bell, TrendingUp, Users, BarChart3, XCircle, PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ease } from "@/lib/motion";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, CartesianGrid,
} from "recharts";

/* ── Shared animation wrapper ── */
function Card({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, ease }}
      className={`card-premium ${className}`}
    >{children}</motion.div>
  );
}

/* ── 2. Medicine Batch Registration (Dual QR Architecture) ── */
export function BatchRegistrationWidget({
  onRegister,
  onExtend,
}: {
  onRegister?: (vals: { category: string; boxes: number; pillsPerBox: number }) => void;
  onExtend?: () => void;
}) {
  const [pillsPerBox, setPillsPerBox] = React.useState(20);
  const [boxes, setBoxes] = React.useState(100);
  const [category, setCategory] = React.useState("Pharmaceutical");
  const total = pillsPerBox * boxes;
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary" />New Batch Registration</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Dual QR Architecture — Box QR + per-pill QR codes</p>
        </div>
        <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold border border-primary/20">⚡ Dual QR</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 block">Product Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-secondary/20 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
          >
            <option>Pharmaceutical</option>
            <option>Vaccine</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 block">Quantity (Boxes)</label>
          <input
            type="number" min={1} value={boxes}
            onChange={e => setBoxes(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-10 w-full rounded-xl border border-border/60 bg-secondary/20 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-success" /> Pills Per Box <span className="text-destructive">*</span>
          </label>
          <input
            type="number" min={1} value={pillsPerBox}
            onChange={e => setPillsPerBox(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-10 w-full rounded-xl border border-success/40 bg-success/5 px-3 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-success/30"
          />
        </div>
      </div>

      {/* Live pill count */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-success/20 bg-success/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-success" />
          <span className="text-[12px] font-medium">Total Pill QRs to generate:</span>
        </div>
        <span className="font-mono text-[16px] font-black text-success tabular-nums">{total.toLocaleString()}</span>
      </div>

      {/* QR format preview */}
      <div className="mt-3 rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">QR Format Preview</p>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
          <div>
            <p className="text-[9px] text-muted-foreground">Box QR</p>
            <p className="font-mono text-[11px] font-bold text-primary">BOX-[BATCH]-[COMPANY]</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">Pill QR (sample)</p>
            <p className="font-mono text-[11px] font-bold text-success">PILL-[BATCH]-001-[COMPANY]</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => onRegister?.({ category, boxes, pillsPerBox })}
            className="rounded-xl bg-gradient-primary shadow-elegant text-[13px] font-medium transition-all hover:scale-[1.02]"
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> Register New Batch
          </Button>
          <Button variant="outline" onClick={onExtend} className="rounded-xl text-[13px] border-border/60 border-success/40 text-success hover:bg-success/5">
            <PlusCircle className="mr-2 h-4 w-4" /> Generate More Pills
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground pl-0.5">Opens the full registration form with these values pre-filled.</p>
      </div>
    </Card>
  );
}

/* ── 3. QR Code Management ── */
import { useQRStore } from "@/store/qr-store";

export function QRManagementWidget({ onExtend }: { onExtend?: () => void }) {
  const { batches, pills, stats } = useQRStore();

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" /> QR Code Management</h3>
        <span className="text-[11px] bg-success/10 text-success px-2 py-0.5 rounded-full font-bold">
          {batches.length} Batches Active
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total Generated", value: stats.totalGenerated().toLocaleString(), icon: QrCode, tone: "text-primary" },
          { label: "Active QR Codes", value: (pills.length - stats.suspiciousCount()).toLocaleString(), icon: CheckCircle2, tone: "text-success" },
          { label: "Flagged / Suspect", value: stats.suspiciousCount().toLocaleString(), icon: AlertTriangle, tone: "text-warning-foreground" },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-secondary/30 border border-border/30 p-4 text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-2 ${s.tone}`} />
            <p className="text-[18px] font-black tabular-nums">{s.value}</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" className="rounded-xl bg-gradient-primary text-[12px]"><QrCode className="mr-1.5 h-3.5 w-3.5" /> Generate Bulk QR</Button>
        <Button size="sm" variant="outline" onClick={onExtend} className="rounded-xl text-[12px] border-success/40 text-success hover:bg-success/5">
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Generate More Pills
        </Button>
      </div>
    </Card>
  );
}

/* ── 6. Supply Chain Monitoring ── */
export function SupplyChainWidget() {
  const steps = [
    { label: "Manufacturing", loc: "Karachi Plant", status: "complete", color: "#16a34a" },
    { label: "QC Inspection", loc: "QC Lab #4", status: "complete", color: "#16a34a" },
    { label: "In Transit", loc: "DHL Logistics", status: "active", color: "#1a56db" },
    { label: "Warehouse", loc: "Lahore Hub", status: "pending", color: "#94a3b8" },
    { label: "Pharmacy", loc: "Servaid #218", status: "pending", color: "#94a3b8" },
  ];
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Supply Chain Monitor</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">Live pipeline for Batch PNX-49281-A</p>
      </div>
      <div className="flex items-center justify-between gap-1">
        {steps.map((s, i) => (
          <div key={s.label} className="flex-1 flex flex-col items-center text-center relative">
            {i > 0 && (
              <div className="absolute top-3.5 -left-1/2 w-full h-0.5" style={{ background: s.status === "complete" ? "#16a34a" : "var(--border)" }} />
            )}
            <div
              className="relative z-10 grid h-7 w-7 place-items-center rounded-full border-2"
              style={{ borderColor: s.color, background: s.status === "complete" ? s.color : "var(--card)" }}
            >
              {s.status === "complete" ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> :
                s.status === "active" ? <motion.div className="h-2 w-2 rounded-full" style={{ background: s.color }} animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }} /> :
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />}
            </div>
            <p className="mt-2 text-[10px] font-bold">{s.label}</p>
            <p className="text-[9px] text-muted-foreground">{s.loc}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── 8. Regional Fraud Heatmap ── */
export function FraudHeatmapWidget() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Map className="h-4 w-4 text-destructive" /> Fraud Heatmap</h3>
      </div>
      <div className="relative h-[200px] rounded-xl overflow-hidden bg-secondary/30 border border-border/50">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <svg viewBox="0 0 100 50" className="absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none">
          <path fill="oklch(0.72 0.18 265 / 0.15)" stroke="oklch(0.72 0.18 265 / 0.4)" strokeWidth="0.3" d="M5,20 Q15,10 25,18 T45,20 Q55,12 70,18 T95,22 L95,40 Q70,45 45,38 T5,40 Z" />
        </svg>
        {[
          { top: "25%", left: "20%", size: "h-4 w-4", color: "bg-destructive" },
          { top: "45%", left: "55%", size: "h-3 w-3", color: "bg-warning" },
          { top: "60%", left: "35%", size: "h-2 w-2", color: "bg-success" },
          { top: "30%", left: "70%", size: "h-3 w-3", color: "bg-success" },
        ].map((d, i) => (
          <div key={i} className={`absolute rounded-full ${d.size} ${d.color} pulse-dot`} style={{ top: d.top, left: d.left }} />
        ))}
        <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-background/80 backdrop-blur-md border border-border/50 p-3 flex justify-between items-center">
          <div>
            <p className="text-[11px] font-semibold">3 Active Hotspots</p>
            <p className="text-[10px] text-muted-foreground">Dubai, Karachi, Lahore</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-md px-2">Expand</Button>
        </div>
      </div>
    </Card>
  );
}

/* ── 9. Recall Management ── */
export function RecallWidget() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/10 text-destructive"><Bell className="h-4 w-4" /></span>
          <div>
            <h3 className="text-[14px] font-semibold">Recall Center</h3>
            <p className="text-[11px] text-muted-foreground">1 active recall</p>
          </div>
        </div>
        <Button size="sm" variant="destructive" className="rounded-xl text-[11px]">Initiate Recall</Button>
      </div>
      <div className="p-5 space-y-3">
        <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-bold text-destructive flex items-center gap-1.5"><XCircle className="h-4 w-4" /> AUG-77821-C</span>
            <span className="text-[10px] bg-destructive/10 text-destructive rounded-full px-2 py-0.5 font-bold">ACTIVE</span>
          </div>
          <p className="text-[12px] text-muted-foreground">Augmentin 625 — 14 counterfeit flags detected across 3 cities.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[{ l: "Pharmacies Notified", v: "218" }, { l: "Returned", v: "142" }, { l: "Completion", v: "65%" }].map(m => (
              <div key={m.l} className="rounded-lg bg-background/60 p-2">
                <p className="text-[14px] font-black">{m.v}</p>
                <p className="text-[9px] text-muted-foreground">{m.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── 10. AI Fraud Detection ── */
export function AIFraudWidget() {
  return (
    <Card className="overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="p-6 relative z-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-white shadow-glow"><BrainCircuit className="h-5 w-5" /></div>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold">AI Fraud Intelligence</h3>
            <p className="text-[11px] text-success font-medium flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" /> Scanning Network</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 rounded-xl bg-secondary/30 border border-border/30">
            <span className="text-[12px] font-bold">Global Fraud Risk</span>
            <span className="text-[14px] font-black text-success">Low (0.8%)</span>
          </div>
          {[
            { msg: "No systematic counterfeit patterns in your batches.", icon: ShieldCheck, tone: "text-success" },
            { msg: "3 duplicate scans on VNT-01122-B flagged in UAE.", icon: AlertTriangle, tone: "text-warning-foreground" },
            { msg: "Batch AUG-77821-C recall 65% complete.", icon: Bell, tone: "text-destructive" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[12px] text-muted-foreground leading-relaxed">
              <item.icon className={`h-4 w-4 shrink-0 mt-0.5 ${item.tone}`} />{item.msg}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ── 11. Distributor Monitoring ── */
export function DistributorWidget() {
  const distributors = [
    { name: "DHL Pakistan", trust: 99, shipments: 142, status: "Verified" },
    { name: "TCS Logistics", trust: 97, shipments: 89, status: "Verified" },
    { name: "Unknown Dist.", trust: 38, shipments: 3, status: "Flagged" },
  ];
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Distributor Network</h3>
        <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">3 Active</span>
      </div>
      <div className="space-y-3">
        {distributors.map((d, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`grid h-9 w-9 place-items-center rounded-full ${d.trust > 90 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">{d.name}</p>
                <p className="text-[11px] text-muted-foreground">{d.shipments} shipments · {d.status}</p>
              </div>
            </div>
            <span className={`text-[13px] font-bold ${d.trust > 90 ? 'text-success' : 'text-destructive'}`}>{d.trust}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── 12. Suspicious Scans ── */
export function SuspiciousScansWidget() {
  const scans = [
    { batch: "VNT-01122-B", loc: "Dubai, UAE", type: "Geo Mismatch", time: "12 min ago", sev: "high" },
    { batch: "AUG-77821-C", loc: "Lahore, PK", type: "Duplicate QR", time: "25 min ago", sev: "high" },
    { batch: "PNX-49281-A", loc: "Mumbai, IN", type: "Unauthorized", time: "1 hr ago", sev: "med" },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/10 text-destructive"><ShieldAlert className="h-4 w-4" /></span>
          <div>
            <h3 className="text-[14px] font-semibold">Suspicious Scans</h3>
            <p className="text-[11px] text-muted-foreground">AI-flagged anomalies</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-destructive pulse-dot" />Live</span>
      </div>
      <ul className="divide-y divide-border/30">
        {scans.map((s, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.4, ease }}
            className={`flex items-start gap-3 px-5 py-3.5 border-l-2 ${s.sev === "high" ? "border-l-destructive bg-destructive/4" : "border-l-warning bg-warning/4"}`}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.sev === "high" ? "bg-destructive" : "bg-warning"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium">{s.type} — <span className="font-mono">{s.batch}</span></p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Globe2 className="h-3 w-3" />{s.loc}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-3 w-3" />{s.time}</span>
              </div>
            </div>
            <button className="mt-1 shrink-0 rounded-lg border border-border/50 bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-accent">Investigate</button>
          </motion.li>
        ))}
      </ul>
    </Card>
  );
}

/* ── 13. Compliance & Regulatory ── */
export function ComplianceWidget() {
  const badges = [
    { label: "DRAP Certified", status: "Active", tone: "success" },
    { label: "WHO-GMP", status: "Active", tone: "success" },
    { label: "ISO 9001", status: "Active", tone: "success" },
    { label: "FDA Import", status: "Pending", tone: "warning" },
  ];
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Compliance Center</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">Regulatory status & certifications</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {badges.map(b => (
          <div key={b.label} className="rounded-xl border border-border/40 bg-secondary/20 p-3.5 flex items-center gap-3">
            <div className={`grid h-8 w-8 place-items-center rounded-full ${b.tone === "success" ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"}`}>
              {b.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-[12px] font-semibold">{b.label}</p>
              <p className={`text-[10px] font-bold ${b.tone === "success" ? "text-success" : "text-warning-foreground"}`}>{b.status}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── 14. Performance Insights ── */
export function PerformanceWidget() {
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Performance Insights</h3>
      </div>
      <div className="space-y-3">
        {[
          { label: "Verification Success Rate", value: "99.4%", tone: "success" as const, icon: CheckCircle2 },
          { label: "Batch Registration Speed", value: "1.2s avg", tone: "success" as const, icon: Clock },
          { label: "Fraud Prevention Score", value: "97/100", tone: "primary" as const, icon: ShieldCheck },
          { label: "Supply Chain Integrity", value: "98.8%", tone: "success" as const, icon: Link2 },
          { label: "Global Trust Rating", value: "AAA+", tone: "success" as const, icon: Globe2 },
        ].map(m => {
          const toneMap = { success: "text-success bg-success/10", primary: "text-primary bg-primary/10", warning: "text-warning-foreground bg-warning/10", destructive: "text-destructive bg-destructive/10" };
          return (
            <div key={m.label} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/30">
              <div className="flex items-center gap-3">
                <div className={`grid h-8 w-8 place-items-center rounded-full ${toneMap[m.tone]}`}><m.icon className="h-4 w-4" /></div>
                <span className="text-[13px] font-medium">{m.label}</span>
              </div>
              <span className={`text-[14px] font-black ${toneMap[m.tone].split(" ")[0]}`}>{m.value}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
