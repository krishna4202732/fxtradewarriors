// Client-side routing for the multi-page app: authentication guard, redirect
// logic, and logout wiring. All session state comes from auth.js (the same
// localStorage-backed source the SPA used) — no auth logic is duplicated here.

import { getStoredUser, logoutUser } from "./auth.js";

export const ROUTES = {
  LANDING: "index.html",
  LOGIN: "login.html",
  HOME: "home.html",
  CALCULATOR: "calculator.html",
  JOURNAL: "journal.html",
};

// The currently authenticated user, or null. Reads persisted session storage,
// so a page refresh keeps the user logged in.
export function getCurrentUser() {
  return getStoredUser();
}

// Guard for private pages (home, calculator, journal). If there is no
// authenticated user, redirect to the login page and signal the caller to halt
// initialization. Uses location.replace so the protected URL is not added to
// history (Back from login should not bounce back into a guarded page).
export function requireAuth() {
  const user = getCurrentUser();

  if (!user) {
    window.location.replace(ROUTES.LOGIN);
    return null;
  }

  return user;
}

// Guard for the login page: an already-authenticated user is sent straight to
// the dashboard instead of seeing the login form again.
export function redirectIfAuthenticated() {
  const user = getCurrentUser();

  if (user) {
    window.location.replace(ROUTES.HOME);
    return true;
  }

  return false;
}

// Clears the session and navigates to the login page. Used by the logout
// buttons, which are anchors to login.html — we still clear storage on click so
// the guard on every private page takes effect immediately.
export function logout() {
  logoutUser();
}

// Wires every [data-logout] control on the page to clear the session before the
// browser follows the anchor to login.html.
export function initLogout() {
  document.querySelectorAll("[data-logout]").forEach((element) => {
    element.addEventListener("click", () => {
      logout();
    });
  });
}
