const kingdomInput = document.getElementById("kvk-kingdom");
const numberInput = document.getElementById("kvk-number");
const nameInput = document.getElementById("kvk-name");
const fileInput = document.getElementById("kvk-file");
const importBtn = document.getElementById("kvk-import-btn");
const progressEl = document.getElementById("kvk-progress");
const statusEl = document.getElementById("kvk-status");

let importing = false;

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
  const name = String(sheetName).trim();
  let iso = name;
  if (/^\d{2}_\d{2}_\d{4}$/.test(name)) {
    const [d, m, y] = name.split("_");
    iso = `${y}-${m}-${d}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(iso))) return null;
  return iso;
}

function toStatRow(row, headers) {
  const id = importToInt(rowValue(row, headers, "ID"));
  if (!id) return null;
  const minDkp = rowValue(row, headers, "Min DKP");
  const dkp = rowValue(row, headers, "DKP");
  const dkpPercent = rowValue(row, headers, "DKP%");
  return {
    id,
    name: importToText(rowValue(row, headers, "Name", ""), ""),
    power: importToInt(rowValue(row, headers, "Power")),
    kp: importToInt(rowValue(row, headers, "Killpoints")),
    t4: importToInt(rowValue(row, headers, "T4 Kills")),
    t5: importToInt(rowValue(row, headers, "T5 Kills")),
    deads: importToInt(rowValue(row, headers, "Deads")),
    powerDiff: importToInt(rowValue(row, headers, "Power diff")),
    kpDiff: importToInt(rowValue(row, headers, "KP gained")),
    t4Diff: importToInt(rowValue(row, headers, "T4 gained")),
    t5Diff: importToInt(rowValue(row, headers, "T5 gained")),
    deadsDiff: importToInt(rowValue(row, headers, "Deads gained")),
    minDkp: importToInt(minDkp),
    dkp: importToInt(dkp),
    dkpPercent: importToFloat(dkpPercent),
    sumMinDkp: importToInt(rowValue(row, headers, "Sum Min DKP", minDkp)),
    sumDkp: importToInt(rowValue(row, headers, "Sum DKP", dkp)),
    sumDkpPercent: importToFloat(rowValue(row, headers, "Sum DKP%", dkpPercent)),
    vacation: importToText(rowValue(row, headers, "Vacation", "NO"), "NO"),
    status: importToText(rowValue(row, headers, "Status", "OK"), "OK"),
    acclaim: importToInt(rowValue(row, headers, "Acclaim")),
  };
}

function parseWorkbook(workbook) {
  const snapshots = [];
  const problems = [];
  for (const sheet of workbook.SheetNames) {
    const date = normalizeImportDate(sheet);
    if (!date) {
      problems.push(`Sheet "${sheet}" is not a date (use dd_mm_yyyy or yyyy-mm-dd).`);
      continue;
    }
    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], {
      header: 1,
      defval: "",
      raw: true,
    });
    const headers = headerMap(raw[0] || []);
    const byId = new Map();
    for (const row of raw.slice(1)) {
      const stat = toStatRow(row, headers);
      if (stat) byId.set(stat.id, stat);
    }
    if (!byId.size) {
      problems.push(`Sheet "${sheet}" has no rows with an ID, skipped.`);
      continue;
    }
    snapshots.push({ sheet, date, rows: [...byId.values()] });
  }
  return { snapshots, problems };
}

function updateImportButton() {
  const ready =
    importIsAdmin &&
    !importing &&
    kingdomInput.value.trim() &&
    Number(numberInput.value) > 0 &&
    fileInput.files.length > 0;
  importBtn.disabled = !ready;
}

async function runImport() {
  if (!importIsAdmin || importing) return;
  if (!window.XLSX) {
    setStatus(statusEl, "The Excel reader failed to load. Reload the page.", "err");
    return;
  }

  const kingdom = kingdomInput.value.trim();
  const kvkNumber = importToInt(numberInput.value);
  const kvkName = nameInput.value.trim() || "KvK";
  if (!kingdom || !kvkNumber) {
    setStatus(statusEl, "Enter the kingdom and KvK number first.", "err");
    return;
  }

  importing = true;
  updateImportButton();
  progressEl.value = 0;
  setStatus(statusEl, "Reading the Excel file…");

  try {
    const { snapshots, problems } = parseWorkbook(await readWorkbook(fileInput.files[0]));
    if (!snapshots.length) {
      throw new Error(problems.join(" ") || "The file has no usable sheets.");
    }

    const totalRows = snapshots.reduce((n, s) => n + s.rows.length, 0);
    let sentRows = 0;
    let kvkId = null;
    let lastSnapshotId = null;

    for (const snap of snapshots) {
      for (let i = 0; i < snap.rows.length; i += ROWS_PER_REQUEST) {
        setStatus(
          statusEl,
          `Importing sheet "${snap.sheet}" (${snap.date}) — ${sentRows.toLocaleString()} / ${totalRows.toLocaleString()} rows…`,
        );
        const chunk = snap.rows.slice(i, i + ROWS_PER_REQUEST);
        const res = await sbRpc(
          "kvk_import_snapshot",
          {
            p_kingdom: kingdom,
            p_kvk_number: kvkNumber,
            p_kvk_name: kvkName,
            p_date: snap.date,
            p_rows: chunk,
          },
          { auth: true },
        );
        kvkId = res.kvkId;
        lastSnapshotId = res.snapshotId;
        sentRows += chunk.length;
        progressEl.value = Math.round((sentRows / totalRows) * 95);
      }
    }

    setStatus(statusEl, "Finishing…");
    await sbRpc(
      "kvk_import_finish",
      { p_kvk_id: kvkId, p_last_snapshot_id: lastSnapshotId },
      { auth: true },
    );
    progressEl.value = 100;

    const notes = problems.length ? ` Notes: ${problems.join(" ")}` : "";
    setStatus(
      statusEl,
      `Imported ${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"} and ${totalRows.toLocaleString()} stat rows into KvK ${kvkNumber} of kingdom ${kingdom}. It is now the latest KvK.${notes}`,
      "ok",
    );
    showToast("KvK imported.", "success");
  } catch (e) {
    console.error("KvK import failed:", e);
    progressEl.value = 0;
    setStatus(
      statusEl,
      "Import failed: " + e.message + " (Anything already sent was saved; running the import again replaces it.)",
      "err",
    );
    if (/signed out|expired|JWT/i.test(e.message)) {
      sbSignOut();
      await refreshAuthUi();
    }
  } finally {
    importing = false;
    updateImportButton();
  }
}

[kingdomInput, numberInput, nameInput, fileInput].forEach((el) =>
  el.addEventListener("input", updateImportButton),
);
fileInput.addEventListener("change", updateImportButton);
importBtn.addEventListener("click", runImport);

document.addEventListener("import-auth", () => {
  if (!importIsAdmin) setStatus(statusEl, "Choose a KvK Excel file.");
  updateImportButton();
});
updateImportButton();
