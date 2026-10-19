function searchPlayers(query) {
  return searchGovernorsByName(query, true).catch((e) => {
    console.warn("Name search failed:", e);
    return [];
  });
}

let dbReady = false;

loadEquipRefData(["inscriptions", "skins"]);

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

async function renderPlayerCard(govId) {
  const safeId = normalizeNumericId(govId);
  if (!safeId) {
    showError("Invalid governor ID.");
    return;
  }

  showState("loading");

  {
    try {
      await loadPlayerBundle(safeId);
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

      const info = loadGovernorInfo(safeId);
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
      const farmKvK = farmIds.length ? loadFarmKvKStats(safeId) : [];
      const farmOwner = isFarm ? loadFarmOwner(safeId) : null;
      const history = loadGovHistory(safeId);

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
  }
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


const searchBtn = document.getElementById("search-btn");
const inputEl = document.getElementById("player-id-input");

showState("search");
dbReady = true;
inputEl.focus();

{
  const params = new URLSearchParams(window.location.search);
  const directId = normalizeNumericId(params.get("govId") || params.get("id"));
  if (directId) {
    inputEl.value = directId;
    renderPlayerCard(directId);
  }
}

async function doSearch() {
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
    const matches = await searchPlayers(val);
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

let suggestTicket = 0;
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
  const ticket = ++suggestTicket;
  searchPlayers(val).then((matches) => {
    if (ticket !== suggestTicket) return;
    if (matches.length) showSuggestions(matches);
    else hideSuggestions();
  });
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
