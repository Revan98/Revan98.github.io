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

  /* Simple query helper */
  const qs = (sel) => document.querySelector(sel);
  const themeToggle = qs("#toggle-theme");
  const ignoreChEl = document.getElementById("ignore-ch");
  const KEY_PENALTIES = "penalties";
  const PENALTY_COLUMNS = [
    "DKP",
    "T4 gained",
    "T5 gained",
    "Deads gained",
    "KP gained",
  ];
  const penaltyColumnEl = document.getElementById("penalty-column");
  PENALTY_COLUMNS.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    penaltyColumnEl.appendChild(opt);
  });
  const CHECKPOINT_COLUMNS = new Set(["KP gained", "DKP"]);

  // In-memory caches
  let powerRanges = []; // [{min_power, max_power|null, percentage}]
  let multipliers = { t4: 0.0, t5: 0.0, deads: 0.0 };
  let vacationList = []; // array of ids (strings)
  let minDkpMap = {}; // id -> min_dkp (number)
  let lastResults = null; // array of result objects
  let powerGridApi = null;
  let resultsGridApi = null;
  // penalties[id] = array of penalty rules
  let penalties = {};
  let df1Cache = null;
  let df2Cache = null;
  let map1Cache = null;
  let map2Cache = null;
  let allIdsCache = [];
  let filteredIdsCache = [];

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
    const p = await localforage.getItem(KEY_PENALTIES);
    if (p && typeof p === "object") {
      penalties = {};
      Object.entries(p).forEach(([id, val]) => {
        if (Array.isArray(val)) {
          penalties[id] = val;
        } else if (val && typeof val === "object") {
          // migrate old single-penalty format → array
          penalties[id] = [val];
        }
      });
    }
  }

  async function savePenalties() {
    await localforage.setItem(KEY_PENALTIES, penalties);
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
  async function loadFilesIfReady() {
    const f1 = file1El.files[0];
    const f2 = file2El.files[0];
    if (!f1 || !f2) return;

    progressEl.value = 5;

    const [df1Raw, df2Raw] = await Promise.all([
      readSpreadsheetFile(f1),
      readSpreadsheetFile(f2),
    ]);

    df1Cache = df1Raw;
    df2Cache = df2Raw;

    // Build ID maps
    const mapById = (arr) => {
      const m = {};
      arr.forEach((r) => {
        const idS = String(r.ID ?? "").trim();
        if (idS) m[idS] = r;
      });
      return m;
    };

    map1Cache = mapById(df1Cache);
    map2Cache = mapById(df2Cache);

    allIdsCache = Array.from(
      new Set([...Object.keys(map1Cache), ...Object.keys(map2Cache)]),
    );

    // Populate penalties dropdown immediately
    populatePenaltyIdDropdown(df1Cache, df2Cache);

    progressEl.value = 20;
    resultsInfo.textContent = "Files loaded. Ready to configure penalties.";
  }
  file1El.addEventListener("change", loadFilesIfReady);
  file2El.addEventListener("change", loadFilesIfReady);

  // UI: power ranges table
  const powerRangeColumnDefs = [
    { headerName: "Min Power", field: "min_power", sortable: true },
    { headerName: "Max Power", field: "max_power", sortable: true },
    { headerName: "%", field: "percentage" },

    {
      headerName: "Actions",
      cellRenderer: (params) => {
        return `
			<button class="primary pr-edit">Edit</button>
			<button class="secondary pr-delete">Delete</button>
		  `;
      },

      sortable: false,
      filter: false,
    },
  ];
  function createPowerRangesGrid() {
    const gridOptions = {
      theme: agGrid.themeQuartz,
      columnDefs: powerRangeColumnDefs,
      rowData: powerRanges,
      rowHeight: 42,
      autoSizeStrategy: {
        type: "fitGridWidth",
        defaultMinWidth: 100,
      },
      defaultColDef: {
        resizable: true,
        sortable: true,
      },
      onCellClicked: async (event) => {
        const row = event.data;
        const idx = powerRanges.indexOf(row);

        if (event.event.target.classList.contains("pr-edit")) {
          prMin.value = row.min_power;
          prMax.value = row.max_power ?? "";
          prPercent.value = row.percentage;
          prAddBtn.dataset.editIdx = idx;
          prAddBtn.textContent = "Update";
        }

        if (event.event.target.classList.contains("pr-delete")) {
          if (!confirm("Delete this range?")) return;
          powerRanges.splice(idx, 1);
          await savePowerRangesToStorage();
          powerGridApi.setGridOption("rowData", powerRanges);
        }
      },
    };

    powerGridApi = agGrid.createGrid(
      document.querySelector("#power-table"),
      gridOptions,
    );
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
    powerGridApi?.setGridOption("rowData", powerRanges);
    prMin.value = prMax.value = prPercent.value = "";
  });

  prSaveBtn.addEventListener("click", async () => {
    await savePowerRangesToStorage();
    powerGridApi?.setGridOption("rowData", powerRanges);
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
  let penaltyGridApi = null;
  function buildPenaltyRows() {
    const rows = [];

    Object.entries(penalties).forEach(([id, rules]) => {
      rules.forEach((p, idx) => {
        rows.push({
          id,
          column: p.column,
          type: p.type,
          value: p.value,
          checkpoint: p.checkpoint ?? "",
          appliedValue: p.appliedValue ?? "",
          _idx: idx, // internal index
        });
      });
    });

    return rows;
  }
  const penaltyColumnDefs = [
    { headerName: "ID", field: "id", width: 140 },
    { headerName: "Column", field: "column", width: 140 },
    { headerName: "Type", field: "type", width: 110 },
    { headerName: "Value", field: "value", width: 110 },
    { headerName: "Checkpoint", field: "checkpoint", width: 140 },
    { headerName: "Applied Value", field: "appliedValue", width: 140 },
    {
      headerName: "Actions",
      width: 150,
      cellRenderer: (params) => {
        return `
        <button class="secondary pen-delete">Delete</button>
      `;
      },
      sortable: false,
      filter: false,
    },
  ];
  function createOrUpdatePenaltyGrid() {
    const rows = buildPenaltyRows();
    const gridDiv = document.querySelector("#penalty-grid");

    // Destroy old grid
    if (penaltyGridApi) {
      penaltyGridApi.destroy();
      penaltyGridApi = null;
      gridDiv.innerHTML = "";
    }

    const gridOptions = {
      theme: agGrid.themeQuartz,
      columnDefs: penaltyColumnDefs,
      rowData: rows,
      rowHeight: 42,
      animateRows: true,
      defaultColDef: {
        resizable: true,
        sortable: true,
      },
      onCellClicked: async (event) => {
        const row = event.data;
        if (!row) return;

        // DELETE
        if (event.event.target.classList.contains("pen-delete")) {
          if (!confirm("Delete this penalty?")) return;

          penalties[row.id].splice(row._idx, 1);
          if (!penalties[row.id].length) delete penalties[row.id];

          await savePenalties();
          createOrUpdatePenaltyGrid();
        }

        // EDIT
        if (event.event.target.classList.contains("pen-edit")) {
          penaltyIdEl.value = row.id;
          penaltyColumnEl.value = row.column;
          penaltyTypeEl.value = row.type;
          penaltyValueEl.value = row.value;

          penalties[row.id].splice(row._idx, 1);
          if (!penalties[row.id].length) delete penalties[row.id];

          createOrUpdatePenaltyGrid();
        }
      },
    };

    penaltyGridApi = agGrid.createGrid(gridDiv, gridOptions);
  }

  async function calculateDkp({ mode = "lilithdata" } = {}) {
    if (!df1Cache || !df2Cache) {
      return alert("Please load both files first.");
    }

    const df1Raw = df1Cache;
    const df2Raw = df2Cache;
    const map1 = map1Cache;
    const map2 = map2Cache;

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

    progressEl.value = 35;

    // build list of all unique IDs

    const allIds = allIdsCache;

    // Filter IDs based on CH: skip if CH < 25 in both files (or missing in both)
    let filteredIds;

    if (ignoreChEl.checked) {
      // User disabled filtering
      filteredIds = allIds;
      skippedCount = 0;
    } else {
      // Original CH filtering
      filteredIds = allIds.filter((id) => {
        const ch1 = getChFromRow(map1[id]);
        const ch2 = getChFromRow(map2[id]);
        if ((ch1 !== null && ch1 >= 25) || (ch2 !== null && ch2 >= 25))
          return true;
        return false;
      });

      skippedCount = allIds.length - filteredIds.length;
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
      let t4Final = applyDeltaPenalty(id, "T4 gained", Math.round(t4g));
      let t5Final = applyDeltaPenalty(id, "T5 gained", Math.round(t5g));
      let deadsFinal = applyDeltaPenalty(id, "Deads gained", Math.round(deg));

      let DKPraw = Math.round(t4Final * t4 + t5Final * t5 + deadsFinal * deads);
      let DKPfinal = applyCheckpointPenalty(id, "DKP", DKPraw);

      const DKPpercent = minDkp ? DKPfinal / minDkp : 0;

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

        "KP gained": applyCheckpointPenalty(id, "KP gained", Math.round(kp)),

        "T4 gained": t4Final,
        "T5 gained": t5Final,
        "Deads gained": deadsFinal,

        "Min DKP": Math.round(minDkp),
        DKP: DKPfinal,
        "DKP%": minDkp ? Number((DKPfinal / minDkp).toFixed(4)) : 0,

        Vacation: vacation,
        Status: status,

        // Full totals
        "T4 Kills": safeNum(a["T4 Kills"]),
        "T5 Kills": safeNum(a["T5 Kills"]),
        Killpoints: safeNum(a.Killpoints),
        Deads: safeNum(a.Deads),

        "Power diff": Math.round(safeNum(b.Power) - safeNum(a.Power)),
        Acclaim: safeNum(b["Acclaim"]),
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
    createResultsGrid(results);
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

  // Render results (table)
  function buildDynamicColumnDefs(rows) {
    if (!rows?.length) return [];

    return Object.keys(rows[0]).map((key) => ({
      headerName: key,
      field: key,
      sortable: true,
      resizable: true,
      filter: false,
      getQuickFilterText: () => "",
    }));
  }

  function populatePenaltyIdDropdown(df1, df2) {
    const select = document.getElementById("penalty-id");
    select.innerHTML = "";

    const seen = new Set();
    [...df1, ...df2].forEach((r) => {
      const id = String(r.ID ?? "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);

      const name = r.Name ?? "Unknown";
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${name} (${id})`;
      select.appendChild(opt);
    });
  }

  function createResultsGrid(rows) {
    if (!rows || !rows.length) return;

    const columnDefs = buildDynamicColumnDefs(rows);
    const gridDiv = document.querySelector("#result-table");

    // Destroy old grid if exists
    if (resultsGridApi) {
      resultsGridApi.destroy();
      resultsGridApi = null;
      gridDiv.innerHTML = "";
    }

    const gridOptions = {
      theme: agGrid.themeQuartz,
      columnDefs,
      rowData: rows,
      rowHeight: 42,
      animateRows: true,
      pagination: true,
      paginationPageSize: 50,
      defaultColDef: {
        sortable: true,
        resizable: true,
      },
    };

    resultsGridApi = agGrid.createGrid(gridDiv, gridOptions);
  }

  // Export: XLSX / CSV / JSON
  function exportToXlsx(rows) {
    if (!rows) return alert("No results to export.");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DKP");
    XLSX.writeFile(
      wb,
      `dkp_output_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`,
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
    a.download = `dkp_output_${new Date()
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
    a.download = `dkp_output_${new Date()
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
      penalties,
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
      if (parsed.penalties && typeof parsed.penalties === "object") {
        penalties = {};

        Object.entries(parsed.penalties).forEach(([id, rules]) => {
          if (Array.isArray(rules)) {
            penalties[id] = rules;
          } else if (rules && typeof rules === "object") {
            // backward compatibility (single penalty)
            penalties[id] = [rules];
          }
        });

        await localforage.setItem(KEY_PENALTIES, penalties);
      }

      alert("Settings imported successfully.");
      // refresh UI
      populateUIFromMemory();
      createOrUpdatePenaltyGrid();
    } catch (err) {
      console.error(err);
      alert("Failed to import settings: " + (err.message || err));
    } finally {
      importSettingsFile.value = ""; // reset
    }
  });

  const penaltyIdEl = document.getElementById("penalty-id");
  const penaltyTypeEl = document.getElementById("penalty-type");
  const penaltyValueEl = document.getElementById("penalty-value");
  const penaltySaveBtn = document.getElementById("penalty-save");

  function applyDeltaPenalty(id, column, originalValue) {
    const rules = penalties[id];
    if (!Array.isArray(rules) || !rules.length) return originalValue;

    let value = originalValue;

    for (const p of rules) {
      if (p.column !== column) continue;

      if (p.type === "percent") {
        value = value * (1 + p.value);
      } else if (p.type === "absolute") {
        value = p.value;
      }
    }

    return Math.round(value);
  }
  penaltySaveBtn.addEventListener("click", async () => {
    const id = String(penaltyIdEl.value).trim();
    const column = penaltyColumnEl.value;
    const type = penaltyTypeEl.value;
    const value = Number(penaltyValueEl.value);

    if (!id || !column || !Number.isFinite(value)) {
      return alert("Invalid penalty data");
    }

    if (!Array.isArray(penalties[id])) {
      penalties[id] = [];
    }

    let checkpoint = null;
    let appliedValue = null;

    // Only for checkpoint columns
    if (CHECKPOINT_COLUMNS.has(column)) {
      if (!lastResults) {
        alert("Run DKP once before adding checkpoint penalties.");
        return;
      }

      const row = lastResults.find((r) => String(r.ID) === id);
      if (!row) {
        alert("Player not found in last results.");
        return;
      }

      const currentVal = Number(row[column]);
      if (!Number.isFinite(currentVal)) {
        alert("Invalid checkpoint value.");
        return;
      }

      checkpoint = currentVal;

      if (type === "percent") {
        appliedValue = Math.round(currentVal * (1 + value));
      } else if (type === "absolute") {
        appliedValue = Math.round(value);
      }
    }

    penalties[id].push({
      column,
      type,
      value,
      checkpoint,
      appliedValue,
    });

    await savePenalties();
    createOrUpdatePenaltyGrid();
  });

  function applyCheckpointPenalty(id, column, rawValue) {
    const rules = penalties[id];
    if (!Array.isArray(rules)) return rawValue;

    const p = rules.find(
      (r) => r.column === column && CHECKPOINT_COLUMNS.has(column),
    );
    if (!p || p.checkpoint == null || p.appliedValue == null) {
      return rawValue;
    }

    const gainedSincePenalty = Math.max(0, rawValue - p.checkpoint);
    return Math.round(p.appliedValue + gainedSincePenalty);
  }

  // Init wiring
  async function init() {
    await loadAllFromStorage();

    populateUIFromMemory();
    createPowerRangesGrid();
    createOrUpdatePenaltyGrid();

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

  // back to the top of the page
  const backToTopBtn = document.getElementById("backToTop");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      backToTopBtn.classList.add("show");
    } else {
      backToTopBtn.classList.remove("show");
    }
  });

  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  /* -------------------------
	   THEME HANDLING
	   ------------------------- */
  function setTheme(mode) {
    document.body.classList.remove("dark", "light");
    document.body.classList.add(mode);

    // 👇 THIS is the AG Grid integration
    document.body.setAttribute("data-ag-theme-mode", mode);

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

  document.addEventListener("DOMContentLoaded", () => {
    const current = location.pathname.split("/").pop(); // e.g. "index.html"

    document.querySelectorAll(".nav-links a").forEach((link) => {
      if (link.getAttribute("href") === current) {
        link.classList.add("active");
      }
    });
  });
})();
