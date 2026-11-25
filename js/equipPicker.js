const EQUIPMENT_PREFIX_MAP = {
  helm: "h",
  chest: "c",
  weapon: "w",
  gloves: "g",
  legs: "l",
  boots: "b",
  accessory: "a",
  accessory_sec: "a",
};

const EQUIPMENT_ICON_REGEX = /^[hcwglba]\d/i;

function isEquipmentIcon(name) {
  return EQUIPMENT_ICON_REGEX.test(name);
}

function iconsForSlot(slotKey) {
  const prefix = EQUIPMENT_PREFIX_MAP[slotKey];
  if (!prefix) return allIconNames;
  return allIconNames.filter((allIconName) => allIconName.charAt(0).toLowerCase() === prefix);
}

function loadIconManifest() {
  if (allIconNames.length && allCommanderNames.length) return;

  const itemKeys = Object.keys(referenceData.items || {});
  const commanderKeys = Object.keys(referenceData.commanders || {});

  if (itemKeys.length || commanderKeys.length) {
    allIconNames = itemKeys.filter((itemKey) => isEquipmentIcon(itemKey)).sort();
    allCommanderNames = commanderKeys.sort();
    return;
  }

}

function loadCommanderManifest() {
  loadIconManifest();
}

function loadSkinManifest() {
  if (allSkinNames.length) return;

  const skinKeys = Object.keys(referenceData.skins || {});
  if (skinKeys.length) {
    allSkinNames = skinKeys.sort();
    return;
  }

}

async function scrapeSkinNamesFromDatabase() {
  try {
    const names = new Set();
    for (const row of await supabaseSelectAll("skins", "select=*")) {
      for (const [column, value] of Object.entries(row)) {
        if (!/^skin\d+$/.test(column) || !value || ["none", "0"].includes(String(value).toLowerCase())) continue;
        names.add(String(value).trim());
      }
    }
    allSkinNames = [...names].sort();
  } catch (event) {
    console.warn("Could not read skin names:", event);
  }
}

function _scrapeIconsFromRows(rows) {
  try {
    if (!rows.length) return;
    const itemColumns = Object.keys(rows[0]).filter(
      (key) =>
        !key.endsWith("_lvl") &&
        !key.includes("_tal") &&
        !["player_id", "name", "acc_type"].includes(key) &&
        !key.startsWith("pair") &&
        !/_(lvl|tal)_\d+$/.test(key),
    );
    const pairColumns = new Set();
    for (const column of Object.keys(rows[0])) if (/^pair\d+_comm[12]$/.test(column)) pairColumns.add(column);

    const equipmentNames = new Set();
    const commanderNames = new Set();
    for (const row of rows.slice(0, 500)) {
      for (const column of itemColumns) {
        const value = row[column];
        if (!value || ["none", "0"].includes(String(value).toLowerCase())) continue;
        if (isEquipmentIcon(String(value).trim())) equipmentNames.add(String(value).trim());
      }
      for (const column of pairColumns) {
        const value = row[column];
        if (!value || ["none", "0"].includes(String(value).toLowerCase())) continue;
        commanderNames.add(String(value).trim());
      }
    }
    allIconNames = [...equipmentNames].sort();
    allCommanderNames = [...commanderNames].sort();
  } catch (event) {
    console.warn("icon scrape failed:", event);
  }
}
async function preloadIconsFromDatabase() {
  if (!allIconNames.length || !allCommanderNames.length) {
    try {
      _scrapeIconsFromRows(await loadAllEquipmentRows());
    } catch (event) {
      console.warn("Could not read equipment rows for icon names:", event);
    }
  }
  loadSkinManifest();
  if (!allSkinNames.length) await scrapeSkinNamesFromDatabase();
}

async function openPicker(target) {
  pickerTarget = target;
  pickerSearch.value = "";

  if (target.type === "skin") {
    pickerSlotLabel.textContent = `– Skin ${target.skinIdx + 1}`;
    pickerSelectedItem = skinsData[target.skinIdx];
    loadSkinManifest();
  } else {
    const label = target.slot === "comm1" ? "Commander 1" : "Commander 2";
    pickerSlotLabel.textContent = `– ${label} · Pair ${target.pairIdx + 1}`;
    pickerSelectedItem = pairsData[target.pairIdx][target.slot];
    loadCommanderManifest();
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
    marchData[pickerTarget.marchIdx][pickerTarget.slotKey] = {
      item: "",
      awk: "",
      tal: "",
    };
    closePicker();
    renderSlotGrid();
  } else if (pickerTarget.type === "skin") {
    skinsData[pickerTarget.skinIdx] = "";
    closePicker();
    renderSkinGrid();
  } else {
    pairsData[pickerTarget.pairIdx][pickerTarget.slot] = "";
    closePicker();
    renderPairsGrid();
  }
}

function renderPickerItems(filter, container = pickerBody, target = pickerTarget) {
  const query = filter.toLowerCase();
  const selectedItem =
    target?.type === "equip"
      ? marchData[target.marchIdx][target.slotKey].item
      : pickerSelectedItem;

  let base;
  if (target?.type === "pair") {
    base = allCommanderNames;
  } else if (target?.type === "equip") {
    base = iconsForSlot(target.slotKey);
  } else if (target?.type === "skin") {
    base = allSkinNames;
  } else {
    base = allIconNames;
  }

  const candidates = new Set(base);

  if (target?.type === "equip") {
    const prefix = EQUIPMENT_PREFIX_MAP[target.slotKey];
    for (let marchIndex = 0; marchIndex < MARCH_COUNT; marchIndex++)
      for (const slot of EQUIPMENT_SLOTS)
        if (
          marchData[marchIndex][slot.key].item &&
          (!prefix ||
            marchData[marchIndex][slot.key].item.charAt(0).toLowerCase() === prefix)
        )
          candidates.add(marchData[marchIndex][slot.key].item);
  } else if (target?.type === "pair") {
    for (let pairIndex = 0; pairIndex < PAIR_COUNT; pairIndex++) {
      if (pairsData[pairIndex].comm1) candidates.add(pairsData[pairIndex].comm1);
      if (pairsData[pairIndex].comm2) candidates.add(pairsData[pairIndex].comm2);
    }
  } else if (target?.type === "skin") {
    for (let index = 0; index < SKIN_COUNT; index++)
      if (skinsData[index]) candidates.add(skinsData[index]);
  }

  const kindForInfo =
    target?.type === "pair"
      ? "commander"
      : target?.type === "skin"
        ? "skin"
        : "item";

  const fullNameOf = (code) => {
    const info =
      kindForInfo === "commander"
        ? getCommanderInfo(code)
        : kindForInfo === "skin"
          ? getSkinInfo(code)
          : getItemInfo(code);
    return info && info.name ? String(info.name) : "";
  };

  let list = [...candidates].sort((firstCandidate, secondCandidate) => firstCandidate.localeCompare(secondCandidate));
  if (query)
    list = list.filter(
      (name) =>
        name.toLowerCase().includes(query) || fullNameOf(name).toLowerCase().includes(query),
    );

  if (!list.length) {
    container.innerHTML = `<div class="eq-picker-empty">${
      filter
        ? "No items match your search."
        : target?.type === "skin"
          ? `No skins found.<br><small>Check <code>data/skins.json</code> or load a DB with existing records.</small>`
          : `No icons found.<br><small>Check <code>data/items.json</code> / <code>data/commanders.json</code> or load a DB with existing records.</small>`
    }</div>`;
    return;
  }

  container.innerHTML = "";
  const tooltipKind =
    target?.type === "pair"
      ? "commander"
      : target?.type === "skin"
        ? "skin"
        : "item";
  for (const name of list) {
    const div = document.createElement("div");
    div.className =
      "eq-picker-item" + (name === selectedItem ? " selected" : "");
    div.dataset.tipCode = name;
    div.dataset.tipKind = tooltipKind;
    div.innerHTML = `
      <img src="${iconPath(name, tooltipKind)}" alt="${escapeHtml(name)}" loading="lazy"
           onerror="this.style.display='none'">
      <span class="eq-picker-item-name">${escapeHtml(fullNameOf(name) || name)}</span>`;
    div.addEventListener("click", () => selectPickerItem(name, target));
    container.appendChild(div);
  }
}

function selectPickerItem(name, target = pickerTarget) {
  pickerSelectedItem = name;
  closePicker();
  if (!target) return;

  if (target.type === "equip") {
    const existing = marchData[target.marchIdx][target.slotKey];
    marchData[target.marchIdx][target.slotKey] = {
      item: name,
      awk: existing.awk,
      tal: existing.tal,
    };
    renderSlotGrid();
    openDetailPopup(target.marchIdx, target.slotKey);
  } else if (target.type === "skin") {
    skinsData[target.skinIdx] = name;
    renderSkinGrid();
  } else {
    pairsData[target.pairIdx][target.slot] = name;
    renderPairsGrid();
  }
}
