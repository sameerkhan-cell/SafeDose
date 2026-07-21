import { prisma } from "../db/client";
import { ApiError } from "../utils/api-response";
import { validatePharmacyProfileUpdate } from "../validators/pharmacy-profile.validator";
import fs from "node:fs/promises";
import path from "node:path";

export type PharmacyProfileDto = {
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
};

function toDto(pharmacy: any): PharmacyProfileDto {
    return {
        id: pharmacy.id,
        userId: pharmacy.userId,
        name: pharmacy.name,
        licenseNumber: pharmacy.licenseNumber,
        location: pharmacy.location ?? "",
        address: pharmacy.address ?? "",
        businessPhone: pharmacy.businessPhone ?? "",
        businessEmail: pharmacy.businessEmail ?? "",
        isVerified: pharmacy.isVerified,
        verificationStatus: pharmacy.verificationStatus,
        licenseDocumentUrl: pharmacy.licenseDocumentUrl,
        verifiedAt: pharmacy.verifiedAt ? pharmacy.verifiedAt.toISOString() : null,
        remarks: pharmacy.remarks,
    };
}

export class PharmacyService {
    static async getProfile(userId: string): Promise<PharmacyProfileDto> {
        const pharmacy = await prisma.pharmacy.findUnique({
            where: { userId },
        });
        if (!pharmacy) {
            throw new ApiError(404, "Pharmacy profile not found.");
        }
        return toDto(pharmacy);
    }

    static async updateProfile(userId: string, body: unknown): Promise<PharmacyProfileDto> {
        const input = validatePharmacyProfileUpdate(body);

        // Check if license number is already registered to another pharmacy
        const existing = await prisma.pharmacy.findUnique({
            where: { licenseNumber: input.licenseNumber },
        });
        if (existing && existing.userId !== userId) {
            throw new ApiError(400, "This license number is already registered to another pharmacy.");
        }

        const updated = await prisma.$transaction(async (tx) => {
            // Update user name as well
            await tx.user.update({
                where: { id: userId },
                data: { name: input.name },
            });

            return tx.pharmacy.update({
                where: { userId },
                data: {
                    name: input.name,
                    licenseNumber: input.licenseNumber,
                    location: input.location,
                    address: input.address,
                    businessPhone: input.businessPhone,
                    businessEmail: input.businessEmail,
                },
            });
        });

        return toDto(updated);
    }

    static async uploadLicense(userId: string, file: any): Promise<PharmacyProfileDto> {
        const pharmacy = await prisma.pharmacy.findUnique({
            where: { userId },
        });
        if (!pharmacy) {
            throw new ApiError(404, "Pharmacy profile not found.");
        }

        // Validate profile completeness
        const hasName = pharmacy.name && pharmacy.name.trim().length > 0;
        const hasLicense = pharmacy.licenseNumber && pharmacy.licenseNumber.trim().length > 0;
        const hasLocation = pharmacy.location && pharmacy.location.trim().length > 0;
        const hasAddress = pharmacy.address && pharmacy.address.trim().length > 0;
        const hasPhone = pharmacy.businessPhone && pharmacy.businessPhone.trim().length > 0;
        const hasEmail = pharmacy.businessEmail && pharmacy.businessEmail.trim().length > 0;

        if (!hasName || !hasLicense || !hasLocation || !hasAddress || !hasPhone || !hasEmail) {
            throw new ApiError(
                400,
                "Please complete your pharmacy profile (name, license number, location, address, contact number, and email) before uploading your license."
            );
        }

        if (!file) {
            throw new ApiError(400, "License file is required.");
        }

        const pharmacyId = pharmacy.id;
        const uploadDir = path.join(process.cwd(), "storage", "pharmacy-licenses", pharmacyId);
        await fs.mkdir(uploadDir, { recursive: true });

        const ext = file.name ? path.extname(file.name) : ".pdf";
        const fileName = `license-${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        const licenseDocumentUrl = `/api/pharmacy/license/download?pharmacyId=${pharmacyId}&file=${fileName}`;

        const updated = await prisma.pharmacy.update({
            where: { id: pharmacyId },
            data: {
                licenseDocumentUrl,
                verificationStatus: "PENDING",
            },
        });

        return toDto(updated);
    }

    static async serveLicenseFile(userId: string, pharmacyId: string, role: string, fileName: string) {
        // Authorize: Must be the owner pharmacy or DRAP admin roles
        const isOwner = await prisma.pharmacy.findFirst({
            where: { id: pharmacyId, userId },
        });

        const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN", "REGULATOR"];
        const isAdmin = ADMIN_ROLES.includes(role);

        if (!isOwner && !isAdmin) {
            throw new ApiError(403, "You do not have access to this document.");
        }

        const filePath = path.join(
            process.cwd(),
            "storage",
            "pharmacy-licenses",
            pharmacyId,
            fileName
        );

        try {
            const buffer = await fs.readFile(filePath);
            return {
                buffer,
                fileName,
            };
        } catch (e) {
            throw new ApiError(404, "License file not found on server filesystem.");
        }
    }
}
