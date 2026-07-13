import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload,
    Search,
    Database,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    FileText,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminDrapBatchesService, type DrapBatchItem } from "@/services/admin-drap-batches";
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

// ─── CSV Drop Zone ────────────────────────────────────────────────────────────

function CsvDropZone({
    onUpload,
    uploading,
}: {
    onUpload: (file: File) => void;
    uploading: boolean;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const handleFile = (file: File | null) => {
        if (!file) return;
        if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
            toast.error("Please select a .csv file");
            return;
        }
        onUpload(file);
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
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {uploading ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
            ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="text-center">
                <p className="text-sm font-medium">
                    {uploading ? "Uploading…" : "Drop CSV here or click to select"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                    CSV columns: <span className="font-mono">medicineName</span>,{" "}
                    <span className="font-mono">batchCode</span>,{" "}
                    <span className="font-mono text-muted-foreground/70">companyName (optional)</span>
                </p>
            </div>
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function DrapBatchRegistryPanel() {
    const [items, setItems] = useState<DrapBatchItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [uploadResult, setUploadResult] = useState<{
        created: number;
        skipped: number;
        errors: string[];
    } | null>(null);

    // Debounce search by 400 ms
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

    const handleUpload = async (file: File) => {
        setUploading(true);
        setUploadResult(null);
        const res = await adminDrapBatchesService.uploadCsv(file);
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

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="space-y-6"
        >
            {/* ── Upload Section ── */}
            <div className="card-premium p-6 space-y-4">
                <div>
                    <h3 className="text-[15px] font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Bulk Upload Batch Codes
                    </h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                        Upload a CSV to register specific batch codes for DRAP-entered medicines
                    </p>
                </div>

                <CsvDropZone onUpload={handleUpload} uploading={uploading} />

                <AnimatePresence>
                    {uploadResult && (
                        <UploadResultBanner
                            result={uploadResult}
                            onClose={() => setUploadResult(null)}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* ── Batch List ── */}
            <div className="card-premium p-6 space-y-4">
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
                        placeholder="Search by batch code, medicine name, or company…"
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
                                : "No batch codes registered yet — upload a CSV to get started"}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/50">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-secondary/20">
                                    <th className="text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-4 py-3">
                                        Batch Code
                                    </th>
                                    <th className="text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-4 py-3">
                                        Medicine
                                    </th>
                                    <th className="text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-4 py-3">
                                        Company
                                    </th>
                                    <th className="text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-4 py-3">
                                        Registered
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        className={`border-b border-border/30 transition-colors hover:bg-secondary/10 ${
                                            idx % 2 === 0 ? "bg-card" : "bg-secondary/5"
                                        }`}
                                    >
                                        <td className="px-4 py-3 font-mono text-[12px] text-primary font-semibold">
                                            {item.batchCode}
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-medium text-foreground">
                                            {item.medicineName}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-muted-foreground">
                                            {item.companyName ?? (
                                                <span className="italic opacity-50">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                                            {new Date(item.registeredAt).toLocaleDateString("en-GB", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
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
    );
}
