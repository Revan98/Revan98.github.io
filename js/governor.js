const qs = (sel) => document.querySelector(sel);

function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    kd: p.get("kd"),
    id: p.get("id"),
  };
}
document.addEventListener("DOMContentLoaded", () => {
  const { kd } = getParams();
  const backLink = document.getElementById("backLink");

  if (!backLink) return;

  if (kd) {
    backLink.href = `dashboard.html?kd=${encodeURIComponent(kd)}`;
  } else {
    backLink.href = "dashboard.html";
  }
});

async function loadDatabase() {
  if (window.db) return;

  const SQL = await initSqlJs({
    locateFile: file =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
  });

  const res = await fetch("kvk.db");
  const buffer = await res.arrayBuffer();
  window.db = new SQL.Database(new Uint8Array(buffer));
}

async function loadGovernorFromDb() {
  await loadDatabase();

  const { kd, id } = getParams();
  if (!kd || !id) return [];

  // 1️⃣ Get all KvKs for this kingdom
  const kvksRes = window.db.exec(`
    SELECT id, kvk_number
    FROM kvks
    WHERE kingdom='${kd}'
    ORDER BY kvk_number
  `);

  if (!kvksRes.length) return [];

  const kvks = kvksRes[0].values;

  const results = [];

  // 2️⃣ For each KvK get last snapshot stats
  for (const [kvkId, kvkNumber] of kvks) {

    const snapRes = window.db.exec(`
      SELECT id
      FROM snapshots
      WHERE kvk_id=${kvkId} AND is_last=1
      LIMIT 1
    `);

    if (!snapRes.length) continue;

    const snapshotId = snapRes[0].values[0][0];

    const statsRes = window.db.exec(`
      SELECT
        s.governor_id,
        g.name,
        s.power,
        s.power_diff,
        s.kill_points,
        s.kp_diff,
        s.t4,
        s.t4_diff,
        s.t5,
        s.t5_diff,
        s.deads,
        s.deads_diff,
        s.dkp,
        s.dkp_percent,
        s.acclaim
      FROM stats s
      JOIN governors g ON g.governor_id=s.governor_id
      WHERE s.snapshot_id=${snapshotId}
        AND s.governor_id='${id}'
    `);

    if (!statsRes.length) continue;

    const row = statsRes[0].values[0];

    results.push({
      kvk: `KvK ${kvkNumber}`,
      id: row[0],
      name: row[1],
      powerDiff: row[3],
      killPointsDiff: row[5],
      t4Diff: row[7],
      t5Diff: row[9],
      deadsDiff: row[11],
      dkp: row[12],
      dkpPercent: row[13],
      acclaim: row[14],
    });
  }

  return results;
}

const num = (v) => Number(v) || 0;

const gridOptions = {
  theme: agGrid.themeQuartz,
  rowData: [],
  columnDefs: [
    { headerName: "KvK", field: "kvk" },
    { headerName: "ID", field: "id", sortable: false },
    { headerName: "Name", field: "name" },

    {
      headerName: "Power",
      field: "powerDiff",
      comparator: (a, b) => a - b,
      valueFormatter: (p) => {
        const v = num(p.value);
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (p) =>
        num(p.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "Killpoints",
      field: "killPointsDiff",
      valueFormatter: (p) => {
        const v = num(p.value);
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (p) =>
        num(p.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "T4",
      field: "t4Diff",
      valueFormatter: (p) => {
        const v = num(p.value);
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (p) =>
        num(p.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "T5",
      field: "t5Diff",
      valueFormatter: (p) => {
        const v = num(p.value);
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (p) =>
        num(p.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "Deads",
      field: "deadsDiff",
      valueFormatter: (p) => {
        const v = num(p.value);
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (p) =>
        num(p.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "DKP",
      field: "dkp",
      valueFormatter: (p) =>
        num(p.value).toLocaleString("en-US"),
    },

    {
      headerName: "DKP %",
      field: "dkpPercent",
      valueFormatter: (p) => {
        const v = Number(p.value);
        if (isNaN(v)) return "";
        return (v * 100).toFixed(2) + "%";
      }
    },

    {
      headerName: "Acclaim",
      field: "acclaim",
      valueFormatter: (p) =>
        num(p.value).toLocaleString("en-US"),
    },
  ],
  defaultColDef: {
    sortable: true,
    filter: false,
    resizable: true,
  },
  pagination: false,
  animateRows: true,
};

const gridApi = agGrid.createGrid(
  document.querySelector("#govGrid"),
  gridOptions
);

loadGovernorFromDb().then((rowData) => {
  const spinner = document.getElementById("loading-spinner");

  gridApi.setGridOption("rowData", rowData);

  spinner.style.display = "none";
  const gridEl = document.getElementById("govGrid");
  gridEl.style.display = "block";

  requestAnimationFrame(() => {
    gridEl.classList.add("visible");
  });
});


const THEME_KEY = "theme";
const themeToggle = document.getElementById("toggle-theme");

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);

  document.body.setAttribute("data-ag-theme-mode", theme);

  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);

  let theme;
  if (saved === "light" || saved === "dark") {
    theme = saved;
  } else {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  applyTheme(theme);
  themeToggle.checked = theme === "dark";
}

themeToggle.addEventListener("change", () => {
  applyTheme(themeToggle.checked ? "dark" : "light");
});

initTheme();

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
if (hamburger && navLinks) {
  hamburger.addEventListener("click", () => navLinks.classList.toggle("show"));
}
