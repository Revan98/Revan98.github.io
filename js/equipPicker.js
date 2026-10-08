/* ==========================================================================
   equipPicker.js — equipment editor: icon manifests and the item / commander / skin picker.
   Load it before equipment.js (see equipment.html). Declarations only:
   everything here is called later from equipment.js handlers.
   ========================================================================== */

const EQUIP_PREFIX_MAP = {
  helm: "h",
  chest: "c",
  weapon: "w",
  gloves: "g",
  legs: "l",
  boots: "b",
  accessory: "a",
  accessory_sec: "a",
};

const EQUIP_ICON_RE = /^[hcwglba]\d/i;

function isEquipIcon(name) {
  return EQUIP_ICON_RE.test(name);
}

function iconsForSlot(slotKey) {
  const prefix = EQUIP_PREFIX_MAP[slotKey];
  if (!prefix) return allIconNames;
  return allIconNames.filter((n) => n.charAt(0).toLowerCase() === prefix);
}

function loadIconManifest() {
  if (allIconNames.length && allCommNames.length) return;

  const itemKeys = Object.keys(refData.items || {});
  const commKeys = Object.keys(refData.commanders || {});

  if (itemKeys.length || commKeys.length) {
    allIconNames = itemKeys.filter((n) => isEquipIcon(n)).sort();
    allCommNames = commKeys.sort();
    return;
  }

  if (!db) return;
  _scrapeIconsFromDb();
}

function loadCommManifest() {
  loadIconManifest();
}

function loadSkinManifest() {
  if (allSkinNames.length) return;

  const skinKeys = Object.keys(refData.skins || {});
  if (skinKeys.length) {
    allSkinNames = skinKeys.sort();
    return;
  }

  if (!db) return;
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='skins'`,
    );
    if (!t.length || !t[0].values.length) return;
    const cols = db.exec(`PRAGMA table_info(skins)`);
    if (!cols.length) return;
    const skinCols = cols[0].values
      .map((r) => r[1])
      .filter((c) => c.startsWith("skin"));
    if (!skinCols.length) return;
    const res = db.exec(`SELECT ${skinCols.join(",")} FROM skins LIMIT 500`);
    const names = new Set();
    if (res.length) {
      res[0].values.forEach((row) =>
        row.forEach((v) => {
          if (!v || ["none", "0"].includes(String(v).toLowerCase())) return;
          names.add(String(v).trim());
        }),
      );
    }
    allSkinNames = [...names].sort();
  } catch (e) {}
}

function _scrapeIconsFromDb() {
  try {
    const cols = db.exec(`PRAGMA table_info(equipment)`);
    if (!cols.length) return;
    const itemCols = cols[0].values
      .map((r) => r[1])
      .filter(
        (c) =>
          !c.endsWith("_lvl") &&
          !c.includes("_tal") &&
          !["player_id", "name", "acc_type"].includes(c) &&
          !c.startsWith("pair") &&
          !/_(lvl|tal)_\d+$/.test(c),
      );
    if (!itemCols.length) return;

    const pairCols = [];
    for (let n = 1; n <= 12; n++)
      pairCols.push(`pair${n}_comm1`, `pair${n}_comm2`);

    const equipNames = new Set();
    const commNames = new Set();

    const res = db.exec(
      `SELECT ${[...itemCols, ...pairCols].join(",")} FROM equipment LIMIT 500`,
    );
    if (res.length) {
      const allCols = res[0].columns;
      const pairSet = new Set(pairCols);
      res[0].values.forEach((row) =>
        row.forEach((v, i) => {
          if (!v || ["none", "0"].includes(String(v).toLowerCase())) return;
          const name = String(v).trim();
          if (pairSet.has(allCols[i])) {
            commNames.add(name);
          } else {
            if (isEquipIcon(name)) equipNames.add(name);
          }
        }),
      );
    }

    allIconNames = [...equipNames].sort();
    allCommNames = [...commNames].sort();
  } catch (e) {}
}

async function preloadIconsFromDb() {
  if (!allIconNames.length || !allCommNames.length) _scrapeIconsFromDb();
  loadSkinManifest();
}

async function openPicker(target) {
  pickerTarget = target;
  pickerSearch.value = "";

  if (target.type === "equip") {
    const slot = EQUIP_SLOTS.find((s) => s.key === target.slotKey);
    pickerSlotLabel.textContent = `– ${slot?.label ?? target.slotKey} · March ${target.marchIdx + 1}`;
    pickerSelectedItem = marchData[target.marchIdx][target.slotKey].item;
    loadIconManifest();
  } else if (target.type === "skin") {
    pickerSlotLabel.textContent = `– Skin ${target.skinIdx + 1}`;
    pickerSelectedItem = skinsData[target.skinIdx];
    loadSkinManifest();
  } else {
    const lbl = target.slot === "comm1" ? "Commander 1" : "Commander 2";
    pickerSlotLabel.textContent = `– ${lbl} · Pair ${target.pairIdx + 1}`;
    pickerSelectedItem = pairsData[target.pairIdx][target.slot];
    loadCommManifest();
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

function renderPickerItems(filter) {
  const q = filter.toLowerCase();

  let base;
  if (pickerTarget?.type === "pair") {
    base = allCommNames;
  } else if (pickerTarget?.type === "equip") {
    base = iconsForSlot(pickerTarget.slotKey);
  } else if (pickerTarget?.type === "skin") {
    base = allSkinNames;
  } else {
    base = allIconNames;
  }

  const candidates = new Set(base);

  if (pickerTarget?.type === "equip") {
    const prefix = EQUIP_PREFIX_MAP[pickerTarget.slotKey];
    for (let mi = 0; mi < MARCH_COUNT; mi++)
      for (const s of EQUIP_SLOTS)
        if (
          marchData[mi][s.key].item &&
          (!prefix ||
            marchData[mi][s.key].item.charAt(0).toLowerCase() === prefix)
        )
          candidates.add(marchData[mi][s.key].item);
  } else if (pickerTarget?.type === "pair") {
    for (let n = 0; n < PAIR_COUNT; n++) {
      if (pairsData[n].comm1) candidates.add(pairsData[n].comm1);
      if (pairsData[n].comm2) candidates.add(pairsData[n].comm2);
    }
  } else if (pickerTarget?.type === "skin") {
    for (let i = 0; i < SKIN_COUNT; i++)
      if (skinsData[i]) candidates.add(skinsData[i]);
  }

  const kindForInfo =
    pickerTarget?.type === "pair"
      ? "commander"
      : pickerTarget?.type === "skin"
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

  let list = [...candidates].sort((a, b) => a.localeCompare(b));
  if (q)
    list = list.filter(
      (n) =>
        n.toLowerCase().includes(q) || fullNameOf(n).toLowerCase().includes(q),
    );

  if (!list.length) {
    pickerBody.innerHTML = `<div class="eq-picker-empty">${
      filter
        ? "No items match your search."
        : pickerTarget?.type === "skin"
          ? `No skins found.<br><small>Check <code>data/skins.json</code> or load a DB with existing records.</small>`
          : `No icons found.<br><small>Check <code>data/items.json</code> / <code>data/commanders.json</code> or load a DB with existing records.</small>`
    }</div>`;
    return;
  }

  pickerBody.innerHTML = "";
  const tipKind =
    pickerTarget?.type === "pair"
      ? "commander"
      : pickerTarget?.type === "skin"
        ? "skin"
        : "item";
  for (const name of list) {
    const div = document.createElement("div");
    div.className =
      "eq-picker-item" + (name === pickerSelectedItem ? " selected" : "");
    div.dataset.tipCode = name;
    div.dataset.tipKind = tipKind;
    div.innerHTML = `
      <img src="${iconPath(name, tipKind)}" alt="${escapeHtml(name)}" loading="lazy"
           onerror="this.style.display='none'">
      <span class="eq-picker-item-name">${escapeHtml(fullNameOf(name) || name)}</span>`;
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
      item: name,
      awk: existing.awk,
      tal: existing.tal,
    };
    openDetailPopup(pickerTarget.marchIdx, pickerTarget.slotKey);
  } else if (pickerTarget.type === "skin") {
    skinsData[pickerTarget.skinIdx] = name;
    renderSkinGrid();
  } else {
    pairsData[pickerTarget.pairIdx][pickerTarget.slot] = name;
    renderPairsGrid();
  }
}
