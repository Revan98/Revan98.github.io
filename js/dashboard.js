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
      flex: 1,
      minWidth: 100,
      cellRenderer: (params) => {
        if (!params.value) return "";
        const a = document.createElement("a");
        a.textContent = params.value;
        a.classList.add("gov-id");
        a.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openGovModal(String(params.value), params.data?.name || "");
        });
        return a;
      },
    },

    {
      headerName: "Name",
      field: "name",
      flex: 1,
      minWidth: 100,
    },

    {
      headerName: "Power",
      field: "powerDiff",
      comparator: (a, b) => a - b,
      flex: 1,
      minWidth: 100,
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
      flex: 1,
      minWidth: 100,
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
      flex: 1,
      minWidth: 100,
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
      flex: 1,
      minWidth: 100,
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
      flex: 1,
      minWidth: 100,
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
      flex: 1,
      minWidth: 100,
      valueFormatter: (p) => Number(p.value || 0).toLocaleString("en-US"),
    },
    {
      headerName: "DKP %",
      field: "dkpPercent",
      comparator: (a, b) => Number(a) - Number(b),
      getQuickFilterText: () => "",
      flex: 1,
      minWidth: 100,
      valueFormatter: (p) => {
        const v = Number(p.value);
        if (isNaN(v)) return "";
        return (v * 100).toFixed(2) + "%";
      },
    },
    {
      headerName: "Acclaim",
      field: "acclaim",
      flex: 1,
      minWidth: 100,
      getQuickFilterText: () => "",

      valueFormatter: (p) => Number(p.value || 0).toLocaleString("en-US"),
      hide: false,
    },
  ],
  enableCellTextSelection: true,
  ensureDomOrder: true,
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
  if (!sheetName || typeof sheetName !== "string") return sheetName;

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
});

const chartSection = document.getElementById("chart-section");

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
    { label: "Total T4 kills", col: 7 },
    { label: "Total T5 kills", col: 9 },
    { label: "Total Deads", col: 11 },
    { label: "Total KP", col: 5 },
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

const navbar = document.getElementById("navbar");
window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 10);
});

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
hamburger.addEventListener("click", () => {
  navLinks.classList.toggle("show");
  hamburger.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
    navLinks.classList.remove("show");
    hamburger.classList.remove("open");
  }
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("show");
    hamburger.classList.remove("open");
  });
});

const THEME_KEY = "theme";
const themeToggle = document.getElementById("toggle-theme");

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);

  document.body.setAttribute("data-ag-theme-mode", theme);

  localStorage.setItem(THEME_KEY, theme);

  if (gridApi) {
    const agTheme =
      theme === "dark"
        ? agGrid.themeQuartz.withPart(agGrid.colorSchemeDark)
        : agGrid.themeQuartz.withPart(agGrid.colorSchemeLight);
    gridApi.setGridOption("theme", agTheme);
  }

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
document.addEventListener("DOMContentLoaded", () => {
  const current = location.pathname.split("/").pop();

  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
});

function renderCollapsibleSection(title, content, defaultOpen = false) {
  const id = "sec_" + Math.random().toString(36).substr(2, 9);

  return `
    <div class="collapsible-section">
      <div class="collapsible-header" 
           data-target="${id}"
           onclick="toggleSection('${id}')">
        <span>${escapeHtml(title)}</span>
        <span class="collapsible-icon">${defaultOpen ? "−" : "+"}</span>
      </div>
      <div id="${id}" 
           class="collapsible-content" 
           style="display:${defaultOpen ? "block" : "none"};">
        ${content}
      </div>
    </div>
  `;
}

function expandAllSections() {
  document.querySelectorAll(".collapsible-content").forEach((el) => {
    el.style.display = "block";
  });

  document.querySelectorAll(".collapsible-icon").forEach((icon) => {
    icon.textContent = "−";
  });
}

function collapseAllSections() {
  document.querySelectorAll(".collapsible-content").forEach((el) => {
    el.style.display = "none";
  });

  document.querySelectorAll(".collapsible-icon").forEach((icon) => {
    icon.textContent = "+";
  });
}

function toggleSection(id) {
  const el = document.getElementById(id);
  const header = el.previousElementSibling;
  const icon = header.querySelector(".collapsible-icon");

  if (el.style.display === "none") {
    el.style.display = "block";
    icon.textContent = "−";
  } else {
    el.style.display = "none";
    icon.textContent = "+";
  }
}

function loadGovHistory(govId) {
  const kd = getKDFromURL();

  const kvksRes = db.exec(`
    SELECT id, kvk_number
    FROM kvks
    WHERE kingdom='${kd}'
    ORDER BY kvk_number
  `);
  if (!kvksRes.length) return [];

  const results = [];
  for (const [kvkId, kvkNumber] of kvksRes[0].values) {
    const snapRes = db.exec(`
      SELECT id FROM snapshots
      WHERE kvk_id=${kvkId} AND is_last=1
      LIMIT 1
    `);
    if (!snapRes.length) continue;

    const snapId = snapRes[0].values[0][0];
    const statsRes = db.exec(`
      SELECT s.power_diff, s.kp_diff, s.t4_diff, s.t5_diff,
             s.deads_diff, s.dkp, s.dkp_percent, s.acclaim
      FROM stats s
      WHERE s.snapshot_id=${snapId} AND s.governor_id='${govId}'
    `);
    if (!statsRes.length) continue;

    const r = statsRes[0].values[0];
    results.push({
      kvk: `KvK ${kvkNumber}`,
      powerDiff: r[0],
      kpDiff: r[1],
      t4Diff: r[2],
      t5Diff: r[3],
      deadsDiff: r[4],
      dkp: r[5],
      dkpPercent: r[6],
      acclaim: r[7],
    });
  }
  return results;
}
function loadFarmKvKStats(farmIds) {
  if (!farmIds.length) return [];

  const kd = getKDFromURL();

  const kvksRes = db.exec(`
    SELECT id, kvk_number
    FROM kvks
    WHERE kingdom='${kd}'
    ORDER BY kvk_number
  `);

  if (!kvksRes.length) return [];

  const results = [];
  const idList = farmIds.join(",");

  for (const [kvkId, kvkNumber] of kvksRes[0].values) {
    const snapRes = db.exec(`
      SELECT id
      FROM snapshots
      WHERE kvk_id=${kvkId} AND is_last=1
      LIMIT 1
    `);

    if (!snapRes.length) continue;

    const snapId = snapRes[0].values[0][0];

    const statsRes = db.exec(`
      SELECT
        g.name,
        s.governor_id,
        s.power_diff,
        s.kp_diff,
        s.t4_diff,
        s.t5_diff,
        s.deads_diff,
        s.dkp,
        s.dkp_percent,
        s.acclaim
      FROM stats s
      JOIN governors g ON g.governor_id = s.governor_id
      WHERE s.snapshot_id=${snapId}
        AND CAST(s.governor_id AS INTEGER) IN (${idList})
      ORDER BY s.dkp DESC
    `);

    if (!statsRes.length) continue;

    statsRes[0].values.forEach((r) => {
      results.push({
        kvk: `KvK ${kvkNumber}`,
        name: r[0],
        id: r[1],
        powerDiff: r[2],
        kpDiff: r[3],
        t4Diff: r[4],
        t5Diff: r[5],
        deadsDiff: r[6],
        dkp: r[7],
        dkpPercent: r[8],
        acclaim: r[9],
      });
    });
  }

  return results;
}
function loadGovernorFarms(govId) {
  const res = db.exec(`
    SELECT name, player_id, power, killpoints, deads, ch
    FROM farm_accounts
    WHERE main_id='${govId}'
    ORDER BY power DESC
  `);

  if (!res.length || !res[0].values.length) return [];

  return res[0].values.map((r) => ({
    name: r[0] ?? "",
    id: r[1] ?? "",
    power: Number(r[2] ?? 0),
    killpoints: Number(r[3] ?? 0),
    deads: Number(r[4] ?? 0),
    ch: r[5] ?? "",
  }));
}

function _fmtDiff(v) {
  const n = Number(v) || 0;
  const cls = n >= 0 ? "diff-positive" : "diff-negative";
  return `<span class="${cls}">${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}</span>`;
}

function renderModalTable(rows) {
  if (!rows.length)
    return `<div class="gov-modal-empty">No historical data found for this governor.</div>`;

  const headers = [
    "KvK",
    "Power",
    "Kill Points",
    "T4",
    "T5",
    "Deads",
    "DKP",
    "DKP %",
    "Acclaim",
  ];
  const ths = headers.map((h) => `<th>${h}</th>`).join("");
  const trs = rows
    .map(
      (r) => `
    <tr>
      <td class="kvk-label">${escapeHtml(r.kvk)}</td>
      <td>${_fmtDiff(r.powerDiff)}</td>
      <td>${_fmtDiff(r.kpDiff)}</td>
      <td>${_fmtDiff(r.t4Diff)}</td>
      <td>${_fmtDiff(r.t5Diff)}</td>
      <td>${_fmtDiff(r.deadsDiff)}</td>
      <td>${Number(r.dkp || 0).toLocaleString("en-US")}</td>
      <td>${isNaN(Number(r.dkpPercent)) ? "" : (Number(r.dkpPercent) * 100).toFixed(2) + "%"}</td>
      <td>${Number(r.acclaim || 0).toLocaleString("en-US")}</td>
    </tr>`,
    )
    .join("");

  return `<table class="gov-modal-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function renderFarmsTable(rows) {
  if (!rows.length)
    return `<div class="gov-modal-empty">No farm accounts found.</div>`;

  const headers = ["Name", "ID", "Power", "Kill Points", "Deads", "CH"];
  const ths = headers.map((h) => `<th>${h}</th>`).join("");

  const trs = rows
    .map(
      (r) => `
    <tr>
      <td class="kvk-label">${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.id)}</td>
      <td>${Number(r.power || 0).toLocaleString("en-US")}</td>
      <td>${Number(r.killpoints || 0).toLocaleString("en-US")}</td>
      <td>${Number(r.deads || 0).toLocaleString("en-US")}</td>
      <td>${escapeHtml(r.ch)}</td>
    </tr>
  `,
    )
    .join("");

  return renderCollapsibleSection(
    "Farm Accounts",
    `
		<table class="gov-modal-table">
		  <thead><tr>${ths}</tr></thead>
		  <tbody>${trs}</tbody>
		</table>
	  `,
    false,
  );
}

const EQUIP_SLOTS = [
  { key: "helm",          label: "Helm",      id: "helmet"       },
  { key: "chest",         label: "Chest",     id: "chest"        },
  { key: "weapon",        label: "Weapon",    id: "weapon"       },
  { key: "gloves",        label: "Gloves",    id: "gloves"       },
  { key: "legs",          label: "Legs",      id: "legs"         },
  { key: "boots",         label: "Boots",     id: "boots"        },
  { key: "accessory",     label: "Acc.",      id: "accessory"    },
  { key: "accessory_sec", label: "Acc. 2",    id: "accessory_sec"},
];

const ARM_SLOTS = [
  { prefix: "arm1", label: "Arm 1" },
  { prefix: "arm2", label: "Arm 2" },
  { prefix: "arm3", label: "Arm 3" },
  { prefix: "arm4", label: "Arm 4" },
  { prefix: "arm5", label: "Arm 5" },
  { prefix: "arm6", label: "Arm 6" },
  { prefix: "arm7", label: "Arm 7" },
  { prefix: "arm8", label: "Arm 8" },
];

function loadGovernorEquipment(govId) {
  try {
    const t = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='equipment'`);
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(`SELECT * FROM equipment WHERE player_id=${Number(govId)} LIMIT 1`);
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => { row[c] = res[0].values[0][i]; });
    return row;
  } catch(e) { console.error("loadGovernorEquipment:", e); return null; }
}

function loadGovernorArmaments(govId) {
  try {
    const t = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='armaments'`);
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(`SELECT * FROM armaments WHERE player_id=${Number(govId)} LIMIT 1`);
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => { row[c] = res[0].values[0][i]; });
    return row;
  } catch(e) { console.error("loadGovernorArmaments:", e); return null; }
}

function isEmptyVal(v) {
  if (v === null || v === undefined || v === "") return true;
  const s = String(v).trim().toLowerCase();
  return s === "none" || s === "0";
}

function isMarchEmpty(row, suffix) {
  return EQUIP_SLOTS.every(slot => {
    const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
    return isEmptyVal(row[colKey]);
  });
}

function renderEquipBox(slot, itemName, lvl, tal, marchIdx) {
  const isEmpty = isEmptyVal(itemName);
  const imgSrc  = isEmpty ? null : `icons/${encodeURIComponent(String(itemName).trim())}.webp`;
  const lvlText = (!isEmpty && !isEmptyVal(lvl)) ? lvl : "—";
  const talText = (!isEmpty && !isEmptyVal(tal)) ? tal : "—";
  const imgTag  = imgSrc
    ? `<img src="${imgSrc}" alt="${escapeHtml(String(itemName))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;border-radius:2px;">`
    : "";
  const fallback = `<span style="display:${imgSrc ? "none" : "flex"};width:100%;height:100%;align-items:center;justify-content:center;font-size:9px;opacity:0.35;">?</span>`;
  return `
    <div class="equip-slot" id="${slot.id}_${marchIdx}">
      <div class="equip-box">${imgTag}${fallback}</div>
      <div class="equip-meta">
        <span class="equip-lvl">Awk: ${lvlText}</span>
        <span class="equip-tal">Talent: ${talText}</span>
      </div>
    </div>`;
}

function renderPairBox(name) {
  const isEmpty = isEmptyVal(name);
  const imgSrc  = isEmpty ? null : `icons/${encodeURIComponent(String(name).trim())}.webp`;
  const imgTag  = imgSrc
    ? `<img src="${imgSrc}" alt="${escapeHtml(String(name))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;border-radius:2px;">`
    : "";
  const fallback = `<span style="display:${imgSrc ? "none" : "flex"};width:100%;height:100%;align-items:center;justify-content:center;font-size:9px;opacity:0.35;">—</span>`;
  const title = isEmpty ? "" : ` `;
  return `<div class="equip-box equip-pair-box${isEmpty ? " equip-pair-box--empty" : ""}"${title}>${imgTag}${fallback}</div>`;
}

function renderPairsSection(row) {
  const PAIR_COUNT = 12;
  let pairRows = "";
  for (let n = 1; n <= PAIR_COUNT; n++) {
    const comm1 = row[`pair${n}_comm1`];
    const comm2 = row[`pair${n}_comm2`];
    if (isEmptyVal(comm1) && isEmptyVal(comm2)) continue;
    const boxes = [comm1, comm2].map(c => renderPairBox(c)).join("");
    pairRows += `
      <div class="equip-pair-row">
        <span class="equip-label">Pair ${n}</span>
        <div class="equip-pairs">${boxes}</div>
      </div>`;
  }
  if (!pairRows) return "";
  return `
    <div class="equip-pairs-section">
      <div class="equip-arm-label">Pairs</div>
      ${pairRows}
    </div>`;
}
const ABILITY_TIERS = (() => {
  const gold = new Set(["Destructive","Straight to the point","Invincible","Fearless","Hunter","Unstoppable","Balanced","Intrepid","Sharpshooter","Drilled","Merciless","Astute","Influential leader","Loaded","Civilized","Fixed","Cocoon","Inviolable","Crowned","Rounded","Rich","Battlements","Moneyed","Transporter","Enmeshed","Logistical","Unassailed","Winged","Irreproachable","Cautious","Shield Bash","Rock Solid","Avenger","Guarding light","Turn the corner","Panacea","Hasty Retreat","Blast Shield","Full Force","United Front","Thrasher","Butterfly effect","Steelskin","Flurry","Battle Ready","Fortified","Chokepoint","Steelheart","Vanquisher","Self Heal","Brilliant","Mountain","Toppler","Demolisher","Airtight","Thundering","Advantage advanced","Indomitable","Maneuver at ease","Horseback action"]);
  const blue = new Set(["Battle-Ready","Even-Keeled","Unswerving","Forceful","Crazed","Boiling Blood","Defiant","Focus Fire","Full Draw","Bloody Bolt","Tempered","Sharp Arrows","Drums of war","Nullify","Counter-Parry","Persevering","Self-Defense","Aegis","Reinforced","Tenacious","Gold Panner","Safeguard","Plentitude","Sturdy Back","Entangling","Arms Race","Sprinter","Strider","Ironclad","Strike & parry","Unshakeable","Convalescing","Back In Action","Medic","Rise Up","Refreshing","Fall Back","Spread Out","Shock Troops","Mutual Defense","Pummeler","Causative","Determined","Relentless","Vigilant","Resolute","Precautions","Ironsides","Overwhelm","Self Tend","Stone","Imploder","Raider","Hardheaded","Rattling","Fury","Soar","Ballista","Divine Staff"]);
  return { gold, blue };
})();

function getAbilityTier(name) {
  if (!name) return "gray";
  const n = String(name).trim();
  if (ABILITY_TIERS.gold.has(n)) return "gold";
  if (ABILITY_TIERS.blue.has(n)) return "blue";
  const lower = n.toLowerCase();
  for (const v of ABILITY_TIERS.gold) if (v.toLowerCase() === lower) return "gold";
  for (const v of ABILITY_TIERS.blue) if (v.toLowerCase() === lower) return "blue";
  return "gray";
}

function renderArmamentRow(armRow) {
  if (!armRow) return `
    <div class="equip-arm-section">
      <div class="equip-arm-label">Armaments</div>
      <div class="gov-modal-empty" style="padding:1rem 0;">No armament data found.</div>
    </div>`;

  const arms = ARM_SLOTS.map(arm => {
    const name = armRow[arm.prefix];
    if (isEmptyVal(name)) return "";

    const insKeys = ["_ins","_ins2","_ins3","_ins4","_ins5","_ins6","_ins7","_ins8"];
	const inscriptions = insKeys
	  .map(k => armRow[`${arm.prefix}${k}`])
	  .filter(v => !isEmptyVal(v))
	  .map(v => {
		const tier = getAbilityTier(String(v));
		return `<span class="arm-ins tier-${tier}">${escapeHtml(String(v))}</span>`;
	  })
	  .join("");

    const statSlots = [
      { n: `${arm.prefix}_stat_name`,   v: `${arm.prefix}_stat`   },
      { n: `${arm.prefix}_stat2_name2`, v: `${arm.prefix}_stat2`  },
      { n: `${arm.prefix}_stat3_name3`, v: `${arm.prefix}_stat3`  },
      { n: `${arm.prefix}_stat4_name4`, v: `${arm.prefix}_stat4`  },
    ];
    const statsHtml = statSlots
      .filter(s => !isEmptyVal(armRow[s.n]) && !isEmptyVal(armRow[s.v]))
      .map(s => `<span class="arm-stat">${escapeHtml(String(armRow[s.n]))}: <b>${escapeHtml(String(armRow[s.v]))}</b></span>`)
      .join("");

    return `
      <div class="arm-card">
        <div class="arm-name">${escapeHtml(String(name))}</div>
		${inscriptions ? `<div class="arm-ins-group">${inscriptions}</div>` : ""}
		${statsHtml    ? `<div class="arm-stats">${statsHtml}</div>`         : ""}
      </div>`;
  }).filter(Boolean).join("");

  return `
    <div class="equip-arm-section">
      <div class="equip-arm-label">Armaments</div>
      <div class="arm-cards">${arms || '<div class="gov-modal-empty" style="padding:1rem 0;">No armaments set.</div>'}</div>
    </div>`;
}

function renderEquipmentSection(govId) {
  const row    = govId ? loadGovernorEquipment(govId) : null;
  const armRow = govId ? loadGovernorArmaments(govId) : null;

  if (!row) {
    return renderCollapsibleSection(
      "Equipment",
      `<div class="gov-modal-empty">No equipment data found.</div>`,
      false,
    );
  }

  const MARCH_SUFFIXES = ["", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  let marchRows = "";

  MARCH_SUFFIXES.forEach((suffix, idx) => {
    const marchNum = idx + 1;
    if (isMarchEmpty(row, suffix)) return;

    const slotBoxes = EQUIP_SLOTS.map(slot => {
      const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
      const lvlKey = suffix ? `${slot.key}_lvl_${suffix}` : `${slot.key}_lvl`;
      const talKey = suffix ? `${slot.key}_tal_${suffix}` : `${slot.key}_tal`;
      return renderEquipBox(slot, row[colKey], row[lvlKey], row[talKey], marchNum);
    }).join("");

    marchRows += `
      <div class="equip-march-row">
        <span class="equip-label">March ${marchNum}</span>
        <div class="equip-slots">${slotBoxes}</div>
      </div>`;
  });

  if (!marchRows) marchRows = `<div class="gov-modal-empty">All marches are empty.</div>`;

  return renderCollapsibleSection(
    "Equipment",
    `<div class="equip-grid">${marchRows}${renderArmamentRow(armRow)}${renderPairsSection(row)}</div>`,
    false,
  );
}


function renderFarmKvKTable(rows) {
  if (!rows.length)
    return `<div class="gov-modal-empty">No KvK data found for farm accounts.</div>`;

  const grouped = {};
  rows.forEach((r) => {
    if (!grouped[r.kvk]) grouped[r.kvk] = [];
    grouped[r.kvk].push(r);
  });

  const headers = [
    "Name",
    "ID",
    "Power",
    "Kill Points",
    "T4",
    "T5",
    "Deads",
    "DKP",
    "DKP %",
    "Acclaim",
  ];
  const ths = headers.map((h) => `<th>${h}</th>`).join("");

  let kvkBlocks = "";

  Object.keys(grouped).forEach((kvkName) => {
    const trs = grouped[kvkName]
      .map(
        (r) => `
      <tr>
        <td class="kvk-label">${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.id)}</td>
        <td>${_fmtDiff(r.powerDiff)}</td>
        <td>${_fmtDiff(r.kpDiff)}</td>
        <td>${_fmtDiff(r.t4Diff)}</td>
        <td>${_fmtDiff(r.t5Diff)}</td>
        <td>${_fmtDiff(r.deadsDiff)}</td>
        <td>${Number(r.dkp || 0).toLocaleString("en-US")}</td>
        <td>${isNaN(Number(r.dkpPercent)) ? "" : (Number(r.dkpPercent) * 100).toFixed(2) + "%"}</td>
        <td>${Number(r.acclaim || 0).toLocaleString("en-US")}</td>
      </tr>
    `,
      )
      .join("");

    const table = `
      <table class="gov-modal-table">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    `;

    kvkBlocks += renderCollapsibleSection(kvkName, table, false);
  });

  return renderCollapsibleSection(
    "Farm Accounts – KvK Stats (All KvKs)",
    kvkBlocks,
    false,
  );
}

function openGovModal(govId, govName) {
  const overlay = document.getElementById("govModalOverlay");
  const body = document.getElementById("govModalBody");
  const subtitle = document.getElementById("govModalSubtitle");

  subtitle.textContent = govName ? `— ${govName} (${govId})` : `— ID: ${govId}`;
  body.innerHTML = `<div class="gov-modal-loading"><div class="spinner"></div><span>Loading…</span></div>`;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    const safeRender = (label, fn) => {
      try { return fn(); }
      catch(e) { console.error("[modal:" + label + "]", e); return ""; }
    };
    try {
      const history = loadGovHistory(govId);
      const farms   = loadGovernorFarms(govId);
      const farmIds = farms.map((f) => f.id);
      const farmKvK = loadFarmKvKStats(farmIds);
      body.innerHTML =
        '<div class="modal-controls">' +
        '  <button onclick="expandAllSections()">Expand All</button>' +
        '  <button onclick="collapseAllSections()">Collapse All</button>' +
        '</div>' +
        safeRender("history",   () => renderCollapsibleSection("Governor History", renderModalTable(history), false)) +
        safeRender("farms",     () => renderFarmsTable(farms)) +
        safeRender("farmKvK",   () => renderFarmKvKTable(farmKvK)) +
        safeRender("equipment", () => renderEquipmentSection(govId));
    } catch (err) {
      console.error("openGovModal:", err);
      body.innerHTML = `<div class="gov-modal-empty">Error: ${escapeHtml(String(err))}</div>`;
    }
  }, 50);
}

function loadAllFarmsGrouped() {
  const mainsRes = db.exec(`
    SELECT player_id, name, power, killpoints, deads, ch
    FROM farm_accounts
    WHERE acc_type='main'
    ORDER BY name COLLATE NOCASE
  `);
  if (!mainsRes.length) return [];

  return mainsRes[0].values.map(m => {
    const mainId = m[0];
    const farmsRes = db.exec(`
      SELECT player_id, name, power, killpoints, deads, ch
      FROM farm_accounts
      WHERE main_id=${mainId} AND acc_type='farm'
      ORDER BY power DESC
    `);
    const farms = farmsRes.length ? farmsRes[0].values.map(f => ({
      id: f[0], name: f[1], power: f[2], killpoints: f[3], deads: f[4], ch: f[5]
    })) : [];
    return {
      main: { id: mainId, name: m[1], power: m[2], killpoints: m[3], deads: m[4], ch: m[5] },
      farms
    };
  });
}

function renderFarmsOverviewModal() {
  const overlay = document.getElementById("farmsOverviewOverlay");
  const body = document.getElementById("farmsOverviewBody");
  body.innerHTML = `<div class="gov-modal-loading"><div class="spinner"></div><span>Loading…</span></div>`;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    try {
      const groups = loadAllFarmsGrouped();
      if (!groups.length) {
        body.innerHTML = `<div class="gov-modal-empty">No farm accounts found.</div>`;
        return;
      }

      const farmThs = ["ID","Name","Power","Kill Points","Deads","CH"]
        .map(h => `<th>${h}</th>`).join("");

      let html = "";
      groups.forEach(({ main, farms }) => {
        const farmRows = farms.length
          ? farms.map(f => `
              <tr>
                <td>${escapeHtml(String(f.id))}</td>
                <td class="kvk-label">${escapeHtml(f.name)}</td>
                <td>${Number(f.power).toLocaleString("en-US")}</td>
                <td>${Number(f.killpoints).toLocaleString("en-US")}</td>
                <td>${Number(f.deads).toLocaleString("en-US")}</td>
                <td>${escapeHtml(String(f.ch))}</td>
              </tr>`).join("")
          : `<tr><td colspan="6" class="gov-modal-empty" style="padding:8px 0;">No farms linked.</td></tr>`;

        const content = `

          <table class="gov-modal-table fo-farms-table">
            <thead><tr>${farmThs}</tr></thead>
            <tbody>${farmRows}</tbody>
          </table>`;

		html += renderCollapsibleSection(
		  `ID: ${escapeHtml(String(main.id))} ${escapeHtml(main.name)}`,
		  content,
		  false
		);
      });

      body.innerHTML =
        `<div class="modal-controls">
           <button onclick="expandAllFarmsOverview()">Expand All</button>
           <button onclick="collapseAllFarmsOverview()">Collapse All</button>
         </div>` + html;
    } catch (err) {
      body.innerHTML = `<div class="gov-modal-empty">Error: ${escapeHtml(String(err))}</div>`;
    }
  }, 50);
}

function expandAllFarmsOverview() {
  document.querySelectorAll("#farmsOverviewBody .collapsible-content").forEach(el => el.style.display = "block");
  document.querySelectorAll("#farmsOverviewBody .collapsible-icon").forEach(icon => icon.textContent = "−");
}

function collapseAllFarmsOverview() {
  document.querySelectorAll("#farmsOverviewBody .collapsible-content").forEach(el => el.style.display = "none");
  document.querySelectorAll("#farmsOverviewBody .collapsible-icon").forEach(icon => icon.textContent = "+");
}

function closeFarmsOverviewModal() {
  document.getElementById("farmsOverviewOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

document.getElementById("farms-overview-btn").addEventListener("click", renderFarmsOverviewModal);
document.getElementById("farmsOverviewClose").addEventListener("click", closeFarmsOverviewModal);
document.getElementById("farmsOverviewOverlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeFarmsOverviewModal();
});

function closeGovModal() {
  document.getElementById("govModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

document
  .getElementById("govModalClose")
  .addEventListener("click", closeGovModal);
document.getElementById("govModalOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeGovModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeGovModal();
});
