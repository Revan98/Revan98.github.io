"use strict";

let dataGridApi = null;
let queryGridApi = null;
let schemaGridApis = [];

const THEME_KEY = "theme";
const themeToggle = document.getElementById("toggle-theme");

function getAgTheme(theme) {
  return (
    theme === "dark"
      ? agGrid.themeQuartz.withPart(agGrid.colorSchemeDark)
      : agGrid.themeQuartz.withPart(agGrid.colorSchemeLight)
  ).withPart(agGrid.buttonStyleQuartz);
}

function getCurrentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Both grids on this page (Data tab + SQL Query tab) are created/destroyed
// on the fly, so theme changes need to be pushed to whichever ones exist.
function applyGridsTheme(theme) {
  const agTheme = getAgTheme(theme);
  if (dataGridApi) dataGridApi.setGridOption("theme", agTheme);
  if (queryGridApi) queryGridApi.setGridOption("theme", agTheme);
  schemaGridApis.forEach((api) => api.setGridOption("theme", agTheme));
}

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);

  document.body.setAttribute("data-ag-theme-mode", theme);

  localStorage.setItem(THEME_KEY, theme);

  applyGridsTheme(theme);
}
function initTheme() {
  const theme = getCurrentTheme();
  applyTheme(theme);
  themeToggle.checked = theme === "dark";
}
themeToggle.addEventListener("change", () =>
  applyTheme(themeToggle.checked ? "dark" : "light"),
);
initTheme();

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
hamburger.addEventListener("click", () => {
  navLinks.classList.toggle("show");
  hamburger.classList.toggle("open");
});
document.addEventListener("click", (e) => {
  if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
    navLinks.classList.remove("show");
    hamburger.classList.remove("open");
  }
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("show");
    hamburger.classList.remove("open");
  });
});

const toolsToggle = document.getElementById("tools-toggle");
const toolsMenu = document.getElementById("tools-menu");
if (toolsToggle && toolsMenu) {
  toolsToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = toolsMenu.classList.toggle("show");
    toolsToggle.setAttribute("aria-expanded", isOpen);
  });

  document.addEventListener("click", (e) => {
    if (!toolsToggle.contains(e.target) && !toolsMenu.contains(e.target)) {
      toolsMenu.classList.remove("show");
      toolsToggle.setAttribute("aria-expanded", "false");
    }
  });

  toolsMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      toolsMenu.classList.remove("show");
      toolsToggle.setAttribute("aria-expanded", "false");
    });
  });
}

let SQL = null;
let db = null;

(async () => {
  try {
    SQL = await initSqlJs({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${f}`,
    });
  } catch (e) {
    console.error("sql.js init failed:", e);
    showLoadError(
      "Could not load the SQLite engine. Check your connection and reload the page.",
    );
  }
})();

const loadState = document.getElementById("load-state");
const explorerState = document.getElementById("explorer-state");
const dbxDrop = document.getElementById("dbx-drop");
const dbxFileInput = document.getElementById("dbx-file-input");
const dbxDropSub = document.getElementById("dbx-drop-sub");
const dbxLoadError = document.getElementById("dbx-load-error");
const dbxLoading = document.getElementById("dbx-loading");

const dbxFilename = document.getElementById("dbx-filename");
const dbxCloseBtn = document.getElementById("dbx-close-btn");

const dbxTableList = document.getElementById("dbx-table-list");
const dbxTableFilter = document.getElementById("dbx-table-filter");
const dbxTableCount = document.getElementById("dbx-table-count");

const dbxTabs = document.getElementById("dbx-tabs");
const tabPanels = {
  data: document.getElementById("tab-data"),
  schema: document.getElementById("tab-schema"),
  query: document.getElementById("tab-query"),
};

const dbxNoTable = document.getElementById("dbx-no-table");
const dbxDataContent = document.getElementById("dbx-data-content");
const dbxDataEmpty = document.getElementById("dbx-data-empty");
const dbxDataGridEl = document.getElementById("dbx-data-grid");
const dbxRowSearch = document.getElementById("dbx-row-search");

const dbxSchemaContent = document.getElementById("dbx-schema-content");

const dbxSqlInput = document.getElementById("dbx-sql-input");
const dbxRunQueryBtn = document.getElementById("dbx-run-query");
const dbxQueryError = document.getElementById("dbx-query-error");
const dbxQueryEmpty = document.getElementById("dbx-query-empty");
const dbxQueryGridEl = document.getElementById("dbx-query-grid");

let allTables = [];
let activeTable = null;
let tableInfoCache = {};
let rowSearchTerm = "";

const GRID_DEFAULTS = {
  enableCellTextSelection: true,
  ensureDomOrder: true,
  defaultColDef: {
    sortable: true,
    filter: false,
    resizable: true,
    minWidth: 130,
    flex: 1,
  },
  tooltipShowDelay: 300,
  pagination: true,
  paginationPageSize: 50,
  paginationPageSizeSelector: [20, 50, 100, 200],
  animateRows: true,
  rowHeight: 42,
};

dbxDrop.addEventListener("click", () => dbxFileInput.click());
dbxDrop.addEventListener("dragover", (e) => {
  e.preventDefault();
  dbxDrop.classList.add("dragover");
});
dbxDrop.addEventListener("dragleave", () =>
  dbxDrop.classList.remove("dragover"),
);
dbxDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  dbxDrop.classList.remove("dragover");
  const file = e.dataTransfer.files?.[0];
  if (file) loadFile(file);
});
dbxFileInput.addEventListener("change", () => {
  const file = dbxFileInput.files[0];
  if (file) loadFile(file);
});

function showLoadError(msg) {
  dbxLoadError.textContent = msg;
  dbxLoadError.style.display = "block";
}
function clearLoadError() {
  dbxLoadError.style.display = "none";
}

async function loadFile(file) {
  clearLoadError();
  dbxDropSub.textContent = file.name;
  dbxLoading.classList.add("show");

  if (!SQL) {
    try {
      SQL = await initSqlJs({
        locateFile: (f) =>
          `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${f}`,
      });
    } catch (e) {
      dbxLoading.classList.remove("show");
      showLoadError(
        "The SQLite engine failed to load. Please reload the page and try again.",
      );
      return;
    }
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const candidate = new SQL.Database(bytes);
    candidate.exec("SELECT name FROM sqlite_master LIMIT 1");

    db = candidate;
    dbxFilename.textContent = file.name;
    dbxLoading.classList.remove("show");
    loadState.style.display = "none";
    explorerState.style.display = "block";

    loadTableList();
    switchTab("data");
  } catch (e) {
    console.error(e);
    dbxLoading.classList.remove("show");
    showLoadError(
      "This doesn't look like a valid SQLite database file. (" +
        (e.message || e) +
        ")",
    );
  }
}

dbxCloseBtn.addEventListener("click", closeDatabase);

function closeDatabase() {
  if (db) {
    try {
      db.close();
    } catch (e) {}
  }
  db = null;
  allTables = [];
  activeTable = null;
  tableInfoCache = {};
  rowSearchTerm = "";
  destroyDataGrid();
  destroyQueryGrid();
  destroySchemaGrids();
  dbxSchemaContent.innerHTML = "";
  dbxRowSearch.value = "";
  dbxFileInput.value = "";
  dbxDropSub.textContent = "No file selected";
  explorerState.style.display = "none";
  loadState.style.display = "flex";
  dbxNoTable.style.display = "block";
  dbxDataContent.style.display = "none";
}

function loadTableList() {
  const res = db.exec(`
    SELECT name, type FROM sqlite_master
    WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'
    ORDER BY type DESC, name COLLATE NOCASE ASC
  `);
  const rows = res[0]?.values || [];

  allTables = rows.map(([name, type]) => {
    let rowCount = null;
    try {
      const c = db.exec(`SELECT COUNT(*) FROM "${name.replace(/"/g, '""')}"`);
      rowCount = c[0]?.values?.[0]?.[0] ?? null;
    } catch (e) {
    }
    return { name, type, rowCount };
  });

  dbxTableCount.textContent = allTables.length ? `(${allTables.length})` : "";
  renderTableList();
}

function renderTableList() {
  const filter = dbxTableFilter.value.trim().toLowerCase();
  const filtered = allTables.filter((t) =>
    t.name.toLowerCase().includes(filter),
  );

  if (!filtered.length) {
    dbxTableList.innerHTML = `<div class="dbx-table-empty">No tables found.</div>`;
    return;
  }

  dbxTableList.innerHTML = filtered
    .map(
      (t) => `
    <button class="dbx-table-item ${t.name === activeTable ? "active" : ""}" data-table="${escapeAttr(t.name)}">
      <span class="dbx-tname">${escapeHtml(t.name)}${t.type === "view" ? " <span style='opacity:.55;font-size:.7em;'>(view)</span>" : ""}</span>
      <span class="dbx-trows">${t.rowCount === null ? "" : t.rowCount.toLocaleString()}</span>
    </button>
  `,
    )
    .join("");

  dbxTableList.querySelectorAll(".dbx-table-item").forEach((btn) => {
    btn.addEventListener("click", () => selectTable(btn.dataset.table));
  });
}

dbxTableFilter.addEventListener("input", renderTableList);

function selectTable(name) {
  activeTable = name;
  rowSearchTerm = "";
  dbxRowSearch.value = "";
  renderTableList();
  dbxNoTable.style.display = "none";
  dbxDataContent.style.display = "block";
  renderDataTab();
  if (tabPanels.schema.classList.contains("active")) renderSchemaForActive();
}

dbxTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".dbx-tab");
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

function switchTab(tab) {
  dbxTabs
    .querySelectorAll(".dbx-tab")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  Object.entries(tabPanels).forEach(([key, el]) =>
    el.classList.toggle("active", key === tab),
  );
  if (tab === "schema") renderSchemaForActive();
}

function getTableInfo(name) {
  if (tableInfoCache[name]) return tableInfoCache[name];
  const res = db.exec(`PRAGMA table_info("${name.replace(/"/g, '""')}")`);
  const cols = res[0]
    ? res[0].values.map((v) => ({
        cid: v[0],
        name: v[1],
        type: v[2] || "",
        notnull: v[3],
        dflt: v[4],
        pk: v[5],
      }))
    : [];
  tableInfoCache[name] = cols;
  return cols;
}

function destroyGrid(el, api) {
  if (api) {
    try {
      api.destroy();
    } catch (e) {}
  }
  if (el) el.classList.remove("visible");
  return null;
}
function destroyDataGrid() {
  dataGridApi = destroyGrid(dbxDataGridEl, dataGridApi);
}
function destroyQueryGrid() {
  queryGridApi = destroyGrid(dbxQueryGridEl, queryGridApi);
}

// Same approach as the dashboard's formatNumber(): thousands separators via
// toLocaleString. sql.js returns real JS numbers for INTEGER/REAL columns,
// so this applies automatically wherever a cell's value is numeric —
// whether that's the Data tab, the Query tab, or an arbitrary user query.
function formatNumber(value) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 20 });
}

// IDs are numeric but aren't quantities — don't add thousands separators or
// right-align them.
const ID_COLUMN_NAMES = new Set([
  "player_id",
  "id",
  "governor_id",
  "kvk_number",
  "main_id",
  "kingdom",
]);

function isIdColumn(field) {
  return !!field && ID_COLUMN_NAMES.has(String(field).toLowerCase());
}

function dbxCellRenderer(params) {
  const val = params.value;
  if (val === null || val === undefined) {
    const span = document.createElement("span");
    span.className = "dbx-cell-null";
    span.textContent = "NULL";
    return span;
  }
  if (val instanceof Uint8Array) {
    return `<BLOB ${val.length}b>`;
  }
  if (typeof val === "number" && !isIdColumn(params.colDef?.field)) {
    return formatNumber(val);
  }
  return String(val);
}
function dbxTooltipValueGetter(params) {
  const val = params.value;
  if (val === null || val === undefined) return "NULL";
  if (val instanceof Uint8Array) return `<BLOB ${val.length}b>`;
  if (typeof val === "number" && !isIdColumn(params.colDef?.field)) {
    return formatNumber(val);
  }
  return String(val);
}

function buildColumnDefs(columns, colInfo) {
  const typeMap = {};
  const pkSet = new Set();
  (colInfo || []).forEach((c) => {
    typeMap[c.name] = c.type;
    if (c.pk) pkSet.add(c.name);
  });
  return columns.map((name) => ({
    field: name,
    headerName: pkSet.has(name) ? `${name}` : name,
    headerTooltip: typeMap[name] ? `${name} — ${typeMap[name]}` : name,
    cellClass: (p) => {
      const classes = [];
      if (pkSet.has(name)) classes.push("dbx-pk-cell");
      if (typeof p.value === "number" && !isIdColumn(name)) {
        classes.push("dbx-num-cell");
      }
      return classes;
    },
    cellRenderer: dbxCellRenderer,
    tooltipValueGetter: dbxTooltipValueGetter,
  }));
}

function rowsToObjects(columns, values) {
  return values.map((row) => {
    const obj = {};
    columns.forEach((c, i) => (obj[c] = row[i]));
    return obj;
  });
}

function renderDataTab() {
  if (!activeTable) return;
  destroyDataGrid();
  dbxDataGridEl.style.display = "none";
  dbxDataEmpty.style.display = "none";

  const cols = getTableInfo(activeTable);
  const safeTable = `"${activeTable.replace(/"/g, '""')}"`;

  let result;
  try {
    result = db.exec(`SELECT * FROM ${safeTable}`)[0];
  } catch (e) {
    dbxDataEmpty.style.display = "block";
    dbxDataEmpty.innerHTML = `<div class="search-error">${escapeHtml(e.message || String(e))}</div>`;
    return;
  }

  if (!result || !result.values.length) {
    dbxDataEmpty.style.display = "block";
    dbxDataEmpty.innerHTML = `<p>No rows in this table.</p>`;
    return;
  }

  const columnDefs = buildColumnDefs(result.columns, cols);
  const rowData = rowsToObjects(result.columns, result.values);

  dbxDataGridEl.style.display = "block";
  dataGridApi = agGrid.createGrid(dbxDataGridEl, {
    ...GRID_DEFAULTS,
    theme: getAgTheme(getCurrentTheme()),
    columnDefs,
    rowData,
    quickFilterText: rowSearchTerm,
  });
  requestAnimationFrame(() => dbxDataGridEl.classList.add("visible"));
}

dbxRowSearch.addEventListener("input", () => {
  rowSearchTerm = dbxRowSearch.value.trim();
  if (dataGridApi) {
    dataGridApi.setGridOption("quickFilterText", rowSearchTerm);
  }
});

function createStaticGrid(el, columnDefs, rowData) {
  const api = agGrid.createGrid(el, {
    theme: getAgTheme(getCurrentTheme()),
    columnDefs,
    rowData,
    domLayout: "autoHeight",
    defaultColDef: { resizable: true, sortable: false, flex: 1 },
    enableCellTextSelection: true,
  });
  requestAnimationFrame(() => el.classList.add("visible"));
  return api;
}

function destroySchemaGrids() {
  schemaGridApis.forEach((api) => {
    try {
      api.destroy();
    } catch (e) {}
  });
  schemaGridApis = [];
}

function renderSchemaForActive() {
  destroySchemaGrids();

  if (!activeTable) {
    dbxSchemaContent.innerHTML = `<div class="dbx-empty-hint">Select a table on the left to see its schema.</div>`;
    return;
  }

  const cols = getTableInfo(activeTable);
  const fkRes = db.exec(
    `PRAGMA foreign_key_list("${activeTable.replace(/"/g, '""')}")`,
  );
  const fks = fkRes[0]
    ? fkRes[0].values.map((v) => ({ from: v[3], table: v[2], to: v[4] }))
    : [];
  const idxRes = db.exec(
    `PRAGMA index_list("${activeTable.replace(/"/g, '""')}")`,
  );
  const indexes = idxRes[0]
    ? idxRes[0].values.map((v) => ({ name: v[1], unique: v[2] }))
    : [];

  const createSqlRes = db.exec(
    `SELECT sql FROM sqlite_master WHERE name = '${activeTable.replace(/'/g, "''")}'`,
  );
  const createSql = createSqlRes[0]?.values?.[0]?.[0] || "";

  dbxSchemaContent.innerHTML = `
    <div class="dbx-schema-table">
      <h3>${escapeHtml(activeTable)} <span class="dbx-row-badge">${cols.length} column${cols.length === 1 ? "" : "s"}</span></h3>
      <div id="dbx-schema-columns-grid" class="dbx-ag-grid dbx-ag-grid--auto ag-theme-quartz"></div>
    </div>
    ${
      fks.length
        ? `<div class="dbx-schema-table"><h3>Foreign keys</h3><div id="dbx-schema-fks-grid" class="dbx-ag-grid dbx-ag-grid--auto ag-theme-quartz"></div></div>`
        : ""
    }
    ${
      indexes.length
        ? `<div class="dbx-schema-table"><h3>Indexes</h3><div id="dbx-schema-idx-grid" class="dbx-ag-grid dbx-ag-grid--auto ag-theme-quartz"></div></div>`
        : ""
    }
    ${createSql ? `<div class="dbx-schema-table"><h3>CREATE statement</h3><div class="dbx-create-sql">${escapeHtml(createSql)}</div></div>` : ""}
  `;

  const columnsGridEl = document.getElementById("dbx-schema-columns-grid");
  schemaGridApis.push(
    createStaticGrid(
      columnsGridEl,
      [
        {
          headerName: "Column",
          field: "name",
          flex: 1.4,
          cellRenderer: (p) =>
            p.data.pk
              ? `${escapeHtml(p.value)}<span class="dbx-pk-badge">PK</span>`
              : escapeHtml(p.value),
        },
        { headerName: "Type", field: "type", valueFormatter: (p) => p.value || "—" },
        {
          headerName: "Constraint",
          field: "notnull",
          valueFormatter: (p) => (p.value ? "NOT NULL" : ""),
        },
        {
          headerName: "Default",
          field: "dflt",
          valueFormatter: (p) => (p.value === null ? "" : String(p.value)),
        },
      ],
      cols,
    ),
  );

  if (fks.length) {
    const fksGridEl = document.getElementById("dbx-schema-fks-grid");
    schemaGridApis.push(
      createStaticGrid(
        fksGridEl,
        [
          { headerName: "Column", field: "from" },
          {
            headerName: "References",
            valueGetter: (p) => `${p.data.table}.${p.data.to}`,
          },
        ],
        fks,
      ),
    );
  }

  if (indexes.length) {
    const idxGridEl = document.getElementById("dbx-schema-idx-grid");
    schemaGridApis.push(
      createStaticGrid(
        idxGridEl,
        [
          { headerName: "Name", field: "name", flex: 1.5 },
          {
            headerName: "Unique",
            field: "unique",
            valueFormatter: (p) => (p.value ? "Yes" : "No"),
          },
        ],
        indexes,
      ),
    );
  }
}

const ALLOWED_QUERY_PREFIX = /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i;
const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|VACUUM|REINDEX|TRIGGER)\b/i;

dbxRunQueryBtn.addEventListener("click", runUserQuery);
dbxSqlInput.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runUserQuery();
});

function runUserQuery() {
  const sql = dbxSqlInput.value.trim();
  dbxQueryError.style.display = "none";
  destroyQueryGrid();
  dbxQueryGridEl.style.display = "none";
  dbxQueryEmpty.style.display = "none";
  dbxQueryEmpty.innerHTML = "";

  if (!sql) return;

  if (!ALLOWED_QUERY_PREFIX.test(sql)) {
    showQueryError(
      "Only SELECT, WITH, PRAGMA, or EXPLAIN statements are allowed in this read-only viewer.",
    );
    return;
  }
  if (FORBIDDEN_KEYWORDS.test(sql)) {
    showQueryError(
      "This query contains a statement that modifies the database, which isn't allowed here.",
    );
    return;
  }
  if (sql.split(";").filter((s) => s.trim()).length > 1) {
    showQueryError("Please run one statement at a time.");
    return;
  }

  try {
    const res = db.exec(sql);
    if (!res.length) {
      dbxQueryEmpty.style.display = "block";
      dbxQueryEmpty.innerHTML = `<p>Query ran successfully and returned no rows.</p>`;
      return;
    }
    const { columns, values } = res[0];
    if (!values.length) {
      dbxQueryEmpty.style.display = "block";
      dbxQueryEmpty.innerHTML = `<p>No rows returned.</p>`;
      return;
    }

    dbxQueryGridEl.style.display = "block";
    queryGridApi = agGrid.createGrid(dbxQueryGridEl, {
      ...GRID_DEFAULTS,
      theme: getAgTheme(getCurrentTheme()),
      columnDefs: buildColumnDefs(columns, []),
      rowData: rowsToObjects(columns, values),
    });
    requestAnimationFrame(() => dbxQueryGridEl.classList.add("visible"));
  } catch (e) {
    showQueryError(e.message || String(e));
  }
}

function showQueryError(msg) {
  dbxQueryError.textContent = msg;
  dbxQueryError.style.display = "block";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}
