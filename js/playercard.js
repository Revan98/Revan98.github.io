function searchPlayers(query) {
  return searchGovernorsByName(query, true).catch((error) => {
    console.warn("Name search failed:", error);
    return [];
  });
}

let databaseReady = false;

loadEquipmentReferenceData(["inscriptions", "skins"]);

const EQUIPMENT_SLOTS = [
  { key: "helm", label: "Helm", id: "helmet" },
  { key: "chest", label: "Chest", id: "chest" },
  { key: "weapon", label: "Weapon", id: "weapon" },
  { key: "gloves", label: "Gloves", id: "gloves" },
  { key: "legs", label: "Legs", id: "legs" },
  { key: "boots", label: "Boots", id: "boots" },
  { key: "accessory", label: "Acc.", id: "accessory" },
  { key: "accessory_sec", label: "Acc.2", id: "accessory_sec" },
];

function isMarchEmpty(row, suffix) {
  return EQUIPMENT_SLOTS.every((slot) => {
    const slotColumnKey = suffix ? `${slot.key}_${suffix}` : slot.key;
    return isEmptyValue(row[slotColumnKey]);
  });
}
function getEquipmentRarityByName(name) {
  if (isEmptyValue(name)) return "empty";
  const normalizedName = String(name).trim().toLowerCase();
  if (normalizedName.endsWith("gray")) return "gray";
  if (normalizedName.endsWith("gr")) return "green";
  if (normalizedName.endsWith("g")) return "gold";
  if (normalizedName.endsWith("p")) return "purple";
  if (normalizedName.endsWith("b")) return "blue";
  return "unknown";
}

async function renderStatCard(governorId) {
  const element = document.getElementById("pc-scan-stats");
  element.style.display = "";
  element.innerHTML = `<div class="poster-loading"><div class="spinner"></div><span>Building player card image…</span></div>`;

  try {
    const dataUrl = await buildStatPosterDataUrl(governorId);
    element.innerHTML = `
      <img class="poster-image" src="${dataUrl}" alt="Player stat card" draggable="false">
      <a class="poster-download" href="${dataUrl}" download="player-${escapeHtml(String(governorId))}.png">
        <i class="fa-solid fa-download"></i> Download image
      </a>`;
  } catch (event) {
    console.error("renderStatCard:", event);
    element.innerHTML = `<div class="pc-equip-empty">Could not build the player image.</div>`;
  }
}

async function renderPlayerCard(governorId) {
  const safeId = normalizeNumericId(governorId);
  if (!safeId) {
    showError("Invalid governor ID.");
    return;
  }

  showState("loading");

  {
    try {
      await loadPlayerBundle(safeId);
      const kingdomId = detectKingdom(safeId);

      if (!kingdomId) {
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

      const accountType = getAccountType(safeId);
      const isMain = resolveFarmMainId(safeId) === safeId;
      const isFarm = accountType === "farm";
      const farms = isMain ? loadGovernorFarms(safeId) : [];
      const farmIds = farms.map((farm) => farm.id);
      const farmKvK = farmIds.length ? loadFarmKvKStats(safeId) : [];
      const farmOwner = isFarm ? loadFarmOwner(safeId) : null;
      const history = loadGovernorHistory(safeId);

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
    } catch (error) {
      console.error(error);
      showState("search");
      showError("Error loading player data: " + String(error));
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
      (group, index) => `<div class="pc-farm-kvk-group${index === 0 ? " is-open" : ""}">
      <div class="pc-farm-kvk-label">
        ${escapeHtml(group.kvk)}
        <svg class="pc-farm-kvk-chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
        </svg>
      </div>
      <div class="pc-farm-kvk-body">${group.html}</div>
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

function showError(message) {
  const element = document.getElementById("search-error");
  element.textContent = message;
  element.style.display = "block";
}

document.getElementById("back-btn").addEventListener("click", () => {
  showState("search");
  document.getElementById("player-id-input").focus();
});


const searchButton = document.getElementById("search-btn");
const inputElement = document.getElementById("player-id-input");

showState("search");
databaseReady = true;
inputElement.focus();

{
  const params = new URLSearchParams(window.location.search);
  const directId = normalizeNumericId(params.get("govId") || params.get("id"));
  if (directId) {
    inputElement.value = directId;
    renderPlayerCard(directId);
  }
}

async function doSearch() {
  if (!databaseReady) return;
  const value = inputElement.value.trim();
  if (!value) {
    showError("Please enter a governor ID or name.");
    return;
  }
  hideSuggestions();
  if (normalizeNumericId(value)) {
    document.getElementById("search-error").style.display = "none";
    renderPlayerCard(value);
  } else {
    const matches = await searchPlayers(value);
    if (!matches.length) {
      showError(`No player found matching "${value}".`);
      return;
    }
    if (matches.length === 1) {
      document.getElementById("search-error").style.display = "none";
      inputElement.value = matches[0].id;
      renderPlayerCard(matches[0].id);
    } else {
      showSuggestions(matches);
    }
  }
}

let suggestTicket = 0;
const suggestionsElement = document.getElementById("name-suggestions");
let activeSuggestionIndex = -1;

function showSuggestions(matches) {
  activeSuggestionIndex = -1;
  suggestionsElement.innerHTML = matches
    .map(
      (match, index) =>
        `<div class="name-suggestion-item" data-id="${escapeHtml(match.id)}" data-idx="${index}">
      <span class="name-suggestion-name">${escapeHtml(match.name)}</span>
      <span class="name-suggestion-id">${escapeHtml(match.id)}</span>
    </div>`,
    )
    .join("");
  suggestionsElement.style.display = "block";
  suggestionsElement.querySelectorAll(".name-suggestion-item").forEach((item) => {
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectSuggestion(item.dataset.id);
    });
  });
}

function hideSuggestions() {
  suggestionsElement.style.display = "none";
  suggestionsElement.innerHTML = "";
  activeSuggestionIndex = -1;
}

function selectSuggestion(id) {
  hideSuggestions();
  inputElement.value = id;
  document.getElementById("search-error").style.display = "none";
  renderPlayerCard(id);
}

inputElement.addEventListener("input", () => {
  if (!databaseReady) return;
  const value = inputElement.value.trim();
  if (!value || normalizeNumericId(value)) {
    hideSuggestions();
    return;
  }
  if (value.length < 2) {
    hideSuggestions();
    return;
  }
  const ticket = ++suggestTicket;
  searchPlayers(value).then((matches) => {
    if (ticket !== suggestTicket) return;
    if (matches.length) showSuggestions(matches);
    else hideSuggestions();
  });
});

inputElement.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const open = suggestionsElement.style.display !== "none";
    const active = open
      ? suggestionsElement.querySelectorAll(".name-suggestion-item")[activeSuggestionIndex]
      : null;
    if (active) {
      event.preventDefault();
      selectSuggestion(active.dataset.id);
    } else {
      doSearch();
    }
    return;
  }
  if (suggestionsElement.style.display === "none") return;
  const items = suggestionsElement.querySelectorAll(".name-suggestion-item");
  if (!items.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, -1);
  } else if (event.key === "Escape") {
    hideSuggestions();
    return;
  } else {
    return;
  }
  items.forEach((item, index) =>
    item.classList.toggle("is-active", index === activeSuggestionIndex),
  );
  if (activeSuggestionIndex >= 0)
    items[activeSuggestionIndex].scrollIntoView({ block: "nearest" });
});

inputElement.addEventListener("blur", () => {
  setTimeout(hideSuggestions, 150);
});
searchButton.addEventListener("click", doSearch);
