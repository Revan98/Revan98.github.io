/* ==========================================================================
   govModal.js — the governor modal: chart, statistics (history, farms) and
   the tab/collapsible plumbing. Equipment tab lives in equipment.js.
   Depends on: common.js, queries.js, govCards.js, equipView.js, Chart.js.
   ========================================================================== */

let inlineChart = null;

const CHART_STYLES = {
  light: {
    text: "#333",
    grid: "rgba(0,0,0,0.1)",
    pointBorder: "#ffffff",
    tooltipBg: "rgba(255,255,255,0.95)",
  },
  dark: {
    text: "#eee",
    grid: "rgba(255,255,255,0.2)",
    pointBorder: "#1e1e1e",
    tooltipBg: "rgba(40,40,40,0.95)",
  },
};

function formatSnapshotDate(snapshotDate) {
  if (!snapshotDate || typeof snapshotDate !== "string") return snapshotDate;

  if (/^\d{2}_\d{2}_\d{4}$/.test(snapshotDate)) {
    return snapshotDate.replaceAll("_", ".");
  }

  return snapshotDate;
}

const CHART_SERIES = [
  { key: "kpDiff", label: "KP Diff", secondary: false },
  { key: "powerDiff", label: "Power Diff", secondary: true },
  { key: "t4Diff", label: "T4 Diff", secondary: true },
  { key: "t5Diff", label: "T5 Diff", secondary: true },
  { key: "deadsDiff", label: "Deads Diff", secondary: true },
];
const CHART_COLORS = ["#dc3545", "#007bff", "#28a745", "#ffc107", "#6f42c1"];

function buildChartDatasets(series) {
  return CHART_SERIES.map((s, i) => ({
    label: s.label,
    data: series.map((row) => Number(row[s.key] || 0)),
    tension: 0.25,
    borderColor: CHART_COLORS[i],
    backgroundColor: CHART_COLORS[i] + "33",
    pointRadius: 3,
    yAxisID: s.secondary ? "ySecondary" : "y",
  }));
}

function createChart(ctx, labels, datasets) {
  inlineChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        title: {
          display: false,
        },
        legend: {},
      },
      scales: {
        x: {},
        y: {
          type: "linear",
          position: "left",
        },
        ySecondary: {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
        },
      },
    },
  });

  applyChartTheme();
}

function applyChartTheme() {
  if (!inlineChart) return;

  const styles = CHART_STYLES[getCurrentTheme()];
  inlineChart.data.datasets.forEach((ds) => {
    ds.pointBackgroundColor = ds.borderColor;
    ds.pointBorderColor = styles.pointBorder;
  });

  inlineChart.options.plugins.legend.labels.color = styles.text;
  inlineChart.options.plugins.tooltip.backgroundColor = styles.tooltipBg;
  inlineChart.options.plugins.tooltip.titleColor = styles.text;
  inlineChart.options.plugins.tooltip.bodyColor = styles.text;

  const axes = ["x", "y", "ySecondary"];
  axes.forEach((axis) => {
    if (inlineChart.options.scales[axis]) {
      inlineChart.options.scales[axis].ticks.color = styles.text;
      inlineChart.options.scales[axis].grid.color = styles.grid;
      if (inlineChart.options.scales[axis].title) {
        inlineChart.options.scales[axis].title.color = styles.text;
      }
    }
  });

  inlineChart.update();
}

window.addEventListener("themechange", applyChartTheme);

function updateChart(governorId) {
  const canvas = document.querySelector("#modal-chart");
  if (!canvas) return;

  const series = loadGovernorSeries(governorId);
  if (inlineChart) {
    inlineChart.destroy();
    inlineChart = null;
  }
  createChart(
    canvas.getContext("2d"),
    series.map((row) => formatSnapshotDate(row.date)),
    buildChartDatasets(series),
  );
}

function renderCollapsibleSection(title, content, defaultOpen = false) {
  const id =
    "sec_" +
    (renderCollapsibleSection._counter =
      (renderCollapsibleSection._counter || 0) + 1);

  return `
    <div class="collapsible-section">
      <div class="collapsible-header" 
           data-target="${id}"
           onclick="toggleSection('${id}')">
        <span>${escapeHtml(title)}</span>
        <span class="collapsible-icon">${defaultOpen ? "−" : "+"}</span>
      </div>
      <div id="${id}" 
           class="collapsible-content" 
           style="display:${defaultOpen ? "block" : "none"};">
        ${content}
      </div>
    </div>
  `;
}

function switchGovModalTab(tab) {
  document.querySelectorAll(".gov-modal-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".gov-modal-tab-pane").forEach((pane) => {
    pane.style.display = pane.id === `govTabPane-${tab}` ? "block" : "none";
  });
}

function expandAllSections() {
  document.querySelectorAll(".collapsible-content").forEach((el) => {
    el.style.display = "block";
  });

  document.querySelectorAll(".collapsible-icon").forEach((icon) => {
    icon.textContent = "−";
  });
}

function collapseAllSections() {
  document.querySelectorAll(".collapsible-content").forEach((el) => {
    el.style.display = "none";
  });

  document.querySelectorAll(".collapsible-icon").forEach((icon) => {
    icon.textContent = "+";
  });
}

function toggleSection(id) {
  const el = document.getElementById(id);
  const header = el.previousElementSibling;
  const icon = header.querySelector(".collapsible-icon");

  if (el.style.display === "none") {
    el.style.display = "block";
    icon.textContent = "−";
  } else {
    el.style.display = "none";
    icon.textContent = "+";
  }
}

function renderFarmOwnerInfo(owner) {
  if (!owner) return "";
  return renderCollapsibleSection(
    "Main Account Owner",
    renderAccountBoxes([owner]),
    true,
  );
}

function renderFarmsBoxes(rows) {
  if (!rows.length)
    return `<div class="gov-modal-empty">No farm accounts found.</div>`;
  return renderCollapsibleSection(
    "Farm Accounts",
    renderAccountBoxes(rows),
    false,
  );
}

function renderFarmKvKBoxes(rows) {
  if (!rows.length)
    return `<div class="gov-modal-empty">No KvK data found for farm accounts.</div>`;

  const kvkBlocks = renderFarmKvKGroups(rows)
    .map((g) => renderCollapsibleSection(g.kvk, g.html, false))
    .join("");

  return renderCollapsibleSection(
    "Farm Accounts – KvK Stats (All KvKs)",
    kvkBlocks,
    false,
  );
}

function openGovModal(govId, govName) {
  const overlay = document.getElementById("govModalOverlay");
  const body = document.getElementById("govModalBody");
  const subtitle = document.getElementById("govModalSubtitle");
  const vipEl = document.getElementById("govModalVip");
  const safeGovId = normalizeNumericId(govId);

  if (vipEl) vipEl.innerHTML = "";

  if (!safeGovId) {
    subtitle.textContent = "";
    body.innerHTML = `<div class="gov-modal-empty">Invalid governor ID.</div>`;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    return;
  }

  govId = safeGovId;

  subtitle.textContent = govName ? `${govName} (${govId})` : `ID: ${govId}`;
  body.innerHTML = `<div class="gov-modal-loading"><div class="spinner"></div><span>Loading…</span></div>`;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    const safeRender = (label, fn) => {
      try {
        return fn();
      } catch (e) {
        console.error("[modal:" + label + "]", e);
        return "";
      }
    };
    try {
      const history = loadGovHistory(govId);
      const farmOwner = loadFarmOwner(govId);
      const farms = loadGovernorFarms(govId);
      const farmIds = farms.map((f) => f.id);
      const farmKvK = loadFarmKvKStats(farmIds);
      const profile = loadPlayerProfile(govId);
      if (vipEl)
        vipEl.innerHTML = renderVipBadge(profile ? profile.vip_level : "");
      const chartSection = `
	    <div class="modal-chart-section">
	      <div class="modal-chart" style="height:400px;">
	        <canvas id="modal-chart"></canvas>
	      </div>
	    </div>
	  `;
      body.innerHTML =
        '<div class="gov-modal-tabs">' +
        '  <button type="button" class="gov-modal-tab active" data-tab="chart" onclick="switchGovModalTab(\'chart\')">Chart</button>' +
        '  <button type="button" class="gov-modal-tab" data-tab="stats" onclick="switchGovModalTab(\'stats\')">Statistics</button>' +
        '  <button type="button" class="gov-modal-tab" data-tab="equipment" onclick="switchGovModalTab(\'equipment\')">Equipment</button>' +
        "</div>" +
        '<div class="gov-modal-tab-pane" id="govTabPane-chart">' +
        chartSection +
        "</div>" +
        '<div class="gov-modal-tab-pane" id="govTabPane-stats" style="display:none;">' +
        '<div class="modal-controls">' +
        '  <button onclick="expandAllSections()">Expand All</button>' +
        '  <button onclick="collapseAllSections()">Collapse All</button>' +
        "</div>" +
        safeRender("farmOwner", () => renderFarmOwnerInfo(farmOwner)) +
        safeRender("history", () =>
          renderCollapsibleSection(
            "Governor History",
            renderKvkGainBoxes(history),
            false,
          ),
        ) +
        safeRender("farms", () => renderFarmsBoxes(farms)) +
        safeRender("farmKvK", () => renderFarmKvKBoxes(farmKvK)) +
        "</div>" +
        '<div class="gov-modal-tab-pane" id="govTabPane-equipment" style="display:none;">' +
        safeRender("equipment", () => renderEquipmentSection(govId)) +
        "</div>";
      setTimeout(() => {
        updateChart(govId);
      }, 0);
    } catch (err) {
      console.error("openGovModal:", err);
      body.innerHTML = `<div class="gov-modal-empty">Error: ${escapeHtml(String(err))}</div>`;
    }
  }, 50);
}

function closeGovModal() {
  document.getElementById("govModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

document
  .getElementById("govModalClose")
  .addEventListener("click", closeGovModal);

document.getElementById("govModalOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeGovModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeGovModal();
});
