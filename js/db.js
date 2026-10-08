/* ==========================================================================
   db.js — loads kvk.db once per page (sql.js) and offers small query helpers.
   Depends on: common.js (getSqlJs), sql.js.
   Every page that needs the database uses the SAME url (kvk.db?v=…) so the
   browser downloads it once, and bumping DB_VERSION busts the cache everywhere.
   ========================================================================== */

const DB_VERSION = "13";
const FIRST_KVK_WITH_SUMS = 8;

let db = null;
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await getSqlJs();
      const res = await fetch(`kvk.db?v=${DB_VERSION}`);
      if (!res.ok) throw new Error(`Could not load kvk.db (HTTP ${res.status})`);
      db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
      ensureStatsSchema(db);
      return db;
    })();
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function ensureStatsSchema(database) {
  const cols = database.exec("PRAGMA table_info(stats)");
  const existing = new Set(cols.length ? cols[0].values.map((r) => r[1]) : []);
  [
    ["sum_min_dkp", "INTEGER"],
    ["sum_dkp", "INTEGER"],
    ["sum_dkp_percent", "REAL"],
  ].forEach(([name, type]) => {
    if (!existing.has(name))
      database.run(`ALTER TABLE stats ADD COLUMN ${name} ${type}`);
  });
}

function dbAll(database, sql, params = []) {
  const stmt = database.prepare(sql);
  try {
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function dbGet(database, sql, params = []) {
  return dbAll(database, sql, params)[0] ?? null;
}

function dbHasTable(database, name) {
  return Boolean(
    dbGet(database, "SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name=?", [name]),
  );
}

function toNumericIds(values) {
  return [...new Set(values.map(normalizeNumericId).filter(Boolean))].map(Number);
}

function sqlPlaceholders(count) {
  return Array(count).fill("?").join(",");
}

function kvkHasSums(kvkNumber) {
  return !(Number(kvkNumber) < FIRST_KVK_WITH_SUMS);
}
