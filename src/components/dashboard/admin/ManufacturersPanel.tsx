import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Building2,
    Shield,
    FileText,
    Phone,
    Mail,
    Globe,
    Calendar,
    AlertCircle,
    Loader2,
    CheckCircle2,
    Clock,
    Pill,
    ArrowLeft,
    ExternalLink,
    ChevronRight,
    Sparkles,
    Ban,
    RotateCcw,
    ShieldOff,
    X,
    Download,
    Eye,
    Link2,
    Hash,
    Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminManufacturersService, type AdminManufacturerItem, type AdminManufacturerReport, type AdminBatchReportItem, type AdminMedicineReportItem } from "@/services/admin-manufacturers";
import { ease } from "@/lib/motion";

// ─── Batch Compliance Report Modal ───────────────────────────────────────────

interface ComplianceBatch {
    batch: AdminBatchReportItem;
    medicine: AdminMedicineReportItem;
    manufacturer: { companyName: string; licenseNumber: string };
}

function BatchComplianceModal({ data, onClose }: { data: ComplianceBatch; onClose: () => void }) {
    const { batch, medicine, manufacturer } = data;
    const reportNo = `MV-${batch.batchNumber}`;
    const generatedOn = new Date().toLocaleString("en-PK");
    const pillsPerBox = batch.quantityBoxes > 0 ? Math.round(batch.totalPillsGenerated / batch.quantityBoxes) : 0;

    const txHashDisplay =
        batch.txHash && batch.txHash !== "0x0000000000000000000000000000000000000000"
            ? batch.txHash
            : batch.blockchainStatus === "CONFIRMED"
              ? "Not configured"
              : "Pending Anchoring";

    const printPdf = () => {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Batch Compliance Report — ${batch.batchNumber}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; background: #fff; color: #1a202c; }
  .header {
    background: #1a1a2e;
    color: #fff;
    padding: 18px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand-name { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
  .brand-sub  { font-size: 8px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #94a3b8; margin-top: 3px; }
  .report-no-label { font-size: 8px; color: #94a3b8; text-align: right; text-transform: uppercase; letter-spacing: 1px; }
  .report-no-val   { font-size: 11px; font-weight: 700; color: #e2e8f0; font-family: monospace; margin-top: 2px; }
  .body { padding: 32px 36px; min-height: calc(297mm - 130px); display: flex; flex-direction: column; }
  h2 { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
  .generated { font-size: 10px; color: #718096; margin-bottom: 22px; }
  .report-table { width: 100%; border: 1px solid #cbd5e0; border-collapse: collapse; margin-bottom: 28px; }
  .report-table tr { border-bottom: 1px solid #e2e8f0; }
  .report-table tr:last-child { border-bottom: none; }
  .report-table td { padding: 9px 14px; font-size: 11.5px; vertical-align: middle; }
  .report-table td.label { font-weight: 700; color: #2d3748; width: 42%; background: #f9fafb; }
  .report-table td.value { color: #1a56db; font-weight: 500; }
  .bc-section { margin-top: 4px; }
  .bc-title { font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 14px; }
  .bc-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 5px; }
  .bc-hash  { font-family: "Courier New", monospace; font-size: 11px; color: #1a56db; word-break: break-all; }
  .footer { margin-top: auto; padding-top: 40px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #a0aec0; text-align: center; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand-name">SafeDose</div>
    <div class="brand-sub">Pharmaceutical Authentication System</div>
  </div>
  <div style="text-align:right">
    <div class="report-no-label">Report No.</div>
    <div class="report-no-val">${reportNo}</div>
  </div>
</div>
<div class="body">
  <h2>Batch Compliance Report</h2>
  <p class="generated">Generated on ${generatedOn}</p>
  <table class="report-table">
    <tr><td class="label">Medicine Name:</td><td class="value">${medicine.name}</td></tr>
    <tr><td class="label">Batch Number:</td><td class="value">${batch.batchNumber}</td></tr>
    <tr><td class="label">Product Category:</td><td class="value">${medicine.category || "—"}</td></tr>
    <tr><td class="label">Manufacturer Code:</td><td class="value">${manufacturer.licenseNumber}</td></tr>
    <tr><td class="label">DRAP License:</td><td class="value">${medicine.drapRegNumber || "Pending"}</td></tr>
    <tr><td class="label">Manufacturing Date:</td><td class="value">${batch.manufacturingDate}</td></tr>
    <tr><td class="label">Expiry Date:</td><td class="value">${batch.expiryDate}</td></tr>
    <tr><td class="label">Total Boxes:</td><td class="value">${batch.quantityBoxes.toLocaleString()}</td></tr>
    <tr><td class="label">Pills Per Box:</td><td class="value">${pillsPerBox.toLocaleString()}</td></tr>
    <tr><td class="label">Total Generated Pills:</td><td class="value">${batch.totalPillsGenerated.toLocaleString()}</td></tr>
    <tr><td class="label">Generation Status:</td><td class="value">${batch.medicineStatus}</td></tr>
    <tr><td class="label">Supply Chain Status:</td><td class="value">${batch.status}</td></tr>
  </table>
  <div class="bc-section">
    <div class="bc-title">Blockchain Verification Details</div>
    <div class="bc-label">Transaction Hash</div>
    <div class="bc-hash">${txHashDisplay}</div>
  </div>
  <div class="footer">This report is digitally signed by SafeDose nodes. Any tampering invalidates the verification.</div>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;

        const win = window.open("", "_blank", "width=820,height=1100");
        if (win) {
            win.document.write(html);
            win.document.close();
            toast.success("Opening PDF print dialog…");
        } else {
            toast.error("Pop-up blocked — please allow pop-ups and try again.");
        }
    };

    const Row = ({ label, value, plain }: { label: string; value: string; plain?: boolean }) => (
        <div className="flex border-b border-gray-200 last:border-0">
            <span className="w-44 flex-shrink-0 py-2.5 px-3 text-[11px] font-bold text-gray-700 bg-gray-50">{label}:</span>
            <span className={`flex-1 py-2.5 px-3 text-[11px] font-medium ${plain ? "text-gray-800" : "text-blue-700"}`}>{value}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.25, ease }}
                className="relative z-10 w-full max-w-[520px] rounded-xl overflow-hidden shadow-2xl border border-white/10"
            >
                {/* ── Dark Navy Header ── */}
                <div className="bg-[#1a1a2e] px-6 py-4 flex items-center justify-between">
                    <div>
                        <p className="text-[21px] font-black text-white tracking-tight leading-none">SafeDose</p>
                        <p className="text-[7.5px] font-semibold tracking-[2.5px] text-slate-400 uppercase mt-1">
                            Pharmaceutical Authentication System
                        </p>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="text-right">
                            <p className="text-[8px] text-slate-500 uppercase tracking-widest">Report No.</p>
                            <p className="text-[10px] font-mono font-bold text-slate-300 mt-0.5">{reportNo}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors"
                        >
                            <X className="h-3 w-3 text-white" />
                        </button>
                    </div>
                </div>

                {/* ── White Report Body ── */}
                <div className="bg-white overflow-y-auto max-h-[68vh]">
                    <div className="px-6 pt-5 pb-3">
                        <h2 className="text-[16px] font-extrabold text-gray-900">Batch Compliance Report</h2>
                        <p className="text-[10px] text-gray-400 mt-0.5">Generated on {generatedOn}</p>
                    </div>

                    {/* Bordered table matching screenshot */}
                    <div className="mx-6 mb-4 border border-gray-200 overflow-hidden">
                        <Row label="Medicine Name"         value={medicine.name} />
                        <Row label="Batch Number"          value={batch.batchNumber} />
                        <Row label="Product Category"      value={medicine.category || "—"} />
                        <Row label="Manufacturer Code"     value={manufacturer.licenseNumber} />
                        <Row label="DRAP License"          value={medicine.drapRegNumber || "Pending"} />
                        <Row label="Manufacturing Date"    value={batch.manufacturingDate} />
                        <Row label="Expiry Date"           value={batch.expiryDate} />
                        <Row label="Total Boxes"           value={batch.quantityBoxes.toLocaleString()} />
                        <Row label="Pills Per Box"         value={pillsPerBox.toLocaleString()} />
                        <Row label="Total Generated Pills" value={batch.totalPillsGenerated.toLocaleString()} />
                        <Row label="Generation Status"     value={batch.medicineStatus} plain />
                        <Row label="Supply Chain Status"   value={batch.status} plain />
                    </div>

                    {/* Blockchain */}
                    <div className="px-6 pb-5">
                        <h3 className="text-[15px] font-extrabold text-gray-900 mb-3">Blockchain Verification Details</h3>
                        <p className="text-[8px] text-gray-400 uppercase tracking-[1.5px] mb-1.5">Transaction Hash</p>
                        <p className="font-mono text-[11px] text-blue-600 break-all leading-relaxed">{txHashDisplay}</p>
                    </div>

                    {/* Disclaimer */}
                    <div className="px-6 pb-5 text-center">
                        <p className="text-[9px] text-gray-400 italic">
                            This report is digitally signed by SafeDose nodes. Any tampering invalidates the verification.
                        </p>
                    </div>
                </div>

                {/* ── Footer Bar ── */}
                <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between">
                    <p className="text-[10px] text-gray-400">Compliance Report · {batch.batchNumber}</p>
                    <Button
                        size="sm"
                        onClick={printPdf}
                        className="gap-1.5 rounded-xl h-8 text-xs bg-[#1a1a2e] hover:bg-[#2d3748] text-white border-0"
                    >
                        <Download className="h-3.5 w-3.5" /> Download PDF
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}


// ─── Confirmation Modal ──────────────────────────────────────────────────────

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: "destructive" | "default";
    isLoading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel,
    confirmVariant = "destructive",
    isLoading,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />
            {/* Dialog */}
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.2, ease }}
                className="relative z-10 w-full max-w-md rounded-2xl border border-border/50 bg-background shadow-2xl p-6 space-y-4"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">{title}</h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary/30"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed pl-10.5">
                    {message}
                </p>
                <div className="flex justify-end gap-2 pt-1">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                        disabled={isLoading}
                        className="rounded-xl border-border/60 h-8 text-xs"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant={confirmVariant}
                        size="sm"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="rounded-xl h-8 text-xs gap-1.5"
                    >
                        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Create Manufacturer Modal ───────────────────────────────────────────────

function CreateManufacturerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [form, setForm] = useState({ companyName: "", email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ companyCode: string; email: string; companyName: string } | null>(null);

    const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

    const handleCreate = async () => {
        if (!form.companyName.trim() || !form.email.trim() || !form.password.trim()) {
            setError("All fields are required.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await adminManufacturersService.createManufacturer(form);
            if (!data.success) throw new Error(data.error?.message ?? "Failed to create account");
            setSuccess({ companyCode: data.data!.companyCode, email: form.email, companyName: form.companyName });
            onCreated();
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
                        <h2 className="font-semibold">Create Manufacturer Account</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Company will verify their email with a code on first login</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {!success ? (
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Company Name</label>
                            <input
                                value={form.companyName}
                                onChange={(e) => set("companyName", e.target.value)}
                                placeholder="e.g. GSK Pakistan"
                                className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Company Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => set("email", e.target.value)}
                                placeholder="official@company.com"
                                className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Temporary Password</label>
                            <input
                                type="text"
                                value={form.password}
                                onChange={(e) => set("password", e.target.value)}
                                placeholder="Set a password to share with them"
                                className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Min 8 chars, with uppercase, lowercase, and a number.</p>
                        </div>
                        {error && <p className="text-red-500 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
                        <div className="flex gap-2 pt-2">
                            <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
                            <Button onClick={handleCreate} disabled={loading} className="flex-1">
                                {loading ? "Creating..." : "Create Account"}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 space-y-3">
                        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-center">
                            <p className="text-sm font-medium text-green-600">Account Created Successfully</p>
                            <p className="text-xs text-muted-foreground mt-2">
                                Company Code: <span className="font-mono font-semibold">{success.companyCode}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Share the email and password with {success.companyName}. They will verify their email with a code on first login.
                            </p>
                        </div>
                        <Button onClick={onClose} className="w-full">Done</Button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────


type ModalState =
    | { type: "suspend"; id: string; companyName: string }
    | { type: "restore"; id: string; companyName: string }
    | { type: "unverify"; id: string; companyName: string }
    | null;

export function ManufacturersPanel() {
    const [manufacturers, setManufacturers] = useState<AdminManufacturerItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [report, setReport] = useState<AdminManufacturerReport | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [showSuspended, setShowSuspended] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [modal, setModal] = useState<ModalState>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [complianceBatch, setComplianceBatch] = useState<ComplianceBatch | null>(null);

    const loadManufacturers = useCallback(async (includeSuspended: boolean) => {
        setLoading(true);
        const res = await adminManufacturersService.getManufacturers({ includeSuspended });
        if (res.success && res.data) {
            setManufacturers(res.data);
        } else {
            toast.error(res.error?.message ?? "Failed to load manufacturers.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void loadManufacturers(showSuspended);
    }, [loadManufacturers, showSuspended]);

    const loadReport = useCallback(async (id: string) => {
        setReportLoading(true);
        setReport(null);
        const res = await adminManufacturersService.getManufacturerReport(id);
        if (res.success && res.data) {
            setReport(res.data);
        } else {
            toast.error(res.error?.message ?? "Failed to load manufacturer details.");
            setSelectedId(null);
        }
        setReportLoading(false);
    }, []);

    useEffect(() => {
        if (selectedId) {
            void loadReport(selectedId);
        } else {
            setReport(null);
        }
    }, [selectedId, loadReport]);

    const handleBack = () => {
        setSelectedId(null);
    };

    const downloadReport = () => {
        if (!report) return;
        const now = new Date().toLocaleString();
        const reportHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Manufacturer Report — ${report.companyName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a56db; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { font-size: 20px; font-weight: 900; color: #1a56db; letter-spacing: -0.5px; }
  .brand-sub { font-size: 9px; color: #6b7280; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
  .report-no { font-size: 10px; color: #6b7280; text-align: right; }
  h2 { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .generated { font-size: 10px; color: #9ca3af; margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 20px 0 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 12px; }
  .field label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; display: block; margin-bottom: 3px; }
  .field span { font-size: 12px; font-weight: 500; color: #1a1a2e; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .badge-verified { background: #dcfce7; color: #16a34a; border: 1px solid #86efac; }
  .badge-pending { background: #fef9c3; color: #ca8a04; border: 1px solid #fde047; }
  .med-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
  .med-name { font-size: 13px; font-weight: 700; color: #1a1a2e; }
  .med-meta { font-size: 10px; color: #6b7280; margin-top: 2px; margin-bottom: 10px; }
  .drap-tag { font-size: 9px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 999px; padding: 2px 8px; font-weight: 700; display: inline-block; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
  td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  .status-active { background: #dcfce7; color: #16a34a; padding: 1px 7px; border-radius: 999px; font-weight: 700; }
  .status-other { background: #f3f4f6; color: #6b7280; padding: 1px 7px; border-radius: 999px; font-weight: 700; }
  .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 9px; color: #9ca3af; text-align: center; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">SafeDose</div>
    <div class="brand-sub">Pharmaceutical Authentication System</div>
  </div>
  <div class="report-no">MANUFACTURER REPORT<br/>Generated: ${now}</div>
</div>

<h2>${report.companyName}</h2>
<div class="generated">License No: ${report.licenseNumber}</div>

<div class="section-title">Company Credentials</div>
<div class="grid">
  <div class="field"><label>License Number</label><span>${report.licenseNumber}</span></div>
  <div class="field"><label>Verification Status</label><span class="badge ${report.isVerified ? "badge-verified" : "badge-pending"}">${report.isVerified ? "Verified" : "Pending / Unverified"}</span></div>
  <div class="field"><label>Tax ID (NTN)</label><span>${report.taxId || "Not provided"}</span></div>
  <div class="field"><label>Registration Number</label><span>${report.registrationNumber || "Not provided"}</span></div>
  <div class="field"><label>Business Email</label><span>${report.businessEmail || "Not provided"}</span></div>
  <div class="field"><label>Business Phone</label><span>${report.businessPhone || "Not provided"}</span></div>
  <div class="field"><label>Website</label><span>${report.website || "Not provided"}</span></div>
  <div class="field"><label>Industry Type</label><span>${report.industryType || "Not provided"}</span></div>
  <div class="field"><label>Full Address</label><span>${report.address || "Not provided"}</span></div>
</div>

<div class="section-title">Registered Products &amp; Batches</div>
${report.medicines.length === 0 ? "<p style='color:#9ca3af;font-size:11px;'>No registered products found.</p>" : report.medicines.map((med: any) => `
<div class="med-card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div class="med-name">${med.name}${med.dosage ? ` <span style="font-size:10px;font-weight:400;color:#6b7280">(${med.dosage})</span>` : ""}</div>
      <div class="med-meta">${med.genericName ? med.genericName + " • " : ""}${med.category || "General Category"}</div>
    </div>
    <span class="drap-tag">DRAP Reg: ${med.drapRegNumber || "Pending"}</span>
  </div>
  ${med.batches.length === 0 ? "<p style='color:#9ca3af;font-size:10px;font-style:italic;margin-top:6px;'>No batches registered yet.</p>" : `
  <table>
    <thead><tr>
      <th>Batch Number</th><th>Mfg. Date</th><th>Expiry Date</th><th>Qty (Boxes)</th><th>Generated Pills</th><th>Scanned / Verified</th><th>Status</th><th>Blockchain</th>
    </tr></thead>
    <tbody>
      ${med.batches.map((b: any) => `
      <tr>
        <td style="font-family:monospace;font-weight:700">${b.batchNumber}</td>
        <td>${new Date(b.manufacturingDate).toLocaleDateString()}</td>
        <td>${new Date(b.expiryDate).toLocaleDateString()}</td>
        <td style="text-align:right">${b.quantityBoxes.toLocaleString()}</td>
        <td style="text-align:right;font-family:monospace">${b.totalPillsGenerated.toLocaleString()}</td>
        <td style="text-align:right;font-family:monospace">${b.verifiedPillsCount.toLocaleString()} / ${b.totalPillsCount.toLocaleString()}</td>
        <td><span class="${b.status === "ACTIVE" ? "status-active" : "status-other"}">${b.status}</span></td>
        <td><span class="${b.blockchainStatus === "CONFIRMED" ? "status-active" : "status-other"}">${b.blockchainStatus}</span></td>
      </tr>`).join("")}
    </tbody>
  </table>`}
</div>`).join("")}

<div class="footer">This report is digitally generated by SafeDose. Any tampering invalidates the verification.</div>
</body>
</html>`;

        const blob = new Blob([reportHtml], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `SafeDose-Manufacturer-${report.companyName.replace(/\s+/g, "-")}-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Report downloaded successfully!");
    };

    // ── Action handlers ──

    const handleConfirm = async () => {
        if (!modal) return;
        setActionLoading(true);

        if (modal.type === "suspend") {
            const res = await adminManufacturersService.suspendManufacturer(modal.id);
            if (res.success) {
                toast.success(`${modal.companyName} has been suspended.`);
                // Remove from active list (they are now suspended)
                setManufacturers((prev) => prev.filter((m) => m.id !== modal.id));
            } else {
                toast.error(res.error?.message ?? "Suspension failed.");
            }
        } else if (modal.type === "restore") {
            const res = await adminManufacturersService.restoreManufacturer(modal.id);
            if (res.success) {
                toast.success(`${modal.companyName} has been restored.`);
                // Remove from suspended list; reload will show them in active
                setManufacturers((prev) => prev.filter((m) => m.id !== modal.id));
            } else {
                toast.error(res.error?.message ?? "Restore failed.");
            }
        } else if (modal.type === "unverify") {
            const res = await adminManufacturersService.unverifyManufacturer(modal.id);
            if (res.success) {
                toast.success(`Verification revoked for ${modal.companyName}.`);
                // Update badge in-place
                setManufacturers((prev) =>
                    prev.map((m) =>
                        m.id === modal.id
                            ? { ...m, isVerified: false, verificationStatus: "PENDING" }
                            : m
                    )
                );
            } else {
                toast.error(res.error?.message ?? "Unverify action failed.");
            }
        }

        setActionLoading(false);
        setModal(null);
    };

    // ── Detail View ──

    if (selectedId) {
        return (
            <>
            <AnimatePresence>
                {complianceBatch && (
                    <BatchComplianceModal
                        data={complianceBatch}
                        onClose={() => setComplianceBatch(null)}
                    />
                )}
            </AnimatePresence>
            <div className="space-y-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBack}
                        className="rounded-xl border-border/60 hover:bg-secondary/30 h-9 gap-1.5"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to List
                    </Button>
                    <div className="flex-1">
                        <h3 className="text-[16px] font-bold flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            {report?.companyName || "Loading profile..."}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Manufacturer Drill-down Report &amp; Credentials
                        </p>
                    </div>
                    {report && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={downloadReport}
                            className="rounded-xl border-primary/40 text-primary hover:bg-primary/10 h-9 gap-1.5"
                        >
                            <Download className="h-4 w-4" /> Download Report
                        </Button>
                    )}
                </div>

                {reportLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm">Assembling company registers...</p>
                    </div>
                ) : report ? (
                    <div className="space-y-6">
                        {/* Company Profile Details */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease }}
                            className="card-premium p-6 border-border/40"
                        >
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                                Company Credentials
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">License Number</span>
                                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                                        <Shield className="h-3.5 w-3.5 text-primary/80" />
                                        {report.licenseNumber}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Verification Status</span>
                                    <span className="inline-flex">
                                        {report.isVerified ? (
                                            <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1 rounded-full text-[10px] py-0.5 px-2.5">
                                                <CheckCircle2 className="h-3 w-3" /> Verified
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1 rounded-full text-[10px] py-0.5 px-2.5">
                                                <Clock className="h-3 w-3" /> Pending / Unverified
                                            </Badge>
                                        )}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Tax ID (NTN)</span>
                                    <span className="font-medium text-foreground">{report.taxId || "Not provided"}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Registration Number</span>
                                    <span className="font-medium text-foreground">{report.registrationNumber || "Not provided"}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Business Email</span>
                                    <span className="font-medium text-foreground flex items-center gap-1.5">
                                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                        {report.businessEmail || "Not provided"}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Business Phone</span>
                                    <span className="font-medium text-foreground flex items-center gap-1.5">
                                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                        {report.businessPhone || "Not provided"}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Website</span>
                                    <span className="font-medium text-foreground">
                                        {report.website ? (
                                            <a
                                                href={report.website.startsWith("http") ? report.website : `https://${report.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline inline-flex items-center gap-1"
                                            >
                                                {report.website} <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : (
                                            "Not provided"
                                        )}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Industry Type</span>
                                    <span className="font-medium text-foreground">{report.industryType || "Not provided"}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Full Address</span>
                                    <span className="font-medium text-foreground">{report.address || "Not provided"}</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Product & Batch Register */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold flex items-center gap-1.5">
                                <Pill className="h-4 w-4 text-primary" /> Registered Products &amp; Batches
                            </h4>

                            {report.medicines.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/5 p-8 text-center">
                                    <AlertCircle className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-foreground/95">No Registered Products</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        This manufacturer has not registered any medicines in the catalog yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {report.medicines.map((med) => (
                                        <motion.div
                                            key={med.id}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="card-premium p-5 border-border/40 space-y-4 bg-background/40"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/20 pb-3">
                                                <div>
                                                    <h5 className="font-bold text-sm text-foreground/95 flex items-center gap-1.5">
                                                        <Pill className="h-4 w-4 text-primary" /> {med.name}
                                                        {med.dosage && (
                                                            <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-foreground/75 font-normal">
                                                                {med.dosage}
                                                            </span>
                                                        )}
                                                    </h5>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                                        {med.genericName ? `${med.genericName} • ` : ""}{med.category || "General Category"}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-mono bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20 font-bold">
                                                        DRAP Reg: {med.drapRegNumber || "Pending"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Batches Table */}
                                            {med.batches.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground italic pl-2">
                                                    No batches registered yet for this medicine.
                                                </p>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse text-[11px]">
                                                        <thead>
                                                            <tr className="border-b border-border/30 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                                                                <th className="py-2 px-3">Batch Number</th>
                                                                <th className="py-2 px-3">Manufacturing Date</th>
                                                                <th className="py-2 px-3">Expiry Date</th>
                                                                <th className="py-2 px-3 text-right">Quantity (Boxes)</th>
                                                                <th className="py-2 px-3 text-right">Generated Pills</th>
                                                                <th className="py-2 px-3 text-right">Scanned / Verified Pills</th>
                                                                <th className="py-2 px-3 text-center">Status</th>
                                                                <th className="py-2 px-3 text-center">Blockchain</th>
                                                                <th className="py-2 px-3 text-center">Report</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/20">
                                                            {med.batches.map((batch) => (
                                                                <tr key={batch.id} className="hover:bg-secondary/10 transition-colors">
                                                                    <td className="py-2 px-3 font-mono font-bold text-foreground">{batch.batchNumber}</td>
                                                                    <td className="py-2 px-3 text-muted-foreground">
                                                                        {new Date(batch.manufacturingDate).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-muted-foreground">
                                                                        {new Date(batch.expiryDate).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right font-medium">{batch.quantityBoxes.toLocaleString()}</td>
                                                                    <td className="py-2 px-3 text-right font-mono font-medium">{batch.totalPillsGenerated.toLocaleString()}</td>
                                                                    <td className="py-2 px-3 text-right font-mono font-medium text-success">
                                                                        {batch.verifiedPillsCount.toLocaleString()} / {batch.totalPillsCount.toLocaleString()}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                                            batch.status === "ACTIVE"
                                                                                ? "bg-success/10 text-success border border-success/20"
                                                                                : "bg-destructive/10 text-destructive border border-destructive/20"
                                                                        }`}>
                                                                            {batch.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                                            batch.blockchainStatus === "CONFIRMED"
                                                                                ? "bg-primary/10 text-primary border border-primary/20"
                                                                                : "bg-secondary text-muted-foreground"
                                                                        }`}>
                                                                            {batch.blockchainStatus}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center">
                                                                         <button
                                                                             onClick={() => setComplianceBatch({
                                                                                 batch,
                                                                                 medicine: med,
                                                                                 manufacturer: { companyName: report.companyName, licenseNumber: report.licenseNumber },
                                                                             })}
                                                                             title="View Compliance Report"
                                                                             className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                                                                         >
                                                                             <FileText className="h-3 w-3" /> Report
                                                                         </button>
                                                                     </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
            </>
        );
    }

    // ── List View ──

    return (
        <>
            {/* Confirmation Modal */}
            <AnimatePresence>
                {modal && (
                    <ConfirmModal
                        isOpen={!!modal}
                        title={
                            modal.type === "suspend"
                                ? `Remove ${modal.companyName}?`
                                : modal.type === "restore"
                                ? `Restore ${modal.companyName}?`
                                : `Revoke Verification for ${modal.companyName}?`
                        }
                        message={
                            modal.type === "suspend"
                                ? `Are you sure you want to remove ${modal.companyName}? They will be blocked from generating QR codes until restored.`
                                : modal.type === "restore"
                                ? `Are you sure you want to restore ${modal.companyName}? They will be able to generate QR codes again (if verified).`
                                : `Are you sure you want to revoke verification for ${modal.companyName}? They will need DRAP License re-approval to generate QR codes again.`
                        }
                        confirmLabel={
                            modal.type === "suspend"
                                ? "Yes, Remove"
                                : modal.type === "restore"
                                ? "Yes, Restore"
                                : "Yes, Revoke"
                        }
                        confirmVariant={modal.type === "restore" ? "default" : "destructive"}
                        isLoading={actionLoading}
                        onConfirm={handleConfirm}
                        onCancel={() => setModal(null)}
                    />
                )}
            </AnimatePresence>

            <div className="space-y-4">
                {/* Header + Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-[15px] font-semibold flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Registered Manufacturers
                        </h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                            Select a manufacturer to inspect registered pharmaceutical assets and QR code verification statistics
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold transition-all hover:bg-primary/90"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Create Manufacturer Account
                        </button>
                        <button
                            onClick={() => setShowSuspended((v) => !v)}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                                showSuspended
                                    ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
                                    : "border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                            }`}
                        >
                            <Ban className="h-3.5 w-3.5" />
                            {showSuspended ? "Showing Suspended Companies" : "Show Suspended Companies"}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm">Fetching manufacturer profiles...</p>
                    </div>
                ) : manufacturers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/5 p-8 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                        <p className="text-sm font-medium text-foreground/90">
                            {showSuspended ? "No Suspended Manufacturers" : "No Active Manufacturers"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {showSuspended
                                ? "There are currently no suspended manufacturer profiles."
                                : "There are currently no active manufacturer profiles in the database."}
                        </p>
                    </div>
                ) : (
                    <div className="card-premium overflow-hidden border-border/40">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-border/30 bg-secondary/10 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                                        <th className="py-3.5 px-4">Company Name</th>
                                        <th className="py-3.5 px-4">License Number</th>
                                        <th className="py-3.5 px-4 text-center">Status</th>
                                        <th className="py-3.5 px-4 text-right">Medicines</th>
                                        <th className="py-3.5 px-4 text-right">Total Batches</th>
                                        <th className="py-3.5 px-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {manufacturers.map((mfg) => (
                                        <tr
                                            key={mfg.id}
                                            onClick={() => setSelectedId(mfg.id)}
                                            className="hover:bg-secondary/20 cursor-pointer transition-colors"
                                        >
                                            <td className="py-3.5 px-4 font-bold text-foreground/95">
                                                <div className="flex items-center gap-2">
                                                    {mfg.companyName}
                                                    {mfg.isSuspended && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-destructive/10 text-destructive border border-destructive/20">
                                                            <Ban className="h-2.5 w-2.5" /> Suspended
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 font-mono text-muted-foreground">{mfg.licenseNumber}</td>
                                            <td className="py-3.5 px-4 text-center">
                                                {mfg.isSuspended ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                                                        <Ban className="h-3 w-3" /> Suspended
                                                    </span>
                                                ) : mfg.isVerified ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success border border-success/20">
                                                        <CheckCircle2 className="h-3 w-3" /> Verified
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/10 text-warning border border-warning/20">
                                                        <Clock className="h-3 w-3" /> Unverified
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-medium">{mfg.medicineCount}</td>
                                            <td className="py-3.5 px-4 text-right font-medium">{mfg.batchCount}</td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                    {mfg.isSuspended ? (
                                                        /* Suspended row: show Restore only */
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Restore manufacturer"
                                                            className="h-7 px-2 rounded-lg text-[10px] font-semibold text-success hover:bg-success/10 hover:text-success gap-1"
                                                            onClick={() =>
                                                                setModal({ type: "restore", id: mfg.id, companyName: mfg.companyName })
                                                            }
                                                        >
                                                            <RotateCcw className="h-3 w-3" /> Restore
                                                        </Button>
                                                    ) : (
                                                        /* Active row: Remove + Unverify (if verified) + drill-down */
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                title="Suspend manufacturer"
                                                                className="h-7 px-2 rounded-lg text-[10px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                                                                onClick={() =>
                                                                    setModal({ type: "suspend", id: mfg.id, companyName: mfg.companyName })
                                                                }
                                                            >
                                                                <Ban className="h-3 w-3" /> Remove
                                                            </Button>
                                                            {mfg.isVerified && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    title="Revoke verification"
                                                                    className="h-7 px-2 rounded-lg text-[10px] font-semibold text-warning hover:bg-warning/10 hover:text-warning gap-1"
                                                                    onClick={() =>
                                                                        setModal({ type: "unverify", id: mfg.id, companyName: mfg.companyName })
                                                                    }
                                                                >
                                                                    <ShieldOff className="h-3 w-3" /> Unverify
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="View details"
                                                        className="h-7 w-7 p-0 rounded-full hover:bg-secondary/40 text-primary"
                                                        onClick={() => setSelectedId(mfg.id)}
                                                    >
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Manufacturer Modal */}
            {showCreateModal && (
                <CreateManufacturerModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => { void loadManufacturers(showSuspended); }}
                />
            )}
        </>
    );
}
