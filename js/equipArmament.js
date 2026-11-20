function fillSelect(select, options, placeholder) {
  select.replaceChildren(new Option(placeholder, ""));
  options.forEach(({ value, label }) => select.add(new Option(label, value)));
}

function buildArmamentStatRows() {
  const grid = document.getElementById("armStatGrid");
  if (!grid || grid.querySelector(".eq-arm-stat-row")) return;

  document.getElementById("armStatTitle").textContent =
    `Stats (up to ${ARMAMENT_STAT_COUNT})`;
  grid.style.maxHeight = "50vh";
  grid.style.overflowY = "auto";

  ARMAMENT_STAT_DEFINITIONS.forEach((_, index) => {
    const row = document.createElement("div");
    row.className = "eq-arm-stat-row";

    const select = document.createElement("select");
    select.id = `armStatName${index}`;
    select.className = "eq-input eq-select";

    const value = document.createElement("input");
    Object.assign(value, {
      type: "number",
      id: `armStatVal${index}`,
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
  buildArmamentStatRows();
  fillSelect(
    document.getElementById("armModalName"),
    getArmamentTypeOptions(),
    "— Select type —",
  );
  const stats = getArmamentTroopTypeNames().map((troopTypeName) => ({ value: troopTypeName, label: troopTypeName }));
  ARMAMENT_STAT_DEFINITIONS.forEach((_, index) => {
    fillSelect(document.getElementById(`armStatName${index}`), stats, "— Select stat —");
  });
}

function setSelectValue(select, value) {
  if (value && ![...select.options].some((option) => option.value === value)) {
    select.add(new Option(value, value));
  }
  select.value = value;
}

function renderArmamentSetBonus() {
  const preview = document.getElementById("armSetBonusPreview");
  if (!preview) return;

  const counts = {};
  for (const armament of ARMAMENT_SLOTS) {
    const value =
      armamentEditorPrefix === armament.prefix
        ? document.getElementById("armModalName")?.value.trim()
        : armamentsRow
          ? armamentsRow[armament.prefix]
          : null;
    if (!isArmamentEmpty(value)) {
      const key = String(value).trim();
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

let armamentEditorPrefix = null;

function openArmamentEditor(prefix, label) {
  armamentEditorPrefix = prefix;

  if (!armamentsRow) armamentsRow = { player_id: null };

  const row = armamentsRow;

  document.getElementById("armModalTitle").textContent = `Edit ${label}`;

  setSelectValue(
    document.getElementById("armModalName"),
    isArmamentEmpty(row[prefix]) ? "" : String(row[prefix]),
  );

  ARMAMENT_STAT_DEFINITIONS.forEach((armamentStatDefinition, index) => {
    const nameColumn = `${prefix}${armamentStatDefinition.nameKey}`;
    const valueColumn = `${prefix}${armamentStatDefinition.valKey}`;
    setSelectValue(
      document.getElementById(`armStatName${index}`),
      isArmamentEmpty(row[nameColumn]) ? "" : String(row[nameColumn]),
    );
    document.getElementById(`armStatVal${index}`).value = isArmamentEmpty(row[valueColumn])
      ? ""
      : String(row[valueColumn]);
  });

  ARMAMENT_INSCRIPTION_KEYS.forEach((armamentInscriptionKey, index) => {
    const value = row[`${prefix}${armamentInscriptionKey}`];
    document.getElementById(`armIns${index}`).value = isArmamentEmpty(value)
      ? ""
      : String(value);
  });
  renderInscriptionChosenList();

  renderArmamentSetBonus();

  document.getElementById("armModalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("armModalName").focus();
}

function closeArmamentEditor() {
  document.getElementById("armModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
  armamentEditorPrefix = null;
}

function saveArmamentEditor() {
  if (!armamentEditorPrefix) return;
  if (!armamentsRow) armamentsRow = {};

  const prefix = armamentEditorPrefix;

  const nameValue = document.getElementById("armModalName").value.trim();
  armamentsRow[prefix] = nameValue || "none";

  ARMAMENT_STAT_DEFINITIONS.forEach((armamentStatDefinition, index) => {
    const statName = document.getElementById(`armStatName${index}`).value.trim();
    const statValue = document.getElementById(`armStatVal${index}`).value.trim();
    armamentsRow[`${prefix}${armamentStatDefinition.nameKey}`] = statName || "none";
    armamentsRow[`${prefix}${armamentStatDefinition.valKey}`] = statValue ? parseFloat(statValue) : null;
  });

  ARMAMENT_INSCRIPTION_KEYS.forEach((armamentInscriptionKey, index) => {
    const value = document.getElementById(`armIns${index}`).value.trim();
    armamentsRow[`${prefix}${armamentInscriptionKey}`] = value || "none";
  });

  closeArmamentEditor();
  renderArmamentsGrid();
}

let inscriptionPickerSelected = [];

function renderInscriptionChosenList() {
  const list = document.getElementById("insChosenList");
  if (!list) return;
  const vals = ARMAMENT_INSCRIPTION_KEYS.map(
    (_, index) => document.getElementById(`armIns${index}`).value,
  ).filter(Boolean);
  if (!vals.length) {
    list.innerHTML = `<span class="eq-ins-none">None selected</span>`;
    return;
  }
  list.innerHTML = vals
    .map((value) => {
      const tier = getArmamentTier(value);
      return `<span class="arm-ins tier-${tier}" data-tip-code="${escapeHtml(String(value).trim())}" data-tip-kind="inscription">${escapeHtml(value)}</span>`;
    })
    .join("");
}

function openInscriptionPicker() {
  inscriptionPickerSelected = ARMAMENT_INSCRIPTION_KEYS.map(
    (_, index) => document.getElementById(`armIns${index}`).value,
  ).filter(Boolean);

  renderInscriptionPickerList("");
  renderInscriptionPickerFooter();
  document.getElementById("insPickerSearch").value = "";
  document.getElementById("insPickerOverlay").classList.add("open");
}

function closeInscriptionPicker() {
  document.getElementById("insPickerOverlay").classList.remove("open");
}

function renderInscriptionPickerList(filter) {
  const query = filter.toLowerCase();
  const body = document.getElementById("insPickerBody");
  let list = getAllInscriptionNames();
  if (query) list = list.filter((name) => name.toLowerCase().includes(query));

  body.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "arm-ins-group eq-ins-pill-grid";
  for (const name of list) {
    const tier = getArmamentTier(name);
    const checked = inscriptionPickerSelected.includes(name);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `arm-ins tier-${tier}${checked ? " selected" : ""}`;
    pill.textContent = name;
    pill.dataset.tipCode = name;
    pill.dataset.tipKind = "inscription";
    pill.addEventListener("click", () => toggleInscriptionPick(name, pill));
    wrap.appendChild(pill);
  }
  body.appendChild(wrap);
}

function toggleInscriptionPick(name, element) {
  const index = inscriptionPickerSelected.indexOf(name);
  if (index !== -1) {
    inscriptionPickerSelected.splice(index, 1);
    element.classList.remove("selected");
  } else {
    if (inscriptionPickerSelected.length >= 8) return;
    inscriptionPickerSelected.push(name);
    element.classList.add("selected");
  }
  renderInscriptionPickerFooter();
}

function renderInscriptionPickerFooter() {
  document.getElementById("insPickerCount").textContent =
    `(${inscriptionPickerSelected.length}/8)`;
  const wrap = document.getElementById("insPickerSelectedWrap");
  wrap.innerHTML = inscriptionPickerSelected
    .map((value) => {
      const tier = getArmamentTier(value);
      return `<span class="arm-ins tier-${tier}" data-tip-code="${escapeHtml(String(value).trim())}" data-tip-kind="inscription">${escapeHtml(value)}</span>`;
    })
    .join("");
}

function confirmInscriptionPicker() {
  ARMAMENT_INSCRIPTION_KEYS.forEach((_, index) => {
    document.getElementById(`armIns${index}`).value = inscriptionPickerSelected[index] ?? "";
  });
  renderInscriptionChosenList();
  closeInscriptionPicker();
}

function clearInscriptionPickerSelection() {
  inscriptionPickerSelected = [];
  renderInscriptionPickerList(document.getElementById("insPickerSearch").value.trim());
  renderInscriptionPickerFooter();
}
