import { prisma } from "../../db/client";
import { ApiError } from "../../utils/api-response";
import { QRService } from "../qr/qr.service";
import { AuditLogService } from "../audit/audit-log.service";
// Blockchain queue — enqueue jobs after batch creation (worker calls anchorBatch/anchorPill)
import { enqueueBlockchainJobs } from "../blockchain/blockchain.queue";

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface BatchRegistrationData {
    // Medicine fields
    medicineName: string;
    genericName?: string;
    category?: string;
    dosage?: string;
    description?: string;

    // Batch fields
    batchNumber: string;
    manufacturingDate: string;
    expiryDate: string;
    quantityBoxes: number;
    pillsPerBox: number;
    totalCartons?: number;
    dosageStrength?: string;
    productType?: string;

    // Extension flag
    allowsExtension?: boolean;
}

export interface DashboardStats {
    totalMedicines: number;
    totalBatches: number;
    totalPillsGenerated: number;
    activeBatches: number;
    expiredBatches: number;
    recalledBatches: number;

    // Hardening metrics
    totalBoxQRGenerated: number;
    totalPillQRGenerated: number;
    totalPDFExports: number;
    totalZIPExports: number;
    lastExportDate: string | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class BatchService {
    static formatCartonCode(batchNumber: string, cartonIndex: number, companyCode: string): string {
        return `${companyCode.toUpperCase()}-${batchNumber.toUpperCase()}-C${cartonIndex}`;
    }

    static formatBoxCode(batchNumber: string, cartonIndex: number, boxIndexInCarton: number, companyCode: string): string {
        return `${companyCode.toUpperCase()}-${batchNumber.toUpperCase()}-C${cartonIndex}-B${boxIndexInCarton}`;
    }

    static formatPillCode(
        batchNumber: string,
        cartonIndex: number,
        boxIndexInCarton: number,
        pillIndexInBox: number,
        companyCode: string
    ): string {
        return `${companyCode.toUpperCase()}-${batchNumber.toUpperCase()}-C${cartonIndex}-B${boxIndexInCarton}-P${pillIndexInBox}`;
    }

    /**
     * POST /api/manufacturer/batches  (and /register-batch legacy)
     *
     * Registers a new pharmaceutical batch, creates all individual pill
     * records, persists QRAsset entries, and emits audit events.
     */
    static async registerBatch(
        userId: string,
        data: BatchRegistrationData,
        requestMeta?: { ipAddress?: string; userAgent?: string }
    ) {
        const {
            medicineName,
            genericName,
            category,
            dosage,
            description,
            batchNumber,
            manufacturingDate,
            expiryDate,
            quantityBoxes,
            pillsPerBox,
            dosageStrength,
            productType,
        } = data;

        // 1. Resolve manufacturer
        const manufacturer = await prisma.manufacturer.findUnique({
            where: { userId },
        });
        if (!manufacturer) throw new ApiError(404, "Manufacturer profile not found.");

        if (manufacturer.isSuspended) {
            throw new ApiError(
                403,
                "Your company has been suspended by DRAP due to a compliance concern. Please contact DRAP for reinstatement before generating QR codes."
            );
        }

        if (!manufacturer.isVerified) {
            throw new ApiError(
                403,
                "Your company profile and DRAP License must be completed and approved before you can register batches or generate QR codes. Please complete your profile details and ensure your DRAP License is approved."
            );
        }

        // 2. Business validations
        if (quantityBoxes < 1) throw new ApiError(400, "Quantity of boxes must be at least 1.");
        if (pillsPerBox < 1) throw new ApiError(400, "Pills per box must be at least 1.");

        const expiry = new Date(expiryDate);
        if (isNaN(expiry.getTime())) throw new ApiError(400, "Invalid expiry date format.");
        if (expiry <= new Date()) throw new ApiError(400, "Expiry date must be in the future.");

        const mfgDate = new Date(manufacturingDate);
        if (isNaN(mfgDate.getTime())) throw new ApiError(400, "Invalid manufacturing date format.");
        if (mfgDate > new Date()) throw new ApiError(400, "Manufacturing date cannot be in the future.");

        // 3. Auto-generate batch number if blank
        const finalBatchNumber =
            batchNumber && batchNumber.trim()
                ? batchNumber.trim()
                : `BAT-${Date.now().toString(36).toUpperCase()}`;

        // 4. Locate or create Medicine (scoped to this manufacturer)
        let medicine = await prisma.medicine.findFirst({
            where: { name: medicineName, manufacturerId: manufacturer.id },
        });

        if (!medicine) {
            medicine = await prisma.medicine.create({
                data: {
                    name: medicineName,
                    genericName: genericName ?? null,
                    category: category ?? null,
                    dosage: dosage ?? null,
                    description: description ?? null,
                    manufacturerId: manufacturer.id,
                },
            });
        } else if (genericName || category || dosage || description) {
            // Update medicine metadata if caller supplied richer data
            medicine = await prisma.medicine.update({
                where: { id: medicine.id },
                data: {
                    genericName: genericName ?? medicine.genericName,
                    category: category ?? medicine.category,
                    dosage: dosage ?? medicine.dosage,
                    description: description ?? medicine.description,
                },
            });
        }

        // 5. Check existing batch / extension logic
        const existingBatch = await prisma.batch.findUnique({
            where: { batchNumber: finalBatchNumber },
            include: { medicine: true },
        });

        const isExtension = !!existingBatch;

        if (isExtension) {
            // Hardening: Enforce strict uniqueness. A batch code can only ever belong to ONE medicine.
            // It can only be reused for the SAME medicine if the extension flow is explicitly triggered.
            if (existingBatch.medicineId !== medicine.id || !data.allowsExtension) {
                throw new ApiError(400, "This batch code is already registered");
            }
        }

        // 6. QR code identities
        const companyCode = manufacturer.companyCode || (manufacturer.companyName.substring(0, 3)).toUpperCase();
        const boxQRCode = QRService.formatBoxCode(finalBatchNumber, companyCode);
        const newPillsCount = quantityBoxes * pillsPerBox;
        const finalTotalPills = isExtension
            ? existingBatch!.totalPillsGenerated + newPillsCount
            : newPillsCount;

        if (finalTotalPills > 100_000) {
            throw new ApiError(400, "Cumulative batch size exceeds system limit (100,000 pills).");
        }

        // 6b. Hierarchical validation
        if (data.totalCartons && data.totalCartons > data.quantityBoxes) {
            throw new ApiError(400, "Total Cartons cannot exceed total Boxes.");
        }
        if (data.totalCartons && data.totalCartons < 1) {
            throw new ApiError(400, "Total Cartons must be at least 1.");
        }

        // 7. Atomic transaction — 3-level hierarchy (Carton -> Box -> Pill)
        const result = await prisma.$transaction(
            async (tx) => {
                const cartons: any[] = [];
                const boxes: any[] = [];

                const batch = isExtension
                    ? await tx.batch.update({
                        where: { id: existingBatch.id },
                        data: {
                            quantityBoxes: existingBatch.quantityBoxes + quantityBoxes,
                            totalPillsGenerated: existingBatch.totalPillsGenerated + newPillsCount,
                        },
                        include: { medicine: { include: { manufacturer: true } } },
                    })
                    : await tx.batch.create({
                        data: {
                            medicineId: medicine!.id,
                            batchNumber: finalBatchNumber,
                            manufacturingDate: mfgDate,
                            expiryDate: expiry,
                            quantityBoxes,
                            pillsPerBox,
                            // We store the base density for reference, though distribution is now variable
                            boxesPerCarton: Math.floor(quantityBoxes / (data.totalCartons ?? 10)),
                            totalPillsGenerated: newPillsCount,
                            boxQRCode, // Legacy/Batch-wide QR ref
                            dosageStrength: dosageStrength ?? dosage ?? null,
                            category: category ?? null,
                            productType: productType ?? null,
                            status: "ACTIVE",
                            medicineStatus: "MANUFACTURED",
                            blockchainStatus: "PENDING",
                        },
                        include: { medicine: { include: { manufacturer: true } } },
                    });

                const totalBoxes = quantityBoxes;
                const numCartons = data.totalCartons ?? Math.max(1, Math.ceil(totalBoxes / 10));
                const baseBoxesPerCarton = Math.floor(totalBoxes / numCartons);
                const cartonsWithExtra = totalBoxes % numCartons;

                const existingCartonCount = isExtension
                    ? await tx.carton.count({ where: { batchId: existingBatch.id } })
                    : 0;
                const existingBoxCount = isExtension
                    ? await tx.box.count({ where: { batchId: existingBatch.id } })
                    : 0;

                let globalBoxCounter = existingBoxCount;

                for (let c = 1; c <= numCartons; c++) {
                    const boxesInThisCarton = c <= cartonsWithExtra ? baseBoxesPerCarton + 1 : baseBoxesPerCarton;

                    if (boxesInThisCarton === 0) continue; // Safety check

                    const cartonCode = this.formatCartonCode(finalBatchNumber, existingCartonCount + c, companyCode);
                    const carton = await tx.carton.create({
                        data: {
                            batchId: batch.id,
                            cartonNumber: cartonCode,
                            qrCode: cartonCode,
                            boxesCount: boxesInThisCarton,
                            status: "ACTIVE"
                        }
                    });
                    cartons.push(carton);

                    for (let b = 1; b <= boxesInThisCarton; b++) {
                        globalBoxCounter++;
                        const boxCode = this.formatBoxCode(
                            finalBatchNumber,
                            existingCartonCount + c,
                            b,
                            companyCode
                        );
                        const box = await tx.box.create({
                            data: {
                                batchId: batch.id,
                                cartonId: carton.id,
                                boxNumber: boxCode,
                                qrCode: boxCode,
                                pillsCount: pillsPerBox,
                                status: "ACTIVE"
                            }
                        });
                        boxes.push(box);

                        const pillsData = [];
                        for (let p = 1; p <= pillsPerBox; p++) {
                            const globalPillIndex = (globalBoxCounter - 1) * pillsPerBox + p;
                            const pillCode = this.formatPillCode(
                                finalBatchNumber,
                                existingCartonCount + c,
                                b,
                                globalPillIndex,
                                companyCode
                            );
                            pillsData.push({
                                batchId: batch.id,
                                boxId: box.id,
                                pillNumber: globalPillIndex.toString().padStart(4, "0"),
                                serialNumber: `SN-${finalBatchNumber}-${globalPillIndex.toString().padStart(4, "0")}`,
                                qrCode: pillCode,
                                status: "ACTIVE",
                                verificationStatus: "UNVERIFIED",
                                qrScanned: false
                            });
                        }
                        await tx.pill.createMany({ data: pillsData, skipDuplicates: true });
                    }
                }

                // Safety verification
                if (globalBoxCounter !== (existingBoxCount + totalBoxes)) {
                    console.warn(`[BatchService] Box count mismatch: expected ${existingBoxCount + totalBoxes}, generated ${globalBoxCounter}`);
                }

                await tx.batch.update({
                    where: { id: batch.id },
                    data: { totalPillsGenerated: globalBoxCounter * pillsPerBox }
                });

                // ── QR ASSET STORAGE (Root Asset) ──────────────────────────
                if (!isExtension) {
                    const boxQrBuffer = await QRService.generatePNGBuffer(boxQRCode, 800);
                    const boxQrPath = await QRService.saveAsset(batch.id, "box.png", boxQrBuffer);

                    await tx.qRAsset.create({
                        data: {
                            batchId: batch.id,
                            type: "BOX_QR",
                            fileUrl: boxQrPath,
                            metadata: JSON.stringify({ width: 800, height: 800 }),
                        },
                    });
                }

                const createdPills = await tx.pill.findMany({
                    where: {
                        batchId: batch.id,
                        boxId: { in: boxes.map(b => b.id) }
                    },
                    orderBy: {
                        pillNumber: "asc"
                    },
                    take: 5000 // Cap to prevent memory/payload overload on large batches
                });

                const pillsFormatted = createdPills.map(p => ({
                    id: p.id,
                    medicineId: batch.medicineId,
                    pillNumber: p.pillNumber,
                    pillQrCode: p.qrCode,
                    qrScanned: p.qrScanned,
                    qrScannedAt: p.scannedAt ? p.scannedAt.toISOString() : null,
                    qrScannedLocation: p.scannedLocation || null,
                    blockchainTx: p.blockchainTx || null,
                    qrPrinted: false,
                    qrStatus: p.status.toLowerCase() as "active" | "suspected" | "invalidated",
                    createdAt: p.createdAt.toISOString()
                }));

                return {
                    batch: { ...batch, cartons, boxes },
                    pills: pillsFormatted,
                    startPillIndex: (existingBoxCount * pillsPerBox) + 1,
                    newPillsCount: totalBoxes * pillsPerBox
                };
            },
            { timeout: 900000 }
        );

        // 8. Audit logs
        void AuditLogService.log({
            manufacturerId: manufacturer.id,
            batchId: result.batch.id,
            action: isExtension ? "QR_GENERATED" : "BATCH_CREATED",
            metadata: {
                batchNumber: finalBatchNumber,
                pillsGenerated: result.newPillsCount,
                totalPillsAfter: result.batch.totalPillsGenerated,
            },
            ...requestMeta,
        });

        void AuditLogService.log({
            manufacturerId: manufacturer.id,
            batchId: result.batch.id,
            action: "QR_GENERATED",
            metadata: {
                boxQRCode: result.batch.boxQRCode,
                pillsGenerated: result.newPillsCount,
                startIndex: result.startPillIndex,
            },
            ...requestMeta,
        });

        // ─── 9. Enqueue blockchain anchoring jobs ──────────────────────────────────
        // Fire-and-forget: a queue failure must NEVER roll back the batch.
        // The worker (via /api/internal/process-blockchain-queue) will pick these up.
        void enqueueBlockchainJobs(result.batch, result.pills);

        return result;
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    static async getManufacturerBatches(userId: string) {
        const batches = await prisma.batch.findMany({
            where: {
                medicine: { manufacturer: { userId } },
            },
            include: {
                medicine: { include: { manufacturer: true } },
                _count: { select: { pills: true, cartons: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return batches.map(b => this.decorateBatchStatus(b));
    }

    static async getBatchDetails(
        userId: string,
        batchId: string,
        options: { allPills?: boolean } = {}
    ) {
        const batch = await prisma.batch.findFirst({
            where: { id: batchId, medicine: { manufacturer: { userId } } },
            include: {
                medicine: { include: { manufacturer: true } },
                pills: options.allPills ? true : { take: 50 },
                qrAssets: { orderBy: { createdAt: "desc" } },
                cartons: { orderBy: { createdAt: "asc" } },
                _count: { select: { pills: true, cartons: true } },
                boxes: true,
            },
        });

        if (!batch) throw new ApiError(404, "Batch not found or unauthorized.");
        return this.decorateBatchStatus(batch);
    }

    static async getManufacturerMedicines(userId: string) {
        const manufacturer = await prisma.manufacturer.findUnique({ where: { userId } });
        if (!manufacturer) throw new ApiError(404, "Manufacturer profile not found.");

        return prisma.medicine.findMany({
            where: { manufacturerId: manufacturer.id },
            include: {
                _count: { select: { batches: true } },
                batches: {
                    select: {
                        id: true,
                        batchNumber: true,
                        status: true,
                        totalPillsGenerated: true,
                        expiryDate: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    /**
     * Aggregated stats for the manufacturer dashboard overview.
     */
    static async getDashboardStats(userId: string): Promise<DashboardStats> {
        const manufacturer = await prisma.manufacturer.findUnique({ where: { userId } });
        if (!manufacturer) throw new ApiError(404, "Manufacturer profile not found.");

        const mId = manufacturer.id;
        const now = new Date();

        const [totalMedicines, batches] = await Promise.all([
            prisma.medicine.count({ where: { manufacturerId: mId } }),
            prisma.batch.findMany({
                where: { medicine: { manufacturerId: mId } },
                select: {
                    id: true,
                    status: true,
                    isRecalled: true,
                    expiryDate: true,
                    totalPillsGenerated: true,
                },
            }),
        ]);

        const totalBatches = batches.length;
        const totalPillsGenerated = batches.reduce(
            (sum, b) => sum + b.totalPillsGenerated,
            0
        );

        // Auto-status logic for counts
        const decorated = batches.map(b => ({
            ...b,
            status: (new Date(b.expiryDate) <= now && b.status !== "RECALLED") ? "EXPIRED" : b.status
        }));

        const activeBatches = decorated.filter(b => b.status === "ACTIVE" || b.status === "MANUFACTURED").length;
        const expiredBatches = decorated.filter(b => b.status === "EXPIRED").length;
        const recalledBatches = decorated.filter(b => b.isRecalled || b.status === "RECALLED").length;

        // Extended metrics
        const exportLogs = await prisma.exportAnalytics.findMany({
            where: { manufacturerId: mId },
            orderBy: { timestamp: "desc" },
        });

        return {
            totalMedicines,
            totalBatches,
            totalPillsGenerated,
            activeBatches,
            expiredBatches,
            recalledBatches,
            totalBoxQRGenerated: totalBatches,
            totalPillQRGenerated: totalPillsGenerated,
            totalPDFExports: exportLogs.filter(e => e.exportType === "PDF").length,
            totalZIPExports: exportLogs.filter(e => e.exportType === "ZIP").length,
            lastExportDate: exportLogs[0]?.timestamp.toISOString() || null,
        };
    }

    /**
     * Record export audit events for PDF / ZIP downloads.
     */
    static async recordExportAudit(
        userId: string,
        batchId: string,
        exportType: "PDF_EXPORTED" | "ZIP_EXPORTED",
        requestMeta?: { ipAddress?: string; userAgent?: string }
    ): Promise<void> {
        const manufacturer = await prisma.manufacturer.findUnique({ where: { userId } });
        if (!manufacturer) return;

        // 1. Audit Log (Backward compat)
        void AuditLogService.log({
            manufacturerId: manufacturer.id,
            batchId,
            action: exportType,
            metadata: { exportedAt: new Date().toISOString() },
            ...requestMeta,
        });

        // 2. Export Analytics (New Hardening requirement)
        await prisma.exportAnalytics.create({
            data: {
                manufacturerId: manufacturer.id,
                batchId,
                exportType: exportType === "PDF_EXPORTED" ? "PDF" : "ZIP",
                exportedBy: userId,
            }
        }).catch(err => console.error("[ExportAnalytics] Failed:", err));
    }

    /**
     * Helper to automatically expose EXPIRED status for batches.
     */
    private static decorateBatchStatus(batch: any) {
        if (!batch) return batch;
        const now = new Date();
        const expiry = new Date(batch.expiryDate);

        if (expiry < now && batch.status !== "RECALLED") {
            return { ...batch, status: "EXPIRED" };
        }
        return batch;
    }
}
