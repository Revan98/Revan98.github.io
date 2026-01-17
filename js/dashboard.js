const CONFIG = {
  sources: [
    {
      id: "main",
      kd: "2247",
      name: "KD2247",
      sheetUrl:
        "https://docs.google.com/spreadsheets/d/1LHAa5r_coFO5XGCuqmZe6BrMmfanlq7Ds9TVIX_ekps/edit?usp=sharing",
    },
    {
      id: "backup",
      kd: "2552",
      name: "KD2552",
      sheetUrl:
        "https://docs.google.com/spreadsheets/d/1HS6wcMWCzLR4PVhYJA_8rFzUuqaYvwUilD2zffq9YNE/edit?usp=sharing",
    },
  ],
};

const API_KEY = "AIzaSyAPP27INsgILZBAigyOm-g31djFgYlU7VY";

const SheetCache = {
  sheetsList: [],
  sheetsData: {},
  lastSheetData: null,
};

const qs = (sel) => document.querySelector(sel);

function extractSheetId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
function getKDFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("kd");
}
function getSelectedSource() {
  const kd = getKDFromURL();
  if (!kd) return null;

  return CONFIG.sources.find((src) => src.kd === kd) || null;
}

// Load all sheets into RAM
/* async function loadAllSheetsCache() {
  const source = getSelectedSource();

  if (!source) {
    alert("Invalid or missing KD parameter.");
    return;
  }

  const SPREADSHEET_ID = extractSheetId(source.sheetUrl);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();

  SheetCache.sheetsList = json.sheets.map((s) => s.properties.title);
  const lastSheet = SheetCache.sheetsList.at(-1);

  for (const sheetName of SheetCache.sheetsList) {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?key=${API_KEY}`;
    const resSheet = await fetch(sheetUrl);
    const sheetJson = await resSheet.json();

    if (!sheetJson.values) continue;

    const headers = sheetJson.values[0];
    const rows = sheetJson.values.slice(1);

    SheetCache.sheetsData[sheetName] = { headers, rows };

    if (sheetName === lastSheet) SheetCache.lastSheetData = { headers, rows };
  }
} */
function normalizeSheetName(rangeStr) {
  let name = rangeStr.split("!")[0];

  if (name.startsWith("'") && name.endsWith("'")) {
    name = name.slice(1, -1);
  }

  return name;
}
async function safeFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function loadAllSheetsCache() {
  try {
    const source = getSelectedSource();

    if (!source) {
      alert("Invalid or missing KD parameter.");
      return;
    }

    const SPREADSHEET_ID = extractSheetId(source.sheetUrl);

    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`;

    const metaJson = await safeFetch(metaUrl);

    SheetCache.sheetsList = metaJson.sheets.map((s) => s.properties.title);

    const lastSheet = SheetCache.sheetsList.at(-1);

    const ranges = SheetCache.sheetsList
      .map((name) => `ranges=${encodeURIComponent(`'${name}'`)}`)
      .join("&");

    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${ranges}&key=${API_KEY}`;

    const batchRes = await fetch(batchUrl);
    const batchJson = await batchRes.json();

    let lastNonEmptySheet = null;

    batchJson.valueRanges.forEach((range) => {
      const sheetName = normalizeSheetName(range.range);
      const values = range.values;

      if (!values || values.length === 0) return;

      const headers = values[0];
      const rows = values.slice(1);

      SheetCache.sheetsData[sheetName] = { headers, rows };
      lastNonEmptySheet = sheetName;
    });

    if (lastNonEmptySheet) {
      SheetCache.lastSheetData = SheetCache.sheetsData[lastNonEmptySheet];
    }
  } catch (err) {
    console.error("Sheet load failed:", err);
    alert("Failed to load spreadsheet data.");
  }
}

function formatNumber(val) {
  if (val === undefined || val === null || val === "") return val;
  if (isNaN(val)) return val;
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 0 });
}

const num = (v) => Number(v) || 0;
const COL = {
  ID: 0,
  NAME: 1,
  POWER: 2,
  KP_DIFF: 3,
  T4_DIFF: 4,
  T5_DIFF: 5,
  DEADS_DIFF: 6,
  DKP: 8,
  DKP_PERCENT: 9,
  EXCLUDED: 10,
  STATUS: 11,
  T4: 12,
  T5: 13,
  KP: 14,
  DEADS: 15,
  POWER_DIFF: 16,
  ACCLAIM: 17,
};

let gridApi;

function buildRowDataFromSheet(rows) {
  return rows
    .filter((r) => String(r[COL.EXCLUDED]).trim().toUpperCase() !== "YES")
    .map((r) => ({
      id: r[COL.ID],
      name: r[COL.NAME],
      power: num(r[COL.POWER]),
      powerDiff: num(r[COL.POWER_DIFF]),

      killPoints: num(r[COL.KP]),
      killPointsDiff: num(r[COL.KP_DIFF]),

      t4: num(r[COL.T4]),
      t4Diff: num(r[COL.T4_DIFF]),

      t5: num(r[COL.T5]),
      t5Diff: num(r[COL.T5_DIFF]),

      deads: num(r[COL.DEADS]),
      deadsDiff: num(r[COL.DEADS_DIFF]),

      dkp: num(r[COL.DKP]),
      dkpPercent: r[COL.DKP_PERCENT],
      status: r[COL.STATUS],
      acclaim: r[COL.ACCLAIM],
    }));
}

const gridOptions = {
  rowData: [],
  columnDefs: [
    {
      headerName: "ID",
      field: "id",
      sortable: false,
    },
    { headerName: "Name", field: "name" },

    {
      headerName: "Power",
      field: "powerDiff",
      comparator: (a, b) => a - b,

      valueFormatter: (params) => {
        const v = Number(params.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },

      cellClass: (params) =>
        Number(params.value) >= 0 ? "diff-positive" : "diff-negative",

      tooltipValueGetter: (params) => {
        const base = Number(params.data?.power || 0).toLocaleString("en-US");
        return `Starting Power: ${base}`;
      },

      getQuickFilterText: () => "",
    },
    {
      headerName: "Killpoints",
      field: "killPointsDiff",

      valueFormatter: (p) => {
        const v = Number(p.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },

      cellClass: (p) =>
        Number(p.value) >= 0 ? "diff-positive" : "diff-negative",

      tooltipValueGetter: (p) =>
        `Starting KP: ${Number(p.data?.killPoints || 0).toLocaleString(
          "en-US"
        )}`,

      getQuickFilterText: () => "",
    },
    {
      headerName: "T4",
      field: "t4Diff",

      valueFormatter: (p) => {
        const v = Number(p.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },

      cellClass: (p) =>
        Number(p.value) >= 0 ? "diff-positive" : "diff-negative",

      tooltipValueGetter: (p) =>
        `Starting T4: ${Number(p.data?.t4 || 0).toLocaleString("en-US")}`,

      getQuickFilterText: () => "",
    },
    {
      headerName: "T5",
      field: "t5Diff",

      valueFormatter: (p) => {
        const v = Number(p.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },

      cellClass: (p) =>
        Number(p.value) >= 0 ? "diff-positive" : "diff-negative",

      tooltipValueGetter: (p) =>
        `Starting T5: ${Number(p.data?.t5 || 0).toLocaleString("en-US")}`,

      getQuickFilterText: () => "",
    },
    {
      headerName: "Deads",
      field: "deadsDiff",

      valueFormatter: (p) => {
        const v = Number(p.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },

      cellClass: (p) =>
        Number(p.value) >= 0 ? "diff-positive" : "diff-negative",

      tooltipValueGetter: (p) =>
        `Starting deads: ${Number(p.data?.deads || 0).toLocaleString("en-US")}`,

      getQuickFilterText: () => "",
    },
    {
      headerName: "DKP",
      field: "dkp",
      getQuickFilterText: () => "",

      valueFormatter: (p) => Number(p.value || 0).toLocaleString("en-US"),
    },
    {
      headerName: "DKP %",
      field: "dkpPercent",
      getQuickFilterText: () => "",
    },
    {
      headerName: "Status",
      field: "status",
      hide: true,
    },
    {
      headerName: "Acclaim",
      field: "acclaim",
      getQuickFilterText: () => "",

      valueFormatter: (p) => Number(p.value || 0).toLocaleString("en-US"),
      hide: false,
    },
  ],
  defaultColDef: {
    sortable: true,
    filter: false,
    resizable: true,
  },
  tooltipShowDelay: 300,
  pagination: false,
  paginationPageSize: 50,
  animateRows: true,
  rowBuffer: 20,
  suppressRowTransform: true,
  onRowClicked: (event) => {
    selectedGovernorId = event.data.id;

    document.getElementById(
      "chart-title"
    ).textContent = `${event.data.name} (ID: ${event.data.id})`;

    updateChart(selectedGovernorId, currentColIndex);
    chartPlaceholder.style.display = "none";
    chartSection.classList.add("visible");
  },
};

gridApi = agGrid.createGrid(document.querySelector("#myGrid"), gridOptions);

function onFilterTextBoxChanged() {
  const input = document.getElementById("quickFilter");
  gridApi.setGridOption("quickFilterText", input.value);
}

let inlineChart = null;
let selectedGovernorId = null;
let currentColIndex = 16;

// Column labels
const labelMap = {
  16: "Power Diff",
  4: "T4 Kills",
  5: "T5 Kills",
  3: "Kill Points",
  6: "Deads",
};

const CHART_STYLES = {
  light: {
    text: "#333",
    grid: "rgba(0,0,0,0.1)",
    line: "#007bff",
    background: "rgba(255,255,255,0.8)",
  },
  dark: {
    text: "#eee",
    grid: "rgba(255,255,255,0.2)",
    line: "#ff9800",
    background: "rgba(40,40,40,0.8)",
  },
};

function getCurrentTheme() {
  return document.body.classList.contains("dark") ? "dark" : "light";
}

function updateChart(governorId, colIndex) {
  selectedGovernorId = governorId;
  currentColIndex = colIndex;

  if (!SheetCache.lastSheetData) return;

  const sheets = SheetCache.sheetsList;
  const values = sheets.map((sheetName) => {
    const sheet = SheetCache.sheetsData[sheetName];
    if (!sheet) return 0;
    const row = sheet.rows.find((r) => `${r[0]}` === `${selectedGovernorId}`);
    return row ? Number(row[colIndex] || 0) : 0;
  });

  const ctx = document.querySelector("#modal-chart").getContext("2d");
  const theme = getCurrentTheme();
  const styles = CHART_STYLES[theme];

  if (!inlineChart) {
    inlineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: sheets,
        datasets: [
          {
            label: labelMap[colIndex] || `Col ${colIndex}`,
            data: values,
            borderColor: styles.line,
            backgroundColor: styles.line + "33",
            pointBackgroundColor: styles.line,
            pointBorderColor: styles.line,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: styles.text } },
          tooltip: {
            backgroundColor: styles.background,
            titleColor: styles.text,
            bodyColor: styles.text,
          },
          chartBackground: { color: styles.background },
        },
        scales: {
          x: { ticks: { color: styles.text }, grid: { color: styles.grid } },
          y: { ticks: { color: styles.text }, grid: { color: styles.grid } },
        },
      },
    });
  } else {
    const dataset = inlineChart.data.datasets[0];
    dataset.data = values;
    dataset.label = labelMap[colIndex] || `Col ${colIndex}`;
    dataset.borderColor = styles.line;
    dataset.backgroundColor = styles.line + "33";
    dataset.pointBackgroundColor = styles.line;
    dataset.pointBorderColor = styles.line;

    inlineChart.options.plugins.legend.labels.color = styles.text;
    inlineChart.options.scales.x.ticks.color = styles.text;
    inlineChart.options.scales.y.ticks.color = styles.text;
    inlineChart.options.scales.x.grid.color = styles.grid;
    inlineChart.options.scales.y.grid.color = styles.grid;
    inlineChart.options.plugins.tooltip.backgroundColor = styles.background;
    inlineChart.options.plugins.tooltip.titleColor = styles.text;
    inlineChart.options.plugins.tooltip.bodyColor = styles.text;
    inlineChart.options.plugins.chartBackground.color = styles.background;

    inlineChart.update();
  }
}

function refreshChartTheme() {
  if (!inlineChart) return;

  const styles = CHART_STYLES[getCurrentTheme()];
  const dataset = inlineChart.data.datasets[0];

  dataset.borderColor = styles.line;
  dataset.backgroundColor = styles.line + "33";
  inlineChart.options.plugins.legend.labels.color = styles.text;
  inlineChart.options.scales.x.ticks.color = styles.text;
  inlineChart.options.scales.y.ticks.color = styles.text;

  inlineChart.update("none");
}
const themeToggle = qs("#toggle-theme");
if (themeToggle) {
  themeToggle.addEventListener("change", refreshChartTheme);
}
document.querySelectorAll(".chart-buttons button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const col = Number(btn.dataset.col);
    if (!isNaN(col) && selectedGovernorId) {
      updateChart(selectedGovernorId, col);
    }
  });
});

const closeChartBtn = document.getElementById("close-chart");

closeChartBtn.addEventListener("click", () => {
  if (inlineChart) {
    inlineChart.destroy();
    inlineChart = null;
  }

  selectedGovernorId = null;
  chartSection.classList.remove("visible");
  chartPlaceholder.style.display = "flex";
});

const chartSection = document.getElementById("chart-section");
const chartPlaceholder = document.getElementById("chart-placeholder");

loadAllSheetsCache().then(() => {
  const spinner = document.getElementById("loading-spinner");

  const rows = SheetCache.lastSheetData.rows;
  const rowData = buildRowDataFromSheet(rows);

  gridApi.setGridOption("rowData", rowData);

  const sortedByDKP = [...rows]
    .sort((a, b) => Number(b[8]) - Number(a[8]))
    .slice(0, 3);

  renderTopPlayers(sortedByDKP);
  renderTotals(rows);

  spinner.style.display = "none";
  const gridEl = document.getElementById("myGrid");
  gridEl.style.display = "block";

  requestAnimationFrame(() => {
    gridEl.classList.add("visible");
  });
});

function renderTopPlayers(players) {
  const box = document.querySelector("#top-players");
  if (!box) return;
  box.innerHTML = "";

  players.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = "player-box";
    el.innerHTML = `
            <div class="player-rank">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-trophy-fill" viewBox="0 0 16 16">
                    <path d="M2.5.5A.5.5 0 0 1 3 0h10a.5.5 0 0 1 .5.5q0 .807-.034 1.536a3 3 0 1 1-1.133 5.89c-.79 1.865-1.878 2.777-2.833 3.011v2.173l1.425.356c.194.048.377.135.537.255L13.3 15.1a.5.5 0 0 1-.3.9H3a.5.5 0 0 1-.3-.9l1.838-1.379c.16-.12.343-.207.537-.255L6.5 13.11v-2.173c-.955-.234-2.043-1.146-2.833-3.012a3 3 0 1 1-1.132-5.89A33 33 0 0 1 2.5.5m.099 2.54a2 2 0 0 0 .72 3.935c-.333-1.05-.588-2.346-.72-3.935m10.083 3.935a2 2 0 0 0 .72-3.935c-.133 1.59-.388 2.885-.72 3.935"/>
                </svg>
                TOP${i + 1}
            </div>
            <h3>${escapeHtml(p[1] ?? "")}</h3>
            <p>ID: ${escapeHtml(p[0] ?? "")}</p>
        `;
    box.appendChild(el);
  });
}
function renderTotals(rows = []) {
  const container = document.querySelector("#bottom-totals");
  if (!container) return;

  container.innerHTML = "";

  const defs = [
    { label: "Total T4 kills", col: 4 },
    { label: "Total T5 kills", col: 5 },
    { label: "Total Deads", col: 6 },
    { label: "Total KP", col: 3 },
  ];

  defs.forEach(({ label, col }) => {
    const sum = rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);

    const box = document.createElement("div");
    box.className = "stat-box";

    box.innerHTML = `
            <h3>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sticky-fill" viewBox="0 0 16 16">
                    <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h6.086a1.5 1.5 0 0 0 1.06-.44l4.915-4.914A1.5 1.5 0 0 0 15 8.586V2.5A1.5 1.5 0 0 0 13.5 1zm6 8.5a1 1 0 0 1 1-1h4.396a.25.25 0 0 1 .177.427l-5.146 5.146a.25.25 0 0 1-.427-.177z"/>
                </svg>
                ${escapeHtml(label)}
            </h3>
            <p>${Number(sum).toLocaleString()}</p>
        `;

    container.appendChild(box);
  });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"'`=\/]/g, function (s) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
      "/": "&#x2F;",
      "`": "&#x60;",
      "=": "&#x3D;",
    }[s];
  });
}

function setTheme(mode) {
  document.body.classList.remove("dark", "light");
  document.body.classList.add(mode);

  document.body.setAttribute("data-ag-theme-mode", mode);
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

initializeTheme(themeToggle);
if (themeToggle) {
  themeToggle.addEventListener("change", (e) => {
    setTheme(e.target.checked ? "dark" : "light");

    if (selectedGovernorId && inlineChart) {
      updateChart(selectedGovernorId, currentColIndex);
    }
  });
}

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
if (hamburger && navLinks) {
  hamburger.addEventListener("click", () => navLinks.classList.toggle("show"));
}

document.addEventListener("DOMContentLoaded", () => {
  const current = location.pathname.split("/").pop();

  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
});
