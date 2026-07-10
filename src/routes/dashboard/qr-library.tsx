import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    QrCode, Download, Printer, Eye, Search, Filter, Package, Calendar,
    ShieldCheck, Hash, ChevronDown, ChevronRight, FileText, Archive,
    CheckCircle2, AlertTriangle, Clock, X, Pill, Box, ExternalLink,
    ArrowDown, ZoomIn, Loader2, Table
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DASH_NAV } from "@/config/nav";
import { ease } from "@/lib/motion";
import { DashShell } from "@/components/dashboard/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQRStore } from "@/store/qr-store";
import type { MedicineBatch, PillRecord } from "@/types/dual-qr";
import { QRCodeCanvas } from "qrcode.react";
import { PrintingService } from "@/services/printing/printing-service";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/qr-library")({
    head: () => ({
        meta: [
            { title: "QR Library — MediVerify" },
            { name: "description", content: "View and manage all previously generated QR codes and batch medicine records." },
        ],
    }),
    component: QRLibraryPage,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(raw: string) {
    if (!raw) return "N/A";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_CFG = {
    Active: { cls: "bg-success/10 text-success border-success/25", dot: "bg-success", label: "Active" },
    Recalled: { cls: "bg-destructive/10 text-destructive border-destructive/25", dot: "bg-destructive", label: "Recalled" },
    Expired: { cls: "bg-warning/10 text-warning-foreground border-warning/25", dot: "bg-warning", label: "Expired" },
};

// ── Detail Panel ──────────────────────────────────────────────────────────────

function BatchDetailPanel({
    batch: initialBatch,
    onClose,
}: {
    batch: MedicineBatch;
    onClose: () => void;
}) {
    const [batch, setBatch] = useState<MedicineBatch>(initialBatch);
    const [batchPills, setBatchPills] = useState<PillRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const status = STATUS_CFG[batch.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.Active;

    useEffect(() => {
        const fetchFullDetails = async () => {
            setIsLoading(true);
            try {
                const sessionStr = localStorage.getItem("mediverify_session") || sessionStorage.getItem("mediverify_session");
                const token = sessionStr ? JSON.parse(sessionStr).token : "";

                const res = await fetch(`/api/manufacturer/batch/${initialBatch.id}?all=true`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await res.json();

                if (data.success) {
                    const b = data.data;
                    setBatch({
                        ...initialBatch,
                        txHash: b.txHash || initialBatch.txHash,
                        qrGenerationStatus: (b.blockchainStatus || "completed").toLowerCase(),
                        totalPills: b._count?.pills ?? b.totalPillsGenerated ?? initialBatch.totalPills,
                        cartons: Array.isArray(b.cartons) ? b.cartons.map((c: any) => ({
                            id: c.id,
                            cartonNumber: c.cartonNumber,
                            qrCode: c.qrCode,
                            boxesCount: c.boxesCount ?? 0,
                        })) : initialBatch.cartons ?? [],
                        boxes: Array.isArray(b.boxes) ? b.boxes.map((bx: any) => ({
                            id: bx.id,
                            boxNumber: bx.boxNumber,
                            qrCode: bx.qrCode,
                            pillsCount: bx.pillsCount ?? 0,
                        })) : initialBatch.boxes ?? [],
                    });

                    if (b.pills) {
                        setBatchPills(b.pills.map((p: any) => ({
                            id: p.id,
                            medicineId: b.id,
                            pillNumber: p.pillNumber,
                            qrStatus: p.qrStatus?.toLowerCase() || "active",
                            pillQrCode: p.qrCode
                        })));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch batch pills:", err);
                toast.error("Failed to load full pill records.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchFullDetails();
    }, [initialBatch.id]);

    const downloadBoxPdf = async () => {
        if (!batch.boxes || batch.boxes.length === 0) {
            toast.error("No boxes found for this batch yet.");
            return;
        }
        const t = toast.loading("Generating All Box QRs Sheet PDF…");
        try {
            const blob = await PrintingService.generateBoxQrSheetPdf(batch, batch.boxes as { id: string; boxNumber: string; qrCode: string }[]);
            saveAs(blob, `AllBoxQRs_${batch.batchNumber}.pdf`);
            toast.dismiss(t);
            toast.success("All Box QRs Sheet downloaded!");
        } catch {
            toast.dismiss(t);
            toast.error("PDF generation failed");
        }
    };

    const downloadCartonSheetPdf = async () => {
        if (!batch.cartons || batch.cartons.length === 0) {
            toast.error("No cartons generated for this batch yet.");
            return;
        }
        const t = toast.loading("Generating All Carton QRs Sheet PDF…");
        try {
            const blob = await PrintingService.generateCartonQrSheetPdf(batch, batch.cartons as { id: string; cartonNumber: string; qrCode: string }[]);
            saveAs(blob, `AllCartonQRs_${batch.batchNumber}.pdf`);
            toast.dismiss(t);
            toast.success("All Carton QRs Sheet downloaded!");
        } catch {
            toast.dismiss(t);
            toast.error("PDF generation failed");
        }
    };


    const downloadPillSheetPdf = async () => {
        const pillCount = batch.totalPills || batchPills.length;
        const isLarge = pillCount > 1000;
        const sessionStr = localStorage.getItem("mediverify_session") || sessionStorage.getItem("mediverify_session");
        const token = sessionStr ? JSON.parse(sessionStr).token : "";

        const t = toast.loading(isLarge
            ? `Generating Industrial Sheet (${pillCount.toLocaleString()} pills)... Please wait, do not close.`
            : "Generating Pill Sheet PDF…");
        try {
            if (isLarge) {
                // 1. Initial Request (Triggers generation on server)
                // Fire and forget to start the process
                fetch(`/api/manufacturer/batch/${batch.id}?download=pdf`, {
                    headers: { "Authorization": `Bearer ${token}` }
                }).catch(() => { });

                // 2. Polling Loop
                let isReady = false;
                let attempts = 0;
                while (!isReady && attempts < 120) { // Max 10 mins
                    await new Promise(r => setTimeout(r, 5000)); // Poll every 5s
                    const res = await fetch(`/api/manufacturer/batch/${batch.id}?download=pdf&check=true`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.ready) isReady = true;
                    attempts++;
                    if (attempts % 6 === 0) toast.message(`Still processing... (${attempts * 5}s)`, { id: t });
                }

                if (!isReady) throw new Error("Server timeout");

                // 3. Final Fetch (Instant from Cache)
                const res = await fetch(`/api/manufacturer/batch/${batch.id}?download=pdf`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const blob = await res.blob();
                saveAs(blob, `PillSheet_${batch.batchNumber}.pdf`);
            } else {
                // ── FIX: Fetch ALL pills on-demand before generating client-side PDF ──
                // The initial fetchFullDetails only loads 50 pills (server default),
                // so batchPills may be empty or incomplete → blank sheet.
                let pillsForSheet = batchPills;
                if (pillsForSheet.length === 0 || pillsForSheet.length < pillCount) {
                    toast.loading("Loading all pill records…", { id: t });
                    const res = await fetch(`/api/manufacturer/batch/${batch.id}?all=true`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data.success && data.data.pills?.length) {
                        pillsForSheet = data.data.pills.map((p: any) => ({
                            id: p.id,
                            medicineId: batch.id,
                            pillNumber: p.pillNumber,
                            qrStatus: p.qrStatus?.toLowerCase?.() || p.status?.toLowerCase?.() || "active",
                            pillQrCode: p.qrCode,
                        }));
                        // Also update local state so subsequent downloads are instant
                        setBatchPills(pillsForSheet);
                    }
                }

                if (pillsForSheet.length === 0) {
                    throw new Error("No pill records found for this batch.");
                }

                toast.loading(`Rendering ${pillsForSheet.length.toLocaleString()} QR codes…`, { id: t });
                const blob = await PrintingService.generatePillQrSheetPdf(batch, pillsForSheet);
                saveAs(blob, `PillSheet_${batch.batchNumber}.pdf`);
            }
            toast.dismiss(t);
            toast.success("Pill Sheet downloaded!");
        } catch (err) {
            toast.dismiss(t);
            toast.error(err instanceof Error ? err.message : "Generation failed. Please try again in 1 minute.");
        }
    };

    const downloadFullRegistryCsv = async () => {
        const t = toast.loading("Preparing Data Registry CSV...");
        try {
            const sessionStr = localStorage.getItem("mediverify_session") || sessionStorage.getItem("mediverify_session");
            const token = sessionStr ? JSON.parse(sessionStr).token : "";

            const response = await fetch(`/api/manufacturer/batch/${batch.id}?download=csv`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Export failed");
            const blob = await response.blob();
            saveAs(blob, `BatchRegistry_${batch.batchNumber}.csv`);
            toast.dismiss(t);
            toast.success("Registry CSV downloaded!");
        } catch {
            toast.dismiss(t);
            toast.error("CSV Export failed");
        }
    };

    const downloadCompliancePdf = async () => {
        const t = toast.loading("Generating Compliance Report…");
        try {
            const pillCount = batch.totalPills || batchPills.length;
            const blob = await PrintingService.generateBatchCompliancePdf(batch, pillCount);
            saveAs(blob, `ComplianceReport_${batch.batchNumber}.pdf`);
            toast.dismiss(t);
            toast.success("Compliance PDF downloaded!");
        } catch {
            toast.dismiss(t);
            toast.error("PDF generation failed");
        }
    };



    return (
        <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease }}
            className="fixed inset-y-0 right-0 z-50 w-full md:max-w-xl bg-card border-l border-border/50 shadow-2xl overflow-y-auto"
        >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-card/95 backdrop-blur px-6 py-4">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Batch Details</p>
                    <h2 className="text-[17px] font-bold mt-0.5">{batch.medicineName}</h2>
                </div>
                <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl border border-border/50 bg-secondary/40 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="p-6 space-y-6">
                {/* Status + Batch ID */}
                <div className="flex items-center justify-between">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold", status.cls)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                        {status.label}
                    </span>
                    <span className="font-mono text-[12px] text-muted-foreground bg-secondary/40 px-3 py-1 rounded-lg">{batch.batchNumber}</span>
                </div>


                {/* Medicine Details */}
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 space-y-3">
                    <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Medicine Details</h3>
                    {[
                        { label: "Medicine Name", value: batch.medicineName },
                        { label: "Category", value: batch.productCategory || "Pharmaceutical" },
                        { label: "Manufacturer Code", value: batch.manufacturerCode },
                        { label: "DRAP License", value: batch.drapLicense },
                        { label: "Manufacturing Date", value: formatDate(batch.manufacturingDate) },
                        { label: "Expiry Date", value: formatDate(batch.expiryDate) },
                        { label: "Qty (Boxes)", value: (batch.quantityBoxes ?? 0).toLocaleString() },
                        { label: "Pills Per Box", value: (batch.totalPillsPerBox ?? 0).toString() },
                        { label: "Total Pills", value: (batch.totalPills ?? 0).toLocaleString() },
                        { label: "Generation Status", value: (batch.qrGenerationStatus || "completed").toUpperCase() },
                        { label: "Registered On", value: formatDate(batch.createdAt) },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                            <span className="text-[12px] text-muted-foreground">{label}</span>
                            <span className="text-[12px] font-semibold text-right max-w-[55%] truncate">{value || "N/A"}</span>
                        </div>
                    ))}
                </div>

                {/* Blockchain */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                    <h3 className="text-[12px] font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
                        <Hash className="h-3.5 w-3.5" /> Blockchain Anchor
                    </h3>
                    <p className="font-mono text-[11px] text-primary/80 break-all leading-relaxed">{batch.txHash || "PENDING"}</p>
                </div>

                {/* Pill records preview */}
                {batchPills.length > 0 && (
                    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Pill Records ({batchPills.length.toLocaleString()} total)</h3>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {batchPills.slice(0, 20).map((pill) => (
                                <div key={pill.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                                    <span className="font-mono text-[11px] text-muted-foreground">#{pill.pillNumber}</span>
                                    <span className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                        pill.qrStatus === "active" ? "bg-success/10 text-success" :
                                            pill.qrStatus === "suspected" ? "bg-warning/10 text-warning-foreground" :
                                                "bg-destructive/10 text-destructive"
                                    )}>{pill.qrStatus}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground/60 max-w-[120px] truncate">{pill.pillQrCode}</span>
                                </div>
                            ))}
                            {batchPills.length > 20 && (
                                <p className="text-[11px] text-muted-foreground text-center pt-2">
                                    + {(batchPills.length - 20).toLocaleString()} more pill records…
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Export / Download Actions */}
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 space-y-2">
                    <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Export Options</h3>
                    <Button className="w-full rounded-xl h-10 gap-2 text-[13px] bg-gradient-primary shadow-elegant" onClick={downloadBoxPdf}>
                        <FileText className="h-4 w-4" /> Download All Box QRs (Sheet PDF)
                    </Button>
                    <Button variant="outline" className="w-full rounded-xl h-10 gap-2 text-[13px]" onClick={downloadCartonSheetPdf}>
                        <Archive className="h-4 w-4" /> Download All Carton QRs (Sheet PDF)
                    </Button>
                    <Button variant="outline" className="w-full rounded-xl h-10 gap-2 text-[13px]" onClick={downloadPillSheetPdf}>
                        <ArrowDown className="h-4 w-4" /> Download Pill QR Sheet PDF
                    </Button>
                    <Button variant="outline" className="w-full rounded-xl h-10 gap-2 text-[13px]" onClick={downloadCompliancePdf}>
                        <ShieldCheck className="h-4 w-4" /> Download Compliance Report PDF
                    </Button>
                    <Button variant="outline" className="w-full rounded-xl h-10 gap-2 text-[13px] border-primary/30 hover:bg-primary/5" onClick={downloadFullRegistryCsv}>
                        <Table className="h-4 w-4 text-primary" /> Download Complete Data Registry (CSV)
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

// ── Batch Card ────────────────────────────────────────────────────────────────

function BatchCard({ batch, pills, onClick }: { batch: MedicineBatch; pills: PillRecord[]; onClick: () => void }) {
    const batchPills = pills.filter((p) => p.medicineId === batch.id);
    const status = STATUS_CFG[batch.status] ?? STATUS_CFG.Active;
    const suspectedCount = batchPills.filter((p) => p.qrStatus === "suspected").length;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="card-premium group relative overflow-hidden cursor-pointer hover:shadow-card-hover transition-all duration-300"
            onClick={onClick}
        >
            {/* Ambient glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

            <div className="p-5">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                            <QrCode className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[14px] font-bold truncate">{batch.medicineName}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">{batch.batchNumber}</p>
                        </div>
                    </div>
                    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold", status.cls)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                        {status.label}
                    </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                        { icon: Package, label: "Boxes", value: (batch.quantityBoxes ?? 0).toLocaleString() },
                        { icon: Archive, label: "Cartons", value: (batch.cartonsCount ?? 0).toLocaleString() },
                        { icon: Pill, label: "Pills", value: (batch.totalPills ?? 0).toLocaleString() },
                        { icon: suspectedCount > 0 ? AlertTriangle : CheckCircle2, label: "Alerts", value: suspectedCount.toString(), tone: suspectedCount > 0 ? "text-warning-foreground" : "text-success" },
                    ].map(({ icon: Icon, label, value, tone }) => (
                        <div key={label} className="rounded-xl bg-secondary/30 p-2.5 text-center">
                            <Icon className={cn("h-3.5 w-3.5 mx-auto mb-1", tone || "text-muted-foreground")} />
                            <p className="text-[13px] font-bold tabular-nums">{value}</p>
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Dates */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30 pt-3">
                    <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Mfg: {formatDate(batch.manufacturingDate)}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Exp: {formatDate(batch.expiryDate)}
                    </span>
                </div>
            </div>

            {/* Footer CTA */}
            <div className="border-t border-border/30 px-5 py-3 flex items-center justify-between bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                <span className="text-[11px] text-muted-foreground">Registered {formatDate(batch.createdAt)}</span>
                <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                    View Details <ChevronRight className="h-3.5 w-3.5" />
                </span>
            </div>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function QRLibraryPage() {
    const { user, isAuthenticated, signOut, isLoading } = useAuth();
    const { batches, pills, setBatches } = useQRStore();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Recalled" | "Expired">("All");
    const [selectedBatch, setSelectedBatch] = useState<MedicineBatch | null>(null);
    const [isLoadingBatches, setIsLoadingBatches] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        const loadBatches = async () => {
            if (!isAuthenticated || user?.role !== "manufacturer") return;

            setIsLoadingBatches(true);
            setFetchError(null);

            try {
                const raw =
                    typeof window !== "undefined"
                        ? localStorage.getItem("mediverify_session")
                        : null;
                const token = raw ? (() => { try { return JSON.parse(raw)?.token; } catch { return null; } })() : null;

                const res = await fetch("/api/manufacturer/batches", {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setFetchError(err.message || "Failed to load batches.");
                    return;
                }

                const data = await res.json();
                const fetchedBatches: any[] = data?.data?.batches ?? data?.data ?? [];

                if (Array.isArray(fetchedBatches) && fetchedBatches.length > 0) {
                    // Map API batches to the store shape
                    const newBatches = fetchedBatches.map((b: any) => ({
                        id: b.id,
                        batchNumber: b.batchNumber,
                        medicineName: b.medicine?.name ?? "Unknown",
                        status: (b.medicineStatus === "MANUFACTURED" ? "Active" :
                            b.medicineStatus === "RECALLED" ? "Recalled" :
                                b.medicineStatus === "EXPIRED" ? "Expired" :
                                    b.status === "ACTIVE" ? "Active" :
                                        b.status === "RECALLED" ? "Recalled" :
                                            b.status === "EXPIRED" ? "Expired" : "Active") as "Active" | "Recalled" | "Expired",
                        createdAt: b.createdAt,
                        quantityBoxes: b.quantityBoxes ?? 0,
                        totalPills: b.totalPillsGenerated ?? 0,
                        totalPillsPerBox: b.pillsPerBox ?? 0,
                        manufacturingDate: b.manufacturingDate,
                        expiryDate: b.expiryDate,
                        productCategory: b.category || "Pharmaceutical",
                        manufacturerCode: b.medicine?.manufacturer?.companyName?.substring(0, 3)?.toUpperCase() || "MFG",
                        drapLicense: b.medicine?.manufacturer?.licenseNumber || "DRAP-LIC-001",
                        txHash: b.txHash || "0x" + "0".repeat(40),
                        qrGenerationStatus: b.blockchainStatus?.toLowerCase() || "completed",
                        boxQrCode: b.boxQRCode || `BOX-${b.batchNumber}-MFG`,
                        boxQrScanned: false,
                        boxesPerCarton: b.boxesPerCarton || 10,
                        cartonsCount: b._count?.cartons ?? 0,
                    }));

                    // Server data always wins: overwrite existing store entries by ID so that
                    // fields added later (e.g. cartonsCount) are never stale from registration time.
                    const newBatchMap = new Map(newBatches.map(nb => [nb.id, nb]));
                    const merged = [
                        ...newBatches,
                        ...batches.filter(eb => !newBatchMap.has(eb.id)),
                    ];
                    setBatches(merged);
                }
            } catch (err) {
                console.error("Fetch error:", err);
                setFetchError("Network error. Could not load batches.");
            } finally {
                setIsLoadingBatches(false);
            }
        };

        loadBatches();
    }, [isAuthenticated, user?.role, setBatches]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated) return <Navigate to="/auth/login" />;
    if (user?.role !== "manufacturer") return <Navigate to="/auth/login" />;

    const filtered = batches.filter((b) => {
        const matchSearch =
            b.medicineName.toLowerCase().includes(search.toLowerCase()) ||
            b.batchNumber.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "All" || b.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalPills = batches.reduce((acc, b) => acc + (b.totalPills ?? 0), 0);
    const activeBatches = batches.filter((b) => (b.status ?? "Active") === "Active").length;
    const suspectedPills = pills.filter((p) => p.qrStatus === "suspected").length;

    return (
        <DashShell
            title="QR Library"
            subtitle="All previously generated QR codes and batch records"
            badge={`${batches.length} Batches`}
            nav={DASH_NAV}
        >
            {/* ── Stats ── */}
            <div className="grid gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { icon: Archive, label: "Total Batches", value: batches.length, color: "text-primary", bg: "bg-primary/10" },
                    { icon: Package, label: "Active Batches", value: activeBatches, color: "text-success", bg: "bg-success/10" },
                    { icon: Pill, label: "Total Pills", value: totalPills.toLocaleString(), color: "text-foreground", bg: "bg-secondary/60" },
                    { icon: AlertTriangle, label: "Suspected Pills", value: suspectedPills, color: "text-warning-foreground", bg: "bg-warning/10" },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                    <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease }}
                        className="card-premium p-5 flex items-center gap-4"
                    >
                        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", bg)}>
                            <Icon className={cn("h-5 w-5", color)} />
                        </div>
                        <div>
                            <p className={cn("text-[22px] font-black tabular-nums", color)}>{value}</p>
                            <p className="text-[11px] text-muted-foreground">{label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Search & Filter ── */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        id="qr-library-search"
                        placeholder="Search by medicine name or batch code…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-10 rounded-xl text-[13px] bg-secondary/20 border-border/40"
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                    {(["All", "Active", "Recalled", "Expired"] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                "rounded-full px-3 py-1.5 text-[12px] font-medium border transition-all duration-150",
                                statusFilter === s
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            )}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {isLoadingBatches && (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading batches…</span>
                </div>
            )}

            {fetchError && !isLoadingBatches && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-6">
                    ⚠ {fetchError}
                </div>
            )}

            {/* ── Grid ── */}
            {filtered.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-28 text-center"
                >
                    <div className="grid h-20 w-20 place-items-center rounded-2xl bg-secondary/30 mb-5">
                        <QrCode className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-[18px] font-bold mb-2">
                        {batches.length === 0 ? "No QR codes generated yet" : "No results found"}
                    </h3>
                    <p className="text-[14px] text-muted-foreground max-w-sm">
                        {batches.length === 0
                            ? "Register a batch from the Manufacturer Dashboard to start generating QR codes. They will all appear here."
                            : "Try adjusting your search or filter criteria."}
                    </p>
                </motion.div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((batch) => (
                        <BatchCard
                            key={batch.id}
                            batch={batch}
                            pills={pills}
                            onClick={() => setSelectedBatch(batch)}
                        />
                    ))}
                </div>
            )}

            {/* ── Detail Side Panel ── */}
            <AnimatePresence>
                {selectedBatch && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
                            onClick={() => setSelectedBatch(null)}
                        />
                        <BatchDetailPanel
                            batch={selectedBatch}
                            onClose={() => setSelectedBatch(null)}
                        />
                    </>
                )}
            </AnimatePresence>
        </DashShell>
    );
}
