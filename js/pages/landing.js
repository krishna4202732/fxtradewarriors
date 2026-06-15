// Landing page controller. Public page — no auth guard. Handles theme + the
// scroll-reveal animations only; navigation is plain anchors to login.html.

import { initTheme } from "../theme.js";
import { setupScrollReveal } from "../dom-utils.js";
import { mountSharedComponents } from "../components.js";

function init() {
  mountSharedComponents();
  initTheme();
  setupScrollReveal();
}

init();
