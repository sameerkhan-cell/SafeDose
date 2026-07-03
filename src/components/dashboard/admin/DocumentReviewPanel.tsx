import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FileText,
    CheckCircle2,
    XCircle,
    Download,
    ExternalLink,
    AlertCircle,
    Loader2,
    MessageSquare,
    Clock,
    Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredSession } from "@/services/auth";
import { adminDocumentsService, type AdminDocumentItem } from "@/services/admin-documents";
import { DOCUMENT_TYPE_LABELS } from "@/services/manufacturer-documents";
import { ease } from "@/lib/motion";

export function DocumentReviewPanel() {
    const [documents, setDocuments] = useState<AdminDocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actioningId, setActioningId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [remarks, setRemarks] = useState("");

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        const res = await adminDocumentsService.list();
        if (res.success && res.data) {
            setDocuments(res.data);
        } else {
            toast.error(res.error?.message ?? "Failed to load documents for review.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void loadDocuments();
    }, [loadDocuments]);

    const handleApprove = async (id: string) => {
        setActioningId(id);
        const res = await adminDocumentsService.approve(id);
        setActioningId(null);
        
        if (res.success) {
            toast.success("Document approved successfully.");
            setDocuments((docs) => docs.filter((d) => d.id !== id));
        } else {
            toast.error(res.error?.message ?? "Approval failed.");
        }
    };

    const handleStartReject = (id: string) => {
        setRejectingId(id);
        setRemarks("");
    };

    const handleCancelReject = () => {
        setRejectingId(null);
        setRemarks("");
    };

    const handleRejectSubmit = async (id: string) => {
        if (!remarks.trim()) {
            toast.error("Rejection remarks are required.");
            return;
        }

        setActioningId(id);
        const res = await adminDocumentsService.reject(id, remarks.trim());
        setActioningId(null);
        setRejectingId(null);
        setRemarks("");

        if (res.success) {
            toast.success("Document rejected successfully.");
            setDocuments((docs) => docs.filter((d) => d.id !== id));
        } else {
            toast.error(res.error?.message ?? "Rejection failed.");
        }
    };

    const handleDownload = (doc: AdminDocumentItem) => {
        if (!doc.documentUrl) return;

        if (doc.documentUrl.startsWith("/api/")) {
            const session = getStoredSession();
            if (!session?.token) {
                toast.error("Session expired. Please log in again.");
                return;
            }
            
            toast.promise(
                fetch(doc.documentUrl, {
                    headers: { Authorization: `Bearer ${session.token}` },
                })
                    .then((res) => {
                        if (!res.ok) {
                            return Promise.reject(
                                res.status === 401 || res.status === 403
                                    ? "Access denied. You do not have permission to download this file."
                                    : res.status === 404
                                      ? "File not found."
                                      : `Download failed (${res.status}).`
                            );
                        }
                        return res.blob();
                    })
                    .then((blob) => {
                        const url = URL.createObjectURL(blob as Blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = doc.documentName || "document";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }),
                {
                    loading: "Fetching document...",
                    success: "Document downloaded.",
                    error: (err) => typeof err === "string" ? err : "Failed to fetch document.",
                }
            );
        } else {
            window.open(doc.documentUrl, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-[15px] font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" /> Regulatory Document Review
                    </h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                        Review uploaded compliance credentials and licenses from manufacturers
                    </p>
                </div>
                {documents.length > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold border border-primary/20">
                        {documents.length} Action{documents.length !== 1 ? "s" : ""} Pending
                    </span>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">Fetching pending regulatory files...</p>
                </div>
            ) : documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/5 p-8 text-center">
                    <CheckCircle2 className="h-8 w-8 text-success/60 mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground/90">All Caught Up!</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">No pending documents to review at this time.</p>
                </div>
            ) : (
                <div className="space-y-3.5">
                    <AnimatePresence mode="popLayout">
                        {documents.map((doc) => {
                            const isLocal = doc.documentUrl?.startsWith("/api/");
                            const isPendingAction = actioningId === doc.id;
                            const isCurrentlyRejecting = rejectingId === doc.id;

                            return (
                                <motion.div
                                    key={doc.id}
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -12 }}
                                    transition={{ duration: 0.35, ease }}
                                    className="card-premium p-5 border-border/40"
                                >
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="font-bold text-sm text-foreground/95">
                                                    {doc.manufacturer.companyName}
                                                </h4>
                                                <span className="text-[9px] font-mono font-semibold bg-secondary/60 text-foreground/70 px-2 py-0.5 rounded border border-border/40">
                                                    Lic: {doc.manufacturer.licenseNumber}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-xs text-foreground/80 flex items-center gap-1.5">
                                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <strong>{DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}:</strong>{" "}
                                                    {doc.documentName}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Uploaded on {new Date(doc.uploadedAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownload(doc)}
                                                className="rounded-xl text-[12px] h-9 gap-1.5 border-border/60 hover:bg-secondary/30"
                                            >
                                                {isLocal ? (
                                                    <><Download className="h-3.5 w-3.5" /> Download</>
                                                ) : (
                                                    <><ExternalLink className="h-3.5 w-3.5" /> View Drive</>
                                                )}
                                            </Button>

                                            <Button
                                                size="sm"
                                                disabled={isPendingAction}
                                                onClick={() => void handleApprove(doc.id)}
                                                className="rounded-xl text-[12px] h-9 bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                                            >
                                                {isPendingAction && actioningId === doc.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                )}
                                                Approve
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isPendingAction}
                                                onClick={() => handleStartReject(doc.id)}
                                                className="rounded-xl text-[12px] h-9 border-destructive/20 hover:bg-destructive/5 text-destructive hover:text-destructive gap-1.5"
                                            >
                                                <XCircle className="h-3.5 w-3.5" />
                                                Reject
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Reject Remarks Panel */}
                                    <AnimatePresence>
                                        {isCurrentlyRejecting && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.25, ease }}
                                                className="overflow-hidden mt-4 pt-4 border-t border-border/40 space-y-3"
                                            >
                                                <div className="flex items-start gap-2">
                                                    <MessageSquare className="h-4 w-4 text-destructive shrink-0 mt-2" />
                                                    <div className="flex-1 space-y-1.5">
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-destructive">
                                                            Reason for Rejection (Required)
                                                        </label>
                                                        <Input
                                                            value={remarks}
                                                            onChange={(e) => setRemarks(e.target.value)}
                                                            placeholder="Describe the issue with the document (e.g. invalid date, blurred signature, incorrect ID)..."
                                                            className="h-10 rounded-xl bg-secondary/10 border-destructive/20 focus:ring-destructive/30"
                                                            disabled={isPendingAction}
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2 text-xs">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleCancelReject}
                                                        disabled={isPendingAction}
                                                        className="rounded-xl h-8"
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        disabled={isPendingAction || !remarks.trim()}
                                                        onClick={() => void handleRejectSubmit(doc.id)}
                                                        className="rounded-xl h-8 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                    >
                                                        {isPendingAction ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                                        ) : null}
                                                        Confirm Rejection
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
