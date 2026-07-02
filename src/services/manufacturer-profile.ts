import { getStoredSession } from "@/services/auth";
import type { AuthResponse } from "@/types/auth";

import type { ComplianceSummary } from "@/services/manufacturer-documents";

export type ManufacturerProfile = {
    companyName: string;
    companyLogo: string;
    businessLocation: string;
    address: string;
    contactNumber: string;
    officialEmail: string;
    drapLicense: string;
    industryType: string;
    productCategories: string;
    websiteUrl: string;
    manufacturingCapacity: string;
    certifications: string;
    operatingCountries: string;
    taxId: string;
    registrationNumber: string;
    registrationDate: string;
    companyDescription: string;
    compliance?: ComplianceSummary;
};

async function profileRequest<T>(
    method: "GET" | "PUT",
    body?: ManufacturerProfile
): Promise<AuthResponse<T>> {
    const session = getStoredSession();
    if (!session?.token) {
        return { success: false, error: { message: "Your session has expired. Please log in again." } };
    }

    try {
        const response = await fetch("/api/manufacturer/profile", {
            method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.token}`,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            return {
                success: false,
                error: { message: result.message || "Request failed." },
            };
        }
        return result;
    } catch {
        return {
            success: false,
            error: { message: "Cannot reach the server. Please try again." },
        };
    }
}

export const manufacturerProfileService = {
    getProfile: () => profileRequest<ManufacturerProfile>("GET"),
    updateProfile: (data: ManufacturerProfile) =>
        profileRequest<ManufacturerProfile>("PUT", data),
    uploadLogo: async (file: File): Promise<AuthResponse<{ logoUrl: string }>> => {
        const session = getStoredSession();
        if (!session?.token) {
            return { success: false, error: { message: "Session expired." } };
        }

        const formData = new FormData();
        formData.append("logo", file);

        try {
            const response = await fetch("/api/manufacturer/profile/logo-upload", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.token}`,
                },
                body: formData,
            });

            const result = await response.json();
            return result;
        } catch {
            return { success: false, error: { message: "Upload failed." } };
        }
    },
    deleteLogo: async (): Promise<AuthResponse<null>> => {
        const session = getStoredSession();
        if (!session?.token) {
            return { success: false, error: { message: "Session expired." } };
        }

        try {
            const response = await fetch("/api/manufacturer/profile/logo", {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${session.token}`,
                },
            });

            const result = await response.json();
            return result;
        } catch {
            return { success: false, error: { message: "Deletion failed." } };
        }
    }
};
