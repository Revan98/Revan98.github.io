/* ==========================================================================
   govCards.js — the card renderers for a governor's KvK history, account
   boxes and farm-account KvK stats. Shared by the dashboard's governor modal
   (govModal.js) and the player card (playercard.js). Pure HTML builders.
   Depends on: common.js. Styles: css/govcards.css.
   ========================================================================== */

function renderKvkGainStat(label, base, sum, showRollup, opts = {}) {
  const {
    signed = true,
    hideZero = false,
    format = formatCompact,
    full = formatNumber,
  } = opts;

  const main = Number(showRollup ? sum : base) || 0;
  const alone = Number(base) || 0;

  if (hideZero && main === 0) {
    return `
      <div class="kvk-gain-stat">
        <span class="kvk-gain-label">${label}</span>
        <span class="kvk-gain-value">—</span>
      </div>`;
  }

  const show = (n) => `${signed && n > 0 ? "+" : ""}${format(n)}`;
  const cls = signed ? (main >= 0 ? "diff-positive" : "diff-negative") : "";
  const title = showRollup
    ? `${full(main)} with farms\n${full(alone)} without farms`
    : full(main);

  return `
    <div class="kvk-gain-stat" title="${title}">
      <span class="kvk-gain-label">${label}</span>
      <span class="kvk-gain-value ${cls}">${show(main)}</span>
      ${showRollup ? `<span class="kvk-gain-rollup">${show(alone)}</span>` : ""}
    </div>`;
}

function renderKvkGainBoxes(rows) {
  if (!rows.length) {
    return `<div class="gov-modal-empty">No historical data found for this governor.</div>`;
  }

  const pct = { signed: false, format: formatPercent, full: formatPercent };
  const plain = { signed: false };

  const boxes = [...rows]
    .reverse()
    .map((r) => {
      const f = r.hasFarmRollup;
      return `
        <div class="kvk-gain-box">
          <div class="kvk-gain-title">${escapeHtml(r.kvk)}</div>
          <div class="kvk-gain-stats">
            ${renderKvkGainStat("Kill Points", r.kpDiff, r.sumKpDiff, f)}
            ${renderKvkGainStat("T4 Kills", r.t4Diff, r.sumT4Diff, f)}
            ${renderKvkGainStat("T5 Kills", r.t5Diff, r.sumT5Diff, f)}
            ${renderKvkGainStat("Deads", r.deadsDiff, r.sumDeadsDiff, f)}
            ${renderKvkGainStat("Power", r.powerDiff, r.sumPowerDiff, f)}
            ${renderKvkGainStat("Acclaim", r.acclaim, r.sumAcclaim, f, { hideZero: true })}
            ${renderKvkGainStat("Min DKP", r.minDkp, r.sumMinDkp, f, plain)}
            ${renderKvkGainStat("DKP", r.dkp, r.sumDkp, f, plain)}
            ${renderKvkGainStat("DKP %", r.dkpPercent, r.sumDkpPercent, f, pct)}
          </div>
        </div>`;
    })
    .join("");

  return `<div class="kvk-gains-grid">${boxes}</div>`;
}

function renderPlainStat(label, display, full) {
  return `
    <div class="kvk-gain-stat" title="${escapeHtml(String(full ?? display))}">
      <span class="kvk-gain-label">${label}</span>
      <span class="kvk-gain-value">${escapeHtml(String(display))}</span>
    </div>`;
}

function renderAccountBoxes(accounts) {
  const boxes = accounts
    .map(
      (a) => `
      <div class="kvk-gain-box">
        <div class="kvk-gain-title">
          <span class="kvk-gain-name">${escapeHtml(a.name)}</span>
          <span class="kvk-gain-id">${escapeHtml(a.id)}</span>
        </div>
        <div class="kvk-gain-stats cols-4">
          ${renderPlainStat("Power", formatCompact(a.power), formatNumber(a.power))}
          ${renderPlainStat("Kill Points", formatCompact(a.killpoints), formatNumber(a.killpoints))}
          ${renderPlainStat("Deads", formatCompact(a.deads), formatNumber(a.deads))}
          ${renderPlainStat("CH", a.ch || "—")}
        </div>
      </div>`,
    )
    .join("");
  return `<div class="kvk-gains-grid">${boxes}</div>`;
}

function renderFarmKvKAccountBox(r) {
  const pct = { signed: false, format: formatPercent, full: formatPercent };
  const plain = { signed: false };
  return `
    <div class="kvk-gain-box">
      <div class="kvk-gain-title">
        <span class="kvk-gain-name">${escapeHtml(r.name)}</span>
        <span class="kvk-gain-id">${escapeHtml(r.id)}</span>
      </div>
      <div class="kvk-gain-stats">
        ${renderKvkGainStat("Kill Points", r.kpDiff, 0, false)}
        ${renderKvkGainStat("T4 Kills", r.t4Diff, 0, false)}
        ${renderKvkGainStat("T5 Kills", r.t5Diff, 0, false)}
        ${renderKvkGainStat("Deads", r.deadsDiff, 0, false)}
        ${renderKvkGainStat("Power", r.powerDiff, 0, false)}
        ${renderKvkGainStat("Acclaim", r.acclaim, 0, false, { hideZero: true })}
        ${renderKvkGainStat("Min DKP", r.minDkp, 0, false, plain)}
        ${renderKvkGainStat("DKP", r.dkp, 0, false, plain)}
        ${renderKvkGainStat("DKP %", r.dkpPercent, 0, false, pct)}
      </div>
    </div>`;
}

function renderFarmKvKGroups(rows) {
  const grouped = {};
  rows.forEach((r) => {
    (grouped[r.kvk] ||= []).push(r);
  });
  return Object.keys(grouped)
    .reverse()
    .map((kvk) => ({
      kvk,
      html: `<div class="kvk-gains-grid">${grouped[kvk].map(renderFarmKvKAccountBox).join("")}</div>`,
    }));
}
