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

// Single source of truth for what every control shows in each UI state.
// Mutually exclusive — exactly one state is active. `recovery` is the special
// post-reset-link flow (set a new password) and is driven by the URL, not a
// user toggle, so it keeps its own minimal entry.
//
//   login    — Email, Password, Login, Google, Forgot Password, Create Account, Back To Overview
//   signup   — Display Name, Email, Password, Create Account, Google, Back To Login, Back To Overview
//   forgot   — Email, Send Reset Link, Back To Login, Back To Overview
//   recovery — Password (new), Update Password, Back To Login, Back To Overview
const VIEWS = {
  login: {
    displayName: false,
    email: true,
    password: true,
    google: true,
    forgot: true,
    toggleMode: true,
    backToLogin: false,
    backToOverview: true,
    subtitle: "Sign in to your trading dashboard.",
    submit: "Login",
    passwordAutocomplete: "current-password",
  },
  signup: {
    displayName: true,
    email: true,
    password: true,
    google: true,
    forgot: false,
    toggleMode: false,
    backToLogin: true,
    backToOverview: true,
    subtitle: "Create your trading account.",
    submit: "Create Account",
    passwordAutocomplete: "new-password",
  },
  forgot: {
    displayName: false,
    email: true,
    password: false,
    google: false,
    forgot: false,
    toggleMode: false,
    backToLogin: true,
    backToOverview: true,
    subtitle: "Reset Your Password — enter your email address and we'll send you a reset link.",
    submit: "Send Reset Link",
    passwordAutocomplete: "current-password",
  },
  recovery: {
    displayName: false,
    email: false,
    password: true,
    google: false,
    forgot: false,
    toggleMode: false,
    backToLogin: true,
    backToOverview: true,
    subtitle: "Choose a new password.",
    submit: "Update Password",
    passwordAutocomplete: "new-password",
  },
};

// Applies an explicit, mutually-exclusive UI state. Visibility uses the native
// `hidden` attribute so no CSS is touched and no duplicate components linger.
function setMode(nextMode) {
  mode = nextMode;
  setError("");

  const view = VIEWS[mode] || VIEWS.login;

  // ---------- DISPLAY NAME ----------
  elements.displayNameField.style.display =
    view.displayName ? "" : "none";

  // ---------- EMAIL ----------
  emailField().style.display =
    view.email ? "" : "none";

  // ---------- PASSWORD ----------
  elements.passwordField.style.display =
    view.password ? "" : "none";

  // ---------- GOOGLE ----------
  elements.googleLogin.style.display =
    view.google ? "" : "none";

  // ---------- FORGOT PASSWORD ----------
  elements.forgotPassword.style.display =
    view.forgot ? "" : "none";

  // ---------- CREATE ACCOUNT ----------
  elements.toggleMode.style.display =
    view.toggleMode ? "" : "none";

  // ---------- BACK TO LOGIN ----------
  elements.backToLogin.style.display =
    view.backToLogin ? "" : "none";

  // ---------- BACK TO OVERVIEW ----------
  elements.backToOverview.style.display =
    view.backToOverview ? "" : "none";

  // ---------- TEXT ----------
  elements.authSubtitle.textContent = view.subtitle;

  elements.authSubmit.textContent = view.submit;

  elements.toggleMode.textContent = "Create an account";

  elements.loginPassword.setAttribute(
    "autocomplete",
    view.passwordAutocomplete
  );
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
    } else if (mode === "forgot") {
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

// "Forgot password?" switches into forgot-password mode (password hidden).
function handleForgotPassword() {
  setMode("forgot");
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
  setMode("signup");
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
