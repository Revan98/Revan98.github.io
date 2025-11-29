let comparedResults = { matching: [], nonMatching: [] };
const progressEl = document.getElementById("progressBar");
const resultsWrap = document.getElementById("compare-results-wrap");
const resultsInfo = document.getElementById("compare-results-info");

/* Simple query helper */
const qs = (sel) => document.querySelector(sel);
const themeToggle = qs("#toggle-theme");

// Read Excel/CSV/JSON
async function readFile(file) {
  const name = file.name.toLowerCase();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (name.endsWith(".xlsx") || name.endsWith(".csv")) {
          const wb = XLSX.read(e.target.result, { type: "binary" });
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
      reader.readAsBinaryString(file);
    else reader.readAsText(file);
  });
}

// Compare logic
function compareRows(row1, row2, prefix1 = "File1_", prefix2 = "File2_") {
  const compared = {};
  if (row1)
    for (const [k, v] of Object.entries(row1)) compared[prefix1 + k] = v;
  if (row2)
    for (const [k, v] of Object.entries(row2)) compared[prefix2 + k] = v;
  return compared;
}

function compareData(df1, df2, keyColumn, option) {
  const map1 = new Map(df1.map((r) => [r[keyColumn], r]));
  const map2 = new Map(df2.map((r) => [r[keyColumn], r]));
  const allKeys = new Set([...map1.keys(), ...map2.keys()]);

  const matching = [];
  const nonMatching = [];

  for (const key of allKeys) {
    const in1 = map1.has(key);
    const in2 = map2.has(key);

    if (in1 && in2) {
      // matched in both files
      matching.push(compareRows(map1.get(key), map2.get(key)));
    } else if (
      option === "both" ||
      (option === "pierwszy" && in1) ||
      (option === "drugi" && in2)
    ) {
      // unmatched in one or both files
      nonMatching.push(
        compareRows(in1 ? map1.get(key) : null, in2 ? map2.get(key) : null)
      );
    }
  }
  return { matching, nonMatching };
}

// Render tables
function renderResultsTables(matchRows, nonMatchRows) {
  resultsWrap.innerHTML = "";

  const makeTable = (rows, title) => {
    const section = document.createElement("div");
    section.innerHTML = `<h3>${title}</h3>`;
    const table = document.createElement("table");

    if (!rows.length) {
      section.innerHTML += `<div class="muted">No ${title.toLowerCase()} rows.</div>`;
      return section;
    }

    const columns = Object.keys(rows[0]);
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr>" + columns.map((c) => `<th>${c}</th>`).join("") + "</tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const max = Math.min(rows.length, 10);
    for (let i = 0; i < max; i++) {
      const r = rows[i];
      const tr = document.createElement("tr");
      tr.innerHTML = columns.map((c) => `<td>${r[c] ?? ""}</td>`).join("");
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    section.appendChild(table);
    return section;
  };

  resultsWrap.appendChild(makeTable(matchRows, "Matching Rows (Top 10)"));
  resultsWrap.appendChild(
    makeTable(nonMatchRows, "Non-Matching Rows (Top 10)")
  );
}

// Export helpers
function exportToXlsx(data, name) {
  if (!data || !data.length) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Compare");
  XLSX.writeFile(
    wb,
    `${name}_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`
  );
}

function exportToCsv(data, name) {
  if (!data || !data.length) return;

  const columns = Object.keys(data[0]);

  // Escape CSV fields properly
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const csv =
    columns.map(escape).join(",") +
    "\n" +
    data
      .map((row) => columns.map((col) => escape(row[col])).join(","))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToJson(data, name) {
  if (!data || !data.length) return;

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Compare button
document.getElementById("compareBtn").addEventListener("click", async () => {
  const file1 = document.getElementById("file1").files[0];
  const file2 = document.getElementById("file2").files[0];
  const keyCol = document.getElementById("keyColumn").value.trim();
  const option = document.getElementById("compareOption").value;
  if (!file1 || !file2 || !keyCol)
    return alert("Please select both files and a key column.");

  progressEl.value = 5;
  resultsInfo.textContent = "Reading files...";

  try {
    const df1 = await readFile(file1);
    progressEl.value = 30;
    const df2 = await readFile(file2);
    progressEl.value = 60;

    const { matching, nonMatching } = compareData(df1, df2, keyCol, option);
    comparedResults = { matching, nonMatching };
    renderResultsTables(matching, nonMatching);
    progressEl.value = 100;
    resultsInfo.textContent = `Comparison complete: ${matching.length} matching, ${nonMatching.length} non-matching rows.`;
  } catch (err) {
    console.error(err);
    alert("Error: " + err);
  }
});

// Export buttons (save separate files)
document.getElementById("export-xlsx").addEventListener("click", () => {
  if (!comparedResults.matching.length && !comparedResults.nonMatching.length)
    return alert("No results to export yet.");
  exportToXlsx(comparedResults.matching, "compare_matching");
  if (comparedResults.nonMatching.length)
    exportToXlsx(comparedResults.nonMatching, "compare_nonmatching");
});

document.getElementById("export-csv").addEventListener("click", () => {
  if (!comparedResults.matching.length && !comparedResults.nonMatching.length)
    return alert("No results to export yet.");
  exportToCsv(comparedResults.matching, "compare_matching");
  if (comparedResults.nonMatching.length)
    exportToCsv(comparedResults.nonMatching, "compare_nonmatching");
});

document.getElementById("export-json").addEventListener("click", () => {
  if (!comparedResults.matching.length && !comparedResults.nonMatching.length)
    return alert("No results to export yet.");
  exportToJson(comparedResults.matching, "compare_matching");
  if (comparedResults.nonMatching.length)
    exportToJson(comparedResults.nonMatching, "compare_nonmatching");
});

// Theme + hamburger menu
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
