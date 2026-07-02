import { z } from "zod";
import { ApiError } from "../utils/api-response";

export const DOCUMENT_TYPES = [
    "DRAP_LICENSE",
    "WHO_GMP",
    "ISO_CERTIFICATE",
    "BUSINESS_REGISTRATION",
    "TAX_REGISTRATION",
    "MANUFACTURING_PERMIT",
    "PRODUCT_QUALITY",
    "ADDITIONAL",
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number];

export const REQUIRED_COMPLIANCE_TYPES: DocumentTypeValue[] = [
    "DRAP_LICENSE",
    "WHO_GMP",
    "ISO_CERTIFICATE",
    "BUSINESS_REGISTRATION",
];

const documentTypeSchema = z.enum(DOCUMENT_TYPES, {
    errorMap: () => ({ message: "Invalid document type." }),
});

export const uploadDocumentSchema = z.object({
    documentType: documentTypeSchema,
    documentName: z.string().trim().min(2, "Document name is required."),
    documentUrl: z.string().trim().url("Enter a valid document URL.").optional(),
    fileSize: z.number().int().positive().optional(),
    mimeType: z.string().trim().max(128).optional(),
    expiryDate: z
        .string()
        .trim()
        .optional()
        .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
            message: "Enter a valid expiry date.",
        }),
});

export const adminReviewSchema = z.object({
    remarks: z.string().trim().max(2000).optional(),
});

export function validateUploadDocument(body: unknown) {
    const result = uploadDocumentSchema.safeParse(body);
    if (!result.success) {
        throw new ApiError(400, result.error.errors[0]?.message || "Invalid document data.");
    }
    return result.data;
}

export function validateAdminReview(body: unknown) {
    const result = adminReviewSchema.safeParse(body ?? {});
    if (!result.success) {
        throw new ApiError(400, result.error.errors[0]?.message || "Invalid review data.");
    }
    return result.data;
}
