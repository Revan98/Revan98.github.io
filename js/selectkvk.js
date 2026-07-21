function normalizeNumericId(value) {
  const id = String(value ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}

function getKDFromURL() {
  const params = new URLSearchParams(window.location.search);
  return normalizeNumericId(params.get("kd"));
}

function selectKvk(kd, kvkNumber) {
  window.location.href =
    "dashboard.html?kd=" + encodeURIComponent(kd) + "&kvk=" + encodeURIComponent(kvkNumber);
}

async function loadKvkNames() {
  try {
    const res = await fetch("data/kvknames.json");
    return await res.json();
  } catch (e) {
    console.error("Failed to load kvknames.json:", e);
    return {};
  }
}

function expandKvkName(rawName, kvkNumber, abbrMap) {
  const numberLabel = `KvK ${kvkNumber}`;
  if (!rawName || !rawName.trim()) return numberLabel;
  const tokens = rawName.trim().split(/[\s_]+/);
  const lastToken = tokens[tokens.length - 1];
  if (!lastToken || /^kvk\d*$/i.test(lastToken)) return numberLabel;
  const full =
    abbrMap[lastToken] ||
    abbrMap[
      Object.keys(abbrMap).find(
        (k) => k.toLowerCase() === lastToken.toLowerCase(),
      )
    ];
  return full ? `${numberLabel} ${full}` : rawName;
}

async function initSelectKvk() {
  const kd = getKDFromURL();
  const heading = document.getElementById("kvk-heading");
  const list = document.getElementById("kvk-list");
  const empty = document.getElementById("kvk-empty");

  if (!kd) {
    // No/invalid kingdom in URL - send the user back to pick one.
    window.location.href = "index.html";
    return;
  }

  heading.innerHTML = `<h1>Kingdom ${kd}</h1><p class="muted">Select a KvK</p>`;

  const abbrMap = await loadKvkNames();

  let db;
  try {
    const SQL = await initSqlJs({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
    });
    const res = await fetch("kvk.db");
    const buffer = await res.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buffer));
  } catch (e) {
    console.error("Failed to load kvk.db:", e);
    empty.textContent = "Failed to load KvK data.";
    empty.style.display = "block";
    return;
  }

  const result = db.exec(`
    SELECT kvk_number, name, is_latest
    FROM kvks
    WHERE kingdom='${kd}'
    ORDER BY kvk_number DESC
  `)[0];

  if (!result || !result.values.length) {
    empty.style.display = "block";
    return;
  }

  list.className = "container";
  list.innerHTML = result.values
    .map(([kvkNumber, name, isLatest]) => {
      const label = expandKvkName(name, kvkNumber, abbrMap);
      const badge = isLatest ? '<span class="kvk-badge">Latest</span>' : "";
      return `
        <div class="kingdom-box kvk-box" onclick="selectKvk('${kd}', ${kvkNumber})">
          ${escapeHtml(label)} ${badge}
        </div>
      `;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", initSelectKvk);
