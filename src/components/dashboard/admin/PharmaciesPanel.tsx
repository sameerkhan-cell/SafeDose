import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Building2,
    Shield,
    FileText,
    Phone,
    Mail,
    MapPin,
    Clock,
    AlertCircle,
    Loader2,
    CheckCircle2,
    Ban,
    RotateCcw,
    ShieldOff,
    XCircle,
    Download,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredSession } from "@/services/auth";
import { adminPharmaciesService } from "@/services/admin-pharmacies";
import type { PharmacyProfile } from "@/services/pharmacy";
import { ease } from "@/lib/motion";

export function PharmaciesPanel() {
    const [pharmacies, setPharmacies] = useState<PharmacyProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "VERIFIED" | "PENDING" | "REJECTED">("ALL");
    const [actioningId, setActioningId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [remarks, setRemarks] = useState("");
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    const loadPharmacies = useCallback(async () => {
        setLoading(true);
        const res = await adminPharmaciesService.getPharmacies();
        if (res.success && res.data) {
            setPharmacies(res.data);
        } else {
            toast.error(res.error?.message ?? "Failed to load pharmacies.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void loadPharmacies();
    }, [loadPharmacies]);

    const handleApprove = async (id: string) => {
        setActioningId(id);
        const res = await adminPharmaciesService.approvePharmacy(id);
        setActioningId(null);

        if (res.success && res.data) {
            toast.success("Pharmacy license approved successfully.");
            setPharmacies((prev) =>
                prev.map((p) => (p.id === id ? { ...p, isVerified: true, verificationStatus: "VERIFIED", remarks: null } : p))
            );
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
        const res = await adminPharmaciesService.rejectPharmacy(id, remarks.trim());
        setActioningId(null);
        setRejectingId(null);
        setRemarks("");

        if (res.success && res.data) {
            toast.success("Pharmacy license rejected successfully.");
            setPharmacies((prev) =>
                prev.map((p) => (p.id === id ? { ...p, isVerified: false, verificationStatus: "REJECTED", remarks: res.data!.remarks } : p))
            );
        } else {
            toast.error(res.error?.message ?? "Rejection failed.");
        }
    };

    const handleUnverify = async (id: string) => {
        if (!confirm("Are you sure you want to revoke verification and set status to pending?")) return;

        setActioningId(id);
        const res = await adminPharmaciesService.unverifyPharmacy(id);
        setActioningId(null);

        if (res.success && res.data) {
            toast.success("Pharmacy verification revoked.");
            setPharmacies((prev) =>
                prev.map((p) => (p.id === id ? { ...p, isVerified: false, verificationStatus: "PENDING" } : p))
            );
        } else {
            toast.error(res.error?.message ?? "Failed to revoke verification.");
        }
    };

    const handleDownload = (docUrl: string, licenseNumber: string) => {
        const session = getStoredSession();
        if (!session?.token) {
            toast.error("Session expired. Please log in again.");
            return;
        }

        toast.promise(
            fetch(docUrl, {
                headers: { Authorization: `Bearer ${session.token}` },
            })
                .then((res) => {
                    if (!res.ok) {
                        return Promise.reject("Download failed.");
                    }
                    return res.blob();
                })
                .then((blob) => {
                    const url = URL.createObjectURL(blob as Blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `drap-pharmacy-license-${licenseNumber}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }),
            {
                loading: "Fetching license document...",
                success: "License document downloaded.",
                error: "Failed to download license document.",
            }
        );
    };

    const filteredPharmacies = pharmacies.filter((p) => {
        const matchesSearch =
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.licenseNumber.toLowerCase().includes(search.toLowerCase()) ||
            (p.location && p.location.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus =
            statusFilter === "ALL" ||
            p.verificationStatus === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-[15px] font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" /> Pharmacy Registrations
                    </h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                        Manage pharmacy profile information and verify official DRAP licenses
                    </p>
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-secondary/10 p-3 rounded-2xl border border-border/40">
                <div className="relative w-full sm:flex-1">
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by pharmacy name, license, or location..."
                        className="h-10 rounded-xl bg-background border-border/50"
                    />
                </div>
                <div className="flex gap-1 w-full sm:w-auto overflow-x-auto">
                    {(["ALL", "PENDING", "VERIFIED", "REJECTED"] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                                statusFilter === status
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                            }`}
                        >
                            {status === "ALL" ? "All" : status === "PENDING" ? "Pending" : status === "VERIFIED" ? "Verified" : "Rejected"}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">Fetching pharmacy registry...</p>
                </div>
            ) : filteredPharmacies.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/5 p-8 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground/90">No Pharmacies Found</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Try adjusting your filters or search terms.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {filteredPharmacies.map((pharmacy) => {
                            const isPendingAction = actioningId === pharmacy.id;
                            const isCurrentlyRejecting = rejectingId === pharmacy.id;

                            return (
                                <motion.div
                                    key={pharmacy.id}
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
                                                    {pharmacy.name}
                                                </h4>
                                                <span className="text-[9px] font-mono font-semibold bg-secondary/60 text-foreground/70 px-2 py-0.5 rounded border border-border/40">
                                                    Lic: {pharmacy.licenseNumber}
                                                </span>
                                                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase border ${
                                                    pharmacy.verificationStatus === "VERIFIED"
                                                        ? "bg-success/10 border-success/20 text-success"
                                                        : pharmacy.verificationStatus === "PENDING"
                                                          ? "bg-warning/10 border-warning/20 text-warning-foreground"
                                                          : pharmacy.verificationStatus === "REJECTED"
                                                            ? "bg-destructive/10 border-destructive/20 text-destructive"
                                                            : "bg-secondary/40 border-border/50 text-muted-foreground"
                                                }`}>
                                                    {pharmacy.verificationStatus}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5" />
                                                {pharmacy.location || "No location provided"}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            {pharmacy.licenseDocumentUrl ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDownload(pharmacy.licenseDocumentUrl!, pharmacy.licenseNumber)}
                                                    className="rounded-xl text-[12px] h-9 gap-1.5 border-border/60 hover:bg-secondary/30"
                                                >
                                                    <Download className="h-3.5 w-3.5" /> Download License
                                                </Button>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground italic px-3 py-1">
                                                    No file uploaded
                                                </span>
                                            )}

                                            {!pharmacy.isVerified && pharmacy.verificationStatus !== "REJECTED" && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        disabled={isPendingAction || !pharmacy.licenseDocumentUrl}
                                                        onClick={() => void handleApprove(pharmacy.id)}
                                                        className="rounded-xl text-[12px] h-9 bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                                                    >
                                                        {isPendingAction && actioningId === pharmacy.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                        )}
                                                        Approve
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={isPendingAction || !pharmacy.licenseDocumentUrl}
                                                        onClick={() => handleStartReject(pharmacy.id)}
                                                        className="rounded-xl text-[12px] h-9 border-destructive/20 hover:bg-destructive/5 text-destructive hover:text-destructive gap-1.5"
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        Reject
                                                    </Button>
                                                </>
                                            )}

                                            {pharmacy.isVerified && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isPendingAction}
                                                    onClick={() => void handleUnverify(pharmacy.id)}
                                                    className="rounded-xl text-[12px] h-9 border-warning/20 hover:bg-warning/5 text-warning-foreground gap-1.5"
                                                >
                                                    <ShieldOff className="h-3.5 w-3.5" /> Revoke
                                                </Button>
                                            )}

                                            {pharmacy.verificationStatus === "REJECTED" && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isPendingAction}
                                                    onClick={() => void handleUnverify(pharmacy.id)}
                                                    className="rounded-xl text-[12px] h-9 border-border/60 hover:bg-secondary/30 gap-1.5"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" /> Reset to Pending
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expandable Pharmacy Details */}
                                    <div className="mt-3.5 border-t border-border/20 pt-3">
                                        <button
                                            onClick={() => toggleExpand(pharmacy.id)}
                                            className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 focus:outline-none transition-colors"
                                        >
                                            {expandedIds[pharmacy.id] ? (
                                                <>Hide Details <ChevronUp className="h-3.5 w-3.5" /></>
                                            ) : (
                                                <>View Full Profile <ChevronDown className="h-3.5 w-3.5" /></>
                                            )}
                                        </button>
                                    </div>

                                    <AnimatePresence initial={false}>
                                        {expandedIds[pharmacy.id] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.25, ease }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3.5 p-4 rounded-xl bg-secondary/20 border border-border/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Address</span>
                                                        <p className="text-foreground/90 font-medium break-words">{pharmacy.address || "Not provided"}</p>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Phone</span>
                                                        <p className="text-foreground/90 font-medium break-words">{pharmacy.businessPhone || "Not provided"}</p>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</span>
                                                        <p className="text-foreground/90 font-medium break-words">{pharmacy.businessEmail || "Not provided"}</p>
                                                    </div>
                                                    {pharmacy.remarks && (
                                                        <div className="space-y-0.5 sm:col-span-2">
                                                            <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">Rejection Remarks</span>
                                                            <p className="text-destructive font-medium break-words">{pharmacy.remarks}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Rejection Input */}
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
                                                            placeholder="Specify why this pharmacy license is being rejected..."
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
                                                        onClick={() => void handleRejectSubmit(pharmacy.id)}
                                                        className="rounded-xl h-8 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                    >
                                                        {isPendingAction && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
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
