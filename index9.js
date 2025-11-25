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
  const table = qs("#data-table");
  table.innerHTML = "";

  // HEADER
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");

  const indexTh = document.createElement("th");
  indexTh.textContent = "#";
  tr.appendChild(indexTh);

  SELECTED_COLS.forEach((i) => {
    const th = document.createElement("th");

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

  // BODY
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

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "4px";

  const raw = row[col];
  const numeric = +raw;

  const text = document.createElement("div");
  text.style.fontWeight = "500";
  text.style.fontSize = "13px";
  text.textContent =
    col === 0
      ? raw
      : SHORT_NUMBER_COLS.includes(col)
      ? formatNumber(numeric)
      : raw;
  wrapper.appendChild(text);

  if (DIFF_COLS.includes(col)) {
    const diff = getDiff(id, col);
    if (diff !== 0) {
      const diffBox = document.createElement("div");
      diffBox.className = `diff-box ${
        diff > 0 ? "diff-positive" : "diff-negative"
      }`;
      diffBox.textContent = `${diff > 0 ? "+" : ""}${formatNumber(diff)}`;
      wrapper.appendChild(diffBox);
    }
  }

  if (PROGRESS_COLS.includes(col)) {
    const barContainer = document.createElement("div");
    barContainer.style.width = "80%";
    barContainer.style.height = "6px";
    barContainer.style.borderRadius = "4px";
    barContainer.style.marginTop = "3px";

    const isDark = document.body.classList.contains("dark");
    barContainer.style.background = isDark
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.06)";

    const bar = document.createElement("div");
    bar.style.height = "100%";
    bar.style.borderRadius = "4px";

    const colors = {
      12: "#00bcd4",
      13: "#ffc107",
      14: "#e91e63",
      15: "#f44336",
      8: "#4caf50",
    };
    bar.style.background = colors[col] || "#2196f3";
    bar.style.width = maxVal > 0 ? `${(numeric / maxVal) * 100}%` : "0%";

    barContainer.appendChild(bar);
    wrapper.appendChild(barContainer);
  }

  td.appendChild(wrapper);

  td.dataset.value = !isNaN(numeric) ? numeric : raw || "";

  return td;
}

/* INFINITE SCROLL DATA TABLE */
function activateDataTable() {
  const table = qs("#data-table");
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const allRows = [...tbody.querySelectorAll("tr")];
  const scrollContainer = qs(".table-container");

  const state = table.__dtState || {
    filteredRows: allRows.slice(),
    renderedCount: 0,
    batchSize: 20,
    currentSort: { col: null, dir: 1 },
  };
  table.__dtState = state;

  const searchInput = qs(".dt-controls .dt-search");
  const infoBox = qs(".dt-info");

  /* SEARCH */
  searchInput.oninput = () => {
    const q = searchInput.value.toLowerCase().trim();
    state.filteredRows = allRows.filter((r) =>
      r.textContent.toLowerCase().includes(q)
    );
    state.renderedCount = 0;
    renderNextBatch();
    updateInfo();
  };

  /* SORT */
  table.querySelectorAll("thead th").forEach((th, colIndex) => {
    if (colIndex === 0) return;

    th.style.cursor = "pointer";

    th.onclick = () => {
      if (state.currentSort.col === colIndex) {
        state.currentSort.dir *= -1;
      } else {
        state.currentSort = { col: colIndex, dir: 1 };
      }

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

      state.renderedCount = 0;
      renderNextBatch();
      updateInfo();
    };
  });

  /* RENDER BATCH */
  function renderNextBatch() {
    const end = Math.min(
      state.filteredRows.length,
      state.renderedCount + state.batchSize
    );

    if (state.renderedCount === 0) tbody.innerHTML = "";

    const slice = state.filteredRows.slice(state.renderedCount, end);
    slice.forEach((r) => tbody.appendChild(r));

    state.renderedCount = end;
  }

  /* INFINITE SCROLL */
  if (!scrollContainer.__scrollBound) {
    scrollContainer.__scrollBound = true;

    scrollContainer.addEventListener("scroll", () => {
      if (
        scrollContainer.scrollTop + scrollContainer.clientHeight >=
        scrollContainer.scrollHeight - 10
      ) {
        if (state.renderedCount < state.filteredRows.length) {
          renderNextBatch();
          updateInfo();
        }
      }
    });
  }

  function updateInfo() {
    const total = state.filteredRows.length;
    const shown = state.renderedCount;
    infoBox.textContent = `${shown} / ${total} loaded`;
  }

  state.renderedCount = 0;
  renderNextBatch();
  updateInfo();
}

/* CLICK EVENTS */
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
