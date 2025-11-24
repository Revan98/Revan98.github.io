/* dashboard.js
   Bootstrap 5.3.8 + Chart.js integration
   Rewritten from your original file to use Bootstrap markup only.
*/

/* CONFIGURATION */
const CONFIG = {
  source: "google",
  googleSheetUrl:
    "https://docs.google.com/spreadsheets/d/1bP7LMwUuN3gjIEWKo0QCStKmrvIzn9rrYedoaUJh5zg/edit?usp=sharing",
};

const API_KEY = "AIzaSyAPP27INsgILZBAigyOm-g31djFgYlU7VY";

const SELECTED_COLS = [0, 1, 2, 12, 13, 14, 15, 8, 9];
const SHORT_NUMBER_COLS = [2, 12, 13, 14, 15, 8];
const PROGRESS_COLS = [2, 12, 13, 14, 15];
const DIFF_COLS = [2, 12, 13, 14, 15];

let googleSheetId = null;
let googleSheetNames = [];
let googleSheetsData = {};
let currentSource = null;

let charts = {};
let diffsCache = {};

const qs = (sel) => document.querySelector(sel);

/* Utilities */
function formatNumber(num) {
  const n = Number(num);
  return isNaN(n) ? "" : n.toLocaleString("en-US");
}

function cleanRows(rows) {
  return rows.filter((r) => r && r.some((c) => c !== undefined && `${c}`.trim() !== ""));
}

function extractSheetId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/* DIFF CALCULATIONS — CACHED */
function computeDiffs() {
  diffsCache = {};

  const lastSheet = googleSheetNames.at(-1);
  const rows = googleSheetsData[lastSheet] || [];
  // rows includes header; we want data rows
  const dataRows = rows.slice(1);

  dataRows.forEach((row) => {
    const id = String(row[0] ?? "").trim();
    if (!id) return;
    // Keep mapping close to original intent.
    // Original code had some cross mapping; keep consistent mapping for display:
    // col keys correspond to the SELECTED_COLS indexes we show diffs for.
    diffsCache[id] = {
      3: +row[3] || 0,
      4: +row[4] || 0,
      5: +row[5] || 0,
      6: +row[6] || 0,
      2: +row[16] || 0, // original used row[16] -> maybe previous value
      12: +row[4] || 0,
      13: +row[5] || 0,
      14: +row[3] || 0,
      15: +row[6] || 0,
    };
  });
}

function getDiff(id, col) {
  return diffsCache[id]?.[col] ?? 0;
}

/* CHARTS */
function initCharts() {
  const chartConfigs = [
    { id: "chart4", label: "T4 kills" },
    { id: "chart5", label: "T5 kills" },
    { id: "chart6", label: "Deads gained" },
    { id: "chart7", label: "KP gained" },
  ];

  const styles = getChartStyles();

  chartConfigs.forEach(({ id, label }) => {
    const canvas = qs(`#${id}`);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    charts[id] = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label,
            data: [],
            fill: true,
            borderWidth: 2,
            tension: 0.3,
            borderColor: styles.line,
            backgroundColor: styles.line + "33",
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: styles.text } },
        },
        scales: {
          x: { ticks: { color: styles.text }, grid: { color: styles.grid } },
          y: { ticks: { color: styles.text }, grid: { color: styles.grid } },
        },
      },
    });
  });
}

function isDarkTheme() {
  const theme = document.documentElement.getAttribute("data-bs-theme");
  return theme === "dark";
}

function getChartStyles() {
  // Choose some readable defaults depending on Bootstrap theme
  if (isDarkTheme()) {
    return {
      text: "#e9ecef",
      grid: "rgba(255,255,255,0.06)",
      line: "#66d9ff",
      dataset: {},
    };
  } else {
    return {
      text: "#212529",
      grid: "rgba(0,0,0,0.06)",
      line: "#007bff",
      dataset: {},
    };
  }
}

function resetCharts() {
  Object.values(charts).forEach((c) => {
    c.data.labels = [];
    c.data.datasets[0].data = [];
    c.update();
  });
}

function updateCharts(playerId) {
  const sheets = googleSheetNames;
  if (!sheets || sheets.length === 0) return;

  const values = sheets.map((sheet) => {
    const row = (googleSheetsData[sheet] || [])
      .slice(1)
      .find((r) => `${r[0]}` === playerId);
    return {
      t4: +row?.[4] || 0,
      t5: +row?.[5] || 0,
      deads: +row?.[6] || 0,
      kp: +row?.[3] || 0,
    };
  });

  if (charts.chart4) {
    charts.chart4.data.labels = sheets;
    charts.chart4.data.datasets[0].data = values.map((v) => v.t4);
  }
  if (charts.chart5) {
    charts.chart5.data.labels = sheets;
    charts.chart5.data.datasets[0].data = values.map((v) => v.t5);
  }
  if (charts.chart6) {
    charts.chart6.data.labels = sheets;
    charts.chart6.data.datasets[0].data = values.map((v) => v.deads);
  }
  if (charts.chart7) {
    charts.chart7.data.labels = sheets;
    charts.chart7.data.datasets[0].data = values.map((v) => v.kp);
  }

  Object.values(charts).forEach((c) => c.update());
}

/* RENDER TABLE & UI */
function renderTable(headers, rawRows) {
  resetCharts();

  let rows = cleanRows(rawRows);
  // filter out rows with column 11 "YES"
  rows = rows.filter((r) => String(r[11] ?? "").trim().toUpperCase() !== "YES");

  computeDiffs(); // Cache diffs once

  // sort by column 8 descending (power)
  rows.sort((a, b) => (+b[8] || 0) - (+a[8] || 0));

  renderTopPlayers(rows.slice(0, 3));
  buildTable(headers, rows);
  renderTotals(rows);
}

function renderTopPlayers(players) {
  const container = qs("#top-players");
  container.innerHTML = "";
  // Use Bootstrap cards in a row
  players.forEach((p, i) => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-4";

    const card = document.createElement("div");
    card.className = "card h-100 shadow-sm";

    const cardBody = document.createElement("div");
    cardBody.className = "card-body";

    const rank = document.createElement("div");
    rank.className = "h6 text-muted";
    rank.textContent = `TOP ${i + 1}`;

    const name = document.createElement("h5");
    name.className = "card-title mb-1";
    name.textContent = p[1] || "";

    const id = document.createElement("p");
    id.className = "card-text text-muted small mb-0";
    id.textContent = `ID: ${p[0] ?? ""}`;

    cardBody.appendChild(rank);
    cardBody.appendChild(name);
    cardBody.appendChild(id);
    card.appendChild(cardBody);
    col.appendChild(card);
    container.appendChild(col);
  });
}

function buildTable(headers, rows) {
  // Clear previous table
  const table = qs("#data-table");
  table.innerHTML = "";

  // Build header
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");

  // Index column
  const thIndex = document.createElement("th");
  thIndex.scope = "col";
  thIndex.textContent = "#";
  trHead.appendChild(thIndex);

  SELECTED_COLS.forEach((i) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.classList.add("sortable");
    th.style.userSelect = "none";

    const label = document.createElement("span");
    label.textContent = headers?.[i] ?? "";

    const sortIcons = document.createElement("span");
    sortIcons.className = "ms-2 text-muted small";
    sortIcons.innerHTML = "▲▼";

    th.appendChild(label);
    th.appendChild(sortIcons);
    trHead.appendChild(th);
  });

  thead.appendChild(trHead);
  table.appendChild(thead);

  // Build body
  const tbody = document.createElement("tbody");
  const maxValues = getMaxValues(rows);

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row[0] ?? "";

    const tdIndex = document.createElement("td");
    tdIndex.textContent = idx + 1;
    tr.appendChild(tdIndex);

    SELECTED_COLS.forEach((col) => {
      tr.appendChild(makeCell(row, col, maxValues[col]));
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  // Activate table features (search/sort/pagination)
  activateDataTable();
  addRowClickEvents();
}

function getMaxValues(rows) {
  const max = {};
  SELECTED_COLS.forEach((c) => {
    const values = rows.map((r) => +r[c] || 0);
    max[c] = values.length ? Math.max(...values) : 0;
  });
  return max;
}

function makeCell(row, col, maxVal) {
  const td = document.createElement("td");
  const id = row[0] ?? "";

  // wrapper using Bootstrap utilities via inline markup
  const wrapper = document.createElement("div");
  wrapper.className = "d-flex flex-column align-items-center gap-1";

  const raw = row[col];
  const numeric = +raw;

  const text = document.createElement("div");
  text.className = "fw-semibold small";
  text.style.fontSize = "0.9rem";
  text.textContent =
    col === 0
      ? raw
      : SHORT_NUMBER_COLS.includes(col)
      ? formatNumber(numeric)
      : raw ?? "";

  wrapper.appendChild(text);

  // DIFF box
  if (DIFF_COLS.includes(col)) {
    const diff = getDiff(id, col);
    if (diff !== 0) {
      const diffBox = document.createElement("div");
      diffBox.className = "small px-2 py-1 rounded";
      diffBox.style.fontWeight = "600";
      diffBox.style.fontSize = "0.75rem";
      if (diff > 0) {
        diffBox.classList.add("text-success", "bg-success", "bg-opacity-10");
      } else {
        diffBox.classList.add("text-danger", "bg-danger", "bg-opacity-10");
      }
      diffBox.textContent = `${diff > 0 ? "+" : ""}${formatNumber(diff)}`;
      wrapper.appendChild(diffBox);
    }
  }

  // Progress bar for some columns
  if (PROGRESS_COLS.includes(col)) {
    const barContainer = document.createElement("div");
    barContainer.className = "w-100";
    barContainer.style.maxWidth = "120px";

    const progress = document.createElement("div");
    progress.className = "progress";
    progress.style.height = "8px";

    const bar = document.createElement("div");
    bar.className = "progress-bar";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", maxVal || 100);
    const pct = maxVal > 0 ? (numeric / maxVal) * 100 : 0;
    bar.style.width = `${pct}%`;
    bar.setAttribute("aria-valuenow", Math.round(pct));

    // Color mapping via Bootstrap utility classes is limited; use inline background for distinct colors
    const colors = {
      12: "#00bcd4", // T4 kills
      13: "#ffc107", // T5 kills
      14: "#e91e63", // KP
      15: "#f44336", // Deads
      8: "#4caf50", // Power
    };
    bar.style.backgroundColor = colors[col] || "#0d6efd";

    progress.appendChild(bar);
    barContainer.appendChild(progress);
    wrapper.appendChild(barContainer);
  }

  td.appendChild(wrapper);

  // Set a clean sortable value used by table sorting
  if (!isNaN(numeric) && numeric !== 0) {
    td.dataset.value = numeric;
  } else {
    td.dataset.value = raw ?? "";
  }

  return td;
}

/* DATATABLE: search / sort / pagination */
function activateDataTable() {
  const table = qs("#data-table");
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const originalRows = [...tbody.querySelectorAll("tr")];

  // Table state stored on DOM element to survive rebuilds
  const state = table.__dtState || {
    filteredRows: originalRows.slice(),
    page: 1,
    pageSize: 20,
    currentSort: { col: null, dir: 1 },
  };
  table.__dtState = state;

  // Controls
  const controlBar = qs(".dt-controls") || qs(".card-body") || document;
  const searchInput = qs(".dt-search");
  const sizeSelect = qs(".dt-size");
  const infoBox = qs(".bottom-table-row .dt-info") || qs(".dt-info");
  const pager = qs(".bottom-table-row .dt-pager") || qs(".dt-pager");

  // Sync UI with state
  if (sizeSelect) sizeSelect.value = state.pageSize;
  if (searchInput) searchInput.value = "";

  // SEARCH
  if (searchInput) {
    searchInput.oninput = () => {
      const q = searchInput.value.toLowerCase().trim();
      state.filteredRows = originalRows.filter((r) =>
        r.textContent.toLowerCase().includes(q)
      );
      state.page = 1;
      renderPage();
    };
  }

  // PAGE SIZE
  if (sizeSelect) {
    sizeSelect.onchange = () => {
      state.pageSize = +sizeSelect.value;
      state.page = 1;
      renderPage();
    };
  }

  // SORTING - attach to header cells
  table.querySelectorAll("thead th").forEach((th, colIndex) => {
    if (colIndex === 0) return; // index column non-sortable
    th.style.cursor = "pointer";
    th.onclick = () => {
      if (state.currentSort.col === colIndex) {
        state.currentSort.dir *= -1;
      } else {
        state.currentSort = { col: colIndex, dir: 1 };
      }

      // Visual indicator (Bootstrap classes)
      table.querySelectorAll("thead th").forEach((h, idx) => {
        h.classList.remove("table-active");
        h.dataset.sortDir = "";
        if (idx === state.currentSort.col) {
          h.classList.add("table-active");
          h.dataset.sortDir = state.currentSort.dir === 1 ? "asc" : "desc";
        }
      });

      // sort
      state.filteredRows.sort((a, b) => {
        const A = a.children[colIndex].dataset.value;
        const B = b.children[colIndex].dataset.value;

        const An = Number(A);
        const Bn = Number(B);

        if (!isNaN(An) && !isNaN(Bn)) {
          return (An - Bn) * state.currentSort.dir;
        }
        return String(A).localeCompare(String(B)) * state.currentSort.dir;
      });

      state.page = 1;
      renderPage();
    };
  });

  // Pager helpers
  function makeBtn(label, page, opts = {}) {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-outline-primary me-1";
    if (opts.disabled) btn.classList.add("disabled");
    if (opts.active) {
      btn.classList.remove("btn-outline-primary");
      btn.classList.add("btn-primary");
    }
    btn.textContent = label;
    btn.onclick = () => {
      if (opts.disabled) return;
      state.page = page;
      renderPage();
    };
    return btn;
  }

  function get5Centered(current, total, size = 5) {
    if (total <= size) return Array.from({ length: total }, (_, i) => i + 1);
    const half = Math.floor(size / 2);
    let start = current - half;
    let end = current + half;
    if (start < 1) {
      start = 1;
      end = size;
    }
    if (end > total) {
      end = total - size + 1;
    }
    const arr = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }

  function renderPager(totalPages) {
    if (!pager) return;
    pager.innerHTML = "";

    pager.appendChild(makeBtn("««", 1, { disabled: state.page === 1 }));
    pager.appendChild(makeBtn("«", Math.max(1, state.page - 1), { disabled: state.page === 1 }));

    const nums = get5Centered(state.page, totalPages, 5);
    if (nums[0] > 1) {
      const ell = document.createElement("span");
      ell.className = "mx-1";
      ell.textContent = "...";
      pager.appendChild(ell);
    }

    nums.forEach((p) => {
      pager.appendChild(makeBtn(p, p, { active: p === state.page }));
    });

    if (nums[nums.length - 1] < totalPages) {
      const ell = document.createElement("span");
      ell.className = "mx-1";
      ell.textContent = "...";
      pager.appendChild(ell);
    }

    pager.appendChild(makeBtn("»", Math.min(totalPages, state.page + 1), { disabled: state.page === totalPages }));
    pager.appendChild(makeBtn("»»", totalPages, { disabled: state.page === totalPages }));
  }

  function renderPage() {
    const prevSelectedId = tbody.querySelector(".table-primary")?.dataset?.id;
    tbody.innerHTML = "";

    const total = state.filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);

    const slice = state.filteredRows.slice(start, end);
    slice.forEach((r) => tbody.appendChild(r));

    if (prevSelectedId) {
      const row = tbody.querySelector(`tr[data-id="${prevSelectedId}"]`);
      if (row) row.classList.add("table-primary");
    }

    if (infoBox) {
      infoBox.textContent = total === 0 ? "No entries" : `Showing ${start + 1}–${end} of ${total}`;
    }
    renderPager(totalPages);
  }

  // initialize
  state.filteredRows = originalRows.slice();
  renderPage();
}

/* CLICK EVENTS (selection & chart updates) */
function addRowClickEvents() {
  const tbody = qs("#data-table tbody");
  if (!tbody) return;

  tbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;

    tbody.querySelector(".table-primary")?.classList.remove("table-primary");
    row.classList.add("table-primary");

    updateCharts(row.dataset.id);
  });
}

/* TOTALS */
function renderTotals(rows) {
  const container = qs("#bottom-totals");
  container.innerHTML = "";

  const defs = [
    { label: "Total T4 kills", col: 4 },
    { label: "Total T5 kills", col: 5 },
    { label: "Total Deads", col: 6 },
    { label: "Total KP", col: 3 },
  ];

  defs.forEach(({ label, col }) => {
    const sum = rows.reduce((acc, r) => acc + (diffsCache[r[0]]?.[col] || 0), 0);
    const colDiv = document.createElement("div");
    colDiv.className = "col-12 col-md-3";

    const card = document.createElement("div");
    card.className = "card h-100 shadow-sm";

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h6");
    title.className = "card-title mb-1";
    title.textContent = label;

    const val = document.createElement("p");
    val.className = "card-text fw-semibold mb-0";
    val.textContent = sum.toLocaleString();

    body.appendChild(title);
    body.appendChild(val);
    card.appendChild(body);
    colDiv.appendChild(card);
    container.appendChild(colDiv);
  });
}

/* GOOGLE SHEETS LOADING */
async function loadGoogleSheets() {
  googleSheetId = extractSheetId(CONFIG.googleSheetUrl);
  if (!googleSheetId) throw new Error("Invalid Google Sheets URL");

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${googleSheetId}?key=${API_KEY}`
  );

  const meta = await metaRes.json();
  if (!meta.sheets) throw new Error("Unable to load spreadsheet metadata");

  googleSheetNames = meta.sheets.map((s) => s.properties.title);
  currentSource = "google";

  googleSheetsData = {};

  await Promise.all(
    googleSheetNames.map(async (name) => {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${googleSheetId}/values/${encodeURIComponent(
          name
        )}?key=${API_KEY}`
      );
      const json = await r.json();
      googleSheetsData[name] = json.values || [];
    })
  );
}

/* THEME TOGGLE */
function applyTheme(isDark) {
  document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");

  // Update chart colors
  const styles = getChartStyles();
  Object.values(charts).forEach((chart) => {
    chart.options.plugins.legend.labels.color = styles.text;
    if (chart.options.scales?.x) chart.options.scales.x.ticks.color = styles.text;
    if (chart.options.scales?.y) chart.options.scales.y.ticks.color = styles.text;
    if (chart.data.datasets[0]) {
      chart.data.datasets[0].borderColor = styles.line;
      chart.data.datasets[0].backgroundColor = styles.line + "33";
    }
    chart.update();
  });
}

/* INITIALIZATION */
document.addEventListener("DOMContentLoaded", async () => {
  // theme from localStorage
  const savedTheme = localStorage.getItem("theme");
  const isDark = savedTheme === "dark";
  document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");
  const toggle = qs("#toggle-theme");
  if (toggle) toggle.checked = isDark;

  initCharts();

  // Show loading overlay
  const loading = qs("#loading-overlay");
  if (loading) loading.style.display = "flex";

  try {
    if (CONFIG.source === "google") {
      await loadGoogleSheets();
      const sheet = googleSheetNames.at(-1);
      if (!sheet) throw new Error("No sheet pages found");
      const all = googleSheetsData[sheet] || [];
      const headers = all[0] || [];
      const rows = all.slice(1);
      renderTable(headers, rows);
    }
  } catch (e) {
    // Better UX than alert — but keep simple
    console.error("Google Sheets load error:", e);
    alert("Google Sheets load error:\n" + (e.message || e));
  } finally {
    if (loading) loading.style.display = "none";
  }

  // wire theme toggle
  const themeToggle = qs("#toggle-theme");
  if (themeToggle) {
    themeToggle.addEventListener("change", (ev) => {
      const dark = !!ev.target.checked;
      localStorage.setItem("theme", dark ? "dark" : "light");
      applyTheme(dark);
    });
  }
});
