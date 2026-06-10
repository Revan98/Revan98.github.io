const MAP_MARKERS = [
  { id: "blue-1-obelisk", name: "Blue 1 - Obelisk", type: "obelisk", x: 11.7, y: 41.1, note: "Obelisk, +20/m." },
  { id: "blue-2-shrine-war", name: "Blue 2 - Shrine of War", type: "shrine", x: 28.0, y: 47.3, note: "Shrine of War, +80/m." },
  { id: "blue-3-sky-altar", name: "Blue 3 - Sky Altar", type: "altar", x: 13.0, y: 58.4, note: "Sky Altar, +150/m." },
  { id: "blue-4-obelisk", name: "Blue 4 - Obelisk", type: "obelisk", x: 53.0, y: 12.8, note: "Obelisk, +20/m." },
  { id: "blue-5-shrine-life", name: "Blue 5 - Shrine of Life", type: "shrine", x: 67.5, y: 15.6, note: "Shrine of Life, +80/m." },
  { id: "blue-6-desert-altar", name: "Blue 6 - Desert Altar", type: "altar", x: 54.0, y: 29.8, note: "Desert Altar, +150/m." },
  { id: "red-1-obelisk", name: "Red 1 - Obelisk", type: "obelisk", x: 41.4, y: 78.2, note: "Obelisk, +20/m." },
  { id: "red-2-shrine-life", name: "Red 2 - Shrine of Life", type: "shrine", x: 25.0, y: 75.3, note: "Shrine of Life, +80/m." },
  { id: "red-3-desert-altar", name: "Red 3 - Desert Altar", type: "altar", x: 41.2, y: 59.8, note: "Desert Altar, +150/m." },
  { id: "red-4-obelisk", name: "Red 4 - Obelisk", type: "obelisk", x: 84.7, y: 45.1, note: "Obelisk, +20/m." },
  { id: "red-5-shrine-war", name: "Red 5 - Shrine of War", type: "shrine", x: 67.3, y: 41.5, note: "Shrine of War, +80/m." },
  { id: "red-6-sky-altar", name: "Red 6 - Sky Altar", type: "altar", x: 80.8, y: 27.9, note: "Sky Altar, +150/m." },
  { id: "yellow-1-outpost-seth", name: "Red 1 - Outpost of Seth", type: "outpost", x: 61.6, y: 58.3, note: "Outpost of Seth, +80/m." },
  { id: "yellow-2-outpost-seth", name: "Red 2 - Outpost of Seth", type: "outpost", x: 78.2, y: 57.7, note: "Outpost of Seth, +50/m." },
  { id: "yellow-3-outpost-seth", name: "Red 3 - Outpost of Seth", type: "outpost", x: 61.9, y: 73.1, note: "Outpost of Seth, +30/m." },
  { id: "yellow-4-outpost-iset", name: "Blue 1 - Outpost of Iset", type: "outpost", x: 33.9, y: 30.3, note: "Outpost of Iset, +50/m." },
  { id: "yellow-5-outpost-iset", name: "Blue 2 - Outpost of Iset", type: "outpost", x: 18.3, y: 27.2, note: "Outpost of Iset, +30/m." },
  { id: "yellow-6-outpost-iset", name: "Blue 3 - Outpost of Iset", type: "outpost", x: 34.4, y: 16.0, note: "Outpost of Iset, +50/m." },
  { id: "bottom-anubis", name: "Anubis 1", type: "anubis", x: 9.3, y: 89.1, note: "Anubis boss." },
  { id: "top-anubis", name: "Anubis 2", type: "anubis", x: 91.4, y: 10.0, note: "Anubis boss." },
];

const TYPE_LABELS = {
  all: "All",
  obelisk: "Obelisks",
  shrine: "Shrines",
  altar: "Altars",
  outpost: "Outposts",
  custom: "Custom",
  anubis: "Anubis",
};

const CUSTOM_PIN_KEY = "interactiveMapCustomPins";
const MARKER_POSITIONS_KEY = "interactiveMapMarkerPositions";
const MARKER_NOTES_KEY = "interactiveMapMarkerNotes";
const MAP_LABELS_KEY = "interactiveMapLabels";
const MAP_LABEL_SECTIONS_KEY = "interactiveMapLabelSections";
const MAP_STAGES_KEY = "interactiveMapStages";
const TEAM_PLAYERS_KEY = "interactiveMapTeamPlayers";
const TEAM_LAYOUT_KEY = "interactiveMapTeamLayout";
const LANE_PLANS_KEY = "interactiveMapLanePlans";
const ARK_SKILLS_KEY = "interactiveMapArkSkills";

const MAP_LABEL_SECTIONS = [
  { key: "top", label: "Top" },
  { key: "midTop", label: "Mid Top" },
  { key: "midBottom", label: "Mid Bottom" },
  { key: "bottom", label: "Bottom" },
];

let currentFilter = "all";
let selectedMarkerId = MAP_MARKERS[0].id;
let legacyCustomPins = loadCustomPins();
let markerPositions = loadMarkerPositions();
let markerNotes = loadMarkerNotes();
let mapStages = loadMapStages(legacyCustomPins);
let activeMapStageId = mapStages[0]?.id || "stage-1";
let teamPlayers = loadTeamPlayers();
let teamLayout = loadTeamLayout();
let lanePlans;
let activeLanePlan = "overview";
let selectedArkSkills;
let visibleLabelSections = loadVisibleLabelSections();
let addPinMode = false;
let addLabelMode = false;
let moveMarkersMode = false;
let activeLabelShape = "bubble-left";
let view = { scale: 1, x: 0, y: 0 };
let dragState = null;
let markerDragState = null;
let labelDragState = null;
let labelResizeState = null;
let suppressMarkerClick = false;
let editingLabelId = null;
let labelContextMenu = null;

const DEFAULT_LABEL_WIDTH = 10;
const DEFAULT_LABEL_HEIGHT = 4;

const navbar = document.getElementById("navbar");
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
const themeToggle = document.getElementById("toggle-theme");
const markerLayer = document.getElementById("markerLayer");
const markerList = document.getElementById("markerList");
const filterGroup = document.getElementById("filterGroup");
const mapLayer = document.getElementById("mapLayer");
const mapViewport = document.getElementById("mapViewport");
const mapStage = document.getElementById("mapStage");
const mapSectionControls = document.getElementById("mapSectionControls");
const mapDetail = document.getElementById("mapDetail");
const mapSearch = document.getElementById("mapSearch");
const mapCoords = document.getElementById("mapCoords");
const addPinBtn = document.getElementById("addPinBtn");
const addLabelBtn = document.getElementById("addLabelBtn");
const labelShapeSelect = document.getElementById("labelShapeSelect");
const exportPngBtn = document.getElementById("exportPngBtn");
const moveMarkersBtn = document.getElementById("moveMarkersBtn");
const mapStageSwitcher = document.getElementById("mapStageSwitcher");
const exportDbBtn = document.getElementById("exportDbBtn");
const importDbInput = document.getElementById("importDbInput");
const tabButtons = document.querySelectorAll(".map-tab");
const tabPanels = document.querySelectorAll(".tab-panel");
const playerForm = document.getElementById("playerForm");
const playerNameInput = document.getElementById("playerNameInput");
const playersCsvInput = document.getElementById("playersCsvInput");
const clearPlayersBtn = document.getElementById("clearPlayersBtn");
const playerList = document.getElementById("playerList");
const playerCount = document.getElementById("playerCount");
const mapPlayerList = document.getElementById("mapPlayerList");
const mapPlayerCount = document.getElementById("mapPlayerCount");
const mapPlayerForm = document.getElementById("mapPlayerForm");
const mapPlayerNameInput = document.getElementById("mapPlayerNameInput");
const mapPlayersCsvInput = document.getElementById("mapPlayersCsvInput");
const mapClearPlayersBtn = document.getElementById("mapClearPlayersBtn");
const lanePlanTabs = document.getElementById("lanePlanTabs");
const lanePlanWrap = document.getElementById("lanePlanWrap");
const arkSkillSlots = document.getElementById("arkSkillSlots");
const skillModalOverlay = document.getElementById("skillModalOverlay");
const skillModalClose = document.getElementById("skillModalClose");
const clearSkillsBtn = document.getElementById("clearSkillsBtn");
const skillGrid = document.getElementById("skillGrid");
const skillModalCount = document.getElementById("skillModalCount");
const stageModalOverlay = document.getElementById("stageModalOverlay");
const stageModalClose = document.getElementById("stageModalClose");
const addStageModalBtn = document.getElementById("addStageModalBtn");
const stageManagerList = document.getElementById("stageManagerList");

const LANES = [
  { key: "a", label: "A Lane" },
  { key: "b", label: "B Lane" },
  { key: "c", label: "C Lane" },
  { key: "d", label: "D Lane" },
];

const ARK_SKILLS = [
  "bog-down.webp",
  "desert-storm.webp",
  "dust-up.webp",
  "energetic.webp",
  "fire-arrows.webp",
  "hard-push.webp",
  "heavens-grace.webp",
  "inferno.webp",
  "insatiable-vision.webp",
  "master-strategy.webp",
  "mystical-formation.webp",
  "nomarch.webp",
  "running-charge.webp",
  "sneaky-tactics.webp",
  "stocking-up.webp",
  "sunsailer.webp",
  "swift-stride.webp",
  "tear-down.webp",
  "time-warp.webp",
  "timely-support.webp",
  "to-the-death.webp",
  "total-vision.webp",
  "valiant-stand.webp",
  "war-drums.webp",
];

const ROLES = [
  {
    group: "Rally",
    roles: [
      "Rally desert altar",
      "Rally shrine of life",
      "Rally shrine of war",
      "Rally sky altar",
      "Rally obelisk",
      "Rally enemy obelisk",
    ],
  },
  {
    group: "Garrison",
    roles: [
      "Garrison desert altar",
      "Garrison shrine of life",
      "Garrison shrine of war",
      "Garrison sky altar",
      "Garrison obelisk",
    ],
  },
  {
    group: "Field",
    roles: ["Open field"],
  },
  {
    group: "Protect",
    roles: [
      "Protect desert altar",
      "Protect shrine of life",
      "Protect shrine of war",
      "Protect sky altar",
      "Protect obelisk",
    ],
  },
];

const BACKUP_KEYS = [
  MARKER_POSITIONS_KEY,
  MARKER_NOTES_KEY,
  MAP_LABELS_KEY,
  MAP_LABEL_SECTIONS_KEY,
  MAP_STAGES_KEY,
  TEAM_PLAYERS_KEY,
  TEAM_LAYOUT_KEY,
  LANE_PLANS_KEY,
  ARK_SKILLS_KEY,
  CUSTOM_PIN_KEY,
];

let sqlJsPromise = null;

lanePlans = loadLanePlans();
selectedArkSkills = loadArkSkills();

window.addEventListener("scroll", () => {
  navbar?.classList.toggle("scrolled", window.scrollY > 10);
});

hamburger?.addEventListener("click", () => {
  navLinks?.classList.toggle("show");
  hamburger.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  hideLabelContextMenu();
  if (hamburger && navLinks && !hamburger.contains(e.target) && !navLinks.contains(e.target)) {
    navLinks.classList.remove("show");
    hamburger.classList.remove("open");
  }
});

navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("show");
    hamburger?.classList.remove("open");
  });
});

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
  document.body.setAttribute("data-ag-theme-mode", theme);
  localStorage.setItem("theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const theme = saved === "light" || saved === "dark"
    ? saved
    : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  applyTheme(theme);
  if (themeToggle) themeToggle.checked = theme === "dark";
}

themeToggle?.addEventListener("change", () => {
  applyTheme(themeToggle.checked ? "dark" : "light");
});

function getMarkers() {
  const builtInMarkers = MAP_MARKERS.map((marker) => ({
    ...marker,
    ...(markerPositions[marker.id] || {}),
    note: markerNotes[marker.id] ?? marker.note,
    locked: true,
  }));
  const customMarkers = getCustomPins().map((pin) => ({
    ...pin,
    note: markerNotes[pin.id] ?? pin.note,
  }));
  return [...builtInMarkers, ...customMarkers];
}

function getVisibleMarkers() {
  const search = mapSearch?.value.trim().toLowerCase() || "";
  return getMarkers().filter((marker) => {
    const matchesType = currentFilter === "all" || marker.type === currentFilter;
    const matchesSearch = !search || `${marker.name} ${TYPE_LABELS[marker.type]} ${marker.note}`.toLowerCase().includes(search);
    return matchesType && matchesSearch;
  });
}

function renderFilters() {
  if (!filterGroup) return;
  filterGroup.innerHTML = "";
  Object.entries(TYPE_LABELS).forEach(([type, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${type === currentFilter ? " active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      currentFilter = type;
      render();
    });
    filterGroup.appendChild(button);
  });
}

function renderMarkers() {
  markerLayer.innerHTML = "";
  renderMapLabels();
  renderMapStageControls();
}

function renderMapLabels() {
  getMapLabels().forEach((label) => {
    if (!isLabelVisible(label)) return;
    const isEditing = editingLabelId === label.id;
    const item = document.createElement("div");
    item.className = `map-label shape-${label.shape || "bubble-left"}`;
    item.style.left = `${label.x}%`;
    item.style.top = `${label.y}%`;
    item.style.width = `${label.width || DEFAULT_LABEL_WIDTH}%`;
    item.style.height = `${label.height || DEFAULT_LABEL_HEIGHT}%`;
    item.innerHTML = `
      <textarea class="map-label-text" title="Edit label" rows="1" ${isEditing ? "" : "readonly"}>${escapeHtml(label.text)}</textarea>
      <span class="map-label-resize" title="Resize label"></span>
    `;
    const labelText = item.querySelector(".map-label-text");
    const resizeHandle = item.querySelector(".map-label-resize");
    labelText.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (isEditing) return;
      startLabelDrag(event, label.id);
    });
    labelText.addEventListener("click", (event) => {
      event.stopPropagation();
      if (suppressMarkerClick) {
        suppressMarkerClick = false;
        return;
      }
    });
    labelText.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      startLabelEdit(label.id);
    });
    labelText.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showLabelContextMenu(event.clientX, event.clientY, label.id);
    });
    labelText.addEventListener("input", () => {
      updateMapLabelText(label.id, labelText.value);
      resizeMapLabelInput(labelText);
    });
    labelText.addEventListener("blur", () => finishLabelEdit(label.id));
    labelText.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        labelText.blur();
      }
    });
    resizeHandle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      startLabelResize(event, label.id);
    });
    markerLayer.appendChild(item);
    if (!label.height) resizeMapLabelInput(labelText);
    if (isEditing) {
      requestAnimationFrame(() => {
        labelText.focus();
        labelText.select();
      });
    }
  });
}

function renderLabelSectionControls() {
  if (!mapSectionControls) return;
  mapSectionControls.innerHTML = "";
  MAP_LABEL_SECTIONS.forEach((section) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `map-section-toggle${visibleLabelSections[section.key] ? " active" : ""}`;
    button.textContent = section.label;
    button.setAttribute("aria-pressed", String(Boolean(visibleLabelSections[section.key])));
    button.title = `${section.label} labels`;
    button.addEventListener("click", () => {
      visibleLabelSections[section.key] = !visibleLabelSections[section.key];
      saveVisibleLabelSections();
      renderMarkers();
      renderLabelSectionControls();
    });
    mapSectionControls.appendChild(button);
  });
}

function getLabelSection(label) {
  // Non-overlapping sections matching the annotated map outlines.
  // Evaluated in priority order — first match wins.
  //
  // TOP (blue oval, top-right):
  //   Shrine of Life (67.5,15.6), Sky Altar (80.8,27.9), Anubis2 (91.4,10)
  //
  // MID TOP (purple oval, right-center):
  //   Desert Altar (54,29.8), Shrine of War (67.3,41.5)
  //
  // MID BOTTOM (red diagonal band, central ruins):
  //   Shrine of War (28,47.3), Desert Altar (41.2,59.8)
  //
  // BOTTOM (black rectangle, bottom-left):
  //   Sky Altar (13,58.4), Shrine of Life (25,75.3), Anubis1 (9.3,89.1)

  const x = Number(label.x) || 0;
  const y = Number(label.y) || 0;

  // TOP: tight top-right oval
  if (x > 62 && y < 32) return "top";

  // MID TOP: right-side area, below/left of top
  if (x > 48 && y < 48) return "midTop";

  // MID BOTTOM: diagonal central band around the ruins
  if (y < 62 && x > 22 && (x - y) > -28) return "midBottom";

  // BOTTOM: explicit bounds from black outline — x < 52, y > 48
  if (x < 42 && y > 48) return "bottom";
  return null;
}

function isLabelSectionControlled(label) {
  const nearestMarker = getNearestMarker(label);
  return !nearestMarker || !["obelisk", "outpost"].includes(nearestMarker.type);
}

function getNearestMarker(label) {
  const markers = getMarkers();
  let nearest = null;
  let nearestDistance = Infinity;
  markers.forEach((marker) => {
    const dx = Number(label.x) - marker.x;
    const dy = Number(label.y) - marker.y;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearest = marker;
      nearestDistance = distance;
    }
  });
  return nearestDistance <= 8 ? nearest : null;
}

function isLabelVisible(label) {
  if (!isLabelSectionControlled(label)) return true;
  const sec = getLabelSection(label);
  if (sec === null) return true; // outside all defined sections — always visible
  return visibleLabelSections[sec];
}

function renderList() {
  if (!markerList) return;
  const visibleMarkers = getVisibleMarkers();
  markerList.innerHTML = "";

  if (!visibleMarkers.length) {
    const empty = document.createElement("div");
    empty.className = "detail-empty";
    empty.textContent = "No markers found";
    markerList.appendChild(empty);
    return;
  }

  visibleMarkers.forEach((marker) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `marker-row${marker.id === selectedMarkerId ? " active" : ""}`;
    row.innerHTML = `<strong>${escapeHtml(marker.name)}</strong><span>${TYPE_LABELS[marker.type]} - X ${marker.x.toFixed(1)} / Y ${marker.y.toFixed(1)}</span>`;
    row.addEventListener("click", () => {
      selectMarker(marker.id);
      centerOnMarker(marker);
    });
    markerList.appendChild(row);
  });
}

function renderDetail() {
  if (!mapDetail) return;
  const marker = getMarkers().find((item) => item.id === selectedMarkerId);
  if (!marker) {
    mapDetail.innerHTML = '<div class="detail-empty">Select a marker</div>';
    return;
  }

  const deleteButton = marker.type === "custom"
    ? `<button class="detail-delete" id="deletePinBtn" type="button">Delete Pin</button>`
    : "";
  const resetButton = marker.locked && markerPositions[marker.id]
    ? `<button class="detail-reset" id="resetMarkerBtn" type="button">Reset Position</button>`
    : "";
  const actions = deleteButton || resetButton
    ? `<div class="detail-actions">${resetButton}${deleteButton}</div>`
    : "";

  mapDetail.innerHTML = `
    <span class="detail-badge marker-${marker.type}">${TYPE_LABELS[marker.type]}</span>
    <div>
      <strong class="detail-name">${escapeHtml(marker.name)}</strong>
      <span class="detail-type">Map marker</span>
    </div>
    <label class="detail-note-label" for="markerNoteInput">Notes</label>
    <textarea class="detail-note-editor" id="markerNoteInput" rows="7">${escapeHtml(marker.note)}</textarea>
    <div class="detail-location">X ${marker.x.toFixed(1)} / Y ${marker.y.toFixed(1)}</div>
    ${actions}
  `;

  const markerNoteInput = document.getElementById("markerNoteInput");
  markerNoteInput.addEventListener("input", () => {
    saveMarkerNote(marker.id, markerNoteInput.value);
  });

  const deletePinBtn = document.getElementById("deletePinBtn");
  if (deletePinBtn) {
    deletePinBtn.addEventListener("click", deleteSelectedPin);
  }
  const resetMarkerBtn = document.getElementById("resetMarkerBtn");
  if (resetMarkerBtn) {
    resetMarkerBtn.addEventListener("click", resetSelectedMarkerPosition);
  }
}

function render() {
  renderFilters();
  renderMarkers();
  renderList();
  renderLabelSectionControls();
  renderDetail();
}

function selectMarker(id) {
  selectedMarkerId = id;
  render();
}

function startMarkerDrag(event, markerId) {
  const marker = getMarkers().find((item) => item.id === markerId);
  if (!marker) return;

  selectedMarkerId = markerId;
  markerDragState = {
    pointerId: event.pointerId,
    markerId,
    didMove: false,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
  renderDetail();
}

function startLabelDrag(event, labelId) {
  labelDragState = {
    pointerId: event.pointerId,
    labelId,
    didMove: false,
    element: event.currentTarget.closest(".map-label"),
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function startLabelResize(event, labelId) {
  const label = getMapLabels().find((item) => item.id === labelId);
  if (!label) return;
  labelResizeState = {
    pointerId: event.pointerId,
    labelId,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: label.width || DEFAULT_LABEL_WIDTH,
    startHeight: label.height || DEFAULT_LABEL_HEIGHT,
    layerWidth: mapLayer.getBoundingClientRect().width,
    layerHeight: mapLayer.getBoundingClientRect().height,
    element: event.currentTarget.closest(".map-label"),
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function centerOnMarker(marker) {
  const stageRect = mapStage.getBoundingClientRect();
  const layerRect = mapLayer.getBoundingClientRect();
  const markerX = layerRect.width * (marker.x / 100);
  const markerY = layerRect.height * (marker.y / 100);
  view.x += stageRect.width / 2 - (layerRect.left - stageRect.left + markerX);
  view.y += stageRect.height / 2 - (layerRect.top - stageRect.top + markerY);
  applyView();
}

function applyView() {
  view.scale = Math.min(2.6, Math.max(0.78, view.scale));
  mapLayer.style.transform = `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.scale})`;
}

function zoomBy(amount) {
  view.scale += amount;
  applyView();
}

function resetView() {
  view = { scale: 1, x: 0, y: 0 };
  applyView();
}

function getMapPoint(event) {
  const rect = mapLayer.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 100,
    y: ((event.clientY - rect.top) / rect.height) * 100,
  };
}

function setMarkerPosition(markerId, point) {
  const x = Number(Math.min(100, Math.max(0, point.x)).toFixed(1));
  const y = Number(Math.min(100, Math.max(0, point.y)).toFixed(1));
  const customPin = getCustomPins().find((pin) => pin.id === markerId);

  if (customPin) {
    customPin.x = x;
    customPin.y = y;
    saveMapStages();
  } else {
    markerPositions[markerId] = { x, y };
    saveMarkerPositions();
  }
}

function moveSelectedMarker(event) {
  if (!markerDragState) return;
  setMarkerPosition(markerDragState.markerId, getMapPoint(event));
  markerDragState.didMove = true;
  suppressMarkerClick = true;
  renderMarkers();
  renderList();
  renderDetail();
}

function moveSelectedLabel(event) {
  if (!labelDragState) return;
  const point = getMapPoint(event);
  const label = getMapLabels().find((item) => item.id === labelDragState.labelId);
  if (!label) return;
  label.x = Number(Math.min(100, Math.max(0, point.x)).toFixed(1));
  label.y = Number(Math.min(100, Math.max(0, point.y)).toFixed(1));
  labelDragState.didMove = true;
  suppressMarkerClick = true;
  if (labelDragState.element) {
    labelDragState.element.style.left = `${label.x}%`;
    labelDragState.element.style.top = `${label.y}%`;
  }
  saveMapLabels();
}

function resizeSelectedLabel(event) {
  if (!labelResizeState) return;
  const label = getMapLabels().find((item) => item.id === labelResizeState.labelId);
  if (!label) return;
  const deltaXPct = ((event.clientX - labelResizeState.startX) / labelResizeState.layerWidth) * 100;
  const deltaYPct = ((event.clientY - labelResizeState.startY) / labelResizeState.layerHeight) * 100;
  label.width = Number(Math.min(42, Math.max(4, labelResizeState.startWidth + deltaXPct)).toFixed(1));
  label.height = Number(Math.min(24, Math.max(2.4, labelResizeState.startHeight + deltaYPct)).toFixed(1));
  if (labelResizeState.element) {
    labelResizeState.element.style.width = `${label.width}%`;
    labelResizeState.element.style.height = `${label.height}%`;
  }
  saveMapLabels();
}

function updateCoords(event) {
  const point = getMapPoint(event);
  const x = Math.min(100, Math.max(0, point.x));
  const y = Math.min(100, Math.max(0, point.y));
  if (mapCoords) mapCoords.textContent = `X ${x.toFixed(1)} / Y ${y.toFixed(1)}`;
}

function addCustomPin(event) {
  const point = getMapPoint(event);
  if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) return;

  const name = prompt("Pin name");
  if (!name) return;

  const pin = {
    id: `custom-${Date.now()}`,
    name: name.trim(),
    type: "custom",
    x: Number(point.x.toFixed(1)),
    y: Number(point.y.toFixed(1)),
    note: "Custom player marker.",
  };
  getCustomPins().push(pin);
  saveMapStages();
  selectedMarkerId = pin.id;
  addPinMode = false;
  addPinBtn.classList.remove("active");
  render();
}

function addMapLabel(event = null) {
  const point = event ? getMapPoint(event) : getViewportCenterMapPoint();
  if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) return;
  const label = {
    id: `label-${Date.now()}`,
    text: "New bubble",
    x: Number(point.x.toFixed(1)),
    y: Number(point.y.toFixed(1)),
    width: 13,
    height: 12,
    shape: activeLabelShape,
  };
  getMapLabels().push(label);
  saveMapLabels();
  editingLabelId = label.id;
  addLabelBtn?.classList.remove("active");
  renderMarkers();
}

function dropLabelOnMap(text, point, shape) {
  const label = {
    id: `label-${Date.now()}`,
    text: String(text).trim() || "Label",
    x: Number(Math.min(100, Math.max(0, point.x)).toFixed(1)),
    y: Number(Math.min(100, Math.max(0, point.y)).toFixed(1)),
    width: 13,
    height: 12,
    shape: shape || activeLabelShape,
  };
  getMapLabels().push(label);
  saveMapLabels();
  renderMarkers();
}

function getViewportCenterMapPoint() {
  const viewportRect = mapViewport.getBoundingClientRect();
  const layerRect = mapLayer.getBoundingClientRect();
  return {
    x: Math.min(100, Math.max(0, ((viewportRect.left + viewportRect.width / 2 - layerRect.left) / layerRect.width) * 100)),
    y: Math.min(100, Math.max(0, ((viewportRect.top + viewportRect.height / 2 - layerRect.top) / layerRect.height) * 100)),
  };
}

function startLabelEdit(labelId) {
  editingLabelId = labelId;
  renderMarkers();
}

function updateMapLabelText(labelId, text) {
  const label = getMapLabels().find((item) => item.id === labelId);
  if (!label) return;
  label.text = text;
  saveMapLabels();
}

function finishLabelEdit(labelId) {
  const label = getMapLabels().find((item) => item.id === labelId);
  if (label && !label.text.trim()) {
    deleteMapLabel(labelId);
    return;
  }
  if (label) {
    label.text = label.text.trim();
    saveMapLabels();
  }
  if (editingLabelId === labelId) editingLabelId = null;
  renderMarkers();
}

function resizeMapLabelInput(input) {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

async function exportCurrentStagePng() {
  const image = await loadImage("icons/interactive-map.png");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 600;
  canvas.height = image.naturalHeight || 450;
  const ctx = canvas.getContext("2d");
  const exportScale = getExportScale(canvas);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  getMapLabels().filter(isLabelVisible).forEach((label) => drawExportLabel(ctx, canvas, label, exportScale));

  canvas.toBlob((blob) => {
    if (!blob) return;
    const stage = getActiveMapStage();
    downloadBlob(blob, `ark-map-${slugify(stage.name)}-${formatDateForFile(new Date())}.png`);
  }, "image/png");
}

function getExportScale(canvas) {
  const layerWidth = mapLayer.getBoundingClientRect().width;
  return layerWidth > 0 ? canvas.width / layerWidth : canvas.width / 1000;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawExportMarker(ctx, canvas, marker, scale = 1) {
  const x = (marker.x / 100) * canvas.width;
  const y = (marker.y / 100) * canvas.height;
  const color = getMarkerColor(marker.type);
  const markerOffset = 12 * scale;
  const markerSize = 20 * scale;
  const markerRadius = 10 * scale;
  ctx.save();
  ctx.translate(x, y - markerOffset);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2 * scale;
  roundedRectPath(ctx, -markerSize / 2, -markerSize / 2, markerSize, markerSize, markerRadius);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y - markerOffset, 3.4 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawExportLabel(ctx, canvas, label, scale = 1) {
  const x = (label.x / 100) * canvas.width;
  const y = (label.y / 100) * canvas.height;
  const width = Math.max(48 * scale, ((label.width || DEFAULT_LABEL_WIDTH) / 100) * canvas.width);
  const height = Math.max(22 * scale, ((label.height || DEFAULT_LABEL_HEIGHT) / 100) * canvas.height);
  const fontSize = 13.2 * scale;
  const paddingX = 5 * scale;
  const paddingY = 3 * scale;
  const lineHeight = 13.625 * scale;
  ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
  const maxLines = Math.max(1, Math.floor((height - paddingY * 2) / lineHeight));
  const lines = wrapCanvasText(ctx, label.text, width - paddingX * 2).slice(0, maxLines);
  const left = x - width / 2;

  ctx.save();
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 2 * scale;
  drawExportBubblePath(ctx, left, y, width, height, label.shape || "bubble-left", 6 * scale);
  ctx.stroke();
  drawExportBubblePath(ctx, left + 1 * scale, y + 1 * scale, width - 2 * scale, height - 2 * scale, label.shape || "bubble-left", 5 * scale);
  ctx.clip();
  ctx.fillStyle = "#050505";
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textBlockHeight = lines.length * lineHeight;
  const textStartY = y + Math.max(paddingY, (height - textBlockHeight) / 2);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, textStartY + lineHeight / 2 + index * lineHeight);
  });
  ctx.restore();
}

function drawExportBubblePath(ctx, x, y, width, height, shape, radius) {
  const tail = Math.min(width, height) * 0.22;
  ctx.beginPath();
  if (shape === "oval") {
    ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (shape === "bubble-right") {
    ctx.ellipse(x + width * 0.48, y + height / 2, width * 0.48, height * 0.48, 0, Math.PI * 0.15, Math.PI * 1.85);
    ctx.lineTo(x + width + tail, y + height * 0.56);
    ctx.lineTo(x + width * 0.91, y + height * 0.72);
  } else if (shape === "bubble-top") {
    ctx.ellipse(x + width / 2, y + height * 0.54, width * 0.48, height * 0.46, 0, Math.PI * 1.15, Math.PI * 0.85);
    ctx.lineTo(x + width * 0.55, y - tail);
    ctx.lineTo(x + width * 0.38, y + height * 0.09);
  } else if (shape === "bubble-bottom") {
    ctx.ellipse(x + width / 2, y + height * 0.46, width * 0.48, height * 0.46, 0, Math.PI * 0.85, Math.PI * 2.15);
    ctx.lineTo(x + width * 0.45, y + height + tail);
    ctx.lineTo(x + width * 0.62, y + height * 0.91);
  } else {
    ctx.ellipse(x + width * 0.52, y + height / 2, width * 0.48, height * 0.48, 0, Math.PI * 1.15, Math.PI * 0.85);
    ctx.lineTo(x - tail, y + height * 0.56);
    ctx.lineTo(x + width * 0.09, y + height * 0.72);
  }
  ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const chunks = splitCanvasWord(ctx, word, maxWidth);
    chunks.forEach((chunk) => {
      const testLine = line ? `${line} ${chunk}` : chunk;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = chunk;
      } else {
        line = testLine;
      }
    });
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function splitCanvasWord(ctx, word, maxWidth) {
  if (ctx.measureText(word).width <= maxWidth) return [word];
  const chunks = [];
  let chunk = "";
  [...word].forEach((char) => {
    const testChunk = `${chunk}${char}`;
    if (ctx.measureText(testChunk).width > maxWidth && chunk) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk = testChunk;
    }
  });
  if (chunk) chunks.push(chunk);
  return chunks;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function getMarkerColor(type) {
  return {
    obelisk: "#2f8fae",
    shrine: "#5aa36b",
    altar: "#8b6ac8",
    outpost: "#d89a3d",
    custom: "#e3b729",
    anubis: "#5c6f77",
  }[type] || "#0b74d1";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDateForFile(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join("-");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "stage";
}

function deleteMapLabel(labelId) {
  const stage = getActiveMapStage();
  stage.labels = stage.labels.filter((label) => label.id !== labelId);
  hideLabelContextMenu();
  saveMapLabels();
  renderMarkers();
}

function showLabelContextMenu(x, y, labelId) {
  hideLabelContextMenu();
  labelContextMenu = document.createElement("div");
  labelContextMenu.className = "label-context-menu";
  labelContextMenu.style.left = `${x}px`;
  labelContextMenu.style.top = `${y}px`;
  labelContextMenu.innerHTML = `
    <button type="button" data-action="edit">Edit Label</button>
    <button type="button" data-action="delete">Delete Label</button>
  `;
  labelContextMenu.querySelector('[data-action="edit"]').addEventListener("click", () => {
    hideLabelContextMenu();
    startLabelEdit(labelId);
  });
  labelContextMenu.querySelector('[data-action="delete"]').addEventListener("click", () => {
    deleteMapLabel(labelId);
  });
  document.body.appendChild(labelContextMenu);
}

function hideLabelContextMenu() {
  if (!labelContextMenu) return;
  labelContextMenu.remove();
  labelContextMenu = null;
}

function deleteMarker(markerId) {
  const stage = getActiveMapStage();
  stage.pins = getCustomPins().filter((pin) => pin.id !== markerId);
  delete markerNotes[markerId];
  saveMapStages();
  saveMarkerNotes();
  if (selectedMarkerId === markerId) selectedMarkerId = MAP_MARKERS[0].id;
  render();
}

function deleteSelectedPin() {
  deleteMarker(selectedMarkerId);
}

function resetMarkerPosition(markerId) {
  delete markerPositions[markerId];
  saveMarkerPositions();
  render();
}

function resetSelectedMarkerPosition() {
  resetMarkerPosition(selectedMarkerId);
}

function loadCustomPins() {
  try {
    const pins = JSON.parse(localStorage.getItem(CUSTOM_PIN_KEY) || "[]");
    return Array.isArray(pins) ? pins : [];
  } catch {
    return [];
  }
}

function saveCustomPins() {
  localStorage.setItem(CUSTOM_PIN_KEY, JSON.stringify(getCustomPins()));
}

function getDefaultMapStages(labels = [], pins = []) {
  return [
    { id: "stage-1", name: "Before First Ark", labels, pins },
    { id: "stage-2", name: "6 mins until Ark", labels: [], pins: [] },
    { id: "stage-3", name: "No Ark", labels: [], pins: [] },
  ];
}

function loadMapStages(legacyPins = []) {
  try {
    const stages = JSON.parse(localStorage.getItem(MAP_STAGES_KEY) || "null");
    if (Array.isArray(stages) && stages.length) {
      return stages.map((stage, index) => ({
        id: String(stage.id || `stage-${index + 1}`),
        name: normalizeDefaultStageName(stage.name, index),
        labels: Array.isArray(stage.labels) ? stage.labels : [],
        pins: Array.isArray(stage.pins) ? stage.pins : index === 0 ? legacyPins : [],
      }));
    }
    const oldLabels = JSON.parse(localStorage.getItem(MAP_LABELS_KEY) || "[]");
    return getDefaultMapStages(Array.isArray(oldLabels) ? oldLabels : [], legacyPins);
  } catch {
    return getDefaultMapStages([], legacyPins);
  }
}

function normalizeDefaultStageName(name, index) {
  const defaultNames = ["Before First Ark", "6 mins until Ark", "No Ark"];
  if (index < defaultNames.length && (!name || /^Stage [1-3]$/.test(String(name)))) {
    return defaultNames[index];
  }
  return String(name || `Stage ${index + 1}`);
}

function saveMapStages() {
  localStorage.setItem(MAP_STAGES_KEY, JSON.stringify(mapStages));
}

function saveMapLabels() {
  saveMapStages();
}

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
    });
  }
  return sqlJsPromise;
}

function collectBackupState() {
  saveMapStages();
  saveTeamPlayers();
  saveTeamLayout();
  saveLanePlans();
  saveArkSkills();
  return BACKUP_KEYS.reduce((state, key) => {
    const value = localStorage.getItem(key);
    if (value !== null) state[key] = value;
    return state;
  }, {});
}

async function exportStateDb() {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const insert = db.prepare("INSERT INTO app_state (key, value) VALUES (?, ?)");
  Object.entries(collectBackupState()).forEach(([key, value]) => {
    insert.run([key, value]);
  });
  insert.free();

  downloadBlob(
    new Blob([db.export()], { type: "application/octet-stream" }),
    `ark-planner-backup-${formatDateForFile(new Date())}.db`
  );
  db.close();
}

async function importStateDb(file) {
  const SQL = await getSqlJs();
  const buffer = await file.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));
  const result = db.exec("SELECT key, value FROM app_state");
  if (!result.length) {
    db.close();
    alert("This database does not contain planner backup data.");
    return;
  }

  result[0].values.forEach(([key, value]) => {
    if (BACKUP_KEYS.includes(key)) localStorage.setItem(key, value);
  });
  db.close();
  location.reload();
}

function getActiveMapStage() {
  let stage = mapStages.find((item) => item.id === activeMapStageId);
  if (!stage) {
    stage = mapStages[0] || getDefaultMapStages()[0];
    mapStages = mapStages.length ? mapStages : getDefaultMapStages();
    activeMapStageId = stage.id;
  }
  return stage;
}

function getMapLabels() {
  return getActiveMapStage().labels;
}

function getCustomPins() {
  const stage = getActiveMapStage();
  stage.pins ||= [];
  return stage.pins;
}

function renderMapStageControls() {
  mapStageSwitcher.innerHTML = "";

  if (mapStages.length > 3) {
    const select = document.createElement("select");
    select.className = "map-stage-select";
    select.setAttribute("aria-label", "Map stage");
    mapStages.forEach((stage) => {
      const option = document.createElement("option");
      option.value = stage.id;
      option.textContent = stage.name;
      option.selected = stage.id === activeMapStageId;
      select.appendChild(option);
    });
    select.addEventListener("change", () => {
      activeMapStageId = select.value;
      editingLabelId = null;
      render();
    });
    mapStageSwitcher.appendChild(select);
    return;
  }

  mapStages.forEach((stage) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `map-stage-btn${stage.id === activeMapStageId ? " active" : ""}`;
    button.textContent = stage.name;
    button.addEventListener("click", () => {
      activeMapStageId = stage.id;
      editingLabelId = null;
      render();
    });
    mapStageSwitcher.appendChild(button);
  });

}

function addMapStage() {
  const nextNumber = mapStages.length + 1;
  const stage = {
    id: `stage-${Date.now()}`,
    name: `Stage ${nextNumber}`,
    labels: [],
    pins: [],
  };
  mapStages.push(stage);
  activeMapStageId = stage.id;
  saveMapStages();
  renderLanePlanTabs();
  renderLanePlan();
  renderMarkers();
}

function openStageManager() {
  stageModalOverlay.hidden = false;
  renderStageManager();
}

function closeStageManager() {
  stageModalOverlay.hidden = true;
}

function renderStageManager() {
  stageManagerList.innerHTML = "";
  mapStages.forEach((stage, index) => {
    const locked = index < 3;
    const row = document.createElement("div");
    row.className = "stage-manager-row";
    row.innerHTML = `
      <span class="stage-manager-index">${index + 1}</span>
      <input type="text" value="${escapeHtml(stage.name)}" data-stage-name="${stage.id}" aria-label="Stage name">
      <button class="detail-delete" type="button" data-stage-delete="${stage.id}" ${locked ? "disabled" : ""}>Delete</button>
    `;
    stageManagerList.appendChild(row);
  });

  stageManagerList.querySelectorAll("[data-stage-name]").forEach((input) => {
    input.addEventListener("input", () => renameMapStage(input.dataset.stageName, input.value));
  });
  stageManagerList.querySelectorAll("[data-stage-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteMapStage(button.dataset.stageDelete));
  });
}

function renameMapStage(stageId, name) {
  const stage = mapStages.find((item) => item.id === stageId);
  if (!stage) return;
  stage.name = name.trim() || "Untitled Stage";
  saveMapStages();
  renderMapStageControls();
  renderLanePlanTabs();
  renderLanePlan();
}

function deleteMapStage(stageId) {
  const index = mapStages.findIndex((stage) => stage.id === stageId);
  if (index < 3) return;
  mapStages.splice(index, 1);
  if (activeMapStageId === stageId) {
    activeMapStageId = mapStages[Math.min(index, mapStages.length - 1)]?.id || "stage-1";
  }
  saveMapStages();
  renderStageManager();
  renderMapStageControls();
  renderLanePlanTabs();
  renderLanePlan();
  renderMarkers();
}

function loadMarkerPositions() {
  try {
    const positions = JSON.parse(localStorage.getItem(MARKER_POSITIONS_KEY) || "{}");
    return positions && typeof positions === "object" && !Array.isArray(positions) ? positions : {};
  } catch {
    return {};
  }
}

function saveMarkerPositions() {
  localStorage.setItem(MARKER_POSITIONS_KEY, JSON.stringify(markerPositions));
}

function loadMarkerNotes() {
  try {
    const notes = JSON.parse(localStorage.getItem(MARKER_NOTES_KEY) || "{}");
    return notes && typeof notes === "object" && !Array.isArray(notes) ? notes : {};
  } catch {
    return {};
  }
}

function loadVisibleLabelSections() {
  const defaults = MAP_LABEL_SECTIONS.reduce((sections, section) => {
    sections[section.key] = true;
    return sections;
  }, {});

  try {
    const parsed = JSON.parse(localStorage.getItem(MAP_LABEL_SECTIONS_KEY) || "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
    return MAP_LABEL_SECTIONS.reduce((sections, section) => {
      sections[section.key] = parsed[section.key] !== false;
      return sections;
    }, {});
  } catch {
    return defaults;
  }
}

function saveVisibleLabelSections() {
  localStorage.setItem(MAP_LABEL_SECTIONS_KEY, JSON.stringify(visibleLabelSections));
}

function saveMarkerNote(markerId, note) {
  markerNotes[markerId] = note;
  saveMarkerNotes();
  renderMarkers();
  renderList();
}

function saveMarkerNotes() {
  localStorage.setItem(MARKER_NOTES_KEY, JSON.stringify(markerNotes));
}

function loadTeamPlayers() {
  try {
    const players = JSON.parse(localStorage.getItem(TEAM_PLAYERS_KEY) || "[]");
    return Array.isArray(players) ? players : [];
  } catch {
    return [];
  }
}

function saveTeamPlayers() {
  localStorage.setItem(TEAM_PLAYERS_KEY, JSON.stringify(teamPlayers));
}

function getDefaultTeamLayout() {
  return {
    rowCounts: { a: 5, b: 10, c: 10, d: 5 },
    laneNames: { a: "A Lane", b: "B Lane", c: "C Lane", d: "D Lane" },
    coordinators: [],
    assignments: {},
  };
}

function loadTeamLayout() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEAM_LAYOUT_KEY) || "null");
    const fallback = getDefaultTeamLayout();
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      rowCounts: { ...fallback.rowCounts, ...(parsed.rowCounts || {}) },
      laneNames: { ...fallback.laneNames, ...(parsed.laneNames || {}) },
      coordinators: Array.isArray(parsed.coordinators) ? parsed.coordinators.slice(0, 5) : [],
      assignments: parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {},
    };
  } catch {
    return getDefaultTeamLayout();
  }
}

function saveTeamLayout() {
  localStorage.setItem(TEAM_LAYOUT_KEY, JSON.stringify(teamLayout));
}

function renderTeam() {
  renderPlayerList();
  renderRolesPanel();
  renderMapRolesPanel();
  renderTeamRolesPanel();
  renderLanePlanTabs();
  renderLanePlan();
  renderArkSkills();
}

function renderMapRolesPanel() {
  const container = document.getElementById("mapRolesPanel");
  if (!container) return;
  renderRolesSidebarInto(container);
}

function renderTeamRolesPanel() {
  const container = document.getElementById("teamRolesPanel");
  if (!container) return;
  renderRolesSidebarInto(container);
}

function renderPlayerList() {
  renderPlayerListInto(playerList, playerCount, "Add players or load a CSV", true);
  renderPlayerListInto(mapPlayerList, mapPlayerCount, "Add players or load a CSV", true);
}

function renderPlayerListInto(container, countNode, emptyText, editable) {
  if (!container) return;
  container.innerHTML = "";
  if (countNode) {
    countNode.textContent = `${teamPlayers.length} player${teamPlayers.length === 1 ? "" : "s"}`;
  }

  if (!teamPlayers.length) {
    const empty = document.createElement("div");
    empty.className = "detail-empty";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  // Detect if this is the map player panel (used to allow map-drop dragging)
  const isMapPanel = container === mapPlayerList;

  teamPlayers.forEach((player, index) => {
    const isCoordinator = teamLayout.coordinators.includes(player.id);
    const coordinatorLimitReached = teamLayout.coordinators.length >= 5 && !isCoordinator;
    const assignmentLabel = getPlayerAssignmentLabel(player.id);
    const row = document.createElement("div");
    row.className = `player-card${isCoordinator ? " coordinator" : ""}${isMapPanel ? " map-draggable" : ""}`;
    row.draggable = true;
    row.dataset.playerId = player.id;
    row.innerHTML = `
      <span class="player-slot">${escapeHtml(assignmentLabel)}</span>
      <span>
        <span class="player-name">${escapeHtml(player.name)}</span>
      </span>
      ${editable ? `<button class="player-coordinator${isCoordinator ? " active" : ""}" type="button" title="Toggle coordinator" aria-label="Toggle coordinator" ${coordinatorLimitReached ? "disabled" : ""}>C</button>
      <button class="player-remove" type="button" title="Remove player" aria-label="Remove player">x</button>` : `<span class="player-map-badge">${isCoordinator ? "Coordinator" : ""}</span>`}
    `;
    // All player cards in both panels are draggable
    // On the team board panel: drag means assign to lane slot (player id)
    // On the map panel: drag means drop onto map as a label (player:id prefix)
    row.addEventListener("dragstart", (event) => {
      if (isMapPanel) {
        event.dataTransfer.setData("text/plain", `player:${player.id}`);
      } else {
        event.dataTransfer.setData("text/plain", player.id);
      }
      event.dataTransfer.effectAllowed = "copy";
    });
    if (editable) {
      row.querySelector(".player-coordinator").addEventListener("click", () => toggleCoordinator(player.id));
      row.querySelector(".player-remove").addEventListener("click", () => removePlayer(player.id));
    }
    container.appendChild(row);
  });
}

function getPlayerAssignmentLabel(playerId) {
  const slotId = Object.keys(teamLayout.assignments).find((slot) => teamLayout.assignments[slot] === playerId);
  if (!slotId) return "-";
  const [laneKey, rowNumber] = slotId.split("-");
  return `${laneKey.toUpperCase()}${rowNumber}`;
}

function renderLaneControls(container = document.getElementById("laneControls")) {
  if (!container) return;
  const laneControls = container;
  laneControls.innerHTML = "";
  LANES.forEach((lane) => {
    const control = document.createElement("div");
    control.className = "lane-control";
    control.innerHTML = `
      <span>${escapeHtml(teamLayout.laneNames[lane.key])}: ${teamLayout.rowCounts[lane.key]}</span>
      <button type="button" data-lane="${lane.key}" data-delta="-1" aria-label="Remove ${lane.label} row">-</button>
      <button type="button" data-lane="${lane.key}" data-delta="1" aria-label="Add ${lane.label} row">+</button>
    `;
    laneControls.appendChild(control);
  });

  laneControls.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => changeLaneRows(button.dataset.lane, Number(button.dataset.delta)));
  });
}

function renderTeamBoard(container = document.getElementById("teamBoard")) {
  if (!container) return;
  container.innerHTML = "";
  LANES.forEach((lane) => {
    const column = document.createElement("div");
    column.className = `lane-column lane-${lane.key}`;
    column.innerHTML = `
      <label class="lane-title">
        <input type="text" value="${escapeHtml(teamLayout.laneNames[lane.key])}" data-lane-name="${lane.key}" aria-label="${lane.key.toUpperCase()} lane name">
      </label>
    `;

    for (let index = 1; index <= teamLayout.rowCounts[lane.key]; index += 1) {
      const slotId = `${lane.key}-${index}`;
      const assignedId = teamLayout.assignments[slotId];
      const player = teamPlayers.find((item) => item.id === assignedId);
      const slot = document.createElement("div");
      slot.className = "lane-slot";
      slot.innerHTML = `
        <div class="slot-label">${lane.key.toUpperCase()}${index}</div>
        <div class="slot-drop${player ? " filled" : ""}" data-slot="${slotId}">
          ${player ? renderAssignedPlayer(player, slotId) : "drop name"}
        </div>
      `;
      column.appendChild(slot);
    }

    container.appendChild(column);
  });

  container.querySelectorAll(".slot-drop").forEach((slot) => {
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      slot.classList.add("drag-over");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("drag-over");
      assignPlayerToSlot(event.dataTransfer.getData("text/plain"), slot.dataset.slot);
    });
  });

  container.querySelectorAll(".slot-clear").forEach((button) => {
    button.addEventListener("click", () => clearSlot(button.dataset.slot));
  });

  container.querySelectorAll("[data-lane-name]").forEach((input) => {
    input.addEventListener("change", () => renameLane(input.dataset.laneName, input.value));
    input.addEventListener("blur", () => renameLane(input.dataset.laneName, input.value));
  });
}

function renderAssignedPlayer(player, slotId) {
  const isCoordinator = teamLayout.coordinators.includes(player.id);
  return `
    <span class="${isCoordinator ? "slot-player coordinator" : "slot-player"}">
      <span class="slot-player-name">${escapeHtml(player.name)}</span>
      ${isCoordinator ? '<span class="slot-player-id">Coordinator</span>' : ""}
    </span>
    <button class="slot-clear" type="button" data-slot="${slotId}" title="Clear slot" aria-label="Clear slot">x</button>
  `;
}

function addPlayer(name, id = "") {
  const cleanName = name.trim();
  const cleanId = id.trim() || makePlayerId(cleanName);
  if (!cleanName) return;

  const existing = teamPlayers.find((player) => player.id === cleanId);
  if (existing) {
    existing.name = cleanName;
  } else {
    teamPlayers.push({ name: cleanName, id: cleanId });
  }

  saveTeamPlayers();
  renderTeam();
}

function makePlayerId(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player";
  let id = base;
  let index = 2;
  while (teamPlayers.some((player) => player.id === id && player.name !== name)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function removePlayer(playerId) {
  teamPlayers = teamPlayers.filter((player) => player.id !== playerId);
  teamLayout.coordinators = teamLayout.coordinators.filter((id) => id !== playerId);
  Object.entries(teamLayout.assignments).forEach(([slot, assignedId]) => {
    if (assignedId === playerId) delete teamLayout.assignments[slot];
  });
  saveTeamPlayers();
  saveTeamLayout();
  renderTeam();
}

function toggleCoordinator(playerId) {
  if (teamLayout.coordinators.includes(playerId)) {
    teamLayout.coordinators = teamLayout.coordinators.filter((id) => id !== playerId);
  } else if (teamLayout.coordinators.length < 5) {
    teamLayout.coordinators.push(playerId);
  }

  saveTeamLayout();
  renderTeam();
}

function assignPlayerToSlot(playerId, slotId) {
  if (!teamPlayers.some((player) => player.id === playerId)) return;
  Object.keys(teamLayout.assignments).forEach((existingSlotId) => {
    if (teamLayout.assignments[existingSlotId] === playerId) {
      delete teamLayout.assignments[existingSlotId];
    }
  });
  teamLayout.assignments[slotId] = playerId;
  saveTeamLayout();
  renderPlayerList();
  renderLanePlan();
}

function clearSlotRole(slotId) {
  const [laneKey, rowNumber] = slotId.split("-");
  if (lanePlans[laneKey]?.rows?.[rowNumber]) {
    delete lanePlans[laneKey].rows[rowNumber].role;
    saveLanePlans();
    renderTeamBoard();
  }
}

function assignRoleToSlot(role, slotId) {
  const [laneKey, rowNumber] = slotId.split("-");
  lanePlans[laneKey] ||= { notes: "", rows: {} };
  lanePlans[laneKey].rows[rowNumber] ||= {};
  lanePlans[laneKey].rows[rowNumber].role = role;
  saveLanePlans();
  renderTeamBoard();
  renderPlayerList();
}

function clearSlot(slotId) {
  delete teamLayout.assignments[slotId];
  saveTeamLayout();
  renderPlayerList();
  renderLanePlan();
}

function changeLaneRows(laneKey, delta) {
  const nextCount = Math.min(15, Math.max(1, teamLayout.rowCounts[laneKey] + delta));
  teamLayout.rowCounts[laneKey] = nextCount;

  Object.keys(teamLayout.assignments).forEach((slotId) => {
    const [slotLane, slotIndex] = slotId.split("-");
    if (slotLane === laneKey && Number(slotIndex) > nextCount) {
      delete teamLayout.assignments[slotId];
    }
  });

  saveTeamLayout();
  renderTeam();
}

function renameLane(laneKey, name) {
  const cleanName = name.trim() || `${laneKey.toUpperCase()} Lane`;
  if (teamLayout.laneNames[laneKey] === cleanName) return;
  teamLayout.laneNames[laneKey] = cleanName;
  saveTeamLayout();
  renderLanePlanTabs();
  renderLanePlan();
}

function getDefaultLanePlans() {
  return {
    a: { notes: "", rows: {} },
    b: { notes: "", rows: {} },
    c: { notes: "", rows: {} },
    d: { notes: "", rows: {} },
  };
}

function loadLanePlans() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LANE_PLANS_KEY) || "null");
    const fallback = getDefaultLanePlans();
    if (!parsed || typeof parsed !== "object") return fallback;
    return LANES.reduce((plans, lane) => {
      plans[lane.key] = {
        notes: parsed[lane.key]?.notes ?? fallback[lane.key].notes,
        rows: parsed[lane.key]?.rows && typeof parsed[lane.key].rows === "object" ? parsed[lane.key].rows : fallback[lane.key].rows,
      };
      return plans;
    }, {});
  } catch {
    return getDefaultLanePlans();
  }
}

function saveLanePlans() {
  localStorage.setItem(LANE_PLANS_KEY, JSON.stringify(lanePlans));
}

function renderLanePlanTabs() {
  lanePlanTabs.innerHTML = "";
  const overviewButton = document.createElement("button");
  overviewButton.type = "button";
  overviewButton.className = `lane-plan-tab${activeLanePlan === "overview" ? " active" : ""}`;
  overviewButton.textContent = "Team Overview";
  overviewButton.addEventListener("click", () => {
    activeLanePlan = "overview";
    renderLanePlanTabs();
    renderLanePlan();
  });
  lanePlanTabs.appendChild(overviewButton);

  LANES.forEach((lane) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lane-plan-tab${activeLanePlan === lane.key ? " active" : ""}`;
    button.textContent = teamLayout.laneNames[lane.key];
    button.addEventListener("click", () => {
      activeLanePlan = lane.key;
      renderLanePlanTabs();
      renderLanePlan();
    });
    lanePlanTabs.appendChild(button);
  });
}

function renderLanePlan() {
  if (activeLanePlan === "overview") {
    renderTeamOverviewView();
    return;
  }

  const laneKey = activeLanePlan;
  const laneName = teamLayout.laneNames[laneKey];
  const rowCount = teamLayout.rowCounts[laneKey];
  lanePlans[laneKey] ||= { notes: "", rows: {} };
  const stageHeaders = mapStages.map((stage) => `<th>${escapeHtml(stage.name)}</th>`).join("");

  const rows = Array.from({ length: rowCount }, (_, index) => {
    const rowNumber = index + 1;
    const slotId = `${laneKey}-${rowNumber}`;
    const player = teamPlayers.find((item) => item.id === teamLayout.assignments[slotId]);
    const plan = lanePlans[laneKey].rows[rowNumber] || {};
    const stageCells = mapStages.map((stage) => `
        <td class="lane-plan-drop-cell" data-drop-target="stage" data-drop-stage="${stage.id}" data-drop-row="${rowNumber}"><textarea data-plan-stage="${stage.id}" data-row="${rowNumber}">${escapeHtml(getLanePlanStageValue(plan, stage))}</textarea></td>
    `).join("");
    const rolesList = getPlanRoles(plan);
    const rolesHtml = rolesList.map((r, ri) =>
      `<span class="role-tag">${escapeHtml(r)}<button class="role-tag-remove" type="button" data-row="${rowNumber}" data-role-index="${ri}" aria-label="Remove role">×</button></span>`
    ).join("");
    return `
      <tr>
        <th>${laneKey.toUpperCase()}${rowNumber}</th>
        <td class="lane-plan-player">${player ? renderPlanPlayer(player) : "drop name"}</td>
        ${stageCells}
        <td class="lane-plan-drop-cell" data-drop-target="field" data-drop-field="teleport" data-drop-row="${rowNumber}"><textarea data-plan-field="teleport" data-row="${rowNumber}">${escapeHtml(plan.teleport || "")}</textarea></td>
        <td class="lane-plan-drop-cell" data-drop-target="field" data-drop-field="entering" data-drop-row="${rowNumber}"><textarea data-plan-field="entering" data-row="${rowNumber}">${escapeHtml(plan.entering || "")}</textarea></td>
      </tr>
    `;
  }).join("");

  lanePlanWrap.innerHTML = `
    <div class="lane-plan-with-roles">
      <div class="lane-plan-roles-sidebar" id="laneRolesSidebar">
        <div class="roles-panel-title">Roles</div>
      </div>
      <div class="lane-plan-main">
        <div class="lane-plan-title">${escapeHtml(laneName)}</div>
        <div class="lane-plan-scroll">
          <table class="lane-plan-table" style="min-width: ${640 + mapStages.length * 230}px">
            <thead>
              <tr>
                <th></th>
                <th>Player</th>
                ${stageHeaders}
                <th>Teleport</th>
                <th>Entering Map</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="lane-plan-notes">
          <strong>NOTES</strong>
          <textarea id="lanePlanNotes">${escapeHtml(lanePlans[laneKey].notes || "")}</textarea>
        </div>
      </div>
    </div>
  `;

  // Render roles sidebar inside lane plan
  renderRolesSidebarInto(document.getElementById("laneRolesSidebar"));

  // Role drop zones on the role-tags-wrap
  lanePlanWrap.querySelectorAll("[data-role-drop]").forEach((zone) => {
    const rowNumber = zone.dataset.roleDrop;
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("drag-over");
      const data = event.dataTransfer.getData("text/plain");
      if (data.startsWith("role:")) {
        addRoleToRow(laneKey, rowNumber, data.slice(5));
      }
    });
  });

  // Manual role input — press Enter or comma to add
  lanePlanWrap.querySelectorAll(".role-manual-input").forEach((input) => {
    const rowNumber = input.dataset.row;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        const val = input.value.trim().replace(/,$/, "");
        if (val) {
          addRoleToRow(laneKey, rowNumber, val);
          input.value = "";
        }
      }
    });
    input.addEventListener("blur", () => {
      const val = input.value.trim();
      if (val) {
        addRoleToRow(laneKey, rowNumber, val);
        input.value = "";
      }
    });
  });

  // Role tag remove buttons
  lanePlanWrap.querySelectorAll(".role-tag-remove").forEach((button) => {
    button.addEventListener("click", () => {
      removeRoleFromRow(laneKey, button.dataset.row, Number(button.dataset.roleIndex));
    });
  });

  lanePlanWrap.querySelectorAll("[data-plan-stage]").forEach((input) => {
    input.addEventListener("input", () => updateLanePlanStageCell(laneKey, input.dataset.row, input.dataset.planStage, input.value));
  });
  lanePlanWrap.querySelectorAll("[data-plan-field]").forEach((input) => {
    input.addEventListener("input", () => updateLanePlanCell(laneKey, input.dataset.row, input.dataset.planField, input.value));
  });

  // Role drop support on stage / teleport / entering cells
  lanePlanWrap.querySelectorAll(".lane-plan-drop-cell").forEach((cell) => {
    cell.addEventListener("dragover", (event) => {
      if (event.dataTransfer.types.includes("text/plain")) {
        event.preventDefault();
        cell.classList.add("drag-over");
      }
    });
    cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
    cell.addEventListener("drop", (event) => {
      event.preventDefault();
      cell.classList.remove("drag-over");
      const data = event.dataTransfer.getData("text/plain");
      if (!data.startsWith("role:")) return;
      const role = data.slice(5);
      const textarea = cell.querySelector("textarea");
      if (!textarea) return;
      const current = textarea.value;
      textarea.value = current ? `${current}\n${role}` : role;
      textarea.dispatchEvent(new Event("input"));
    });
  });
  document.getElementById("lanePlanNotes").addEventListener("input", (event) => {
    lanePlans[laneKey].notes = event.target.value;
    saveLanePlans();
  });
}

function getLanePlanStageValue(plan, stage) {
  if (plan.stages?.[stage.id] !== undefined) return plan.stages[stage.id];
  const legacyFields = {
    "stage-1": "before",
    "stage-2": "until",
    "stage-3": "noArk",
  };
  return legacyFields[stage.id] ? plan[legacyFields[stage.id]] || "" : "";
}

function getPlanRoles(plan) {
  if (Array.isArray(plan.roles)) return plan.roles;
  // Legacy: single string stored in plan.role
  if (plan.role && typeof plan.role === "string" && plan.role.trim()) return [plan.role.trim()];
  return [];
}

function addRoleToRow(laneKey, rowNumber, role) {
  lanePlans[laneKey] ||= { notes: "", rows: {} };
  lanePlans[laneKey].rows[rowNumber] ||= {};
  const row = lanePlans[laneKey].rows[rowNumber];
  const current = getPlanRoles(row);
  if (!current.includes(role)) {
    row.roles = [...current, role];
    // keep legacy role field in sync with first role
    row.role = row.roles[0] || "";
    delete row.role; // clean up legacy field — roles array is canonical now
  }
  saveLanePlans();
  renderLanePlan();
}

function removeRoleFromRow(laneKey, rowNumber, roleIndex) {
  lanePlans[laneKey] ||= { notes: "", rows: {} };
  const row = lanePlans[laneKey].rows[rowNumber];
  if (!row) return;
  const current = getPlanRoles(row);
  current.splice(roleIndex, 1);
  row.roles = current;
  saveLanePlans();
  renderLanePlan();
}

function renderRolesSidebarInto(container) {
  if (!container) return;
  // preserve the title if already there
  const title = container.querySelector(".roles-panel-title");
  container.innerHTML = "";
  if (title) container.appendChild(title);
  else {
    const t = document.createElement("div");
    t.className = "roles-panel-title";
    t.textContent = "Roles";
    container.appendChild(t);
  }

  ROLES.forEach((group) => {
    const section = document.createElement("div");
    section.className = "roles-group";

    const heading = document.createElement("div");
    heading.className = "roles-group-title";
    heading.textContent = group.group;
    section.appendChild(heading);

    const chips = document.createElement("div");
    chips.className = "roles-chips";

    group.roles.forEach((role) => {
      const chip = document.createElement("div");
      chip.className = "role-chip";
      chip.textContent = role;
      chip.draggable = true;
      chip.dataset.role = role;
      chip.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", `role:${role}`);
        event.dataTransfer.effectAllowed = "copy";
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
      chips.appendChild(chip);
    });

    section.appendChild(chips);
    container.appendChild(section);
  });
}

function renderRolesPanel() {
  const container = document.getElementById("rolesPanel");
  if (!container) return;
  renderRolesSidebarInto(container);
}

function renderTeamOverviewView() {
  lanePlanWrap.innerHTML = `
    <div class="team-board-card embedded">
      <div class="team-board-header">
        <h2>Team Overview</h2>
        <div class="overview-actions">
          <button class="map-pin-btn" id="addPlanningStageBtn" type="button">Manage Stages</button>
          <div class="lane-controls" id="laneControls"></div>
        </div>
      </div>
      <div class="team-board" id="teamBoard"></div>
    </div>
  `;
  document.getElementById("addPlanningStageBtn").addEventListener("click", openStageManager);
  renderLaneControls();
  renderTeamBoard();
}

function renderPlanPlayer(player) {
  const coordinator = teamLayout.coordinators.includes(player.id);
  return `
    <span class="${coordinator ? "plan-player coordinator" : "plan-player"}">
      <span>${escapeHtml(player.name)}</span>
      ${coordinator ? "<small>Coordinator</small>" : ""}
    </span>
  `;
}

function updateLanePlanCell(laneKey, rowNumber, field, value) {
  lanePlans[laneKey] ||= { notes: "", rows: {} };
  lanePlans[laneKey].rows[rowNumber] ||= {};
  lanePlans[laneKey].rows[rowNumber][field] = value;
  saveLanePlans();
}

function updateLanePlanStageCell(laneKey, rowNumber, stageId, value) {
  lanePlans[laneKey] ||= { notes: "", rows: {} };
  lanePlans[laneKey].rows[rowNumber] ||= {};
  lanePlans[laneKey].rows[rowNumber].stages ||= {};
  lanePlans[laneKey].rows[rowNumber].stages[stageId] = value;
  saveLanePlans();
}

function loadArkSkills() {
  try {
    const skills = JSON.parse(localStorage.getItem(ARK_SKILLS_KEY) || "[]");
    return Array.isArray(skills) ? skills.filter((skill) => ARK_SKILLS.includes(skill)).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveArkSkills() {
  localStorage.setItem(ARK_SKILLS_KEY, JSON.stringify(selectedArkSkills));
}

function getSkillName(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function renderArkSkills() {
  arkSkillSlots.innerHTML = "";
  for (let index = 0; index < 6; index += 1) {
    const skill = selectedArkSkills[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ark-skill-slot${skill ? " filled" : ""}`;
    button.title = skill ? getSkillName(skill) : "Select Ark skill";
    button.setAttribute("aria-label", button.title);
    button.innerHTML = skill
      ? `<img src="icons/aoo/${skill}" alt="${escapeHtml(getSkillName(skill))}">`
      : "+";
    button.addEventListener("click", openSkillModal);
    arkSkillSlots.appendChild(button);
  }
  renderSkillGrid();
}

function openSkillModal() {
  skillModalOverlay.hidden = false;
  renderSkillGrid();
}

function closeSkillModal() {
  skillModalOverlay.hidden = true;
}

function renderSkillGrid() {
  if (!skillGrid) return;
  skillModalCount.textContent = `${selectedArkSkills.length} / 6 selected`;
  skillGrid.innerHTML = "";
  ARK_SKILLS.forEach((skill) => {
    const selected = selectedArkSkills.includes(skill);
    const disabled = selectedArkSkills.length >= 6 && !selected;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `skill-option${selected ? " selected" : ""}`;
    button.disabled = disabled;
    button.innerHTML = `
      <img src="icons/aoo/${skill}" alt="${escapeHtml(getSkillName(skill))}">
      <span>${escapeHtml(getSkillName(skill))}</span>
    `;
    button.addEventListener("click", () => toggleArkSkill(skill));
    skillGrid.appendChild(button);
  });
}

function toggleArkSkill(skill) {
  if (selectedArkSkills.includes(skill)) {
    selectedArkSkills = selectedArkSkills.filter((item) => item !== skill);
  } else if (selectedArkSkills.length < 6) {
    selectedArkSkills.push(skill);
  }
  saveArkSkills();
  renderArkSkills();
}

function parseCsvPlayers(text) {
  return text
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line))
    .filter((columns) => columns.length >= 1)
    .filter((columns, index) => {
      const first = columns[0].trim().toLowerCase();
      return index !== 0 || first !== "name";
    })
    .map((columns) => ({ name: columns[0].trim(), id: columns[1]?.trim() || "" }))
    .filter((player) => player.name);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

document.getElementById("zoomInBtn").addEventListener("click", () => zoomBy(0.15));
document.getElementById("zoomOutBtn").addEventListener("click", () => zoomBy(-0.15));
document.getElementById("resetViewBtn").addEventListener("click", resetView);

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    tabButtons.forEach((item) => {
      const active = item.dataset.tab === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    tabPanels.forEach((panel) => {
      const active = panel.id === `${tab}TabPanel`;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  });
});

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addPlayer(playerNameInput.value);
  playerNameInput.value = "";
  playerNameInput.focus();
});

mapPlayerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  addPlayer(mapPlayerNameInput.value);
  mapPlayerNameInput.value = "";
  mapPlayerNameInput.focus();
});

playersCsvInput.addEventListener("change", async () => {
  const file = playersCsvInput.files[0];
  if (!file) return;
  const text = await file.text();
  parseCsvPlayers(text).forEach((player) => addPlayer(player.name, player.id));
  playersCsvInput.value = "";
});

mapPlayersCsvInput?.addEventListener("change", async () => {
  const file = mapPlayersCsvInput.files[0];
  if (!file) return;
  const text = await file.text();
  parseCsvPlayers(text).forEach((player) => addPlayer(player.name, player.id));
  mapPlayersCsvInput.value = "";
});

clearPlayersBtn.addEventListener("click", () => {
  if (!confirm("Clear all players and lane assignments?")) return;
  teamPlayers = [];
  teamLayout.assignments = {};
  saveTeamPlayers();
  saveTeamLayout();
  renderTeam();
});

mapClearPlayersBtn?.addEventListener("click", () => {
  if (!confirm("Clear all players and lane assignments?")) return;
  teamPlayers = [];
  teamLayout.assignments = {};
  saveTeamPlayers();
  saveTeamLayout();
  renderTeam();
});

exportDbBtn.addEventListener("click", () => {
  exportStateDb().catch((error) => {
    console.error(error);
    alert("Could not export the backup database.");
  });
});

importDbInput.addEventListener("change", () => {
  const file = importDbInput.files[0];
  if (!file) return;
  importStateDb(file).catch((error) => {
    console.error(error);
    alert("Could not load this backup database.");
  });
});

exportPngBtn.addEventListener("click", () => {
  exportCurrentStagePng().catch((error) => {
    console.error(error);
    alert("Could not export this stage as PNG.");
  });
});

skillModalClose.addEventListener("click", closeSkillModal);
skillModalOverlay.addEventListener("click", (event) => {
  if (event.target === skillModalOverlay) closeSkillModal();
});
clearSkillsBtn.addEventListener("click", () => {
  selectedArkSkills = [];
  saveArkSkills();
  renderArkSkills();
});

stageModalClose.addEventListener("click", closeStageManager);
stageModalOverlay.addEventListener("click", (event) => {
  if (event.target === stageModalOverlay) closeStageManager();
});
addStageModalBtn.addEventListener("click", () => {
  addMapStage();
  renderStageManager();
});

labelShapeSelect?.addEventListener("change", () => {
  activeLabelShape = labelShapeSelect.value;
});

addPinBtn?.addEventListener("click", () => {
  addPinMode = !addPinMode;
  if (addPinMode) {
    addLabelMode = false;
    addLabelBtn?.classList.remove("active");
    moveMarkersMode = false;
    moveMarkersBtn?.classList.remove("active");
  }
  addPinBtn?.classList.toggle("active", addPinMode);
});

addLabelBtn?.addEventListener("click", () => {
  addPinMode = false;
  addPinBtn?.classList.remove("active");
  addLabelMode = !addLabelMode;
  moveMarkersMode = false;
  moveMarkersBtn?.classList.remove("active");
  addLabelBtn.classList.toggle("active", addLabelMode);
});

moveMarkersBtn?.addEventListener("click", () => {
  moveMarkersMode = !moveMarkersMode;
  if (moveMarkersMode) {
    addPinMode = false;
    addPinBtn?.classList.remove("active");
    addLabelMode = false;
    addLabelBtn?.classList.remove("active");
  }
  moveMarkersBtn.classList.toggle("active", moveMarkersMode);
  renderMarkers();
});

mapSearch?.addEventListener("input", render);
mapStage.addEventListener("pointermove", updateCoords);
mapStage.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomBy(event.deltaY > 0 ? -0.08 : 0.08);
}, { passive: false });

mapViewport.addEventListener("pointerdown", (event) => {
  if (addLabelMode) {
    addMapLabel(event);
    addLabelMode = false;
    addLabelBtn?.classList.remove("active");
    return;
  }
  if (addPinMode) {
    addCustomPin(event);
    return;
  }
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    viewX: view.x,
    viewY: view.y,
  };
  mapViewport.setPointerCapture(event.pointerId);
  mapViewport.classList.add("dragging");
});

mapViewport.addEventListener("pointermove", (event) => {
  if (labelResizeState && labelResizeState.pointerId === event.pointerId) {
    resizeSelectedLabel(event);
    return;
  }
  if (labelDragState && labelDragState.pointerId === event.pointerId) {
    moveSelectedLabel(event);
    return;
  }
  if (markerDragState && markerDragState.pointerId === event.pointerId) {
    moveSelectedMarker(event);
    return;
  }
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  view.x = dragState.viewX + event.clientX - dragState.startX;
  view.y = dragState.viewY + event.clientY - dragState.startY;
  applyView();
});

mapViewport.addEventListener("pointerup", (event) => {
  if (labelResizeState && labelResizeState.pointerId === event.pointerId) {
    labelResizeState = null;
    renderMarkers();
    return;
  }
  if (labelDragState && labelDragState.pointerId === event.pointerId) {
    const didMove = labelDragState.didMove;
    labelDragState = null;
    if (didMove) renderMarkers();
    return;
  }
  if (markerDragState && markerDragState.pointerId === event.pointerId) {
    markerDragState = null;
    return;
  }
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  dragState = null;
  mapViewport.classList.remove("dragging");
});

mapViewport.addEventListener("pointercancel", () => {
  dragState = null;
  markerDragState = null;
  labelDragState = null;
  labelResizeState = null;
  mapViewport.classList.remove("dragging");
});

mapViewport.addEventListener("dragover", (event) => {
  if (event.dataTransfer.types.includes("text/plain")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    mapViewport.classList.add("drop-target");
  }
});

mapViewport.addEventListener("dragleave", (event) => {
  // Only remove if leaving the viewport entirely (not entering a child)
  if (!mapViewport.contains(event.relatedTarget)) {
    mapViewport.classList.remove("drop-target");
  }
});

mapViewport.addEventListener("drop", (event) => {
  event.preventDefault();
  mapViewport.classList.remove("drop-target");
  const data = event.dataTransfer.getData("text/plain");
  if (!data) return;

  const point = getMapPoint(event);
  if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) return;

  if (data.startsWith("player:")) {
    const playerId = data.slice(7);
    const player = teamPlayers.find((p) => p.id === playerId);
    if (!player) return;
    dropLabelOnMap(player.name, point, "bubble-left");
  } else if (data.startsWith("role:")) {
    const role = data.slice(5);
    dropLabelOnMap(role, point, "bubble-left");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const current = location.pathname.split("/").pop();
  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === current) link.classList.add("active");
  });
});

initTheme();
applyView();
render();
renderTeam();
