async function loadKvkNames() {
  try {
    const response = await fetch("data/kvknames.json");
    const raw = await response.json();
    const out = {};
    for (const [abbr, skin] of Object.entries(raw.skins || {})) {
      out[abbr.toLowerCase()] = skin;
      if (skin.img && !(skin.img in out)) out[skin.img.toLowerCase()] = skin;
    }
    return out;
  } catch (event) {
    console.error("Failed to load kvknames.json:", event);
    return {};
  }
}

function findKvkSkin(rawName, names) {
  if (!rawName || !rawName.trim()) return null;
  const lastToken = rawName.trim().split(/[\s_]+/).pop();
  if (!lastToken || /^kvk\d*$/i.test(lastToken)) return null;
  return names[lastToken.toLowerCase()] || null;
}

function expandKvkName(rawName, kvkNumber, names) {
  const numberLabel = `KvK ${kvkNumber}`;
  const skin = findKvkSkin(rawName, names);
  if (skin) return `${numberLabel} ${skin.name}`;
  if (!rawName || !rawName.trim()) return numberLabel;
  const lastToken = rawName.trim().split(/[\s_]+/).pop();
  if (!lastToken || /^kvk\d*$/i.test(lastToken)) return numberLabel;
  return rawName;
}

function formatTotal(total) {
  return Number(total) > 0 ? formatCompact(total) : "—";
}

function statHtml(label, value) {
  return `
    <div class="kvk-stat" title="${formatNumber(value)}">
      <span class="kvk-stat-label">${label}</span>
      <span class="kvk-stat-value">${formatTotal(value)}</span>
    </div>`;
}

function kvkBoxHtml(kingdomId, key, names) {
  const label = expandKvkName(key.name, key.kvkNumber, names);
  const badge = key.isLatest ? '<span class="kvk-badge">Latest</span>' : "";
  const skin = findKvkSkin(key.name, names);
  const backgroundStyle = skin && skin.img
    ? ` style="--kvk-bg: url('${new URL(`icons/kvks/${encodeURIComponent(skin.img)}.webp`, document.baseURI).href}')"`
    : "";
  const href = `dashboard.html?kd=${encodeURIComponent(kingdomId)}&kvk=${encodeURIComponent(key.kvkNumber)}`;
  return `
    <a class="kingdom-box kvk-box${backgroundStyle ? " has-bg" : ""}" href="${href}"${backgroundStyle}>
      <div class="kvk-title">${escapeHtml(label)} ${badge}</div>
      <div class="kvk-stats">
        ${statHtml("Kill Points", key.kp)}
        ${statHtml("T4 Kills", key.t4)}
        ${statHtml("T5 Kills", key.t5)}
        ${statHtml("Deads", key.deads)}
        ${statHtml("Acclaim", key.acclaim)}
      </div>
    </a>`;
}

async function initSelectKvk() {
  const kingdomId = '2247';
  const heading = document.getElementById("kvk-heading");
  const list = document.getElementById("kvk-list");
  const empty = document.getElementById("kvk-empty");
  heading.innerHTML = `<h1>Kingdom ${kingdomId}</h1><p class="muted">Select a KvK</p>`;

  let names;
  let kvks;
  try {
    [names, kvks] = await Promise.all([loadKvkNames(), listKvks(kingdomId)]);
  } catch (event) {
    console.error("Failed to load KvK data:", event);
    empty.textContent = "Failed to load KvK data.";
    empty.style.display = "block";
    return;
  }

  if (!kvks.length) {
    empty.style.display = "block";
    return;
  }

  list.className = "container";
  list.innerHTML = kvks.map((kvk) => kvkBoxHtml(kingdomId, kvk, names)).join("");
}

initSelectKvk();
