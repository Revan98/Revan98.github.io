let comparedResults = { matching: [], nonMatching: [] };
const progressEl = document.getElementById("progressBar");
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
    reader.onload = (e) => {
      try {
        if (name.endsWith(".xlsx") || name.endsWith(".csv")) {
          const wb = XLSX.read(e.target.result, { type: "array" });

          const first = wb.SheetNames[0];
          resolve(XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: null }));
        } else if (name.endsWith(".json")) {
          resolve(JSON.parse(e.target.result));
        } else reject("Unsupported file format");
      } catch (err) {
        reject(err);
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
    for (const [k, v] of Object.entries(row1)) compared[prefix1 + k] = v;
  if (row2)
    for (const [k, v] of Object.entries(row2)) compared[prefix2 + k] = v;
  return compared;
}

function hasDuplicateKeys(data, key) {
  const seen = new Set();
  for (const r of data) {
    const k = r[key] == null ? r[key] : String(r[key]).trim();
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

function compareData(df1, df2, keyColumn, option) {
  const normalizeKey = (v) =>
    v === null || v === undefined ? v : String(v).trim();
  if (hasDuplicateKeys(df1, keyColumn) || hasDuplicateKeys(df2, keyColumn)) {
    console.warn(
      "Duplicate key values detected; later rows overwrite earlier ones.",
    );
  }
  const map1 = new Map(df1.map((r) => [normalizeKey(r[keyColumn]), r]));
  const map2 = new Map(df2.map((r) => [normalizeKey(r[keyColumn]), r]));
  const allKeys = new Set([...map1.keys(), ...map2.keys()]);

  const matching = [];
  const nonMatching = [];

  for (const key of allKeys) {
    const in1 = map1.has(key);
    const in2 = map2.has(key);

    if (in1 && in2) {
      matching.push(compareRows(map1.get(key), map2.get(key)));
    } else if (
      option === "both" ||
      (option === "pierwszy" && in1) ||
      (option === "drugi" && in2)
    ) {
      nonMatching.push(
        compareRows(in1 ? map1.get(key) : null, in2 ? map2.get(key) : null),
      );
    }
  }
  return { matching, nonMatching };
}

function renderCompareTable(containerId, label, rows, emptyText) {
  const el = document.getElementById(containerId);
  el.style.display = "block";
  if (!rows.length) {
    destroySiteTable(el);
    el.innerHTML = `<div class="muted">${emptyText}</div>`;
    return;
  }
  const { keys, data } = objectsToRows(rows);
  createSiteTable(el, {
    title: `${label} (${rows.length.toLocaleString()} rows)`,
    columns: keys.map((k) => ({ title: k })),
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
  const keyCol = document.getElementById("keyColumn").value.trim();
  const option = document.getElementById("compareOption").value;
  if (!file1 || !file2 || !keyCol)
    return showToast("Please select both files and a key column.");
  if (!/\.xlsx$/i.test(file1.name) || !/\.xlsx$/i.test(file2.name)) {
    return showToast("Please select .xlsx files only.");
  }

  progressEl.value = 5;
  resultsInfo.textContent = "Reading files...";

  try {
    const df1 = await readFile(file1);
    progressEl.value = 30;
    const df2 = await readFile(file2);
    progressEl.value = 60;
    if (!df1.length || !df2.length) {
      showToast("One of the files is empty.");
      return;
    }

    if (!(keyCol in df1[0]) || !(keyCol in df2[0])) {
      showToast(`Key column "${keyCol}" not found in both files.`);
      return;
    }
    const { matching, nonMatching } = compareData(df1, df2, keyCol, option);
    comparedResults = { matching, nonMatching };
    if (!comparedResults || comparedResults.length === 0) {
      setExportEnabled(false);
      return;
    }
    renderResultsGrids(matching, nonMatching);
    progressEl.value = 100;
    resultsInfo.textContent = `Comparison complete: ${matching.length} matching, ${nonMatching.length} non-matching rows.`;
    setExportEnabled(true);
  } catch (err) {
    console.error(err);
    showToast("Error: " + err);
    progressEl.value = 0;
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
