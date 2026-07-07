function getKDFromURL() {
  const params = new URLSearchParams(window.location.search);
  return normalizeNumericId(params.get("kd"));
}
function getSelectedSource() {
  const kd = getKDFromURL();
  if (!kd) return null;
  return kd;
}

function normalizeNumericId(value) {
  const id = String(value ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}

function buildNumericInList(values) {
  return [...new Set(values.map(normalizeNumericId).filter(Boolean))].join(",");
}

let db;

let itemsData = { items: {} };
let commandersData = { commanders: {} };
let inscriptionsData = { inscriptions: {} };
let inscriptionsByName = {};

async function loadEquipRefData() {
  try {
    const [itemsRes, commandersRes, inscriptionsRes] = await Promise.all([
      fetch("data/items.json"),
      fetch("data/commanders.json"),
      fetch("data/inscriptions.json"),
    ]);
    itemsData = await itemsRes.json();
    commandersData = await commandersRes.json();
    inscriptionsData = await inscriptionsRes.json();

    inscriptionsByName = {};
    for (const [key, info] of Object.entries(inscriptionsData.inscriptions || {})) {
      const nameKey = String(info.name || key).trim().toLowerCase();
      inscriptionsByName[nameKey] = { key, ...info };
    }
  } catch (e) {
    console.error("loadEquipRefData:", e);
  }
}
loadEquipRefData();

async function loadDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
  });

  const res = await fetch("kvk.db");
  const buffer = await res.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buffer));
  ensureDashboardSchema();
}

function ensureDashboardSchema() {
  const cols = db.exec("PRAGMA table_info(stats)");
  const existing = new Set(cols.length ? cols[0].values.map((r) => r[1]) : []);
  [
    ["sum_min_dkp", "INTEGER"],
    ["sum_dkp", "INTEGER"],
    ["sum_dkp_percent", "REAL"],
  ].forEach(([name, type]) => {
    if (!existing.has(name)) db.run(`ALTER TABLE stats ADD COLUMN ${name} ${type}`);
  });
}

const SheetCache = {};

async function loadAllSheetsCache() {
  await loadDatabase();

  const kd = getKDFromURL();
  if (!kd) {
    alert("Invalid or missing kingdom ID");
    return;
  }

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
      s.min_dkp,
      s.dkp,
      s.dkp_percent,
      coalesce(s.sum_min_dkp, s.min_dkp) AS sum_min_dkp,
      coalesce(s.sum_dkp, s.dkp) AS sum_dkp,
      coalesce(s.sum_dkp_percent, s.dkp_percent) AS sum_dkp_percent,
      coalesce(s.vacation, 'NO') AS vacation,
      coalesce(s.status, 'OK') AS status,
      s.acclaim
    FROM stats s
    JOIN governors g ON g.governor_id=s.governor_id
      AND g.kingdom='${kd}'
    WHERE s.snapshot_id=${lastSnap}
      AND upper(coalesce(s.vacation, 'NO')) != 'YES'
  `)[0];

  SheetCache.lastSheetData = {
    rows: grid.values,
  };

  SheetCache.sheetsData = {};

  // Batch-load all snapshot diff data in one query instead of one per snapshot
  const allSnapIds = snaps.values.map((r) => r[0]).join(",");
  if (allSnapIds) {
    const allDiffData = db.exec(`
      SELECT
        snapshot_id,
        governor_id,
        kp_diff,
        power_diff,
        t4_diff,
        t5_diff,
        deads_diff
      FROM stats
      WHERE snapshot_id IN (${allSnapIds})
    `)[0];

    if (allDiffData) {
      // Group rows by snapshot_id -> governor_id map
      const bySnap = {};
      allDiffData.values.forEach((r) => {
        const sid = r[0];
        if (!bySnap[sid]) bySnap[sid] = {};
        bySnap[sid][String(r[1])] = r;
      });

      snaps.values.forEach(([sid, date]) => {
        SheetCache.sheetsData[date] = { rows: bySnap[sid] || {} };
      });
    }
  }
}

const COL_table = {
  ID: 0,
  NAME: 1,
  POWER: 2,
  KP_DIFF: 5,
  T4_DIFF: 7,
  T5_DIFF: 9,
  DEADS_DIFF: 11,
  T4: 6,
  T5: 8,
  KP: 4,
  DEADS: 10,
  POWER_DIFF: 3,
  MIN_DKP: 12,
  DKP: 13,
  DKP_PERCENT: 14,
  SUM_MIN_DKP: 15,
  SUM_DKP: 16,
  SUM_DKP_PERCENT: 17,
  VACATION: 18,
  STATUS: 19,
  ACCLAIM: 20,
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
    minDkp: r[COL_table.MIN_DKP],
    dkp: r[COL_table.DKP],
    dkpPercent: r[COL_table.DKP_PERCENT],
    sumMinDkp: r[COL_table.SUM_MIN_DKP],
    sumDkp: r[COL_table.SUM_DKP],
    sumDkpPercent: r[COL_table.SUM_DKP_PERCENT],
    vacation: r[COL_table.VACATION],
    status: r[COL_table.STATUS],
    acclaim: r[COL_table.ACCLAIM],
  }));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatSignedNumber(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
}

function formatPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : "";
}

function formatCsvPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n).replace(".", ",") : "";
}

const DKP_EXPORT_COLUMNS = [
  { headerName: "ID", field: "id" },
  { headerName: "Name", field: "name" },
  { headerName: "Power", field: "power" },
  { headerName: "KP gained", field: "killPointsDiff" },
  { headerName: "T4 gained", field: "t4Diff" },
  { headerName: "T5 gained", field: "t5Diff" },
  { headerName: "Deads gained", field: "deadsDiff" },
  { headerName: "Min DKP", field: "minDkp" },
  { headerName: "DKP", field: "dkp" },
  { headerName: "DKP%", field: "dkpPercent", valueFormatter: (p) => formatCsvPercent(p.value) },
  { headerName: "Sum Min DKP", field: "sumMinDkp" },
  { headerName: "Sum DKP", field: "sumDkp" },
  { headerName: "Sum DKP%", field: "sumDkpPercent", valueFormatter: (p) => formatCsvPercent(p.value) },
  { headerName: "Vacation", field: "vacation" },
  { headerName: "Status", field: "status" },
  { headerName: "T4 Kills", field: "t4" },
  { headerName: "T5 Kills", field: "t5" },
  { headerName: "Killpoints", field: "killPoints" },
  { headerName: "Deads", field: "deads" },
  { headerName: "Power diff", field: "powerDiff" },
  { headerName: "Acclaim", field: "acclaim" },
].map((column) => ({
  ...column,
  colId: `export_${column.field}`,
  hide: true,
  suppressColumnsToolPanel: true,
  getQuickFilterText: () => "",
}));

function getExportFileName() {
  const kd = getKDFromURL() || "dkp";
  const lastSheet = SheetCache.sheetsList?.[SheetCache.sheetsList.length - 1] || "export";
  return `DKP_${kd}_${String(lastSheet).replaceAll("-", "_")}.csv`;
}

function exportDkpCsv() {
  if (!gridApi) return;
  gridApi.exportDataAsCsv({
    fileName: getExportFileName(),
    columnKeys: DKP_EXPORT_COLUMNS.map((column) => column.colId),
    columnSeparator: ";",
    exportedRows: "all",
  });
}

function renderMetricStack(baseValue, sumValue, formatter) {
  const base = formatter(baseValue);
  const sum = formatter(sumValue);
  return `
    <div class="metric-stack">
      <div class="metric-base">${sum}</div>
      <div class="metric-rollup">${base}</div>
    </div>
  `;
}

function renderTroopDiffStack(t4Diff, t5Diff) {
  const t4 = Number(t4Diff) || 0;
  const t5 = Number(t5Diff) || 0;
  return `
    <div class="troop-diff-stack">
      <div class="${t4 >= 0 ? "diff-positive" : "diff-negative"}">
        <span class="troop-diff-label">T4</span>${formatSignedNumber(t4)}
      </div>
      <div class="${t5 >= 0 ? "diff-positive" : "diff-negative"}">
        <span class="troop-diff-label">T5</span>${formatSignedNumber(t5)}
      </div>
    </div>
  `;
}

function renderDeadsPowerDiffStack(deadsDiff, powerDiff) {
  const deads = Number(deadsDiff) || 0;
  const power = Number(powerDiff) || 0;
  return `
    <div class="troop-diff-stack">
      <div class="${deads >= 0 ? "diff-positive" : "diff-negative"}">
        <span class="troop-diff-label">Dead</span>${formatSignedNumber(deads)}
      </div>
      <div class="${power >= 0 ? "diff-positive" : "diff-negative"}">
        <span class="troop-diff-label">Pwr</span>${formatSignedNumber(power)}
      </div>
    </div>
  `;
}

const gridOptions = {
  theme: agGrid.themeQuartz,
  rowData: [],
  columnDefs: [
	  {
	    headerName: "#",
	    valueGetter: "node.rowIndex + 1",
	    width: 55,
	    sortable: false,
	    filter: false,
	    pinned: "left",
	    getQuickFilterText: () => "",
	  },	  
    {
      headerName: "Name",
      field: "name",
      flex: 1.25,
      minWidth: 155,
      cellRenderer: (params) => {
        const id = params.data?.id;
        const name = params.value || "";
        const wrap = document.createElement("div");
        wrap.classList.add("gov-name-stack");

        const nameEl = document.createElement("div");
        nameEl.classList.add("gov-name-value");
        nameEl.textContent = name;
        wrap.appendChild(nameEl);

        if (!id) return wrap;

        const a = document.createElement("a");
        a.textContent = id;
        a.classList.add("gov-id");
        a.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openGovModal(String(id), name);
        });
        wrap.appendChild(a);

        return wrap;
      },
      getQuickFilterText: (params) =>
        `${params.data?.name || ""} ${params.data?.id || ""}`,
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
      headerName: "T4 / T5",
      field: "t4Diff",
      flex: 1,
      minWidth: 115,
      cellClass: "metric-stack-cell",
      comparator: (a, b, nodeA, nodeB) =>
        (Number(nodeA.data?.t4Diff) || 0) +
        (Number(nodeA.data?.t5Diff) || 0) -
        ((Number(nodeB.data?.t4Diff) || 0) + (Number(nodeB.data?.t5Diff) || 0)),
      cellRenderer: (p) => renderTroopDiffStack(p.value, p.data?.t5Diff),
      tooltipValueGetter: (p) =>
        `Starting T4: ${Number(p.data?.t4 || 0).toLocaleString("en-US")}\nStarting T5: ${Number(p.data?.t5 || 0).toLocaleString("en-US")}`,

      getQuickFilterText: () => "",
    },
    {
      headerName: "Deads / Power",
      field: "deadsDiff",
      flex: 1,
      minWidth: 125,
      sortable: false,
      cellClass: "metric-stack-cell",
      cellRenderer: (p) => renderDeadsPowerDiffStack(p.value, p.data?.powerDiff),
      tooltipValueGetter: (p) =>
        `Starting deads: ${Number(p.data?.deads || 0).toLocaleString("en-US")}\nStarting Power: ${Number(p.data?.power || 0).toLocaleString("en-US")}`,

      getQuickFilterText: () => "",
    },
    {
      headerName: "Min DKP",
      field: "minDkp",
      getQuickFilterText: () => "",
      flex: 1,
      minWidth: 135,
      cellClass: "metric-stack-cell",
      comparator: (a, b, nodeA, nodeB) =>
        (Number(nodeA.data?.sumMinDkp) || 0) -
        (Number(nodeB.data?.sumMinDkp) || 0),
      tooltipValueGetter: () => "with farms\nwithout farms",
      cellRenderer: (p) =>
        renderMetricStack(p.value, p.data?.sumMinDkp, formatNumber),
    },
    {
      headerName: "DKP",
      field: "dkp",
      sort: "desc",
      sortIndex: 0,
      getQuickFilterText: () => "",
      flex: 1,
      minWidth: 130,
      cellClass: "metric-stack-cell",
      comparator: (a, b, nodeA, nodeB) =>
        (Number(nodeA.data?.sumDkp) || 0) -
        (Number(nodeB.data?.sumDkp) || 0),
      tooltipValueGetter: () => "with farms\nwithout farms",
      cellRenderer: (p) =>
        renderMetricStack(p.value, p.data?.sumDkp, formatNumber),
    },
    {
      headerName: "DKP %",
      field: "dkpPercent",
      getQuickFilterText: () => "",
      flex: 1,
      minWidth: 120,
      cellClass: "metric-stack-cell",
      comparator: (a, b, nodeA, nodeB) =>
        (Number(nodeA.data?.sumDkpPercent) || 0) -
        (Number(nodeB.data?.sumDkpPercent) || 0),
      tooltipValueGetter: () => "with farms\nwithout farms",
      cellRenderer: (p) =>
        renderMetricStack(p.value, p.data?.sumDkpPercent, formatPercent),
    },
    {
      headerName: "Acclaim",
      field: "acclaim",
      flex: 1,
      minWidth: 100,
      getQuickFilterText: () => "",

      valueFormatter: (p) => Number(p.value || 0).toLocaleString("en-US"),
    },
    ...DKP_EXPORT_COLUMNS,
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
  animateRows: true,
  rowHeight: 60,
  rowBuffer: 20,
  suppressRowTransform: true,
};

gridApi = agGrid.createGrid(document.querySelector("#myGrid"), gridOptions);

function onFilterTextBoxChanged() {
  const input = document.getElementById("quickFilter");
  gridApi.setGridOption("quickFilterText", input.value);
}

document.getElementById("export-csv-btn")?.addEventListener("click", exportDkpCsv);

function copyTop18() {
  const allRows = [];
  gridApi.forEachNode((node) => { if (node.data) allRows.push(node.data); });

  if (!allRows.length) {
    alert("No data loaded yet.");
    return;
  }

  const text = [...allRows]
    .sort((a, b) => Number(b.sumDkp || 0) - Number(a.sumDkp || 0))
    .slice(0, 18)
    .map((row, i) => `${i + 1}. ${row.id} ${row.name}`)
    .join("\n");

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("copy-top18-btn");
    const original = btn.innerHTML;
    btn.textContent = "✓ Copied!";
    btn.disabled = true;
    setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });
}

document.getElementById("copy-top18-btn")?.addEventListener("click", copyTop18);

let inlineChart = null;
let selectedGovernorId = null;

const CHART_STYLES = {
  light: {
    text: "#333",
    grid: "rgba(0,0,0,0.1)",
    pointBorder: "#ffffff",
    tooltipBg: "rgba(255,255,255,0.95)",
  },
  dark: {
    text: "#eee",
    grid: "rgba(255,255,255,0.2)",
    pointBorder: "#1e1e1e",
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

// Column indices in the batched sheetsData rows:
// [0]=snapshot_id, [1]=governor_id, [2]=kp_diff, [3]=power_diff, [4]=t4_diff, [5]=t5_diff, [6]=deads_diff
const CHART_COL = {
  KP: 2,
  POWER_DIFF: 3,
  T4: 4,
  T5: 5,
  DEADS: 6,
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
          display: false,
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
	const canvas = document.querySelector("#modal-chart");
	if (!canvas) return;
	
	const ctx = canvas.getContext("2d");


	if (inlineChart) {
	  inlineChart.destroy();
	  inlineChart = null;
	}
	createChart(ctx, labels, datasets);
}

loadAllSheetsCache().then(() => {
  const spinner = document.getElementById("loading-spinner");

  const rows = SheetCache.lastSheetData.rows;
  const rowData = buildRowDataFromSheet(rows);

  gridApi.setGridOption("rowData", rowData);

  const sortedByDKP = [...rows]
    .sort((a, b) => Number(b[COL_table.DKP]) - Number(a[COL_table.DKP]))
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
    { label: "Total T4 gained", col: COL_table.T4_DIFF },
    { label: "Total T5 gained", col: COL_table.T5_DIFF },
    { label: "Total Deads gained", col: COL_table.DEADS_DIFF },
    { label: "Total KP", col: COL_table.KP_DIFF },
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

  initEquipTooltip();
});

function initEquipTooltip() {
  const tip = document.createElement("div");
  tip.className = "equip-tooltip";
  tip.style.display = "none";
  document.body.appendChild(tip);

  let activeEl = null;

  function positionTip(x, y) {
    const margin = 14;
    const rect = tip.getBoundingClientRect();
    let left = x + margin;
    let top = y + margin;

    if (left + rect.width > window.innerWidth - 8) {
      left = x - rect.width - margin;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = y - rect.height - margin;
    }
    left = Math.max(8, left);
    top = Math.max(8, top);

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip-code]");
    if (!el) return;
    activeEl = el;

    const html = buildTooltipHtml(el.dataset.tipCode, el.dataset.tipKind);
    if (!html) return;

    tip.innerHTML = html;
    tip.style.display = "block";
    positionTip(e.clientX, e.clientY);
  });

  document.addEventListener("mousemove", (e) => {
    if (!activeEl || tip.style.display === "none") return;
    positionTip(e.clientX, e.clientY);
  });

  document.addEventListener("mouseout", (e) => {
    const el = e.target.closest("[data-tip-code]");
    if (!el || el !== activeEl) return;
    if (el.contains(e.relatedTarget)) return;
    activeEl = null;
    tip.style.display = "none";
  });

  document.addEventListener("scroll", () => {
    tip.style.display = "none";
    activeEl = null;
  }, true);
}

function renderCollapsibleSection(title, content, defaultOpen = false) {
  // Use a stable incrementing counter instead of Math.random() for predictable IDs
  const id = "sec_" + (renderCollapsibleSection._counter = (renderCollapsibleSection._counter || 0) + 1);


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
  const safeGovId = normalizeNumericId(govId);
  if (!kd || !safeGovId) return [];
  const isMainAccount = resolveFarmMainId(safeGovId) === safeGovId;
  const farmIds = isMainAccount
    ? getGovernorFarmIds(safeGovId)
    : [];
  const farmIdList = buildNumericInList(farmIds);

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
             s.deads_diff, s.min_dkp, s.dkp, s.dkp_percent,
             coalesce(s.sum_min_dkp, s.min_dkp) AS sum_min_dkp,
             coalesce(s.sum_dkp, s.dkp) AS sum_dkp,
             coalesce(s.sum_dkp_percent, s.dkp_percent) AS sum_dkp_percent,
             s.acclaim
      FROM stats s
      WHERE s.snapshot_id=${snapId}
        AND s.governor_id='${safeGovId}'
        AND upper(coalesce(s.vacation, 'NO')) != 'YES'
    `);
    if (!statsRes.length) continue;

    const r = statsRes[0].values[0];
    let farmSums = null;
    if (farmIdList) {
      const farmStatsRes = db.exec(`
        SELECT
          coalesce(sum(s.power_diff), 0),
          coalesce(sum(s.kp_diff), 0),
          coalesce(sum(s.t4_diff), 0),
          coalesce(sum(s.t5_diff), 0),
          coalesce(sum(s.deads_diff), 0),
          coalesce(sum(s.min_dkp), 0),
          coalesce(sum(s.dkp), 0),
          coalesce(sum(s.dkp_percent), 0),
          coalesce(sum(s.acclaim), 0)
        FROM stats s
        WHERE s.snapshot_id=${snapId}
          AND CAST(s.governor_id AS INTEGER) IN (${farmIdList})
          AND upper(coalesce(s.vacation, 'NO')) != 'YES'
      `);
      farmSums = farmStatsRes.length ? farmStatsRes[0].values[0] : null;
    }

    results.push({
      kvk: `KvK ${kvkNumber}`,
      hasFarmRollup: isMainAccount && Boolean(farmIdList),
      powerDiff: r[0],
      kpDiff: r[1],
      t4Diff: r[2],
      t5Diff: r[3],
      deadsDiff: r[4],
      minDkp: r[5],
      dkp: r[6],
      dkpPercent: r[7],
      acclaim: r[11],
      sumPowerDiff: Number(r[0] || 0) + Number(farmSums?.[0] || 0),
      sumKpDiff: Number(r[1] || 0) + Number(farmSums?.[1] || 0),
      sumT4Diff: Number(r[2] || 0) + Number(farmSums?.[2] || 0),
      sumT5Diff: Number(r[3] || 0) + Number(farmSums?.[3] || 0),
      sumDeadsDiff: Number(r[4] || 0) + Number(farmSums?.[4] || 0),
      sumMinDkp: Number(r[5] || 0) + Number(farmSums?.[5] || 0),
      sumDkp: Number(r[6] || 0) + Number(farmSums?.[6] || 0),
      sumDkpPercent: Number(r[7] || 0) + Number(farmSums?.[7] || 0),
      sumAcclaim: Number(r[11] || 0) + Number(farmSums?.[8] || 0),
    });
  }
  return results;
}
function loadFarmKvKStats(farmIds) {
  const idList = buildNumericInList(farmIds);
  if (!idList) return [];

  const kd = getKDFromURL();
  if (!kd) return [];

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
        AND g.kingdom='${kd}'
      WHERE s.snapshot_id=${snapId}
        AND CAST(s.governor_id AS INTEGER) IN (${idList})
        AND upper(coalesce(s.vacation, 'NO')) != 'YES'
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
  const safeGovId = normalizeNumericId(govId);
  if (!safeGovId) return [];
  const mainId = resolveFarmMainId(safeGovId);
  if (!mainId) return [];

  const res = db.exec(`
    SELECT name, player_id, power, killpoints, deads, ch
    FROM farm_accounts
    WHERE main_id=${mainId}
      AND acc_type='farm'
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

function loadFarmOwner(govId) {
  const safeGovId = normalizeNumericId(govId);
  if (!safeGovId) return null;

  const res = db.exec(`
    SELECT
      main.player_id,
      main.name,
      main.power,
      main.killpoints,
      main.deads,
      main.ch
    FROM farm_accounts farm
    JOIN farm_accounts main ON main.player_id=farm.main_id
      AND main.acc_type='main'
    WHERE farm.player_id=${safeGovId}
      AND farm.acc_type='farm'
    LIMIT 1
  `);

  if (!res.length || !res[0].values.length) return null;

  const r = res[0].values[0];
  return {
    id: r[0] ?? "",
    name: r[1] ?? "",
    power: Number(r[2] ?? 0),
    killpoints: Number(r[3] ?? 0),
    deads: Number(r[4] ?? 0),
    ch: r[5] ?? "",
  };
}

function resolveFarmMainId(govId) {
  const safeGovId = normalizeNumericId(govId);
  if (!safeGovId) return null;

  const res = db.exec(`
    SELECT main_id, acc_type
    FROM farm_accounts
    WHERE player_id=${safeGovId}
    LIMIT 1
  `);

  if (!res.length || !res[0].values.length) return safeGovId;

  const [mainId, accType] = res[0].values[0];
  const safeMainId = normalizeNumericId(mainId);
  return String(accType || "").toLowerCase() === "farm" && safeMainId
    ? safeMainId
    : safeGovId;
}

function getGovernorFarmIds(govId) {
  return loadGovernorFarms(govId).map((farm) => farm.id);
}

function _fmtDiff(v) {
  const n = Number(v) || 0;
  const cls = n >= 0 ? "diff-positive" : "diff-negative";
  return `<span class="${cls}">${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}</span>`;
}

function renderDiffStack(baseValue, sumValue) {
  return renderMetricStack(baseValue, sumValue, (value) => {
    const n = Number(value) || 0;
    return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
  });
}

function renderMaybeRollupStack(baseValue, sumValue, formatter, showRollup) {
  return showRollup
    ? renderMetricStack(baseValue, sumValue, formatter)
    : formatter(baseValue);
}

function renderPairedDiffStack(firstLabel, firstBase, firstSum, secondLabel, secondBase, secondSum, showRollup = true) {
  return `
    <div class="modal-pair-stack">
      <div class="modal-pair-line">
        <span class="troop-diff-label">${escapeHtml(firstLabel)}</span>
        ${showRollup ? renderDiffStack(firstBase, firstSum) : _fmtDiff(firstBase)}
      </div>
      <div class="modal-pair-line">
        <span class="troop-diff-label">${escapeHtml(secondLabel)}</span>
        ${showRollup ? renderDiffStack(secondBase, secondSum) : _fmtDiff(secondBase)}
      </div>
    </div>
  `;
}

function renderFarmOwnerInfo(owner) {
  if (!owner) return "";

  return renderCollapsibleSection(
    "Main Account Owner",
    `
      <table class="gov-modal-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>ID</th>
            <th>Power</th>
            <th>Kill Points</th>
            <th>Deads</th>
            <th>CH</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="kvk-label">${escapeHtml(owner.name)}</td>
            <td>${escapeHtml(owner.id)}</td>
            <td>${Number(owner.power || 0).toLocaleString("en-US")}</td>
            <td>${Number(owner.killpoints || 0).toLocaleString("en-US")}</td>
            <td>${Number(owner.deads || 0).toLocaleString("en-US")}</td>
            <td>${escapeHtml(owner.ch)}</td>
          </tr>
        </tbody>
      </table>
    `,
    true,
  );
}

function renderModalTable(rows) {
  if (!rows.length)
    return `<div class="gov-modal-empty">No historical data found for this governor.</div>`;

  const headers = [
    "KvK",
    "Killpoints",
    "T4 / T5",
    "Deads / Power",
    "Min DKP",
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
      <td>${r.hasFarmRollup ? renderDiffStack(r.kpDiff, r.sumKpDiff) : _fmtDiff(r.kpDiff)}</td>
      <td>${renderPairedDiffStack("T4", r.t4Diff, r.sumT4Diff, "T5", r.t5Diff, r.sumT5Diff, r.hasFarmRollup)}</td>
      <td>${renderPairedDiffStack("Dead", r.deadsDiff, r.sumDeadsDiff, "Pwr", r.powerDiff, r.sumPowerDiff, r.hasFarmRollup)}</td>
      <td>${renderMaybeRollupStack(r.minDkp, r.sumMinDkp, formatNumber, r.hasFarmRollup)}</td>
      <td>${renderMaybeRollupStack(r.dkp, r.sumDkp, formatNumber, r.hasFarmRollup)}</td>
      <td>${renderMaybeRollupStack(r.dkpPercent, r.sumDkpPercent, formatPercent, r.hasFarmRollup)}</td>
      <td>${renderMaybeRollupStack(r.acclaim, r.sumAcclaim, formatNumber, r.hasFarmRollup)}</td>
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
  const safeGovId = normalizeNumericId(govId);
  if (!safeGovId) return null;

  try {
    const t = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='equipment'`);
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(`SELECT * FROM equipment WHERE player_id=${safeGovId} LIMIT 1`);
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => { row[c] = res[0].values[0][i]; });
    return row;
  } catch(e) { console.error("loadGovernorEquipment:", e); return null; }
}

function loadGovernorArmaments(govId) {
  const safeGovId = normalizeNumericId(govId);
  if (!safeGovId) return null;

  try {
    const t = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='armaments'`);
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(`SELECT * FROM armaments WHERE player_id=${safeGovId} LIMIT 1`);
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => { row[c] = res[0].values[0][i]; });
    return row;
  } catch(e) { console.error("loadGovernorArmaments:", e); return null; }
}

function iconPath(name, kind) {
  const folder = kind === "commander" ? "commanders" : "equipment";
  return `icons/${folder}/${encodeURIComponent(String(name).trim())}.webp`;
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

function getEquipmentRarity(itemName) {
  if (isEmptyVal(itemName)) return "empty";
  const name = String(itemName).trim().toLowerCase();
  if (name.endsWith("gray")) return "gray";
  if (name.endsWith("gr")) return "green";
  if (name.endsWith("g")) return "gold";
  if (name.endsWith("p")) return "purple";
  if (name.endsWith("b")) return "blue";
  return "unknown";
}

function renderSlotPlaceholderIcon(slotId) {
  const icons = {
    helmet: `<path d="M8 2.6 11 4v2.9c0 1.9-1.2 3.5-3 4.4-1.8-.9-3-2.5-3-4.4V4l3-1.4Zm-2 3.1v1l2 1.2 2-1.2v-1L8 6.9 6 5.7Zm.3 3 .7 1h2l.7-1H6.3Z"/><path opacity=".5" d="M8 2.6v4.3L6 5.7v-1L8 3.8l2 .9v1L8 6.9v4.4c-1.8-.9-3-2.5-3-4.4V4l3-1.4Z"/>`,
    chest: `<path d="M5.5 2.9 7 4.1h2l1.5-1.2 2.3 1.3-1.3 2.6-1-.4v4.3h-5V6.4l-1 .4-1.3-2.6 2.3-1.3Zm1.1 3-.5 1.4L8 8.1l1.9-.8-.5-1.4H6.6Zm-.1 2.8v1.1h3V8.7L8 9.3l-1.5-.6Z"/><path opacity=".45" d="M5.5 2.9 7 4.1 5.5 5.3v-2.4Zm5 0v2.4L9 4.1l1.5-1.2Zm-3.9 3H9.4l.4 1.1H6.2l.4-1.1Z"/>`,
    weapon: `<path d="M11.9 2.8 13.2 4l-5.6 5.6 1.1 1.1-1 1-1.1-1.1-1.5 1.5-1.2-1.2 1.5-1.5-1.1-1.1 1-1 1.1 1.1 5.5-5.6Zm-.5 2.3-3.8 3.8.5.5 3.8-3.8-.5-.5Z"/><path opacity=".45" d="M4.3 8.3 5.4 7.2l3.3 3.3-1 1-3.4-3.2Zm6.7-4.6 1.2-.9 1 .9-.9 1.2L11 3.7Z"/>`,
    gloves: `<path d="M6.1 3h1.4v4h.8V2.8h1.4V7h.7V3.6h1.3v4.1l.8.9-.6 2.4-1.6 1.1H7l-2.1-1.6-1.1-2 .9-1.1 1.4 1V3Zm.3 6-.6.5.6.9 1.1.7h2.4l.8-.6.3-1.2-.5-.6-1.9.4L6.4 9Z"/><path opacity=".45" d="M6.1 3h1.4v4H6.1V3Zm2.2-.2h1.4V7H8.3V2.8Zm1.4 6.1 1.5-.3-.2.8-1.3.5v-1Z"/>`,
    legs: `<path d="M5.2 3.2h5.6l.6 1.4-.9 3.3-.4 3.3-1.7.8L8 8.8 7.6 12l-1.7-.8-.4-3.3-.9-3.3.6-1.4Zm1.2 1.6.3 2h2.6l.3-2H6.4Zm.3 3 .3 2.3.4.2-.1-2.5h-.6Zm2 0-.1 2.5.4-.2.3-2.3h-.6Z"/><path opacity=".45" d="M6.4 4.8h3.2l-.3 1H6.7l-.3-1Zm-1 3.1 1.3-.1.3 2.3-1.1-.5-.5-1.7Zm5.2 0-.5 1.7-1.1.5.3-2.3 1.3.1Z"/>`,
    boots: `<path d="M4.7 3.3h2.7l.4 4.1-.5 1.7 1.5.8 2.8.4 1.4 1.2v1.1H3.6v-1.8l1.2-1 .2-2.9-.3-3.6Zm1.1 1.2.2 2.3-.2 3.6-.8.6v.4h6.2l-.4-.3-2.7-.4-2.2-1.3.5-1.9-.4-3H5.8Z"/><path opacity=".45" d="M9.1 3.8h2.2l.4 3.7-.5 1.4 1 .4-2.3-.3.3-1.4-.4-2.6h-.7V3.8ZM5.9 9.4l2.2 1.3 2.7.4.4.3H5l.9-2Z"/>`,
    accessory: `<path d="M8 2.5 10.2 5 8 7.5 5.8 5 8 2.5Zm0 5.8c1.8 0 3.3 1.5 3.3 3.3S9.8 14.9 8 14.9s-3.3-1.5-3.3-3.3S6.2 8.3 8 8.3Zm0 1.4c-1 0-1.9.8-1.9 1.9S7 13.5 8 13.5s1.9-.8 1.9-1.9S9 9.7 8 9.7Z"/>`,
    accessory_sec: `<path d="M5.9 2.4 7.4 4 5.9 5.7 4.4 4l1.5-1.6Zm4.2 0L11.6 4l-1.5 1.7L8.6 4l1.5-1.6ZM6.1 7.5c1.5 0 2.7 1.2 2.7 2.7s-1.2 2.7-2.7 2.7-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7Zm3.8 0c1.5 0 2.7 1.2 2.7 2.7s-1.2 2.7-2.7 2.7c-.4 0-.8-.1-1.1-.2.7-.6 1.1-1.5 1.1-2.5s-.4-1.9-1.1-2.5c.3-.1.7-.2 1.1-.2Zm-3.8 1.3c-.8 0-1.4.6-1.4 1.4s.6 1.4 1.4 1.4 1.4-.6 1.4-1.4-.6-1.4-1.4-1.4Z"/>`,
  };
  return `<svg class="equip-placeholder-icon" viewBox="0 0 16 16" aria-hidden="true">${icons[slotId] || icons.accessory}</svg>`;
}

function getItemInfo(itemCode) {
  const key = String(itemCode ?? "").trim();
  return (itemsData.items && itemsData.items[key]) || null;
}

function getCommanderInfo(commCode) {
  const key = String(commCode ?? "").trim();
  return (commandersData.commanders && commandersData.commanders[key]) || null;
}

function getInscriptionInfo(name) {
  const key = String(name ?? "").trim().toLowerCase();
  return inscriptionsByName[key] || null;
}

function buildTooltipHtml(code, kind) {
  if (isEmptyVal(code)) return "";
  const key = String(code).trim();

  if (kind === "commander") {
    const info = getCommanderInfo(key);
    const name = info ? info.name : key;
    return `<div class="tt-name">${escapeHtml(name)}</div>`;
  }

  if (kind === "inscription") {
    const info = getInscriptionInfo(key);
    if (!info) return `<div class="tt-name">${escapeHtml(key)}</div>`;
    const rarityClass = String(info.rarity || "gold").toLowerCase();
    const parts = [`<div class="tt-name tt-rarity-${rarityClass}">${escapeHtml(info.name || key)}</div>`];
    if (info.rarity) {
      parts.push(`<div class="tt-slot">${escapeHtml(info.rarity)}</div>`);
    }
    if (info.description) {
      parts.push(`<div class="tt-desc">${escapeHtml(String(info.description))}</div>`);
    }
    return parts.join("");
  }

  const info = getItemInfo(key);
  if (!info) return `<div class="tt-name">${escapeHtml(key)}</div>`;

  const rarityClass = String(info.rarity || "gold").toLowerCase();
  const parts = [`<div class="tt-name tt-rarity-${rarityClass}">${escapeHtml(info.name || key)}</div>`];

  if (info.slot) {
    parts.push(`<div class="tt-slot">${escapeHtml(info.slot)}</div>`);
  }

  const stats = Array.isArray(info.stats) ? info.stats : (info.stats ? [info.stats] : []);
  if (stats.length) {
    parts.push(`<ul class="tt-stats">${stats.map(s => `<li>${escapeHtml(String(s))}</li>`).join("")}</ul>`);
  }

  const descArr = Array.isArray(info.description) ? info.description : (info.description ? [info.description] : []);
  if (descArr.length) {
    parts.push(`<div class="tt-desc">${descArr.map(d => escapeHtml(String(d))).join("<br>")}</div>`);
  }

  return parts.join("");
}

function renderEquipBox(slot, itemName, lvl, tal, marchIdx) {
  const isEmpty = isEmptyVal(itemName);
  const imgSrc  = isEmpty ? null : iconPath(itemName, "item");
  const rarity  = getEquipmentRarity(itemName);
  const lvlText = (!isEmpty && !isEmptyVal(lvl)) ? lvl : "—";
  const talText = (!isEmpty && !isEmptyVal(tal)) ? tal : "—";
  const imgTag  = imgSrc
    ? `<img src="${imgSrc}" alt="${escapeHtml(String(itemName))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;border-radius:2px;">`
    : "";
  const fallback = `<div class="equip-placeholder" style="display:${imgSrc ? "none" : "flex"};">${renderSlotPlaceholderIcon(slot.id)}</div>`;
  const tipAttrs = isEmpty ? "" : ` data-tip-code="${escapeHtml(String(itemName).trim())}" data-tip-kind="item"`;
  return `
    <div class="equip-slot" id="${slot.id}_${marchIdx}">
      <div class="equip-box equip-box--framed rarity-${rarity}"${tipAttrs}>${imgTag}${fallback}</div>
      <div class="equip-meta">
        <span class="equip-lvl">Awk: ${lvlText}</span>
        <span class="equip-tal">Talent: ${talText}</span>
      </div>
    </div>`;
}

function renderPairBox(name) {
  const isEmpty = isEmptyVal(name);
  const imgSrc  = isEmpty ? null : iconPath(name, "commander");
  const imgTag  = imgSrc
    ? `<img src="${imgSrc}" alt="${escapeHtml(String(name))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;border-radius:2px;">`
    : "";
  const fallback = `<span style="display:${imgSrc ? "none" : "flex"};width:100%;height:100%;align-items:center;justify-content:center;font-size:9px;opacity:0.35;">—</span>`;
  const tipAttrs = isEmpty ? "" : ` data-tip-code="${escapeHtml(String(name).trim())}" data-tip-kind="commander"`;
  return `<div class="equip-box equip-pair-box${isEmpty ? " equip-pair-box--empty" : ""}"${tipAttrs}>${imgTag}${fallback}</div>`;
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
function getAbilityTier(name) {
  if (!name) return "gray";
  const info = getInscriptionInfo(name);
  return info ? info.rarity : "gray";
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
		return `<span class="arm-ins tier-${tier}" data-tip-code="${escapeHtml(String(v).trim())}" data-tip-kind="inscription">${escapeHtml(String(v))}</span>`;
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

function renderEmptyEquipmentMarch(marchNum = 1) {
  const slotBoxes = EQUIP_SLOTS.map(slot => renderEquipBox(slot, "", "", "", marchNum)).join("");
  return `
    <div class="equip-march-row equip-march-row--empty">
      <span class="equip-label">March ${marchNum}</span>
      <div class="equip-slots">${slotBoxes}</div>
    </div>`;
}

function renderEquipmentSection(govId) {
  const row    = govId ? loadGovernorEquipment(govId) : null;
  const armRow = govId ? loadGovernorArmaments(govId) : null;

  if (!row) {
    return renderCollapsibleSection(
      "Equipment",
      `<div class="equip-grid">${renderEmptyEquipmentMarch(1)}${renderArmamentRow(armRow)}</div>`,
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

  if (!marchRows) marchRows = renderEmptyEquipmentMarch(1);

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
    "Killpoints",
    "T4 / T5",
    "Deads / Power",
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
        <td>${_fmtDiff(r.kpDiff)}</td>
        <td>${renderTroopDiffStack(r.t4Diff, r.t5Diff)}</td>
        <td>${renderDeadsPowerDiffStack(r.deadsDiff, r.powerDiff)}</td>
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
  const safeGovId = normalizeNumericId(govId);

  if (!safeGovId) {
    subtitle.textContent = "";
    body.innerHTML = `<div class="gov-modal-empty">Invalid governor ID.</div>`;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    return;
  }

  govId = safeGovId;

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
      const farmOwner = loadFarmOwner(govId);
      const farms   = loadGovernorFarms(govId);
      const farmIds = farms.map((f) => f.id);
      const farmKvK = loadFarmKvKStats(farmIds);
	  const chartSection = `
	    <div class="modal-chart-section">
	      <div class="modal-chart" style="height:400px;">
	        <canvas id="modal-chart"></canvas>
	      </div>
	    </div>
	  `;
      body.innerHTML =
        '<div class="modal-controls">' +
        '  <button onclick="expandAllSections()">Expand All</button>' +
        '  <button onclick="collapseAllSections()">Collapse All</button>' +
        '</div>' +
		chartSection +
        safeRender("farmOwner", () => renderFarmOwnerInfo(farmOwner)) +
        safeRender("history",   () => renderCollapsibleSection("Governor History", renderModalTable(history), false)) +
        safeRender("farms",     () => renderFarmsTable(farms)) +
        safeRender("farmKvK",   () => renderFarmKvKTable(farmKvK)) +
        safeRender("equipment", () => renderEquipmentSection(govId));
	setTimeout(() => {
	  updateChart(govId);
	}, 0);
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
    const mainId = normalizeNumericId(m[0]);
    if (!mainId) return null;

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
  }).filter(Boolean);
}

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
