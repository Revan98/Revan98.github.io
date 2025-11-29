/* ============================================
   1. CONSTANTS & UTILITIES
================================================ */

const API_KEY = "AIzaSyAPP27INsgILZBAigyOm-g31djFgYlU7VY";

let SELECTED_COLS = [];
const SHORT_NUMBER_COLS = [2, 12, 13, 14, 15, 8];

let charts = {};
let diffsCache = {};

const qs = (sel) => document.querySelector(sel);

function formatNumber(num) {
  const n = Number(num);
  return isNaN(n) ? "" : n.toLocaleString("en-US");
}

/* ============================================
   2. DATA CLEANING & EXTRACTION
================================================ */

function cleanRows(rows) {
  return rows.filter((r) => r.some((c) => c && `${c}`.trim() !== ""));
}

function extractSheetId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

const SOURCE_LIST = [
  {
    name: "KD3202",
    url: "https://docs.google.com/spreadsheets/d/1v9mdsOKtcypKClOvxIyrslXvGUsvVg_C6x7tHyv7N38/edit?usp=sharing",
  },
  {
    name: "KD2247",
    url: "https://docs.google.com/spreadsheets/d/1Cdzv5wgPdczAvQwgpyO0CqjPbkzAjLDd8Uu4HHcoiFU/edit?usp=sharing",
  },
];

const SourcesCache = new Map();

/* ============================================
   3. TABLE BUILDING & RENDERING
================================================ */

function renderTable(headers, rawRows) {
  let rows = cleanRows(rawRows);
  rows = rows.filter((r) => String(r[11]).trim().toUpperCase() !== "YES");

  SELECTED_COLS = headers.map((_, idx) => idx);
  rows.sort((a, b) => (+b[8] || 0) - (+a[8] || 0));

  buildTable(headers, rows);
}

function buildTable(headers, rows) {
  const table = qs("#data-table");
  table.innerHTML = "";

  // ---- HEADER ----
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");

  const indexTh = document.createElement("th");
  indexTh.textContent = "#";
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

  // ---- BODY ----
  const tbody = document.createElement("tbody");
  const maxValues = getMaxValues(rows);

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row[0];

    const idxCell = document.createElement("td");
    idxCell.textContent = idx + 1;
    tr.appendChild(idxCell);

    SELECTED_COLS.forEach((col) =>
      tr.appendChild(makeCell(row, col, maxValues[col]))
    );

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  activateDataTable();
}

function getMaxValues(rows) {
  const max = {};
  SELECTED_COLS.forEach(
    (c) => (max[c] = Math.max(...rows.map((r) => +r[c] || 0)))
  );
  return max;
}

function makeCell(row, col) {
  const td = document.createElement("td");
  const raw = row[col];
  const numeric = parseFloat(String(raw).replace("%", ""));

  td.dataset.value = !isNaN(numeric) ? numeric : raw ?? "";

  const valueDiv = document.createElement("div");
  valueDiv.className = "cell-value";

  valueDiv.textContent =
    col > 1 && !isNaN(numeric) ? formatNumber(numeric) : raw;

  td.appendChild(valueDiv);
  return td;
}

/* ============================================
   4. DATATABLE: SEARCH, SORT, PAGINATION
================================================ */

function activateDataTable() {
  const table = qs("#data-table");
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const rows = [...tbody.querySelectorAll("tr")];

  const state = table.__dtState || {
    filteredRows: rows.slice(),
    page: 1,
    pageSize: 20,
    currentSort: { col: null, dir: 1 },
  };

  table.__dtState = state;

  const controlBar = qs(".dt-controls");
  const searchInput = controlBar.querySelector("input.dt-search");
  const sizeSelect = controlBar.querySelector("select.dt-size");
  const infoBox = qs(".bottom-table-row .dt-info");
  const pager = qs(".bottom-table-row .dt-pager");

  sizeSelect.value = state.pageSize;
  searchInput.value = "";

  /* ---------- SEARCH ---------- */
  searchInput.oninput = () => {
    const q = searchInput.value.toLowerCase().trim();
    state.filteredRows = rows.filter((r) =>
      r.textContent.toLowerCase().includes(q)
    );
    state.page = 1;
    renderPage();
  };

  /* ---------- PAGE SIZE ---------- */
  sizeSelect.onchange = () => {
    state.pageSize = +sizeSelect.value;
    state.page = 1;
    renderPage();
  };

  /* ---------- SORTING ---------- */
  table.querySelectorAll("thead th").forEach((th, colIndex) => {
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
        state.filteredRows = rows
          .slice()
          .filter((r) =>
            r.textContent
              .toLowerCase()
              .includes(searchInput.value.toLowerCase())
          );
      } else {
        const col = sort.col;
        const dir = sort.dir;

        state.filteredRows.sort((a, b) => {
          const A = a.children[col].dataset.value;
          const B = b.children[col].dataset.value;

          const An = Number(A);
          const Bn = Number(B);

          if (!isNaN(An) && !isNaN(Bn)) {
            return (An - Bn) * dir;
          }
          return String(A).localeCompare(String(B)) * dir;
        });
      }

      state.page = 1;
      renderPage();
    };
  });

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

  /* ---------- PAGINATION ---------- */

  function makeBtn(label, page, opts = {}) {
    const b = document.createElement("button");
    b.textContent = label;

    if (opts.disabled) b.disabled = true;
    if (opts.active) b.classList.add("active");

    b.onclick = () => {
      if (!opts.disabled) {
        state.page = page;
        renderPage();
      }
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

    pager.appendChild(makeBtn("<<", 1, { disabled: state.page === 1 }));
    pager.appendChild(
      makeBtn("<", Math.max(1, state.page - 1), {
        disabled: state.page === 1,
      })
    );

    const current = state.page;
    const windowSize = 3;

    pager.appendChild(makeBtn("1", 1, { active: current === 1 }));

    if (current > Math.ceil(windowSize / 2) + 1) {
      const ell = document.createElement("span");
      ell.textContent = "...";
      ell.className = "ell";
      pager.appendChild(ell);
    }

    const pages = getCenteredPages(current, totalPages, windowSize);
    pages.forEach((p) => {
      if (p !== 1 && p !== totalPages) {
        pager.appendChild(makeBtn(p, p, { active: current === p }));
      }
    });

    if (current < totalPages - Math.ceil(windowSize / 2)) {
      const ell = document.createElement("span");
      ell.textContent = "...";
      ell.className = "ell";
      pager.appendChild(ell);
    }

    if (totalPages > 1) {
      pager.appendChild(
        makeBtn(totalPages, totalPages, {
          active: current === totalPages,
        })
      );
    }

    pager.appendChild(
      makeBtn(">", Math.min(totalPages, current + 1), {
        disabled: current === totalPages,
      })
    );
    pager.appendChild(
      makeBtn(">>", totalPages, { disabled: current === totalPages })
    );
  }

  /* ---------- FINAL PAGE RENDER ---------- */

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

/* ============================================
   5. GOOGLE SHEETS LOADING (MULTI-SOURCE)
================================================ */

async function loadSourceSheet(url) {
  if (SourcesCache.has(url)) return SourcesCache.get(url);

  const sheetId = extractSheetId(url);
  if (!sheetId) throw new Error("Invalid Google Sheets URL: " + url);

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${API_KEY}`
  );
  const meta = await metaRes.json();

  const sheetNames = meta.sheets.map((s) => s.properties.title);
  const entry = { sheetId, sheetNames, data: {} };

  SourcesCache.set(url, entry);
  return entry;
}

async function loadWorksheetData(url, sheetName) {
  const entry = SourcesCache.get(url);
  if (!entry) throw new Error("Source not in cache");

  if (entry.data[sheetName]) return entry.data[sheetName];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${
      entry.sheetId
    }/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`
  );

  const json = await res.json();
  entry.data[sheetName] = json.values || [];

  return entry.data[sheetName];
}

/* ============================================
   6. INITIALIZATION
================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    qs("#toggle-theme").checked = true;
  }

  const sourceSelect = qs("#source-select");
  const worksheetSelect = qs("#worksheet-select");

  SOURCE_LIST.forEach((src) => {
    const opt = document.createElement("option");
    opt.value = src.url;
    opt.textContent = src.name;
    sourceSelect.appendChild(opt);
  });

  sourceSelect.addEventListener("change", async () => {
    const url = sourceSelect.value;
    worksheetSelect.innerHTML = `<option value="">Select Worksheet…</option>`;
    if (!url) return;

    qs("#loading-overlay").style.display = "flex";

    try {
      const entry = await loadSourceSheet(url);
      entry.sheetNames.forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        worksheetSelect.appendChild(opt);
      });
    } catch (e) {
      alert("Sheet load error:\n" + e.message);
    } finally {
      qs("#loading-overlay").style.display = "none";
    }
  });

  worksheetSelect.addEventListener("change", async () => {
    const url = sourceSelect.value;
    const sheetName = worksheetSelect.value;
    if (!url || !sheetName) return;

    qs("#loading-overlay").style.display = "flex";

    try {
      const rows = await loadWorksheetData(url, sheetName);
      const headers = rows[0] || [];
      const bodyRows = rows.slice(1);
      renderTable(headers, bodyRows);
    } catch (e) {
      alert("Worksheet load error:\n" + e.message);
    } finally {
      qs("#loading-overlay").style.display = "none";
    }
  });
});

/* ============================================
   7. THEME HANDLING
================================================ */

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

initializeTheme(themeToggle);

if (themeToggle) {
  themeToggle.addEventListener("change", (e) => {
    setTheme(e.target.checked ? "dark" : "light");
  });
}
