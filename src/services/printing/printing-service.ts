import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { MedicineBatch, PillRecord } from "@/types/dual-qr";

/**
 * Printing Service — MediVerify Dual QR System
 * Handles PDF generation for architectural print layouts.
 */
export class PrintingService {
    /**
     * Generates a PDF for a single Box QR.
     * Layout: 3cm x 3cm as requested (with small bleed).
     */
    static async generateBoxQrPdf(batch: MedicineBatch, qrDataUrl: string): Promise<Blob> {
        const doc = new jsPDF({
            unit: "mm",
            format: [45, 45], // 4.5cm x 4.5cm canvas
        });

        // 3cm = 30mm
        doc.addImage(qrDataUrl, "PNG", 7.5, 5, 30, 30);

        doc.setFontSize(6);
        doc.setTextColor(50, 50, 50);
        doc.text(`BATCH: ${batch.batchNumber}`, 22.5, 37, { align: "center" });
        doc.text(`${batch.medicineName}`, 22.5, 40, { align: "center" });
        doc.text(`EXP: ${batch.expiryDate}`, 22.5, 43, { align: "center" });

        return doc.output("blob");
    }

    /**
     * Generates a PDF with multiple stickers/labels for ALL cartons.
     * Layout: 6cm x 6cm per carton.
     */
    static async generateCartonQrPdf(batch: MedicineBatch): Promise<Blob> {
        const doc = new jsPDF({
            unit: "mm",
            format: "a4",
        });

        const LABEL_SIZE = 60; // 6cm
        const MARGIN = 10;
        const GAP = 5;
        const perRow = Math.floor((210 - MARGIN * 2) / (LABEL_SIZE + GAP));
        const perCol = Math.floor((297 - MARGIN * 2) / (LABEL_SIZE + GAP));

        const cartons = batch.cartons || [];

        for (let i = 0; i < cartons.length; i++) {
            if (i > 0 && i % (perRow * perCol) === 0) doc.addPage();

            const pageIndex = i % (perRow * perCol);
            const col = pageIndex % perRow;
            const row = Math.floor(pageIndex / perRow);

            const x = MARGIN + col * (LABEL_SIZE + GAP);
            const y = MARGIN + row * (LABEL_SIZE + GAP);

            const qrDataUrl = await QRCode.toDataURL(cartons[i].qrCode, { margin: 1, width: 200 });
            doc.addImage(qrDataUrl, "PNG", x + 5, y + 5, 50, 50);

            doc.setFontSize(8);
            doc.text(`CARTON: ${cartons[i].cartonNumber}`, x + 30, y + 57, { align: "center" });
        }

        return doc.output("blob");
    }

    /**
     * Generates a PDF for a sheet of Pill QRs.
     * Layout: Micro QR layout (0.8cm x 0.8cm) on A4.
     */
    static async generatePillQrSheetPdf(batch: MedicineBatch, pills: PillRecord[]): Promise<Blob> {
        const doc = new jsPDF({
            unit: "mm",
            format: "a4",
        });

        const MARGIN_X = 10;
        const MARGIN_Y = 22;        // vertical space reserved for the per-page header
        const QR_SIZE = 8;         // 0.8 cm per QR image
        const CELL_W = QR_SIZE + 5; // 13 mm per column  (QR + horizontal gap)
        // CELL_H derivation (mm, 1 pt = 0.353 mm, line-height factor = 1.15):
        //   QR image:          8.00 mm
        //   gap to text:       2.00 mm  (offset used in doc.text call)
        //   split-code block:  3 lines × (4.5 pt × 0.353 × 1.15) ≈ 3 × 1.83 = 5.49 mm
        //   gap before SN:     gap from block bottom to SN baseline ≈ 0.51 mm
        //   SN line:           4 pt × 0.353 ≈ 1.41 mm  (baseline at y+16, placed at y+QR+8)
        //   descender buffer:  ~0.5 mm before next row's QR image
        //   Total: 8 + 2 + 5.49 + 0.51 + 1.41 + 0.5 ≈ 17.9 → ceil to 17 mm
        const CELL_H = QR_SIZE + 9; // 17 mm per row
        const COLS = 12;

        const PAGE_H = doc.internal.pageSize.getHeight();
        const USABLE_H = PAGE_H - MARGIN_Y - 10;
        const ROWS_PER_PAGE = Math.floor(USABLE_H / CELL_H);
        const CELLS_PER_PAGE = COLS * ROWS_PER_PAGE;

        const totalPages = Math.ceil(pills.length / CELLS_PER_PAGE);

        const addPageHeader = (pageNum: number) => {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text("MediVerify · Pill QR Print Sheet", MARGIN_X, 8);

            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            doc.text(
                `${batch.medicineName} — Batch: ${batch.batchNumber} — Total Pills: ${pills.length}  (Page ${pageNum} of ${totalPages})`,
                MARGIN_X, 14
            );

            doc.setDrawColor(200, 200, 200);
            doc.line(MARGIN_X, 16, doc.internal.pageSize.getWidth() - MARGIN_X, 16);
        };

        addPageHeader(1);

        // Use 'L' error correction (fastest decode; sufficient for print-quality micro QRs)
        // and a smaller render width — 8 mm cells only need ~80 px of detail.
        const qrOpts = { margin: 1, width: 80, errorCorrectionLevel: 'L' as const };

        // ── PERFORMANCE: Generate QR codes in parallel chunks ──────────────
        // Each chunk resolves concurrently; the PDF is still assembled in order.
        const CHUNK_SIZE = 48;
        for (let chunkStart = 0; chunkStart < pills.length; chunkStart += CHUNK_SIZE) {
            const chunk = pills.slice(chunkStart, chunkStart + CHUNK_SIZE);

            // Kick off the entire chunk concurrently
            const rendered = await Promise.all(
                chunk.map(async (pill) => {
                    try {
                        const dataUrl = await QRCode.toDataURL(pill.pillQrCode, qrOpts);
                        return { dataUrl, pill };
                    } catch {
                        return { dataUrl: null, pill };
                    }
                })
            );

            // Place results into the PDF sequentially (order guaranteed)
            for (let localIdx = 0; localIdx < rendered.length; localIdx++) {
                const { dataUrl, pill } = rendered[localIdx];
                const i = chunkStart + localIdx;          // absolute index — O(1)
                const posOnPage = i % CELLS_PER_PAGE;

                if (posOnPage === 0 && i > 0) {
                    doc.addPage();
                    addPageHeader(Math.floor(i / CELLS_PER_PAGE) + 1);
                }

                const col = posOnPage % COLS;
                const row = Math.floor(posOnPage / COLS);
                const x = MARGIN_X + col * CELL_W;
                const y = MARGIN_Y + row * CELL_H;

                if (dataUrl) {
                    doc.addImage(dataUrl, "PNG", x, y, QR_SIZE, QR_SIZE);
                } else {
                    console.error(`Failed to generate QR for pill ${pill.pillNumber}`);
                }

                doc.setFontSize(4.5);
                doc.setFont("courier", "bold");
                doc.setTextColor(80, 80, 80);
                doc.setLineHeightFactor(1.15);
                const fullCode = String(pill.pillQrCode || "");
                const parts = fullCode.split('-');
                let displayLines = [fullCode];
                if (parts.length >= 6) {
                    // 6-7 segment codes (e.g. CO-BATCH-C1-B1-P1 or CO-BAT1-BAT2-C1-B1-P1):
                    // split into 3 balanced lines, keeping last 3 segments (C/B/P) together
                    displayLines = [
                        parts.slice(0, 2).join('-') + '-',
                        parts.slice(2, parts.length - 3).join('-') + '-',
                        parts.slice(parts.length - 3).join('-')
                    ];
                } else if (parts.length >= 5) {
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
                doc.text(displayLines, x + QR_SIZE / 2, y + QR_SIZE + 2, { align: "center" });

                doc.setFont("helvetica", "normal");
                doc.setFontSize(4);
                doc.text(`SN: ${pill.pillNumber}`, x + QR_SIZE / 2, y + QR_SIZE + 8, { align: "center" });
            }
        }

        return doc.output("blob");
    }

    /**
     * Generates a PDF for a sheet of Box QRs.
     * Layout: Grid of Box QR codes on A4.
     */
    static async generateBoxQrSheetPdf(
        batch: MedicineBatch,
        boxes: { id: string; boxNumber: string; qrCode: string }[]
    ): Promise<Blob> {
        const doc = new jsPDF({
            unit: "mm",
            format: "a4",
        });

        const MARGIN_X = 10;
        const MARGIN_Y = 22;        // vertical space reserved for the per-page header
        const QR_SIZE = 8;         // 0.8 cm per QR image
        const CELL_W = QR_SIZE + 5; // 13 mm per column  (QR + horizontal gap)
        // CELL_H derivation: same formula as pill sheet — 17 mm (QR_SIZE + 9).
        // The full-code caption is replaced by a short 2-segment label (e.g. "Box: C1-B1")
        // which fits well within CELL_W at font size 4 and sits at y+QR_SIZE+8.
        const CELL_H = QR_SIZE + 9; // 17 mm per row
        const COLS = 12;

        const PAGE_H = doc.internal.pageSize.getHeight();
        const USABLE_H = PAGE_H - MARGIN_Y - 10;
        const ROWS_PER_PAGE = Math.floor(USABLE_H / CELL_H);
        const CELLS_PER_PAGE = COLS * ROWS_PER_PAGE;

        const totalPages = Math.ceil(boxes.length / CELLS_PER_PAGE);

        const addPageHeader = (pageNum: number) => {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text("MediVerify · Box QR Print Sheet", MARGIN_X, 8);

            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            doc.text(
                `${batch.medicineName} — Batch: ${batch.batchNumber} — Total Boxes: ${boxes.length}  (Page ${pageNum} of ${totalPages})`,
                MARGIN_X, 14
            );

            doc.setDrawColor(200, 200, 200);
            doc.line(MARGIN_X, 16, doc.internal.pageSize.getWidth() - MARGIN_X, 16);
        };

        addPageHeader(1);

        const qrOpts = { margin: 1, width: 80, errorCorrectionLevel: 'L' as const };

        const CHUNK_SIZE = 48;
        for (let chunkStart = 0; chunkStart < boxes.length; chunkStart += CHUNK_SIZE) {
            const chunk = boxes.slice(chunkStart, chunkStart + CHUNK_SIZE);

            const rendered = await Promise.all(
                chunk.map(async (box) => {
                    try {
                        const dataUrl = await QRCode.toDataURL(box.qrCode, qrOpts);
                        return { dataUrl, box };
                    } catch {
                        return { dataUrl: null, box };
                    }
                })
            );

            for (let localIdx = 0; localIdx < rendered.length; localIdx++) {
                const { dataUrl, box } = rendered[localIdx];
                const i = chunkStart + localIdx;
                const posOnPage = i % CELLS_PER_PAGE;

                if (posOnPage === 0 && i > 0) {
                    doc.addPage();
                    addPageHeader(Math.floor(i / CELLS_PER_PAGE) + 1);
                }

                const col = posOnPage % COLS;
                const row = Math.floor(posOnPage / COLS);
                const x = MARGIN_X + col * CELL_W;
                const y = MARGIN_Y + row * CELL_H;

                if (dataUrl) {
                    doc.addImage(dataUrl, "PNG", x, y, QR_SIZE, QR_SIZE);
                } else {
                    console.error(`Failed to generate QR for box ${box.boxNumber}`);
                }

                doc.setFontSize(4.5);
                doc.setFont("courier", "bold");
                doc.setTextColor(80, 80, 80);
                doc.setLineHeightFactor(1.15);
                const fullCode = String(box.qrCode || "");
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
                doc.text(displayLines, x + QR_SIZE / 2, y + QR_SIZE + 2, { align: "center" });

                // Show only the last two hyphen-separated segments (e.g. "C1-B1" from
                // "MFG-SAM001-BAT-MRBZ38YW-C1-B1") — short enough to fit CELL_W at font 4.
                const boxParts = String(box.qrCode || '').split('-');
                const shortId = boxParts.length >= 2
                    ? boxParts.slice(-2).join('-')
                    : String(box.qrCode || '');
                doc.setFont("helvetica", "normal");
                doc.setFontSize(4);
                doc.text(`Box: ${shortId}`, x + QR_SIZE / 2, y + QR_SIZE + 8, { align: "center" });
            }
        }

        return doc.output("blob");
    }

    /**
     * Generates a comprehensive Batch Report PDF.
     */
    static async generateBatchReportPdf(batch: MedicineBatch, totalPills: number): Promise<Blob> {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, pageWidth, 40, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("MediVerify", 20, 20);
        doc.setFontSize(12);
        doc.text("PHARMACEUTICAL AUTHENTICATION SYSTEM", 20, 28);

        doc.setTextColor(200, 200, 200);
        doc.setFontSize(10);
        doc.text(`REPORT NO: MV-${batch.batchNumber}`, pageWidth - 20, 25, { align: "right" });

        // Body
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Batch Compliance Report", 20, 55);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.text(`Generated on ${new Date().toLocaleString()}`, 20, 62);

        // Table-like structure
        let y = 75;
        const fields = [
            ["Medicine Name", batch.medicineName],
            ["Batch Number", batch.batchNumber],
            ["Product Category", batch.productCategory || "Pharmaceutical"],
            ["Manufacturer Code", batch.manufacturerCode],
            ["DRAP License", batch.drapLicense],
            ["Manufacturing Date", batch.manufacturingDate],
            ["Expiry Date", batch.expiryDate],
            ["Total Boxes", batch.quantityBoxes.toLocaleString()],
            ["Pills Per Box", batch.totalPillsPerBox.toString()],
            ["Total Generated Pills", totalPills.toLocaleString()],
            ["Generation Status", (batch.qrGenerationStatus || "completed").toUpperCase()],
            ["Supply Chain Status", (batch.status || "active").toUpperCase()],
        ];

        fields.forEach(([label, value]) => {
            // Row background
            doc.setFillColor(249, 250, 251);
            doc.rect(20, y - 5, pageWidth - 40, 10, "F");

            doc.setFont("helvetica", "bold");
            doc.setTextColor(55, 65, 81);
            doc.text(`${label}:`, 25, y + 1);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(17, 24, 39);
            doc.text(String(value || "N/A"), 80, y + 1);

            y += 10;
        });

        // Blockchain Section
        y += 10;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Blockchain Verification Details", 20, y);

        y += 10;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.text("TRANSACTION HASH", 20, y);

        y += 6;
        doc.setFont("courier", "bold");
        doc.setTextColor(37, 99, 235);
        doc.text(String(batch.txHash || "PENDING"), 20, y);

        // Footer
        doc.setFont("helvetica", "normal");
        doc.setTextColor(156, 163, 175);
        doc.setFontSize(8);
        doc.text("This report is digitally signed by MediVerify nodes. Any tampering invalidates the verification.", 105, 280, { align: "center" });

        return doc.output("blob");
    }

    /**
     * Alias: Compliance PDF for QR Library — delegates to generateBatchReportPdf.
     */
    static async generateBatchCompliancePdf(batch: MedicineBatch, pillCount: number): Promise<Blob> {
        return PrintingService.generateBatchReportPdf(batch, pillCount);
    }
}
