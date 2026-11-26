const referenceData = {
  items: {},
  commanders: {},
  inscriptions: {},
  inscriptionsByName: {},
  skins: {},
  armaments: {},
  armamentsByKey: {},
  armTroopTypes: {},
};

const REFERENCE_FILES = {
  items: { url: "data/items.json", key: "items" },
  commanders: { url: "data/commanders.json", key: "commanders" },
  inscriptions: { url: "data/inscriptions.json", key: "inscriptions" },
  skins: { url: "data/skins.json", key: "skins" },
  armaments: { url: "data/armaments.json", key: "armaments" },
  armTroopTypes: { url: "data/arm_troop_types.json", key: "types" },
};
const DEFAULT_REFERENCE_KINDS = ["items", "commanders", "inscriptions", "skins", "armaments", "armTroopTypes"];
const referenceLoads = {};

function normalizeArmamentKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/formation/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function loadReferenceFile(kind) {
  referenceLoads[kind] ??= (async () => {
    const { url, key } = REFERENCE_FILES[kind];
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      referenceData[kind] = json[key] || {};
    } catch (event) {
      console.error(`${url} failed to load or parse:`, event);
    }
  })();
  return referenceLoads[kind];
}

async function loadEquipmentReferenceData(kinds = DEFAULT_REFERENCE_KINDS) {
  await Promise.all(kinds.map(loadReferenceFile));

  if (kinds.includes("inscriptions") && !Object.keys(referenceData.inscriptionsByName).length) {
    for (const [key, info] of Object.entries(referenceData.inscriptions)) {
      const nameKey = String(info.name || key).trim().toLowerCase();
      referenceData.inscriptionsByName[nameKey] = { key, ...info };
    }
  }
  if (kinds.includes("armaments") && !Object.keys(referenceData.armamentsByKey).length) {
    for (const [key, info] of Object.entries(referenceData.armaments)) {
      const entry = { key, ...info };
      referenceData.armamentsByKey[normalizeArmamentKey(key)] = entry;
      if (info.name) referenceData.armamentsByKey[normalizeArmamentKey(info.name)] = entry;
    }
  }
}

const lookup = (table, code) => table[String(code ?? "").trim()] || null;

function getItemInfo(code) {
  return lookup(referenceData.items, code);
}
function getCommanderInfo(code) {
  return lookup(referenceData.commanders, code);
}
function getSkinInfo(code) {
  return lookup(referenceData.skins, code);
}
function getInscriptionInfo(name) {
  return referenceData.inscriptionsByName[String(name ?? "").trim().toLowerCase()] || null;
}
function getArmamentInfo(name) {
  return referenceData.armamentsByKey[normalizeArmamentKey(name)] || null;
}

function getArmamentTypeOptions() {
  return Object.values(referenceData.armaments)
    .filter((armament) => armament.name)
    .map((armament) => ({ value: armament.name.replace(/\s+Formation$/i, ""), label: armament.name }));
}

function getArmamentStatIconPath(statName) {
  const icon = referenceData.armTroopTypes[String(statName ?? "").trim()]?.icon;
  return icon ? `icons/troopico/${encodeURIComponent(icon)}.webp` : null;
}

function getArmamentTroopTypeNames() {
  return Object.keys(referenceData.armTroopTypes);
}

function getAllInscriptionNames() {
  return Object.values(referenceData.inscriptionsByName)
    .map((index) => index.name)
    .sort((firstName, secondName) => firstName.localeCompare(secondName));
}

const ARMAMENT_STAT_COUNT = 14;
const ARMAMENT_STAT_DEFINITIONS = Array.from({ length: ARMAMENT_STAT_COUNT }, (_, index) => {
  const skinNumber = index + 1;
  return skinNumber === 1
    ? { nameKey: "_stat_name", valKey: "_stat" }
    : { nameKey: `_stat${skinNumber}_name${skinNumber}`, valKey: `_stat${skinNumber}` };
});

function armamentStatColumns(prefix) {
  return ARMAMENT_STAT_DEFINITIONS.map((armamentStatDefinition) => ({ n: prefix + armamentStatDefinition.nameKey, v: prefix + armamentStatDefinition.valKey }));
}

const MARCH_COLUMN_REGEX =
  /^(?:helm|chest|weapon|gloves|legs|boots|accessory|accessory_sec)_(\d+)$/;

function maxNumberedColumn(row, pattern) {
  let max = 0;
  if (!row) return max;
  for (const key of Object.keys(row)) {
    const match = pattern.exec(key);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function marchSuffixes(row) {
  const count = Math.max(1, maxNumberedColumn(row, MARCH_COLUMN_REGEX));
  return Array.from({ length: count }, (_, index) => (index === 0 ? "" : String(index + 1)));
}

function pairCount(row) {
  return maxNumberedColumn(row, /^pair(\d+)_comm[12]$/);
}

function armamentSlotsFor(row) {
  return Array.from({ length: maxNumberedColumn(row, /^arm(\d+)$/) }, (_, index) => ({
    prefix: `arm${index + 1}`,
    label: `Arm ${index + 1}`,
  }));
}

function skinKeysFor(row) {
  return Array.from({ length: maxNumberedColumn(row, /^skin(\d+)$/) }, (_, index) => `skin${index + 1}`);
}

function isEmptyValue(value) {
  if (value === null || value === undefined || value === "") return true;
  const text = String(value).trim().toLowerCase();
  return text === "none" || text === "0";
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

function toRoman(value) {
  const numericValue = parseInt(String(value).trim(), 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "";
  return ROMAN_NUMERALS[numericValue] || String(numericValue);
}

function hasTalent(value) {
  if (isEmptyValue(value)) return false;
  const text = String(value).trim().toLowerCase();
  return !["no", "n", "false", "-", "—"].includes(text);
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

const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

function tooltipName(name, rarity) {
  const cssClass = rarity ? ` tt-rarity-${escapeHtml(String(rarity).toLowerCase())}` : "";
  return `<div class="tt-name${cssClass}">${escapeHtml(name)}</div>`;
}

function tooltipSlot(text) {
  return text ? `<div class="tt-slot">${escapeHtml(text)}</div>` : "";
}

function tooltipStats(list) {
  const stats = toArray(list);
  return stats.length
    ? `<ul class="tt-stats">${stats.map((stat) => `<li>${escapeHtml(String(stat))}</li>`).join("")}</ul>`
    : "";
}

function fillValues(template, values) {
  const list = toArray(values);
  return String(template)
    .split(/(\{\d+\})/)
    .map((part) => {
      const match = /^\{(\d+)\}$/.exec(part);
      if (!match) return escapeHtml(part).replace(/\n/g, "<br>");
      const value = list[Number(match[1]) - 1];
      return value ? `<b class="tt-val">${escapeHtml(String(value))}</b>` : escapeHtml(part);
    })
    .join("");
}

function tooltipIconic(list) {
  const rows = toArray(list);
  if (!rows.length) return "";
  const roman = ["", "I", "II", "III", "IV", "V"];
  const items = rows
    .map((row) => {
      const numeral = `<span class="tt-iconic-tier">${roman[row.tier] || escapeHtml(String(row.tier))}</span>`;
      if (row.description || row.value == null) {
        return (
          `<li class="tt-iconic-skill">${numeral}<span class="tt-iconic-name">${escapeHtml(String(row.label))}</span>` +
          (row.description ? `<div class="tt-iconic-desc">${fillValues(row.description, row.values)}</div>` : "") +
          `</li>`
        );
      }
      return `<li>${numeral}${escapeHtml(String(row.label))} <b class="tt-val">${escapeHtml(String(row.value))}</b></li>`;
    })
    .join("");
  return `<div class="tt-section">Iconic Attributes</div><ul class="tt-iconic">${items}</ul>`;
}

function tooltipDescription(desc) {
  const lines = toArray(desc);
  return lines.length
    ? `<div class="tt-desc">${lines.map((line) => escapeHtml(String(line))).join("<br>")}</div>`
    : "";
}

function buildTooltipHtml(code, kind) {
  if (isEmptyValue(code)) return "";
  const key = String(code).trim();

  if (kind === "commander") {
    const info = getCommanderInfo(key);
    return tooltipName(info?.name || key);
  }

  if (kind === "armament") {
    const info = getArmamentInfo(key);
    return tooltipName(info?.name || key) + tooltipDescription(info?.description);
  }

  if (kind === "inscription") {
    const info = getInscriptionInfo(key);
    if (!info) return tooltipName(key);
    return (
      tooltipName(info.name || key, info.rarity || "gold") +
      tooltipSlot(info.type) +
      (info.description
        ? `<div class="tt-desc">${escapeHtml(String(info.description))}</div>`
        : "")
    );
  }

  const info = kind === "skin" ? getSkinInfo(key) : getItemInfo(key);
  if (!info) return tooltipName(key);
  return (
    tooltipName(info.name || key, info.rarity || "gold") +
    (kind === "skin" ? "" : tooltipSlot(info.slot)) +
    tooltipStats(info.stats) +
    tooltipDescription(info.description) +
    tooltipIconic(info.iconic)
  );
}

function initEquipmentTooltip() {
  const tooltip = document.getElementById("equipTooltip");
  if (!tooltip) return;

  let activeElement = null;

  function positionTooltip(x, y) {
    const margin = 14;
    const rect = tooltip.getBoundingClientRect();
    let left = x + margin;
    let tooltipTop = y + margin;

    if (left + rect.width > window.innerWidth - 8) {
      left = x - rect.width - margin;
    }
    if (tooltipTop + rect.height > window.innerHeight - 8) {
      tooltipTop = y - rect.height - margin;
    }
    left = Math.max(8, left);
    tooltipTop = Math.max(8, tooltipTop);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${tooltipTop}px`;
  }

  document.addEventListener("mouseover", (event) => {
    const element = event.target.closest("[data-tip-code]");
    if (!element) return;
    activeElement = element;

    const html = buildTooltipHtml(element.dataset.tipCode, element.dataset.tipKind);
    if (!html) return;

    tooltip.innerHTML = html;
    tooltip.style.display = "block";
    positionTooltip(event.clientX, event.clientY);
  });

  document.addEventListener("mousemove", (event) => {
    if (!activeElement || tooltip.style.display === "none") return;
    positionTooltip(event.clientX, event.clientY);
  });

  document.addEventListener("mouseout", (event) => {
    const element = event.target.closest("[data-tip-code]");
    if (!element || element !== activeElement) return;
    if (element.contains(event.relatedTarget)) return;
    activeElement = null;
    tooltip.style.display = "none";
  });

  document.addEventListener(
    "scroll",
    () => {
      tooltip.style.display = "none";
      activeElement = null;
    },
    true,
  );
}

document.addEventListener("DOMContentLoaded", initEquipmentTooltip);
