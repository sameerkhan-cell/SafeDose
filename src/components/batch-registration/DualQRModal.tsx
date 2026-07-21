import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, AlertCircle, ArrowLeft, Link2, AlertTriangle, CheckCircle, Info, QrCode, ChevronRight,
    X, Pill, Layers, Hash, Calendar, Package, Building2, FileDigit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ease } from "@/lib/motion";
import { useBatchGeneration } from "@/hooks/useBatchGeneration";
import { QRGenerationProgress } from "@/components/qr/QRGenerationProgress";
import { DualQRCard } from "@/components/qr/DualQRCard";
import { DownloadCenter } from "@/components/download-center/DownloadCenter";
import type { BatchRegistrationForm } from "@/types/dual-qr";
import { exportQRCanvasToPng, triggerDownload } from "@/services/qr/qr-generator";

type ModalStep = "form" | "generating" | "result" | "downloads";

const DRAP_DEFAULT = "DRAP-MFG-2024-GSK-001";
const MFG_CODE_DEFAULT = "GSK";

interface Props {
    open: boolean;
    onClose: () => void;
    initialValues?: {
        category?: string;
        boxes?: number;
        pillsPerBox?: number;
    };
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">
            {children}
        </label>
    );
}

function FieldRow({ icon: Icon, label, children }: { icon: React.ElementType; label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/70">
                <Icon className="h-3 w-3" />
                {label}
            </label>
            {children}
        </div>
    );
}

export function DualQRModal({ open, onClose, initialValues }: Props) {
    const [step, setStep] = useState<ModalStep>("form");
    const [form, setForm] = useState<BatchRegistrationForm>({
        medicineName: "",
        batchNumber: "",
        productCategory: initialValues?.category ?? "Pharmaceutical",
        manufacturingDate: new Date().toISOString().slice(0, 7),
        expiryDate: "2027-03",
        quantityBoxes: initialValues?.boxes ?? 100,
        totalPillsPerBox: initialValues?.pillsPerBox ?? 20,
        totalCartons: 10,
        manufacturerCode: MFG_CODE_DEFAULT,
        drapLicense: DRAP_DEFAULT,
    });

    const { progress, result, error, isGenerating, generate, reset } = useBatchGeneration();
    const boxQrRef = useRef<HTMLDivElement>(null);

    const set = (key: keyof BatchRegistrationForm, val: string | number) =>
        setForm((f) => ({ ...f, [key]: val }));

    const totalPills = form.quantityBoxes * form.totalPillsPerBox;
    const canGenerate = form.medicineName.trim().length > 0 && form.quantityBoxes > 0 && form.totalPillsPerBox > 0 && form.totalCartons > 0 && form.totalCartons <= form.quantityBoxes;

    // Live math calculations
    const quantityBoxes = form.quantityBoxes || 0;
    const pillsPerBox = form.totalPillsPerBox || 0;
    const totalCartons = Math.max(1, form.totalCartons || 1);

    const totalPillsCalc = quantityBoxes * pillsPerBox;
    const baseBoxesPerCarton = Math.floor(quantityBoxes / totalCartons);
    const cartonsWithExtra = quantityBoxes % totalCartons; // how many cartons get +1 box to absorb the remainder

    const handleGenerate = async () => {
        setStep("generating");
        const success = await generate(form);
        if (success) {
            setStep("result");
        } else {
            setStep("form");
        }
    };

    const handleClose = () => {
        reset();
        setStep("form");
        onClose();
    };

    const handleReset = () => {
        reset();
        setStep("form");
        setForm({
            medicineName: "",
            batchNumber: "",
            productCategory: "Pharmaceutical",
            manufacturingDate: new Date().toISOString().slice(0, 7),
            expiryDate: "2027-03",
            quantityBoxes: 100,
            totalPillsPerBox: 20,
            totalCartons: 10,
            manufacturerCode: MFG_CODE_DEFAULT,
            drapLicense: DRAP_DEFAULT,
        });
    };

    const handleCartonDownload = useCallback((canvas: HTMLCanvasElement) => {
        const dataUrl = exportQRCanvasToPng(
            canvas,
            result?.batch.cartons?.[0]?.qrCode ?? "",
            `MediVerify · ${result?.batch.medicineName ?? ""} · Carton`
        );
        triggerDownload(dataUrl, `MediVerify-CartonQR-${result?.batch.batchNumber ?? "batch"}.png`);
    }, [result]);

    const handleBoxDownload = useCallback((canvas: HTMLCanvasElement) => {
        const dataUrl = exportQRCanvasToPng(
            canvas,
            result?.batch.boxes?.[0]?.qrCode || result?.batch.boxQrCode || "",
            `MediVerify · ${result?.batch.medicineName ?? ""} · Box`
        );
        triggerDownload(dataUrl, `MediVerify-BoxQR-${result?.batch.batchNumber ?? "batch"}.png`);
    }, [result]);

    const handlePillDownload = useCallback((canvas: HTMLCanvasElement) => {
        const dataUrl = exportQRCanvasToPng(
            canvas,
            result?.pills[0]?.pillQrCode ?? "",
            `MediVerify · ${result?.batch.medicineName ?? ""} · Pill`
        );
        triggerDownload(dataUrl, `MediVerify-SamplePillQR-${result?.batch.batchNumber ?? "batch"}.png`);
    }, [result]);

    const handleDownloadPng = (canvas: HTMLCanvasElement, type: string) => {
        if (type === "Carton") handleCartonDownload(canvas);
        else if (type === "Box") handleBoxDownload(canvas);
        else if (type === "Pill") handlePillDownload(canvas);
    };

    const stepTitles: Record<ModalStep, { title: string; sub: string }> = {
        form: { title: "Register Batch + Generate Dual QR", sub: "Box QR & per-pill QR codes for Pakistan-style dispensing" },
        generating: { title: "Generating Dual QR Architecture", sub: "Please wait — minting on MediVerify blockchain…" },
        result: { title: "Dual QR System Ready", sub: `${result?.totalPillsGenerated?.toLocaleString() ?? 0} pill QRs + 1 box QR generated` },
        downloads: { title: "Download Center", sub: "Export all QR codes and batch documentation" },
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        onClick={step === "generating" ? undefined : handleClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Modal */}
                    <motion.div
                        className="relative w-full max-w-2xl rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
                        initial={{ opacity: 0, scale: 0.94, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 24 }}
                        transition={{ duration: 0.35, ease }}
                    >
                        {/* Ambient gradient top */}
                        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/8 to-transparent pointer-events-none" />
                        <div className="absolute inset-0 holo opacity-20 pointer-events-none" />

                        {/* Header */}
                        <div className="relative z-10 flex items-center gap-4 border-b border-border/40 px-6 py-4 shrink-0">
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-elegant">
                                <QrCode className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-[15px] font-bold leading-snug truncate">
                                    {stepTitles[step].title}
                                </h2>
                                <p className="text-[11px] text-muted-foreground truncate">
                                    {stepTitles[step].sub}
                                </p>
                            </div>

                            {/* Step pills */}
                            <div className="hidden sm:flex items-center gap-1.5 mr-2">
                                {(["form", "generating", "result", "downloads"] as ModalStep[]).map((s, i) => (
                                    <div
                                        key={s}
                                        className={`h-1.5 rounded-full transition-all duration-400 ${s === step ? "w-5 bg-primary" :
                                            (["form", "generating", "result", "downloads"].indexOf(step) > i) ? "w-2 bg-success" :
                                                "w-2 bg-border"
                                            }`}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={step === "generating" ? undefined : handleClose}
                                disabled={step === "generating"}
                                className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary transition-colors disabled:opacity-30 shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Body (scrollable) */}
                        <div className="relative z-10 flex-1 overflow-y-auto px-6 py-5">
                            <AnimatePresence mode="wait">

                                {/* ── STEP 1: Form ─────────────────────────────────────────── */}
                                {step === "form" && (
                                    <motion.div
                                        key="form"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.28, ease }}
                                        className="space-y-5"
                                    >


                                        {/* Medicine Name */}
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <FieldRow icon={Pill} label={<>Medicine Name <span className="text-destructive">*</span></>}>
                                                <Input
                                                    value={form.medicineName}
                                                    onChange={(e) => set("medicineName", e.target.value)}
                                                    placeholder="e.g. Panadol Extra 500mg"
                                                    className="h-11 rounded-xl text-[14px] bg-secondary/20"
                                                    autoFocus
                                                />
                                            </FieldRow>
                                            <FieldRow icon={Layers} label="Product Category">
                                                <select
                                                    value={form.productCategory}
                                                    onChange={(e) => set("productCategory", e.target.value)}
                                                    className="flex h-11 w-full rounded-xl border border-input bg-secondary/20 px-3 py-2 text-[14px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                                                >
                                                    <option>Pharmaceutical</option>
                                                    <option>Vaccine</option>
                                                    {/* <option>Nutraceutical</option>
                                                    <option>Biological</option> */}
                                                </select>
                                            </FieldRow>
                                        </div>

                                        {/* Batch Number */}
                                        <FieldRow icon={Hash} label="Batch Number (leave blank to auto-generate)">
                                            <Input
                                                value={form.batchNumber}
                                                onChange={(e) => set("batchNumber", e.target.value)}
                                                placeholder="e.g. PND2024-A1 (auto if blank)"
                                                className="h-11 rounded-xl text-[14px] bg-secondary/20 font-mono"
                                            />
                                        </FieldRow>

                                        {/* Dates row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <FieldRow icon={Calendar} label="Manufacturing Date">
                                                <Input
                                                    type="month"
                                                    value={form.manufacturingDate}
                                                    onChange={(e) => set("manufacturingDate", e.target.value)}
                                                    className="h-11 rounded-xl text-[14px] bg-secondary/20"
                                                />
                                            </FieldRow>
                                            <FieldRow icon={Calendar} label="Expiry Date">
                                                <Input
                                                    type="month"
                                                    value={form.expiryDate}
                                                    onChange={(e) => set("expiryDate", e.target.value)}
                                                    className="h-11 rounded-xl text-[14px] bg-secondary/20"
                                                />
                                            </FieldRow>
                                        </div>

                                        {/* Quantity + Pills Per Box + Boxes Per Carton */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <FieldRow icon={Package} label="Quantity (Boxes)">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={100000}
                                                    value={form.quantityBoxes}
                                                    onChange={(e) => set("quantityBoxes", Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="h-11 rounded-xl text-[14px] bg-secondary/20 px-3"
                                                />
                                            </FieldRow>
                                            <FieldRow icon={Layers} label="Pills Per Box">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={1000}
                                                    value={form.totalPillsPerBox}
                                                    onChange={(e) => set("totalPillsPerBox", Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="h-11 rounded-xl text-[14px] bg-secondary/20 px-3"
                                                />
                                            </FieldRow>
                                            <FieldRow icon={Hash} label="Total Cartons">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={form.quantityBoxes}
                                                    value={form.totalCartons}
                                                    onChange={(e) => set("totalCartons", Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="h-11 rounded-xl text-[14px] bg-secondary/20 px-3"
                                                />
                                            </FieldRow>
                                        </div>

                                        {/* Pill count preview Expanded */}
                                        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-foreground/80 flex items-center gap-1.5">
                                                    <Link2 className="h-3.5 w-3.5" /> Total Pill QRs to generate:
                                                </span>
                                                <span className="font-bold text-green-600 text-lg">{totalPills.toLocaleString()}</span>
                                            </div>

                                            <div className="h-px bg-green-500/20" />

                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cartons</p>
                                                    <p className="text-sm font-semibold text-foreground/90">{totalCartons}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Boxes</p>
                                                    <p className="text-sm font-semibold text-foreground/90">{quantityBoxes}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pills</p>
                                                    <p className="text-sm font-semibold text-foreground/90">{totalPills.toLocaleString()}</p>
                                                </div>
                                            </div>

                                            {quantityBoxes > 0 && totalCartons > 0 && (
                                                <div className="flex items-start gap-1.5 pt-1 text-[11px] text-foreground/70 bg-secondary/30 rounded-lg px-2.5 py-1.5">
                                                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                    <span>
                                                        {cartonsWithExtra > 0 ? (
                                                            <>
                                                                {cartonsWithExtra} carton{cartonsWithExtra !== 1 ? "s" : ""} will have {baseBoxesPerCarton + 1} boxes,
                                                                {" "}{totalCartons - cartonsWithExtra} carton{(totalCartons - cartonsWithExtra) !== 1 ? "s" : ""} will have {baseBoxesPerCarton} boxes.
                                                            </>
                                                        ) : (
                                                            <>Each of the {totalCartons} carton{totalCartons !== 1 ? "s" : ""} will have exactly {baseBoxesPerCarton} boxes.</>
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            {quantityBoxes > 0 && quantityBoxes < totalCartons && (
                                                <div className="flex items-start gap-1.5 pt-1 text-[11px] text-red-600 bg-red-500/10 rounded-lg px-2.5 py-1.5">
                                                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                    <span>Total Cartons cannot exceed total Boxes. Reduce cartons or increase boxes.</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Manufacturer row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <FieldRow icon={Building2} label="Manufacturer Code">
                                                <Input
                                                    value={form.manufacturerCode}
                                                    onChange={(e) => set("manufacturerCode", e.target.value.toUpperCase())}
                                                    placeholder="e.g. GSK"
                                                    className="h-11 rounded-xl text-[14px] bg-secondary/20 font-mono uppercase"
                                                    maxLength={10}
                                                />
                                            </FieldRow>
                                            <FieldRow icon={FileDigit} label="DRAP License">
                                                <Input
                                                    value={form.drapLicense}
                                                    readOnly
                                                    className="h-11 rounded-xl text-[14px] bg-secondary/30 font-mono text-muted-foreground cursor-not-allowed"
                                                />
                                            </FieldRow>
                                        </div>

                                        {/* QR preview labels */}
                                        <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 space-y-2">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">QR Code Preview</p>
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground mb-1">Box QR</p>
                                                    <p className="font-mono text-[11px] font-bold text-primary break-all">
                                                        BOX-{form.batchNumber || "[AUTO]"}-{form.manufacturerCode || "CODE"}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground mb-1">Sample Pill QR</p>
                                                    <p className="font-mono text-[11px] font-bold text-success break-all">
                                                        PILL-{form.batchNumber || "[AUTO]"}-001-{form.manufacturerCode || "CODE"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* ── STEP 2: Generating ───────────────────────────────────── */}
                                {step === "generating" && (
                                    <motion.div
                                        key="generating"
                                        initial={{ opacity: 0, scale: 0.96 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.96 }}
                                        transition={{ duration: 0.28, ease }}
                                    >
                                        <QRGenerationProgress progress={progress} />
                                    </motion.div>
                                )}

                                {/* ── STEP 3: Result ───────────────────────────────────────── */}
                                <div className={step === "result" ? "block" : "hidden"}>
                                    {result && (
                                        <motion.div
                                            key="result"
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-5"
                                        >
                                            {/* Success banner */}
                                            <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/8 px-4 py-3.5">
                                                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                                                <div>
                                                    <p className="text-[14px] font-bold text-success">Hierarchical QR System Ready!</p>
                                                    <p className="text-[11px] text-foreground/70">
                                                        Batch <span className="font-mono font-semibold">{result.batch.batchNumber}</span> · {result.batch.cartons?.length || form.totalCartons} cartons · {result.batch.quantityBoxes} boxes · {result.totalPillsGenerated.toLocaleString()} pills
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Dual QR Cards */}
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                                {/* Carton QR */}
                                                <DualQRCard
                                                    type="carton"
                                                    qrValue={result.batch.cartons?.[0]?.qrCode || ""}
                                                    label={`Carton #001 of ${result.batch.cartons?.length || 0}`}
                                                    sublabel={`${result.batch.cartons?.length || 0} cartons Generated`}
                                                    badge="Shipment Unit"
                                                    onDownloadPng={(canvas) => handleDownloadPng(canvas, "Carton")}
                                                />

                                                {/* Box QR */}
                                                <div ref={boxQrRef}>
                                                    <DualQRCard
                                                        type="box"
                                                        qrValue={result.batch.boxes?.[0]?.qrCode || result.batch.boxQrCode}
                                                        label={`Box #001 of ${result.batch.quantityBoxes}`}
                                                        sublabel={`Batch: ${result.batch.batchNumber}`}
                                                        badge="Pharmacy Unit"
                                                        onDownloadPng={handleBoxDownload}
                                                    />
                                                </div>

                                                {/* Sample Pill QR (first pill) */}
                                                <DualQRCard
                                                    type="pill"
                                                    qrValue={result.pills[0]?.pillQrCode ?? ""}
                                                    label={`Pill #001 of ${result.totalPillsGenerated.toLocaleString()}`}
                                                    sublabel={`Sample — ${result.totalPillsGenerated.toLocaleString()} total pills`}
                                                    badge={`Unit Level`}
                                                    onDownloadPng={handlePillDownload}
                                                />
                                            </div>

                                            {/* Summary row */}
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                {[
                                                    { label: "Cartons", value: (result.batch.cartons?.length || form.totalCartons).toLocaleString(), color: "text-amber-500", bg: "bg-amber-500/10" },
                                                    { label: "Box QRs", value: result.batch.quantityBoxes.toLocaleString(), color: "text-primary", bg: "bg-primary/10" },
                                                    { label: "Pill QRs", value: result.totalPillsGenerated.toLocaleString(), color: "text-success", bg: "bg-success/10" },
                                                    { label: "Boxes Total", value: result.batch.quantityBoxes.toLocaleString(), color: "text-foreground", bg: "bg-secondary/50" },
                                                ].map((m) => (
                                                    <div key={m.label} className={`rounded-xl ${m.bg} border border-border/30 p-3 text-center`}>
                                                        <p className={`text-[18px] font-black tabular-nums ${m.color}`}>{m.value}</p>
                                                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{m.label}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                {/* ── STEP 4: Downloads ────────────────────────────────────── */}
                                {step === "downloads" && result && (
                                    <motion.div
                                        key="downloads"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.28, ease }}
                                    >
                                        <DownloadCenter result={result} boxQrCanvasRef={boxQrRef} />
                                    </motion.div>
                                )}

                                {/* Error state */}
                                {error && (
                                    <motion.div
                                        key="error"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 mt-4"
                                    >
                                        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                                        <p className="text-[13px] text-destructive font-medium">{error}</p>
                                    </motion.div>
                                )}

                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="relative z-10 shrink-0 border-t border-border/40 bg-card/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between gap-3">

                            {step === "form" && (
                                <>
                                    <Button variant="ghost" onClick={handleClose} className="text-[13px]">
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleGenerate}
                                        disabled={!canGenerate}
                                        className="rounded-xl bg-gradient-primary shadow-elegant text-[13px] font-semibold gap-2 transition-all hover:scale-[1.02] hover:shadow-card-hover disabled:opacity-50"
                                    >
                                        <QrCode className="h-4 w-4" />
                                        Generate Dual QR System
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </>
                            )}

                            {step === "generating" && (
                                <p className="w-full text-center text-[12px] text-muted-foreground">
                                    ⚡ Generating {totalPills.toLocaleString()} QR codes — please wait…
                                </p>
                            )}

                            {step === "result" && result && (
                                <>
                                    <Button variant="outline" onClick={handleReset} className="rounded-xl text-[13px] border-border/60 gap-1.5">
                                        <ArrowLeft className="h-3.5 w-3.5" /> New Batch
                                    </Button>
                                    <Button
                                        onClick={() => setStep("downloads")}
                                        className="rounded-xl bg-gradient-primary shadow-elegant text-[13px] font-semibold gap-2 transition-all hover:scale-[1.02]"
                                    >
                                        Download All QRs
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </>
                            )}

                            {step === "downloads" && result && (
                                <>
                                    <Button variant="outline" onClick={() => setStep("result")} className="rounded-xl text-[13px] border-border/60 gap-1.5">
                                        <ArrowLeft className="h-3.5 w-3.5" /> Back to QRs
                                    </Button>
                                    <Button variant="ghost" onClick={handleReset} className="rounded-xl text-[13px]">
                                        Register New Batch
                                    </Button>
                                </>
                            )}

                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
