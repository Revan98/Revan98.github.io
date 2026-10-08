/* ==========================================================================
   dashboard.js — DKP table (DataTables), card view, podium and totals.
   Depends on: common.js, db.js, queries.js, govModal.js, DataTables.
   ========================================================================== */
let table;

function formatCsvPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n).replace(".", ",") : "";
}

function getExportFileName() {
  const kd = getKDFromURL() || "dkp";
  const kvkPart = kvkCtx.kvkNumber ? `_kvk${kvkCtx.kvkNumber}` : "";
  const lastSnapshot =
    kvkCtx.snapshotDates[kvkCtx.snapshotDates.length - 1] || "export";
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
  hasSums = kvkHasSums(kvkCtx.kvkNumber);

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

let cardsEl = null;
let cardMode = false;

const CARD_BTN_TEXT =
  '<i class="fa-solid fa-table-cells-large" style="font-size: 14px"></i> Card view';
const TABLE_BTN_TEXT =
  '<i class="fa-solid fa-table" style="font-size: 14px"></i> Table view';

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

function renderTopPlayers(players, dkpKey) {
  document.querySelectorAll("#top-players .player-box").forEach((box) => {
    const p = players[Number(box.dataset.rank) - 1];
    box.querySelector(".player-name").textContent = p?.name ?? "";
    box.querySelector(".player-id").textContent = p ? `ID: ${p.id ?? ""}` : "";
    const dkpEl = box.querySelector(".player-dkp");
    if (dkpEl) {
      const dkp = p ? Number(p[dkpKey]) : NaN;
      dkpEl.textContent = Number.isNaN(dkp) ? "" : `${dkp.toLocaleString()} DKP`;
    }
    box.style.visibility = p ? "" : "hidden";
  });
}

function renderTotals(rows = []) {
  const fields = { t4: "t4Diff", t5: "t5Diff", deads: "deadsDiff", kp: "killPointsDiff" };
  for (const [stat, field] of Object.entries(fields)) {
    const total = rows.reduce((sum, r) => sum + num(r[field]), 0);
    const el = document.querySelector(`.stat-box[data-stat="${stat}"] .stat-value`);
    if (el) el.textContent = total.toLocaleString();
  }
}


async function initDashboard() {
  const spinner = document.getElementById("loading-spinner");
  loadEquipRefData();
  try {
    await openDb();
    loadKvkContext();
    const rows = loadDashboardRows();

    initTable(rows);

    const dkpKey = hasSums ? "sumDkp" : "dkp";
    const top3 = [...rows].sort((a, b) => num(b[dkpKey]) - num(a[dkpKey])).slice(0, 3);
    renderTopPlayers(top3, dkpKey);
    renderTotals(rows);

    requestAnimationFrame(() =>
      document.getElementById("gridWrapper").classList.add("visible"),
    );
  } catch (e) {
    console.error(e);
    showToast(e.message || "Failed to load data", "error");
  } finally {
    spinner.style.display = "none";
  }
}

initDashboard();
