/* ==========================================================================
   posterCard.js — draws the shareable stat-poster image (canvas) for a governor.
   Depends on: common.js, queries.js, gameData.js, and the data helpers in
   playercard.js (EQUIP_SLOTS, loadGovernorInfo, loadScanStats, ...), which are
   only used when buildStatPosterDataUrl() runs, long after both files loaded.
   ========================================================================== */

const POSTER_W = 860;
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

function posterRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function posterText(ctx, text, x, y, font, color, align = "center") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function posterTruncate(ctx, text, font, maxWidth) {
  ctx.font = font;
  const str = String(text ?? "");
  if (ctx.measureText(str).width <= maxWidth) return str;
  let t = str;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function loadImageSafe(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawPosterBackground(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0b0a1e");
  grad.addColorStop(0.35, "#191340");
  grad.addColorStop(1, "#241a52");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  let seed = 42;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  const starCount = Math.round((w * Math.min(h, 900)) / 6500);
  for (let i = 0; i < starCount; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = rnd() < 0.85 ? 1 : 1.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#100c28";
  ctx.beginPath();
  ctx.moveTo(0, 210);
  ctx.lineTo(0, 130);
  ctx.lineTo(w * 0.12, 95);
  ctx.lineTo(w * 0.24, 140);
  ctx.lineTo(w * 0.38, 60);
  ctx.lineTo(w * 0.5, 120);
  ctx.lineTo(w * 0.64, 70);
  ctx.lineTo(w * 0.78, 145);
  ctx.lineTo(w * 0.9, 55);
  ctx.lineTo(w, 100);
  ctx.lineTo(w, 210);
  ctx.closePath();
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawIconTile(ctx, img, x, y, size, borderColor) {
  posterRoundRect(ctx, x, y, size, size, 8);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.strokeStyle = borderColor || "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (img) {
    ctx.save();
    posterRoundRect(ctx, x + 2, y + 2, size - 4, size - 4, 6);
    ctx.clip();
    ctx.drawImage(img, x + 2, y + 2, size - 4, size - 4);
    ctx.restore();
  } else {
    posterText(
      ctx,
      "—",
      x + size / 2,
      y + size / 2,
      "13px sans-serif",
      "rgba(255,255,255,0.35)",
    );
  }
}

function drawPlainIcon(ctx, img, x, y, size) {
  if (!img) return;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 8;
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function measurePillWidth(ctx, label, font) {
  ctx.font = font;
  return ctx.measureText(label).width + 20;
}

function drawArmamentCard(ctx, iconMap, a, cellX, topY, cellW, iconSize) {
  let y = topY;

  const nameFont = "700 14px 'DM Sans', sans-serif";
  const img = iconMap.get(a.icon);
  const iconGap = img ? 8 : 0;
  const iconW = img ? iconSize : 0;
  const nameStr = posterTruncate(
    ctx,
    a.name,
    nameFont,
    cellW - 12 - iconW - iconGap,
  );
  ctx.font = nameFont;
  const nameW = ctx.measureText(nameStr).width;
  const startX = cellX - (iconW + iconGap + nameW) / 2;
  if (img) drawPlainIcon(ctx, img, startX, y, iconSize);
  posterText(
    ctx,
    nameStr,
    startX + iconW + iconGap,
    y + iconSize / 2,
    nameFont,
    "#f3f1ff",
    "left",
  );
  y += iconSize + 6;

  if (a.inscriptions.length) {
    const pillFont = "600 10px 'DM Sans', sans-serif";
    const pillH = 18;
    const gapX = 6;
    const gapY = 6;
    const maxW = cellW - 10;
    const pills = a.inscriptions.map((ins) => {
      const label = ins.label;
      return {
        label,
        tier: ins.tier,
        w: measurePillWidth(ctx, label, pillFont),
      };
    });
    const lines = [];
    let line = [];
    let lineW = 0;
    pills.forEach((p) => {
      const addW = p.w + (line.length ? gapX : 0);
      if (lineW + addW > maxW && line.length) {
        lines.push(line);
        line = [];
        lineW = 0;
      }
      line.push(p);
      lineW += p.w + (line.length > 1 ? gapX : 0);
    });
    if (line.length) lines.push(line);

    lines.forEach((ln) => {
      const w = ln.reduce((s, p) => s + p.w, 0) + gapX * (ln.length - 1);
      let x = cellX - w / 2;
      ln.forEach((p) => {
        posterRoundRect(ctx, x, y, p.w, pillH, pillH / 2);
        ctx.fillStyle =
          POSTER_RARITY_COLORS[p.tier] || POSTER_RARITY_COLORS.unknown;
        ctx.fill();
        posterText(
          ctx,
          p.label,
          x + p.w / 2,
          y + pillH / 2 + 0.5,
          pillFont,
          "#0b0a1e",
        );
        x += p.w + gapX;
      });
      y += pillH + gapY;
    });
    y += 2;
  }

  a.stats.forEach((s) => {
    const statStr = posterTruncate(
      ctx,
      `${s.name} +${s.val}%`,
      "11px 'DM Sans', sans-serif",
      cellW - 12,
    );
    posterText(
      ctx,
      statStr,
      cellX,
      y + 7,
      "11px 'DM Sans', sans-serif",
      "#8fe3ac",
    );
    y += 15;
  });

  return y - topY;
}

function drawEquipSlotIcon(ctx, iconMap, x, y, size, itemName, lvl, tal) {
  const empty = isEmptyVal(itemName);
  const rarity = getEquipRarity(itemName);
  const color = POSTER_RARITY_COLORS[rarity] || POSTER_RARITY_COLORS.unknown;
  drawIconTile(
    ctx,
    empty ? null : iconMap.get(iconPath(itemName, "item")),
    x,
    y,
    size,
    color,
  );
  if (!empty) {
    const roman = toRoman(lvl);
    if (roman) {
      const badgeW = Math.max(16, size * 0.42);
      const badgeH = 13;
      const bx = x + size / 2 - badgeW / 2;
      const by = y + size - badgeH / 2 - 2;
      posterRoundRect(ctx, bx, by, badgeW, badgeH, badgeH / 2);
      ctx.fillStyle = "rgba(10,8,25,0.88)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      posterText(
        ctx,
        roman,
        bx + badgeW / 2,
        by + badgeH / 2 + 0.5,
        "700 9px 'DM Sans', sans-serif",
        "#ffd76a",
      );
    }
    if (hasTalent(tal)) {
      ctx.beginPath();
      ctx.fillStyle = "#57e08c";
      ctx.arc(x + size - 6, y + 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const EQUIP_DIAMOND_ROWS = [[0], [1], [2, 3], [4], [5, 6], [7]];

function drawEquipDiamond(ctx, iconMap, slots, centerX, topY, slotSize) {
  const gapV = 6;
  const gapH = 10;
  let y = topY;
  EQUIP_DIAMOND_ROWS.forEach((idxRow) => {
    const rowSlots = idxRow.map((i) => slots[i]);
    const n = rowSlots.length;
    const rowW = n * slotSize + (n - 1) * gapH;
    let x = centerX - rowW / 2;
    rowSlots.forEach(({ itemName, lvl, tal }) => {
      drawEquipSlotIcon(ctx, iconMap, x, y, slotSize, itemName, lvl, tal);
      x += slotSize + gapH;
    });
    y += slotSize + gapV;
  });
  return y - gapV - topY;
}

function buildEquipmentMarches(row) {
  if (!row) return [];
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
  const marches = [];
  MARCH_SUFFIXES.forEach((suffix, idx) => {
    if (isMarchEmpty(row, suffix)) return;
    const slots = EQUIP_SLOTS.map((slot) => {
      const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
      const lvlKey = suffix ? `${slot.key}_lvl_${suffix}` : `${slot.key}_lvl`;
      const talKey = suffix ? `${slot.key}_tal_${suffix}` : `${slot.key}_tal`;
      return { itemName: row[colKey], lvl: row[lvlKey], tal: row[talKey] };
    });
    marches.push({ marchNum: idx + 1, slots });
  });
  return marches;
}

function buildArmamentsList(armRow) {
  if (!armRow) return [];
  const list = [];
  ARM_SLOTS.forEach((arm) => {
    const name = armRow[arm.prefix];
    if (isEmptyVal(name)) return;
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
      .map((v) => ({
        label: String(v).trim(),
        tier: getAbilityTier(String(v)),
      }));
    const stats = armStatColumns(arm.prefix)
      .filter((s) => !isEmptyVal(armRow[s.n]) && !isEmptyVal(armRow[s.v]))
      .map((s) => ({ name: String(armRow[s.n]), val: String(armRow[s.v]) }));
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
  for (let n = 1; n <= 12; n++) {
    const c1 = row[`pair${n}_comm1`];
    const c2 = row[`pair${n}_comm2`];
    if (isEmptyVal(c1) && isEmptyVal(c2)) continue;
    pairs.push([c1, c2]);
  }
  return pairs;
}

function buildSkinsList(skinsRow) {
  if (!skinsRow) return [];
  return SKIN_SLOTS.map((k) => skinsRow[k]).filter((v) => !isEmptyVal(v));
}

function renderPosterContent(ctx, data, iconMap, W) {
  const { scan, profile, ch, accType, marches, armaments, pairs, skins } = data;
  const padX = POSTER_PAD_X;
  const contentW = W - padX * 2;
  const cx = W / 2;
  let y = 36;

  posterText(
    ctx,
    data.name,
    cx,
    y + 26,
    "700 26px 'DM Sans', sans-serif",
    "#f3f1ff",
  );
  posterText(ctx, `ID ${data.govId}`, cx, y + 52, "13px monospace", "#b9a8f5");
  const badgeParts = [];
  if (profile?.vip_level && !isEmptyVal(profile.vip_level)) {
    badgeParts.push(
      String(profile.vip_level) === "20" ? "SVIP" : `VIP ${profile.vip_level}`,
    );
  }
  if (ch) badgeParts.push(`CH ${ch}`);
  if (accType === "farm") badgeParts.push("Farm Account");
  if (accType === "main") badgeParts.push("Main Account");
  if (badgeParts.length) {
    posterText(
      ctx,
      badgeParts.join("   ·   "),
      cx,
      y + 80,
      "600 13px 'DM Sans', sans-serif",
      "#8fe3ac",
    );
  }
  y += 116;

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 230, y);
  ctx.lineTo(cx + 230, y);
  ctx.stroke();
  y += 26;

  if (scan) {
    const rows = [
      [
        ["Power", formatNumber(scan.power)],
        ["Kill Points", formatNumber(scan.killPoints)],
        ["Deaths", formatNumber(scan.deaths)],
        ["Ranged Points", formatNumber(scan.rangedPoints)],
      ],
      [
        ["T1", formatNumber(scan.t1)],
        ["T2", formatNumber(scan.t2)],
        ["T3", formatNumber(scan.t3)],
        ["T4", formatNumber(scan.t4)],
        ["T5", formatNumber(scan.t5)],
      ],
      [
        ["RSS Gathered", formatNumber(scan.rssGathered)],
        ["RSS Assistance", formatNumber(scan.rssAssistance)],
        ["Helps", formatNumber(scan.helps)],
        ["Acclaim", formatNumber(scan.acclaim)],
      ],
    ];
    rows.forEach((items) => {
      const itemW = contentW / items.length;
      const startX = padX + itemW / 2;
      items.forEach(([label, value], i) => {
        const x = startX + i * itemW;
        posterText(
          ctx,
          label,
          x,
          y + 13,
          "600 12px 'DM Sans', sans-serif",
          "#b9a8f5",
        );
        posterText(
          ctx,
          value,
          x,
          y + 35,
          "700 16px 'DM Sans', sans-serif",
          "#f3f1ff",
        );
      });
      y += 52;
    });
    posterText(
      ctx,
      `Snapshot · ${data.snapDate}`,
      W - padX,
      y + 6,
      "11px 'DM Sans', sans-serif",
      "rgba(185,168,245,0.7)",
      "right",
    );
    y += 30;
  } else {
    posterText(
      ctx,
      "No live scan data available.",
      cx,
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
      ctx,
      "No equipment set.",
      cx,
      y + 12,
      "13px 'DM Sans', sans-serif",
      "rgba(255,255,255,0.5)",
    );
    y += 30;
  } else {
    const slotSize = 42;
    const colsPerRow = Math.min(marches.length, 4);
    const colW = contentW / colsPerRow;
    for (let i = 0; i < marches.length; i += colsPerRow) {
      const rowMarches = marches.slice(i, i + colsPerRow);
      let maxColHeight = 0;
      rowMarches.forEach((m, ci) => {
        const colCenterX = padX + colW * ci + colW / 2;
        posterText(
          ctx,
          `Equipment ${m.marchNum}`,
          colCenterX,
          y + 8,
          "600 12px 'DM Sans', sans-serif",
          "#b9a8f5",
        );
        const colH = drawEquipDiamond(
          ctx,
          iconMap,
          m.slots,
          colCenterX,
          y + 24,
          slotSize,
        );
        maxColHeight = Math.max(maxColHeight, colH);
      });
      y += 24 + maxColHeight + 26;
    }
  }

  y += 16;

  y += 16;
  if (!armaments.length) {
    posterText(
      ctx,
      "No armaments set.",
      cx,
      y + 12,
      "13px 'DM Sans', sans-serif",
      "rgba(255,255,255,0.5)",
    );
    y += 30;
  } else {
    const cols = 4;
    const cellW = contentW / cols;
    const iconSize = 30;
    const rowGap = 14;
    for (let i = 0; i < armaments.length; i += cols) {
      const rowArms = armaments.slice(i, i + cols);
      let maxH = 0;
      rowArms.forEach((a, ci) => {
        const cellX = padX + cellW * ci + cellW / 2;
        const h = drawArmamentCard(ctx, iconMap, a, cellX, y, cellW, iconSize);
        maxH = Math.max(maxH, h);
      });
      y += maxH + rowGap;
    }
  }

  y += 16;

  y += 26;
  if (!pairs.length) {
    posterText(
      ctx,
      "No commander pairs set.",
      cx,
      y + 12,
      "13px 'DM Sans', sans-serif",
      "rgba(255,255,255,0.5)",
    );
    y += 30;
  } else {
    const cols = 5;
    const cellW = contentW / cols;
    const iconSize = 58;
    const boxGap = 8;
    const rowStep = 96;
    pairs.forEach(([c1, c2], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = padX + cellW * col + cellW / 2;
      const cellY = y + row * rowStep;
      const totalW = iconSize * 2 + boxGap;
      let x0 = cellX - totalW / 2;
      [c1, c2].forEach((c) => {
        const empty = isEmptyVal(c);
        drawIconTile(
          ctx,
          empty ? null : iconMap.get(iconPath(c, "commander")),
          x0,
          cellY,
          iconSize,
          "#3a2f66",
        );
        x0 += iconSize + boxGap;
      });
    });
    y += Math.ceil(pairs.length / cols) * rowStep;
  }

  y += 16;

  y += 26;
  if (!skins.length) {
    posterText(
      ctx,
      "No skins set.",
      cx,
      y + 12,
      "13px 'DM Sans', sans-serif",
      "rgba(255,255,255,0.5)",
    );
    y += 30;
  } else {
    const cols = 5;
    const cellW = contentW / cols;
    const iconSize = 76;
    const rowStep = 122;
    skins.forEach((code, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = padX + cellW * col + cellW / 2;
      const cellY = y + row * rowStep;
      drawIconTile(
        ctx,
        iconMap.get(iconPath(code, "skin")),
        cellX - iconSize / 2,
        cellY,
        iconSize,
        "#e0b23c",
      );
      const info = getSkinInfo(code);
      const label = posterTruncate(
        ctx,
        (info && info.name) || code,
        "600 13px 'DM Sans', sans-serif",
        cellW - 12,
      );
      posterText(
        ctx,
        label,
        cellX,
        cellY + iconSize + 16,
        "600 13px 'DM Sans', sans-serif",
        "#f3f1ff",
      );
    });
    y += Math.ceil(skins.length / cols) * rowStep;
  }

  y += 30;
  return y;
}

async function buildStatPosterDataUrl(govId) {
  const scan = loadScanStats(govId);
  const profile = loadPlayerProfile(govId);
  const ch = loadCH(govId);
  const accType = getAccType(govId);
  const equipRow = loadGovernorEquipment(govId);
  const armRow = loadGovernorArmaments(govId);
  const skinsRow = loadGovernorSkins(govId);

  const marches = buildEquipmentMarches(equipRow);
  const armaments = buildArmamentsList(armRow);
  const pairs = buildPairsList(equipRow);
  const skins = buildSkinsList(skinsRow);

  const iconSrcs = new Set();
  marches.forEach((m) =>
    m.slots.forEach(({ itemName }) => {
      if (!isEmptyVal(itemName)) iconSrcs.add(iconPath(itemName, "item"));
    }),
  );
  armaments.forEach((a) => iconSrcs.add(a.icon));
  pairs.forEach(([c1, c2]) =>
    [c1, c2].forEach((c) => {
      if (!isEmptyVal(c)) iconSrcs.add(iconPath(c, "commander"));
    }),
  );
  skins.forEach((s) => iconSrcs.add(iconPath(s, "skin")));

  const iconMap = new Map();
  await Promise.all(
    [...iconSrcs].map(async (src) => {
      iconMap.set(src, await loadImageSafe(src));
    }),
  );

  const data = {
    name: (scan && scan.name) || String(govId),
    govId: String(govId),
    snapDate: scan ? scan.snapDate : "",
    scan,
    profile,
    ch,
    accType,
    marches,
    armaments,
    pairs,
    skins,
  };

  const W = POSTER_W;
  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = 8000;
  const measuredHeight = renderPosterContent(
    scratch.getContext("2d"),
    data,
    iconMap,
    W,
  );

  const SCALE = 2;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = Math.ceil(measuredHeight) * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawPosterBackground(ctx, W, Math.ceil(measuredHeight));
  renderPosterContent(ctx, data, iconMap, W);

  return canvas.toDataURL("image/png");
}
