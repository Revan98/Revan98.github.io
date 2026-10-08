/* ==========================================================================
   equipImport.js — equipment editor: Excel import (KvK workbook) and the farm-accounts table.
   Load it before equipment.js (see equipment.html). Declarations only:
   everything here is called later from equipment.js handlers.
   ========================================================================== */

function requireWorkbookLibrary() {
  if (window.XLSX) return true;
  showToast(
    "Excel importer failed to load. Check your internet connection and reload the page.",
  );
  return false;
}

async function readWorkbook(file) {
  const bytes = await file.arrayBuffer();
  return XLSX.read(bytes, { type: "array" });
}

function sheetRows(workbook, sheetName, opts = {}) {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true, ...opts });
}

function importToInt(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function importToFloat(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function importToText(v, fallback = "") {
  if (v === null || v === undefined || String(v).trim() === "") return fallback;
  return String(v).trim();
}

function headerMap(headers) {
  const map = {};
  headers.forEach((header, idx) => {
    const key = String(header ?? "").trim();
    if (key) map[key] = idx;
  });
  return map;
}

function rowValue(row, headers, columnName, fallback = 0) {
  const idx = headers[columnName];
  return idx === undefined ? fallback : row[idx];
}

function normalizeImportDate(sheetName) {
  const name = String(sheetName);
  if (name.includes("_") && name.length === 10) {
    const [d, m, y] = name.split("_");
    return `${y}-${m}-${d}`;
  }
  return name;
}

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

function saveFarmRow(tr, isNew) {
  if (!db) return;
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

  const payload = [
    name,
    playerId,
    importToInt(data.power),
    importToInt(data.killpoints),
    importToInt(data.deads),
    importToInt(data.ch),
    importToText(data.acc_type, "farm"),
    importToInt(data.main_id),
  ];

  try {
    ensureAppSchema();
    if (isNew) {
      db.run(
        `INSERT INTO farm_accounts
         (name, player_id, power, killpoints, deads, ch, acc_type, main_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        payload,
      );
      farmNewRowOpen = false;
      setImportStatus(
        farmImportStatus,
        `Added "${name}" — remember to download the database when you're done.`,
        "ok",
      );
    } else {
      const id = Number(tr.dataset.id);
      db.run(
        `UPDATE farm_accounts
         SET name=?, player_id=?, power=?, killpoints=?, deads=?, ch=?, acc_type=?, main_id=?
         WHERE id=?`,
        [...payload, id],
      );
      setImportStatus(
        farmImportStatus,
        `Saved "${name}" — remember to download the database when you're done.`,
        "ok",
      );
    }
    markDirty();
    renderFarmsTable();
  } catch (e) {
    console.error("saveFarmRow:", e);
    setImportStatus(farmImportStatus, "Save failed: " + e.message, "err");
  }
}

function deleteFarmRow(id, name) {
  if (!db) return;
  if (!confirm(`Delete farm account "${name || id}"? This cannot be undone.`))
    return;
  try {
    db.run("DELETE FROM farm_accounts WHERE id = ?", [id]);
    markDirty();
    setImportStatus(farmImportStatus, `Deleted "${name || id}".`, "ok");
    renderFarmsTable();
  } catch (e) {
    console.error("deleteFarmRow:", e);
    setImportStatus(farmImportStatus, "Delete failed: " + e.message, "err");
  }
}

function renderFarmsTable() {
  if (!farmsTableBody) return;
  farmsTableBody.innerHTML = "";

  if (!db) {
    setImportStatus(
      farmImportStatus,
      "Load a database to manage farm accounts.",
      "",
    );
    return;
  }

  ensureAppSchema();

  if (farmNewRowOpen) farmsTableBody.appendChild(buildFarmRow(null));

  const q = (farmSearchInput?.value || "").trim().toLowerCase();
  let rows = [];
  try {
    let sql = `SELECT id, name, player_id, power, killpoints, deads, ch, acc_type, main_id FROM farm_accounts`;
    if (q) {
      const esc = q.replace(/'/g, "''");
      sql += ` WHERE lower(name) LIKE '%${esc}%' OR CAST(player_id AS TEXT) LIKE '%${esc}%'`;
    }
    sql += ` ORDER BY name COLLATE NOCASE`;
    const res = db.exec(sql);
    if (res.length) {
      rows = res[0].values.map((v) => ({
        id: v[0],
        name: v[1],
        player_id: v[2],
        power: v[3],
        killpoints: v[4],
        deads: v[5],
        ch: v[6],
        acc_type: v[7],
        main_id: v[8],
      }));
    }
  } catch (e) {
    console.error("renderFarmsTable:", e);
  }

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

async function importKvkWorkbook() {
  if (!db || !kvkFileInput?.files?.length) return;
  if (!requireWorkbookLibrary()) return;

  const kingdom = kvkKingdomInput.value.trim();
  const kvkNumber = importToInt(kvkNumberInput.value);
  const kvkName = kvkNameInput.value.trim() || "KvK";
  if (!kingdom || !kvkNumber) {
    setImportStatus(
      kvkImportStatus,
      "Enter kingdom and KvK number first.",
      "err",
    );
    return;
  }

  kvkImportBtn.disabled = true;
  setImportStatus(kvkImportStatus, "Importing KvK snapshots...", "info");

  try {
    ensureAppSchema();
    const workbook = await readWorkbook(kvkFileInput.files[0]);
    let snapshotCount = 0;
    let statCount = 0;
    let lastSnapshotId = null;

    db.run("BEGIN");
    try {
      let kvkRows = db.exec(
        "SELECT id FROM kvks WHERE kingdom = ? AND kvk_number = ?",
        [kingdom, kvkNumber],
      );
      let kvkId =
        kvkRows.length && kvkRows[0].values.length
          ? kvkRows[0].values[0][0]
          : null;

      if (!kvkId) {
        db.run(
          "INSERT INTO kvks (kingdom, kvk_number, name, is_latest) VALUES (?, ?, ?, 0)",
          [kingdom, kvkNumber, kvkName],
        );
        kvkRows = db.exec(
          "SELECT id FROM kvks WHERE kingdom = ? AND kvk_number = ?",
          [kingdom, kvkNumber],
        );
        kvkId = kvkRows[0].values[0][0];
      } else {
        db.run("UPDATE kvks SET name = ? WHERE id = ?", [kvkName, kvkId]);
      }

      db.run("UPDATE kvks SET is_latest = 0 WHERE kingdom = ?", [kingdom]);
      db.run("UPDATE snapshots SET is_last = 0 WHERE kvk_id = ?", [kvkId]);

      for (const sheetName of workbook.SheetNames) {
        const rows = sheetRows(workbook, sheetName, { header: 1 });
        const headers = headerMap(rows[0] || []);
        const snapshotDate = normalizeImportDate(sheetName);

        db.run(
          "INSERT OR IGNORE INTO snapshots (kvk_id, snapshot_date) VALUES (?, ?)",
          [kvkId, snapshotDate],
        );
        const snapRows = db.exec(
          "SELECT id FROM snapshots WHERE kvk_id = ? AND snapshot_date = ?",
          [kvkId, snapshotDate],
        );
        const snapshotId = snapRows[0].values[0][0];
        lastSnapshotId = snapshotId;
        snapshotCount++;

        for (const row of rows.slice(1)) {
          const governorId = importToInt(rowValue(row, headers, "ID"));
          if (!governorId) continue;
          const name = importToText(rowValue(row, headers, "Name", ""), "");

          db.run(
            `INSERT OR IGNORE INTO governors (governor_id, kingdom, name)
             VALUES (?, ?, ?)`,
            [String(governorId), kingdom, name],
          );

          db.run(
            `INSERT OR REPLACE INTO stats (
              snapshot_id, governor_id,
              power, kill_points, t4, t5, deads,
              power_diff, kp_diff, t4_diff, t5_diff, deads_diff,
              min_dkp, dkp, dkp_percent,
              sum_min_dkp, sum_dkp, sum_dkp_percent,
              vacation, status, acclaim
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
              snapshotId,
              String(governorId),
              importToInt(rowValue(row, headers, "Power")),
              importToInt(rowValue(row, headers, "Killpoints")),
              importToInt(rowValue(row, headers, "T4 Kills")),
              importToInt(rowValue(row, headers, "T5 Kills")),
              importToInt(rowValue(row, headers, "Deads")),
              importToInt(rowValue(row, headers, "Power diff")),
              importToInt(rowValue(row, headers, "KP gained")),
              importToInt(rowValue(row, headers, "T4 gained")),
              importToInt(rowValue(row, headers, "T5 gained")),
              importToInt(rowValue(row, headers, "Deads gained")),
              importToInt(rowValue(row, headers, "Min DKP")),
              importToInt(rowValue(row, headers, "DKP")),
              importToFloat(rowValue(row, headers, "DKP%")),
              importToInt(
                rowValue(
                  row,
                  headers,
                  "Sum Min DKP",
                  rowValue(row, headers, "Min DKP"),
                ),
              ),
              importToInt(
                rowValue(
                  row,
                  headers,
                  "Sum DKP",
                  rowValue(row, headers, "DKP"),
                ),
              ),
              importToFloat(
                rowValue(
                  row,
                  headers,
                  "Sum DKP%",
                  rowValue(row, headers, "DKP%"),
                ),
              ),
              importToText(rowValue(row, headers, "Vacation", "NO"), "NO"),
              importToText(rowValue(row, headers, "Status", "OK"), "OK"),
              importToInt(rowValue(row, headers, "Acclaim")),
            ],
          );
          statCount++;
        }
      }

      if (lastSnapshotId) {
        db.run("UPDATE snapshots SET is_last = 1 WHERE id = ?", [
          lastSnapshotId,
        ]);
      }
      db.run("UPDATE kvks SET is_latest = 1 WHERE id = ?", [kvkId]);
      db.run("COMMIT");
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }

    markDirty();
    setImportStatus(
      kvkImportStatus,
      `Imported ${snapshotCount} snapshot${snapshotCount === 1 ? "" : "s"} and ${statCount} stat row${statCount === 1 ? "" : "s"} — remember to download the database when you're done.`,
      "ok",
    );
  } catch (e) {
    console.error("importKvkWorkbook:", e);
    setImportStatus(kvkImportStatus, "KvK import failed: " + e.message, "err");
  } finally {
    updateImportButtons();
  }
}
