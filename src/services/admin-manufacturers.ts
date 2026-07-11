import { getStoredSession } from "@/services/auth";
import type { AuthResponse } from "@/types/auth";

export interface AdminManufacturerItem {
    id: string;
    companyName: string;
    licenseNumber: string;
    address: string | null;
    businessPhone: string | null;
    businessEmail: string | null;
    taxId: string | null;
    registrationNumber: string | null;
    industryType: string | null;
    isVerified: boolean;
    verificationStatus: string;
    registrationDate: string | null;
    website: string | null;
    isSuspended: boolean;
    suspendedAt: string | null;
    medicineCount: number;
    batchCount: number;
}

export interface AdminBatchReportItem {
    id: string;
    batchNumber: string;
    status: string;
    medicineStatus: string;
    manufacturingDate: string;
    expiryDate: string;
    quantityBoxes: number;
    totalPillsGenerated: number;
    blockchainStatus: string;
    createdAt: string;
    totalPillsCount: number;
    verifiedPillsCount: number;
}

export interface AdminMedicineReportItem {
    id: string;
    name: string;
    genericName: string | null;
    category: string | null;
    dosage: string | null;
    drapRegNumber: string | null;
    approvalStatus: string;
    createdAt: string;
    batches: AdminBatchReportItem[];
}

export interface AdminManufacturerReport {
    id: string;
    companyName: string;
    licenseNumber: string;
    address: string | null;
    businessPhone: string | null;
    businessEmail: string | null;
    taxId: string | null;
    registrationNumber: string | null;
    industryType: string | null;
    isVerified: boolean;
    verificationStatus: string;
    registrationDate: string | null;
    website: string | null;
    medicines: AdminMedicineReportItem[];
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

export const adminManufacturersService = {
    getManufacturers: (options: { includeSuspended?: boolean } = {}) => {
        const params = options.includeSuspended ? "?includeSuspended=true" : "";
        return authFetch<AdminManufacturerItem[]>(`/api/admin/manufacturers${params}`);
    },
    getManufacturerReport: (id: string) => {
        return authFetch<AdminManufacturerReport>(`/api/admin/manufacturers/${id}/report`);
    },
    suspendManufacturer: (id: string) => {
        return authFetch<AdminManufacturerItem>(`/api/admin/manufacturers/${id}/suspend`, {
            method: "POST",
        });
    },
    restoreManufacturer: (id: string) => {
        return authFetch<AdminManufacturerItem>(`/api/admin/manufacturers/${id}/restore`, {
            method: "POST",
        });
    },
    unverifyManufacturer: (id: string) => {
        return authFetch<AdminManufacturerItem>(`/api/admin/manufacturers/${id}/unverify`, {
            method: "POST",
        });
    },
    createManufacturer: (data: { companyName: string; email: string; password: string }) => {
        return authFetch<{ companyCode: string; email: string }>("/api/admin/manufacturers/create", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },
};

