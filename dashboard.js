/* CONFIGURATION */
const CONFIG = {
  sources: [
    {
      id: "main",
      name: "KD2247",
      url: "https://docs.google.com/spreadsheets/d/1bP7LMwUuN3gjIEWKo0QCStKmrvIzn9rrYedoaUJh5zg/edit?usp=sharing",
    },
    {
      id: "backup",
      name: "KD2552",
      url: "https://docs.google.com/spreadsheets/d/1HS6wcMWCzLR4PVhYJA_8rFzUuqaYvwUilD2zffq9YNE/edit?usp=sharing",
    },
  ],
};
function getKDFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("kd");
}

function mapKDToSourceId(kd) {
  if (kd === "2552") return "backup"; // KD2552
  if (kd === "2247") return "main"; // KD2247
  return null;
}

const API_KEY = "AIzaSyAZoyI5MbKsUJBe71jcn8AgU5ejFzdrteI";

/* COLUMNS / BEHAVIOR CONFIG */
const SELECTED_COLS = [0, 1, 2, 12, 13, 14, 15, 8, 9];
const SHORT_NUMBER_COLS = [2, 12, 13, 14, 15, 8];
const PROGRESS_COLS = [2, 12, 13, 14, 15];
const DIFF_COLS = [2, 12, 13, 14, 15];

/* STATE */
let googleSheetId = null;
let googleSheetNames = [];
let googleSheetsData = {};
let currentSource = null;
let sourcesCache = {};
let diffsCache = {};
let modalChart = null;
let selectedGovernorId = null;
let currentMetric = 16; // default metric for modal chart
let _documentClickListenerAdded = false;

/* Simple query helper */
const qs = (sel) => document.querySelector(sel);

/* -------------------------
   UTILS
   ------------------------- */
function formatNumber(num) {
  const n = Number(num);
  return isNaN(n) ? "" : n.toLocaleString("en-US");
}

function cleanRows(rows = []) {
  return rows.filter(
    (r) =>
      Array.isArray(r) && r.some((c) => c !== undefined && `${c}`.trim() !== "")
  );
}

function extractSheetId(url) {
  const match = (url || "").match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/* -------------------------
   DIFF CALCULATIONS (cached)
   ------------------------- */
function computeDiffs() {
  diffsCache = {};

  const lastSheet = googleSheetNames.at(-1);
  const rows = (googleSheetsData[lastSheet] || []).slice(1);

  rows.forEach((row) => {
    const id = String(row[0] ?? "").trim();
    if (!id) return;

    // Keep the original mapping but coerce to numbers with fallback 0
    diffsCache[id] = {
      3: Number(row[3]) || 0,
      4: Number(row[4]) || 0,
      5: Number(row[5]) || 0,
      6: Number(row[6]) || 0,
      2: Number(row[16]) || 0, // original used col 16 for Power diff
      12: Number(row[4]) || 0,
      13: Number(row[5]) || 0,
      14: Number(row[3]) || 0,
      15: Number(row[6]) || 0,
    };
  });
}

function getDiff(id, col) {
  return diffsCache[id]?.[col] ?? 0;
}

/* -------------------------
   GOVERNOR / NAME HELPERS
   ------------------------- */
function getGovernorName(id) {
  const sheet = googleSheetNames.at(-1);
  const rows = googleSheetsData[sheet];
  if (!rows) return id;
  const found = rows.find((r) => `${r[0]}` === `${id}`);
  return found ? found[1] : id;
}

/* -------------------------
   CHARTS (modal)
   ------------------------- */
function getChartStyles() {
  const css = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();
  const line = css("--chart-line") || "#007bff";
  return {
    text: css("--chart-text") || "#333",
    grid: css("--chart-grid") || "rgba(0,0,0,0.1)",
    line,
    dataset: {
      borderColor: line,
      backgroundColor: line + "33",
      tension: 0.3,
    },
  };
}

function openChartModal(governorId) {
  selectedGovernorId = governorId;
  const modal = qs("#chart-modal");
  const title = qs("#modal-title");
  const name = getGovernorName(governorId);
  title.textContent = `${name} (ID: ${governorId})`;

  modal.classList.remove("hidden");

  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }

  const ctx = qs("#modal-chart").getContext("2d");
  modalChart = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [{ label: "", data: [] }] },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: getChartStyles().text } } },
      scales: {
        x: { ticks: { color: getChartStyles().text } },
        y: { ticks: { color: getChartStyles().text } },
      },
    },
  });

  updateModalChart(currentMetric);
}

function updateModalChart(colIndex) {
  if (!modalChart) return;
  currentMetric = colIndex;

  const sheets = googleSheetNames || [];
  const values = sheets.map((sheet) => {
    const row = (googleSheetsData[sheet] || [])
      .slice(1)
      .find((r) => `${r[0]}` === `${selectedGovernorId}`);
    return row ? Number(row[colIndex] || 0) : 0;
  });

  modalChart.data.labels = sheets;
  modalChart.data.datasets[0].data = values;

  const labelMap = {
    16: "Power Diff",
    3: "T4 Kills",
    4: "T5 Kills",
    5: "Kill Points",
    6: "Deads",
  };
  modalChart.data.datasets[0].label = labelMap[colIndex] || `Col ${colIndex}`;

  modalChart.update();
}

/* -------------------------
   TABLE / UI RENDERING
   ------------------------- */
function renderTable(headers, rawRows) {
  let rows = cleanRows(rawRows);
  // filter out rows where col 11 (index 11) equals "YES"
  rows = rows.filter(
    (r) =>
      String(r[11] ?? "")
        .trim()
        .toUpperCase() !== "YES"
  );

  computeDiffs();

  // sort by power (col 8) desc
  rows.sort((a, b) => (Number(b[8]) || 0) - (Number(a[8]) || 0));

  renderTopPlayers(rows.slice(0, 3));
  buildTable(headers, rows);
  renderTotals(rows);
}

function renderTopPlayers(players) {
  const box = qs("#top-players");
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

function buildTable(headers = [], rows = []) {
  const thead = document.querySelector(".header-table thead");
  const tbody = document.querySelector(".body-table tbody");

  if (!thead || !tbody) return;

  thead.innerHTML = "";
  tbody.innerHTML = "";

  /* -------------------------
      BUILD HEADER
     ------------------------- */
  const trHead = document.createElement("tr");

  // # column
  const indexTh = document.createElement("th");
  indexTh.textContent = "#";
  trHead.appendChild(indexTh);

  // data columns
  SELECTED_COLS.forEach((i) => {
    const th = document.createElement("th");
    th.classList.add("dt-sortable");

    const label = document.createElement("span");
    label.textContent = headers[i] || "";

    const icons = document.createElement("span");
    icons.className = "sort-icons";
    icons.innerHTML = `<span class="up">▲</span><span class="down">▼</span>`;

    th.appendChild(label);
    th.appendChild(icons);

    trHead.appendChild(th);
  });

  thead.appendChild(trHead);

  /* -------------------------
      BUILD BODY
     ------------------------- */
  const maxValues = getMaxValues(rows);

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row[0];

    // row index
    const idxCell = document.createElement("td");
    idxCell.textContent = idx + 1;
    tr.appendChild(idxCell);

    // data cells
    SELECTED_COLS.forEach((col) => {
      tr.appendChild(makeCell(row, col, maxValues[col]));
    });

    tbody.appendChild(tr);
  });

  // Sync column widths after rows are in DOM
  requestAnimationFrame(syncColumnWidths);

  // re-activate datatable (sorting, pagination, etc.)
  activateDataTable();
  addRowClickEventsOnce();
}

function getMaxValues(rows) {
  const max = {};
  SELECTED_COLS.forEach((c) => {
    max[c] = Math.max(...rows.map((r) => Number(r[c]) || 0), 0);
  });
  return max;
}

function makeCell(row, col, maxVal = 0) {
  const td = document.createElement("td");
  const id = row[0];
  const raw = row[col];
  const numeric = Number(raw);

  td.classList.add("cell");

  // sortable value
  td.dataset.value = !isNaN(numeric) ? numeric : raw ?? "";

  // value area
  const valueDiv = document.createElement("div");
  valueDiv.className = "cell-value";

  if (col === 0) {
    // governor ID clickable
    valueDiv.innerHTML = `
      <span class="gov-link" data-id="${escapeHtml(raw ?? "")}">
        ${escapeHtml(raw ?? "")}
        <span class="gov-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/>
            <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/>
          </svg>
        </span>
      </span>`;
  } else {
    valueDiv.textContent = SHORT_NUMBER_COLS.includes(col)
      ? formatNumber(numeric)
      : raw ?? "";
  }

  td.appendChild(valueDiv);

  // diff
  if (DIFF_COLS.includes(col)) {
    const diff = getDiff(id, col);
    if (diff !== 0) {
      const diffDiv = document.createElement("div");
      diffDiv.className = `cell-diff ${diff > 0 ? "positive" : "negative"}`;
      diffDiv.textContent = `${diff > 0 ? "+" : ""}${formatNumber(diff)}`;
      td.appendChild(diffDiv);
    }
  }

  // progress bar
  if (PROGRESS_COLS.includes(col)) {
    const progress = document.createElement("div");
    progress.className = "cell-progress";

    const bar = document.createElement("div");
    bar.className = "cell-progress-bar";

    const colors = {
      12: "#00bcd4", // T4
      13: "#ffc107", // T5
      14: "#e91e63", // KP
      15: "#f44336", // Deads
      8: "#4caf50", // Power
    };

    bar.style.background = colors[col] || "#2196f3";
    bar.style.width =
      maxVal > 0 ? `${((Number(row[col]) || 0) / maxVal) * 100}%` : "0%";

    progress.appendChild(bar);
    td.appendChild(progress);
  }

  return td;
}

/* -------------------------
   SIMPLE DATATABLE: search / sort / pagination
   ------------------------- */
function activateDataTable() {
  const table = document.querySelector(".body-table");
  if (!table) return;

  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  // Snapshot rows
  const rows = [...tbody.querySelectorAll("tr")];

  const state = table.__dtState || {
    filteredRows: rows.slice(),
    page: 1,
    pageSize: 20,
    currentSort: { col: null, dir: 1 },
  };

  table.__dtState = state;

  const controlBar = qs(".dt-controls");
  const searchInput = controlBar?.querySelector("input.dt-search");
  const sizeSelect = controlBar?.querySelector("select.dt-size");
  const infoBox = qs(".bottom-table-row .dt-info");
  const pager = qs(".bottom-table-row .dt-pager");

  // reset inputs
  if (sizeSelect) sizeSelect.value = state.pageSize;
  if (searchInput) searchInput.value = "";

  /* -------------------------
      SEARCH
     ------------------------- */
  if (searchInput) {
    searchInput.oninput = () => {
      const q = searchInput.value.toLowerCase().trim();
      state.filteredRows = rows.filter((r) =>
        r.textContent.toLowerCase().includes(q)
      );
      state.page = 1;
      renderPage();
    };
  }

  /* -------------------------
      PAGE SIZE
     ------------------------- */
  if (sizeSelect) {
    sizeSelect.onchange = () => {
      state.pageSize = Number(sizeSelect.value) || 20;
      state.page = 1;
      renderPage();
    };
  }

  /* -------------------------
      SORTING (on header table)
     ------------------------- */
  document
    .querySelectorAll(".header-table thead th")
    .forEach((th, colIndex) => {
      if (colIndex === 0) return;

      th.style.cursor = "pointer";

      th.onclick = () => {
        const sort = state.currentSort;

        if (sort.col !== colIndex) {
          sort.col = colIndex;
          sort.dir = 1;
        } else if (sort.dir === 1) {
          sort.dir = -1;
        } else {
          sort.col = null;
          sort.dir = 1;
        }

        updateSortIcons();

        if (sort.col === null) {
          const q = (searchInput?.value || "").toLowerCase();
          state.filteredRows = rows.filter((r) =>
            r.textContent.toLowerCase().includes(q)
          );
        } else {
          const col = sort.col;
          const dir = sort.dir;
          state.filteredRows.sort((a, b) => {
            const A = parseSortableValue(a.children[col].dataset.value);
            const B = parseSortableValue(b.children[col].dataset.value);
            if (!isNaN(A.num) && !isNaN(B.num)) return (A.num - B.num) * dir;
            if (!isNaN(A.num) && isNaN(B.num)) return -1 * dir;
            if (isNaN(A.num) && !isNaN(B.num)) return 1 * dir;
            return A.text.localeCompare(B.text) * dir;
          });
        }

        state.page = 1;
        renderPage();
      };
    });

  function updateSortIcons() {
    document.querySelectorAll(".header-table thead th").forEach((th, idx) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      if (idx === state.currentSort.col) {
        th.classList.add(
          state.currentSort.dir === 1 ? "sorted-asc" : "sorted-desc"
        );
      }
    });
  }

  function parseSortableValue(v) {
    if (v == null) return { num: NaN, text: "" };
    let s = String(v).trim();
    s = s.replace(/,/g, ""); // remove thousands separator
    // handle percentages
    if (/^\d+(\.\d+)?%$/.test(s)) {
      const num = parseFloat(s.replace("%", ""));
      return { num, text: s };
    }
    const n = Number(s);
    if (!isNaN(n)) return { num: n, text: s };
    return { num: NaN, text: s.toLowerCase() };
  }

  /* -------------------------
      PAGINATION
     ------------------------- */

  function renderPage() {
    tbody.innerHTML = "";

    const total = state.filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);

    const slice = state.filteredRows.slice(start, end);
    slice.forEach((r) => tbody.appendChild(r));

    infoBox.textContent =
      total === 0 ? "No entries" : `Showing ${start + 1}–${end} of ${total}`;

    renderPager(totalPages);

    // resync column widths after re-render
    syncColumnWidths();
  }

  function renderPager(totalPages) {
    pager.innerHTML = "";

    const makeBtn = (label, page, disabled = false, active = false) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      if (disabled) btn.disabled = true;
      if (active) btn.classList.add("active");
      btn.onclick = () => {
        if (!disabled) {
          state.page = page;
          renderPage();
        }
      };
      return btn;
    };

    const cur = state.page;

    pager.appendChild(makeBtn("<<", 1, cur === 1));
    pager.appendChild(makeBtn("<", Math.max(1, cur - 1), cur === 1));

    pager.appendChild(makeBtn("1", 1, false, cur === 1));

    const total = totalPages;
    const windowSize = 3;
    const half = Math.floor(windowSize / 2);

    if (cur > half + 2) {
      const ell = document.createElement("span");
      ell.textContent = "...";
      pager.appendChild(ell);
    }

    const start = Math.max(2, cur - half);
    const end = Math.min(total - 1, cur + half);

    for (let p = start; p <= end; p++) {
      pager.appendChild(makeBtn(p, p, false, p === cur));
    }

    if (cur < total - (half + 1)) {
      const ell = document.createElement("span");
      ell.textContent = "...";
      pager.appendChild(ell);
    }

    if (total > 1)
      pager.appendChild(makeBtn(total, total, false, cur === total));

    pager.appendChild(makeBtn(">", Math.min(total, cur + 1), cur === total));
    pager.appendChild(makeBtn(">>", total, cur === total));
  }

  state.filteredRows = rows.slice();
  renderPage();
}

function syncColumnWidths() {
  const headCols = document.querySelectorAll(".header-table thead tr th");
  const bodyRow = document.querySelector(".body-table tbody tr");
  if (!bodyRow) return;

  const bodyCols = bodyRow.children;
  if (headCols.length !== bodyCols.length) return;

  for (let i = 0; i < headCols.length; i++) {
    const width = bodyCols[i].getBoundingClientRect().width + "px";
    headCols[i].style.width = width;
  }
}

/* -------------------------
   CLICK EVENTS
   - single document-level listener used for gov-link clicks
   ------------------------- */
function addRowClickEventsOnce() {
  if (_documentClickListenerAdded) return;
  _documentClickListenerAdded = true;

  document.addEventListener("click", (e) => {
    // looks for element with data-id (gov link)
    const link = e.target.closest(".gov-link");
    if (!link) return;

    const id = link.dataset?.id;
    if (!id) return;

    openChartModal(id);
  });
}

/* -------------------------
   TOTALS (bottom)
   ------------------------- */
function renderTotals(rows = []) {
  const container = qs("#bottom-totals");
  if (!container) return;
  container.innerHTML = "";

  const defs = [
    { label: "Total T4 kills", col: 4 },
    { label: "Total T5 kills", col: 5 },
    { label: "Total Deads", col: 6 },
    { label: "Total KP", col: 3 },
  ];

  defs.forEach(({ label, col }) => {
    const sum = rows.reduce(
      (acc, r) => acc + (diffsCache[r[0]]?.[col] || 0),
      0
    );
    const box = document.createElement("div");
    box.className = "stat-box";
    box.innerHTML = `<h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sticky-fill" viewBox="0 0 16 16">
        <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h6.086a1.5 1.5 0 0 0 1.06-.44l4.915-4.914A1.5 1.5 0 0 0 15 8.586V2.5A1.5 1.5 0 0 0 13.5 1zm6 8.5a1 1 0 0 1 1-1h4.396a.25.25 0 0 1 .177.427l-5.146 5.146a.25.25 0 0 1-.427-.177z"/>
      </svg>
      ${escapeHtml(label)}</h3><p>${Number(sum).toLocaleString()}</p>`;
    container.appendChild(box);
  });
}

/* -------------------------
   GOOGLE SHEETS LOADING (per-source)
   ------------------------- */
async function loadSource(sourceId) {
  const select = qs("#source-select");
  if (select) select.disabled = true;

  const source = CONFIG.sources.find((s) => s.id === sourceId);
  if (!source) {
    if (select) select.disabled = false;
    return;
  }

  qs("#loading-overlay").style.display = "flex";

  // if cached, just enable controls and return
  if (sourcesCache[sourceId]) {
    qs("#loading-overlay").style.display = "none";
    if (select) select.disabled = false;
    return;
  }

  const sheetId = extractSheetId(source.url);
  if (!sheetId) {
    qs("#loading-overlay").style.display = "none";
    if (select) select.disabled = false;
    throw new Error("Invalid Google Sheets URL for source: " + sourceId);
  }

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${API_KEY}`
  );
  const meta = await metaRes.json();
  const sheetNames = (meta.sheets || []).map((s) => s.properties.title);
  const sheetData = {};

  await Promise.all(
    sheetNames.map(async (name) => {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
          name
        )}?key=${API_KEY}`
      );
      const json = await r.json();
      sheetData[name] = json.values || [];
    })
  );

  sourcesCache[sourceId] = {
    sheetNames,
    sheetData,
  };

  qs("#loading-overlay").style.display = "none";
  if (select) select.disabled = false;
}

function applySourceData(sourceId) {
  const cached = sourcesCache[sourceId];
  if (!cached) return;

  googleSheetNames = cached.sheetNames;
  googleSheetsData = cached.sheetData;

  const lastSheet = googleSheetNames.at(-1);
  const headers = (googleSheetsData[lastSheet] || [])[0] || [];
  const rows = (googleSheetsData[lastSheet] || []).slice(1);

  renderTable(headers, rows);

  // update modal if open
  if (selectedGovernorId) {
    updateModalChart(currentMetric);
  }
}

/* -------------------------
   THEME HANDLING
   ------------------------- */
const themeToggle = qs("#toggle-theme");

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

/* -------------------------
   BOOTSTRAP / EVENT BINDING
   ------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  // UI refs
  const sourceSelect = qs("#source-select");
  const loadingOverlay = qs("#loading-overlay");
  const closeModalBtn = qs("#close-modal");
  const chartButtons = qs(".chart-buttons");
  const themeToggle = qs("#toggle-theme");
  // AUTO LOAD KINGDOM BASED ON URL
  const kd = getKDFromURL();
  const autoSource = mapKDToSourceId(kd);

  if (autoSource) {
    // Hide selector so user can’t switch sources
    const selector = qs("#source-select");
    if (selector) selector.style.display = "none";
    // hide the label
    const label = document.querySelector("label[for='source-select']");
    if (label) label.style.display = "none";

    qs("#loading-overlay").style.display = "flex";
    await loadSource(autoSource);
    applySourceData(autoSource);

    const card = qs(".card");
    if (card) card.style.display = "block";
    qs("#loading-overlay").style.display = "none";
  }
  // populate source selector
  if (sourceSelect) {
    CONFIG.sources.forEach((src) => {
      const opt = document.createElement("option");
      opt.value = src.id;
      opt.textContent = src.name;
      sourceSelect.appendChild(opt);
    });

    sourceSelect.addEventListener("change", async () => {
      const sourceId = sourceSelect.value;
      selectedGovernorId = null;

      if (loadingOverlay) loadingOverlay.style.display = "flex";

      await loadSource(sourceId);
      applySourceData(sourceId);

      const card = qs(".card");
      if (card) card.style.display = "block";
      if (loadingOverlay) loadingOverlay.style.display = "none";
    });
  }
  function syncHeaderScroll() {
    const bodyScroll = document.querySelector(".table-scroll-body");
    const headerTable = document.querySelector(".header-table");

    if (!bodyScroll || !headerTable) return;

    bodyScroll.addEventListener("scroll", () => {
      headerTable.style.transform = `translateX(-${bodyScroll.scrollLeft}px)`;
    });
  }

  // call it after tables are rendered
  requestAnimationFrame(syncHeaderScroll);

  // Modal close
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () =>
      qs("#chart-modal")?.classList.add("hidden")
    );
  }

  // Chart buttons (switch metric)
  if (chartButtons) {
    chartButtons.addEventListener("click", (e) => {
      const col = Number(e.target.dataset?.col);
      if (!isNaN(col)) updateModalChart(col);
    });
  }

  // Hide loading initially
  if (loadingOverlay) loadingOverlay.style.display = "none";
});

/* -------------------------
   SMALL SAFETY HELPERS
   ------------------------- */
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

document.addEventListener("DOMContentLoaded", () => {
  const current = location.pathname.split("/").pop(); // e.g. "index.html"

  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
});
