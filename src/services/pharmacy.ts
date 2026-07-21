import { getStoredSession } from "@/services/auth";
import type { AuthResponse } from "@/types/auth";

export interface PharmacyProfile {
    id: string;
    userId: string;
    name: string;
    licenseNumber: string;
    location: string;
    address: string;
    businessPhone: string;
    businessEmail: string;
    isVerified: boolean;
    verificationStatus: string;
    licenseDocumentUrl: string | null;
    verifiedAt: string | null;
    remarks: string | null;
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

export const pharmacyService = {
    getProfile: () => {
        return authFetch<PharmacyProfile>("/api/pharmacy/profile");
    },
    updateProfile: (data: Partial<PharmacyProfile>) => {
        return authFetch<PharmacyProfile>("/api/pharmacy/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    },
    uploadLicense: (formData: FormData) => {
        return authFetch<PharmacyProfile>("/api/pharmacy/license-upload", {
            method: "POST",
            body: formData, // fetch will automatically set boundary for multipart
        });
    },
};
