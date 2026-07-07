// ── Helpers ────────────────────────────────────────────────────────
function normalizeNumericId(value) {
  const id = String(value ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}
function buildNumericInList(values) {
  return [...new Set(values.map(normalizeNumericId).filter(Boolean))].join(",");
}
function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"'`=/]/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
    "/":"&#x2F;","`":"&#x60;","=":"&#x3D;"
  })[s]);
}
function fmt(v)   { return Number(v||0).toLocaleString("en-US"); }
function fmtPct(v){ const n=Number(v); return Number.isFinite(n)?`${(n*100).toFixed(2)}%`:""; }
function fmtSgn(v){ const n=Number(v)||0; return `${n>=0?"+":""}${n.toLocaleString("en-US")}`; }
function fmtDiff(v){
  const n=Number(v)||0;
  const cls=n>=0?"diff-positive":"diff-negative";
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
    <div class="modal-pair-line"><span class="troop-diff-label">${l1}</span>${show?metricStack(b1,s1,v=>{const n=Number(v)||0;return`${n>=0?"+":""}${n.toLocaleString("en-US")}`;}):fmtDiff(b1)}</div>
    <div class="modal-pair-line"><span class="troop-diff-label">${l2}</span>${show?metricStack(b2,s2,v=>{const n=Number(v)||0;return`${n>=0?"+":""}${n.toLocaleString("en-US")}`;}):fmtDiff(b2)}</div>
  </div>`;
}

// ── Name search ────────────────────────────────────────────────────
function searchByName(query) {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];
  const results = [];
  const seen = new Set();

  // Search kvk.db governors table
  if (db) {
    try {
      const res = db.exec(`
        SELECT DISTINCT governor_id, name FROM governors
        WHERE lower(name) LIKE '%${q.replace(/'/g,"''")}%'
        ORDER BY name
        LIMIT 20
      `);
      if (res.length && res[0].values.length) {
        res[0].values.forEach(([id, name]) => {
          const key = String(id);
          if (!seen.has(key)) { seen.add(key); results.push({ id: key, name: name || key, src: "kvk" }); }
        });
      }
    } catch(e) { console.warn("Name search (kvk.db):", e); }
  }

  // Search scans db governors table
  if (scansDb) {
    try {
      const res = scansDb.exec(`
        SELECT DISTINCT governor_id, name FROM governors
        WHERE lower(name) LIKE '%${q.replace(/'/g,"''")}%'
        ORDER BY name
        LIMIT 20
      `);
      if (res.length && res[0].values.length) {
        res[0].values.forEach(([id, name]) => {
          const key = String(id);
          if (!seen.has(key)) { seen.add(key); results.push({ id: key, name: name || key, src: "scan" }); }
        });
      }
    } catch(e) { console.warn("Name search (scans.db):", e); }
  }

  // Sort: prefix matches first
  results.sort((a, b) => {
    const al = a.name.toLowerCase(), bl = b.name.toLowerCase();
    const aStarts = al.startsWith(q), bStarts = bl.startsWith(q);
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

async function loadEquipRefData() {
  try {
    const [itemsRes, commandersRes, inscriptionsRes] = await Promise.all([
      fetch("data/items.json"),
      fetch("data/commanders.json"),
      fetch("data/inscriptions.json"),
    ]);
    itemsData = await itemsRes.json();
    commandersData = await commandersRes.json();
    inscriptionsData = await inscriptionsRes.json();

    inscriptionsByName = {};
    for (const [key, info] of Object.entries(inscriptionsData.inscriptions || {})) {
      const nameKey = String(info.name || key).trim().toLowerCase();
      inscriptionsByName[nameKey] = { key, ...info };
    }
  } catch (e) {
    console.error("loadEquipRefData:", e);
  }
}
loadEquipRefData();

function getItemInfo(itemCode) {
  const key = String(itemCode ?? "").trim();
  return (itemsData.items && itemsData.items[key]) || null;
}

function getCommanderInfo(commCode) {
  const key = String(commCode ?? "").trim();
  return (commandersData.commanders && commandersData.commanders[key]) || null;
}

function getInscriptionInfo(name) {
  const key = String(name ?? "").trim().toLowerCase();
  return inscriptionsByName[key] || null;
}

function buildTooltipHtml(code, kind) {
  if (isEmptyVal(code)) return "";
  const key = String(code).trim();

  if (kind === "commander") {
    const info = getCommanderInfo(key);
    const name = info ? info.name : key;
    return `<div class="tt-name">${escapeHtml(name)}</div>`;
  }

  if (kind === "inscription") {
    const info = getInscriptionInfo(key);
    if (!info) return `<div class="tt-name">${escapeHtml(key)}</div>`;
    const rarityClass = String(info.rarity || "gold").toLowerCase();
    const parts = [`<div class="tt-name tt-rarity-${rarityClass}">${escapeHtml(info.name || key)}</div>`];
    if (info.rarity) {
      parts.push(`<div class="tt-slot">${escapeHtml(info.rarity)}</div>`);
    }
    if (info.description) {
      parts.push(`<div class="tt-desc">${escapeHtml(String(info.description))}</div>`);
    }
    return parts.join("");
  }

  const info = getItemInfo(key);
  if (!info) return `<div class="tt-name">${escapeHtml(key)}</div>`;

  const rarityClass = String(info.rarity || "gold").toLowerCase();
  const parts = [`<div class="tt-name tt-rarity-${rarityClass}">${escapeHtml(info.name || key)}</div>`];

  if (info.slot) {
    parts.push(`<div class="tt-slot">${escapeHtml(info.slot)}</div>`);
  }

  const stats = Array.isArray(info.stats) ? info.stats : (info.stats ? [info.stats] : []);
  if (stats.length) {
    parts.push(`<ul class="tt-stats">${stats.map(s => `<li>${escapeHtml(String(s))}</li>`).join("")}</ul>`);
  }

  const descArr = Array.isArray(info.description) ? info.description : (info.description ? [info.description] : []);
  if (descArr.length) {
    parts.push(`<div class="tt-desc">${descArr.map(d => escapeHtml(String(d))).join("<br>")}</div>`);
  }

  return parts.join("");
}

function initEquipTooltip() {
  const tip = document.createElement("div");
  tip.className = "equip-tooltip";
  tip.style.display = "none";
  document.body.appendChild(tip);

  let activeEl = null;

  function positionTip(x, y) {
    const margin = 14;
    const rect = tip.getBoundingClientRect();
    let left = x + margin;
    let top = y + margin;

    if (left + rect.width > window.innerWidth - 8) {
      left = x - rect.width - margin;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = y - rect.height - margin;
    }
    left = Math.max(8, left);
    top = Math.max(8, top);

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip-code]");
    if (!el) return;
    activeEl = el;

    const html = buildTooltipHtml(el.dataset.tipCode, el.dataset.tipKind);
    if (!html) return;

    tip.innerHTML = html;
    tip.style.display = "block";
    positionTip(e.clientX, e.clientY);
  });

  document.addEventListener("mousemove", (e) => {
    if (!activeEl || tip.style.display === "none") return;
    positionTip(e.clientX, e.clientY);
  });

  document.addEventListener("mouseout", (e) => {
    const el = e.target.closest("[data-tip-code]");
    if (!el || el !== activeEl) return;
    if (el.contains(e.relatedTarget)) return;
    activeEl = null;
    tip.style.display = "none";
  });

  document.addEventListener("scroll", () => {
    tip.style.display = "none";
    activeEl = null;
  }, true);
}

async function loadDatabase() {
  const SQL = await initSqlJs({
    locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${f}`
  });
  const res = await fetch("kvk.db");
  const buf = await res.arrayBuffer();
  db = new SQL.Database(new Uint8Array(buf));
  ensureSchema();
  return SQL;
}

async function loadScansDatabase(SQL) {
  try {
    const res = await fetch("scans_2247.db");
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    scansDb = new SQL.Database(new Uint8Array(buf));
  } catch(e) {
    console.warn("scans_2247.db not available:", e);
  }
}

function loadScanStats(govId) {
  if (!scansDb) return null;
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  try {
    // Get newest snapshot
    const snapRes = scansDb.exec(`SELECT snapshot_id, snapshot_date FROM snapshots ORDER BY snapshot_date DESC LIMIT 1`);
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
      power: r[0], killPoints: r[1], deaths: r[2],
      t1: r[3], t2: r[4], t3: r[5], t4: r[6], t5: r[7],
      rangedPoints: r[8], rssGathered: r[9], rssAssistance: r[10],
      helps: r[11], alliance: r[12], acclaim: r[13], name: r[14]
    };
  } catch(e) { console.warn("loadScanStats error:", e); return null; }
}

function ensureSchema() {
  const cols = db.exec("PRAGMA table_info(stats)");
  const existing = new Set(cols.length ? cols[0].values.map(r=>r[1]) : []);
  [["sum_min_dkp","INTEGER"],["sum_dkp","INTEGER"],["sum_dkp_percent","REAL"]].forEach(([name,type])=>{
    if (!existing.has(name)) db.run(`ALTER TABLE stats ADD COLUMN ${name} ${type}`);
  });
}

// ── Kingdom auto-detection ─────────────────────────────────────────
// Find which kingdom has the most recent data for this governor ID.
// Searches across all snapshots (not just is_last) so players who
// dropped out of the final snapshot are still found.
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
  // Fallback: governors table alone
  const g = db.exec(`SELECT kingdom FROM governors WHERE governor_id='${safeId}' LIMIT 1`);
  return (g.length && g[0].values.length) ? g[0].values[0][0] : null;
}

// ── Data loaders ───────────────────────────────────────────────────

// Returns the most recent snapshot this specific governor appears in
// (falls back from is_last of latest KvK to any snapshot they exist in).
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
  return (res.length && res[0].values.length) ? res[0].values[0][0] : null;
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
    name:r[0], power:r[1], kp:r[2], t4:r[3], t5:r[4], deads:r[5],
    powerDiff:r[6], kpDiff:r[7], t4Diff:r[8], t5Diff:r[9], deadsDiff:r[10],
    minDkp:r[11], dkp:r[12], dkpPercent:r[13],
    sumMinDkp:r[14], sumDkp:r[15], sumDkpPercent:r[16],
    vacation:r[17], status:r[18], acclaim:r[19]
  };
}

function resolveFarmMainId(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return safeId;
  const res = db.exec(`SELECT main_id, acc_type FROM farm_accounts WHERE player_id=${safeId} LIMIT 1`);
  if (!res.length || !res[0].values.length) return safeId;
  const [mainId, accType] = res[0].values[0];
  const safeMid = normalizeNumericId(mainId);
  return String(accType||"").toLowerCase() === "farm" && safeMid ? safeMid : safeId;
}

function getAccType(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  const res = db.exec(`SELECT acc_type FROM farm_accounts WHERE player_id=${safeId} LIMIT 1`);
  if (!res.length || !res[0].values.length) return null;
  return String(res[0].values[0][0] || "").toLowerCase();
}

function loadCH(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  const res = db.exec(`SELECT ch FROM farm_accounts WHERE player_id=${safeId} LIMIT 1`);
  if (!res.length || !res[0].values.length) return null;
  const ch = res[0].values[0][0];
  return (ch !== null && ch !== undefined && String(ch).trim() !== "" && String(ch).trim() !== "0") ? String(ch).trim() : null;
}

function loadGovernorFarms(mainId) {
  const safeId = normalizeNumericId(mainId);
  if (!safeId) return [];
  const res = db.exec(`SELECT name,player_id,power,killpoints,deads,ch FROM farm_accounts WHERE main_id=${safeId} AND acc_type='farm' ORDER BY power DESC`);
  if (!res.length) return [];
  return res[0].values.map(r=>({name:r[0]??"",id:r[1]??"",power:Number(r[2]??0),killpoints:Number(r[3]??0),deads:Number(r[4]??0),ch:r[5]??""}));
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
  const r=res[0].values[0];
  return {id:r[0]??"",name:r[1]??"",power:Number(r[2]??0),killpoints:Number(r[3]??0),deads:Number(r[4]??0),ch:r[5]??""};
}

function loadGovHistory(govId, kd) {
  const safeId = normalizeNumericId(govId);
  if (!safeId || !kd) return [];
  const isMain = resolveFarmMainId(safeId) === safeId;
  const farmIds = isMain ? loadGovernorFarms(safeId).map(f=>f.id) : [];
  const farmIdList = buildNumericInList(farmIds);

  const kvksRes = db.exec(`SELECT id,kvk_number FROM kvks WHERE kingdom='${kd}' ORDER BY kvk_number`);
  if (!kvksRes.length) return [];
  const results = [];
  for (const [kvkId, kvkNumber] of kvksRes[0].values) {
    const snap = db.exec(`SELECT id FROM snapshots WHERE kvk_id=${kvkId} AND is_last=1 LIMIT 1`);
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
      kvk:`KvK ${kvkNumber}`,
      hasFarmRollup: isMain && Boolean(farmIdList),
      powerDiff:r[0], kpDiff:r[1], t4Diff:r[2], t5Diff:r[3], deadsDiff:r[4],
      minDkp:r[5], dkp:r[6], dkpPercent:r[7], acclaim:r[11],
      sumPowerDiff: Number(r[0]||0)+Number(farmSums?.[0]||0),
      sumKpDiff:    Number(r[1]||0)+Number(farmSums?.[1]||0),
      sumT4Diff:    Number(r[2]||0)+Number(farmSums?.[2]||0),
      sumT5Diff:    Number(r[3]||0)+Number(farmSums?.[3]||0),
      sumDeadsDiff: Number(r[4]||0)+Number(farmSums?.[4]||0),
      sumMinDkp:    Number(r[5]||0)+Number(farmSums?.[5]||0),
      sumDkp:       Number(r[6]||0)+Number(farmSums?.[6]||0),
      sumDkpPercent:Number(r[7]||0)+Number(farmSums?.[7]||0),
      sumAcclaim:   Number(r[11]||0)+Number(farmSums?.[8]||0),
    });
  }
  return results;
}

function loadFarmKvKStats(farmIds, kd) {
  const idList = buildNumericInList(farmIds);
  if (!idList || !kd) return [];
  const kvksRes = db.exec(`SELECT id,kvk_number FROM kvks WHERE kingdom='${kd}' ORDER BY kvk_number`);
  if (!kvksRes.length) return [];
  const results = [];
  for (const [kvkId, kvkNumber] of kvksRes[0].values) {
    const snap = db.exec(`SELECT id FROM snapshots WHERE kvk_id=${kvkId} AND is_last=1 LIMIT 1`);
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
    st[0].values.forEach(r=>{
      results.push({kvk:`KvK ${kvkNumber}`,name:r[0],id:r[1],powerDiff:r[2],kpDiff:r[3],t4Diff:r[4],t5Diff:r[5],deadsDiff:r[6],dkp:r[7],dkpPercent:r[8],acclaim:r[9]});
    });
  }
  return results;
}

function loadEquipment(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  try {
    const t = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='equipment'`);
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(`SELECT * FROM equipment WHERE player_id=${safeId} LIMIT 1`);
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c,i)=>{ row[c] = res[0].values[0][i]; });
    return row;
  } catch(e) { return null; }
}

function loadArmaments(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  try {
    const t = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='armaments'`);
    if (!t.length || !t[0].values.length) return null;
    const res = db.exec(`SELECT * FROM armaments WHERE player_id=${safeId} LIMIT 1`);
    if (!res.length || !res[0].values.length) return null;
    const row = {};
    res[0].columns.forEach((c,i)=>{ row[c] = res[0].values[0][i]; });
    return row;
  } catch(e) { return null; }
}

// ── Equipment rendering ────────────────────────────────────────────
const EQUIP_SLOTS = [
  {key:"helm",label:"Helm",id:"helmet"},{key:"chest",label:"Chest",id:"chest"},
  {key:"weapon",label:"Weapon",id:"weapon"},{key:"gloves",label:"Gloves",id:"gloves"},
  {key:"legs",label:"Legs",id:"legs"},{key:"boots",label:"Boots",id:"boots"},
  {key:"accessory",label:"Acc.",id:"accessory"},{key:"accessory_sec",label:"Acc.2",id:"accessory_sec"},
];
const ARM_SLOTS = Array.from({length:8},(_,i)=>({prefix:`arm${i+1}`,label:`Arm ${i+1}`}));

function iconPath(name, kind) {
  const folder = kind === "commander" ? "commanders" : "equipment";
  return `icons/${folder}/${encodeURIComponent(String(name).trim())}.webp`;
}

function isEmptyVal(v) {
  if (v===null||v===undefined||v==="") return true;
  const s=String(v).trim().toLowerCase();
  return s==="none"||s==="0";
}
function isMarchEmpty(row, suffix) {
  return EQUIP_SLOTS.every(slot=>{
    const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
    return isEmptyVal(row[colKey]);
  });
}
function getEquipRarity(name) {
  if (isEmptyVal(name)) return "empty";
  const n=String(name).trim().toLowerCase();
  if (n.endsWith("gray")) return "gray";
  if (n.endsWith("gr")) return "green";
  if (n.endsWith("g")) return "gold";
  if (n.endsWith("p")) return "purple";
  if (n.endsWith("b")) return "blue";
  return "unknown";
}
function slotIcon(slotId) {
  const icons = {
    helmet:`<path d="M8 2.6 11 4v2.9c0 1.9-1.2 3.5-3 4.4-1.8-.9-3-2.5-3-4.4V4l3-1.4Zm-2 3.1v1l2 1.2 2-1.2v-1L8 6.9 6 5.7Zm.3 3 .7 1h2l.7-1H6.3Z"/><path opacity=".5" d="M8 2.6v4.3L6 5.7v-1L8 3.8l2 .9v1L8 6.9v4.4c-1.8-.9-3-2.5-3-4.4V4l3-1.4Z"/>`,
    chest:`<path d="M5.5 2.9 7 4.1h2l1.5-1.2 2.3 1.3-1.3 2.6-1-.4v4.3h-5V6.4l-1 .4-1.3-2.6 2.3-1.3Zm1.1 3-.5 1.4L8 8.1l1.9-.8-.5-1.4H6.6Zm-.1 2.8v1.1h3V8.7L8 9.3l-1.5-.6Z"/><path opacity=".45" d="M5.5 2.9 7 4.1 5.5 5.3v-2.4Zm5 0v2.4L9 4.1l1.5-1.2Zm-3.9 3H9.4l.4 1.1H6.2l.4-1.1Z"/>`,
    weapon:`<path d="M11.9 2.8 13.2 4l-5.6 5.6 1.1 1.1-1 1-1.1-1.1-1.5 1.5-1.2-1.2 1.5-1.5-1.1-1.1 1-1 1.1 1.1 5.5-5.6Zm-.5 2.3-3.8 3.8.5.5 3.8-3.8-.5-.5Z"/><path opacity=".45" d="M4.3 8.3 5.4 7.2l3.3 3.3-1 1-3.4-3.2Zm6.7-4.6 1.2-.9 1 .9-.9 1.2L11 3.7Z"/>`,
    gloves:`<path d="M6.1 3h1.4v4h.8V2.8h1.4V7h.7V3.6h1.3v4.1l.8.9-.6 2.4-1.6 1.1H7l-2.1-1.6-1.1-2 .9-1.1 1.4 1V3Zm.3 6-.6.5.6.9 1.1.7h2.4l.8-.6.3-1.2-.5-.6-1.9.4L6.4 9Z"/><path opacity=".45" d="M6.1 3h1.4v4H6.1V3Zm2.2-.2h1.4V7H8.3V2.8Zm1.4 6.1 1.5-.3-.2.8-1.3.5v-1Z"/>`,
    legs:`<path d="M5.2 3.2h5.6l.6 1.4-.9 3.3-.4 3.3-1.7.8L8 8.8 7.6 12l-1.7-.8-.4-3.3-.9-3.3.6-1.4Zm1.2 1.6.3 2h2.6l.3-2H6.4Zm.3 3 .3 2.3.4.2-.1-2.5h-.6Zm2 0-.1 2.5.4-.2.3-2.3h-.6Z"/><path opacity=".45" d="M6.4 4.8h3.2l-.3 1H6.7l-.3-1Zm-1 3.1 1.3-.1.3 2.3-1.1-.5-.5-1.7Zm5.2 0-.5 1.7-1.1.5.3-2.3 1.3.1Z"/>`,
    boots:`<path d="M4.7 3.3h2.7l.4 4.1-.5 1.7 1.5.8 2.8.4 1.4 1.2v1.1H3.6v-1.8l1.2-1 .2-2.9-.3-3.6Zm1.1 1.2.2 2.3-.2 3.6-.8.6v.4h6.2l-.4-.3-2.7-.4-2.2-1.3.5-1.9-.4-3H5.8Z"/><path opacity=".45" d="M9.1 3.8h2.2l.4 3.7-.5 1.4 1 .4-2.3-.3.3-1.4-.4-2.6h-.7V3.8ZM5.9 9.4l2.2 1.3 2.7.4.4.3H5l.9-2Z"/>`,
    accessory:`<path d="M8 2.5 10.2 5 8 7.5 5.8 5 8 2.5Zm0 5.8c1.8 0 3.3 1.5 3.3 3.3S9.8 14.9 8 14.9s-3.3-1.5-3.3-3.3S6.2 8.3 8 8.3Zm0 1.4c-1 0-1.9.8-1.9 1.9S7 13.5 8 13.5s1.9-.8 1.9-1.9S9 9.7 8 9.7Z"/>`,
    accessory_sec:`<path d="M5.9 2.4 7.4 4 5.9 5.7 4.4 4l1.5-1.6Zm4.2 0L11.6 4l-1.5 1.7L8.6 4l1.5-1.6ZM6.1 7.5c1.5 0 2.7 1.2 2.7 2.7s-1.2 2.7-2.7 2.7-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7Zm3.8 0c1.5 0 2.7 1.2 2.7 2.7s-1.2 2.7-2.7 2.7c-.4 0-.8-.1-1.1-.2.7-.6 1.1-1.5 1.1-2.5s-.4-1.9-1.1-2.5c.3-.1.7-.2 1.1-.2Zm-3.8 1.3c-.8 0-1.4.6-1.4 1.4s.6 1.4 1.4 1.4 1.4-.6 1.4-1.4-.6-1.4-1.4-1.4Z"/>`,
  };
  return `<svg class="equip-placeholder-icon" viewBox="0 0 16 16" aria-hidden="true">${icons[slotId]||icons.accessory}</svg>`;
}
function renderEquipBox(slot, itemName, lvl, tal, marchIdx) {
  const empty = isEmptyVal(itemName);
  const imgSrc = empty ? null : iconPath(itemName, "item");
  const rarity = getEquipRarity(itemName);
  const lvlTxt = (!empty && !isEmptyVal(lvl)) ? lvl : "—";
  const talTxt = (!empty && !isEmptyVal(tal)) ? tal : "—";
  const imgTag = imgSrc ? `<img src="${imgSrc}" alt="${escapeHtml(String(itemName))}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="width:100%;height:100%;object-fit:contain;border-radius:2px;">` : "";
  const fallback = `<div class="equip-placeholder" style="display:${imgSrc?"none":"flex"};">${slotIcon(slot.id)}</div>`;
  const tipAttrs = empty ? "" : ` data-tip-code="${escapeHtml(String(itemName).trim())}" data-tip-kind="item"`;
  return `<div class="equip-slot" id="${slot.id}_${marchIdx}">
    <div class="equip-box equip-box--framed rarity-${rarity}"${tipAttrs}>${imgTag}${fallback}</div>
    <div class="equip-meta"><span class="equip-lvl">Awk:${lvlTxt}</span><span class="equip-tal">Tal:${talTxt}</span></div>
  </div>`;
}
function renderPairBox(name) {
  const empty = isEmptyVal(name);
  const imgSrc = empty ? null : iconPath(name, "commander");
  const imgTag = imgSrc ? `<img src="${imgSrc}" alt="${escapeHtml(String(name))}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="width:100%;height:100%;object-fit:contain;border-radius:2px;">` : "";
  const fallback = `<span style="display:${imgSrc?"none":"flex"};width:100%;height:100%;align-items:center;justify-content:center;font-size:9px;opacity:0.35;">—</span>`;
  const tipAttrs = empty ? "" : ` data-tip-code="${escapeHtml(String(name).trim())}" data-tip-kind="commander"`;
  return `<div class="equip-pair-box${empty?" equip-pair-box--empty":""}"${tipAttrs}>${imgTag}${fallback}</div>`;
}


function getAbilityTier(name) {
  if (!name) return "gray";
  const info = getInscriptionInfo(name);
  return info ? info.rarity : "gray";
}

function renderArmamentSection(armRow) {
  if (!armRow) return `<div class="equip-arm-section"><div class="equip-arm-label">Armaments</div><div class="pc-equip-empty">No armament data.</div></div>`;
  const arms = ARM_SLOTS.map(arm => {
    const name = armRow[arm.prefix];
    if (isEmptyVal(name)) return "";
    const insKeys = ["_ins","_ins2","_ins3","_ins4","_ins5","_ins6","_ins7","_ins8"];
    const inscriptions = insKeys.map(k=>armRow[`${arm.prefix}${k}`]).filter(v=>!isEmptyVal(v))
      .map(v=>`<span class="arm-ins tier-${getAbilityTier(String(v))}" data-tip-code="${escapeHtml(String(v).trim())}" data-tip-kind="inscription">${escapeHtml(String(v))}</span>`).join("");
    const statSlots = [
      {n:`${arm.prefix}_stat_name`,v:`${arm.prefix}_stat`},
      {n:`${arm.prefix}_stat2_name2`,v:`${arm.prefix}_stat2`},
      {n:`${arm.prefix}_stat3_name3`,v:`${arm.prefix}_stat3`},
      {n:`${arm.prefix}_stat4_name4`,v:`${arm.prefix}_stat4`},
    ];
    const statsHtml = statSlots.filter(s=>!isEmptyVal(armRow[s.n])&&!isEmptyVal(armRow[s.v]))
      .map(s=>`<span class="arm-stat">${escapeHtml(String(armRow[s.n]))}: <b>${escapeHtml(String(armRow[s.v]))}</b></span>`).join("");
    return `<div class="arm-card"><div class="arm-name">${escapeHtml(String(name))}</div>${inscriptions?`<div class="arm-ins-group">${inscriptions}</div>`:""}${statsHtml?`<div class="arm-stats">${statsHtml}</div>`:""}</div>`;
  }).filter(Boolean).join("");
  return `<div class="equip-arm-section"><div class="equip-arm-label">Armaments</div><div class="arm-cards">${arms||`<div class="pc-equip-empty">No armaments set.</div>`}</div></div>`;
}

function renderPairsSection(row) {
  let html = "";
  for (let n=1; n<=12; n++) {
    const c1=row[`pair${n}_comm1`], c2=row[`pair${n}_comm2`];
    if (isEmptyVal(c1)&&isEmptyVal(c2)) continue;
    html += `<div class="equip-pair-row"><span class="equip-label">Pair ${n}</span><div class="equip-pairs">${[c1,c2].map(c=>renderPairBox(c)).join("")}</div></div>`;
  }
  if (!html) return "";
  return `<div class="equip-pairs-section"><div class="equip-arm-label">Pairs</div>${html}</div>`;
}

function renderEquipmentGrid(govId) {
  const row = loadEquipment(govId);
  const armRow = loadArmaments(govId);
  const grid = document.getElementById("pc-equipment");
  if (!row) {
    grid.innerHTML = `<div class="pc-equip-empty">No equipment data found for this governor.</div>${renderArmamentSection(armRow)}`;
    return;
  }
  const MARCH_SUFFIXES = ["","2","3","4","5","6","7","8","9","10","11","12"];
  let marchRows = "";
  MARCH_SUFFIXES.forEach((suffix, idx) => {
    if (isMarchEmpty(row, suffix)) return;
    const marchNum = idx+1;
    const slotBoxes = EQUIP_SLOTS.map(slot => {
      const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
      const lvlKey = suffix ? `${slot.key}_lvl_${suffix}` : `${slot.key}_lvl`;
      const talKey = suffix ? `${slot.key}_tal_${suffix}` : `${slot.key}_tal`;
      return renderEquipBox(slot, row[colKey], row[lvlKey], row[talKey], marchNum);
    }).join("");
    marchRows += `<div class="equip-march-row"><span class="equip-label">March ${marchNum}</span><div class="equip-slots">${slotBoxes}</div></div>`;
  });
  if (!marchRows) marchRows = `<div class="pc-equip-empty">No equipment set.</div>`;
  grid.innerHTML = marchRows + renderArmamentSection(armRow) + renderPairsSection(row);
}

// ── Render player card ─────────────────────────────────────────────
// ── Scan stat boxes ────────────────────────────────────────────────
function renderScanStats(govId) {
  const el = document.getElementById("pc-scan-stats");
  const data = loadScanStats(govId);
  if (!data) { el.style.display = "none"; return; }

  function statItem(label, value) {
    return `<div class="scan-item">
      <span class="scan-item-label">${label}</span>
      <span class="scan-item-value">${value}</span>
    </div>`;
  }

  function tierItem(tier, value) {
    return `<div class="scan-tier-item">
      <span class="scan-tier-label">${tier}</span>
      <span class="scan-tier-val">${fmt(value)}</span>
    </div>`;
  }

  const row1 = `<div class="scan-row">
    ${statItem("Power",         fmt(data.power))}
    ${statItem("Kill Points",   fmt(data.killPoints))}
    ${statItem("Deaths",        fmt(data.deaths))}
    ${statItem("Ranged Points", fmt(data.rangedPoints))}
  </div>`;

  const row2 = `<div class="scan-row">
    ${tierItem("T1", data.t1)}
    ${tierItem("T2", data.t2)}
    ${tierItem("T3", data.t3)}
    ${tierItem("T4", data.t4)}
    ${tierItem("T5", data.t5)}
  </div>`;

  const row3 = `<div class="scan-row">
    ${statItem("RSS Gathered",   fmt(data.rssGathered))}
    ${statItem("RSS Assistance", fmt(data.rssAssistance))}
    ${statItem("Helps",          fmt(data.helps))}
    ${statItem("Acclaim",        fmt(data.acclaim))}
  </div>`;

  el.innerHTML = `${row1}${row2}${row3}
    <div class="scan-snap-label">Snapshot · ${escapeHtml(String(data.snapDate))}</div>`;
  el.style.display = "";
}

function renderPlayerCard(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) { showError("Invalid governor ID."); return; }

  showState("loading");

  setTimeout(() => {
    try {
      const kd = detectKingdom(safeId);

      // If not found in kvk.db at all, check scans_2247.db as fallback
      if (!kd) {
        const scanData = loadScanStats(safeId);
        if (!scanData) { showState("search"); showError(`No data found for ID ${safeId}.`); return; }

        // Show scan-only card — name from scans governors table
        document.getElementById("pc-name").textContent = scanData.name || safeId;
        document.getElementById("pc-id").textContent = safeId;
        document.getElementById("pc-type-badge").className = "pc-type-badge";
        if (!document.getElementById("pc-ch")) {
          const chSpan = document.createElement("span");
          chSpan.id = "pc-ch";
          chSpan.className = "pc-ch-value";
          document.getElementById("pc-type-badge").insertAdjacentElement("afterend", chSpan);
        }
        const chScan = loadCH(safeId);
        const chElScan = document.getElementById("pc-ch");
        chElScan.textContent = chScan ? `CH ${chScan}` : "";
        chElScan.style.display = chScan ? "" : "none";

        renderScanStats(safeId);

        // Hide all kvk-only sections
        document.getElementById("section-history").style.display = "none";
        document.getElementById("pc-farm-owner-section").style.display = "none";
        document.getElementById("pc-farms-section").style.display = "none";
        document.getElementById("pc-farm-kvk-section").style.display = "none";

        // Still try equipment
        renderEquipmentGrid(safeId);
        initCollapsibleSections();
        showState("card");
        return;
      }

      // Restore history section visibility in case it was hidden by a previous scan-only search
      document.getElementById("section-history").style.display = "";

      const info = loadGovernorInfo(safeId, kd);
      if (!info) { showState("search"); showError(`No data found for ID ${safeId}.`); return; }

      const accType = getAccType(safeId);
      const isMain = resolveFarmMainId(safeId) === safeId;
      const isFarm = accType === "farm";
      const farms = isMain ? loadGovernorFarms(safeId) : [];
      const farmIds = farms.map(f=>f.id);
      const farmKvK = farmIds.length ? loadFarmKvKStats(farmIds, kd) : [];
      const farmOwner = isFarm ? loadFarmOwner(safeId) : null;
      const history = loadGovHistory(safeId, kd);
      const hasFarmRollup = isMain && farmIds.length > 0;

      // Identity
      document.getElementById("pc-name").textContent = info.name || safeId;
      document.getElementById("pc-id").textContent = safeId;
      // Inject CH span once if not already in DOM
      if (!document.getElementById("pc-ch")) {
        const chSpan = document.createElement("span");
        chSpan.id = "pc-ch";
        chSpan.className = "pc-ch-value";
        document.getElementById("pc-type-badge").insertAdjacentElement("afterend", chSpan);
      }
      const ch = loadCH(safeId);
      const chEl = document.getElementById("pc-ch");
      chEl.textContent = ch ? `CH ${ch}` : "";
      chEl.style.display = ch ? "" : "none";


      // Scan stat boxes (from scans_2247.db)
      renderScanStats(safeId);

      // History table
      renderHistoryTable(history);

      // Farm owner
      if (farmOwner) {
        document.getElementById("pc-farm-owner-section").style.display = "";
        document.getElementById("pc-farm-owner-table").innerHTML = renderSimpleTable(
          ["Name","ID","Power","Kill Points","Deads","CH"],
          [[escapeHtml(farmOwner.name), `<span class="col-mono">${escapeHtml(String(farmOwner.id))}</span>`, fmt(farmOwner.power), fmt(farmOwner.killpoints), fmt(farmOwner.deads), escapeHtml(String(farmOwner.ch))]]
        );
      } else {
        document.getElementById("pc-farm-owner-section").style.display = "none";
      }

      // Farm accounts table
      if (farms.length) {
        document.getElementById("pc-farms-section").style.display = "";
        document.getElementById("pc-farms-table").innerHTML = renderSimpleTable(
          ["Name","ID","Power","Kill Points","Deads","CH"],
          farms.map(f=>[escapeHtml(f.name), `<span class="col-mono">${escapeHtml(String(f.id))}</span>`, fmt(f.power), fmt(f.killpoints), fmt(f.deads), escapeHtml(String(f.ch))])
        );
      } else {
        document.getElementById("pc-farms-section").style.display = "none";
      }

      // Farm KvK stats
      if (farmKvK.length) {
        document.getElementById("pc-farm-kvk-section").style.display = "";
        renderFarmKvKSection(farmKvK);
      } else {
        document.getElementById("pc-farm-kvk-section").style.display = "none";
      }

      // Equipment
      renderEquipmentGrid(safeId);

      // Init collapsible section toggles
      initCollapsibleSections();

      showState("card");
    } catch(err) {
      console.error(err);
      showState("search");
      showError("Error loading player data: " + String(err));
    }
  }, 50);
}

function renderHistoryTable(rows) {
  const container = document.getElementById("pc-history-table");
  if (!rows.length) { container.innerHTML = `<div class="pc-empty">No historical KvK data found.</div>`; return; }
  const headers = ["KvK","Killpoints","T4 / T5","Deads / Power","Min DKP","DKP","DKP %","Acclaim"];
  const ths = headers.map(h=>`<th>${h}</th>`).join("");
  const trs = rows.map(r=>`<tr>
    <td class="col-label">${escapeHtml(r.kvk)}</td>
    <td>${r.hasFarmRollup ? metricStack(r.kpDiff, r.sumKpDiff, v=>{const n=Number(v)||0;return`${n>=0?"+":""}${n.toLocaleString("en-US")}`;}) : fmtDiff(r.kpDiff)}</td>
    <td>${pairStack("T4",r.t4Diff,r.sumT4Diff,"T5",r.t5Diff,r.sumT5Diff,r.hasFarmRollup)}</td>
    <td>${pairStack("Dead",r.deadsDiff,r.sumDeadsDiff,"Pwr",r.powerDiff,r.sumPowerDiff,r.hasFarmRollup)}</td>
    <td>${maybeStack(r.minDkp,r.sumMinDkp,fmt,r.hasFarmRollup)}</td>
    <td>${maybeStack(r.dkp,r.sumDkp,fmt,r.hasFarmRollup)}</td>
    <td>${maybeStack(r.dkpPercent,r.sumDkpPercent,fmtPct,r.hasFarmRollup)}</td>
    <td>${maybeStack(r.acclaim,r.sumAcclaim,fmt,r.hasFarmRollup)}</td>
  </tr>`).join("");
  container.innerHTML = `<table class="pc-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function renderSimpleTable(headers, rows) {
  const ths = headers.map(h=>`<th>${h}</th>`).join("");
  const trs = rows.map(r=>`<tr>${r.map(cell=>`<td>${cell}</td>`).join("")}</tr>`).join("");
  return `<table class="pc-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function renderFarmKvKSection(rows) {
  const container = document.getElementById("pc-farm-kvk-table");
  const grouped = {};
  rows.forEach(r=>{ if (!grouped[r.kvk]) grouped[r.kvk]=[]; grouped[r.kvk].push(r); });
  const headers = ["Name","ID","Killpoints","T4 / T5","Deads / Power","DKP","DKP %","Acclaim"];
  const ths = headers.map(h=>`<th>${h}</th>`).join("");
  const kvkKeys = Object.keys(grouped);
  let html = "";
  kvkKeys.forEach((kvkName, idx) => {
    const isOpen = idx === kvkKeys.length - 1; // most recent KvK open by default
    const trs = grouped[kvkName].map(r=>`<tr>
      <td class="col-label">${escapeHtml(r.name)}</td>
      <td class="col-mono">${escapeHtml(String(r.id))}</td>
      <td>${fmtDiff(r.kpDiff)}</td>
      <td><div class="troop-diff-stack"><div class="${Number(r.t4Diff)>=0?"diff-positive":"diff-negative"}"><span class="troop-diff-label">T4</span>${fmtSgn(r.t4Diff)}</div><div class="${Number(r.t5Diff)>=0?"diff-positive":"diff-negative"}"><span class="troop-diff-label">T5</span>${fmtSgn(r.t5Diff)}</div></div></td>
      <td><div class="troop-diff-stack"><div class="${Number(r.deadsDiff)>=0?"diff-positive":"diff-negative"}"><span class="troop-diff-label">Dead</span>${fmtSgn(r.deadsDiff)}</div><div class="${Number(r.powerDiff)>=0?"diff-positive":"diff-negative"}"><span class="troop-diff-label">Pwr</span>${fmtSgn(r.powerDiff)}</div></div></td>
      <td>${fmt(r.dkp)}</td>
      <td>${isNaN(Number(r.dkpPercent))?"":fmtPct(r.dkpPercent)}</td>
      <td>${fmt(r.acclaim)}</td>
    </tr>`).join("");
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

  // Attach click handlers for per-KvK collapsible groups
  container.querySelectorAll(".pc-farm-kvk-label").forEach(label => {
    label.addEventListener("click", () => {
      label.closest(".pc-farm-kvk-group").classList.toggle("is-open");
    });
  });
}

// ── Collapsible sections ───────────────────────────────────────────
function initCollapsibleSections() {
  // Collapse all sections by default
  document.querySelectorAll(".pc-section.is-collapsible").forEach(section => {
    section.classList.remove("is-open");
  });

  document.querySelectorAll(".pc-section-title.is-toggle").forEach(title => {
    // Remove old listener by cloning
    const fresh = title.cloneNode(true);
    title.parentNode.replaceChild(fresh, title);
    fresh.addEventListener("click", () => {
      fresh.closest(".pc-section").classList.toggle("is-open");
    });
  });
}

// ── UI state management ────────────────────────────────────────────
function showState(state) {
  document.getElementById("search-state").style.display  = state==="search" ? "" : "none";
  document.getElementById("loading-state").style.display = state==="loading" ? "" : "none";
  document.getElementById("card-state").style.display    = state==="card" ? "" : "none";
  if (state !== "search") {
    document.getElementById("search-error").style.display = "none";
  }
}

function showError(msg) {
  const el = document.getElementById("search-error");
  el.textContent = msg;
  el.style.display = "block";
}

// ── Theme ──────────────────────────────────────────────────────────
const THEME_KEY = "theme";
const themeToggle = document.getElementById("toggle-theme");

function applyTheme(theme) {
  document.body.classList.remove("light","dark");
  document.body.classList.add(theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = (saved==="light"||saved==="dark") ? saved :
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
  themeToggle.checked = theme==="dark";
}
themeToggle.addEventListener("change", ()=>applyTheme(themeToggle.checked?"dark":"light"));

// ── Navbar ─────────────────────────────────────────────────────────
const navbar = document.getElementById("navbar");
window.addEventListener("scroll", ()=>navbar.classList.toggle("scrolled",window.scrollY>10));
const hamburger = document.getElementById("hamburger");
const navLinks  = document.getElementById("nav-links");
hamburger.addEventListener("click",()=>{ navLinks.classList.toggle("show"); hamburger.classList.toggle("open"); });
document.addEventListener("click",e=>{ if (!hamburger.contains(e.target)&&!navLinks.contains(e.target)) { navLinks.classList.remove("show"); hamburger.classList.remove("open"); }});
navLinks.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{ navLinks.classList.remove("show"); hamburger.classList.remove("open"); }));

// ── Back button ────────────────────────────────────────────────────
document.getElementById("back-btn").addEventListener("click",()=>{
  showState("search");
  document.getElementById("player-id-input").focus();
});

// ── Init ───────────────────────────────────────────────────────────
initTheme();
initEquipTooltip();

const dbLoadEl = document.getElementById("db-loading");
const searchBtn = document.getElementById("search-btn");
const inputEl   = document.getElementById("player-id-input");

showState("search");
dbLoadEl.style.display = "flex";
searchBtn.disabled = true;

loadDatabase().then(async (SQL) => {
  // Also load scans DB in background — non-blocking, failures are silent
  await loadScansDatabase(SQL);

  dbReady = true;
  dbLoadEl.style.display = "none";
  searchBtn.disabled = false;
  inputEl.focus();

  // Support ?govId= or ?id= in URL for direct linking
  const params = new URLSearchParams(window.location.search);
  const directId = normalizeNumericId(params.get("govId") || params.get("id"));
  if (directId) {
    inputEl.value = directId;
    renderPlayerCard(directId);
  }
}).catch(err=>{
  dbLoadEl.style.display = "none";
  showError("Failed to load database: " + String(err));
});

function doSearch() {
  if (!dbReady) return;
  const val = inputEl.value.trim();
  if (!val) { showError("Please enter a governor ID or name."); return; }
  hideSuggestions();
  if (normalizeNumericId(val)) {
    document.getElementById("search-error").style.display = "none";
    renderPlayerCard(val);
  } else {
    // Name search — if there's exactly one match, load it; otherwise show suggestions
    const matches = searchByName(val);
    if (!matches.length) { showError(`No player found matching "${val}".`); return; }
    if (matches.length === 1) {
      document.getElementById("search-error").style.display = "none";
      inputEl.value = matches[0].id;
      renderPlayerCard(matches[0].id);
    } else {
      showSuggestions(matches);
    }
  }
}

// ── Autocomplete suggestions ───────────────────────────────────────
const suggestionsEl = document.getElementById("name-suggestions");
let activeSuggestionIdx = -1;

function showSuggestions(matches) {
  activeSuggestionIdx = -1;
  suggestionsEl.innerHTML = matches.map((m, i) =>
    `<div class="name-suggestion-item" data-id="${escapeHtml(m.id)}" data-idx="${i}">
      <span class="name-suggestion-name">${escapeHtml(m.name)}</span>
      <span class="name-suggestion-id">${escapeHtml(m.id)}</span>
    </div>`
  ).join("");
  suggestionsEl.style.display = "block";
  suggestionsEl.querySelectorAll(".name-suggestion-item").forEach(item => {
    item.addEventListener("mousedown", e => {
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
  if (!val || normalizeNumericId(val)) { hideSuggestions(); return; }
  if (val.length < 2) { hideSuggestions(); return; }
  const matches = searchByName(val);
  if (matches.length) showSuggestions(matches);
  else hideSuggestions();
});

inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter") { doSearch(); return; }
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
    hideSuggestions(); return;
  } else { return; }
  items.forEach((item, i) => item.classList.toggle("is-active", i === activeSuggestionIdx));
  if (activeSuggestionIdx >= 0) items[activeSuggestionIdx].scrollIntoView({ block: "nearest" });
  if (e.key === "Enter" && activeSuggestionIdx >= 0) {
    selectSuggestion(items[activeSuggestionIdx].dataset.id);
  }
});

inputEl.addEventListener("blur", () => { setTimeout(hideSuggestions, 150); });

searchBtn.addEventListener("click", doSearch);
