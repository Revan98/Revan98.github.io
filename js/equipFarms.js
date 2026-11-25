let farmNewRowOpen = false;

function farmField(value, { type = "text", placeholder = "", field = "" }) {
  const input = document.createElement("input");
  input.type = type;
  input.className = "eq-farms-input";
  input.value = value ?? "";
  input.placeholder = placeholder;
  input.dataset.field = field;
  return input;
}

function buildFarmRow(row) {
  const isNew = !row;
  const tableRow = document.createElement("tr");
  tableRow.className = "eq-farms-row" + (isNew ? " eq-farms-row--new" : "");
  if (row) tableRow.dataset.id = row.id;

  const numericFields = [
    { key: "name", type: "text", placeholder: "Name" },
    { key: "player_id", type: "number", placeholder: "Player ID" },
    { key: "power", type: "number", placeholder: "0" },
    { key: "killpoints", type: "number", placeholder: "0" },
    { key: "deads", type: "number", placeholder: "0" },
    { key: "ch", type: "number", placeholder: "0" },
  ];

  numericFields.forEach((numericField) => {
    const tableCell = document.createElement("td");
    tableCell.appendChild(
      farmField(row ? row[numericField.key] : "", {
        type: numericField.type,
        placeholder: numericField.placeholder,
        field: numericField.key,
      }),
    );
    tableRow.appendChild(tableCell);
  });

  const typeTableCell = document.createElement("td");
  const typeSelect = document.createElement("select");
  typeSelect.className = "eq-farms-input";
  typeSelect.dataset.field = "acc_type";
  ["main", "farm"].forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option;
    optionElement.textContent = option === "main" ? "Main" : "Farm";
    if ((row ? row.acc_type : "farm") === option) optionElement.selected = true;
    typeSelect.appendChild(optionElement);
  });
  typeTableCell.appendChild(typeSelect);
  tableRow.appendChild(typeTableCell);

  const mainIdTableCell = document.createElement("td");
  mainIdTableCell.appendChild(
    farmField(row ? row.main_id : "", {
      type: "number",
      placeholder: "0",
      field: "main_id",
    }),
  );
  tableRow.appendChild(mainIdTableCell);

  const actionsTableCell = document.createElement("td");
  actionsTableCell.className = "eq-farms-actions";

  if (isNew) {
    const addButton = document.createElement("button");
    addButton.className = "eq-import-btn primary eq-farms-btn";
    addButton.type = "button";
    addButton.title = "Add farm";
    addButton.innerHTML = '<i class="fa-solid fa-check"></i>';
    addButton.addEventListener("click", () => saveFarmRow(tableRow, true));

    const cancelButton = document.createElement("button");
    cancelButton.className = "eq-import-btn secondary eq-farms-btn";
    cancelButton.type = "button";
    cancelButton.title = "Cancel";
    cancelButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    cancelButton.addEventListener("click", () => {
      farmNewRowOpen = false;
      renderFarmsTable();
    });

    actionsTableCell.append(addButton, cancelButton);
  } else {
    const saveRowButton = document.createElement("button");
    saveRowButton.className = "eq-import-btn primary eq-farms-btn";
    saveRowButton.type = "button";
    saveRowButton.title = "Save changes";
    saveRowButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
    saveRowButton.addEventListener("click", () => saveFarmRow(tableRow, false));

    const deleteButton = document.createElement("button");
    deleteButton.className = "eq-import-btn eq-farms-btn eq-farms-btn--danger";
    deleteButton.type = "button";
    deleteButton.title = "Delete";
    deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteButton.addEventListener("click", () => deleteFarmRow(row.id, row.name));

    actionsTableCell.append(saveRowButton, deleteButton);
  }
  tableRow.appendChild(actionsTableCell);

  return tableRow;
}

function readFarmRowInputs(tableRow) {
  const data = {};
  tableRow.querySelectorAll("[data-field]").forEach((element) => {
    data[element.dataset.field] = element.value;
  });
  return data;
}

let farmRows = [];

async function saveFarmRow(tableRow, isNew) {
  if (!editorReady) return;
  const data = readFarmRowInputs(tableRow);
  const name = importToText(data.name, "");
  const playerId = importToInt(data.player_id);

  if (!name) {
    showToast("Farm name is required.");
    return;
  }
  if (!playerId) {
    showToast("Player ID is required.");
    return;
  }

  try {
    await saveEditorFarm({
      id: isNew ? null : Number(tableRow.dataset.id),
      name,
      player: playerId,
      power: importToInt(data.power),
      killpoints: importToInt(data.killpoints),
      deads: importToInt(data.deads),
      ch: importToInt(data.ch),
      accType: importToText(data.acc_type, "farm"),
      main: importToInt(data.main_id),
    });
    farmNewRowOpen = false;
    setImportStatus(farmImportStatus, `${isNew ? "Added" : "Saved"} "${name}".`, "ok");
    await renderFarmsTable(true);
  } catch (event) {
    console.error("saveFarmRow:", event);
    setImportStatus(farmImportStatus, "Save failed: " + event.message, "err");
  }
}

async function deleteFarmRow(id, name) {
  if (!editorReady) return;
  if (!confirm(`Delete farm account "${name || id}"? This cannot be undone.`)) return;
  try {
    await deleteEditorFarm(id);
    setImportStatus(farmImportStatus, `Deleted "${name || id}".`, "ok");
    await renderFarmsTable(true);
  } catch (event) {
    console.error("deleteFarmRow:", event);
    setImportStatus(farmImportStatus, "Delete failed: " + event.message, "err");
  }
}

function filterFarmRows(query) {
  const base = farmRows.filter(
    (farmRow) => String(farmRow.name).toLowerCase().includes(query) || String(farmRow.player_id).includes(query),
  );
  if (!/^\d+$/.test(query)) return base;

  const id = Number(query);
  const isMain = (farmRow) => String(farmRow.acc_type || "").toLowerCase() === "main";
  const exact = farmRows.filter((farmRow) => Number(farmRow.player_id) === id);
  const mainIds = new Set([id]);
  exact.forEach((farmRow) => {
    const mainId = Number(farmRow.main_id);
    if (mainId && mainId !== id) mainIds.add(mainId);
  });

  const family = farmRows.filter(
    (farmRow) => mainIds.has(Number(farmRow.player_id)) || mainIds.has(Number(farmRow.main_id)),
  );
  if (!family.length) return base;

  const seen = new Set();
  const merged = [...family, ...base].filter((farmRow) => {
    const key = farmRow.id ?? `${farmRow.player_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return merged.sort((firstFarm, secondFarm) => Number(!isMain(firstFarm)) - Number(!isMain(secondFarm)));
}

async function renderFarmsTable(reload = false) {
  if (!farmsTableBody) return;

  if (!editorReady) {
    farmsTableBody.innerHTML = "";
    setImportStatus(farmImportStatus, "Connecting to the database…", "");
    return;
  }

  if (reload || !farmRows.length) {
    try {
      farmRows = await listEditorFarms();
    } catch (event) {
      console.error("renderFarmsTable:", event);
      setImportStatus(farmImportStatus, "Could not load farm accounts: " + event.message, "err");
      return;
    }
  }

  farmsTableBody.innerHTML = "";
  if (farmNewRowOpen) farmsTableBody.appendChild(buildFarmRow(null));

  const query = (farmSearchInput?.value || "").trim().toLowerCase();
  const rows = query ? filterFarmRows(query) : farmRows;

  if (!rows.length && !farmNewRowOpen) {
    const tableRow = document.createElement("tr");
    const tableCell = document.createElement("td");
    tableCell.colSpan = 9;
    tableCell.className = "eq-farms-empty";
    tableCell.textContent = query
      ? "No matching farm accounts."
      : 'No farm accounts yet. Click "Add Farm" to create one.';
    tableRow.appendChild(tableCell);
    farmsTableBody.appendChild(tableRow);
  }

  rows.forEach((row) => farmsTableBody.appendChild(buildFarmRow(row)));

  setImportStatus(
    farmImportStatus,
    `${rows.length} farm account${rows.length === 1 ? "" : "s"}${query ? " matching search" : ""}.`,
    "",
  );
}
