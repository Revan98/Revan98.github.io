"use strict";

const DEFAULT_MARCH_COUNT = 12;
const DEFAULT_PAIR_COUNT = 12;
const DEFAULT_ARMAMENT_COUNT = 8;
const DEFAULT_SKIN_COUNT = 8;

let MARCH_COUNT = DEFAULT_MARCH_COUNT;
let PAIR_COUNT = DEFAULT_PAIR_COUNT;
let ARMAMENT_COUNT = DEFAULT_ARMAMENT_COUNT;
let SKIN_COUNT = DEFAULT_SKIN_COUNT;

let editorReady = false;
let loadTicket = 0;
let loadBlock = null;
let loadedGovernorId = null;
const databaseStatus = document.getElementById("dbStatus");

let currentMarch = 1;
let activeTab = "equipment";

const marchData = Array.from({ length: MARCH_COUNT }, () =>
  Object.fromEntries(
    EQUIPMENT_SLOTS.map((equipmentSlot) => [equipmentSlot.key, { item: "", awk: "", tal: "" }]),
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
let allCommanderNames = [];
let allSkinNames = [];


(async () => {
  buildArmamentStatRows();
  const connected = connectToDatabase();
  await loadEquipmentReferenceData();
  populateArmamentSelects();
  loadIconManifest();
  loadSkinManifest();
  await connected;
  preloadIconsFromDatabase();
})();

const loadGovernorButton = document.getElementById("loadGovBtn");
const saveButton = document.getElementById("saveBtn");
const newGovernorButton = document.getElementById("newGovBtn");
const farmImportStatus = document.getElementById("farmImportStatus");
const farmSearchInput = document.getElementById("farmSearchInput");
const farmAddNewButton = document.getElementById("farmAddNewBtn");
const farmsTableBody = document.getElementById("farmsTableBody");
const addMarchButton = document.getElementById("addMarchBtn");
const addPairButton = document.getElementById("addPairBtn");
const addArmamentButton = document.getElementById("addArmBtn");
const addSkinButton = document.getElementById("addSkinBtn");

async function connectToDatabase() {
  setDatabaseStatus("Connecting…", "");
  try {
    applyCounts(await loadEditorInitialData());
    editorReady = true;
    setDatabaseStatus("✓ Connected", "ok");
    loadGovernorButton.disabled = false;
    saveButton.disabled = false;
    newGovernorButton.disabled = false;
    updateImportButtons();
    updateAddSlotButtons();
    if (activeTab === "farmImport") renderFarmsTable();
    openGovernorFromUrl();
  } catch (event) {
    console.error(event);
    setDatabaseStatus("✗ Could not connect", "err");
    showToast("Could not connect to the database: " + event.message, "error");
  }
}

function openGovernorFromUrl() {
  const params = new URLSearchParams(location.search);
  const id = normalizeNumericId(params.get("govId") || params.get("id"));
  if (!id) return;
  governorIdInput.value = id;
  loadGovernorById(id);
}

function applyCounts(counts) {
  MARCH_COUNT = counts.march_count;
  PAIR_COUNT = counts.pair_count;
  ARMAMENT_COUNT = counts.arm_count;
  SKIN_COUNT = counts.skin_count;

  resizeDataArray(marchData, MARCH_COUNT, () =>
    Object.fromEntries(
      EQUIPMENT_SLOTS.map((equipmentSlot) => [equipmentSlot.key, { item: "", awk: "", tal: "" }]),
    ),
  );
  resizeDataArray(pairsData, PAIR_COUNT, () => ({ comm1: "", comm2: "" }));
  resizeDataArray(skinsData, SKIN_COUNT, () => "");
  rebuildArmamentSlots();

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
    const counts = await addEditorSlot(kind);
    applyCounts(counts);
    showToast(`Added ${label} ${counts[kind + "_count"]}`, "success");
  } catch (event) {
    showToast("Could not add the slot: " + event.message, "error");
  }
}
addMarchButton?.addEventListener("click", () => addSlot("march", "March"));
addPairButton?.addEventListener("click", () => addSlot("pair", "Pair Row"));
addArmamentButton?.addEventListener("click", () => addSlot("arm", "Armament Slot"));
addSkinButton?.addEventListener("click", () => addSlot("skin", "Skin Slot"));

function updateImportButtons() {
  if (farmAddNewButton) farmAddNewButton.disabled = !editorReady;
  if (farmSearchInput) farmSearchInput.disabled = !editorReady;
}

function updateAddSlotButtons() {
  [addMarchButton, addPairButton, addArmamentButton, addSkinButton].forEach((button) => {
    if (button) button.disabled = !editorReady;
  });
}

function setDatabaseStatus(message, cssClass) {
  databaseStatus.textContent = message;
  databaseStatus.className = "eq-db-status" + (cssClass ? " " + cssClass : "");
}

function setImportStatus(element, message, cssClass) {
  if (!element) return;
  element.textContent = message;
  element.className = "eq-import-status" + (cssClass ? " " + cssClass : "");
}


farmSearchInput?.addEventListener("input", () => renderFarmsTable());
farmAddNewButton?.addEventListener("click", () => {
  farmNewRowOpen = true;
  renderFarmsTable();
});

const governorIdInput = document.getElementById("govIdInput");
const governorNameInput = document.getElementById("govNameInput");
const VIP_LEVELS = Array.from({ length: 19 }, (_, index) => index + 1);
const SVIP_VALUE = 20;
let vipLevel = null;
const saveStatus = document.getElementById("saveStatus");
const governorBadge = document.getElementById("govBadge");

loadGovernorButton.addEventListener("click", loadGovernor);

const governorIdSuggestionsElement = document.getElementById("govIdSuggestions");
let governorIdActiveSuggestionIndex = -1;

function showGovernorIdSuggestions(matches) {
  governorIdActiveSuggestionIndex = -1;
  governorIdSuggestionsElement.innerHTML = matches
    .map(
      (match, index) =>
        `<div class="name-suggestion-item" data-id="${escapeHtml(match.id)}" data-idx="${index}">
      <span class="name-suggestion-name">${escapeHtml(match.name)}</span>
      <span class="name-suggestion-id">${escapeHtml(match.id)}</span>
    </div>`,
    )
    .join("");
  governorIdSuggestionsElement.style.display = "block";
  governorIdSuggestionsElement
    .querySelectorAll(".name-suggestion-item")
    .forEach((item) => {
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectGovernorIdSuggestion(item.dataset.id);
      });
    });
}

function hideGovernorIdSuggestions() {
  governorIdSuggestionsElement.style.display = "none";
  governorIdSuggestionsElement.innerHTML = "";
  governorIdActiveSuggestionIndex = -1;
}

function selectGovernorIdSuggestion(id) {
  hideGovernorIdSuggestions();
  governorIdInput.value = id;
  loadGovernor();
}

let governorSuggestTicket = 0;
governorIdInput.addEventListener("input", () => {
  if (!editorReady) return;
  const value = governorIdInput.value.trim();
  if (!value || normalizeNumericId(value) || value.length < 2) {
    hideGovernorIdSuggestions();
    return;
  }
  const ticket = ++governorSuggestTicket;
  searchGovernorsByName(value)
    .then((matches) => {
      if (ticket !== governorSuggestTicket) return;
      if (matches.length) showGovernorIdSuggestions(matches);
      else hideGovernorIdSuggestions();
    })
    .catch(() => hideGovernorIdSuggestions());
});

governorIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    if (
      governorIdSuggestionsElement.style.display !== "none" &&
      governorIdActiveSuggestionIndex >= 0
    ) {
      const items = governorIdSuggestionsElement.querySelectorAll(
        ".name-suggestion-item",
      );
      selectGovernorIdSuggestion(items[governorIdActiveSuggestionIndex].dataset.id);
      return;
    }
    hideGovernorIdSuggestions();
    loadGovernor();
    return;
  }
  if (governorIdSuggestionsElement.style.display === "none") return;
  const items = governorIdSuggestionsElement.querySelectorAll(".name-suggestion-item");
  if (!items.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    governorIdActiveSuggestionIndex = Math.min(
      governorIdActiveSuggestionIndex + 1,
      items.length - 1,
    );
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    governorIdActiveSuggestionIndex = Math.max(governorIdActiveSuggestionIndex - 1, -1);
  } else if (event.key === "Escape") {
    hideGovernorIdSuggestions();
    return;
  } else {
    return;
  }
  items.forEach((item, index) =>
    item.classList.toggle("is-active", index === governorIdActiveSuggestionIndex),
  );
  if (governorIdActiveSuggestionIndex >= 0)
    items[governorIdActiveSuggestionIndex].scrollIntoView({ block: "nearest" });
});

governorIdInput.addEventListener("blur", () => {
  setTimeout(hideGovernorIdSuggestions, 150);
});

newGovernorButton.addEventListener("click", () => {
  if (!editorReady) return;
  clearAllData();
  loadBlock = null;
  loadedGovernorId = null;
  hideGovernorIdSuggestions();
  governorIdInput.value = "";
  governorNameInput.value = "";
  vipLevel = null;
  renderVipGrid();
  setGovernorBadge("new");
  renderActiveTab();
  showSaveStatus("Fill in the Governor ID & Name, then save.", "info");
  governorIdInput.focus();
});

function clearAllData() {
  for (let marchIndex = 0; marchIndex < MARCH_COUNT; marchIndex++)
    for (const slot of EQUIPMENT_SLOTS)
      marchData[marchIndex][slot.key] = { item: "", awk: "", tal: "" };
  for (let pairIndex = 0; pairIndex < PAIR_COUNT; pairIndex++) pairsData[pairIndex] = { comm1: "", comm2: "" };
  for (let index = 0; index < SKIN_COUNT; index++) skinsData[index] = "";
  armamentsRow = null;
  vipLevel = null;
}

function setGovernorBadge(type) {
  governorBadge.className = "eq-gov-badge" + (type ? " " + type : "");
  governorBadge.textContent =
    type === "new" ? "New Governor" : type === "loaded" ? "Loaded" : "";
}

let ARMAMENT_SLOTS = [];
function rebuildArmamentSlots() {
  ARMAMENT_SLOTS = Array.from({ length: ARMAMENT_COUNT }, (_, index) => ({
    prefix: `arm${index + 1}`,
    label: `Arm ${index + 1}`,
  }));
}
rebuildArmamentSlots();

const ARMAMENT_INSCRIPTION_KEYS = [
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

function isArmamentEmpty(value) {
  if (value === null || value === undefined || value === "") return true;
  return ["none", "0"].includes(String(value).trim().toLowerCase());
}

function getArmamentTier(name) {
  const info = getInscriptionInfo(name);
  return info ? info.rarity : "gray";
}

function renderArmamentsGrid() {
  const grid = document.getElementById("armGrid");
  grid.innerHTML = "";

  for (const armament of ARMAMENT_SLOTS) {
    const name = armamentsRow ? armamentsRow[armament.prefix] : null;
    const isSlotEmpty = isArmamentEmpty(name);

    const inscriptions =
      !isSlotEmpty && armamentsRow
        ? ARMAMENT_INSCRIPTION_KEYS.map((armamentInscriptionKey) => armamentsRow[`${armament.prefix}${armamentInscriptionKey}`])
            .filter((value) => !isArmamentEmpty(value))
            .map((value) => {
              const tier = getArmamentTier(String(value));
              return `<span class="arm-ins tier-${tier}" data-tip-code="${escapeHtml(String(value).trim())}" data-tip-kind="inscription">${escapeHtml(String(value))}</span>`;
            })
            .join("")
        : "";

    const stats =
      !isSlotEmpty && armamentsRow
        ? ARMAMENT_STAT_DEFINITIONS.filter(
            (armamentStatDefinition) =>
              !isArmamentEmpty(armamentsRow[`${armament.prefix}${armamentStatDefinition.nameKey}`]) &&
              !isArmamentEmpty(armamentsRow[`${armament.prefix}${armamentStatDefinition.valKey}`]),
          )
            .map(
              (armamentStatDefinition) =>
                `<span class="eq-arm-stat-tag"><span class="eq-arm-stat-name">${escapeHtml(String(armamentsRow[`${armament.prefix}${armamentStatDefinition.nameKey}`]))}</span><span class="eq-arm-stat-val">${escapeHtml(String(armamentsRow[`${armament.prefix}${armamentStatDefinition.valKey}`]))}%</span></span>`,
            )
            .join("")
        : "";

    const slotBox = document.createElement("div");
    slotBox.className = "eq-arm-card" + (isSlotEmpty ? " eq-arm-card--empty" : "");
    slotBox.innerHTML = `
      <div class="eq-arm-header">
        <span class="eq-arm-slot-label">${escapeHtml(armament.label)}</span>
        <span class="eq-arm-name${isSlotEmpty ? " eq-arm-name--empty" : ""}">${isSlotEmpty ? "— empty —" : escapeHtml(String(name))}</span>
        <button class="eq-arm-edit-btn" title="${isSlotEmpty ? "Add armament" : "Edit armament"}">${isSlotEmpty ? "+" : "✎"}</button>
      </div>
      ${inscriptions ? `<div class="arm-ins-group">${inscriptions}</div>` : ""}
      ${stats ? `<div class="eq-arm-stats-row">${stats}</div>` : ""}
    `;
    slotBox.querySelector(".eq-arm-edit-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      openArmamentEditor(armament.prefix, armament.label);
    });
    slotBox.addEventListener("click", () =>
      openArmamentEditor(armament.prefix, armament.label),
    );
    grid.appendChild(slotBox);
  }
}

function slotColumnKey(slotKey, marchIndex) {
  const suffix = marchIndex === 0 ? "" : String(marchIndex + 1);
  return suffix ? `${slotKey}_${suffix}` : slotKey;
}
function slotLevelKey(slotKey, marchIndex) {
  const suffix = marchIndex === 0 ? "" : String(marchIndex + 1);
  return suffix ? `${slotKey}_lvl_${suffix}` : `${slotKey}_lvl`;
}
function slotTalentKey(slotKey, marchIndex) {
  const suffix = marchIndex === 0 ? "" : String(marchIndex + 1);
  return suffix ? `${slotKey}_tal_${suffix}` : `${slotKey}_tal`;
}

function isEmptyOrNone(value) {
  if (value === null || value === undefined || value === "") return true;
  return ["none", "0"].includes(String(value).trim().toLowerCase());
}

function populateMarchData(row) {
  for (let marchIndex = 0; marchIndex < MARCH_COUNT; marchIndex++)
    for (const slot of EQUIPMENT_SLOTS) {
      const item = row[slotColumnKey(slot.key, marchIndex)];
      const awaken = row[slotLevelKey(slot.key, marchIndex)];
      const talent = row[slotTalentKey(slot.key, marchIndex)];
      marchData[marchIndex][slot.key] = {
        item: isEmptyOrNone(item) ? "" : String(item),
        awk: isEmptyOrNone(awaken) ? "" : clampAwaken(awaken),
        tal: isEmptyOrNone(talent) ? "" : String(talent),
      };
    }
}

function populatePairsData(row) {
  for (let pairIndex = 0; pairIndex < PAIR_COUNT; pairIndex++) {
    const firstCommander = row[`pair${pairIndex + 1}_comm1`];
    const secondCommander = row[`pair${pairIndex + 1}_comm2`];
    pairsData[pairIndex] = {
      comm1: isEmptyOrNone(firstCommander) ? "" : String(firstCommander),
      comm2: isEmptyOrNone(secondCommander) ? "" : String(secondCommander),
    };
  }
}

async function loadGovernor() {
  if (!editorReady) return;
  const rawId = governorIdInput.value.trim();
  const safeGovernorId = normalizeNumericId(rawId);

  if (safeGovernorId) {
    await loadGovernorById(safeGovernorId);
    return;
  }
  if (!rawId) {
    showSaveStatus("Enter a Governor ID or name first.", "err");
    return;
  }

  let matches;
  try {
    matches = await searchGovernorsByName(rawId);
  } catch (event) {
    showSaveStatus("Search failed: " + event.message, "err");
    return;
  }
  if (!matches.length) {
    showSaveStatus(`No governor found matching "${rawId}".`, "err");
    return;
  }
  if (matches.length === 1) {
    governorIdInput.value = matches[0].id;
    await loadGovernorById(matches[0].id);
  } else {
    showGovernorIdSuggestions(matches);
  }
}

async function loadGovernorById(safeGovernorId) {
  if (!editorReady || !safeGovernorId) return;

  const ticket = ++loadTicket;
  clearAllData();
  governorNameInput.value = "";
  loadedGovernorId = null;
  loadBlock = "Still loading this governor, wait a moment before saving.";
  setGovernorBadge("");
  showSaveStatus("Loading…", "info");

  let data;
  try {
    data = await loadEditorGovernor(safeGovernorId);
  } catch (event) {
    console.error("loadGovernor:", event);
    if (ticket === loadTicket) {
      loadBlock = "Loading this governor failed. Reload it before saving, otherwise an empty record would overwrite it.";
      showSaveStatus("Could not load governor: " + event.message, "err");
    }
    return;
  }
  if (ticket !== loadTicket) return;
  loadBlock = null;
  loadedGovernorId = String(safeGovernorId);
  showSaveStatus("", "");

  if (data.name) governorNameInput.value = data.name;

  if (data.equipment) {
    populateMarchData(data.equipment);
    populatePairsData(data.equipment);
    setGovernorBadge("loaded");
  } else {
    setGovernorBadge("new");
    showSaveStatus("No equipment record found — starting fresh for this ID.", "info");
  }

  const vip = data.profile?.vip_level;
  vipLevel = isEmptyOrNone(vip) ? null : Number(vip);
  renderVipGrid();

  armamentsRow = data.armaments ?? null;
  for (let index = 0; index < SKIN_COUNT; index++) {
    const value = data.skins?.[`skin${index + 1}`];
    skinsData[index] = isEmptyOrNone(value) ? "" : String(value);
  }

  renderSlotGrid();
  renderPairsGrid();
  renderArmamentsGrid();
  renderSkinGrid();
}

saveButton.addEventListener("click", saveGovernor);

async function saveGovernor() {
  if (!editorReady) return;
  const safeGovernorId = normalizeNumericId(governorIdInput.value);
  if (!safeGovernorId) {
    showSaveStatus("Enter a numeric Governor ID first.", "err");
    return;
  }
  if (loadBlock) {
    showSaveStatus(loadBlock, "err");
    return;
  }
  if (loadedGovernorId && loadedGovernorId !== safeGovernorId) {
    const confirmed = confirm(
      `The editor holds the data of governor ${loadedGovernorId}, but the ID field now says ${safeGovernorId}.\n\nSaving will overwrite governor ${safeGovernorId} with that data. Continue?`,
    );
    if (!confirmed) return;
  }

  const equipment = {};
  for (let marchIndex = 0; marchIndex < MARCH_COUNT; marchIndex++) {
    for (const slot of EQUIPMENT_SLOTS) {
      const slotData = marchData[marchIndex][slot.key];
      equipment[slotColumnKey(slot.key, marchIndex)] = slotData.item || "none";
      equipment[slotLevelKey(slot.key, marchIndex)] = slotData.awk === "" ? null : Number(clampAwaken(slotData.awk));
      equipment[slotTalentKey(slot.key, marchIndex)] = slotData.tal || "none";
    }
  }
  for (let pairIndex = 0; pairIndex < PAIR_COUNT; pairIndex++) {
    equipment[`pair${pairIndex + 1}_comm1`] = pairsData[pairIndex].comm1 || "none";
    equipment[`pair${pairIndex + 1}_comm2`] = pairsData[pairIndex].comm2 || "none";
  }

  let armaments = null;
  if (armamentsRow) {
    armaments = {};
    for (const armament of ARMAMENT_SLOTS) {
      const prefix = armament.prefix;
      armaments[prefix] = armamentsRow[prefix] ?? "none";
      for (const key of ARMAMENT_INSCRIPTION_KEYS) armaments[`${prefix}${key}`] = armamentsRow[`${prefix}${key}`] ?? "none";
      for (const statDefinition of ARMAMENT_STAT_DEFINITIONS) {
        armaments[`${prefix}${statDefinition.nameKey}`] = armamentsRow[`${prefix}${statDefinition.nameKey}`] ?? "none";
        const value = armamentsRow[`${prefix}${statDefinition.valKey}`];
        armaments[`${prefix}${statDefinition.valKey}`] = isArmamentEmpty(value) ? null : Number(value);
      }
    }
  }

  const skins = {};
  for (let index = 0; index < SKIN_COUNT; index++) skins[`skin${index + 1}`] = skinsData[index] || "none";

  saveButton.disabled = true;
  showSaveStatus("Saving…", "info");
  try {
    await saveEditorGovernor({
      govId: safeGovernorId,
      name: governorNameInput.value.trim(),
      equipment,
      armaments,
      skins,
      vip: vipLevel,
    });
    loadedGovernorId = safeGovernorId;
    setGovernorBadge("loaded");
    showSaveStatus("✓ Governor saved.", "ok");
  } catch (event) {
    console.error("saveGovernor:", event);
    showSaveStatus("Error: " + event.message, "err");
  } finally {
    saveButton.disabled = false;
  }
}

function showSaveStatus(message, cssClass) {
  saveStatus.textContent = message;
  saveStatus.className = "eq-save-status" + (cssClass ? " " + cssClass : "");
  clearTimeout(saveStatus._t);
  if (message && (cssClass === "ok" || cssClass === "info"))
    saveStatus._t = setTimeout(() => {
      saveStatus.textContent = "";
      saveStatus.className = "eq-save-status";
    }, 5000);
}

document.querySelectorAll(".eq-section-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;

    document
      .querySelectorAll(".eq-section-tab")
      .forEach((sectionTab) => sectionTab.classList.toggle("active", sectionTab === button));

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
  for (let index = 1; index <= MARCH_COUNT; index++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eq-tab" + (index === currentMarch ? " active" : "");
    button.dataset.march = String(index);
    button.textContent = `March ${index}`;
    tabs.appendChild(button);
  }
}

renderMarchTabs();

document.getElementById("marchTabs").addEventListener("click", (event) => {
  const tab = event.target.closest(".eq-tab");
  if (!tab) return;
  currentMarch = Number(tab.dataset.march);
  document
    .querySelectorAll("#marchTabs .eq-tab")
    .forEach((marchTab) => marchTab.classList.toggle("active", marchTab === tab));
  renderSlotGrid();
});

let equipSelectedSlot = null;

function selectEquipSlot(slotKey) {
  const changed = slotKey !== equipSelectedSlot;
  equipSelectedSlot = slotKey;
  if (changed) {
    document.getElementById("itemsPaneSearch").value = "";
  }
  renderSlotGrid();
  if (changed) document.getElementById("itemsPaneBody").scrollTop = 0;
}

function renderEquipItemsPane() {
  const body = document.getElementById("itemsPaneBody");
  const title = document.getElementById("itemsPaneTitle");
  const search = document.getElementById("itemsPaneSearch");
  const clearButton = document.getElementById("itemsPaneClear");

  const slot = EQUIPMENT_SLOTS.find((equipmentSlot) => equipmentSlot.key === equipSelectedSlot);
  if (!slot) {
    title.textContent = "Items";
    search.value = "";
    search.disabled = true;
    clearButton.disabled = true;
    body.innerHTML = '<div class="eq-picker-empty">Select equipment slot to display items.</div>';
    return;
  }

  title.textContent = `${slot.label} · March ${currentMarch}`;
  search.disabled = false;
  clearButton.disabled = false;

  const target = { type: "equip", marchIdx: currentMarch - 1, slotKey: slot.key };
  pickerTarget = target;
  loadIconManifest();
  const scrollTop = body.scrollTop;
  renderPickerItems(search.value.trim(), body, target);
  body.scrollTop = scrollTop;
}

function renderSlotGrid() {
  const grid = document.getElementById("slotGrid");
  const marchIndex = currentMarch - 1;

  const slotsHtml = EQUIPMENT_SLOTS.map((slot) => {
    const slotData = marchData[marchIndex][slot.key];
    return renderEquipmentBox(slot, slotData.item, slotData.awk, slotData.tal, currentMarch);
  }).join("");
  grid.innerHTML = `<div class="equip-slots">${slotsHtml}</div>`;

  grid.querySelectorAll(".equip-slot").forEach((element) => {
    const slot = EQUIPMENT_SLOTS.find((equipmentSlot) => equipmentSlot.id === element.dataset.slot);
    element.classList.add("equip-slot--pick");
    element.classList.toggle("is-selected", slot.key === equipSelectedSlot);
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-label", `${slot.label} — March ${currentMarch}`);
    element.addEventListener("click", () => selectEquipSlot(slot.key));
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectEquipSlot(slot.key);
      }
    });
  });

  renderEquipItemsPane();
}

function renderPairsGrid() {
  const grid = document.getElementById("pairsGrid");
  grid.innerHTML = "";

  for (let pairIndex = 0; pairIndex < PAIR_COUNT; pairIndex++) {
    const pair = pairsData[pairIndex];
    const row = document.createElement("div");
    row.className = "eq-pair-row";
    row.innerHTML = `<span class="eq-pair-label">Pair ${pairIndex + 1}</span>`;

    for (const slot of ["comm1", "comm2"]) {
      const name = pair[slot];
      const hasCommander = !!name;
      const card = document.createElement("div");
      card.className = "eq-pair-card" + (hasCommander ? " has-item" : "");
      if (hasCommander) {
        card.dataset.tipCode = name;
        card.dataset.tipKind = "commander";
      }

      card.innerHTML = `
        <div class="eq-pair-img-box">
          ${
            hasCommander
              ? `<img src="${iconPath(name, "commander")}" alt="${escapeHtml(name)}" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <div class="eq-slot-placeholder" style="display:none;">?</div>`
              : `<div class="eq-slot-placeholder">+</div>`
          }
        </div>
        <span class="eq-pair-comm-name">${hasCommander ? escapeHtml(name) : "—"}</span>
        ${hasCommander ? `<button class="eq-pair-clear" title="Clear this commander">×</button>` : ""}`;

      card.addEventListener("click", (event) => {
        if (event.target.classList.contains("eq-pair-clear")) return;
        openPicker({ type: "pair", pairIdx: pairIndex, slot });
      });

      const clearButton = card.querySelector(".eq-pair-clear");
      if (clearButton) {
        clearButton.addEventListener("click", (event) => {
          event.stopPropagation();
          pairsData[pairIndex][slot] = "";
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

  for (let index = 0; index < SKIN_COUNT; index++) {
    const name = skinsData[index];
    const hasItem = !!name;
    const card = document.createElement("div");
    card.className = "eq-slot-card" + (hasItem ? " has-item" : "");
    if (hasItem) {
      card.dataset.tipCode = name;
      card.dataset.tipKind = "skin";
    }

    card.innerHTML = `
      <span class="eq-slot-label">Skin ${index + 1}</span>
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

    card.addEventListener("click", (event) => {
      if (event.target.classList.contains("eq-pair-clear")) return;
      openPicker({ type: "skin", skinIdx: index });
    });

    const clearButton = card.querySelector(".eq-pair-clear");
    if (clearButton) {
      clearButton.addEventListener("click", (event) => {
        event.stopPropagation();
        skinsData[index] = "";
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
    ...VIP_LEVELS.map((level) => ({ label: String(level), value: level })),
    { label: "SVIP", value: SVIP_VALUE },
  ];

  for (const { label, value } of buttons) {
    const isSelected = vipLevel === value;
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "eq-vip-btn" +
      (isSelected ? " selected" : "") +
      (value === SVIP_VALUE ? " svip" : "");
    button.textContent = label;
    button.addEventListener("click", () => {
      vipLevel = isSelected ? null : value;
      renderVipGrid();
    });
    grid.appendChild(button);
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
const pickerClearButton = document.getElementById("pickerClearBtn");
const pickerSlotLabel = document.getElementById("pickerSlotLabel");

pickerClose.addEventListener("click", closePicker);
pickerClearButton.addEventListener("click", clearPickerSlot);
pickerOverlay.addEventListener("click", (event) => {
  if (event.target === pickerOverlay) closePicker();
});
pickerSearch.addEventListener("input", () =>
  renderPickerItems(pickerSearch.value.trim()),
);

document
  .getElementById("itemsPaneSearch")
  .addEventListener("input", renderEquipItemsPane);
document.getElementById("itemsPaneClear").addEventListener("click", () => {
  if (!equipSelectedSlot) return;
  pickerTarget = { type: "equip", marchIdx: currentMarch - 1, slotKey: equipSelectedSlot };
  clearPickerSlot();
});

const detailPopup = document.getElementById("detailPopup");
const detailBackdrop = document.getElementById("detailBackdrop");
const detailImage = document.getElementById("detailImg");
const detailItemName = document.getElementById("detailItemName");
const detailAwaken = document.getElementById("detailAwk");
const MAX_AWAKEN_LEVEL = 5;

function clampAwaken(value) {
  const text = String(value ?? "").trim();
  if (text === "") return "";
  const numericValue = Number(text);
  if (!Number.isFinite(numericValue)) return "";
  return String(Math.min(MAX_AWAKEN_LEVEL, Math.max(0, Math.round(numericValue))));
}

detailAwaken.max = MAX_AWAKEN_LEVEL;
detailAwaken.addEventListener("input", () => {
  if (detailAwaken.value !== "" && Number(detailAwaken.value) > MAX_AWAKEN_LEVEL) {
    detailAwaken.value = MAX_AWAKEN_LEVEL;
  } else if (detailAwaken.value !== "" && Number(detailAwaken.value) < 0) {
    detailAwaken.value = 0;
  }
});
const detailTalent = document.getElementById("detailTal");
const detailSlotTitle = document.getElementById("detailSlotTitle");
const detailClose = document.getElementById("detailClose");
const detailConfirm = document.getElementById("detailConfirm");

let detailTarget = null;

function openDetailPopup(marchIndex, slotKey) {
  detailTarget = { marchIdx: marchIndex, slotKey };
  const slotData = marchData[marchIndex][slotKey];
  const slot = EQUIPMENT_SLOTS.find((equipmentSlot) => equipmentSlot.key === slotKey);
  detailSlotTitle.textContent = `${slot?.label ?? slotKey} — March ${marchIndex + 1}`;
  detailItemName.textContent = slotData.item;
  detailImage.src = iconPath(slotData.item, "item");
  detailImage.alt = slotData.item;
  detailImage.onerror = () => {
    detailImage.style.display = "none";
  };
  detailImage.style.display = "";
  detailAwaken.value = slotData.awk ?? "";

  const talentValue = (slotData.tal ?? "").toLowerCase();
  setTalentButton(talentValue === "yes" ? "yes" : talentValue === "no" ? "no" : "");

  detailPopup.style.display = "block";
  detailBackdrop.style.display = "block";
  detailAwaken.focus();
}

function closeDetailPopup() {
  detailPopup.style.display = "none";
  detailBackdrop.style.display = "none";
  detailTarget = null;
}

detailClose.addEventListener("click", closeDetailPopup);
detailBackdrop.addEventListener("click", closeDetailPopup);

function setTalentButton(value) {
  detailTalent.value = value;
  document
    .getElementById("talBtnYes")
    .classList.toggle("active", value === "yes");
  document.getElementById("talBtnNo").classList.toggle("active", value === "no");
}
document
  .getElementById("talBtnYes")
  .addEventListener("click", () => setTalentButton("yes"));
document
  .getElementById("talBtnNo")
  .addEventListener("click", () => setTalentButton("no"));

detailConfirm.addEventListener("click", () => {
  if (!detailTarget) return;
  marchData[detailTarget.marchIdx][detailTarget.slotKey].awk = clampAwaken(
    detailAwaken.value,
  );
  marchData[detailTarget.marchIdx][detailTarget.slotKey].tal =
    detailTalent.value.trim();
  closeDetailPopup();
  renderSlotGrid();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (document.getElementById("armModalOverlay").classList.contains("open"))
      closeArmamentEditor();
    else if (detailPopup.style.display === "block") closeDetailPopup();
    else closePicker();
  }
});

document.getElementById("armModalOverlay").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeArmamentEditor();
});
document
  .getElementById("armModalClose")
  .addEventListener("click", closeArmamentEditor);
document
  .getElementById("armModalSave")
  .addEventListener("click", saveArmamentEditor);
document.getElementById("armModalClear").addEventListener("click", () => {
  if (!armamentEditorPrefix) return;
  document.getElementById("armModalName").value = "";
  ARMAMENT_STAT_DEFINITIONS.forEach((_, index) => {
    document.getElementById(`armStatName${index}`).value = "";
    document.getElementById(`armStatVal${index}`).value = "";
  });
  ARMAMENT_INSCRIPTION_KEYS.forEach((_, index) => {
    document.getElementById(`armIns${index}`).value = "";
  });
  renderInscriptionChosenList();
  renderArmamentSetBonus();
});
document
  .getElementById("armModalName")
  .addEventListener("input", renderArmamentSetBonus);

document
  .getElementById("openInsPickerBtn")
  .addEventListener("click", openInscriptionPicker);
document
  .getElementById("insPickerClose")
  .addEventListener("click", closeInscriptionPicker);
document
  .getElementById("insPickerConfirm")
  .addEventListener("click", confirmInscriptionPicker);
document
  .getElementById("insPickerClearAll")
  .addEventListener("click", clearInscriptionPickerSelection);
document
  .getElementById("insPickerSearch")
  .addEventListener("input", (event) => renderInscriptionPickerList(event.target.value.trim()));
document.getElementById("insPickerOverlay").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeInscriptionPicker();
});
