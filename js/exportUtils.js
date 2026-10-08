/* ==========================================================================
   exportUtils.js — XLSX / CSV / JSON downloads used by the tool pages
   (compare, merge, dkp). Columns whose header ends in "%" are written as
   percentages.  Depends on: common.js (showToast), SheetJS (XLSX).
   Usage: exportToXlsx(rows, "merge") -> merge-<timestamp>.xlsx
   ========================================================================== */

const pad2 = (n) => String(n).padStart(2, "0");

function getExportTimestamp() {
  const now = new Date();
  const date = `${pad2(now.getDate())}-${pad2(now.getMonth() + 1)}-${now.getFullYear()}`;
  const time = `${pad2(now.getHours())}-${pad2(now.getMinutes())}`;
  return `${date}-T${time}-${crypto.randomUUID().split("-")[0]}`;
}

function getSheetDate() {
  const now = new Date();
  return `${pad2(now.getDate())}_${pad2(now.getMonth() + 1)}_${now.getFullYear()}`;
}

function buildExportName(suffix, ext) {
  return `${suffix}-${getExportTimestamp()}.${ext}`;
}

function isPercentColumn(header) {
  return typeof header === "string" && header.trim().endsWith("%");
}

function applyPercentFormats(ws, rows) {
  if (!rows || !rows.length) return;
  Object.keys(rows[0]).forEach((header, colIdx) => {
    if (!isPercentColumn(header)) return;
    const colLetter = XLSX.utils.encode_col(colIdx);
    rows.forEach((_, rowIdx) => {
      const cell = ws[`${colLetter}${rowIdx + 2}`];
      if (cell && typeof cell.v === "number") cell.z = "0.00%";
    });
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function hasExportRows(rows) {
  if (rows && rows.length) return true;
  showToast("No results to export.");
  return false;
}

function exportToXlsx(rows, name) {
  if (!hasExportRows(rows)) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  applyPercentFormats(ws, rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, getSheetDate());
  XLSX.writeFile(wb, buildExportName(name, "xlsx"), { compression: true });
}

function exportToCsv(rows, name) {
  if (!hasExportRows(rows)) return;
  const columns = Object.keys(rows[0]);
  const quote = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const format = (col, v) =>
    isPercentColumn(col) && typeof v === "number" && Number.isFinite(v)
      ? `${(v * 100).toFixed(2)}%`
      : v;
  const csv = [
    columns.map(quote).join(","),
    ...rows.map((row) => columns.map((c) => quote(format(c, row[c]))).join(",")),
  ].join("\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    buildExportName(name, "csv"),
  );
}

function exportToJson(rows, name) {
  if (!hasExportRows(rows)) return;
  downloadBlob(
    new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
    buildExportName(name, "json"),
  );
}
