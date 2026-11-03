function formatCsvPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n).replace(".", ",") : "";
}

function getExportFileName() {
  const kd = '2247' || "dkp";
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

function renderGovernor(row, asCard = false) {
  const name = escapeHtml(row.name);
  const tip = (text) => (asCard ? ` title="${text}"` : "");
  if (!row.id) {
    return `<div class="gov-name-stack"><div class="gov-name-value">${name}</div></div>`;
  }
  return (
    `<div class="gov-name-stack">` +
    `<div class="gov-name-value gov-name-link"${tip("View governor history")}>${name}</div>` +
    `<a class="gov-id"${tip("Copy governor ID")}><span class="gov-id-text">${escapeHtml(row.id)}</span>` +
    `<i class="fa-regular fa-copy gov-id-copy-icon"></i></a>` +
    `</div>`
  );
}

const TIP_FARMS = "with farms\nwithout farms";
let hasSums = true;
let gridApi = null;
let allRows = [];

function sumMetricColumn({ headerName, field, sumField, format, colId, sort }) {
  return {
    colId: colId ?? field,
    headerName,
    cellClass: "metric-stack-cell",
    sort,
    valueGetter: (p) => num(hasSums ? p.data[sumField] : p.data[field]),
    tooltipValueGetter: () => (hasSums ? TIP_FARMS : null),
    cellRenderer: (p) => {
      const row = p.data;
      return hasSums
        ? renderMetricStack(row[field], row[sumField], format)
        : `<div class="metric-stack"><div class="metric-base">${format(row[field])}</div></div>`;
    },
  };
}

const noQuickFilter = () => "";

const COLUMNS = [
  {
    colId: "rank",
    headerName: "#",
    width: 55,
    pinned: "left",
    sortable: false,
    cellClass: "row-num",
    valueGetter: (p) => (p.node ? p.node.rowIndex + 1 : ""),
    getQuickFilterText: noQuickFilter,
  },
  {
    colId: "name",
    headerName: "Governor",
    width: 190,
    pinned: "left",
    cellClass: "gov-cell",
    valueGetter: (p) => p.data.name ?? "",
    cellRenderer: (p) => renderGovernor(p.data),
    tooltipValueGetter: (p) =>
      p.data?.id ? "View governor history\nCopy governor ID" : null,
    getQuickFilterText: (p) => `${p.data.name ?? ""} ${p.data.id ?? ""}`,
  },
  {
    colId: "killPointsDiff",
    headerName: "Killpoints",
    valueGetter: (p) => num(p.data.killPointsDiff),
    tooltipValueGetter: (p) => `Current KP: ${formatNumber(p.data.killPoints)}`,
    cellRenderer: (p) => {
      const r = p.data;
      const cls = num(r.killPointsDiff) >= 0 ? "diff-positive" : "diff-negative";
      return `<span class="${cls}">${formatSignedNumber(r.killPointsDiff)}</span>`;
    },
  },
  {
    colId: "t4t5",
    headerName: "T4 / T5",
    cellClass: "metric-stack-cell",
    valueGetter: (p) => num(p.data.t4Diff) + num(p.data.t5Diff),
    tooltipValueGetter: (p) =>
      `Current T4: ${formatNumber(p.data.t4)}\nCurrent T5: ${formatNumber(p.data.t5)}`,
    cellRenderer: (p) => renderTroopDiffStack(p.data.t4Diff, p.data.t5Diff),
  },
  {
    colId: "deadsPower",
    headerName: "Deads / Power",
    cellClass: "metric-stack-cell",
    valueGetter: (p) => num(p.data.deadsDiff),
    tooltipValueGetter: (p) =>
      `Current Deads: ${formatNumber(p.data.deads)}\nCurrent Power: ${formatNumber(p.data.power)}`,
    cellRenderer: (p) =>
      renderDeadsPowerDiffStack(p.data.deadsDiff, p.data.powerDiff),
  },
  {
    colId: "acclaim",
    headerName: "Acclaim",
    valueGetter: (p) => num(p.data.acclaim),
    valueFormatter: (p) => (p.data?.acclaim == null ? "" : formatNumber(p.value)),
  },
  sumMetricColumn({
    headerName: "Min DKP",
    field: "minDkp",
    sumField: "sumMinDkp",
    format: formatNumber,
  }),
  sumMetricColumn({
    headerName: "DKP",
    field: "dkp",
    sumField: "sumDkp",
    format: formatNumber,
    colId: "dkp",
    sort: "desc",
  }),
  sumMetricColumn({
    headerName: "DKP %",
    field: "dkpPercent",
    sumField: "sumDkpPercent",
    format: formatPercent,
  }),
].map((c) =>
  c.pinned
    ? c
    : { flex: 1, minWidth: 130, getQuickFilterText: noQuickFilter, ...c },
);

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
].map(([title, data, isPercent]) => ({ title, data, isPercent: !!isPercent }));

const SUM_FIELDS = new Set(["sumMinDkp", "sumDkp", "sumDkpPercent"]);
const exportColumns = () =>
  EXPORT_COLUMNS.filter((c) => hasSums || !SUM_FIELDS.has(c.data));
const exportFilename = () => getExportFileName().replace(/\.csv$/, "");

function getRowsInGridOrder() {
  const rows = [...allRows];
  const sorts = gridApi
    .getColumnState()
    .filter((c) => c.sort)
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((c) => ({
      dir: c.sort === "desc" ? -1 : 1,
      get: COLUMNS.find((d) => d.colId === c.colId).valueGetter,
    }));
  if (!sorts.length) return rows;
  return rows.sort((a, b) => {
    for (const { dir, get } of sorts) {
      const va = get({ data: a });
      const vb = get({ data: b });
      const diff =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va ?? "").localeCompare(String(vb ?? ""));
      if (diff) return diff * dir;
    }
    return 0;
  });
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const cols = exportColumns();
  const quote = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    cols.map((c) => quote(c.title)).join(";"),
    ...getRowsInGridOrder().map((row) =>
      cols
        .map((c) =>
          quote(
            csvSafeCell(
              c.isPercent ? formatCsvPercent(row[c.data]) : row[c.data],
            ),
          ),
        )
        .join(";"),
    ),
  ];
  saveBlob(
    new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
    `${exportFilename()}.csv`,
  );
}

async function exportExcel() {
  try {
    await loadVendor("xlsx");
  } catch (e) {
    return showToast(e.message, "error");
  }
  const cols = exportColumns();
  const aoa = [
    cols.map((c) => c.title),
    ...getRowsInGridOrder().map((row) => cols.map((c) => row[c.data] ?? null)),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "DKP");
  XLSX.writeFile(wb, `${exportFilename()}.xlsx`, { compression: true });
}

const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 44;
const GRID_MAX_HEIGHT = 700;

function updateGridHeight() {
  if (!gridApi) return;
  const count = gridApi.getDisplayedRowCount();
  const fits = count * ROW_HEIGHT + HEADER_HEIGHT + 2 <= GRID_MAX_HEIGHT;
  const gridEl = document.getElementById("dkpGrid");
  const wantLayout = fits ? "autoHeight" : "normal";
  if (gridApi.getGridOption("domLayout") === wantLayout) return;
  gridEl.style.height = fits ? "" : `${GRID_MAX_HEIGHT}px`;
  gridApi.setGridOption("domLayout", wantLayout);
}

function makeToolbarButton(html, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shared-style-btn";
  btn.innerHTML = html;
  btn.addEventListener("click", onClick);
  return btn;
}

function buildToolbar() {
  const bar = document.getElementById("dkpToolbar");
  bar.replaceChildren();

  const buttons = document.createElement("div");
  buttons.className = "grid-toolbar-buttons";

  const cardBtn = makeToolbarButton(CARD_BTN_TEXT, () => {
    setCardMode(!cardMode);
    cardBtn.innerHTML = cardMode ? TABLE_BTN_TEXT : CARD_BTN_TEXT;
  });
  const csvBtn = makeToolbarButton(
    '<i class="fa-solid fa-download" style="font-size: 14px"></i> Export CSV',
    exportCsv,
  );
  const xlsxBtn = makeToolbarButton(
    '<i class="fa-solid fa-file-excel" style="font-size: 14px"></i> Export Excel',
    exportExcel,
  );
  const copyHtml =
    '<i class="fa-regular fa-copy" style="font-size: 14px"></i> Copy Top 18';
  const copyBtn = makeToolbarButton(copyHtml, () => copyTop18(copyBtn, copyHtml));
  buttons.append(cardBtn, csvBtn, xlsxBtn, copyBtn);

  const searchWrap = document.createElement("div");
  searchWrap.className = "grid-search";
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Search...";
  input.setAttribute("aria-label", "Search governors");
  input.addEventListener("input", () =>
    gridApi.setGridOption("quickFilterText", input.value),
  );
  searchWrap.appendChild(input);

  bar.append(buttons, searchWrap);
}

function initTable(rowData) {
  hasSums = kvkHasSums(kvkCtx.kvkNumber);
  allRows = rowData;

  const gridEl = document.getElementById("dkpGrid");
  const fits = rowData.length * ROW_HEIGHT + HEADER_HEIGHT + 2 <= GRID_MAX_HEIGHT;
  if (!fits) gridEl.style.height = `${GRID_MAX_HEIGHT}px`;

  gridApi = agGrid.createGrid(gridEl, {
    theme: createSiteTheme(),
    rowData,
    columnDefs: COLUMNS,
    defaultColDef: { resizable: true, suppressMovable: true },
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
    domLayout: fits ? "autoHeight" : "normal",
    suppressCellFocus: true,
    enableCellTextSelection: true,
    tooltipShowDelay: 300,
    localeText: { noMatchingRows: "No matching governors", noRowsToShow: "No governors" },
    onCellClicked: (e) => {
      if (e.colDef.colId === "name") onGovernorClick(e.event?.target, e.data);
    },
    onModelUpdated: () => {
      if (!gridApi) return;
      gridEl.classList.toggle("is-empty", gridApi.getDisplayedRowCount() === 0);
      gridApi.refreshCells({ columns: ["rank"], force: true });
      updateGridHeight();
      if (cardMode) renderCards();
    },
  });

  buildToolbar();

  cardsEl = document.createElement("div");
  cardsEl.id = "dkpCards";
  cardsEl.className = "dkp-cards";
  cardsGridEl = document.createElement("div");
  cardsGridEl.className = "dkp-cards-grid";
  cardsEl.appendChild(cardsGridEl);
  document.getElementById("dkpContainer").appendChild(cardsEl);
  cardsEl.addEventListener("scroll", scheduleCardLayout, { passive: true });
  new ResizeObserver(scheduleCardLayout).observe(cardsGridEl);
  document.getElementById("gridWrapper").addEventListener("click", onCardClick);
}

function onCardClick(e) {
  const card = e.target.closest(".dkp-card");
  if (card) onGovernorClick(e.target, cardRows[Number(card.dataset.row)]);
}

function onGovernorClick(target, row) {
  const nameEl = target?.closest(".gov-name-link");
  const idEl = target?.closest(".gov-id");
  if ((!nameEl && !idEl) || !row) return;

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

async function copyTop18(btn, originalHtml) {
  const dkpKey = hasSums ? "sumDkp" : "dkp";
  if (!allRows.length) {
    showToast("No data loaded yet.", "info");
    return;
  }

  const text = [...allRows]
    .sort((a, b) => num(b[dkpKey]) - num(a[dkpKey]))
    .slice(0, 18)
    .map((row, i) => `${i + 1}. ${row.id} ${row.name}`)
    .join("\n");

  if (!(await copyText(text))) {
    showToast("Could not copy to clipboard", "error");
    return;
  }

  btn.textContent = "✓ Copied!";
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }, 2000);
}

let cardsEl = null;
let cardsGridEl = null;
let cardMode = false;
let cardRows = [];

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
        ${renderGovernor(r, true)}
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

const CARD_BUFFER_ROWS = 2;
let cardWindow = { start: -1, end: -1, cols: 0, stride: 0 };

function layoutCards() {
  const total = cardRows.length;
  const cs = getComputedStyle(cardsGridEl);
  const cols = Math.max(1, cs.gridTemplateColumns.split(" ").length);
  const gap = parseFloat(cs.rowGap) || 0;
  const first = cardsGridEl.firstElementChild;
  const stride = (first ? first.offsetHeight : 330) + gap;
  const rows = Math.ceil(total / cols);
  const viewTop = Math.min(cardsEl.scrollTop, Math.max(0, rows * stride - cardsEl.clientHeight));
  const firstRow = Math.max(0, Math.floor(viewTop / stride) - CARD_BUFFER_ROWS);
  const lastRow = Math.min(
    rows - 1,
    Math.ceil((viewTop + cardsEl.clientHeight) / stride) + CARD_BUFFER_ROWS,
  );
  const start = firstRow * cols;
  const end = Math.min(total, (lastRow + 1) * cols);

  const same =
    start === cardWindow.start &&
    end === cardWindow.end &&
    cols === cardWindow.cols &&
    stride === cardWindow.stride;
  if (same) return;
  cardWindow = { start, end, cols, stride };

  cardsGridEl.style.paddingTop = `${firstRow * stride}px`;
  cardsGridEl.style.paddingBottom = `${Math.max(0, rows - lastRow - 1) * stride}px`;
  let html = "";
  for (let i = start; i < end; i++) html += renderCard(cardRows[i], i, i + 1);
  cardsGridEl.innerHTML = html;

  if (!first && cardsGridEl.firstElementChild) layoutCards();
}

let cardLayoutFrame = 0;
function scheduleCardLayout() {
  if (!cardMode || cardLayoutFrame) return;
  cardLayoutFrame = requestAnimationFrame(() => {
    cardLayoutFrame = 0;
    layoutCards();
  });
}

function renderCards() {
  cardRows = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => cardRows.push(node.data));
  cardWindow = { start: -1, end: -1, cols: 0, stride: 0 };
  cardsEl.scrollTop = 0;
  layoutCards();
}

function setCardMode(on) {
  cardMode = on;
  document.getElementById("dkpContainer").classList.toggle("dkp-cards-on", on);
  if (on) renderCards();
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
  try {
    await loadKvkContext();
    const rows = await loadDashboardRows();

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
