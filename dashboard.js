/* CONFIGURATION */
const CONFIG = {
  sources: [
    {
      id: "main",
      kd: "2247",
      name: "KD2247",
      sheetUrl:
        "https://docs.google.com/spreadsheets/d/1bP7LMwUuN3gjIEWKo0QCStKmrvIzn9rrYedoaUJh5zg/edit?usp=sharing",
    },
    {
      id: "backup",
      kd: "2552",
      name: "KD2552",
      sheetUrl:
        "https://docs.google.com/spreadsheets/d/1HS6wcMWCzLR4PVhYJA_8rFzUuqaYvwUilD2zffq9YNE/edit?usp=sharing",
    },
  ],
};

const API_KEY = "AIzaSyAPP27INsgILZBAigyOm-g31djFgYlU7VY";

// RAM cache
const SheetCache = {
  sheetsList: [],
  sheetsData: {},
  lastSheetData: null,
};

/* query helper */
const qs = (sel) => document.querySelector(sel);
const themeToggle = qs("#toggle-theme");

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

// Load all sheets into RAM
async function loadAllSheetsCache() {
  const source = getSelectedSource();

  if (!source) {
    alert("Invalid or missing KD parameter.");
    return;
  }

  const SPREADSHEET_ID = extractSheetId(source.sheetUrl);
  const API_KEY = "AIzaSyBXiXdttKmf_Ma3ghSNcFoHN9DnaXET2VU";

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();

  SheetCache.sheetsList = json.sheets.map((s) => s.properties.title);
  const lastSheet = SheetCache.sheetsList.at(-1);

  for (const sheetName of SheetCache.sheetsList) {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?key=${API_KEY}`;
    const resSheet = await fetch(sheetUrl);
    const sheetJson = await resSheet.json();

    if (!sheetJson.values) continue;

    const headers = sheetJson.values[0];
    const rows = sheetJson.values.slice(1);

    SheetCache.sheetsData[sheetName] = { headers, rows };

    if (sheetName === lastSheet) SheetCache.lastSheetData = { headers, rows };
  }
}

function formatNumber(val) {
  if (val === undefined || val === null || val === "") return val;
  if (isNaN(val)) return val;
  return Number(val).toLocaleString("en-US", { minimumFractionDigits: 0 });
}

// Initialize DataTable from last sheet
function loadDataTableFromCache() {
  const rows = SheetCache.lastSheetData.rows.filter(
    (r) => String(r[10]).trim().toUpperCase() !== "YES"
  );

  new DataTable("#myTable", {
    data: rows,
    columns: [
      { title: "ID", data: 0 },
      { title: "Name", data: 1 },
      { title: "Power", data: 2 },
      { title: "T4", data: 12 },
      { title: "T5", data: 13 },
      { title: "Killpoints", data: 14 },
      { title: "Deads", data: 15 },
      { title: "Min DKP", data: 7 },
      { title: "DKP", data: 8 },
      { title: "DKP%", data: 9 },
      { title: "Col 3", data: 3 },
      { title: "Col 4", data: 4 },
      { title: "Col 5", data: 5 },
      { title: "Col 6", data: 6 },
      { title: "Col 10", data: 10 },
      { title: "Col 11", data: 11 },
      { title: "Power2", data: 16 },
    ],
    order: [],
    info: true,
    paging: true,
    scrollCollapse: true,
    scrollX: true,
    scrollY: "550px",
    pageLength: 50,
    language: {
      lengthLabels: { "-1": "Show all" },

      // REMOVE "Search:" label
      search: "",

      // ADD PLACEHOLDER INSIDE SEARCH BOX
      searchPlaceholder: "Search players...",
    },
    lengthMenu: [10, 25, 50, -1],
    columnDefs: [
      { targets: [10, 11, 12, 13, 14, 15, 16], visible: false },
      {
        targets: 2,
        render: {
          display: (data, type, row) => {
            const value = Number(data) || 0;
            const diff = Number(row[16]) || 0;
            const diffClass = diff >= 0 ? "positive" : "negative";

            return `
                            <div class="cell-value">${formatNumber(value)}</div>
                            <div class="cell-diff ${diffClass}">
                                ${diff >= 0 ? "+" : ""}${formatNumber(diff)}
                            </div>
                        `;
          },
          sort: (data) => Number(data),
        },
      },
      {
        targets: 3,
        render: {
          display: (data, type, row) => {
            const value = Number(data) || 0;
            const diff = Number(row[3]) || 0;
            const diffClass = diff >= 0 ? "positive" : "negative";

            return `
                            <div class="cell-value">${formatNumber(value)}</div>
                            <div class="cell-diff ${diffClass}">
                                ${diff >= 0 ? "+" : ""}${formatNumber(diff)}
                            </div>
                        `;
          },
          sort: (data) => Number(data),
        },
      },
      {
        targets: 4,
        render: {
          display: (data, type, row) => {
            const value = Number(data) || 0;
            const diff = Number(row[4]) || 0;
            const diffClass = diff >= 0 ? "positive" : "negative";

            return `
                            <div class="cell-value">${formatNumber(value)}</div>
                            <div class="cell-diff ${diffClass}">
                                ${diff >= 0 ? "+" : ""}${formatNumber(diff)}
                            </div>
                        `;
          },
          sort: (data) => Number(data),
        },
      },
      {
        targets: 5,
        render: {
          display: (data, type, row) => {
            const value = Number(data) || 0;
            const diff = Number(row[5]) || 0;
            const diffClass = diff >= 0 ? "positive" : "negative";

            return `
                            <div class="cell-value">${formatNumber(value)}</div>
                            <div class="cell-diff ${diffClass}">
                                ${diff >= 0 ? "+" : ""}${formatNumber(diff)}
                            </div>
                        `;
          },
          sort: (data) => Number(data),
        },
      },
      {
        targets: 6,
        render: {
          display: (data, type, row) => {
            const value = Number(data) || 0;
            const diff = Number(row[6]) || 0;
            const diffClass = diff >= 0 ? "positive" : "negative";

            return `
                            <div class="cell-value">${formatNumber(value)}</div>
                            <div class="cell-diff ${diffClass}">
                                ${diff >= 0 ? "+" : ""}${formatNumber(diff)}
                            </div>
                        `;
          },
          sort: (data) => Number(data),
        },
      },
      {
        targets: 0,
        render: (data, type, row) => `
                <span class="gov-link" data-id="${data}">
                    ${data}
                    <span class="gov-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                            <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/>
                            <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/>
                        </svg>
                    </span>
                </span>`,
      },

      // Generic numeric columns — except index 0
      {
        targets: [3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16],
        render: (data) => formatNumber(data),
      },
    ],
  });
}

/* ----------------
   MODAL CHART
------------------- */
let modalChart = null;
let selectedGovernorId = null;
let currentColIndex = 16; // default is Power Diff
let _documentClickListenerAdded = false;

// Get governor name from last sheet
function getGovernorName(id) {
  const rows = SheetCache.lastSheetData?.rows || [];
  const found = rows.find((r) => `${r[0]}` === `${id}`);
  return found ? found[1] : id;
}

// Chart theme
function getChartStyles() {
  const css = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();
  const line = css("--chart-line") || "#007bff";

  return {
    text: css("--chart-text") || "#fff",
    dataset: {
      borderColor: line,
      backgroundColor: line + "33",
      tension: 0.3,
    },
  };
}

// Open modal
function openChartModal(governorId) {
  selectedGovernorId = governorId;

  const modal = document.querySelector("#chart-modal");
  const title = document.querySelector("#modal-title");

  const name = getGovernorName(governorId);
  title.textContent = `${name} (ID: ${governorId})`;

  modal.classList.remove("hidden");

  // Destroy old chart if exists
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }

  const ctx = document.querySelector("#modal-chart").getContext("2d");
  const styles = getChartStyles();

  modalChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{ label: "", data: [], ...styles.dataset }],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: styles.text } } },
      scales: {
        x: { ticks: { color: styles.text } },
        y: { ticks: { color: styles.text } },
      },
    },
  });

  updateModalChart(currentColIndex);
}

// Update chart for selected governor + metric
function updateModalChart(colIndex) {
  if (!modalChart) return;
  currentColIndex = colIndex;

  const sheets = SheetCache.sheetsList;
  const values = [];

  for (const sheetName of sheets) {
    const sheet = SheetCache.sheetsData[sheetName];
    if (!sheet) {
      values.push(0);
      continue;
    }

    const row = sheet.rows.find((r) => `${r[0]}` === `${selectedGovernorId}`);
    values.push(row ? Number(row[colIndex] || 0) : 0);
  }

  const labelMap = {
    16: "Power Diff",
    4: "T4 Kills",
    5: "T5 Kills",
    3: "Kill Points",
    6: "Deads",
  };

  modalChart.data.labels = sheets;
  modalChart.data.datasets[0].data = values;
  modalChart.data.datasets[0].label = labelMap[colIndex] || `Col ${colIndex}`;
  modalChart.update();
}

/* ------------------------------------------------------
   CLICK EVENTS (open modal when clicking ID)
--------------------------------------------------------- */
function addRowClickEventsOnce() {
  if (_documentClickListenerAdded) return;
  _documentClickListenerAdded = true;

  document.addEventListener("click", (e) => {
    const link = e.target.closest(".gov-link");
    if (!link) return;

    const id = link.dataset.id;
    if (id) openChartModal(id);
  });
}

// Initialize after table loads
setTimeout(addRowClickEventsOnce, 500);

/* ------------------------------------------------------
   CLOSE MODAL + SWITCH METRIC BUTTONS
--------------------------------------------------------- */
const closeModalBtn = document.querySelector("#close-modal");
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () =>
    document.querySelector("#chart-modal").classList.add("hidden")
  );
}

document.querySelectorAll(".chart-buttons button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const col = Number(btn.dataset.col);
    if (!isNaN(col)) updateModalChart(col);
  });
});

// Initialize everything
loadAllSheetsCache().then(() => {
  // Show spinner
  const spinner = document.getElementById("loading-spinner");
  loadDataTableFromCache();

  // Filter out rows where column 10 == "YES"
  const rows = SheetCache.lastSheetData.rows.filter(
    (r) => String(r[10]).trim().toUpperCase() !== "YES"
  );

  // Top 3 players by DKP (Column 8)
  const sortedByDKP = [...rows]
    .sort((a, b) => Number(b[8]) - Number(a[8])) // Sort by DKP column
    .slice(0, 3); // Top 3

  renderTopPlayers(sortedByDKP); // Render top players

  renderTotals(rows); // Render total statistics
  // Hide spinner
  spinner.style.display = "none";
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
    { label: "Total T4 kills", col: 12 },
    { label: "Total T5 kills", col: 13 },
    { label: "Total Deads", col: 15 },
    { label: "Total KP", col: 14 },
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
/* -------------------------
   THEME HANDLING
   ------------------------- */
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

document.addEventListener("DOMContentLoaded", () => {
  const current = location.pathname.split("/").pop(); // e.g. "index.html"

  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
});
