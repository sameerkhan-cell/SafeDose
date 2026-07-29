import { prisma } from "@/server/db/client";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import fs from "node:fs/promises";
import path from "node:path";

// ─── Shared Row Interface ─────────────────────────────────────────────────────

export interface BatchRowInput {
    medicineName: string;
    batchCode: string;
    barcode?: string | null;
    companyName?: string | null;
    expiryDate?: Date | null;
    manufactureDate?: Date | null;
    extraData?: Record<string, any> | null;
    sourceDocumentUrl?: string | null;
    // medicine-level optional fields (used when auto-creating a medicine)
    genericName?: string | null;
    manufacturer_name?: string | null;
    drapRegNumber?: string | null;
    approvalStatus?: string;
    activeIngredients?: string | null;
}

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface BulkUploadResult {
    created: number;
    skipped: number;
    errors: string[];
}

export interface BatchListItem {
    id: string;
    batchCode: string;
    barcode: string | null;
    companyName: string | null;
    registeredAt: string;
    medicineName: string;
    medicineId: string;
    expiryDate: string | null;
    manufactureDate: string | null;
    sourceDocumentUrl: string | null;
}

export interface BatchListResult {
    items: BatchListItem[];
    total: number;
}

// ─── Batch Sequence Auto-update (non-blocking helper) ────────────────────────

async function updateBatchSequence(medicineId: string, batchCode: string): Promise<void> {
    // Only works for PREFIX-YYYY-NNN format — silently skip otherwise
    const parts = batchCode.split("-");
    if (parts.length < 3) return;
    const prefix = parts[0].toUpperCase();
    const year = parseInt(parts[1], 10);
    const num = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(num) || year < 2000 || year > 2100) return;

    try {
        const existing = await prisma.batchSequence.findUnique({
            where: { medicineId_prefix_year: { medicineId, prefix, year } },
        });

        if (existing) {
            await prisma.batchSequence.update({
                where: { medicineId_prefix_year: { medicineId, prefix, year } },
                data: {
                    minSequence: Math.min(existing.minSequence, num),
                    maxSequence: Math.max(existing.maxSequence, num),
                    totalBatches: { increment: 1 },
                    lastUpdated: new Date(),
                    // keep existing confidence — auto-derived data is additive but doesn't upgrade confidence
                },
            });
        } else {
            await prisma.batchSequence.create({
                data: {
                    medicineId,
                    prefix,
                    year,
                    minSequence: num,
                    maxSequence: num,
                    totalBatches: 1,
                    confidence: "LOW", // auto-derived = LOW until admin confirms
                },
            });
        }
    } catch (err: any) {
        // Non-blocking — log and continue
        console.error(`[BatchSequence] Auto-update failed for ${batchCode}:`, err?.message);
    }
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class DrapBatchRegistryService {

    // ── Shared: Find-or-create Medicine + create DrapBatchRegistry row ────────
    static async findOrCreateMedicineAndBatch(
        row: BatchRowInput,
        adminUserId: string
    ): Promise<{ created: boolean; skipped: boolean; error?: string; batchId?: string }> {
        const medicineName = row.medicineName.trim();
        const batchCode = row.batchCode.trim();

        if (!medicineName) return { created: false, skipped: true, error: "medicineName is empty" };
        if (!batchCode) return { created: false, skipped: true, error: "batchCode is empty" };

        // Check for duplicate batch code
        const existing = await prisma.drapBatchRegistry.findUnique({
            where: { batchCode },
            select: { id: true },
        });
        if (existing) {
            return { created: false, skipped: true, error: `Batch code "${batchCode}" already exists` };
        }

        // Find or create medicine (DRAP entry)
        let medicine = await prisma.medicine.findFirst({
            where: { name: medicineName, isPublicDRAPEntry: true },
            select: { id: true, manufacturer_name: true },
        });

        if (!medicine) {
            // Auto-create the medicine — find any manufacturer as placeholder
            const defaultMfr = await prisma.manufacturer.findFirst({ select: { id: true } });
            if (!defaultMfr) {
                return { created: false, skipped: true, error: "No manufacturer found in database — cannot create medicine" };
            }
            const created = await prisma.medicine.create({
                data: {
                    name: medicineName,
                    genericName: row.genericName || null,
                    category: null,
                    dosage: null,
                    drapRegNumber: row.drapRegNumber || null,
                    activeIngredients: row.activeIngredients || null,
                    approvalStatus: row.approvalStatus || "REGISTERED",
                    manufacturer_name: row.manufacturer_name || null,
                    isPublicDRAPEntry: true,
                    manufacturerId: defaultMfr.id,
                },
                select: { id: true, manufacturer_name: true },
            });
            medicine = created;
        }

        // Resolve company name
        const resolvedCompanyName = row.companyName?.trim() || medicine.manufacturer_name || null;

        // Resolve barcode
        const barcode = row.barcode?.trim() || null;

        try {
            const batch = await prisma.drapBatchRegistry.create({
                data: {
                    medicineId: medicine.id,
                    batchCode,
                    barcode,
                    companyName: resolvedCompanyName,
                    registeredBy: adminUserId,
                    expiryDate: row.expiryDate ?? null,
                    manufactureDate: row.manufactureDate ?? null,
                    extraData: row.extraData ?? undefined,
                    sourceDocumentUrl: row.sourceDocumentUrl ?? null,
                },
                select: { id: true },
            });

            // STEP 6: Auto-update BatchSequence — fire-and-forget, never blocks
            updateBatchSequence(medicine.id, batchCode).catch(console.error);

            return { created: true, skipped: false, batchId: batch.id };
        } catch (err: any) {
            if (err.code === "P2002") {
                return { created: false, skipped: true, error: `Batch code "${batchCode}" or barcode already exists` };
            }
            return { created: false, skipped: true, error: `Unexpected error: ${err.message}` };
        }
    }

    // ── Bulk Upload from pre-parsed rows (CSV or Excel) ───────────────────────
    static async bulkUploadFromRows(
        rows: BatchRowInput[],
        adminUserId: string
    ): Promise<BulkUploadResult> {
        const result: BulkUploadResult = { created: 0, skipped: 0, errors: [] };

        for (let i = 0; i < rows.length; i++) {
            const rowNum = i + 2; // 1-indexed + header row
            const row = rows[i];
            const res = await this.findOrCreateMedicineAndBatch(row, adminUserId);
            if (res.created) {
                result.created++;
            } else {
                result.skipped++;
                if (res.error) result.errors.push(`Row ${rowNum}: ${res.error}`);
            }
        }

        return result;
    }

    // ── Parse CSV text → rows ─────────────────────────────────────────────────
    static parseCsvToRows(csvText: string): { rows: BatchRowInput[]; error?: string } {
        const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, ""),
        });

        if (parsed.errors.length > 0 && parsed.data.length === 0) {
            return { rows: [], error: `CSV parse failed: ${parsed.errors[0].message}` };
        }

        const rawRows = parsed.data;
        if (rawRows.length > 0 && (!("medicinename" in rawRows[0]) || !("batchcode" in rawRows[0]))) {
            return { rows: [], error: "CSV must have columns: medicineName, batchCode (and optionally barcode, companyName, expiryDate, manufactureDate)" };
        }

        return {
            rows: rawRows.map((r) => ({
                medicineName: (r["medicinename"] ?? "").trim(),
                batchCode: (r["batchcode"] ?? "").trim(),
                barcode: (r["barcode"] ?? r["gtin"] ?? r["barcodenumber"] ?? "").trim() || null,
                companyName: (r["companyname"] ?? "").trim() || null,
                expiryDate: parseDate(r["expirydate"]),
                manufactureDate: parseDate(r["manufacturedate"]),
            })),
        };
    }

    // ── Parse Excel buffer → rows ─────────────────────────────────────────────
    static parseExcelToRows(buffer: Buffer): { rows: BatchRowInput[]; error?: string } {
        try {
            const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) return { rows: [], error: "Excel file has no sheets" };

            const sheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

            if (rawRows.length === 0) return { rows: [], error: "Excel sheet is empty" };

            // Normalize headers: lowercase, strip spaces
            const normalize = (key: string) => key.toLowerCase().replace(/\s+/g, "");

            return {
                rows: rawRows.map((r) => {
                    const get = (k: string) => {
                        const found = Object.keys(r).find((key) => normalize(key) === k);
                        return found ? r[found] : "";
                    };
                    return {
                        medicineName: String(get("medicinename") ?? "").trim(),
                        batchCode: String(get("batchcode") ?? "").trim(),
                        barcode: String(get("barcode") || get("gtin") || get("barcodenumber") || "").trim() || null,
                        companyName: String(get("companyname") ?? "").trim() || null,
                        expiryDate: parseDateValue(get("expirydate")),
                        manufactureDate: parseDateValue(get("manufacturedate")),
                    };
                }),
            };
        } catch (err: any) {
            return { rows: [], error: `Excel parse failed: ${err?.message}` };
        }
    }

    // ── Legacy: CSV upload (keeps API backward-compat) ────────────────────────
    static async bulkUploadFromCsv(csvText: string, adminUserId: string): Promise<BulkUploadResult> {
        const { rows, error } = this.parseCsvToRows(csvText);
        if (error) return { created: 0, skipped: 0, errors: [error] };
        return this.bulkUploadFromRows(rows, adminUserId);
    }

    // ── List paginated batch codes ────────────────────────────────────────────
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
                      { barcode: { contains: params.search } },
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
                barcode: item.barcode ?? null,
                companyName: item.companyName,
                registeredAt: item.registeredAt.toISOString(),
                medicineName: item.medicine.name,
                medicineId: item.medicine.id,
                expiryDate: item.expiryDate?.toISOString() ?? null,
                manufactureDate: item.manufactureDate?.toISOString() ?? null,
                sourceDocumentUrl: item.sourceDocumentUrl ?? null,
            })),
            total,
        };
    }

    // ── Store supporting document (PDF/XML/eCTD) ─────────────────────────────
    static async storeDocument(
        file: File,
        adminUserId: string
    ): Promise<{ documentUrl: string; driveUrl?: string }> {
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = path.extname(file.name) || "";
        const safeName = `${Date.now()}-${adminUserId}${ext}`;

        const uploadDir = path.join(process.cwd(), "storage", "drap-documents");
        await fs.mkdir(uploadDir, { recursive: true });
        await fs.writeFile(path.join(uploadDir, safeName), buffer);

        const documentUrl = `/api/admin/drap-batches/document?file=${encodeURIComponent(safeName)}`;

        let driveUrl: string | undefined;
        try {
            const { GoogleDriveService } = await import("@/server/services/google-drive.service");
            const link = await GoogleDriveService.uploadFile(buffer, file.name, file.type);
            if (link) driveUrl = link;
        } catch (err: any) {
            console.error("[DrapDocumentUpload] Google Drive mirror failed:", err?.message);
        }

        return { documentUrl, driveUrl };
    }

    // ── Inspect XML file to detect candidate repeating record tags ───────────
    static inspectXml(xmlText: string): {
        candidates: Array<{
            nodePath: string;
            count: number;
            sampleTags: Array<{ tag: string; sample: string }>;
        }>;
        error?: string;
    } {
        try {
            const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: false });
            const parsed = parser.parse(xmlText.trim());

            const candidates: Array<{
                nodePath: string;
                count: number;
                sampleTags: Array<{ tag: string; sample: string }>;
            }> = [];

            function traverse(obj: any, path: string, depth: number) {
                if (!obj || typeof obj !== "object") return;

                for (const key of Object.keys(obj)) {
                    if (key.startsWith("?xml") || key.startsWith("@_")) continue;
                    const val = obj[key];
                    const currentPath = path ? `${path}.${key}` : key;

                    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
                        // ── Multi-record: fast-xml-parser returned an array (2+ elements) ──
                        const firstItem = val[0];
                        const sampleTags: Array<{ tag: string; sample: string }> = [];
                        for (const childKey of Object.keys(firstItem)) {
                            if (childKey.startsWith("@_")) continue;
                            const childVal = firstItem[childKey];
                            const sample = typeof childVal === "object" ? JSON.stringify(childVal) : String(childVal ?? "");
                            sampleTags.push({ tag: childKey, sample: sample.substring(0, 100) });
                        }
                        candidates.push({ nodePath: currentPath, count: val.length, sampleTags });
                    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
                        // ── Single-record edge case: fast-xml-parser returns a plain object ──
                        // When only 1 element exists under a tag, FXP does NOT arrayify it.
                        // Detect it by: at depth >= 1, object whose own leaf-count >= 2.
                        const childKeys = Object.keys(val).filter(
                            k => !k.startsWith("@_") && !k.startsWith("?")
                        );
                        const leafCount = childKeys.filter(k => {
                            const cv = val[k];
                            return cv === null || typeof cv !== "object" || Array.isArray(cv);
                        }).length;
                        if (depth >= 1 && childKeys.length >= 2 && leafCount === childKeys.length) {
                            // Looks like a single data record — surface it as a 1-count candidate
                            const sampleTags: Array<{ tag: string; sample: string }> = [];
                            for (const childKey of childKeys) {
                                const childVal = val[childKey];
                                const sample = Array.isArray(childVal) ? JSON.stringify(childVal) : String(childVal ?? "");
                                sampleTags.push({ tag: childKey, sample: sample.substring(0, 100) });
                            }
                            candidates.push({ nodePath: currentPath, count: 1, sampleTags });
                        } else {
                            traverse(val, currentPath, depth + 1);
                        }
                    }
                }
            }

            traverse(parsed, "", 0);

            if (candidates.length === 0) {
                return { candidates: [], error: "No repeating record elements found in XML file." };
            }

            return { candidates };
        } catch (err: any) {
            return { candidates: [], error: `XML parse failed: ${err?.message}` };
        }
    }

    // ── Import XML records using mapped tag names ─────────────────────────────
    static parseXmlToRows(
        xmlText: string,
        nodePath: string,
        mapping: {
            medicineNameTag: string;
            batchCodeTag: string;
            barcodeTag?: string;
            companyNameTag?: string;
            expiryDateTag?: string;
            manufactureDateTag?: string;
            genericNameTag?: string;
            manufacturerNameTag?: string;
            drapRegNumberTag?: string;
        }
    ): { rows: BatchRowInput[]; error?: string } {
        try {
            const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: false });
            const parsed = parser.parse(xmlText.trim());

            // Resolve array at nodePath e.g. "inventory.item" -> parsed["inventory"]["item"]
            const pathParts = nodePath.split(".");
            let records: any = parsed;
            for (const part of pathParts) {
                if (records && typeof records === "object") {
                    records = records[part];
                }
            }

            if (!Array.isArray(records)) {
                if (records && typeof records === "object") {
                    records = [records];
                } else {
                    return { rows: [], error: `No records found at XML node path "${nodePath}".` };
                }
            }

            const rows: BatchRowInput[] = records.map((rec: any) => {
                const getVal = (tag?: string) => {
                    if (!tag || !rec) return "";
                    const v = rec[tag];
                    return typeof v === "object" ? JSON.stringify(v) : String(v ?? "").trim();
                };

                return {
                    medicineName: getVal(mapping.medicineNameTag),
                    batchCode: getVal(mapping.batchCodeTag),
                    barcode: getVal(mapping.barcodeTag) || null,
                    companyName: getVal(mapping.companyNameTag) || null,
                    expiryDate: parseDate(getVal(mapping.expiryDateTag)),
                    manufactureDate: parseDate(getVal(mapping.manufactureDateTag)),
                    genericName: getVal(mapping.genericNameTag) || null,
                    manufacturer_name: getVal(mapping.manufacturerNameTag) || null,
                    drapRegNumber: getVal(mapping.drapRegNumberTag) || null,
                };
            });

            return { rows };
        } catch (err: any) {
            return { rows: [], error: `XML extraction failed: ${err?.message}` };
        }
    }

    // ── Extract PDF text into structured table preview ────────────────────────
    // Uses the installed pdf-parse class-based API (PDFParse / pdfjs-dist wrapper)
    // which provides vector-path border detection via getTable().
    // Falls back to flat-text heuristic for borderless PDFs.
    static async extractPdfTable(buffer: Buffer): Promise<{
        success: boolean;
        headers?: string[];
        rows?: BatchRowInput[];
        error?: string;
    }> {
        try {
            // ── Primary path: coordinate-based table extraction via PDFParse class ──
            const pdfMod = await import("pdf-parse");
            const { PDFParse, VerbosityLevel } = pdfMod as any;

            let tableRows: string[][] | null = null;

            if (typeof PDFParse === "function") {
                try {
                    const instance = new PDFParse({
                        data: new Uint8Array(buffer),
                        verbosity: VerbosityLevel?.ERRORS ?? 0,
                    });
                    const tableResult = await instance.getTable();

                    // Result shape: { pages: [{ num, tables: [string[][], ...] }], total, text }
                    // Each entry in tables is a 2D array: row → cell (string or {text:[]})
                    outer:
                    for (const page of (tableResult.pages ?? [])) {
                        for (const tableArr of (page.tables ?? [])) {
                            if (!Array.isArray(tableArr) || tableArr.length < 2) continue;
                            const colCount = tableArr[0]?.length ?? 0;
                            if (colCount < 2) continue;
                            // Normalise cells: each cell may be string or {text:[]} object
                            tableRows = (tableArr as any[]).map((row: any[]) =>
                                row.map((cell: any) => {
                                    if (cell === null || cell === undefined) return "";
                                    if (typeof cell === "string") return cell.trim();
                                    if (Array.isArray(cell?.text)) return cell.text.join(" ").trim();
                                    return String(cell).trim();
                                })
                            );
                            break outer;
                        }
                    }
                } catch (_tableErr) {
                    // getTable() failed (e.g. borderless PDF) — fall through to getText() path
                    tableRows = null;
                }
            }

            // ── Fallback: getText() → flat-text line-splitting heuristic ──
            if (!tableRows) {
                let flatText = "";
                try {
                    const instance2 = new PDFParse({
                        data: new Uint8Array(buffer),
                        verbosity: VerbosityLevel?.ERRORS ?? 0,
                    });
                    const textResult = await instance2.getText();
                    flatText = textResult.text ?? "";
                } catch (_) {
                    flatText = "";
                }

                if (!flatText.trim()) {
                    return { success: false, error: "Could not extract text from this PDF — it may be scanned/image-based. Try CSV or Excel instead." };
                }

                const rawLines = flatText.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
                const parsed: string[][] = [];
                for (const line of rawLines) {
                    let cols: string[];
                    if (line.includes("\t")) cols = line.split("\t").map((c: string) => c.trim());
                    else if (line.includes("|")) cols = line.split("|").map((c: string) => c.trim()).filter(Boolean);
                    else if (line.includes(",")) cols = line.split(",").map((c: string) => c.trim());
                    else cols = line.split(/\s{2,}/).map((c: string) => c.trim());
                    if (cols.length >= 2) parsed.push(cols);
                }
                if (parsed.length < 2) {
                    return { success: false, error: "Could not detect a table structure in this PDF — try CSV or Excel instead." };
                }
                tableRows = parsed;
            }

            // ── Map tableRows → BatchRowInput[] with fuzzy header detection ──
            const headerRow = tableRows[0];
            const lh = headerRow.map((h) => h.toLowerCase());

            const idxOf = (keywords: string[]) =>
                lh.findIndex((h) => keywords.some((kw) => h.includes(kw)));

            let medIdx     = idxOf(["medicine", "product", "drug", "name"]);
            let batchIdx   = idxOf(["batch", "lot", "code", "batch no", "batch#"]);
            let barcodeIdx = idxOf(["barcode", "gtin", "ean"]);
            let companyIdx = idxOf(["company", "manufacturer", "mfr", "mfg by", "made by"]);
            let expIdx     = idxOf(["exp", "expiry", "expiration", "best before"]);
            let mfgIdx     = idxOf(["mfg date", "manufacture date", "dom", "mfg", "manufacture"]);

            if (medIdx     === -1) medIdx     = 0;
            if (batchIdx   === -1) batchIdx   = 1;
            if (barcodeIdx === -1 && headerRow.length > 2)  barcodeIdx = -1; // don't default barcode
            if (companyIdx === -1 && headerRow.length > 3)  companyIdx = -1; // don't default company

            const dataRows = tableRows.slice(1);
            const rows: BatchRowInput[] = dataRows
                .map((cols) => ({
                    medicineName:  cols[medIdx]     ?? "",
                    batchCode:     cols[batchIdx]   ?? "",
                    barcode:       barcodeIdx !== -1 ? (cols[barcodeIdx] ?? null) : null,
                    companyName:   companyIdx !== -1 ? (cols[companyIdx] ?? null) : null,
                    expiryDate:    expIdx     !== -1 ? parseDate(cols[expIdx])     : null,
                    manufactureDate: mfgIdx   !== -1 ? parseDate(cols[mfgIdx])    : null,
                }))
                .filter((r) => r.medicineName || r.batchCode);

            if (rows.length === 0) {
                return { success: false, error: "Table was detected but no data rows could be mapped — check column headers. Try CSV or Excel instead." };
            }

            return { success: true, headers: headerRow, rows };

        } catch (err: any) {
            return { success: false, error: `PDF extraction failed: ${err?.message ?? "unknown error"}` };
        }
    }
}

// ─── Date parsing helpers ─────────────────────────────────────────────────────

function parseDate(val?: string): Date | null {
    if (!val) return null;
    const d = new Date(val.trim());
    return isNaN(d.getTime()) ? null : d;
}

function parseDateValue(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === "number") {
        // Excel serial date number
        const d = XLSX.SSF.parse_date_code(val);
        if (d) return new Date(d.y, d.m - 1, d.d);
    }
    if (typeof val === "string") return parseDate(val);
    return null;
}
