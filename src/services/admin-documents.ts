import { getStoredSession } from "@/services/auth";
import type { AuthResponse } from "@/types/auth";
import type { ManufacturerDocumentItem } from "./manufacturer-documents";

export interface AdminDocumentItem extends ManufacturerDocumentItem {
    manufacturer: {
        companyName: string;
        licenseNumber: string;
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

export const adminDocumentsService = {
    list: (status?: string) => {
        const query = status ? `?status=${status}` : "";
        return authFetch<AdminDocumentItem[]>(`/api/admin/documents${query}`);
    },

    approve: (id: string, remarks?: string) => {
        return authFetch<AdminDocumentItem>(`/api/admin/documents/${id}/approve`, {
            method: "PUT",
            body: JSON.stringify({ remarks }),
        });
    },

    reject: (id: string, remarks: string) => {
        return authFetch<AdminDocumentItem>(`/api/admin/documents/${id}/reject`, {
            method: "PUT",
            body: JSON.stringify({ remarks }),
        });
    },
};
