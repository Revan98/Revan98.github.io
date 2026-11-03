function normalizeNumericId(value) {
  const id = String(value ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}

function getKvkNumberFromURL() {
  return normalizeNumericId(new URLSearchParams(location.search).get("kvk"));
}

const num = (v) => Number(v) || 0;
const CSV_FORMULA_START = /^[=+\-@\t\r]/;
const CSV_NUMERIC_LIKE = /^[-+]?\d+([.,]\d+)?([eE][-+]?\d+)?%?$/;
function csvSafeCell(value) {
  if (typeof value !== "string") return value;
  return CSV_FORMULA_START.test(value) && !CSV_NUMERIC_LIKE.test(value)
    ? "'" + value
    : value;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatSignedNumber(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
}

function formatPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : "";
}

function formatCompact(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  for (const [size, suffix] of [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ]) {
    if (abs >= size) {
      return sign + (abs / size).toFixed(2).replace(/\.?0+$/, "") + suffix;
    }
  }
  return String(n);
}

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"'`=/]/g, (s) => HTML_ESCAPES[s]);
}

const escapeAttr = escapeHtml;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function importToInt(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function importToText(v, fallback = "") {
  if (v === null || v === undefined || String(v).trim() === "") return fallback;
  return String(v).trim();
}

function importToFloat(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function searchByName(query, sources) {
  const q = String(query ?? "").trim().toLowerCase();
  if (q.length < 2) return [];

  const pattern = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
  const results = [];
  const seen = new Set();

  for (const { db: database, src } of sources) {
    if (!database) continue;
    let stmt;
    try {
      stmt = database.prepare(
        `SELECT DISTINCT governor_id, name FROM governors
         WHERE lower(name) LIKE ? ESCAPE '\\'
         ORDER BY name LIMIT 20`,
      );
      stmt.bind([pattern]);
      while (stmt.step()) {
        const [id, name] = stmt.get();
        const key = String(id);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ id: key, name: name || key, src });
      }
    } catch (e) {
      console.warn(`Name search (${src}):`, e);
    } finally {
      stmt?.free();
    }
  }

  results.sort((a, b) => {
    const al = a.name.toLowerCase();
    const bl = b.name.toLowerCase();
    const aStarts = al.startsWith(q);
    const bStarts = bl.startsWith(q);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return al.localeCompare(bl);
  });
  return results.slice(0, 15);
}

const TOAST_ICONS = {
  error: "fa-solid fa-circle-exclamation",
  info: "fa-solid fa-circle-info",
  success: "fa-solid fa-circle-check",
};

function getToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = "info", duration = 5000) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "alert");

  const icon = document.createElement("i");
  icon.className = `toast-icon ${TOAST_ICONS[type] || TOAST_ICONS.info}`;

  const text = document.createElement("span");
  text.className = "toast-message";
  text.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.className = "toast-close";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';

  toast.append(icon, text, closeBtn);
  getToastContainer().appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  const remove = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  };
  closeBtn.addEventListener("click", remove);
  if (duration > 0) setTimeout(remove, duration);
}

const THEME_KEY = "theme";

function getCurrentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
}

function initTheme() {
  const toggle = document.getElementById("toggle-theme");
  const theme = getCurrentTheme();
  applyTheme(theme);
  if (!toggle) return;
  toggle.checked = theme === "dark";
  toggle.addEventListener("change", () =>
    applyTheme(toggle.checked ? "dark" : "light"),
  );
}

function initNav() {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");
  if (!hamburger || !navLinks) return;

  const close = () => {
    navLinks.classList.remove("show");
    hamburger.classList.remove("open");
  };

  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("show");
    hamburger.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) close();
  });
  navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));

  const current = location.pathname.split("/").pop();
  navLinks.querySelectorAll("a").forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.setAttribute("href", current + location.search);
    }
  });
}

function initToolsDropdown() {
  const toggle = document.getElementById("tools-toggle");
  const menu = document.getElementById("tools-menu");
  if (!toggle || !menu) return;

  const close = () => {
    menu.classList.remove("show");
    toggle.setAttribute("aria-expanded", "false");
  };
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle.setAttribute("aria-expanded", menu.classList.toggle("show"));
  });
  document.addEventListener("click", (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) close();
  });
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
}

initTheme();
initNav();
initToolsDropdown();

const VENDOR_SCRIPTS = {
  xlsx: {
    src: "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js",
    integrity: "sha512-AXreDm/maQt99+BKeuV5VUY8x0xBAZPX6OYenHRlRwG/C35PKcZ7GQXITTR8Zf3cLHeTfwVDLEMBBPf7laKtAA==",
    global: "XLSX",
  },
  chart: {
    src: "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.6.1/chart.umd.min.js",
    integrity: "sha512-vMRyUfXe50uUhhDC+fk6UYBA/1VPj+I7Jn+wK0A3+wSVeUgT9OCz/xoF2M8KFvrmUOlb4Anv0FQUw8NafuzYPw==",
    global: "Chart",
  },
};
const vendorLoads = {};

function loadVendor(name) {
  const lib = VENDOR_SCRIPTS[name];
  if (window[lib.global]) return Promise.resolve();
  vendorLoads[name] ??= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = lib.src;
    el.integrity = lib.integrity;
    el.crossOrigin = "anonymous";
    el.referrerPolicy = "no-referrer";
    el.onload = resolve;
    el.onerror = () => {
      delete vendorLoads[name];
      el.remove();
      reject(new Error(`Could not load ${lib.global}. Check your connection and try again.`));
    };
    document.head.appendChild(el);
  });
  return vendorLoads[name];
}
