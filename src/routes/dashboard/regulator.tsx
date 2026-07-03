import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Building2, ShieldAlert, BarChart3, Users,
    FileText, Search, Filter, ArrowUpRight,
    AlertTriangle, CheckCircle2, MoreVertical,
    Download, LayoutDashboard, Globe2, Landmark,
    Scale, Megaphone, Pill, MapPin, Loader2
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DashShell } from "@/components/dashboard/DashShell";
import { DASH_NAV } from "@/config/nav";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentReviewPanel } from "@/components/dashboard/admin/DocumentReviewPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export const Route = createFileRoute("/dashboard/regulator")({
    head: () => ({
        meta: [
            { title: "DRAP Regulatory Portal — MediVerify" },
            { name: "description", content: "National healthcare surveillance and regulatory inspection dashboard." },
        ],
    }),
    component: RegulatorDashboard,
});

function RegulatorDashboard() {
    const { user, session, isAuthenticated, signOut, isLoading } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [recalls, setRecalls] = useState<any[]>([]);
    const [heatmapData, setHeatmapData] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (isAuthenticated && user?.role !== "REGULATOR" && user?.role !== "DRAP_ADMIN" && user?.role !== "ADMIN") {
            signOut();
        }
    }, [isAuthenticated, user?.role, signOut]);

    useEffect(() => {
        if (!session?.token) return;
        const headers = { "Authorization": `Bearer ${session.token}` };
        Promise.all([
            fetch("/api/regulator/stats", { headers }).then(r => r.json()),
            fetch("/api/regulator/recalls", { headers }).then(r => r.json()),
            fetch("/api/regulator/heatmap", { headers }).then(r => r.json()),
        ]).then(([statsRes, recallsRes, heatmapRes]) => {
            if (statsRes.success) setStats(statsRes.data);
            if (recallsRes.success) setRecalls(recallsRes.data);
            if (heatmapRes.success) setHeatmapData(heatmapRes.data);
        }).finally(() => setLoadingData(false));
    }, [session?.token]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated) return <Navigate to="/auth/login" />;
    if (user?.role !== "REGULATOR" && user?.role !== "DRAP_ADMIN" && user?.role !== "ADMIN") return <Navigate to="/auth/login" />;

    return (
        <DashShell
            title="Regulatory Oversight Portal"
            subtitle="National Healthcare Surveillance & DRAP Integration"
            badge="Government"
            nav={DASH_NAV}
        >
            <div className="space-y-6">
                {/* Regulatory Stats */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard icon={Landmark} label="DRAP Inspections" value={stats?.totalScans ?? "..."} delta={12} sparkline={[40, 55, 60, 45, 80, 95, 110, 142]} />
                    <StatCard icon={ShieldAlert} label="Active Recalls" value={stats?.activeRecalls ?? "..."} delta={-2} tone="destructive" sparkline={[5, 8, 12, 10, 15, 8, 6, 4]} />
                    <StatCard icon={FileText} label="Pending Reports" value={stats?.suspiciousScans ?? "..."} delta={5} tone="warning" sparkline={[20, 25, 30, 45, 50, 42, 38, 35]} />
                    <StatCard icon={Scale} label="Blacklisted Entities" value={stats?.blacklistedPharmacies ?? "..."} delta={1} tone="destructive" sparkline={[5, 5, 6, 6, 7, 8, 8, 9]} />
                </div>

                {heatmapData.length > 0 && (
                    <div className="rounded-xl border border-border/50 bg-card p-5 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <MapPin className="h-4 w-4 text-red-500" />
                            <h3 className="font-semibold text-sm">Fake Medicine Hotspots — Pakistan</h3>
                            <span className="ml-auto text-xs text-muted-foreground">Based on verified scan reports</span>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={heatmapData} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="city" tick={{ fontSize: 12 }} width={85} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(val: any) => [val + " reports", "Fake scans"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="fakeCount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                                    {heatmapData.map((entry: any, i: number) => (
                                        <Cell key={i} fill={entry.riskLevel === "HIGH" ? "#DC2626" : entry.riskLevel === "MEDIUM" ? "#D97706" : "#16A34A"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 mt-3">
                            {[["HIGH", "#DC2626", "High Risk"], ["MEDIUM", "#D97706", "Medium Risk"], ["LOW", "#16A34A", "Low Risk"]].map(([level, color, label]) => (
                                <div key={level} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                                    <span className="text-xs text-muted-foreground">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column: Complaints & Investigations */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="card-premium p-0 overflow-hidden">
                            <Tabs defaultValue="complaints" className="w-full">
                                <div className="px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/10">
                                    <TabsList className="bg-secondary/40 h-9 p-1 w-full sm:w-auto">
                                        <TabsTrigger value="complaints" className="text-[11px] font-bold uppercase tracking-widest px-4 flex-1 sm:flex-none">Consumer Complaints</TabsTrigger>
                                        <TabsTrigger value="inspections" className="text-[11px] font-bold uppercase tracking-widest px-4 flex-1 sm:flex-none">Active Investigations</TabsTrigger>
                                        <TabsTrigger value="documents" className="text-[11px] font-bold uppercase tracking-widest px-4 flex-1 sm:flex-none">Document Review</TabsTrigger>
                                    </TabsList>
                                    <Button variant="outline" size="sm" className="rounded-full h-8 px-4 text-[11px] font-bold w-full sm:w-auto">
                                        <Download className="h-3.5 w-3.5 mr-2" /> Export Audit Log
                                    </Button>
                                </div>
                                <TabsContent value="complaints" className="m-0">
                                    <div className="p-0">
                                        <div className="py-20 text-center flex flex-col items-center">
                                            <div className="h-16 w-16 bg-secondary/20 rounded-full flex items-center justify-center mb-4">
                                                <FileText className="h-8 w-8 text-muted-foreground opacity-30" />
                                            </div>
                                            <p className="text-muted-foreground font-medium">Regional complaint nodes are currently restricted.</p>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="inspections" className="m-0 p-12 text-center text-muted-foreground">
                                    Inspection tracking module is synchronizing with regional nodes...
                                </TabsContent>
                                <TabsContent value="documents" className="m-0">
                                    <div className="p-6">
                                        <DocumentReviewPanel />
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* Recent Recalls Monitor */}
                        <div className="card-premium p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-[14px] font-bold flex items-center gap-2">
                                    <Megaphone className="h-4 w-4 text-destructive" /> Emergency Recall Monitor
                                </h3>
                                <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 font-black text-[10px]">REAL-TIME</Badge>
                            </div>
                            <div className="space-y-4">
                                {recalls.map((recall) => (
                                    <div key={recall.id} className="p-4 rounded-2xl border border-white/5 bg-secondary/20 flex items-center gap-4">
                                        <div className="h-10 w-10 shrink-0 rounded-xl bg-destructive/10 grid place-items-center">
                                            <AlertTriangle className="h-5 w-5 text-destructive" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-bold truncate">{recall.medicine?.name} (Batch {recall.batchNumber})</p>
                                            <p className="text-[11px] text-muted-foreground line-clamp-1">{recall.recallReason || "Safety non-compliance detected"}</p>
                                            <p className="text-[10px] text-primary mt-0.5">{recall.medicine?.manufacturer?.companyName}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[11px] font-black uppercase text-destructive tracking-widest italic">Recall Active</p>
                                            <p className="text-[10px] text-muted-foreground">{new Date(recall.updatedAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Blacklist & Registry */}
                    <div className="space-y-6">
                        <div className="card-premium p-6 border-destructive/20">
                            <h3 className="text-[14px] font-black tracking-widest uppercase text-destructive mb-6 flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4" /> Blacklisted Entities
                            </h3>
                            <div className="space-y-4">
                                {stats?.blacklistedPharmacies > 0 ? (
                                    <div className="p-4 rounded-2xl border border-destructive/10 bg-destructive/[0.03] space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                                <h4 className="text-[13px] font-bold truncate">High Risk Entities Identified</h4>
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" /> Multiple Locations
                                                </p>
                                            </div>
                                            <Badge className="bg-destructive text-[9px] font-black shadow-[0_0_10px_rgba(239,68,68,0.3)]">MONITORED</Badge>
                                        </div>
                                        <div className="pt-2 border-t border-destructive/10">
                                            <p className="text-[9px] font-black uppercase opacity-50 mb-1">Recent Violations</p>
                                            <p className="text-[10px] text-destructive/80 font-medium italic">Entities found distributing non-verified batches in {heatmapData[0]?.city || "current hubs"}.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center text-muted-foreground text-[12px]">No new blacklisted entities this week.</div>
                                )}
                            </div>
                        </div>

                        {/* Regulatory Alerts Config */}
                        <div className="card-premium p-6 bg-gradient-to-br from-primary/10 to-transparent">
                            <h3 className="text-[14px] font-bold mb-4">Emergency Alert System</h3>
                            <div className="space-y-3">
                                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-[11px] font-bold mb-1">Target Region</p>
                                    <select className="w-full bg-black/20 border-none rounded-lg text-[12px] h-8 px-2 font-medium">
                                        <option>All Pakistan</option>
                                        <option>Sindh</option>
                                        <option>Punjab</option>
                                    </select>
                                </div>
                                <Button className="w-full rounded-xl bg-primary h-11 text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                                    <Megaphone className="h-4 w-4 mr-2" /> Broadcast Alert
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashShell>
    );
}

function ReportListItem({ report, onStatusUpdate }: { report: any, onStatusUpdate: any }) {
    const statusColors = {
        pending: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        investigating: "text-primary bg-primary/10 border-primary/20",
        verified: "text-destructive bg-destructive/10 border-destructive/20",
        dismissed: "text-muted-foreground bg-secondary border-white/5"
    };

    return (
        <div className="p-5 hover:bg-white/[0.02] transition-colors group">
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <Pill className="h-4 w-4 text-primary shrink-0" />
                        <h4 className="text-[14px] font-bold truncate tracking-tight">{report.medicineName}</h4>
                        <Badge className={`${statusColors[report.status as keyof typeof statusColors]} text-[9px] font-black px-2 py-0 h-4 border uppercase tracking-widest`}>
                            {report.status}
                        </Badge>
                    </div>
                    <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" /> Purchased: {report.pharmacyName} · <MapPin className="h-3 w-3" /> {report.location}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-muted-foreground mb-1">{new Date(report.submittedAt).toLocaleDateString()}</p>
                    <p className="text-[11px] font-mono opacity-50">REF: {report.id.toUpperCase()}</p>
                </div>
            </div>

            <div className="bg-black/20 p-3 rounded-xl border border-white/5 mb-4 group-hover:border-primary/20 transition-colors">
                <p className="text-[12px] text-muted-foreground leading-relaxed italic">"{report.description}"</p>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[10px] font-bold uppercase"
                        onClick={() => onStatusUpdate(report.id, 'investigating')}
                    >
                        Mark Investigating
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-[10px] font-bold uppercase"
                        onClick={() => onStatusUpdate(report.id, 'verified')}
                    >
                        Verify Fraud
                    </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
