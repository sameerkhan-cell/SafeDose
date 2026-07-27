import { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    QrCode, X, PlusCircle, ShieldCheck, Package, Pill,
    Calendar, Hash, ChevronRight, CheckCircle2,
    AlertCircle, ArrowLeft, Search, Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ease } from "@/lib/motion";
import { useBatchGeneration } from "@/hooks/useBatchGeneration";
import { QRGenerationProgress } from "@/components/qr/QRGenerationProgress";
import { DualQRCard } from "@/components/qr/DualQRCard";
import { DownloadCenter } from "@/components/download-center/DownloadCenter";
import { exportQRCanvasToPng, triggerDownload } from "@/services/qr/qr-generator";
import { useQRStore } from "@/store/qr-store";

type ModalStep = "selection" | "form" | "generating" | "result" | "downloads";

interface Props {
    open: boolean;
    onClose: () => void;
}

export function ExtendBatchModal({ open, onClose }: Props) {
    const [step, setStep] = useState<ModalStep>("selection");
    const { batches } = useQRStore();
    const [selectedBatchId, setSelectedBatchId] = useState<string>("");
    const [extraBoxes, setExtraBoxes] = useState<number>(50);

    const { progress, result, error, generate, reset } = useBatchGeneration();
    const boxQrRef = useRef<HTMLDivElement>(null);

    const handleCartonDownload = useCallback((canvas: HTMLCanvasElement) => {
        const dataUrl = exportQRCanvasToPng(
            canvas,
            result?.batch.cartons?.[0]?.qrCode ?? "",
            `SafeDose · ${result?.batch.medicineName ?? ""} · Carton`
        );
        triggerDownload(dataUrl, `SafeDose-CartonQR-${result?.batch.batchNumber ?? "batch"}.png`);
    }, [result]);

    const handleBoxDownload = useCallback((canvas: HTMLCanvasElement) => {
        const dataUrl = exportQRCanvasToPng(
            canvas,
            result?.batch.boxes?.[0]?.qrCode || result?.batch.boxQrCode || "",
            `SafeDose · ${result?.batch.medicineName ?? ""} · Box`
        );
        triggerDownload(dataUrl, `SafeDose-BoxQR-${result?.batch.batchNumber ?? "batch"}.png`);
    }, [result]);

    const handlePillDownload = useCallback((canvas: HTMLCanvasElement) => {
        const dataUrl = exportQRCanvasToPng(
            canvas,
            result?.pills[0]?.pillQrCode ?? "",
            `SafeDose · ${result?.batch.medicineName ?? ""} · Pill`
        );
        triggerDownload(dataUrl, `SafeDose-SamplePillQR-${result?.batch.batchNumber ?? "batch"}.png`);
    }, [result]);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "N/A";
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const selectedBatch = useMemo(() =>
        batches.find(b => b.id === selectedBatchId || b.batchNumber === selectedBatchId)
        , [batches, selectedBatchId]);

    const handleBatchSelect = (batchId: string) => {
        setSelectedBatchId(batchId);
        setStep("form");
    };

    const handleGenerate = async () => {
        if (!selectedBatch) return;

        setStep("generating");
        const boxesPerCarton = selectedBatch.boxesPerCarton || 10;
        const totalCartonsToGenerate = Math.max(1, Math.ceil(extraBoxes / boxesPerCarton));

        await generate({
            medicineName: selectedBatch.medicineName,
            batchNumber: selectedBatch.batchNumber,
            productCategory: selectedBatch.productCategory || "Pharmaceutical",
            manufacturingDate: selectedBatch.manufacturingDate,
            expiryDate: selectedBatch.expiryDate,
            quantityBoxes: extraBoxes,
            totalPillsPerBox: selectedBatch.totalPillsPerBox || 20,
            totalCartons: totalCartonsToGenerate,
            manufacturerCode: selectedBatch.manufacturerCode || "MFG",
            drapLicense: selectedBatch.drapLicense || "DRAP-LIC-001",
            isExtension: true
        });
        setStep("result");
    };

    const handleClose = () => {
        setStep("selection");
        setSelectedBatchId("");
        reset();
        onClose();
    };

    const stepTitles: Record<ModalStep, { title: string; sub: string }> = {
        selection: { title: "Extend Existing Batch", sub: "Select a medicine batch to add more pills to" },
        form: { title: "Batch Extension Parameters", sub: "Medicine and Batch codes are locked for security" },
        generating: { title: "Generating Additional Architecture", sub: "Scaling the blockchain sequence…" },
        result: { title: "Expansion Complete", sub: "New pill QRs added sequentially to the batch" },
        downloads: { title: "Download Center", sub: "Export new pill labels for this extension" },
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={handleClose} />

                    <motion.div
                        className="relative w-full max-w-2xl rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
                        initial={{ opacity: 0, scale: 0.94, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 24 }}
                    >
                        {/* Header */}
                        <div className="relative z-10 flex items-center gap-4 border-b border-border/40 px-6 py-4 shrink-0">
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-success to-emerald-600 shadow-elegant">
                                <PlusCircle className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-[15px] font-bold leading-snug truncate">{stepTitles[step].title}</h2>
                                <p className="text-[11px] text-muted-foreground truncate">{stepTitles[step].sub}</p>
                            </div>
                            <button onClick={handleClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary transition-colors shrink-0">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="relative z-10 flex-1 overflow-y-auto px-6 py-5">
                            <AnimatePresence mode="wait">

                                {step === "selection" && (
                                    <motion.div key="selection" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="Search batch number or medicine..." className="pl-9 h-11 rounded-xl bg-secondary/20" />
                                        </div>

                                        <div className="grid gap-2">
                                            {batches.length === 0 ? (
                                                <div className="text-center py-10 opacity-50">
                                                    <Database className="h-10 w-10 mx-auto mb-2" />
                                                    <p className="text-sm">No batches found to extend.</p>
                                                </div>
                                            ) : (
                                                batches.map(b => (
                                                    <button
                                                        key={b.id}
                                                        onClick={() => handleBatchSelect(b.id || b.batchNumber)}
                                                        className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all text-left group"
                                                    >
                                                        <div>
                                                            <p className="text-[14px] font-bold">{b.medicineName}</p>
                                                            <p className="text-[11px] font-mono text-primary font-bold">{b.batchNumber}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[12px] font-bold tabular-nums">{b.totalPills.toLocaleString()} Pills</p>
                                                            <p className="text-[10px] text-muted-foreground">Registered {formatDate(b.expiryDate)}</p>
                                                        </div>
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform ml-2" />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {step === "form" && selectedBatch && (
                                    <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold uppercase text-muted-foreground">Medicine Name</label>
                                                <div className="h-11 rounded-xl bg-secondary/30 border border-border/40 flex items-center px-4 font-bold text-[14px] text-foreground/70">
                                                    <Pill className="h-4 w-4 mr-2" /> {selectedBatch.medicineName}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold uppercase text-muted-foreground">Batch Code</label>
                                                <div className="h-11 rounded-xl bg-secondary/30 border border-border/40 flex items-center px-4 font-mono font-bold text-[14px] text-primary/70">
                                                    <Hash className="h-4 w-4 mr-2" /> {selectedBatch.batchNumber}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold uppercase text-muted-foreground">Mfg. Date (Fixed)</label>
                                                <div className="h-11 rounded-xl bg-secondary/30 border border-border/40 flex items-center px-4 text-[14px] text-foreground/70">
                                                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> {formatDate(selectedBatch.manufacturingDate)}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold uppercase text-muted-foreground">Exp. Date (Fixed)</label>
                                                <div className="h-11 rounded-xl bg-secondary/30 border border-border/40 flex items-center px-4 text-[14px] text-foreground/70">
                                                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> {formatDate(selectedBatch.expiryDate)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-border/40">
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[13px] font-bold text-primary flex items-center gap-2">
                                                        <PlusCircle className="h-4 w-4" /> Additional Boxes to Add
                                                    </label>
                                                    <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Resuming at Pill #{(selectedBatch.totalPills + 1).toString().padStart(3, '0')}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1">
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            value={extraBoxes}
                                                            onChange={e => setExtraBoxes(parseInt(e.target.value) || 0)}
                                                            className="h-12 rounded-xl text-[20px] font-bold bg-primary/5 border-primary/20 focus:ring-primary/30"
                                                        />
                                                        <p className="text-[11px] text-muted-foreground mt-1">Each box contains {selectedBatch.totalPillsPerBox || 20} pills</p>
                                                    </div>
                                                    <div className="text-right px-4 py-2 rounded-2xl bg-secondary/20 border border-border/40 min-w-[120px]">
                                                        <p className="text-[28px] font-black text-primary leading-tight">{(extraBoxes * (selectedBatch.totalPillsPerBox || 20)).toLocaleString()}</p>
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">New Pill QRs</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl bg-warning/5 border border-warning/20 p-4 flex gap-3">
                                            <ShieldCheck className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                                            <p className="text-[12px] text-warning-foreground font-medium">
                                                These will be numbered starting from <strong>{(selectedBatch.totalPills + 1).toString().padStart(3, '0')}</strong>.
                                                The Box QR Code remains unchanged.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {step === "generating" && (
                                    <motion.div key="generating" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                                        <QRGenerationProgress progress={progress} />
                                    </motion.div>
                                )}

                                {(step === "result" || step === "downloads") && result && (
                                    <div className={step === "downloads" ? "hidden" : "space-y-5"}>
                                        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/8 px-4 py-3.5">
                                            <CheckCircle2 className="h-5 w-5 text-success" />
                                            <div>
                                                <p className="text-[14px] font-bold text-success">Batch Successfully Augmented!</p>
                                                <p className="text-[11px] text-foreground/70">
                                                    Batch extended with <span className="font-bold">{result.totalPillsGenerated.toLocaleString()}</span> new pills · {result.batch.cartons?.length || 0} cartons · {result.batch.quantityBoxes} boxes.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                            {/* Carton QR */}
                                            <DualQRCard
                                                type="carton"
                                                qrValue={result.batch.cartons?.[0]?.qrCode || ""}
                                                label={`Carton #${result.batch.cartons?.[0]?.qrCode?.split("-")?.[2] || "New"}`}
                                                sublabel={`${result.batch.cartons?.length || 0} cartons added`}
                                                badge="Shipment Unit"
                                                onDownloadPng={handleCartonDownload}
                                            />
                                            {/* Box QR */}
                                            <div ref={boxQrRef}>
                                                <DualQRCard
                                                    type="box"
                                                    qrValue={result.batch.boxes?.[0]?.qrCode || result.batch.boxQrCode}
                                                    label={`Box #${result.batch.boxes?.[0]?.boxNumber?.split("-")?.[2] || "Same"}`}
                                                    sublabel={result.batch.batchNumber}
                                                    badge="Pharmacy Unit"
                                                    onDownloadPng={handleBoxDownload}
                                                />
                                            </div>
                                            {/* Pill QR */}
                                            <DualQRCard
                                                type="pill"
                                                qrValue={result.pills[0]?.pillQrCode ?? ""}
                                                label={`New Pill #${result.pills[0]?.pillNumber}`}
                                                sublabel="Sequence resumed"
                                                badge={`+${(extraBoxes * (selectedBatch.totalPillsPerBox || 20)).toLocaleString()}`}
                                                onDownloadPng={handlePillDownload}
                                            />
                                        </div>
                                    </div>
                                )}

                                {step === "downloads" && result && (
                                    <DownloadCenter result={result} boxQrCanvasRef={boxQrRef} />
                                )}

                                {error && (
                                    <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex gap-2 text-destructive text-[13px]">
                                        <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                                    </div>
                                )}

                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 border-t border-border/40 bg-card/80 px-6 py-4 flex items-center justify-between">
                            {step === "selection" && <Button variant="ghost" onClick={handleClose}>Cancel</Button>}
                            {step === "form" && (
                                <>
                                    <Button variant="ghost" onClick={() => setStep("selection")} size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                                    <Button onClick={handleGenerate} className="bg-gradient-to-br from-success to-emerald-600 font-bold">Generate {(extraBoxes * (selectedBatch.totalPillsPerBox || 20)).toLocaleString()} More Pills</Button>
                                </>
                            )}
                            {step === "result" && (
                                <>
                                    <Button variant="outline" onClick={() => setStep("selection")}>Extend Another</Button>
                                    <Button onClick={() => setStep("downloads")} className="bg-gradient-primary">Download Labels</Button>
                                </>
                            )}
                            {step === "downloads" && (
                                <>
                                    <Button variant="ghost" onClick={() => setStep("result")} size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                                    <Button variant="ghost" onClick={handleClose}>Done</Button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
