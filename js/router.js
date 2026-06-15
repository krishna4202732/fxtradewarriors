// Client-side routing for the multi-page app: authentication guard, redirect
// logic, and logout wiring. All session state comes from auth.js, now backed by
// Supabase. Session reads are async, so the guards below return Promises and
// each page's init() awaits them.

import { getStoredUser, signOut } from "./auth.js";

export const ROUTES = {
  LANDING: "index.html",
  LOGIN: "login.html",
  HOME: "home.html",
  CALCULATOR: "calculator.html",
  JOURNAL: "journal.html",
};

// The currently authenticated user, or null. Resolves the persisted Supabase
// session, so a page refresh keeps the user logged in.
export async function getCurrentUser() {
  return getStoredUser();
}

// Guard for private pages (home, calculator, journal). If there is no
// authenticated user, redirect to the login page and resolve to null so the
// caller halts initialization. Uses location.replace so the protected URL is not
// added to history (Back from login should not bounce back into a guarded page).
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.replace(ROUTES.LOGIN);
    return null;
  }

  return user;
}

// Guard for the login page: an already-authenticated user is sent straight to
// the dashboard instead of seeing the login form again.
export async function redirectIfAuthenticated() {
  const user = await getCurrentUser();

  if (user) {
    window.location.replace(ROUTES.HOME);
    return true;
  }

  return false;
}

// Clears the Supabase session.
export async function logout() {
  await signOut();
}

// Wires every [data-logout] control on the page. Logout controls are anchors to
// login.html; because sign-out is async we intercept the click, clear the
// session, then navigate so the guard on every private page takes effect.
export function initLogout() {
  document.querySelectorAll("[data-logout]").forEach((element) => {
    element.addEventListener("click", async (event) => {
      event.preventDefault();

      try {
        await logout();
      } finally {
        window.location.replace(ROUTES.LOGIN);
      }
    });
  });
}
