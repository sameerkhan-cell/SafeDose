import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertCircle, ShieldAlert, Package, ArrowRight,
    X, CheckCircle2, Search, Filter, Megaphone, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegulatoryStore, type MedicineRecall } from "@/store/regulatory-store";
import { useQRStore } from "@/store/qr-store";
import { toast } from "sonner";

export function RecallHubWidget() {
    const { recalls, addRecall } = useRegulatoryStore();
    const { batches, setBatches } = useQRStore();
    const [selectedBatchId, setSelectedBatchId] = useState("");
    const [reason, setReason] = useState("");
    const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRecall = async () => {
        const batch = batches.find(b => b.id === selectedBatchId || b.batchNumber === selectedBatchId);
        if (!batch) {
            toast.error("Selected batch not found in inventory.");
            return;
        }

        setIsSubmitting(true);
        try {
            const token = (() => {
                try {
                    const session = localStorage.getItem("mediverify_session") || sessionStorage.getItem("mediverify_session");
                    return session ? JSON.parse(session).token : "";
                } catch { return ""; }
            })();

            const response = await fetch("/api/manufacturer/recall", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    batchId: batch.id,
                    reason: reason,
                    severity: severity
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to initiate recall.");
            }

            const recallData = result.data.recall;
            addRecall({
                id: recallData.id,
                batchNumber: recallData.batchNumber || batch.batchNumber,
                medicineName: recallData.medicineName || batch.medicineName,
                reason: recallData.reason,
                severity: (recallData.severity === "CRITICAL" || recallData.severity === "HIGH") ? "urgent" : "standard",
                dateInitiated: recallData.recallDate || new Date().toISOString(),
                status: "active"
            });

            // Update local batch status to Recalled in useQRStore
            const updatedBatches = batches.map(b => 
                (b.id === batch.id)
                    ? { ...b, status: "Recalled" as const }
                    : b
            );
            setBatches(updatedBatches);

            toast.success("Batch successfully recalled and reported to DRAP.");
            setShowForm(false);
            setSelectedBatchId("");
            setReason("");
            setSeverity("MEDIUM");
        } catch (error: any) {
            toast.error(error.message || "An unexpected error occurred during recall protocol.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="card-premium overflow-hidden border-destructive/20 bg-gradient-to-br from-destructive/[0.02] to-transparent">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                        <Megaphone className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold tracking-tight">Enterprise Recall Hub</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">DRAP & Regulatory Oversight</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={() => setShowForm(true)}
                    className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[11px] font-bold h-8 gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                >
                    <ShieldAlert className="h-3.5 w-3.5" /> Initiate Recall
                </Button>
            </div>

            <div className="p-6">
                {showForm ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4 bg-black/20 p-5 rounded-2xl border border-white/5"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[13px] font-bold text-destructive">Emergency Recall Protocol</h4>
                            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-white"><X className="h-4 w-4" /></button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase opacity-50 ml-1">Select Active Batch</label>
                            <select
                                className="w-full bg-secondary/50 border border-input rounded-xl px-4 h-11 text-[13px] focus:outline-none focus:ring-1 focus:ring-destructive"
                                value={selectedBatchId}
                                onChange={(e) => setSelectedBatchId(e.target.value)}
                            >
                                <option value="">Select Target Batch...</option>
                                {batches.map(b => (
                                    <option key={b.id} value={b.id}>{b.medicineName} ({b.batchNumber})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase opacity-50 ml-1">Severity Level</label>
                            <select
                                className="w-full bg-secondary/50 border border-input rounded-xl px-4 h-11 text-[13px] focus:outline-none focus:ring-1 focus:ring-destructive"
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value as any)}
                            >
                                <option value="LOW">Low Severity</option>
                                <option value="MEDIUM">Medium Severity</option>
                                <option value="HIGH">High Severity</option>
                                <option value="CRITICAL">Critical Severity</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase opacity-50 ml-1">Reason for Recall</label>
                            <textarea
                                className="w-full bg-secondary/50 border border-input rounded-xl p-3 text-[13px] min-h-[80px] focus:outline-none focus:ring-1 focus:ring-destructive"
                                placeholder="Describe the safety concern, contamination, or quality issue..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <Button
                            className="w-full rounded-xl bg-destructive h-12 text-[12px] font-black uppercase tracking-widest gap-2"
                            onClick={handleRecall}
                            disabled={!selectedBatchId || !reason || isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Authorizing...
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="h-4 w-4" /> Authorize Emergency Recall
                                </>
                            )}
                        </Button>
                    </motion.div>
                ) : (
                    <div className="space-y-3">
                        {recalls.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground italic text-[13px]">
                                No active recalls in your inventory.
                            </div>
                        ) : (
                            recalls.map((recall) => (
                                <div key={recall.id} className="group p-4 rounded-xl border border-destructive/10 bg-destructive/[0.03] hover:bg-destructive/[0.05] transition-all flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-destructive/10 grid place-items-center shrink-0 border border-destructive/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                                        <AlertCircle className="h-5 w-5 text-destructive animate-pulse" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h4 className="text-[13px] font-bold truncate text-destructive uppercase tracking-widest">{recall.medicineName}</h4>
                                            <span className="text-[9px] font-mono opacity-50 uppercase">{new Date(recall.dateInitiated).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground line-clamp-1">{recall.reason}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[9px] font-black bg-white/5 px-2 py-0.5 rounded border border-white/5 opacity-60">BATCH: {recall.batchNumber}</span>
                                            <span className="h-1 w-1 rounded-full bg-white/20" />
                                            <span className="text-[9px] font-black text-destructive uppercase">URGENT ACTION REQUIRED</span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="px-6 py-4 border-t border-white/5 bg-secondary/10 flex justify-center text-center">
                <p className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
                    <ShieldAlert className="h-3 w-3" /> All recalls are cryptographically reported to DRAP servers automatically.
                </p>
            </div>
        </div>
    );
}
