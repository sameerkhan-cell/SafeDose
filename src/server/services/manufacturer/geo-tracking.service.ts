/**
 * GeoTrackingService
 *
 * Provides geo-tagged VerificationLog queries for two isolated actors:
 *   - Manufacturer: sees only scans of their own medicines (cartons, boxes, pills, batches).
 *   - Pharmacy: sees scans they performed PLUS patient scans of boxes they received.
 *
 * Isolation guarantee (manufacturer):
 *   Scans are strictly mapped back to the authenticated manufacturer's own product codes:
 *   - Carton scans: matched by code string against this manufacturer's own Carton codes.
 *   - Box scans: matched by code string against this manufacturer's own Box codes.
 *   - Pill scans: matched via relation chain: pill → box → batch → medicine → manufacturerId = manufacturer.id
 *   - Batch scans: matched by code string against this manufacturer's own Batch numbers.
 *
 * Both queries cap at 500 rows (most recent first) to protect against
 * unbounded result sets.
 */

import { prisma } from "@/server/db/client";

const MAX_RESULTS = 500;

export type ScanLocationPoint = {
    id: string;
    lat: number;
    lng: number;
    status: string;
    type: string;
    createdAt: Date;
    scannedByRole: string;
    medicineName: string | null;
};

/**
 * Helper to dynamically load medicine names for logs where pillId is null (cartons, boxes, batches)
 */
async function resolveMedicineNamesForLogs(codes: string[]): Promise<Map<string, string>> {
    const codeToName = new Map<string, string>();
    if (codes.length === 0) return codeToName;

    const [cartons, boxes, batches] = await Promise.all([
        prisma.carton.findMany({
            where: {
                OR: [
                    { qrCode: { in: codes } },
                    { cartonNumber: { in: codes } }
                ]
            },
            select: {
                qrCode: true,
                cartonNumber: true,
                batch: { select: { medicine: { select: { name: true } } } }
            }
        }),
        prisma.box.findMany({
            where: {
                OR: [
                    { qrCode: { in: codes } },
                    { boxNumber: { in: codes } }
                ]
            },
            select: {
                qrCode: true,
                boxNumber: true,
                batch: { select: { medicine: { select: { name: true } } } }
            }
        }),
        prisma.batch.findMany({
            where: { batchNumber: { in: codes } },
            select: {
                batchNumber: true,
                medicine: { select: { name: true } }
            }
        })
    ]);

    for (const c of cartons) {
        codeToName.set(c.qrCode, c.batch.medicine.name);
        codeToName.set(c.cartonNumber, c.batch.medicine.name);
    }
    for (const b of boxes) {
        codeToName.set(b.qrCode, b.batch.medicine.name);
        codeToName.set(b.boxNumber, b.batch.medicine.name);
    }
    for (const b of batches) {
        codeToName.set(b.batchNumber, b.medicine.name);
    }

    return codeToName;
}

export class GeoTrackingService {
    // ─────────────────────────────────────────────────────────────────────────
    // MANUFACTURER — scans of their own medicines (cartons, boxes, pills, batches)
    // ─────────────────────────────────────────────────────────────────────────
    static async getManufacturerScanLocations(userId: string): Promise<ScanLocationPoint[]> {
        // Step 1: resolve the manufacturer row from the authenticated userId.
        const manufacturer = await prisma.manufacturer.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!manufacturer) {
            const err: any = new Error("Manufacturer profile not found");
            err.statusCode = 404;
            throw err;
        }

        // Resolve all batches of this manufacturer to obtain valid Carton, Box, and Batch codes
        const batches = await prisma.batch.findMany({
            where: {
                medicine: {
                    manufacturerId: manufacturer.id
                }
            },
            select: {
                id: true,
                batchNumber: true
            }
        });
        const batchIds = batches.map(b => b.id);
        const batchNumbers = batches.map(b => b.batchNumber);

        const [cartons, boxes] = await Promise.all([
            prisma.carton.findMany({
                where: { batchId: { in: batchIds } },
                select: { qrCode: true, cartonNumber: true }
            }),
            prisma.box.findMany({
                where: { batchId: { in: batchIds } },
                select: { qrCode: true, boxNumber: true }
            })
        ]);

        const cartonCodes = [
            ...cartons.map(c => c.qrCode),
            ...cartons.map(c => c.cartonNumber)
        ];
        const boxCodes = [
            ...boxes.map(b => b.qrCode),
            ...boxes.map(b => b.boxNumber)
        ];

        // Step 2: query VerificationLogs where:
        //   • lat and lng are present (GPS-tagged scans only)
        //   • OR condition matching:
        //       (a) Pill scans: nested relation chain to this manufacturer
        //       (b) Carton scans: matches this manufacturer's carton codes
        //       (c) Box scans: matches this manufacturer's box codes
        //       (d) Batch scans: matches this manufacturer's batch numbers
        const logs = await prisma.verificationLog.findMany({
            where: {
                lat: { not: null },
                lng: { not: null },
                OR: [
                    // (a) Pill scans (where pillId is populated)
                    {
                        pill: {
                            box: {
                                batch: {
                                    medicine: {
                                        manufacturerId: manufacturer.id,
                                    },
                                },
                            },
                        },
                    },
                    // (b) Carton scans (where pillId is null)
                    {
                        type: "CARTON",
                        code: { in: cartonCodes }
                    },
                    // (c) Box scans (where pillId is null)
                    {
                        type: "BOX",
                        code: { in: boxCodes }
                    },
                    // (d) Batch scans (where pillId is null)
                    {
                        type: "BATCH",
                        code: { in: batchNumbers }
                    }
                ]
            },
            orderBy: { createdAt: "desc" },
            take: MAX_RESULTS,
            select: {
                id: true,
                lat: true,
                lng: true,
                status: true,
                type: true,
                createdAt: true,
                code: true,
                user: {
                    select: { role: true },
                },
                pill: {
                    select: {
                        box: {
                            select: {
                                batch: {
                                    select: {
                                        medicine: {
                                            select: { name: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Resolve missing medicine names for non-pill scans (cartons, boxes, batches)
        const missingCodes = logs.filter((log) => !log.pill).map((log) => log.code);
        const nameMap = await resolveMedicineNamesForLogs(missingCodes);

        return logs.map((log) => ({
            id: log.id,
            lat: log.lat as number,
            lng: log.lng as number,
            status: log.status,
            type: log.type,
            createdAt: log.createdAt,
            scannedByRole: log.user?.role ?? "UNKNOWN",
            medicineName: log.pill?.box?.batch?.medicine?.name ?? nameMap.get(log.code) ?? null,
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHARMACY — their own scans + patient scans of boxes they received
    // ─────────────────────────────────────────────────────────────────────────
    static async getPharmacyScanLocations(userId: string): Promise<ScanLocationPoint[]> {
        // Step 1: resolve the pharmacy row.
        const pharmacy = await prisma.pharmacy.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!pharmacy) {
            const err: any = new Error("Pharmacy profile not found");
            err.statusCode = 404;
            throw err;
        }

        // Fetch all Box codes assigned to this pharmacy to find patient scans of these boxes
        const assignedBoxes = await prisma.box.findMany({
            where: { pharmacyId: pharmacy.id },
            select: { qrCode: true, boxNumber: true }
        });
        const assignedBoxCodes = [
            ...assignedBoxes.map(b => b.qrCode),
            ...assignedBoxes.map(b => b.boxNumber)
        ];

        // Step 2: query VerificationLogs where lat/lng are present AND either:
        //   (a) the log was written by this pharmacy's own userId (their stock scans), OR
        //   (b) the scanned pill belongs to a box whose pharmacyId = this pharmacy
        //   (c) the scanned box belongs to this pharmacy (where pillId is null)
        const logs = await prisma.verificationLog.findMany({
            where: {
                lat: { not: null },
                lng: { not: null },
                OR: [
                    // (a) Pharmacy scanned it directly
                    { userId },
                    // (b) Patient scanned a pill from a box assigned to this pharmacy
                    {
                        pill: {
                            box: {
                                pharmacyId: pharmacy.id,
                            },
                        },
                    },
                    // (c) Patient scanned a box assigned to this pharmacy (pillId is null)
                    {
                        type: "BOX",
                        code: { in: assignedBoxCodes }
                    }
                ],
            },
            orderBy: { createdAt: "desc" },
            take: MAX_RESULTS,
            select: {
                id: true,
                lat: true,
                lng: true,
                status: true,
                type: true,
                createdAt: true,
                code: true,
                user: {
                    select: { role: true },
                },
                pill: {
                    select: {
                        box: {
                            select: {
                                batch: {
                                    select: {
                                        medicine: {
                                            select: { name: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Resolve missing medicine names for non-pill scans (cartons, boxes, batches)
        const missingCodes = logs.filter((log) => !log.pill).map((log) => log.code);
        const nameMap = await resolveMedicineNamesForLogs(missingCodes);

        return logs.map((log) => ({
            id: log.id,
            lat: log.lat as number,
            lng: log.lng as number,
            status: log.status,
            type: log.type,
            createdAt: log.createdAt,
            scannedByRole: log.user?.role ?? "UNKNOWN",
            medicineName: log.pill?.box?.batch?.medicine?.name ?? nameMap.get(log.code) ?? null,
        }));
    }
}
