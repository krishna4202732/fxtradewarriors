// Home (dashboard) page controller. Private page: guarded by requireAuth. Shows
// the welcome name and the calculator/journal cards (plain anchors). Logout is
// wired to clear the session before following the link to login.html.

import { initTheme } from "../theme.js";
import { setText, setupScrollReveal } from "../dom-utils.js";
import { initUserData } from "../journal.js";
import { requireAuth, initLogout } from "../router.js";
import { mountSharedComponents } from "../components.js";

async function init() {
  const user = await requireAuth();

  if (!user) {
    return;
  }

  // Hydrate from Supabase + run the one-time localStorage migration, then keep
  // stored balances current — matching the SPA's home render path.
  try {
    await initUserData(user.username);
  } catch (error) {
    console.error("Failed to load your data:", error.message);
  }

  mountSharedComponents();
  initTheme();
  initLogout();
  setText(document.querySelector("#homeDisplayName"), user.displayName);
  setupScrollReveal();
}

init();
