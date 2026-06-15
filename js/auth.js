// =============================================================================
// Authentication — now backed by Supabase Auth.
// =============================================================================
//
// The hardcoded user list has been removed. Sessions are managed by Supabase and
// persisted by its SDK (localStorage), so a refresh keeps the user logged in just
// like before. The rest of the app still receives a plain user object via
// getStoredUser(), so the data layer (journal.js / history.js) is unchanged.
//
// IMPORTANT: session resolution is now ASYNC. Every exported reader returns a
// Promise. Callers (router.js, login.js) await it.
// =============================================================================

import { getSupabaseClient } from "./supabase.js";

// Where Supabase should send the user back to after Google OAuth or an email
// confirmation / password-recovery link. Absolute URL to the login page in the
// same folder as the current page (works on GitHub Pages and locally).
function authRedirectUrl() {
  return new URL("login.html", window.location.href).href;
}

// Normalizes a Supabase user into the shape the rest of the app expects.
//  - username : the STABLE per-user storage scope used by journal.js/history.js
//               (`fx.user.<username>.*`). We use the immutable user id so each
//               account's data stays isolated and never collides.
//  - displayName : a friendly name for the dashboard greeting / exports.
function mapUser(user) {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata || {};
  const emailHandle = user.email ? user.email.split("@")[0] : "";
  const displayName =
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    emailHandle ||
    "Trader";

  return {
    id: user.id,
    email: user.email || "",
    username: user.id,
    displayName,
  };
}

// Best-effort: keep a row in `profiles` for the signed-in user. Wrapped so it can
// never break the auth flow — RLS guarantees a user can only write their own row.
async function ensureProfile(user) {
  if (!user) {
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const mapped = mapUser(user);

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        username: mapped.email || user.id,
        display_name: mapped.displayName,
      },
      { onConflict: "id" },
    );
  } catch (error) {
    // Non-fatal: a missing profile row never blocks login.
    console.warn("Could not sync profile:", error.message);
  }
}

// Returns the currently authenticated user (mapped) or null. Async: reads the
// persisted Supabase session. Used by the router guards on every page.
export async function getStoredUser() {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session ? mapUser(session.user) : null;
}

// Email + password sign-in. Returns the mapped user.
// Throws with Supabase's message on failure (e.g. wrong password, unconfirmed
// email) so the caller can surface it.
export async function signInWithEmail(email, password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || "").trim(),
    password: String(password || ""),
  });

  if (error) {
    throw new Error(error.message);
  }

  await ensureProfile(data.user);
  return mapUser(data.user);
}

// Email + password sign-up. When the project has email confirmation enabled,
// Supabase returns a user but NO session until the link is clicked, so we report
// `needsVerification` to the caller instead of a logged-in user.
export async function signUp(email, password, displayName) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(email || "").trim(),
    password: String(password || ""),
    options: {
      emailRedirectTo: authRedirectUrl(),
      data: {
        display_name: String(displayName || "").trim(),
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  // Session present → confirmation disabled, user is already logged in.
  if (data.session) {
    await ensureProfile(data.user);
    return { user: mapUser(data.user), needsVerification: false };
  }

  return { user: mapUser(data.user), needsVerification: true };
}

// Google OAuth. Redirects the browser to Google and back to the login page,
// where the session is picked up automatically (detectSessionInUrl).
export async function signInWithGoogle() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authRedirectUrl() },
  });

  if (error) {
    throw new Error(error.message);
  }
}

// Sends a password-reset email. The link returns the user to the login page in
// recovery mode (see login.js), where they set a new password.
export async function sendPasswordReset(email) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    String(email || "").trim(),
    { redirectTo: authRedirectUrl() },
  );

  if (error) {
    throw new Error(error.message);
  }
}

// Sets a new password for the user currently in a recovery session.
export async function updatePassword(newPassword) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    password: String(newPassword || ""),
  });

  if (error) {
    throw new Error(error.message);
  }
}

// Clears the Supabase session. Replaces the old localStorage logout.
export async function signOut() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}

// Subscribe to auth state changes (used by login.js to catch PASSWORD_RECOVERY).
// Returns the subscription so callers can unsubscribe if needed.
export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session ? mapUser(session.user) : null);
  });

  return subscription;
}
