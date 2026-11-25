(() => {
  localforage.config({ name: "dkp_web_app" });

  const KEY_MULTIPLIERS = "multipliers";
  const KEY_POWER_RANGES = "power_ranges";
  const KEY_VACATION_LIST = "vacation_list";
  const KEY_MIN_DKP = "min_dkp";
  const KEY_MIN_DKP_SIG = "min_dkp_signature";

  const t4Element = document.getElementById("t4");
  const t5Element = document.getElementById("t5");
  const deadsElement = document.getElementById("deads");
  const saveMultiplierButton = document.getElementById("save-multipliers");

  const powerRangeMin = document.getElementById("pr-min");
  const powerRangeMax = document.getElementById("pr-max");
  const powerRangePercent = document.getElementById("pr-percent");
  const powerRangeAddButton = document.getElementById("pr-add");
  const powerRangeSaveButton = document.getElementById("pr-save");

  const vacationInput = document.getElementById("vacation-input");
  const vacationSaveButton = document.getElementById("vac-save");
  const vacationClearButton = document.getElementById("vac-clear");

  const file1Element = document.getElementById("file1");
  const file2Element = document.getElementById("file2");
  const runButton = document.getElementById("run-dkp");
  const progressElement = document.getElementById("progress");
  const resultsInfo = document.getElementById("results-info");

  const exportX = document.getElementById("export-xlsx");
  const exportC = document.getElementById("export-csv");
  const exportJ = document.getElementById("export-json");

  const exportSettingsButton = document.getElementById("export-settings");
  const importSettingsButton = document.getElementById("import-settings");
  const importSettingsFile = document.getElementById("import-settings-file");
  const clearMinButton = document.getElementById("clear-min-dkp");

  const ignoreCityHallElement = document.getElementById("ignore-ch");

  let powerRanges = [];
  let multipliers = { t4: 0.0, t5: 0.0, deads: 0.0 };
  let vacationList = [];
  let minDkpMap = {};
  let minDkpSignature = null;
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
    const savedMultipliers = await localforage.getItem(KEY_MULTIPLIERS);
    if (savedMultipliers) multipliers = savedMultipliers;
    const savedPowerRanges = await localforage.getItem(KEY_POWER_RANGES);
    if (Array.isArray(savedPowerRanges)) powerRanges = savedPowerRanges.slice();
    const savedVacationList = await localforage.getItem(KEY_VACATION_LIST);
    if (Array.isArray(savedVacationList)) vacationList = savedVacationList.slice();
    const savedMinDkpMap = await localforage.getItem(KEY_MIN_DKP);
    if (savedMinDkpMap && typeof savedMinDkpMap === "object") minDkpMap = savedMinDkpMap;
    const savedSignature = await localforage.getItem(KEY_MIN_DKP_SIG);
    minDkpSignature = typeof savedSignature === "string" ? savedSignature : null;
  }

  function getPowerRangesSignature() {
    return JSON.stringify(
      powerRanges
        .map((range) => [
          Number(range.min_power),
          range.max_power === null || range.max_power === undefined ? null : Number(range.max_power),
          Number(range.percentage),
        ])
        .sort((a, b) => a[0] - b[0]),
    );
  }

  async function saveMultipliers() {
    multipliers = {
      t4: parseFloat(t4Element.value) || 0,
      t5: parseFloat(t5Element.value) || 0,
      deads: parseFloat(deadsElement.value) || 0,
    };
    await localforage.setItem(KEY_MULTIPLIERS, multipliers);
    showToast("Multipliers saved locally.");
  }

  async function savePowerRangesToStorage() {
    powerRanges.sort((firstPowerRange, secondPowerRange) => firstPowerRange.min_power - secondPowerRange.min_power);
    await localforage.setItem(KEY_POWER_RANGES, powerRanges);
    showToast("Power ranges saved locally.");
  }

  async function saveVacationList() {
    const raw = vacationInput.value.trim();
    if (!raw) {
      vacationList = [];
    } else {
      vacationList = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    await localforage.setItem(KEY_VACATION_LIST, vacationList);
    showToast("Vacation list saved.");
  }

  async function clearVacationList() {
    if (!confirm("Clear vacation list (set to empty)?")) return;
    vacationList = [];
    vacationInput.value = "";
    await localforage.setItem(KEY_VACATION_LIST, vacationList);
    showToast("Vacation list cleared.");
  }

  async function saveMinDkpMap() {
    await localforage.setItem(KEY_MIN_DKP, minDkpMap);
    await localforage.setItem(KEY_MIN_DKP_SIG, minDkpSignature);
  }

  async function clearAllMinDkp() {
    if (!confirm("Are you sure? This will remove all stored Min DKP values."))
      return;
    await localforage.removeItem(KEY_MIN_DKP);
    await localforage.removeItem(KEY_MIN_DKP_SIG);
    minDkpMap = {};
    minDkpSignature = null;
    showToast("All Min DKP values cleared.");
  }

  function validatePowerRange(newItem, ranges, editingIndex = null) {
    const others = ranges.filter((_, index) => index !== editingIndex);

    for (const otherRange of others) {
      const rMin = otherRange.min_power;
      const rMax = otherRange.max_power ?? Infinity;
      const nMin = newItem.min_power;
      const nMax = newItem.max_power ?? Infinity;
      const overlaps = nMin <= rMax && nMax >= rMin;
      if (overlaps) {
        return `Range ${nMin}-${newItem.max_power ?? "∞"} overlaps with existing range ${rMin}-${otherRange.max_power ?? "∞"}.`;
      }
      if (newItem.max_power === null) {
        const hasInfinity = ranges.some(
          (range, index) => index !== editingIndex && range.max_power === null,
        );
        if (hasInfinity) {
          return "Only one open-ended (∞) range is allowed.";
        }
      }
    }
    return null;
  }

  function renderPowerRanges() {
    const rowActions = (index, type) =>
      type === "display"
        ? `<button class="primary pr-edit" data-idx="${index}">Edit</button>
           <button class="secondary pr-delete" data-idx="${index}">Delete</button>`
        : "";
    createSiteTable(document.querySelector("#power-table"), {
      plain: true,
      columns: [
        { title: "Min Power" },
        { title: "Max Power" },
        { title: "%" },
        { title: "Actions", render: rowActions, orderable: false },
      ],
      data: powerRanges.map((powerRange, index) => [powerRange.min_power, powerRange.max_power, powerRange.percentage, index]),
    });
  }

  document.querySelector("#power-table").addEventListener("click", async (event) => {
    const button = event.target.closest(".pr-edit, .pr-delete");
    if (!button) return;
    const index = Number(button.dataset.idx);
    const row = powerRanges[index];
    if (!row) return;

    if (button.classList.contains("pr-edit")) {
      powerRangeMin.value = row.min_power;
      powerRangeMax.value = row.max_power ?? "";
      powerRangePercent.value = row.percentage;
      powerRangeAddButton.dataset.editIdx = index;
      powerRangeAddButton.textContent = "Update";
    } else {
      if (!confirm("Delete this range?")) return;
      powerRanges.splice(index, 1);
      await savePowerRangesToStorage();
      renderPowerRanges();
    }
  });

  powerRangeAddButton.addEventListener("click", async () => {
    const minv = parseInt(powerRangeMin.value, 10);
    if (Number.isNaN(minv)) return showToast("Min power must be an integer");

    const maxRaw = powerRangeMax.value.trim();
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

    const percent = parseFloat(powerRangePercent.value);
    if (Number.isNaN(percent)) return showToast("Percentage required (e.g. 0.6)");

    const item = { min_power: minv, max_power: maxv, percentage: percent };
    const editIndex =
      "editIdx" in powerRangeAddButton.dataset ? Number(powerRangeAddButton.dataset.editIdx) : null;
    const error = validatePowerRange(item, powerRanges, editIndex);
    if (error) {
      showToast(
        error +
          "\n\nExample fix:\nIf last range ends at 100, next should start at 101.",
      );
      return;
    }

    if (editIndex !== null) {
      powerRanges[editIndex] = item;
      delete powerRangeAddButton.dataset.editIdx;
      powerRangeAddButton.textContent = "Add / Update";
    } else {
      powerRanges.push(item);
    }

    await savePowerRangesToStorage();
    renderPowerRanges();

    powerRangeMin.value = powerRangeMax.value = powerRangePercent.value = "";
  });

  powerRangeSaveButton.addEventListener("click", async () => {
    await savePowerRangesToStorage();
    renderPowerRanges();
  });

  async function readSpreadsheetFile(file) {
    if (!file) throw new Error("No file provided");
    const arrBuf = await file.arrayBuffer();
    const workbook = XLSX.read(arrBuf, { type: "array" });
    const first = workbook.SheetNames[0];
    const sheet = workbook.Sheets[first];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

    return json.map((row) => {
      const normalized = {};
      Object.keys(row).forEach((columnKey) => {
        const key = String(columnKey).trim().toLowerCase();
        const value = row[columnKey];
        if (["character id", "id"].includes(key)) normalized.ID = value;
        else if (["username", "name"].includes(key)) normalized.Name = value;
        else if (["current power", "power"].includes(key))
          normalized.Power = value;
        else if (["total kill points", "killpoints", "kills"].includes(key))
          normalized.Killpoints = value;
        else if (["deaths", "deads"].includes(key)) normalized.Deads = value;
        else if (["t4", "t4 kills", "tier 4 kills"].includes(key))
          normalized["T4 Kills"] = value;
        else if (["t5", "t5 kills", "tier 5 kills"].includes(key))
          normalized["T5 Kills"] = value;
        else if (
          ["ch", "city hall", "cityhall", "city hall level"].includes(key)
        )
          normalized.CH = value;
        else if (["acclaim"].includes(key)) normalized["Acclaim"] = value;
        else normalized[columnKey] = value;
      });
      return normalized;
    });
  }

  function getMinDkpPercent(power) {
    for (const powerRange of powerRanges) {
      if (powerRange.max_power === null) {
        if (power >= powerRange.min_power) return Number(powerRange.percentage);
      } else {
        if (power >= powerRange.min_power && power <= powerRange.max_power)
          return Number(powerRange.percentage);
      }
    }
    return 0.6;
  }

  function safeNumber(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  function isVacationRow(row) {
    return vacationList.includes(String(row?.ID ?? "").trim());
  }

  function loadFarmLinks() {
    if (farmLinksPromise) return farmLinksPromise;

    farmLinksPromise = (async () => {
      const rows = await supabaseSelectAll(
        "farm_accounts",
        "select=player_id,main_id&acc_type=ilike.farm&main_id=not.is.null&order=player_id.asc",
      );
      const links = new Map();
      rows.forEach(({ player_id, main_id }) => {
        const farmId = normalizeNumericId(player_id);
        const mainId = normalizeNumericId(main_id);
        if (!farmId || !mainId || farmId === mainId) return;
        if (!links.has(mainId)) links.set(mainId, []);
        links.get(mainId).push(farmId);
      });
      return links;
    })().catch((error) => {
      console.warn("[DKP] Farm rollup unavailable:", error);
      farmLinksPromise = null;
      showToast(
        "Could not load farm accounts, so the Sum columns will NOT include farms. Run the calculation again.",
        "error",
        10000,
      );
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
      row["Sum Min DKP"] = Math.round(safeNumber(row["Min DKP"]));
      row["Sum DKP"] = Math.round(safeNumber(row.DKP));
      row["Sum DKP%"] = row["Sum Min DKP"]
        ? Number((row["Sum DKP"] / row["Sum Min DKP"]).toFixed(4))
        : 0;
    });

    const links = await loadFarmLinks();
    links.forEach((farmIds, mainId) => {
      const main = byId.get(mainId);
      if (!main || isVacationRow(main)) return;

      let sumMinDkp = safeNumber(main["Min DKP"]);
      let sumDkp = safeNumber(main.DKP);

      farmIds.forEach((farmId) => {
        const farm = byId.get(farmId);
        if (!farm || isVacationRow(farm)) return;
        sumMinDkp += safeNumber(farm["Min DKP"]);
        sumDkp += safeNumber(farm.DKP);
      });

      main["Sum Min DKP"] = Math.round(sumMinDkp);
      main["Sum DKP"] = Math.round(sumDkp);
      main["Sum DKP%"] = sumMinDkp
        ? Number((sumDkp / sumMinDkp).toFixed(4))
        : 0;
    });
  }

  function getCityHallLevelFromRow(row) {
    if (
      !row ||
      row.CH === undefined ||
      row.CH === null ||
      String(row.CH).trim() === ""
    )
      return null;
    const cityHallLevel = Number(row.CH);
    return Number.isFinite(cityHallLevel) ? cityHallLevel : null;
  }

  async function calculateDkp({ mode = "lilithdata" } = {}) {
    setExportEnabled(false);
    const firstFile = file1Element.files[0];
    const secondFile = file2Element.files[0];
    if (!firstFile || !secondFile) return showToast("Please select both files.");
    if (!/\.xlsx$/i.test(firstFile.name) || !/\.xlsx$/i.test(secondFile.name)) {
      return showToast("Please select .xlsx files only.");
    }
    progressElement.value = 5;

    const [df1Raw, df2Raw] = await Promise.all([
      readSpreadsheetFile(firstFile),
      readSpreadsheetFile(secondFile),
    ]);
    progressElement.value = 20;

    const mapById = (arr) => {
      const rowsById = {};
      arr.forEach((row) => {
        const idString = String(row.ID ?? "").trim();
        if (!idString) return;
        rowsById[idString] = row;
      });
      return rowsById;
    };

    const map1 = mapById(df1Raw);
    const map2 = mapById(df2Raw);

    progressElement.value = 35;

    const allIdsSet = new Set([...Object.keys(map1), ...Object.keys(map2)]);
    const allIds = Array.from(allIdsSet);
    let filteredIds;

    if (ignoreCityHallElement.checked) {
      filteredIds = allIds;
      skippedCount = 0;
    } else {
      filteredIds = allIds.filter((id) => {
        const firstCityHallLevel = getCityHallLevelFromRow(map1[id]);
        const secondCityHallLevel = getCityHallLevelFromRow(map2[id]);
        if ((firstCityHallLevel !== null && firstCityHallLevel >= 25) || (secondCityHallLevel !== null && secondCityHallLevel >= 25))
          return true;
        return false;
      });

      skippedCount = allIds.length - filteredIds.length;
    }

    await ensureMinDkpForIds(filteredIds, df1Raw, df2Raw, map1, map2);
    progressElement.value = 55;

    const results = [];
    const tier4Multiplier = multipliers.t4,
      tier5Multiplier = multipliers.t5,
      deadsMultiplier = multipliers.deads;

    for (const id of filteredIds) {
      const startRow = map1[id] || {};
      const endRow = map2[id] || {};
      const name = (endRow.Name ?? startRow.Name ?? "Missing") + "";
      const powerValue = safeNumber(endRow.Power ?? startRow.Power ?? 0);
      let tier4Gain = 0,
        tier5Gain = 0,
        deadsGain = 0,
        killPointsGain = 0;
      if (mode === "default") {
        tier4Gain = safeNumber(endRow["T4 Kills"]) - safeNumber(startRow["T4 Kills"]);
        tier5Gain = safeNumber(endRow["T5 Kills"]) - safeNumber(startRow["T5 Kills"]);
        deadsGain = safeNumber(endRow.Deads) - safeNumber(startRow.Deads);
        killPointsGain = safeNumber(endRow.Killpoints) - safeNumber(startRow.Killpoints);
      } else {
        tier4Gain = safeNumber(endRow["T4 Kills"]);
        tier5Gain = safeNumber(endRow["T5 Kills"]);
        deadsGain =
          safeNumber(endRow["T1 Deaths"]) +
          safeNumber(endRow["T2 Deaths"]) +
          safeNumber(endRow["T3 Deaths"]) +
          safeNumber(endRow["T4 Deaths"]) +
          safeNumber(endRow["T5 Deaths"]);
        killPointsGain = safeNumber(endRow.Killpoints);
      }

      const minDkp =
        minDkpMap[id] !== undefined
          ? Number(minDkpMap[id])
          : Math.round(powerValue * getMinDkpPercent(powerValue));
      const dkpScore = Math.round(tier4Gain * tier4Multiplier + tier5Gain * tier5Multiplier + deadsGain * deadsMultiplier);
      const dkpPercent = minDkp ? dkpScore / minDkp : 0;

      const status =
        startRow.Power === undefined || startRow.Power === null || startRow.Power === ""
          ? "missing in start"
          : endRow.Power === undefined || endRow.Power === null || endRow.Power === ""
            ? "missing in new"
            : "OK";

      const row = {
        ID: id,
        Name: name,
        Power: powerValue,
        "KP gained": Math.round(killPointsGain),
        "T4 gained": Math.round(tier4Gain),
        "T5 gained": Math.round(tier5Gain),
        "Deads gained": Math.round(deadsGain),
        "Min DKP": Math.round(minDkp),
        DKP: Math.round(dkpScore),
        "DKP%": Number.isFinite(dkpPercent) ? Number(dkpPercent.toFixed(4)) : 0,
        "Sum Min DKP": 0,
        "Sum DKP": 0,
        "Sum DKP%": 0,
        Status: status,
        "T4 Kills": safeNumber(endRow["T4 Kills"] ?? startRow["T4 Kills"]),
        "T5 Kills": safeNumber(endRow["T5 Kills"] ?? startRow["T5 Kills"]),
        Killpoints: safeNumber(endRow.Killpoints ?? startRow.Killpoints),
        Deads: safeNumber(endRow.Deads ?? startRow.Deads),
        "Power diff": Math.round(safeNumber(endRow.Power) - safeNumber(startRow.Power)),
        Acclaim: safeNumber(endRow["Acclaim"]),
        Vacation: isVacationRow({ ID: id }) ? "YES" : "NO",
      };

      if (status === "missing in start" || status === "missing in new") {
        Object.keys(row).forEach((key) => {
          if (!["ID", "Name", "Power", "Status", "Vacation"].includes(key)) {
            row[key] = 0;
          }
        });
      }
      results.push(row);
    }

    await applyFarmRollups(results);

    const visibleResults = results;

    visibleResults.sort((firstVisibleResult, secondVisibleResult) => secondVisibleResult.DKP - firstVisibleResult.DKP);

    lastResults = visibleResults;
    if (!visibleResults || visibleResults.length === 0) {
      setExportEnabled(false);
      return;
    }
    createResultsGrid(visibleResults);
    setExportEnabled(true);
    progressElement.value = 100;
    resultsInfo.textContent = `Calculated ${visibleResults.length} rows (skipped ${skippedCount} due to CH<25).`;
  }

  async function ensureMinDkpForIds(allIds, df1, df2, map1, map2) {
    const currentSignature = getPowerRangesSignature();
    if (minDkpSignature !== currentSignature) {
      minDkpMap = {};
      minDkpSignature = currentSignature;
      await saveMinDkpMap();
    }
    const toInsert = [];
    for (const gid of allIds) {
      const gidString = String(gid).trim();
      if (gidString === "") continue;
      if (minDkpMap[gidString] !== undefined) continue;

      const findPower = (arr, map) => {
        const row =
          (map && map[gidString]) ||
          arr.find(
            (candidateRow) =>
              String(candidateRow.ID).trim() === gidString &&
              candidateRow.Power != null &&
              candidateRow.Power !== "",
          );
        if (!row) return null;
        const parsedPower = Number(row.Power);
        return Number.isFinite(parsedPower) ? parsedPower : null;
      };
      let power = findPower(df1, map1);
      if (power === null) power = findPower(df2, map2);
      if (power === null) {
        console.warn(
          `[DKP] No Power for ID ${gidString} — skipping min_dkp calculation`,
        );
        continue;
      }
      const percent = getMinDkpPercent(power);
      const minDkp = Math.round(power * percent);
      minDkpMap[gidString] = minDkp;
      toInsert.push({ id: gidString, minDkp });
    }
    if (toInsert.length) await saveMinDkpMap();
  }

  function createResultsGrid(rows) {
    if (!rows || !rows.length) return;
    const element = document.querySelector("#result-table");
    element.style.display = "block";
    const { keys, data } = objectsToRows(rows);
    createSiteTable(element, { columns: keys.map((key) => ({ title: key })), data });
  }

  async function exportSettings() {
    const payload = {
      multipliers,
      power_ranges: powerRanges,
      vacation_list: vacationList,
      min_dkp: minDkpMap,
      min_dkp_signature: minDkpSignature,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `dkp-settings-${getExportTimestamp()}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(url);
  }

  importSettingsButton.addEventListener("click", () => importSettingsFile.click());
  importSettingsFile.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt);

      if (!parsed || typeof parsed !== "object")
        throw new Error("Invalid file format.");
      if (parsed.multipliers) {
        multipliers = parsed.multipliers;
        await localforage.setItem(KEY_MULTIPLIERS, multipliers);
      }
      if (Array.isArray(parsed.power_ranges)) {
        powerRanges = parsed.power_ranges;
        await localforage.setItem(KEY_POWER_RANGES, powerRanges);
        renderPowerRanges();
      }
      if (Array.isArray(parsed.vacation_list)) {
        vacationList = parsed.vacation_list;
        await localforage.setItem(KEY_VACATION_LIST, vacationList);
      }
      if (parsed.min_dkp && typeof parsed.min_dkp === "object") {
        minDkpMap = parsed.min_dkp;
        minDkpSignature =
          typeof parsed.min_dkp_signature === "string" ? parsed.min_dkp_signature : null;
        await localforage.setItem(KEY_MIN_DKP, minDkpMap);
        await localforage.setItem(KEY_MIN_DKP_SIG, minDkpSignature);
      }
      showToast("Settings imported successfully.");
      populateUIFromMemory();
    } catch (error) {
      console.error(error);
      showToast("Failed to import settings: " + (error.message || error));
    } finally {
      importSettingsFile.value = "";
    }
  });

  async function init() {
    await loadAllFromStorage();

    populateUIFromMemory();
    renderPowerRanges();
    progressElement.value = 0;

    progressElement.value = 0;
    resultsInfo.textContent = "Ready.";
  }

  function populateUIFromMemory() {
    t4Element.value = multipliers.t4 ?? 0;
    t5Element.value = multipliers.t5 ?? 0;
    deadsElement.value = multipliers.deads ?? 0;
    vacationInput.value = (vacationList || []).join(", ");
  }

  saveMultiplierButton.addEventListener("click", saveMultipliers);
  vacationSaveButton.addEventListener("click", saveVacationList);
  vacationClearButton.addEventListener("click", clearVacationList);

  runButton.addEventListener("click", async () => {
    multipliers.t4 = parseFloat(t4Element.value) || 0;
    multipliers.t5 = parseFloat(t5Element.value) || 0;
    multipliers.deads = parseFloat(deadsElement.value) || 0;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    progressElement.value = 2;
    try {
      await calculateDkp({ mode });
      await saveMinDkpMap();
    } catch (error) {
      console.error(error);
      showToast("Error during calculation: " + (error.message || error));
    } finally {
      progressElement.value = 100;
    }
  });

  exportX.addEventListener("click", () => exportToXlsx(lastResults, "dkp"));
  exportC.addEventListener("click", () => exportToCsv(lastResults, "dkp"));
  exportJ.addEventListener("click", () => exportToJson(lastResults, "dkp"));

  exportSettingsButton.addEventListener("click", exportSettings);
  clearMinButton.addEventListener("click", clearAllMinDkp);

  init().catch((error) => console.error("Init error", error));

})();
