import { prisma } from "../../db/client";
import { ApiError } from "../../utils/api-response";

export class ManufacturerReportService {
    /**
     * Lists all manufacturers with basic profile info, medicine counts, and batch counts.
     */
    static async listManufacturers(options: { includeSuspended?: boolean } = {}) {
        const { includeSuspended = false } = options;

        const manufacturers = await prisma.manufacturer.findMany({
            where: { isSuspended: includeSuspended },
            select: {
                id: true,
                companyName: true,
                licenseNumber: true,
                address: true,
                businessPhone: true,
                businessEmail: true,
                taxId: true,
                registrationNumber: true,
                industryType: true,
                isVerified: true,
                verificationStatus: true,
                registrationDate: true,
                website: true,
                isSuspended: true,
                suspendedAt: true,
                medicines: {
                    select: {
                        _count: {
                            select: {
                                batches: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                companyName: "asc",
            },
        });

        return manufacturers.map((m) => {
            const medicineCount = m.medicines.length;
            const batchCount = m.medicines.reduce((acc, med) => acc + med._count.batches, 0);

            return {
                id: m.id,
                companyName: m.companyName,
                licenseNumber: m.licenseNumber,
                address: m.address,
                businessPhone: m.businessPhone,
                businessEmail: m.businessEmail,
                taxId: m.taxId,
                registrationNumber: m.registrationNumber,
                industryType: m.industryType,
                isVerified: m.isVerified,
                verificationStatus: m.verificationStatus,
                registrationDate: m.registrationDate?.toISOString() ?? null,
                website: m.website,
                isSuspended: m.isSuspended,
                suspendedAt: m.suspendedAt?.toISOString() ?? null,
                medicineCount,
                batchCount,
            };
        });
    }

    /**
     * Returns a specific manufacturer's report: profile info, medicines list, and their batches
     * with pill counts and verified/scanned pill counts.
     */
    static async getManufacturerReport(manufacturerId: string) {
        const manufacturer = await prisma.manufacturer.findUnique({
            where: { id: manufacturerId },
            include: {
                medicines: {
                    include: {
                        batches: {
                            include: {
                                _count: {
                                    select: {
                                        pills: true,
                                    },
                                },
                                pills: {
                                    where: {
                                        OR: [
                                            { qrScanned: true },
                                            { verificationStatus: "VERIFIED" },
                                        ],
                                    },
                                    select: {
                                        id: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!manufacturer) {
            throw new ApiError(404, "Manufacturer profile not found.");
        }

        const medicines = manufacturer.medicines.map((med) => {
            const batches = med.batches.map((batch) => {
                const totalPills = batch._count.pills;
                const verifiedPills = batch.pills.length;

                return {
                    id: batch.id,
                    batchNumber: batch.batchNumber,
                    status: batch.status,
                    medicineStatus: batch.medicineStatus,
                    manufacturingDate: batch.manufacturingDate.toISOString(),
                    expiryDate: batch.expiryDate.toISOString(),
                    quantityBoxes: batch.quantityBoxes,
                    totalPillsGenerated: batch.totalPillsGenerated,
                    blockchainStatus: batch.blockchainStatus,
                    createdAt: batch.createdAt.toISOString(),
                    totalPillsCount: totalPills,
                    verifiedPillsCount: verifiedPills,
                };
            });

            return {
                id: med.id,
                name: med.name,
                genericName: med.genericName,
                category: med.category,
                dosage: med.dosage,
                drapRegNumber: med.drapRegNumber,
                approvalStatus: med.approvalStatus,
                createdAt: med.createdAt.toISOString(),
                batches,
            };
        });

        return {
            id: manufacturer.id,
            companyName: manufacturer.companyName,
            licenseNumber: manufacturer.licenseNumber,
            address: manufacturer.address,
            businessPhone: manufacturer.businessPhone,
            businessEmail: manufacturer.businessEmail,
            taxId: manufacturer.taxId,
            registrationNumber: manufacturer.registrationNumber,
            industryType: manufacturer.industryType,
            isVerified: manufacturer.isVerified,
            verificationStatus: manufacturer.verificationStatus,
            registrationDate: manufacturer.registrationDate?.toISOString() ?? null,
            website: manufacturer.website,
            medicines,
        };
    }
}
