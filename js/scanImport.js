const scanDateInput = document.getElementById("scan-date");
const scanFileInput = document.getElementById("scan-file");
const scanImportBtn = document.getElementById("scan-import-btn");
const scanProgress = document.getElementById("scan-progress");
const scanStatus = document.getElementById("scan-status");
const scanColumns = document.getElementById("scan-columns");
const scanExisting = document.getElementById("scan-existing");
const scanWarning = document.getElementById("scan-warning");
const SCAN_FIELDS = [
  { key: "id", label: "Governor ID", type: "int", required: true,
    aliases: ["governorid", "id", "characterid", "playerid", "userid", "govid"] },
  { key: "name", label: "Name", type: "text", required: true,
    aliases: ["name", "username", "governorname", "playername", "govname"] },
  { key: "power", label: "Power", type: "int", required: true,
    aliases: ["power", "currentpower"] },
  { key: "killPoints", label: "Kill Points", type: "int", required: true,
    aliases: ["killpoints", "totalkillpoints", "kp", "killpoint"] },
  { key: "deaths", label: "Deaths", type: "int",
    aliases: ["deaths", "deads", "dead", "totaldeaths", "deadtroops"] },
  { key: "t1", label: "T1", type: "int", aliases: ["t1", "t1kills", "tier1kills", "tier1", "killst1"] },
  { key: "t2", label: "T2", type: "int", aliases: ["t2", "t2kills", "tier2kills", "tier2", "killst2"] },
  { key: "t3", label: "T3", type: "int", aliases: ["t3", "t3kills", "tier3kills", "tier3", "killst3"] },
  { key: "t4", label: "T4", type: "int", aliases: ["t4", "t4kills", "tier4kills", "tier4", "killst4"] },
  { key: "t5", label: "T5", type: "int", aliases: ["t5", "t5kills", "tier5kills", "tier5", "killst5"] },
  { key: "rangedPoints", label: "Ranged Points", type: "int",
    aliases: ["rangedpoints", "ranged", "rangedkillpoints"] },
  { key: "rssGathered", label: "RSS Gathered", type: "int",
    aliases: ["rssgathered", "resourcesgathered", "resourcegathered", "gathered"] },
  { key: "rssAssistance", label: "RSS Assistance", type: "int",
    aliases: ["rssassistance", "rssassist", "resourceassistance", "resourcesassistance", "assistance"] },
  { key: "helps", label: "Helps", type: "int",
    aliases: ["helps", "alliancehelps", "allyhelps", "helpscount"] },
  { key: "alliance", label: "Alliance", type: "text",
    aliases: ["alliance", "alliancetag", "alliancename", "tag"] },
  { key: "acclaim", label: "Acclaim", type: "int", aliases: ["acclaim", "acclaimpoints"] },
  { key: "kingdom", label: "Kingdom", type: "int", aliases: ["kingdom", "kd", "kingdomid"] },
];

let scanRows = [];
let latestScan = null;
let scanImporting = false;

const normalizeHeader = (h) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function matchScanColumns(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const columns = {};
  const used = new Set();
  for (const field of SCAN_FIELDS) {
    const idx = normalized.findIndex((h, i) => !used.has(i) && field.aliases.includes(h));
    if (idx >= 0) {
      columns[field.key] = idx;
      used.add(idx);
    }
  }
  return {
    columns,
    missing: SCAN_FIELDS.filter((f) => columns[f.key] === undefined),
    unused: headerRow.filter((h, i) => !used.has(i) && String(h ?? "").trim() !== ""),
  };
}

function parseScanSheet(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const match = matchScanColumns(raw[0] || []);
  const byId = new Map();
  for (const row of raw.slice(1)) {
    const cell = (key) => (match.columns[key] === undefined ? undefined : row[match.columns[key]]);
    const id = importToInt(cell("id"));
    if (!id) continue;
    const out = { id };
    for (const field of SCAN_FIELDS) {
      if (field.key === "id") continue;
      const value = cell(field.key);
      if (value === undefined) out[field.key] = null; // column not in the file
      else out[field.key] = field.type === "int" ? importToInt(value) : importToText(value, "");
    }
    byId.set(id, out);
  }
  return { rows: [...byId.values()], match };
}

function describeScan(match, count) {
  const found = SCAN_FIELDS.filter((f) => match.columns[f.key] !== undefined).map((f) => f.label);
  const lines = [`${count.toLocaleString()} players found. Columns used: ${found.join(", ") || "none"}.`];
  const missingRequired = match.missing.filter((f) => f.required).map((f) => f.label);
  const missingOptional = match.missing.filter((f) => !f.required).map((f) => f.label);
  if (missingRequired.length) lines.push(`Required columns missing: ${missingRequired.join(", ")}.`);
  if (missingOptional.length) lines.push(`Not in the file (saved as empty): ${missingOptional.join(", ")}.`);
  if (match.unused.length) lines.push(`Ignored columns: ${match.unused.join(", ")}.`);
  return lines.join(" ");
}

function updateScanButton() {
  scanImportBtn.disabled = !(
    importIsAdmin &&
    !scanImporting &&
    scanRows.length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(scanDateInput.value)
  );
}

function updateScanWarning() {
  const smaller =
    latestScan &&
    scanRows.length > 0 &&
    scanDateInput.value >= latestScan.date &&
    scanRows.length < latestScan.rows * 0.5;
  setStatus(
    scanWarning,
    smaller
      ? `Warning: this scan has ${scanRows.length.toLocaleString()} players but the newest scan on the site (${latestScan.date}) has ${latestScan.rows.toLocaleString()}. Once imported, the Player Card will only know the players in this smaller scan.`
      : "",
    smaller ? "err" : "",
  );
}

async function showExistingScans() {
  try {
    const scans = await sbRpc("scan_overview");
    latestScan = scans[0] || null;
    updateScanWarning();
    scanExisting.textContent = scans.length
      ? "Scans on the site: " +
        scans
          .map((s, i) => `${s.date} (${s.rows} players)${i === 0 ? " — shown on the Player Card" : ""}`)
          .join("; ")
      : "No scans on the site yet.";
  } catch {
    scanExisting.textContent = "";
  }
}

scanFileInput.addEventListener("change", async () => {
  scanRows = [];
  scanColumns.textContent = "";
  updateScanWarning();
  updateScanButton();
  if (!scanFileInput.files.length) return;
  if (!window.XLSX) {
    setStatus(scanStatus, "The Excel reader failed to load. Reload the page.", "err");
    return;
  }
  try {
    setStatus(scanStatus, "Reading the file…");
    const { rows, match } = parseScanSheet(await readWorkbook(scanFileInput.files[0]));
    const blocked = match.missing.some((f) => f.required);
    scanColumns.textContent = describeScan(match, rows.length);
    if (blocked || !rows.length) {
      setStatus(
        scanStatus,
        blocked
          ? "Some required columns were not recognised, so this file cannot be imported."
          : "No rows with a Governor ID were found.",
        "err",
      );
      return;
    }
    scanRows = rows;
    updateScanWarning();
    setStatus(scanStatus, "Ready to import.");
  } catch (e) {
    console.error("Scan file:", e);
    setStatus(scanStatus, "Could not read the file: " + e.message, "err");
  }
  updateScanButton();
});

async function runScanImport() {
  if (!importIsAdmin || scanImporting || !scanRows.length) return;
  const date = scanDateInput.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    setStatus(scanStatus, "Choose the scan date first.", "err");
    return;
  }

  scanImporting = true;
  updateScanButton();
  scanProgress.value = 0;
  try {
    let sent = 0;
    for (let i = 0; i < scanRows.length; i += ROWS_PER_REQUEST) {
      setStatus(scanStatus, `Importing… ${sent.toLocaleString()} / ${scanRows.length.toLocaleString()} players`);
      const chunk = scanRows.slice(i, i + ROWS_PER_REQUEST);
      await sbRpc("scan_import", { p_date: date, p_rows: chunk }, { auth: true });
      sent += chunk.length;
      scanProgress.value = Math.round((sent / scanRows.length) * 100);
    }
    setStatus(
      scanStatus,
      `Imported ${scanRows.length.toLocaleString()} players for ${date}. The newest scan date is the one the Player Card shows.`,
      "ok",
    );
    showToast("Scan imported.", "success");
    showExistingScans();
  } catch (e) {
    console.error("Scan import failed:", e);
    scanProgress.value = 0;
    setStatus(scanStatus, "Import failed: " + e.message + " (Running the import again replaces what was sent.)", "err");
    if (/signed out|expired|JWT/i.test(e.message)) {
      sbSignOut();
      await refreshAuthUi();
    }
  } finally {
    scanImporting = false;
    updateScanButton();
  }
}

scanDateInput.value = todayIso();
scanDateInput.addEventListener("input", () => {
  updateScanWarning();
  updateScanButton();
});
scanImportBtn.addEventListener("click", runScanImport);
document.addEventListener("import-auth", updateScanButton);
setStatus(scanStatus, "Choose a scan file.");
showExistingScans();
updateScanButton();
