function selectKingdom(kd) {
  window.location.href = "selectkvk.html?kd=" + kd;
}

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
hamburger.addEventListener("click", () => {
  navLinks.classList.toggle("show");
  hamburger.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
    navLinks.classList.remove("show");
    hamburger.classList.remove("open");
  }
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("show");
    hamburger.classList.remove("open");
  });
});

const THEME_KEY = "theme";
const themeToggle = document.getElementById("toggle-theme");

function getCurrentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
  document.body.setAttribute("data-ag-theme-mode", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const theme = getCurrentTheme();
  applyTheme(theme);
  themeToggle.checked = theme === "dark";
}

themeToggle.addEventListener("change", () => {
  applyTheme(themeToggle.checked ? "dark" : "light");
});

initTheme();
