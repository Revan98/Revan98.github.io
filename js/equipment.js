"use strict";

const EQUIP_SLOTS = [
  { key: "helm",          label: "Helm"      },
  { key: "chest",         label: "Chest"     },
  { key: "weapon",        label: "Weapon"    },
  { key: "gloves",        label: "Gloves"    },
  { key: "legs",          label: "Legs"      },
  { key: "boots",         label: "Boots"     },
  { key: "accessory",     label: "Accessory" },
  { key: "accessory_sec", label: "Acc. 2"    },
];

const MARCH_COUNT = 12;
const PAIR_COUNT  = 12;

let SQL    = null;
let db     = null;

let currentMarch   = 1;
let activeTab      = "equipment";

const marchData = Array.from({ length: MARCH_COUNT }, () =>
  Object.fromEntries(EQUIP_SLOTS.map(s => [s.key, { item: "", awk: "", tal: "" }]))
);

const pairsData = Array.from({ length: PAIR_COUNT }, () => ({ comm1: "", comm2: "" }));

let pickerTarget       = null;
let pickerSelectedItem = "";
let allIconNames       = [];
let allCommNames       = [];

function normalizeNumericId(value) {
  const id = String(value ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}

(async () => {
  try {
    SQL = await initSqlJs({
      locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${f}`,
    });
  } catch (e) { console.error("sql.js init failed:", e); }
  await loadIconManifest();
})();

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
 
CREATE TABLE IF NOT EXISTS armaments (
  player_id INTEGER PRIMARY KEY,
  name TEXT,
  arm1 TEXT,
  arm1_ins TEXT, arm1_ins2 TEXT, arm1_ins3 TEXT, arm1_ins4 TEXT,
  arm1_ins5 TEXT, arm1_ins6 TEXT, arm1_ins7 TEXT, arm1_ins8 TEXT,
  arm1_stat_name TEXT, arm1_stat REAL,
  arm1_stat2_name2 TEXT, arm1_stat2 REAL,
  arm1_stat3_name3 TEXT, arm1_stat3 REAL,
  arm1_stat4_name4 TEXT, arm1_stat4 REAL,
  arm2 TEXT,
  arm2_ins TEXT, arm2_ins2 TEXT, arm2_ins3 TEXT, arm2_ins4 TEXT,
  arm2_ins5 TEXT, arm2_ins6 TEXT, arm2_ins7 TEXT, arm2_ins8 TEXT,
  arm2_stat_name TEXT, arm2_stat REAL,
  arm2_stat2_name2 TEXT, arm2_stat2 REAL,
  arm2_stat3_name3 TEXT, arm2_stat3 REAL,
  arm2_stat4_name4 TEXT, arm2_stat4 REAL,
  arm3 TEXT,
  arm3_ins TEXT, arm3_ins2 TEXT, arm3_ins3 TEXT, arm3_ins4 TEXT,
  arm3_ins5 TEXT, arm3_ins6 TEXT, arm3_ins7 TEXT, arm3_ins8 TEXT,
  arm3_stat_name TEXT, arm3_stat REAL,
  arm3_stat2_name2 TEXT, arm3_stat2 REAL,
  arm3_stat3_name3 TEXT, arm3_stat3 REAL,
  arm3_stat4_name4 TEXT, arm3_stat4 REAL,
  arm4 TEXT,
  arm4_ins TEXT, arm4_ins2 TEXT, arm4_ins3 TEXT, arm4_ins4 TEXT,
  arm4_ins5 TEXT, arm4_ins6 TEXT, arm4_ins7 TEXT, arm4_ins8 TEXT,
  arm4_stat_name TEXT, arm4_stat REAL,
  arm4_stat2_name2 TEXT, arm4_stat2 REAL,
  arm4_stat3_name3 TEXT, arm4_stat3 REAL,
  arm4_stat4_name4 TEXT, arm4_stat4 REAL,
  arm5 TEXT,
  arm5_ins TEXT, arm5_ins2 TEXT, arm5_ins3 TEXT, arm5_ins4 TEXT,
  arm5_ins5 TEXT, arm5_ins6 TEXT, arm5_ins7 TEXT, arm5_ins8 TEXT,
  arm5_stat_name TEXT, arm5_stat REAL,
  arm5_stat2_name2 TEXT, arm5_stat2 REAL,
  arm5_stat3_name3 TEXT, arm5_stat3 REAL,
  arm5_stat4_name4 TEXT, arm5_stat4 REAL,
  arm6 TEXT,
  arm6_ins TEXT, arm6_ins2 TEXT, arm6_ins3 TEXT, arm6_ins4 TEXT,
  arm6_ins5 TEXT, arm6_ins6 TEXT, arm6_ins7 TEXT, arm6_ins8 TEXT,
  arm6_stat_name TEXT, arm6_stat REAL,
  arm6_stat2_name2 TEXT, arm6_stat2 REAL,
  arm6_stat3_name3 TEXT, arm6_stat3 REAL,
  arm6_stat4_name4 TEXT, arm6_stat4 REAL,
  arm7 TEXT,
  arm7_ins TEXT, arm7_ins2 TEXT, arm7_ins3 TEXT, arm7_ins4 TEXT,
  arm7_ins5 TEXT, arm7_ins6 TEXT, arm7_ins7 TEXT, arm7_ins8 TEXT,
  arm7_stat_name TEXT, arm7_stat REAL,
  arm7_stat2_name2 TEXT, arm7_stat2 REAL,
  arm7_stat3_name3 TEXT, arm7_stat3 REAL,
  arm7_stat4_name4 TEXT, arm7_stat4 REAL,
  arm8 TEXT,
  arm8_ins TEXT, arm8_ins2 TEXT, arm8_ins3 TEXT, arm8_ins4 TEXT,
  arm8_ins5 TEXT, arm8_ins6 TEXT, arm8_ins7 TEXT, arm8_ins8 TEXT,
  arm8_stat_name TEXT, arm8_stat REAL,
  arm8_stat2_name2 TEXT, arm8_stat2 REAL,
  arm8_stat3_name3 TEXT, arm8_stat3 REAL,
  arm8_stat4_name4 TEXT, arm8_stat4 REAL
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
 
document.getElementById("createDbBtn").addEventListener("click", createDatabase);
 
async function createDatabase() {
  const btn = document.getElementById("createDbBtn");
  const origHtml = btn.innerHTML;
 
  if (!SQL) {
    btn.textContent = "Loading sql.js…";
    btn.disabled = true;
    for (let i = 0; i < 50 && !SQL; i++) await new Promise(r => setTimeout(r, 100));
    btn.disabled = false;
    btn.innerHTML = origHtml;
    if (!SQL) { alert("sql.js failed to load. Cannot create database."); return; }
  }
 
  try {
    btn.textContent = "Creating…";
    btn.disabled = true;
 
    const newDb = new SQL.Database();
    newDb.run("PRAGMA foreign_keys = ON;");
 
    const stmts = SCHEMA_SQL.split(";").map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of stmts) {
      try { newDb.run(stmt + ";"); } catch (e) { }
    }
    ensureEquipmentMarchColumns(newDb);
 
    const bytes = newDb.export();
    const blob  = new Blob([bytes], { type: "application/octet-stream" });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href     = url;
    a.download = "kvk.db";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
 
    newDb.close();
 
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/></svg> Created!`;
    setTimeout(() => { btn.innerHTML = origHtml; btn.disabled = false; }, 2500);
  } catch (e) {
    console.error("createDatabase:", e);
    btn.innerHTML = origHtml;
    btn.disabled = false;
    alert("Failed to create database: " + e.message);
  }
}

const THEME_KEY   = "theme";
const themeToggle = document.getElementById("toggle-theme");

function applyTheme(t) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(t);
  localStorage.setItem(THEME_KEY, t);
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = (saved === "light" || saved === "dark") ? saved
    : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(theme);
  themeToggle.checked = theme === "dark";
}
themeToggle.addEventListener("change", () => applyTheme(themeToggle.checked ? "dark" : "light"));
initTheme();

const hamburger = document.getElementById("hamburger");
const navLinks  = document.getElementById("nav-links");
hamburger.addEventListener("click", () => {
  navLinks.classList.toggle("show");
  hamburger.classList.toggle("open");
});
document.addEventListener("click", e => {
  if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
    navLinks.classList.remove("show");
    hamburger.classList.remove("open");
  }
});
document.querySelectorAll(".nav-links a").forEach(link => {
  if (link.getAttribute("href") === location.pathname.split("/").pop())
    link.classList.add("active");
});

const dbFileInput = document.getElementById("dbFileInput");
const dbFileName  = document.getElementById("dbFileName");
const dbStatus    = document.getElementById("dbStatus");
const loadGovBtn  = document.getElementById("loadGovBtn");
const saveBtn     = document.getElementById("saveBtn");
const newGovBtn   = document.getElementById("newGovBtn");
const farmFileInput    = document.getElementById("farmFileInput");
const farmImportBtn    = document.getElementById("farmImportBtn");
const farmImportStatus = document.getElementById("farmImportStatus");
const kvkFileInput     = document.getElementById("kvkFileInput");
const kvkImportBtn     = document.getElementById("kvkImportBtn");
const kvkImportStatus  = document.getElementById("kvkImportStatus");
const kvkKingdomInput  = document.getElementById("kvkKingdomInput");
const kvkNumberInput   = document.getElementById("kvkNumberInput");
const kvkNameInput     = document.getElementById("kvkNameInput");

document.getElementById("dbFileLabel").addEventListener("click", () => dbFileInput.click());

dbFileInput.addEventListener("change", async () => {
  const file = dbFileInput.files[0];
  if (!file) return;
  dbFileName.textContent = file.name;
  setDbStatus("Loading…", "");

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    db = new SQL.Database(bytes);
    db.exec("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1");
    ensureAppSchema();
    setDbStatus("✓ Loaded", "ok");
    loadGovBtn.disabled = false;
    saveBtn.disabled    = false;
    newGovBtn.disabled  = false;
    updateImportButtons();
    preloadIconsFromDb();
  } catch (e) {
    setDbStatus("✗ Invalid DB", "err");
    db = null;
    loadGovBtn.disabled = true;
    saveBtn.disabled    = true;
    newGovBtn.disabled  = true;
    updateImportButtons();
    console.error(e);
  }
});

function setDbStatus(msg, cls) {
  dbStatus.textContent = msg;
  dbStatus.className   = "eq-db-status" + (cls ? " " + cls : "");
}

function updateImportButtons() {
  if (farmImportBtn) farmImportBtn.disabled = !db || !farmFileInput?.files?.length;
  if (kvkImportBtn) {
    kvkImportBtn.disabled = !db || !kvkFileInput?.files?.length ||
      !kvkKingdomInput?.value.trim() || !Number(kvkNumberInput?.value);
  }
}

function setImportStatus(el, msg, cls) {
  if (!el) return;
  el.textContent = msg;
  el.className = "eq-import-status" + (cls ? " " + cls : "");
}

function ensureAppSchema() {
  if (!db) return;
  const stmts = SCHEMA_SQL.split(";").map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    try { db.run(stmt + ";"); } catch (e) { console.warn("schema update skipped:", e); }
  }
  try {
    const cols = db.exec("PRAGMA table_info(stats)");
    const existing = new Set(cols.length ? cols[0].values.map(r => r[1]) : []);
    [
      ["sum_min_dkp", "INTEGER"],
      ["sum_dkp", "INTEGER"],
      ["sum_dkp_percent", "REAL"],
    ].forEach(([name, type]) => {
      if (!existing.has(name)) db.run(`ALTER TABLE stats ADD COLUMN ${name} ${type}`);
    });
  } catch (e) { console.warn("stats migration skipped:", e); }
  ensureEquipmentMarchColumns(db);
}

function ensureEquipmentMarchColumns(targetDb = db) {
  if (!targetDb) return;
  try {
    const table = targetDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='equipment'");
    if (!table.length || !table[0].values.length) return;

    const cols = targetDb.exec("PRAGMA table_info(equipment)");
    const existing = new Set(cols.length ? cols[0].values.map(r => r[1]) : []);

    for (let mi = 7; mi < MARCH_COUNT; mi++) {
      for (const slot of EQUIP_SLOTS) {
        const defs = [
          [colKey(slot.key, mi), "TEXT"],
          [lvlKey(slot.key, mi), "INTEGER"],
          [talKey(slot.key, mi), "TEXT"],
        ];
        for (const [name, type] of defs) {
          if (!existing.has(name)) {
            targetDb.run(`ALTER TABLE equipment ADD COLUMN ${name} ${type}`);
            existing.add(name);
          }
        }
      }
    }
  } catch (e) {
    console.warn("equipment march migration skipped:", e);
  }
}

farmFileInput?.addEventListener("change", updateImportButtons);
kvkFileInput?.addEventListener("change", updateImportButtons);
kvkKingdomInput?.addEventListener("input", updateImportButtons);
kvkNumberInput?.addEventListener("input", updateImportButtons);
kvkNameInput?.addEventListener("input", updateImportButtons);
farmImportBtn?.addEventListener("click", importFarmAccounts);
kvkImportBtn?.addEventListener("click", importKvkWorkbook);

const govIdInput   = document.getElementById("govIdInput");
const govNameInput = document.getElementById("govNameInput");
const saveStatus   = document.getElementById("saveStatus");
const govBadge     = document.getElementById("govBadge");

loadGovBtn.addEventListener("click", loadGovernor);
govIdInput.addEventListener("keydown", e => { if (e.key === "Enter") loadGovernor(); });

newGovBtn.addEventListener("click", () => {
  if (!db) return;
  clearAllData();
  govIdInput.value   = "";
  govNameInput.value = "";
  setGovBadge("new");
  renderActiveTab();
  showSaveStatus("Fill in the Governor ID & Name, then save.", "info");
  govIdInput.focus();
});

function clearAllData() {
  for (let mi = 0; mi < MARCH_COUNT; mi++)
    for (const s of EQUIP_SLOTS)
      marchData[mi][s.key] = { item: "", awk: "", tal: "" };
  for (let n = 0; n < PAIR_COUNT; n++)
    pairsData[n] = { comm1: "", comm2: "" };
  armamentsRow = null;
}

function setGovBadge(type) {
  govBadge.className   = "eq-gov-badge" + (type ? " " + type : "");
  govBadge.textContent = type === "new" ? "New Governor" : type === "loaded" ? "Loaded" : "";
}

const ARM_SLOTS = [
  { prefix: "arm1", label: "Arm 1" },
  { prefix: "arm2", label: "Arm 2" },
  { prefix: "arm3", label: "Arm 3" },
  { prefix: "arm4", label: "Arm 4" },
  { prefix: "arm5", label: "Arm 5" },
  { prefix: "arm6", label: "Arm 6" },
  { prefix: "arm7", label: "Arm 7" },
  { prefix: "arm8", label: "Arm 8" },
];

const ARM_INS_KEYS  = ["_ins","_ins2","_ins3","_ins4","_ins5","_ins6","_ins7","_ins8"];
const ARM_STAT_DEFS = [
  { nameKey: "_stat_name",   valKey: "_stat"   },
  { nameKey: "_stat2_name2", valKey: "_stat2"  },
  { nameKey: "_stat3_name3", valKey: "_stat3"  },
  { nameKey: "_stat4_name4", valKey: "_stat4"  },
];

let armamentsRow = null;

function loadArmaments(govId) {
  armamentsRow = null;
  const safeGovId = normalizeNumericId(govId);
  if (!db) return;
  if (!safeGovId) return;
  try {
    const t = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='armaments'`);
    if (!t.length || !t[0].values.length) return;
    const res = db.exec(`SELECT * FROM armaments WHERE player_id=${safeGovId} LIMIT 1`);
    if (!res.length || !res[0].values.length) return;
    const row = {};
    res[0].columns.forEach((c, i) => { row[c] = res[0].values[0][i]; });
    armamentsRow = row;
  } catch (e) {
    console.warn("armaments load failed:", e);
  }
}

function isArmEmpty(v) {
  if (v === null || v === undefined || v === "") return true;
  return ["none", "0"].includes(String(v).trim().toLowerCase());
}

function loadGovernor() {
  const rawId = govIdInput.value.trim();
  const safeGovId = normalizeNumericId(rawId);
  if (!db) return;
  if (!safeGovId) {
    showSaveStatus("Enter a numeric Governor ID first.", "err");
    return;
  }

  clearAllData();
  setGovBadge("");

  try {
    const res = db.exec("SELECT name FROM governors WHERE governor_id = ? LIMIT 1", [safeGovId]);
    if (res.length && res[0].values.length)
      govNameInput.value = res[0].values[0][0] ?? "";
  } catch (e) { /* ok */ }

  try {
    const tbl = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='equipment'`);
    if (tbl.length && tbl[0].values.length) {
      const eqRes = db.exec(`SELECT * FROM equipment WHERE player_id=${safeGovId} LIMIT 1`);
      if (eqRes.length && eqRes[0].values.length) {
        const row = zipRow(eqRes[0]);
        populateMarchData(row);
        populatePairsData(row);
        setGovBadge("loaded");
      } else {
        setGovBadge("new");
        showSaveStatus("No equipment record found — starting fresh for this ID.", "info");
      }
    }
  } catch (e) { console.error("loadGovernor:", e); }

  renderSlotGrid();
  renderPairsGrid();
  loadArmaments(safeGovId);
}
const ARM_ABILITY_TIERS = (() => {
  const gold = new Set(["Destructive","Straight to the point","Invincible","Fearless","Hunter","Unstoppable","Balanced","Intrepid","Sharpshooter","Drilled","Merciless","Astute","Influential leader","Loaded","Civilized","Fixed","Cocoon","Inviolable","Crowned","Rounded","Rich","Battlements","Moneyed","Transporter","Enmeshed","Logistical","Unassailed","Winged","Irreproachable","Cautious","Shield Bash","Rock Solid","Avenger","Guarding light","Turn the corner","Panacea","Hasty Retreat","Blast Shield","Full Force","United Front","Thrasher","Butterfly effect","Steelskin","Flurry","Battle Ready","Fortified","Chokepoint","Steelheart","Vanquisher","Self Heal","Brilliant","Mountain","Toppler","Demolisher","Airtight","Thundering","Advantage advanced","Indomitable","Maneuver at ease","Horseback action"]);
  const blue = new Set(["Battle-Ready","Even-Keeled","Unswerving","Forceful","Crazed","Boiling Blood","Defiant","Focus Fire","Full Draw","Bloody Bolt","Tempered","Sharp Arrows","Drums of war","Nullify","Counter-Parry","Persevering","Self-Defense","Aegis","Reinforced","Tenacious","Gold Panner","Safeguard","Plentitude","Sturdy Back","Entangling","Arms Race","Sprinter","Strider","Ironclad","Strike & parry","Unshakeable","Convalescing","Back In Action","Medic","Rise Up","Refreshing","Fall Back","Spread Out","Shock Troops","Mutual Defense","Pummeler","Causative","Determined","Relentless","Vigilant","Resolute","Precautions","Ironsides","Overwhelm","Self Tend","Stone","Imploder","Raider","Hardheaded","Rattling","Fury","Soar","Ballista","Divine Staff"]);
  const gray = new Set(["Warcry", "Well Clad", "Robust", "Swift", "Payback", "Onslaught", "Retaliato....", "Enraged", "Valiant", "Iron Wall", "Bellicose", "Pulverize", "Breaker", "Furious", "Ward", "Phalanx", "Hurried", "Tremors", "Calm", "Loosed", "Brutal", "Armored", "Fit", "Fine Horse", "Annexer", "Warhunger", "Alert", "Devious", "Fearsome", "Evasive", "Requital", "Respite", "Guarded", "Embattled", "Vengeful", "Patronage", "Primed", "Uplifting", "Spirited", "Bluster", "Infamy", "Shielded", "Hardy", "Haste", "Pacifier", "Militant", "Resistant", "Daring", "Elite", "Evasive", "Smite", "Enduring", "Artisan", "Rapacious", "Guardians", "Counterer", "Deflecter", "Watchmen", "Lineshot", "Spiked", "Metallics", "Vitality", "Galloping", "Cleanser", "Striker", "Rebuff", "Brawler", "Warflames", "Eclipsed", "Brave", "Strategic", "Desperado", "Cohesive", "Pursuer", "Assertive", "Wary", "Siegework", "Sentries", "Ballistics"]);
  return { gold, blue, gray };
})();

function getArmTier(name) {
  const n = String(name).trim();
  if (ARM_ABILITY_TIERS.gold.has(n)) return "gold";
  if (ARM_ABILITY_TIERS.blue.has(n)) return "blue";
  if (ARM_ABILITY_TIERS.gray.has(n)) return "gray";
  const lower = n.toLowerCase();
  for (const v of ARM_ABILITY_TIERS.gold) if (v.toLowerCase() === lower) return "gold";
  for (const v of ARM_ABILITY_TIERS.blue) if (v.toLowerCase() === lower) return "blue";
  for (const v of ARM_ABILITY_TIERS.gray) if (v.toLowerCase() === lower) return "gray";
}

function renderArmamentsGrid() {
  const grid = document.getElementById("armGrid");
  grid.innerHTML = "";

  for (const arm of ARM_SLOTS) {
    const name    = armamentsRow ? armamentsRow[arm.prefix] : null;
    const isEmpty = isArmEmpty(name);

    const inscriptions = (!isEmpty && armamentsRow)
      ? ARM_INS_KEYS
          .map(k => armamentsRow[`${arm.prefix}${k}`])
          .filter(v => !isArmEmpty(v))
          .map(v => {
            const tier = getArmTier(String(v));
            return `<span class="eq-arm-ins eq-arm-ins--${tier}">${escapeHtml(String(v))}</span>`;
          }).join("")
      : "";

    const stats = (!isEmpty && armamentsRow)
      ? ARM_STAT_DEFS
          .filter(s => !isArmEmpty(armamentsRow[`${arm.prefix}${s.nameKey}`]) && !isArmEmpty(armamentsRow[`${arm.prefix}${s.valKey}`]))
          .map(s => `<span class="eq-arm-stat-tag"><span class="eq-arm-stat-name">${escapeHtml(String(armamentsRow[`${arm.prefix}${s.nameKey}`]))}</span><span class="eq-arm-stat-val">${escapeHtml(String(armamentsRow[`${arm.prefix}${s.valKey}`]))}%</span></span>`)
          .join("")
      : "";

    const div = document.createElement("div");
    div.className = "eq-arm-card" + (isEmpty ? " eq-arm-card--empty" : "");
    div.innerHTML = `
      <div class="eq-arm-header">
        <span class="eq-arm-slot-label">${escapeHtml(arm.label)}</span>
        <span class="eq-arm-name${isEmpty ? " eq-arm-name--empty" : ""}">${isEmpty ? "— empty —" : escapeHtml(String(name))}</span>
        <button class="eq-arm-edit-btn" title="${isEmpty ? "Add armament" : "Edit armament"}">${isEmpty ? "+" : "✎"}</button>
      </div>
      ${stats        ? `<div class="eq-arm-stats-row">${stats}</div>` : ""}
      ${inscriptions ? `<div class="eq-arm-ins-row">${inscriptions}</div>` : ""}
    `;
    div.querySelector(".eq-arm-edit-btn").addEventListener("click", e => {
      e.stopPropagation();
      openArmamentEditor(arm.prefix, arm.label);
    });
    div.addEventListener("click", () => openArmamentEditor(arm.prefix, arm.label));
    grid.appendChild(div);
  }
}
function zipRow(result) {
  const cols = result.columns;
  const vals = result.values[0];
  return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
}

function colKey(slotKey, mi) {
  const sfx = mi === 0 ? "" : String(mi + 1);
  return sfx ? `${slotKey}_${sfx}` : slotKey;
}
function lvlKey(slotKey, mi) {
  const sfx = mi === 0 ? "" : String(mi + 1);
  return sfx ? `${slotKey}_lvl_${sfx}` : `${slotKey}_lvl`;
}
function talKey(slotKey, mi) {
  const sfx = mi === 0 ? "" : String(mi + 1);
  return sfx ? `${slotKey}_tal_${sfx}` : `${slotKey}_tal`;
}

function isEmpty(v) {
  if (v === null || v === undefined || v === "") return true;
  return ["none", "0"].includes(String(v).trim().toLowerCase());
}

function populateMarchData(row) {
  for (let mi = 0; mi < MARCH_COUNT; mi++)
    for (const slot of EQUIP_SLOTS) {
      const item = row[colKey(slot.key, mi)];
      const awk  = row[lvlKey(slot.key, mi)];
      const tal  = row[talKey(slot.key, mi)];
      marchData[mi][slot.key] = {
        item: isEmpty(item) ? "" : String(item),
        awk:  isEmpty(awk)  ? "" : String(awk),
        tal:  isEmpty(tal)  ? "" : String(tal),
      };
    }
}

function populatePairsData(row) {
  for (let n = 0; n < PAIR_COUNT; n++) {
    const c1 = row[`pair${n + 1}_comm1`];
    const c2 = row[`pair${n + 1}_comm2`];
    pairsData[n] = {
      comm1: isEmpty(c1) ? "" : String(c1),
      comm2: isEmpty(c2) ? "" : String(c2),
    };
  }
}

saveBtn.addEventListener("click", saveGovernor);

function saveGovernor() {
  if (!db) return;
  const safeGovId = normalizeNumericId(govIdInput.value);
  const name  = govNameInput.value.trim() || "none";
  if (!safeGovId) { showSaveStatus("Enter a numeric Governor ID first.", "err"); return; }
  const govId = Number(safeGovId);

  try {
    ensureGovernorRow(govId, name);

    const colsRes = db.exec(`PRAGMA table_info(equipment)`);
    if (!colsRes.length) { showSaveStatus("No equipment table in DB.", "err"); return; }
    const existingCols = new Set(colsRes[0].values.map(r => r[1]));

    const setCols = [];
    const vals    = [];

    for (let mi = 0; mi < MARCH_COUNT; mi++) {
      for (const slot of EQUIP_SLOTS) {
        const d  = marchData[mi][slot.key];
        pushIfExists(setCols, vals, existingCols, colKey(slot.key, mi), d.item || "none");
        pushIfExists(setCols, vals, existingCols, lvlKey(slot.key, mi), d.awk ? Number(d.awk) : null);
        pushIfExists(setCols, vals, existingCols, talKey(slot.key, mi), d.tal || "none");
      }
    }

    for (let n = 0; n < PAIR_COUNT; n++) {
      pushIfExists(setCols, vals, existingCols, `pair${n + 1}_comm1`, pairsData[n].comm1 || "none");
      pushIfExists(setCols, vals, existingCols, `pair${n + 1}_comm2`, pairsData[n].comm2 || "none");
    }
	
    if (armamentsRow) {
      try {
        const armCols = db.exec(`PRAGMA table_info(armaments)`);
        if (armCols.length) {
          const existArmCols = new Set(armCols[0].values.map(r => r[1]));
          const armSetCols = [];
          const armSetVals = [];

          for (const arm of ARM_SLOTS) {
            const p = arm.prefix;
            if (existArmCols.has(p)) {
              armSetCols.push(p);
              armSetVals.push(armamentsRow[p] ?? "none");
            }
            for (const k of ARM_INS_KEYS) {
              const col = `${p}${k}`;
              if (existArmCols.has(col)) {
                armSetCols.push(col);
                armSetVals.push(armamentsRow[col] ?? "none");
              }
            }
            for (const s of ARM_STAT_DEFS) {
              const nk = `${p}${s.nameKey}`;
              const vk = `${p}${s.valKey}`;
              if (existArmCols.has(nk)) { armSetCols.push(nk); armSetVals.push(armamentsRow[nk] ?? "none"); }
              if (existArmCols.has(vk)) { armSetCols.push(vk); armSetVals.push(armamentsRow[vk] ?? null); }
            }
          }

          const armUpsertCols = ["player_id", "name", ...armSetCols];
          const armUpsertVals = [govId, name, ...armSetVals];
          const armPh         = armUpsertVals.map(() => "?").join(", ");
          const armUpdateSet  = armSetCols.map(c => `${c}=excluded.${c}`).join(", ");

          db.run(
            `INSERT INTO armaments (${armUpsertCols.join(", ")}) VALUES (${armPh})
             ON CONFLICT(player_id) DO UPDATE SET name=excluded.name${armUpdateSet ? ", " + armUpdateSet : ""}`,
            armUpsertVals
          );
        }
      } catch (e) { console.warn("armaments save failed:", e); }
    }

    const upsertCols = ["player_id", "name", ...setCols];
    const upsertVals = [govId, name, ...vals];
    const ph         = upsertVals.map(() => "?").join(", ");
    const updateSet  = setCols.map(c => `${c}=excluded.${c}`).join(", ");

    db.run(
      `INSERT INTO equipment (${upsertCols.join(", ")}) VALUES (${ph})
       ON CONFLICT(player_id) DO UPDATE SET name=excluded.name${updateSet ? ", " + updateSet : ""}`,
      upsertVals
    );

    downloadDb();
    setGovBadge("loaded");
    showSaveStatus("✓ Saved & downloaded!", "ok");
  } catch (e) {
    console.error("saveGovernor:", e);
    showSaveStatus("Error: " + e.message, "err");
  }
}

function pushIfExists(cols, vals, existingCols, col, val) {
  if (existingCols.has(col)) { cols.push(col); vals.push(val); }
}

function ensureGovernorRow(govId, name) {
  try {
    const t = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='governors'`);
    if (!t.length || !t[0].values.length) return;
    db.run(
      `INSERT INTO governors (governor_id, kingdom, name) VALUES (?, ?, ?)
       ON CONFLICT(governor_id, kingdom) DO UPDATE SET name=excluded.name`,
      [String(govId), "", name]
    );
  } catch (e) { console.warn("ensureGovernorRow:", e); }
}

function downloadDb() {
  const exported = db.export();
  const blob     = new Blob([exported], { type: "application/octet-stream" });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement("a");
  a.href         = url;
  a.download     = dbFileInput.files[0]?.name || "kvk.db";
  a.click();
  URL.revokeObjectURL(url);
}

function showSaveStatus(msg, cls) {
  saveStatus.textContent = msg;
  saveStatus.className   = "eq-save-status" + (cls ? " " + cls : "");
  clearTimeout(saveStatus._t);
  if (msg && (cls === "ok" || cls === "info"))
    saveStatus._t = setTimeout(() => { saveStatus.textContent = ""; saveStatus.className = "eq-save-status"; }, 5000);
}

function requireWorkbookLibrary() {
  if (window.XLSX) return true;
  alert("Excel importer failed to load. Check your internet connection and reload the page.");
  return false;
}

async function readWorkbook(file) {
  const bytes = await file.arrayBuffer();
  return XLSX.read(bytes, { type: "array" });
}

function sheetRows(workbook, sheetName, opts = {}) {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true, ...opts });
}

function importToInt(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function importToFloat(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function importToText(v, fallback = "") {
  if (v === null || v === undefined || String(v).trim() === "") return fallback;
  return String(v).trim();
}

function headerMap(headers) {
  const map = {};
  headers.forEach((header, idx) => {
    const key = String(header ?? "").trim();
    if (key) map[key] = idx;
  });
  return map;
}

function rowValue(row, headers, columnName, fallback = 0) {
  const idx = headers[columnName];
  return idx === undefined ? fallback : row[idx];
}

function normalizeImportDate(sheetName) {
  const name = String(sheetName);
  if (name.includes("_") && name.length === 10) {
    const [d, m, y] = name.split("_");
    return `${y}-${m}-${d}`;
  }
  return name;
}

async function importFarmAccounts() {
  if (!db || !farmFileInput?.files?.length) return;
  if (!requireWorkbookLibrary()) return;

  const file = farmFileInput.files[0];
  farmImportBtn.disabled = true;
  setImportStatus(farmImportStatus, "Importing farm accounts...", "info");

  try {
    ensureAppSchema();
    const workbook = await readWorkbook(file);
    let imported = 0;

    db.run("BEGIN");
    try {
      for (const sheetName of workbook.SheetNames) {
        const rows = sheetRows(workbook, sheetName);
        for (const raw of rows) {
          const row = {};
          for (const [key, value] of Object.entries(raw)) {
            row[String(key).trim().toLowerCase()] = value;
          }

          const playerId = importToInt(row.id);
          if (!playerId) continue;

          db.run(
            `INSERT OR REPLACE INTO farm_accounts
             (name, player_id, power, killpoints, deads, ch, acc_type, main_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              importToText(row.name, ""),
              playerId,
              importToInt(row.power),
              importToInt(row.killpoints),
              importToInt(row.deads),
              importToInt(row.ch),
              importToText(row.acc_type, ""),
              importToInt(row.main_id),
            ]
          );
          imported++;
        }
      }
      db.run("COMMIT");
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }

    downloadDb();
    setImportStatus(farmImportStatus, `Imported ${imported} farm account${imported === 1 ? "" : "s"} and downloaded the database.`, "ok");
  } catch (e) {
    console.error("importFarmAccounts:", e);
    setImportStatus(farmImportStatus, "Farm import failed: " + e.message, "err");
  } finally {
    updateImportButtons();
  }
}

async function importKvkWorkbook() {
  if (!db || !kvkFileInput?.files?.length) return;
  if (!requireWorkbookLibrary()) return;

  const kingdom = kvkKingdomInput.value.trim();
  const kvkNumber = importToInt(kvkNumberInput.value);
  const kvkName = kvkNameInput.value.trim() || "KvK";
  if (!kingdom || !kvkNumber) {
    setImportStatus(kvkImportStatus, "Enter kingdom and KvK number first.", "err");
    return;
  }

  kvkImportBtn.disabled = true;
  setImportStatus(kvkImportStatus, "Importing KvK snapshots...", "info");

  try {
    ensureAppSchema();
    const workbook = await readWorkbook(kvkFileInput.files[0]);
    let snapshotCount = 0;
    let statCount = 0;
    let lastSnapshotId = null;

    db.run("BEGIN");
    try {
      let kvkRows = db.exec(
        "SELECT id FROM kvks WHERE kingdom = ? AND kvk_number = ?",
        [kingdom, kvkNumber]
      );
      let kvkId = kvkRows.length && kvkRows[0].values.length ? kvkRows[0].values[0][0] : null;

      if (!kvkId) {
        db.run(
          "INSERT INTO kvks (kingdom, kvk_number, name, is_latest) VALUES (?, ?, ?, 0)",
          [kingdom, kvkNumber, kvkName]
        );
        kvkRows = db.exec(
          "SELECT id FROM kvks WHERE kingdom = ? AND kvk_number = ?",
          [kingdom, kvkNumber]
        );
        kvkId = kvkRows[0].values[0][0];
      } else {
        db.run("UPDATE kvks SET name = ? WHERE id = ?", [kvkName, kvkId]);
      }

      db.run("UPDATE kvks SET is_latest = 0 WHERE kingdom = ?", [kingdom]);
      db.run("UPDATE snapshots SET is_last = 0 WHERE kvk_id = ?", [kvkId]);

      for (const sheetName of workbook.SheetNames) {
        const rows = sheetRows(workbook, sheetName, { header: 1 });
        const headers = headerMap(rows[0] || []);
        const snapshotDate = normalizeImportDate(sheetName);

        db.run(
          "INSERT OR IGNORE INTO snapshots (kvk_id, snapshot_date) VALUES (?, ?)",
          [kvkId, snapshotDate]
        );
        const snapRows = db.exec(
          "SELECT id FROM snapshots WHERE kvk_id = ? AND snapshot_date = ?",
          [kvkId, snapshotDate]
        );
        const snapshotId = snapRows[0].values[0][0];
        lastSnapshotId = snapshotId;
        snapshotCount++;

        for (const row of rows.slice(1)) {
          const governorId = importToInt(rowValue(row, headers, "ID"));
          if (!governorId) continue;
          const name = importToText(rowValue(row, headers, "Name", ""), "");

          db.run(
            `INSERT OR IGNORE INTO governors (governor_id, kingdom, name)
             VALUES (?, ?, ?)`,
            [String(governorId), kingdom, name]
          );

          db.run(
            `INSERT OR REPLACE INTO stats (
              snapshot_id, governor_id,
              power, kill_points, t4, t5, deads,
              power_diff, kp_diff, t4_diff, t5_diff, deads_diff,
              min_dkp, dkp, dkp_percent,
              sum_min_dkp, sum_dkp, sum_dkp_percent,
              vacation, status, acclaim
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
              snapshotId,
              String(governorId),
              importToInt(rowValue(row, headers, "Power")),
              importToInt(rowValue(row, headers, "Killpoints")),
              importToInt(rowValue(row, headers, "T4 Kills")),
              importToInt(rowValue(row, headers, "T5 Kills")),
              importToInt(rowValue(row, headers, "Deads")),
              importToInt(rowValue(row, headers, "Power diff")),
              importToInt(rowValue(row, headers, "KP gained")),
              importToInt(rowValue(row, headers, "T4 gained")),
              importToInt(rowValue(row, headers, "T5 gained")),
              importToInt(rowValue(row, headers, "Deads gained")),
              importToInt(rowValue(row, headers, "Min DKP")),
              importToInt(rowValue(row, headers, "DKP")),
              importToFloat(rowValue(row, headers, "DKP%")),
              importToInt(rowValue(row, headers, "Sum Min DKP", rowValue(row, headers, "Min DKP"))),
              importToInt(rowValue(row, headers, "Sum DKP", rowValue(row, headers, "DKP"))),
              importToFloat(rowValue(row, headers, "Sum DKP%", rowValue(row, headers, "DKP%"))),
              importToText(rowValue(row, headers, "Vacation", "NO"), "NO"),
              importToText(rowValue(row, headers, "Status", "OK"), "OK"),
              importToInt(rowValue(row, headers, "Acclaim")),
            ]
          );
          statCount++;
        }
      }

      if (lastSnapshotId) {
        db.run("UPDATE snapshots SET is_last = 1 WHERE id = ?", [lastSnapshotId]);
      }
      db.run("UPDATE kvks SET is_latest = 1 WHERE id = ?", [kvkId]);
      db.run("COMMIT");
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }

    downloadDb();
    setImportStatus(kvkImportStatus, `Imported ${snapshotCount} snapshot${snapshotCount === 1 ? "" : "s"} and ${statCount} stat row${statCount === 1 ? "" : "s"}. Database downloaded.`, "ok");
  } catch (e) {
    console.error("importKvkWorkbook:", e);
    setImportStatus(kvkImportStatus, "KvK import failed: " + e.message, "err");
  } finally {
    updateImportButtons();
  }
}

document.querySelectorAll(".eq-section-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;

    document.querySelectorAll(".eq-section-tab").forEach(b =>
      b.classList.toggle("active", b === btn));

    for (const tabName of ["equipment", "pairs", "armaments", "farmImport", "kvkImport"]) {
      const panel = document.getElementById(`${tabName}Panel`);
      if (panel) panel.style.display = activeTab === tabName ? "" : "none";
    }

    renderActiveTab();
  });
});

function renderActiveTab() {
  if (activeTab === "equipment") renderSlotGrid();
  else if (activeTab === "pairs") renderPairsGrid();
  else if (activeTab === "armaments") renderArmamentsGrid();
  else if (activeTab === "farmImport" || activeTab === "kvkImport") updateImportButtons();
}

function renderMarchTabs() {
  const tabs = document.getElementById("marchTabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  for (let i = 1; i <= MARCH_COUNT; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eq-tab" + (i === currentMarch ? " active" : "");
    button.dataset.march = String(i);
    button.textContent = `March ${i}`;
    tabs.appendChild(button);
  }
}

renderMarchTabs();

document.getElementById("marchTabs").addEventListener("click", e => {
  const tab = e.target.closest(".eq-tab");
  if (!tab) return;
  currentMarch = Number(tab.dataset.march);
  document.querySelectorAll("#marchTabs .eq-tab").forEach(t =>
    t.classList.toggle("active", t === tab));
  renderSlotGrid();
});

function renderSlotGrid() {
  const grid = document.getElementById("slotGrid");
  const mi   = currentMarch - 1;
  grid.innerHTML = "";

  for (const slot of EQUIP_SLOTS) {
    const d       = marchData[mi][slot.key];
    const hasItem = !!d.item;
    const card    = document.createElement("div");
    card.className = "eq-slot-card" + (hasItem ? " has-item" : "");

    card.innerHTML = `
      <span class="eq-slot-label">${escapeHtml(slot.label)}</span>
      <div class="eq-slot-img-box">
        ${hasItem
          ? `<img src="icons/${encodeURIComponent(d.item)}.webp" alt="${escapeHtml(d.item)}" loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="eq-slot-placeholder" style="display:none;">?</div>`
          : `<div class="eq-slot-placeholder">+</div>`}
      </div>
      <span class="eq-slot-item-name">${hasItem ? escapeHtml(d.item) : "—"}</span>
      <div class="eq-slot-stats">
        <span class="eq-slot-stat${hasItem && d.awk ? " filled" : ""}">Awk: ${hasItem && d.awk ? escapeHtml(d.awk) : "—"}</span>
        <span class="eq-slot-stat${hasItem && d.tal ? " filled" : ""}">Tal: ${hasItem && d.tal ? escapeHtml(d.tal) : "—"}</span>
      </div>`;

    card.addEventListener("click", () => openPicker({ type: "equip", marchIdx: mi, slotKey: slot.key }));
    grid.appendChild(card);
  }
}

function renderPairsGrid() {
  const grid = document.getElementById("pairsGrid");
  grid.innerHTML = "";

  for (let n = 0; n < PAIR_COUNT; n++) {
    const p   = pairsData[n];
    const row = document.createElement("div");
    row.className = "eq-pair-row";
    row.innerHTML = `<span class="eq-pair-label">Pair ${n + 1}</span>`;

    for (const slot of ["comm1", "comm2"]) {
      const name    = p[slot];
      const hasComm = !!name;
      const card    = document.createElement("div");
      card.className = "eq-pair-card" + (hasComm ? " has-item" : "");

      card.innerHTML = `
        <div class="eq-pair-img-box">
          ${hasComm
            ? `<img src="icons/${encodeURIComponent(name)}.webp" alt="${escapeHtml(name)}" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <div class="eq-slot-placeholder" style="display:none;">?</div>`
            : `<div class="eq-slot-placeholder">+</div>`}
        </div>
        <span class="eq-pair-comm-name">${hasComm ? escapeHtml(name) : "—"}</span>
        ${hasComm ? `<button class="eq-pair-clear" title="Clear this commander">×</button>` : ""}`;

      card.addEventListener("click", ev => {
        if (ev.target.classList.contains("eq-pair-clear")) return;
        openPicker({ type: "pair", pairIdx: n, slot });
      });

      const clearBtn = card.querySelector(".eq-pair-clear");
      if (clearBtn) {
        clearBtn.addEventListener("click", ev => {
          ev.stopPropagation();
          pairsData[n][slot] = "";
          renderPairsGrid();
        });
      }

      row.appendChild(card);
    }

    grid.appendChild(row);
  }
}

renderSlotGrid();
renderPairsGrid();

const EQUIP_PREFIX_MAP = {
  helm:          "h",
  chest:         "c",
  weapon:        "w",
  gloves:        "g",
  legs:          "l",
  boots:         "b",
  accessory:     "a",
  accessory_sec: "a",
};
const EQUIP_ICON_RE = /^[hcwglba]\d/i;

function isEquipIcon(name) {
  return EQUIP_ICON_RE.test(name);
}

function iconsForSlot(slotKey) {
  const prefix = EQUIP_PREFIX_MAP[slotKey];
  if (!prefix) return allIconNames;
  return allIconNames.filter(n => n.charAt(0).toLowerCase() === prefix);
}

async function loadIconManifest() {
  if (allIconNames.length) return;
  try {
    const res = await fetch("icons/manifest.json");
    if (res.ok) {
      const all = await res.json();
      allIconNames = all.filter(n => isEquipIcon(n)).sort();
      allCommNames = all.filter(n => !isEquipIcon(n)).sort();
      return;
    }
  } catch (e) { }

  if (!db) return;
  _scrapeIconsFromDb();
}

async function loadCommManifest() {
  if (allCommNames.length) return;
  await loadIconManifest();
}

function _scrapeIconsFromDb() {
  try {
    const cols = db.exec(`PRAGMA table_info(equipment)`);
    if (!cols.length) return;
    const itemCols = cols[0].values.map(r => r[1]).filter(c =>
      !c.endsWith("_lvl") && !c.includes("_tal") &&
      !["player_id","name","acc_type"].includes(c) && !c.startsWith("pair") &&
      !/_(lvl|tal)_\d+$/.test(c));
    if (!itemCols.length) return;

    const pairCols = [];
    for (let n = 1; n <= 12; n++) pairCols.push(`pair${n}_comm1`, `pair${n}_comm2`);

    const equipNames = new Set();
    const commNames  = new Set();

    const res = db.exec(`SELECT ${[...itemCols, ...pairCols].join(",")} FROM equipment LIMIT 500`);
    if (res.length) {
      const allCols = res[0].columns;
      const pairSet = new Set(pairCols);
      res[0].values.forEach(row =>
        row.forEach((v, i) => {
          if (!v || ["none","0"].includes(String(v).toLowerCase())) return;
          const name = String(v).trim();
          if (pairSet.has(allCols[i])) {
            commNames.add(name);
          } else {
            if (isEquipIcon(name)) equipNames.add(name);
          }
        })
      );
    }

    allIconNames = [...equipNames].sort();
    allCommNames = [...commNames].sort();
  } catch (e) { /* ignore */ }
}

async function preloadIconsFromDb() {
  if (allIconNames.length && allCommNames.length) return;
  _scrapeIconsFromDb();
}

const pickerOverlay  = document.getElementById("pickerOverlay");
const pickerBody     = document.getElementById("pickerBody");
const pickerSearch   = document.getElementById("pickerSearch");
const pickerClose    = document.getElementById("pickerClose");
const pickerClearBtn = document.getElementById("pickerClearBtn");
const pickerSlotLabel= document.getElementById("pickerSlotLabel");

pickerClose.addEventListener("click",   closePicker);
pickerClearBtn.addEventListener("click", clearPickerSlot);
pickerOverlay.addEventListener("click",  e => { if (e.target === pickerOverlay) closePicker(); });
pickerSearch.addEventListener("input",   () => renderPickerItems(pickerSearch.value.trim()));

async function openPicker(target) {
  pickerTarget = target;
  pickerSearch.value = "";

  if (target.type === "equip") {
    const slot = EQUIP_SLOTS.find(s => s.key === target.slotKey);
    pickerSlotLabel.textContent = `– ${slot?.label ?? target.slotKey} · March ${target.marchIdx + 1}`;
    pickerSelectedItem = marchData[target.marchIdx][target.slotKey].item;
    await loadIconManifest();
  } else {
    const lbl = target.slot === "comm1" ? "Commander 1" : "Commander 2";
    pickerSlotLabel.textContent = `– ${lbl} · Pair ${target.pairIdx + 1}`;
    pickerSelectedItem = pairsData[target.pairIdx][target.slot];
    await loadCommManifest();
  }

  pickerOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  renderPickerItems("");
  setTimeout(() => pickerSearch.focus(), 80);
}

function closePicker() {
  pickerOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

function clearPickerSlot() {
  if (!pickerTarget) return;
  if (pickerTarget.type === "equip") {
    marchData[pickerTarget.marchIdx][pickerTarget.slotKey] = { item: "", awk: "", tal: "" };
    closePicker();
    renderSlotGrid();
  } else {
    pairsData[pickerTarget.pairIdx][pickerTarget.slot] = "";
    closePicker();
    renderPairsGrid();
  }
}

function renderPickerItems(filter) {
  const q = filter.toLowerCase();

  let base;
  if (pickerTarget?.type === "pair") {
    base = allCommNames;
  } else if (pickerTarget?.type === "equip") {
    base = iconsForSlot(pickerTarget.slotKey);
  } else {
    base = allIconNames;
  }

  const candidates = new Set(base);

  if (pickerTarget?.type === "equip") {
    const prefix = EQUIP_PREFIX_MAP[pickerTarget.slotKey];
    for (let mi = 0; mi < MARCH_COUNT; mi++)
      for (const s of EQUIP_SLOTS)
        if (marchData[mi][s.key].item && (!prefix || marchData[mi][s.key].item.charAt(0).toLowerCase() === prefix))
          candidates.add(marchData[mi][s.key].item);
  } else if (pickerTarget?.type === "pair") {
    for (let n = 0; n < PAIR_COUNT; n++) {
      if (pairsData[n].comm1) candidates.add(pairsData[n].comm1);
      if (pairsData[n].comm2) candidates.add(pairsData[n].comm2);
    }
  }

  let list = [...candidates].sort((a, b) => a.localeCompare(b));
  if (q) list = list.filter(n => n.toLowerCase().includes(q));

  if (!list.length) {
    pickerBody.innerHTML = `<div class="eq-picker-empty">${
      filter
        ? "No items match your search."
        : `No icons found.<br><small>Add <code>icons/manifest.json</code> or load a DB with existing records.</small>`
    }</div>`;
    return;
  }

  pickerBody.innerHTML = "";
  for (const name of list) {
    const div = document.createElement("div");
    div.className = "eq-picker-item" + (name === pickerSelectedItem ? " selected" : "");
    div.innerHTML = `
      <img src="icons/${encodeURIComponent(name)}.webp" alt="${escapeHtml(name)}" loading="lazy"
           onerror="this.style.display='none'">
      <span class="eq-picker-item-name">${escapeHtml(name)}</span>`;
    div.addEventListener("click", () => selectPickerItem(name));
    pickerBody.appendChild(div);
  }
}

function selectPickerItem(name) {
  pickerSelectedItem = name;
  closePicker();
  if (!pickerTarget) return;

  if (pickerTarget.type === "equip") {
    const existing = marchData[pickerTarget.marchIdx][pickerTarget.slotKey];
    marchData[pickerTarget.marchIdx][pickerTarget.slotKey] = {
      item: name, awk: existing.awk, tal: existing.tal,
    };
    openDetailPopup(pickerTarget.marchIdx, pickerTarget.slotKey);
  } else {
    pairsData[pickerTarget.pairIdx][pickerTarget.slot] = name;
    renderPairsGrid();
  }
}

const detailPopup    = document.getElementById("detailPopup");
const detailBackdrop = document.getElementById("detailBackdrop");
const detailImg      = document.getElementById("detailImg");
const detailItemName = document.getElementById("detailItemName");
const detailAwk      = document.getElementById("detailAwk");
const detailTal      = document.getElementById("detailTal");
const detailSlotTitle= document.getElementById("detailSlotTitle");
const detailClose    = document.getElementById("detailClose");
const detailConfirm  = document.getElementById("detailConfirm");

let detailTarget = null;

function openDetailPopup(marchIdx, slotKey) {
  detailTarget = { marchIdx, slotKey };
  const d      = marchData[marchIdx][slotKey];
  const slot   = EQUIP_SLOTS.find(s => s.key === slotKey);
  detailSlotTitle.textContent = `${slot?.label ?? slotKey} — March ${marchIdx + 1}`;
  detailItemName.textContent  = d.item;
  detailImg.src               = `icons/${encodeURIComponent(d.item)}.webp`;
  detailImg.alt               = d.item;
  detailImg.onerror           = () => { detailImg.style.display = "none"; };
  detailImg.style.display     = "";
  detailAwk.value             = d.awk ?? "";

  const talVal = (d.tal ?? "").toLowerCase();
  setTalentBtn(talVal === "yes" ? "yes" : talVal === "no" ? "no" : "");

  detailPopup.style.display    = "block";
  detailBackdrop.style.display = "block";
  detailAwk.focus();
}

function closeDetailPopup() {
  detailPopup.style.display    = "none";
  detailBackdrop.style.display = "none";
  detailTarget = null;
}

detailClose.addEventListener("click",    closeDetailPopup);
detailBackdrop.addEventListener("click", closeDetailPopup);

function setTalentBtn(val) {
  detailTal.value = val;
  document.getElementById("talBtnYes").classList.toggle("active", val === "yes");
  document.getElementById("talBtnNo").classList.toggle("active",  val === "no");
}
document.getElementById("talBtnYes").addEventListener("click", () => setTalentBtn("yes"));
document.getElementById("talBtnNo").addEventListener("click",  () => setTalentBtn("no"));

detailConfirm.addEventListener("click", () => {
  if (!detailTarget) return;
  marchData[detailTarget.marchIdx][detailTarget.slotKey].awk = detailAwk.value.trim();
  marchData[detailTarget.marchIdx][detailTarget.slotKey].tal = detailTal.value.trim();
  closeDetailPopup();
  renderSlotGrid();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (document.getElementById("armModalOverlay").classList.contains("open")) closeArmamentEditor();
    else if (detailPopup.style.display === "block") closeDetailPopup();
    else closePicker();
  }
});

let armEditorPrefix = null;
let armEditorLabel  = null;

function openArmamentEditor(prefix, label) {
  armEditorPrefix = prefix;
  armEditorLabel  = label;

  if (!armamentsRow) armamentsRow = { player_id: null };

  const row = armamentsRow;

  document.getElementById("armModalTitle").textContent = `Edit ${label}`;

  document.getElementById("armModalName").value = isArmEmpty(row[prefix]) ? "" : String(row[prefix]);

  ARM_STAT_DEFS.forEach((s, i) => {
    const nk = `${prefix}${s.nameKey}`;
    const vk = `${prefix}${s.valKey}`;
    document.getElementById(`armStatName${i}`).value = isArmEmpty(row[nk]) ? "" : String(row[nk]);
    document.getElementById(`armStatVal${i}`).value  = isArmEmpty(row[vk]) ? "" : String(row[vk]);
  });

  ARM_INS_KEYS.forEach((k, i) => {
    const v = row[`${prefix}${k}`];
    document.getElementById(`armIns${i}`).value = isArmEmpty(v) ? "" : String(v);
  });
  renderInsChosenList();

  renderArmSetBonus();

  document.getElementById("armModalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("armModalName").focus();
}

function closeArmamentEditor() {
  document.getElementById("armModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
  armEditorPrefix = null;
}

function saveArmamentEditor() {
  if (!armEditorPrefix) return;
  if (!armamentsRow) armamentsRow = {};

  const prefix = armEditorPrefix;

  const nameVal = document.getElementById("armModalName").value.trim();
  armamentsRow[prefix] = nameVal || "none";

  ARM_STAT_DEFS.forEach((s, i) => {
    const nv = document.getElementById(`armStatName${i}`).value.trim();
    const vv = document.getElementById(`armStatVal${i}`).value.trim();
    armamentsRow[`${prefix}${s.nameKey}`] = nv || "none";
    armamentsRow[`${prefix}${s.valKey}`]  = vv ? parseFloat(vv) : null;
  });

  ARM_INS_KEYS.forEach((k, i) => {
    const v = document.getElementById(`armIns${i}`).value.trim();
    armamentsRow[`${prefix}${k}`] = v || "none";
  });

  closeArmamentEditor();
  renderArmamentsGrid();
}

const ARM_SET_BONUSES = {
  "Pincer":  { name: "Pincer Formation", bonus: "The user's troop deals 10% more smite damage." },
  "Wedge":   { name: "Wedge Formation",  bonus: "The user's troop deals 5% more skill damage." },
  "Delta":   { name: "Delta Formation",  bonus: "The user's troop deals 10% more combo attack damage." },
  "Tercio":  { name: "Tercio Formation", bonus: "When the user is garrisoned in your city, all unit-specific attribute bonuses (Attack/Defense/Health) from the user's armaments will apply to all unit types." },
  "Double Line":  { name: "Double Line Formation", bonus: "If the user's troop is marching towards barbarians, it gains 10% March Speed." },
  "Staggered":  { name: "Staggered Formation", bonus: "The user's troop gains 15% March Speed when marching to join a rallied army or garrison." },
  "Circle":  { name: "Circle Formation", bonus: "All healing the user's troop receives is increased by 5%." },
  "Tetsudo":  { name: "Tetsudo Formation", bonus: "The user's troop takes 5% less damage while it has a shield. All healing their troop receives is increased by 2.5%." },
  "Triple Line":  { name: "Triple Line Formation", bonus: "Increases the March Speed of the user's troop by 5%." },  
  "Line":  { name: "Line Formation", bonus: "Increases the Food, Wood, Stone, and Gold Gathering Speed of the user's troop by 10%." },
  "Hollow Square":  { name: "Hollow Square Formation", bonus: "The user's troop takes 2% less damage." },
  "Echelon":  { name: "Echelon Formation", bonus: "When the user's troop grants percentage-based buffs to other troops, their effects are multiplied by 1.2, with a maximum increase of up to 5% of their original value." },
  "V":  { name: "V Formation", bonus: "The user's troop can switch to ranged mode, allowing it to launch 1 ranged basic attack per second. If your city is in a War Frenzy, your troops in ranged mode will automatically launch ranged attacks against enemies within their attack range that are attacking a friendly or allied troop. Only commanders with the Engineering talent tag can use their active skills while in V formation." },
  "Arch":  { name: "Arch Formation", bonus: "The user's troop deals 5% more normal damage." },
};

function renderArmSetBonus() {
  const preview = document.getElementById("armSetBonusPreview");
  if (!preview) return;

  const counts = {};
  for (const arm of ARM_SLOTS) {
    const v = armEditorPrefix === arm.prefix
      ? document.getElementById("armModalName")?.value.trim()
      : (armamentsRow ? armamentsRow[arm.prefix] : null);
    if (!isArmEmpty(v)) {
      const key = String(v).trim();
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  let html = "";
  for (const [type, count] of Object.entries(counts)) {
    const bonus = ARM_SET_BONUSES[type];
    const active = count >= 3;
    html += `<div class="eq-arm-set-row${active ? " active" : ""}">
      <span class="eq-arm-set-name">${escapeHtml(type)}</span>
      <span class="eq-arm-set-count">×${count}</span>
      ${bonus ? `<span class="eq-arm-set-bonus">${active ? "✓ " : ""}${escapeHtml(bonus.bonus)}</span>` : ""}
    </div>`;
  }
  preview.innerHTML = html || `<span class="eq-arm-set-none">No active set bonuses</span>`;
}

document.getElementById("armModalOverlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeArmamentEditor();
});
document.getElementById("armModalClose").addEventListener("click", closeArmamentEditor);
document.getElementById("armModalSave").addEventListener("click", saveArmamentEditor);
document.getElementById("armModalClear").addEventListener("click", () => {
  if (!armEditorPrefix) return;
  document.getElementById("armModalName").value = "";
  ARM_STAT_DEFS.forEach((_, i) => {
    document.getElementById(`armStatName${i}`).value = "";
    document.getElementById(`armStatVal${i}`).value  = "";
  });
  ARM_INS_KEYS.forEach((_, i) => {
    document.getElementById(`armIns${i}`).value = "";
  });
  renderInsChosenList();
  renderArmSetBonus();
});
document.getElementById("armModalName").addEventListener("input", renderArmSetBonus);

const ALL_INSCRIPTIONS = [...ARM_ABILITY_TIERS.gold, ...ARM_ABILITY_TIERS.blue, ...ARM_ABILITY_TIERS.gray].sort((a, b) => a.localeCompare(b));

let insPickerSelected = [];

function renderInsChosenList() {
  const list = document.getElementById("insChosenList");
  if (!list) return;
  const vals = ARM_INS_KEYS.map((_, i) => document.getElementById(`armIns${i}`).value).filter(Boolean);
  if (!vals.length) {
    list.innerHTML = `<span class="eq-ins-none">None selected</span>`;
    return;
  }
  list.innerHTML = vals.map(v => {
    const tier = getArmTier(v);
    return `<span class="eq-arm-ins eq-arm-ins--${tier}">${escapeHtml(v)}</span>`;
  }).join("");
}

function openInsPicker() {
  insPickerSelected = ARM_INS_KEYS
    .map((_, i) => document.getElementById(`armIns${i}`).value)
    .filter(Boolean);

  renderInsPickerList("");
  renderInsPickerFooter();
  document.getElementById("insPickerSearch").value = "";
  document.getElementById("insPickerOverlay").classList.add("open");
}

function closeInsPicker() {
  document.getElementById("insPickerOverlay").classList.remove("open");
}

function renderInsPickerList(filter) {
  const q    = filter.toLowerCase();
  const body = document.getElementById("insPickerBody");
  let list   = ALL_INSCRIPTIONS;
  if (q) list = list.filter(n => n.toLowerCase().includes(q));

  body.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "eq-ins-pill-grid";
  for (const name of list) {
    const tier    = getArmTier(name);
    const checked = insPickerSelected.includes(name);
    const pill    = document.createElement("button");
    pill.type      = "button";
    pill.className = `eq-ins-pill eq-ins-pill--${tier}${checked ? " selected" : ""}`;
    pill.textContent = name;
    pill.addEventListener("click", () => toggleInsPick(name, pill));
    wrap.appendChild(pill);
  }
  body.appendChild(wrap);
}

function toggleInsPick(name, el) {
  const idx = insPickerSelected.indexOf(name);
  if (idx !== -1) {
    insPickerSelected.splice(idx, 1);
    el.classList.remove("selected");
  } else {
    if (insPickerSelected.length >= 8) return;
    insPickerSelected.push(name);
    el.classList.add("selected");
  }
  renderInsPickerFooter();
}

function renderInsPickerFooter() {
  document.getElementById("insPickerCount").textContent = `(${insPickerSelected.length}/8)`;
  const wrap = document.getElementById("insPickerSelectedWrap");
  wrap.innerHTML = insPickerSelected.map(v => {
    const tier = getArmTier(v);
    return `<span class="eq-arm-ins eq-arm-ins--${tier}">${escapeHtml(v)}</span>`;
  }).join("");
}

function confirmInsPicker() {
  ARM_INS_KEYS.forEach((_, i) => {
    document.getElementById(`armIns${i}`).value = insPickerSelected[i] ?? "";
  });
  renderInsChosenList();
  closeInsPicker();
}

document.getElementById("openInsPickerBtn").addEventListener("click", openInsPicker);
document.getElementById("insPickerClose").addEventListener("click",   closeInsPicker);
document.getElementById("insPickerConfirm").addEventListener("click", confirmInsPicker);
document.getElementById("insPickerSearch").addEventListener("input",  e => renderInsPickerList(e.target.value.trim()));
document.getElementById("insPickerOverlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeInsPicker();
});

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"'`=/]/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
    "/":"&#x2F;","`":"&#x60;","=":"&#x3D;",
  }[s]));
}
