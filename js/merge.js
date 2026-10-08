let file1Data = [];
let file2Data = [];
let mergedResults = null;

const progressEl = document.getElementById("progress");
const resultsInfo = document.getElementById("merge-results-info");
function setExportEnabled(enabled) {
  ["export-xlsx", "export-csv", "export-json"].forEach((id) => {
    document.getElementById(id).disabled = !enabled;
  });
}

setExportEnabled(false);

function diffRender(value, type) {
  if (type !== "display" || value === null || value === undefined || value === "")
    return value ?? "";
  const cls = Number(value) >= 0 ? "diff-positive" : "diff-negative";
  return `<span class="${cls}">${escapeHtml(value)}</span>`;
}

function renderResultsTable(rows) {
  const gridDiv = document.querySelector("#myGrid");
  gridDiv.style.display = "block";
  const { keys, data } = objectsToRows(rows);
  createSiteTable(gridDiv, {
    columns: keys.map((k) => ({
      title: k,
      render: k.endsWith("Diff") ? diffRender : undefined,
    })),
    data,
  });
}

function fillSelect(selectEl, columns) {
  selectEl.replaceChildren();
  columns.forEach((col) => {
    const option = document.createElement("option");
    option.value = col;
    option.textContent = col;
    selectEl.appendChild(option);
  });
}

async function readExcel(file) {
  if (!file) throw new Error("No file provided");
  const arrBuf = await file.arrayBuffer();
  const wb = XLSX.read(arrBuf, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheet];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

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
      else normalized[key] = val;
    });
    return normalized;
  });
}

async function handleFiles() {
  setExportEnabled(false);
  mergedResults = null;
  progressEl.value = 0;
  const file1 = document.getElementById("file1").files[0];
  const file2 = document.getElementById("file2").files[0];
  const selectors = document.getElementById("columnSelectors");

  if (!file1 || !file2) return;
  if (!/\.xlsx$/i.test(file1.name) || !/\.xlsx$/i.test(file2.name)) {
    showToast("Please select .xlsx files only.");
    return;
  }

  file1Data = await readExcel(file1);
  file2Data = await readExcel(file2);

  if (!file1Data.length || !file2Data.length) return;

  const idSelect = document.getElementById("idColumn");
  const sourceIdSelect = document.getElementById("sourceIdColumn");
  const mergeSelect = document.getElementById("mergeColumn");
  const file1Columns = Object.keys(file1Data[0]);
  const file2Columns = Object.keys(file2Data[0]);

  fillSelect(idSelect, file1Columns);
  fillSelect(sourceIdSelect, file2Columns);
  fillSelect(mergeSelect, file2Columns);

  selectors.style.display = "block";
  document.getElementById("mergeBtn").disabled = false;
}

async function doMerge() {
  const mergeBtn = document.getElementById("mergeBtn");
  mergeBtn.disabled = true;
  try {
    const idColumn = document.getElementById("idColumn").value;
    const sourceIdColumn = document.getElementById("sourceIdColumn").value;
    const mergeColumn = document.getElementById("mergeColumn").value;

    if (!idColumn || !sourceIdColumn || !mergeColumn)
      return showToast("Please select columns first.");

    progressEl.value = 10;

    const map = new Map();
    for (const row of file2Data) {
      const id = row[sourceIdColumn];
      if (id == null) continue;
      map.set(id, row[mergeColumn]);
    }

    progressEl.value = 40;

    mergedResults = file1Data.map((row, i) => {
      if (i % 100 === 0) {
        progressEl.value = 40 + (i / file1Data.length) * 40;
      }
      const id = row[idColumn];
      const newVal = map.get(id);
      if (newVal !== undefined) {
        return { ...row, [mergeColumn]: newVal };
      }
      return row;
    });

    progressEl.value = 80;
    if (!mergedResults || mergedResults.length === 0) {
      setExportEnabled(false);
      return;
    }

    renderResultsTable(mergedResults);

    progressEl.value = 100;
    resultsInfo.textContent = `Merged ${mergedResults.length} rows using File 1 ID "${idColumn}", File 2 ID "${sourceIdColumn}", and column "${mergeColumn}" from File 2.`;
    setExportEnabled(true);
  } finally {
    mergeBtn.disabled = false;
  }
}

document.getElementById("file1").addEventListener("change", handleFiles);
document.getElementById("file2").addEventListener("change", handleFiles);
document.getElementById("mergeBtn").addEventListener("click", doMerge);
document
  .getElementById("export-xlsx")
  .addEventListener("click", () => exportToXlsx(mergedResults, "merge"));

document
  .getElementById("export-csv")
  .addEventListener("click", () => exportToCsv(mergedResults, "merge"));

document
  .getElementById("export-json")
  .addEventListener("click", () => exportToJson(mergedResults, "merge"));
