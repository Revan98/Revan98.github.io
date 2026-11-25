const padTwoDigits = (numericValue) => String(numericValue).padStart(2, "0");

function getExportTimestamp() {
  const now = new Date();
  const date = `${padTwoDigits(now.getDate())}-${padTwoDigits(now.getMonth() + 1)}-${now.getFullYear()}`;
  const time = `${padTwoDigits(now.getHours())}-${padTwoDigits(now.getMinutes())}`;
  return `${date}-T${time}-${crypto.randomUUID().split("-")[0]}`;
}

function getSheetDate() {
  const now = new Date();
  return `${padTwoDigits(now.getDate())}_${padTwoDigits(now.getMonth() + 1)}_${now.getFullYear()}`;
}

function buildExportName(suffix, extension) {
  return `${suffix}-${getExportTimestamp()}.${extension}`;
}

function isPercentColumn(header) {
  return typeof header === "string" && header.trim().endsWith("%");
}

function applyPercentFormats(worksheet, rows) {
  if (!rows || !rows.length) return;
  Object.keys(rows[0]).forEach((header, columnIndex) => {
    if (!isPercentColumn(header)) return;
    const columnLetter = XLSX.utils.encode_col(columnIndex);
    rows.forEach((_, rowIndex) => {
      const cell = worksheet[`${columnLetter}${rowIndex + 2}`];
      if (cell && typeof cell.v === "number") cell.z = "0.00%";
    });
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(url);
}

function hasExportRows(rows) {
  if (rows && rows.length) return true;
  showToast("No results to export.");
  return false;
}

function exportToXlsx(rows, name) {
  if (!hasExportRows(rows)) return;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  applyPercentFormats(worksheet, rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, getSheetDate());
  XLSX.writeFile(workbook, buildExportName(name, "xlsx"), { compression: true });
}

function exportToCsv(rows, name) {
  if (!hasExportRows(rows)) return;
  const columns = Object.keys(rows[0]);
  const quote = (value) => `"${String(csvSafeCell(value) ?? "").replace(/"/g, '""')}"`;
  const format = (column, value) =>
    isPercentColumn(column) && typeof value === "number" && Number.isFinite(value)
      ? `${(value * 100).toFixed(2)}%`
      : value;
  const csv = [
    columns.map(quote).join(","),
    ...rows.map((row) => columns.map((column) => quote(format(column, row[column]))).join(",")),
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
