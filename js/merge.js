let file1Data = [];
let file2Data = [];
let mergedResults = null;

const progressElement = document.getElementById("progress");
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
  const cssClass = Number(value) >= 0 ? "diff-positive" : "diff-negative";
  return `<span class="${cssClass}">${escapeHtml(value)}</span>`;
}

function renderResultsTable(rows) {
  const gridDiv = document.querySelector("#myGrid");
  gridDiv.style.display = "block";
  const { keys, data } = objectsToRows(rows);
  createSiteTable(gridDiv, {
    columns: keys.map((key) => ({
      title: key,
      render: key.endsWith("Diff") ? diffRender : undefined,
    })),
    data,
  });
}

function fillSelect(selectElement, columns) {
  selectElement.replaceChildren();
  columns.forEach((column) => {
    const option = document.createElement("option");
    option.value = column;
    option.textContent = column;
    selectElement.appendChild(option);
  });
}

async function readExcel(file) {
  if (!file) throw new Error("No file provided");
  const arrBuf = await file.arrayBuffer();
  const workbook = XLSX.read(arrBuf, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

  return json.map((row) => {
    const normalized = {};
    Object.keys(row).forEach((columnKey) => {
      const key = String(columnKey).trim().toLowerCase();
      const value = row[columnKey];
      if (["character id", "id"].includes(key)) normalized.ID = value;
      else if (["username", "name"].includes(key)) normalized.Name = value;
      else if (["current power", "power"].includes(key)) normalized.Power = value;
      else if (["total kill points", "killpoints", "kills"].includes(key))
        normalized.Killpoints = value;
      else if (["deaths", "deads"].includes(key)) normalized.Deads = value;
      else if (["t4", "t4 kills", "tier 4 kills"].includes(key))
        normalized["T4 Kills"] = value;
      else if (["t5", "t5 kills", "tier 5 kills"].includes(key))
        normalized["T5 Kills"] = value;
      else if (["ch", "city hall", "cityhall", "city hall level"].includes(key))
        normalized.CH = value;
      else normalized[key] = value;
    });
    return normalized;
  });
}

async function handleFiles() {
  setExportEnabled(false);
  mergedResults = null;
  progressElement.value = 0;
  const file1 = document.getElementById("file1").files[0];
  const file2 = document.getElementById("file2").files[0];
  const selectors = document.getElementById("columnSelectors");

  if (!file1 || !file2) return;
  if (!/\.xlsx$/i.test(file1.name) || !/\.xlsx$/i.test(file2.name)) {
    showToast("Please select .xlsx files only.");
    return;
  }

  try {
    file1Data = await readExcel(file1);
    file2Data = await readExcel(file2);
  } catch (event) {
    console.error(event);
    showToast("Could not read the file: " + (event.message || event), "error");
    return;
  }

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
  const mergeButton = document.getElementById("mergeBtn");
  mergeButton.disabled = true;
  try {
    const idColumn = document.getElementById("idColumn").value;
    const sourceIdColumn = document.getElementById("sourceIdColumn").value;
    const mergeColumn = document.getElementById("mergeColumn").value;

    if (!idColumn || !sourceIdColumn || !mergeColumn)
      return showToast("Please select columns first.");

    progressElement.value = 10;

    const keyOf = (value) => (value == null ? "" : String(value).trim());
    const map = new Map();
    for (const row of file2Data) {
      const id = keyOf(row[sourceIdColumn]);
      if (!id) continue;
      map.set(id, row[mergeColumn]);
    }

    progressElement.value = 40;

    mergedResults = file1Data.map((row, index) => {
      if (index % 100 === 0) {
        progressElement.value = 40 + (index / file1Data.length) * 40;
      }
      const newValue = map.get(keyOf(row[idColumn]));
      if (newValue !== undefined) {
        return { ...row, [mergeColumn]: newValue };
      }
      return row;
    });

    progressElement.value = 80;
    if (!mergedResults || mergedResults.length === 0) {
      setExportEnabled(false);
      return;
    }

    renderResultsTable(mergedResults);

    progressElement.value = 100;
    resultsInfo.textContent = `Merged ${mergedResults.length} rows using File 1 ID "${idColumn}", File 2 ID "${sourceIdColumn}", and column "${mergeColumn}" from File 2.`;
    setExportEnabled(true);
  } finally {
    mergeButton.disabled = false;
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
