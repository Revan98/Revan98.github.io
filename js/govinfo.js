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

/* -------------------------
   SOURCE SELECTOR
   ------------------------- */
const sourceSelector = document.querySelector("#source-selector");

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
let gridApi = null;

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
    theme: agGrid.themeQuartz,
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
const THEME_KEY = "theme";
const themeToggle = document.getElementById("toggle-theme");

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);

  document.body.setAttribute("data-ag-theme-mode", theme);

  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved === "dark" ? "dark" : "light";

  applyTheme(theme);
  themeToggle.checked = theme === "dark";
}

themeToggle.addEventListener("change", () => {
  applyTheme(themeToggle.checked ? "dark" : "light");
});

initTheme();

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
