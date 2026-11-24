/**
 * SEC-03: Secure Excel Import/Export Helper powered by ExcelJS.
 * Replaces vulnerable `xlsx@0.18.5` (Prototype Pollution / ReDoS CVEs) across all panels & reports.
 */
import ExcelJS from "exceljs";

function sanitizeSheetName(name) {
  const clean = String(name || "Sayfa1")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim();
  return (clean || "Sayfa1").slice(0, 31);
}

function triggerBrowserDownload(buffer, fileName) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function addJsonRowsToWorksheet(wb, sheetName, rows) {
  const ws = wb.addWorksheet(sanitizeSheetName(sheetName));
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) return ws;

  const colSet = new Set();
  for (const r of safeRows) {
    if (r && typeof r === "object") {
      Object.keys(r).forEach((k) => colSet.add(k));
    }
  }
  const headers = Array.from(colSet);
  ws.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.min(48, Math.max(14, String(h).length + 4))
  }));

  for (const r of safeRows) {
    if (!r || typeof r !== "object") continue;
    const rowObj = {};
    for (const h of headers) {
      const val = r[h];
      rowObj[h] = val === undefined || val === null ? "" : val;
    }
    ws.addRow(rowObj);
  }

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  return ws;
}

export async function exportJsonToExcel(rows, sheetName = "Veri", fileName = "export.xlsx") {
  const wb = new ExcelJS.Workbook();
  addJsonRowsToWorksheet(wb, sheetName, rows);
  const buffer = await wb.xlsx.writeBuffer();
  triggerBrowserDownload(buffer, fileName);
}

export async function exportSheetsToExcel(sheets, fileName = "rapor.xlsx") {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets || []) {
    if (!s) continue;
    addJsonRowsToWorksheet(wb, s.name || "Sayfa", s.rows || []);
  }
  const buffer = await wb.xlsx.writeBuffer();
  triggerBrowserDownload(buffer, fileName);
}

function normalizeCellValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val.richText)) {
      return val.richText.map((t) => t?.text || "").join("");
    }
    if (val.text !== undefined) return String(val.text);
    if (val.result !== undefined) return val.result;
    return String(val);
  }
  return val;
}

export async function readExcelFileToJson(file) {
  const wb = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headers = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const label = String(normalizeCellValue(cell.value) || "").trim();
    headers[colNumber] = label || `Col_${colNumber}`;
  });

  const result = [];
  for (let rowIdx = 2; rowIdx <= ws.rowCount; rowIdx += 1) {
    const row = ws.getRow(rowIdx);
    const obj = {};
    let hasAnyValue = false;
    for (let colIdx = 1; colIdx < headers.length; colIdx += 1) {
      const key = headers[colIdx];
      if (!key) continue;
      const val = normalizeCellValue(row.getCell(colIdx).value);
      if (val !== "" && val !== null && val !== undefined) {
        hasAnyValue = true;
        obj[key] = val;
      }
    }
    if (hasAnyValue) {
      result.push(obj);
    }
  }
  return result;
}

/**
 * Drop-in workbook builder API compatible with existing panel & multi-sheet report exports,
 * backed completely by secure ExcelJS (zero SheetJS/xlsx dependency).
 */
export const utils = {
  book_new() {
    return { _sheets: [] };
  },
  json_to_sheet(rows) {
    return { _rows: Array.isArray(rows) ? rows : [] };
  },
  book_append_sheet(wb, ws, name) {
    if (wb && Array.isArray(wb._sheets)) {
      wb._sheets.push({ name: name || `Sayfa${wb._sheets.length + 1}`, rows: ws?._rows || [] });
    }
  }
};

export function writeFile(wb, fileName = "export.xlsx") {
  const sheets = wb && Array.isArray(wb._sheets) ? wb._sheets : [];
  return exportSheetsToExcel(sheets, fileName);
}

export const readFileToJson = readExcelFileToJson;

