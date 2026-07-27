import { jsPDF } from "jspdf";
import { QRService } from "../qr/qr.service";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

export class PDFSheetService {
    /**
     * Generates a printable A4 PDF sheet for an entire medicine batch.
     * High-Performance Parallel Generation with Disk Caching.
     */
    static async generateBatchPillSheet(batch: any, pills: any[]): Promise<Buffer> {
        const cacheFileName = `Sheet-${batch.batchNumber}-Industrial.pdf`;
        const storageRoot = process.env.VERCEL ? "/tmp/qr-assets" : path.join(process.cwd(), "storage", "qr-assets");
        const cacheDir = path.join(storageRoot, batch.id);
        const cachePath = path.join(cacheDir, cacheFileName);

        /* 
        if (fs.existsSync(cachePath)) {
            console.log(`[PDFSheetService] Serving cached PDF for batch ${batch.batchNumber}`);
            return fs.readFileSync(cachePath);
        }
        */

        const startTime = Date.now();
        console.log(`[PDFSheetService] Starting industrial generation for ${pills.length} pills...`);

        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const qrSize = 25;
        const cellWidth = 35;
        const cellHeight = 45;

        const cols = Math.floor((pageWidth - 2 * margin) / cellWidth);
        const rows = Math.floor((pageHeight - 35) / cellHeight);

        const drawHeader = (pageNumber: number) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(`SafeDose Production Asset: ${batch.medicine?.name}`, margin, 12);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(`Batch ID: ${batch.batchNumber} | Mfg: ${new Date(batch.manufacturingDate).toLocaleDateString()} | Exp: ${new Date(batch.expiryDate).toLocaleDateString()}`, margin, 18);
            doc.text(`Dosage: ${batch.dosageStrength || 'N/A'} | Page: ${pageNumber}`, margin, 23);
            doc.line(margin, 26, pageWidth - margin, 26);
        };

        let pageNum = 1;
        drawHeader(pageNum);

        let count = 0;
        let currentX = margin;
        let currentY = 30;

        // ── PERFORMANCE OPTIMIZATION: Parallel QR Generation ──
        // Increased concurrency to 50 for faster throughput (supported by 4GB heap)
        const CONCURRENCY = 50;
        for (let i = 0; i < pills.length; i += CONCURRENCY) {
            const chunk = pills.slice(i, i + CONCURRENCY);

            const qrTasks = chunk.map(pill =>
                QRService.generateDataURL(pill.qrCode, { width: 100, margin: 0 })
                    .then(dataUrl => ({ pill, dataUrl }))
            );

            const results = await Promise.all(qrTasks);

            for (const { pill, dataUrl } of results) {
                if (count > 0 && count % (cols * rows) === 0) {
                    doc.addPage();
                    pageNum++;
                    drawHeader(pageNum);
                    currentX = margin;
                    currentY = 30;
                }

                doc.addImage(dataUrl, 'PNG', currentX + (cellWidth - qrSize) / 2, currentY + 2, qrSize, qrSize);
                const fullCode = String(pill.qrCode);
                const parts = fullCode.split('-');
                let displayLines = [fullCode];
                if (parts.length >= 5) {
                    displayLines = [
                        parts.slice(0, 2).join('-') + '-',
                        parts.slice(2, 4).join('-') + '-',
                        parts.slice(4).join('-')
                    ];
                } else if (parts.length >= 3) {
                    displayLines = [
                        parts.slice(0, 2).join('-') + '-',
                        parts.slice(2).join('-')
                    ];
                }
                doc.setFont("courier", "bold");
                doc.setFontSize(4.5);
                doc.setLineHeightFactor(1.15);
                doc.text(displayLines, currentX + cellWidth / 2, currentY + qrSize + 5, { align: 'center' });

                doc.setFont("helvetica", "normal");
                doc.setFontSize(5.5);
                doc.text(`SN: ${pill.pillNumber}`, currentX + cellWidth / 2, currentY + qrSize + 13.5, { align: 'center' });

                count++;
                if (count % cols === 0) {
                    currentX = margin;
                    currentY += cellHeight;
                } else {
                    currentX += cellWidth;
                }
            }
        }

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        // 2. CACHE SAVE: Persist for next time
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(cachePath, pdfBuffer);

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[PDFSheetService] Finished industrial export in ${duration.toFixed(2)}s`);

        return pdfBuffer;
    }

    /**
     * Splits a massive batch into multiple smaller PDF parts and ZIPS them.
     * Prevents OOM and ensures stability for 100,000+ pill registries.
     */
    static async generateIndustrialPDFZip(batch: any, pills: any[]): Promise<Buffer> {
        console.log(`[PDFSheetService] Splitting ${pills.length} pills into volumes...`);
        const zip = new JSZip();

        // Chunk by 2,500 pills (~100 pages per PDF) for maximum stability
        const CHUNK_SIZE = 2500;
        let partNum = 1;

        for (let i = 0; i < pills.length; i += CHUNK_SIZE) {
            const chunk = pills.slice(i, i + CHUNK_SIZE);
            const startLabel = (i + 1).toString().padStart(6, '0');
            const endLabel = Math.min(i + CHUNK_SIZE, pills.length).toString().padStart(6, '0');

            console.log(`[PDFSheetService] Generating Part ${partNum} (${startLabel} to ${endLabel})...`);

            // Re-use our optimized generator for each part
            const partBatch = { ...batch, batchNumber: `${batch.batchNumber}-PART-${partNum}` };
            const pdfBuffer = await this.generateBatchPillSheet(partBatch, chunk);

            zip.file(`Pill_Sheet_Volume_${partNum}_(${startLabel}-${endLabel}).pdf`, pdfBuffer);
            partNum++;
        }

        return await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 1 }
        });
    }
}
