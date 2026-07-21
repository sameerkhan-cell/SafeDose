import { getStoredSession } from "@/services/auth";
import type { AuthResponse } from "@/types/auth";
import type { PharmacyProfile } from "./pharmacy";

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

export const adminPharmaciesService = {
    getPharmacies: () => {
        return authFetch<PharmacyProfile[]>("/api/admin/pharmacies");
    },
    approvePharmacy: (id: string) => {
        return authFetch<PharmacyProfile>(`/api/admin/pharmacies/${id}/approve`, {
            method: "PUT",
        });
    },
    rejectPharmacy: (id: string, remarks: string) => {
        return authFetch<PharmacyProfile>(`/api/admin/pharmacies/${id}/reject`, {
            method: "PUT",
            body: JSON.stringify({ remarks }),
        });
    },
    unverifyPharmacy: (id: string) => {
        return authFetch<PharmacyProfile>(`/api/admin/pharmacies/${id}/unverify`, {
            method: "POST",
        });
    },
};
