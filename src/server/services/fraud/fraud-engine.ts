import { prisma } from "../../db/client";
import { isImpossibleTravel } from "../geo-anomaly.util";

export class FraudEngine {
    static async analyzeScan(qrCode: string, location: string, metadata: any = {}) {
        const alerts = [];
        let riskScore = 0;

        // 1. Duplicate Pattern Detection
        const previousScans = await prisma.verificationLog.findMany({
            where: { code: qrCode },
            orderBy: { createdAt: "desc" },
            take: 5
        });

        if (previousScans.length > 0) {
            riskScore += 40;
            alerts.push({
                type: "DUPLICATE_SCAN",
                severity: previousScans.length > 2 ? "HIGH" : "MEDIUM",
                message: `This code has been scanned ${previousScans.length + 1} times.`
            });

            // 2. Geo-Anomaly Check (Impossible Travel)
            const lastScan = previousScans[0];
            const geoCheck = isImpossibleTravel(
                { location: lastScan.location, timestamp: lastScan.createdAt },
                location,
                new Date(),
                60
            );

            if (geoCheck.isAnomaly) {
                riskScore += 50;
                alerts.push({
                    type: "GEO_ANOMALY",
                    severity: "CRITICAL",
                    message: geoCheck.message
                });

                await prisma.geoAnalytics.create({
                    data: {
                        qrCode,
                        previousLocation: lastScan.location,
                        currentLocation: location,
                        suspicious: true
                    }
                });
            }
        }


        // 3. Automated Risk Scoring Update
        const riskLevel = this.getRiskLevel(riskScore);

        // 4. Persistence of Alerts
        for (const alert of alerts) {
            await prisma.fraudAlert.create({
                data: {
                    alertType: alert.type,
                    qrCode,
                    severity: alert.severity,
                    riskScore,
                    message: alert.message,
                    metadata: JSON.stringify(metadata)
                }
            });
        }

        return {
            fraudDetected: riskScore > 50,
            riskScore: Math.min(riskScore, 100),
            riskLevel,
            alerts
        };
    }

    private static getRiskLevel(score: number): string {
        if (score <= 25) return "SAFE";
        if (score <= 50) return "LOW";
        if (score <= 75) return "SUSPICIOUS";
        return "HIGH";
    }

    static async updateEntityRisk(entityType: "PHARMACY" | "MEDICINE", entityId: string) {
        // Aggregator for pharmacy/medicine risk based on recent alerts
        const alerts = await prisma.fraudAlert.findMany({
            where: {
                OR: [
                    { pharmacyId: entityId },
                    { medicineId: entityId }
                ],
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // last 30 days
            }
        });

        const score = Math.min(alerts.length * 10, 100);
        const level = this.getRiskLevel(score);

        await prisma.riskScore.upsert({
            where: { id: `${entityType}-${entityId}` }, // Hacky unique ID
            update: { score, riskLevel: level },
            create: {
                id: `${entityType}-${entityId}`,
                entityType,
                entityId,
                score,
                riskLevel: level,
                reasons: `Based on ${alerts.length} recent fraud alerts.`
            }
        });
    }
}
