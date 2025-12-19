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
   NEW: SOURCE SELECTOR
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
let tableInstance = null;

function loadDataTableFromCache() {
  if (tableInstance) {
    tableInstance.destroy();
    document.querySelector("#myTable").innerHTML = "";
  }

  const rows = SheetCache.lastSheetData.rows.filter(
    (r) => String(r[10]).trim().toUpperCase() !== "YES"
  );

  tableInstance = new DataTable("#myTable", {
    data: rows,
    columns: SheetCache.lastSheetData.headers.map(h => ({ title: h })),
    order: [],
    paging: true,
    scrollCollapse: true,
    scrollX: true,
    scrollY: "550px",
    pageLength: 50,
    language: {
      search: "",
      searchPlaceholder: "Search players...",
    },
    lengthMenu: [10, 25, 50, -1],
    columnDefs: [
      {
        targets: [3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16],
        render: (data) => formatNumber(data),
      },
    ],
  });
}
function showLoading() {
  document.getElementById("loading-spinner").style.display = "flex";

  const wrapper = document.querySelector(".dt-container");
  if (wrapper) wrapper.style.display = "none";
}

function hideLoading() {
  document.getElementById("loading-spinner").style.display = "none";

  const wrapper = document.querySelector(".dt-container");
  if (wrapper) wrapper.style.display = "block";
}

/* -------------------------
   INITIALIZATION
   ------------------------- */

populateSourceSelector();

async function init() {
  showLoading();

  await loadAllSheetsCache();
  loadDataTableFromCache();

  hideLoading();
}

init();

/* Reload when source changes */
sourceSelector.addEventListener("change", () => {
  init();
});

/* -------------------------
   THEME HANDLING (unchanged)
   ------------------------- */
function setTheme(mode) {
  document.body.classList.remove("dark", "light");
  document.body.classList.add(mode);
  localStorage.setItem("theme", mode);
}

function initializeTheme(toggleEl) {
  const saved = localStorage.getItem("theme");
  if (saved) setTheme(saved);
  else {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }
  if (toggleEl) toggleEl.checked = document.body.classList.contains("dark");
}

initializeTheme(themeToggle);

themeToggle?.addEventListener("change", (e) =>
  setTheme(e.target.checked ? "dark" : "light")
);

/* Navigation */
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");

hamburger?.addEventListener("click", () => navLinks.classList.toggle("show"));

document.addEventListener("DOMContentLoaded", () => {
  const current = location.pathname.split("/").pop();
  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
});
