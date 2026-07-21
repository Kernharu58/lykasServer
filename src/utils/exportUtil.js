// Lightweight CSV exporter (no external dependency). For Excel-native files,
// see toExcelBuffer below which uses `exceljs` if it's installed
// (`npm install exceljs`) — falls back to CSV automatically if it isn't.

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * @param {Array<Object>} rows - flat objects (already shaped for export)
 * @param {Array<String>} [columns] - explicit column order; defaults to keys of first row
 * @returns {String} CSV text
 */
const toCsv = (rows, columns) => {
  if (!rows || rows.length === 0) return "";
  const cols = columns || Object.keys(rows[0]);
  const header = cols.join(",");
  const lines = rows.map((row) => cols.map((col) => escapeCsvValue(row[col])).join(","));
  return [header, ...lines].join("\n");
};

const sendCsv = (res, filename, rows, columns) => {
  const csv = toCsv(rows, columns);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
};

// Excel export — requires `npm install exceljs`. If it's not installed yet,
// falls back to CSV so the endpoint doesn't hard-crash before you run
// npm install.
const sendExcel = async (res, filename, rows, columns) => {
  let ExcelJS;
  try {
    ExcelJS = require("exceljs");
  } catch (err) {
    // exceljs not installed — degrade gracefully to CSV
    return sendCsv(res, filename.replace(/\.xlsx$/, ".csv"), rows, columns);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Export");
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  sheet.columns = cols.map((col) => ({ header: col, key: col, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

// PDF export — requires `npm install pdfkit`. Falls back to CSV if missing.
const sendPdf = async (res, filename, title, rows, columns) => {
  let PDFDocument;
  try {
    PDFDocument = require("pdfkit");
  } catch (err) {
    return sendCsv(res, filename.replace(/\.pdf$/, ".csv"), rows, columns);
  }

  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
  doc.pipe(res);
  doc.fontSize(16).text(title || "Export", { align: "center" });
  doc.moveDown();
  doc.fontSize(8);
  rows.forEach((row) => {
    const line = cols.map((c) => `${c}: ${row[c] ?? ""}`).join("  |  ");
    doc.text(line);
    doc.moveDown(0.3);
  });
  doc.end();
};

module.exports = { toCsv, sendCsv, sendExcel, sendPdf };
