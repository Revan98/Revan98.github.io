function normalizeNumericId(value) {
  const id = String(value ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}

function getKvkNumberFromURL() {
  return normalizeNumericId(new URLSearchParams(location.search).get("kvk"));
}

const toNumberOrZero = (value) => Number(value) || 0;
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
  const numericValue = Number(value) || 0;
  return `${numericValue >= 0 ? "+" : ""}${numericValue.toLocaleString("en-US")}`;
}

function formatPercent(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${(numericValue * 100).toFixed(2)}%` : "";
}

function formatCompact(value) {
  const numericValue = Number(value) || 0;
  const absoluteValue = Math.abs(numericValue);
  const sign = numericValue < 0 ? "-" : "";
  for (const [size, suffix] of [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ]) {
    if (absoluteValue >= size) {
      return sign + (absoluteValue / size).toFixed(2).replace(/\.?0+$/, "") + suffix;
    }
  }
  return String(numericValue);
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

function escapeHtml(string) {
  if (string == null) return "";
  return String(string).replace(/[&<>"'`=/]/g, (character) => HTML_ESCAPES[character]);
}

const escapeAttr = escapeHtml;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    textArea.remove();
    return copied;
  }
}

function importToInt(value) {
  if (value === null || value === undefined || value === "") return 0;
  const numericValue = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : 0;
}

function importToText(value, fallback = "") {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  return String(value).trim();
}

function importToFloat(value) {
  if (value === null || value === undefined || value === "") return 0;
  const numericValue = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function searchByName(query, sources) {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  const pattern = "%" + normalizedQuery.replace(/[\\%_]/g, "\\$&") + "%";
  const results = [];
  const seen = new Set();

  for (const { db: database, src: source } of sources) {
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
        results.push({ id: key, name: name || key, src: source });
      }
    } catch (event) {
      console.warn(`Name search (${source}):`, event);
    } finally {
      stmt?.free();
    }
  }

  results.sort((firstResult, secondResult) => {
    const firstName = firstResult.name.toLowerCase();
    const secondName = secondResult.name.toLowerCase();
    const aStarts = firstName.startsWith(normalizedQuery);
    const bStarts = secondName.startsWith(normalizedQuery);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return firstName.localeCompare(secondName);
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

  const closeButton = document.createElement("button");
  closeButton.className = "toast-close";
  closeButton.setAttribute("aria-label", "Dismiss");
  closeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';

  toast.append(icon, text, closeButton);
  getToastContainer().appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  const remove = () => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  };
  closeButton.addEventListener("click", remove);
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

function initNavigation() {
  const hamburger = document.getElementById("hamburger");
  const navigationLinks = document.getElementById("nav-links");
  if (!hamburger || !navigationLinks) return;

  const close = () => {
    navigationLinks.classList.remove("show");
    hamburger.classList.remove("open");
  };

  hamburger.addEventListener("click", () => {
    navigationLinks.classList.toggle("show");
    hamburger.classList.toggle("open");
  });
  document.addEventListener("click", (event) => {
    if (!hamburger.contains(event.target) && !navigationLinks.contains(event.target)) close();
  });
  navigationLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));

  const current = location.pathname.split("/").pop();
  navigationLinks.querySelectorAll("a").forEach((link) => {
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
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    toggle.setAttribute("aria-expanded", menu.classList.toggle("show"));
  });
  document.addEventListener("click", (event) => {
    if (!toggle.contains(event.target) && !menu.contains(event.target)) close();
  });
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
}

initTheme();
initNavigation();
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
  const vendorLibrary = VENDOR_SCRIPTS[name];
  if (window[vendorLibrary.global]) return Promise.resolve();
  vendorLoads[name] ??= new Promise((resolve, reject) => {
    const element = document.createElement("script");
    element.src = vendorLibrary.src;
    element.integrity = vendorLibrary.integrity;
    element.crossOrigin = "anonymous";
    element.referrerPolicy = "no-referrer";
    element.onload = resolve;
    element.onerror = () => {
      delete vendorLoads[name];
      element.remove();
      reject(new Error(`Could not load ${vendorLibrary.global}. Check your connection and try again.`));
    };
    document.head.appendChild(element);
  });
  return vendorLoads[name];
}
