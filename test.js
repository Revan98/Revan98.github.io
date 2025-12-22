const CONFIG = {
  sources: [
    {
      id: "main",
      kd: "2247",
      name: "KD2247",
      sheetUrl:
        "https://docs.google.com/spreadsheets/d/1bP7LMwUuN3gjIEWKo0QCStKmrvIzn9rrYedoaUJh5zg/edit?usp=sharing",
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

const API_KEY = "AIzaSyDIX6tSEresAQCeYE6cGOWEzWQ92HHoPeY";

const SheetCache = {
  sheetsList: [],
  sheetsData: {},
  lastSheetData: null,
};

const qs = (sel) => document.querySelector(sel);
const themeToggle = qs("#toggle-theme");

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

async function loadAllSheetsCache() {
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
}

function formatNumber(val) {
  if (val === undefined || val === null || val === "") return val;
  if (isNaN(val)) return val;
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 0 });
}
function valueWithDiffRenderer(diffField) {
  return (params) => {
    const value = Number(params.value) || 0;
    const diff = Number(params.data?.[diffField]) || 0;
    const diffClass = diff >= 0 ? "positive" : "negative";

    return `
      <div class="cell-value">${formatNumber(value)}</div>
      <div class="cell-diff ${diffClass}">
        ${diff >= 0 ? "+" : ""}${formatNumber(diff)}
      </div>
    `;
  };
}

let gridApi;

function buildRowDataFromSheet(rows) {
  return rows
    .filter((r) => String(r[10]).trim().toUpperCase() !== "YES")
    .map((r) => ({
      id: r[0],
      name: r[1],
      power: Number(r[2]) || 0,
      powerDiff: Number(r[16]) || 0,

      killPoints: Number(r[14]) || 0,
      killPointsDiff: Number(r[3]) || 0,

      t4: Number(r[12]) || 0,
      t4Diff: Number(r[4]) || 0,

      t5: Number(r[13]) || 0,
      t5Diff: Number(r[5]) || 0,

      deads: Number(r[15]) || 0,
      deadsDiff: Number(r[6]) || 0,

      dkp: Number(r[8]) || 0,
      dkpPercent: r[9],
      status: r[11],
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
      field: "power",
      cellRenderer: valueWithDiffRenderer("powerDiff"),
      comparator: (a, b) => a - b,
      getQuickFilterText: () => "",
    },
    {
      headerName: "Kill Points",
      field: "killPoints",
      cellRenderer: valueWithDiffRenderer("killPointsDiff"),
      getQuickFilterText: () => "",
    },
    {
      headerName: "T4",
      field: "t4",
      cellRenderer: valueWithDiffRenderer("t4Diff"),
      getQuickFilterText: () => "",
    },
    {
      headerName: "T5",
      field: "t5",
      cellRenderer: valueWithDiffRenderer("t5Diff"),
      getQuickFilterText: () => "",
    },
    {
      headerName: "Deads",
      field: "deads",
      cellRenderer: valueWithDiffRenderer("deadsDiff"),
      getQuickFilterText: () => "",
    },

    { headerName: "DKP", field: "dkp", getQuickFilterText: () => "" },
    {
      headerName: "DKP %",
      field: "dkpPercent",
      getQuickFilterText: () => "",
    },
    { headerName: "Status", field: "status", hide: true },
  ],
  defaultColDef: {
    sortable: true,
    filter: false,
    resizable: true,
  },
  rowHeight: 50,
  pagination: true,
  paginationPageSize: 50,
  animateRows: true,
  onRowClicked: (event) => {
    selectedGovernorId = event.data.id;

    const chartSection = document.getElementById("table-chart");
    chartSection.style.display = "block";

    document.getElementById(
      "chart-title"
    ).textContent = `${event.data.name} (ID: ${event.data.id})`;

    renderTableChart(currentColIndex);
    const chart = document.getElementById("table-chart");
    chart.classList.add("visible");
  },
};

gridApi = agGrid.createGrid(document.querySelector("#myGrid"), gridOptions);

function onFilterTextBoxChanged() {
  const input = document.getElementById("quickFilter");
  gridApi.setGridOption("quickFilterText", input.value);
}

const { AgCharts } = agCharts;
let tableChart = null;
let selectedGovernorId = null;
let currentColIndex = 16;
let _documentClickListenerAdded = false;

function getGovernorName(id) {
  const rows = SheetCache.lastSheetData?.rows || [];
  const found = rows.find((r) => `${r[0]}` === `${id}`);
  return found ? found[1] : id;
}

function buildChartData(colIndex) {
  return SheetCache.sheetsList.map((sheetName) => {
    const sheet = SheetCache.sheetsData[sheetName];
    const row = sheet?.rows.find((r) => `${r[0]}` === `${selectedGovernorId}`);
    return {
      sheet: sheetName,
      value: row ? Number(row[colIndex] || 0) : 0,
    };
  });
}

const metricLabels = {
  16: "Power Diff",
  4: "T4 Kills",
  5: "T5 Kills",
  3: "Kill Points",
  6: "Deads",
};

function renderTableChart(colIndex) {
  if (!selectedGovernorId) return;

  currentColIndex = colIndex;

  const container = document.getElementById("table-chart");
  const data = buildChartData(colIndex);

  const options = {
    container,
    theme: getChartTheme(),
    title: {
      text: metricLabels[colIndex],
    },
    data,
    series: [
      {
        type: "line",
        xKey: "sheet",
        yKey: "value",
        yName: metricLabels[colIndex],
        marker: { enabled: true },
      },
    ],
    axes: {
      x: { type: "category", position: "bottom" },
      y: { type: "number", position: "left" },
    },
    legend: { enabled: false },
  };

  if (!tableChart) {
    tableChart = AgCharts.create(options);
  } else {
    tableChart.updateDelta(options);
  }
}

const materialChartThemes = {
  light: {
    baseTheme: "ag-material",
    overrides: {
      common: {
        background: {
          fill: "#ffffff",
        },
        title: {
          color: "#333333",
        },
      },
      series: [
          {
              // ...
            fill: '#badaff', // fill colour
            fillOpacity: 0.8,
          },
      ],
      line: {
        series: {
          stroke: "#007bff",
          marker: {
            fill: "#007bff",
            stroke: "#007bff",
          },
        },
      },
    },
  },

  dark: {
    baseTheme: "ag-material-dark",
    overrides: {
      common: {
        background: {
          fill: "#2a2a2a",
        },
        title: {
          color: "#eeeeee",
        },
      },
      series: [
          {
              // ...
            fill: '#badaff', // fill colour
            fillOpacity: 0.8,
          },
      ],
      line: {
        series: {
          stroke: "#ff9800",
          marker: {
            fill: "#ff9800",
            stroke: "#ff9800",
          },
        },
      },
    },
  },
};

function getChartTheme() {
  return document.body.classList.contains("dark")
    ? materialChartThemes.dark
    : materialChartThemes.light;
}

document.querySelectorAll(".chart-buttons button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const col = Number(btn.dataset.col);
    renderTableChart(col);
  });
});

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
    { label: "Total T4 kills", col: 12 },
    { label: "Total T5 kills", col: 13 },
    { label: "Total Deads", col: 15 },
    { label: "Total KP", col: 14 },
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
  if (tableChart) {
    tableChart.updateDelta({
      theme: getChartTheme(),
    });
  }

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
  });
}

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
hamburger.addEventListener("click", () => navLinks.classList.toggle("show"));

document.addEventListener("DOMContentLoaded", () => {
  const current = location.pathname.split("/").pop();

  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
});
