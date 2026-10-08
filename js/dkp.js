(() => {
  localforage.config({ name: "dkp_web_app" });

  const KEY_MULT = "multipliers";
  const KEY_PR = "power_ranges";
  const KEY_VAC = "vacation_list";
  const KEY_MIN = "min_dkp";

  const t4El = document.getElementById("t4");
  const t5El = document.getElementById("t5");
  const deadsEl = document.getElementById("deads");
  const saveMultBtn = document.getElementById("save-multipliers");

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
  const resultsInfo = document.getElementById("results-info");

  const exportX = document.getElementById("export-xlsx");
  const exportC = document.getElementById("export-csv");
  const exportJ = document.getElementById("export-json");

  const exportSettingsBtn = document.getElementById("export-settings");
  const importSettingsBtn = document.getElementById("import-settings");
  const importSettingsFile = document.getElementById("import-settings-file");
  const clearMinBtn = document.getElementById("clear-min-dkp");

  const ignoreChEl = document.getElementById("ignore-ch");

  let powerRanges = [];
  let multipliers = { t4: 0.0, t5: 0.0, deads: 0.0 };
  let vacationList = [];
  let minDkpMap = {};
  let lastResults = null;
  let skippedCount = 0;
  let farmLinksPromise = null;

  function setExportEnabled(enabled) {
    ["export-xlsx", "export-csv", "export-json"].forEach((id) => {
      document.getElementById(id).disabled = !enabled;
    });
  }

  setExportEnabled(false);

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
    showToast("Multipliers saved locally.");
  }

  async function savePowerRangesToStorage() {
    powerRanges.sort((a, b) => a.min_power - b.min_power);
    await localforage.setItem(KEY_PR, powerRanges);
    showToast("Power ranges saved locally.");
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
    showToast("Vacation list saved.");
  }

  async function clearVacationList() {
    if (!confirm("Clear vacation list (set to empty)?")) return;
    vacationList = [];
    vacInput.value = "";
    await localforage.setItem(KEY_VAC, vacationList);
    showToast("Vacation list cleared.");
  }

  async function saveMinDkpMap() {
    await localforage.setItem(KEY_MIN, minDkpMap);
  }

  async function clearAllMinDkp() {
    if (!confirm("Are you sure? This will remove all stored Min DKP values."))
      return;
    await localforage.removeItem(KEY_MIN);
    minDkpMap = {};
    showToast("All Min DKP values cleared.");
  }

  function validatePowerRange(newItem, ranges, editingIdx = null) {
    const others = ranges.filter((_, i) => i !== editingIdx);

    for (const r of others) {
      const rMin = r.min_power;
      const rMax = r.max_power ?? Infinity;
      const nMin = newItem.min_power;
      const nMax = newItem.max_power ?? Infinity;
      const overlaps = nMin <= rMax && nMax >= rMin;
      if (overlaps) {
        return `Range ${nMin}-${newItem.max_power ?? "∞"} overlaps with existing range ${rMin}-${r.max_power ?? "∞"}.`;
      }
      if (newItem.max_power === null) {
        const hasInfinity = ranges.some(
          (r, i) => i !== editingIdx && r.max_power === null,
        );
        if (hasInfinity) {
          return "Only one open-ended (∞) range is allowed.";
        }
      }
    }
    return null;
  }

  function renderPowerRanges() {
    const rowActions = (idx, type) =>
      type === "display"
        ? `<button class="primary pr-edit" data-idx="${idx}">Edit</button>
           <button class="secondary pr-delete" data-idx="${idx}">Delete</button>`
        : "";
    createSiteTable(document.querySelector("#power-table"), {
      plain: true,
      columns: [
        { title: "Min Power" },
        { title: "Max Power" },
        { title: "%" },
        { title: "Actions", render: rowActions, orderable: false },
      ],
      // last cell is the row's index in powerRanges, used by the buttons
      data: powerRanges.map((r, i) => [r.min_power, r.max_power, r.percentage, i]),
    });
  }

  document.querySelector("#power-table").addEventListener("click", async (e) => {
    const btn = e.target.closest(".pr-edit, .pr-delete");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const row = powerRanges[idx];
    if (!row) return;

    if (btn.classList.contains("pr-edit")) {
      prMin.value = row.min_power;
      prMax.value = row.max_power ?? "";
      prPercent.value = row.percentage;
      prAddBtn.dataset.editIdx = idx;
      prAddBtn.textContent = "Update";
    } else {
      if (!confirm("Delete this range?")) return;
      powerRanges.splice(idx, 1);
      await savePowerRangesToStorage();
      renderPowerRanges();
    }
  });

  prAddBtn.addEventListener("click", async () => {
    const minv = parseInt(prMin.value, 10);
    if (Number.isNaN(minv)) return showToast("Min power must be an integer");

    const maxRaw = prMax.value.trim();
    const maxv =
      maxRaw === ""
        ? null
        : /^-?\d+$/.test(maxRaw)
          ? parseInt(maxRaw, 10)
          : null;
    if (maxRaw !== "" && maxv === null) {
      return showToast("Max power must be an integer or left empty.");
    }
    if (maxv !== null && maxv < minv) {
      return showToast("Max power must be greater than or equal to Min power.");
    }

    const perc = parseFloat(prPercent.value);
    if (Number.isNaN(perc)) return showToast("Percentage required (e.g. 0.6)");

    const item = { min_power: minv, max_power: maxv, percentage: perc };
    const editIdx =
      "editIdx" in prAddBtn.dataset ? Number(prAddBtn.dataset.editIdx) : null;
    const error = validatePowerRange(item, powerRanges, editIdx);
    if (error) {
      showToast(
        error +
          "\n\nExample fix:\nIf last range ends at 100, next should start at 101.",
      );
      return;
    }

    if (editIdx !== null) {
      powerRanges[editIdx] = item;
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

  async function readSpreadsheetFile(file) {
    if (!file) throw new Error("No file provided");
    const arrBuf = await file.arrayBuffer();
    const wb = XLSX.read(arrBuf, { type: "array" });
    const first = wb.SheetNames[0];
    const sheet = wb.Sheets[first];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

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
        else if (["acclaim"].includes(key)) normalized["Acclaim"] = val;
        else normalized[k] = val;
      });
      return normalized;
    });
  }

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

  function isVacationRow(row) {
    return vacationList.includes(String(row?.ID ?? "").trim());
  }

  function loadFarmLinks() {
    if (farmLinksPromise) return farmLinksPromise;

    farmLinksPromise = (async () => {
      if (!window.initSqlJs) return new Map();

      const SQL = await getSqlJs();
      const res = await fetch("kvk.db", { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load kvk.db (${res.status})`);

      const buffer = await res.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(buffer));
      const links = new Map();

      try {
        const farmRes = db.exec(`
          SELECT player_id, main_id
          FROM farm_accounts
          WHERE lower(coalesce(acc_type, ''))='farm'
            AND main_id IS NOT NULL
            AND main_id != ''
        `);

        if (farmRes.length) {
          farmRes[0].values.forEach(([farmIdRaw, mainIdRaw]) => {
            const farmId = normalizeNumericId(farmIdRaw);
            const mainId = normalizeNumericId(mainIdRaw);
            if (!farmId || !mainId || farmId === mainId) return;
            if (!links.has(mainId)) links.set(mainId, []);
            links.get(mainId).push(farmId);
          });
        }
      } finally {
        db.close();
      }

      return links;
    })().catch((err) => {
      console.warn("[DKP] Farm rollup unavailable:", err);
      return new Map();
    });

    return farmLinksPromise;
  }

  async function applyFarmRollups(rows) {
    const byId = new Map();
    rows.forEach((row) => {
      const id = normalizeNumericId(row.ID);
      if (id) byId.set(id, row);
    });

    rows.forEach((row) => {
      if (isVacationRow(row)) return;
      row["Sum Min DKP"] = Math.round(safeNum(row["Min DKP"]));
      row["Sum DKP"] = Math.round(safeNum(row.DKP));
      row["Sum DKP%"] = row["Sum Min DKP"]
        ? Number((row["Sum DKP"] / row["Sum Min DKP"]).toFixed(4))
        : 0;
    });

    const links = await loadFarmLinks();
    links.forEach((farmIds, mainId) => {
      const main = byId.get(mainId);
      if (!main || isVacationRow(main)) return;

      let sumMinDkp = safeNum(main["Min DKP"]);
      let sumDkp = safeNum(main.DKP);

      farmIds.forEach((farmId) => {
        const farm = byId.get(farmId);
        if (!farm || isVacationRow(farm)) return;
        sumMinDkp += safeNum(farm["Min DKP"]);
        sumDkp += safeNum(farm.DKP);
      });

      main["Sum Min DKP"] = Math.round(sumMinDkp);
      main["Sum DKP"] = Math.round(sumDkp);
      main["Sum DKP%"] = sumMinDkp
        ? Number((sumDkp / sumMinDkp).toFixed(4))
        : 0;
    });
  }

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
    setExportEnabled(false);
    const f1 = file1El.files[0];
    const f2 = file2El.files[0];
    if (!f1 || !f2) return showToast("Please select both files.");
    if (!/\.xlsx$/i.test(f1.name) || !/\.xlsx$/i.test(f2.name)) {
      return showToast("Please select .xlsx files only.");
    }
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

    const allIdsSet = new Set([...Object.keys(map1), ...Object.keys(map2)]);
    const allIds = Array.from(allIdsSet);
    let filteredIds;

    if (ignoreChEl.checked) {
      filteredIds = allIds;
      skippedCount = 0;
    } else {
      filteredIds = allIds.filter((id) => {
        const ch1 = getChFromRow(map1[id]);
        const ch2 = getChFromRow(map2[id]);
        if ((ch1 !== null && ch1 >= 25) || (ch2 !== null && ch2 >= 25))
          return true;
        return false;
      });

      skippedCount = allIds.length - filteredIds.length;
    }

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
        deg =
          safeNum(b["T1 Deaths"]) +
          safeNum(b["T2 Deaths"]) +
          safeNum(b["T3 Deaths"]) +
          safeNum(b["T4 Deaths"]) +
          safeNum(b["T5 Deaths"]);
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
        "Sum Min DKP": 0,
        "Sum DKP": 0,
        "Sum DKP%": 0,
        Status: status,
        "T4 Kills": safeNum(b["T4 Kills"] ?? a["T4 Kills"]),
        "T5 Kills": safeNum(b["T5 Kills"] ?? a["T5 Kills"]),
        Killpoints: safeNum(b.Killpoints ?? a.Killpoints),
        Deads: safeNum(b.Deads ?? a.Deads),
        "Power diff": Math.round(safeNum(b.Power) - safeNum(a.Power)),
        Acclaim: safeNum(b["Acclaim"]),
        Vacation: isVacationRow({ ID: id }) ? "YES" : "NO",
      };

      if (status === "missing in start" || status === "missing in new") {
        Object.keys(row).forEach((k) => {
          if (!["ID", "Name", "Power", "Status", "Vacation"].includes(k)) {
            row[k] = 0;
          }
        });
      }

      results.push(row);
    }

    await applyFarmRollups(results);

    const visibleResults = results;

    visibleResults.sort((x, y) => y.DKP - x.DKP);

    lastResults = visibleResults;
    if (!visibleResults || visibleResults.length === 0) {
      setExportEnabled(false);
      return;
    }
    createResultsGrid(visibleResults);
    setExportEnabled(true);
    progressEl.value = 100;
    resultsInfo.textContent = `Calculated ${visibleResults.length} rows (skipped ${skippedCount} due to CH<25).`;
  }

  async function ensureMinDkpForIds(allIds, df1, df2, map1, map2) {
    const toInsert = [];
    for (const gid of allIds) {
      const gidStr = String(gid).trim();
      if (gidStr === "") continue;
      if (minDkpMap[gidStr] !== undefined) continue;

      const findPower = (arr, map) => {
        const row =
          (map && map[gidStr]) ||
          arr.find(
            (r) =>
              String(r.ID).trim() === gidStr &&
              r.Power != null &&
              r.Power !== "",
          );
        if (!row) return null;
        const p = Number(row.Power);
        return Number.isFinite(p) ? p : null;
      };
      let power = findPower(df1, map1);
      if (power === null) power = findPower(df2, map2);
      if (power === null) {
        console.warn(
          `[DKP] No Power for ID ${gidStr} — skipping min_dkp calculation`,
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

  function createResultsGrid(rows) {
    if (!rows || !rows.length) return;
    const el = document.querySelector("#result-table");
    el.style.display = "block";
    const { keys, data } = objectsToRows(rows);
    createSiteTable(el, { columns: keys.map((k) => ({ title: k })), data });
  }

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
    a.download = `dkp-settings-${getExportTimestamp()}.json`;
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

      if (!parsed || typeof parsed !== "object")
        throw new Error("Invalid file format.");
      if (parsed.multipliers) {
        multipliers = parsed.multipliers;
        await localforage.setItem(KEY_MULT, multipliers);
      }
      if (Array.isArray(parsed.power_ranges)) {
        powerRanges = parsed.power_ranges;
        await localforage.setItem(KEY_PR, powerRanges);
        renderPowerRanges();
      }
      if (Array.isArray(parsed.vacation_list)) {
        vacationList = parsed.vacation_list;
        await localforage.setItem(KEY_VAC, vacationList);
      }
      if (parsed.min_dkp && typeof parsed.min_dkp === "object") {
        minDkpMap = parsed.min_dkp;
        await localforage.setItem(KEY_MIN, minDkpMap);
      }
      showToast("Settings imported successfully.");
      populateUIFromMemory();
    } catch (err) {
      console.error(err);
      showToast("Failed to import settings: " + (err.message || err));
    } finally {
      importSettingsFile.value = "";
    }
  });

  async function init() {
    await loadAllFromStorage();

    populateUIFromMemory();
    renderPowerRanges();
    progressEl.value = 0;

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
      showToast("Error during calculation: " + (err.message || err));
    } finally {
      progressEl.value = 100;
    }
  });

  exportX.addEventListener("click", () => exportToXlsx(lastResults, "dkp"));
  exportC.addEventListener("click", () => exportToCsv(lastResults, "dkp"));
  exportJ.addEventListener("click", () => exportToJson(lastResults, "dkp"));

  exportSettingsBtn.addEventListener("click", exportSettings);
  clearMinBtn.addEventListener("click", clearAllMinDkp);

  init().catch((err) => console.error("Init error", err));

})();
