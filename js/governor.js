const KVK_SHEETS = [
  {
    name: "KvK 1",
    url: "https://docs.google.com/spreadsheets/d/1wt5pWTBn3gzBB_kVi6JSXpr6clJSkmLHl-d5WsS6PM0",
  },
  {
    name: "KvK 2",
    url: "https://docs.google.com/spreadsheets/d/1PR54M6XMc2OTkt9gAgK9kirrZq--M8pTtGGcTTxxygw",
  },
  {
    name: "KvK 3",
    url: "https://docs.google.com/spreadsheets/d/11L5nIbO29VRCMIhE8-O4HHaQQCie2HCE56wp9HA_Ke0",
  },
  {
    name: "KvK 4",
    url: "https://docs.google.com/spreadsheets/d/1wc9Qu-PDcNsKMkUcNmCIrKYpxXJH1GrjwiPRL2syxlc",
  },
  {
    name: "KvK 5",
    url: "https://docs.google.com/spreadsheets/d/1bP7LMwUuN3gjIEWKo0QCStKmrvIzn9rrYedoaUJh5zg",
  },
  {
    name: "KvK 6",
    url: "https://docs.google.com/spreadsheets/d/1LHAa5r_coFO5XGCuqmZe6BrMmfanlq7Ds9TVIX_ekps",
  },
];
const API_KEY = "AIzaSyDIX6tSEresAQCeYE6cGOWEzWQ92HHoPeY";

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

function extractSheetId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

async function loadLastSheet(spreadsheetId) {
  // 1️⃣ get metadata
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${API_KEY}`;
  const metaRes = await fetch(metaUrl);
  const metaJson = await metaRes.json();

  const sheetNames = metaJson.sheets.map((s) => s.properties.title);
  const lastSheet = sheetNames.at(-1);

  // 2️⃣ load last sheet values
  const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(lastSheet)}'?key=${API_KEY}`;

  const dataRes = await fetch(dataUrl);
  return dataRes.json();
}

async function loadGovernorData() {
  const { id } = getParams();
  const results = [];

  for (const kvk of KVK_SHEETS) {
    const sheetId = extractSheetId(kvk.url);

    try {
      const data = await loadLastSheet(sheetId);

      if (!data.values) continue;

      const headers = data.values[0];
      const rows = data.values.slice(1);

      const found = rows.find((r) => `${r[0]}` === `${id}`);

      if (found) {
        results.push({
          kvk: kvk.name,
          row: found,
        });
      }
    } catch (err) {
      console.error("Failed loading:", kvk.name, err);
    }
  }

  return results;
}

const COL = {
  ID: 0,
  NAME: 1,
  POWER: 2,
  KP_DIFF: 3,
  T4_DIFF: 4,
  T5_DIFF: 5,
  DEADS_DIFF: 6,
  DKP: 8,
  DKP_PERCENT: 9,
  POWER_DIFF: 16,
  ACCLAIM: 17,
};
const num = (v) => Number(v) || 0;

function safe(row, index) {
  return row[index] !== undefined ? row[index] : 0;
}

function buildRowDataFromKvKs(kvkRows) {
  return kvkRows.map(({ kvk, row }) => ({
    kvk,
    id: safe(row, 0),
    name: safe(row, 1),

    powerDiff: num(safe(row, 16)),
    killPointsDiff: num(safe(row, 3)),
    t4Diff: num(safe(row, 4)),
    t5Diff: num(safe(row, 5)),
    deadsDiff: num(safe(row, 6)),

    dkp: num(safe(row, 8)),
    dkpPercent: safe(row, 9),
  }));
}

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
      valueFormatter: (params) => {
        const v = Number(params.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (params) =>
        Number(params.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "Killpoints",
      field: "killPointsDiff",
      valueFormatter: (p) => {
        const v = Number(p.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (p) =>
        Number(p.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "T4",
      field: "t4Diff",
      valueFormatter: (p) => {
        const v = Number(p.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (p) =>
        Number(p.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "T5",
      field: "t5Diff",
      valueFormatter: (p) => {
        const v = Number(p.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (p) =>
        Number(p.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "Deads",
      field: "deadsDiff",
      valueFormatter: (p) => {
        const v = Number(p.value) || 0;
        return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US")}`;
      },
      cellClass: (p) =>
        Number(p.value) >= 0 ? "diff-positive" : "diff-negative",
    },

    {
      headerName: "DKP",
      field: "dkp",
      valueFormatter: (p) => Number(p.value || 0).toLocaleString("en-US"),
    },

    {
      headerName: "DKP %",
      field: "dkpPercent",
    },

    {
      headerName: "Acclaim",
      field: "acclaim",
      valueFormatter: (p) => Number(p.value || 0).toLocaleString("en-US"),
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

gridApi = agGrid.createGrid(document.querySelector("#govGrid"), gridOptions);

const maximizeToggle = document.getElementById("maximizeTable");
const gridWrapper = document.getElementById("gridWrapper");

maximizeToggle.addEventListener("change", () => {
  gridWrapper.classList.toggle("maximized", maximizeToggle.checked);
  gridApi.doLayout();
});

function onFilterTextBoxChanged() {
  const input = document.getElementById("quickFilter");
  gridApi.setGridOption("quickFilterText", input.value);
}

loadGovernorData().then((data) => {
  const spinner = document.getElementById("loading-spinner");
  const rowData = buildRowDataFromKvKs(data);
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
