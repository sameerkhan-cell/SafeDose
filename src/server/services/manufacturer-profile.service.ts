import { prisma } from "../db/client";
import { ApiError } from "../utils/api-response";
import {
    validateManufacturerProfileUpdate,
    type ManufacturerProfileInput,
} from "../validators/profile.validator";
import { ManufacturerDocumentService } from "./manufacturer-document.service";
import type { ComplianceMetrics } from "./compliance-score.service";
import fs from "node:fs/promises";
import path from "node:path";

export type ManufacturerProfileDto = {
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
    compliance?: ComplianceMetrics;
};

function toDto(mfg: {
    companyName: string;
    companyLogo: string | null;
    businessLocation: string | null;
    address: string | null;
    businessPhone: string | null;
    businessEmail: string | null;
    licenseNumber: string;
    industryType: string | null;
    productCategories: string | null;
    website: string | null;
    manufacturingCapacity: string | null;
    certifications: string | null;
    operatingCountries: string | null;
    taxId: string | null;
    registrationNumber: string | null;
    registrationDate: Date | null;
    companyDescription: string | null;
}): ManufacturerProfileDto {
    return {
        companyName: mfg.companyName,
        companyLogo: mfg.companyLogo ?? "",
        businessLocation: mfg.businessLocation ?? "",
        address: mfg.address ?? "",
        contactNumber: mfg.businessPhone ?? "",
        officialEmail: mfg.businessEmail ?? "",
        drapLicense: mfg.licenseNumber,
        industryType: mfg.industryType ?? "",
        productCategories: mfg.productCategories ?? "",
        websiteUrl: mfg.website ?? "",
        manufacturingCapacity: mfg.manufacturingCapacity ?? "",
        certifications: mfg.certifications ?? "",
        operatingCountries: mfg.operatingCountries ?? "",
        taxId: mfg.taxId ?? "",
        registrationNumber: mfg.registrationNumber ?? "",
        registrationDate: mfg.registrationDate
            ? mfg.registrationDate.toISOString().slice(0, 10)
            : "",
        companyDescription: mfg.companyDescription ?? "",
    };
}

function toDbData(input: ManufacturerProfileInput) {
    return {
        companyName: input.companyName,
        companyLogo: input.companyLogo?.trim() || null,
        businessLocation: input.businessLocation?.trim() || null,
        address: input.address,
        businessPhone: input.contactNumber,
        businessEmail: input.officialEmail,
        licenseNumber: input.drapLicense,
        industryType: input.industryType?.trim() || null,
        productCategories: input.productCategories?.trim() || null,
        website: input.websiteUrl?.trim() || null,
        manufacturingCapacity: input.manufacturingCapacity?.trim() || null,
        certifications: input.certifications?.trim() || null,
        operatingCountries: input.operatingCountries?.trim() || null,
        taxId: input.taxId?.trim() || null,
        registrationNumber: input.registrationNumber?.trim() || null,
        registrationDate: input.registrationDate
            ? new Date(input.registrationDate)
            : null,
        companyDescription: input.companyDescription?.trim() || null,
    };
}

export class ManufacturerProfileService {
    static async getProfile(userId: string): Promise<ManufacturerProfileDto> {
        const manufacturer = await prisma.manufacturer.findUnique({
            where: { userId },
        });

        if (!manufacturer) {
            throw new ApiError(404, "Manufacturer profile not found.");
        }

        const compliance = await ManufacturerDocumentService.getComplianceMetrics(userId);
        return { ...toDto(manufacturer), compliance };
    }

    static async updateProfile(
        userId: string,
        body: unknown
    ): Promise<ManufacturerProfileDto> {
        const input = validateManufacturerProfileUpdate(body);

        const existing = await prisma.manufacturer.findUnique({
            where: { userId },
        });

        if (!existing) {
            throw new ApiError(404, "Manufacturer profile not found.");
        }

        if (input.drapLicense !== existing.licenseNumber) {
            const licenseTaken = await prisma.manufacturer.findUnique({
                where: { licenseNumber: input.drapLicense },
            });
            if (licenseTaken && licenseTaken.userId !== userId) {
                throw new ApiError(400, "This DRAP license is already registered to another manufacturer.");
            }
        }

        const data = toDbData(input);

        const updated = await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { name: input.companyName },
            });

            return tx.manufacturer.update({
                where: { userId },
                data,
            });
        });

        return toDto(updated);
    }

    static async uploadLogo(userId: string, file: any): Promise<string> {
        const manufacturer = await prisma.manufacturer.findUnique({
            where: { userId },
        });

        if (!manufacturer) {
            throw new ApiError(404, "Manufacturer profile not found.");
        }

        const mfgId = manufacturer.id;
        const uploadDir = path.join(process.cwd(), "storage", "company-logos", mfgId);

        // Ensure directory exists
        await fs.mkdir(uploadDir, { recursive: true });

        // Generate filename
        const ext = file.name ? path.extname(file.name) : ".png";
        const fileName = `logo-${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);

        // Return a URL that we will handle via an API route to serve the image
        const fileUrl = `/api/manufacturer/profile/logo-image?mfgId=${mfgId}&file=${fileName}`;

        // Save file
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        // Clean up old logo if it was local
        if (manufacturer.companyLogo && manufacturer.companyLogo.includes("logo-image")) {
            try {
                const oldUrl = new URL(manufacturer.companyLogo, "http://localhost");
                const oldFile = oldUrl.searchParams.get("file");
                if (oldFile) {
                    const oldPath = path.join(uploadDir, oldFile);
                    await fs.unlink(oldPath);
                }
            } catch { }
        }

        // Update DB
        await prisma.manufacturer.update({
            where: { id: mfgId },
            data: { companyLogo: fileUrl },
        });

        return fileUrl;
    }

    static async deleteLogo(userId: string): Promise<void> {
        const manufacturer = await prisma.manufacturer.findUnique({
            where: { userId },
        });

        if (!manufacturer || !manufacturer.companyLogo) return;

        // Delete file if local
        if (manufacturer.companyLogo.includes("logo-image")) {
            try {
                const url = new URL(manufacturer.companyLogo, "http://localhost");
                const fileName = url.searchParams.get("file");
                if (fileName) {
                    const filePath = path.join(process.cwd(), "storage", "company-logos", manufacturer.id, fileName);
                    await fs.unlink(filePath);
                }
            } catch { }
        }

        // Update DB
        await prisma.manufacturer.update({
            where: { userId },
            data: { companyLogo: null },
        });
    }
}
