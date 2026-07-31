import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload, Search, Database, Loader2, CheckCircle2, AlertTriangle,
    ChevronLeft, ChevronRight, RefreshCw, FileText, X, Plus, Save,
    FileUp, FilePlus, Pill, ChevronDown, ChevronUp, ExternalLink,
    FileSpreadsheet, File, FileCode, Table, Trash2, ArrowRight, ArrowLeft, Pencil
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    adminDrapBatchesService,
    type DrapBatchItem,
    type ManualEntryPayload,
    type EditBatchPayload,
} from "@/services/admin-drap-batches";
import { ease } from "@/lib/motion";

const PAGE_SIZE = 50;

// ─── Upload Result Banner ─────────────────────────────────────────────────────

function UploadResultBanner({
    result,
    onClose,
}: {
    result: { created: number; skipped: number; errors: string[] };
    onClose: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-border/50 bg-card p-4 space-y-2"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-sm font-semibold">
                        Upload complete —{" "}
                        <span className="text-green-600">{result.created} created</span>,{" "}
                        <span className="text-muted-foreground">{result.skipped} skipped</span>
                    </span>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            {result.errors.length > 0 && (
                <div>
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="text-[11px] text-amber-600 hover:underline"
                    >
                        {expanded ? "Hide" : "Show"} {result.errors.length} warning
                        {result.errors.length !== 1 ? "s" : ""}
                    </button>
                    <AnimatePresence>
                        {expanded && (
                            <motion.ul
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-2 max-h-48 overflow-y-auto space-y-1"
                            >
                                {result.errors.map((e, i) => (
                                    <li
                                        key={i}
                                        className="text-[11px] text-muted-foreground bg-secondary/30 rounded px-2 py-1 font-mono"
                                    >
                                        {e}
                                    </li>
                                ))}
                            </motion.ul>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}

// ─── File Drop Zone ───────────────────────────────────────────────────────────

type DropMode = "bulk" | "xml" | "pdf" | "document";

function FileDropZone({
    mode,
    onUpload,
    uploading,
}: {
    mode: DropMode;
    onUpload: (file: File) => void;
    uploading: boolean;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const acceptMap: Record<DropMode, string> = {
        bulk: ".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
        xml: ".xml,text/xml,application/xml",
        pdf: ".pdf,application/pdf",
        document: ".pdf,.xml,.ectd,.zip,application/pdf,text/xml,application/xml,application/octet-stream",
    };

    const validateFile = (file: File): boolean => {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (mode === "bulk" && !["csv", "xlsx", "xls"].includes(ext)) {
            toast.error("Please select a .csv, .xlsx, or .xls file");
            return false;
        }
        if (mode === "xml" && ext !== "xml") {
            toast.error("Please select an .xml file");
            return false;
        }
        if (mode === "pdf" && ext !== "pdf") {
            toast.error("Please select a .pdf file");
            return false;
        }
        return true;
    };

    const handleFile = (file: File | null) => {
        if (!file) return;
        if (!validateFile(file)) return;
        onUpload(file);
    };

    const iconMap: Record<DropMode, any> = {
        bulk: <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />,
        xml: <FileCode className="h-8 w-8 text-muted-foreground" />,
        pdf: <Table className="h-8 w-8 text-muted-foreground" />,
        document: <File className="h-8 w-8 text-muted-foreground" />,
    };

    const labelMap: Record<DropMode, string> = {
        bulk: "Drop CSV or Excel here",
        xml: "Drop XML file here",
        pdf: "Drop PDF table file here",
        document: "Drop document here",
    };

    const hintMap: Record<DropMode, any> = {
        bulk: <>CSV columns: <span className="font-mono">medicineName</span>, <span className="font-mono">batchCode</span>, <span className="font-mono text-muted-foreground/70">barcode, companyName, expiryDate, manufactureDate (optional)</span>. Excel columns: same headers.</>,
        xml: "Upload an XML file containing medicine/batch records. You will map XML tags in the next step.",
        pdf: "Upload a structured PDF table. Rows will be extracted for review before importing.",
        document: "Accepts PDF, XML, or eCTD files. Stored as an audit source document.",
    };

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files[0] ?? null);
            }}
            onClick={() => !uploading && fileRef.current?.click()}
            className={`cursor-pointer flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-300 ${
                dragging
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/60 bg-secondary/10 hover:border-primary/30 hover:bg-secondary/20"
            } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        >
            <input
                ref={fileRef}
                type="file"
                accept={acceptMap[mode]}
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {uploading ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : iconMap[mode]}
            <div className="text-center">
                <p className="text-sm font-medium">
                    {uploading ? "Processing file…" : labelMap[mode]}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">{hintMap[mode]}</p>
            </div>
        </div>
    );
}

// ─── Bulk XML Card ────────────────────────────────────────────────────────────

function XmlBulkUploadCard({ onImportSuccess }: { onImportSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [inspecting, setInspecting] = useState(false);
    const [candidates, setCandidates] = useState<Array<{ nodePath: string; count: number; sampleTags: Array<{ tag: string; sample: string }> }>>([]);
    const [selectedPath, setSelectedPath] = useState<string>("");
    const [mapping, setMapping] = useState<Record<string, string>>({
        medicineNameTag: "",
        batchCodeTag: "",
        barcodeTag: "",
        companyNameTag: "",
        expiryDateTag: "",
        manufactureDateTag: "",
        genericNameTag: "",
        drapRegNumberTag: "",
    });
    const [step, setStep] = useState<"upload" | "map">("upload");
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

    const handleInspect = async (f: File) => {
        setFile(f);
        setInspecting(true);
        setResult(null);
        const res = await adminDrapBatchesService.inspectXml(f);
        setInspecting(false);
        if (res.success && res.data && res.data.candidates.length > 0) {
            setCandidates(res.data.candidates);
            const first = res.data.candidates[0];
            setSelectedPath(first.nodePath);
            autoGuessMapping(first.sampleTags);
            setStep("map");
        } else {
            toast.error(res.error?.message || "No repeating record elements found in XML.");
        }
    };

    const autoGuessMapping = (sampleTags: Array<{ tag: string; sample: string }>) => {
        const find = (...matches: string[]) => {
            const found = sampleTags.find((t) => matches.some((m) => t.tag.toLowerCase().includes(m)));
            return found ? found.tag : "";
        };

        setMapping({
            medicineNameTag: find("medicine", "product", "drug", "trade", "name"),
            batchCodeTag: find("batch", "lot", "code"),
            barcodeTag: find("barcode", "gtin"),
            companyNameTag: find("company", "manufacturer", "mfr"),
            expiryDateTag: find("exp", "expiry"),
            manufactureDateTag: find("mfg", "dom", "manufacture"),
            genericNameTag: find("generic"),
            drapRegNumberTag: find("drap", "reg"),
        });
    };

    const handlePathChange = (path: string) => {
        setSelectedPath(path);
        const candidate = candidates.find((c) => c.nodePath === path);
        if (candidate) {
            autoGuessMapping(candidate.sampleTags);
        }
    };

    const currentCandidate = candidates.find((c) => c.nodePath === selectedPath);
    const availableTags = currentCandidate ? currentCandidate.sampleTags : [];

    const handleImport = async () => {
        if (!file || !selectedPath) return;
        if (!mapping.medicineNameTag || !mapping.batchCodeTag) {
            toast.error("Please map required fields: Medicine Name and Batch Code.");
            return;
        }
        setImporting(true);
        const res = await adminDrapBatchesService.importXml(file, selectedPath, mapping);
        setImporting(false);
        if (res.success && res.data) {
            setResult(res.data);
            if (res.data.created > 0) {
                toast.success(`XML Import Complete: ${res.data.created} records registered.`);
                onImportSuccess();
            } else {
                toast.warning("No records created.");
            }
        } else {
            toast.error(res.error?.message || "XML import failed.");
        }
    };

    const reset = () => {
        setFile(null);
        setCandidates([]);
        setSelectedPath("");
        setStep("upload");
        setResult(null);
    };

    return (
        <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground -mt-1">
                Upload an XML file. Map detected XML tags to database fields and bulk-import all records.
            </p>

            {step === "upload" ? (
                <FileDropZone mode="xml" onUpload={handleInspect} uploading={inspecting} />
            ) : (
                <div className="space-y-4 rounded-xl border border-border/50 bg-secondary/10 p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-xs font-semibold text-primary">Loaded File:</span>{" "}
                            <span className="text-xs font-mono">{file?.name}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs">
                            Change File
                        </Button>
                    </div>

                    {/* Node path selection */}
                    {candidates.length > 1 && (
                        <div>
                            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                                Select Record Tag:
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {candidates.map((c) => (
                                    <button
                                        key={c.nodePath}
                                        onClick={() => handlePathChange(c.nodePath)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                            selectedPath === c.nodePath
                                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                                : "border-border bg-card text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        &lt;{c.nodePath}&gt; ({c.count} records)
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mapping Table */}
                    <div>
                        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                            Field Tag Mapping ({currentCandidate?.count ?? 0} records detected):
                        </p>
                        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border/50 bg-secondary/20 text-left text-muted-foreground">
                                        <th className="px-3 py-2">Target Field</th>
                                        <th className="px-3 py-2">XML Tag</th>
                                        <th className="px-3 py-2">Sample Value (Record #1)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: "Medicine Name *", key: "medicineNameTag", required: true },
                                        { label: "Batch Code *", key: "batchCodeTag", required: true },
                                        { label: "Barcode / GTIN", key: "barcodeTag" },
                                        { label: "Company Name", key: "companyNameTag" },
                                        { label: "Expiry Date", key: "expiryDateTag" },
                                        { label: "Manufacture Date", key: "manufactureDateTag" },
                                        { label: "Generic Name", key: "genericNameTag" },
                                        { label: "DRAP Reg. No.", key: "drapRegNumberTag" },
                                    ].map((f) => {
                                        const selectedTag = mapping[f.key] || "";
                                        const sampleObj = availableTags.find((t) => t.tag === selectedTag);
                                        return (
                                            <tr key={f.key} className="border-b border-border/30">
                                                <td className="px-3 py-2 font-medium">
                                                    {f.label}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={selectedTag}
                                                        onChange={(e) => setMapping((p) => ({ ...p, [f.key]: e.target.value }))}
                                                        className="h-8 rounded-lg border border-border bg-secondary/20 px-2 text-xs focus:outline-none"
                                                    >
                                                        <option value="">-- Ignore --</option>
                                                        {availableTags.map((t) => (
                                                            <option key={t.tag} value={t.tag}>
                                                                &lt;{t.tag}&gt;
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground truncate max-w-xs">
                                                    {sampleObj ? sampleObj.sample : <span className="italic opacity-40">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button onClick={reset} variant="outline" size="sm">Cancel</Button>
                        <Button onClick={handleImport} disabled={importing} size="sm" className="gap-1.5">
                            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Import XML Records ({currentCandidate?.count ?? 0})
                        </Button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {result && <UploadResultBanner result={result} onClose={() => setResult(null)} />}
            </AnimatePresence>
        </div>
    );
}

// ─── Bulk PDF Table Card ──────────────────────────────────────────────────────

function PdfBulkUploadCard({ onImportSuccess }: { onImportSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [rows, setRows] = useState<any[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

    const handleExtract = async (f: File) => {
        setFile(f);
        setExtracting(true);
        setErrorMsg(null);
        setRows([]);
        setResult(null);

        const res = await adminDrapBatchesService.extractPdf(f);
        setExtracting(false);

        if (res.success && res.data && res.data.success && res.data.rows) {
            setRows(res.data.rows);
            toast.success(`Extracted ${res.data.rows.length} table rows from PDF.`);
        } else {
            setErrorMsg(res.error?.message || res.data?.error || "Could not detect a table structure in this PDF — try CSV or Excel instead.");
        }
    };

    const updateCell = (idx: number, field: string, value: string) => {
        setRows((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const deleteRow = (idx: number) => {
        setRows((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleImport = async () => {
        if (rows.length === 0) return;
        setImporting(true);
        const res = await adminDrapBatchesService.importPdfRows(rows);
        setImporting(false);
        if (res.success && res.data) {
            setResult(res.data);
            if (res.data.created > 0) {
                toast.success(`PDF Import Complete: ${res.data.created} records registered.`);
                onImportSuccess();
            } else {
                toast.warning("No records created.");
            }
        } else {
            toast.error(res.error?.message || "PDF import failed.");
        }
    };

    const reset = () => {
        setFile(null);
        setRows([]);
        setErrorMsg(null);
        setResult(null);
    };

    return (
        <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground -mt-1">
                Upload a structured PDF table. Review and edit extracted rows before final import.
            </p>

            {!file || extracting ? (
                <FileDropZone mode="pdf" onUpload={handleExtract} uploading={extracting} />
            ) : errorMsg ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Extraction Notice
                    </div>
                    <p className="text-xs text-red-700">{errorMsg}</p>
                    <Button size="sm" variant="outline" onClick={reset}>
                        Try Another File
                    </Button>
                </div>
            ) : (
                <div className="space-y-4 rounded-xl border border-border/50 bg-secondary/10 p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-xs font-semibold text-primary">PDF File:</span>{" "}
                            <span className="text-xs font-mono">{file?.name}</span>{" "}
                            <span className="text-xs text-muted-foreground">({rows.length} extracted rows)</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs">
                            Change File
                        </Button>
                    </div>

                    {/* Editable Preview Table */}
                    <div className="overflow-x-auto rounded-xl border border-border/50 bg-card max-h-96 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-secondary/90 backdrop-blur-sm border-b border-border/50">
                                <tr className="text-left text-muted-foreground">
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">Medicine Name *</th>
                                    <th className="px-3 py-2">Batch Code *</th>
                                    <th className="px-3 py-2">Barcode</th>
                                    <th className="px-3 py-2">Company Name</th>
                                    <th className="px-3 py-2">Expiry</th>
                                    <th className="px-3 py-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/10">
                                        <td className="px-3 py-1.5 text-muted-foreground font-mono text-[10px]">{i + 1}</td>
                                        <td className="px-2 py-1">
                                            <input
                                                value={r.medicineName ?? ""}
                                                onChange={(e) => updateCell(i, "medicineName", e.target.value)}
                                                className="w-full h-7 rounded border border-border/50 bg-secondary/20 px-2 text-xs"
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input
                                                value={r.batchCode ?? ""}
                                                onChange={(e) => updateCell(i, "batchCode", e.target.value)}
                                                className="w-full h-7 rounded border border-border/50 bg-secondary/20 px-2 font-mono text-xs"
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input
                                                value={r.barcode ?? ""}
                                                onChange={(e) => updateCell(i, "barcode", e.target.value)}
                                                className="w-full h-7 rounded border border-border/50 bg-secondary/20 px-2 font-mono text-xs"
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input
                                                value={r.companyName ?? ""}
                                                onChange={(e) => updateCell(i, "companyName", e.target.value)}
                                                className="w-full h-7 rounded border border-border/50 bg-secondary/20 px-2 text-xs"
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input
                                                value={r.expiryDate ? String(r.expiryDate).split("T")[0] : ""}
                                                onChange={(e) => updateCell(i, "expiryDate", e.target.value)}
                                                type="date"
                                                className="h-7 rounded border border-border/50 bg-secondary/20 px-2 text-xs"
                                            />
                                        </td>
                                        <td className="px-3 py-1">
                                            <button
                                                onClick={() => deleteRow(i)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button onClick={reset} variant="outline" size="sm">Cancel</Button>
                        <Button onClick={handleImport} disabled={importing || rows.length === 0} size="sm" className="gap-1.5">
                            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Import Reviewed PDF Rows ({rows.length})
                        </Button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {result && <UploadResultBanner result={result} onClose={() => setResult(null)} />}
            </AnimatePresence>
        </div>
    );
}

// ─── Manual Entry Form ────────────────────────────────────────────────────────

const EMPTY_FORM: ManualEntryPayload = {
    medicineName: "",
    genericName: "",
    manufacturer_name: "",
    drapRegNumber: "",
    approvalStatus: "REGISTERED",
    activeIngredients: "",
    batchCode: "",
    barcode: "",
    companyName: "",
    expiryDate: "",
    manufactureDate: "",
    sourceDocumentUrl: "",
};

function ManualEntryForm({
    initialSourceDocUrl,
    onSuccess,
    onCancel,
}: {
    initialSourceDocUrl?: string;
    onSuccess: () => void;
    onCancel?: () => void;
}) {
    const [form, setForm] = useState<ManualEntryPayload>({
        ...EMPTY_FORM,
        sourceDocumentUrl: initialSourceDocUrl ?? "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = (k: keyof ManualEntryPayload, v: string) =>
        setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
        if (!form.medicineName.trim()) { setError("Medicine name is required."); return; }
        if (!form.batchCode.trim()) { setError("Batch code is required."); return; }
        setLoading(true); setError(null);
        try {
            const res = await adminDrapBatchesService.manualCreate(form);
            if (!res.success) throw new Error(res.error?.message ?? "Failed to save");
            toast.success("Batch code registered successfully.");
            setForm({ ...EMPTY_FORM, sourceDocumentUrl: "" });
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const Field = ({
        label, k, placeholder, textarea, type,
    }: { label: string; k: keyof ManualEntryPayload; placeholder: string; textarea?: boolean; type?: string }) => (
        <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">{label}</label>
            {textarea ? (
                <textarea
                    value={form[k] ?? ""}
                    onChange={(e) => set(k, e.target.value)}
                    placeholder={placeholder}
                    rows={2}
                    className="w-full rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
            ) : (
                <input
                    type={type ?? "text"}
                    value={form[k] ?? ""}
                    onChange={(e) => set(k, e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
            )}
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Medicine fields */}
            <div>
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3 flex items-center gap-1.5">
                    <Pill className="h-3.5 w-3.5" /> Medicine Details
                </p>
                <div className="space-y-3">
                    <Field label="Medicine Name *" k="medicineName" placeholder="e.g. Gauze Swab / Sponge (White Lily brand)" />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Generic Name" k="genericName" placeholder="e.g. Paracetamol" />
                        <Field label="Manufacturer Name" k="manufacturer_name" placeholder="e.g. The National Absorbent Cotton Mills Co" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="DRAP Reg. Number" k="drapRegNumber" placeholder="e.g. ELM-0009" />
                        <div>
                            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Approval Status</label>
                            <select
                                value={form.approvalStatus}
                                onChange={(e) => set("approvalStatus", e.target.value)}
                                className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none"
                            >
                                <option value="REGISTERED">Registered</option>
                                <option value="SUSPENDED">Suspended</option>
                                <option value="BANNED">Banned</option>
                            </select>
                        </div>
                    </div>
                    <Field label="Active Ingredients" k="activeIngredients" placeholder="e.g. 100% Cotton" textarea />
                </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border/40" />

            {/* Batch fields */}
            <div>
                <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3 flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5" /> Batch Details
                </p>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Batch Code *" k="batchCode" placeholder="e.g. WL-GZ-2025-047" />
                        <Field label="Barcode / GTIN (Optional)" k="barcode" placeholder="e.g. 8901234567890" />
                    </div>
                    <Field label="Company Name" k="companyName" placeholder="e.g. The National Absorbent Cotton Mills Co" />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Manufacture Date" k="manufactureDate" placeholder="YYYY-MM-DD" type="date" />
                        <Field label="Expiry Date" k="expiryDate" placeholder="YYYY-MM-DD" type="date" />
                    </div>
                    {form.sourceDocumentUrl && (
                        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2 flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="text-[11px] text-blue-600 flex-1 truncate">Source document attached</span>
                            <a
                                href={form.sourceDocumentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-blue-500 hover:underline shrink-0"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {error && <p className="text-red-500 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
                {onCancel && (
                    <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
                )}
                <Button onClick={handleSubmit} disabled={loading} className="flex-1 gap-1.5">
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Register Batch
                </Button>
            </div>
        </div>
    );
}

// ─── Edit Batch Modal ─────────────────────────────────────────────────────────

function EditBatchModal({
    item,
    onClose,
    onSaved,
}: {
    item: DrapBatchItem;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [form, setForm] = useState<EditBatchPayload>({
        batchCode: item.batchCode,
        barcode: item.barcode ?? "",
        companyName: item.companyName ?? "",
        expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : "",
        manufactureDate: item.manufactureDate ? item.manufactureDate.slice(0, 10) : "",
        sourceDocumentUrl: item.sourceDocumentUrl ?? "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = (k: keyof EditBatchPayload, v: string) =>
        setForm((p) => ({ ...p, [k]: v }));

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminDrapBatchesService.updateBatch(item.id, form);
            if (!res.success) throw new Error(res.error?.message ?? "Update failed.");
            toast.success("Batch entry updated successfully.");
            onSaved();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const Field = ({ label, k, placeholder, type }: { label: string; k: keyof EditBatchPayload; placeholder: string; type?: string }) => (
        <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">{label}</label>
            <input
                type={type ?? "text"}
                value={(form[k] as string) ?? ""}
                onChange={(e) => set(k, e.target.value)}
                placeholder={placeholder}
                className="w-full h-10 rounded-xl border border-border bg-secondary/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ duration: 0.2 }}
                className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-primary" /> Edit Batch Entry
                    </h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="rounded-xl bg-secondary/20 border border-border/40 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-0.5">Medicine</p>
                    <p className="text-sm font-medium text-foreground">{item.medicineName}</p>
                </div>

                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Batch Code *" k="batchCode" placeholder="e.g. WL-GZ-2025-047" />
                        <Field label="Barcode / GTIN" k="barcode" placeholder="e.g. 8964000831083" />
                    </div>
                    <Field label="Company Name" k="companyName" placeholder="e.g. National Absorbent Cotton Mills" />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Manufacture Date" k="manufactureDate" placeholder="YYYY-MM-DD" type="date" />
                        <Field label="Expiry Date" k="expiryDate" placeholder="YYYY-MM-DD" type="date" />
                    </div>
                </div>

                {error && <p className="text-red-500 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Changes
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function DrapBatchRegistryPanel() {
    const [items, setItems] = useState<DrapBatchItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [docUploading, setDocUploading] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [uploadResult, setUploadResult] = useState<{
        created: number; skipped: number; errors: string[];
    } | null>(null);
    const [editingItem, setEditingItem] = useState<DrapBatchItem | null>(null);

    // Section open/close state
    const [showBulkUpload, setShowBulkUpload] = useState(true);
    const [showXmlUpload, setShowXmlUpload] = useState(false);
    const [showPdfUpload, setShowPdfUpload] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [showDocUpload, setShowDocUpload] = useState(false);

    // After a document upload, hold the returned URL so the form can use it
    const [pendingDocUrl, setPendingDocUrl] = useState<string | null>(null);

    // Debounce search 400ms
    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    const loadBatches = useCallback(async () => {
        setLoading(true);
        const res = await adminDrapBatchesService.listBatches({
            search: debouncedSearch || undefined,
            page,
            pageSize: PAGE_SIZE,
        });
        if (res.success && res.data) {
            setItems(res.data.items);
            setTotal(res.data.total);
        } else {
            toast.error(res.error?.message ?? "Failed to load batch codes.");
        }
        setLoading(false);
    }, [debouncedSearch, page]);

    useEffect(() => { void loadBatches(); }, [loadBatches]);

    // Bulk file upload (CSV or Excel)
    const handleBulkUpload = async (file: File) => {
        setUploading(true);
        setUploadResult(null);
        const res = await adminDrapBatchesService.uploadFile(file);
        if (res.success && res.data) {
            setUploadResult(res.data);
            if (res.data.created > 0) {
                toast.success(`${res.data.created} batch codes registered.`);
                void loadBatches();
            } else {
                toast.warning("No new batch codes were created.");
            }
        } else {
            toast.error(res.error?.message ?? "Upload failed.");
        }
        setUploading(false);
    };

    // Supporting document upload
    const handleDocUpload = async (file: File) => {
        setDocUploading(true);
        const res = await adminDrapBatchesService.uploadDocument(file);
        if (res.success && res.data) {
            setPendingDocUrl(res.data.documentUrl);
            toast.success("Document uploaded. Fill in the batch details below.");
            setShowManualEntry(true);
            setShowDocUpload(false);
        } else {
            toast.error(res.error?.message ?? "Document upload failed.");
        }
        setDocUploading(false);
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const SectionToggle = ({ label, icon: Icon, open, onToggle }: {
        label: string; icon: any; open: boolean; onToggle: () => void;
    }) => (
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left group"
        >
            <h3 className="text-[15px] font-semibold flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" /> {label}
            </h3>
            {open
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
    );

    return (
        <>
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="space-y-4"
        >
            {/* ── Section 1: Bulk Upload (CSV / Excel) ── */}
            <div className="card-premium overflow-hidden">
                <SectionToggle
                    label="Bulk Upload — CSV or Excel"
                    icon={FileSpreadsheet}
                    open={showBulkUpload}
                    onToggle={() => setShowBulkUpload((v) => !v)}
                />
                <AnimatePresence initial={false}>
                    {showBulkUpload && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-4 sm:px-6 pb-6 space-y-4"
                        >
                            <p className="text-[12px] text-muted-foreground -mt-1">
                                Upload a CSV or Excel file to bulk-register batch codes. Medicines are auto-created if not found.
                            </p>
                            <FileDropZone mode="bulk" onUpload={handleBulkUpload} uploading={uploading} />
                            <AnimatePresence>
                                {uploadResult && (
                                    <UploadResultBanner result={uploadResult} onClose={() => setUploadResult(null)} />
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Section 2: Bulk XML Import ── */}
            <div className="card-premium overflow-hidden">
                <SectionToggle
                    label="Bulk XML Import (Tag Mapping)"
                    icon={FileCode}
                    open={showXmlUpload}
                    onToggle={() => setShowXmlUpload((v) => !v)}
                />
                <AnimatePresence initial={false}>
                    {showXmlUpload && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-4 sm:px-6 pb-6"
                        >
                            <XmlBulkUploadCard onImportSuccess={() => void loadBatches()} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Section 3: Bulk PDF Table Import ── */}
            <div className="card-premium overflow-hidden">
                <SectionToggle
                    label="Bulk PDF Table Import (Review & Extract)"
                    icon={Table}
                    open={showPdfUpload}
                    onToggle={() => setShowPdfUpload((v) => !v)}
                />
                <AnimatePresence initial={false}>
                    {showPdfUpload && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-4 sm:px-6 pb-6"
                        >
                            <PdfBulkUploadCard onImportSuccess={() => void loadBatches()} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Section 4: Manual Entry ── */}
            <div className="card-premium overflow-hidden">
                <SectionToggle
                    label="Manual Single Entry"
                    icon={FilePlus}
                    open={showManualEntry}
                    onToggle={() => { setShowManualEntry((v) => !v); if (showManualEntry) setPendingDocUrl(null); }}
                />
                <AnimatePresence initial={false}>
                    {showManualEntry && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-4 sm:px-6 pb-6"
                        >
                            <p className="text-[12px] text-muted-foreground mb-4 -mt-1">
                                Register a single medicine + batch code. A new medicine is created automatically if the name doesn't exist yet.
                            </p>
                            <ManualEntryForm
                                initialSourceDocUrl={pendingDocUrl ?? undefined}
                                onSuccess={() => { void loadBatches(); setPendingDocUrl(null); }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Section 5: Supporting Document Upload ── */}
            <div className="card-premium overflow-hidden">
                <SectionToggle
                    label="Supporting Document (PDF / XML / eCTD)"
                    icon={FileUp}
                    open={showDocUpload}
                    onToggle={() => setShowDocUpload((v) => !v)}
                />
                <AnimatePresence initial={false}>
                    {showDocUpload && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-4 sm:px-6 pb-6 space-y-4"
                        >
                            <p className="text-[12px] text-muted-foreground -mt-1">
                                Upload a source document as an audit reference. No data is extracted automatically — fill in the fields manually after upload.
                            </p>
                            <FileDropZone mode="document" onUpload={handleDocUpload} uploading={docUploading} />
                            {pendingDocUrl && !showManualEntry && (
                                <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                        <span className="text-sm text-green-700">Document stored. Now fill in batch details.</span>
                                    </div>
                                    <Button size="sm" onClick={() => { setShowManualEntry(true); setShowDocUpload(false); }}>
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Fill Details
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Section 6: Registered Batch Codes ── */}
            <div className="card-premium p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-[15px] font-semibold flex items-center gap-2">
                            <Database className="h-4 w-4 text-primary" /> Registered Batch Codes
                        </h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                            {total.toLocaleString()} total batch codes registered
                        </p>
                    </div>
                    <button
                        onClick={() => void loadBatches()}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/50 bg-secondary/20 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by batch code, barcode, medicine name, or company…"
                        className="w-full h-10 rounded-xl border border-border bg-secondary/20 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                </div>

                {/* Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <Database className="h-8 w-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">
                            {debouncedSearch
                                ? "No results match your search"
                                : "No batch codes registered yet"}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/50">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-secondary/20">
                                    {["Batch Code", "Barcode", "Medicine", "Company", "Expiry", "Doc", "Registered", ""].map((h) => (
                                        <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-4 py-3">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        className={`border-b border-border/30 transition-colors hover:bg-secondary/10 ${idx % 2 === 0 ? "bg-card" : "bg-secondary/5"}`}
                                    >
                                        <td className="px-4 py-3 font-mono text-[12px] text-primary font-semibold">
                                            {item.batchCode}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                                            {item.barcode ?? <span className="italic opacity-40">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-medium text-foreground">
                                            {item.medicineName}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-muted-foreground">
                                            {item.companyName ?? <span className="italic opacity-50">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                                            {item.expiryDate
                                                ? new Date(item.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                                : <span className="italic opacity-50">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.sourceDocumentUrl ? (
                                                <a
                                                    href={item.sourceDocumentUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
                                                >
                                                    <FileText className="h-3 w-3" /> View
                                                </a>
                                            ) : (
                                                <span className="italic text-[11px] opacity-40">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                                            {new Date(item.registeredAt).toLocaleDateString("en-GB", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </td>
                                        <td className="px-3 py-3">
                                            <button
                                                onClick={() => setEditingItem(item)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                                                title="Edit this entry"
                                            >
                                                <Pencil className="h-3 w-3" /> Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                        <span className="text-[12px] text-muted-foreground">
                            Page {page} of {totalPages} · {total.toLocaleString()} records
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="h-8 w-8 p-0 rounded-lg"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading}
                                className="h-8 w-8 p-0 rounded-lg"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>

        {/* Edit modal — rendered outside the card to avoid overflow clip */}
        <AnimatePresence>
            {editingItem && (
                <EditBatchModal
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                    onSaved={() => { void loadBatches(); }}
                />
            )}
        </AnimatePresence>
        </>
    );
}
