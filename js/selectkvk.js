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
function formatCompact(n) {
  n = Number(n) || 0;
  if (n <= 0) return "—";
  const units = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) return (n / size).toFixed(2).replace(/\.?0+$/, "") + suffix;
  }
  return String(n);
}

function statHtml(label, value) {
  return `
    <div class="kvk-stat" title="${Number(value).toLocaleString("en-US")}">
      <span class="kvk-stat-label">${label}</span>
      <span class="kvk-stat-value">${formatCompact(value)}</span>
    </div>`;
}
async function initSelectKvk() {
  const kd = getKDFromURL();
  const heading = document.getElementById("kvk-heading");
  const list = document.getElementById("kvk-list");
  const empty = document.getElementById("kvk-empty");

  if (!kd) {
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
    SELECT
      k.kvk_number,
      k.name,
      k.is_latest,
      COALESCE(SUM(st.kp_diff), 0)     AS kp,
      COALESCE(SUM(st.t4_diff), 0)     AS t4,
      COALESCE(SUM(st.t5_diff), 0)     AS t5,
      COALESCE(SUM(st.deads_diff), 0)  AS deads,
      COALESCE(SUM(st.acclaim), 0)     AS acclaim
    FROM kvks k
    LEFT JOIN snapshots s ON s.kvk_id = k.id AND s.is_last = 1
    LEFT JOIN stats st    ON st.snapshot_id = s.id
    WHERE k.kingdom = '${kd}'
    GROUP BY k.id
    ORDER BY k.kvk_number DESC
  `)[0];

  if (!result || !result.values.length) {
    empty.style.display = "block";
    return;
  }

  list.className = "container";
  list.innerHTML = result.values
    .map(([kvkNumber, name, isLatest, kp, t4, t5, deads, acclaim]) => {
      const label = expandKvkName(name, kvkNumber, abbrMap);
      const badge = isLatest ? '<span class="kvk-badge">Latest</span>' : "";
      return `
        <div class="kingdom-box kvk-box" onclick="selectKvk('${kd}', ${kvkNumber})">
          <div class="kvk-title">${escapeHtml(label)} ${badge}</div>
          <div class="kvk-stats">
            ${statHtml("Kill Points", kp)}
            ${statHtml("T4 Kills", t4)}
            ${statHtml("T5 Kills", t5)}
            ${statHtml("Deads", deads)}
            ${statHtml("Acclaim", acclaim)}
          </div>
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
