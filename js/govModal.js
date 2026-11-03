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
  CHART_SERIES.find((s) => s.key === key) ?? CHART_SERIES[0];

function chartStatData(stat) {
  return chartSeries.map((row) => Number(row[stat.key] || 0));
}

function renderChartButtons() {
  return CHART_SERIES.map(
    (s) =>
      `<button type="button" class="chart-stat-btn${s.key === activeChartKey ? " active" : ""}" ` +
      `data-key="${s.key}" aria-pressed="${s.key === activeChartKey}" ` +
      `onclick="selectChartStat('${s.key}')">${s.label}</button>`,
  ).join("");
}

function createChart(ctx, labels) {
  const stat = getChartStat(activeChartKey);
  inlineChart = new Chart(ctx, {
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
  inlineChart.data.datasets.forEach((ds) => {
    ds.pointBackgroundColor = ds.borderColor;
    ds.pointBorderColor = styles.pointBorder;
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
  document.querySelectorAll(".chart-stat-btn").forEach((btn) => {
    const on = btn.dataset.key === activeChartKey;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on);
  });
  if (!inlineChart) return;

  const stat = getChartStat(activeChartKey);
  const ds = inlineChart.data.datasets[0];
  ds.label = stat.label;
  ds.data = chartStatData(stat);
  ds.borderColor = stat.color;
  ds.backgroundColor = stat.color + "33";
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

let govModalToken = 0;

async function openGovModal(govId, govName) {
  const token = ++govModalToken;
  const overlay = document.getElementById("govModalOverlay");
  const body = document.getElementById("govModalBody");
  const subtitle = document.getElementById("govModalSubtitle");
  const vipEl = document.getElementById("govModalVip");
  const safeGovId = normalizeNumericId(govId);

  if (vipEl) vipEl.innerHTML = "";

  const editLink = document.getElementById("edit-eq");
  if (editLink) {
    editLink.href = safeGovId
      ? `equipment.html?govId=${encodeURIComponent(safeGovId)}`
      : "equipment.html";
  }

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

  {
    const safeRender = (label, fn) => {
      try {
        return fn();
      } catch (e) {
        console.error("[modal:" + label + "]", e);
        return "";
      }
    };
    try {
      await Promise.all([loadPlayerBundle(govId, kvkCtx.kd), loadEquipRefData()]);
      if (token !== govModalToken) return;
      const history = loadGovHistory(govId);
      const farmOwner = loadFarmOwner(govId);
      const farms = loadGovernorFarms(govId);
      const farmKvK = loadFarmKvKStats(govId);
      const profile = loadPlayerProfile(govId);
      if (vipEl)
        vipEl.innerHTML = renderVipBadge(profile ? profile.vip_level : "");
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
      updateChart(govId).catch((e) => {
        console.error("updateChart:", e);
        const canvas = document.querySelector("#modal-chart");
        if (canvas?.parentElement)
          canvas.parentElement.innerHTML = `<div class="gov-modal-empty">Could not load the chart.</div>`;
      });
    } catch (err) {
      console.error("openGovModal:", err);
      body.innerHTML = `<div class="gov-modal-empty">Error: ${escapeHtml(String(err))}</div>`;
    }
  }
}

function closeGovModal() {
  destroyChart();
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
