import { prisma } from "../db/client";
import { VerificationStatus } from "@prisma/client";
import { BlockchainService } from "./blockchain/blockchain.service";
import { RealtimeService } from "./realtime/realtime.service";
import { AIService } from "./ai/ai.service";
import { FraudEngine } from "./fraud/fraud-engine";
import { logVerificationAnchorError } from "./blockchain/blockchain.queue";
import { isImpossibleTravel } from "./geo-anomaly.util";

export interface VerificationRequest {
    code: string;
    location?: string;
    resolvedLocation?: string;
    lat?: number;
    lng?: number;
    deviceInfo?: string;
    userId?: string;
}

export interface VerificationResponse {
    success: boolean;
    resultType: "GENUINE" | "FAKE" | "SUSPICIOUS" | "DUPLICATE" | "EXPIRED" | "RECALLED" | "UNVERIFIED";
    medicine?: any;
    manufacturer?: any;
    batch?: any;
    pill?: any;
    verification: {
        id: string;
        scanTime: Date;
        scanLocation: string;
        deviceInfo: string;
        blockchainStatus: string;
    };
    blockchain: {
        txHash: string | null;
        status: string;
        verifiedOnChain: boolean;
    };
    warnings: string[];
    riskScore: number;
    message: string;
    // Optional Supply Chain Info
    supplyChain?: { boxNumber: string; pharmacyName: string | null; verifiedBy: string };
    pillInfo?: { pillNumber: string; boxNumber: string | null; sequencePosition: string };
    cartonInfo?: { cartonNumber: string; boxesCount: number; boxNumbers: string[] };
    priorScanInfo?: { scannerRole: string | null; scannerName: string | null; location: string | null; scannedAt: string } | null;
}


export class VerificationEngine {
    // ═══════════════════════════════════
    // Helper — non-blocking anchor with structured error logging
    // ═══════════════════════════════════
    private static anchorWithLogging(
        verificationLogId: string,
        pillQR: string,
        location: string,
        status: string
    ): void {
        BlockchainService.isPillRegistered(pillQR)
            .then((isRegistered) => {
                if (!isRegistered) {
                    const msg = "PENDING_ANCHOR: Pill not yet registered on-chain.";
                    console.warn(`[BLOCKCHAIN] anchorVerification skipped (PENDING_ANCHOR) pill=${pillQR}: ${msg}`);
                    // Log directly to blockchain_job table for admin visibility with isPendingAnchor = true
                    void logVerificationAnchorError(verificationLogId, pillQR, msg, true);
                    return;
                }

                // Proceed with gas-spending transaction only if registered
                BlockchainService.anchorVerification(pillQR, location, status)
                    .then((txHash) => {
                        if (txHash) {
                            console.log(`[BLOCKCHAIN] Verification anchored: ${txHash} (pill=${pillQR})`);
                        }
                    })
                    .catch((err: any) => {
                        const msg: string = err?.message ?? String(err);
                        console.error(`[BLOCKCHAIN] anchorVerification failed (RPC_ERROR) pill=${pillQR}: ${msg}`);
                        void logVerificationAnchorError(verificationLogId, pillQR, msg, false);
                    });
            })
            .catch((err: any) => {
                const msg = err?.message ?? String(err);
                console.error(`[BLOCKCHAIN] isPillRegistered check failed: ${msg}`);
                void logVerificationAnchorError(verificationLogId, pillQR, `Pre-check failed: ${msg}`, false);
            });
    }

    // ═══════════════════════════════════
    // PART 1 — Routing
    // ═══════════════════════════════════
    static async verify(req: VerificationRequest): Promise<VerificationResponse> {
        const type = this.classifyCodeType(req.code);
        if (type === "CARTON") return this.verifyCarton(req);
        if (type === "BOX") return this.verifyBox(req);
        if (type === "PILL") return this.verifyPill(req);
        return this.verifyBatchNumber(req);
    }

    private static classifyCodeType(code: string): "CARTON" | "BOX" | "PILL" | "BATCH" {
        // ── LEGACY FORMAT (pre-hierarchical): fixed prefix routing ───────────
        // Codes generated before the hierarchical QR change use a plain
        // "TYPE-..." prefix and must continue to be routed correctly.
        if (code.startsWith("CARTON-")) {
            return "CARTON";
        } else if (code.startsWith("BOX-")) {
            return "BOX";
        } else if (code.startsWith("PILL-")) {
            return "PILL";
        }

        // ── NEW HIERARCHICAL FORMAT: suffix-pattern routing ──────────────────
        // New codes follow: {companyCode}-{batchNumber}-C{n}[-B{n}[-P{n}]]
        // We identify the type by what the code ends with, working from most
        // specific (Pill has all 3 levels) to least specific (Carton has 1).
        //
        //   Pill:   ends with -P<digits>  AND contains -B<digits>- AND -C<digits>-
        //   Box:    ends with -B<digits>  AND contains -C<digits>-  (no trailing -P)
        //   Carton: ends with -C<digits>  (no trailing -B or -P)

        // Pill: …-C{n}-B{n}-P{n}
        if (/(-C\d+-B\d+-P\d+)$/.test(code)) {
            return "PILL";
        }

        // Box: …-C{n}-B{n}
        if (/(-C\d+-B\d+)$/.test(code)) {
            return "BOX";
        }

        // Carton: …-C{n}
        if (/-C\d+$/.test(code)) {
            return "CARTON";
        }

        return "BATCH";
    }

    // ═══════════════════════════════════
    // PART 2 — Anomaly Detection & Batch Verification
    // ═══════════════════════════════════
    private static async isAnomalous(batchNumber: string): Promise<{ anomalous: boolean; reason: string; severity: "HIGH" | "MEDIUM" }> {
        const parts = batchNumber.split("-");
        if (parts.length !== 3) {
            return { anomalous: true, reason: "Invalid batch number format.", severity: "HIGH" };
        }

        const year = parseInt(parts[1]);
        const num = parseInt(parts[2]);

        if (isNaN(year) || isNaN(num)) {
            return { anomalous: true, reason: "Invalid batch number format.", severity: "HIGH" };
        }

        const currentYear = new Date().getFullYear();

        if (year > currentYear) {
            return { anomalous: true, reason: "Batch year " + year + " is in the future.", severity: "HIGH" };
        }

        if (num > 5000) {
            return { anomalous: true, reason: "Batch sequence number " + num + " is far outside the normal manufacturing range.", severity: "HIGH" };
        }

        if (num === 0) {
            return { anomalous: true, reason: "Batch sequence number cannot be zero.", severity: "HIGH" };
        }

        if (year < currentYear - 6) {
            return { anomalous: true, reason: "Batch year " + year + " is unusually old.", severity: "MEDIUM" };
        }

        // ── DRAP Intelligence Layer: check admin-entered BatchSequence ranges ──
        const [prefix, , numStr] = parts;
        const seqNum = parseInt(numStr, 10);

        const knownSequence = await prisma.batchSequence.findFirst({
            where: { prefix: prefix.toUpperCase(), year }
        });

        if (knownSequence) {
            if (seqNum > knownSequence.maxSequence) {
                return {
                    anomalous: true,
                    reason: `Batch sequence ${seqNum} exceeds known maximum of ${knownSequence.maxSequence} for ${prefix}-${year} (${knownSequence.confidence} confidence data).`,
                    severity: knownSequence.confidence === "HIGH" ? "HIGH" : "MEDIUM"
                };
            }
            if (seqNum < knownSequence.minSequence) {
                return {
                    anomalous: true,
                    reason: `Batch sequence ${seqNum} is below minimum of ${knownSequence.minSequence} for ${prefix}-${year}.`,
                    severity: "MEDIUM"
                };
            }
            // Sequence is within known valid range — high-confidence genuine
            return { anomalous: false, reason: "Sequence validated against DRAP intelligence database.", severity: "HIGH" };
        }

        // No BatchSequence data found — fall through to math-only result
        return { anomalous: false, reason: "", severity: "MEDIUM" };
    }

    private static async verifyBatchNumber(req: VerificationRequest): Promise<VerificationResponse> {
        const check = await this.isAnomalous(req.code);

        if (check.anomalous && check.severity === "HIGH") {
            return this.handleFakeResult(req, "FAKE DETECTED: " + check.reason);
        }

        // ── STEP 1: DRAP Recall check (admin-entered recall alerts) ──────────────
        const recallCheck = await prisma.dRAPRecall.findFirst({
            where: {
                isActive: true,
                OR: [
                    { batchNumber: req.code },
                    { medicineName: { contains: req.code.split("-")[0] } }
                ]
            }
        });

        if (recallCheck) {
            return {
                ...this.handleFakeResult(req, `RECALLED: ${recallCheck.medicineName} — ${recallCheck.reason}. Severity: ${recallCheck.severity}. DRAP Ref: ${recallCheck.drapRef ?? "N/A"}`),
                resultType: "RECALLED",
                warnings: ["This medicine has been officially recalled by DRAP. Do NOT consume. Return to pharmacy immediately."]
            };
        }

        // ── STEP 2: Look up batch in SafeDose blockchain ledger ────────────────
        const batch = await prisma.batch.findUnique({
            where: { batchNumber: req.code },
            include: { medicine: { include: { manufacturer: true } } }
        });

        if (!batch) {
            // ── STEP 3: Anomaly gate (format / sequence violations) ───────────────
            // Run this before the registry lookup — a structurally impossible code
            // cannot be in any legitimate registry, so fail fast.
            if (check.anomalous) {
                return this.handleFakeResult(req, "SUSPICIOUS: " + check.reason + " Additionally, this batch was not found in the SafeDose database.");
            }

            // ── STEP 4: Exact batch-code lookup in DrapBatchRegistry ─────────────
            // This registry holds specific, admin-confirmed batch codes for DRAP-
            // entered legacy medicines (uploaded via CSV bulk-upload).
            const drapBatch = await prisma.drapBatchRegistry.findUnique({
                where: { batchCode: req.code },
                include: { medicine: true },
            });

            if (drapBatch) {
                // Check for any prior scan of this exact batch code (most recent scan)
                const priorScan = await prisma.drapBatchScanLog.findFirst({
                    where: { drapBatchId: drapBatch.id },
                    orderBy: { scannedAt: "desc" },
                });

                // Determine active location string (real IP GeoIP location preferred, falling back to channel location)
                const activeLocation = req.resolvedLocation && req.resolvedLocation !== "Unknown Location"
                    ? req.resolvedLocation
                    : (req.location || "Unknown Location");

                // Determine actor role and display name
                let scannerRole: string = "GUEST";
                let scannerName: string = "Guest User";
                if (req.userId) {
                    const user = await prisma.user.findUnique({
                        where: { id: req.userId },
                        include: { pharmacy: true }
                    });
                    if (user) {
                        scannerRole = user.role;
                        if (user.role === "PHARMACY") {
                            scannerName = user.pharmacy?.name ?? "Pharmacy User";
                        } else if (user.role === "PATIENT") {
                            scannerName = "Patient";
                        } else {
                            scannerName = user.name ?? user.role;
                        }
                    }
                }

                // Geo-anomaly check (impossible travel detection under 60 mins)
                const geoCheck = isImpossibleTravel(
                    priorScan ? { location: priorScan.location, timestamp: priorScan.scannedAt } : null,
                    activeLocation,
                    new Date(),
                    60
                );

                const warnings: string[] = [];
                if (geoCheck.isAnomaly) {
                    warnings.push(geoCheck.message);
                }

                // Log this scan — fire-and-forget, never blocks the result.
                prisma.drapBatchScanLog.create({
                    data: {
                        drapBatchId: drapBatch.id,
                        scannedByUserId: req.userId ?? null,
                        location: activeLocation,
                        scannerRole,
                        scannerName,
                    },
                }).catch(console.error);

                // Log to the standard verification audit trail.
                const log = await this.logVerification(req, "GENUINE", drapBatch.medicineId, null);

                // Side-effects (non-blocking).
                this.anchorWithLogging(log.id, req.code, activeLocation, "GENUINE");
                RealtimeService.broadcastVerification({ ...log, status: "GENUINE" } as any);
                if (req.location) AIService.predictFraudOutbreak(req.location).catch(console.error);
                void FraudEngine.analyzeScan(req.code, activeLocation, { deviceInfo: req.deviceInfo, userId: req.userId }).catch((err) => console.error("[FRAUD_ENGINE] Analysis failed:", err));

                const drapManufacturer = {
                    companyName: drapBatch.companyName ?? drapBatch.medicine.manufacturer_name ?? "Not provided",
                    licenseNumber: null,
                    address: null,
                    businessPhone: null,
                    businessEmail: null,
                };

                let message: string;
                if (priorScan) {
                    const formattedTime = new Date(priorScan.scannedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true
                    });
                    const whoStr = priorScan.scannerName
                        ? `${priorScan.scannerName} (${priorScan.scannerRole ?? "User"})`
                        : (priorScan.scannerRole ?? "a user");
                    const locStr = priorScan.location ?? "Unknown Location";
                    message = `This batch was previously scanned by ${whoStr} in ${locStr} on ${formattedTime}. This is expected — the same batch code can appear on multiple genuine units.`;
                } else {
                    message = `${drapBatch.medicine.name} — DRAP-confirmed batch. This is a genuine, registered product.`;
                }

                const priorScanInfo = priorScan
                    ? {
                        scannerRole: priorScan.scannerRole,
                        scannerName: priorScan.scannerName,
                        location: priorScan.location,
                        scannedAt: new Date(priorScan.scannedAt).toISOString(),
                    }
                    : null;

                return {
                    success: true,
                    resultType: "GENUINE",
                    medicine: drapBatch.medicine,
                    manufacturer: drapManufacturer,
                    batch: null,
                    pill: null,
                    verification: {
                        id: log.id,
                        scanTime: log.createdAt,
                        scanLocation: activeLocation,
                        deviceInfo: req.deviceInfo || "Web",
                        blockchainStatus: "NOT_APPLICABLE",
                    },
                    blockchain: { txHash: null, status: "NOT_APPLICABLE", verifiedOnChain: false },
                    warnings,
                    riskScore: geoCheck.isAnomaly ? 60 : 10,
                    message,
                    priorScanInfo,
                };
            }


            // ── STEP 5: Not in registry, not in SafeDose — definitive FAKE ─────
            return this.handleFakeResult(
                req,
                "This batch code was not found in DRAP's confirmed registry or the SafeDose database. This product cannot be verified — contact DRAP at 0800-22222."
            );
        }


        const now = new Date();
        const isExpired = batch.expiryDate < now;
        const isRecalled = batch.isRecalled;

        const scanCount = await prisma.verificationLog.count({
            where: { code: req.code }
        });

        const riskLevel = this.calculateRisk(scanCount, req);
        const resultType = isExpired ? "EXPIRED" : (isRecalled || riskLevel.score > 70) ? "SUSPICIOUS" : scanCount > 0 ? "DUPLICATE" : "GENUINE";

        const log = await this.logVerification(req, resultType, batch.medicineId, null);

        // Side-effects
        this.anchorWithLogging(log.id, req.code, req.location || "Unknown", resultType);
        RealtimeService.broadcastVerification({ ...log, status: resultType } as any);
        if (req.location) AIService.predictFraudOutbreak(req.location).catch(console.error);
        void FraudEngine.analyzeScan(req.code, req.location || "Unknown", { deviceInfo: req.deviceInfo, userId: req.userId }).catch((err) => console.error("[FRAUD_ENGINE] Analysis failed:", err));

        return {
            success: true,
            resultType,
            medicine: batch.medicine,
            manufacturer: batch.medicine.manufacturer,
            batch: {
                batchNumber: batch.batchNumber,
                expiry: batch.expiryDate,
                status: batch.medicineStatus,
                category: batch.category
            },
            verification: {
                id: log.id,
                scanTime: log.createdAt,
                scanLocation: req.location || "Unknown",
                deviceInfo: req.deviceInfo || "Web Browser",
                blockchainStatus: batch.blockchainStatus
            },
            blockchain: {
                txHash: batch.txHash,
                status: batch.blockchainStatus,
                verifiedOnChain: !!batch.txHash
            },
            warnings: this.generateWarnings(resultType, isRecalled, isExpired, riskLevel.score),
            riskScore: riskLevel.score,
            message: this.generateMessage(resultType, batch.medicine.name)
        };
    }

    // ═══════════════════════════════════
    // PART 3 — verifyCarton (NEW)
    // ═══════════════════════════════════
    private static async verifyCarton(req: VerificationRequest): Promise<VerificationResponse> {
        const carton = await prisma.carton.findUnique({
            where: { qrCode: req.code },
            include: {
                batch: { include: { medicine: { include: { manufacturer: true } } } },
                boxes: true
            }
        });

        if (!carton) {
            return this.handleFakeResult(req, "Carton QR code not found in SafeDose database.");
        }

        if (carton.scannedAt) {
            // Genuine product that has already been scanned — return DUPLICATE with full context,
            // NOT a FAKE result, so the patient sees real manufacturer/medicine info.
            const dupLog = await this.logVerification(req, "DUPLICATE", carton.batch.medicineId, null);
            this.anchorWithLogging(dupLog.id, req.code, req.location || "Unknown", "DUPLICATE");
            RealtimeService.broadcastVerification({ ...dupLog, status: "DUPLICATE" } as any);
            return {
                success: true,
                resultType: "DUPLICATE",
                medicine: carton.batch.medicine,
                manufacturer: carton.batch.medicine.manufacturer,
                batch: carton.batch,
                verification: {
                    id: dupLog.id,
                    scanTime: dupLog.createdAt,
                    scanLocation: req.location || "Unknown",
                    deviceInfo: req.deviceInfo || "Web Browser",
                    blockchainStatus: carton.batch.blockchainStatus
                },
                blockchain: {
                    txHash: carton.batch.txHash,
                    status: carton.batch.blockchainStatus,
                    verifiedOnChain: !!carton.batch.txHash
                },
                warnings: ["POTENTIAL_PACKAGING_REUSE"],
                riskScore: 40,
                message: "DUPLICATE: This carton was already scanned on " + carton.scannedAt.toISOString() + ".",
                cartonInfo: {
                    cartonNumber: carton.cartonNumber,
                    boxesCount: carton.boxesCount,
                    boxNumbers: carton.boxes.map(b => b.boxNumber)
                }
            };
        }

        await prisma.carton.update({
            where: { id: carton.id },
            data: {
                scannedAt: new Date(),
                scannedLocation: req.location || "Unknown",
                scannedByUserId: req.userId ?? null
            }
        });

        const isExpired = carton.batch.expiryDate < new Date();
        const isRecalled = carton.batch.isRecalled;
        const resultType = isExpired ? "EXPIRED" : isRecalled ? "SUSPICIOUS" : "GENUINE";

        const log = await this.logVerification(req, resultType, carton.batch.medicineId, null);

        // Side-effects
        this.anchorWithLogging(log.id, req.code, req.location || "Unknown", resultType);
        RealtimeService.broadcastVerification({ ...log, status: resultType } as any);
        if (req.location) AIService.predictFraudOutbreak(req.location).catch(console.error);
        void FraudEngine.analyzeScan(req.code, req.location || "Unknown", { deviceInfo: req.deviceInfo, userId: req.userId }).catch((err) => console.error("[FRAUD_ENGINE] Analysis failed:", err));

        return {
            success: true,
            resultType,
            medicine: carton.batch.medicine,
            manufacturer: carton.batch.medicine.manufacturer,
            batch: carton.batch,
            verification: {
                id: log.id,
                scanTime: log.createdAt,
                scanLocation: req.location || "Unknown",
                deviceInfo: req.deviceInfo || "Web Browser",
                blockchainStatus: carton.batch.blockchainStatus
            },
            blockchain: {
                txHash: carton.batch.txHash,
                status: carton.batch.blockchainStatus,
                verifiedOnChain: !!carton.batch.txHash
            },
            warnings: this.generateWarnings(resultType, isRecalled, isExpired, 0),
            riskScore: 0,
            message: this.generateMessage(resultType, carton.batch.medicine.name),
            cartonInfo: {
                cartonNumber: carton.cartonNumber,
                boxesCount: carton.boxesCount,
                boxNumbers: carton.boxes.map(b => b.boxNumber)
            }
        };
    }

    // ═══════════════════════════════════
    // PART 4 — verifyBox (REWRITE)
    // ═══════════════════════════════════
    private static async verifyBox(req: VerificationRequest): Promise<VerificationResponse> {
        const box = await prisma.box.findUnique({
            where: { qrCode: req.code },
            include: {
                batch: { include: { medicine: { include: { manufacturer: true } } } },
                pharmacy: true
            }
        });

        if (!box) {
            return this.handleFakeResult(req, "Box QR code not found in SafeDose database.");
        }

        const scanningUser = req.userId ? await prisma.user.findUnique({
            where: { id: req.userId },
            include: { pharmacy: true }
        }) : null;

        if (scanningUser?.role === "PHARMACY") {
            if (box.pharmacyScannedAt) {
                // Genuine product already pharmacy-scanned — return DUPLICATE with full context.
                const existingPharmacy = box.pharmacyId ? await prisma.pharmacy.findUnique({ where: { id: box.pharmacyId } }) : null;
                const dupMsg = "DUPLICATE: This box was already scanned by " + (existingPharmacy?.name ?? "another pharmacy") + " on " + box.pharmacyScannedAt.toISOString() + ". Cannot be re-verified by another pharmacy.";
                const dupLog = await this.logVerification(req, "DUPLICATE", box.batch.medicineId, null);
                this.anchorWithLogging(dupLog.id, req.code, req.location || "Unknown", "DUPLICATE");
                RealtimeService.broadcastVerification({ ...dupLog, status: "DUPLICATE" } as any);
                return {
                    success: true,
                    resultType: "DUPLICATE",
                    medicine: box.batch.medicine,
                    manufacturer: box.batch.medicine.manufacturer,
                    batch: box.batch,
                    verification: {
                        id: dupLog.id,
                        scanTime: dupLog.createdAt,
                        scanLocation: req.location || "Unknown",
                        deviceInfo: req.deviceInfo || "Web Browser",
                        blockchainStatus: box.batch.blockchainStatus
                    },
                    blockchain: {
                        txHash: box.batch.txHash,
                        status: box.batch.blockchainStatus,
                        verifiedOnChain: !!box.batch.txHash
                    },
                    warnings: ["POTENTIAL_PACKAGING_REUSE"],
                    riskScore: 40,
                    message: dupMsg,
                    supplyChain: {
                        boxNumber: box.boxNumber,
                        pharmacyName: existingPharmacy?.name ?? null,
                        verifiedBy: "PHARMACY"
                    }
                };
            }
            await prisma.box.update({
                where: { id: box.id },
                data: {
                    pharmacyScannedAt: new Date(),
                    pharmacyId: scanningUser.pharmacy?.id ?? null
                }
            });
        } else if (scanningUser?.role === "PATIENT" || !scanningUser) {
            if (!box.pharmacyScannedAt) {
                // Out-of-sequence scan: no pharmacy has checked this box into the supply chain yet.
                const seqMsg = "SUPPLY CHAIN WARNING: This box has not yet been checked in by any pharmacy. It should not be reaching a patient directly from the manufacturer. Verify the distribution channel before consuming.";
                const seqLog = await this.logVerification(req, "SUSPICIOUS", box.batch.medicineId, null);
                this.anchorWithLogging(seqLog.id, req.code, req.location || "Unknown", "SUSPICIOUS");
                RealtimeService.broadcastVerification({ ...seqLog, status: "SUSPICIOUS" } as any);
                return {
                    success: true,
                    resultType: "SUSPICIOUS",
                    medicine: box.batch.medicine,
                    manufacturer: box.batch.medicine.manufacturer,
                    batch: box.batch,
                    verification: {
                        id: seqLog.id,
                        scanTime: seqLog.createdAt,
                        scanLocation: req.location || "Unknown",
                        deviceInfo: req.deviceInfo || "Web Browser",
                        blockchainStatus: box.batch.blockchainStatus
                    },
                    blockchain: {
                        txHash: box.batch.txHash,
                        status: box.batch.blockchainStatus,
                        verifiedOnChain: !!box.batch.txHash
                    },
                    warnings: ["SUPPLY_CHAIN_SEQUENCE_SKIPPED"],
                    riskScore: 55,
                    message: seqMsg,
                    supplyChain: {
                        boxNumber: box.boxNumber,
                        pharmacyName: null,
                        verifiedBy: scanningUser?.role ?? "PUBLIC"
                    }
                };
            }

            if (box.patientScannedAt) {
                // Genuine product already patient-scanned — return DUPLICATE with full context.
                const dupMsg = "DUPLICATE: This box QR was already verified by a patient on " + box.patientScannedAt.toISOString() + ". If this is an unopened box, please report immediately.";
                const dupLog = await this.logVerification(req, "DUPLICATE", box.batch.medicineId, null);
                this.anchorWithLogging(dupLog.id, req.code, req.location || "Unknown", "DUPLICATE");
                RealtimeService.broadcastVerification({ ...dupLog, status: "DUPLICATE" } as any);
                return {
                    success: true,
                    resultType: "DUPLICATE",
                    medicine: box.batch.medicine,
                    manufacturer: box.batch.medicine.manufacturer,
                    batch: box.batch,
                    verification: {
                        id: dupLog.id,
                        scanTime: dupLog.createdAt,
                        scanLocation: req.location || "Unknown",
                        deviceInfo: req.deviceInfo || "Web Browser",
                        blockchainStatus: box.batch.blockchainStatus
                    },
                    blockchain: {
                        txHash: box.batch.txHash,
                        status: box.batch.blockchainStatus,
                        verifiedOnChain: !!box.batch.txHash
                    },
                    warnings: ["POTENTIAL_PACKAGING_REUSE"],
                    riskScore: 40,
                    message: dupMsg,
                    supplyChain: {
                        boxNumber: box.boxNumber,
                        pharmacyName: box.pharmacy?.name ?? null,
                        verifiedBy: "PATIENT"
                    }
                };
            }
            await prisma.box.update({
                where: { id: box.id },
                data: {
                    patientScannedAt: new Date(),
                    patientUserId: scanningUser?.id ?? null
                }
            });
        }

        const isExpired = box.batch.expiryDate < new Date();
        const isRecalled = box.batch.isRecalled;

        const scanCount = await prisma.verificationLog.count({ where: { code: req.code } });
        const riskLevel = this.calculateRisk(scanCount, req);
        const resultType = isExpired ? "EXPIRED" : (isRecalled || riskLevel.score > 70) ? "SUSPICIOUS" : "GENUINE";

        const log = await this.logVerification(req, resultType, box.batch.medicineId, null);

        // Side-effects
        this.anchorWithLogging(log.id, req.code, req.location || "Unknown", resultType);
        RealtimeService.broadcastVerification({ ...log, status: resultType } as any);
        if (req.location) AIService.predictFraudOutbreak(req.location).catch(console.error);
        void FraudEngine.analyzeScan(req.code, req.location || "Unknown", { deviceInfo: req.deviceInfo, userId: req.userId }).catch((err) => console.error("[FRAUD_ENGINE] Analysis failed:", err));

        const pharmacy = box.pharmacyId ? await prisma.pharmacy.findUnique({ where: { id: box.pharmacyId } }) : null;

        return {
            success: true,
            resultType,
            medicine: box.batch.medicine,
            manufacturer: box.batch.medicine.manufacturer,
            batch: box.batch,
            verification: {
                id: log.id,
                scanTime: log.createdAt,
                scanLocation: req.location || "Unknown",
                deviceInfo: req.deviceInfo || "Web Browser",
                blockchainStatus: box.batch.blockchainStatus
            },
            blockchain: {
                txHash: box.batch.txHash,
                status: box.batch.blockchainStatus,
                verifiedOnChain: !!box.batch.txHash
            },
            warnings: this.generateWarnings(resultType, isRecalled, isExpired, riskLevel.score),
            riskScore: riskLevel.score,
            message: this.generateMessage(resultType, box.batch.medicine.name),
            supplyChain: {
                boxNumber: box.boxNumber,
                pharmacyName: pharmacy?.name ?? null,
                verifiedBy: scanningUser?.role ?? "PUBLIC"
            }
        };
    }

    // ═══════════════════════════════════
    // PART 5 — verifyPill (REWRITE)
    // ═══════════════════════════════════
    private static async verifyPill(req: VerificationRequest): Promise<VerificationResponse> {
        const pill = await prisma.pill.findUnique({
            where: { qrCode: req.code },
            include: {
                batch: { include: { medicine: { include: { manufacturer: true } } } },
                box: true
            }
        });

        if (!pill) {
            return this.handleFakeResult(req, "Pill QR code not found in SafeDose database.");
        }

        const scanningUser = req.userId ? await prisma.user.findUnique({ where: { id: req.userId } }) : null;

        if (scanningUser?.role === "PHARMACY" || scanningUser?.role === "MANUFACTURER") {
            return this.handleFakeResult(req, "Pill-level QR codes can only be verified by patients, not " + scanningUser.role + " accounts.");
        }

        if (pill.box && !pill.box.pharmacyScannedAt) {
            // Out-of-sequence scan: the parent box was never checked in by a pharmacy.
            const seqMsg = "SUPPLY CHAIN WARNING: This pill's box has not yet been checked in by any pharmacy. It should not be reaching a patient directly from the manufacturer. Verify the distribution channel before consuming.";
            const seqLog = await this.logVerification(req, "SUSPICIOUS", pill.batch.medicineId, pill.id);
            this.anchorWithLogging(seqLog.id, req.code, req.location || "Unknown", "SUSPICIOUS");
            RealtimeService.broadcastVerification({ ...seqLog, status: "SUSPICIOUS" } as any);
            return {
                success: true,
                resultType: "SUSPICIOUS",
                medicine: pill.batch.medicine,
                manufacturer: pill.batch.medicine.manufacturer,
                batch: pill.batch,
                pill: { serialNumber: pill.pillNumber, status: pill.status },
                verification: {
                    id: seqLog.id,
                    scanTime: seqLog.createdAt,
                    scanLocation: req.location || "Unknown",
                    deviceInfo: req.deviceInfo || "Web Browser",
                    blockchainStatus: pill.batch.blockchainStatus
                },
                blockchain: {
                    txHash: pill.blockchainTx || pill.batch.txHash,
                    status: pill.batch.blockchainStatus,
                    verifiedOnChain: !!(pill.blockchainTx || pill.batch.txHash)
                },
                warnings: ["SUPPLY_CHAIN_SEQUENCE_SKIPPED"],
                riskScore: 55,
                message: seqMsg,
                pillInfo: {
                    pillNumber: pill.pillNumber,
                    boxNumber: pill.box?.boxNumber ?? null,
                    sequencePosition: "Pill " + pill.pillNumber + " from batch " + pill.batch.batchNumber
                }
            };
        }

        if (pill.qrScanned) {
            // Genuine product already scanned — return DUPLICATE with full context.
            const dupMsg = "DUPLICATE: This pill was already scanned on " + pill.scannedAt?.toISOString() + ". Each pill can only be verified once.";
            const dupLog = await this.logVerification(req, "DUPLICATE", pill.batch.medicineId, pill.id);
            this.anchorWithLogging(dupLog.id, req.code, req.location || "Unknown", "DUPLICATE");
            RealtimeService.broadcastVerification({ ...dupLog, status: "DUPLICATE" } as any);
            return {
                success: true,
                resultType: "DUPLICATE",
                medicine: pill.batch.medicine,
                manufacturer: pill.batch.medicine.manufacturer,
                batch: pill.batch,
                pill: {
                    serialNumber: pill.pillNumber,
                    status: pill.status
                },
                verification: {
                    id: dupLog.id,
                    scanTime: dupLog.createdAt,
                    scanLocation: req.location || "Unknown",
                    deviceInfo: req.deviceInfo || "Web Browser",
                    blockchainStatus: pill.batch.blockchainStatus
                },
                blockchain: {
                    txHash: pill.blockchainTx || pill.batch.txHash,
                    status: pill.batch.blockchainStatus,
                    verifiedOnChain: !!(pill.blockchainTx || pill.batch.txHash)
                },
                warnings: ["POTENTIAL_PACKAGING_REUSE"],
                riskScore: 40,
                message: dupMsg,
                pillInfo: {
                    pillNumber: pill.pillNumber,
                    boxNumber: pill.box?.boxNumber ?? null,
                    sequencePosition: "Pill " + pill.pillNumber + " from batch " + pill.batch.batchNumber
                }
            };
        }

        await prisma.pill.update({
            where: { id: pill.id },
            data: {
                qrScanned: true,
                scannedAt: new Date(),
                scannedLocation: req.location || "Unknown",
                verificationStatus: "VERIFIED"
            }
        });

        const isExpired = pill.batch.expiryDate < new Date();
        const isRecalled = pill.batch.isRecalled;
        const resultType = isExpired ? "EXPIRED" : isRecalled ? "SUSPICIOUS" : "GENUINE";

        const log = await this.logVerification(req, resultType, pill.batch.medicineId, pill.id);

        // Side-effects
        this.anchorWithLogging(log.id, req.code, req.location || "Unknown", resultType);
        RealtimeService.broadcastVerification({ ...log, status: resultType } as any);
        if (req.location) AIService.predictFraudOutbreak(req.location).catch(console.error);
        void FraudEngine.analyzeScan(req.code, req.location || "Unknown", { deviceInfo: req.deviceInfo, userId: req.userId }).catch((err) => console.error("[FRAUD_ENGINE] Analysis failed:", err));

        return {
            success: true,
            resultType,
            medicine: pill.batch.medicine,
            manufacturer: pill.batch.medicine.manufacturer,
            batch: pill.batch,
            pill: {
                serialNumber: pill.pillNumber,
                status: pill.status
            },
            verification: {
                id: log.id,
                scanTime: log.createdAt,
                scanLocation: req.location || "Unknown",
                deviceInfo: req.deviceInfo || "Web Browser",
                blockchainStatus: pill.batch.blockchainStatus
            },
            blockchain: {
                txHash: pill.blockchainTx || pill.batch.txHash,
                status: pill.batch.blockchainStatus,
                verifiedOnChain: !!(pill.blockchainTx || pill.batch.txHash)
            },
            warnings: this.generateWarnings(resultType, isRecalled, isExpired, 0),
            riskScore: 0,
            message: this.generateMessage(resultType, pill.batch.medicine.name, pill.pillNumber),
            pillInfo: {
                pillNumber: pill.pillNumber,
                boxNumber: pill.box?.boxNumber ?? null,
                sequencePosition: "Pill " + pill.pillNumber + " from batch " + pill.batch.batchNumber
            }
        };
    }

    // ═══════════════════════════════════
    // PART 6 — logVerification
    // ═══════════════════════════════════
    private static async logVerification(req: VerificationRequest, status: string, medicineId: string, pillId: string | null) {
        const statusMap: Record<string, VerificationStatus> = {
            GENUINE: "GENUINE",
            DUPLICATE: "DUPLICATE",
            SUSPICIOUS: "SUSPECTED",
            EXPIRED: "INVALID",
            FAKE: "INVALID"
        };
        const dbStatus = statusMap[status] ?? "INVALID";

        const type = this.classifyCodeType(req.code);

        return await prisma.verificationLog.create({
            data: {
                userId: req.userId,
                // Note: The VerificationLog model in schema.prisma has no medicineId column,
                // so we do not persist it to the database to prevent database creation crashes.
                pillId,
                code: req.code,
                type,
                status: dbStatus,
                location: req.location || "Unknown",
                lat: req.lat,
                lng: req.lng,
                userAgent: req.deviceInfo || "Web Browser",
            }
        });
    }

    private static handleFakeResult(req: VerificationRequest, reason: string): VerificationResponse {
        return {
            success: false,
            resultType: "FAKE",
            verification: {
                id: "ERR-" + Date.now(),
                scanTime: new Date(),
                scanLocation: req.location || "Unknown",
                deviceInfo: req.deviceInfo || "Unknown",
                blockchainStatus: "NOT_FOUND"
            },
            blockchain: { txHash: null, status: "UNVERIFIED", verifiedOnChain: false },
            warnings: ["CRYPTOGRAPHIC_MISMATCH", "UNAUTHORIZED_BATCH_ID"],
            riskScore: 100,
            message: reason || "WARNING: This medicine is NOT FOUND in the SafeDose blockchain ledger. DO NOT CONSUME."
        };
    }

    private static calculateRisk(scanCount: number, req: VerificationRequest) {
        let score = 0;
        if (scanCount > 0) score += 40;
        if (scanCount > 5) score += 40;
        if (req.location === "Unknown") score += 10;
        return { score: Math.min(score, 100) };
    }

    private static generateWarnings(type: string, recalled: boolean, expired: boolean, score: number) {
        const warnings = [];
        if (recalled) warnings.push("BATCH_RECALLED_BY_MANUFACTURER");
        if (expired) warnings.push("EXPIRED_MEDICINE_DETECTED");
        if (score > 50) warnings.push("HIGH_SCAN_FREQUENCY_DETECTED");
        if (type === "DUPLICATE") warnings.push("POTENTIAL_PACKAGING_REUSE");
        return warnings;
    }

    private static generateMessage(type: string, name: string, pillNum?: string) {
        if (type === "GENUINE") return `Success! ${name}${pillNum ? ' Pill #' + pillNum : ''} is authenticated and safe.`;
        if (type === "DUPLICATE") return `CAUTION: This ${pillNum ? 'pill' : 'box'} has been scanned multiple times. Integrity compromised.`;
        if (type === "EXPIRED") return `STOP: ${name} is past its expiry date. Contact your pharmacy.`;
        if (type === "SUSPICIOUS") return `ALERT: Anomalous activity detected. Contact DRAP immediately.`;
        return "Verification failed.";
    }
}
