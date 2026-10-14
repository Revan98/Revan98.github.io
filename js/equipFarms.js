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
  const tr = document.createElement("tr");
  tr.className = "eq-farms-row" + (isNew ? " eq-farms-row--new" : "");
  if (row) tr.dataset.id = row.id;

  const numericFields = [
    { key: "name", type: "text", placeholder: "Name" },
    { key: "player_id", type: "number", placeholder: "Player ID" },
    { key: "power", type: "number", placeholder: "0" },
    { key: "killpoints", type: "number", placeholder: "0" },
    { key: "deads", type: "number", placeholder: "0" },
    { key: "ch", type: "number", placeholder: "0" },
  ];

  numericFields.forEach((f) => {
    const td = document.createElement("td");
    td.appendChild(
      farmField(row ? row[f.key] : "", {
        type: f.type,
        placeholder: f.placeholder,
        field: f.key,
      }),
    );
    tr.appendChild(td);
  });

  const typeTd = document.createElement("td");
  const typeSelect = document.createElement("select");
  typeSelect.className = "eq-farms-input";
  typeSelect.dataset.field = "acc_type";
  ["main", "farm"].forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt === "main" ? "Main" : "Farm";
    if ((row ? row.acc_type : "farm") === opt) o.selected = true;
    typeSelect.appendChild(o);
  });
  typeTd.appendChild(typeSelect);
  tr.appendChild(typeTd);

  const mainIdTd = document.createElement("td");
  mainIdTd.appendChild(
    farmField(row ? row.main_id : "", {
      type: "number",
      placeholder: "0",
      field: "main_id",
    }),
  );
  tr.appendChild(mainIdTd);

  const actionsTd = document.createElement("td");
  actionsTd.className = "eq-farms-actions";

  if (isNew) {
    const addBtn = document.createElement("button");
    addBtn.className = "eq-import-btn primary eq-farms-btn";
    addBtn.type = "button";
    addBtn.title = "Add farm";
    addBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    addBtn.addEventListener("click", () => saveFarmRow(tr, true));

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "eq-import-btn secondary eq-farms-btn";
    cancelBtn.type = "button";
    cancelBtn.title = "Cancel";
    cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    cancelBtn.addEventListener("click", () => {
      farmNewRowOpen = false;
      renderFarmsTable();
    });

    actionsTd.append(addBtn, cancelBtn);
  } else {
    const saveRowBtn = document.createElement("button");
    saveRowBtn.className = "eq-import-btn primary eq-farms-btn";
    saveRowBtn.type = "button";
    saveRowBtn.title = "Save changes";
    saveRowBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
    saveRowBtn.addEventListener("click", () => saveFarmRow(tr, false));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "eq-import-btn eq-farms-btn eq-farms-btn--danger";
    deleteBtn.type = "button";
    deleteBtn.title = "Delete";
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.addEventListener("click", () => deleteFarmRow(row.id, row.name));

    actionsTd.append(saveRowBtn, deleteBtn);
  }
  tr.appendChild(actionsTd);

  return tr;
}

function readFarmRowInputs(tr) {
  const data = {};
  tr.querySelectorAll("[data-field]").forEach((el) => {
    data[el.dataset.field] = el.value;
  });
  return data;
}

let farmRows = [];

async function saveFarmRow(tr, isNew) {
  if (!editorReady) return;
  const data = readFarmRowInputs(tr);
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
    await edSaveFarm({
      id: isNew ? null : Number(tr.dataset.id),
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
  } catch (e) {
    console.error("saveFarmRow:", e);
    setImportStatus(farmImportStatus, "Save failed: " + e.message, "err");
  }
}

async function deleteFarmRow(id, name) {
  if (!editorReady) return;
  if (!confirm(`Delete farm account "${name || id}"? This cannot be undone.`)) return;
  try {
    await edDeleteFarm(id);
    setImportStatus(farmImportStatus, `Deleted "${name || id}".`, "ok");
    await renderFarmsTable(true);
  } catch (e) {
    console.error("deleteFarmRow:", e);
    setImportStatus(farmImportStatus, "Delete failed: " + e.message, "err");
  }
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
      farmRows = await edListFarms();
    } catch (e) {
      console.error("renderFarmsTable:", e);
      setImportStatus(farmImportStatus, "Could not load farm accounts: " + e.message, "err");
      return;
    }
  }

  farmsTableBody.innerHTML = "";
  if (farmNewRowOpen) farmsTableBody.appendChild(buildFarmRow(null));

  const q = (farmSearchInput?.value || "").trim().toLowerCase();
  const rows = q
    ? farmRows.filter(
        (r) =>
          String(r.name).toLowerCase().includes(q) || String(r.player_id).includes(q),
      )
    : farmRows;

  if (!rows.length && !farmNewRowOpen) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.className = "eq-farms-empty";
    td.textContent = q
      ? "No matching farm accounts."
      : 'No farm accounts yet. Click "Add Farm" to create one.';
    tr.appendChild(td);
    farmsTableBody.appendChild(tr);
  }

  rows.forEach((row) => farmsTableBody.appendChild(buildFarmRow(row)));

  setImportStatus(
    farmImportStatus,
    `${rows.length} farm account${rows.length === 1 ? "" : "s"}${q ? " matching search" : ""}.`,
    "",
  );
}
