let file1Data = [];
let file2Data = [];
let mergedResults = null;
const progressEl = document.getElementById("progress");
const resultsWrap = document.getElementById("merge-results-wrap");
const resultsInfo = document.getElementById("merge-results-info");

/* Simple query helper */
const qs = (sel) => document.querySelector(sel);
const themeToggle = qs("#toggle-theme");

// Utility: read spreadsheet file (.xlsx or .csv) with header normalization
async function readExcel(file) {
  if (!file) throw new Error("No file provided");
  const arrBuf = await file.arrayBuffer();
  const wb = XLSX.read(arrBuf, { type: "array" });
  const first = wb.SheetNames[0];
  const sheet = wb.Sheets[first];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

  // Normalize header keys: lowercase & trimmed & mapping to expected columns
  return json.map((row) => {
    const normalized = {};
    Object.keys(row).forEach((k) => {
      const key = String(k).trim().toLowerCase();
      const val = row[k];
      if (["character id", "id"].includes(key)) normalized.ID = val;
      else if (["username", "name"].includes(key)) normalized.Name = val;
      else if (["current power", "power"].includes(key)) normalized.Power = val;
      else if (["total kill points", "killpoints", "kills"].includes(key))
        normalized.Killpoints = val;
      else if (["deaths", "deads"].includes(key)) normalized.Deads = val;
      else if (["t4", "t4 kills", "tier 4 kills"].includes(key))
        normalized["T4 Kills"] = val;
      else if (["t5", "t5 kills", "tier 5 kills"].includes(key))
        normalized["T5 Kills"] = val;
      else if (["ch", "city hall", "cityhall", "city hall level"].includes(key))
        normalized.CH = val;
      else normalized[k] = val; // keep other columns
    });
    return normalized;
  });
}

// File handling
async function handleFiles() {
  const file1 = document.getElementById("file1").files[0];
  const file2 = document.getElementById("file2").files[0];
  const selectors = document.getElementById("columnSelectors");

  if (!file1 || !file2) return;

  file1Data = await readExcel(file1);
  file2Data = await readExcel(file2);

  if (!file1Data.length || !file2Data.length) return;

  const idSelect = document.getElementById("idColumn");
  const mergeSelect = document.getElementById("mergeColumn");
  idSelect.innerHTML = "";
  mergeSelect.innerHTML = "";

  Object.keys(file1Data[0]).forEach((col) => {
    idSelect.innerHTML += `<option value="${col}">${col}</option>`;
  });
  Object.keys(file2Data[0]).forEach((col) => {
    mergeSelect.innerHTML += `<option value="${col}">${col}</option>`;
  });

  selectors.style.display = "block";
  document.getElementById("mergeBtn").disabled = false;
}

// Merge logic
function mergeData(file1Data, file2Data, idColumn, mergeColumn) {
  const map = {};
  for (const row of file2Data) {
    map[row[idColumn]] = row[mergeColumn];
  }

  return file1Data.map((row) => {
    const id = row[idColumn];
    if (map[id] !== undefined) {
      return { ...row, [mergeColumn]: map[id] };
    }
    return row;
  });
}

// Rendering results
function renderResultsTable(rows) {
  resultsWrap.innerHTML = "";
  if (!rows || rows.length === 0) {
    resultsInfo.textContent = "No results.";
    return;
  }

  const max = Math.min(rows.length, 15);
  const table = document.createElement("table");
  const columns = Object.keys(rows[0]);

  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr>" + columns.map((c) => `<th>${c}</th>`).join("") + "</tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let i = 0; i < max; i++) {
    const r = rows[i];
    const tr = document.createElement("tr");
    tr.innerHTML = columns
      .map((c) => `<td>${String(r[c] ?? "")}</td>`)
      .join("");
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  resultsWrap.appendChild(table);
}

// Export: XLSX / CSV / JSON
function exportToXlsx(rows) {
  if (!rows) return alert("No results to export.");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Merged");
  XLSX.writeFile(
    wb,
    `merge_output_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`
  );
}

function exportToCsv(rows) {
  if (!rows) return alert("No results to export.");

  const columns = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`; // proper CSV escaping

  const csv =
    columns.map(escape).join(",") +
    "\n" +
    rows
      .map((row) => columns.map((col) => escape(row[col])).join(","))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `merge_output_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportToJson(rows) {
  if (!rows) return alert("No results to export.");

  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `merge_output_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Main merge execution
async function doMerge() {
  const idColumn = document.getElementById("idColumn").value;
  const mergeColumn = document.getElementById("mergeColumn").value;

  if (!idColumn || !mergeColumn) return alert("Please select columns first.");

  progressEl.value = 10;

  // Build a lookup map from file2
  const map = {};
  for (const row of file2Data) {
    map[row[idColumn]] = row[mergeColumn];
  }

  progressEl.value = 40;

  // Merge into file1Data
  const merged = file1Data.map((row) => {
    const id = row[idColumn];
    const newVal = map[id];
    if (newVal !== undefined) {
      return { ...row, [mergeColumn]: newVal };
    }
    return row;
  });

  progressEl.value = 80;

  mergedResults = merged;
  renderResultsTable(merged);
  progressEl.value = 100;
  resultsInfo.textContent = `Merged ${merged.length} rows using ID "${idColumn}" and column "${mergeColumn}" from File 2.`;
}

/* -------------------------
   THEME HANDLING
   ------------------------- */
function setTheme(mode) {
  document.body.classList.remove("dark", "light");
  if (mode === "dark") document.body.classList.add("dark");
  if (mode === "light") document.body.classList.add("light");
  localStorage.setItem("theme", mode);
}

function initializeTheme(toggleEl) {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    setTheme("dark");
    if (toggleEl) toggleEl.checked = true;
    return;
  }
  if (saved === "light") {
    setTheme("light");
    if (toggleEl) toggleEl.checked = false;
    return;
  }
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(prefersDark ? "dark" : "light");
  if (toggleEl) toggleEl.checked = prefersDark;
}
// Theme init & toggle
initializeTheme(themeToggle);
if (themeToggle) {
  themeToggle.addEventListener("change", (e) => {
    setTheme(e.target.checked ? "dark" : "light");
  });
}

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
hamburger.addEventListener("click", () => navLinks.classList.toggle("show"));

document
  .getElementById("export-xlsx")
  .addEventListener("click", () => exportToXlsx(mergedResults));
document
  .getElementById("export-csv")
  .addEventListener("click", () => exportToCsv(mergedResults));
document
  .getElementById("export-json")
  .addEventListener("click", () => exportToJson(mergedResults));
