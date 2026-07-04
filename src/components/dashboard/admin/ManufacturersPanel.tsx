import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Building2,
    Shield,
    FileText,
    Phone,
    Mail,
    Globe,
    Calendar,
    AlertCircle,
    Loader2,
    CheckCircle2,
    Clock,
    Pill,
    ArrowLeft,
    ExternalLink,
    ChevronRight,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminManufacturersService, type AdminManufacturerItem, type AdminManufacturerReport } from "@/services/admin-manufacturers";
import { ease } from "@/lib/motion";

export function ManufacturersPanel() {
    const [manufacturers, setManufacturers] = useState<AdminManufacturerItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [report, setReport] = useState<AdminManufacturerReport | null>(null);
    const [reportLoading, setReportLoading] = useState(false);

    const loadManufacturers = useCallback(async () => {
        setLoading(true);
        const res = await adminManufacturersService.getManufacturers();
        if (res.success && res.data) {
            setManufacturers(res.data);
        } else {
            toast.error(res.error?.message ?? "Failed to load manufacturers.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void loadManufacturers();
    }, [loadManufacturers]);

    const loadReport = useCallback(async (id: string) => {
        setReportLoading(true);
        setReport(null);
        const res = await adminManufacturersService.getManufacturerReport(id);
        if (res.success && res.data) {
            setReport(res.data);
        } else {
            toast.error(res.error?.message ?? "Failed to load manufacturer details.");
            setSelectedId(null);
        }
        setReportLoading(false);
    }, []);

    useEffect(() => {
        if (selectedId) {
            void loadReport(selectedId);
        } else {
            setReport(null);
        }
    }, [selectedId, loadReport]);

    const handleBack = () => {
        setSelectedId(null);
    };

    if (selectedId) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBack}
                        className="rounded-xl border-border/60 hover:bg-secondary/30 h-9 gap-1.5"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to List
                    </Button>
                    <div>
                        <h3 className="text-[16px] font-bold flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            {report?.companyName || "Loading profile..."}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Manufacturer Drill-down Report & Credentials
                        </p>
                    </div>
                </div>

                {reportLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm">Assembling company registers...</p>
                    </div>
                ) : report ? (
                    <div className="space-y-6">
                        {/* Company Profile Details */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease }}
                            className="card-premium p-6 border-border/40"
                        >
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                                Company Credentials
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">License Number</span>
                                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                                        <Shield className="h-3.5 w-3.5 text-primary/80" />
                                        {report.licenseNumber}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Verification Status</span>
                                    <span className="inline-flex">
                                        {report.isVerified ? (
                                            <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1 rounded-full text-[10px] py-0.5 px-2.5">
                                                <CheckCircle2 className="h-3 w-3" /> Verified
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1 rounded-full text-[10px] py-0.5 px-2.5">
                                                <Clock className="h-3 w-3" /> Pending / Unverified
                                            </Badge>
                                        )}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Tax ID (NTN)</span>
                                    <span className="font-medium text-foreground">{report.taxId || "Not provided"}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Registration Number</span>
                                    <span className="font-medium text-foreground">{report.registrationNumber || "Not provided"}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Business Email</span>
                                    <span className="font-medium text-foreground flex items-center gap-1.5">
                                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                        {report.businessEmail || "Not provided"}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Business Phone</span>
                                    <span className="font-medium text-foreground flex items-center gap-1.5">
                                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                        {report.businessPhone || "Not provided"}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Website</span>
                                    <span className="font-medium text-foreground">
                                        {report.website ? (
                                            <a
                                                href={report.website.startsWith("http") ? report.website : `https://${report.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline inline-flex items-center gap-1"
                                            >
                                                {report.website} <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : (
                                            "Not provided"
                                        )}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Industry Type</span>
                                    <span className="font-medium text-foreground">{report.industryType || "Not provided"}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Full Address</span>
                                    <span className="font-medium text-foreground">{report.address || "Not provided"}</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Product & Batch Register */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold flex items-center gap-1.5">
                                <Pill className="h-4 w-4 text-primary" /> Registered Products & Batches
                            </h4>

                            {report.medicines.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/5 p-8 text-center">
                                    <AlertCircle className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-foreground/95">No Registered Products</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        This manufacturer has not registered any medicines in the catalog yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {report.medicines.map((med) => (
                                        <motion.div
                                            key={med.id}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="card-premium p-5 border-border/40 space-y-4 bg-background/40"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/20 pb-3">
                                                <div>
                                                    <h5 className="font-bold text-sm text-foreground/95 flex items-center gap-1.5">
                                                        <Pill className="h-4 w-4 text-primary" /> {med.name}
                                                        {med.dosage && (
                                                            <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-foreground/75 font-normal">
                                                                {med.dosage}
                                                            </span>
                                                        )}
                                                    </h5>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                                        {med.genericName ? `${med.genericName} • ` : ""}{med.category || "General Category"}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-mono bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20 font-bold">
                                                        DRAP Reg: {med.drapRegNumber || "Pending"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Batches Table */}
                                            {med.batches.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground italic pl-2">
                                                    No batches registered yet for this medicine.
                                                </p>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse text-[11px]">
                                                        <thead>
                                                            <tr className="border-b border-border/30 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                                                                <th className="py-2 px-3">Batch Number</th>
                                                                <th className="py-2 px-3">Manufacturing Date</th>
                                                                <th className="py-2 px-3">Expiry Date</th>
                                                                <th className="py-2 px-3 text-right">Quantity (Boxes)</th>
                                                                <th className="py-2 px-3 text-right">Generated Pills</th>
                                                                <th className="py-2 px-3 text-right">Scanned / Verified Pills</th>
                                                                <th className="py-2 px-3 text-center">Status</th>
                                                                <th className="py-2 px-3 text-center">Blockchain</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/20">
                                                            {med.batches.map((batch) => (
                                                                <tr key={batch.id} className="hover:bg-secondary/10 transition-colors">
                                                                    <td className="py-2 px-3 font-mono font-bold text-foreground">{batch.batchNumber}</td>
                                                                    <td className="py-2 px-3 text-muted-foreground">
                                                                        {new Date(batch.manufacturingDate).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-muted-foreground">
                                                                        {new Date(batch.expiryDate).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right font-medium">{batch.quantityBoxes.toLocaleString()}</td>
                                                                    <td className="py-2 px-3 text-right font-mono font-medium">{batch.totalPillsGenerated.toLocaleString()}</td>
                                                                    <td className="py-2 px-3 text-right font-mono font-medium text-success">
                                                                        {batch.verifiedPillsCount.toLocaleString()} / {batch.totalPillsCount.toLocaleString()}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                                            batch.status === "ACTIVE"
                                                                                ? "bg-success/10 text-success border border-success/20"
                                                                                : "bg-destructive/10 text-destructive border border-destructive/20"
                                                                        }`}>
                                                                            {batch.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                                            batch.blockchainStatus === "CONFIRMED"
                                                                                ? "bg-primary/10 text-primary border border-primary/20"
                                                                                : "bg-secondary text-muted-foreground"
                                                                        }`}>
                                                                            {batch.blockchainStatus}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-[15px] font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> Registered Manufacturers
                </h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                    Select a manufacturer to inspect registered pharmaceutical assets and QR code verification statistics
                </p>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">Fetching manufacturer profiles...</p>
                </div>
            ) : manufacturers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/5 p-8 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground/90">No Manufacturers Registered</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        There are currently no active manufacturer profiles in the database.
                    </p>
                </div>
            ) : (
                <div className="card-premium overflow-hidden border-border/40">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-border/30 bg-secondary/10 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                                    <th className="py-3.5 px-4">Company Name</th>
                                    <th className="py-3.5 px-4">License Number</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Medicines</th>
                                    <th className="py-3.5 px-4 text-right">Total Batches</th>
                                    <th className="py-3.5 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                {manufacturers.map((mfg) => (
                                    <tr
                                        key={mfg.id}
                                        onClick={() => setSelectedId(mfg.id)}
                                        className="hover:bg-secondary/20 cursor-pointer transition-colors"
                                    >
                                        <td className="py-3.5 px-4 font-bold text-foreground/95">{mfg.companyName}</td>
                                        <td className="py-3.5 px-4 font-mono text-muted-foreground">{mfg.licenseNumber}</td>
                                        <td className="py-3.5 px-4 text-center">
                                            {mfg.isVerified ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success border border-success/20">
                                                    <CheckCircle2 className="h-3 w-3" /> Verified
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/10 text-warning border border-warning/20">
                                                    <Clock className="h-3 w-3" /> Unverified
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-medium">{mfg.medicineCount}</td>
                                        <td className="py-3.5 px-4 text-right font-medium">{mfg.batchCount}</td>
                                        <td className="py-3.5 px-4 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 rounded-full hover:bg-secondary/40 text-primary"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedId(mfg.id);
                                                }}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
