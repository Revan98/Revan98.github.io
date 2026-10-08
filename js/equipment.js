"use strict";

const EQUIP_SLOTS = [
  { key: "helm", label: "Helm" },
  { key: "chest", label: "Chest" },
  { key: "weapon", label: "Weapon" },
  { key: "gloves", label: "Gloves" },
  { key: "legs", label: "Legs" },
  { key: "boots", label: "Boots" },
  { key: "accessory", label: "Accessory" },
  { key: "accessory_sec", label: "Acc. 2" },
];

const DEFAULT_MARCH_COUNT = 12;
const DEFAULT_PAIR_COUNT = 12;
const DEFAULT_ARM_COUNT = 8;
const DEFAULT_SKIN_COUNT = 8;

let MARCH_COUNT = DEFAULT_MARCH_COUNT;
let PAIR_COUNT = DEFAULT_PAIR_COUNT;
let ARM_COUNT = DEFAULT_ARM_COUNT;
let SKIN_COUNT = DEFAULT_SKIN_COUNT;

let SQL = null;
let db = null;

let currentMarch = 1;
let activeTab = "equipment";

const marchData = Array.from({ length: MARCH_COUNT }, () =>
  Object.fromEntries(
    EQUIP_SLOTS.map((s) => [s.key, { item: "", awk: "", tal: "" }]),
  ),
);

const pairsData = Array.from({ length: PAIR_COUNT }, () => ({
  comm1: "",
  comm2: "",
}));

let skinsData = Array.from({ length: SKIN_COUNT }, () => "");

function resizeDataArray(arr, newLen, factory) {
  while (arr.length < newLen) arr.push(factory());
  if (arr.length > newLen) arr.length = newLen;
}

let pickerTarget = null;
let pickerSelectedItem = "";
let allIconNames = [];
let allCommNames = [];
let allSkinNames = [];


(async () => {
  buildArmStatRows();
  try {
    SQL = await getSqlJs();
  } catch (e) {
    console.error("sql.js init failed:", e);
  }
  await loadEquipRefData();
  populateArmamentSelects();
  loadIconManifest();
  loadSkinManifest();
})();

document
  .getElementById("createDbBtn")
  .addEventListener("click", createDatabase);

const dbFileInput = document.getElementById("dbFileInput");
const dbFileName = document.getElementById("dbFileName");
const dbStatus = document.getElementById("dbStatus");
const loadGovBtn = document.getElementById("loadGovBtn");
const saveBtn = document.getElementById("saveBtn");
const newGovBtn = document.getElementById("newGovBtn");
const downloadDbBtn = document.getElementById("downloadDbBtn");
const unsavedBadge = document.getElementById("unsavedBadge");
const farmImportStatus = document.getElementById("farmImportStatus");
const farmSearchInput = document.getElementById("farmSearchInput");
const farmAddNewBtn = document.getElementById("farmAddNewBtn");
const farmsTableBody = document.getElementById("farmsTableBody");
const kvkFileInput = document.getElementById("kvkFileInput");
const kvkImportBtn = document.getElementById("kvkImportBtn");
const kvkImportStatus = document.getElementById("kvkImportStatus");
const kvkKingdomInput = document.getElementById("kvkKingdomInput");
const kvkNumberInput = document.getElementById("kvkNumberInput");
const kvkNameInput = document.getElementById("kvkNameInput");
const addMarchBtn = document.getElementById("addMarchBtn");
const addPairBtn = document.getElementById("addPairBtn");
const addArmBtn = document.getElementById("addArmBtn");
const addSkinBtn = document.getElementById("addSkinBtn");

addMarchBtn?.addEventListener("click", addMarchSlot);
addPairBtn?.addEventListener("click", addPairSlot);
addArmBtn?.addEventListener("click", addArmSlot);
addSkinBtn?.addEventListener("click", addSkinSlot);

function addMarchSlot() {
  if (!db) return;
  MARCH_COUNT++;
  marchData.push(
    Object.fromEntries(
      EQUIP_SLOTS.map((s) => [s.key, { item: "", awk: "", tal: "" }]),
    ),
  );
  ensureEquipmentMarchColumns(db);
  setConfigInt("march_count", MARCH_COUNT);
  renderMarchTabs();
  markDirty();
  showToast(`Added March ${MARCH_COUNT}`, "success");
}

function addPairSlot() {
  if (!db) return;
  PAIR_COUNT++;
  pairsData.push({ comm1: "", comm2: "" });
  ensurePairColumns(db);
  setConfigInt("pair_count", PAIR_COUNT);
  renderPairsGrid();
  markDirty();
  showToast(`Added Pair Row ${PAIR_COUNT}`, "success");
}

function addArmSlot() {
  if (!db) return;
  ARM_COUNT++;
  rebuildArmSlots();
  ensureArmColumns(db);
  setConfigInt("arm_count", ARM_COUNT);
  renderArmamentsGrid();
  markDirty();
  showToast(`Added Armament Slot ${ARM_COUNT}`, "success");
}

function addSkinSlot() {
  if (!db) return;
  SKIN_COUNT++;
  skinsData.push("");
  ensureSkinColumns(db);
  setConfigInt("skin_count", SKIN_COUNT);
  renderSkinGrid();
  markDirty();
  showToast(`Added Skin Slot ${SKIN_COUNT}`, "success");
}

let dbDirty = false;

function markDirty() {
  dbDirty = true;
  if (unsavedBadge) unsavedBadge.style.display = "inline-block";
}

function markClean() {
  dbDirty = false;
  if (unsavedBadge) unsavedBadge.style.display = "none";
}

window.addEventListener("beforeunload", (e) => {
  if (!dbDirty) return;
  e.preventDefault();
  e.returnValue = "";
});

document
  .getElementById("dbFileLabel")
  .addEventListener("click", () => dbFileInput.click());

dbFileInput.addEventListener("change", async () => {
  const file = dbFileInput.files[0];
  if (!file) return;
  dbFileName.textContent = file.name;
  setDbStatus("Loading…", "");
  markClean();

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    db = new SQL.Database(bytes);
    db.exec("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1");
    ensureAppSchema();
    applySlotCounts();
    setDbStatus("✓ Loaded", "ok");
    loadGovBtn.disabled = false;
    saveBtn.disabled = false;
    newGovBtn.disabled = false;
    downloadDbBtn.disabled = false;
    updateImportButtons();
    if (activeTab === "farmImport") renderFarmsTable();
    preloadIconsFromDb();
  } catch (e) {
    setDbStatus("✗ Invalid DB", "err");
    db = null;
    loadGovBtn.disabled = true;
    saveBtn.disabled = true;
    newGovBtn.disabled = true;
    downloadDbBtn.disabled = true;
    updateImportButtons();
    updateAddSlotButtons();
    if (activeTab === "farmImport") renderFarmsTable();
    console.error(e);
  }
});

function setDbStatus(msg, cls) {
  dbStatus.textContent = msg;
  dbStatus.className = "eq-db-status" + (cls ? " " + cls : "");
}

function updateImportButtons() {
  if (farmAddNewBtn) farmAddNewBtn.disabled = !db;
  if (farmSearchInput) farmSearchInput.disabled = !db;
  if (kvkImportBtn) {
    kvkImportBtn.disabled =
      !db ||
      !kvkFileInput?.files?.length ||
      !kvkKingdomInput?.value.trim() ||
      !Number(kvkNumberInput?.value);
  }
}

function setImportStatus(el, msg, cls) {
  if (!el) return;
  el.textContent = msg;
  el.className = "eq-import-status" + (cls ? " " + cls : "");
}

function applySlotCounts() {
  MARCH_COUNT = getConfigInt("march_count", DEFAULT_MARCH_COUNT);
  PAIR_COUNT = getConfigInt("pair_count", DEFAULT_PAIR_COUNT);
  ARM_COUNT = getConfigInt("arm_count", DEFAULT_ARM_COUNT);
  SKIN_COUNT = getConfigInt("skin_count", DEFAULT_SKIN_COUNT);

  resizeDataArray(marchData, MARCH_COUNT, () =>
    Object.fromEntries(
      EQUIP_SLOTS.map((s) => [s.key, { item: "", awk: "", tal: "" }]),
    ),
  );
  resizeDataArray(pairsData, PAIR_COUNT, () => ({ comm1: "", comm2: "" }));
  resizeDataArray(skinsData, SKIN_COUNT, () => "");
  rebuildArmSlots();

  ensureAllSlotColumns(db);

  if (currentMarch > MARCH_COUNT) currentMarch = 1;
  renderMarchTabs();
  renderSlotGrid();
  renderPairsGrid();
  renderArmamentsGrid();
  renderSkinGrid();
  updateAddSlotButtons();
}

function updateAddSlotButtons() {
  [addMarchBtn, addPairBtn, addArmBtn, addSkinBtn].forEach((btn) => {
    if (btn) btn.disabled = !db;
  });
}

kvkFileInput?.addEventListener("change", updateImportButtons);
kvkKingdomInput?.addEventListener("input", updateImportButtons);
kvkNumberInput?.addEventListener("input", updateImportButtons);
kvkNameInput?.addEventListener("input", updateImportButtons);
kvkImportBtn?.addEventListener("click", importKvkWorkbook);

farmSearchInput?.addEventListener("input", () => renderFarmsTable());
farmAddNewBtn?.addEventListener("click", () => {
  farmNewRowOpen = true;
  renderFarmsTable();
});

const govIdInput = document.getElementById("govIdInput");
const govNameInput = document.getElementById("govNameInput");
const VIP_LEVELS = Array.from({ length: 19 }, (_, i) => i + 1);
const SVIP_VALUE = 20;
let vipLevel = null;
const saveStatus = document.getElementById("saveStatus");
const govBadge = document.getElementById("govBadge");

loadGovBtn.addEventListener("click", loadGovernor);

const govIdSuggestionsEl = document.getElementById("govIdSuggestions");
let govIdActiveSuggestionIdx = -1;

function showGovIdSuggestions(matches) {
  govIdActiveSuggestionIdx = -1;
  govIdSuggestionsEl.innerHTML = matches
    .map(
      (m, i) =>
        `<div class="name-suggestion-item" data-id="${escapeHtml(m.id)}" data-idx="${i}">
      <span class="name-suggestion-name">${escapeHtml(m.name)}</span>
      <span class="name-suggestion-id">${escapeHtml(m.id)}</span>
    </div>`,
    )
    .join("");
  govIdSuggestionsEl.style.display = "block";
  govIdSuggestionsEl
    .querySelectorAll(".name-suggestion-item")
    .forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectGovIdSuggestion(item.dataset.id);
      });
    });
}

function hideGovIdSuggestions() {
  govIdSuggestionsEl.style.display = "none";
  govIdSuggestionsEl.innerHTML = "";
  govIdActiveSuggestionIdx = -1;
}

function selectGovIdSuggestion(id) {
  hideGovIdSuggestions();
  govIdInput.value = id;
  loadGovernor();
}

govIdInput.addEventListener("input", () => {
  if (!db) return;
  const val = govIdInput.value.trim();
  if (!val || normalizeNumericId(val) || val.length < 2) {
    hideGovIdSuggestions();
    return;
  }
  const matches = searchByName(val, [{ db, src: "kvk" }]);
  if (matches.length) showGovIdSuggestions(matches);
  else hideGovIdSuggestions();
});

govIdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (
      govIdSuggestionsEl.style.display !== "none" &&
      govIdActiveSuggestionIdx >= 0
    ) {
      const items = govIdSuggestionsEl.querySelectorAll(
        ".name-suggestion-item",
      );
      selectGovIdSuggestion(items[govIdActiveSuggestionIdx].dataset.id);
      return;
    }
    hideGovIdSuggestions();
    loadGovernor();
    return;
  }
  if (govIdSuggestionsEl.style.display === "none") return;
  const items = govIdSuggestionsEl.querySelectorAll(".name-suggestion-item");
  if (!items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    govIdActiveSuggestionIdx = Math.min(
      govIdActiveSuggestionIdx + 1,
      items.length - 1,
    );
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    govIdActiveSuggestionIdx = Math.max(govIdActiveSuggestionIdx - 1, -1);
  } else if (e.key === "Escape") {
    hideGovIdSuggestions();
    return;
  } else {
    return;
  }
  items.forEach((item, i) =>
    item.classList.toggle("is-active", i === govIdActiveSuggestionIdx),
  );
  if (govIdActiveSuggestionIdx >= 0)
    items[govIdActiveSuggestionIdx].scrollIntoView({ block: "nearest" });
});

govIdInput.addEventListener("blur", () => {
  setTimeout(hideGovIdSuggestions, 150);
});

newGovBtn.addEventListener("click", () => {
  if (!db) return;
  clearAllData();
  hideGovIdSuggestions();
  govIdInput.value = "";
  govNameInput.value = "";
  vipLevel = null;
  renderVipGrid();
  setGovBadge("new");
  renderActiveTab();
  showSaveStatus("Fill in the Governor ID & Name, then save.", "info");
  govIdInput.focus();
});

function clearAllData() {
  for (let mi = 0; mi < MARCH_COUNT; mi++)
    for (const s of EQUIP_SLOTS)
      marchData[mi][s.key] = { item: "", awk: "", tal: "" };
  for (let n = 0; n < PAIR_COUNT; n++) pairsData[n] = { comm1: "", comm2: "" };
  for (let i = 0; i < SKIN_COUNT; i++) skinsData[i] = "";
  armamentsRow = null;
  vipLevel = null;
}

function setGovBadge(type) {
  govBadge.className = "eq-gov-badge" + (type ? " " + type : "");
  govBadge.textContent =
    type === "new" ? "New Governor" : type === "loaded" ? "Loaded" : "";
}

let ARM_SLOTS = [];
function rebuildArmSlots() {
  ARM_SLOTS = Array.from({ length: ARM_COUNT }, (_, i) => ({
    prefix: `arm${i + 1}`,
    label: `Arm ${i + 1}`,
  }));
}
rebuildArmSlots();

const ARM_INS_KEYS = [
  "_ins",
  "_ins2",
  "_ins3",
  "_ins4",
  "_ins5",
  "_ins6",
  "_ins7",
  "_ins8",
];
let armamentsRow = null;

function loadArmaments(govId) {
  armamentsRow = null;
  const safeGovId = normalizeNumericId(govId);
  if (!db) return;
  if (!safeGovId) return;
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='armaments'`,
    );
    if (!t.length || !t[0].values.length) return;
    const res = db.exec(
      `SELECT * FROM armaments WHERE player_id=${safeGovId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return;
    const row = {};
    res[0].columns.forEach((c, i) => {
      row[c] = res[0].values[0][i];
    });
    armamentsRow = row;
  } catch (e) {
    console.warn("armaments load failed:", e);
  }
}

function loadSkins(govId) {
  for (let i = 0; i < SKIN_COUNT; i++) skinsData[i] = "";
  const safeGovId = normalizeNumericId(govId);
  if (!db || !safeGovId) return;
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='skins'`,
    );
    if (!t.length || !t[0].values.length) return;
    const res = db.exec(
      `SELECT * FROM skins WHERE player_id=${safeGovId} LIMIT 1`,
    );
    if (!res.length || !res[0].values.length) return;
    const row = zipRow(res[0]);
    for (let i = 0; i < SKIN_COUNT; i++) {
      const v = row[`skin${i + 1}`];
      skinsData[i] = isEmpty(v) ? "" : String(v);
    }
  } catch (e) {
    console.warn("skins load failed:", e);
  }
}

function isArmEmpty(v) {
  if (v === null || v === undefined || v === "") return true;
  return ["none", "0"].includes(String(v).trim().toLowerCase());
}

function loadGovernor() {
  if (!db) return;
  const rawId = govIdInput.value.trim();
  const safeGovId = normalizeNumericId(rawId);

  if (safeGovId) {
    loadGovernorById(safeGovId);
    return;
  }

  if (!rawId) {
    showSaveStatus("Enter a Governor ID or name first.", "err");
    return;
  }

  const matches = searchByName(rawId, [{ db, src: "kvk" }]);
  if (!matches.length) {
    showSaveStatus(`No governor found matching "${rawId}".`, "err");
    return;
  }
  if (matches.length === 1) {
    govIdInput.value = matches[0].id;
    loadGovernorById(matches[0].id);
  } else {
    showGovIdSuggestions(matches);
  }
}

function loadGovernorById(safeGovId) {
  if (!db || !safeGovId) return;

  clearAllData();
  setGovBadge("");

  try {
    const res = db.exec(
      "SELECT name FROM governors WHERE governor_id = ? LIMIT 1",
      [safeGovId],
    );
    if (res.length && res[0].values.length)
      govNameInput.value = res[0].values[0][0] ?? "";
  } catch (e) {}

  try {
    const tbl = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='equipment'`,
    );
    if (tbl.length && tbl[0].values.length) {
      const eqRes = db.exec(
        `SELECT * FROM equipment WHERE player_id=${safeGovId} LIMIT 1`,
      );
      if (eqRes.length && eqRes[0].values.length) {
        const row = zipRow(eqRes[0]);
        populateMarchData(row);
        populatePairsData(row);
        setGovBadge("loaded");
      } else {
        setGovBadge("new");
        showSaveStatus(
          "No equipment record found — starting fresh for this ID.",
          "info",
        );
      }
    }
  } catch (e) {
    console.error("loadGovernor:", e);
  }

  loadPlayerProfile(safeGovId);

  renderSlotGrid();
  renderPairsGrid();
  loadArmaments(safeGovId);
  renderArmamentsGrid();
  loadSkins(safeGovId);
  renderSkinGrid();
}

function loadPlayerProfile(govId) {
  if (!db) return;
  vipLevel = null;
  try {
    const tbl = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='player_profile'`,
    );
    if (!tbl.length || !tbl[0].values.length) {
      renderVipGrid();
      return;
    }
    const res = db.exec(
      `SELECT vip_level FROM player_profile WHERE player_id=${govId} LIMIT 1`,
    );
    if (res.length && res[0].values.length) {
      const [vip] = res[0].values[0];
      vipLevel = isEmpty(vip) ? null : Number(vip);
    } else {
      vipLevel = null;
    }
  } catch (e) {
    console.warn("player_profile load failed:", e);
  }
  renderVipGrid();
}
function getArmTier(name) {
  const info = getInscriptionInfo(name);
  return info ? info.rarity : "gray";
}

function renderArmamentsGrid() {
  const grid = document.getElementById("armGrid");
  grid.innerHTML = "";

  for (const arm of ARM_SLOTS) {
    const name = armamentsRow ? armamentsRow[arm.prefix] : null;
    const isEmpty = isArmEmpty(name);

    const inscriptions =
      !isEmpty && armamentsRow
        ? ARM_INS_KEYS.map((k) => armamentsRow[`${arm.prefix}${k}`])
            .filter((v) => !isArmEmpty(v))
            .map((v) => {
              const tier = getArmTier(String(v));
              return `<span class="arm-ins tier-${tier}" data-tip-code="${escapeHtml(String(v).trim())}" data-tip-kind="inscription">${escapeHtml(String(v))}</span>`;
            })
            .join("")
        : "";

    const stats =
      !isEmpty && armamentsRow
        ? ARM_STAT_DEFS.filter(
            (s) =>
              !isArmEmpty(armamentsRow[`${arm.prefix}${s.nameKey}`]) &&
              !isArmEmpty(armamentsRow[`${arm.prefix}${s.valKey}`]),
          )
            .map(
              (s) =>
                `<span class="eq-arm-stat-tag"><span class="eq-arm-stat-name">${escapeHtml(String(armamentsRow[`${arm.prefix}${s.nameKey}`]))}</span><span class="eq-arm-stat-val">${escapeHtml(String(armamentsRow[`${arm.prefix}${s.valKey}`]))}%</span></span>`,
            )
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
      ${inscriptions ? `<div class="arm-ins-group">${inscriptions}</div>` : ""}
      ${stats ? `<div class="eq-arm-stats-row">${stats}</div>` : ""}
    `;
    div.querySelector(".eq-arm-edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openArmamentEditor(arm.prefix, arm.label);
    });
    div.addEventListener("click", () =>
      openArmamentEditor(arm.prefix, arm.label),
    );
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
      const awk = row[lvlKey(slot.key, mi)];
      const tal = row[talKey(slot.key, mi)];
      marchData[mi][slot.key] = {
        item: isEmpty(item) ? "" : String(item),
        awk: isEmpty(awk) ? "" : String(awk),
        tal: isEmpty(tal) ? "" : String(tal),
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
  const name = govNameInput.value.trim() || "none";
  if (!safeGovId) {
    showSaveStatus("Enter a numeric Governor ID first.", "err");
    return;
  }
  const govId = Number(safeGovId);

  try {
    ensureGovernorRow(govId, name);

    const colsRes = db.exec(`PRAGMA table_info(equipment)`);
    if (!colsRes.length) {
      showSaveStatus("No equipment table in DB.", "err");
      return;
    }
    const existingCols = new Set(colsRes[0].values.map((r) => r[1]));

    const setCols = [];
    const vals = [];

    for (let mi = 0; mi < MARCH_COUNT; mi++) {
      for (const slot of EQUIP_SLOTS) {
        const d = marchData[mi][slot.key];
        pushIfExists(
          setCols,
          vals,
          existingCols,
          colKey(slot.key, mi),
          d.item || "none",
        );
        pushIfExists(
          setCols,
          vals,
          existingCols,
          lvlKey(slot.key, mi),
          d.awk ? Number(d.awk) : null,
        );
        pushIfExists(
          setCols,
          vals,
          existingCols,
          talKey(slot.key, mi),
          d.tal || "none",
        );
      }
    }

    for (let n = 0; n < PAIR_COUNT; n++) {
      pushIfExists(
        setCols,
        vals,
        existingCols,
        `pair${n + 1}_comm1`,
        pairsData[n].comm1 || "none",
      );
      pushIfExists(
        setCols,
        vals,
        existingCols,
        `pair${n + 1}_comm2`,
        pairsData[n].comm2 || "none",
      );
    }

    if (armamentsRow) {
      try {
        const armCols = db.exec(`PRAGMA table_info(armaments)`);
        if (armCols.length) {
          const existArmCols = new Set(armCols[0].values.map((r) => r[1]));
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
              if (existArmCols.has(nk)) {
                armSetCols.push(nk);
                armSetVals.push(armamentsRow[nk] ?? "none");
              }
              if (existArmCols.has(vk)) {
                armSetCols.push(vk);
                armSetVals.push(armamentsRow[vk] ?? null);
              }
            }
          }

          const armUpsertCols = ["player_id", "name", ...armSetCols];
          const armUpsertVals = [govId, name, ...armSetVals];
          const armPh = armUpsertVals.map(() => "?").join(", ");
          const armUpdateSet = armSetCols
            .map((c) => `${c}=excluded.${c}`)
            .join(", ");

          db.run(
            `INSERT INTO armaments (${armUpsertCols.join(", ")}) VALUES (${armPh})
             ON CONFLICT(player_id) DO UPDATE SET name=excluded.name${armUpdateSet ? ", " + armUpdateSet : ""}`,
            armUpsertVals,
          );
        }
      } catch (e) {
        console.warn("armaments save failed:", e);
      }
    }

    const upsertCols = ["player_id", "name", ...setCols];
    const upsertVals = [govId, name, ...vals];
    const ph = upsertVals.map(() => "?").join(", ");
    const updateSet = setCols.map((c) => `${c}=excluded.${c}`).join(", ");

    db.run(
      `INSERT INTO equipment (${upsertCols.join(", ")}) VALUES (${ph})
       ON CONFLICT(player_id) DO UPDATE SET name=excluded.name${updateSet ? ", " + updateSet : ""}`,
      upsertVals,
    );

    try {
      const skinColsRes = db.exec(`PRAGMA table_info(skins)`);
      if (skinColsRes.length) {
        const existSkinCols = new Set(skinColsRes[0].values.map((r) => r[1]));
        const skinSetCols = [];
        const skinSetVals = [];
        for (let i = 0; i < SKIN_COUNT; i++) {
          const col = `skin${i + 1}`;
          if (existSkinCols.has(col)) {
            skinSetCols.push(col);
            skinSetVals.push(skinsData[i] || "none");
          }
        }
        const skinUpsertCols = ["player_id", "name", ...skinSetCols];
        const skinUpsertVals = [govId, name, ...skinSetVals];
        const skinPh = skinUpsertVals.map(() => "?").join(", ");
        const skinUpdateSet = skinSetCols
          .map((c) => `${c}=excluded.${c}`)
          .join(", ");

        db.run(
          `INSERT INTO skins (${skinUpsertCols.join(", ")}) VALUES (${skinPh})
           ON CONFLICT(player_id) DO UPDATE SET name=excluded.name${skinUpdateSet ? ", " + skinUpdateSet : ""}`,
          skinUpsertVals,
        );
      }
    } catch (e) {
      console.warn("skins save failed:", e);
    }

    savePlayerProfile(govId);

    downloadDbBtn.disabled = false;
    markDirty();
    setGovBadge("loaded");
    showSaveStatus(
      "✓ Governor saved (in memory) — download the database when you're done.",
      "ok",
    );
  } catch (e) {
    console.error("saveGovernor:", e);
    showSaveStatus("Error: " + e.message, "err");
  }
}

downloadDbBtn.addEventListener("click", () => {
  if (!db) return;
  downloadDb();
  markClean();
  showSaveStatus("✓ Database downloaded!", "ok");
});

function savePlayerProfile(govId) {
  if (!db) return;
  try {
    const tbl = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='player_profile'`,
    );
    if (!tbl.length || !tbl[0].values.length) return;

    db.run(
      `INSERT INTO player_profile (player_id, vip_level) VALUES (?, ?)
       ON CONFLICT(player_id) DO UPDATE SET vip_level=excluded.vip_level`,
      [govId, vipLevel],
    );
  } catch (e) {
    console.warn("savePlayerProfile:", e);
  }
}

function pushIfExists(cols, vals, existingCols, col, val) {
  if (existingCols.has(col)) {
    cols.push(col);
    vals.push(val);
  }
}

function ensureGovernorRow(govId, name) {
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='governors'`,
    );
    if (!t.length || !t[0].values.length) return;
    db.run(
      `INSERT INTO governors (governor_id, kingdom, name) VALUES (?, ?, ?)
       ON CONFLICT(governor_id, kingdom) DO UPDATE SET name=excluded.name`,
      [String(govId), "", name],
    );
  } catch (e) {
    console.warn("ensureGovernorRow:", e);
  }
}

function downloadDb() {
  const exported = db.export();
  const blob = new Blob([exported], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dbFileInput.files[0]?.name || "kvk.db";
  a.click();
  URL.revokeObjectURL(url);
}

function showSaveStatus(msg, cls) {
  saveStatus.textContent = msg;
  saveStatus.className = "eq-save-status" + (cls ? " " + cls : "");
  clearTimeout(saveStatus._t);
  if (msg && (cls === "ok" || cls === "info"))
    saveStatus._t = setTimeout(() => {
      saveStatus.textContent = "";
      saveStatus.className = "eq-save-status";
    }, 5000);
}

document.querySelectorAll(".eq-section-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;

    document
      .querySelectorAll(".eq-section-tab")
      .forEach((b) => b.classList.toggle("active", b === btn));

    for (const tabName of [
      "equipment",
      "pairs",
      "armaments",
      "skins",
      "vip",
      "farmImport",
      "kvkImport",
    ]) {
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
  else if (activeTab === "skins") renderSkinGrid();
  else if (activeTab === "vip") renderVipGrid();
  else if (activeTab === "farmImport") {
    farmNewRowOpen = false;
    renderFarmsTable();
  } else if (activeTab === "kvkImport") updateImportButtons();
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

document.getElementById("marchTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".eq-tab");
  if (!tab) return;
  currentMarch = Number(tab.dataset.march);
  document
    .querySelectorAll("#marchTabs .eq-tab")
    .forEach((t) => t.classList.toggle("active", t === tab));
  renderSlotGrid();
});

function renderSlotGrid() {
  const grid = document.getElementById("slotGrid");
  const mi = currentMarch - 1;
  grid.innerHTML = "";

  for (const slot of EQUIP_SLOTS) {
    const d = marchData[mi][slot.key];
    const hasItem = !!d.item;
    const card = document.createElement("div");
    card.className = "eq-slot-card" + (hasItem ? " has-item" : "");
    if (hasItem) {
      card.dataset.tipCode = d.item;
      card.dataset.tipKind = "item";
    }

    card.innerHTML = `
      <span class="eq-slot-label">${escapeHtml(slot.label)}</span>
      <div class="eq-slot-img-box">
        ${
          hasItem
            ? `<img src="${iconPath(d.item, "item")}" alt="${escapeHtml(d.item)}" loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="eq-slot-placeholder" style="display:none;">?</div>`
            : `<div class="eq-slot-placeholder">+</div>`
        }
      </div>
      <span class="eq-slot-item-name">${hasItem ? escapeHtml(d.item) : "—"}</span>
      <div class="eq-slot-stats">
        <span class="eq-slot-stat${hasItem && d.awk ? " filled" : ""}">Awk: ${hasItem && d.awk ? escapeHtml(d.awk) : "—"}</span>
        <span class="eq-slot-stat${hasItem && d.tal ? " filled" : ""}">Tal: ${hasItem && d.tal ? escapeHtml(d.tal) : "—"}</span>
      </div>`;

    card.addEventListener("click", () =>
      openPicker({ type: "equip", marchIdx: mi, slotKey: slot.key }),
    );
    grid.appendChild(card);
  }
}

function renderPairsGrid() {
  const grid = document.getElementById("pairsGrid");
  grid.innerHTML = "";

  for (let n = 0; n < PAIR_COUNT; n++) {
    const p = pairsData[n];
    const row = document.createElement("div");
    row.className = "eq-pair-row";
    row.innerHTML = `<span class="eq-pair-label">Pair ${n + 1}</span>`;

    for (const slot of ["comm1", "comm2"]) {
      const name = p[slot];
      const hasComm = !!name;
      const card = document.createElement("div");
      card.className = "eq-pair-card" + (hasComm ? " has-item" : "");
      if (hasComm) {
        card.dataset.tipCode = name;
        card.dataset.tipKind = "commander";
      }

      card.innerHTML = `
        <div class="eq-pair-img-box">
          ${
            hasComm
              ? `<img src="${iconPath(name, "commander")}" alt="${escapeHtml(name)}" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <div class="eq-slot-placeholder" style="display:none;">?</div>`
              : `<div class="eq-slot-placeholder">+</div>`
          }
        </div>
        <span class="eq-pair-comm-name">${hasComm ? escapeHtml(name) : "—"}</span>
        ${hasComm ? `<button class="eq-pair-clear" title="Clear this commander">×</button>` : ""}`;

      card.addEventListener("click", (ev) => {
        if (ev.target.classList.contains("eq-pair-clear")) return;
        openPicker({ type: "pair", pairIdx: n, slot });
      });

      const clearBtn = card.querySelector(".eq-pair-clear");
      if (clearBtn) {
        clearBtn.addEventListener("click", (ev) => {
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

function renderSkinGrid() {
  const grid = document.getElementById("skinGrid");
  if (!grid) return;
  grid.innerHTML = "";

  for (let i = 0; i < SKIN_COUNT; i++) {
    const name = skinsData[i];
    const hasItem = !!name;
    const card = document.createElement("div");
    card.className = "eq-slot-card" + (hasItem ? " has-item" : "");
    if (hasItem) {
      card.dataset.tipCode = name;
      card.dataset.tipKind = "skin";
    }

    card.innerHTML = `
      <span class="eq-slot-label">Skin ${i + 1}</span>
      <div class="eq-slot-img-box">
        ${
          hasItem
            ? `<img src="${iconPath(name, "skin")}" alt="${escapeHtml(name)}" loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="eq-slot-placeholder" style="display:none;">?</div>`
            : `<div class="eq-slot-placeholder">+</div>`
        }
      </div>
      <span class="eq-slot-item-name">${hasItem ? escapeHtml(name) : "—"}</span>
      ${hasItem ? `<button class="eq-pair-clear" title="Clear this skin">×</button>` : ""}`;

    card.addEventListener("click", (ev) => {
      if (ev.target.classList.contains("eq-pair-clear")) return;
      openPicker({ type: "skin", skinIdx: i });
    });

    const clearBtn = card.querySelector(".eq-pair-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        skinsData[i] = "";
        renderSkinGrid();
      });
    }

    grid.appendChild(card);
  }
}

function renderVipGrid() {
  const grid = document.getElementById("vipGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const buttons = [
    ...VIP_LEVELS.map((n) => ({ label: String(n), value: n })),
    { label: "SVIP", value: SVIP_VALUE },
  ];

  for (const { label, value } of buttons) {
    const isSelected = vipLevel === value;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "eq-vip-btn" +
      (isSelected ? " selected" : "") +
      (value === SVIP_VALUE ? " svip" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      vipLevel = isSelected ? null : value;
      renderVipGrid();
    });
    grid.appendChild(btn);
  }
}

renderSlotGrid();
renderPairsGrid();
renderSkinGrid();
renderVipGrid();

const pickerOverlay = document.getElementById("pickerOverlay");
const pickerBody = document.getElementById("pickerBody");
const pickerSearch = document.getElementById("pickerSearch");
const pickerClose = document.getElementById("pickerClose");
const pickerClearBtn = document.getElementById("pickerClearBtn");
const pickerSlotLabel = document.getElementById("pickerSlotLabel");

pickerClose.addEventListener("click", closePicker);
pickerClearBtn.addEventListener("click", clearPickerSlot);
pickerOverlay.addEventListener("click", (e) => {
  if (e.target === pickerOverlay) closePicker();
});
pickerSearch.addEventListener("input", () =>
  renderPickerItems(pickerSearch.value.trim()),
);

const detailPopup = document.getElementById("detailPopup");
const detailBackdrop = document.getElementById("detailBackdrop");
const detailImg = document.getElementById("detailImg");
const detailItemName = document.getElementById("detailItemName");
const detailAwk = document.getElementById("detailAwk");
const detailTal = document.getElementById("detailTal");
const detailSlotTitle = document.getElementById("detailSlotTitle");
const detailClose = document.getElementById("detailClose");
const detailConfirm = document.getElementById("detailConfirm");

let detailTarget = null;

function openDetailPopup(marchIdx, slotKey) {
  detailTarget = { marchIdx, slotKey };
  const d = marchData[marchIdx][slotKey];
  const slot = EQUIP_SLOTS.find((s) => s.key === slotKey);
  detailSlotTitle.textContent = `${slot?.label ?? slotKey} — March ${marchIdx + 1}`;
  detailItemName.textContent = d.item;
  detailImg.src = iconPath(d.item, "item");
  detailImg.alt = d.item;
  detailImg.onerror = () => {
    detailImg.style.display = "none";
  };
  detailImg.style.display = "";
  detailAwk.value = d.awk ?? "";

  const talVal = (d.tal ?? "").toLowerCase();
  setTalentBtn(talVal === "yes" ? "yes" : talVal === "no" ? "no" : "");

  detailPopup.style.display = "block";
  detailBackdrop.style.display = "block";
  detailAwk.focus();
}

function closeDetailPopup() {
  detailPopup.style.display = "none";
  detailBackdrop.style.display = "none";
  detailTarget = null;
}

detailClose.addEventListener("click", closeDetailPopup);
detailBackdrop.addEventListener("click", closeDetailPopup);

function setTalentBtn(val) {
  detailTal.value = val;
  document
    .getElementById("talBtnYes")
    .classList.toggle("active", val === "yes");
  document.getElementById("talBtnNo").classList.toggle("active", val === "no");
}
document
  .getElementById("talBtnYes")
  .addEventListener("click", () => setTalentBtn("yes"));
document
  .getElementById("talBtnNo")
  .addEventListener("click", () => setTalentBtn("no"));

detailConfirm.addEventListener("click", () => {
  if (!detailTarget) return;
  marchData[detailTarget.marchIdx][detailTarget.slotKey].awk =
    detailAwk.value.trim();
  marchData[detailTarget.marchIdx][detailTarget.slotKey].tal =
    detailTal.value.trim();
  closeDetailPopup();
  renderSlotGrid();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.getElementById("armModalOverlay").classList.contains("open"))
      closeArmamentEditor();
    else if (detailPopup.style.display === "block") closeDetailPopup();
    else closePicker();
  }
});

document.getElementById("armModalOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeArmamentEditor();
});
document
  .getElementById("armModalClose")
  .addEventListener("click", closeArmamentEditor);
document
  .getElementById("armModalSave")
  .addEventListener("click", saveArmamentEditor);
document.getElementById("armModalClear").addEventListener("click", () => {
  if (!armEditorPrefix) return;
  document.getElementById("armModalName").value = "";
  ARM_STAT_DEFS.forEach((_, i) => {
    document.getElementById(`armStatName${i}`).value = "";
    document.getElementById(`armStatVal${i}`).value = "";
  });
  ARM_INS_KEYS.forEach((_, i) => {
    document.getElementById(`armIns${i}`).value = "";
  });
  renderInsChosenList();
  renderArmSetBonus();
});
document
  .getElementById("armModalName")
  .addEventListener("input", renderArmSetBonus);

document
  .getElementById("openInsPickerBtn")
  .addEventListener("click", openInsPicker);
document
  .getElementById("insPickerClose")
  .addEventListener("click", closeInsPicker);
document
  .getElementById("insPickerConfirm")
  .addEventListener("click", confirmInsPicker);
document
  .getElementById("insPickerClearAll")
  .addEventListener("click", clearInsPickerSelection);
document
  .getElementById("insPickerSearch")
  .addEventListener("input", (e) => renderInsPickerList(e.target.value.trim()));
document.getElementById("insPickerOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeInsPicker();
});
