import { prisma } from "@/server/db/client";

export interface ReportListItem {
    id: string;
    medicineName: string;
    batchNumber: string | null;
    pharmacyName: string | null;
    description: string;
    status: string;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        role: string;
    };
}

export class ReportReviewService {
    static async listReports(filters?: {
        role?: string;
        status?: string;
    }): Promise<ReportListItem[]> {
        const where: any = {};

        if (filters?.status) {
            where.status = filters.status;
        }

        if (filters?.role) {
            where.user = { role: filters.role };
        }

        const reports = await prisma.report.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });

        return reports.map((r) => ({
            id: r.id,
            medicineName: r.medicineName,
            batchNumber: r.batchNumber,
            pharmacyName: r.pharmacyName,
            description: r.description,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            user: {
                id: r.user.id,
                name: r.user.name,
                email: r.user.email,
                role: r.user.role as string,
            },
        }));
    }

    static async updateReportStatus(
        id: string,
        status: string
    ): Promise<ReportListItem> {
        const VALID_STATUSES = ["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"];
        if (!VALID_STATUSES.includes(status)) {
            throw Object.assign(new Error(`Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(", ")}`), { statusCode: 400 });
        }

        const updated = await prisma.report.update({
            where: { id },
            data: { status },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });

        return {
            id: updated.id,
            medicineName: updated.medicineName,
            batchNumber: updated.batchNumber,
            pharmacyName: updated.pharmacyName,
            description: updated.description,
            status: updated.status,
            createdAt: updated.createdAt.toISOString(),
            user: {
                id: updated.user.id,
                name: updated.user.name,
                email: updated.user.email,
                role: updated.user.role as string,
            },
        };
    }
}
