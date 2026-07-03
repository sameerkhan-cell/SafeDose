import { useRef } from "react";
import { motion } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import { Package, Pill, Copy, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ease } from "@/lib/motion";
import { useState } from "react";

interface DualQRCardProps {
    type: "carton" | "box" | "pill";
    qrValue: string;
    label: string;
    sublabel?: string;
    badge?: string;
    onDownloadPng?: (canvas: HTMLCanvasElement) => void;
    onCopy?: () => void;
}

export function DualQRCard({
    type,
    qrValue,
    label,
    sublabel,
    badge,
    onDownloadPng,
    onCopy,
}: DualQRCardProps) {
    const qrRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    const isCarton = type === "carton";
    const isBox = type === "box";
    const Icon = isCarton ? Package : (isBox ? Package : Pill);
    const accent = isCarton
        ? "from-amber-500/20 via-amber-500/5 to-transparent"
        : (isBox ? "from-primary/20 via-primary/5 to-transparent" : "from-success/20 via-success/5 to-transparent");
    const dotColor = isCarton ? "bg-amber-500" : (isBox ? "bg-primary" : "bg-success");
    const textColor = isCarton ? "text-amber-500" : (isBox ? "text-primary" : "text-success");
    const borderColor = isCarton ? "border-amber-500/30" : (isBox ? "border-primary/30" : "border-success/30");

    const handleCopy = () => {
        navigator.clipboard.writeText(qrValue);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        if (!qrRef.current) return;
        const canvas = qrRef.current.querySelector("canvas");
        if (canvas && onDownloadPng) onDownloadPng(canvas);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
            className={`relative overflow-hidden rounded-2xl border-2 ${borderColor} bg-card`}
        >
            {/* Holographic background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${accent} pointer-events-none`} />
            {/* Holo shimmer overlay */}
            <div className="absolute inset-0 holo pointer-events-none opacity-50" />

            {/* Content */}
            <div className="relative z-10 p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${isBox ? "from-primary to-primary/70" : "from-success to-success/70"} shadow-elegant`}>
                            <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className={`text-[12px] font-bold uppercase tracking-wider ${textColor}`}>
                                {isCarton ? "Carton QR" : (isBox ? "Box QR" : "Pill QR")}
                            </p>
                            {badge && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isCarton ? "bg-amber-500/10 text-amber-500" : (isBox ? "bg-primary/10 text-primary" : "bg-success/10 text-success")}`}>
                                    {badge}
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Live dot */}
                    <span className={`flex items-center gap-1.5 text-[10px] text-muted-foreground`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor} pulse-dot`} />
                        Active
                    </span>
                </div>

                {/* QR Code */}
                <div
                    ref={qrRef}
                    className="flex justify-center"
                >
                    <div className={`rounded-xl border-2 ${borderColor} bg-white p-3 shadow-sm`}>
                        <QRCodeCanvas
                            value={qrValue}
                            size={256}
                            level="H"
                            style={{ width: "100%", height: "auto", maxWidth: "160px" }}
                            includeMargin={false}
                            bgColor="#ffffff"
                            fgColor="#0a0c18"
                        />
                    </div>
                </div>

                {/* QR Code value */}
                <div className={`rounded-xl border ${borderColor} bg-background/50 p-3`}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">QR Code</p>
                    <p className={`font-mono text-[11px] font-bold ${textColor} break-all leading-relaxed`}>
                        {qrValue}
                    </p>
                    {sublabel && (
                        <p className="mt-1 text-[10px] text-muted-foreground">{sublabel}</p>
                    )}
                </div>

                {/* Label */}
                <div className="text-center">
                    <p className="text-[12px] font-semibold">{label}</p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 w-full">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className={`w-full rounded-xl text-[11px] h-8 border ${borderColor} hover:${isBox ? "bg-primary/5" : "bg-success/5"}`}
                    >
                        {copied
                            ? <><CheckCircle2 className="mr-1 h-3 w-3 text-success" />Copied!</>
                            : <><Copy className="mr-1 h-3 w-3" />Copy QR</>
                        }
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleDownload}
                        className={`w-full rounded-xl text-[11px] h-8 ${isCarton ? "bg-gradient-to-br from-amber-500 to-amber-600" : (isBox ? "bg-gradient-primary" : "bg-gradient-success")} text-white shadow-elegant`}
                    >
                        <Download className="mr-1 h-3 w-3" />PNG
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
