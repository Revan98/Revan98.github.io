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

const TOAST_ICONS = {
  error: "fa-solid fa-circle-exclamation",
  info: "fa-solid fa-circle-info",
  success: "fa-solid fa-circle-check",
};

function showToast(message, type = "info", duration = 5000) {
  const container = getToastContainer();

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
  container.appendChild(toast);

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

function selectKingdom(kingdomId) {
  window.location.href = "selectkvk.html?kd=" + kingdomId;
}

const hamburger = document.getElementById("hamburger");
const navigationLinks = document.getElementById("nav-links");
hamburger.addEventListener("click", () => {
  navigationLinks.classList.toggle("show");
  hamburger.classList.toggle("open");
});

document.addEventListener("click", (event) => {
  if (!hamburger.contains(event.target) && !navigationLinks.contains(event.target)) {
    navigationLinks.classList.remove("show");
    hamburger.classList.remove("open");
  }
});

navigationLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navigationLinks.classList.remove("show");
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
