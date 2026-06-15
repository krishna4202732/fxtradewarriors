// Home (dashboard) page controller. Private page: guarded by requireAuth. Shows
// the welcome name and the calculator/journal cards (plain anchors). Logout is
// wired to clear the session before following the link to login.html.

import { initTheme } from "../theme.js";
import { setText, setupScrollReveal } from "../dom-utils.js";
import { recalculateUserJournal } from "../journal.js";
import { requireAuth, initLogout } from "../router.js";
import { mountSharedComponents } from "../components.js";

function init() {
  const user = requireAuth();

  if (!user) {
    return;
  }

  // Keep stored balances current, matching the SPA's home render path.
  recalculateUserJournal(user.username);

  mountSharedComponents();
  initTheme();
  initLogout();
  setText(document.querySelector("#homeDisplayName"), user.displayName);
  setupScrollReveal();
}

init();
