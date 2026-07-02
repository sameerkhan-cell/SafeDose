import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    FileText,
    Upload,
    Trash2,
    Loader2,
    ShieldCheck,
    AlertTriangle,
    Clock,
    CheckCircle2,
    Download,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    manufacturerDocumentsService,
    DOCUMENT_TYPE_LABELS,
    type ComplianceSummary,
    type ManufacturerDocumentItem,
} from "@/services/manufacturer-documents";
import { ease } from "@/lib/motion";

const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS);

function statusColor(status: string) {
    switch (status) {
        case "APPROVED":
            return "text-success bg-success/10 border-success/20";
        case "REJECTED":
            return "text-destructive bg-destructive/10 border-destructive/20";
        case "EXPIRED":
            return "text-warning bg-warning/10 border-warning/20";
        case "UNDER_REVIEW":
            return "text-primary bg-primary/10 border-primary/20";
        default:
            return "text-muted-foreground bg-secondary/30 border-border/40";
    }
}

export function ComplianceDocuments() {
    const [compliance, setCompliance] = useState<ComplianceSummary | null>(null);
    const [documents, setDocuments] = useState<ManufacturerDocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [form, setForm] = useState({
        documentType: "DRAP_LICENSE",
        documentName: "",
        documentUrl: "",
        expiryDate: "",
    });

    const load = useCallback(async () => {
        setLoading(true);
        const res = await manufacturerDocumentsService.list();
        if (res.success && res.data) {
            setDocuments(res.data.documents);
            setCompliance(res.data.compliance);
        } else {
            toast.error(res.error?.message ?? "Failed to load documents.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file && !form.documentUrl) {
            toast.error("Please upload a file or enter a document URL.");
            return;
        }
        setUploading(true);

        let res;
        if (file) {
            const formData = new FormData();
            formData.append("documentType", form.documentType);
            formData.append("documentName", form.documentName);
            formData.append("file", file);
            if (form.expiryDate) {
                formData.append("expiryDate", form.expiryDate);
            }
            res = await manufacturerDocumentsService.upload(formData);
        } else {
            res = await manufacturerDocumentsService.upload({
                documentType: form.documentType,
                documentName: form.documentName,
                documentUrl: form.documentUrl,
                expiryDate: form.expiryDate || undefined,
            });
        }
        setUploading(false);

        if (res.success) {
            toast.success("Document uploaded", {
                description: "Your document is pending review.",
            });
            setForm({ documentType: "DRAP_LICENSE", documentName: "", documentUrl: "", expiryDate: "" });
            setFile(null);
            void load();
        } else {
            toast.error(res.error?.message ?? "Upload failed.");
        }
    };

    const handleDelete = async (id: string) => {
        const res = await manufacturerDocumentsService.remove(id);
        if (res.success) {
            toast.success("Document removed");
            void load();
        } else {
            toast.error(res.error?.message ?? "Failed to remove document.");
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {compliance && (
                <>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease }}
                        className="card-premium p-5 border-primary/20"
                    >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            Compliance progress
                        </p>
                        <div className="flex flex-wrap items-end gap-6">
                            <div>
                                <p className="text-3xl font-bold text-primary tabular-nums">
                                    {compliance.progress.complianceScore}%
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {compliance.progress.approvedRequiredDocuments} of{" "}
                                    {compliance.progress.requiredDocuments} required documents approved
                                </p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">
                                    {compliance.progress.uploadedRequiredDocuments}
                                </span>{" "}
                                uploaded ·{" "}
                                <span className="font-semibold text-foreground">
                                    {compliance.requiredDocumentsApproved}
                                </span>{" "}
                                approved
                            </div>
                            {compliance.nextExpiryDate && (
                                <div className="text-sm text-muted-foreground">
                                    Next expiry:{" "}
                                    <span className="font-semibold text-foreground">
                                        {compliance.nextExpiryDate}
                                    </span>
                                    {compliance.daysUntilNextExpiry !== null && (
                                        <span> ({compliance.daysUntilNextExpiry} days)</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease }}
                        className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
                    >
                        <MetricCard label="Compliance" value={`${compliance.complianceScore}%`} icon={ShieldCheck} />
                        <MetricCard label="Total" value={String(compliance.totalDocuments)} icon={FileText} />
                        <MetricCard label="Approved" value={String(compliance.approvedDocuments)} icon={CheckCircle2} />
                        <MetricCard label="Pending" value={String(compliance.pendingDocuments)} icon={Clock} />
                        <MetricCard label="In review" value={String(compliance.underReviewDocuments)} icon={Clock} />
                        <MetricCard label="Rejected" value={String(compliance.rejectedDocuments)} icon={AlertTriangle} />
                        <MetricCard label="Expired" value={String(compliance.expiredDocuments)} icon={AlertTriangle} />
                    </motion.div>
                </>
            )}

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                className="card-premium p-6"
            >
                <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" /> Upload Regulatory Document
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                    Upload a document file directly, or provide a document URL (Cloudinary, S3, or CDN).
                </p>
                <form onSubmit={handleUpload} className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Document type</label>
                        <select
                            value={form.documentType}
                            onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}
                            className="mt-1 h-11 w-full rounded-xl border border-border/60 bg-secondary/20 px-3 text-sm"
                        >
                            {DOCUMENT_TYPES.map((t) => (
                                <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Document name</label>
                        <Input
                            value={form.documentName}
                            onChange={(e) => setForm((f) => ({ ...f, documentName: e.target.value }))}
                            placeholder="e.g. DRAP License 2026"
                            className="mt-1 h-11 rounded-xl bg-secondary/20"
                            required
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                            Document File / URL
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <div className="relative flex items-center justify-center border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-xl h-11 px-4 cursor-pointer bg-secondary/10">
                                    <input
                                        type="file"
                                        onChange={(e) => {
                                            const selectedFile = e.target.files?.[0] || null;
                                            setFile(selectedFile);
                                            if (selectedFile && !form.documentName) {
                                                const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
                                                setForm((f) => ({ ...f, documentName: baseName }));
                                            }
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                    />
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                                        <Upload className="h-4 w-4 shrink-0" />
                                        <span className="truncate">{file ? file.name : "Upload document file"}</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Input
                                    value={form.documentUrl}
                                    onChange={(e) => setForm((f) => ({ ...f, documentUrl: e.target.value }))}
                                    placeholder="Or paste URL: https://example.com/doc.pdf"
                                    type="url"
                                    className="h-11 rounded-xl bg-secondary/20"
                                    disabled={!!file}
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Expiry date (optional)</label>
                        <Input
                            value={form.expiryDate}
                            onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                            type="date"
                            className="mt-1 h-11 rounded-xl bg-secondary/20"
                        />
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" disabled={uploading} className="w-full rounded-xl bg-gradient-primary h-11">
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload document"}
                        </Button>
                    </div>
                </form>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.05 }}
                className="card-premium p-6"
            >
                <h3 className="text-[15px] font-semibold mb-4">Uploaded documents</h3>
                {documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet.</p>
                ) : (
                    <div className="space-y-3">
                        {documents.map((doc) => (
                            <div
                                key={doc.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/10 p-4"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm truncate">{doc.documentName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                                        {" · "}Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                                    </p>
                                    {doc.expiryDate && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Expires {doc.expiryDate}
                                            {doc.daysRemaining !== null && (
                                                <span
                                                    className={
                                                        doc.isExpired || (doc.daysRemaining ?? 0) <= 0
                                                            ? " text-destructive font-medium"
                                                            : doc.daysRemaining <= 30
                                                              ? " text-warning font-medium"
                                                              : ""
                                                    }
                                                >
                                                    {" "}
                                                    ({doc.isExpired ? "expired" : `${doc.daysRemaining} days left`})
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    {doc.remarks && (() => {
                                        const driveMatch = doc.remarks.match(/\[Google Drive\]\s*(https?:\/\/[^\s]+)/);
                                        const driveUrl = driveMatch?.[1];
                                        const plainRemarks = driveUrl ? null : doc.remarks;
                                        return (
                                            <>
                                                {driveUrl && (
                                                    <a
                                                        href={driveUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 hover:underline"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        View on Google Drive
                                                    </a>
                                                )}
                                                {plainRemarks && (
                                                    <p className="text-xs text-muted-foreground mt-1 italic">Review: {plainRemarks}</p>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${statusColor(doc.status)}`}>
                                        {doc.status.replace("_", " ")}
                                    </span>
                                    {doc.documentUrl && (
                                        <a
                                            href={doc.documentUrl}
                                            target={doc.documentUrl.startsWith("/api/") ? "_self" : "_blank"}
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                                        >
                                            {doc.documentUrl.startsWith("/api/") ? (
                                                <><Download className="h-3 w-3" /> Download</>
                                            ) : (
                                                <>View</>
                                            )}
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(doc.id)}
                                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                                        aria-label="Remove document"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {compliance && compliance.upcomingExpirations.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-premium p-6 border-warning/20"
                >
                    <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-4 w-4" /> Upcoming expirations
                    </h3>
                    <ul className="space-y-2 text-sm">
                        {compliance.upcomingExpirations.map((item) => (
                            <li key={item.documentId} className="flex justify-between gap-2">
                                <span>{item.documentName}</span>
                                <span className="text-muted-foreground shrink-0">{item.daysRemaining} days</span>
                            </li>
                        ))}
                    </ul>
                </motion.div>
            )}
        </div>
    );
}

function MetricCard({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
}) {
    return (
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 text-center">
            <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
        </div>
    );
}
