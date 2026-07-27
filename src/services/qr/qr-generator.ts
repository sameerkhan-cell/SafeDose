/**
 * QR Generation Service — SafeDose Dual QR Architecture
 *
 * BOX QR Format:  BOX-{BatchNumber}-{ManufacturerCode}
 * PILL QR Format: PILL-{BatchNumber}-{PillNumber}-{ManufacturerCode}
 */

import type { MedicineBatch, PillRecord, BatchRegistrationForm, DualQRResult } from "@/types/dual-qr";

// ── ID helpers ───────────────────────────────────────────────────────────────

function generateId(): string {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function generateTxHash(): string {
    const hex = "0123456789abcdef";
    let h = "0x";
    for (let i = 0; i < 40; i++) h += hex[Math.floor(Math.random() * 16)];
    return h;
}

function padPillNumber(n: number, total: number): string {
    const digits = String(total).length;
    return String(n).padStart(Math.max(digits, 3), "0");
}

// ── QR payload builders ──────────────────────────────────────────────────────

/**
 * BOX QR code value
 * Format: BOX-{BatchNumber}-{ManufacturerCode}
 */
export function buildBoxQrCode(batchNumber: string, manufacturerCode: string): string {
    return `BOX-${batchNumber}-${manufacturerCode}`;
}

/**
 * PILL QR code value
 * Format: PILL-{BatchNumber}-{PillNumber}-{ManufacturerCode}
 */
export function buildPillQrCode(batchNumber: string, pillNumber: string, manufacturerCode: string): string {
    return `PILL-${batchNumber}-${pillNumber}-${manufacturerCode}`;
}

// ── Batch + pill creation ────────────────────────────────────────────────────

function createBatch(form: BatchRegistrationForm, startCartonNumber = 1, startBoxNumber = 1): MedicineBatch {
    const totalPills = form.quantityBoxes * form.totalPillsPerBox;
    const batchNumber = form.batchNumber || generateId();
    const manufacturerCode = form.manufacturerCode.toUpperCase();
    const quantityBoxes = form.quantityBoxes;
    const totalCartons = form.totalCartons || Math.max(1, Math.ceil(quantityBoxes / 10));
    const boxesPerCarton = Math.floor(quantityBoxes / totalCartons);

    // Generate cartons and boxes
    const cartons: any[] = [];
    const boxes: any[] = [];
    const baseBoxesPerCarton = Math.floor(quantityBoxes / totalCartons);
    const cartonsWithExtra = quantityBoxes % totalCartons;

    let globalBoxCounter = startBoxNumber - 1;
    for (let c = 1; c <= totalCartons; c++) {
        const boxesInThisCarton = c <= cartonsWithExtra ? baseBoxesPerCarton + 1 : baseBoxesPerCarton;
        if (boxesInThisCarton === 0) continue;

        const cartonIdx = (startCartonNumber - 1 + c).toString().padStart(3, "0");
        const cartonCode = `CARTON-${batchNumber.toUpperCase()}-${cartonIdx}-${manufacturerCode}`;

        cartons.push({
            id: `carton-${c}-${Math.random().toString(36).slice(2, 6)}`,
            cartonNumber: cartonCode,
            qrCode: cartonCode,
            boxesCount: boxesInThisCarton,
        });

        for (let b = 1; b <= boxesInThisCarton; b++) {
            globalBoxCounter++;
            const boxIdx = globalBoxCounter.toString().padStart(4, "0");
            const boxCode = `BOX-${batchNumber.toUpperCase()}-${boxIdx}-${manufacturerCode}`;

            boxes.push({
                id: `box-${globalBoxCounter}-${Math.random().toString(36).slice(2, 6)}`,
                boxNumber: boxCode,
                qrCode: boxCode,
                pillsCount: form.totalPillsPerBox,
            });
        }
    }

    return {
        id: generateId(),
        medicineName: form.medicineName,
        batchNumber,
        manufacturingDate: form.manufacturingDate,
        expiryDate: form.expiryDate,
        quantityBoxes: form.quantityBoxes,
        totalPillsPerBox: form.totalPillsPerBox,
        totalPills,
        manufacturerCode,
        drapLicense: form.drapLicense,
        productCategory: form.productCategory,
        boxQrCode: buildBoxQrCode(batchNumber, manufacturerCode),
        boxQrScanned: false,
        qrGenerationStatus: "pending",
        createdAt: new Date().toISOString(),
        txHash: generateTxHash(),
        status: "Active",
        boxesPerCarton,
        totalCartons,
        cartons,
        boxes
    };
}

function createPillRecords(batch: MedicineBatch): PillRecord[] {
    const pills: PillRecord[] = [];
    const total = batch.totalPills;

    for (let i = 1; i <= total; i++) {
        const pillNumber = padPillNumber(i, total);
        pills.push({
            id: generateId(),
            medicineId: batch.id,
            pillNumber,
            pillQrCode: buildPillQrCode(batch.batchNumber, pillNumber, batch.manufacturerCode),
            qrScanned: false,
            qrScannedAt: null,
            qrScannedLocation: null,
            blockchainTx: null,
            qrPrinted: false,
            qrStatus: "active",
            createdAt: new Date().toISOString(),
        });
    }

    return pills;
}

// ── Main generation function ─────────────────────────────────────────────────

export interface GenerateOptions {
    /** Called with progress 0–100 as pills are generated */
    onProgress?: (generated: number, total: number) => void;
    /** Simulate async delay between progress chunks (ms) */
    chunkDelay?: number;
    /** The starting number for the pill sequence (useful for extending batches) */
    startNumber?: number;
    /** The starting carton index */
    startCartonNumber?: number;
    /** The starting box index */
    startBoxNumber?: number;
}

/**
 * Generate a full DualQR result: 1 batch record + N pill records.
 * Yields progress via `onProgress` for animated UX.
 */
export async function generateDualQR(
    form: BatchRegistrationForm,
    options: GenerateOptions = {}
): Promise<DualQRResult> {
    const { onProgress, chunkDelay = 30, startNumber = 1, startCartonNumber = 1, startBoxNumber = 1 } = options;

    // STEP 1 — Create batch
    const batch = createBatch(form, startCartonNumber, startBoxNumber);

    // STEP 2 — Create pills in chunks for animated progress
    const quantityToGenerate = batch.totalPills;
    const pills: PillRecord[] = [];

    const CHUNK_SIZE = Math.max(1, Math.ceil(quantityToGenerate / 40));

    for (let i = 0; i < quantityToGenerate; i++) {
        const currentNum = startNumber + i;
        const pillNumber = padPillNumber(currentNum, Math.max(currentNum, 100)); // Ensure at least 3 digits

        pills.push({
            id: generateId(),
            medicineId: batch.id,
            pillNumber,
            pillQrCode: buildPillQrCode(batch.batchNumber, pillNumber, batch.manufacturerCode),
            qrScanned: false,
            qrScannedAt: null,
            qrScannedLocation: null,
            blockchainTx: null,
            qrPrinted: false,
            qrStatus: "active",
            createdAt: new Date().toISOString(),
        });

        if ((i + 1) % CHUNK_SIZE === 0 || (i + 1) === quantityToGenerate) {
            onProgress?.(i + 1, quantityToGenerate);
            if (chunkDelay > 0 && (i + 1) < quantityToGenerate) {
                await new Promise((r) => setTimeout(r, chunkDelay));
            }
        }
    }

    return { batch, pills, totalPillsGenerated: pills.length };
}

// ── QR Canvas export helpers ─────────────────────────────────────────────────

/** Reads a QRCodeCanvas DOM node and returns a PNG data-URL with a label. */
export function exportQRCanvasToPng(
    canvas: HTMLCanvasElement,
    label: string,
    sublabel?: string
): string {
    const PAD = 40;
    const LABEL_H = 64;
    const dlCanvas = document.createElement("canvas");
    const ctx = dlCanvas.getContext("2d");
    if (!ctx) return "";

    dlCanvas.width = canvas.width + PAD * 2;
    dlCanvas.height = canvas.height + PAD * 2 + LABEL_H;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dlCanvas.width, dlCanvas.height);
    ctx.drawImage(canvas, PAD, PAD);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, dlCanvas.width / 2, canvas.height + PAD + 24);

    if (sublabel) {
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#6b7280";
        ctx.fillText(sublabel, dlCanvas.width / 2, canvas.height + PAD + 44);
    }

    return dlCanvas.toDataURL("image/png");
}

/** Trigger a browser download for any data URL. */
export function triggerDownload(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.download = filename;
    a.href = dataUrl;
    a.click();
}

/** Build an SVG string for a QR code value (simple placeholder SVG badge). */
export function buildQrSvg(qrValue: string, label: string): string {
    // We embed the text label; the actual QR rendering is done by the React component.
    // This SVG is a minimal text-based representation for SVG download.
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <rect width="240" height="240" fill="#ffffff" rx="12"/>
  <rect x="20" y="20" width="200" height="180" rx="8" fill="none" stroke="#e5e7eb" stroke-width="1.5"/>
  <text x="120" y="90" font-family="monospace" font-size="10" fill="#111827" text-anchor="middle" font-weight="bold">SafeDose QR</text>
  <text x="120" y="115" font-family="monospace" font-size="8" fill="#374151" text-anchor="middle">${qrValue}</text>
  <text x="120" y="215" font-family="sans-serif" font-size="9" fill="#6b7280" text-anchor="middle">${label}</text>
</svg>`;
}

/** Generate and download a minimal batch report as HTML→blob. */
export function downloadBatchReportHtml(batch: MedicineBatch, totalPills: number) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>SafeDose Batch Report — ${batch.batchNumber}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #111; }
    h1   { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .sub { color: #6b7280; font-size: 13px; margin-bottom: 32px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f9fafb; text-align: left; padding: 10px 14px; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: #d1fae5; color: #065f46; }
    .mono  { font-family: monospace; font-size: 11px; word-break: break-all; }
    .qr-box { margin-top: 24px; padding: 16px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; }
    .qr-box h3 { margin: 0 0 8px; font-size: 14px; }
    h2 { margin-top: 32px; font-size: 16px; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <h1>SafeDose — Batch Report</h1>
  <p class="sub">Generated: ${new Date().toLocaleString()}</p>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Medicine Name</td><td>${batch.medicineName}</td></tr>
    <tr><td>Batch Number</td><td><span class="mono">${batch.batchNumber}</span></td></tr>
    <tr><td>Manufacturer Code</td><td>${batch.manufacturerCode}</td></tr>
    <tr><td>DRAP License</td><td>${batch.drapLicense}</td></tr>
    <tr><td>Manufacturing Date</td><td>${batch.manufacturingDate}</td></tr>
    <tr><td>Expiry Date</td><td>${batch.expiryDate}</td></tr>
    <tr><td>Quantity (Boxes)</td><td>${batch.quantityBoxes.toLocaleString()}</td></tr>
    <tr><td>Pills Per Box</td><td>${batch.totalPillsPerBox}</td></tr>
    <tr><td>Total Pills</td><td>${totalPills.toLocaleString()}</td></tr>
    <tr><td>Status</td><td><span class="badge">${batch.status}</span></td></tr>
    <tr><td>Blockchain TX</td><td><span class="mono">${batch.txHash}</span></td></tr>
    <tr><td>Created</td><td>${new Date(batch.createdAt).toLocaleString()}</td></tr>
  </table>
  <div class="qr-box">
    <h3>Box QR Code</h3>
    <p class="mono">${batch.boxQrCode}</p>
  </div>
  <h2>QR Pill Architecture</h2>
  <p style="font-size:13px; color:#374151;">
    This batch contains <strong>${totalPills.toLocaleString()}</strong> individual pill QR codes
    in the format <code>PILL-${batch.batchNumber}-{PillNumber}-${batch.manufacturerCode}</code>.<br/>
    Examples: <span class="mono">PILL-${batch.batchNumber}-001-${batch.manufacturerCode}</span>,
    <span class="mono">PILL-${batch.batchNumber}-002-${batch.manufacturerCode}</span>, …
  </p>
  <footer>SafeDose · Pakistan Pharmaceutical Authentication System · Blockchain-verified</footer>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SafeDose-BatchReport-${batch.batchNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
}
