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

/* -------------------------
   SOURCE SELECTOR
   ------------------------- */
const sourceSelector = qs("#source-selector");

function populateSourceSelector() {
  CONFIG.sources.forEach((src, index) => {
    const opt = document.createElement("option");
    opt.value = src.id;
    opt.textContent = src.name;
    if (index === 0) opt.selected = true;
    sourceSelector.appendChild(opt);
  });
}

function getSelectedSource() {
  const id = sourceSelector.value;
  return CONFIG.sources.find((s) => s.id === id);
}

/* Extract sheet ID from Google URL */
function extractSheetId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/* Load all sheets into RAM */
async function loadAllSheetsCache() {
  const source = getSelectedSource();
  const SPREADSHEET_ID = extractSheetId(source.sheetUrl);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();

  SheetCache.sheetsList = json.sheets.map((s) => s.properties.title);
  SheetCache.sheetsData = {};
  SheetCache.lastSheetData = null;

  const lastSheet = SheetCache.sheetsList.at(-1);

  for (const sheetName of SheetCache.sheetsList) {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?key=${API_KEY}`;
    const resSheet = await fetch(sheetUrl);
    const sheetJson = await resSheet.json();

    if (!sheetJson.values) continue;

    const headers = sheetJson.values[0];
    const rows = sheetJson.values.slice(1);

    SheetCache.sheetsData[sheetName] = { headers, rows };

    if (sheetName === lastSheet) {
      SheetCache.lastSheetData = { headers, rows };
    }
  }
}

/* Number formatter */
function formatNumber(val) {
  if (!val || isNaN(val)) return val;
  return Number(val).toLocaleString("en-US");
}

/* Load DataTable from cache */
/* -------------------------
   AG GRID STATE
   ------------------------- */
let gridApi = null;

/* -------------------------
   AG GRID HELPERS
   ------------------------- */
function formatNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : val;
}

function buildColumnDefs(headers) {
  return headers.map((h, idx) => ({
    headerName: h,
    field: h,
    sortable: true,
    filter: false,
    resizable: true,
    valueFormatter: [3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16].includes(idx)
      ? (p) => formatNumber(p.value)
      : undefined,
  }));
}

/* -------------------------
   LOAD GRID FROM CACHE
   ------------------------- */
function loadAgGridFromCache() {
  const gridDiv = document.querySelector("#myGrid");

  if (!SheetCache.lastSheetData) return;

  // Filter rows (Vacation = YES in column index 10)
  const rows = SheetCache.lastSheetData.rows.map((r) => {
    const obj = {};
    SheetCache.lastSheetData.headers.forEach((h, i) => {
      obj[h] = r[i] ?? "";
    });
    return obj;
  });

  const columnDefs = buildColumnDefs(SheetCache.lastSheetData.headers);

  if (gridApi) {
    gridApi.destroy();
    gridApi = null;
    gridDiv.innerHTML = "";
  }

  const gridOptions = {
    columnDefs,
    rowData: rows,

    rowHeight: 42,
    animateRows: true,

    pagination: true,
    paginationPageSize: 50,

    defaultColDef: {
      sortable: true,
      filter: false,
      resizable: true,
      minWidth: 100,
    },

    // Modern AG Grid sizing (v35)
    autoSizeStrategy: {
      type: "fitCellContents",
    },
  };

  gridApi = agGrid.createGrid(gridDiv, gridOptions);
}
function onFilterTextBoxChanged() {
  const input = document.getElementById("quickFilter");
  gridApi.setGridOption("quickFilterText", input.value);
}

function showLoading() {
  document.getElementById("loading-spinner").style.display = "flex";
}

function hideLoading() {
  document.getElementById("loading-spinner").style.display = "none";
}

/* -------------------------
   INITIALIZATION
   ------------------------- */

populateSourceSelector();

async function init() {
  showLoading();

  await loadAllSheetsCache();
  loadAgGridFromCache();

  hideLoading();
}

init();

/* Reload when source changes */
sourceSelector.addEventListener("change", () => {
  init();
});

/* -------------------------
	   THEME HANDLING
	   ------------------------- */
function setTheme(mode) {
  document.body.classList.remove("dark", "light");
  document.body.classList.add(mode);

  // 👇 THIS is the AG Grid integration
  document.body.setAttribute("data-ag-theme-mode", mode);

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
