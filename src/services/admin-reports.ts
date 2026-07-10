import { getStoredSession } from "@/services/auth";
import type { AuthResponse } from "@/types/auth";

export interface AdminReportItem {
    id: string;
    medicineName: string;
    batchNumber: string | null;
    pharmacyName: string | null;
    description: string;
    status: string;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        role: string;
    };
}

async function authFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<AuthResponse<T>> {
    const session = getStoredSession();
    if (!session?.token) {
        return { success: false, error: { message: "Your session has expired. Please log in again." } };
    }

    try {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${session.token}`,
            "Content-Type": "application/json",
            ...(options.headers as any ?? {}),
        };

        const response = await fetch(path, {
            ...options,
            headers,
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            return { success: false, error: { message: result.message || "Request failed." } };
        }
        return result;
    } catch {
        return { success: false, error: { message: "Cannot reach the server. Please try again." } };
    }
}

export const adminReportsService = {
    getReports: (filters: { role?: string; status?: string } = {}) => {
        const params = new URLSearchParams();
        if (filters.role) params.set("role", filters.role);
        if (filters.status) params.set("status", filters.status);
        const qs = params.toString() ? `?${params.toString()}` : "";
        return authFetch<AdminReportItem[]>(`/api/admin/reports${qs}`);
    },

    updateStatus: (id: string, status: string) => {
        return authFetch<AdminReportItem>(`/api/admin/reports/${id}/status`, {
            method: "POST",
            body: JSON.stringify({ status }),
        });
    },
};
