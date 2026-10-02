function getToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

const TOAST_ICONS = {
  error: "fa-solid fa-circle-exclamation",
  info: "fa-solid fa-circle-info",
  success: "fa-solid fa-circle-check",
};

function showToast(message, type = "info", duration = 5000) {
  const container = getToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "alert");

  const icon = document.createElement("i");
  icon.className = `toast-icon ${TOAST_ICONS[type] || TOAST_ICONS.info}`;

  const text = document.createElement("span");
  text.className = "toast-message";
  text.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.className = "toast-close";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';

  toast.append(icon, text, closeBtn);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  const remove = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  };

  closeBtn.addEventListener("click", remove);
  if (duration > 0) setTimeout(remove, duration);
}

function normalizeNumericId(value) {
  const id = String(value ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}
function buildNumericInList(values) {
  return [...new Set(values.map(normalizeNumericId).filter(Boolean))].join(",");
}
function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(
    /[&<>"'`=/]/g,
    (s) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "/": "&#x2F;",
        "`": "&#x60;",
        "=": "&#x3D;",
      })[s],
  );
}
function fmt(v) {
  return Number(v || 0).toLocaleString("en-US");
}
function fmtPct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : "";
}
function fmtSgn(v) {
  const n = Number(v) || 0;
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
}
function fmtDiff(v) {
  const n = Number(v) || 0;
  const cls = n >= 0 ? "diff-positive" : "diff-negative";
  return `<span class="${cls}">${fmtSgn(n)}</span>`;
}
function metricStack(base, sum, formatter) {
  return `<div class="metric-stack"><div class="metric-base">${formatter(sum)}</div><div class="metric-rollup">${formatter(base)}</div></div>`;
}
function maybeStack(base, sum, formatter, show) {
  return show ? metricStack(base, sum, formatter) : formatter(base);
}
function pairStack(l1, b1, s1, l2, b2, s2, show) {
  return `<div class="modal-pair-stack">
    <div class="modal-pair-line"><span class="troop-diff-label">${l1}</span>${
      show
        ? metricStack(b1, s1, (v) => {
            const n = Number(v) || 0;
            return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
          })
        : fmtDiff(b1)
    }</div>
    <div class="modal-pair-line"><span class="troop-diff-label">${l2}</span>${
      show
        ? metricStack(b2, s2, (v) => {
            const n = Number(v) || 0;
            return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
          })
        : fmtDiff(b2)
    }</div>
  </div>`;
}

function searchByName(query) {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];
  const results = [];
  const seen = new Set();

  if (db) {
    try {
      const res = db.exec(`
        SELECT DISTINCT governor_id, name FROM governors
        WHERE lower(name) LIKE '%${q.replace(/'/g, "''")}%'
        ORDER BY name
        LIMIT 20
      `);
      if (res.length && res[0].values.length) {
        res[0].values.forEach(([id, name]) => {
          const key = String(id);
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ id: key, name: name || key, src: "kvk" });
          }
        });
      }
    } catch (e) {
      console.warn("Name search (kvk.db):", e);
    }
  }

  if (scansDb) {
    try {
      const res = scansDb.exec(`
        SELECT DISTINCT governor_id, name FROM governors
        WHERE lower(name) LIKE '%${q.replace(/'/g, "''")}%'
        ORDER BY name
        LIMIT 20
      `);
      if (res.length && res[0].values.length) {
        res[0].values.forEach(([id, name]) => {
          const key = String(id);
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ id: key, name: name || key, src: "scan" });
          }
        });
      }
    } catch (e) {
      console.warn("Name search (scans.db):", e);
    }
  }

  results.sort((a, b) => {
    const al = a.name.toLowerCase(),
      bl = b.name.toLowerCase();
    const aStarts = al.startsWith(q),
      bStarts = bl.startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return al.localeCompare(bl);
  });
  return results.slice(0, 15);
}

let db = null;
let dbReady = false;
let scansDb = null;

let itemsData = { items: {} };
let commandersData = { commanders: {} };
let inscriptionsData = { inscriptions: {} };
let inscriptionsByName = {};
let skinsData = { skins: {} };
let armamentsData = { armaments: {} };
let armamentsByKey = {};

function normalizeArmamentKey(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/formation/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function loadEquipRefData() {
  try {
    const [itemsRes, commandersRes, inscriptionsRes, skinsRes, armamentsRes] =
      await Promise.all([
        fetch("data/items.json"),
        fetch("data/commanders.json"),
        fetch("data/inscriptions.json"),
        fetch("data/skins.json"),
        fetch("data/armaments.json"),
      ]);
    itemsData = await itemsRes.json();
    commandersData = await commandersRes.json();
    inscriptionsData = await inscriptionsRes.json();
    skinsData = await skinsRes.json();
    armamentsData = await armamentsRes.json();

    inscriptionsByName = {};
    for (const [key, info] of Object.entries(
      inscriptionsData.inscriptions || {},
    )) {
      const nameKey = String(info.name || key)
        .trim()
        .toLowerCase();
      inscriptionsByName[nameKey] = { key, ...info };
    }

    armamentsByKey = {};
    for (const [key, info] of Object.entries(
      armamentsData.armaments || {},
    )) {
      const entry = { key, ...info };
      armamentsByKey[normalizeArmamentKey(key)] = entry;
      if (info.name) armamentsByKey[normalizeArmamentKey(info.name)] = entry;
    }
  } catch (e) {
    console.error("loadEquipRefData:", e);
  }
}
loadEquipRefData();

function getInscriptionInfo(name) {
  const key = String(name ?? "")
    .trim()
    .toLowerCase();
  return inscriptionsByName[key] || null;
}

function getSkinInfo(skinCode) {
  const key = String(skinCode ?? "").trim();
  return (skinsData.skins && skinsData.skins[key]) || null;
}

const DB_VERSION = "12";
const SCANS_DB_VERSION = "1";

async function loadDatabase() {
  const SQL = await initSqlJs({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${f}`,
  });
  const res = await fetch(`kvk.db?v=${DB_VERSION}`);
  const buf = await res.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buf));
  ensureSchema();
  return SQL;
}

async function loadScansDatabase(SQL) {
  try {
    const res = await fetch(`scans_2247.db?v=${SCANS_DB_VERSION}`);
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    scansDb = new SQL.Database(new Uint8Array(buf));
  } catch (e) {
    console.warn("scans_2247.db not available:", e);
  }
}

function loadScanStats(govId) {
  if (!scansDb) return null;
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  try {
    const snapRes = scansDb.exec(
      `SELECT snapshot_id, snapshot_date FROM snapshots ORDER BY snapshot_date DESC LIMIT 1`,
    );
    if (!snapRes.length || !snapRes[0].values.length) return null;
    const [snapId, snapDate] = snapRes[0].values[0];

    const res = scansDb.exec(`
      SELECT s.power, s.kill_points, s.deaths,
             s.t1, s.t2, s.t3, s.t4, s.t5,
             s.ranged_points, s.rss_gathered, s.rss_assistance,
             s.helps, s.alliance, s.acclaim,
             g.name
      FROM stats s
      JOIN governors g ON g.governor_id = s.governor_id
      WHERE s.governor_id = ${safeId} AND s.snapshot_id = ${snapId}
      LIMIT 1
    `);
    if (!res.length || !res[0].values.length) return null;
    const r = res[0].values[0];
    return {
      snapDate,
      power: r[0],
      killPoints: r[1],
      deaths: r[2],
      t1: r[3],
      t2: r[4],
      t3: r[5],
      t4: r[6],
      t5: r[7],
      rangedPoints: r[8],
      rssGathered: r[9],
      rssAssistance: r[10],
      helps: r[11],
      alliance: r[12],
      acclaim: r[13],
      name: r[14],
    };
  } catch (e) {
    console.warn("loadScanStats error:", e);
    return null;
  }
}

function ensureSchema() {
  const cols = db.exec("PRAGMA table_info(stats)");
  const existing = new Set(cols.length ? cols[0].values.map((r) => r[1]) : []);
  [
    ["sum_min_dkp", "INTEGER"],
    ["sum_dkp", "INTEGER"],
    ["sum_dkp_percent", "REAL"],
  ].forEach(([name, type]) => {
    if (!existing.has(name))
      db.run(`ALTER TABLE stats ADD COLUMN ${name} ${type}`);
  });
}

function detectKingdom(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  const res = db.exec(`
    SELECT g.kingdom
    FROM governors g
    JOIN kvks k ON k.kingdom = g.kingdom
    JOIN snapshots sn ON sn.kvk_id = k.id
    JOIN stats s ON s.snapshot_id = sn.id AND s.governor_id = '${safeId}'
    ORDER BY k.kvk_number DESC, sn.snapshot_date DESC
    LIMIT 1
  `);
  if (res.length && res[0].values.length) return res[0].values[0][0];
  const g = db.exec(
    `SELECT kingdom FROM governors WHERE governor_id='${safeId}' LIMIT 1`,
  );
  return g.length && g[0].values.length ? g[0].values[0][0] : null;
}

function getBestSnapshotForGov(govId, kd) {
  const safeId = normalizeNumericId(govId);
  if (!safeId || !kd) return null;
  const res = db.exec(`
    SELECT sn.id
    FROM stats s
    JOIN snapshots sn ON sn.id = s.snapshot_id
    JOIN kvks k ON k.id = sn.kvk_id AND k.kingdom = '${kd}'
    WHERE s.governor_id = '${safeId}'
    ORDER BY k.kvk_number DESC, sn.snapshot_date DESC
    LIMIT 1
  `);
  return res.length && res[0].values.length ? res[0].values[0][0] : null;
}

function loadGovernorInfo(govId, kd) {
  const safeId = normalizeNumericId(govId);
  if (!safeId || !kd) return null;
  const snapId = getBestSnapshotForGov(safeId, kd);
  if (!snapId) return null;
  const res = db.exec(`
    SELECT g.name,
           s.power, s.kill_points, s.t4, s.t5, s.deads,
           s.power_diff, s.kp_diff, s.t4_diff, s.t5_diff, s.deads_diff,
           s.min_dkp, s.dkp, s.dkp_percent,
           coalesce(s.sum_min_dkp, s.min_dkp) AS sum_min_dkp,
           coalesce(s.sum_dkp, s.dkp) AS sum_dkp,
           coalesce(s.sum_dkp_percent, s.dkp_percent) AS sum_dkp_percent,
           coalesce(s.vacation,'NO') AS vacation,
           coalesce(s.status,'OK') AS status,
           s.acclaim
    FROM stats s
    JOIN governors g ON g.governor_id=s.governor_id AND g.kingdom='${kd}'
    WHERE s.snapshot_id=${snapId} AND s.governor_id='${safeId}'
    LIMIT 1
  `)[0];
  if (!res) return null;
  const r = res.values[0];
  return {
    name: r[0],
    power: r[1],
    kp: r[2],
    t4: r[3],
    t5: r[4],
    deads: r[5],
    powerDiff: r[6],
    kpDiff: r[7],
    t4Diff: r[8],
    t5Diff: r[9],
    deadsDiff: r[10],
    minDkp: r[11],
    dkp: r[12],
    dkpPercent: r[13],
    sumMinDkp: r[14],
    sumDkp: r[15],
    sumDkpPercent: r[16],
    vacation: r[17],
    status: r[18],
    acclaim: r[19],
  };
}

function resolveFarmMainId(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return safeId;
  const res = db.exec(
    `SELECT main_id, acc_type FROM farm_accounts WHERE player_id=${safeId} LIMIT 1`,
  );
  if (!res.length || !res[0].values.length) return safeId;
  const [mainId, accType] = res[0].values[0];
  const safeMid = normalizeNumericId(mainId);
  return String(accType || "").toLowerCase() === "farm" && safeMid
    ? safeMid
    : safeId;
}

function getAccType(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  const res = db.exec(
    `SELECT acc_type FROM farm_accounts WHERE player_id=${safeId} LIMIT 1`,
  );
  if (!res.length || !res[0].values.length) return null;
  return String(res[0].values[0][0] || "").toLowerCase();
}

function loadCH(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  const res = db.exec(
    `SELECT ch FROM farm_accounts WHERE player_id=${safeId} LIMIT 1`,
  );
  if (!res.length || !res[0].values.length) return null;
  const ch = res[0].values[0][0];
  return ch !== null &&
    ch !== undefined &&
    String(ch).trim() !== "" &&
    String(ch).trim() !== "0"
    ? String(ch).trim()
    : null;
}

function loadGovernorFarms(mainId) {
  const safeId = normalizeNumericId(mainId);
  if (!safeId) return [];
  const res = db.exec(
    `SELECT name,player_id,power,killpoints,deads,ch FROM farm_accounts WHERE main_id=${safeId} AND acc_type='farm' ORDER BY power DESC`,
  );
  if (!res.length) return [];
  return res[0].values.map((r) => ({
    name: r[0] ?? "",
    id: r[1] ?? "",
    power: Number(r[2] ?? 0),
    killpoints: Number(r[3] ?? 0),
    deads: Number(r[4] ?? 0),
    ch: r[5] ?? "",
  }));
}

function loadFarmOwner(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  const res = db.exec(`
    SELECT main.player_id, main.name, main.power, main.killpoints, main.deads, main.ch
    FROM farm_accounts farm
    JOIN farm_accounts main ON main.player_id=farm.main_id AND main.acc_type='main'
    WHERE farm.player_id=${safeId} AND farm.acc_type='farm'
    LIMIT 1
  `);
  if (!res.length || !res[0].values.length) return null;
  const r = res[0].values[0];
  return {
    id: r[0] ?? "",
    name: r[1] ?? "",
    power: Number(r[2] ?? 0),
    killpoints: Number(r[3] ?? 0),
    deads: Number(r[4] ?? 0),
    ch: r[5] ?? "",
  };
}

function loadGovHistory(govId, kd) {
  const safeId = normalizeNumericId(govId);
  if (!safeId || !kd) return [];
  const isMain = resolveFarmMainId(safeId) === safeId;
  const farmIds = isMain ? loadGovernorFarms(safeId).map((f) => f.id) : [];
  const farmIdList = buildNumericInList(farmIds);

  const kvksRes = db.exec(
    `SELECT id,kvk_number FROM kvks WHERE kingdom='${kd}' ORDER BY kvk_number`,
  );
  if (!kvksRes.length) return [];
  const results = [];
  for (const [kvkId, kvkNumber] of kvksRes[0].values) {
    const snap = db.exec(
      `SELECT id FROM snapshots WHERE kvk_id=${kvkId} AND is_last=1 LIMIT 1`,
    );
    if (!snap.length) continue;
    const snapId = snap[0].values[0][0];
    const st = db.exec(`
      SELECT s.power_diff,s.kp_diff,s.t4_diff,s.t5_diff,s.deads_diff,
             s.min_dkp,s.dkp,s.dkp_percent,
             coalesce(s.sum_min_dkp,s.min_dkp),coalesce(s.sum_dkp,s.dkp),coalesce(s.sum_dkp_percent,s.dkp_percent),
             s.acclaim
      FROM stats s
      WHERE s.snapshot_id=${snapId} AND s.governor_id='${safeId}'
    `);
    if (!st.length) continue;
    const r = st[0].values[0];
    let farmSums = null;
    if (farmIdList) {
      const fs = db.exec(`
        SELECT coalesce(sum(s.power_diff),0),coalesce(sum(s.kp_diff),0),
               coalesce(sum(s.t4_diff),0),coalesce(sum(s.t5_diff),0),coalesce(sum(s.deads_diff),0),
               coalesce(sum(s.min_dkp),0),coalesce(sum(s.dkp),0),coalesce(sum(s.dkp_percent),0),
               coalesce(sum(s.acclaim),0)
        FROM stats s
        WHERE s.snapshot_id=${snapId} AND CAST(s.governor_id AS INTEGER) IN (${farmIdList})
      `);
      farmSums = fs.length ? fs[0].values[0] : null;
    }
    results.push({
      kvk: `KvK ${kvkNumber}`,
      hasFarmRollup: isMain && Boolean(farmIdList),
      powerDiff: r[0],
      kpDiff: r[1],
      t4Diff: r[2],
      t5Diff: r[3],
      deadsDiff: r[4],
      minDkp: r[5],
      dkp: r[6],
      dkpPercent: r[7],
      acclaim: r[11],
      sumPowerDiff: Number(r[0] || 0) + Number(farmSums?.[0] || 0),
      sumKpDiff: Number(r[1] || 0) + Number(farmSums?.[1] || 0),
      sumT4Diff: Number(r[2] || 0) + Number(farmSums?.[2] || 0),
      sumT5Diff: Number(r[3] || 0) + Number(farmSums?.[3] || 0),
      sumDeadsDiff: Number(r[4] || 0) + Number(farmSums?.[4] || 0),
      sumMinDkp: Number(r[5] || 0) + Number(farmSums?.[5] || 0),
      sumDkp: Number(r[6] || 0) + Number(farmSums?.[6] || 0),
      sumDkpPercent: Number(r[7] || 0) + Number(farmSums?.[7] || 0),
      sumAcclaim: Number(r[11] || 0) + Number(farmSums?.[8] || 0),
    });
  }
  return results;
}

function loadFarmKvKStats(farmIds, kd) {
  const idList = buildNumericInList(farmIds);
  if (!idList || !kd) return [];
  const kvksRes = db.exec(
    `SELECT id,kvk_number FROM kvks WHERE kingdom='${kd}' ORDER BY kvk_number`,
  );
  if (!kvksRes.length) return [];
  const results = [];
  for (const [kvkId, kvkNumber] of kvksRes[0].values) {
    const snap = db.exec(
      `SELECT id FROM snapshots WHERE kvk_id=${kvkId} AND is_last=1 LIMIT 1`,
    );
    if (!snap.length) continue;
    const snapId = snap[0].values[0][0];
    const st = db.exec(`
      SELECT g.name,s.governor_id,s.power_diff,s.kp_diff,s.t4_diff,s.t5_diff,
             s.deads_diff,s.dkp,s.dkp_percent,s.acclaim
      FROM stats s
      JOIN governors g ON g.governor_id=s.governor_id AND g.kingdom='${kd}'
      WHERE s.snapshot_id=${snapId} AND CAST(s.governor_id AS INTEGER) IN (${idList})
      ORDER BY s.dkp DESC
    `);
    if (!st.length) continue;
    st[0].values.forEach((r) => {
      results.push({
        kvk: `KvK ${kvkNumber}`,
        name: r[0],
        id: r[1],
        powerDiff: r[2],
        kpDiff: r[3],
        t4Diff: r[4],
        t5Diff: r[5],
        deadsDiff: r[6],
        dkp: r[7],
        dkpPercent: r[8],
        acclaim: r[9],
      });
    });
  }
  return results;
}

function loadEquipment(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='equipment'`,
    );
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(
      `SELECT * FROM equipment WHERE player_id=${safeId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => {
      row[c] = res[0].values[0][i];
    });
    return row;
  } catch (e) {
    return null;
  }
}

function loadArmaments(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='armaments'`,
    );
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(
      `SELECT * FROM armaments WHERE player_id=${safeId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => {
      row[c] = res[0].values[0][i];
    });
    return row;
  } catch (e) {
    return null;
  }
}

function loadPlayerProfile(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId || !db) return null;
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='player_profile'`,
    );
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(
      `SELECT vip_level, city_skin FROM player_profile WHERE player_id=${safeId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return null;
    const [vip_level, city_skin] = res[0].values[0];
    return { vip_level, city_skin };
  } catch (e) {
    console.error("loadPlayerProfile:", e);
    return null;
  }
}

function loadSkins(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId || !db) return null;
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='skins'`,
    );
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(
      `SELECT * FROM skins WHERE player_id=${safeId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c, i) => {
      row[c] = res[0].values[0][i];
    });
    return row;
  } catch (e) {
    console.error("loadSkins:", e);
    return null;
  }
}

const EQUIP_SLOTS = [
  { key: "helm", label: "Helm", id: "helmet" },
  { key: "chest", label: "Chest", id: "chest" },
  { key: "weapon", label: "Weapon", id: "weapon" },
  { key: "gloves", label: "Gloves", id: "gloves" },
  { key: "legs", label: "Legs", id: "legs" },
  { key: "boots", label: "Boots", id: "boots" },
  { key: "accessory", label: "Acc.", id: "accessory" },
  { key: "accessory_sec", label: "Acc.2", id: "accessory_sec" },
];
const ARM_SLOTS = Array.from({ length: 8 }, (_, i) => ({
  prefix: `arm${i + 1}`,
  label: `Arm ${i + 1}`,
}));
const SKIN_SLOTS = Array.from({ length: 8 }, (_, i) => `skin${i + 1}`);

function iconPath(name, kind) {
  const folder =
    kind === "commander" ? "commanders" :
    kind === "skin" ? "skins" :
    kind === "armament" ? "armaments" :
    "equipment";
  return `icons/${folder}/${encodeURIComponent(String(name).trim().toLowerCase())}.webp`;
}

function isEmptyVal(v) {
  if (v === null || v === undefined || v === "") return true;
  const s = String(v).trim().toLowerCase();
  return s === "none" || s === "0";
}
function isMarchEmpty(row, suffix) {
  return EQUIP_SLOTS.every((slot) => {
    const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
    return isEmptyVal(row[colKey]);
  });
}
function getEquipRarity(name) {
  if (isEmptyVal(name)) return "empty";
  const n = String(name).trim().toLowerCase();
  if (n.endsWith("gray")) return "gray";
  if (n.endsWith("gr")) return "green";
  if (n.endsWith("g")) return "gold";
  if (n.endsWith("p")) return "purple";
  if (n.endsWith("b")) return "blue";
  return "unknown";
}
const ROMAN_NUMERALS = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
];
function toRoman(v) {
  const n = parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return ROMAN_NUMERALS[n] || String(n);
}

function hasTalent(v) {
  if (isEmptyVal(v)) return false;
  const s = String(v).trim().toLowerCase();
  return !["no", "n", "false", "-", "—"].includes(s);
}

function getAbilityTier(name) {
  if (!name) return "gray";
  const info = getInscriptionInfo(name);
  return info ? info.rarity : "gray";
}

const POSTER_W = 860;
const POSTER_PAD_X = 40;

const POSTER_RARITY_COLORS = {
  gray: "#8a8a8a",
  green: "#4caf50",
  blue: "#2196f3",
  purple: "#9c6ade",
  gold: "#e0b23c",
  unknown: "#665a99",
  empty: "#443a70",
};

function posterRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function posterText(ctx, text, x, y, font, color, align = "center") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function posterTruncate(ctx, text, font, maxWidth) {
  ctx.font = font;
  const str = String(text ?? "");
  if (ctx.measureText(str).width <= maxWidth) return str;
  let t = str;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function loadImageSafe(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawPosterBackground(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0b0a1e");
  grad.addColorStop(0.35, "#191340");
  grad.addColorStop(1, "#241a52");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  let seed = 42;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  const starCount = Math.round((w * Math.min(h, 900)) / 6500);
  for (let i = 0; i < starCount; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = rnd() < 0.85 ? 1 : 1.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#100c28";
  ctx.beginPath();
  ctx.moveTo(0, 210);
  ctx.lineTo(0, 130);
  ctx.lineTo(w * 0.12, 95);
  ctx.lineTo(w * 0.24, 140);
  ctx.lineTo(w * 0.38, 60);
  ctx.lineTo(w * 0.5, 120);
  ctx.lineTo(w * 0.64, 70);
  ctx.lineTo(w * 0.78, 145);
  ctx.lineTo(w * 0.9, 55);
  ctx.lineTo(w, 100);
  ctx.lineTo(w, 210);
  ctx.closePath();
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawIconTile(ctx, img, x, y, size, borderColor) {
  posterRoundRect(ctx, x, y, size, size, 8);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.strokeStyle = borderColor || "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (img) {
    ctx.save();
    posterRoundRect(ctx, x + 2, y + 2, size - 4, size - 4, 6);
    ctx.clip();
    ctx.drawImage(img, x + 2, y + 2, size - 4, size - 4);
    ctx.restore();
  } else {
    posterText(ctx, "—", x + size / 2, y + size / 2, "13px sans-serif", "rgba(255,255,255,0.35)");
  }
}

function drawPlainIcon(ctx, img, x, y, size) {
  if (!img) return;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 8;
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function measurePillWidth(ctx, label, font) {
  ctx.font = font;
  return ctx.measureText(label).width + 20;
}

function drawArmamentCard(ctx, iconMap, a, cellX, topY, cellW, iconSize) {
  let y = topY;

  const nameFont = "700 14px 'DM Sans', sans-serif";
  const img = iconMap.get(a.icon);
  const iconGap = img ? 8 : 0;
  const iconW = img ? iconSize : 0;
  const nameStr = posterTruncate(ctx, a.name, nameFont, cellW - 12 - iconW - iconGap);
  ctx.font = nameFont;
  const nameW = ctx.measureText(nameStr).width;
  const startX = cellX - (iconW + iconGap + nameW) / 2;
  if (img) drawPlainIcon(ctx, img, startX, y, iconSize);
  posterText(ctx, nameStr, startX + iconW + iconGap, y + iconSize / 2, nameFont, "#f3f1ff", "left");
  y += iconSize + 6;

  if (a.inscriptions.length) {
    const pillFont = "600 10px 'DM Sans', sans-serif";
    const pillH = 18;
    const gapX = 6;
    const gapY = 6;
    const maxW = cellW - 10;
    const pills = a.inscriptions.map((ins) => {
      const label = ins.label;
      return { label, tier: ins.tier, w: measurePillWidth(ctx, label, pillFont) };
    });
    const lines = [];
    let line = [];
    let lineW = 0;
    pills.forEach((p) => {
      const addW = p.w + (line.length ? gapX : 0);
      if (lineW + addW > maxW && line.length) {
        lines.push(line);
        line = [];
        lineW = 0;
      }
      line.push(p);
      lineW += p.w + (line.length > 1 ? gapX : 0);
    });
    if (line.length) lines.push(line);

    lines.forEach((ln) => {
      const w = ln.reduce((s, p) => s + p.w, 0) + gapX * (ln.length - 1);
      let x = cellX - w / 2;
      ln.forEach((p) => {
        posterRoundRect(ctx, x, y, p.w, pillH, pillH / 2);
        ctx.fillStyle = POSTER_RARITY_COLORS[p.tier] || POSTER_RARITY_COLORS.unknown;
        ctx.fill();
        posterText(ctx, p.label, x + p.w / 2, y + pillH / 2 + 0.5, pillFont, "#0b0a1e");
        x += p.w + gapX;
      });
      y += pillH + gapY;
    });
    y += 2;
  }

  a.stats.forEach((s) => {
    const statStr = posterTruncate(ctx, `${s.name} +${s.val}%`, "11px 'DM Sans', sans-serif", cellW - 12);
    posterText(ctx, statStr, cellX, y + 7, "11px 'DM Sans', sans-serif", "#8fe3ac");
    y += 15;
  });

  return y - topY;
}

function drawEquipSlotIcon(ctx, iconMap, x, y, size, itemName, lvl, tal) {
  const empty = isEmptyVal(itemName);
  const rarity = getEquipRarity(itemName);
  const color = POSTER_RARITY_COLORS[rarity] || POSTER_RARITY_COLORS.unknown;
  drawIconTile(ctx, empty ? null : iconMap.get(iconPath(itemName, "item")), x, y, size, color);
  if (!empty) {
    const roman = toRoman(lvl);
    if (roman) {
      const badgeW = Math.max(16, size * 0.42);
      const badgeH = 13;
      const bx = x + size / 2 - badgeW / 2;
      const by = y + size - badgeH / 2 - 2;
      posterRoundRect(ctx, bx, by, badgeW, badgeH, badgeH / 2);
      ctx.fillStyle = "rgba(10,8,25,0.88)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      posterText(ctx, roman, bx + badgeW / 2, by + badgeH / 2 + 0.5, "700 9px 'DM Sans', sans-serif", "#ffd76a");
    }
    if (hasTalent(tal)) {
      ctx.beginPath();
      ctx.fillStyle = "#57e08c";
      ctx.arc(x + size - 6, y + 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const EQUIP_DIAMOND_ROWS = [[0], [1], [2, 3], [4], [5, 6], [7]];

function drawEquipDiamond(ctx, iconMap, slots, centerX, topY, slotSize) {
  const gapV = 6;
  const gapH = 10;
  let y = topY;
  EQUIP_DIAMOND_ROWS.forEach((idxRow) => {
    const rowSlots = idxRow.map((i) => slots[i]);
    const n = rowSlots.length;
    const rowW = n * slotSize + (n - 1) * gapH;
    let x = centerX - rowW / 2;
    rowSlots.forEach(({ itemName, lvl, tal }) => {
      drawEquipSlotIcon(ctx, iconMap, x, y, slotSize, itemName, lvl, tal);
      x += slotSize + gapH;
    });
    y += slotSize + gapV;
  });
  return y - gapV - topY;
}

function buildEquipmentMarches(row) {
  if (!row) return [];
  const MARCH_SUFFIXES = ["", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const marches = [];
  MARCH_SUFFIXES.forEach((suffix, idx) => {
    if (isMarchEmpty(row, suffix)) return;
    const slots = EQUIP_SLOTS.map((slot) => {
      const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
      const lvlKey = suffix ? `${slot.key}_lvl_${suffix}` : `${slot.key}_lvl`;
      const talKey = suffix ? `${slot.key}_tal_${suffix}` : `${slot.key}_tal`;
      return { itemName: row[colKey], lvl: row[lvlKey], tal: row[talKey] };
    });
    marches.push({ marchNum: idx + 1, slots });
  });
  return marches;
}

function buildArmamentsList(armRow) {
  if (!armRow) return [];
  const list = [];
  ARM_SLOTS.forEach((arm) => {
    const name = armRow[arm.prefix];
    if (isEmptyVal(name)) return;
    const insKeys = ["_ins", "_ins2", "_ins3", "_ins4", "_ins5", "_ins6", "_ins7", "_ins8"];
    const inscriptions = insKeys
      .map((k) => armRow[`${arm.prefix}${k}`])
      .filter((v) => !isEmptyVal(v))
      .map((v) => ({ label: String(v).trim(), tier: getAbilityTier(String(v)) }));
    const stats = [
      { n: `${arm.prefix}_stat_name`, v: `${arm.prefix}_stat` },
      { n: `${arm.prefix}_stat2_name2`, v: `${arm.prefix}_stat2` },
      { n: `${arm.prefix}_stat3_name3`, v: `${arm.prefix}_stat3` },
      { n: `${arm.prefix}_stat4_name4`, v: `${arm.prefix}_stat4` },
    ]
      .filter((s) => !isEmptyVal(armRow[s.n]) && !isEmptyVal(armRow[s.v]))
      .map((s) => ({ name: String(armRow[s.n]), val: String(armRow[s.v]) }));
    list.push({ name: String(name), icon: iconPath(name, "armament"), inscriptions, stats });
  });
  return list;
}

function buildPairsList(row) {
  if (!row) return [];
  const pairs = [];
  for (let n = 1; n <= 12; n++) {
    const c1 = row[`pair${n}_comm1`];
    const c2 = row[`pair${n}_comm2`];
    if (isEmptyVal(c1) && isEmptyVal(c2)) continue;
    pairs.push([c1, c2]);
  }
  return pairs;
}

function buildSkinsList(skinsRow) {
  if (!skinsRow) return [];
  return SKIN_SLOTS.map((k) => skinsRow[k]).filter((v) => !isEmptyVal(v));
}

function renderPosterContent(ctx, data, iconMap, W) {
  const { scan, profile, ch, accType, marches, armaments, pairs, skins } = data;
  const padX = POSTER_PAD_X;
  const contentW = W - padX * 2;
  const cx = W / 2;
  let y = 36;

  posterText(ctx, data.name, cx, y + 26, "700 26px 'DM Sans', sans-serif", "#f3f1ff");
  posterText(ctx, `ID ${data.govId}`, cx, y + 52, "13px monospace", "#b9a8f5");
  const badgeParts = [];
  if (profile?.vip_level && !isEmptyVal(profile.vip_level)) {
    badgeParts.push(String(profile.vip_level) === "20" ? "SVIP" : `VIP ${profile.vip_level}`);
  }
  if (ch) badgeParts.push(`CH ${ch}`);
  if (accType === "farm") badgeParts.push("Farm Account");
  if (accType === "main") badgeParts.push("Main Account");
  if (badgeParts.length) {
    posterText(ctx, badgeParts.join("   ·   "), cx, y + 80, "600 13px 'DM Sans', sans-serif", "#8fe3ac");
  }
  y += 116;

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 230, y);
  ctx.lineTo(cx + 230, y);
  ctx.stroke();
  y += 26;

  if (scan) {
    const rows = [
      [
        ["Power", fmt(scan.power)],
        ["Kill Points", fmt(scan.killPoints)],
        ["Deaths", fmt(scan.deaths)],
        ["Ranged Points", fmt(scan.rangedPoints)],
      ],
      [
        ["T1", fmt(scan.t1)],
        ["T2", fmt(scan.t2)],
        ["T3", fmt(scan.t3)],
        ["T4", fmt(scan.t4)],
        ["T5", fmt(scan.t5)],
      ],
      [
        ["RSS Gathered", fmt(scan.rssGathered)],
        ["RSS Assistance", fmt(scan.rssAssistance)],
        ["Helps", fmt(scan.helps)],
        ["Acclaim", fmt(scan.acclaim)],
      ],
    ];
    rows.forEach((items) => {
      const itemW = contentW / items.length;
      const startX = padX + itemW / 2;
      items.forEach(([label, value], i) => {
        const x = startX + i * itemW;
        posterText(ctx, label, x, y + 13, "600 12px 'DM Sans', sans-serif", "#b9a8f5");
        posterText(ctx, value, x, y + 35, "700 16px 'DM Sans', sans-serif", "#f3f1ff");
      });
      y += 52;
    });
    posterText(ctx, `Snapshot · ${data.snapDate}`, W - padX, y + 6, "11px 'DM Sans', sans-serif", "rgba(185,168,245,0.7)", "right");
    y += 30;
  } else {
    posterText(ctx, "No live scan data available.", cx, y + 20, "14px 'DM Sans', sans-serif", "rgba(255,255,255,0.55)");
    y += 46;
  }

  y += 16;

  y += 26;
  if (!marches.length) {
    posterText(ctx, "No equipment set.", cx, y + 12, "13px 'DM Sans', sans-serif", "rgba(255,255,255,0.5)");
    y += 30;
  } else {
    const slotSize = 42;
    const colsPerRow = Math.min(marches.length, 4);
    const colW = contentW / colsPerRow;
    for (let i = 0; i < marches.length; i += colsPerRow) {
      const rowMarches = marches.slice(i, i + colsPerRow);
      let maxColHeight = 0;
      rowMarches.forEach((m, ci) => {
        const colCenterX = padX + colW * ci + colW / 2;
        posterText(ctx, `Equipment ${m.marchNum}`, colCenterX, y + 8, "600 12px 'DM Sans', sans-serif", "#b9a8f5");
        const colH = drawEquipDiamond(ctx, iconMap, m.slots, colCenterX, y + 24, slotSize);
        maxColHeight = Math.max(maxColHeight, colH);
      });
      y += 24 + maxColHeight + 26;
    }
  }

  y += 16;

  y += 16;
  if (!armaments.length) {
    posterText(ctx, "No armaments set.", cx, y + 12, "13px 'DM Sans', sans-serif", "rgba(255,255,255,0.5)");
    y += 30;
  } else {
    const cols = 4;
    const cellW = contentW / cols;
    const iconSize = 30;
    const rowGap = 14;
    for (let i = 0; i < armaments.length; i += cols) {
      const rowArms = armaments.slice(i, i + cols);
      let maxH = 0;
      rowArms.forEach((a, ci) => {
        const cellX = padX + cellW * ci + cellW / 2;
        const h = drawArmamentCard(ctx, iconMap, a, cellX, y, cellW, iconSize);
        maxH = Math.max(maxH, h);
      });
      y += maxH + rowGap;
    }
  }

  y += 16;

  y += 26;
  if (!pairs.length) {
    posterText(ctx, "No commander pairs set.", cx, y + 12, "13px 'DM Sans', sans-serif", "rgba(255,255,255,0.5)");
    y += 30;
  } else {
    const cols = 5;
    const cellW = contentW / cols;
    const iconSize = 58;
    const boxGap = 8;
    const rowStep = 96;
    pairs.forEach(([c1, c2], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = padX + cellW * col + cellW / 2;
      const cellY = y + row * rowStep;
      const totalW = iconSize * 2 + boxGap;
      let x0 = cellX - totalW / 2;
      [c1, c2].forEach((c) => {
        const empty = isEmptyVal(c);
        drawIconTile(ctx, empty ? null : iconMap.get(iconPath(c, "commander")), x0, cellY, iconSize, "#3a2f66");
        x0 += iconSize + boxGap;
      });
    });
    y += Math.ceil(pairs.length / cols) * rowStep;
  }

  y += 16;


  y += 26;
  if (!skins.length) {
    posterText(ctx, "No skins set.", cx, y + 12, "13px 'DM Sans', sans-serif", "rgba(255,255,255,0.5)");
    y += 30;
  } else {
    const cols = 5;
    const cellW = contentW / cols;
    const iconSize = 76;
    const rowStep = 122;
    skins.forEach((code, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = padX + cellW * col + cellW / 2;
      const cellY = y + row * rowStep;
      drawIconTile(ctx, iconMap.get(iconPath(code, "skin")), cellX - iconSize / 2, cellY, iconSize, "#e0b23c");
      const info = getSkinInfo(code);
      const label = posterTruncate(ctx, (info && info.name) || code, "600 13px 'DM Sans', sans-serif", cellW - 12);
      posterText(ctx, label, cellX, cellY + iconSize + 16, "600 13px 'DM Sans', sans-serif", "#f3f1ff");
    });
    y += Math.ceil(skins.length / cols) * rowStep;
  }

  y += 30;
  return y;
}

async function buildStatPosterDataUrl(govId) {
  const scan = loadScanStats(govId);
  const profile = loadPlayerProfile(govId);
  const ch = loadCH(govId);
  const accType = getAccType(govId);
  const equipRow = loadEquipment(govId);
  const armRow = loadArmaments(govId);
  const skinsRow = loadSkins(govId);

  const marches = buildEquipmentMarches(equipRow);
  const armaments = buildArmamentsList(armRow);
  const pairs = buildPairsList(equipRow);
  const skins = buildSkinsList(skinsRow);

  const iconSrcs = new Set();
  marches.forEach((m) =>
    m.slots.forEach(({ itemName }) => {
      if (!isEmptyVal(itemName)) iconSrcs.add(iconPath(itemName, "item"));
    }),
  );
  armaments.forEach((a) => iconSrcs.add(a.icon));
  pairs.forEach(([c1, c2]) =>
    [c1, c2].forEach((c) => {
      if (!isEmptyVal(c)) iconSrcs.add(iconPath(c, "commander"));
    }),
  );
  skins.forEach((s) => iconSrcs.add(iconPath(s, "skin")));

  const iconMap = new Map();
  await Promise.all(
    [...iconSrcs].map(async (src) => {
      iconMap.set(src, await loadImageSafe(src));
    }),
  );

  const data = {
    name: (scan && scan.name) || String(govId),
    govId: String(govId),
    snapDate: scan ? scan.snapDate : "",
    scan,
    profile,
    ch,
    accType,
    marches,
    armaments,
    pairs,
    skins,
  };

  const W = POSTER_W;
  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = 8000;
  const measuredHeight = renderPosterContent(scratch.getContext("2d"), data, iconMap, W);

  const SCALE = 2;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = Math.ceil(measuredHeight) * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawPosterBackground(ctx, W, Math.ceil(measuredHeight));
  renderPosterContent(ctx, data, iconMap, W);

  return canvas.toDataURL("image/png");
}

async function renderStatCard(govId) {
  const el = document.getElementById("pc-scan-stats");
  el.style.display = "";
  el.innerHTML = `<div class="poster-loading"><div class="spinner"></div><span>Building player card image…</span></div>`;

  try {
    const dataUrl = await buildStatPosterDataUrl(govId);
    el.innerHTML = `
      <img class="poster-image" src="${dataUrl}" alt="Player stat card" draggable="false">
      <a class="poster-download" href="${dataUrl}" download="player-${escapeHtml(String(govId))}.png">
        <i class="fa-solid fa-download"></i> Download image
      </a>`;
  } catch (e) {
    console.error("renderStatCard:", e);
    el.innerHTML = `<div class="pc-equip-empty">Could not build the player image.</div>`;
  }
}

function renderPlayerCard(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) {
    showError("Invalid governor ID.");
    return;
  }

  showState("loading");

  setTimeout(() => {
    try {
      const kd = detectKingdom(safeId);

      if (!kd) {
        const scanData = loadScanStats(safeId);
        if (!scanData) {
          showState("search");
          showError(`No data found for ID ${safeId}.`);
          return;
        }

        renderStatCard(safeId);

        document.getElementById("section-history").style.display = "none";
        document.getElementById("pc-farm-owner-section").style.display = "none";
        document.getElementById("pc-farms-section").style.display = "none";
        document.getElementById("pc-farm-kvk-section").style.display = "none";

        initCollapsibleSections();
        showState("card");
        return;
      }

      document.getElementById("section-history").style.display = "";

      const info = loadGovernorInfo(safeId, kd);
      if (!info) {
        showState("search");
        showError(`No data found for ID ${safeId}.`);
        return;
      }

      const accType = getAccType(safeId);
      const isMain = resolveFarmMainId(safeId) === safeId;
      const isFarm = accType === "farm";
      const farms = isMain ? loadGovernorFarms(safeId) : [];
      const farmIds = farms.map((f) => f.id);
      const farmKvK = farmIds.length ? loadFarmKvKStats(farmIds, kd) : [];
      const farmOwner = isFarm ? loadFarmOwner(safeId) : null;
      const history = loadGovHistory(safeId, kd);
      const hasFarmRollup = isMain && farmIds.length > 0;

      renderStatCard(safeId);

      renderHistoryTable(history);

      if (farmOwner) {
        document.getElementById("pc-farm-owner-section").style.display = "";
        document.getElementById("pc-farm-owner-table").innerHTML =
          renderSimpleTable(
            ["Name", "ID", "Power", "Kill Points", "Deads", "CH"],
            [
              [
                escapeHtml(farmOwner.name),
                `<span class="col-mono">${escapeHtml(String(farmOwner.id))}</span>`,
                fmt(farmOwner.power),
                fmt(farmOwner.killpoints),
                fmt(farmOwner.deads),
                escapeHtml(String(farmOwner.ch)),
              ],
            ],
          );
      } else {
        document.getElementById("pc-farm-owner-section").style.display = "none";
      }

      if (farms.length) {
        document.getElementById("pc-farms-section").style.display = "";
        document.getElementById("pc-farms-table").innerHTML = renderSimpleTable(
          ["Name", "ID", "Power", "Kill Points", "Deads", "CH"],
          farms.map((f) => [
            escapeHtml(f.name),
            `<span class="col-mono">${escapeHtml(String(f.id))}</span>`,
            fmt(f.power),
            fmt(f.killpoints),
            fmt(f.deads),
            escapeHtml(String(f.ch)),
          ]),
        );
      } else {
        document.getElementById("pc-farms-section").style.display = "none";
      }

      if (farmKvK.length) {
        document.getElementById("pc-farm-kvk-section").style.display = "";
        renderFarmKvKSection(farmKvK);
      } else {
        document.getElementById("pc-farm-kvk-section").style.display = "none";
      }

      initCollapsibleSections();
      showState("card");
    } catch (err) {
      console.error(err);
      showState("search");
      showError("Error loading player data: " + String(err));
    }
  }, 50);
}

function renderHistoryTable(rows) {
  const container = document.getElementById("pc-history-table");
  if (!rows.length) {
    container.innerHTML = `<div class="pc-empty">No historical KvK data found.</div>`;
    return;
  }
  const headers = [
    "KvK",
    "Killpoints",
    "T4 / T5",
    "Deads / Power",
    "Min DKP",
    "DKP",
    "DKP %",
    "Acclaim",
  ];
  const ths = headers.map((h) => `<th>${h}</th>`).join("");
  const trs = rows
    .map(
      (r) => `<tr>
    <td class="col-label">${escapeHtml(r.kvk)}</td>
    <td>${
      r.hasFarmRollup
        ? metricStack(r.kpDiff, r.sumKpDiff, (v) => {
            const n = Number(v) || 0;
            return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
          })
        : fmtDiff(r.kpDiff)
    }</td>
    <td>${pairStack("T4", r.t4Diff, r.sumT4Diff, "T5", r.t5Diff, r.sumT5Diff, r.hasFarmRollup)}</td>
    <td>${pairStack("Dead", r.deadsDiff, r.sumDeadsDiff, "Pwr", r.powerDiff, r.sumPowerDiff, r.hasFarmRollup)}</td>
    <td>${maybeStack(r.minDkp, r.sumMinDkp, fmt, r.hasFarmRollup)}</td>
    <td>${maybeStack(r.dkp, r.sumDkp, fmt, r.hasFarmRollup)}</td>
    <td>${maybeStack(r.dkpPercent, r.sumDkpPercent, fmtPct, r.hasFarmRollup)}</td>
    <td>${maybeStack(r.acclaim, r.sumAcclaim, fmt, r.hasFarmRollup)}</td>
  </tr>`,
    )
    .join("");
  container.innerHTML = `<table class="pc-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function renderSimpleTable(headers, rows) {
  const ths = headers.map((h) => `<th>${h}</th>`).join("");
  const trs = rows
    .map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="pc-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function renderFarmKvKSection(rows) {
  const container = document.getElementById("pc-farm-kvk-table");
  const grouped = {};
  rows.forEach((r) => {
    if (!grouped[r.kvk]) grouped[r.kvk] = [];
    grouped[r.kvk].push(r);
  });
  const headers = [
    "Name",
    "ID",
    "Killpoints",
    "T4 / T5",
    "Deads / Power",
    "DKP",
    "DKP %",
    "Acclaim",
  ];
  const ths = headers.map((h) => `<th>${h}</th>`).join("");
  const kvkKeys = Object.keys(grouped);
  let html = "";
  kvkKeys.forEach((kvkName, idx) => {
    const isOpen = idx === kvkKeys.length - 1;
    const trs = grouped[kvkName]
      .map(
        (r) => `<tr>
      <td class="col-label">${escapeHtml(r.name)}</td>
      <td class="col-mono">${escapeHtml(String(r.id))}</td>
      <td>${fmtDiff(r.kpDiff)}</td>
      <td><div class="troop-diff-stack"><div class="${Number(r.t4Diff) >= 0 ? "diff-positive" : "diff-negative"}"><span class="troop-diff-label">T4</span>${fmtSgn(r.t4Diff)}</div><div class="${Number(r.t5Diff) >= 0 ? "diff-positive" : "diff-negative"}"><span class="troop-diff-label">T5</span>${fmtSgn(r.t5Diff)}</div></div></td>
      <td><div class="troop-diff-stack"><div class="${Number(r.deadsDiff) >= 0 ? "diff-positive" : "diff-negative"}"><span class="troop-diff-label">Dead</span>${fmtSgn(r.deadsDiff)}</div><div class="${Number(r.powerDiff) >= 0 ? "diff-positive" : "diff-negative"}"><span class="troop-diff-label">Pwr</span>${fmtSgn(r.powerDiff)}</div></div></td>
      <td>${fmt(r.dkp)}</td>
      <td>${isNaN(Number(r.dkpPercent)) ? "" : fmtPct(r.dkpPercent)}</td>
      <td>${fmt(r.acclaim)}</td>
    </tr>`,
      )
      .join("");
    html += `<div class="pc-farm-kvk-group${isOpen ? " is-open" : ""}">
      <div class="pc-farm-kvk-label">
        ${escapeHtml(kvkName)}
        <svg class="pc-farm-kvk-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
        </svg>
      </div>
      <div class="pc-farm-kvk-body"><div class="pc-table-wrap"><table class="pc-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div></div>
    </div>`;
  });
  container.innerHTML = html;

  container.querySelectorAll(".pc-farm-kvk-label").forEach((label) => {
    label.addEventListener("click", () => {
      label.closest(".pc-farm-kvk-group").classList.toggle("is-open");
    });
  });
}

function initCollapsibleSections() {
  document.querySelectorAll(".pc-section.is-collapsible").forEach((section) => {
    section.classList.remove("is-open");
  });

  document.querySelectorAll(".pc-section-title.is-toggle").forEach((title) => {
    const fresh = title.cloneNode(true);
    title.parentNode.replaceChild(fresh, title);
    fresh.addEventListener("click", () => {
      fresh.closest(".pc-section").classList.toggle("is-open");
    });
  });
}

function showState(state) {
  document.getElementById("search-state").style.display =
    state === "search" ? "" : "none";
  document.getElementById("loading-state").style.display =
    state === "loading" ? "" : "none";
  document.getElementById("card-state").style.display =
    state === "card" ? "" : "none";
  if (state !== "search") {
    document.getElementById("search-error").style.display = "none";
  }
}

function showError(msg) {
  const el = document.getElementById("search-error");
  el.textContent = msg;
  el.style.display = "block";
}

const THEME_KEY = "theme";
const themeToggle = document.getElementById("toggle-theme");

function getCurrentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
  document.body.setAttribute("data-ag-theme-mode", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const theme = getCurrentTheme();
  applyTheme(theme);
  themeToggle.checked = theme === "dark";
}
themeToggle.addEventListener("change", () =>
  applyTheme(themeToggle.checked ? "dark" : "light"),
);

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

document.getElementById("back-btn").addEventListener("click", () => {
  showState("search");
  document.getElementById("player-id-input").focus();
});

initTheme();

const dbLoadEl = document.getElementById("db-loading");
const searchBtn = document.getElementById("search-btn");
const inputEl = document.getElementById("player-id-input");

showState("search");
dbLoadEl.style.display = "flex";
searchBtn.disabled = true;

loadDatabase()
  .then(async (SQL) => {
    await loadScansDatabase(SQL);

    dbReady = true;
    dbLoadEl.style.display = "none";
    searchBtn.disabled = false;
    inputEl.focus();

    const params = new URLSearchParams(window.location.search);
    const directId = normalizeNumericId(
      params.get("govId") || params.get("id"),
    );
    if (directId) {
      inputEl.value = directId;
      renderPlayerCard(directId);
    }
  })
  .catch((err) => {
    dbLoadEl.style.display = "none";
    showError("Failed to load database: " + String(err));
  });

function doSearch() {
  if (!dbReady) return;
  const val = inputEl.value.trim();
  if (!val) {
    showError("Please enter a governor ID or name.");
    return;
  }
  hideSuggestions();
  if (normalizeNumericId(val)) {
    document.getElementById("search-error").style.display = "none";
    renderPlayerCard(val);
  } else {
    const matches = searchByName(val);
    if (!matches.length) {
      showError(`No player found matching "${val}".`);
      return;
    }
    if (matches.length === 1) {
      document.getElementById("search-error").style.display = "none";
      inputEl.value = matches[0].id;
      renderPlayerCard(matches[0].id);
    } else {
      showSuggestions(matches);
    }
  }
}

const suggestionsEl = document.getElementById("name-suggestions");
let activeSuggestionIdx = -1;

function showSuggestions(matches) {
  activeSuggestionIdx = -1;
  suggestionsEl.innerHTML = matches
    .map(
      (m, i) =>
        `<div class="name-suggestion-item" data-id="${escapeHtml(m.id)}" data-idx="${i}">
      <span class="name-suggestion-name">${escapeHtml(m.name)}</span>
      <span class="name-suggestion-id">${escapeHtml(m.id)}</span>
    </div>`,
    )
    .join("");
  suggestionsEl.style.display = "block";
  suggestionsEl.querySelectorAll(".name-suggestion-item").forEach((item) => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectSuggestion(item.dataset.id);
    });
  });
}

function hideSuggestions() {
  suggestionsEl.style.display = "none";
  suggestionsEl.innerHTML = "";
  activeSuggestionIdx = -1;
}

function selectSuggestion(id) {
  hideSuggestions();
  inputEl.value = id;
  document.getElementById("search-error").style.display = "none";
  renderPlayerCard(id);
}

inputEl.addEventListener("input", () => {
  if (!dbReady) return;
  const val = inputEl.value.trim();
  if (!val || normalizeNumericId(val)) {
    hideSuggestions();
    return;
  }
  if (val.length < 2) {
    hideSuggestions();
    return;
  }
  const matches = searchByName(val);
  if (matches.length) showSuggestions(matches);
  else hideSuggestions();
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    doSearch();
    return;
  }
  if (suggestionsEl.style.display === "none") return;
  const items = suggestionsEl.querySelectorAll(".name-suggestion-item");
  if (!items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeSuggestionIdx = Math.min(activeSuggestionIdx + 1, items.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeSuggestionIdx = Math.max(activeSuggestionIdx - 1, -1);
  } else if (e.key === "Escape") {
    hideSuggestions();
    return;
  } else {
    return;
  }
  items.forEach((item, i) =>
    item.classList.toggle("is-active", i === activeSuggestionIdx),
  );
  if (activeSuggestionIdx >= 0)
    items[activeSuggestionIdx].scrollIntoView({ block: "nearest" });
  if (e.key === "Enter" && activeSuggestionIdx >= 0) {
    selectSuggestion(items[activeSuggestionIdx].dataset.id);
  }
});

inputEl.addEventListener("blur", () => {
  setTimeout(hideSuggestions, 150);
});
searchBtn.addEventListener("click", doSearch);
