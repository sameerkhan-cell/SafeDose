import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MedicineBatch, PillRecord, DualQRResult } from "@/types/dual-qr";

interface QRState {
    batches: MedicineBatch[];
    pills: PillRecord[];
    activeGeneration: DualQRResult | null;

    // Actions
    setBatches: (batches: MedicineBatch[]) => void;
    registerNewBatch: (result: DualQRResult) => void;
    setActiveGeneration: (result: DualQRResult | null) => void;
    updatePillStatus: (pillId: string, status: PillRecord["qrStatus"]) => void;
    clearStore: () => void;


    // Stats selectors
    stats: {
        totalGenerated: () => number;
        totalScanned: () => number;
        suspiciousCount: () => number;
    };
}

/**
 * QR Store — SafeDose State Management
 * Persistent store for managing batches, individual pills, and generation sessions.
 */
export const useQRStore = create<QRState>()(
    persist(
        (set, get) => ({
            batches: [],
            pills: [],
            activeGeneration: null,

            setBatches: (batches) => set({ batches }),

            registerNewBatch: (result) => set((state) => ({
                batches: [result.batch, ...state.batches],
                pills: [...result.pills, ...state.pills],
                activeGeneration: result
            })),

            setActiveGeneration: (activeGeneration) => set({ activeGeneration }),

            updatePillStatus: (pillId, status) => set((state) => ({
                pills: state.pills.map(p => p.id === pillId ? { ...p, qrStatus: status } : p)
            })),

            clearStore: () => set({ batches: [], pills: [], activeGeneration: null }),

            stats: {
                totalGenerated: () => get().pills.length,
                totalScanned: () => get().pills.filter(p => p.qrScanned).length,
                suspiciousCount: () => get().pills.filter(p => p.qrStatus === "suspected").length,
            }
        }),
        {
            name: "mediverify-qr-storage",
            partialize: (state) => ({ batches: state.batches, pills: state.pills }),
        }
    )
);
