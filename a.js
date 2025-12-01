/* CONFIGURATION */
const CONFIG = {
  sources: [
    {
      id: "main",
      name: "KD2247",
      url: "https://docs.google.com/spreadsheets/d/1bP7LMwUuN3gjIEWKo0QCStKmrvIzn9rrYedoaUJh5zg/edit?usp=sharing",
    },
    {
      id: "backup",
      name: "KD2552",
      url: "https://docs.google.com/spreadsheets/d/1HS6wcMWCzLR4PVhYJA_8rFzUuqaYvwUilD2zffq9YNE/edit?usp=sharing",
    },
  ],
};

const API_KEY = "AIzaSyAPP27INsgILZBAigyOm-g31djFgYlU7VY";

/* STATE */
let googleSheetId = null;
let googleSheetNames = [];
let googleSheetsData = {};
let currentSource = null;
let sourcesCache = {};
let selectedGovernorId = null;
let _documentClickListenerAdded = false;

/* Simple query helper */
const qs = (sel) => document.querySelector(sel);

/* -------------------------
   UTILS
   ------------------------- */
function formatNumber(num) {
  const n = Number(num);
  return isNaN(n) ? "" : n.toLocaleString("en-US");
}

function cleanRows(rows = []) {
  return rows.filter(
    (r) =>
      Array.isArray(r) && r.some((c) => c !== undefined && `${c}`.trim() !== "")
  );
}

function extractSheetId(url) {
  const match = (url || "").match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/* -------------------------
   GOVERNOR / NAME HELPERS
   ------------------------- */
function getGovernorName(id) {
  const sheet = googleSheetNames.at(-1);
  const rows = googleSheetsData[sheet];
  if (!rows) return id;
  const found = rows.find((r) => `${r[0]}` === `${id}`);
  return found ? found[1] : id;
}

/* -------------------------
   TABLE / UI RENDERING
   ------------------------- */
function renderTable(headers, rawRows) {
  const rows = cleanRows(rawRows);

  // dynamically select ALL columns
  window.SELECTED_COLS = headers.map((_, i) => i);

  // sort by column 3
  rows.sort((a, b) => (Number(b[3]) || 0) - (Number(a[3]) || 0));

  buildTable(headers, rows);
}

function buildTable(headers = [], rows = []) {
  const thead = document.querySelector(".header-table thead");
  const tbody = document.querySelector(".body-table tbody");

  if (!thead || !tbody) return;

  thead.innerHTML = "";
  tbody.innerHTML = "";

  /* -------------------------
      BUILD HEADER
     ------------------------- */
  const trHead = document.createElement("tr");

  // # column
  const indexTh = document.createElement("th");
  indexTh.textContent = "#";
  trHead.appendChild(indexTh);

  // data columns
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

    trHead.appendChild(th);
  });

  thead.appendChild(trHead);

  /* -------------------------
      BUILD BODY
     ------------------------- */
  const maxValues = getMaxValues(rows);

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row[0];

    // row index
    const idxCell = document.createElement("td");
    idxCell.textContent = idx + 1;
    tr.appendChild(idxCell);

    // data cells
    SELECTED_COLS.forEach((col) => {
      tr.appendChild(makeCell(row, col, maxValues[col]));
    });

    tbody.appendChild(tr);
  });

  // Sync column widths after rows are in DOM
  requestAnimationFrame(syncColumnWidths);

  // re-activate datatable (sorting, pagination, etc.)
  activateDataTable();
  addRowClickEventsOnce();
}

function getMaxValues(rows) {
  const max = {};
  SELECTED_COLS.forEach((c) => {
    max[c] = Math.max(...rows.map((r) => Number(r[c]) || 0), 0);
  });
  return max;
}

function makeCell(row, col, maxVal = 0) {
  const td = document.createElement("td");
  const raw = row[col];
  const numeric = Number(raw);

  td.classList.add("cell");
  td.dataset.value = !isNaN(numeric) ? numeric : raw ?? "";

  const valueDiv = document.createElement("div");
  valueDiv.className = "cell-value";

  // shorten all numeric except column index 1
  if (!isNaN(numeric) && col !== 1) {
    valueDiv.textContent = formatNumber(numeric);
  } else {
    valueDiv.textContent = raw ?? "";
  }

  td.appendChild(valueDiv);
  return td;
}

/* -------------------------
   SIMPLE DATATABLE: search / sort / pagination
   ------------------------- */
function activateDataTable() {
  const table = document.querySelector(".body-table");
  if (!table) return;

  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  // Snapshot rows
  const rows = [...tbody.querySelectorAll("tr")];

  const state = table.__dtState || {
    filteredRows: rows.slice(),
    page: 1,
    pageSize: 20,
    currentSort: { col: null, dir: 1 },
  };

  table.__dtState = state;

  const controlBar = qs(".dt-controls");
  const searchInput = controlBar?.querySelector("input.dt-search");
  const sizeSelect = controlBar?.querySelector("select.dt-size");
  const infoBox = qs(".bottom-table-row .dt-info");
  const pager = qs(".bottom-table-row .dt-pager");

  // reset inputs
  if (sizeSelect) sizeSelect.value = state.pageSize;
  if (searchInput) searchInput.value = "";

  /* -------------------------
      SEARCH
     ------------------------- */
  if (searchInput) {
    searchInput.oninput = () => {
      const q = searchInput.value.toLowerCase().trim();
      state.filteredRows = rows.filter((r) =>
        r.textContent.toLowerCase().includes(q)
      );
      state.page = 1;
      renderPage();
    };
  }

  /* -------------------------
      PAGE SIZE
     ------------------------- */
  if (sizeSelect) {
    sizeSelect.onchange = () => {
      state.pageSize = Number(sizeSelect.value) || 20;
      state.page = 1;
      renderPage();
    };
  }

  /* -------------------------
      SORTING (on header table)
     ------------------------- */
  document
    .querySelectorAll(".header-table thead th")
    .forEach((th, colIndex) => {
      if (colIndex === 0) return;

      th.style.cursor = "pointer";

      th.onclick = () => {
        const sort = state.currentSort;

        if (sort.col !== colIndex) {
          sort.col = colIndex;
          sort.dir = 1;
        } else if (sort.dir === 1) {
          sort.dir = -1;
        } else {
          sort.col = null;
          sort.dir = 1;
        }

        updateSortIcons();

        if (sort.col === null) {
          const q = (searchInput?.value || "").toLowerCase();
          state.filteredRows = rows.filter((r) =>
            r.textContent.toLowerCase().includes(q)
          );
        } else {
          const col = sort.col;
          const dir = sort.dir;
          state.filteredRows.sort((a, b) => {
            const A = parseSortableValue(a.children[col].dataset.value);
            const B = parseSortableValue(b.children[col].dataset.value);
            if (!isNaN(A.num) && !isNaN(B.num)) return (A.num - B.num) * dir;
            if (!isNaN(A.num) && isNaN(B.num)) return -1 * dir;
            if (isNaN(A.num) && !isNaN(B.num)) return 1 * dir;
            return A.text.localeCompare(B.text) * dir;
          });
        }

        state.page = 1;
        renderPage();
      };
    });

  function updateSortIcons() {
    document.querySelectorAll(".header-table thead th").forEach((th, idx) => {
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
    s = s.replace(/,/g, ""); // remove thousands separator
    // handle percentages
    if (/^\d+(\.\d+)?%$/.test(s)) {
      const num = parseFloat(s.replace("%", ""));
      return { num, text: s };
    }
    const n = Number(s);
    if (!isNaN(n)) return { num: n, text: s };
    return { num: NaN, text: s.toLowerCase() };
  }

  /* -------------------------
      PAGINATION
     ------------------------- */

  function renderPage() {
    tbody.innerHTML = "";

    const total = state.filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);

    const slice = state.filteredRows.slice(start, end);
    slice.forEach((r) => tbody.appendChild(r));

    infoBox.textContent =
      total === 0 ? "No entries" : `Showing ${start + 1}–${end} of ${total}`;

    renderPager(totalPages);

    // resync column widths after re-render
    syncColumnWidths();
  }

  function renderPager(totalPages) {
    pager.innerHTML = "";

    const makeBtn = (label, page, disabled = false, active = false) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      if (disabled) btn.disabled = true;
      if (active) btn.classList.add("active");
      btn.onclick = () => {
        if (!disabled) {
          state.page = page;
          renderPage();
        }
      };
      return btn;
    };

    const cur = state.page;

    pager.appendChild(makeBtn("<<", 1, cur === 1));
    pager.appendChild(makeBtn("<", Math.max(1, cur - 1), cur === 1));

    pager.appendChild(makeBtn("1", 1, false, cur === 1));

    const total = totalPages;
    const windowSize = 3;
    const half = Math.floor(windowSize / 2);

    if (cur > half + 2) {
      const ell = document.createElement("span");
      ell.textContent = "...";
      pager.appendChild(ell);
    }

    const start = Math.max(2, cur - half);
    const end = Math.min(total - 1, cur + half);

    for (let p = start; p <= end; p++) {
      pager.appendChild(makeBtn(p, p, false, p === cur));
    }

    if (cur < total - (half + 1)) {
      const ell = document.createElement("span");
      ell.textContent = "...";
      pager.appendChild(ell);
    }

    if (total > 1)
      pager.appendChild(makeBtn(total, total, false, cur === total));

    pager.appendChild(makeBtn(">", Math.min(total, cur + 1), cur === total));
    pager.appendChild(makeBtn(">>", total, cur === total));
  }

  state.filteredRows = rows.slice();
  renderPage();
}

function syncColumnWidths() {
  const headerTable = document.querySelector(".header-table");
  const bodyTable = document.querySelector(".body-table");
  if (!headerTable || !bodyTable) return;

  const headerCols = headerTable.querySelectorAll("th");
  const firstBodyRow = bodyTable.querySelector("tr");

  if (!firstBodyRow) return;

  const bodyCols = firstBodyRow.children;
  if (headerCols.length !== bodyCols.length) return;

  // Step 1: Reset widths so natural sizing kicks in
  headerCols.forEach(c => c.style.width = "auto");
  bodyCols.forEach(c => c.style.width = "auto");

  // Step 2: Calculate max width for each column from *all rows + header*
  const colCount = headerCols.length;
  const maxWidths = new Array(colCount).fill(0);

  // Scan header
  headerCols.forEach((col, i) => {
    maxWidths[i] = Math.max(maxWidths[i], col.scrollWidth);
  });

  // Scan every body row
  bodyTable.querySelectorAll("tr").forEach(row => {
    row.querySelectorAll("td").forEach((cell, i) => {
      maxWidths[i] = Math.max(maxWidths[i], cell.scrollWidth);
    });
  });

  // Step 3: Apply these exact widths to both header + body
  maxWidths.forEach((w, i) => {
    headerCols[i].style.width = w + "px";
    bodyTable.querySelectorAll("tr").forEach(row => {
      row.children[i].style.width = w + "px";
    });
  });
}


/* -------------------------
   GOOGLE SHEETS LOADING (per-source)
   ------------------------- */
async function loadSource(sourceId) {
  const select = qs("#source-select");
  if (select) select.disabled = true;

  const source = CONFIG.sources.find((s) => s.id === sourceId);
  if (!source) {
    if (select) select.disabled = false;
    return;
  }

  qs("#loading-overlay").style.display = "flex";

  // if cached, just enable controls and return
  if (sourcesCache[sourceId]) {
    qs("#loading-overlay").style.display = "none";
    if (select) select.disabled = false;
    return;
  }

  const sheetId = extractSheetId(source.url);
  if (!sheetId) {
    qs("#loading-overlay").style.display = "none";
    if (select) select.disabled = false;
    throw new Error("Invalid Google Sheets URL for source: " + sourceId);
  }

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${API_KEY}`
  );
  const meta = await metaRes.json();
  const sheetNames = (meta.sheets || []).map((s) => s.properties.title);
  const sheetData = {};

  await Promise.all(
    sheetNames.map(async (name) => {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
          name
        )}?key=${API_KEY}`
      );
      const json = await r.json();
      sheetData[name] = json.values || [];
    })
  );

  sourcesCache[sourceId] = {
    sheetNames,
    sheetData,
  };

  qs("#loading-overlay").style.display = "none";
  if (select) select.disabled = false;
}

function applySourceData(sourceId) {
  const cached = sourcesCache[sourceId];
  if (!cached) return;

  googleSheetNames = cached.sheetNames;
  googleSheetsData = cached.sheetData;

  const lastSheet = googleSheetNames.at(-1);
  const headers = (googleSheetsData[lastSheet] || [])[0] || [];
  const rows = (googleSheetsData[lastSheet] || []).slice(1);

  renderTable(headers, rows);
}

/* -------------------------
   THEME HANDLING
   ------------------------- */
const themeToggle = qs("#toggle-theme");

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

/* -------------------------
   BOOTSTRAP / EVENT BINDING
   ------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  // UI refs
  const sourceSelect = qs("#source-select");
  const loadingOverlay = qs("#loading-overlay");
  const themeToggle = qs("#toggle-theme");

  // populate source selector
  if (sourceSelect) {
    CONFIG.sources.forEach((src) => {
      const opt = document.createElement("option");
      opt.value = src.id;
      opt.textContent = src.name;
      sourceSelect.appendChild(opt);
    });

    sourceSelect.addEventListener("change", async () => {
      const sourceId = sourceSelect.value;
      selectedGovernorId = null;

      if (loadingOverlay) loadingOverlay.style.display = "flex";

      await loadSource(sourceId);
      applySourceData(sourceId);

      const card = qs(".card");
      if (card) card.style.display = "block";
      if (loadingOverlay) loadingOverlay.style.display = "none";
    });
  }
  function syncHeaderScroll() {
    const bodyScroll = document.querySelector(".table-scroll-body");
    const headerTable = document.querySelector(".header-table");

    if (!bodyScroll || !headerTable) return;

    bodyScroll.addEventListener("scroll", () => {
      headerTable.style.transform = `translateX(-${bodyScroll.scrollLeft}px)`;
    });
  }

  // call it after tables are rendered
  requestAnimationFrame(syncHeaderScroll);

  // Hide loading initially
  if (loadingOverlay) loadingOverlay.style.display = "none";
});

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

document.addEventListener("DOMContentLoaded", () => {
  const current = location.pathname.split("/").pop(); // e.g. "index.html"

  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
});
