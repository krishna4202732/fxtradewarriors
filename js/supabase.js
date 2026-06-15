// =============================================================================
// Supabase client initialization
// =============================================================================
//
// This file ONLY prepares the Supabase client. It does NOT replace localStorage,
// it does NOT touch authentication, and it does NOT remove the hardcoded users.
// Those migrations happen later. For now this simply gives the rest of the app a
// ready-to-use client once you paste your project credentials below.
//
// -----------------------------------------------------------------------------
// 👉 PASTE YOUR CREDENTIALS HERE
// -----------------------------------------------------------------------------
// 1. Open your Supabase project dashboard.
// 2. Go to: Project Settings → API.
// 3. Copy "Project URL" into SUPABASE_URL.
// 4. Copy the "anon / public" key into SUPABASE_ANON_KEY.
//
// The anon key is safe to expose in a public frontend — access is still
// protected by the Row Level Security policies defined in sql/rls_policies.sql.
// -----------------------------------------------------------------------------

const SUPABASE_URL = "https://chcwbklncfrwghjvlyfb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoY3dia2xuY2Zyd2doanZseWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MDM5MTAsImV4cCI6MjA5NzA3OTkxMH0.2ZKsEC4-IkB39Y6PLAIpdnInJN68OTdhWcW3Fk_-qkQ";

// -----------------------------------------------------------------------------
// The Supabase JS SDK is loaded from its official ESM CDN so it works in this
// no-build / no-Node project, exactly like jsPDF is loaded in journal.html.
// -----------------------------------------------------------------------------
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/**
 * True only when both credentials have been filled in above. Helper functions in
 * database.js use this so calling the API before configuring Supabase fails with
 * a clear message instead of a cryptic network error.
 */
export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);
}

/**
 * The shared Supabase client for the whole app. It is `null` until credentials
 * are provided, so existing localStorage-based code is never affected.
 */
export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Returns the configured client or throws a descriptive error. Internal helper
 * used by database.js to avoid repeating the same guard everywhere.
 */
export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured yet. Paste SUPABASE_URL and SUPABASE_ANON_KEY in js/supabase.js.",
    );
  }

  return supabase;
}

// Database table names kept in one place so callers never hardcode strings.
export const TABLES = {
  PROFILES: "profiles",
  TRADING_ACCOUNTS: "trading_accounts",
  JOURNAL_ENTRIES: "journal_entries",
  CALCULATOR_HISTORY: "calculator_history",
};
