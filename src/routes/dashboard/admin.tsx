import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Plus, Search, Edit2, Trash2, AlertTriangle,
  CheckCircle, XCircle, Database, Pill, Building2,
  RefreshCw, Save, X, ChevronDown, ChevronUp, Bell
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DashShell } from "@/components/dashboard/DashShell";
import { Button } from "@/components/ui/button";
import { DocumentReviewPanel } from "@/components/dashboard/admin/DocumentReviewPanel";
import { ManufacturersPanel } from "@/components/dashboard/admin/ManufacturersPanel";
import { ReportsPanel } from "@/components/dashboard/admin/ReportsPanel";

export const Route = createFileRoute("/dashboard/admin")({
  component: Page,
});

// ── Types ──────────────────────────────────────────────
interface DRAPMedicine {
  id: string;
  name: string;
  genericName?: string;
  category?: string;
  dosage?: string;
  drapRegNumber?: string;
  activeIngredients?: string;
  approvalStatus: string;
  manufacturer_name?: string;
  isPublicDRAPEntry: boolean;
  createdAt: string;
}

interface BatchSequence {
  id: string;
  prefix: string;
  year: number;
  minSequence: number;
  maxSequence: number;
  totalBatches: number;
  confidence: string;
  medicine: { name: string };
}

interface DRAPRecall {
  id: string;
  medicineName: string;
  batchNumber?: string;
  recallDate: string;
  reason: string;
  severity: string;
  isActive: boolean;
  drapRef?: string;
}

// ── Helper Components ───────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, onAdd }: { title: string; subtitle: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="font-semibold text-base">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {onAdd && (
        <Button onClick={onAdd} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add New
        </Button>
      )}
    </div>
  );
}

// ── Medicine Form Modal ─────────────────────────────────
function MedicineFormModal({ medicine, onClose, onSave, session }: { medicine?: DRAPMedicine | null; onClose: () => void; onSave: () => void; session: any }) {
  const [form, setForm] = useState({
    name: medicine?.name ?? "",
    genericName: medicine?.genericName ?? "",
    category: medicine?.category ?? "",
    dosage: medicine?.dosage ?? "",
    drapRegNumber: medicine?.drapRegNumber ?? "",
    activeIngredients: medicine?.activeIngredients ?? "",
    approvalStatus: medicine?.approvalStatus ?? "REGISTERED",
    manufacturer_name: medicine?.manufacturer_name ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Medicine name is required."); return; }
    setLoading(true); setError(null);
    try {
      const url = medicine ? `/api/admin/medicines/${medicine.id}` : "/api/admin/medicines";
      const method = medicine ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.token ?? ""}` },
        body: JSON.stringify({ ...form, isPublicDRAPEntry: true })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to save");
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, field, placeholder, textarea }: { label: string; field: string; placeholder: string; textarea?: boolean }) => (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">{label}</label>
      {textarea ? (
        <textarea
          value={(form as any)[field]}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      ) : (
        <input
          value={(form as any)[field]}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border/50 sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-semibold">{medicine ? "Edit Medicine" : "Add DRAP Medicine"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Layer 1 — Public intelligence database</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Medicine Name *" field="name" placeholder="e.g. Panadol Extra 500mg Tablet" />
          <Field label="Generic Name" field="genericName" placeholder="e.g. Paracetamol" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" field="category" placeholder="e.g. Analgesic" />
            <Field label="Dosage" field="dosage" placeholder="e.g. 500mg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="DRAP Reg. Number" field="drapRegNumber" placeholder="e.g. DRAP-MED-0001" />
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Approval Status</label>
              <select
                value={form.approvalStatus}
                onChange={e => set("approvalStatus", e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none"
              >
                <option value="REGISTERED">Registered</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="BANNED">Banned</option>
              </select>
            </div>
          </div>
          <Field label="Manufacturer Name" field="manufacturer_name" placeholder="e.g. GSK Pakistan" />
          <Field label="Active Ingredients" field="activeIngredients" placeholder="e.g. Paracetamol 500mg, Caffeine 65mg" textarea />

          {error && <p className="text-red-500 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1 gap-1.5">
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {medicine ? "Update" : "Save to DRAP DB"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Batch Sequence Form Modal ───────────────────────────
function BatchSequenceModal({ onClose, onSave, session }: { onClose: () => void; onSave: () => void; session: any }) {
  const [form, setForm] = useState({ medicineId: "", prefix: "", year: new Date().getFullYear(), minSequence: 1, maxSequence: 100, totalBatches: 100, confidence: "MEDIUM" });
  const [medicines, setMedicines] = useState<DRAPMedicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/medicines", { headers: { "Authorization": `Bearer ${session?.token ?? ""}` } })
      .then(r => r.json()).then(d => { if (d.success) setMedicines(d.data); });
  }, []);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.medicineId || !form.prefix) { setError("Medicine and prefix are required."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/batch-sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.token ?? ""}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to save");
      onSave(); onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div>
            <h2 className="font-semibold">Add Batch Sequence Range</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Define valid batch number ranges for anomaly detection</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Medicine</label>
            <select value={form.medicineId} onChange={e => set("medicineId", e.target.value)} className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none">
              <option value="">Select medicine...</option>
              {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Prefix</label>
              <input value={form.prefix} onChange={e => set("prefix", e.target.value.toUpperCase())} placeholder="e.g. PND" className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Year</label>
              <input type="number" value={form.year} onChange={e => set("year", parseInt(e.target.value))} className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Min Sequence</label>
              <input type="number" value={form.minSequence} onChange={e => set("minSequence", parseInt(e.target.value))} className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Max Sequence</label>
              <input type="number" value={form.maxSequence} onChange={e => set("maxSequence", parseInt(e.target.value))} className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Confidence</label>
            <select value={form.confidence} onChange={e => set("confidence", e.target.value)} className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none">
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-[11px] text-blue-600">
            Example: Prefix "PND", Year 2024, Min 1, Max 523 means batch numbers PND-2024-0001 to PND-2024-0523 are valid. PND-2024-9999 would be FAKE.
          </div>
          {error && <p className="text-red-500 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1 gap-1.5">
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Sequence
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recall Form Modal ───────────────────────────────────
function RecallFormModal({ onClose, onSave, session }: { onClose: () => void; onSave: () => void; session: any }) {
  const [form, setForm] = useState({ medicineName: "", batchNumber: "", reason: "", severity: "MEDIUM", drapRef: "", recallDate: new Date().toISOString().split("T")[0] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.medicineName || !form.reason) { setError("Medicine name and reason are required."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/recalls", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.token ?? ""}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to save");
      onSave(); onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div>
            <h2 className="font-semibold">Issue DRAP Recall</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Add recall alert to Layer 1 intelligence</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Medicine Name *</label>
            <input value={form.medicineName} onChange={e => set("medicineName", e.target.value)} placeholder="e.g. Panadol Extra 500mg" className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Batch Number</label>
              <input value={form.batchNumber} onChange={e => set("batchNumber", e.target.value)} placeholder="e.g. PND-2024-001" className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Recall Date</label>
              <input type="date" value={form.recallDate} onChange={e => set("recallDate", e.target.value)} className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Severity</label>
              <select value={form.severity} onChange={e => set("severity", e.target.value)} className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">DRAP Ref No.</label>
              <input value={form.drapRef} onChange={e => set("drapRef", e.target.value)} placeholder="e.g. DRAP-RC-2024-001" className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Reason *</label>
            <textarea value={form.reason} onChange={e => set("reason", e.target.value)} placeholder="Reason for recall..." rows={3} className="w-full rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          {error && <p className="text-red-500 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1 gap-1.5 bg-red-600 hover:bg-red-700">
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
              Issue Recall
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────
function Page() {
  const { user, isAuthenticated, signOut, session } = useAuth();

  // Role check — ADMIN only
  useEffect(() => {
    if (isAuthenticated && (user?.role as string) !== "admin" && (user?.role as string) !== "super_admin" && (user?.role as string) !== "drap_admin") {
      signOut();
    }
  }, [isAuthenticated, user?.role, signOut]);

  if (!isAuthenticated || ((user?.role as string) !== "admin" && (user?.role as string) !== "super_admin" && (user?.role as string) !== "drap_admin")) {
    return <Navigate to="/auth/login" />;
  }

  // State
  const [medicines, setMedicines] = useState<DRAPMedicine[]>([]);
  const [sequences, setSequences] = useState<BatchSequence[]>([]);
  const [recalls, setRecalls] = useState<DRAPRecall[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"medicines" | "sequences" | "recalls" | "documents" | "manufacturers" | "reports">("medicines");
  const [showMedicineForm, setShowMedicineForm] = useState(false);
  const [showSequenceForm, setShowSequenceForm] = useState(false);
  const [showRecallForm, setShowRecallForm] = useState(false);
  const [editMedicine, setEditMedicine] = useState<DRAPMedicine | null>(null);

  const headers = { "Authorization": `Bearer ${session?.token ?? ""}` };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [medRes, seqRes, recRes, statsRes] = await Promise.all([
        fetch("/api/admin/medicines", { headers }).then(r => r.json()),
        fetch("/api/admin/batch-sequences", { headers }).then(r => r.json()),
        fetch("/api/admin/recalls", { headers }).then(r => r.json()),
        fetch("/api/admin/dashboard", { headers }).then(r => r.json()),
      ]);
      if (medRes.success) setMedicines(medRes.data);
      if (seqRes.success) setSequences(seqRes.data);
      if (recRes.success) setRecalls(recRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [session?.token]);

  const filteredMedicines = medicines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.drapRegNumber?.toLowerCase().includes(search.toLowerCase()) ||
    m.manufacturer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteMedicine = async (id: string) => {
    if (!confirm("Delete this medicine from DRAP database?")) return;
    await fetch(`/api/admin/medicines/${id}`, { method: "DELETE", headers });
    fetchAll();
  };

  const handleToggleRecall = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/recalls/${id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive })
    });
    fetchAll();
  };

  const severityColor = (s: string) => s === "CRITICAL" ? "text-red-600 bg-red-500/10" : s === "HIGH" ? "text-orange-600 bg-orange-500/10" : s === "MEDIUM" ? "text-amber-600 bg-amber-500/10" : "text-green-600 bg-green-500/10";

  return (
    <DashShell title="DRAP Admin Portal" subtitle="Layer 1 — Public Intelligence Database" badge="ADMIN">
      <div className="space-y-6 p-4 md:p-6">

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Pill} label="DRAP Medicines" value={medicines.length} color="bg-blue-500/15 text-blue-500" />
          <StatCard icon={Database} label="Batch Sequences" value={sequences.length} color="bg-purple-500/15 text-purple-500" />
          <StatCard icon={AlertTriangle} label="Active Recalls" value={recalls.filter(r => r.isActive).length} color="bg-red-500/15 text-red-500" />
          <StatCard icon={Building2} label="Total Scans" value={stats?.totalScans ?? "..."} color="bg-green-500/15 text-green-500" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/30 rounded-xl p-1 w-fit flex-wrap">
          {(["medicines", "sequences", "recalls", "documents", "manufacturers", "reports"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {tab === "medicines" ? "DRAP Medicines" : tab === "sequences" ? "Batch Sequences" : tab === "recalls" ? "Recall Alerts" : tab === "documents" ? "Document Review" : tab === "manufacturers" ? "Manufacturers" : "Reports"}
            </button>
          ))}
        </div>

        {/* ── MEDICINES TAB ── */}
        {activeTab === "medicines" && (
          <div>
            <SectionHeader title="DRAP Medicine Database" subtitle="Medicines entered here are checked during every patient scan (Layer 1)" onAdd={() => { setEditMedicine(null); setShowMedicineForm(true); }} />
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, DRAP number, or manufacturer..." className="w-full h-10 rounded-xl border border-border bg-secondary/20 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
              ) : filteredMedicines.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Pill className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No medicines yet — add your first DRAP medicine</p>
                </div>
              ) : filteredMedicines.map(med => (
                <div key={med.id} className="rounded-xl border border-border/50 bg-card p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{med.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${med.approvalStatus === "REGISTERED" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                        {med.approvalStatus}
                      </span>
                      {med.isPublicDRAPEntry && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">DRAP Entry</span>}
                    </div>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {med.genericName && <span className="text-[11px] text-muted-foreground">{med.genericName}</span>}
                      {med.drapRegNumber && <span className="text-[11px] font-mono text-blue-500">{med.drapRegNumber}</span>}
                      {med.manufacturer_name && <span className="text-[11px] text-muted-foreground">by {med.manufacturer_name}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => { setEditMedicine(med); setShowMedicineForm(true); }} className="w-8 h-8 rounded-lg border border-border bg-secondary/30 flex items-center justify-center hover:bg-secondary transition-colors">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDeleteMedicine(med.id)} className="w-8 h-8 rounded-lg border border-red-200 bg-red-500/5 flex items-center justify-center hover:bg-red-500/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SEQUENCES TAB ── */}
        {activeTab === "sequences" && (
          <div>
            <SectionHeader title="Batch Sequence Ranges" subtitle="Define valid batch number ranges — anything outside these is flagged as FAKE" onAdd={() => setShowSequenceForm(true)} />
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
              ) : sequences.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No sequences yet — add batch sequence ranges</p>
                </div>
              ) : sequences.map(seq => (
                <div key={seq.id} className="rounded-xl border border-border/50 bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{seq.medicine?.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Prefix: <span className="font-mono text-blue-500">{seq.prefix}</span> — Year: <span className="font-mono">{seq.year}</span> — Range: <span className="font-mono">{seq.minSequence.toString().padStart(4,"0")} to {seq.maxSequence.toString().padStart(4,"0")}</span>
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${seq.confidence === "HIGH" ? "bg-green-500/10 text-green-600" : seq.confidence === "MEDIUM" ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"}`}>
                      {seq.confidence}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground bg-secondary/30 rounded-lg px-3 py-1.5">
                    Valid: <span className="font-mono">{seq.prefix}-{seq.year}-{seq.minSequence.toString().padStart(4,"0")}</span> to <span className="font-mono">{seq.prefix}-{seq.year}-{seq.maxSequence.toString().padStart(4,"0")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RECALLS TAB ── */}
        {activeTab === "recalls" && (
          <div>
            <SectionHeader title="DRAP Recall Alerts" subtitle="Active recalls are shown to patients when they scan that medicine" onAdd={() => setShowRecallForm(true)} />
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
              ) : recalls.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No recalls yet</p>
                </div>
              ) : recalls.map(rec => (
                <div key={rec.id} className={`rounded-xl border p-4 ${rec.isActive ? "border-red-200 bg-red-500/5" : "border-border/50 bg-card opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{rec.medicineName}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${severityColor(rec.severity)}`}>{rec.severity}</span>
                        {rec.batchNumber && <span className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded">{rec.batchNumber}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{rec.reason}</p>
                      {rec.drapRef && <p className="text-[10px] text-blue-500 mt-0.5">Ref: {rec.drapRef}</p>}
                    </div>
                    <button onClick={() => handleToggleRecall(rec.id, rec.isActive)} className={`flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${rec.isActive ? "bg-red-500/10 text-red-600 hover:bg-red-500/20" : "bg-green-500/10 text-green-600 hover:bg-green-500/20"}`}>
                      {rec.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DOCUMENTS TAB ── */}
        {activeTab === "documents" && (
          <DocumentReviewPanel />
        )}

        {/* ── MANUFACTURERS TAB ── */}
        {activeTab === "manufacturers" && (
          <ManufacturersPanel />
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab === "reports" && (
          <ReportsPanel />
        )}
      </div>

      {/* Modals */}
      {showMedicineForm && <MedicineFormModal medicine={editMedicine} onClose={() => { setShowMedicineForm(false); setEditMedicine(null); }} onSave={fetchAll} session={session} />}
      {showSequenceForm && <BatchSequenceModal onClose={() => setShowSequenceForm(false)} onSave={fetchAll} session={session} />}
      {showRecallForm && <RecallFormModal onClose={() => setShowRecallForm(false)} onSave={fetchAll} session={session} />}
    </DashShell>
  );
}
