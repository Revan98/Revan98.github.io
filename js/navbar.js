"use strict";
(() => {
  const THEME_KEY = "theme";

  function applyTheme(theme) {
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme);
    document.body.setAttribute("data-ag-theme-mode", theme);
    localStorage.setItem(THEME_KEY, theme);
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  function preferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function initTheme() {
    const theme = preferredTheme();
    applyTheme(theme);

    const themeToggle = document.getElementById("toggle-theme");
    if (!themeToggle) return;
    themeToggle.checked = theme === "dark";
    themeToggle.addEventListener("change", () => {
      applyTheme(themeToggle.checked ? "dark" : "light");
    });
  }

  function initActiveNavLink() {
    const current = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach((link) => {
      if (link.getAttribute("href") === current) {
        link.classList.add("active");
      }
    });
  }

  function initMobileNav() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;

    const hamburger = document.createElement("button");
    hamburger.type = "button";
    hamburger.id = "navbar-hamburger";
    hamburger.className = "navbar-hamburger";
    hamburger.setAttribute("aria-label", "Toggle navigation");
    hamburger.setAttribute("aria-controls", "sidebar");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.innerHTML =
      '<svg class="hamburger-icon icon-open" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>' +
      '<svg class="hamburger-icon icon-close" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    const backdrop = document.createElement("div");
    backdrop.id = "nav-backdrop";
    backdrop.className = "nav-backdrop";

    document.body.prepend(backdrop);
    document.body.prepend(hamburger);

    function closeNav() {
      sidebar.classList.remove("mobile-open");
      backdrop.classList.remove("show");
      hamburger.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-scroll-lock");
    }
    function openNav() {
      sidebar.classList.add("mobile-open");
      backdrop.classList.add("show");
      hamburger.setAttribute("aria-expanded", "true");
      document.body.classList.add("nav-scroll-lock");
    }
    function toggleNav() {
      if (sidebar.classList.contains("mobile-open")) closeNav();
      else openNav();
    }

    hamburger.addEventListener("click", toggleNav);
    backdrop.addEventListener("click", closeNav);

    sidebar.querySelectorAll(".nav-links a").forEach((link) => {
      link.addEventListener("click", closeNav);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });

    let wasMobile = window.innerWidth <= 768;
    window.addEventListener("resize", () => {
      const isMobile = window.innerWidth <= 768;
      if (wasMobile && !isMobile) closeNav();
      wasMobile = isMobile;
    });
  }

  initTheme();
  document.addEventListener("DOMContentLoaded", () => {
    initActiveNavLink();
    initMobileNav();
  });
})();
