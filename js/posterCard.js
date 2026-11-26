const POSTER_WIDTH = 860;
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

function posterRoundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function posterText(context, text, x, y, font, color, align = "center") {
  context.font = font;
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = "middle";
  context.fillText(text, x, y);
}

function posterTruncate(context, text, font, maxWidth) {
  context.font = font;
  const string = String(text ?? "");
  if (context.measureText(string).width <= maxWidth) return string;
  let truncated = string;
  while (truncated.length > 1 && context.measureText(truncated + "…").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}

function loadImageSafe(source) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function drawPosterBackground(context, width, height) {
  const grad = context.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#0b0a1e");
  grad.addColorStop(0.35, "#191340");
  grad.addColorStop(1, "#241a52");
  context.fillStyle = grad;
  context.fillRect(0, 0, width, height);

  let seed = 42;
  const nextRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  context.fillStyle = "rgba(255,255,255,0.65)";
  const starCount = Math.round((width * Math.min(height, 900)) / 6500);
  for (let index = 0; index < starCount; index++) {
    const x = nextRandom() * width;
    const y = nextRandom() * height;
    const radius = nextRandom() < 0.85 ? 1 : 1.7;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#100c28";
  context.beginPath();
  context.moveTo(0, 210);
  context.lineTo(0, 130);
  context.lineTo(width * 0.12, 95);
  context.lineTo(width * 0.24, 140);
  context.lineTo(width * 0.38, 60);
  context.lineTo(width * 0.5, 120);
  context.lineTo(width * 0.64, 70);
  context.lineTo(width * 0.78, 145);
  context.lineTo(width * 0.9, 55);
  context.lineTo(width, 100);
  context.lineTo(width, 210);
  context.closePath();
  context.globalAlpha = 0.9;
  context.fill();
  context.globalAlpha = 1;
}

function drawFrostedBox(context, x, y, width, height, radius = 12) {
  const scale = context.getTransform ? context.getTransform().a : 1;
  context.save();
  posterRoundRect(context, x, y, width, height, radius);
  context.clip();
  if ("filter" in context) {
    const pad = 8;
    context.filter = "blur(6px)";
    context.drawImage(
      context.canvas,
      (x - pad) * scale,
      (y - pad) * scale,
      (width + pad * 2) * scale,
      (height + pad * 2) * scale,
      x - pad,
      y - pad,
      width + pad * 2,
      height + pad * 2,
    );
    context.filter = "none";
  }
  const sheen = context.createLinearGradient(x, y, x, y + height);
  sheen.addColorStop(0, "rgba(255,255,255,0.14)");
  sheen.addColorStop(1, "rgba(255,255,255,0.04)");
  context.fillStyle = sheen;
  context.fillRect(x, y, width, height);
  context.restore();

  posterRoundRect(context, x + 0.5, y + 0.5, width - 1, height - 1, radius);
  context.strokeStyle = "rgba(255,255,255,0.2)";
  context.lineWidth = 1;
  context.stroke();
}

function drawIconTile(context, image, x, y, size, borderColor) {
  posterRoundRect(context, x, y, size, size, 8);
  context.fillStyle = "rgba(255,255,255,0.07)";
  context.fill();
  context.strokeStyle = borderColor || "rgba(255,255,255,0.25)";
  context.lineWidth = 1.5;
  context.stroke();
  if (image) {
    context.save();
    posterRoundRect(context, x + 2, y + 2, size - 4, size - 4, 6);
    context.clip();
    context.drawImage(image, x + 2, y + 2, size - 4, size - 4);
    context.restore();
  } else {
    posterText(
      context,
      "—",
      x + size / 2,
      y + size / 2,
      "13px sans-serif",
      "rgba(255,255,255,0.35)",
    );
  }
}

function drawPlainIcon(context, image, x, y, size) {
  if (!image) return;
  context.save();
  context.shadowColor = "rgba(0,0,0,0.55)";
  context.shadowBlur = 8;
  context.drawImage(image, x, y, size, size);
  context.restore();
}

function measurePillWidth(context, label, font) {
  context.font = font;
  return context.measureText(label).width + 20;
}

function drawArmamentCard(context, iconMap, armament, cellX, topY, cellWidth, iconSize) {
  let y = topY;

  const nameFont = "700 14px 'DM Sans', sans-serif";
  const image = iconMap.get(armament.icon);
  const iconGap = image ? 8 : 0;
  const iconWidth = image ? iconSize : 0;
  const nameString = posterTruncate(
    context,
    armament.name,
    nameFont,
    cellWidth - 12 - iconWidth - iconGap,
  );
  context.font = nameFont;
  const nameWidth = context.measureText(nameString).width;
  const startX = cellX - (iconWidth + iconGap + nameWidth) / 2;
  if (image) drawPlainIcon(context, image, startX, y, iconSize);
  posterText(
    context,
    nameString,
    startX + iconWidth + iconGap,
    y + iconSize / 2,
    nameFont,
    "#f3f1ff",
    "left",
  );
  y += iconSize + 6;

  if (armament.inscriptions.length) {
    const pillFont = "600 10px 'DM Sans', sans-serif";
    const pillHeight = 18;
    const gapX = 6;
    const gapY = 6;
    const maxWidth = cellWidth - 10;
    const pills = armament.inscriptions.map((inscription) => {
      const label = inscription.label;
      return {
        label,
        tier: inscription.tier,
        w: measurePillWidth(context, label, pillFont),
      };
    });
    const lines = [];
    let line = [];
    let lineWidth = 0;
    pills.forEach((pill) => {
      const addWidth = pill.w + (line.length ? gapX : 0);
      if (lineWidth + addWidth > maxWidth && line.length) {
        lines.push(line);
        line = [];
        lineWidth = 0;
      }
      line.push(pill);
      lineWidth += pill.w + (line.length > 1 ? gapX : 0);
    });
    if (line.length) lines.push(line);

    lines.forEach((linePills) => {
      const totalLineWidth = linePills.reduce((total, pill) => total + pill.w, 0) + gapX * (linePills.length - 1);
      let x = cellX - totalLineWidth / 2;
      linePills.forEach((pill) => {
        posterRoundRect(context, x, y, pill.w, pillHeight, pillHeight / 2);
        context.fillStyle =
          POSTER_RARITY_COLORS[pill.tier] || POSTER_RARITY_COLORS.unknown;
        context.fill();
        posterText(
          context,
          pill.label,
          x + pill.w / 2,
          y + pillHeight / 2 + 0.5,
          pillFont,
          "#0b0a1e",
        );
        x += pill.w + gapX;
      });
      y += pillHeight + gapY;
    });
    y += 2;
  }

  armament.stats.forEach((stat) => {
    const statString = posterTruncate(
      context,
      `${stat.name} +${stat.val}%`,
      "11px 'DM Sans', sans-serif",
      cellWidth - 12,
    );
    posterText(
      context,
      statString,
      cellX,
      y + 7,
      "11px 'DM Sans', sans-serif",
      "#8fe3ac",
    );
    y += 15;
  });

  return y - topY;
}

function drawEquipmentSlotIcon(context, iconMap, x, y, size, itemName, level, talent) {
  const empty = isEmptyValue(itemName);
  const rarity = getEquipmentRarityByName(itemName);
  const color = POSTER_RARITY_COLORS[rarity] || POSTER_RARITY_COLORS.unknown;
  drawIconTile(
    context,
    empty ? null : iconMap.get(iconPath(itemName, "item")),
    x,
    y,
    size,
    color,
  );
  if (!empty) {
    const roman = toRoman(level);
    if (roman) {
      const badgeWidth = Math.max(16, size * 0.42);
      const badgeHeight = 13;
      const badgeX = x + size / 2 - badgeWidth / 2;
      const badgeY = y + size - badgeHeight / 2 - 2;
      posterRoundRect(context, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
      context.fillStyle = "rgba(10,8,25,0.88)";
      context.fill();
      context.strokeStyle = "rgba(255,255,255,0.3)";
      context.lineWidth = 1;
      context.stroke();
      posterText(
        context,
        roman,
        badgeX + badgeWidth / 2,
        badgeY + badgeHeight / 2 + 0.5,
        "700 9px 'DM Sans', sans-serif",
        "#ffd76a",
      );
    }
    if (hasTalent(talent)) {
      context.beginPath();
      context.fillStyle = "#57e08c";
      context.arc(x + size - 6, y + 6, 4, 0, Math.PI * 2);
      context.fill();
    }
  }
}

const EQUIPMENT_DIAMOND_ROWS = [[0], [1], [2, 3], [4], [5, 6], [7]];

function drawEquipmentDiamond(context, iconMap, slots, centerX, topY, slotSize) {
  const gapV = 6;
  const gapHeight = 10;
  let y = topY;
  EQUIPMENT_DIAMOND_ROWS.forEach((indexRow) => {
    const rowSlots = indexRow.map((index) => slots[index]);
    const slotCount = rowSlots.length;
    const rowWidth = slotCount * slotSize + (slotCount - 1) * gapHeight;
    let x = centerX - rowWidth / 2;
    rowSlots.forEach(({ itemName, lvl: level, tal: talent }) => {
      drawEquipmentSlotIcon(context, iconMap, x, y, slotSize, itemName, level, talent);
      x += slotSize + gapHeight;
    });
    y += slotSize + gapV;
  });
  return y - gapV - topY;
}

function buildEquipmentMarches(row) {
  if (!row) return [];
  const MARCH_SUFFIXES = marchSuffixes(row);
  const marches = [];
  MARCH_SUFFIXES.forEach((suffix, index) => {
    if (isMarchEmpty(row, suffix)) return;
    const slots = EQUIPMENT_SLOTS.map((slot) => {
      const slotColumnKey = suffix ? `${slot.key}_${suffix}` : slot.key;
      const slotLevelKey = suffix ? `${slot.key}_lvl_${suffix}` : `${slot.key}_lvl`;
      const slotTalentKey = suffix ? `${slot.key}_tal_${suffix}` : `${slot.key}_tal`;
      return { itemName: row[slotColumnKey], lvl: row[slotLevelKey], tal: row[slotTalentKey] };
    });
    marches.push({ marchNum: index + 1, slots });
  });
  return marches;
}

function buildArmamentsList(armamentRow) {
  if (!armamentRow) return [];
  const list = [];
  armamentSlotsFor(armamentRow).forEach((armament) => {
    const name = armamentRow[armament.prefix];
    if (isEmptyValue(name)) return;
    const inscriptionKeys = [
      "_ins",
      "_ins2",
      "_ins3",
      "_ins4",
      "_ins5",
      "_ins6",
      "_ins7",
      "_ins8",
    ];
    const inscriptions = inscriptionKeys
      .map((inscriptionKey) => armamentRow[`${armament.prefix}${inscriptionKey}`])
      .filter((value) => !isEmptyValue(value))
      .map((value) => ({
        label: String(value).trim(),
        tier: getAbilityTier(String(value)),
      }));
    const stats = armamentStatColumns(armament.prefix)
      .filter((stat) => !isEmptyValue(armamentRow[stat.n]) && !isEmptyValue(armamentRow[stat.v]))
      .map((stat) => ({ name: String(armamentRow[stat.n]), val: String(armamentRow[stat.v]) }));
    list.push({
      name: String(name),
      icon: iconPath(name, "armament"),
      inscriptions,
      stats,
    });
  });
  return list;
}

function buildPairsList(row) {
  if (!row) return [];
  const pairs = [];
  for (let pairNumber = 1; pairNumber <= pairCount(row); pairNumber++) {
    const firstCommander = row[`pair${pairNumber}_comm1`];
    const secondCommander = row[`pair${pairNumber}_comm2`];
    if (isEmptyValue(firstCommander) && isEmptyValue(secondCommander)) continue;
    pairs.push([firstCommander, secondCommander]);
  }
  return pairs;
}

function buildSkinsList(skinsRow) {
  if (!skinsRow) return [];
  return skinKeysFor(skinsRow).map((key) => skinsRow[key]).filter((value) => !isEmptyValue(value));
}

function renderPosterContent(context, data, iconMap, width) {
  const { scan, profile, ch: cityHallLevel, accType: accountType, marches, armaments, pairs, skins } = data;
  const padX = POSTER_PAD_X;
  const contentWidth = width - padX * 2;
  const centerX = width / 2;
  let y = 36;

  posterText(
    context,
    data.name,
    centerX,
    y + 26,
    "700 26px 'DM Sans', sans-serif",
    "#f3f1ff",
  );
  posterText(context, `ID ${data.govId}`, centerX, y + 52, "13px monospace", "#b9a8f5");
  const badgeParts = [];
  if (profile?.vip_level && !isEmptyValue(profile.vip_level)) {
    badgeParts.push(
      String(profile.vip_level) === "20" ? "SVIP" : `VIP ${profile.vip_level}`,
    );
  }
  if (cityHallLevel) badgeParts.push(`CH ${cityHallLevel}`);
  if (accountType === "farm") badgeParts.push("Farm Account");
  if (accountType === "main") badgeParts.push("Main Account");
  if (badgeParts.length) {
    posterText(
      context,
      badgeParts.join("   ·   "),
      centerX,
      y + 80,
      "600 13px 'DM Sans', sans-serif",
      "#8fe3ac",
    );
  }
  y += 116;

  context.strokeStyle = "rgba(255,255,255,0.14)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(centerX - 230, y);
  context.lineTo(centerX + 230, y);
  context.stroke();
  y += 26;

  if (scan) {
    const stats = [
      ["Power", formatNumber(scan.power)],
      ["Kill Points", formatNumber(scan.killPoints)],
      ["Deaths", formatNumber(scan.deaths)],
      ["Ranged Points", formatNumber(scan.rangedPoints)],
      ["T1", formatNumber(scan.t1)],
      ["T2", formatNumber(scan.t2)],
      ["T3", formatNumber(scan.t3)],
      ["T4", formatNumber(scan.t4)],
      ["T5", formatNumber(scan.t5)],
      ["RSS Gathered", formatNumber(scan.rssGathered)],
      ["RSS Assistance", formatNumber(scan.rssAssistance)],
      ["Helps", formatNumber(scan.helps)],
      ["Acclaim", formatNumber(scan.acclaim)],
    ];
    const statColumns = 4;
    const boxGap = 12;
    const boxHeight = 56;
    const boxWidth = (contentWidth - boxGap * (statColumns - 1)) / statColumns;
    for (let start = 0; start < stats.length; start += statColumns) {
      const rowStats = stats.slice(start, start + statColumns);
      const rowWidth = rowStats.length * boxWidth + (rowStats.length - 1) * boxGap;
      let boxX = padX + (contentWidth - rowWidth) / 2;
      rowStats.forEach(([label, value]) => {
        drawFrostedBox(context, boxX, y, boxWidth, boxHeight);
        posterText(
          context,
          label,
          boxX + boxWidth / 2,
          y + 18,
          "600 12px 'DM Sans', sans-serif",
          "#b9a8f5",
        );
        posterText(
          context,
          value,
          boxX + boxWidth / 2,
          y + 39,
          "700 17px 'DM Sans', sans-serif",
          "#f3f1ff",
        );
        boxX += boxWidth + boxGap;
      });
      y += boxHeight + boxGap;
    }
    posterText(
      context,
      `Snapshot · ${data.snapDate}`,
      width - padX,
      y + 6,
      "11px 'DM Sans', sans-serif",
      "rgba(185,168,245,0.7)",
      "right",
    );
    y += 30;
  } else {
    posterText(
      context,
      "No live scan data available.",
      centerX,
      y + 20,
      "14px 'DM Sans', sans-serif",
      "rgba(255,255,255,0.55)",
    );
    y += 46;
  }

  y += 16;

  y += 26;
  if (!marches.length) {
    posterText(
      context,
      "No equipment set.",
      centerX,
      y + 12,
      "13px 'DM Sans', sans-serif",
      "rgba(255,255,255,0.5)",
    );
    y += 30;
  } else {
    const slotSize = 42;
    const columnsPerRow = Math.min(marches.length, 4);
    const columnWidth = contentWidth / columnsPerRow;
    for (let index = 0; index < marches.length; index += columnsPerRow) {
      const rowMarches = marches.slice(index, index + columnsPerRow);
      let maxColumnHeight = 0;
      rowMarches.forEach((march, columnIndex) => {
        const columnCenterX = padX + columnWidth * columnIndex + columnWidth / 2;
        posterText(
          context,
          `Equipment ${march.marchNum}`,
          columnCenterX,
          y + 8,
          "600 12px 'DM Sans', sans-serif",
          "#b9a8f5",
        );
        const columnHeight = drawEquipmentDiamond(
          context,
          iconMap,
          march.slots,
          columnCenterX,
          y + 24,
          slotSize,
        );
        maxColumnHeight = Math.max(maxColumnHeight, columnHeight);
      });
      y += 24 + maxColumnHeight + 26;
    }
  }

  y += 16;

  y += 16;
  if (!armaments.length) {
    posterText(
      context,
      "No armaments set.",
      centerX,
      y + 12,
      "13px 'DM Sans', sans-serif",
      "rgba(255,255,255,0.5)",
    );
    y += 30;
  } else {
    const columns = 4;
    const cellWidth = contentWidth / columns;
    const iconSize = 30;
    const rowGap = 14;
    for (let index = 0; index < armaments.length; index += columns) {
      const rowArms = armaments.slice(index, index + columns);
      let maxHeight = 0;
      rowArms.forEach((armament, columnIndex) => {
        const cellX = padX + cellWidth * columnIndex + cellWidth / 2;
        const cardHeight = drawArmamentCard(context, iconMap, armament, cellX, y, cellWidth, iconSize);
        maxHeight = Math.max(maxHeight, cardHeight);
      });
      y += maxHeight + rowGap;
    }
  }

  y += 16;

  y += 26;
  if (!pairs.length) {
    posterText(
      context,
      "No commander pairs set.",
      centerX,
      y + 12,
      "13px 'DM Sans', sans-serif",
      "rgba(255,255,255,0.5)",
    );
    y += 30;
  } else {
    const columns = 5;
    const cellWidth = contentWidth / columns;
    const iconSize = 58;
    const boxGap = 8;
    const rowStep = 96;
    pairs.forEach(([firstCommander, secondCommander], index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cellX = padX + cellWidth * column + cellWidth / 2;
      const cellY = y + row * rowStep;
      const totalWidth = iconSize * 2 + boxGap;
      let rowStartX = cellX - totalWidth / 2;
      [firstCommander, secondCommander].forEach((commander) => {
        const empty = isEmptyValue(commander);
        drawIconTile(
          context,
          empty ? null : iconMap.get(iconPath(commander, "commander")),
          rowStartX,
          cellY,
          iconSize,
          "#3a2f66",
        );
        rowStartX += iconSize + boxGap;
      });
    });
    y += Math.ceil(pairs.length / columns) * rowStep;
  }

  y += 16;

  y += 26;
  if (!skins.length) {
    posterText(
      context,
      "No skins set.",
      centerX,
      y + 12,
      "13px 'DM Sans', sans-serif",
      "rgba(255,255,255,0.5)",
    );
    y += 30;
  } else {
    const columns = 5;
    const cellWidth = contentWidth / columns;
    const iconSize = 76;
    const rowStep = 122;
    skins.forEach((code, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cellX = padX + cellWidth * column + cellWidth / 2;
      const cellY = y + row * rowStep;
      drawIconTile(
        context,
        iconMap.get(iconPath(code, "skin")),
        cellX - iconSize / 2,
        cellY,
        iconSize,
        "#e0b23c",
      );
      const info = getSkinInfo(code);
      const label = posterTruncate(
        context,
        (info && info.name) || code,
        "600 13px 'DM Sans', sans-serif",
        cellWidth - 12,
      );
      posterText(
        context,
        label,
        cellX,
        cellY + iconSize + 16,
        "600 13px 'DM Sans', sans-serif",
        "#f3f1ff",
      );
    });
    y += Math.ceil(skins.length / columns) * rowStep;
  }

  y += 30;
  return y;
}

async function buildStatPosterDataUrl(governorId) {
  const scan = loadScanStats(governorId);
  const profile = loadPlayerProfile(governorId);
  const cityHallLevel = loadCityHallLevel(governorId);
  const accountType = getAccountType(governorId);
  const equipmentRow = loadGovernorEquipment(governorId);
  const armamentRow = loadGovernorArmaments(governorId);
  const skinsRow = loadGovernorSkins(governorId);

  const marches = buildEquipmentMarches(equipmentRow);
  const armaments = buildArmamentsList(armamentRow);
  const pairs = buildPairsList(equipmentRow);
  const skins = buildSkinsList(skinsRow);

  const iconSrcs = new Set();
  marches.forEach((march) =>
    march.slots.forEach(({ itemName }) => {
      if (!isEmptyValue(itemName)) iconSrcs.add(iconPath(itemName, "item"));
    }),
  );
  armaments.forEach((armament) => iconSrcs.add(armament.icon));
  pairs.forEach(([firstCommander, secondCommander]) =>
    [firstCommander, secondCommander].forEach((commander) => {
      if (!isEmptyValue(commander)) iconSrcs.add(iconPath(commander, "commander"));
    }),
  );
  skins.forEach((skin) => iconSrcs.add(iconPath(skin, "skin")));

  const iconMap = new Map();
  await Promise.all(
    [...iconSrcs].map(async (source) => {
      iconMap.set(source, await loadImageSafe(source));
    }),
  );

  const data = {
    name: (scan && scan.name) || String(governorId),
    govId: String(governorId),
    snapDate: scan ? scan.snapDate : "",
    scan,
    profile,
    ch: cityHallLevel,
    accType: accountType,
    marches,
    armaments,
    pairs,
    skins,
  };

  const posterWidth = POSTER_WIDTH;
  const scratch = document.createElement("canvas");
  scratch.width = posterWidth;
  scratch.height = 8000;
  const measuredHeight = renderPosterContent(
    scratch.getContext("2d"),
    data,
    iconMap,
    posterWidth,
  );

  const SCALE = 2;

  const canvas = document.createElement("canvas");
  canvas.width = posterWidth * SCALE;
  canvas.height = Math.ceil(measuredHeight) * SCALE;
  const context = canvas.getContext("2d");
  context.scale(SCALE, SCALE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawPosterBackground(context, posterWidth, Math.ceil(measuredHeight));
  renderPosterContent(context, data, iconMap, posterWidth);

  return canvas.toDataURL("image/png");
}
