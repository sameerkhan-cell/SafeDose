import { z } from "zod";
import { ApiError } from "../utils/api-response";

const DRAP_LICENSE_REGEX = /^([A-Z]{2,5}-){1,3}[A-Z0-9-]{3,24}$/i;
const PHONE_REGEX = /^\+?[\d\s().-]{8,24}$/;

export const pharmacyProfileUpdateSchema = z.object({
    name: z.string().trim().min(2, "Pharmacy name is required."),
    licenseNumber: z
        .string()
        .trim()
        .min(5, "License number is required.")
        .regex(DRAP_LICENSE_REGEX, "License number must match format: DRAP-PH-2023-004521"),
    location: z.string().trim().min(3, "Location (city/region) is required."),
    address: z.string().trim().min(5, "Full address is required."),
    businessPhone: z
        .string()
        .trim()
        .min(8, "Contact number is required.")
        .regex(PHONE_REGEX, "Enter a valid contact number."),
    businessEmail: z.string().trim().email("Enter a valid business email."),
});

export type PharmacyProfileInput = z.infer<typeof pharmacyProfileUpdateSchema>;

export function validatePharmacyProfileUpdate(body: unknown): PharmacyProfileInput {
    const result = pharmacyProfileUpdateSchema.safeParse(body);
    if (!result.success) {
        const first = result.error.errors[0];
        throw new ApiError(400, first?.message || "Invalid pharmacy profile data.");
    }
    return result.data;
}
