/* ==========================================================================
   gameData.js — Rise of Kingdoms reference data shared by the dashboard modal,
   the player card and the equipment editor: data, .json loading, lookups,
   icon paths, small equipment helpers and hover tooltips.
   Depends on: common.js (escapeHtml).
   Everything lives behind `refData` so pages can keep their own variables
   called skinsData / itemsData etc. without clashing.
   ========================================================================== */

const refData = {
  items: {},
  commanders: {},
  inscriptions: {},
  inscriptionsByName: {},
  skins: {},
  armaments: {},
  armamentsByKey: {},
  armTroopTypes: {},
};

const REF_FILES = {
  items: { url: "data/items.json", key: "items" },
  commanders: { url: "data/commanders.json", key: "commanders" },
  inscriptions: { url: "data/inscriptions.json", key: "inscriptions" },
  skins: { url: "data/skins.json", key: "skins" },
  armaments: { url: "data/armaments.json", key: "armaments" },
  armTroopTypes: { url: "data/arm_troop_types.json", key: "types" },
};

const DEFAULT_REF_KINDS = ["items", "commanders", "inscriptions", "skins", "armaments", "armTroopTypes"];
const refLoads = {};

function normalizeArmamentKey(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/formation/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function loadRefFile(kind) {
  refLoads[kind] ??= (async () => {
    const { url, key } = REF_FILES[kind];
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      refData[kind] = json[key] || {};
    } catch (e) {
      console.error(`${url} failed to load or parse:`, e);
    }
  })();
  return refLoads[kind];
}

async function loadEquipRefData(kinds = DEFAULT_REF_KINDS) {
  await Promise.all(kinds.map(loadRefFile));

  refData.inscriptionsByName = {};
  for (const [key, info] of Object.entries(refData.inscriptions)) {
    const nameKey = String(info.name || key).trim().toLowerCase();
    refData.inscriptionsByName[nameKey] = { key, ...info };
  }
  refData.armamentsByKey = {};
  for (const [key, info] of Object.entries(refData.armaments)) {
    const entry = { key, ...info };
    refData.armamentsByKey[normalizeArmamentKey(key)] = entry;
    if (info.name) refData.armamentsByKey[normalizeArmamentKey(info.name)] = entry;
  }
}

const lookup = (table, code) => table[String(code ?? "").trim()] || null;

function getItemInfo(code) {
  return lookup(refData.items, code);
}
function getCommanderInfo(code) {
  return lookup(refData.commanders, code);
}
function getSkinInfo(code) {
  return lookup(refData.skins, code);
}
function getInscriptionInfo(name) {
  return refData.inscriptionsByName[String(name ?? "").trim().toLowerCase()] || null;
}
function getArmamentInfo(name) {
  return refData.armamentsByKey[normalizeArmamentKey(name)] || null;
}

function getArmamentTypeOptions() {
  return Object.values(refData.armaments)
    .filter((a) => a.name)
    .map((a) => ({ value: a.name.replace(/\s+Formation$/i, ""), label: a.name }));
}

function getArmStatIconPath(statName) {
  const icon = refData.armTroopTypes[String(statName ?? "").trim()]?.icon;
  return icon ? `icons/troopico/${encodeURIComponent(icon)}.webp` : null;
}

function getArmTroopTypeNames() {
  return Object.keys(refData.armTroopTypes);
}

function getAllInscriptionNames() {
  return Object.values(refData.inscriptionsByName)
    .map((i) => i.name)
    .sort((a, b) => a.localeCompare(b));
}

const ARM_STAT_COUNT = 14;
const ARM_STAT_DEFS = Array.from({ length: ARM_STAT_COUNT }, (_, i) => {
  const n = i + 1;
  return n === 1
    ? { nameKey: "_stat_name", valKey: "_stat" }
    : { nameKey: `_stat${n}_name${n}`, valKey: `_stat${n}` };
});

function armStatColumns(prefix) {
  return ARM_STAT_DEFS.map((s) => ({ n: prefix + s.nameKey, v: prefix + s.valKey }));
}

function isEmptyVal(v) {
  if (v === null || v === undefined || v === "") return true;
  const s = String(v).trim().toLowerCase();
  return s === "none" || s === "0";
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

function iconPath(name, kind) {
  const folder =
    kind === "commander"
      ? "commanders"
      : kind === "skin"
        ? "skins"
        : kind === "armament"
          ? "armaments"
          : "equipment";
  return `icons/${folder}/${encodeURIComponent(String(name).trim().toLowerCase())}.webp`;
}

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function ttName(name, rarity) {
  const cls = rarity ? ` tt-rarity-${escapeHtml(String(rarity).toLowerCase())}` : "";
  return `<div class="tt-name${cls}">${escapeHtml(name)}</div>`;
}

function ttSlot(text) {
  return text ? `<div class="tt-slot">${escapeHtml(text)}</div>` : "";
}

function ttStats(list) {
  const stats = toArray(list);
  return stats.length
    ? `<ul class="tt-stats">${stats.map((s) => `<li>${escapeHtml(String(s))}</li>`).join("")}</ul>`
    : "";
}

function ttDesc(desc) {
  const lines = toArray(desc);
  return lines.length
    ? `<div class="tt-desc">${lines.map((d) => escapeHtml(String(d))).join("<br>")}</div>`
    : "";
}

function buildTooltipHtml(code, kind) {
  if (isEmptyVal(code)) return "";
  const key = String(code).trim();

  if (kind === "commander") {
    const info = getCommanderInfo(key);
    return ttName(info?.name || key);
  }

  if (kind === "armament") {
    const info = getArmamentInfo(key);
    return ttName(info?.name || key) + ttDesc(info?.description);
  }

  if (kind === "inscription") {
    const info = getInscriptionInfo(key);
    if (!info) return ttName(key);
    return (
      ttName(info.name || key, info.rarity || "gold") +
      ttSlot(info.type) +
      (info.description
        ? `<div class="tt-desc">${escapeHtml(String(info.description))}</div>`
        : "")
    );
  }

  const info = kind === "skin" ? getSkinInfo(key) : getItemInfo(key);
  if (!info) return ttName(key);
  return (
    ttName(info.name || key, info.rarity || "gold") +
    (kind === "skin" ? "" : ttSlot(info.slot)) +
    ttStats(info.stats) +
    ttDesc(info.description)
  );
}

function initEquipTooltip() {
  const tip = document.getElementById("equipTooltip");
  if (!tip) return;

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

  document.addEventListener(
    "scroll",
    () => {
      tip.style.display = "none";
      activeEl = null;
    },
    true,
  );
}

document.addEventListener("DOMContentLoaded", initEquipTooltip);
