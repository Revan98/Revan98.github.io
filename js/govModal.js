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
  { key: "kpDiff", label: "KP Diff", color: "#dc3545" },
  { key: "powerDiff", label: "Power Diff", color: "#007bff" },
  { key: "t4Diff", label: "T4 Diff", color: "#28a745" },
  { key: "t5Diff", label: "T5 Diff", color: "#ffc107" },
  { key: "deadsDiff", label: "Deads Diff", color: "#6f42c1" },
];

let chartSeries = [];
let activeChartKey = CHART_SERIES[0].key;

const getChartStat = (key) =>
  CHART_SERIES.find((seriesItem) => seriesItem.key === key) ?? CHART_SERIES[0];

function chartStatData(stat) {
  return chartSeries.map((row) => Number(row[stat.key] || 0));
}

function renderChartButtons() {
  return CHART_SERIES.map(
    (seriesEntry) =>
      `<button type="button" class="chart-stat-btn${seriesEntry.key === activeChartKey ? " active" : ""}" ` +
      `data-key="${seriesEntry.key}" aria-pressed="${seriesEntry.key === activeChartKey}" ` +
      `onclick="selectChartStat('${seriesEntry.key}')">${seriesEntry.label}</button>`,
  ).join("");
}

function createChart(context, labels) {
  const stat = getChartStat(activeChartKey);
  inlineChart = new Chart(context, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: stat.label,
          data: chartStatData(stat),
          tension: 0.25,
          pointRadius: 3,
          borderColor: stat.color,
          backgroundColor: stat.color + "33",
		  fill: "origin",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatNumber(item.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {},
        y: { ticks: { callback: (value) => formatCompact(value) } },
      },
    },
  });

  applyChartTheme();
}

function applyChartTheme() {
  if (!inlineChart) return;

  const styles = CHART_STYLES[getCurrentTheme()];
  inlineChart.data.datasets.forEach((dataset) => {
    dataset.pointBackgroundColor = dataset.borderColor;
    dataset.pointBorderColor = styles.pointBorder;
  });

  inlineChart.options.plugins.tooltip.backgroundColor = styles.tooltipBg;
  inlineChart.options.plugins.tooltip.titleColor = styles.text;
  inlineChart.options.plugins.tooltip.bodyColor = styles.text;

  ["x", "y"].forEach((axis) => {
    const scale = inlineChart.options.scales[axis];
    scale.ticks.color = styles.text;
    scale.grid.color = styles.grid;
  });

  inlineChart.update();
}

window.addEventListener("themechange", applyChartTheme);

function selectChartStat(key) {
  activeChartKey = getChartStat(key).key;
  document.querySelectorAll(".chart-stat-btn").forEach((button) => {
    const isActive = button.dataset.key === activeChartKey;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive);
  });
  if (!inlineChart) return;

  const stat = getChartStat(activeChartKey);
  const dataset = inlineChart.data.datasets[0];
  dataset.label = stat.label;
  dataset.data = chartStatData(stat);
  dataset.borderColor = stat.color;
  dataset.backgroundColor = stat.color + "33";
  applyChartTheme();
}

function destroyChart() {
  inlineChart?.destroy();
  inlineChart = null;
}

async function updateChart(governorId) {
  const canvas = document.querySelector("#modal-chart");
  if (!canvas) return;

  const [series] = await Promise.all([loadGovernorSeries(governorId), loadVendor("chart")]);
  if (!document.body.contains(canvas)) return;
  destroyChart();
  chartSeries = series;
  createChart(
    canvas.getContext("2d"),
    series.map((row) => formatSnapshotDate(row.date)),
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

function switchGovernorModalTab(tab) {
  document.querySelectorAll(".gov-modal-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".gov-modal-tab-pane").forEach((pane) => {
    pane.style.display = pane.id === `govTabPane-${tab}` ? "block" : "none";
  });
}

function expandAllSections() {
  document.querySelectorAll(".collapsible-content").forEach((element) => {
    element.style.display = "block";
  });

  document.querySelectorAll(".collapsible-icon").forEach((icon) => {
    icon.textContent = "−";
  });
}

function collapseAllSections() {
  document.querySelectorAll(".collapsible-content").forEach((element) => {
    element.style.display = "none";
  });

  document.querySelectorAll(".collapsible-icon").forEach((icon) => {
    icon.textContent = "+";
  });
}

function toggleSection(id) {
  const element = document.getElementById(id);
  const header = element.previousElementSibling;
  const icon = header.querySelector(".collapsible-icon");

  if (element.style.display === "none") {
    element.style.display = "block";
    icon.textContent = "−";
  } else {
    element.style.display = "none";
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
    .map((group) => renderCollapsibleSection(group.kvk, group.html, false))
    .join("");

  return renderCollapsibleSection(
    "Farm Accounts – KvK Stats (All KvKs)",
    kvkBlocks,
    false,
  );
}

let governorModalToken = 0;

async function openGovernorModal(governorId, governorName) {
  const token = ++governorModalToken;
  const overlay = document.getElementById("govModalOverlay");
  const body = document.getElementById("govModalBody");
  const subtitle = document.getElementById("govModalSubtitle");
  const vipElement = document.getElementById("govModalVip");
  const safeGovernorId = normalizeNumericId(governorId);

  if (vipElement) vipElement.innerHTML = "";

  const editLink = document.getElementById("edit-eq");
  if (editLink) {
    editLink.href = safeGovernorId
      ? `equipment.html?govId=${encodeURIComponent(safeGovernorId)}`
      : "equipment.html";
  }

  if (!safeGovernorId) {
    subtitle.textContent = "";
    body.innerHTML = `<div class="gov-modal-empty">Invalid governor ID.</div>`;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    return;
  }

  governorId = safeGovernorId;

  subtitle.textContent = governorName ? `${governorName} (${governorId})` : `ID: ${governorId}`;
  body.innerHTML = `<div class="gov-modal-loading"><div class="spinner"></div><span>Loading…</span></div>`;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  {
    const safeRender = (label, renderCallback) => {
      try {
        return renderCallback();
      } catch (event) {
        console.error("[modal:" + label + "]", event);
        return "";
      }
    };
    try {
      await Promise.all([loadPlayerBundle(governorId, kvkContext.kd), loadEquipmentReferenceData()]);
      if (token !== governorModalToken) return;
      const history = loadGovernorHistory(governorId);
      const farmOwner = loadFarmOwner(governorId);
      const farms = loadGovernorFarms(governorId);
      const farmKvK = loadFarmKvKStats(governorId);
      const profile = loadPlayerProfile(governorId);
      if (vipElement)
        vipElement.innerHTML = renderVipBadge(profile ? profile.vip_level : "");
      const chartSection = `
	    <div class="modal-chart-section">
	      <div class="chart-stat-buttons" role="group" aria-label="Chart stat">${renderChartButtons()}</div>
	      <div class="modal-chart" style="height:400px;">
	        <canvas id="modal-chart"></canvas>
	      </div>
	    </div>
	  `;
      body.innerHTML =
        '<div class="gov-modal-tabs">' +
        '  <button type="button" class="gov-modal-tab active" data-tab="chart" onclick="switchGovernorModalTab(\'chart\')">Chart</button>' +
        '  <button type="button" class="gov-modal-tab" data-tab="stats" onclick="switchGovernorModalTab(\'stats\')">Statistics</button>' +
        '  <button type="button" class="gov-modal-tab" data-tab="equipment" onclick="switchGovernorModalTab(\'equipment\')">Equipment</button>' +
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
        safeRender("equipment", () => renderEquipmentSection(governorId)) +
        "</div>";
      updateChart(governorId).catch((error) => {
        console.error("updateChart:", error);
        const canvas = document.querySelector("#modal-chart");
        if (canvas?.parentElement)
          canvas.parentElement.innerHTML = `<div class="gov-modal-empty">Could not load the chart.</div>`;
      });
    } catch (error) {
      console.error("openGovernorModal:", error);
      body.innerHTML = `<div class="gov-modal-empty">Error: ${escapeHtml(String(error))}</div>`;
    }
  }
}

function closeGovernorModal() {
  destroyChart();
  document.getElementById("govModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

document
  .getElementById("govModalClose")
  .addEventListener("click", closeGovernorModal);

document.getElementById("govModalOverlay").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeGovernorModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeGovernorModal();
});
