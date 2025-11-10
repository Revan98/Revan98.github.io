const CONFIG = {
  source: "google",
  googleSheetUrl: "https://docs.google.com/spreadsheets/d/1Cdzv5wgPdczAvQwgpyO0CqjPbkzAjLDd8Uu4HHcoiFU/edit?usp=sharing",
};

const API_KEY = "AIzaSyAPP27INsgILZBAigyOm-g31djFgYlU7VY";

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
function renderTableFiltered(headers, rows) {
  rows = removeEmptyRows(rows);
  rows = rows.filter(r => String(r[11]).trim().toUpperCase() !== "YES"); // optional governor filter

  // Destroy old table if exists
  if (dataTableInstance) {
    dataTableInstance.destroy();
    dataTableInstance = null;
  }

  const table = document.getElementById("data-table");
  table.innerHTML = "";

  // Build headers dynamically from sheet
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const indexTh = document.createElement("th");
  indexTh.textContent = "#";
  headRow.appendChild(indexTh);

  headers.forEach(h => {
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

    headers.forEach((_, colIdx) => {
      const td = document.createElement("td");
      const rawVal = row[colIdx] ?? "";
      const val = parseFloat(rawVal);
      td.textContent = isNaN(val) ? rawVal : formatNumber(val);
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
    language: { searchPlaceholder: "Search by name or ID", search: "" },
    layout: {
      topStart: {
        buttons: ["csv", "excel"]
      },
      bottomStart: {
        pageLength: { menu: [20, 40, 60, 80, 100] }
      }
    }
  });
}

// --- Data Loading ---
async function loadGoogleSheets() {
  const match = CONFIG.googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return alert("Invalid Google Sheets URL");
  googleSheetId = match[1];

  // Step A: Fetch sheet metadata (names only)
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${googleSheetId}?key=${API_KEY}`
  );
  if (!metaRes.ok) throw new Error("Google Sheets API error");
  const meta = await metaRes.json();
  if (!meta.sheets) throw new Error("No sheets found or access denied.");

  googleSheetNames = meta.sheets.map(s => s.properties.title);
  currentSource = "google";

  // Step B: populate dropdown
  const selector = document.getElementById("sheet-selector");
  selector.innerHTML = "";
  googleSheetNames.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    selector.appendChild(opt);
  });

  // Step C: don't load any sheet yet — wait for user to pick
  document.getElementById("data-table").innerHTML =
    "<p style='text-align:center;margin-top:30px;'>Select a worksheet to display data.</p>";
}

  // load all sheets in parallel
  await Promise.all(
    googleSheetNames.map(async name => {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${googleSheetId}/values/${encodeURIComponent(name)}?key=${API_KEY}`
      );
      if (!res.ok) throw new Error("Error fetching sheet: " + name);
      const data = await res.json();
      googleSheetsData[name] = data.values || [];
    })
  );

  // show the latest (last) by default
  const lastSheet = googleSheetNames[googleSheetNames.length - 1];
  selector.value = lastSheet;
  renderCurrentSheet(lastSheet);
}

function renderCurrentSheet(sheetName) {
  const data = googleSheetsData[sheetName];
  if (!data || !data.length) {
    document.getElementById("data-table").innerHTML = "<p>No data found in this sheet.</p>";
    return;
  }
  const headers = data[0];
  const rows = data.slice(1);
  renderTableFiltered(headers, rows);
}

async function loadSheetByName(sheetName) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${googleSheetId}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`
  );
  if (!res.ok) throw new Error(`Error fetching ${sheetName}: ${res.statusText}`);
  const data = await res.json();
  googleSheetsData[sheetName] = data.values || [];
  renderCurrentSheet(sheetName);
}



// --- Sheet Selector Change ---
document.getElementById("sheet-selector").addEventListener("change", async e => {
  const overlay = document.getElementById("loading-overlay");
  overlay.style.display = "flex";
  try {
    await loadSheetByName(e.target.value);
  } catch (err) {
    alert("Error loading selected sheet: " + err.message);
  } finally {
    overlay.style.display = "none";
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
  }

  document.getElementById("loading-overlay").style.display = "flex";
  try {
    if (CONFIG.source === "google") {
      await loadGoogleSheets(); // loads only sheet names
    }
  } catch (err) {
    alert("Failed to load Google Sheets metadata.\n\n" + err.message);
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
