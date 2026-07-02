import { getStoredSession } from "@/services/auth";
import type { AuthResponse } from "@/types/auth";

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    DRAP_LICENSE: "DRAP License",
    WHO_GMP: "WHO GMP Certificate",
    ISO_CERTIFICATE: "ISO Certificate",
    BUSINESS_REGISTRATION: "Business Registration Certificate",
    TAX_REGISTRATION: "Tax Registration Certificate",
    MANUFACTURING_PERMIT: "Manufacturing Permit",
    PRODUCT_QUALITY: "Product Quality Certificate",
    ADDITIONAL: "Additional Supporting Document",
};

export type ManufacturerDocumentItem = {
    id: string;
    manufacturerId: string;
    documentType: string;
    documentName: string;
    documentUrl: string;
    fileSize: number | null;
    mimeType: string | null;
    status: string;
    effectiveStatus?: string;
    isExpired?: boolean;
    uploadedAt: string;
    verifiedAt: string | null;
    verifiedBy: string | null;
    expiryDate: string | null;
    remarks: string | null;
    daysRemaining: number | null;
};

export type ComplianceProgress = {
    requiredDocuments: number;
    uploadedRequiredDocuments: number;
    approvedRequiredDocuments: number;
    complianceScore: number;
};

export type ComplianceSummary = {
    complianceScore: number;
    totalDocuments: number;
    approvedDocuments: number;
    pendingDocuments: number;
    expiredDocuments: number;
    underReviewDocuments: number;
    rejectedDocuments: number;
    requiredDocumentsTotal: number;
    requiredDocumentsUploaded: number;
    requiredDocumentsApproved: number;
    nextExpiryDate: string | null;
    daysUntilNextExpiry: number | null;
    statusBreakdown: Record<string, number>;
    upcomingExpirations: Array<{
        documentId: string;
        documentName: string;
        documentType: string;
        expiryDate: string;
        daysRemaining: number;
        status: string;
    }>;
    progress: ComplianceProgress;
};

async function authFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<AuthResponse<T>> {
    const session = getStoredSession();
    if (!session?.token) {
        return { success: false, error: { message: "Your session has expired. Please log in again." } };
    }

    try {
        const isFormData = options.body instanceof FormData;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${session.token}`,
            ...(options.headers as any ?? {}),
        };

        if (!isFormData) {
            headers["Content-Type"] = "application/json";
        }

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

export const manufacturerDocumentsService = {
    list: () =>
        authFetch<{ documents: ManufacturerDocumentItem[]; compliance: ComplianceSummary }>(
            "/api/manufacturer/documents"
        ),

    get: (id: string, page = 1, limit = 50) =>
        authFetch<
            ManufacturerDocumentItem & {
                auditHistory: unknown[];
                totalRecords: number;
                totalPages: number;
                page: number;
                limit: number;
            }
        >(`/api/manufacturer/documents/${id}?page=${page}&limit=${limit}`),

    upload: (body: FormData | {
        documentType: string;
        documentName: string;
        documentUrl?: string;
        fileSize?: number;
        mimeType?: string;
        expiryDate?: string;
    }) =>
        authFetch<ManufacturerDocumentItem>("/api/manufacturer/documents/upload", {
            method: "POST",
            body: body instanceof FormData ? body : JSON.stringify(body),
        }),

    remove: (id: string) =>
        authFetch<{ success: boolean; message: string }>(`/api/manufacturer/documents/${id}`, {
            method: "DELETE",
        }),

    complianceMetrics: () =>
        authFetch<ComplianceSummary>("/api/manufacturer/compliance"),
};
