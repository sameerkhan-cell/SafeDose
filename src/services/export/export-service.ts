import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { MedicineBatch, PillRecord } from "@/types/dual-qr";

/**
 * Export Service — SafeDose Dual QR System
 * Handles bulk data exports and ZIP packaging for industrial vendors.
 */
export class ExportService {
    /**
     * Exports all pill QR codes metadata and sample assets as a ZIP file.
     */
    static async exportPillQrsAsZip(batch: MedicineBatch, pills: PillRecord[], qrBlob?: Blob): Promise<void> {
        const zip = new JSZip();
        const folder = zip.folder(`SafeDose_Batch_${batch.batchNumber}_QR_Assets`);

        if (!folder) return;

        // 1. Add README instructions
        const readme = `SafeDose Dual QR Export
=========================================
Batch: ${batch.batchNumber}
Medicine: ${batch.medicineName}
Total Pills: ${pills.length}
Date: ${new Date().toLocaleString()}

This package contains the QR manifest and sample assets for industrial printing.
The 'pill_manifest.csv' file contains the exact strings to be encoded in each micro-QR.
`;
        folder.file("README.txt", readme);

        // 2. Add CSV Manifest (The core data for industrial printers)
        const csvHeader = "pill_number,qr_code_string,blockchain_tx,status\n";
        const csvRows = pills.map(p =>
            `${p.pillNumber},${p.pillQrCode},${p.blockchainTx || "Pending"},${p.qrStatus}`
        ).join("\n");

        folder.file("pill_manifest.csv", csvHeader + csvRows);

        // 3. Add Sample Assets if provided
        if (qrBlob) {
            folder.file(`SAMPLE_PILL_QR_LAYOUT.png`, qrBlob);
        }

        // 4. Generate and trigger download
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `SafeDose_Export_${batch.batchNumber}.zip`);
    }
}
