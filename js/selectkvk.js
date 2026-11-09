async function loadKvkNames() {
  try {
    const res = await fetch("data/kvknames.json");
    const raw = await res.json();
    const out = {};
    for (const [abbr, skin] of Object.entries(raw.skins || {})) {
      out[abbr.toLowerCase()] = skin;
      if (skin.img && !(skin.img in out)) out[skin.img.toLowerCase()] = skin;
    }
    return out;
  } catch (e) {
    console.error("Failed to load kvknames.json:", e);
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
  const skin = findKvkSkin(k.name, names);
  const bgStyle = skin && skin.img
    ? ` style="--kvk-bg: url('${new URL(`icons/kvks/${encodeURIComponent(skin.img)}.webp`, document.baseURI).href}')"`
    : "";
  const href = `dashboard.html?kd=${encodeURIComponent(kd)}&kvk=${encodeURIComponent(k.kvkNumber)}`;
  return `
    <a class="kingdom-box kvk-box${bgStyle ? " has-bg" : ""}" href="${href}"${bgStyle}>
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
  const kd = '2247';
  const heading = document.getElementById("kvk-heading");
  const list = document.getElementById("kvk-list");
  const empty = document.getElementById("kvk-empty");
  heading.innerHTML = `<h1>Kingdom ${kd}</h1><p class="muted">Select a KvK</p>`;

  let names;
  let kvks;
  try {
    [names, kvks] = await Promise.all([loadKvkNames(), listKvks(kd)]);
  } catch (e) {
    console.error("Failed to load KvK data:", e);
    empty.textContent = "Failed to load KvK data.";
    empty.style.display = "block";
    return;
  }

  if (!kvks.length) {
    empty.style.display = "block";
    return;
  }

  list.className = "container";
  list.innerHTML = kvks.map((k) => kvkBoxHtml(kd, k, names)).join("");
}

initSelectKvk();
