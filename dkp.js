(() => {
  // Setup localforage store
  localforage.config({ name: "dkp_web_app" });

  // Keys
  const KEY_MULT = "multipliers";
  const KEY_PR = "power_ranges";
  const KEY_VAC = "vacation_list";
  const KEY_MIN = "min_dkp";

  // UI elements
  const t4El = document.getElementById("t4");
  const t5El = document.getElementById("t5");
  const deadsEl = document.getElementById("deads");
  const saveMultBtn = document.getElementById("save-multipliers");

  const prTableBody = document.querySelector("#power-ranges-table tbody");
  const prMin = document.getElementById("pr-min");
  const prMax = document.getElementById("pr-max");
  const prPercent = document.getElementById("pr-percent");
  const prAddBtn = document.getElementById("pr-add");
  const prSaveBtn = document.getElementById("pr-save");

  const vacInput = document.getElementById("vacation-input");
  const vacSaveBtn = document.getElementById("vac-save");
  const vacClearBtn = document.getElementById("vac-clear");

  const file1El = document.getElementById("file1");
  const file2El = document.getElementById("file2");
  const runBtn = document.getElementById("run-dkp");
  const progressEl = document.getElementById("progress");
  const resultsWrap = document.getElementById("results-table-wrap");
  const resultsInfo = document.getElementById("results-info");

  const exportX = document.getElementById("export-xlsx");
  const exportC = document.getElementById("export-csv");
  const exportJ = document.getElementById("export-json");

  const exportSettingsBtn = document.getElementById("export-settings");
  const importSettingsBtn = document.getElementById("import-settings");
  const importSettingsFile = document.getElementById("import-settings-file");
  const clearMinBtn = document.getElementById("clear-min-dkp");

  /* Simple query helper */
  const qs = (sel) => document.querySelector(sel);
  const themeToggle = qs("#toggle-theme");

  // In-memory caches
  let powerRanges = []; // [{min_power, max_power|null, percentage}]
  let multipliers = { t4: 0.0, t5: 0.0, deads: 0.0 };
  let vacationList = []; // array of ids (strings)
  let minDkpMap = {}; // id -> min_dkp (number)
  let lastResults = null; // array of result objects

  // Helpers: persistence
  async function loadAllFromStorage() {
    const m = await localforage.getItem(KEY_MULT);
    if (m) multipliers = m;
    const pr = await localforage.getItem(KEY_PR);
    if (Array.isArray(pr)) powerRanges = pr.slice();
    const v = await localforage.getItem(KEY_VAC);
    if (Array.isArray(v)) vacationList = v.slice();
    const md = await localforage.getItem(KEY_MIN);
    if (md && typeof md === "object") minDkpMap = md;
  }

  async function saveMultipliers() {
    multipliers = {
      t4: parseFloat(t4El.value) || 0,
      t5: parseFloat(t5El.value) || 0,
      deads: parseFloat(deadsEl.value) || 0,
    };
    await localforage.setItem(KEY_MULT, multipliers);
    alert("Multipliers saved locally.");
  }

  async function savePowerRangesToStorage() {
    powerRanges.sort((a, b) => a.min_power - b.min_power);
    await localforage.setItem(KEY_PR, powerRanges);
    alert("Power ranges saved locally.");
  }

  async function saveVacationList() {
    const raw = vacInput.value.trim();
    if (!raw) {
      vacationList = [];
    } else {
      vacationList = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    await localforage.setItem(KEY_VAC, vacationList);
    alert("Vacation list saved.");
  }

  async function clearVacationList() {
    if (!confirm("Clear vacation list (set to empty)?")) return;
    vacationList = [];
    vacInput.value = "";
    await localforage.setItem(KEY_VAC, vacationList);
    alert("Vacation list cleared.");
  }

  async function saveMinDkpMap() {
    await localforage.setItem(KEY_MIN, minDkpMap);
  }

  async function clearAllMinDkp() {
    if (!confirm("Are you sure? This will remove all stored Min DKP values."))
      return;
    await localforage.removeItem(KEY_MIN);
    minDkpMap = {};
    alert("All Min DKP values cleared.");
  }

  // UI: power ranges table
  function renderPowerRanges() {
    prTableBody.innerHTML = "";
    powerRanges.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.min_power}</td><td>${
        r.max_power === null ? "" : r.max_power
      }</td><td>${r.percentage}</td>
            <td>
              <button class="pr-edit" data-idx="${idx}">Edit</button>
              <button class="pr-delete" data-idx="${idx}">Delete</button>
            </td>`;
      prTableBody.appendChild(tr);
    });
    prTableBody.querySelectorAll(".pr-edit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = Number(e.currentTarget.dataset.idx);
        const r = powerRanges[i];
        prMin.value = r.min_power;
        prMax.value = r.max_power === null ? "" : r.max_power;
        prPercent.value = r.percentage;
        prAddBtn.dataset.editIdx = i;
        prAddBtn.textContent = "Update";
      });
    });
    prTableBody.querySelectorAll(".pr-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const i = Number(e.currentTarget.dataset.idx);
        if (!confirm("Delete this range?")) return;
        powerRanges.splice(i, 1);
        await savePowerRangesToStorage();
        renderPowerRanges();
      });
    });
  }

  prAddBtn.addEventListener("click", async () => {
    const minv = parseInt(prMin.value, 10);
    if (Number.isNaN(minv)) return alert("Min power must be an integer");
    const maxRaw = prMax.value.trim();
    const maxv =
      maxRaw === ""
        ? null
        : Number.isInteger(Number(maxRaw))
        ? parseInt(maxRaw, 10)
        : null;
    const perc = parseFloat(prPercent.value);
    if (Number.isNaN(perc)) return alert("Percentage required (e.g. 0.6)");

    const item = { min_power: minv, max_power: maxv, percentage: perc };

    if (prAddBtn.dataset.editIdx !== undefined) {
      const idx = Number(prAddBtn.dataset.editIdx);
      powerRanges[idx] = item;
      delete prAddBtn.dataset.editIdx;
      prAddBtn.textContent = "Add / Update";
    } else {
      powerRanges.push(item);
    }
    await savePowerRangesToStorage();
    renderPowerRanges();
    prMin.value = prMax.value = prPercent.value = "";
  });

  prSaveBtn.addEventListener("click", async () => {
    await savePowerRangesToStorage();
    renderPowerRanges();
  });

  // Utility: read spreadsheet file (.xlsx or .csv)
  async function readSpreadsheetFile(file) {
    if (!file) throw new Error("No file provided");
    const arrBuf = await file.arrayBuffer();
    const wb = XLSX.read(arrBuf, { type: "array" });
    const first = wb.SheetNames[0];
    const sheet = wb.Sheets[first];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
    // Normalize header keys: lowercase & trimmed & mapping to expected columns
    return json.map((row) => {
      const normalized = {};
      Object.keys(row).forEach((k) => {
        const key = String(k).trim().toLowerCase();
        const val = row[k];
        if (["character id", "id"].includes(key)) normalized.ID = val;
        else if (["username", "name"].includes(key)) normalized.Name = val;
        else if (["current power", "power"].includes(key))
          normalized.Power = val;
        else if (["total kill points", "killpoints", "kills"].includes(key))
          normalized.Killpoints = val;
        else if (["deaths", "deads"].includes(key)) normalized.Deads = val;
        else if (["t4", "t4 kills", "tier 4 kills"].includes(key))
          normalized["T4 Kills"] = val;
        else if (["t5", "t5 kills", "tier 5 kills"].includes(key))
          normalized["T5 Kills"] = val;
        else if (
          ["ch", "city hall", "cityhall", "city hall level"].includes(key)
        )
          normalized.CH = val;
        else normalized[k] = val; // keep other columns if any
      });
      return normalized;
    });
  }

  // DKP logic
  function getMinDkpPercent(power) {
    for (const r of powerRanges) {
      if (r.max_power === null) {
        if (power >= r.min_power) return Number(r.percentage);
      } else {
        if (power >= r.min_power && power < r.max_power)
          return Number(r.percentage);
      }
    }
    return 0.6;
  }

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // return CH numeric or null
  function getChFromRow(row) {
    if (
      !row ||
      row.CH === undefined ||
      row.CH === null ||
      String(row.CH).trim() === ""
    )
      return null;
    const n = Number(row.CH);
    return Number.isFinite(n) ? n : null;
  }

  async function calculateDkp({ mode = "lilithdata" } = {}) {
    const f1 = file1El.files[0];
    const f2 = file2El.files[0];
    if (!f1 || !f2) return alert("Please select both files.");
    progressEl.value = 5;

    const [df1Raw, df2Raw] = await Promise.all([
      readSpreadsheetFile(f1),
      readSpreadsheetFile(f2),
    ]);
    progressEl.value = 20;

    const mapById = (arr) => {
      const m = {};
      arr.forEach((r) => {
        const idS = String(r.ID ?? "").trim();
        if (!idS) return;
        m[idS] = r;
      });
      return m;
    };

    const map1 = mapById(df1Raw);
    const map2 = mapById(df2Raw);

    progressEl.value = 35;

    // build list of all unique IDs
    const allIdsSet = new Set([...Object.keys(map1), ...Object.keys(map2)]);
    const allIds = Array.from(allIdsSet);

    // Filter IDs based on CH: skip if CH < 25 in both files (or missing in both)
    const filteredIds = allIds.filter((id) => {
      const ch1 = getChFromRow(map1[id]);
      const ch2 = getChFromRow(map2[id]);
      // If either CH is >= 25 -> include
      if ((ch1 !== null && ch1 >= 25) || (ch2 !== null && ch2 >= 25))
        return true;
      // otherwise skip
      return false;
    });

    const skippedCount = allIds.length - filteredIds.length;
    if (skippedCount > 0) {
      console.info(`Skipped ${skippedCount} IDs due to CH < 25 (or missing).`);
    }

    // Ensure min_dkp exists for filtered IDs
    await ensureMinDkpForIds(filteredIds, df1Raw, df2Raw, map1, map2);
    progressEl.value = 55;

    const results = [];
    const t4 = multipliers.t4,
      t5 = multipliers.t5,
      deads = multipliers.deads;

    for (const id of filteredIds) {
      const a = map1[id] || {};
      const b = map2[id] || {};
      const name = (b.Name ?? a.Name ?? "Missing") + "";
      const powerVal = safeNum(b.Power ?? a.Power ?? 0);
      let t4g = 0,
        t5g = 0,
        deg = 0,
        kp = 0;
      if (mode === "default") {
        t4g = safeNum(b["T4 Kills"]) - safeNum(a["T4 Kills"]);
        t5g = safeNum(b["T5 Kills"]) - safeNum(a["T5 Kills"]);
        deg = safeNum(b.Deads) - safeNum(a.Deads);
        kp = safeNum(b.Killpoints) - safeNum(a.Killpoints);
      } else {
        t4g = safeNum(b["T4 Kills"]);
        t5g = safeNum(b["T5 Kills"]);
        deg = safeNum(b.Deads);
        kp = safeNum(b.Killpoints);
      }

      const minDkp =
        minDkpMap[id] !== undefined
          ? Number(minDkpMap[id])
          : Math.round(powerVal * getMinDkpPercent(powerVal));
      const DKP = Math.round(t4g * t4 + t5g * t5 + deg * deads);
      const DKPpercent = minDkp ? DKP / minDkp : 0;

      const status =
        a.Power === undefined || a.Power === null || a.Power === ""
          ? "missing in start"
          : b.Power === undefined || b.Power === null || b.Power === ""
          ? "missing in new"
          : "OK";

      const vacation = vacationList.includes(id) ? "YES" : "NO";

      // Build the row object
      const row = {
        ID: id,
        Name: name,
        Power: powerVal,

        "KP gained": Math.round(kp),
        "T4 gained": Math.round(t4g),
        "T5 gained": Math.round(t5g),
        "Deads gained": Math.round(deg),

        "Min DKP": Math.round(minDkp),
        DKP: Math.round(DKP),
        "DKP%": Number.isFinite(DKPpercent) ? Number(DKPpercent.toFixed(4)) : 0,
        Vacation: vacation,
        Status: status,

        // Full totals
        "T4 Kills": safeNum(a["T4 Kills"]),
        "T5 Kills": safeNum(a["T5 Kills"]),
        Killpoints: safeNum(a.Killpoints),
        Deads: safeNum(a.Deads),

        "Power diff": Math.round(safeNum(b.Power) - safeNum(a.Power)),
      };

      // Zero out all stats if user is missing in either scan
      if (status === "missing in start" || status === "missing in new") {
        Object.keys(row).forEach((k) => {
          if (!["ID", "Name", "Power", "Status", "Vacation"].includes(k)) {
            row[k] = 0;
          }
        });
      }

      results.push(row);
    }

    results.sort((x, y) => y.DKP - x.DKP);

    lastResults = results;
    renderResultsTable(results);
    progressEl.value = 100;
    resultsInfo.textContent = `Calculated ${results.length} rows (skipped ${skippedCount} due to CH<25).`;
  }

  // Ensure min_dkp exists only for filtered IDs
  async function ensureMinDkpForIds(allIds, df1, df2, map1, map2) {
    const toInsert = [];
    for (const gid of allIds) {
      const gidStr = String(gid).trim();
      if (gidStr === "") continue;
      if (minDkpMap[gidStr] !== undefined) continue;
      // find power in df1 then df2
      const findPower = (arr, map) => {
        const row =
          (map && map[gidStr]) ||
          arr.find(
            (r) =>
              String(r.ID).trim() === gidStr &&
              r.Power != null &&
              r.Power !== ""
          );
        if (!row) return null;
        const p = Number(row.Power);
        return Number.isFinite(p) ? p : null;
      };
      let power = findPower(df1, map1);
      if (power === null) power = findPower(df2, map2);
      if (power === null) {
        console.warn(
          `[DKP] No Power for ID ${gidStr} — skipping min_dkp calculation`
        );
        continue;
      }
      const perc = getMinDkpPercent(power);
      const minDkp = Math.round(power * perc);
      minDkpMap[gidStr] = minDkp;
      toInsert.push({ id: gidStr, minDkp });
    }
    if (toInsert.length) await saveMinDkpMap();
  }

  // Render results (table)
  function renderResultsTable(rows) {
    resultsWrap.innerHTML = "";
    if (!rows || rows.length === 0) {
      resultsInfo.textContent = "No results.";
      return;
    }
    const max = Math.min(rows.length, 15);
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const columns = Object.keys(rows[0]);
    thead.innerHTML =
      "<tr>" + columns.map((c) => `<th>${c}</th>`).join("") + "</tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (let i = 0; i < max; i++) {
      const r = rows[i];
      const tr = document.createElement("tr");
      tr.innerHTML = columns
        .map((c) => `<td>${String(r[c] ?? "")}</td>`)
        .join("");
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    resultsWrap.appendChild(table);
  }

  // Export: XLSX / CSV / JSON
  function exportToXlsx(rows) {
    if (!rows) return alert("No results to export.");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DKP");
    XLSX.writeFile(
      wb,
      `dkp_output_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`
    );
  }
  function exportToCsv(rows) {
    if (!rows) return alert("No results to export.");

    const columns = Object.keys(rows[0]);
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`; // proper CSV escaping

    const csv =
      columns.map(escape).join(",") +
      "\n" +
      rows
        .map((row) => columns.map((col) => escape(row[col])).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `merge_output_${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportToJson(rows) {
    if (!rows) return alert("No results to export.");

    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `merge_output_${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Settings export/import
  async function exportSettings() {
    const payload = {
      multipliers,
      power_ranges: powerRanges,
      vacation_list: vacationList,
      min_dkp: minDkpMap,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dkp_settings_${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  importSettingsBtn.addEventListener("click", () => importSettingsFile.click());
  importSettingsFile.addEventListener("change", async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt);
      // Basic validation
      if (!parsed || typeof parsed !== "object")
        throw new Error("Invalid file format.");
      // accept keys (multipliers, power_ranges, vacation_list, min_dkp)
      if (parsed.multipliers) {
        multipliers = parsed.multipliers;
        await localforage.setItem(KEY_MULT, multipliers);
      }
      if (Array.isArray(parsed.power_ranges)) {
        powerRanges = parsed.power_ranges;
        await localforage.setItem(KEY_PR, powerRanges);
      }
      if (Array.isArray(parsed.vacation_list)) {
        vacationList = parsed.vacation_list;
        await localforage.setItem(KEY_VAC, vacationList);
      }
      if (parsed.min_dkp && typeof parsed.min_dkp === "object") {
        minDkpMap = parsed.min_dkp;
        await localforage.setItem(KEY_MIN, minDkpMap);
      }
      alert("Settings imported successfully.");
      // refresh UI
      populateUIFromMemory();
    } catch (err) {
      console.error(err);
      alert("Failed to import settings: " + (err.message || err));
    } finally {
      importSettingsFile.value = ""; // reset
    }
  });

  // Init wiring
  async function init() {
    await loadAllFromStorage();

    populateUIFromMemory();
    renderPowerRanges();
    progressEl.value = 0;
    resultsInfo.textContent = "Ready.";
  }

  function populateUIFromMemory() {
    t4El.value = multipliers.t4 ?? 0;
    t5El.value = multipliers.t5 ?? 0;
    deadsEl.value = multipliers.deads ?? 0;
    vacInput.value = (vacationList || []).join(", ");
  }

  saveMultBtn.addEventListener("click", saveMultipliers);
  vacSaveBtn.addEventListener("click", saveVacationList);
  vacClearBtn.addEventListener("click", clearVacationList);

  runBtn.addEventListener("click", async () => {
    multipliers.t4 = parseFloat(t4El.value) || 0;
    multipliers.t5 = parseFloat(t5El.value) || 0;
    multipliers.deads = parseFloat(deadsEl.value) || 0;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    progressEl.value = 2;
    try {
      await calculateDkp({ mode });
      await saveMinDkpMap();
    } catch (err) {
      console.error(err);
      alert("Error during calculation: " + (err.message || err));
    } finally {
      progressEl.value = 100;
    }
  });

  exportX.addEventListener("click", () => exportToXlsx(lastResults));
  exportC.addEventListener("click", () => exportToCsv(lastResults));
  exportJ.addEventListener("click", () => exportToJson(lastResults));

  exportSettingsBtn.addEventListener("click", exportSettings);
  clearMinBtn.addEventListener("click", clearAllMinDkp);

  // initial load
  init().catch((err) => console.error("Init error", err));

  /* -------------------------
   THEME HANDLING
   ------------------------- */
  function setTheme(mode) {
    document.body.classList.remove("dark", "light");
    if (mode === "dark") document.body.classList.add("dark");
    if (mode === "light") document.body.classList.add("light");
    localStorage.setItem("theme", mode);
  }

  function initializeTheme(toggleEl) {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setTheme("dark");
      if (toggleEl) toggleEl.checked = true;
      return;
    }
    if (saved === "light") {
      setTheme("light");
      if (toggleEl) toggleEl.checked = false;
      return;
    }
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
    if (toggleEl) toggleEl.checked = prefersDark;
  }
  // Theme init & toggle
  initializeTheme(themeToggle);
  if (themeToggle) {
    themeToggle.addEventListener("change", (e) => {
      setTheme(e.target.checked ? "dark" : "light");
    });
  }

  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");
  hamburger.addEventListener("click", () => navLinks.classList.toggle("show"));
})();
