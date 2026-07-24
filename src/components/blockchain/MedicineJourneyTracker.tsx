import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Factory, Store, ShoppingBag, ShieldCheck, CheckCircle2, Clock, MapPin, Hash, Search, Loader2, Info, AlertTriangle, RefreshCw, ExternalLink, ChevronDown,
} from "lucide-react";
import { ease } from "@/lib/motion";

interface RealStage {
  id: string;
  name: string;
  status: "COMPLETED" | "ACTIVE" | "PENDING";
  actor: string;
  location: string;
  timestamp: string;
  txHash: string;
  detail: string;
}

interface BatchOption {
  batchNumber: string;
  medicineName: string;
  blockchainStatus: string;
}

interface JourneyData {
  batchNumber: string | null;
  medicineName?: string;
  manufacturerName?: string;
  blockchainStatus?: string;
  stages: RealStage[];
  availableBatches?: BatchOption[];
  notTracked?: string[];
  note?: string;
}

const STAGE_ICONS: Record<string, typeof Factory> = {
  "Manufactured": Factory,
  "Received at Pharmacy": Store,
  "Verified by Customer": ShoppingBag,
};

export function MedicineJourneyTracker() {
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [batchInput, setBatchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJourney = async (batchId?: string) => {
    try {
      setLoading(true);
      const url = batchId ? `/api/blockchain/journey?batchId=${encodeURIComponent(batchId)}` : "/api/blockchain/journey";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        setJourney(json.data);
        if (json.data.batchNumber) {
          setBatchInput(json.data.batchNumber);
        }
        setError(null);
      } else {
        setError(json.error || "Batch journey not found");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load journey data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJourney();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchInput.trim()) {
      fetchJourney(batchInput.trim());
    }
  };

  const handleSelectBatch = (selectedBatchNumber: string) => {
    setBatchInput(selectedBatchNumber);
    fetchJourney(selectedBatchNumber);
  };

  const stages = journey?.stages || [];
  const availableBatches = journey?.availableBatches || [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#16a34a]/10 border border-[#16a34a]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#16a34a] mb-2">
            <ShieldCheck className="h-3 w-3" /> Supply Chain Journey
          </span>
          <h2 className="text-2xl font-bold tracking-tight">Medicine Provenance Tracker</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {journey?.medicineName ? (
              <span>
                <strong>{journey.medicineName}</strong> · Batch <code className="text-[#16a34a] font-mono">{journey.batchNumber}</code>
                {journey.blockchainStatus && (
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      journey.blockchainStatus === "CONFIRMED"
                        ? "bg-[#16a34a]/20 text-[#16a34a] border border-[#16a34a]/40"
                        : "bg-amber-500/20 text-amber-500 border border-amber-500/40"
                    }`}
                  >
                    {journey.blockchainStatus}
                  </span>
                )}
              </span>
            ) : (
              "Real-time lifecycle telemetry"
            )}
          </p>
        </div>

        {/* Batch Selector & Search Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dropdown Selector */}
          {availableBatches.length > 0 && (
            <div className="relative">
              <select
                value={journey?.batchNumber || ""}
                onChange={(e) => handleSelectBatch(e.target.value)}
                className="h-9 appearance-none rounded-xl border border border-[#16a34a]/40 bg-card/80 pl-3 pr-8 text-xs font-semibold text-foreground focus:outline-none focus:border-[#16a34a] cursor-pointer"
              >
                {availableBatches.map((b) => (
                  <option key={b.batchNumber} value={b.batchNumber}>
                    {b.batchNumber} ({b.medicineName} - {b.blockchainStatus})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 pointer-events-none text-muted-foreground" />
            </div>
          )}

          {/* Direct Search Input */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter Batch ID..."
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                className="h-9 w-44 sm:w-52 rounded-xl border border-border/40 bg-card/60 pl-8 pr-3 text-xs focus:outline-none focus:border-[#16a34a]"
              />
            </div>
            <button
              type="submit"
              className="h-9 rounded-xl border border-[#16a34a]/40 bg-[#16a34a]/10 px-3 text-xs font-semibold text-[#16a34a] hover:bg-[#16a34a]/20"
            >
              Track
            </button>
          </form>
        </div>
      </div>

      {loading && !journey ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-border/40 bg-card/60">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#16a34a]" />
            <p className="text-[13px] font-medium text-muted-foreground">Loading supply chain provenance…</p>
          </div>
        </div>
      ) : error && !journey ? (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <div>
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
            <p className="text-sm font-bold text-red-500">{error}</p>
            <button
              onClick={() => fetchJourney()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reset to Latest Batch
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Note Banner about omitted intermediate stages */}
          {journey?.note && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-500 text-xs">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Database Schema Scope Note</p>
                <p className="mt-0.5 text-foreground/80 leading-relaxed">{journey.note}</p>
                {journey.notTracked && (
                  <p className="mt-1 font-mono text-[11px] opacity-80">
                    Omitted untracked stages: {journey.notTracked.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          )}

          {stages.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card/60 p-12 text-center text-muted-foreground">
              <Factory className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-bold">No tracking milestones for this batch yet</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[23px] top-0 bottom-0 w-px bg-[#16a34a]/30 hidden sm:block" />

              <div className="space-y-4">
                {stages.map((stage, i) => {
                  const StageIcon = STAGE_ICONS[stage.name] || ShieldCheck;
                  const isPendingTx = !stage.txHash || !stage.txHash.startsWith("0x");

                  return (
                    <motion.div
                      key={stage.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.4, ease }}
                      className="relative sm:pl-14"
                    >
                      {/* Node dot */}
                      <div className="absolute left-0 top-4 hidden sm:flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-[#16a34a] bg-[#16a34a]/15 z-10">
                        <StageIcon className="h-5 w-5 text-[#16a34a]" />
                      </div>

                      {/* Card */}
                      <div className="rounded-2xl border border-[#16a34a]/30 bg-[#16a34a]/05 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold">{stage.name}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isPendingTx
                                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/40"
                                  : "bg-[#16a34a]/20 text-[#16a34a] border border-[#16a34a]/40"
                              }`}
                            >
                              {isPendingTx ? "PENDING ANCHORING" : "VERIFIED"}
                            </span>
                          </div>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" /> {stage.timestamp}
                          </span>
                        </div>

                        <p className="text-xs text-foreground/80 mb-3">{stage.detail}</p>

                        <div className="grid gap-2 sm:grid-cols-2 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
                            <span className="truncate">{stage.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-muted-foreground min-w-0">
                            <Hash className="h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
                            {stage.txHash && stage.txHash.startsWith("0x") && stage.txHash.length > 20 ? (
                              <a
                                href={`https://amoy.polygonscan.com/tx/${stage.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#06b6d4] hover:underline truncate"
                                title={stage.txHash}
                              >
                                <span className="truncate">{stage.txHash}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="truncate text-amber-500 font-sans italic">{stage.txHash || "Pending Anchoring"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
