/* ==========================================================================
   equipSchema.js — equipment editor: database schema & migrations.
   Load it before equipment.js (see equipment.html). Declarations only:
   everything here is called later from equipment.js handlers.
   ========================================================================== */

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
 
CREATE TABLE IF NOT EXISTS kvks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom TEXT,
  kvk_number INTEGER,
  name TEXT,
  is_latest INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kvks_unique ON kvks (kingdom, kvk_number);
 
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kvk_id INTEGER,
  snapshot_date TEXT,
  is_last INTEGER DEFAULT 0,
  UNIQUE (kvk_id, snapshot_date),
  FOREIGN KEY (kvk_id) REFERENCES kvks(id)
);
 
CREATE TABLE IF NOT EXISTS governors (
  governor_id TEXT,
  kingdom TEXT,
  name TEXT,
  PRIMARY KEY (governor_id, kingdom)
);
 
CREATE TABLE IF NOT EXISTS stats (
  snapshot_id INTEGER,
  governor_id TEXT,
  power INTEGER,
  kill_points INTEGER,
  t4 INTEGER,
  t5 INTEGER,
  deads INTEGER,
  power_diff INTEGER,
  kp_diff INTEGER,
  t4_diff INTEGER,
  t5_diff INTEGER,
  deads_diff INTEGER,
  min_dkp INTEGER,
  dkp INTEGER,
  dkp_percent REAL,
  sum_min_dkp INTEGER,
  sum_dkp INTEGER,
  sum_dkp_percent REAL,
  vacation TEXT,
  status TEXT,
  acclaim INTEGER,
  PRIMARY KEY (snapshot_id, governor_id),
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
);
 
CREATE TABLE IF NOT EXISTS equipment (
  player_id INTEGER PRIMARY KEY,
  name TEXT,
  acc_type TEXT,
  helm TEXT, helm_lvl INTEGER, helm_tal TEXT,
  chest TEXT, chest_lvl INTEGER, chest_tal TEXT,
  weapon TEXT, weapon_lvl INTEGER, weapon_tal TEXT,
  gloves TEXT, gloves_lvl INTEGER, gloves_tal TEXT,
  legs TEXT, legs_lvl INTEGER, legs_tal TEXT,
  accessory TEXT, accessory_lvl INTEGER, accessory_tal TEXT,
  accessory_sec TEXT, accessory_sec_lvl INTEGER, accessory_sec_tal TEXT,
  boots TEXT, boots_lvl INTEGER, boots_tal TEXT,
  helm_2 TEXT, helm_lvl_2 INTEGER, helm_tal_2 TEXT,
  chest_2 TEXT, chest_lvl_2 INTEGER, chest_tal_2 TEXT,
  weapon_2 TEXT, weapon_lvl_2 INTEGER, weapon_tal_2 TEXT,
  gloves_2 TEXT, gloves_lvl_2 INTEGER, gloves_tal_2 TEXT,
  legs_2 TEXT, legs_lvl_2 INTEGER, legs_tal_2 TEXT,
  accessory_2 TEXT, accessory_lvl_2 INTEGER, accessory_tal_2 TEXT,
  accessory_sec_2 TEXT, accessory_sec_lvl_2 INTEGER, accessory_sec_tal_2 TEXT,
  boots_2 TEXT, boots_lvl_2 INTEGER, boots_tal_2 TEXT,
  helm_3 TEXT, helm_lvl_3 INTEGER, helm_tal_3 TEXT,
  chest_3 TEXT, chest_lvl_3 INTEGER, chest_tal_3 TEXT,
  weapon_3 TEXT, weapon_lvl_3 INTEGER, weapon_tal_3 TEXT,
  gloves_3 TEXT, gloves_lvl_3 INTEGER, gloves_tal_3 TEXT,
  legs_3 TEXT, legs_lvl_3 INTEGER, legs_tal_3 TEXT,
  accessory_3 TEXT, accessory_lvl_3 INTEGER, accessory_tal_3 TEXT,
  accessory_sec_3 TEXT, accessory_sec_lvl_3 INTEGER, accessory_sec_tal_3 TEXT,
  boots_3 TEXT, boots_lvl_3 INTEGER, boots_tal_3 TEXT,
  helm_4 TEXT, helm_lvl_4 INTEGER, helm_tal_4 TEXT,
  chest_4 TEXT, chest_lvl_4 INTEGER, chest_tal_4 TEXT,
  weapon_4 TEXT, weapon_lvl_4 INTEGER, weapon_tal_4 TEXT,
  gloves_4 TEXT, gloves_lvl_4 INTEGER, gloves_tal_4 TEXT,
  legs_4 TEXT, legs_lvl_4 INTEGER, legs_tal_4 TEXT,
  accessory_4 TEXT, accessory_lvl_4 INTEGER, accessory_tal_4 TEXT,
  accessory_sec_4 TEXT, accessory_sec_lvl_4 INTEGER, accessory_sec_tal_4 TEXT,
  boots_4 TEXT, boots_lvl_4 INTEGER, boots_tal_4 TEXT,
  helm_5 TEXT, helm_lvl_5 INTEGER, helm_tal_5 TEXT,
  chest_5 TEXT, chest_lvl_5 INTEGER, chest_tal_5 TEXT,
  weapon_5 TEXT, weapon_lvl_5 INTEGER, weapon_tal_5 TEXT,
  gloves_5 TEXT, gloves_lvl_5 INTEGER, gloves_tal_5 TEXT,
  legs_5 TEXT, legs_lvl_5 INTEGER, legs_tal_5 TEXT,
  accessory_5 TEXT, accessory_lvl_5 INTEGER, accessory_tal_5 TEXT,
  accessory_sec_5 TEXT, accessory_sec_lvl_5 INTEGER, accessory_sec_tal_5 TEXT,
  boots_5 TEXT, boots_lvl_5 INTEGER, boots_tal_5 TEXT,
  helm_6 TEXT, helm_lvl_6 INTEGER, helm_tal_6 TEXT,
  chest_6 TEXT, chest_lvl_6 INTEGER, chest_tal_6 TEXT,
  weapon_6 TEXT, weapon_lvl_6 INTEGER, weapon_tal_6 TEXT,
  gloves_6 TEXT, gloves_lvl_6 INTEGER, gloves_tal_6 TEXT,
  legs_6 TEXT, legs_lvl_6 INTEGER, legs_tal_6 TEXT,
  accessory_6 TEXT, accessory_lvl_6 INTEGER, accessory_tal_6 TEXT,
  accessory_sec_6 TEXT, accessory_sec_lvl_6 INTEGER, accessory_sec_tal_6 TEXT,
  boots_6 TEXT, boots_lvl_6 INTEGER, boots_tal_6 TEXT,
  helm_7 TEXT, helm_lvl_7 INTEGER, helm_tal_7 TEXT,
  chest_7 TEXT, chest_lvl_7 INTEGER, chest_tal_7 TEXT,
  weapon_7 TEXT, weapon_lvl_7 INTEGER, weapon_tal_7 TEXT,
  gloves_7 TEXT, gloves_lvl_7 INTEGER, gloves_tal_7 TEXT,
  legs_7 TEXT, legs_lvl_7 INTEGER, legs_tal_7 TEXT,
  accessory_7 TEXT, accessory_lvl_7 INTEGER, accessory_tal_7 TEXT,
  accessory_sec_7 TEXT, accessory_sec_lvl_7 INTEGER, accessory_sec_tal_7 TEXT,
  boots_7 TEXT, boots_lvl_7 INTEGER, boots_tal_7 TEXT,
  pair1_comm1 TEXT, pair1_comm2 TEXT,
  pair2_comm1 TEXT, pair2_comm2 TEXT,
  pair3_comm1 TEXT, pair3_comm2 TEXT,
  pair4_comm1 TEXT, pair4_comm2 TEXT,
  pair5_comm1 TEXT, pair5_comm2 TEXT,
  pair6_comm1 TEXT, pair6_comm2 TEXT,
  pair7_comm1 TEXT, pair7_comm2 TEXT,
  pair8_comm1 TEXT, pair8_comm2 TEXT,
  pair9_comm1 TEXT, pair9_comm2 TEXT,
  pair10_comm1 TEXT, pair10_comm2 TEXT,
  pair11_comm1 TEXT, pair11_comm2 TEXT,
  pair12_comm1 TEXT, pair12_comm2 TEXT
);
 
__ARMAMENTS_TABLE__;
 
CREATE TABLE IF NOT EXISTS player_profile (
  player_id INTEGER PRIMARY KEY,
  vip_level INTEGER,
  city_skin TEXT
);
 
CREATE TABLE IF NOT EXISTS skins (
  player_id INTEGER PRIMARY KEY,
  name TEXT,
  skin1 TEXT,
  skin2 TEXT,
  skin3 TEXT,
  skin4 TEXT,
  skin5 TEXT,
  skin6 TEXT,
  skin7 TEXT,
  skin8 TEXT
);
 
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT
);
 
CREATE TABLE IF NOT EXISTS farm_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  player_id INTEGER UNIQUE,
  power INTEGER,
  killpoints INTEGER,
  deads INTEGER,
  ch INTEGER,
  acc_type TEXT,
  main_id INTEGER
);
`;

/* CREATE TABLE for armaments, built from the slot definitions (armour slots x inscriptions x stats). */
function buildArmamentsTableSql(armCount = ARM_COUNT) {
  const cols = ["player_id INTEGER PRIMARY KEY", "name TEXT"];
  for (let n = 1; n <= armCount; n++) {
    const p = `arm${n}`;
    cols.push(`${p} TEXT`);
    ARM_INS_KEYS.forEach((k) => cols.push(`${p}${k} TEXT`));
    ARM_STAT_DEFS.forEach((s) => {
      cols.push(`${p}${s.nameKey} TEXT`, `${p}${s.valKey} REAL`);
    });
  }
  return `CREATE TABLE IF NOT EXISTS armaments (\n  ${cols.join(",\n  ")}\n)`;
}

function getSchemaSql() {
  return SCHEMA_SQL.replace("__ARMAMENTS_TABLE__", buildArmamentsTableSql());
}

async function createDatabase() {
  const btn = document.getElementById("createDbBtn");
  const origHtml = btn.innerHTML;

  if (!SQL) {
    btn.textContent = "Loading sql.js…";
    btn.disabled = true;
    for (let i = 0; i < 50 && !SQL; i++)
      await new Promise((r) => setTimeout(r, 100));
    btn.disabled = false;
    btn.innerHTML = origHtml;
    if (!SQL) {
      showToast("sql.js failed to load. Cannot create database.");
      return;
    }
  }

  try {
    btn.textContent = "Creating…";
    btn.disabled = true;

    const newDb = new SQL.Database();
    newDb.run("PRAGMA foreign_keys = ON;");

    const stmts = getSchemaSql().split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of stmts) {
      try {
        newDb.run(stmt + ";");
      } catch (e) {}
    }
    ensureEquipmentMarchColumns(newDb);

    const bytes = newDb.export();
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kvk.db";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    newDb.close();

    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/></svg> Created!`;
    setTimeout(() => {
      btn.innerHTML = origHtml;
      btn.disabled = false;
    }, 2500);
  } catch (e) {
    console.error("createDatabase:", e);
    btn.innerHTML = origHtml;
    btn.disabled = false;
    showToast("Failed to create database: " + e.message);
  }
}

function ensureAppSchema() {
  if (!db) return;
  const stmts = getSchemaSql().split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of stmts) {
    try {
      db.run(stmt + ";");
    } catch (e) {
      console.warn("schema update skipped:", e);
    }
  }
  try {
    const cols = db.exec("PRAGMA table_info(stats)");
    const existing = new Set(
      cols.length ? cols[0].values.map((r) => r[1]) : [],
    );
    [
      ["sum_min_dkp", "INTEGER"],
      ["sum_dkp", "INTEGER"],
      ["sum_dkp_percent", "REAL"],
    ].forEach(([name, type]) => {
      if (!existing.has(name))
        db.run(`ALTER TABLE stats ADD COLUMN ${name} ${type}`);
    });
  } catch (e) {
    console.warn("stats migration skipped:", e);
  }
  ensureEquipmentMarchColumns(db);
}

function ensureColumnsExist(targetDb, table, colDefs) {
  if (!targetDb) return;
  try {
    const t = targetDb.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`,
    );
    if (!t.length || !t[0].values.length) return;

    const cols = targetDb.exec(`PRAGMA table_info(${table})`);
    const existing = new Set(
      cols.length ? cols[0].values.map((r) => r[1]) : [],
    );

    for (const [name, type] of colDefs) {
      if (!existing.has(name)) {
        targetDb.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
        existing.add(name);
      }
    }
  } catch (e) {
    console.warn(`${table} migration skipped:`, e);
  }
}

function ensureEquipmentMarchColumns(targetDb = db) {
  const defs = [];
  for (let mi = 7; mi < MARCH_COUNT; mi++) {
    for (const slot of EQUIP_SLOTS) {
      defs.push([colKey(slot.key, mi), "TEXT"]);
      defs.push([lvlKey(slot.key, mi), "INTEGER"]);
      defs.push([talKey(slot.key, mi), "TEXT"]);
    }
  }
  ensureColumnsExist(targetDb, "equipment", defs);
}

function ensurePairColumns(targetDb = db) {
  const defs = [];
  for (let n = 1; n <= PAIR_COUNT; n++) {
    defs.push([`pair${n}_comm1`, "TEXT"]);
    defs.push([`pair${n}_comm2`, "TEXT"]);
  }
  ensureColumnsExist(targetDb, "equipment", defs);
}

function ensureArmColumns(targetDb = db) {
  const defs = [];
  for (let n = 1; n <= ARM_COUNT; n++) {
    const p = `arm${n}`;
    defs.push([p, "TEXT"]);
    ARM_INS_KEYS.forEach((k) => defs.push([`${p}${k}`, "TEXT"]));
    ARM_STAT_DEFS.forEach((s) => {
      defs.push([`${p}${s.nameKey}`, "TEXT"]);
      defs.push([`${p}${s.valKey}`, "REAL"]);
    });
  }
  ensureColumnsExist(targetDb, "armaments", defs);
}

function ensureSkinColumns(targetDb = db) {
  const defs = [];
  for (let n = 1; n <= SKIN_COUNT; n++) defs.push([`skin${n}`, "TEXT"]);
  ensureColumnsExist(targetDb, "skins", defs);
}

function ensureAllSlotColumns(targetDb = db) {
  ensureEquipmentMarchColumns(targetDb);
  ensurePairColumns(targetDb);
  ensureArmColumns(targetDb);
  ensureSkinColumns(targetDb);
}

function getConfigInt(key, fallback) {
  if (!db) return fallback;
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='app_config'`,
    );
    if (!t.length || !t[0].values.length) return fallback;
    const res = db.exec(`SELECT value FROM app_config WHERE key=?`, [key]);
    if (res.length && res[0].values.length) {
      const v = parseInt(res[0].values[0][0], 10);
      if (!isNaN(v)) return v;
    }
  } catch (e) {}
  return fallback;
}

function setConfigInt(key, value) {
  if (!db) return;
  try {
    db.run(
      `CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT)`,
    );
    db.run(
      `INSERT INTO app_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, String(value)],
    );
  } catch (e) {
    console.warn("config save failed:", e);
  }
}
