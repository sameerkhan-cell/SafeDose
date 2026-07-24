import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode, Shield, ShieldCheck, ShieldAlert, Cpu, Zap,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Hash, Search, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ease } from "@/lib/motion";

type VerifyState = "idle" | "scanning" | "querying" | "matching" | "confirming" | "success" | "failure" | "duplicate";

const FLOW_STEPS = [
  { id: "scanning",   label: "QR Code Entered",            icon: QrCode,       color: "#06b6d4" },
  { id: "querying",   label: "Database & Ledger Queried",  icon: Cpu,          color: "#1a56db" },
  { id: "matching",   label: "Cryptographic Hash Matched", icon: Hash,         color: "#8b5cf6" },
  { id: "confirming", label: "Verification Confirmed",     icon: ShieldCheck,  color: "#1a56db" },
  { id: "success",    label: "Medicine Authenticated",     icon: CheckCircle2, color: "#16a34a" },
];

const STATE_LABELS: Partial<Record<VerifyState, string>> = {
  idle:       "Enter a QR code or tap a sample code below to verify",
  scanning:   "Reading QR code payload payload…",
  querying:   "Querying distributed blockchain nodes & DRAP ledger…",
  matching:   "Running cryptographic hash comparison…",
  confirming: "Confirming supply chain integrity…",
  success:    "Medicine verified — Safe to consume",
  failure:    "⚠ Verification failed — Possible counterfeit",
  duplicate:  "🔴 Duplicate scan detected — ALERT",
};

export function QRAuthFlow() {
  const [qrInput, setQrInput] = useState("");
  const [state, setState] = useState<VerifyState>("idle");
  const [stepIndex, setStepIndex] = useState(-1);
  const [resultData, setResultData] = useState<any>(null);
  const [sampleCodes, setSampleCodes] = useState<Array<{ code: string; label: string }>>([]);

  // Fetch real sample QR codes from cards API on mount
  useEffect(() => {
    async function loadSamples() {
      try {
        const res = await fetch("/api/blockchain/cards");
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const samples = json.data.slice(0, 3).map((item: any, idx: number) => ({
            code: item.txHash ? item.batchId : item.id,
            label: `Sample ${idx + 1}: ${item.medicineLabel}`,
          }));
          setSampleCodes(samples);
        }
      } catch {
        // Fallback default sample strings if fetch fails
        setSampleCodes([
          { code: "MFG-TM-TM-DIAG-MRWTRYF0-C1-B1-P1", label: "Sample 1: Genuine Pill P1" },
          { code: "MFG-TM-TM-DIAG-MRWTRYF0-C1-B1", label: "Sample 2: Box QR" },
        ]);
      }
    }
    loadSamples();
  }, []);

  const runVerification = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;
    setQrInput(codeToVerify);
    setState("scanning");
    setStepIndex(0);
    setResultData(null);

    try {
      // Step 2: Querying
      setTimeout(() => setStepIndex(1), 400);

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeToVerify.trim(),
          location: "Blockchain Command Center Verification",
        }),
      });

      const json = await res.json();

      // Step 3 & 4
      setStepIndex(2);
      await new Promise((r) => setTimeout(r, 300));
      setStepIndex(3);
      await new Promise((r) => setTimeout(r, 300));

      setResultData(json);

      const resultType = json.data?.resultType || json.resultType;
      if (json.success && resultType === "GENUINE") {
        setStepIndex(4);
        setState("success");
      } else if (resultType === "DUPLICATE") {
        setState("duplicate");
      } else {
        setState("failure");
      }
    } catch (err: any) {
      setResultData({ success: false, message: err?.message || "Verification API error" });
      setState("failure");
    }
  };

  const handleReset = () => {
    setState("idle");
    setStepIndex(-1);
    setResultData(null);
  };

  const isError = state === "failure" || state === "duplicate";
  const isSuccess = state === "success";
  const isActive = state !== "idle" && !isError && !isSuccess;

  const ringColor = isError ? "#dc2626" : isSuccess ? "#16a34a" : "#1a56db";
  const ringGlow = isError ? "#dc262644" : isSuccess ? "#16a34a44" : "#1a56db44";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#8b5cf6] mb-2">
            <QrCode className="h-3 w-3" /> Real QR Authentication
          </span>
          <h2 className="text-2xl font-bold tracking-tight">QR Authenticity Flow</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Live blockchain verification connected to real <code className="text-[#8b5cf6]">/api/verify</code>
          </p>
        </div>

        {/* Input Form for Real QR Code */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runVerification(qrInput);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Enter real QR code..."
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            disabled={isActive}
            className="h-9 w-60 rounded-xl border border-border/40 bg-card/60 px-3 text-xs focus:outline-none focus:border-[#8b5cf6]"
          />
          <Button
            type="submit"
            disabled={isActive || !qrInput.trim()}
            size="sm"
            className="h-9 bg-[#8b5cf6] text-white hover:bg-[#7c3aed]"
          >
            Verify
          </Button>
        </form>
      </div>

      {/* Sample buttons pre-filled from real DB */}
      {sampleCodes.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-semibold">Try sample codes:</span>
          {sampleCodes.map((s) => (
            <button
              key={s.code}
              onClick={() => runVerification(s.code)}
              disabled={isActive}
              className="rounded-full border border-border/40 bg-card/40 px-3 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-[#8b5cf6]/40"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visualizer Ring */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card/60 p-8 backdrop-blur-sm">
          <div className="relative flex h-52 w-52 items-center justify-center">
            {/* Outer rings */}
            {[1, 0.7, 0.5].map((scale, i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: `${ringColor}${Math.round((1 - i * 0.25) * 255).toString(16).padStart(2, "0")}` }}
              />
            ))}

            {/* Center icon */}
            <motion.div
              className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl border-2"
              style={{
                borderColor: ringColor,
                background: `linear-gradient(135deg, ${ringColor}22, ${ringColor}11)`,
                boxShadow: `0 0 40px 0 ${ringGlow}`,
              }}
            >
              {state === "idle" && <QrCode className="h-10 w-10 text-muted-foreground" />}
              {isActive && <Loader2 className="h-10 w-10 animate-spin text-[#1a56db]" />}
              {isSuccess && <ShieldCheck className="h-10 w-10 text-[#16a34a]" />}
              {state === "failure" && <XCircle className="h-10 w-10 text-[#dc2626]" />}
              {state === "duplicate" && <ShieldAlert className="h-10 w-10 text-[#dc2626]" />}
            </motion.div>
          </div>

          <p
            className="mt-6 text-center text-[13px] font-semibold"
            style={{ color: isSuccess ? "#16a34a" : isError ? "#dc2626" : isActive ? "#1a56db" : "var(--muted-foreground)" }}
          >
            {STATE_LABELS[state]}
          </p>

          {(isSuccess || isError) && (
            <Button size="sm" variant="outline" onClick={handleReset} className="mt-4 rounded-full text-[12px]">
              <RefreshCw className="mr-1.5 h-3 w-3" /> Reset / Verify Another
            </Button>
          )}
        </div>

        {/* Step Flow List */}
        <div className="space-y-3">
          {FLOW_STEPS.map((step, i) => {
            const isDone = stepIndex > i || isSuccess;
            const isCurrent = stepIndex === i && isActive;
            const StepIcon = step.icon;

            return (
              <div
                key={step.id}
                className="flex items-center gap-4 rounded-xl border p-4 transition-all duration-300"
                style={{
                  borderColor: isDone ? `${step.color}44` : isCurrent ? `${step.color}66` : "rgba(255,255,255,0.06)",
                  background: isDone ? `${step.color}0d` : isCurrent ? `${step.color}14` : "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2"
                  style={{ borderColor: isDone || isCurrent ? step.color : "rgba(255,255,255,0.12)" }}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" style={{ color: step.color }} />
                  ) : isCurrent ? (
                    <Zap className="h-4 w-4 animate-pulse" style={{ color: step.color }} />
                  ) : (
                    <StepIcon className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold" style={{ color: isDone || isCurrent ? step.color : "#777" }}>
                    {step.label}
                  </p>
                  {isCurrent && <p className="text-[11px] text-[#1a56db] animate-pulse">Processing call to /api/verify…</p>}
                  {isDone && <p className="text-[11px] text-muted-foreground">Confirmed</p>}
                </div>
              </div>
            );
          })}

          {/* Result Box */}
          {resultData && (
            <div
              className="rounded-xl border p-4 text-xs font-mono"
              style={{
                borderColor: isSuccess ? "#16a34a55" : "#dc262655",
                background: isSuccess ? "#16a34a11" : "#dc262611",
              }}
            >
              <p className="font-bold text-sm mb-1" style={{ color: isSuccess ? "#16a34a" : "#dc2626" }}>
                Result: {resultData.data?.resultType || resultData.resultType || (isSuccess ? "GENUINE" : "FAILED")}
              </p>
              <p className="text-muted-foreground">{resultData.data?.message || resultData.message}</p>
              {resultData.data?.blockchain?.txHash && (
                <p className="mt-2 text-[10px] break-all opacity-80">
                  TX: {resultData.data.blockchain.txHash}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
