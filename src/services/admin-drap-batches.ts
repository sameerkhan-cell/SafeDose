import { getStoredSession } from "@/services/auth";
import type { AuthResponse } from "@/types/auth";

export interface DrapBatchItem {
    id: string;
    batchCode: string;
    companyName: string | null;
    registeredAt: string;
    medicineName: string;
    medicineId: string;
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
            return { success: false, error: { message: result.message || "Request failed." } };
        }
        return result;
    } catch {
        return { success: false, error: { message: "Cannot reach the server. Please try again." } };
    }
}

export const adminDrapBatchesService = {
    listBatches: (params: { search?: string; page?: number; pageSize?: number } = {}) => {
        const qs = new URLSearchParams();
        if (params.search) qs.set("search", params.search);
        if (params.page) qs.set("page", String(params.page));
        if (params.pageSize) qs.set("pageSize", String(params.pageSize));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return authFetch<DrapBatchListData>(`/api/admin/drap-batches${query}`);
    },

    uploadCsv: (file: File) => {
        const session = getStoredSession();
        if (!session?.token) {
            return Promise.resolve<AuthResponse<BulkUploadResult>>({
                success: false,
                error: { message: "Your session has expired. Please log in again." },
            });
        }
        const formData = new FormData();
        formData.append("file", file);
        return fetch("/api/admin/drap-batches", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.token}` },
            body: formData,
        })
            .then(async (res) => {
                const result = await res.json();
                if (!res.ok || !result.success) {
                    return { success: false as const, error: { message: result.message || "Upload failed." } };
                }
                return result as AuthResponse<BulkUploadResult>;
            })
            .catch(() => ({
                success: false as const,
                error: { message: "Cannot reach the server. Please try again." },
            }));
    },
};
