// Generic DOM + formatting helpers shared across every page.
// Extracted verbatim from the original SPA app.js so behaviour is unchanged.

import { formatCurrency } from "./calculator.js";
import { IST_TIMEZONE } from "./sessions.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function setText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = value || "--";
}

export function setBarFill(element, percent) {
  if (!element) {
    return;
  }

  const normalizedPercent = Math.min(Math.max(Number(percent) || 0, 0), 100);
  element.style.setProperty("--bar-width", `${normalizedPercent}%`);
}

export function setSignedClass(element, value) {
  if (!element) {
    return;
  }

  element.classList.remove("positive", "negative");

  if (!Number.isFinite(value) || value === 0) {
    return;
  }

  element.classList.add(value > 0 ? "positive" : "negative");
}

export function formatSignedCurrency(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (value > 0) {
    return `+${formatCurrency(value)}`;
  }

  if (value < 0) {
    return `-${formatCurrency(Math.abs(value))}`;
  }

  return formatCurrency(0);
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function parseNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Default datetime-local value expressed as IST wall-clock, matching the "(IST)"
// labelling on the entry/exit time fields.
export function getIstDateTimeLocalValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = value("hour") === "24" ? "00" : value("hour");

  return `${value("year")}-${value("month")}-${value("day")}T${hour}:${value("minute")}`;
}

export function formatTimeOnly(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saved trade";
  }

  return date.toLocaleString();
}

// --- Toast ----------------------------------------------------------------------

let toastTimer = null;

export function showToast(message) {
  const toast = document.querySelector("#toast");

  if (!toast) {
    return;
  }

  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
}

// --- Scroll reveal animation ----------------------------------------------------

export function setupScrollReveal() {
  const revealTargets = Array.from(
    document.querySelectorAll("[data-reveal], .app-header, .page-view .panel, .stats-grid > div"),
  );

  if (revealTargets.length === 0) {
    return;
  }

  revealTargets.forEach((target, index) => {
    target.classList.add("reveal-ready");
    target.style.transitionDelay = `${Math.min(index % 6, 5) * 45}ms`;
  });

  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    revealTargets.forEach((target) => target.classList.add("is-revealed"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.14,
    },
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
}
