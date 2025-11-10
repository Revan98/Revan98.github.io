const CONFIG = {
  source: "google",
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/1Cdzv5wgPdczAvQwgpyO0CqjPbkzAjLDd8Uu4HHcoiFU/edit?usp=sharing",
};

const API_KEY = "AIzaSyAPP27INsgILZBAigyOm-g31djFgYlU7VY";
const selectedColumns = [0,1,2,3,4,5,6,7,8,9,10,11,12,13];

let dataTableInstance = null;
let googleSheetId = null;
let googleSheetNames = [];
let googleSheetsData = {};
let currentSource = null;

// --- Helpers ---
function removeEmptyRows(rows) {
  return rows.filter(row => row.some(cell => cell && String(cell).trim() !== ""));
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "";
  return Number(num).toLocaleString("en-US");
}

// --- Core Table Rendering ---
function renderTableFiltered(headers, rows, selectedCols) {
  rows = removeEmptyRows(rows);
  rows = rows.filter(r => String(r[11]).trim().toUpperCase() !== "YES"); // filter out governors

  // Destroy old table if exists
  if (dataTableInstance) {
    dataTableInstance.destroy();
    dataTableInstance = null;
  }

  const table = document.getElementById("data-table");
  table.innerHTML = "";

  // Headers
  const filteredHeaders = selectedCols.map(i => headers[i] ?? "");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const indexTh = document.createElement("th");
  indexTh.textContent = "#";
  headRow.appendChild(indexTh);
  filteredHeaders.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h ?? "";
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  // Body
  const tbody = document.createElement("tbody");

  rows.forEach((row, rowIdx) => {
    const tr = document.createElement("tr");

    const indexTd = document.createElement("td");
    indexTd.textContent = rowIdx + 1;
    tr.appendChild(indexTd);

    selectedCols.forEach(colIndex => {
      const td = document.createElement("td");
      let rawVal = row[colIndex];
      let val = isNaN(parseFloat(rawVal)) ? rawVal : parseFloat(rawVal);
      const shortenableCols = [2, 8, 12, 13, 14, 15];
      let displayVal;

      if (colIndex === 0) {
        displayVal = String(rawVal);
      } else if (shortenableCols.includes(colIndex)) {
        displayVal = formatNumber(val);
      } else if (typeof rawVal === "string") {
        displayVal = rawVal;
      } else {
        displayVal = val.toLocaleString("en-US").replace(/\s/g, "");
      }

      td.textContent = displayVal;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  // Initialize DataTable
  dataTableInstance = new DataTable("#data-table", {
    paging: true,
    scrollY: "50vh",
    scrollX: "100%",
    scrollCollapse: true,
    order: [],
    searching: true,
    info: false,
    autoWidth: true,
    pageLength: 20,
    columnDefs: [
      { orderable: false, searchable: false, targets: 0 },
      { targets: [11,12,13,14], visible: false }
    ],
    language: { searchPlaceholder: "Search by name or ID", search: "" },
    layout: {
      topStart: {
        buttons: ["csv", "excel", "colvis"]
      },
      bottomStart: {
        pageLength: { menu: [20, 40, 60, 80, 100] }
      }
    }
  });

  // Column visibility persistence
  const savedVisibility = JSON.parse(localStorage.getItem("colVisibility") || "{}");
  Object.keys(savedVisibility).forEach(idx => {
    dataTableInstance.column(idx).visible(savedVisibility[idx]);
  });

  dataTableInstance.on("column-visibility.dt", function (e, settings, column, state) {
    const vis = JSON.parse(localStorage.getItem("colVisibility") || "{}");
    vis[column] = state;
    localStorage.setItem("colVisibility", JSON.stringify(vis));
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
  }
  initCharts();
  document.getElementById("loading-overlay").style.display = "flex";
  try {
     if (CONFIG.source === "google") {
       resetCharts();
       const match = CONFIG.googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
       if (!match) return alert("Invalid Google Sheets URL");
       googleSheetId = match[1];
       try {
         const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${googleSheetId}?key=${API_KEY}`);
         if (!metaRes.ok) throw new Error("Google Sheets API error");
         const meta = await metaRes.json();
         if (!meta.sheets) throw new Error("No sheets found or access denied.");
      
         googleSheetNames = meta.sheets.map(s => s.properties.title);
         currentSource = "google";
         googleSheetsData = {};
         await Promise.all(
           googleSheetNames.map(async name => {
             const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${googleSheetId}/values/${encodeURIComponent(name)}?key=${API_KEY}`);
             if (!res.ok) throw new Error("Error fetching sheet: " + name);
             const data = await res.json();
             googleSheetsData[name] = data.values || [];
           })
         );
      
         const firstSheet = googleSheetNames[googleSheetNames.length - 1];
         renderTableFiltered(googleSheetsData[firstSheet][0], googleSheetsData[firstSheet].slice(1), selectedColumns);
       } catch (err) {
         alert("Failed to load Google Sheets data. Please check API key or sharing settings.\n\n" + err.message);
       }
     }
   } finally {
     document.getElementById("loading-overlay").style.display = "none";
   }
});

// --- Theme Toggle ---
const themeToggle = document.getElementById("toggle-theme");
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  themeToggle.checked = true;
}

themeToggle.addEventListener("change", () => {
  document.body.classList.toggle("dark", themeToggle.checked);
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
});

// --- Mobile Nav ---
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
hamburger.addEventListener("click", () => navLinks.classList.toggle("show"));
