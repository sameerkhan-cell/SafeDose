import type { DocumentStatus, ManufacturerDocumentType } from "@prisma/client";
import { prisma } from "../db/client";
import { ApiError } from "../utils/api-response";
import fs from "node:fs/promises";
import path from "node:path";
import {
    REQUIRED_COMPLIANCE_TYPES,
    validateAdminReview,
    validateUploadDocument,
    type DocumentTypeValue,
} from "../validators/document.validator";
import {
    computeComplianceMetrics,
    enrichDocumentExpiry,
    type ComplianceMetrics,
} from "./compliance-score.service";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "DRAP_ADMIN", "REGULATOR"];

async function getManufacturerForUser(userId: string) {
    const manufacturer = await prisma.manufacturer.findUnique({ where: { userId } });
    if (!manufacturer) {
        throw new ApiError(404, "Manufacturer profile not found.");
    }
    return manufacturer;
}

async function logAudit(params: {
    documentId: string;
    manufacturerId: string;
    action: string;
    oldStatus?: DocumentStatus | null;
    newStatus?: DocumentStatus | null;
    performedBy: string;
    remarks?: string | null;
}) {
    await prisma.documentAuditLog.create({
        data: {
            documentId: params.documentId,
            manufacturerId: params.manufacturerId,
            action: params.action,
            oldStatus: params.oldStatus ?? undefined,
            newStatus: params.newStatus ?? undefined,
            performedBy: params.performedBy,
            remarks: params.remarks ?? undefined,
        },
    });
}

function toDocumentDto(doc: {
    id: string;
    manufacturerId: string;
    documentType: ManufacturerDocumentType;
    documentName: string;
    documentUrl: string;
    fileSize: number | null;
    mimeType: string | null;
    status: DocumentStatus;
    uploadedAt: Date;
    verifiedAt: Date | null;
    verifiedBy: string | null;
    expiryDate: Date | null;
    remarks: string | null;
}) {
    const enriched = enrichDocumentExpiry(doc);
    return {
        id: doc.id,
        manufacturerId: doc.manufacturerId,
        documentType: doc.documentType,
        documentName: doc.documentName,
        documentUrl: doc.documentUrl,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        status: enriched.effectiveStatus,
        effectiveStatus: enriched.effectiveStatus,
        isExpired: enriched.isExpired,
        uploadedAt: doc.uploadedAt.toISOString(),
        verifiedAt: doc.verifiedAt?.toISOString() ?? null,
        verifiedBy: doc.verifiedBy,
        expiryDate: doc.expiryDate?.toISOString().slice(0, 10) ?? null,
        remarks: doc.remarks,
        daysRemaining: enriched.daysRemaining,
    };
}

function mapAuditLog(log: {
    id: string;
    documentId: string;
    manufacturerId: string;
    action: string;
    oldStatus: DocumentStatus | null;
    newStatus: DocumentStatus | null;
    performedBy: string;
    remarks: string | null;
    createdAt: Date;
}) {
    return {
        id: log.id,
        documentId: log.documentId,
        manufacturerId: log.manufacturerId,
        action: log.action,
        oldStatus: log.oldStatus,
        newStatus: log.newStatus,
        performedBy: log.performedBy,
        remarks: log.remarks,
        timestamp: log.createdAt.toISOString(),
    };
}

export class ManufacturerDocumentService {
    static async uploadDocument(userId: string, body: unknown, file?: any) {
        const input = validateUploadDocument(body);
        const manufacturer = await getManufacturerForUser(userId);
        const docType = input.documentType as DocumentTypeValue;

        // Goal 2: Block DRAP_LICENSE upload until manufacturer profile is complete
        if (docType === "DRAP_LICENSE") {
            const hasAddress = manufacturer.address && manufacturer.address.trim().length > 0;
            const hasPhone = manufacturer.businessPhone && manufacturer.businessPhone.trim().length > 0;
            const hasEmail = manufacturer.businessEmail && manufacturer.businessEmail.trim().length > 0;
            const hasLicense = manufacturer.licenseNumber && manufacturer.licenseNumber.trim().length > 0;
            const hasTaxId = manufacturer.taxId && manufacturer.taxId.trim().length > 0;
            const hasRegNumber = manufacturer.registrationNumber && manufacturer.registrationNumber.trim().length > 0;
            const hasCompanyName = manufacturer.companyName && manufacturer.companyName.trim().length > 0;

            if (!hasCompanyName || !hasAddress || !hasPhone || !hasEmail || !hasLicense || !hasTaxId || !hasRegNumber) {
                throw new ApiError(
                    400,
                    "Please complete your company profile (address, contact number, business email, tax ID, and registration number) before uploading your DRAP License."
                );
            }
        }

        if (REQUIRED_COMPLIANCE_TYPES.includes(docType)) {
            const existing = await prisma.manufacturerDocument.findFirst({
                where: {
                    manufacturerId: manufacturer.id,
                    documentType: docType,
                    deletedAt: null,
                },
            });
            if (existing) {
                throw new ApiError(
                    409,
                    "Active document already exists for this type."
                );
            }
        }

        const document = await prisma.manufacturerDocument.create({
            data: {
                manufacturerId: manufacturer.id,
                documentType: docType as ManufacturerDocumentType,
                documentName: input.documentName,
                documentUrl: input.documentUrl || "",
                fileSize: file ? file.size : input.fileSize,
                mimeType: file ? file.type : input.mimeType,
                expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
                status: "PENDING",
            },
        });

        let documentUrl = input.documentUrl || "";
        let remarks = "";

        if (file) {
            const uploadDir = path.join(process.cwd(), "storage", "manufacturer-documents", manufacturer.id);
            await fs.mkdir(uploadDir, { recursive: true });
            
            const filePath = path.join(uploadDir, `doc-${document.id}`);
            const buffer = Buffer.from(await file.arrayBuffer());
            await fs.writeFile(filePath, buffer);

            documentUrl = `/api/manufacturer/documents/download?docId=${document.id}`;

            let driveLinkUrl: string | null = null;
            try {
                const { GoogleDriveService } = await import("./google-drive.service");
                const driveLink = await GoogleDriveService.uploadFile(
                    buffer,
                    input.documentName,
                    file.type
                );
                if (driveLink) {
                    driveLinkUrl = driveLink;
                    remarks = `[Google Drive] ${driveLink}`;
                }
            } catch (err: any) {
                console.error("[ManufacturerDocumentService] Google Drive upload failed:", err?.message || err);
                remarks = `Google Drive upload failed: ${err?.message || "Unknown error"}`;
            }

            try {
                const { sendDocumentNotificationEmail } = await import("./document-notification.service");
                await sendDocumentNotificationEmail({
                    manufacturerId: manufacturer.id,
                    manufacturerName: manufacturer.companyName,
                    documentType: docType,
                    documentName: input.documentName,
                    uploadedAt: new Date(),
                    driveLink: driveLinkUrl,
                    fileBuffer: buffer,
                    fileName: file.name || input.documentName,
                    mimeType: file.type || "application/octet-stream",
                });
            } catch (err: any) {
                console.error("[ManufacturerDocumentService] Failed to send document notification email:", err?.message || err);
            }

            await prisma.manufacturerDocument.update({
                where: { id: document.id },
                data: {
                    documentUrl,
                    remarks: remarks || null
                }
            });
            
            document.documentUrl = documentUrl;
            document.remarks = remarks || null;
        }

        await logAudit({
            documentId: document.id,
            manufacturerId: manufacturer.id,
            action: "UPLOADED",
            oldStatus: null,
            newStatus: "PENDING",
            performedBy: userId,
            remarks: remarks || undefined,
        });

        return toDocumentDto(document);
    }

    static async listDocuments(userId: string) {
        const manufacturer = await getManufacturerForUser(userId);
        const documents = await prisma.manufacturerDocument.findMany({
            where: { manufacturerId: manufacturer.id, deletedAt: null },
            orderBy: { uploadedAt: "desc" },
        });

        const items = documents.map(toDocumentDto);
        const compliance = computeComplianceMetrics(documents);

        return { documents: items, compliance };
    }

    static async getDocument(
        userId: string,
        documentId: string,
        role: string,
        options: { page?: number; limit?: number } = {}
    ) {
        const page = Math.max(1, options.page ?? 1);
        const limit = Math.min(100, Math.max(1, options.limit ?? 50));
        const skip = (page - 1) * limit;

        const document = await prisma.manufacturerDocument.findFirst({
            where: { id: documentId, deletedAt: null },
        });

        if (!document) {
            throw new ApiError(404, "Document not found.");
        }

        const isAdmin = ADMIN_ROLES.includes(role);
        if (!isAdmin) {
            const manufacturer = await getManufacturerForUser(userId);
            if (document.manufacturerId !== manufacturer.id) {
                throw new ApiError(403, "You do not have access to this document.");
            }
        }

        const [totalRecords, auditLogs] = await Promise.all([
            prisma.documentAuditLog.count({ where: { documentId } }),
            prisma.documentAuditLog.findMany({
                where: { documentId },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);

        const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

        return {
            ...toDocumentDto(document),
            auditHistory: auditLogs.map(mapAuditLog),
            totalRecords,
            totalPages,
            page,
            limit,
        };
    }

    static async softDeleteDocument(userId: string, documentId: string) {
        const manufacturer = await getManufacturerForUser(userId);
        const document = await prisma.manufacturerDocument.findFirst({
            where: { id: documentId, manufacturerId: manufacturer.id, deletedAt: null },
        });

        if (!document) {
            throw new ApiError(404, "Document not found.");
        }

        const oldStatus = document.status;

        await prisma.manufacturerDocument.update({
            where: { id: documentId },
            data: { deletedAt: new Date() },
        });

        await logAudit({
            documentId: document.id,
            manufacturerId: manufacturer.id,
            action: "DELETED",
            oldStatus,
            newStatus: null,
            performedBy: userId,
        });

        return { success: true, message: "Document removed. Audit history preserved." };
    }

    static async getComplianceMetrics(userId: string): Promise<ComplianceMetrics> {
        const manufacturer = await getManufacturerForUser(userId);
        const documents = await prisma.manufacturerDocument.findMany({
            where: { manufacturerId: manufacturer.id, deletedAt: null },
            select: {
                id: true,
                documentName: true,
                documentType: true,
                status: true,
                expiryDate: true,
                deletedAt: true,
            },
        });
        return computeComplianceMetrics(documents);
    }

    static async adminStartReview(adminUserId: string, documentId: string, body: unknown) {
        const { remarks } = validateAdminReview(body);
        const document = await prisma.manufacturerDocument.findFirst({
            where: { id: documentId, deletedAt: null },
        });

        if (!document) {
            throw new ApiError(404, "Document not found.");
        }

        if (document.status !== "PENDING") {
            throw new ApiError(
                400,
                "Only documents with PENDING status can be moved to review."
            );
        }

        const updated = await prisma.manufacturerDocument.update({
            where: { id: documentId },
            data: { status: "UNDER_REVIEW", remarks: remarks ?? document.remarks },
        });

        await logAudit({
            documentId,
            manufacturerId: document.manufacturerId,
            action: "UNDER_REVIEW",
            oldStatus: "PENDING",
            newStatus: "UNDER_REVIEW",
            performedBy: adminUserId,
            remarks,
        });

        return toDocumentDto(updated);
    }

    static async adminApprove(adminUserId: string, documentId: string, body: unknown) {
        const { remarks } = validateAdminReview(body);
        return this.adminTransition(adminUserId, documentId, "APPROVED", "APPROVED", remarks, [
            "PENDING",
            "UNDER_REVIEW",
        ]);
    }

    static async adminReject(adminUserId: string, documentId: string, body: unknown) {
        const { remarks } = validateAdminReview(body);
        if (!remarks) {
            throw new ApiError(400, "Rejection remarks are required.");
        }
        return this.adminTransition(adminUserId, documentId, "REJECTED", "REJECTED", remarks, [
            "PENDING",
            "UNDER_REVIEW",
        ]);
    }

    static async adminExpire(adminUserId: string, documentId: string, body: unknown) {
        const { remarks } = validateAdminReview(body);
        return this.adminTransition(adminUserId, documentId, "EXPIRED", "EXPIRED", remarks, [
            "PENDING",
            "UNDER_REVIEW",
            "APPROVED",
        ]);
    }

    private static async adminTransition(
        adminUserId: string,
        documentId: string,
        newStatus: DocumentStatus,
        auditAction: string,
        remarks: string | undefined,
        allowedFrom: DocumentStatus[]
    ) {
        const document = await prisma.manufacturerDocument.findFirst({
            where: { id: documentId, deletedAt: null },
        });

        if (!document) {
            throw new ApiError(404, "Document not found.");
        }

        if (!allowedFrom.includes(document.status)) {
            throw new ApiError(
                400,
                `Cannot transition from ${document.status} to ${newStatus}.`
            );
        }

        const oldStatus = document.status;
        const updated = await prisma.manufacturerDocument.update({
            where: { id: documentId },
            data: {
                status: newStatus,
                remarks: remarks ?? document.remarks,
                verifiedAt: newStatus === "APPROVED" ? new Date() : document.verifiedAt,
                verifiedBy: newStatus === "APPROVED" ? adminUserId : document.verifiedBy,
            },
        });

        if (document.documentType === "DRAP_LICENSE") {
            if (newStatus === "APPROVED") {
                await prisma.manufacturer.update({
                    where: { id: document.manufacturerId },
                    data: {
                        isVerified: true,
                        verificationStatus: "VERIFIED",
                        verifiedAt: new Date(),
                    },
                });
            } else if (newStatus === "REJECTED") {
                const mfg = await prisma.manufacturer.findUnique({
                    where: { id: document.manufacturerId },
                    select: { isVerified: true },
                });
                if (mfg?.isVerified) {
                    await prisma.manufacturer.update({
                        where: { id: document.manufacturerId },
                        data: {
                            isVerified: false,
                            verificationStatus: "PENDING",
                        },
                    });
                }
            }
        }

        await logAudit({
            documentId,
            manufacturerId: document.manufacturerId,
            action: auditAction,
            oldStatus,
            newStatus,
            performedBy: adminUserId,
            remarks,
        });

        return toDocumentDto(updated);
    }

    static async adminListDocuments(status?: string) {
        let statusFilter: any;
        if (status) {
            statusFilter = status as DocumentStatus;
        } else {
            statusFilter = { in: ["PENDING", "UNDER_REVIEW"] as DocumentStatus[] };
        }

        const documents = await prisma.manufacturerDocument.findMany({
            where: {
                deletedAt: null,
                status: statusFilter,
            },
            include: {
                manufacturer: {
                    select: {
                        companyName: true,
                        licenseNumber: true,
                        address: true,
                        businessPhone: true,
                        businessEmail: true,
                        taxId: true,
                        registrationNumber: true,
                        industryType: true,
                        website: true,
                        isVerified: true,
                        verificationStatus: true,
                    },
                },
            },
            orderBy: {
                uploadedAt: "desc",
            },
        });

        return documents.map((doc) => {
            const enriched = enrichDocumentExpiry(doc);
            return {
                id: doc.id,
                manufacturerId: doc.manufacturerId,
                documentType: doc.documentType,
                documentName: doc.documentName,
                documentUrl: doc.documentUrl,
                fileSize: doc.fileSize,
                mimeType: doc.mimeType,
                status: enriched.effectiveStatus,
                effectiveStatus: enriched.effectiveStatus,
                isExpired: enriched.isExpired,
                uploadedAt: doc.uploadedAt.toISOString(),
                verifiedAt: doc.verifiedAt?.toISOString() ?? null,
                verifiedBy: doc.verifiedBy,
                expiryDate: doc.expiryDate?.toISOString().slice(0, 10) ?? null,
                remarks: doc.remarks,
                daysRemaining: enriched.daysRemaining,
                manufacturer: {
                    companyName: doc.manufacturer.companyName,
                    licenseNumber: doc.manufacturer.licenseNumber,
                    address: doc.manufacturer.address,
                    businessPhone: doc.manufacturer.businessPhone,
                    businessEmail: doc.manufacturer.businessEmail,
                    taxId: doc.manufacturer.taxId,
                    registrationNumber: doc.manufacturer.registrationNumber,
                    industryType: doc.manufacturer.industryType,
                    website: doc.manufacturer.website,
                    isVerified: doc.manufacturer.isVerified,
                    verificationStatus: doc.manufacturer.verificationStatus,
                },
            };
        });
    }
}
