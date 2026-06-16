// Login page controller. Backed by Supabase Auth. One form drives three modes:
//   login    — email + password sign-in
//   signup   — email + password registration (+ optional display name)
//   recovery — set a new password after following a reset link
// Plus Google OAuth and "forgot password". The visual design is unchanged; all
// controls reuse the existing CSS classes.

import { initTheme } from "../theme.js";
import { showToast } from "../dom-utils.js";
import {
  signInWithEmail,
  signUp,
  signInWithGoogle,
  sendPasswordReset,
  updatePassword,
  onAuthStateChange,
} from "../auth.js";
import { redirectIfAuthenticated, ROUTES } from "../router.js";
import { mountSharedComponents } from "../components.js";

const elements = {
  loginForm: document.querySelector("#loginForm"),
  authSubtitle: document.querySelector("#authSubtitle"),
  displayNameField: document.querySelector("#displayNameField"),
  signupName: document.querySelector("#signupName"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  authSubmit: document.querySelector("#authSubmit"),
  googleLogin: document.querySelector("#googleLogin"),
  forgotPassword: document.querySelector("#forgotPassword"),
  toggleMode: document.querySelector("#toggleMode"),
  loginError: document.querySelector("#loginError"),
};

let mode = "login";

function emailField() {
  return elements.loginEmail.closest(".field");
}

function setError(message) {
  elements.loginError.textContent = message || "";
}

function setBusy(isBusy) {
  elements.authSubmit.disabled = isBusy;
  elements.googleLogin.disabled = isBusy;
}

// Applies the visual + behavioural state for a given mode. Visibility uses the
// native `hidden` attribute so no CSS is touched.
function setMode(nextMode) {
  mode = nextMode;
  setError("");

  const isSignup = mode === "signup";
  const isRecovery = mode === "recovery";

  elements.displayNameField.hidden = !isSignup;
  emailField().hidden = isRecovery;
  elements.forgotPassword.hidden = isRecovery;
  elements.toggleMode.hidden = isRecovery;
  elements.googleLogin.hidden = isRecovery;

  if (isRecovery) {
    elements.authSubtitle.textContent = "Choose a new password.";
    elements.authSubmit.textContent = "Update Password";
    elements.loginPassword.setAttribute("autocomplete", "new-password");
    return;
  }

  if (isSignup) {
    elements.authSubtitle.textContent = "Create your trading account.";
    elements.authSubmit.textContent = "Sign Up";
    elements.toggleMode.textContent = "Back to login";
    elements.loginPassword.setAttribute("autocomplete", "new-password");
    return;
  }

  elements.authSubtitle.textContent = "Sign in to your trading dashboard.";
  elements.authSubmit.textContent = "Login";
  elements.toggleMode.textContent = "Create an account";
  elements.loginPassword.setAttribute("autocomplete", "current-password");
}

// Recovery links arrive as `…/login.html#access_token=…&type=recovery`. Detect
// this synchronously so we don't bounce the user to the dashboard before they
// set a new password.
function isRecoveryFlow() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return hash.includes("type=recovery") || search.includes("type=recovery");
}

// On success, navigate to the dashboard via a real page load. Data hydration +
// the one-time localStorage migration happen on the home page (initUserData).
function completeLogin() {
  elements.loginForm.reset();
  window.location.href = ROUTES.HOME;
}

async function handleLogin() {
  const user = await signInWithEmail(elements.loginEmail.value, elements.loginPassword.value);
  completeLogin(user);
}

async function handleSignup() {
  const { user, needsVerification } = await signUp(
    elements.loginEmail.value,
    elements.loginPassword.value,
    elements.signupName.value,
  );

  if (needsVerification) {
    showToast("Account created. Check your email to verify your account, then log in.");
    elements.loginForm.reset();
    setMode("login");
    return;
  }

  completeLogin(user);
}

async function handleRecovery() {
  await updatePassword(elements.loginPassword.value);
  showToast("Password updated. You're signed in.");
  // Clear the recovery token from the URL before navigating on.
  window.location.replace(ROUTES.HOME);
}

async function handleSubmit(event) {
  event.preventDefault();
  setError("");
  setBusy(true);

  try {
    if (mode === "recovery") {
      await handleRecovery();
    } else if (mode === "signup") {
      await handleSignup();
    } else {
      await handleLogin();
    }
  } catch (error) {
    setError(error.message || "Something went wrong. Please try again.");
    elements.loginPassword.select();
  } finally {
    setBusy(false);
  }
}

async function handleGoogle() {
  setError("");
  setBusy(true);

  try {
    // Redirects away to Google and back to this page; no further code runs here.
    await signInWithGoogle();
  } catch (error) {
    setError(error.message || "Google sign-in is unavailable right now.");
    setBusy(false);
  }
}

async function handleForgotPassword() {
  const email = elements.loginEmail.value.trim();

  if (!email) {
    setError("Enter your email above, then tap Forgot password.");
    elements.loginEmail.focus();
    return;
  }

  setError("");

  try {
    await sendPasswordReset(email);
    showToast("Password reset link sent. Check your email.");
  } catch (error) {
    setError(error.message || "Could not send the reset email.");
  }
}

function handleToggleMode() {
  setMode(mode === "signup" ? "login" : "signup");
}

function attachEvents() {
  elements.loginForm.addEventListener("submit", handleSubmit);
  elements.googleLogin.addEventListener("click", handleGoogle);
  elements.forgotPassword.addEventListener("click", handleForgotPassword);
  elements.toggleMode.addEventListener("click", handleToggleMode);

  // Backup: Supabase also emits this event once the recovery token is parsed.
  onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      setMode("recovery");
    }
  });
}

async function init() {
  mountSharedComponents();
  initTheme();
  attachEvents();
  setMode("login");

  // Password recovery takes priority — don't redirect an authenticated recovery
  // session into the dashboard before the new password is set.
  if (isRecoveryFlow()) {
    setMode("recovery");
    return;
  }

  // Already logged in (incl. just returned from Google)? Skip the form.
  if (await redirectIfAuthenticated()) {
    return;
  }

  elements.loginEmail.focus();
}

init();
