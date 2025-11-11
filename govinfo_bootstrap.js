// =========================================================
// GOVINFO_BOOTSTRAP.JS — Bootstrap 5 integrated version
// =========================================================
const CONFIG = {
  sources: [
    {
      name: "KD3202",
      url: "https://docs.google.com/spreadsheets/d/1v9mdsOKtcypKClOvxIyrslXvGUsvVg_C6x7tHyv7N38/edit?usp=sharing",
    },
    {
      name: "KD2247",
      url: "https://docs.google.com/spreadsheets/d/1Cdzv5wgPdczAvQwgpyO0CqjPbkzAjLDd8Uu4HHcoiFU/edit?usp=sharing",
    },
  ],
};
const API_KEY = "AIzaSyAPP27INsgILZBAigyOm-g31djFgYlU7VY";

let dataTableInstance = null;
let googleSheetsData = {};
let currentSource = null;
let googleSheetId = null;
let googleSheetNames = [];
let sourceCache = {};

// Helpers
function removeEmptyRows(rows) {
  return rows.filter((row) => row.some((cell) => cell && String(cell).trim() !== ""));
}
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "";
  return Number(num).toLocaleString("en-US");
}

// Core rendering
function renderTableFiltered(headers, rows) {
  rows = removeEmptyRows(rows);
  rows = rows.filter((r) => String(r[11]).trim().toUpperCase() !== "YES");

  if (dataTableInstance) {
    dataTableInstance.destroy();
    dataTableInstance = null;
  }

  const table = document.getElementById("data-table");
  table.innerHTML = "";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const indexTh = document.createElement("th");
  indexTh.textContent = "#";
  headRow.appendChild(indexTh);
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h ?? "";
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  rows.forEach((row, i) => {
    const tr = document.createElement("tr");
    const indexTd = document.createElement("td");
    indexTd.textContent = i + 1;
    tr.appendChild(indexTd);
    headers.forEach((_, colIdx) => {
      const td = document.createElement("td");
      const rawVal = row[colIdx] ?? "";
      if (colIdx > 1) {
        const val = parseFloat(rawVal);
        td.textContent = isNaN(val) ? rawVal : formatNumber(val);
      } else {
        td.textContent = rawVal;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  dataTableInstance = new DataTable("#data-table", {
    paging: true,
    scrollY: "50vh",
    scrollX: true,
    order: [],
    searching: true,
    info: false,
    pageLength: 20,
    language: { searchPlaceholder: "Search...", search: "" },
    layout: {
      topStart: { buttons: ["csv", "excel"] },
      bottomStart: { pageLength: { menu: [20, 40, 60, 80, 100] } },
    },
  });
  // Apply Bootstrap button classes to export buttons
  document.querySelectorAll(".dt-buttons button").forEach(btn => {
    btn.classList.add("btn", "btn-outline-primary", "btn-sm");
  });
}

// Google Sheets loading
async function loadGoogleSheets(sheetUrl) {
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return alert("Invalid Google Sheets URL");
  googleSheetId = match[1];

  if (sourceCache[googleSheetId]) {
    googleSheetNames = sourceCache[googleSheetId];
  } else {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${googleSheetId}?key=${API_KEY}`);
    const meta = await metaRes.json();
    googleSheetNames = meta.sheets.map((s) => s.properties.title);
    sourceCache[googleSheetId] = googleSheetNames;
  }

  currentSource = sheetUrl;
  const selector = document.getElementById("sheet-selector");
  selector.innerHTML = "";
  googleSheetNames.forEach((name, i) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (i === 0) opt.selected = true;
    selector.appendChild(opt);
  });

  if (googleSheetNames.length > 0) {
    const overlay = document.getElementById("loading-overlay");
    overlay.style.display = "flex";
    try {
      await loadSheetByName(googleSheetNames[0]);
    } catch (err) {
      alert("Error loading first worksheet: " + err.message);
    } finally {
      overlay.style.display = "none";
    }
  }
}

async function loadSheetByName(sheetName) {
  const match = currentSource.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = match ? match[1] : googleSheetId;
  const cacheKey = `${sheetId}:${sheetName}`;
  if (googleSheetsData[cacheKey]) return renderCurrentSheet(cacheKey);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`
  );
  const data = await res.json();
  googleSheetsData[cacheKey] = data.values || [];
  renderCurrentSheet(cacheKey);
}

function renderCurrentSheet(cacheKey) {
  const data = googleSheetsData[cacheKey];
  if (!data || !data.length) {
    document.getElementById("data-table").innerHTML = "<p>No data found.</p>";
    return;
  }
  const headers = data[0];
  const rows = data.slice(1);
  renderTableFiltered(headers, rows);
}

// Event listeners
document.addEventListener("DOMContentLoaded", async () => {

  const sourceSelector = document.getElementById("source-selector");
  CONFIG.sources.forEach((src, idx) => {
    const opt = document.createElement("option");
    opt.value = src.url;
    opt.textContent = src.name;
    if (idx === 0) opt.selected = true;
    sourceSelector.appendChild(opt);
  });

  await loadGoogleSheets(CONFIG.sources[0].url);

  document.getElementById("source-selector").addEventListener("change", async (e) => {
    document.getElementById("loading-overlay").style.display = "flex";
    try {
      await loadGoogleSheets(e.target.value);
    } finally {
      document.getElementById("loading-overlay").style.display = "none";
    }
  });

  document.getElementById("sheet-selector").addEventListener("change", async (e) => {
    document.getElementById("loading-overlay").style.display = "flex";
    try {
      await loadSheetByName(e.target.value);
    } finally {
      document.getElementById("loading-overlay").style.display = "none";
    }
  });
});

// Theme toggle using Bootstrap color modes
const toggle = document.getElementById("toggle-theme");
const savedTheme = localStorage.getItem("theme") || "light";
document.body.setAttribute("data-bs-theme", savedTheme);
toggle.checked = savedTheme === "dark";

toggle.addEventListener("change", () => {
  const theme = toggle.checked ? "dark" : "light";
  document.body.setAttribute("data-bs-theme", theme);
  localStorage.setItem("theme", theme);
});
