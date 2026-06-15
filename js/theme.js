// Theme system shared by every page. Persists to the same localStorage key the
// original SPA used, so an existing user's light/dark preference is preserved.

import { showToast } from "./dom-utils.js";

const THEME_STORAGE_KEY = "fxTradeWarriors.theme.v1";

function getThemeToggles() {
  return Array.from(document.querySelectorAll("[data-theme-toggle]"));
}

export function getPreferredTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  const isLight = normalizedTheme === "light";
  const themeColor = document.querySelector('meta[name="theme-color"]');

  document.documentElement.dataset.theme = normalizedTheme;

  getThemeToggles().forEach((toggle) => {
    const text = toggle.querySelector(".theme-toggle-text");

    if (text) {
      text.textContent = isLight ? "Light" : "Dark";
    }

    toggle.setAttribute("aria-pressed", String(isLight));
    toggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
  });

  if (themeColor) {
    themeColor.setAttribute("content", isLight ? "#F7F8FB" : "#070A12");
  }
}

export function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";

  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
  showToast(`${nextTheme === "light" ? "Light" : "Dark"} mode active.`);
}

// Applies the saved theme and wires every theme toggle on the current page.
// Call once during page initialization.
export function initTheme() {
  applyTheme(getPreferredTheme());

  getThemeToggles().forEach((toggle) => {
    toggle.addEventListener("click", toggleTheme);
  });
}
