import { useState, useCallback, useRef } from "react";
import type { BatchRegistrationForm, DualQRResult, GenerationProgress, GenerationPhase } from "@/types/dual-qr";
// Bypassed client-side mock QR generation in favor of real database data

interface UseBatchGenerationReturn {
    progress: GenerationProgress;
    result: DualQRResult | null;
    error: string | null;
    isGenerating: boolean;
    generate: (form: BatchRegistrationForm) => Promise<boolean>;
    reset: () => void;
}

const PHASE_MESSAGES: Record<GenerationPhase, string> = {
    idle: "Ready to generate",
    registering: "Registering batch on blockchain…",
    "generating-box-qr": "Generating Box QR code…",
    "generating-pill-qrs": "Generating individual pill QR codes…",
    complete: "Generation complete!",
    error: "Generation failed",
};

const INITIAL_PROGRESS: GenerationProgress = {
    phase: "idle",
    pillsGenerated: 0,
    totalPills: 0,
    percentage: 0,
    currentMessage: PHASE_MESSAGES["idle"],
};

export function useBatchGeneration(): UseBatchGenerationReturn {
    const [progress, setProgress] = useState<GenerationProgress>(INITIAL_PROGRESS);
    const [result, setResult] = useState<DualQRResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef(false);

    const setPhase = (phase: GenerationPhase, pills = 0, total = 0) => {
        const percentage =
            phase === "registering" ? 8
                : phase === "generating-box-qr" ? 20
                    : phase === "generating-pill-qrs" && total > 0
                        ? Math.round(20 + (pills / total) * 75)
                        : phase === "complete" ? 100
                            : 0;

        setProgress({
            phase,
            pillsGenerated: pills,
            totalPills: total,
            percentage,
            currentMessage:
                phase === "generating-pill-qrs" && total > 0
                    ? `Generating pill QRs… ${pills.toLocaleString()} / ${total.toLocaleString()}`
                    : PHASE_MESSAGES[phase],
        });
    };

    const generate = useCallback(async (form: BatchRegistrationForm) => {
        const { batches, registerNewBatch } = (await import("@/store/qr-store")).useQRStore.getState();

        // 0. Check for duplicates (ONLY if not extending)
        if (!form.isExtension && form.batchNumber && batches.some(b => b.batchNumber === form.batchNumber)) {
            setError("This batch code is already registered");
            return false;
        }

        abortRef.current = false;
        setError(null);
        setResult(null);

        try {
            // Phase 1 — Server-side registration (Prisma + MySQL)
            setPhase("registering");
            const token = (() => {
                try {
                    const session = localStorage.getItem("mediverify_session") || sessionStorage.getItem("mediverify_session");
                    return session ? JSON.parse(session).token : "";
                } catch { return ""; }
            })();
            console.log(`[DEBUG] Attempting batch registration with token: ${token ? "YES" : "NO"}`);

            const response = await fetch("/api/manufacturer/register-batch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    medicineName: form.medicineName,
                    batchNumber: form.batchNumber,
                    // Normalize date: type="month" gives "YYYY-MM" (no day), which Node.js
                    // may parse as Invalid Date. Append "-01" only when needed.
                    manufacturingDate: (() => {
                        const d = form.manufacturingDate || "";
                        const normalized = d.length === 7 ? `${d}-01` : d;
                        return new Date(normalized).toISOString();
                    })(),
                    expiryDate: (() => {
                        const d = form.expiryDate || "";
                        const normalized = d.length === 7 ? `${d}-01` : d;
                        return new Date(normalized).toISOString();
                    })(),
                    quantityBoxes: Number(form.quantityBoxes),
                    pillsPerBox: Number(form.totalPillsPerBox),
                    totalCartons: Number(form.totalCartons),
                    category: form.productCategory,
                    allowsExtension: Boolean(form.isExtension),
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to register batch on server.");
            }

            const { batch: serverBatch, pills: serverPills } = data.data;

            // Phase 2 — local box QR generation
            setPhase("generating-box-qr");
            await new Promise((r) => setTimeout(r, 400));
            if (abortRef.current) return false;

            // Phase 3 — pill QR generation (chunked progress animation using real data)
            const quantityToGenerate = form.quantityBoxes * form.totalPillsPerBox;
            setPhase("generating-pill-qrs", 0, quantityToGenerate);

            const chunkDelay = quantityToGenerate > 500 ? 5 : 15;
            const CHUNK_SIZE = Math.max(1, Math.ceil(quantityToGenerate / 40));

            for (let i = 0; i < quantityToGenerate; i += CHUNK_SIZE) {
                const currentProgress = Math.min(i + CHUNK_SIZE, quantityToGenerate);
                if (abortRef.current) return false;
                setPhase("generating-pill-qrs", currentProgress, quantityToGenerate);
                if (chunkDelay > 0 && currentProgress < quantityToGenerate) {
                    await new Promise((r) => setTimeout(r, chunkDelay));
                }
            }

            if (abortRef.current) return false;

            // Merge server data with compliant MedicineBatch layout
            const finalResult: DualQRResult = {
                batch: {
                    id: serverBatch.id,
                    medicineName: form.medicineName,
                    batchNumber: serverBatch.batchNumber,
                    manufacturingDate: serverBatch.manufacturingDate,
                    expiryDate: serverBatch.expiryDate,
                    quantityBoxes: serverBatch.quantityBoxes,
                    totalPillsPerBox: serverBatch.pillsPerBox,
                    totalPills: serverBatch.totalPillsGenerated,
                    manufacturerCode: serverBatch.medicine?.manufacturer?.companyCode || form.manufacturerCode,
                    drapLicense: serverBatch.medicine?.manufacturer?.licenseNumber || form.drapLicense,
                    productCategory: serverBatch.category || form.productCategory,
                    boxQrCode: serverBatch.boxQRCode,
                    boxQrScanned: false,
                    qrGenerationStatus: "completed",
                    createdAt: serverBatch.createdAt,
                    txHash: serverBatch.txHash || "PENDING_ANCHOR",
                    status: "Active",
                    boxesPerCarton: serverBatch.boxesPerCarton,
                    totalCartons: form.totalCartons,
                    cartons: serverBatch.cartons,
                    boxes: serverBatch.boxes
                },
                pills: serverPills || [],
                totalPillsGenerated: serverBatch.totalPillsGenerated || (serverPills ? serverPills.length : 0)
            };

            // Phase 4 — complete
            setPhase("complete", quantityToGenerate, quantityToGenerate);
            setResult(finalResult);

            // Persist to store
            try {
                registerNewBatch(finalResult);
            } catch (e) {
                console.error("Failed to persist batch:", e);
            }

            return true;
        } catch (err) {
            setPhase("error");
            setError(err instanceof Error ? err.message : "Unknown error occurred");
            return false;
        }
    }, []);

    const reset = useCallback(() => {
        abortRef.current = true;
        setProgress(INITIAL_PROGRESS);
        setResult(null);
        setError(null);
    }, []);

    return {
        progress,
        result,
        error,
        isGenerating: progress.phase !== "idle" && progress.phase !== "complete" && progress.phase !== "error",
        generate,
        reset,
    };
}
