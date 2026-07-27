import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
    Smartphone, Zap, WifiOff, Send,
    ArrowLeft, CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/verify-lite")({
    head: () => ({
        meta: [
            { title: "Lite Verification — SafeDose" },
            { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
        ],
    }),
    component: LiteVerifyPage,
});

function LiteVerifyPage() {
    const [code, setCode] = useState("");
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        if (!code) return;
        setLoading(true);
        try {
            const res = await fetch("/api/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: code.trim().toUpperCase(),
                    location: "Lite Verification Portal",
                    deviceInfo: "MediVerify Public Verify",
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setResult({
                    isValid: false,
                    status: "invalid",
                    message: data.message || "Verification failed. Please try again.",
                });
                return;
            }

            const d = data.data;
            const resultType = (d.resultType ?? "INVALID").toUpperCase();

            setResult({
                isValid: resultType === "GENUINE",
                status:
                    resultType === "GENUINE" ? "genuine"
                    : resultType === "DUPLICATE" ? "duplicate"
                    : resultType === "SUSPICIOUS" || resultType === "EXPIRED" ? "suspected"
                    : "invalid",
                message: d.message || "Verification complete.",
                batchDetails:
                    d.batch && d.medicine && d.manufacturer
                        ? {
                            name: d.medicine.name,
                            batchNumber: d.batch.batchNumber,
                            manufacturer: d.manufacturer.companyName,
                            expiry: d.batch.expiryDate
                                ? new Date(d.batch.expiryDate).toLocaleDateString("en-PK", {
                                    year: "numeric",
                                    month: "short",
                                })
                                : "N/A",
                            txHash: d.blockchain?.txHash || "PENDING",
                        }
                        : undefined,
                warnings: d.warnings ?? [],
                riskScore: d.riskScore ?? 0,
            });
        } catch {
            setResult({
                isValid: false,
                status: "invalid",
                message: "Network error. Please check your connection and try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white text-black p-4 font-sans">
            {/* Minimal Header */}
            <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <Link to="/" className="flex items-center gap-2 text-primary font-bold">
                    <Zap className="h-5 w-5 fill-primary" /> SafeDose LITE
                </Link>
                <div className="flex items-center gap-1.5 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" /> LOW-BANDWIDTH MODE
                </div>
            </header>

            <main className="max-w-md mx-auto">
                {!result ? (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h1 className="text-2xl font-bold mb-2">Check your medicine</h1>
                            <p className="text-gray-500 text-sm">Works even on slow 2G/3G connections.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 ml-1">Code from Medicine</label>
                                <Input
                                    placeholder="Enter batch number or QR code"
                                    className="h-14 text-lg font-mono border-2 border-gray-200 rounded-xl focus:border-primary"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                />
                            </div>
                            <Button
                                onClick={handleVerify}
                                disabled={loading}
                                className="w-full h-14 text-lg font-bold rounded-xl"
                            >
                                {loading ? "Checking..." : "Verify Identity"}
                            </Button>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                                <Smartphone className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-blue-800">No data connection?</p>
                                <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                                    Send <span className="font-mono bg-blue-200 px-1 rounded">VERIFY {code || 'CODE'}</span> to <span className="font-bold underline text-blue-800">8002</span>
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 pt-4 animate-in fade-in duration-300">
                        <div className={`p-8 rounded-2xl text-center border-4 ${result.status === 'genuine' ? 'bg-green-50 border-green-200' :
                            result.status === 'error' ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'
                            }`}>
                            {result.status === 'genuine' ? (
                                <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-4" />
                            ) : (
                                <XCircle className="h-14 w-14 text-red-600 mx-auto mb-4" />
                            )}
                            <h2 className={`text-2xl font-black mb-2 uppercase ${result.status === 'genuine' ? 'text-green-700' : 'text-red-700'
                                }`}>
                                {result.status === 'genuine' ? 'GENUINE' : result.status === 'error' ? 'SYSTEM ERROR' : 'FAKE / SUSPICIOUS'}
                            </h2>
                            <p className="font-bold text-gray-700">{result.batchDetails?.name || (result.pillDetails ? 'Pill #' + result.pillDetails.pillNumber : '')}</p>
                            <p className="text-sm text-gray-500 mt-2">{result.message}</p>
                        </div>

                        <div className="space-y-3">
                            <Button variant="outline" onClick={() => setResult(null)} className="w-full h-12 rounded-xl text-primary font-bold border-primary/20">
                                Check Another Medicine
                            </Button>
                            <Link to="/">
                                <Button variant="ghost" className="w-full h-12 text-gray-500 font-bold">
                                    Back to Full Version
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </main>

            {/* Accessibility Footer */}
            <footer className="mt-12 text-center border-t border-gray-100 pt-6">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-loose">
                    SafeDose Rural Access Initiative<br />Supported by DRAP Public Health Network
                </p>
                <div className="flex justify-center gap-4 mt-4">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <WifiOff className="h-3 w-3" /> Offline Ready
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <Send className="h-3 w-3" /> SMS Backup
                    </div>
                </div>
            </footer>
        </div>
    );
}
