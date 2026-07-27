import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import {
  QrCode, X, Download, Copy, CheckCircle2, ShieldCheck,
  Hash, Building2, Calendar, Package, Pill, Link2, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ease } from "@/lib/motion";

interface GeneratedQR {
  batchId: string;
  medicine: string;
  manufacturer: string;
  quantity: number;
  expiry: string;
  txHash: string;
  payload: string;
  timestamp: string;
}

function generateBatchId(): string {
  const prefixes = ["PNX", "VNT", "AUG", "RSK", "BRF", "CLN", "DSP"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(10000 + Math.random() * 89999);
  const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 6));
  return `${prefix}-${num}-${suffix}`;
}

function generateTxHash(): string {
  const hex = "0123456789abcdef";
  let hash = "0x";
  for (let i = 0; i < 40; i++) hash += hex[Math.floor(Math.random() * 16)];
  return hash;
}

export function QRGeneratorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"form" | "generating" | "result">("form");
  const [medicine, setMedicine] = useState("");
  const [manufacturer, setManufacturer] = useState("GlaxoSmithKline Pakistan");
  const [quantity, setQuantity] = useState("25000");
  const [expiry, setExpiry] = useState("2027-03");
  const [generated, setGenerated] = useState<GeneratedQR | null>(null);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setStep("form");
    setMedicine("");
    setQuantity("25000");
    setExpiry("2027-03");
    setGenerated(null);
  };

  const handleGenerate = () => {
    if (!medicine.trim()) return;
    setStep("generating");

    // Simulate blockchain registration delay
    setTimeout(() => {
      const batchId = generateBatchId();
      const txHash = generateTxHash();
      const payload = JSON.stringify({
        v: "MediVerify-1.0",
        batch: batchId,
        med: medicine.trim(),
        mfg: manufacturer,
        qty: parseInt(quantity) || 25000,
        exp: expiry,
        tx: txHash,
        ts: new Date().toISOString(),
        chain: "MediVerify-L2",
      });

      setGenerated({
        batchId,
        medicine: medicine.trim(),
        manufacturer,
        quantity: parseInt(quantity) || 25000,
        expiry,
        txHash,
        payload,
        timestamp: new Date().toLocaleString(),
      });
      setStep("result");
    }, 2200);
  };

  const handleDownload = useCallback(() => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector("canvas");
    if (!canvas) return;

    // Create a styled download canvas
    const dlCanvas = document.createElement("canvas");
    const ctx = dlCanvas.getContext("2d");
    if (!ctx) return;

    const padding = 40;
    const labelH = 60;
    dlCanvas.width = canvas.width + padding * 2;
    dlCanvas.height = canvas.height + padding * 2 + labelH;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dlCanvas.width, dlCanvas.height);

    // Draw QR
    ctx.drawImage(canvas, padding, padding);

    // Label
    ctx.fillStyle = "#000000";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      generated?.batchId || "BATCH",
      dlCanvas.width / 2,
      canvas.height + padding + 28
    );
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#666666";
    ctx.fillText(
      `SafeDose · ${generated?.medicine || ""}`,
      dlCanvas.width / 2,
      canvas.height + padding + 48
    );

    const link = document.createElement("a");
    link.download = `SafeDose-QR-${generated?.batchId || "batch"}.png`;
    link.href = dlCanvas.toDataURL("image/png");
    link.click();
  }, [generated]);

  const handleCopy = useCallback(() => {
    if (!generated) return;
    navigator.clipboard.writeText(generated.payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generated]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-lg rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-white shadow-elegant">
                  <QrCode className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold">Generate Blockchain QR Code</h2>
                  <p className="text-[11px] text-muted-foreground">Immutable medicine verification code</p>
                </div>
              </div>
              <button
                onClick={() => { reset(); onClose(); }}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <AnimatePresence mode="wait">
                {/* STEP 1: Form */}
                {step === "form" && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25, ease }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Pill className="h-3 w-3" /> Medicine Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={medicine}
                        onChange={(e) => setMedicine(e.target.value)}
                        placeholder="e.g. Panadol Extra 500mg"
                        className="h-11 rounded-xl text-[14px] bg-secondary/20"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" /> Manufacturer
                      </label>
                      <Input
                        value={manufacturer}
                        onChange={(e) => setManufacturer(e.target.value)}
                        className="h-11 rounded-xl text-[14px] bg-secondary/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <Package className="h-3 w-3" /> Quantity
                        </label>
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="h-11 rounded-xl text-[14px] bg-secondary/20"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" /> Expiry
                        </label>
                        <Input
                          type="month"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          className="h-11 rounded-xl text-[14px] bg-secondary/20"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-[12px] text-foreground/70 flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      A unique Batch ID and blockchain transaction hash will be auto-generated and permanently linked to this QR code.
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: Generating */}
                {step === "generating" && (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="py-10 text-center"
                  >
                    <div className="relative mx-auto h-20 w-20 mb-6">
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-primary/30"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-primary/20"
                        animate={{ scale: [1, 1.7, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 1.5, delay: 0.3, repeat: Infinity }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                          className="h-14 w-14 rounded-full bg-gradient-primary shadow-elegant flex items-center justify-center"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <Link2 className="h-6 w-6 text-primary-foreground" />
                        </motion.div>
                      </div>
                    </div>
                    {["Registering batch on blockchain…", "Generating unique QR hash…", "Minting verification token…"].map((txt, i) => (
                      <motion.p
                        key={txt}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.6, duration: 0.4 }}
                        className="text-[13px] text-foreground/80 font-medium mt-1"
                      >
                        {i < 2 ? "✓" : "⟳"} {txt}
                      </motion.p>
                    ))}
                  </motion.div>
                )}

                {/* STEP 3: Result */}
                {step === "result" && generated && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-5"
                  >
                    {/* Success banner */}
                    <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/20 px-4 py-3">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="text-[13px] font-bold text-success">QR Code Generated Successfully</p>
                        <p className="text-[11px] text-foreground/70">Registered on SafeDose blockchain</p>
                      </div>
                    </div>

                    {/* QR + Details */}
                    <div className="flex flex-col sm:flex-row gap-5 items-center">
                      <div ref={qrRef} className="shrink-0 rounded-2xl border-2 border-border/60 bg-white p-4 shadow-sm">
                        <QRCodeCanvas
                          value={generated.payload}
                          size={180}
                          level="H"
                          includeMargin={false}
                          bgColor="#ffffff"
                          fgColor="#0a0c18"
                        />
                      </div>
                      <div className="flex-1 space-y-2.5 w-full">
                        {[
                          { icon: Hash, label: "Batch ID", value: generated.batchId, mono: true },
                          { icon: Pill, label: "Medicine", value: generated.medicine },
                          { icon: Building2, label: "Manufacturer", value: generated.manufacturer },
                          { icon: Package, label: "Quantity", value: generated.quantity.toLocaleString() + " units" },
                          { icon: Calendar, label: "Expiry", value: generated.expiry },
                        ].map(f => (
                          <div key={f.label} className="flex items-center gap-2.5 rounded-lg bg-secondary/30 border border-border/30 px-3 py-2">
                            <f.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted-foreground">{f.label}</p>
                              <p className={`text-[12px] font-semibold truncate ${f.mono ? "font-mono" : ""}`}>{f.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* TX Hash */}
                    <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Blockchain TX Hash</p>
                      <p className="font-mono text-[11px] text-foreground/80 break-all">{generated.txHash}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="border-t border-border/40 px-6 py-4 flex justify-between items-center">
              {step === "form" && (
                <>
                  <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="text-[13px]">Cancel</Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={!medicine.trim()}
                    className="rounded-xl bg-gradient-primary shadow-elegant text-[13px] font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                  >
                    <QrCode className="mr-2 h-4 w-4" /> Generate QR Code
                  </Button>
                </>
              )}
              {step === "generating" && (
                <p className="text-[12px] text-muted-foreground w-full text-center">Please wait…</p>
              )}
              {step === "result" && (
                <>
                  <Button variant="outline" onClick={() => { reset(); }} className="rounded-xl text-[13px] border-border/60">
                    Generate Another
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCopy} className="rounded-xl text-[13px] border-border/60">
                      {copied ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                      {copied ? "Copied!" : "Copy Data"}
                    </Button>
                    <Button onClick={handleDownload} className="rounded-xl bg-gradient-primary shadow-elegant text-[13px] font-medium transition-all hover:scale-[1.02]">
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Download PNG
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
