function renderKvkGainStat(label, base, sum, showRollup, options = {}) {
  const {
    signed = true,
    hideZero = false,
    format = formatCompact,
    full = formatNumber,
  } = options;

  const main = Number(showRollup ? sum : base) || 0;
  const alone = Number(base) || 0;

  if (hideZero && main === 0) {
    return `
      <div class="kvk-gain-stat">
        <span class="kvk-gain-label">${label}</span>
        <span class="kvk-gain-value">—</span>
      </div>`;
  }

  const show = (amount) => `${signed && amount > 0 ? "+" : ""}${format(amount)}`;
  const cssClass = signed ? (main >= 0 ? "diff-positive" : "diff-negative") : "";
  const title = showRollup
    ? `${full(main)} with farms\n${full(alone)} without farms`
    : full(main);

  return `
    <div class="kvk-gain-stat" title="${title}">
      <span class="kvk-gain-label">${label}</span>
      <span class="kvk-gain-value ${cssClass}">${show(main)}</span>
      ${showRollup ? `<span class="kvk-gain-rollup">${show(alone)}</span>` : ""}
    </div>`;
}

function renderKvkGainBoxes(rows) {
  if (!rows.length) {
    return `<div class="gov-modal-empty">No historical data found for this governor.</div>`;
  }

  const percent = { signed: false, format: formatPercent, full: formatPercent };
  const plain = { signed: false };

  const boxes = [...rows]
    .reverse()
    .map((row) => {
      const hasFarmRollup = row.hasFarmRollup;
      return `
        <div class="kvk-gain-box">
          <div class="kvk-gain-title">${escapeHtml(row.kvk)}</div>
          <div class="kvk-gain-stats">
            ${renderKvkGainStat("Kill Points", row.kpDiff, row.sumKpDiff, hasFarmRollup)}
            ${renderKvkGainStat("T4 Kills", row.t4Diff, row.sumT4Diff, hasFarmRollup)}
            ${renderKvkGainStat("T5 Kills", row.t5Diff, row.sumT5Diff, hasFarmRollup)}
            ${renderKvkGainStat("Deads", row.deadsDiff, row.sumDeadsDiff, hasFarmRollup)}
            ${renderKvkGainStat("Power", row.powerDiff, row.sumPowerDiff, hasFarmRollup)}
            ${renderKvkGainStat("Acclaim", row.acclaim, row.sumAcclaim, hasFarmRollup, { hideZero: true })}
            ${renderKvkGainStat("Min DKP", row.minDkp, row.sumMinDkp, hasFarmRollup, plain)}
            ${renderKvkGainStat("DKP", row.dkp, row.sumDkp, hasFarmRollup, plain)}
            ${renderKvkGainStat("DKP %", row.dkpPercent, row.sumDkpPercent, hasFarmRollup, percent)}
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
      (account) => `
      <div class="kvk-gain-box">
        <div class="kvk-gain-title">
          <span class="kvk-gain-name">${escapeHtml(account.name)}</span>
          <span class="kvk-gain-id">${escapeHtml(account.id)}</span>
        </div>
        <div class="kvk-gain-stats cols-4">
          ${renderPlainStat("Power", formatCompact(account.power), formatNumber(account.power))}
          ${renderPlainStat("Kill Points", formatCompact(account.killpoints), formatNumber(account.killpoints))}
          ${renderPlainStat("Deads", formatCompact(account.deads), formatNumber(account.deads))}
          ${renderPlainStat("CH", account.ch || "—")}
        </div>
      </div>`,
    )
    .join("");
  return `<div class="kvk-gains-grid">${boxes}</div>`;
}

function renderFarmKvKAccountBox(row) {
  const percent = { signed: false, format: formatPercent, full: formatPercent };
  const plain = { signed: false };
  return `
    <div class="kvk-gain-box">
      <div class="kvk-gain-title">
        <span class="kvk-gain-name">${escapeHtml(row.name)}</span>
        <span class="kvk-gain-id">${escapeHtml(row.id)}</span>
      </div>
      <div class="kvk-gain-stats">
        ${renderKvkGainStat("Kill Points", row.kpDiff, 0, false)}
        ${renderKvkGainStat("T4 Kills", row.t4Diff, 0, false)}
        ${renderKvkGainStat("T5 Kills", row.t5Diff, 0, false)}
        ${renderKvkGainStat("Deads", row.deadsDiff, 0, false)}
        ${renderKvkGainStat("Power", row.powerDiff, 0, false)}
        ${renderKvkGainStat("Acclaim", row.acclaim, 0, false, { hideZero: true })}
        ${renderKvkGainStat("Min DKP", row.minDkp, 0, false, plain)}
        ${renderKvkGainStat("DKP", row.dkp, 0, false, plain)}
        ${renderKvkGainStat("DKP %", row.dkpPercent, 0, false, percent)}
      </div>
    </div>`;
}

function renderFarmKvKGroups(rows) {
  const grouped = {};
  rows.forEach((row) => {
    (grouped[row.kvk] ||= []).push(row);
  });
  return Object.keys(grouped)
    .reverse()
    .map((kvk) => ({
      kvk,
      html: `<div class="kvk-gains-grid">${grouped[kvk].map(renderFarmKvKAccountBox).join("")}</div>`,
    }));
}
