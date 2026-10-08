"use strict";

let SQL = null;
let db = null;

(async () => {
  try {
    SQL = await getSqlJs();
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

const dbxSchemaContent = document.getElementById("dbx-schema-content");

const dbxSqlInput = document.getElementById("dbx-sql-input");
const dbxRunQueryBtn = document.getElementById("dbx-run-query");
const dbxQueryError = document.getElementById("dbx-query-error");
const dbxQueryEmpty = document.getElementById("dbx-query-empty");
const dbxQueryGridEl = document.getElementById("dbx-query-grid");

let allTables = [];
let activeTable = null;
let tableInfoCache = {};

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
      SQL = await getSqlJs();
    } catch (e) {
      showToast(`SQLite engine failed to load: ${e.message}`, "error");
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
    } catch (e) {
      showToast(`Failed to close database: ${e.message}`, "error");
    }
  }
  db = null;
  allTables = [];
  activeTable = null;
  tableInfoCache = {};
  destroySiteTable(dbxDataGridEl);
  destroySiteTable(dbxQueryGridEl);
  dbxSchemaContent.innerHTML = "";
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
      showToast(`Could not count rows for table "${name}": ${e.message}`, "error");
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
  // tables built while their tab was hidden need re-measuring
  if (tab === "data") refreshSiteTable(dbxDataGridEl);
  if (tab === "query") refreshSiteTable(dbxQueryGridEl);
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

function formatCellNumber(value) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 20 });
}

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

/** Plain-text form of a cell value (used for display after escaping). */
function dbxFormatCell(val, col) {
  if (val === null || val === undefined) return "NULL";
  if (val instanceof Uint8Array) return `<BLOB ${val.length}b>`;
  if (typeof val === "number" && !isIdColumn(col)) return formatCellNumber(val);
  return String(val);
}

/** DataTables render function for one column: HTML for display, raw value for sort/search. */
function dbxRender(col) {
  return (val, type) => {
    if (type === "display") {
      if (val === null || val === undefined)
        return '<span class="dbx-cell-null">NULL</span>';
      return escapeHtml(dbxFormatCell(val, col));
    }
    if (val === null || val === undefined) return "";
    return val instanceof Uint8Array ? dbxFormatCell(val, col) : val;
  };
}

function buildTableColumns(columns, colInfo) {
  const typeMap = {};
  const pkSet = new Set();
  (colInfo || []).forEach((c) => {
    typeMap[c.name] = c.type;
    if (c.pk) pkSet.add(c.name);
  });
  return columns.map((name) => ({
    title: name,
    titleHtml: `<span title="${escapeAttr(typeMap[name] ? `${name} — ${typeMap[name]}` : name)}">${escapeHtml(name)}</span>`,
    render: dbxRender(name),
    className: pkSet.has(name) ? "dbx-pk-cell" : undefined,
  }));
}

function renderDataTab() {
  if (!activeTable) return;
  destroySiteTable(dbxDataGridEl);
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

  dbxDataGridEl.style.display = "block";
  createSiteTable(dbxDataGridEl, {
    columns: buildTableColumns(result.columns, cols),
    data: result.values,
  });
}


function renderSchemaForActive() {
  dbxSchemaContent.querySelectorAll(".dbx-schema-grid").forEach(destroySiteTable);

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
      <div id="dbx-schema-columns-grid" class="dbx-schema-grid"></div>
    </div>
    ${
      fks.length
        ? `<div class="dbx-schema-table"><h3>Foreign keys</h3><div id="dbx-schema-fks-grid" class="dbx-schema-grid"></div></div>`
        : ""
    }
    ${
      indexes.length
        ? `<div class="dbx-schema-table"><h3>Indexes</h3><div id="dbx-schema-idx-grid" class="dbx-schema-grid"></div></div>`
        : ""
    }
    ${createSql ? `<div class="dbx-schema-table"><h3>CREATE statement</h3><div class="dbx-create-sql">${escapeHtml(createSql)}</div></div>` : ""}
  `;

  const text = (v, type) => (type === "display" ? escapeHtml(v ?? "") : (v ?? ""));
  const plainTable = (id, columns, data) =>
    createSiteTable(document.getElementById(id), {
      plain: true,
      columns: columns.map((c) => ({ orderable: false, render: text, ...c })),
      data,
    });

  plainTable(
    "dbx-schema-columns-grid",
    [
      {
        title: "Column",
        render: (v, type, row) =>
          type === "display"
            ? escapeHtml(v) + (row[4] ? '<span class="dbx-pk-badge">PK</span>' : "")
            : v,
      },
      { title: "Type", render: (v, type) => (type === "display" ? escapeHtml(v || "—") : v) },
      { title: "Constraint", render: (v, type) => (type === "display" && v ? "NOT NULL" : "") },
      { title: "Default", render: (v, type) => (type === "display" && v !== null ? escapeHtml(String(v)) : "") },
    ],
    cols.map((c) => [c.name, c.type, c.notnull, c.dflt, c.pk]),
  );

  if (fks.length) {
    plainTable(
      "dbx-schema-fks-grid",
      [{ title: "Column" }, { title: "References" }],
      fks.map((f) => [f.from, `${f.table}.${f.to}`]),
    );
  }

  if (indexes.length) {
    plainTable(
      "dbx-schema-idx-grid",
      [{ title: "Name" }, { title: "Unique", render: (v, type) => (type === "display" ? (v ? "Yes" : "No") : v) }],
      indexes.map((i) => [i.name, i.unique]),
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
  destroySiteTable(dbxQueryGridEl);
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
    createSiteTable(dbxQueryGridEl, {
      columns: buildTableColumns(columns, []),
      data: values,
    });
  } catch (e) {
    showQueryError(e.message || String(e));
  }
}

function showQueryError(msg) {
  dbxQueryError.textContent = msg;
  dbxQueryError.style.display = "block";
}
