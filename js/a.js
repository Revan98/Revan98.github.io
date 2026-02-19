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

const CHART_RANGES = ["A:B", "D:D", "Q:Q", "E:G"];

let db;

async function loadDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`,
  });

  const res = await fetch("kvk.db");
  const buffer = await res.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
}

const SheetCache = {
  dates: [],
  lastSnapshot: [],
  chartData: {},
};

async function loadAllSheetsCache() {
  await loadDatabase();

  const kd = getKDFromURL();

  // 1️⃣ Find KVKingdom
  const kvk = db.exec(`
	  SELECT id
	  FROM kvks
	  WHERE kingdom='${kd}'
	  ORDER BY kvk_number DESC
	  LIMIT 1
	`)[0];

  if (!kvk) {
    alert("No KVKingdom found in DB");
    return;
  }

  const kvkId = kvk.values[0][0];

  // 2️⃣ Get all snapshots (timeline)
  const snaps = db.exec(`
    SELECT id, snapshot_date
    FROM snapshots
    WHERE kvk_id=${kvkId}
    ORDER BY snapshot_date
  `)[0];

  SheetCache.sheetsList = snaps.values.map((r) => r[1]); // dates
  SheetCache._snapIds = Object.fromEntries(
    snaps.values.map((r) => [r[1], r[0]]),
  );

  // 3️⃣ Get last snapshot (grid)
  const lastSnap = db.exec(`
    SELECT id FROM snapshots
    WHERE kvk_id=${kvkId} AND is_last=1
  `)[0].values[0][0];

  const grid = db.exec(`
    SELECT
      s.governor_id,
      g.name,
      s.power,
      s.power_diff,
      s.kill_points,
      s.kp_diff,
      s.t4,
      s.t4_diff,
      s.t5,
      s.t5_diff,
      s.deads,
      s.deads_diff,
      s.dkp,
      s.dkp_percent,
      s.acclaim
    FROM stats s
    JOIN governors g ON g.governor_id=s.governor_id
    WHERE s.snapshot_id=${lastSnap}
  `)[0];

  SheetCache.lastSheetData = {
    rows: grid.values,
  };

  // Load chart data (all snapshots)
  SheetCache.sheetsData = {};

  SheetCache.sheetsList.forEach((date) => {
    const sid = SheetCache._snapIds[date];

    const data = db.exec(`
	  SELECT
		governor_id,
		kp_diff,
		power_diff,
		t4_diff,
		t5_diff,
		deads_diff
	  FROM stats
	  WHERE snapshot_id=${sid}
	`)[0];

    const map = {};
    data.values.forEach((r) => (map[String(r[0])] = r));

    SheetCache.sheetsData[date] = { rows: map };
  });
}

function formatNumber(val) {
  if (val === undefined || val === null || val === "") return val;
  if (isNaN(val)) return val;
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 0 });
}

const num = (v) => Number(v) || 0;
const COL_table = {
  ID: 0,
  NAME: 1,
  POWER: 2,
  KP_DIFF: 5,
  T4_DIFF: 7,
  T5_DIFF: 9,
  DEADS_DIFF: 11,
  DKP: 12,
  DKP_PERCENT: 13,
  T4: 6,
  T5: 8,
  KP: 4,
  DEADS: 10,
  POWER_DIFF: 3,
  ACCLAIM: 14,
};

let gridApi;

function buildRowDataFromSheet(rows) {
  return rows.map((r) => ({
    id: r[COL_table.ID],
    name: r[COL_table.NAME],
    power: r[COL_table.POWER],
    powerDiff: r[COL_table.POWER_DIFF],
    killPoints: r[COL_table.KP],
    killPointsDiff: r[COL_table.KP_DIFF],
    t4: r[COL_table.T4],
    t4Diff: r[COL_table.T4_DIFF],
    t5: r[COL_table.T5],
    t5Diff: r[COL_table.T5_DIFF],
    deads: r[COL_table.DEADS],
    deadsDiff: r[COL_table.DEADS_DIFF],
    dkp: r[COL_table.DKP],
    dkpPercent: r[COL_table.DKP_PERCENT],
    acclaim: r[COL_table.ACCLAIM],
  }));
}

const gridOptions = {
  theme: agGrid.themeQuartz,
  rowData: [],
  columnDefs: [
    {
      headerName: "ID",
      field: "id",
      sortable: false,
      cellRenderer: (params) => {
        const a = document.createElement("a");
        a.href = `governor.html?kd=${getKDFromURL()}&id=${params.value}`;
        a.textContent = params.value;
        a.classList.add("gov-id");
        return a;
      },
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
          "en-US",
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
      sort: "desc",
      sortIndex: 0,
      getQuickFilterText: () => "",

      valueFormatter: (p) => Number(p.value || 0).toLocaleString("en-US"),
    },
    {
      headerName: "DKP %",
      field: "dkpPercent",
      comparator: (a, b) => Number(a) - Number(b),
      getQuickFilterText: () => "",
      valueFormatter: (p) => {
        const v = Number(p.value);
        if (isNaN(v)) return "";
        return (v * 100).toFixed(2) + "%";
      },
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

    if (inlineChart) {
      inlineChart.options.plugins.title.text = `${event.data.name} (ID: ${event.data.id})`;
      inlineChart.update();
    }

    updateChart(selectedGovernorId);
    chartSection.classList.add("visible");
  },
};

gridApi = agGrid.createGrid(document.querySelector("#myGrid"), gridOptions);
//
//table resize toggle js
//
const maximizeToggle = document.getElementById("maximizeTable");
const gridWrapper = document.getElementById("gridWrapper");

maximizeToggle.addEventListener("change", () => {
  gridWrapper.classList.toggle("maximized", maximizeToggle.checked);
  gridApi.doLayout();
});


//end resize
function onFilterTextBoxChanged() {
  const input = document.getElementById("quickFilter");
  gridApi.setGridOption("quickFilterText", input.value);
}

let inlineChart = null;
let selectedGovernorId = null;

const CHART_STYLES = {
  light: {
    text: "#333",
    grid: "rgba(0,0,0,0.1)",
    line: "#007bff",
    point: "#007bff",
    pointBorder: "#ffffff",
    canvas: "#ffffff",
    tooltipBg: "rgba(255,255,255,0.95)",
  },
  dark: {
    text: "#eee",
    grid: "rgba(255,255,255,0.2)",
    line: "#ff9800",
    point: "#ff9800",
    pointBorder: "#1e1e1e",
    canvas: "#1e1e1e",
    tooltipBg: "rgba(40,40,40,0.95)",
  },
};

function getCurrentTheme() {
  return document.body.classList.contains("dark") ? "dark" : "light";
}

function formatSheetDate(sheetName) {
  // Expecting DD_MM_YYYY
  if (!sheetName || typeof sheetName !== "string") return sheetName;

  // Only replace if it matches the pattern
  if (/^\d{2}_\d{2}_\d{4}$/.test(sheetName)) {
    return sheetName.replaceAll("_", ".");
  }

  return sheetName;
}

const CHART_COL = {
  KP: 1,
  POWER_DIFF: 2,
  T4: 3,
  T5: 4,
  DEADS: 5,
};

const CHART_SERIES = [
  { col: CHART_COL.KP, label: "KP Diff", secondary: false },
  { col: CHART_COL.POWER_DIFF, label: "Power Diff", secondary: true },
  { col: CHART_COL.T4, label: "T4 Diff", secondary: true },
  { col: CHART_COL.T5, label: "T5 Diff", secondary: true },
  { col: CHART_COL.DEADS, label: "Deads Diff", secondary: true },
];

function createChart(ctx, labels, datasets) {
  inlineChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        title: {
          display: true,
          text: "Select a governor to view chart",
          font: {
            size: 18,
            weight: "600",
          },
        },
        legend: {},
      },
      scales: {
        x: {},
        y: {
          type: "linear",
          position: "left",
        },
        ySecondary: {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
        },
      },
    },
  });

  applyChartTheme();
}

function buildChartDatasets(governorId) {
  const colors = ["#dc3545", "#007bff", "#28a745", "#ffc107", "#6f42c1"];

  return CHART_SERIES.map((series, i) => {
    const data = SheetCache.sheetsList.map((sheetName) => {
      const sheet = SheetCache.sheetsData[sheetName];

      if (!sheet) return 0;
      const row = sheet.rows?.[governorId];

      return row ? Number(row[series.col] || 0) : 0;
    });

    return {
      label: series.label,
      data,
      tension: 0.25,
      borderColor: colors[i],
      backgroundColor: colors[i] + "33",
      pointRadius: 3,
      yAxisID: series.secondary ? "ySecondary" : "y",
    };
  });
}

function applyChartTheme() {
  if (!inlineChart) return;

  const styles = CHART_STYLES[getCurrentTheme()];
  inlineChart.data.datasets.forEach((ds, i) => {
    ds.pointBackgroundColor = ds.borderColor;
    ds.pointBorderColor = styles.pointBorder;
  });

  inlineChart.options.plugins.legend.labels.color = styles.text;
  inlineChart.options.plugins.title.color = styles.text;
  inlineChart.options.plugins.tooltip.backgroundColor = styles.tooltipBg;
  inlineChart.options.plugins.tooltip.titleColor = styles.text;
  inlineChart.options.plugins.tooltip.bodyColor = styles.text;

  const axes = ["x", "y", "ySecondary"];
  axes.forEach((axis) => {
    if (inlineChart.options.scales[axis]) {
      inlineChart.options.scales[axis].ticks.color = styles.text;
      inlineChart.options.scales[axis].grid.color = styles.grid;
      if (inlineChart.options.scales[axis].title) {
        inlineChart.options.scales[axis].title.color = styles.text;
      }
    }
  });

  inlineChart.update();
}

function updateChart(governorId) {
  selectedGovernorId = governorId;

  const labels = SheetCache.sheetsList.map(formatSheetDate);
  const datasets = buildChartDatasets(governorId);
  const ctx = document.querySelector("#modal-chart").getContext("2d");

  const row = SheetCache.lastSheetData.rows.find(
    (r) => `${r[0]}` === `${governorId}`,
  );

  const titleText = row
    ? `${row[1]} (ID: ${row[0]})`
    : "Select a governor to view chart";

  if (!inlineChart) {
    createChart(ctx, labels, datasets);
  }

  inlineChart.data.labels = labels;
  inlineChart.data.datasets = datasets;
  inlineChart.options.plugins.title.text = titleText;
  inlineChart.update();
}

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
	  .sort((a, b) => Number(b[12]) - Number(a[12]))
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
	  { label: "Total T4 kills", col: 7 },      // t4_diff
	  { label: "Total T5 kills", col: 9 },      // t5_diff
	  { label: "Total Deads", col: 11 },        // deads_diff
	  { label: "Total KP", col: 5 },            // kp_diff
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

const THEME_KEY = "theme";
const themeToggle = document.getElementById("toggle-theme");

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);

  document.body.setAttribute("data-ag-theme-mode", theme);

  localStorage.setItem(THEME_KEY, theme);
  applyChartTheme();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);

  let theme;
  if (saved === "light" || saved === "dark") {
    theme = saved;
  } else {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  applyTheme(theme);
  themeToggle.checked = theme === "dark";
}

themeToggle.addEventListener("change", () => {
  applyTheme(themeToggle.checked ? "dark" : "light");
});

initTheme();

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
