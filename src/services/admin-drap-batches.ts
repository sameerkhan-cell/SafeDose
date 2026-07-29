import { getStoredSession } from "@/services/auth";
import type { AuthResponse } from "@/types/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrapBatchItem {
    id: string;
    batchCode: string;
    barcode: string | null;
    companyName: string | null;
    registeredAt: string;
    medicineName: string;
    medicineId: string;
    expiryDate: string | null;
    manufactureDate: string | null;
    sourceDocumentUrl: string | null;
}

export interface DrapBatchListData {
    items: DrapBatchItem[];
    total: number;
}

export interface BulkUploadResult {
    created: number;
    skipped: number;
    errors: string[];
}

export interface ManualEntryPayload {
    // medicine fields
    medicineName: string;
    genericName?: string;
    manufacturer_name?: string;
    drapRegNumber?: string;
    approvalStatus?: string;
    activeIngredients?: string;
    // batch fields
    batchCode: string;
    barcode?: string;
    companyName?: string;
    expiryDate?: string;       // ISO date string "YYYY-MM-DD"
    manufactureDate?: string;  // ISO date string "YYYY-MM-DD"
    sourceDocumentUrl?: string;
}

export interface DocumentUploadResult {
    documentUrl: string;
    driveUrl: string | null;
}

// ─── Auth fetch helper ────────────────────────────────────────────────────────

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<AuthResponse<T>> {
    const session = getStoredSession();
    if (!session?.token) {
        return { success: false, error: { message: "Your session has expired. Please log in again." } };
    }

    try {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${session.token}`,
            ...(options.headers as any ?? {}),
        };

        const response = await fetch(path, { ...options, headers });
        const result = await response.json();
        if (!response.ok || !result.success) {
            return { success: false, error: { message: result.message || result.error || "Request failed." } };
        }
        return result;
    } catch {
        return { success: false, error: { message: "Cannot reach the server. Please try again." } };
    }
}

function getToken(): string | null {
    return getStoredSession()?.token ?? null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const adminDrapBatchesService = {
    listBatches: (params: { search?: string; page?: number; pageSize?: number } = {}) => {
        const qs = new URLSearchParams();
        if (params.search) qs.set("search", params.search);
        if (params.page) qs.set("page", String(params.page));
        if (params.pageSize) qs.set("pageSize", String(params.pageSize));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return authFetch<DrapBatchListData>(`/api/admin/drap-batches${query}`);
    },

    // Upload CSV or Excel file (.csv / .xlsx / .xls)
    uploadFile: (file: File): Promise<AuthResponse<BulkUploadResult>> => {
        const token = getToken();
        if (!token) {
            return Promise.resolve<AuthResponse<BulkUploadResult>>({
                success: false,
                error: { message: "Your session has expired. Please log in again." },
            });
        }
        const formData = new FormData();
        formData.append("file", file);
        return fetch("/api/admin/drap-batches", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        })
            .then(async (res) => {
                const result = await res.json();
                if (!res.ok || !result.success) {
                    return { success: false as const, error: { message: result.message || result.error || "Upload failed." } };
                }
                return result as AuthResponse<BulkUploadResult>;
            })
            .catch(() => ({
                success: false as const,
                error: { message: "Cannot reach the server. Please try again." },
            }));
    },

    // Backward-compat alias for existing callers
    uploadCsv: (file: File) => adminDrapBatchesService.uploadFile(file),

    // Manual single-entry submission
    manualCreate: (payload: ManualEntryPayload): Promise<AuthResponse<{ batchId: string }>> => {
        return authFetch<{ batchId: string }>("/api/admin/drap-batches/manual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    },

    // Upload a supporting document (PDF/XML/eCTD) — returns downloadable URL
    uploadDocument: (file: File): Promise<AuthResponse<DocumentUploadResult>> => {
        const token = getToken();
        if (!token) {
            return Promise.resolve<AuthResponse<DocumentUploadResult>>({
                success: false,
                error: { message: "Your session has expired. Please log in again." },
            });
        }
        const formData = new FormData();
        formData.append("file", file);
        return fetch("/api/admin/drap-batches/document", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        })
            .then(async (res) => {
                const result = await res.json();
                if (!res.ok || !result.success) {
                    return { success: false as const, error: { message: result.message || result.error || "Upload failed." } };
                }
                return result as AuthResponse<DocumentUploadResult>;
            })
            .catch(() => ({
                success: false as const,
                error: { message: "Cannot reach the server. Please try again." },
            }));
    },

    // Inspect XML file structure
    inspectXml: (file: File): Promise<AuthResponse<{ candidates: Array<{ nodePath: string; count: number; sampleTags: Array<{ tag: string; sample: string }> }> }>> => {
        const token = getToken();
        if (!token) return Promise.resolve({ success: false, error: { message: "Session expired." } });
        const formData = new FormData();
        formData.append("file", file);
        return fetch("/api/admin/drap-batches/xml/inspect", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        }).then(async (res) => res.json());
    },

    // Import XML records with tag mapping
    importXml: (file: File, nodePath: string, mapping: Record<string, string>): Promise<AuthResponse<BulkUploadResult>> => {
        const token = getToken();
        if (!token) return Promise.resolve({ success: false, error: { message: "Session expired." } });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("nodePath", nodePath);
        formData.append("mapping", JSON.stringify(mapping));
        return fetch("/api/admin/drap-batches/xml/import", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        }).then(async (res) => res.json());
    },

    // Extract table from PDF
    extractPdf: (file: File): Promise<AuthResponse<{ success: boolean; headers?: string[]; rows?: any[]; error?: string }>> => {
        const token = getToken();
        if (!token) return Promise.resolve({ success: false, error: { message: "Session expired." } });
        const formData = new FormData();
        formData.append("file", file);
        return fetch("/api/admin/drap-batches/pdf/extract", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        }).then(async (res) => res.json());
    },

    // Import reviewed PDF rows
    importPdfRows: (rows: any[]): Promise<AuthResponse<BulkUploadResult>> => {
        return authFetch<BulkUploadResult>("/api/admin/drap-batches/pdf/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows }),
        });
    },
};
