"use strict";

let SQL = null;
let db  = null;

(async () => {
  try {
    SQL = await initSqlJs({
      locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${f}`,
    });
  } catch (e) {
    console.error("sql.js init failed:", e);
    showLoadError("Could not load the SQLite engine. Check your connection and reload the page.");
  }
})();

const loadState     = document.getElementById("load-state");
const explorerState = document.getElementById("explorer-state");
const dbxDrop        = document.getElementById("dbx-drop");
const dbxFileInput    = document.getElementById("dbx-file-input");
const dbxDropSub      = document.getElementById("dbx-drop-sub");
const dbxLoadError    = document.getElementById("dbx-load-error");
const dbxLoading      = document.getElementById("dbx-loading");

const dbxFilename   = document.getElementById("dbx-filename");
const dbxCloseBtn   = document.getElementById("dbx-close-btn");

const dbxTableList   = document.getElementById("dbx-table-list");
const dbxTableFilter = document.getElementById("dbx-table-filter");
const dbxTableCount  = document.getElementById("dbx-table-count");

const dbxTabs       = document.getElementById("dbx-tabs");
const tabPanels      = { data: document.getElementById("tab-data"), schema: document.getElementById("tab-schema"), query: document.getElementById("tab-query") };

const dbxNoTable     = document.getElementById("dbx-no-table");
const dbxDataContent = document.getElementById("dbx-data-content");
const dbxTableWrap   = document.getElementById("dbx-table-wrap");
const dbxPagination  = document.getElementById("dbx-pagination");
const dbxRowSearch   = document.getElementById("dbx-row-search");
const dbxRowCount    = document.getElementById("dbx-row-count");

const dbxSchemaContent = document.getElementById("dbx-schema-content");

const dbxSqlInput    = document.getElementById("dbx-sql-input");
const dbxRunQueryBtn  = document.getElementById("dbx-run-query");
const dbxQueryError   = document.getElementById("dbx-query-error");
const dbxQueryResult  = document.getElementById("dbx-query-result");

let allTables   = [];
let activeTable = null;
let tableInfoCache = {};
let currentPage = 1;
const PAGE_SIZE = 100;
let rowSearchTerm = "";
let sortState = { col: null, dir: "asc" };

dbxDrop.addEventListener("click", () => dbxFileInput.click());
dbxDrop.addEventListener("dragover", e => { e.preventDefault(); dbxDrop.classList.add("dragover"); });
dbxDrop.addEventListener("dragleave", () => dbxDrop.classList.remove("dragover"));
dbxDrop.addEventListener("drop", e => {
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
      SQL = await initSqlJs({ locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${f}` });
    } catch (e) {
      dbxLoading.classList.remove("show");
      showLoadError("The SQLite engine failed to load. Please reload the page and try again.");
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
    showLoadError("This doesn't look like a valid SQLite database file. (" + (e.message || e) + ")");
  }
}

dbxCloseBtn.addEventListener("click", closeDatabase);

function closeDatabase() {
  if (db) { try { db.close(); } catch (e) {} }
  db = null;
  allTables = [];
  activeTable = null;
  tableInfoCache = {};
  currentPage = 1;
  rowSearchTerm = "";
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
    } catch (e) {}
    return { name, type, rowCount };
  });

  dbxTableCount.textContent = allTables.length ? `(${allTables.length})` : "";
  renderTableList();
}

function renderTableList() {
  const filter = dbxTableFilter.value.trim().toLowerCase();
  const filtered = allTables.filter(t => t.name.toLowerCase().includes(filter));

  if (!filtered.length) {
    dbxTableList.innerHTML = `<div class="dbx-table-empty">No tables found.</div>`;
    return;
  }

  dbxTableList.innerHTML = filtered.map(t => `
    <button class="dbx-table-item ${t.name === activeTable ? "active" : ""}" data-table="${escapeAttr(t.name)}">
      <span class="dbx-tname">${escapeHtml(t.name)}${t.type === "view" ? " <span style='opacity:.55;font-size:.7em;'>(view)</span>" : ""}</span>
      <span class="dbx-trows">${t.rowCount === null ? "" : t.rowCount.toLocaleString()}</span>
    </button>
  `).join("");

  dbxTableList.querySelectorAll(".dbx-table-item").forEach(btn => {
    btn.addEventListener("click", () => selectTable(btn.dataset.table));
  });
}

dbxTableFilter.addEventListener("input", renderTableList);

function selectTable(name) {
  activeTable = name;
  currentPage = 1;
  rowSearchTerm = "";
  dbxRowSearch.value = "";
  sortState = { col: null, dir: "asc" };
  renderTableList();
  dbxNoTable.style.display = "none";
  dbxDataContent.style.display = "block";
  renderDataTab();
  if (tabPanels.schema.classList.contains("active")) renderSchemaForActive();
}

dbxTabs.addEventListener("click", e => {
  const btn = e.target.closest(".dbx-tab");
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

function switchTab(tab) {
  dbxTabs.querySelectorAll(".dbx-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  Object.entries(tabPanels).forEach(([key, el]) => el.classList.toggle("active", key === tab));
  if (tab === "schema") renderSchemaForActive();
}

function getTableInfo(name) {
  if (tableInfoCache[name]) return tableInfoCache[name];
  const res = db.exec(`PRAGMA table_info("${name.replace(/"/g, '""')}")`);
  const cols = res[0] ? res[0].values.map(v => ({
    cid: v[0], name: v[1], type: v[2] || "", notnull: v[3], dflt: v[4], pk: v[5],
  })) : [];
  tableInfoCache[name] = cols;
  return cols;
}

function renderDataTab() {
  if (!activeTable) return;
  const cols = getTableInfo(activeTable);
  const colNames = cols.length ? cols.map(c => c.name) : inferColumnsFromSelect(activeTable);

  const safeTable = `"${activeTable.replace(/"/g, '""')}"`;
  const whereClause = buildSearchWhere(colNames, rowSearchTerm);

  let totalRows = 0;
  try {
    const countRes = db.exec(`SELECT COUNT(*) FROM ${safeTable} ${whereClause.sql}`, whereClause.params);
    totalRows = countRes[0]?.values?.[0]?.[0] ?? 0;
  } catch (e) {
    renderQueryStyleError(dbxTableWrap, e);
    dbxPagination.innerHTML = "";
    dbxRowCount.textContent = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const orderClause = sortState.col
    ? ` ORDER BY "${sortState.col.replace(/"/g, '""')}" ${sortState.dir === "desc" ? "DESC" : "ASC"}`
    : "";

  let dataRes;
  try {
    dataRes = db.exec(
      `SELECT * FROM ${safeTable} ${whereClause.sql}${orderClause} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      whereClause.params
    );
  } catch (e) {
    renderQueryStyleError(dbxTableWrap, e);
    dbxPagination.innerHTML = "";
    dbxRowCount.textContent = "";
    return;
  }

  const result = dataRes[0];
  dbxRowCount.textContent = totalRows.toLocaleString() + (totalRows === 1 ? " row" : " rows") +
    (rowSearchTerm ? " (filtered)" : "");

  if (!result || !result.values.length) {
    dbxTableWrap.innerHTML = `<div class="dbx-empty-hint">No rows ${rowSearchTerm ? "match your search" : "in this table"}.</div>`;
    dbxPagination.innerHTML = "";
    return;
  }

  const pkSet = new Set(cols.filter(c => c.pk).map(c => c.name));
  dbxTableWrap.innerHTML = renderDataTable(result.columns, result.values, cols, pkSet);

  dbxTableWrap.querySelectorAll("th[data-col]").forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (sortState.col === col) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState = { col, dir: "asc" };
      }
      renderDataTab();
    });
  });

  renderPagination(totalPages);
}

function renderDataTable(columns, rows, colInfo, pkSet) {
  const typeMap = {};
  colInfo.forEach(c => typeMap[c.name] = c.type);

  const head = columns.map(c => {
    const isSorted = sortState.col === c;
    const arrow = isSorted ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";
    return `<th data-col="${escapeAttr(c)}">${escapeHtml(c)}${pkSet.has(c) ? '<span class="dbx-pk-badge">PK</span>' : ""}${arrow}
      ${typeMap[c] ? `<span class="dbx-col-type">${escapeHtml(typeMap[c])}</span>` : ""}
    </th>`;
  }).join("");

  const body = rows.map(row => {
    const cells = row.map(val => {
      if (val === null) return `<td><span class="dbx-cell-null">NULL</span></td>`;
      let display = val;
      if (typeof val === "object" && val instanceof Uint8Array) {
        display = `<BLOB ${val.length}b>`;
      }
      const str = String(display);
      const truncated = str.length > 200 ? str.slice(0, 200) + "…" : str;
      return `<td title="${escapeAttr(str)}">${escapeHtml(truncated)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderPagination(totalPages) {
  if (totalPages <= 1) { dbxPagination.innerHTML = ""; return; }

  const makeBtn = (label, page, disabled, active) =>
    `<button class="dbx-page-btn ${active ? "active" : ""}" data-page="${page}" ${disabled ? "disabled" : ""}>${label}</button>`;

  let html = "";
  html += makeBtn("« First", 1, currentPage === 1, false);
  html += makeBtn("‹ Prev", currentPage - 1, currentPage === 1, false);

  const pages = pageWindow(currentPage, totalPages);
  pages.forEach(p => {
    if (p === "...") {
      html += `<span class="dbx-page-status">…</span>`;
    } else {
      html += makeBtn(String(p), p, false, p === currentPage);
    }
  });

  html += makeBtn("Next ›", currentPage + 1, currentPage === totalPages, false);
  html += makeBtn("Last »", totalPages, currentPage === totalPages, false);

  dbxPagination.innerHTML = html;
  dbxPagination.querySelectorAll(".dbx-page-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentPage = Number(btn.dataset.page);
      renderDataTab();
      dbxTableWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function pageWindow(current, total) {
  const span = 1;
  const pages = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || (p >= current - span && p <= current + span)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }
  return pages;
}

let rowSearchDebounce = null;
dbxRowSearch.addEventListener("input", () => {
  clearTimeout(rowSearchDebounce);
  rowSearchDebounce = setTimeout(() => {
    rowSearchTerm = dbxRowSearch.value.trim();
    currentPage = 1;
    renderDataTab();
  }, 250);
});

function buildSearchWhere(colNames, term) {
  if (!term || !colNames.length) return { sql: "", params: [] };
  const likeParam = `%${term}%`;
  const conditions = colNames.map(c => `CAST("${c.replace(/"/g, '""')}" AS TEXT) LIKE ?`);
  return { sql: "WHERE " + conditions.join(" OR "), params: colNames.map(() => likeParam) };
}

function inferColumnsFromSelect(table) {
  try {
    const res = db.exec(`SELECT * FROM "${table.replace(/"/g, '""')}" LIMIT 1`);
    return res[0]?.columns || [];
  } catch (e) { return []; }
}

function renderSchemaForActive() {
  if (!activeTable) {
    dbxSchemaContent.innerHTML = `<div class="dbx-empty-hint">Select a table on the left to see its schema.</div>`;
    return;
  }
  const cols = getTableInfo(activeTable);
  const fkRes = db.exec(`PRAGMA foreign_key_list("${activeTable.replace(/"/g, '""')}")`);
  const fks = fkRes[0] ? fkRes[0].values.map(v => ({ from: v[3], table: v[2], to: v[4] })) : [];
  const idxRes = db.exec(`PRAGMA index_list("${activeTable.replace(/"/g, '""')}")`);
  const indexes = idxRes[0] ? idxRes[0].values.map(v => ({ name: v[1], unique: v[2] })) : [];

  const createSqlRes = db.exec(
    `SELECT sql FROM sqlite_master WHERE name = '${activeTable.replace(/'/g, "''")}'`
  );
  const createSql = createSqlRes[0]?.values?.[0]?.[0] || "";

  const colRows = cols.map(c => `
    <tr>
      <td>${escapeHtml(c.name)}${c.pk ? '<span class="dbx-pk-badge">PK</span>' : ""}</td>
      <td>${escapeHtml(c.type || "—")}</td>
      <td>${c.notnull ? "NOT NULL" : ""}</td>
      <td>${c.dflt === null ? "" : escapeHtml(String(c.dflt))}</td>
    </tr>
  `).join("");

  const fkRows = fks.length
    ? `<div class="dbx-schema-table"><h3>Foreign keys</h3>
        <table><thead><tr><th>Column</th><th>References</th></tr></thead><tbody>
        ${fks.map(f => `<tr><td>${escapeHtml(f.from)}</td><td>${escapeHtml(f.table)}.${escapeHtml(f.to)}</td></tr>`).join("")}
        </tbody></table></div>`
    : "";

  const idxRows = indexes.length
    ? `<div class="dbx-schema-table"><h3>Indexes</h3>
        <table><thead><tr><th>Name</th><th>Unique</th></tr></thead><tbody>
        ${indexes.map(i => `<tr><td>${escapeHtml(i.name)}</td><td>${i.unique ? "Yes" : "No"}</td></tr>`).join("")}
        </tbody></table></div>`
    : "";

  dbxSchemaContent.innerHTML = `
    <div class="dbx-schema-table">
      <h3>${escapeHtml(activeTable)} <span class="dbx-row-badge">${cols.length} column${cols.length === 1 ? "" : "s"}</span></h3>
      <div class="dbx-table-wrap">
        <table>
          <thead><tr><th>Column</th><th>Type</th><th>Constraint</th><th>Default</th></tr></thead>
          <tbody>${colRows}</tbody>
        </table>
      </div>
    </div>
    ${fkRows}
    ${idxRows}
    ${createSql ? `<div class="dbx-schema-table"><h3>CREATE statement</h3><div class="dbx-create-sql">${escapeHtml(createSql)}</div></div>` : ""}
  `;
}

const ALLOWED_QUERY_PREFIX = /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i;
const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|VACUUM|REINDEX|TRIGGER)\b/i;

dbxRunQueryBtn.addEventListener("click", runUserQuery);
dbxSqlInput.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runUserQuery();
});

function runUserQuery() {
  const sql = dbxSqlInput.value.trim();
  dbxQueryError.style.display = "none";
  dbxQueryResult.innerHTML = "";

  if (!sql) return;

  if (!ALLOWED_QUERY_PREFIX.test(sql)) {
    showQueryError("Only SELECT, WITH, PRAGMA, or EXPLAIN statements are allowed in this read-only viewer.");
    return;
  }
  if (FORBIDDEN_KEYWORDS.test(sql)) {
    showQueryError("This query contains a statement that modifies the database, which isn't allowed here.");
    return;
  }
  if (sql.split(";").filter(s => s.trim()).length > 1) {
    showQueryError("Please run one statement at a time.");
    return;
  }

  try {
    const res = db.exec(sql);
    if (!res.length) {
      dbxQueryResult.innerHTML = `<div class="dbx-empty-hint">Query ran successfully and returned no rows.</div>`;
      return;
    }
    const { columns, values } = res[0];
    if (!values.length) {
      dbxQueryResult.innerHTML = `<div class="dbx-empty-hint">No rows returned.</div>`;
      return;
    }
    dbxQueryResult.innerHTML = renderDataTable(columns, values, [], new Set());
  } catch (e) {
    showQueryError(e.message || String(e));
  }
}

function showQueryError(msg) {
  dbxQueryError.textContent = msg;
  dbxQueryError.style.display = "block";
}

function renderQueryStyleError(target, e) {
  target.innerHTML = `<div class="search-error" style="margin:10px 0;">${escapeHtml(e.message || String(e))}</div>`;
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
