function formatCsvPercent(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? String(numericValue).replace(".", ",") : "";
}

function getExportFileName() {
  const kingdomId = '2247' || "dkp";
  const kvkPart = kvkContext.kvkNumber ? `_kvk${kvkContext.kvkNumber}` : "";
  const lastSnapshot =
    kvkContext.snapshotDates[kvkContext.snapshotDates.length - 1] || "export";
  return `DKP_${kingdomId}${kvkPart}_${String(lastSnapshot).replaceAll("-", "_")}.csv`;
}

function renderMetricStack(baseValue, sumValue, formatter) {
  const base = formatter(baseValue);
  const formattedSum = formatter(sumValue);
  return `
    <div class="metric-stack">
      <div class="metric-base">${formattedSum}</div>
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
  const titleAttribute = (text) => (asCard ? ` title="${text}"` : "");
  if (!row.id) {
    return `<div class="gov-name-stack"><div class="gov-name-value">${name}</div></div>`;
  }
  return (
    `<div class="gov-name-stack">` +
    `<div class="gov-name-value gov-name-link"${titleAttribute("View governor history")}>${name}</div>` +
    `<a class="gov-id"${titleAttribute("Copy governor ID")}><span class="gov-id-text">${escapeHtml(row.id)}</span>` +
    `<i class="fa-regular fa-copy gov-id-copy-icon"></i></a>` +
    `</div>`
  );
}

const TOOLTIP_FARMS = "with farms\nwithout farms";
let hasSums = true;
let gridApi = null;
let allRows = [];

function sumMetricColumn({ headerName, field, sumField, format, colId: columnId, sort }) {
  return {
    colId: columnId ?? field,
    headerName,
    cellClass: "metric-stack-cell",
    sort,
    valueGetter: (params) => toNumberOrZero(hasSums ? params.data[sumField] : params.data[field]),
    tooltipValueGetter: () => (hasSums ? TOOLTIP_FARMS : null),
    cellRenderer: (params) => {
      const row = params.data;
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
    valueGetter: (params) => (params.node ? params.node.rowIndex + 1 : ""),
    getQuickFilterText: noQuickFilter,
  },
  {
    colId: "name",
    headerName: "Governor",
    width: 190,
    pinned: "left",
    cellClass: "gov-cell",
    valueGetter: (params) => params.data.name ?? "",
    cellRenderer: (params) => renderGovernor(params.data),
    tooltipValueGetter: (params) =>
      params.data?.id ? "View governor history\nCopy governor ID" : null,
    getQuickFilterText: (params) => `${params.data.name ?? ""} ${params.data.id ?? ""}`,
  },
  {
    colId: "killPointsDiff",
    headerName: "Killpoints",
    valueGetter: (params) => toNumberOrZero(params.data.killPointsDiff),
    tooltipValueGetter: (params) => `Current KP: ${formatNumber(params.data.killPoints)}`,
    cellRenderer: (params) => {
      const row = params.data;
      const cssClass = toNumberOrZero(row.killPointsDiff) >= 0 ? "diff-positive" : "diff-negative";
      return `<span class="${cssClass}">${formatSignedNumber(row.killPointsDiff)}</span>`;
    },
  },
  {
    colId: "t4t5",
    headerName: "T4 / T5",
    cellClass: "metric-stack-cell",
    valueGetter: (params) => toNumberOrZero(params.data.t4Diff) + toNumberOrZero(params.data.t5Diff),
    tooltipValueGetter: (params) =>
      `Current T4: ${formatNumber(params.data.t4)}\nCurrent T5: ${formatNumber(params.data.t5)}`,
    cellRenderer: (params) => renderTroopDiffStack(params.data.t4Diff, params.data.t5Diff),
  },
  {
    colId: "deadsPower",
    headerName: "Deads / Power",
    cellClass: "metric-stack-cell",
    valueGetter: (params) => toNumberOrZero(params.data.deadsDiff),
    tooltipValueGetter: (params) =>
      `Current Deads: ${formatNumber(params.data.deads)}\nCurrent Power: ${formatNumber(params.data.power)}`,
    cellRenderer: (params) =>
      renderDeadsPowerDiffStack(params.data.deadsDiff, params.data.powerDiff),
  },
  {
    colId: "acclaim",
    headerName: "Acclaim",
    valueGetter: (params) => toNumberOrZero(params.data.acclaim),
    valueFormatter: (params) => (params.data?.acclaim == null ? "" : formatNumber(params.value)),
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
].map((columnDefinition) =>
  columnDefinition.pinned
    ? columnDefinition
    : { flex: 1, minWidth: 130, getQuickFilterText: noQuickFilter, ...columnDefinition },
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
  EXPORT_COLUMNS.filter((exportColumn) => hasSums || !SUM_FIELDS.has(exportColumn.data));
const exportFilename = () => getExportFileName().replace(/\.csv$/, "");

function getRowsInGridOrder() {
  const rows = [...allRows];
  const sorts = gridApi
    .getColumnState()
    .filter((column) => column.sort)
    .sort((firstColumn, secondColumn) => firstColumn.sortIndex - secondColumn.sortIndex)
    .map((column) => ({
      dir: column.sort === "desc" ? -1 : 1,
      get: COLUMNS.find((sourceColumn) => sourceColumn.colId === column.colId).valueGetter,
    }));
  if (!sorts.length) return rows;
  return rows.sort((firstRow, secondRow) => {
    for (const { dir: direction, get: getSortValue } of sorts) {
      const firstValue = getSortValue({ data: firstRow });
      const secondValue = getSortValue({ data: secondRow });
      const diff =
        typeof firstValue === "number" && typeof secondValue === "number"
          ? firstValue - secondValue
          : String(firstValue ?? "").localeCompare(String(secondValue ?? ""));
      if (diff) return diff * direction;
    }
    return 0;
  });
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const columns = exportColumns();
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [
    columns.map((column) => quote(column.title)).join(";"),
    ...getRowsInGridOrder().map((row) =>
      columns
        .map((column) =>
          quote(
            csvSafeCell(
              column.isPercent ? formatCsvPercent(row[column.data]) : row[column.data],
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
  } catch (event) {
    return showToast(event.message, "error");
  }
  const columns = exportColumns();
  const rowsAsArrays = [
    columns.map((column) => column.title),
    ...getRowsInGridOrder().map((row) => columns.map((column) => row[column.data] ?? null)),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rowsAsArrays), "DKP");
  XLSX.writeFile(workbook, `${exportFilename()}.xlsx`, { compression: true });
}

const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 44;
const GRID_MAX_HEIGHT = 700;

function updateGridHeight() {
  if (!gridApi) return;
  const count = gridApi.getDisplayedRowCount();
  const fits = count * ROW_HEIGHT + HEADER_HEIGHT + 2 <= GRID_MAX_HEIGHT;
  const gridElement = document.getElementById("dkpGrid");
  const wantLayout = fits ? "autoHeight" : "normal";
  if (gridApi.getGridOption("domLayout") === wantLayout) return;
  gridElement.style.height = fits ? "" : `${GRID_MAX_HEIGHT}px`;
  gridApi.setGridOption("domLayout", wantLayout);
}

function makeToolbarButton(html, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shared-style-btn";
  button.innerHTML = html;
  button.addEventListener("click", onClick);
  return button;
}

function buildToolbar() {
  const toolbar = document.getElementById("dkpToolbar");
  toolbar.replaceChildren();

  const buttons = document.createElement("div");
  buttons.className = "grid-toolbar-buttons";

  const cardButton = makeToolbarButton(CARD_BUTTON_TEXT, () => {
    setCardMode(!cardMode);
    cardButton.innerHTML = cardMode ? TABLE_BUTTON_TEXT : CARD_BUTTON_TEXT;
  });
  const csvButton = makeToolbarButton(
    '<i class="fa-solid fa-download" style="font-size: 14px"></i> Export CSV',
    exportCsv,
  );
  const xlsxButton = makeToolbarButton(
    '<i class="fa-solid fa-file-excel" style="font-size: 14px"></i> Export Excel',
    exportExcel,
  );
  const copyHtml =
    '<i class="fa-regular fa-copy" style="font-size: 14px"></i> Copy Top 18';
  const copyButton = makeToolbarButton(copyHtml, () => copyTop18(copyButton, copyHtml));
  buttons.append(cardButton, csvButton, xlsxButton, copyButton, buildCardSortControls());

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

  toolbar.append(buttons, searchWrap);
}

function initTable(rowData) {
  hasSums = kvkHasSums(kvkContext.kvkNumber);
  allRows = rowData;

  const gridElement = document.getElementById("dkpGrid");
  const fits = rowData.length * ROW_HEIGHT + HEADER_HEIGHT + 2 <= GRID_MAX_HEIGHT;
  if (!fits) gridElement.style.height = `${GRID_MAX_HEIGHT}px`;

  gridApi = agGrid.createGrid(gridElement, {
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
    onCellClicked: (event) => {
      if (event.colDef.colId === "name") onGovernorClick(event.event?.target, event.data);
    },
    onModelUpdated: () => {
      if (!gridApi) return;
      gridElement.classList.toggle("is-empty", gridApi.getDisplayedRowCount() === 0);
      gridApi.refreshCells({ columns: ["rank"], force: true });
      updateGridHeight();
      if (cardMode) renderCards();
    },
  });

  buildToolbar();

  cardsElement = document.createElement("div");
  cardsElement.id = "dkpCards";
  cardsElement.className = "dkp-cards";
  cardsGridElement = document.createElement("div");
  cardsGridElement.className = "dkp-cards-grid";
  cardsElement.appendChild(cardsGridElement);
  document.getElementById("dkpContainer").appendChild(cardsElement);
  cardsElement.addEventListener("scroll", scheduleCardLayout, { passive: true });
  new ResizeObserver(scheduleCardLayout).observe(cardsGridElement);
  document.getElementById("gridWrapper").addEventListener("click", onCardClick);
}

function onCardClick(event) {
  const card = event.target.closest(".dkp-card");
  if (card) onGovernorClick(event.target, cardRows[Number(card.dataset.row)]);
}

function onGovernorClick(target, row) {
  const nameElement = target?.closest(".gov-name-link");
  const idElement = target?.closest(".gov-id");
  if ((!nameElement && !idElement) || !row) return;

  if (nameElement) {
    openGovernorModal(String(row.id), row.name || "");
    return;
  }

  if (idElement.classList.contains("gov-id-copied")) return;
  copyText(String(row.id)).then((copied) => {
    if (!copied) return showToast("Could not copy governor ID", "error");
    const idText = idElement.querySelector(".gov-id-text");
    const original = idText.textContent;
    idText.textContent = "Copied!";
    idElement.classList.add("gov-id-copied");
    setTimeout(() => {
      idText.textContent = original;
      idElement.classList.remove("gov-id-copied");
    }, 1200);
  });
}

async function copyTop18(button, originalHtml) {
  const dkpKey = hasSums ? "sumDkp" : "dkp";
  if (!allRows.length) {
    showToast("No data loaded yet.", "info");
    return;
  }

  const text = [...allRows]
    .sort((firstAllRow, secondAllRow) => toNumberOrZero(secondAllRow[dkpKey]) - toNumberOrZero(firstAllRow[dkpKey]))
    .slice(0, 18)
    .map((row, index) => `${index + 1}. ${row.id} ${row.name}`)
    .join("\n");

  if (!(await copyText(text))) {
    showToast("Could not copy to clipboard", "error");
    return;
  }

  button.textContent = "✓ Copied!";
  button.disabled = true;
  setTimeout(() => {
    button.innerHTML = originalHtml;
    button.disabled = false;
  }, 2000);
}

let cardsElement = null;
let cardsGridElement = null;
let cardMode = false;
let cardRows = [];

const CARD_BUTTON_TEXT =
  '<i class="fa-solid fa-table-cells-large" style="font-size: 14px"></i> Card view';
const TABLE_BUTTON_TEXT =
  '<i class="fa-solid fa-table" style="font-size: 14px"></i> Table view';

function renderCard(row, rowIndex, rank) {
  const metric = (base, sum, formatValue) =>
    hasSums
      ? renderMetricStack(base, sum, formatValue)
      : `<div class="metric-stack"><div class="metric-base">${formatValue(base)}</div></div>`;
  const field = (label, html) =>
    `<div class="dkp-card-field"><span class="dkp-card-label">${label}</span><div class="dkp-card-value">${html}</div></div>`;
  const kpCssClass = toNumberOrZero(row.killPointsDiff) >= 0 ? "diff-positive" : "diff-negative";

  return `
    <div class="dkp-card" data-row="${rowIndex}">
      <div class="dkp-card-head">
        <span class="dkp-card-rank">${rank}</span>
        ${renderGovernor(row, true)}
      </div>
      ${field("Killpoints", `<span class="${kpCssClass}">${formatSignedNumber(row.killPointsDiff)}</span>`)}
      ${field("T4 / T5", renderTroopDiffStack(row.t4Diff, row.t5Diff))}
      ${field("Deads / Power", renderDeadsPowerDiffStack(row.deadsDiff, row.powerDiff))}
      ${field("Acclaim", formatNumber(row.acclaim))}
      ${field("Min DKP", metric(row.minDkp, row.sumMinDkp, formatNumber))}
      ${field("DKP", metric(row.dkp, row.sumDkp, formatNumber))}
      ${field("DKP %", metric(row.dkpPercent, row.sumDkpPercent, formatPercent))}
    </div>`;
}

const CARD_BUFFER_ROWS = 2;
let cardWindow = { start: -1, end: -1, cols: 0, stride: 0 };

function layoutCards() {
  const total = cardRows.length;
  const computedStyle = getComputedStyle(cardsGridElement);
  const columns = Math.max(1, computedStyle.gridTemplateColumns.split(" ").length);
  const rowGap = parseFloat(computedStyle.rowGap) || 0;
  const first = cardsGridElement.firstElementChild;
  const stride = (first ? first.offsetHeight : 330) + rowGap;
  const rows = Math.ceil(total / columns);
  const viewTop = Math.min(cardsElement.scrollTop, Math.max(0, rows * stride - cardsElement.clientHeight));
  const firstRow = Math.max(0, Math.floor(viewTop / stride) - CARD_BUFFER_ROWS);
  const lastRow = Math.min(
    rows - 1,
    Math.ceil((viewTop + cardsElement.clientHeight) / stride) + CARD_BUFFER_ROWS,
  );
  const start = firstRow * columns;
  const endIndex = Math.min(total, (lastRow + 1) * columns);

  const same =
    start === cardWindow.start &&
    endIndex === cardWindow.end &&
    columns === cardWindow.cols &&
    stride === cardWindow.stride;
  if (same) return;
  cardWindow = { start, end: endIndex, cols: columns, stride };

  cardsGridElement.style.paddingTop = `${firstRow * stride}px`;
  cardsGridElement.style.paddingBottom = `${Math.max(0, rows - lastRow - 1) * stride}px`;
  let html = "";
  for (let index = start; index < endIndex; index++) html += renderCard(cardRows[index], index, index + 1);
  cardsGridElement.innerHTML = html;
  if (!first && cardsGridElement.firstElementChild) layoutCards();
}

let cardLayoutFrame = 0;
function scheduleCardLayout() {
  if (!cardMode || cardLayoutFrame) return;
  cardLayoutFrame = requestAnimationFrame(() => {
    cardLayoutFrame = 0;
    layoutCards();
  });
}

const CARD_SORT_COLUMNS = ["name", "killPointsDiff", "t4t5", "deadsPower", "acclaim", "minDkp", "dkp", "dkpPercent"];
const cardSortColumn = (columnId) => COLUMNS.find((column) => column.colId === columnId);
let cardSort = { colId: "dkp", dir: "desc" };
let cardSortElement = null;
let cardSortDirectionButton = null;

function sortCardRows(rows) {
  const getSortValue = cardSortColumn(cardSort.colId).valueGetter;
  const direction = cardSort.dir === "desc" ? -1 : 1;
  const keyed = rows.map((data, index) => ({ data, i: index, key: getSortValue({ data }) }));
  keyed.sort((firstEntry, secondEntry) => {
    const diff =
      typeof firstEntry.key === "number" && typeof secondEntry.key === "number"
        ? firstEntry.key - secondEntry.key
        : String(firstEntry.key ?? "").localeCompare(String(secondEntry.key ?? ""));
    return diff ? diff * direction : firstEntry.i - secondEntry.i;
  });
  return keyed.map((entry) => entry.data);
}

function updateCardSortDirectionButton() {
  const desc = cardSort.dir === "desc";
  cardSortDirectionButton.innerHTML = `<i class="fa-solid fa-arrow-${desc ? "down" : "up"}-wide-short" style="font-size: 14px"></i>`;
  const label = desc ? "Sorted descending, click for ascending" : "Sorted ascending, click for descending";
  cardSortDirectionButton.title = label;
  cardSortDirectionButton.setAttribute("aria-label", label);
}

function buildCardSortControls() {
  cardSortElement = document.createElement("div");
  cardSortElement.className = "card-sort";
  cardSortElement.hidden = !cardMode;

  const select = document.createElement("select");
  select.setAttribute("aria-label", "Sort cards by");
  for (const columnId of CARD_SORT_COLUMNS) {
    const option = document.createElement("option");
    option.value = columnId;
    option.textContent = cardSortColumn(columnId).headerName;
    select.appendChild(option);
  }
  select.value = cardSort.colId;
  select.addEventListener("change", () => {
    cardSort = { colId: select.value, dir: select.value === "name" ? "asc" : "desc" };
    updateCardSortDirectionButton();
    renderCards();
  });

  cardSortDirectionButton = makeToolbarButton("", () => {
    cardSort.dir = cardSort.dir === "desc" ? "asc" : "desc";
    updateCardSortDirectionButton();
    renderCards();
  });
  updateCardSortDirectionButton();

  cardSortElement.append(select, cardSortDirectionButton);
  return cardSortElement;
}

function renderCards() {
  const rows = [];
  gridApi.forEachNodeAfterFilter((node) => rows.push(node.data));
  cardRows = sortCardRows(rows);
  cardWindow = { start: -1, end: -1, cols: 0, stride: 0 };
  cardsElement.scrollTop = 0;
  layoutCards();
}

function setCardMode(enabled) {
  cardMode = enabled;
  document.getElementById("dkpContainer").classList.toggle("dkp-cards-on", enabled);
  cardSortElement.hidden = !enabled;
  if (enabled) renderCards();
}

function renderTopPlayers(players, dkpKey) {
  document.querySelectorAll("#top-players .player-box").forEach((playerBox) => {
    const player = players[Number(playerBox.dataset.rank) - 1];
    playerBox.querySelector(".player-name").textContent = player?.name ?? "";
    playerBox.querySelector(".player-id").textContent = player ? `ID: ${player.id ?? ""}` : "";
    const dkpElement = playerBox.querySelector(".player-dkp");
    if (dkpElement) {
      const dkp = player ? Number(player[dkpKey]) : NaN;
      dkpElement.textContent = Number.isNaN(dkp) ? "" : `${dkp.toLocaleString()} DKP`;
    }
    playerBox.style.visibility = player ? "" : "hidden";
  });
}

function renderTotals(rows = []) {
  const fields = { t4: "t4Diff", t5: "t5Diff", deads: "deadsDiff", kp: "killPointsDiff" };
  for (const [stat, field] of Object.entries(fields)) {
    const total = rows.reduce((sum, row) => sum + toNumberOrZero(row[field]), 0);
    const element = document.querySelector(`.stat-box[data-stat="${stat}"] .stat-value`);
    if (element) element.textContent = total.toLocaleString();
  }
}

async function initDashboard() {
  const spinner = document.getElementById("loading-spinner");
  try {
    await loadKvkContext();
    initTimeline();
    const rows = await loadDashboardRows();

    initTable(rows);

    const dkpKey = hasSums ? "sumDkp" : "dkp";
    const top3 = [...rows].sort((firstRow, secondRow) => toNumberOrZero(secondRow[dkpKey]) - toNumberOrZero(firstRow[dkpKey])).slice(0, 3);
    renderTopPlayers(top3, dkpKey);
    renderTotals(rows);

    requestAnimationFrame(() =>
      document.getElementById("gridWrapper").classList.add("visible"),
    );
  } catch (event) {
    console.error(event);
    showToast(event.message || "Failed to load data", "error");
  } finally {
    spinner.style.display = "none";
  }
}

initDashboard();
