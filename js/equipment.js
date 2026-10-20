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

let editorReady = false;
let loadTicket = 0;
const dbStatus = document.getElementById("dbStatus");

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
  const connected = connectToDatabase();
  await loadEquipRefData();
  populateArmamentSelects();
  loadIconManifest();
  loadSkinManifest();
  await connected;
  preloadIconsFromDb();
})();

const loadGovBtn = document.getElementById("loadGovBtn");
const saveBtn = document.getElementById("saveBtn");
const newGovBtn = document.getElementById("newGovBtn");
const farmImportStatus = document.getElementById("farmImportStatus");
const farmSearchInput = document.getElementById("farmSearchInput");
const farmAddNewBtn = document.getElementById("farmAddNewBtn");
const farmsTableBody = document.getElementById("farmsTableBody");
const addMarchBtn = document.getElementById("addMarchBtn");
const addPairBtn = document.getElementById("addPairBtn");
const addArmBtn = document.getElementById("addArmBtn");
const addSkinBtn = document.getElementById("addSkinBtn");


async function connectToDatabase() {
  setDbStatus("Connecting…", "");
  try {
    applyCounts(await edInit());
    editorReady = true;
    setDbStatus("✓ Connected", "ok");
    loadGovBtn.disabled = false;
    saveBtn.disabled = false;
    newGovBtn.disabled = false;
    updateImportButtons();
    updateAddSlotButtons();
    if (activeTab === "farmImport") renderFarmsTable();
    openGovernorFromUrl();
  } catch (e) {
    console.error(e);
    setDbStatus("✗ Could not connect", "err");
    showToast("Could not connect to the database: " + e.message, "error");
  }
}

function openGovernorFromUrl() {
  const params = new URLSearchParams(location.search);
  const id = normalizeNumericId(params.get("govId") || params.get("id"));
  if (!id) return;
  govIdInput.value = id;
  loadGovernorById(id);
}

function applyCounts(counts) {
  MARCH_COUNT = counts.march_count;
  PAIR_COUNT = counts.pair_count;
  ARM_COUNT = counts.arm_count;
  SKIN_COUNT = counts.skin_count;

  resizeDataArray(marchData, MARCH_COUNT, () =>
    Object.fromEntries(
      EQUIP_SLOTS.map((s) => [s.key, { item: "", awk: "", tal: "" }]),
    ),
  );
  resizeDataArray(pairsData, PAIR_COUNT, () => ({ comm1: "", comm2: "" }));
  resizeDataArray(skinsData, SKIN_COUNT, () => "");
  rebuildArmSlots();

  if (currentMarch > MARCH_COUNT) currentMarch = 1;
  renderMarchTabs();
  renderSlotGrid();
  renderPairsGrid();
  renderArmamentsGrid();
  renderSkinGrid();
  updateAddSlotButtons();
}

async function addSlot(kind, label) {
  if (!editorReady) return;
  try {
    const counts = await edAddSlot(kind);
    applyCounts(counts);
    showToast(`Added ${label} ${counts[kind + "_count"]}`, "success");
  } catch (e) {
    showToast("Could not add the slot: " + e.message, "error");
  }
}
addMarchBtn?.addEventListener("click", () => addSlot("march", "March"));
addPairBtn?.addEventListener("click", () => addSlot("pair", "Pair Row"));
addArmBtn?.addEventListener("click", () => addSlot("arm", "Armament Slot"));
addSkinBtn?.addEventListener("click", () => addSlot("skin", "Skin Slot"));

function updateImportButtons() {
  if (farmAddNewBtn) farmAddNewBtn.disabled = !editorReady;
  if (farmSearchInput) farmSearchInput.disabled = !editorReady;
}

function updateAddSlotButtons() {
  [addMarchBtn, addPairBtn, addArmBtn, addSkinBtn].forEach((btn) => {
    if (btn) btn.disabled = !editorReady;
  });
}

function setDbStatus(msg, cls) {
  dbStatus.textContent = msg;
  dbStatus.className = "eq-db-status" + (cls ? " " + cls : "");
}

function setImportStatus(el, msg, cls) {
  if (!el) return;
  el.textContent = msg;
  el.className = "eq-import-status" + (cls ? " " + cls : "");
}


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

let govSuggestTicket = 0;
govIdInput.addEventListener("input", () => {
  if (!editorReady) return;
  const val = govIdInput.value.trim();
  if (!val || normalizeNumericId(val) || val.length < 2) {
    hideGovIdSuggestions();
    return;
  }
  const ticket = ++govSuggestTicket;
  searchGovernorsByName(val)
    .then((matches) => {
      if (ticket !== govSuggestTicket) return;
      if (matches.length) showGovIdSuggestions(matches);
      else hideGovIdSuggestions();
    })
    .catch(() => hideGovIdSuggestions());
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
  if (!editorReady) return;
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

function isArmEmpty(v) {
  if (v === null || v === undefined || v === "") return true;
  return ["none", "0"].includes(String(v).trim().toLowerCase());
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
        awk: isEmpty(awk) ? "" : clampAwaken(awk),
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

async function loadGovernor() {
  if (!editorReady) return;
  const rawId = govIdInput.value.trim();
  const safeGovId = normalizeNumericId(rawId);

  if (safeGovId) {
    await loadGovernorById(safeGovId);
    return;
  }
  if (!rawId) {
    showSaveStatus("Enter a Governor ID or name first.", "err");
    return;
  }

  let matches;
  try {
    matches = await searchGovernorsByName(rawId);
  } catch (e) {
    showSaveStatus("Search failed: " + e.message, "err");
    return;
  }
  if (!matches.length) {
    showSaveStatus(`No governor found matching "${rawId}".`, "err");
    return;
  }
  if (matches.length === 1) {
    govIdInput.value = matches[0].id;
    await loadGovernorById(matches[0].id);
  } else {
    showGovIdSuggestions(matches);
  }
}

async function loadGovernorById(safeGovId) {
  if (!editorReady || !safeGovId) return;

  const ticket = ++loadTicket;
  clearAllData();
  setGovBadge("");
  showSaveStatus("Loading…", "info");

  let data;
  try {
    data = await edLoadGovernor(safeGovId);
  } catch (e) {
    console.error("loadGovernor:", e);
    if (ticket === loadTicket) showSaveStatus("Could not load governor: " + e.message, "err");
    return;
  }
  if (ticket !== loadTicket) return;
  showSaveStatus("", "");

  if (data.name) govNameInput.value = data.name;

  if (data.equipment) {
    populateMarchData(data.equipment);
    populatePairsData(data.equipment);
    setGovBadge("loaded");
  } else {
    setGovBadge("new");
    showSaveStatus("No equipment record found — starting fresh for this ID.", "info");
  }

  const vip = data.profile?.vip_level;
  vipLevel = isEmpty(vip) ? null : Number(vip);
  renderVipGrid();

  armamentsRow = data.armaments ?? null;
  for (let i = 0; i < SKIN_COUNT; i++) {
    const v = data.skins?.[`skin${i + 1}`];
    skinsData[i] = isEmpty(v) ? "" : String(v);
  }

  renderSlotGrid();
  renderPairsGrid();
  renderArmamentsGrid();
  renderSkinGrid();
}

saveBtn.addEventListener("click", saveGovernor);

async function saveGovernor() {
  if (!editorReady) return;
  const safeGovId = normalizeNumericId(govIdInput.value);
  if (!safeGovId) {
    showSaveStatus("Enter a numeric Governor ID first.", "err");
    return;
  }

  const equipment = {};
  for (let mi = 0; mi < MARCH_COUNT; mi++) {
    for (const slot of EQUIP_SLOTS) {
      const d = marchData[mi][slot.key];
      equipment[colKey(slot.key, mi)] = d.item || "none";
      equipment[lvlKey(slot.key, mi)] = d.awk === "" ? null : Number(clampAwaken(d.awk));
      equipment[talKey(slot.key, mi)] = d.tal || "none";
    }
  }
  for (let n = 0; n < PAIR_COUNT; n++) {
    equipment[`pair${n + 1}_comm1`] = pairsData[n].comm1 || "none";
    equipment[`pair${n + 1}_comm2`] = pairsData[n].comm2 || "none";
  }

  let armaments = null;
  if (armamentsRow) {
    armaments = {};
    for (const arm of ARM_SLOTS) {
      const p = arm.prefix;
      armaments[p] = armamentsRow[p] ?? "none";
      for (const k of ARM_INS_KEYS) armaments[`${p}${k}`] = armamentsRow[`${p}${k}`] ?? "none";
      for (const s of ARM_STAT_DEFS) {
        armaments[`${p}${s.nameKey}`] = armamentsRow[`${p}${s.nameKey}`] ?? "none";
        const value = armamentsRow[`${p}${s.valKey}`];
        armaments[`${p}${s.valKey}`] = isArmEmpty(value) ? null : Number(value);
      }
    }
  }

  const skins = {};
  for (let i = 0; i < SKIN_COUNT; i++) skins[`skin${i + 1}`] = skinsData[i] || "none";

  saveBtn.disabled = true;
  showSaveStatus("Saving…", "info");
  try {
    await edSaveGovernor({
      govId: safeGovId,
      name: govNameInput.value.trim(),
      equipment,
      armaments,
      skins,
      vip: vipLevel,
    });
    setGovBadge("loaded");
    showSaveStatus("✓ Governor saved.", "ok");
  } catch (e) {
    console.error("saveGovernor:", e);
    showSaveStatus("Error: " + e.message, "err");
  } finally {
    saveBtn.disabled = false;
  }
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
  }
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
const MAX_AWAKEN_LEVEL = 5;

function clampAwaken(value) {
  const text = String(value ?? "").trim();
  if (text === "") return "";
  const n = Number(text);
  if (!Number.isFinite(n)) return "";
  return String(Math.min(MAX_AWAKEN_LEVEL, Math.max(0, Math.round(n))));
}

detailAwk.max = MAX_AWAKEN_LEVEL;
detailAwk.addEventListener("input", () => {
  if (detailAwk.value !== "" && Number(detailAwk.value) > MAX_AWAKEN_LEVEL) {
    detailAwk.value = MAX_AWAKEN_LEVEL;
  } else if (detailAwk.value !== "" && Number(detailAwk.value) < 0) {
    detailAwk.value = 0;
  }
});
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
  marchData[detailTarget.marchIdx][detailTarget.slotKey].awk = clampAwaken(
    detailAwk.value,
  );
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
