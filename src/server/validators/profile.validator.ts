import { z } from "zod";
import { ApiError } from "../utils/api-response";

/** Accepts DRAP-MFG-2024-001847 and existing LIC-MFG-* license formats */
const DRAP_LICENSE_REGEX = /^([A-Z]{2,5}-){1,3}[A-Z0-9-]{3,24}$/i;
const PHONE_REGEX = /^\+?[\d\s().-]{8,24}$/;

const optionalUrl = z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v === "" || z.string().url().safeParse(v).success, {
        message: "Enter a valid website URL.",
    });

export const manufacturerProfileUpdateSchema = z.object({
    companyName: z.string().trim().min(2, "Company name is required."),
    companyLogo: z.string().trim().optional(),
    businessLocation: z.string().trim().optional(),
    address: z.string().trim().min(5, "Address is required."),
    contactNumber: z
        .string()
        .trim()
        .min(8, "Contact number is required.")
        .regex(PHONE_REGEX, "Enter a valid contact number."),
    officialEmail: z.string().trim().email("Enter a valid official email."),
    drapLicense: z
        .string()
        .trim()
        .min(5, "DRAP license is required.")
        .regex(DRAP_LICENSE_REGEX, "License must match format: DRAP-MFG-2024-001847 or LIC-MFG-2024-XXXX"),
    industryType: z.string().trim().optional(),
    productCategories: z.string().trim().optional(),
    websiteUrl: optionalUrl,
    manufacturingCapacity: z.string().trim().optional(),
    certifications: z.string().trim().optional(),
    operatingCountries: z.string().trim().optional(),
    taxId: z.string().trim().min(1, "Tax ID is required."),
    registrationNumber: z.string().trim().min(1, "Registration Number is required."),
    registrationDate: z
        .string()
        .trim()
        .optional()
        .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
            message: "Enter a valid registration date.",
        }),
    companyDescription: z.string().trim().max(5000, "Description is too long.").optional(),
});

export type ManufacturerProfileInput = z.infer<typeof manufacturerProfileUpdateSchema>;

export function validateManufacturerProfileUpdate(body: unknown): ManufacturerProfileInput {
    const result = manufacturerProfileUpdateSchema.safeParse(body);
    if (!result.success) {
        const first = result.error.errors[0];
        throw new ApiError(400, first?.message || "Invalid profile data.");
    }
    return result.data;
}
