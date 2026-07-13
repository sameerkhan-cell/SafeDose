import { prisma } from "@/server/db/client";
import Papa from "papaparse";

export interface BulkUploadResult {
    created: number;
    skipped: number;
    errors: string[];
}

export interface BatchListItem {
    id: string;
    batchCode: string;
    companyName: string | null;
    registeredAt: string;
    medicineName: string;
    medicineId: string;
}

export interface BatchListResult {
    items: BatchListItem[];
    total: number;
}

export class DrapBatchRegistryService {
    static async bulkUploadFromCsv(
        csvText: string,
        adminUserId: string
    ): Promise<BulkUploadResult> {
        const result: BulkUploadResult = { created: 0, skipped: 0, errors: [] };

        // Parse CSV — handles quoted fields, commas in values, etc.
        const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim().toLowerCase(),
        });

        if (parsed.errors.length > 0 && parsed.data.length === 0) {
            result.errors.push(`CSV parse failed: ${parsed.errors[0].message}`);
            return result;
        }

        const rows = parsed.data;

        // Validate that required columns are present
        if (rows.length > 0 && (!("medicinename" in rows[0]) || !("batchcode" in rows[0]))) {
            result.errors.push(
                "CSV must have columns: medicineName, batchCode (and optionally companyName)"
            );
            return result;
        }

        // Build a medicine lookup cache — only DRAP entries
        const medicineCache = new Map<string, { id: string; manufacturer_name: string | null }>();

        for (let i = 0; i < rows.length; i++) {
            const rowNum = i + 2; // 1-indexed + header row
            const row = rows[i];

            const medicineName = (row["medicinename"] ?? "").trim();
            const batchCode = (row["batchcode"] ?? "").trim();
            const companyNameCol = (row["companyname"] ?? "").trim() || null;

            if (!medicineName) {
                result.errors.push(`Row ${rowNum}: medicineName is empty — skipped`);
                result.skipped++;
                continue;
            }
            if (!batchCode) {
                result.errors.push(`Row ${rowNum}: batchCode is empty — skipped`);
                result.skipped++;
                continue;
            }

            // Lookup medicine (cache to avoid N+1 for repeated medicine names)
            if (!medicineCache.has(medicineName)) {
                const med = await prisma.medicine.findFirst({
                    where: { name: medicineName, isPublicDRAPEntry: true },
                    select: { id: true, manufacturer_name: true },
                });
                if (med) {
                    medicineCache.set(medicineName, med);
                } else {
                    medicineCache.set(medicineName, null as any); // cache miss
                }
            }

            const medicine = medicineCache.get(medicineName);
            if (!medicine) {
                result.errors.push(
                    `Row ${rowNum}: No DRAP-registered medicine found with name "${medicineName}" — skipped`
                );
                result.skipped++;
                continue;
            }

            // Resolve companyName: explicit column > medicine's manufacturer_name > null
            const resolvedCompanyName = companyNameCol ?? medicine.manufacturer_name ?? null;

            // Upsert to handle duplicates with per-row error reporting
            try {
                const existing = await prisma.drapBatchRegistry.findUnique({
                    where: { batchCode },
                    select: { id: true },
                });

                if (existing) {
                    result.errors.push(
                        `Row ${rowNum}: Batch code "${batchCode}" already exists — skipped`
                    );
                    result.skipped++;
                    continue;
                }

                await prisma.drapBatchRegistry.create({
                    data: {
                        medicineId: medicine.id,
                        batchCode,
                        companyName: resolvedCompanyName,
                        registeredBy: adminUserId,
                    },
                });
                result.created++;
            } catch (err: any) {
                // Unique constraint violation (race condition on concurrent uploads)
                if (err.code === "P2002") {
                    result.errors.push(
                        `Row ${rowNum}: Batch code "${batchCode}" already exists — skipped`
                    );
                    result.skipped++;
                } else {
                    result.errors.push(`Row ${rowNum}: Unexpected error — ${err.message}`);
                    result.skipped++;
                }
            }
        }

        return result;
    }

    static async listBatches(params: {
        search?: string;
        page?: number;
        pageSize?: number;
    }): Promise<BatchListResult> {
        const page = Math.max(1, params.page ?? 1);
        const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
        const skip = (page - 1) * pageSize;

        const where = params.search
            ? {
                  OR: [
                      { batchCode: { contains: params.search } },
                      { medicine: { name: { contains: params.search } } },
                      { companyName: { contains: params.search } },
                  ],
              }
            : {};

        const [items, total] = await Promise.all([
            prisma.drapBatchRegistry.findMany({
                where,
                orderBy: { registeredAt: "desc" },
                skip,
                take: pageSize,
                include: {
                    medicine: { select: { id: true, name: true } },
                },
            }),
            prisma.drapBatchRegistry.count({ where }),
        ]);

        return {
            items: items.map((item) => ({
                id: item.id,
                batchCode: item.batchCode,
                companyName: item.companyName,
                registeredAt: item.registeredAt.toISOString(),
                medicineName: item.medicine.name,
                medicineId: item.medicine.id,
            })),
            total,
        };
    }
}
