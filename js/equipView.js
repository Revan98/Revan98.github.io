/* ==========================================================================
   equipView.js — the "Equipment" tab of the governor modal.
   Depends on: common.js, gameData.js, queries.js (loadGovernorEquipment/Armaments/Skins).
   ========================================================================== */

const EQUIP_SLOTS = [
  { key: "helm", label: "Helm", id: "helmet" },
  { key: "chest", label: "Chest", id: "chest" },
  { key: "weapon", label: "Weapon", id: "weapon" },
  { key: "gloves", label: "Gloves", id: "gloves" },
  { key: "legs", label: "Legs", id: "legs" },
  { key: "boots", label: "Boots", id: "boots" },
  { key: "accessory", label: "Acc.", id: "accessory" },
  { key: "accessory_sec", label: "Acc. 2", id: "accessory_sec" },
];

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
const SKIN_SLOTS = Array.from({ length: 8 }, (_, i) => `skin${i + 1}`);

function isMarchEmpty(row, suffix) {
  return EQUIP_SLOTS.every((slot) => {
    const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
    return isEmptyVal(row[colKey]);
  });
}

function getEquipmentRarity(itemName) {
  if (isEmptyVal(itemName)) return "empty";
  const name = String(itemName).trim().toLowerCase();
  if (name.endsWith("gray")) return "gray";
  if (name.endsWith("gr")) return "green";
  if (name.endsWith("g")) return "gold";
  if (name.endsWith("p")) return "purple";
  if (name.endsWith("b")) return "blue";
  return "unknown";
}

function renderSlotPlaceholderIcon(slotId) {
  const icons = {
    helmet: `<path d="M8 2.6 11 4v2.9c0 1.9-1.2 3.5-3 4.4-1.8-.9-3-2.5-3-4.4V4l3-1.4Zm-2 3.1v1l2 1.2 2-1.2v-1L8 6.9 6 5.7Zm.3 3 .7 1h2l.7-1H6.3Z"/><path opacity=".5" d="M8 2.6v4.3L6 5.7v-1L8 3.8l2 .9v1L8 6.9v4.4c-1.8-.9-3-2.5-3-4.4V4l3-1.4Z"/>`,
    chest: `<path d="M5.5 2.9 7 4.1h2l1.5-1.2 2.3 1.3-1.3 2.6-1-.4v4.3h-5V6.4l-1 .4-1.3-2.6 2.3-1.3Zm1.1 3-.5 1.4L8 8.1l1.9-.8-.5-1.4H6.6Zm-.1 2.8v1.1h3V8.7L8 9.3l-1.5-.6Z"/><path opacity=".45" d="M5.5 2.9 7 4.1 5.5 5.3v-2.4Zm5 0v2.4L9 4.1l1.5-1.2Zm-3.9 3H9.4l.4 1.1H6.2l.4-1.1Z"/>`,
    weapon: `<path d="M11.9 2.8 13.2 4l-5.6 5.6 1.1 1.1-1 1-1.1-1.1-1.5 1.5-1.2-1.2 1.5-1.5-1.1-1.1 1-1 1.1 1.1 5.5-5.6Zm-.5 2.3-3.8 3.8.5.5 3.8-3.8-.5-.5Z"/><path opacity=".45" d="M4.3 8.3 5.4 7.2l3.3 3.3-1 1-3.4-3.2Zm6.7-4.6 1.2-.9 1 .9-.9 1.2L11 3.7Z"/>`,
    gloves: `<path d="M6.1 3h1.4v4h.8V2.8h1.4V7h.7V3.6h1.3v4.1l.8.9-.6 2.4-1.6 1.1H7l-2.1-1.6-1.1-2 .9-1.1 1.4 1V3Zm.3 6-.6.5.6.9 1.1.7h2.4l.8-.6.3-1.2-.5-.6-1.9.4L6.4 9Z"/><path opacity=".45" d="M6.1 3h1.4v4H6.1V3Zm2.2-.2h1.4V7H8.3V2.8Zm1.4 6.1 1.5-.3-.2.8-1.3.5v-1Z"/>`,
    legs: `<path d="M5.2 3.2h5.6l.6 1.4-.9 3.3-.4 3.3-1.7.8L8 8.8 7.6 12l-1.7-.8-.4-3.3-.9-3.3.6-1.4Zm1.2 1.6.3 2h2.6l.3-2H6.4Zm.3 3 .3 2.3.4.2-.1-2.5h-.6Zm2 0-.1 2.5.4-.2.3-2.3h-.6Z"/><path opacity=".45" d="M6.4 4.8h3.2l-.3 1H6.7l-.3-1Zm-1 3.1 1.3-.1.3 2.3-1.1-.5-.5-1.7Zm5.2 0-.5 1.7-1.1.5.3-2.3 1.3.1Z"/>`,
    boots: `<path d="M4.7 3.3h2.7l.4 4.1-.5 1.7 1.5.8 2.8.4 1.4 1.2v1.1H3.6v-1.8l1.2-1 .2-2.9-.3-3.6Zm1.1 1.2.2 2.3-.2 3.6-.8.6v.4h6.2l-.4-.3-2.7-.4-2.2-1.3.5-1.9-.4-3H5.8Z"/><path opacity=".45" d="M9.1 3.8h2.2l.4 3.7-.5 1.4 1 .4-2.3-.3.3-1.4-.4-2.6h-.7V3.8ZM5.9 9.4l2.2 1.3 2.7.4.4.3H5l.9-2Z"/>`,
    accessory: `<path d="M8 2.5 10.2 5 8 7.5 5.8 5 8 2.5Zm0 5.8c1.8 0 3.3 1.5 3.3 3.3S9.8 14.9 8 14.9s-3.3-1.5-3.3-3.3S6.2 8.3 8 8.3Zm0 1.4c-1 0-1.9.8-1.9 1.9S7 13.5 8 13.5s1.9-.8 1.9-1.9S9 9.7 8 9.7Z"/>`,
    accessory_sec: `<path d="M5.9 2.4 7.4 4 5.9 5.7 4.4 4l1.5-1.6Zm4.2 0L11.6 4l-1.5 1.7L8.6 4l1.5-1.6ZM6.1 7.5c1.5 0 2.7 1.2 2.7 2.7s-1.2 2.7-2.7 2.7-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7Zm3.8 0c1.5 0 2.7 1.2 2.7 2.7s-1.2 2.7-2.7 2.7c-.4 0-.8-.1-1.1-.2.7-.6 1.1-1.5 1.1-2.5s-.4-1.9-1.1-2.5c.3-.1.7-.2 1.1-.2Zm-3.8 1.3c-.8 0-1.4.6-1.4 1.4s.6 1.4 1.4 1.4 1.4-.6 1.4-1.4-.6-1.4-1.4-1.4Z"/>`,
  };
  return `<svg class="equip-placeholder-icon" viewBox="0 0 16 16" aria-hidden="true">${icons[slotId] || icons.accessory}</svg>`;
}

function renderEquipBox(slot, itemName, lvl, tal, marchIdx) {
  const isEmpty = isEmptyVal(itemName);
  const imgSrc = isEmpty ? null : iconPath(itemName, "item");
  const rarity = getEquipmentRarity(itemName);
  const imgTag = imgSrc
    ? `<img src="${imgSrc}" alt="${escapeHtml(String(itemName))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;border-radius:2px;">`
    : "";
  const fallback = `<div class="equip-placeholder" style="display:${imgSrc ? "none" : "flex"};">${renderSlotPlaceholderIcon(slot.id)}</div>`;
  const tipAttrs = isEmpty
    ? ""
    : ` data-tip-code="${escapeHtml(String(itemName).trim())}" data-tip-kind="item"`;
  const roman = isEmpty ? "" : toRoman(lvl);
  const awkBadge = roman
    ? `<span class="equip-awk" title="Awakening ${roman}"><span class="equip-awk-text">${roman}</span></span>`
    : "";
  const talBadge =
    !isEmpty && hasTalent(tal)
      ? `<span class="equip-talent" title="Talent unlocked" aria-label="Talent unlocked"></span>`
      : "";
  return `
    <div class="equip-slot" id="${slot.id}_${marchIdx}" data-slot="${slot.id}">
      <div class="equip-box equip-box--framed rarity-${rarity}"${tipAttrs}>${imgTag}${fallback}</div>
      ${talBadge}${awkBadge}
    </div>`;
}

function renderPairBox(name) {
  const isEmpty = isEmptyVal(name);
  const imgSrc = isEmpty ? null : iconPath(name, "commander");
  const imgTag = imgSrc
    ? `<img src="${imgSrc}" alt="${escapeHtml(String(name))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;border-radius:2px;">`
    : "";
  const fallback = `<span style="display:${imgSrc ? "none" : "flex"};width:100%;height:100%;align-items:center;justify-content:center;font-size:9px;opacity:0.35;">—</span>`;
  const tipAttrs = isEmpty
    ? ""
    : ` data-tip-code="${escapeHtml(String(name).trim())}" data-tip-kind="commander"`;
  return `<div class="equip-box equip-pair-box${isEmpty ? " equip-pair-box--empty" : ""}"${tipAttrs}>${imgTag}${fallback}</div>`;
}

function renderPairsSection(row) {
  const PAIR_COUNT = 12;
  let pairCards = "";
  for (let n = 1; n <= PAIR_COUNT; n++) {
    const comm1 = row[`pair${n}_comm1`];
    const comm2 = row[`pair${n}_comm2`];
    if (isEmptyVal(comm1) && isEmptyVal(comm2)) continue;
    const boxes = [comm1, comm2].map((c) => renderPairBox(c)).join("");
    pairCards += `
      <div class="pair-card">

        <div class="pair-card-boxes">${boxes}</div>
      </div>`;
  }
  if (!pairCards) return "";
  return `

      <div class="pair-cards">${pairCards}</div>`;
}
function renderVipBadge(vipLevel) {
  if (isEmptyVal(vipLevel)) return "";
  const level = escapeHtml(String(vipLevel).trim());
  const label = level === "20" ? "SVIP" : `VIP ${level}`;
  return `<span class="vip-badge" title="VIP Level ${level}"><i class="fa-solid fa-crown"></i>${label}</span>`;
}

function renderSingleSkinItem(skinCode) {
  const info = getSkinInfo(skinCode);
  const displayName = info && info.name ? info.name : skinCode;
  const rarity = info && info.rarity ? String(info.rarity).toLowerCase() : "";
  const imgSrc = iconPath(skinCode, "skin");
  const imgTag = `<img src="${imgSrc}" alt="${escapeHtml(String(displayName))}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:100%;height:100%;object-fit:contain;">`;
  const fallback = `<span class="city-skin-box-fallback" style="display:none;">—</span>`;
  const tipAttrs = ` data-tip-code="${escapeHtml(String(skinCode).trim())}" data-tip-kind="skin"`;

  return `
        <div class="city-skin-item">
          <div class="city-skin-box${rarity ? " rarity-" + rarity : ""}"${tipAttrs}>${imgTag}${fallback}</div>
          <span class="city-skin-name">${escapeHtml(String(displayName))}</span>
        </div>`;
}

function renderCitySkinSection(skinsRow) {
  const owned = skinsRow
    ? SKIN_SLOTS.map((key) => skinsRow[key]).filter((v) => !isEmptyVal(v))
    : [];
  if (!owned.length) {
    return `
      <div class="city-skin-section">
        <div class="city-skin-item">
          <div class="city-skin-box">
            <span class="city-skin-box-fallback" style="display:flex;">—</span>
          </div>
          <span class="city-skin-name city-skin-name--empty">No skins set</span>
        </div>
      </div>`;
  }
  const items = owned.map((code) => renderSingleSkinItem(code)).join("");
  return `
      <div class="city-skin-section">
        ${items}
      </div>`;
}

function renderArmamentRow(armRow) {
  if (!armRow)
    return `
    <div class="equip-arm-section">
      <div class="equip-arm-label">Armaments</div>
      <div class="gov-modal-empty" style="padding:1rem 0;">No armament data found.</div>
    </div>`;

  const arms = ARM_SLOTS.map((arm) => {
    const name = armRow[arm.prefix];
    if (isEmptyVal(name)) return "";

    const insKeys = [
      "_ins",
      "_ins2",
      "_ins3",
      "_ins4",
      "_ins5",
      "_ins6",
      "_ins7",
      "_ins8",
    ];
    const inscriptions = insKeys
      .map((k) => armRow[`${arm.prefix}${k}`])
      .filter((v) => !isEmptyVal(v))
      .map((v) => {
        const tier = getAbilityTier(String(v));
        const label = String(v).trim();
        const displayLabel =
          label.length > 9 ? `${label.slice(0, 9)}...` : label;
        return `<span class="arm-ins tier-${tier}" data-tip-code="${escapeHtml(label)}" data-tip-kind="inscription">${escapeHtml(displayLabel)}</span>`;
      })
      .join("");

    const statSlots = armStatColumns(arm.prefix);
    const statsHtml = statSlots
      .filter((s) => !isEmptyVal(armRow[s.n]) && !isEmptyVal(armRow[s.v]))
      .map((s) => {
        const iconSrc = getArmStatIconPath(armRow[s.n]);
        const icon = iconSrc
          ? `<img class="arm-stat-img" src="${iconSrc}" alt="" loading="lazy" onerror="this.style.display='none'">`
          : `<i class="fa-solid fa-khanda arm-stat-icon"></i>`;
        return `<span class="arm-stat">${icon}${escapeHtml(String(armRow[s.n]))} <b>${escapeHtml(String(armRow[s.v]))}%</b></span>`;
      })
      .join("");

    const armIconSrc = iconPath(name, "armament");
    return `
      <div class="arm-card">
        <div class="arm-name" data-tip-code="${escapeHtml(String(name).trim())}" data-tip-kind="armament">
          <img class="arm-icon" src="${armIconSrc}" alt="" loading="lazy" onerror="this.style.display='none'">
          <span class="arm-name-text">${escapeHtml(String(name))}</span>
        </div>
		${inscriptions ? `<div class="arm-ins-group">${inscriptions}</div>` : ""}
		${statsHtml ? `<div class="arm-stats">${statsHtml}</div>` : ""}
      </div>`;
  })
    .filter(Boolean)
    .join("");

  return `
      <div class="arm-cards">${arms || '<div class="gov-modal-empty" style="padding:1rem 0;">No armaments set.</div>'}</div>`;
}

function renderEmptyEquipmentMarch(marchNum = 1) {
  const slotBoxes = EQUIP_SLOTS.map((slot) =>
    renderEquipBox(slot, "", "", "", marchNum),
  ).join("");
  return `
    <div class="equip-march-row equip-march-row--empty">
      <span class="equip-march-title">March ${marchNum}</span>
      <div class="equip-slots">${slotBoxes}</div>
    </div>`;
}

function renderEquipmentSection(govId) {
  const row = govId ? loadGovernorEquipment(govId) : null;
  const armRow = govId ? loadGovernorArmaments(govId) : null;
  const skinsRow = govId ? loadGovernorSkins(govId) : null;
  const citySkinHtml = renderCitySkinSection(skinsRow);

  if (!row) {
    return `<div class="equip-grid"><div class="equip-marches">${renderEmptyEquipmentMarch(1)}</div>${renderArmamentRow(armRow)}${citySkinHtml}</div>`;
  }

  const MARCH_SUFFIXES = [
    "",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
  ];
  let marchRows = "";

  MARCH_SUFFIXES.forEach((suffix, idx) => {
    const marchNum = idx + 1;
    if (isMarchEmpty(row, suffix)) return;

    const slotBoxes = EQUIP_SLOTS.map((slot) => {
      const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
      const lvlKey = suffix ? `${slot.key}_lvl_${suffix}` : `${slot.key}_lvl`;
      const talKey = suffix ? `${slot.key}_tal_${suffix}` : `${slot.key}_tal`;
      return renderEquipBox(
        slot,
        row[colKey],
        row[lvlKey],
        row[talKey],
        marchNum,
      );
    }).join("");

    marchRows += `
      <div class="equip-march-row">
        <span class="equip-march-title">Equipment ${marchNum}</span>
        <div class="equip-slots">${slotBoxes}</div>
      </div>`;
  });

  if (!marchRows) marchRows = renderEmptyEquipmentMarch(1);

  return `<div class="equip-grid"><div class="equip-marches">${marchRows}</div>${renderArmamentRow(armRow)}${renderPairsSection(row)}${citySkinHtml}</div>`;
}
