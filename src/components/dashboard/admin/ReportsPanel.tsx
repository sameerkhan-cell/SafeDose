import React, { useState, useEffect, useCallback } from "react";
import {
    AlertTriangle,
    Loader2,
    FileText,
    User,
    Building2,
    Calendar,
    Hash,
    ChevronDown,
    ChevronUp,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminReportsService, type AdminReportItem } from "@/services/admin-reports";
import { ease } from "@/lib/motion";
import { motion, AnimatePresence } from "framer-motion";

// ── Role badge ──────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
    const roleUpper = role.toUpperCase();
    if (roleUpper === "PATIENT") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                <User className="h-2.5 w-2.5" />
                Patient
            </span>
        );
    }
    if (roleUpper === "PHARMACY") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-600 border border-violet-500/20">
                <Building2 className="h-2.5 w-2.5" />
                Pharmacy
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground border border-border/50">
            {role}
        </span>
    );
}

// ── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        PENDING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        REVIEWING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        RESOLVED: "bg-green-500/10 text-green-600 border-green-500/20",
        DISMISSED: "bg-muted text-muted-foreground border-border/50",
    };
    const cls = map[status] ?? "bg-secondary text-foreground border-border/50";
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
            {status}
        </span>
    );
}

// ── Status dropdown per row ─────────────────────────────────────────────────

const STATUSES = ["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"] as const;

function StatusSelect({
    reportId,
    current,
    onUpdated,
}: {
    reportId: string;
    current: string;
    onUpdated: (id: string, newStatus: string) => void;
}) {
    const [loading, setLoading] = useState(false);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;
        if (newStatus === current) return;
        setLoading(true);
        const res = await adminReportsService.updateStatus(reportId, newStatus);
        setLoading(false);
        if (res.success) {
            onUpdated(reportId, newStatus);
            toast.success(`Report status updated to ${newStatus}.`);
        } else {
            toast.error(res.error?.message ?? "Failed to update status.");
        }
    };

    return (
        <div className="relative flex items-center">
            {loading && <Loader2 className="absolute left-2 h-3 w-3 animate-spin text-primary z-10" />}
            <select
                value={current}
                onChange={handleChange}
                disabled={loading}
                className="h-7 rounded-lg border border-border/60 bg-secondary/30 pl-6 pr-6 text-[11px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 cursor-pointer appearance-none"
            >
                {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-1.5 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
    );
}

// ── ReportRow ───────────────────────────────────────────────────────────────

function ReportRow({
    report,
    onStatusUpdated,
}: {
    report: AdminReportItem;
    onStatusUpdated: (id: string, newStatus: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="p-4 flex items-start justify-between gap-4">
                {/* Left: medicine + submitter */}
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground truncate">{report.medicineName}</p>
                        <RoleBadge role={report.user.role} />
                        <StatusBadge status={report.status} />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                        {report.batchNumber && (
                            <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                <span className="font-mono">{report.batchNumber}</span>
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {report.user.name ?? report.user.email}
                        </span>
                        {report.pharmacyName && (
                            <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {report.pharmacyName}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(report.createdAt).toLocaleDateString("en-PK", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                            })}
                        </span>
                    </div>
                    {/* Description preview */}
                    <p className={`text-[12px] text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
                        {report.description}
                    </p>
                    {report.description.length > 120 && (
                        <button
                            onClick={() => setExpanded((p) => !p)}
                            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                            {expanded ? (
                                <><ChevronUp className="h-3 w-3" /> Show less</>
                            ) : (
                                <><ChevronDown className="h-3 w-3" /> Show more</>
                            )}
                        </button>
                    )}
                </div>

                {/* Right: status dropdown */}
                <div className="flex-shrink-0">
                    <StatusSelect reportId={report.id} current={report.status} onUpdated={onStatusUpdated} />
                </div>
            </div>
        </div>
    );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

const ROLE_FILTERS = [
    { label: "All Reports", value: undefined },
    { label: "Patient Reports", value: "PATIENT" },
    { label: "Pharmacy Reports", value: "PHARMACY" },
] as const;

const STATUS_FILTERS = [
    { label: "All Statuses", value: undefined },
    { label: "Pending", value: "PENDING" },
    { label: "Reviewing", value: "REVIEWING" },
    { label: "Resolved", value: "RESOLVED" },
    { label: "Dismissed", value: "DISMISSED" },
] as const;

export function ReportsPanel() {
    const [reports, setReports] = useState<AdminReportItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        const res = await adminReportsService.getReports({ role: roleFilter, status: statusFilter });
        setLoading(false);
        if (res.success && res.data) {
            setReports(res.data);
        } else {
            setError(res.error?.message ?? "Failed to load reports.");
        }
    }, [roleFilter, statusFilter]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleStatusUpdated = (id: string, newStatus: string) => {
        setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus } : r));
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="font-semibold text-base">Submitted Reports</h2>
                    <p className="text-xs text-muted-foreground">
                        Counterfeit medicine complaints from patients and pharmacies
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchReports} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                {/* Role filter pills */}
                <div className="flex gap-1 bg-secondary/30 rounded-xl p-1">
                    {ROLE_FILTERS.map((f) => (
                        <button
                            key={f.label}
                            onClick={() => setRoleFilter(f.value)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                roleFilter === f.value
                                    ? "bg-card shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Status dropdown */}
                <div className="relative flex items-center">
                    <select
                        value={statusFilter ?? ""}
                        onChange={(e) => setStatusFilter(e.target.value || undefined)}
                        className="h-8 rounded-xl border border-border/60 bg-secondary/30 pl-3 pr-7 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
                    >
                        {STATUS_FILTERS.map((f) => (
                            <option key={f.label} value={f.value ?? ""}>{f.label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 h-3 w-3 text-muted-foreground pointer-events-none" />
                </div>
            </div>

            {/* Body */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading reports...
                </div>
            ) : error ? (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
            ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">No reports submitted yet</p>
                    <p className="text-xs mt-1 opacity-70">Reports from patients and pharmacies will appear here.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {reports.map((report) => (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease }}
                        >
                            <ReportRow report={report} onStatusUpdated={handleStatusUpdated} />
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
