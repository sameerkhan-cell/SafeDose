import type { VerificationResult } from "../verification/verification-service";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface FraudAlert {
    id: string;
    type: "duplicate_scan" | "geo_anomaly" | "spike_detected" | "pharmacy_risk" | "expiry_fraud";
    severity: RiskLevel;
    message: string;
    targetId: string; // Batch ID or Pharmacy ID
    timestamp: string;
    location?: string;
    coordinates?: [number, number];
}

export interface RiskScores {
    medicineRisk: number; // 0-100
    pharmacyTrust: number; // 0-100
    batchSafety: number; // 0-100
    regionThreat: number; // 0-100
}

/**
 * AI-style Fraud Detection Engine — SafeDose Intelligence
 * Simulates behavioral analysis and anomaly detection.
 */
export class FraudEngine {
    /**
     * Analyzes a scan result to determine if it's fraudulent or suspicious.
     */
    static analyzeScan(result: VerificationResult, history: any[]): FraudAlert[] {
        const alerts: FraudAlert[] = [];

        // 1. Duplicate Verification Analysis
        if (result.status === "duplicate" && result.fraudDetails) {
            alerts.push({
                id: Math.random().toString(36).slice(2, 9),
                type: "duplicate_scan",
                severity: result.fraudDetails.scanCount > 5 ? "critical" : "high",
                message: `Pill ID duplicated ${result.fraudDetails.scanCount} times. Probable counterfeit batch.`,
                targetId: result.batchDetails?.batchNumber || "UNKNOWN",
                timestamp: new Date().toISOString(),
                location: result.fraudDetails.firstScanLocation
            });
        }

        // 2. Impossible Travel (Geo-Anomaly) Simulation
        // If scanned in Karachi and then Lahore within < 1 hour
        const lastScan = history[0];
        if (lastScan && result.fraudDetails) {
            const timeDiff = (new Date().getTime() - new Date(lastScan.timestamp).getTime()) / 60000;
            if (timeDiff < 60 && lastScan.result?.fraudDetails?.firstScanLocation !== result.fraudDetails.firstScanLocation) {
                alerts.push({
                    id: Math.random().toString(36).slice(2, 9),
                    type: "geo_anomaly",
                    severity: "critical",
                    message: "Impossible Travel Detected: Medicine verified in multiple cities within minutes.",
                    targetId: result.batchDetails?.batchNumber || "UNKNOWN",
                    timestamp: new Date().toISOString(),
                    location: "Cross-Region Mismatch"
                });
            }
        }

        return alerts;
    }

    /**
     * Generates risk scores using simulated AI heuristics.
     */
    static calculateRiskScores(batchId: string, analytics: any): RiskScores {
        // Simulated AI heuristics
        const duplicateRate = analytics.duplicates / (analytics.totalScans || 1);

        return {
            medicineRisk: Math.min(Math.round(duplicateRate * 500), 100),
            pharmacyTrust: Math.max(100 - (analytics.flaggedReports * 15), 0),
            batchSafety: Math.max(100 - (duplicateRate * 200), 0),
            regionThreat: analytics.regionAnomalies > 5 ? 85 : 15
        };
    }
}
