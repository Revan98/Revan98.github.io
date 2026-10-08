function searchPlayers(query) {
  return searchByName(query, [
    { db, src: "kvk" },
    { db: scansDb, src: "scan" },
  ]);
}

let dbReady = false;
let scansDb = null;

loadEquipRefData(["inscriptions", "skins"]);

const SCANS_DB_VERSION = "1";

async function loadScansDatabase(SQL) {
  try {
    const res = await fetch(`scans_2247.db?v=${SCANS_DB_VERSION}`);
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    scansDb = new SQL.Database(new Uint8Array(buf));
  } catch (e) {
    console.warn("scans_2247.db not available:", e);
  }
}

function loadScanStats(govId) {
  if (!scansDb) return null;
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  try {
    const snapRes = scansDb.exec(
      `SELECT snapshot_id, snapshot_date FROM snapshots ORDER BY snapshot_date DESC LIMIT 1`,
    );
    if (!snapRes.length || !snapRes[0].values.length) return null;
    const [snapId, snapDate] = snapRes[0].values[0];

    const res = scansDb.exec(`
      SELECT s.power, s.kill_points, s.deaths,
             s.t1, s.t2, s.t3, s.t4, s.t5,
             s.ranged_points, s.rss_gathered, s.rss_assistance,
             s.helps, s.alliance, s.acclaim,
             g.name
      FROM stats s
      JOIN governors g ON g.governor_id = s.governor_id
      WHERE s.governor_id = ${safeId} AND s.snapshot_id = ${snapId}
      LIMIT 1
    `);
    if (!res.length || !res[0].values.length) return null;
    const r = res[0].values[0];
    return {
      snapDate,
      power: r[0],
      killPoints: r[1],
      deaths: r[2],
      t1: r[3],
      t2: r[4],
      t3: r[5],
      t4: r[6],
      t5: r[7],
      rangedPoints: r[8],
      rssGathered: r[9],
      rssAssistance: r[10],
      helps: r[11],
      alliance: r[12],
      acclaim: r[13],
      name: r[14],
    };
  } catch (e) {
    console.warn("loadScanStats error:", e);
    return null;
  }
}

function detectKingdom(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  const res = db.exec(`
    SELECT g.kingdom
    FROM governors g
    JOIN kvks k ON k.kingdom = g.kingdom
    JOIN snapshots sn ON sn.kvk_id = k.id
    JOIN stats s ON s.snapshot_id = sn.id AND s.governor_id = '${safeId}'
    ORDER BY k.kvk_number DESC, sn.snapshot_date DESC
    LIMIT 1
  `);
  if (res.length && res[0].values.length) return res[0].values[0][0];
  const g = db.exec(
    `SELECT kingdom FROM governors WHERE governor_id='${safeId}' LIMIT 1`,
  );
  return g.length && g[0].values.length ? g[0].values[0][0] : null;
}

function getBestSnapshotForGov(govId, kd) {
  const safeId = normalizeNumericId(govId);
  if (!safeId || !kd) return null;
  const res = db.exec(`
    SELECT sn.id
    FROM stats s
    JOIN snapshots sn ON sn.id = s.snapshot_id
    JOIN kvks k ON k.id = sn.kvk_id AND k.kingdom = '${kd}'
    WHERE s.governor_id = '${safeId}'
    ORDER BY k.kvk_number DESC, sn.snapshot_date DESC
    LIMIT 1
  `);
  return res.length && res[0].values.length ? res[0].values[0][0] : null;
}

function loadGovernorInfo(govId, kd) {
  const safeId = normalizeNumericId(govId);
  if (!safeId || !kd) return null;
  const snapId = getBestSnapshotForGov(safeId, kd);
  if (!snapId) return null;
  const res = db.exec(`
    SELECT g.name,
           s.power, s.kill_points, s.t4, s.t5, s.deads,
           s.power_diff, s.kp_diff, s.t4_diff, s.t5_diff, s.deads_diff,
           s.min_dkp, s.dkp, s.dkp_percent,
           coalesce(s.sum_min_dkp, s.min_dkp) AS sum_min_dkp,
           coalesce(s.sum_dkp, s.dkp) AS sum_dkp,
           coalesce(s.sum_dkp_percent, s.dkp_percent) AS sum_dkp_percent,
           coalesce(s.vacation,'NO') AS vacation,
           coalesce(s.status,'OK') AS status,
           s.acclaim
    FROM stats s
    JOIN governors g ON g.governor_id=s.governor_id AND g.kingdom='${kd}'
    WHERE s.snapshot_id=${snapId} AND s.governor_id='${safeId}'
    LIMIT 1
  `)[0];
  if (!res) return null;
  const r = res.values[0];
  return {
    name: r[0],
    power: r[1],
    kp: r[2],
    t4: r[3],
    t5: r[4],
    deads: r[5],
    powerDiff: r[6],
    kpDiff: r[7],
    t4Diff: r[8],
    t5Diff: r[9],
    deadsDiff: r[10],
    minDkp: r[11],
    dkp: r[12],
    dkpPercent: r[13],
    sumMinDkp: r[14],
    sumDkp: r[15],
    sumDkpPercent: r[16],
    vacation: r[17],
    status: r[18],
    acclaim: r[19],
  };
}

function getAccType(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  const res = db.exec(
    `SELECT acc_type FROM farm_accounts WHERE player_id=${safeId} LIMIT 1`,
  );
  if (!res.length || !res[0].values.length) return null;
  return String(res[0].values[0][0] || "").toLowerCase();
}

function loadCH(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) return null;
  const res = db.exec(
    `SELECT ch FROM farm_accounts WHERE player_id=${safeId} LIMIT 1`,
  );
  if (!res.length || !res[0].values.length) return null;
  const ch = res[0].values[0][0];
  return ch !== null &&
    ch !== undefined &&
    String(ch).trim() !== "" &&
    String(ch).trim() !== "0"
    ? String(ch).trim()
    : null;
}

const EQUIP_SLOTS = [
  { key: "helm", label: "Helm", id: "helmet" },
  { key: "chest", label: "Chest", id: "chest" },
  { key: "weapon", label: "Weapon", id: "weapon" },
  { key: "gloves", label: "Gloves", id: "gloves" },
  { key: "legs", label: "Legs", id: "legs" },
  { key: "boots", label: "Boots", id: "boots" },
  { key: "accessory", label: "Acc.", id: "accessory" },
  { key: "accessory_sec", label: "Acc.2", id: "accessory_sec" },
];
const ARM_SLOTS = Array.from({ length: 8 }, (_, i) => ({
  prefix: `arm${i + 1}`,
  label: `Arm ${i + 1}`,
}));
const SKIN_SLOTS = Array.from({ length: 8 }, (_, i) => `skin${i + 1}`);

function isMarchEmpty(row, suffix) {
  return EQUIP_SLOTS.every((slot) => {
    const colKey = suffix ? `${slot.key}_${suffix}` : slot.key;
    return isEmptyVal(row[colKey]);
  });
}
function getEquipRarity(name) {
  if (isEmptyVal(name)) return "empty";
  const n = String(name).trim().toLowerCase();
  if (n.endsWith("gray")) return "gray";
  if (n.endsWith("gr")) return "green";
  if (n.endsWith("g")) return "gold";
  if (n.endsWith("p")) return "purple";
  if (n.endsWith("b")) return "blue";
  return "unknown";
}

async function renderStatCard(govId) {
  const el = document.getElementById("pc-scan-stats");
  el.style.display = "";
  el.innerHTML = `<div class="poster-loading"><div class="spinner"></div><span>Building player card image…</span></div>`;

  try {
    const dataUrl = await buildStatPosterDataUrl(govId);
    el.innerHTML = `
      <img class="poster-image" src="${dataUrl}" alt="Player stat card" draggable="false">
      <a class="poster-download" href="${dataUrl}" download="player-${escapeHtml(String(govId))}.png">
        <i class="fa-solid fa-download"></i> Download image
      </a>`;
  } catch (e) {
    console.error("renderStatCard:", e);
    el.innerHTML = `<div class="pc-equip-empty">Could not build the player image.</div>`;
  }
}

function renderPlayerCard(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) {
    showError("Invalid governor ID.");
    return;
  }

  showState("loading");

  setTimeout(() => {
    try {
      const kd = detectKingdom(safeId);

      if (!kd) {
        const scanData = loadScanStats(safeId);
        if (!scanData) {
          showState("search");
          showError(`No data found for ID ${safeId}.`);
          return;
        }

        renderStatCard(safeId);

        document.getElementById("section-history").style.display = "none";
        document.getElementById("pc-farm-owner-section").style.display = "none";
        document.getElementById("pc-farms-section").style.display = "none";
        document.getElementById("pc-farm-kvk-section").style.display = "none";

        initCollapsibleSections();
        showState("card");
        return;
      }

      document.getElementById("section-history").style.display = "";

      const info = loadGovernorInfo(safeId, kd);
      if (!info) {
        showState("search");
        showError(`No data found for ID ${safeId}.`);
        return;
      }

      const accType = getAccType(safeId);
      const isMain = resolveFarmMainId(safeId) === safeId;
      const isFarm = accType === "farm";
      const farms = isMain ? loadGovernorFarms(safeId) : [];
      const farmIds = farms.map((f) => f.id);
      const farmKvK = farmIds.length ? loadFarmKvKStats(farmIds, kd) : [];
      const farmOwner = isFarm ? loadFarmOwner(safeId) : null;
      const history = loadGovHistory(safeId, kd);

      renderStatCard(safeId);

      renderHistoryCards(history);

      if (farmOwner) {
        document.getElementById("pc-farm-owner-section").style.display = "";
        document.getElementById("pc-farm-owner-table").innerHTML =
          renderAccountBoxes([farmOwner]);
      } else {
        document.getElementById("pc-farm-owner-section").style.display = "none";
      }

      if (farms.length) {
        document.getElementById("pc-farms-section").style.display = "";
        document.getElementById("pc-farms-table").innerHTML =
          renderAccountBoxes(farms);
      } else {
        document.getElementById("pc-farms-section").style.display = "none";
      }

      if (farmKvK.length) {
        document.getElementById("pc-farm-kvk-section").style.display = "";
        renderFarmKvKCards(farmKvK);
      } else {
        document.getElementById("pc-farm-kvk-section").style.display = "none";
      }

      initCollapsibleSections();
      showState("card");
    } catch (err) {
      console.error(err);
      showState("search");
      showError("Error loading player data: " + String(err));
    }
  }, 50);
}

function renderHistoryCards(rows) {
  document.getElementById("pc-history-table").innerHTML = rows.length
    ? renderKvkGainBoxes(rows)
    : `<div class="pc-empty">No historical KvK data found.</div>`;
}

function renderFarmKvKCards(rows) {
  const container = document.getElementById("pc-farm-kvk-table");
  container.innerHTML = renderFarmKvKGroups(rows)
    .map(
      (g, idx) => `<div class="pc-farm-kvk-group${idx === 0 ? " is-open" : ""}">
      <div class="pc-farm-kvk-label">
        ${escapeHtml(g.kvk)}
        <svg class="pc-farm-kvk-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
        </svg>
      </div>
      <div class="pc-farm-kvk-body">${g.html}</div>
    </div>`,
    )
    .join("");

  container.querySelectorAll(".pc-farm-kvk-label").forEach((label) => {
    label.addEventListener("click", () => {
      label.closest(".pc-farm-kvk-group").classList.toggle("is-open");
    });
  });
}

function initCollapsibleSections() {
  document.querySelectorAll(".pc-section.is-collapsible").forEach((section) => {
    section.classList.remove("is-open");
  });

  document.querySelectorAll(".pc-section-title.is-toggle").forEach((title) => {
    const fresh = title.cloneNode(true);
    title.parentNode.replaceChild(fresh, title);
    fresh.addEventListener("click", () => {
      fresh.closest(".pc-section").classList.toggle("is-open");
    });
  });
}

function showState(state) {
  document.getElementById("search-state").style.display =
    state === "search" ? "" : "none";
  document.getElementById("loading-state").style.display =
    state === "loading" ? "" : "none";
  document.getElementById("card-state").style.display =
    state === "card" ? "" : "none";
  if (state !== "search") {
    document.getElementById("search-error").style.display = "none";
  }
}

function showError(msg) {
  const el = document.getElementById("search-error");
  el.textContent = msg;
  el.style.display = "block";
}

document.getElementById("back-btn").addEventListener("click", () => {
  showState("search");
  document.getElementById("player-id-input").focus();
});


const dbLoadEl = document.getElementById("db-loading");
const searchBtn = document.getElementById("search-btn");
const inputEl = document.getElementById("player-id-input");

showState("search");
dbLoadEl.style.display = "flex";
searchBtn.disabled = true;

openDb()
  .then(async () => {
    await loadScansDatabase(await getSqlJs());

    dbReady = true;
    dbLoadEl.style.display = "none";
    searchBtn.disabled = false;
    inputEl.focus();

    const params = new URLSearchParams(window.location.search);
    const directId = normalizeNumericId(
      params.get("govId") || params.get("id"),
    );
    if (directId) {
      inputEl.value = directId;
      renderPlayerCard(directId);
    }
  })
  .catch((err) => {
    dbLoadEl.style.display = "none";
    showError("Failed to load database: " + String(err));
  });

function doSearch() {
  if (!dbReady) return;
  const val = inputEl.value.trim();
  if (!val) {
    showError("Please enter a governor ID or name.");
    return;
  }
  hideSuggestions();
  if (normalizeNumericId(val)) {
    document.getElementById("search-error").style.display = "none";
    renderPlayerCard(val);
  } else {
    const matches = searchPlayers(val);
    if (!matches.length) {
      showError(`No player found matching "${val}".`);
      return;
    }
    if (matches.length === 1) {
      document.getElementById("search-error").style.display = "none";
      inputEl.value = matches[0].id;
      renderPlayerCard(matches[0].id);
    } else {
      showSuggestions(matches);
    }
  }
}

const suggestionsEl = document.getElementById("name-suggestions");
let activeSuggestionIdx = -1;

function showSuggestions(matches) {
  activeSuggestionIdx = -1;
  suggestionsEl.innerHTML = matches
    .map(
      (m, i) =>
        `<div class="name-suggestion-item" data-id="${escapeHtml(m.id)}" data-idx="${i}">
      <span class="name-suggestion-name">${escapeHtml(m.name)}</span>
      <span class="name-suggestion-id">${escapeHtml(m.id)}</span>
    </div>`,
    )
    .join("");
  suggestionsEl.style.display = "block";
  suggestionsEl.querySelectorAll(".name-suggestion-item").forEach((item) => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectSuggestion(item.dataset.id);
    });
  });
}

function hideSuggestions() {
  suggestionsEl.style.display = "none";
  suggestionsEl.innerHTML = "";
  activeSuggestionIdx = -1;
}

function selectSuggestion(id) {
  hideSuggestions();
  inputEl.value = id;
  document.getElementById("search-error").style.display = "none";
  renderPlayerCard(id);
}

inputEl.addEventListener("input", () => {
  if (!dbReady) return;
  const val = inputEl.value.trim();
  if (!val || normalizeNumericId(val)) {
    hideSuggestions();
    return;
  }
  if (val.length < 2) {
    hideSuggestions();
    return;
  }
  const matches = searchPlayers(val);
  if (matches.length) showSuggestions(matches);
  else hideSuggestions();
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    doSearch();
    return;
  }
  if (suggestionsEl.style.display === "none") return;
  const items = suggestionsEl.querySelectorAll(".name-suggestion-item");
  if (!items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeSuggestionIdx = Math.min(activeSuggestionIdx + 1, items.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeSuggestionIdx = Math.max(activeSuggestionIdx - 1, -1);
  } else if (e.key === "Escape") {
    hideSuggestions();
    return;
  } else {
    return;
  }
  items.forEach((item, i) =>
    item.classList.toggle("is-active", i === activeSuggestionIdx),
  );
  if (activeSuggestionIdx >= 0)
    items[activeSuggestionIdx].scrollIntoView({ block: "nearest" });
  if (e.key === "Enter" && activeSuggestionIdx >= 0) {
    selectSuggestion(items[activeSuggestionIdx].dataset.id);
  }
});

inputEl.addEventListener("blur", () => {
  setTimeout(hideSuggestions, 150);
});
searchBtn.addEventListener("click", doSearch);
