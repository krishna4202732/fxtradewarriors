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
  backToLogin: document.querySelector("#backToLogin"),
  backToOverview: document.querySelector("#backToOverview"),
  passwordField: document.querySelector("#loginPassword").closest(".field"),
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
//   login    — email + password + all secondary actions
//   signup   — adds display name; submit creates an account
//   reset    — forgot-password: email only, "Send Reset Link" + Back To Login
//   recovery — set a new password after following a reset link
function setMode(nextMode) {
  mode = nextMode;
  setError("");

  const isSignup = mode === "signup";
  const isRecovery = mode === "recovery";
  const isReset = mode === "reset";

  // Display Name belongs to signup only — never shown for login/reset/recovery.
  elements.displayNameField.hidden = !isSignup;
  // Email is hidden only while choosing a new password (recovery).
  emailField().hidden = isRecovery;
  // Password is hidden while requesting a reset link.
  elements.passwordField.hidden = isReset;
  // Secondary actions only make sense in normal login/signup.
  elements.forgotPassword.hidden = isRecovery || isReset;
  elements.toggleMode.hidden = isRecovery || isReset;
  elements.googleLogin.hidden = isRecovery || isReset;
  elements.backToLogin.hidden = !isReset;
  elements.backToOverview.hidden = isReset || isRecovery;

  if (isRecovery) {
    elements.authSubtitle.textContent = "Choose a new password.";
    elements.authSubmit.textContent = "Update Password";
    elements.loginPassword.setAttribute("autocomplete", "new-password");
    return;
  }

  if (isReset) {
    elements.authSubtitle.textContent =
      "Enter your email address and we'll send you a reset link.";
    elements.authSubmit.textContent = "Send Reset Link";
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
    } else if (mode === "reset") {
      await handleSendResetLink();
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

// "Forgot password?" switches into reset mode (password hidden, email kept).
function handleForgotPassword() {
  setMode("reset");
  elements.loginEmail.focus();
}

// Submit in reset mode: send the reset link, then return to login.
async function handleSendResetLink() {
  const email = elements.loginEmail.value.trim();

  if (!email) {
    setError("Enter your email address to receive a reset link.");
    elements.loginEmail.focus();
    return;
  }

  await sendPasswordReset(email);
  showToast("Password reset link sent. Check your email.");
  setMode("login");
}

function handleToggleMode() {
  setMode(mode === "signup" ? "login" : "signup");
}

function attachEvents() {
  elements.loginForm.addEventListener("submit", handleSubmit);
  elements.googleLogin.addEventListener("click", handleGoogle);
  elements.forgotPassword.addEventListener("click", handleForgotPassword);
  elements.toggleMode.addEventListener("click", handleToggleMode);
  elements.backToLogin.addEventListener("click", () => setMode("login"));

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
