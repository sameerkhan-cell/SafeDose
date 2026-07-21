import { prisma } from "../../db/client";
import { ApiError } from "../../utils/api-response";

export class PharmacyAdminService {
    static async listPharmacies() {
        const pharmacies = await prisma.pharmacy.findMany({
            orderBy: {
                name: "asc",
            },
        });

        return pharmacies.map((p: any) => ({
            id: p.id,
            userId: p.userId,
            name: p.name,
            licenseNumber: p.licenseNumber,
            location: p.location ?? "",
            address: p.address ?? "",
            businessPhone: p.businessPhone ?? "",
            businessEmail: p.businessEmail ?? "",
            isVerified: p.isVerified,
            verificationStatus: p.verificationStatus,
            licenseDocumentUrl: p.licenseDocumentUrl,
            verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
            remarks: p.remarks,
        }));
    }

    static async approvePharmacy(adminUserId: string, pharmacyId: string) {
        const pharmacy = await prisma.pharmacy.findUnique({
            where: { id: pharmacyId },
        });

        if (!pharmacy) {
            throw new ApiError(404, "Pharmacy not found.");
        }

        const updated = await prisma.pharmacy.update({
            where: { id: pharmacyId },
            data: {
                isVerified: true,
                verificationStatus: "VERIFIED",
                verifiedAt: new Date(),
                remarks: null,
            },
        });

        return updated;
    }

    static async rejectPharmacy(adminUserId: string, pharmacyId: string, remarks: string) {
        const pharmacy = await prisma.pharmacy.findUnique({
            where: { id: pharmacyId },
        });

        if (!pharmacy) {
            throw new ApiError(404, "Pharmacy not found.");
        }

        const updated = await prisma.pharmacy.update({
            where: { id: pharmacyId },
            data: {
                isVerified: false,
                verificationStatus: "REJECTED",
                remarks: remarks,
                verifiedAt: null,
            },
        });

        return updated;
    }

    static async unverifyPharmacy(adminUserId: string, pharmacyId: string) {
        const pharmacy = await prisma.pharmacy.findUnique({
            where: { id: pharmacyId },
        });

        if (!pharmacy) {
            throw new ApiError(404, "Pharmacy not found.");
        }

        const updated = await prisma.pharmacy.update({
            where: { id: pharmacyId },
            data: {
                isVerified: false,
                verificationStatus: "PENDING",
                verifiedAt: null,
            },
        });

        return updated;
    }
}
