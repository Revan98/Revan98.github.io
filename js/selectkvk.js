/* ==========================================================================
   selectkvk.js — lists the KvKs of ?kd=… with their headline totals.
   Depends on: common.js, db.js, queries.js, sql.js.
   ========================================================================== */
async function loadKvkNames() {
  try {
    const res = await fetch("data/kvknames.json");
    const raw = await res.json();
    return Object.fromEntries(
      Object.entries(raw).map(([abbr, full]) => [abbr.toLowerCase(), full]),
    );
  } catch (e) {
    console.error("Failed to load kvknames.json:", e);
    return {};
  }
}

function expandKvkName(rawName, kvkNumber, names) {
  const numberLabel = `KvK ${kvkNumber}`;
  if (!rawName || !rawName.trim()) return numberLabel;
  const lastToken = rawName.trim().split(/[\s_]+/).pop();
  if (!lastToken || /^kvk\d*$/i.test(lastToken)) return numberLabel;
  const full = names[lastToken.toLowerCase()];
  return full ? `${numberLabel} ${full}` : rawName;
}

function formatTotal(n) {
  return Number(n) > 0 ? formatCompact(n) : "—";
}

function statHtml(label, value) {
  return `
    <div class="kvk-stat" title="${formatNumber(value)}">
      <span class="kvk-stat-label">${label}</span>
      <span class="kvk-stat-value">${formatTotal(value)}</span>
    </div>`;
}

function kvkBoxHtml(kd, k, names) {
  const label = expandKvkName(k.name, k.kvkNumber, names);
  const badge = k.isLatest ? '<span class="kvk-badge">Latest</span>' : "";
  const href = `dashboard.html?kd=${encodeURIComponent(kd)}&kvk=${encodeURIComponent(k.kvkNumber)}`;
  return `
    <a class="kingdom-box kvk-box" href="${href}">
      <div class="kvk-title">${escapeHtml(label)} ${badge}</div>
      <div class="kvk-stats">
        ${statHtml("Kill Points", k.kp)}
        ${statHtml("T4 Kills", k.t4)}
        ${statHtml("T5 Kills", k.t5)}
        ${statHtml("Deads", k.deads)}
        ${statHtml("Acclaim", k.acclaim)}
      </div>
    </a>`;
}

async function initSelectKvk() {
  const kd = getKDFromURL();
  if (!kd) {
    location.href = "index.html";
    return;
  }

  const heading = document.getElementById("kvk-heading");
  const list = document.getElementById("kvk-list");
  const empty = document.getElementById("kvk-empty");
  heading.innerHTML = `<h1>Kingdom ${kd}</h1><p class="muted">Select a KvK</p>`;

  let names;
  try {
    [names] = await Promise.all([loadKvkNames(), openDb()]);
  } catch (e) {
    console.error("Failed to load kvk.db:", e);
    empty.textContent = "Failed to load KvK data.";
    empty.style.display = "block";
    return;
  }

  const kvks = listKvks(kd);
  if (!kvks.length) {
    empty.style.display = "block";
    return;
  }

  list.className = "container";
  list.innerHTML = kvks.map((k) => kvkBoxHtml(kd, k, names)).join("");
}

initSelectKvk();
