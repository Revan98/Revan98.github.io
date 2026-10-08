/* ==========================================================================
   equipArmament.js — equipment editor: armament editor modal and inscription picker.
   Load it before equipment.js (see equipment.html). Declarations only:
   everything here is called later from equipment.js handlers.
   ========================================================================== */

function fillSelect(select, options, placeholder) {
  select.replaceChildren(new Option(placeholder, ""));
  options.forEach(({ value, label }) => select.add(new Option(label, value)));
}

function buildArmStatRows() {
  const grid = document.getElementById("armStatGrid");
  if (!grid || grid.querySelector(".eq-arm-stat-row")) return;

  document.getElementById("armStatTitle").textContent =
    `Stats (up to ${ARM_STAT_COUNT})`;
   
  grid.style.maxHeight = "50vh";
  grid.style.overflowY = "auto";

  ARM_STAT_DEFS.forEach((_, i) => {
    const row = document.createElement("div");
    row.className = "eq-arm-stat-row";

    const select = document.createElement("select");
    select.id = `armStatName${i}`;
    select.className = "eq-input eq-select";

    const value = document.createElement("input");
    Object.assign(value, {
      type: "number",
      id: `armStatVal${i}`,
      className: "eq-input",
      placeholder: "0.0",
      step: "0.1",
      min: "0",
    });

    row.append(select, value);
    grid.appendChild(row);
  });
}

function populateArmamentSelects() {
  buildArmStatRows();
  fillSelect(
    document.getElementById("armModalName"),
    getArmamentTypeOptions(),
    "— Select type —",
  );
  const stats = getArmTroopTypeNames().map((n) => ({ value: n, label: n }));
  ARM_STAT_DEFS.forEach((_, i) => {
    fillSelect(document.getElementById(`armStatName${i}`), stats, "— Select stat —");
  });
}

function setSelectValue(select, value) {
  if (value && ![...select.options].some((o) => o.value === value)) {
    select.add(new Option(value, value));
  }
  select.value = value;
}

function renderArmSetBonus() {
  const preview = document.getElementById("armSetBonusPreview");
  if (!preview) return;

  const counts = {};
  for (const arm of ARM_SLOTS) {
    const v =
      armEditorPrefix === arm.prefix
        ? document.getElementById("armModalName")?.value.trim()
        : armamentsRow
          ? armamentsRow[arm.prefix]
          : null;
    if (!isArmEmpty(v)) {
      const key = String(v).trim();
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  let html = "";
  for (const [type, count] of Object.entries(counts)) {
    const info = getArmamentInfo(type);
    const bonus = toArray(info?.description).join(" ");
    const active = count >= 3;
    html += `<div class="eq-arm-set-row${active ? " active" : ""}">
      <span class="eq-arm-set-name">${escapeHtml(info?.name || type)}</span>
      <span class="eq-arm-set-count">×${count}</span>
      ${bonus ? `<span class="eq-arm-set-bonus">${active ? "✓ " : ""}${escapeHtml(bonus)}</span>` : ""}
    </div>`;
  }
  preview.innerHTML =
    html || `<span class="eq-arm-set-none">No active set bonuses</span>`;
}

let armEditorPrefix = null;

function openArmamentEditor(prefix, label) {
  armEditorPrefix = prefix;

  if (!armamentsRow) armamentsRow = { player_id: null };

  const row = armamentsRow;

  document.getElementById("armModalTitle").textContent = `Edit ${label}`;

  setSelectValue(
    document.getElementById("armModalName"),
    isArmEmpty(row[prefix]) ? "" : String(row[prefix]),
  );

  ARM_STAT_DEFS.forEach((s, i) => {
    const nk = `${prefix}${s.nameKey}`;
    const vk = `${prefix}${s.valKey}`;
    setSelectValue(
      document.getElementById(`armStatName${i}`),
      isArmEmpty(row[nk]) ? "" : String(row[nk]),
    );
    document.getElementById(`armStatVal${i}`).value = isArmEmpty(row[vk])
      ? ""
      : String(row[vk]);
  });

  ARM_INS_KEYS.forEach((k, i) => {
    const v = row[`${prefix}${k}`];
    document.getElementById(`armIns${i}`).value = isArmEmpty(v)
      ? ""
      : String(v);
  });
  renderInsChosenList();

  renderArmSetBonus();

  document.getElementById("armModalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("armModalName").focus();
}

function closeArmamentEditor() {
  document.getElementById("armModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
  armEditorPrefix = null;
}

function saveArmamentEditor() {
  if (!armEditorPrefix) return;
  if (!armamentsRow) armamentsRow = {};

  const prefix = armEditorPrefix;

  const nameVal = document.getElementById("armModalName").value.trim();
  armamentsRow[prefix] = nameVal || "none";

  ARM_STAT_DEFS.forEach((s, i) => {
    const nv = document.getElementById(`armStatName${i}`).value.trim();
    const vv = document.getElementById(`armStatVal${i}`).value.trim();
    armamentsRow[`${prefix}${s.nameKey}`] = nv || "none";
    armamentsRow[`${prefix}${s.valKey}`] = vv ? parseFloat(vv) : null;
  });

  ARM_INS_KEYS.forEach((k, i) => {
    const v = document.getElementById(`armIns${i}`).value.trim();
    armamentsRow[`${prefix}${k}`] = v || "none";
  });

  closeArmamentEditor();
  renderArmamentsGrid();
}

let insPickerSelected = [];

function renderInsChosenList() {
  const list = document.getElementById("insChosenList");
  if (!list) return;
  const vals = ARM_INS_KEYS.map(
    (_, i) => document.getElementById(`armIns${i}`).value,
  ).filter(Boolean);
  if (!vals.length) {
    list.innerHTML = `<span class="eq-ins-none">None selected</span>`;
    return;
  }
  list.innerHTML = vals
    .map((v) => {
      const tier = getArmTier(v);
      return `<span class="arm-ins tier-${tier}" data-tip-code="${escapeHtml(String(v).trim())}" data-tip-kind="inscription">${escapeHtml(v)}</span>`;
    })
    .join("");
}

function openInsPicker() {
  insPickerSelected = ARM_INS_KEYS.map(
    (_, i) => document.getElementById(`armIns${i}`).value,
  ).filter(Boolean);

  renderInsPickerList("");
  renderInsPickerFooter();
  document.getElementById("insPickerSearch").value = "";
  document.getElementById("insPickerOverlay").classList.add("open");
}

function closeInsPicker() {
  document.getElementById("insPickerOverlay").classList.remove("open");
}

function renderInsPickerList(filter) {
  const q = filter.toLowerCase();
  const body = document.getElementById("insPickerBody");
  let list = getAllInscriptionNames();
  if (q) list = list.filter((n) => n.toLowerCase().includes(q));

  body.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "eq-arm-ins-group eq-ins-pill-grid";
  for (const name of list) {
    const tier = getArmTier(name);
    const checked = insPickerSelected.includes(name);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `arm-ins tier-${tier}${checked ? " selected" : ""}`;
    pill.textContent = name;
    pill.dataset.tipCode = name;
    pill.dataset.tipKind = "inscription";
    pill.addEventListener("click", () => toggleInsPick(name, pill));
    wrap.appendChild(pill);
  }
  body.appendChild(wrap);
}

function toggleInsPick(name, el) {
  const idx = insPickerSelected.indexOf(name);
  if (idx !== -1) {
    insPickerSelected.splice(idx, 1);
    el.classList.remove("selected");
  } else {
    if (insPickerSelected.length >= 8) return;
    insPickerSelected.push(name);
    el.classList.add("selected");
  }
  renderInsPickerFooter();
}

function renderInsPickerFooter() {
  document.getElementById("insPickerCount").textContent =
    `(${insPickerSelected.length}/8)`;
  const wrap = document.getElementById("insPickerSelectedWrap");
  wrap.innerHTML = insPickerSelected
    .map((v) => {
      const tier = getArmTier(v);
      return `<span class="arm-ins tier-${tier}" data-tip-code="${escapeHtml(String(v).trim())}" data-tip-kind="inscription">${escapeHtml(v)}</span>`;
    })
    .join("");
}

function confirmInsPicker() {
  ARM_INS_KEYS.forEach((_, i) => {
    document.getElementById(`armIns${i}`).value = insPickerSelected[i] ?? "";
  });
  renderInsChosenList();
  closeInsPicker();
}

function clearInsPickerSelection() {
  insPickerSelected = [];
  renderInsPickerList(document.getElementById("insPickerSearch").value.trim());
  renderInsPickerFooter();
}
