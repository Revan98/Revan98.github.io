let comparedResults = { matching: [], nonMatching: [] };
const progressElement = document.getElementById("progressBar");
const resultsInfo = document.getElementById("compare-results-info");

function setExportEnabled(enabled) {
  ["export-xlsx", "export-csv", "export-json"].forEach((id) => {
    document.getElementById(id).disabled = !enabled;
  });
}

setExportEnabled(false);

async function readFile(file) {
  const name = file.name.toLowerCase();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (name.endsWith(".xlsx") || name.endsWith(".csv")) {
          const workbook = XLSX.read(event.target.result, { type: "array" });

          const first = workbook.SheetNames[0];
          resolve(XLSX.utils.sheet_to_json(workbook.Sheets[first], { defval: null }));
        } else if (name.endsWith(".json")) {
          resolve(JSON.parse(event.target.result));
        } else reject("Unsupported file format");
      } catch (error) {
        reject(error);
      }
    };
    if (name.endsWith(".xlsx") || name.endsWith(".csv"))
      reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  });
}

function compareRows(row1, row2, prefix1 = "File1_", prefix2 = "File2_") {
  const compared = {};
  if (row1)
    for (const [key, value] of Object.entries(row1)) compared[prefix1 + key] = value;
  if (row2)
    for (const [key, value] of Object.entries(row2)) compared[prefix2 + key] = value;
  return compared;
}

function hasDuplicateKeys(data, key) {
  const seen = new Set();
  for (const row of data) {
    const keyValue = row[key] == null ? row[key] : String(row[key]).trim();
    if (seen.has(keyValue)) return true;
    seen.add(keyValue);
  }
  return false;
}

function compareData(firstRows, secondRows, keyColumn, option) {
  const normalizeKey = (value) =>
    value === null || value === undefined ? value : String(value).trim();
  if (hasDuplicateKeys(firstRows, keyColumn) || hasDuplicateKeys(secondRows, keyColumn)) {
    console.warn(
      "Duplicate key values detected; later rows overwrite earlier ones.",
    );
    showToast(
      "Duplicate key values found: later rows overwrite earlier ones, so some rows are missing from the result.",
    );
  }
  const map1 = new Map(firstRows.map((row) => [normalizeKey(row[keyColumn]), row]));
  const map2 = new Map(secondRows.map((row) => [normalizeKey(row[keyColumn]), row]));
  const allKeys = new Set([...map1.keys(), ...map2.keys()]);

  const matching = [];
  const nonMatching = [];

  for (const key of allKeys) {
    const existsInFirst = map1.has(key);
    const existsInSecond = map2.has(key);

    if (existsInFirst && existsInSecond) {
      matching.push(compareRows(map1.get(key), map2.get(key)));
    } else if (
      option === "both" ||
      (option === "pierwszy" && existsInFirst) ||
      (option === "drugi" && existsInSecond)
    ) {
      nonMatching.push(
        compareRows(existsInFirst ? map1.get(key) : null, existsInSecond ? map2.get(key) : null),
      );
    }
  }
  return { matching, nonMatching };
}

function renderCompareTable(containerId, label, rows, emptyText) {
  const element = document.getElementById(containerId);
  element.style.display = "block";
  if (!rows.length) {
    destroySiteTable(element);
    element.innerHTML = `<div class="muted">${emptyText}</div>`;
    return;
  }
  const { keys, data } = objectsToRows(rows);
  createSiteTable(element, {
    title: `${label} (${rows.length.toLocaleString()} rows)`,
    columns: keys.map((key) => ({ title: key })),
    data,
  });
}

function renderResultsGrids(matchingRows, nonMatchingRows) {
  renderCompareTable("matching-table", "Matching rows", matchingRows, "No matching rows.");
  renderCompareTable(
    "nonmatching-table",
    "Non-matching rows",
    nonMatchingRows,
    "No non-matching rows.",
  );
}

document.getElementById("compareBtn").addEventListener("click", async () => {
  setExportEnabled(false);
  const file1 = document.getElementById("file1").files[0];
  const file2 = document.getElementById("file2").files[0];
  const keyColumn = document.getElementById("keyColumn").value.trim();
  const option = document.getElementById("compareOption").value;
  if (!file1 || !file2 || !keyColumn)
    return showToast("Please select both files and a key column.");
  if (!/\.xlsx$/i.test(file1.name) || !/\.xlsx$/i.test(file2.name)) {
    return showToast("Please select .xlsx files only.");
  }

  progressElement.value = 5;
  resultsInfo.textContent = "Reading files...";

  try {
    const firstRows = await readFile(file1);
    progressElement.value = 30;
    const secondRows = await readFile(file2);
    progressElement.value = 60;
    if (!firstRows.length || !secondRows.length) {
      showToast("One of the files is empty.");
      return;
    }

    if (!(keyColumn in firstRows[0]) || !(keyColumn in secondRows[0])) {
      showToast(`Key column "${keyColumn}" not found in both files.`);
      return;
    }
    const { matching, nonMatching } = compareData(firstRows, secondRows, keyColumn, option);
    comparedResults = { matching, nonMatching };
    renderResultsGrids(matching, nonMatching);
    progressElement.value = 100;
    resultsInfo.textContent = `Comparison complete: ${matching.length} matching, ${nonMatching.length} non-matching rows.`;
    setExportEnabled(matching.length > 0 || nonMatching.length > 0);
  } catch (error) {
    console.error(error);
    showToast("Error: " + error);
    progressElement.value = 0;
    resultsInfo.textContent = "Comparison failed.";
  }
});

document.getElementById("export-xlsx").addEventListener("click", () => {
  if (!comparedResults.matching.length && !comparedResults.nonMatching.length)
    return showToast("No results to export yet.");
  exportToXlsx(comparedResults.matching, "compare_matching");
  if (comparedResults.nonMatching.length)
    exportToXlsx(comparedResults.nonMatching, "compare_nonmatching");
});

document.getElementById("export-csv").addEventListener("click", () => {
  if (!comparedResults.matching.length && !comparedResults.nonMatching.length)
    return showToast("No results to export yet.");
  exportToCsv(comparedResults.matching, "compare_matching");
  if (comparedResults.nonMatching.length)
    exportToCsv(comparedResults.nonMatching, "compare_nonmatching");
});

document.getElementById("export-json").addEventListener("click", () => {
  if (!comparedResults.matching.length && !comparedResults.nonMatching.length)
    return showToast("No results to export yet.");
  exportToJson(comparedResults.matching, "compare_matching");
  if (comparedResults.nonMatching.length)
    exportToJson(comparedResults.nonMatching, "compare_nonmatching");
});
