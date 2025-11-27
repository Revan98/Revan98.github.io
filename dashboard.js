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

function formatNumber(num) {
  const n = Number(num);
  return isNaN(n) ? "" : n.toLocaleString("en-US");
}

function cleanRows(rows) {
  return rows.filter((r) => r.some((c) => c && `${c}`.trim() !== ""));
}

function extractSheetId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/* DIFF CALCULATIONS — CACHED */
function computeDiffs() {
  diffsCache = {};

  const lastSheet = googleSheetNames.at(-1);
  const rows = googleSheetsData[lastSheet]?.slice(1) || [];

  rows.forEach((row) => {
    const id = String(row[0]).trim();
    diffsCache[id] = {
      3: +row[3] || 0,
      4: +row[4] || 0,
      5: +row[5] || 0,
      6: +row[6] || 0,
      2: +row[16] || 0,
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
    const ctx = qs(`#${id}`).getContext("2d");
    charts[id] = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ label, data: [], ...styles.dataset }] },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: styles.text } } },
        scales: {
          x: { ticks: { color: styles.text }, grid: { color: styles.grid } },
          y: { ticks: { color: styles.text }, grid: { color: styles.grid } },
        },
      },
    });
  });
}

function getChartStyles() {
  const css = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();
  return {
    text: css("--chart-text"),
    grid: css("--chart-grid"),
    line: css("--chart-line"),
    dataset: {
      borderColor: css("--chart-line"),
      backgroundColor: css("--chart-line") + "33",
      tension: 0.3,
    },
  };
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

  const values = sheets.map((sheet) => {
    const row = googleSheetsData[sheet]
      .slice(1)
      .find((r) => `${r[0]}` === playerId);
    return {
      t4: row?.[4] || 0,
      t5: row?.[5] || 0,
      deads: row?.[6] || 0,
      kp: row?.[3] || 0,
    };
  });

  charts.chart4.data.labels = sheets;
  charts.chart4.data.datasets[0].data = values.map((v) => v.t4);

  charts.chart5.data.labels = sheets;
  charts.chart5.data.datasets[0].data = values.map((v) => v.t5);

  charts.chart6.data.labels = sheets;
  charts.chart6.data.datasets[0].data = values.map((v) => v.deads);

  charts.chart7.data.labels = sheets;
  charts.chart7.data.datasets[0].data = values.map((v) => v.kp);

  Object.values(charts).forEach((c) => c.update());
}

/* RENDER TABLE & UI */
function renderTable(headers, rawRows) {
  resetCharts();

  let rows = cleanRows(rawRows);
  rows = rows.filter((r) => String(r[11]).trim().toUpperCase() !== "YES");

  computeDiffs(); // Cache diffs once

  rows.sort((a, b) => (+b[8] || 0) - (+a[8] || 0));
  renderTopPlayers(rows.slice(0, 3));
  buildTable(headers, rows);
  renderTotals(rows);
}

function renderTopPlayers(players) {
  const box = qs("#top-players");
  box.innerHTML = "";

  players.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = "player-box";
    el.innerHTML = `
    <div class="player-rank">TOP${i + 1}</div>
    <h3>${p[1]}</h3>
    <p>ID: ${p[0]}</p>
    `;
    box.appendChild(el);
  });
}

function buildTable(headers, rows) {
  // Clear any previous DataTable instance placeholder
  const table = qs("#data-table");
  table.innerHTML = "";

  // Build header
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  const indexTh = document.createElement("th");
  indexTh.textContent = "#";
  // no sort class, no icons
  tr.appendChild(indexTh);

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
    tr.appendChild(th);
  });

  thead.appendChild(tr);

  // Build body
  const tbody = document.createElement("tbody");
  const maxValues = getMaxValues(rows);

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row[0];

    const idxCell = document.createElement("td");
    idxCell.textContent = idx + 1;
    tr.appendChild(idxCell);

    SELECTED_COLS.forEach((col) => {
      tr.appendChild(makeCell(row, col, maxValues[col]));
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  // Activate table features (search/sort/pagination)
  activateDataTable();
  addRowClickEvents();
}

function getMaxValues(rows) {
  const max = {};
  SELECTED_COLS.forEach((c) => {
    max[c] = Math.max(...rows.map((r) => +r[c] || 0));
  });
  return max;
}

function makeCell(row, col, maxVal) {
  const td = document.createElement("td");
  const id = row[0];
  const raw = row[col];
  const numeric = +raw;

  td.classList.add("cell");

  // Set clean sortable numeric value
  td.dataset.value = !isNaN(numeric) ? numeric : raw || "";

  // ---- VALUE ----
  const valueDiv = document.createElement("div");
  valueDiv.className = "cell-value";
  valueDiv.textContent =
    col === 0
      ? raw
      : SHORT_NUMBER_COLS.includes(col)
      ? formatNumber(numeric)
      : raw;
  td.appendChild(valueDiv);

  // ---- DIFF ----
  if (DIFF_COLS.includes(col)) {
    const diff = getDiff(id, col);
    if (diff !== 0) {
      const diffDiv = document.createElement("div");
      diffDiv.className = "cell-diff " + (diff > 0 ? "positive" : "negative");
      diffDiv.textContent = `${diff > 0 ? "+" : ""}${formatNumber(diff)}`;
      td.appendChild(diffDiv);
    }
  }

  // ---- PROGRESS BAR ----
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
    bar.style.width = maxVal > 0 ? `${(numeric / maxVal) * 100}%` : "0%";

    progress.appendChild(bar);
    td.appendChild(progress);
  }

  return td;
}

function activateDataTable() {
  const table = qs("#data-table");
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  // grab rows snapshot (original DOM rows)
  const rows = [...tbody.querySelectorAll("tr")];

  // state - store on table element so rebuilds reuse values
  const state = table.__dtState || {
    filteredRows: rows.slice(),
    page: 1,
    pageSize: 20,
    currentSort: { col: null, dir: 1 },
  };
  table.__dtState = state;

  // Reference existing HTML elements
  const controlBar = qs(".dt-controls");
  const searchInput = controlBar.querySelector("input.dt-search");
  const sizeSelect = controlBar.querySelector("select.dt-size");
  const infoBox = qs(".bottom-table-row .dt-info");
  const pager = qs(".bottom-table-row .dt-pager");

  // sync UI -> state
  sizeSelect.value = state.pageSize;
  searchInput.value = "";

  // SEARCH
  searchInput.oninput = () => {
    const q = searchInput.value.toLowerCase().trim();
    state.filteredRows = rows.filter((r) =>
      r.textContent.toLowerCase().includes(q)
    );
    state.page = 1;
    renderPage();
  };

  // PAGE SIZE
  sizeSelect.onchange = () => {
    state.pageSize = +sizeSelect.value;
    state.page = 1;
    renderPage();
  };

  // SORTING - attach to headers (ASC → DESC → NONE)
  table.querySelectorAll("thead th").forEach((th, colIndex) => {
    if (colIndex === 0) return; // skip index column

    th.style.cursor = "pointer";

    th.onclick = () => {
      const sort = state.currentSort;

      // --- TRI-STATE LOGIC ---
      if (sort.col !== colIndex) {
        // First click on new column → ASC
        sort.col = colIndex;
        sort.dir = 1;
      } else if (sort.dir === 1) {
        // Second click → DESC
        sort.dir = -1;
      } else {
        // Third click → RESET (no sorting)
        sort.col = null;
        sort.dir = 1;
      }

      updateSortIcons();

      // --- APPLY SORT OR RESET ---
      if (sort.col === null) {
        // RESET sorting → restore original order
        state.filteredRows = rows
          .slice()
          .filter((r) =>
            r.textContent
              .toLowerCase()
              .includes(searchInput.value.toLowerCase())
          );
      } else {
        // NORMAL sorting
        const col = sort.col;
        const dir = sort.dir;

        state.filteredRows.sort((a, b) => {
          const A = parseSortableValue(a.children[col].dataset.value);
          const B = parseSortableValue(b.children[col].dataset.value);

          // If both are numbers → numeric sort
          if (!isNaN(A.num) && !isNaN(B.num)) {
            return (A.num - B.num) * dir;
          }

          // If only one is numeric → numeric always comes first
          if (!isNaN(A.num) && isNaN(B.num)) return -1 * dir;
          if (isNaN(A.num) && !isNaN(B.num)) return 1 * dir;

          // Else compare text
          return A.text.localeCompare(B.text) * dir;
        });
      }

      state.page = 1;
      renderPage();
    };
  });

  // update sort icons (ASC / DESC / neutral)
  function updateSortIcons() {
    table.querySelectorAll("thead th").forEach((th, idx) => {
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

    // Remove commas commonly used in large numbers
    s = s.replace(/,/g, "");

    // Percentage?
    if (/^\d+(\.\d+)?%$/.test(s)) {
      const num = parseFloat(s.replace("%", ""));
      return { num, text: s };
    }

    // Pure number?
    const n = Number(s);
    if (!isNaN(n)) return { num: n, text: s };

    // Fallback → treat as text only
    return { num: NaN, text: s.toLowerCase() };
  }

  // RENDER helpers
  function makeBtn(label, page, opts = {}) {
    const b = document.createElement("button");
    b.textContent = label;
    if (opts.disabled) b.disabled = true;
    if (opts.active) b.classList.add("active");
    b.onclick = () => {
      if (opts.disabled) return;
      state.page = page;
      renderPage();
    };
    return b;
  }

  function getCenteredPages(current, total, windowSize) {
    if (total <= windowSize) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const half = Math.floor(windowSize / 2);
    let start = current - half;
    let end = current + half;

    if (start < 2) {
      start = 2;
      end = windowSize;
    }

    if (end > total - 1) {
      end = total - 1;
      start = total - windowSize + 1;
    }

    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  function renderPager(totalPages) {
    pager.innerHTML = "";

    // Navigation buttons
    pager.appendChild(makeBtn("<<", 1, { disabled: state.page === 1 }));
    pager.appendChild(
      makeBtn("<", Math.max(1, state.page - 1), { disabled: state.page === 1 })
    );

    const current = state.page;

    // Determine 5-page window around current
    const windowSize = 3; // change this to adjust button count

    // Always show page 1
    pager.appendChild(makeBtn("1", 1, { active: current === 1 }));

    // Ellipsis after 1
    if (current > Math.ceil(windowSize / 2) + 1) {
      const ell = document.createElement("span");
      ell.textContent = "...";
      ell.className = "ell";
      pager.appendChild(ell);
    }

    // Centered page window
    const pages = getCenteredPages(current, totalPages, windowSize);
    pages.forEach((p) => {
      if (p !== 1 && p !== totalPages) {
        pager.appendChild(makeBtn(p, p, { active: current === p }));
      }
    });

    // Ellipsis before last page
    if (current < totalPages - Math.ceil(windowSize / 2)) {
      const ell = document.createElement("span");
      ell.textContent = "...";
      ell.className = "ell";
      pager.appendChild(ell);
    }

    // Always show last page
    if (totalPages > 1) {
      pager.appendChild(
        makeBtn(totalPages, totalPages, { active: current === totalPages })
      );
    }

    // Next / Last
    pager.appendChild(
      makeBtn(">", Math.min(totalPages, current + 1), {
        disabled: current === totalPages,
      })
    );
    pager.appendChild(
      makeBtn(">>", totalPages, { disabled: current === totalPages })
    );
  }

  function renderPage() {
    const prevSelectedId = tbody.querySelector(".selected")?.dataset?.id;
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
      if (row) row.classList.add("selected");
    }

    infoBox.textContent =
      total === 0 ? "No entries" : `Showing ${start + 1}–${end} of ${total}`;
    renderPager(totalPages);
  }

  state.filteredRows = rows.slice();
  renderPage();
}

/* CLICK EVENTS (preserve selection & update charts) */
function addRowClickEvents() {
  const tbody = qs("#data-table tbody");
  if (!tbody) return;
  tbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;

    tbody.querySelector(".selected")?.classList.remove("selected");
    row.classList.add("selected");

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
    const sum = rows.reduce(
      (acc, r) => acc + (diffsCache[r[0]]?.[col] || 0),
      0
    );
    const box = document.createElement("div");
    box.className = "stat-box";
    box.innerHTML = `<h3>${label}</h3><p>${sum.toLocaleString()}</p>`;
    container.appendChild(box);
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

/* INITIALIZATION */
document.addEventListener("DOMContentLoaded", async () => {
  // apply stored theme BEFORE anything else
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    qs("#toggle-theme").checked = true;
  }

  initCharts();

  qs("#loading-overlay").style.display = "flex";

  try {
    if (CONFIG.source === "google") {
      await loadGoogleSheets();
      const sheet = googleSheetNames.at(-1);
      renderTable(googleSheetsData[sheet][0], googleSheetsData[sheet].slice(1));
    }
  } catch (e) {
    alert("Google Sheets load error:\n" + e.message);
    console.error(e);
  } finally {
    qs("#loading-overlay").style.display = "none";
  }
});

/* THEME TOGGLE */
qs("#toggle-theme").addEventListener("change", (e) => {
  document.body.classList.toggle("dark", e.target.checked);
  localStorage.setItem("theme", e.target.checked ? "dark" : "light");

  const styles = getChartStyles();
  Object.values(charts).forEach((chart) => {
    chart.options.plugins.legend.labels.color = styles.text;
    chart.options.scales.x.ticks.color = styles.text;
    chart.options.scales.y.ticks.color = styles.text;
    chart.options.scales.x.grid.color = styles.grid;
    chart.options.scales.y.grid.color = styles.grid;

    chart.data.datasets[0].borderColor = styles.line;
    chart.data.datasets[0].backgroundColor = styles.line + "33";

    chart.update();
  });
});
