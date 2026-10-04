function getToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

const TOAST_ICONS = {
  error: "fa-solid fa-circle-exclamation",
  info: "fa-solid fa-circle-info",
  success: "fa-solid fa-circle-check",
};

function showToast(message, type = "info", duration = 5000) {
  const container = getToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "alert");

  const icon = document.createElement("i");
  icon.className = `toast-icon ${TOAST_ICONS[type] || TOAST_ICONS.info}`;

  const text = document.createElement("span");
  text.className = "toast-message";
  text.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.className = "toast-close";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';

  toast.append(icon, text, closeBtn);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  const remove = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  };

  closeBtn.addEventListener("click", remove);
  if (duration > 0) setTimeout(remove, duration);
}

function getKDFromURL() {
  const params = new URLSearchParams(window.location.search);
  return normalizeNumericId(params.get("kd"));
}

function getKvkNumberFromURL() {
  const params = new URLSearchParams(window.location.search);
  return normalizeNumericId(params.get("kvk"));
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
let skinsData = { skins: {} };
let armamentsData = { armaments: {} };
let armamentsByKey = {};

function normalizeArmamentKey(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/formation/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function loadEquipRefData() {
  try {
    const [itemsRes, commandersRes, inscriptionsRes, skinsRes, armamentsRes] =
      await Promise.all([
        fetch("data/items.json"),
        fetch("data/commanders.json"),
        fetch("data/inscriptions.json"),
        fetch("data/skins.json"),
        fetch("data/armaments.json"),
      ]);
    itemsData = await itemsRes.json();
    commandersData = await commandersRes.json();
    inscriptionsData = await inscriptionsRes.json();
    skinsData = await skinsRes.json();
    armamentsData = await armamentsRes.json();

    inscriptionsByName = {};
    for (const [key, info] of Object.entries(
      inscriptionsData.inscriptions || {},
    )) {
      const nameKey = String(info.name || key)
        .trim()
        .toLowerCase();
      inscriptionsByName[nameKey] = { key, ...info };
    }

    armamentsByKey = {};
    for (const [key, info] of Object.entries(
      armamentsData.armaments || {},
    )) {
      const entry = { key, ...info };
      armamentsByKey[normalizeArmamentKey(key)] = entry;
      if (info.name) armamentsByKey[normalizeArmamentKey(info.name)] = entry;
    }
  } catch (e) {
    console.error("loadEquipRefData:", e);
  }
}
loadEquipRefData();
const DB_VERSION = "9"; 
async function loadDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
  });

  const res = await fetch(`kvk.db?v=${DB_VERSION}`);
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
    if (!existing.has(name))
      db.run(`ALTER TABLE stats ADD COLUMN ${name} ${type}`);
  });
}

const DbCache = {};

async function loadDashboardData() {
  await loadDatabase();

  const kd = getKDFromURL();
  if (!kd) {
    showToast("Invalid or missing kingdom ID", "error");
    return;
  }

  const kvkNumber = getKvkNumberFromURL();

  const kvk = kvkNumber
    ? db.exec(`
	  SELECT id, kvk_number, name
	  FROM kvks
	  WHERE kingdom='${kd}' AND kvk_number=${kvkNumber}
	  LIMIT 1
	`)[0]
    : db.exec(`
	  SELECT id, kvk_number, name
	  FROM kvks
	  WHERE kingdom='${kd}'
	  ORDER BY kvk_number DESC
	  LIMIT 1
	`)[0];

  if (!kvk) {
    showToast("No KvK found in DB for this kingdom/KvK selection", "error");
    return;
  }

  const kvkId = kvk.values[0][0];
  DbCache.currentKvkNumber = kvk.values[0][1];
  DbCache.currentKvkName = kvk.values[0][2];
  const snaps = db.exec(`
    SELECT id, snapshot_date
    FROM snapshots
    WHERE kvk_id=${kvkId}
    ORDER BY snapshot_date
  `)[0];

  DbCache.snapshotsList = snaps.values.map((r) => r[1]);
  DbCache.snapshotIds = Object.fromEntries(
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

  DbCache.lastSnapshotData = {
    rows: grid.values,
  };

  DbCache.snapshotsData = {};

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
      const bySnap = {};
      allDiffData.values.forEach((r) => {
        const sid = r[0];
        if (!bySnap[sid]) bySnap[sid] = {};
        bySnap[sid][String(r[1])] = r;
      });

      snaps.values.forEach(([sid, date]) => {
        DbCache.snapshotsData[date] = { rows: bySnap[sid] || {} };
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

let table;

function buildRowData(rows) {
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

function getExportFileName() {
  const kd = getKDFromURL() || "dkp";
  const kvkPart = DbCache.currentKvkNumber
    ? `_kvk${DbCache.currentKvkNumber}`
    : "";
  const lastSnapshot =
    DbCache.snapshotsList?.[DbCache.snapshotsList.length - 1] || "export";
  return `DKP_${kd}${kvkPart}_${String(lastSnapshot).replaceAll("-", "_")}.csv`;
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

const num = (v) => Number(v) || 0;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function renderGovernor(row) {
  const name = escapeHtml(row.name);
  if (!row.id) {
    return `<div class="gov-name-stack"><div class="gov-name-value">${name}</div></div>`;
  }
  return (
    `<div class="gov-name-stack">` +
    `<div class="gov-name-value gov-name-link" data-tip="View governor history">${name}</div>` +
    `<a class="gov-id" data-tip="Copy governor ID"><span class="gov-id-text">${escapeHtml(row.id)}</span>` +
    `<i class="fa-regular fa-copy gov-id-copy-icon"></i></a>` +
    `</div>`
  );
}

function stackedColumn(sortValue, renderDisplay) {
  return (data, type, row) =>
    type === "display" ? renderDisplay(row) : sortValue(row);
}

const TIP_FARMS = "with farms\nwithout farms";
const FIRST_KVK_WITH_SUMS = 8;
let hasSums = true;

function sumMetricColumn({ title, data, sumData, format, name }) {
  return {
    title,
    data,
    name,
    className: "metric-stack-cell",
    render: (value, type, row) => {
      if (type !== "display") return num(hasSums ? row[sumData] : value);
      return hasSums
        ? renderMetricStack(value, row[sumData], format)
        : `<div class="metric-stack"><div class="metric-base">${format(value)}</div></div>`;
    },
    createdCell: (td) => {
      if (hasSums) td.dataset.tip = TIP_FARMS;
    },
  };
}

const VISIBLE_COLUMNS = [
  {
    title: "#",
    data: null,
    defaultContent: "",
    className: "row-num",
    orderable: false,
    width: "55px",
  },
  {
    title: "Governor",
    data: "name",
    className: "gov-cell",
    searchable: true,
    render: (name, type, row) => {
      if (type === "display") return renderGovernor(row);
      if (type === "filter") return `${row.name ?? ""} ${row.id ?? ""}`;
      return name ?? "";
    },
  },
  {
    title: "Killpoints",
    data: "killPointsDiff",
    render: (v, type) => (type === "display" ? formatSignedNumber(v) : num(v)),
    createdCell: (td, v, row) => {
      td.classList.add(num(v) >= 0 ? "diff-positive" : "diff-negative");
      td.dataset.tip = `Current KP: ${formatNumber(row.killPoints)}`;
    },
  },
  {
    title: "T4 / T5",
    data: "t4Diff",
    className: "metric-stack-cell",
    render: stackedColumn(
      (r) => num(r.t4Diff) + num(r.t5Diff),
      (r) => renderTroopDiffStack(r.t4Diff, r.t5Diff),
    ),
    createdCell: (td, v, r) => {
      td.dataset.tip = `Current T4: ${formatNumber(r.t4)}\nCurrent T5: ${formatNumber(r.t5)}`;
    },
  },
  {
    title: "Deads / Power",
    data: "deadsDiff",
    className: "metric-stack-cell",
    render: stackedColumn(
      (r) => num(r.deadsDiff),
      (r) => renderDeadsPowerDiffStack(r.deadsDiff, r.powerDiff),
    ),
    createdCell: (td, v, r) => {
      td.dataset.tip = `Current Deads: ${formatNumber(r.deads)}\nCurrent Power: ${formatNumber(r.power)}`;
    },
  },
  {
    title: "Acclaim",
    data: "acclaim",
    render: DataTable.render.number(",", ".", 0),
  },
  sumMetricColumn({
    title: "Min DKP",
    data: "minDkp",
    sumData: "sumMinDkp",
    format: formatNumber,
  }),
  sumMetricColumn({
    title: "DKP",
    data: "dkp",
    sumData: "sumDkp",
    format: formatNumber,
    name: "dkp",
  }),
  sumMetricColumn({
    title: "DKP %",
    data: "dkpPercent",
    sumData: "sumDkpPercent",
    format: formatPercent,
  }),
];

const EXPORT_COLUMNS = [
  ["ID", "id"],
  ["Name", "name"],
  ["Power", "power"],
  ["KP gained", "killPointsDiff"],
  ["T4 gained", "t4Diff"],
  ["T5 gained", "t5Diff"],
  ["Deads gained", "deadsDiff"],
  ["Min DKP", "minDkp"],
  ["DKP", "dkp"],
  ["DKP%", "dkpPercent", true],
  ["Sum Min DKP", "sumMinDkp"],
  ["Sum DKP", "sumDkp"],
  ["Sum DKP%", "sumDkpPercent", true],
  ["Vacation", "vacation"],
  ["Status", "status"],
  ["T4 Kills", "t4"],
  ["T5 Kills", "t5"],
  ["Killpoints", "killPoints"],
  ["Deads", "deads"],
  ["Power diff", "powerDiff"],
  ["Acclaim", "acclaim"],
].map(([title, data, isPercent]) => ({
  title,
  data,
  visible: false,
  orderable: false,
  render: isPercent
    ? (v, type) => (type === "export" ? formatCsvPercent(v) : v)
    : undefined,
}));

const TABLE_COLUMNS = [...VISIBLE_COLUMNS, ...EXPORT_COLUMNS].map((c) => ({
  searchable: false,
  ...c,
}));
const DKP_COL = TABLE_COLUMNS.findIndex((c) => c.name === "dkp");
const SUM_FIELDS = new Set(["sumMinDkp", "sumDkp", "sumDkpPercent"]);
const exportColumnIndexes = () =>
  EXPORT_COLUMNS.flatMap((c, i) =>
    hasSums || !SUM_FIELDS.has(c.data) ? [VISIBLE_COLUMNS.length + i] : [],
  );

const exportFilename = () => getExportFileName().replace(/\.csv$/, "");
const exportOptions = (orthogonal) => ({
  columns: exportColumnIndexes(),
  orthogonal,
  stripHtml: false,
  modifier: { search: "none", order: "current" },
});

function initTable(rowData) {
  const kvkNumber = Number(DbCache.currentKvkNumber);
  hasSums = !(kvkNumber < FIRST_KVK_WITH_SUMS);

  table = new DataTable("#dkpTable", {
    data: rowData,
    columns: TABLE_COLUMNS,
    order: [[DKP_COL, "desc"]],
    stripeClasses: [],
    scroller: true,
    scrollY: "700px",
    scrollX: true,
    scrollCollapse: true,
    fixedColumns: { start: 2 },
    rowCallback: (row, data, displayNum, displayIndexFull) => {
      row.cells[0].textContent = displayIndexFull + 1;
      row.classList.toggle("row-alt", displayIndexFull % 2 === 1);
    },

    layout: {
      topStart: {
        buttons: [
			{
			  text: CARD_BTN_TEXT,
			  className: "shared-style-btn",
			  action: function () {
			    setCardMode(!cardMode);
			    this.text(cardMode ? TABLE_BTN_TEXT : CARD_BTN_TEXT);
			  },
			},
          {
            extend: "csvHtml5",
            text: '<i class="fa-solid fa-download" style="font-size: 14px"></i> Export CSV',
            className: "shared-style-btn",
            filename: exportFilename,
            fieldSeparator: ";",
            newline: "\r\n",
            bom: true,
            exportOptions: exportOptions("export"),
          },
          {
            extend: "excelHtml5",
            text: '<i class="fa-solid fa-file-excel" style="font-size: 14px"></i> Export Excel',
            className: "shared-style-btn",
            filename: exportFilename,
            title: null,
            exportOptions: exportOptions("excel"),
          },
          {
            text: '<i class="fa-regular fa-copy" style="font-size: 14px"></i> Copy Top 18',
            className: "shared-style-btn",
            action: copyTop18,
          },
        ],
      },
      topEnd: "search",
      bottomStart: null,
      bottomEnd: null,
    },
    language: {
      search: "",
      searchPlaceholder: "Search...",
      zeroRecords: "No matching governors",
    },
  });
	cardsEl = document.createElement("div");
	cardsEl.id = "dkpCards";
	cardsEl.className = "dkp-cards";
	table.table().container().querySelector(".dt-scroll").after(cardsEl);
	
	table.on("draw", () => {
	  if (cardMode) renderCards();
	});
  table.table().container().addEventListener("click", onTableClick);
  initCellTooltip(table.table().container());
}

const TIP_SHOW_DELAY = 300;

function initCellTooltip(container) {
  const tip = document.createElement("div");
  tip.className = "cell-tooltip";
  document.body.appendChild(tip);

  let timer = null;
  let activeEl = null;

  const hide = () => {
    clearTimeout(timer);
    activeEl = null;
    tip.classList.remove("visible");
  };

  const show = (el, x, y) => {
    tip.textContent = el.dataset.tip;
    tip.classList.add("visible");
    const { width, height } = tip.getBoundingClientRect();
    const gap = 12;
    let left = x + gap;
    let top = y + gap;
    if (left + width > window.innerWidth - 8) left = x - width - gap;
    if (top + height > window.innerHeight - 8) top = y - height - gap;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  };

  container.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (!el || el === activeEl) return;
    hide();
    activeEl = el;
    const { clientX, clientY } = e;
    timer = setTimeout(() => show(el, clientX, clientY), TIP_SHOW_DELAY);
  });
  container.addEventListener("mouseout", (e) => {
    if (activeEl && !activeEl.contains(e.relatedTarget)) hide();
  });
  container.addEventListener("scroll", hide, true);
  container.addEventListener("click", hide);
}

function onTableClick(e) {
  const nameEl = e.target.closest(".gov-name-link");
  const idEl = e.target.closest(".gov-id");
  if (!nameEl && !idEl) return;

	const card = e.target.closest(".dkp-card");
	const row = card
	  ? table.row(Number(card.dataset.row)).data()
	  : table.row(e.target.closest("tr")).data();
	if (!row) return;

  if (nameEl) {
    openGovModal(String(row.id), row.name || "");
    return;
  }

  if (idEl.classList.contains("gov-id-copied")) return;
  copyText(String(row.id)).then((ok) => {
    if (!ok) return showToast("Could not copy governor ID", "error");
    const idText = idEl.querySelector(".gov-id-text");
    const original = idText.textContent;
    idText.textContent = "Copied!";
    idEl.classList.add("gov-id-copied");
    setTimeout(() => {
      idText.textContent = original;
      idEl.classList.remove("gov-id-copied");
    }, 1200);
  });
}

async function copyTop18(e, dt, node, config) {
  const rows = dt.rows().data().toArray();
  const dkpKey = hasSums ? "sumDkp" : "dkp";
  if (!rows.length) {
    showToast("No data loaded yet.", "info");
    return;
  }

  const text = rows
    .sort((a, b) => num(b[dkpKey]) - num(a[dkpKey]))
    .slice(0, 18)
    .map((row, i) => `${i + 1}. ${row.id} ${row.name}`)
    .join("\n");

  if (!(await copyText(text))) {
    showToast("Could not copy to clipboard", "error");
    return;
  }

  this.text("✓ Copied!");
  this.disable();
  setTimeout(() => {
    this.text(config.text);
    this.enable();
  }, 2000);
}

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

function formatSnapshotDate(snapshotDate) {
  if (!snapshotDate || typeof snapshotDate !== "string") return snapshotDate;

  if (/^\d{2}_\d{2}_\d{4}$/.test(snapshotDate)) {
    return snapshotDate.replaceAll("_", ".");
  }

  return snapshotDate;
}

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
    const data = DbCache.snapshotsList.map((snapshotDate) => {
      const sheet = DbCache.snapshotsData[snapshotDate];

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

  const labels = DbCache.snapshotsList.map(formatSnapshotDate);
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

loadDashboardData().then(() => {
  const spinner = document.getElementById("loading-spinner");
  const rows = DbCache.lastSnapshotData?.rows;
  if (!rows) {
    spinner.style.display = "none";
    return;
  }

  initTable(buildRowData(rows));

  const sortedByDKP = [...rows]
    .sort((a, b) => Number(b[COL_table.DKP]) - Number(a[COL_table.DKP]))
    .slice(0, 3);

  renderTopPlayers(sortedByDKP);
  renderTotals(rows);

  spinner.style.display = "none";
  requestAnimationFrame(() => {
    document.getElementById("gridWrapper").classList.add("visible");
  });
});

function renderTopPlayers(players) {
  const boxes = document.querySelectorAll("#top-players .player-box");

  boxes.forEach((box) => {
    const rank = Number(box.dataset.rank);
    const p = players[rank - 1];
    box.querySelector(".player-name").textContent = p ? p[1] ?? "" : "";
    box.querySelector(".player-id").textContent = p ? `ID: ${p[0] ?? ""}` : "";
    const dkpEl = box.querySelector(".player-dkp");
    if (dkpEl) {
      const dkpVal = p ? Number(p[COL_table.DKP]) : null;
      dkpEl.textContent =
        p && !Number.isNaN(dkpVal) ? `${dkpVal.toLocaleString()} DKP` : "";
    }
    box.style.visibility = p ? "" : "hidden";
  });
}
function renderTotals(rows = []) {
  const sums = {
    t4: 0,
    t5: 0,
    deads: 0,
    kp: 0,
  };
  const cols = {
    t4: COL_table.T4_DIFF,
    t5: COL_table.T5_DIFF,
    deads: COL_table.DEADS_DIFF,
    kp: COL_table.KP_DIFF,
  };

  rows.forEach((r) => {
    for (const key in cols) {
      sums[key] += Number(r[cols[key]]) || 0;
    }
  });

  for (const key in sums) {
    const el = document.querySelector(`.stat-box[data-stat="${key}"] .stat-value`);
    if (el) el.textContent = sums[key].toLocaleString();
  }
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

function getCurrentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
  document.documentElement.classList.toggle("dark", theme === "dark");

  localStorage.setItem(THEME_KEY, theme);

  applyChartTheme();
}

function initTheme() {
  const theme = getCurrentTheme();
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
      link.setAttribute("href", current + window.location.search);
    }
  });

  initEquipTooltip();
});

function initEquipTooltip() {
  const tip = document.getElementById("equipTooltip");
  if (!tip) return;

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

  document.addEventListener(
    "scroll",
    () => {
      tip.style.display = "none";
      activeEl = null;
    },
    true,
  );
}

function renderCollapsibleSection(title, content, defaultOpen = false) {
  const id =
    "sec_" +
    (renderCollapsibleSection._counter =
      (renderCollapsibleSection._counter || 0) + 1);

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

function switchGovModalTab(tab) {
  document.querySelectorAll(".gov-modal-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".gov-modal-tab-pane").forEach((pane) => {
    pane.style.display = pane.id === `govTabPane-${tab}` ? "block" : "none";
  });
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
  const farmIds = isMainAccount ? getGovernorFarmIds(safeGovId) : [];
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
    const rollsUpFarms =
      isMainAccount &&
      Boolean(farmIdList) &&
      !(Number(kvkNumber) < FIRST_KVK_WITH_SUMS);
    let farmSums = null;
    if (rollsUpFarms) {
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
      hasFarmRollup: rollsUpFarms,
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
        s.acclaim,
        s.min_dkp
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
        minDkp: r[10],
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

function renderPairedDiffStack(
  firstLabel,
  firstBase,
  firstSum,
  secondLabel,
  secondBase,
  secondSum,
  showRollup = true,
) {
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


function formatCompact(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const units = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      return sign + (abs / size).toFixed(2).replace(/\.?0+$/, "") + suffix;
    }
  }
  return String(n);
}
let cardsEl = null;
let cardMode = false;

const CARD_BTN_TEXT = '<i class="fa-solid fa-table-cells-large" style="font-size: 14px"></i> Card view';
const TABLE_BTN_TEXT = '<i class="fa-solid fa-table" style="font-size: 14px"></i> Table view';

function renderCard(r, rowIdx, rank) {
  const metric = (base, sum, fmt) =>
    hasSums
      ? renderMetricStack(base, sum, fmt)
      : `<div class="metric-stack"><div class="metric-base">${fmt(base)}</div></div>`;
  const field = (label, html) =>
    `<div class="dkp-card-field"><span class="dkp-card-label">${label}</span><div class="dkp-card-value">${html}</div></div>`;
  const kpCls = num(r.killPointsDiff) >= 0 ? "diff-positive" : "diff-negative";

  return `
    <div class="dkp-card" data-row="${rowIdx}">
      <div class="dkp-card-head">
        <span class="dkp-card-rank">${rank}</span>
        ${renderGovernor(r)}
      </div>
      ${field("Killpoints", `<span class="${kpCls}">${formatSignedNumber(r.killPointsDiff)}</span>`)}
      ${field("T4 / T5", renderTroopDiffStack(r.t4Diff, r.t5Diff))}
      ${field("Deads / Power", renderDeadsPowerDiffStack(r.deadsDiff, r.powerDiff))}
      ${field("Acclaim", formatNumber(r.acclaim))}
      ${field("Min DKP", metric(r.minDkp, r.sumMinDkp, formatNumber))}
      ${field("DKP", metric(r.dkp, r.sumDkp, formatNumber))}
      ${field("DKP %", metric(r.dkpPercent, r.sumDkpPercent, formatPercent))}
    </div>`;
}

function renderCards() {
  const rows = table.rows({ search: "applied", order: "applied" });
  const idx = rows.indexes().toArray();
  const data = rows.data().toArray();
  cardsEl.innerHTML = data.map((r, i) => renderCard(r, idx[i], i + 1)).join("");
}

function setCardMode(on) {
  cardMode = on;
  table.table().container().classList.toggle("dkp-cards-on", on);
  if (on) {
    renderCards();
  } else {
    table.columns.adjust();
    table.scroller?.measure?.(false);
  }
}
function renderKvkGainStat(label, base, sum, showRollup, opts = {}) {
  const {
    signed = true,
    hideZero = false,
    format = formatCompact,
    full = formatNumber,
  } = opts;

  const main = Number(showRollup ? sum : base) || 0;
  const alone = Number(base) || 0;

  if (hideZero && main === 0) {
    return `
      <div class="kvk-gain-stat">
        <span class="kvk-gain-label">${label}</span>
        <span class="kvk-gain-value">—</span>
      </div>`;
  }

  const show = (n) => `${signed && n > 0 ? "+" : ""}${format(n)}`;
  const cls = signed ? (main >= 0 ? "diff-positive" : "diff-negative") : "";
  const title = showRollup
    ? `${full(main)} with farms\n${full(alone)} without farms`
    : full(main);

  return `
    <div class="kvk-gain-stat" title="${title}">
      <span class="kvk-gain-label">${label}</span>
      <span class="kvk-gain-value ${cls}">${show(main)}</span>
      ${showRollup ? `<span class="kvk-gain-rollup">${show(alone)}</span>` : ""}
    </div>`;
}

function renderKvkGainBoxes(rows) {
  if (!rows.length) {
    return `<div class="gov-modal-empty">No historical data found for this governor.</div>`;
  }

  const pct = { signed: false, format: formatPercent, full: formatPercent };
  const plain = { signed: false };

  const boxes = [...rows]
    .reverse()
    .map((r) => {
      const f = r.hasFarmRollup;
      return `
        <div class="kvk-gain-box">
          <div class="kvk-gain-title">${escapeHtml(r.kvk)}</div>
          <div class="kvk-gain-stats">
            ${renderKvkGainStat("Kill Points", r.kpDiff, r.sumKpDiff, f)}
            ${renderKvkGainStat("T4 Kills", r.t4Diff, r.sumT4Diff, f)}
            ${renderKvkGainStat("T5 Kills", r.t5Diff, r.sumT5Diff, f)}
            ${renderKvkGainStat("Deads", r.deadsDiff, r.sumDeadsDiff, f)}
            ${renderKvkGainStat("Power", r.powerDiff, r.sumPowerDiff, f)}
            ${renderKvkGainStat("Acclaim", r.acclaim, r.sumAcclaim, f, { hideZero: true })}
            ${renderKvkGainStat("Min DKP", r.minDkp, r.sumMinDkp, f, plain)}
            ${renderKvkGainStat("DKP", r.dkp, r.sumDkp, f, plain)}
            ${renderKvkGainStat("DKP %", r.dkpPercent, r.sumDkpPercent, f, pct)}
          </div>
        </div>`;
    })
    .join("");

  return `<div class="kvk-gains-grid">${boxes}</div>`;
}

function renderPlainStat(label, display, full) {
  return `
    <div class="kvk-gain-stat" title="${escapeHtml(String(full ?? display))}">
      <span class="kvk-gain-label">${label}</span>
      <span class="kvk-gain-value">${escapeHtml(String(display))}</span>
    </div>`;
}

function renderAccountBoxes(accounts) {
  const boxes = accounts
    .map(
      (a) => `
      <div class="kvk-gain-box">
        <div class="kvk-gain-title">
          <span class="kvk-gain-name">${escapeHtml(a.name)}</span>
          <span class="kvk-gain-id">${escapeHtml(a.id)}</span>
        </div>
        <div class="kvk-gain-stats cols-4">
          ${renderPlainStat("Power", formatCompact(a.power), formatNumber(a.power))}
          ${renderPlainStat("Kill Points", formatCompact(a.killpoints), formatNumber(a.killpoints))}
          ${renderPlainStat("Deads", formatCompact(a.deads), formatNumber(a.deads))}
          ${renderPlainStat("CH", a.ch || "—")}
        </div>
      </div>`,
    )
    .join("");
  return `<div class="kvk-gains-grid">${boxes}</div>`;
}

const EQUIP_SLOTS = [
  { key: "helm", label: "Helm", id: "helmet" },
  { key: "chest", label: "Chest", id: "chest" },
  { key: "weapon", label: "Weapon", id: "weapon" },
  { key: "gloves", label: "Gloves", id: "gloves" },
  { key: "legs", label: "Legs", id: "legs" },
  { key: "boots", label: "Boots", id: "boots" },
  { key: "accessory", label: "Acc.", id: "accessory" },
  { key: "accessory_sec", label: "Acc. 2", id: "accessory_sec" },
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
const SKIN_SLOTS = Array.from({ length: 8 }, (_, i) => `skin${i + 1}`);

function loadGovernorEquipment(govId) {
  const safeGovId = normalizeNumericId(govId);
  if (!safeGovId) return null;

  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='equipment'`,
    );
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(
      `SELECT * FROM equipment WHERE player_id=${safeGovId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => {
      row[c] = res[0].values[0][i];
    });
    return row;
  } catch (e) {
    console.error("loadGovernorEquipment:", e);
    return null;
  }
}

function loadGovernorArmaments(govId) {
  const safeGovId = normalizeNumericId(govId);
  if (!safeGovId) return null;

  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='armaments'`,
    );
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(
      `SELECT * FROM armaments WHERE player_id=${safeGovId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => {
      row[c] = res[0].values[0][i];
    });
    return row;
  } catch (e) {
    console.error("loadGovernorArmaments:", e);
    return null;
  }
}

function loadGovernorSkins(govId) {
  const safeGovId = normalizeNumericId(govId);
  if (!safeGovId) return null;

  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='skins'`,
    );
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(
      `SELECT * FROM skins WHERE player_id=${safeGovId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => {
      row[c] = res[0].values[0][i];
    });
    return row;
  } catch (e) {
    console.error("loadGovernorSkins:", e);
    return null;
  }
}

function loadPlayerProfile(govId) {
  const safeGovId = normalizeNumericId(govId);
  if (!safeGovId) return null;

  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='player_profile'`,
    );
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(
      `SELECT vip_level, city_skin FROM player_profile WHERE player_id=${safeGovId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return null;
    const [vip_level, city_skin] = res[0].values[0];
    return { vip_level, city_skin };
  } catch (e) {
    console.error("loadPlayerProfile:", e);
    return null;
  }
}

function iconPath(name, kind) {
  const folder =
    kind === "commander" ? "commanders" :
    kind === "skin" ? "skins" :
    kind === "armament" ? "armaments" :
    "equipment";
  return `icons/${folder}/${encodeURIComponent(String(name).trim().toLowerCase())}.webp`;
}

function isEmptyVal(v) {
  if (v === null || v === undefined || v === "") return true;
  const s = String(v).trim().toLowerCase();
  return s === "none" || s === "0";
}

function isMarchEmpty(row, suffix) {
  return EQUIP_SLOTS.every((slot) => {
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

function getSkinInfo(skinCode) {
  const key = String(skinCode ?? "").trim();
  return (skinsData.skins && skinsData.skins[key]) || null;
}

function getInscriptionInfo(name) {
  const key = String(name ?? "")
    .trim()
    .toLowerCase();
  return inscriptionsByName[key] || null;
}

function getArmamentInfo(name) {
  return armamentsByKey[normalizeArmamentKey(name)] || null;
}

function buildTooltipHtml(code, kind) {
  if (isEmptyVal(code)) return "";
  const key = String(code).trim();

  if (kind === "commander") {
    const info = getCommanderInfo(key);
    const name = info ? info.name : key;
    return `<div class="tt-name">${escapeHtml(name)}</div>`;
  }

  if (kind === "armament") {
    const info = getArmamentInfo(key);
    const name = info && info.name ? info.name : key;
    const parts = [`<div class="tt-name">${escapeHtml(name)}</div>`];
    if (info && info.description) {
      const descArr = Array.isArray(info.description)
        ? info.description
        : [info.description];
      parts.push(
        `<div class="tt-desc">${descArr.map((d) => escapeHtml(String(d))).join("<br>")}</div>`,
      );
    }
    return parts.join("");
  }

  if (kind === "inscription") {
    const info = getInscriptionInfo(key);
    if (!info) return `<div class="tt-name">${escapeHtml(key)}</div>`;
    const rarityClass = String(info.rarity || "gold").toLowerCase();
    const parts = [
      `<div class="tt-name tt-rarity-${rarityClass}">${escapeHtml(info.name || key)}</div>`,
    ];
    if (info.type) {
      parts.push(`<div class="tt-slot">${escapeHtml(info.type)}</div>`);
    }
    if (info.description) {
      parts.push(
        `<div class="tt-desc">${escapeHtml(String(info.description))}</div>`,
      );
    }
    return parts.join("");
  }

  if (kind === "skin") {
    const info = getSkinInfo(key);
    if (!info) return `<div class="tt-name">${escapeHtml(key)}</div>`;
    const rarityClass = String(info.rarity || "gold").toLowerCase();
    const parts = [
      `<div class="tt-name tt-rarity-${rarityClass}">${escapeHtml(info.name || key)}</div>`,
    ];
    const stats = Array.isArray(info.stats)
      ? info.stats
      : info.stats
        ? [info.stats]
        : [];
    if (stats.length) {
      parts.push(
        `<ul class="tt-stats">${stats.map((s) => `<li>${escapeHtml(String(s))}</li>`).join("")}</ul>`,
      );
    }
    const descArr = Array.isArray(info.description)
      ? info.description
      : info.description
        ? [info.description]
        : [];
    if (descArr.length) {
      parts.push(
        `<div class="tt-desc">${descArr.map((d) => escapeHtml(String(d))).join("<br>")}</div>`,
      );
    }
    return parts.join("");
  }

  const info = getItemInfo(key);
  if (!info) return `<div class="tt-name">${escapeHtml(key)}</div>`;

  const rarityClass = String(info.rarity || "gold").toLowerCase();
  const parts = [
    `<div class="tt-name tt-rarity-${rarityClass}">${escapeHtml(info.name || key)}</div>`,
  ];

  if (info.slot) {
    parts.push(`<div class="tt-slot">${escapeHtml(info.slot)}</div>`);
  }

  const stats = Array.isArray(info.stats)
    ? info.stats
    : info.stats
      ? [info.stats]
      : [];
  if (stats.length) {
    parts.push(
      `<ul class="tt-stats">${stats.map((s) => `<li>${escapeHtml(String(s))}</li>`).join("")}</ul>`,
    );
  }

  const descArr = Array.isArray(info.description)
    ? info.description
    : info.description
      ? [info.description]
      : [];
  if (descArr.length) {
    parts.push(
      `<div class="tt-desc">${descArr.map((d) => escapeHtml(String(d))).join("<br>")}</div>`,
    );
  }

  return parts.join("");
}

const ROMAN_NUMERALS = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
];

function toRoman(v) {
  const n = parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return ROMAN_NUMERALS[n] || String(n);
}

function hasTalent(v) {
  if (isEmptyVal(v)) return false;
  const s = String(v).trim().toLowerCase();
  return !["no", "n", "false", "-", "—"].includes(s);
}

function renderEquipBox(slot, itemName, lvl, tal, marchIdx) {
  const isEmpty = isEmptyVal(itemName);
  const imgSrc = isEmpty ? null : iconPath(itemName, "item");
  const rarity = getEquipmentRarity(itemName);
  const lvlText = !isEmpty && !isEmptyVal(lvl) ? lvl : "—";
  const talText = !isEmpty && !isEmptyVal(tal) ? tal : "—";
  const imgTag = imgSrc
    ? `<img src="${imgSrc}" alt="${escapeHtml(String(itemName))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;border-radius:2px;">`
    : "";
  const fallback = `<div class="equip-placeholder" style="display:${imgSrc ? "none" : "flex"};">${renderSlotPlaceholderIcon(slot.id)}</div>`;
  const tipAttrs = isEmpty
    ? ""
    : ` data-tip-code="${escapeHtml(String(itemName).trim())}" data-tip-kind="item"`;
  const roman = isEmpty ? "" : toRoman(lvl);
  const awkBadge = roman
    ? `<span class="equip-awk" title="Awakening ${roman}"><span class="equip-awk-text">${roman}</span></span>`
    : "";
  const talBadge =
    !isEmpty && hasTalent(tal)
      ? `<span class="equip-talent" title="Talent unlocked" aria-label="Talent unlocked"></span>`
      : "";
  return `
    <div class="equip-slot" id="${slot.id}_${marchIdx}" data-slot="${slot.id}">
      <div class="equip-box equip-box--framed rarity-${rarity}"${tipAttrs}>${imgTag}${fallback}</div>
      ${talBadge}${awkBadge}
    </div>`;
}

function renderPairBox(name) {
  const isEmpty = isEmptyVal(name);
  const imgSrc = isEmpty ? null : iconPath(name, "commander");
  const imgTag = imgSrc
    ? `<img src="${imgSrc}" alt="${escapeHtml(String(name))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;border-radius:2px;">`
    : "";
  const fallback = `<span style="display:${imgSrc ? "none" : "flex"};width:100%;height:100%;align-items:center;justify-content:center;font-size:9px;opacity:0.35;">—</span>`;
  const tipAttrs = isEmpty
    ? ""
    : ` data-tip-code="${escapeHtml(String(name).trim())}" data-tip-kind="commander"`;
  return `<div class="equip-box equip-pair-box${isEmpty ? " equip-pair-box--empty" : ""}"${tipAttrs}>${imgTag}${fallback}</div>`;
}

function renderPairsSection(row) {
  const PAIR_COUNT = 12;
  let pairCards = "";
  for (let n = 1; n <= PAIR_COUNT; n++) {
    const comm1 = row[`pair${n}_comm1`];
    const comm2 = row[`pair${n}_comm2`];
    if (isEmptyVal(comm1) && isEmptyVal(comm2)) continue;
    const boxes = [comm1, comm2].map((c) => renderPairBox(c)).join("");
    pairCards += `
      <div class="pair-card">

        <div class="pair-card-boxes">${boxes}</div>
      </div>`;
  }
  if (!pairCards) return "";
  return `

      <div class="pair-cards">${pairCards}</div>`;
}
function renderVipBadge(vipLevel) {
  if (isEmptyVal(vipLevel)) return "";
  const level = escapeHtml(String(vipLevel).trim());
  const label = level === "20" ? "SVIP" : `VIP ${level}`;
  return `<span class="vip-badge" title="VIP Level ${level}"><i class="fa-solid fa-crown"></i>${label}</span>`;
}

function renderSingleSkinItem(skinCode) {
  const info = getSkinInfo(skinCode);
  const displayName = info && info.name ? info.name : skinCode;
  const rarity = info && info.rarity ? String(info.rarity).toLowerCase() : "";
  const imgSrc = iconPath(skinCode, "skin");
  const imgTag = `<img src="${imgSrc}" alt="${escapeHtml(String(displayName))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;">`;
  const fallback = `<span class="city-skin-box-fallback" style="display:none;">—</span>`;
  const tipAttrs = ` data-tip-code="${escapeHtml(String(skinCode).trim())}" data-tip-kind="skin"`;

  return `
        <div class="city-skin-item">
          <div class="city-skin-box${rarity ? " rarity-" + rarity : ""}"${tipAttrs}>${imgTag}${fallback}</div>
          <span class="city-skin-name">${escapeHtml(String(displayName))}</span>
        </div>`;
}

function renderCitySkinSection(skinsRow) {
  const owned = skinsRow
    ? SKIN_SLOTS.map((key) => skinsRow[key]).filter((v) => !isEmptyVal(v))
    : [];
  if (!owned.length) {
    return `
      <div class="city-skin-section">
        <div class="city-skin-item">
          <div class="city-skin-box">
            <span class="city-skin-box-fallback" style="display:flex;">—</span>
          </div>
          <span class="city-skin-name city-skin-name--empty">No skins set</span>
        </div>
      </div>`;
  }
  const items = owned.map((code) => renderSingleSkinItem(code)).join("");
  return `
      <div class="city-skin-section">
        ${items}
      </div>`;
}

function getAbilityTier(name) {
  if (!name) return "gray";
  const info = getInscriptionInfo(name);
  return info ? info.rarity : "gray";
}

function renderArmamentRow(armRow) {
  if (!armRow)
    return `
    <div class="equip-arm-section">
      <div class="equip-arm-label">Armaments</div>
      <div class="gov-modal-empty" style="padding:1rem 0;">No armament data found.</div>
    </div>`;

  const arms = ARM_SLOTS.map((arm) => {
    const name = armRow[arm.prefix];
    if (isEmptyVal(name)) return "";

    const insKeys = [
      "_ins",
      "_ins2",
      "_ins3",
      "_ins4",
      "_ins5",
      "_ins6",
      "_ins7",
      "_ins8",
    ];
    const inscriptions = insKeys
      .map((k) => armRow[`${arm.prefix}${k}`])
      .filter((v) => !isEmptyVal(v))
      .map((v) => {
        const tier = getAbilityTier(String(v));
        const label = String(v).trim();
        const displayLabel =
          label.length > 9 ? `${label.slice(0, 9)}...` : label;
        return `<span class="arm-ins tier-${tier}" data-tip-code="${escapeHtml(label)}" data-tip-kind="inscription">${escapeHtml(displayLabel)}</span>`;
      })
      .join("");

    const statSlots = [
      { n: `${arm.prefix}_stat_name`, v: `${arm.prefix}_stat` },
      { n: `${arm.prefix}_stat2_name2`, v: `${arm.prefix}_stat2` },
      { n: `${arm.prefix}_stat3_name3`, v: `${arm.prefix}_stat3` },
      { n: `${arm.prefix}_stat4_name4`, v: `${arm.prefix}_stat4` },
    ];
    const statsHtml = statSlots
      .filter((s) => !isEmptyVal(armRow[s.n]) && !isEmptyVal(armRow[s.v]))
      .map(
        (s) =>
          `<span class="arm-stat"><i class="fa-solid fa-khanda arm-stat-icon"></i>${escapeHtml(String(armRow[s.n]))} <b>${escapeHtml(String(armRow[s.v]))}%</b></span>`,
      )
      .join("");

    const armIconSrc = iconPath(name, "armament");
    return `
      <div class="arm-card">
        <div class="arm-name" data-tip-code="${escapeHtml(String(name).trim())}" data-tip-kind="armament">
          <img class="arm-icon" src="${armIconSrc}" alt="" loading="lazy" onerror="this.style.display='none'">
          <span class="arm-name-text">${escapeHtml(String(name))}</span>
        </div>
		${inscriptions ? `<div class="arm-ins-group">${inscriptions}</div>` : ""}
		${statsHtml ? `<div class="arm-stats">${statsHtml}</div>` : ""}
      </div>`;
  })
    .filter(Boolean)
    .join("");

  return `
      <div class="arm-cards">${arms || '<div class="gov-modal-empty" style="padding:1rem 0;">No armaments set.</div>'}</div>`;
}

function renderEmptyEquipmentMarch(marchNum = 1) {
  const slotBoxes = EQUIP_SLOTS.map((slot) =>
    renderEquipBox(slot, "", "", "", marchNum),
  ).join("");
  return `
    <div class="equip-march-row equip-march-row--empty">
      <span class="equip-march-title">March ${marchNum}</span>
      <div class="equip-slots">${slotBoxes}</div>
    </div>`;
}

function renderEquipmentSection(govId) {
  const row = govId ? loadGovernorEquipment(govId) : null;
  const armRow = govId ? loadGovernorArmaments(govId) : null;
  const skinsRow = govId ? loadGovernorSkins(govId) : null;
  const citySkinHtml = renderCitySkinSection(skinsRow);

  if (!row) {
    return `<div class="equip-grid"><div class="equip-marches">${renderEmptyEquipmentMarch(1)}</div>${renderArmamentRow(armRow)}${citySkinHtml}</div>`;
  }

  const MARCH_SUFFIXES = [
    "",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
  ];
  let marchRows = "";

  MARCH_SUFFIXES.forEach((suffix, idx) => {
    const marchNum = idx + 1;
    if (isMarchEmpty(row, suffix)) return;

    const slotBoxes = EQUIP_SLOTS.map((slot) => {
      const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
      const lvlKey = suffix ? `${slot.key}_lvl_${suffix}` : `${slot.key}_lvl`;
      const talKey = suffix ? `${slot.key}_tal_${suffix}` : `${slot.key}_tal`;
      return renderEquipBox(
        slot,
        row[colKey],
        row[lvlKey],
        row[talKey],
        marchNum,
      );
    }).join("");

    marchRows += `
      <div class="equip-march-row">
        <span class="equip-march-title">Equipment ${marchNum}</span>
        <div class="equip-slots">${slotBoxes}</div>
      </div>`;
  });

  if (!marchRows) marchRows = renderEmptyEquipmentMarch(1);

  return `<div class="equip-grid"><div class="equip-marches">${marchRows}</div>${renderArmamentRow(armRow)}${renderPairsSection(row)}${citySkinHtml}</div>`;
}

function renderFarmOwnerInfo(owner) {
  if (!owner) return "";
  return renderCollapsibleSection(
    "Main Account Owner",
    renderAccountBoxes([owner]),
    true,
  );
}

function renderFarmsBoxes(rows) {
  if (!rows.length)
    return `<div class="gov-modal-empty">No farm accounts found.</div>`;
  return renderCollapsibleSection(
    "Farm Accounts",
    renderAccountBoxes(rows),
    false,
  );
}

function renderFarmKvKBoxes(rows) {
  if (!rows.length)
    return `<div class="gov-modal-empty">No KvK data found for farm accounts.</div>`;

  const grouped = {};
  rows.forEach((r) => {
    (grouped[r.kvk] ||= []).push(r);
  });

  const pct = { signed: false, format: formatPercent, full: formatPercent };
  const plain = { signed: false };

  const kvkBlocks = Object.keys(grouped)
    .reverse()
    .map((kvkName) => {
      const boxes = grouped[kvkName]
        .map(
          (r) => `
          <div class="kvk-gain-box">
            <div class="kvk-gain-title">
              <span class="kvk-gain-name">${escapeHtml(r.name)}</span>
              <span class="kvk-gain-id">${escapeHtml(r.id)}</span>
            </div>
            <div class="kvk-gain-stats">
              ${renderKvkGainStat("Kill Points", r.kpDiff, 0, false)}
              ${renderKvkGainStat("T4 Kills", r.t4Diff, 0, false)}
              ${renderKvkGainStat("T5 Kills", r.t5Diff, 0, false)}
              ${renderKvkGainStat("Deads", r.deadsDiff, 0, false)}
              ${renderKvkGainStat("Power", r.powerDiff, 0, false)}
              ${renderKvkGainStat("Acclaim", r.acclaim, 0, false, { hideZero: true })}
              ${renderKvkGainStat("Min DKP", r.minDkp, 0, false, plain)}
              ${renderKvkGainStat("DKP", r.dkp, 0, false, plain)}
              ${renderKvkGainStat("DKP %", r.dkpPercent, 0, false, pct)}
            </div>
          </div>`,
        )
        .join("");

      return renderCollapsibleSection(
        kvkName,
        `<div class="kvk-gains-grid">${boxes}</div>`,
        false,
      );
    })
    .join("");

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
  const vipEl = document.getElementById("govModalVip");
  const safeGovId = normalizeNumericId(govId);

  if (vipEl) vipEl.innerHTML = "";

  if (!safeGovId) {
    subtitle.textContent = "";
    body.innerHTML = `<div class="gov-modal-empty">Invalid governor ID.</div>`;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    return;
  }

  govId = safeGovId;

  subtitle.textContent = govName ? `${govName} (${govId})` : `ID: ${govId}`;
  body.innerHTML = `<div class="gov-modal-loading"><div class="spinner"></div><span>Loading…</span></div>`;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    const safeRender = (label, fn) => {
      try {
        return fn();
      } catch (e) {
        console.error("[modal:" + label + "]", e);
        return "";
      }
    };
    try {
      const history = loadGovHistory(govId);
      const farmOwner = loadFarmOwner(govId);
      const farms = loadGovernorFarms(govId);
      const farmIds = farms.map((f) => f.id);
      const farmKvK = loadFarmKvKStats(farmIds);
      const profile = loadPlayerProfile(govId);
      if (vipEl)
        vipEl.innerHTML = renderVipBadge(profile ? profile.vip_level : "");
      const chartSection = `
	    <div class="modal-chart-section">
	      <div class="modal-chart" style="height:400px;">
	        <canvas id="modal-chart"></canvas>
	      </div>
	    </div>
	  `;
      body.innerHTML =
        '<div class="gov-modal-tabs">' +
        '  <button type="button" class="gov-modal-tab active" data-tab="chart" onclick="switchGovModalTab(\'chart\')">Chart</button>' +
        '  <button type="button" class="gov-modal-tab" data-tab="stats" onclick="switchGovModalTab(\'stats\')">Statistics</button>' +
        '  <button type="button" class="gov-modal-tab" data-tab="equipment" onclick="switchGovModalTab(\'equipment\')">Equipment</button>' +
        "</div>" +
        '<div class="gov-modal-tab-pane" id="govTabPane-chart">' +
        chartSection +
        "</div>" +
        '<div class="gov-modal-tab-pane" id="govTabPane-stats" style="display:none;">' +
        '<div class="modal-controls">' +
        '  <button onclick="expandAllSections()">Expand All</button>' +
        '  <button onclick="collapseAllSections()">Collapse All</button>' +
        "</div>" +
        safeRender("farmOwner", () => renderFarmOwnerInfo(farmOwner)) +
        safeRender("history", () =>
          renderCollapsibleSection(
            "Governor History",
            renderKvkGainBoxes(history),
            false,
          ),
        ) +
        safeRender("farms", () => renderFarmsBoxes(farms)) +
        safeRender("farmKvK", () => renderFarmKvKBoxes(farmKvK)) +
        "</div>" +
        '<div class="gov-modal-tab-pane" id="govTabPane-equipment" style="display:none;">' +
        safeRender("equipment", () => renderEquipmentSection(govId)) +
        "</div>";
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

  return mainsRes[0].values
    .map((m) => {
      const mainId = normalizeNumericId(m[0]);
      if (!mainId) return null;

      const farmsRes = db.exec(`
      SELECT player_id, name, power, killpoints, deads, ch
      FROM farm_accounts
      WHERE main_id=${mainId} AND acc_type='farm'
      ORDER BY power DESC
    `);
      const farms = farmsRes.length
        ? farmsRes[0].values.map((f) => ({
            id: f[0],
            name: f[1],
            power: f[2],
            killpoints: f[3],
            deads: f[4],
            ch: f[5],
          }))
        : [];
      return {
        main: {
          id: mainId,
          name: m[1],
          power: m[2],
          killpoints: m[3],
          deads: m[4],
          ch: m[5],
        },
        farms,
      };
    })
    .filter(Boolean);
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
