// Login page controller. If the user is already authenticated they are sent to
// the dashboard. On success we navigate to home.html via a real page load so
// browser history reflects the transition.

import { initTheme } from "../theme.js";
import { showToast } from "../dom-utils.js";
import { authenticateUser } from "../auth.js";
import { recalculateUserJournal } from "../journal.js";
import { redirectIfAuthenticated, ROUTES } from "../router.js";
import { mountSharedComponents } from "../components.js";

const elements = {
  loginForm: document.querySelector("#loginForm"),
  loginUsername: document.querySelector("#loginUsername"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
};

function handleLoginSubmit(event) {
  event.preventDefault();

  const user = authenticateUser(elements.loginUsername.value, elements.loginPassword.value);

  if (!user) {
    elements.loginError.textContent = "Invalid username or password.";
    elements.loginPassword.select();
    return;
  }

  // Keep journal/account balances consistent on login, exactly as the SPA did.
  recalculateUserJournal(user.username);
  elements.loginError.textContent = "";
  elements.loginForm.reset();
  window.location.href = ROUTES.HOME;
}

function init() {
  // Already logged in? Skip the form entirely.
  if (redirectIfAuthenticated()) {
    return;
  }

  mountSharedComponents();
  initTheme();
  elements.loginForm.addEventListener("submit", handleLoginSubmit);
  elements.loginUsername.focus();
}

init();
