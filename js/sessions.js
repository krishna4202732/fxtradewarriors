// Trading-session engine. All session windows are expressed in IST (Asia/Kolkata),
// which has no daylight saving, so a fixed minutes-from-midnight model is exact.

export const IST_TIMEZONE = "Asia/Kolkata";

const MINUTES_PER_DAY = 24 * 60;

// Session windows in IST minutes-from-midnight.
// New York wraps past midnight (17:30 IST -> 02:30 IST next day).
export const SESSIONS = {
  asian: { key: "asian", label: "Asian", short: "Asian", start: 5 * 60 + 30, end: 14 * 60 + 30 },
  london: { key: "london", label: "London", short: "London", start: 12 * 60 + 30, end: 21 * 60 + 30 },
  newyork: { key: "newyork", label: "New York", short: "New York", start: 17 * 60 + 30, end: 2 * 60 + 30 },
};

// Priority order used when listing active sessions (drives overlap naming).
const SESSION_ORDER = ["asian", "london", "newyork"];

function isWithinWindow(minutes, session) {
  if (!Number.isFinite(minutes)) {
    return false;
  }

  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  if (session.start < session.end) {
    return normalized >= session.start && normalized < session.end;
  }

  // Wrapping window (e.g. New York): active from start to midnight, then midnight to end.
  return normalized >= session.start || normalized < session.end;
}

export function getActiveSessionKeys(minutes) {
  return SESSION_ORDER.filter((key) => isWithinWindow(minutes, SESSIONS[key]));
}

// Returns { key, label, sessions } describing the session(s) active at the given
// minutes-from-midnight (IST). Overlaps collapse into a combined label.
export function describeSessionFromMinutes(minutes) {
  if (!Number.isFinite(minutes)) {
    return null;
  }

  const activeKeys = getActiveSessionKeys(minutes);

  if (activeKeys.length === 0) {
    return { key: "none", label: "No Active Session", sessions: [] };
  }

  if (activeKeys.length === 1) {
    const session = SESSIONS[activeKeys[0]];
    return { key: session.key, label: session.label, sessions: activeKeys };
  }

  const label = `${activeKeys.map((key) => SESSIONS[key].short).join(" + ")} Overlap`;
  return { key: "overlap", label, sessions: activeKeys };
}

// Extracts minutes-from-midnight from a "YYYY-MM-DDTHH:MM" datetime-local string.
// The value is treated as IST wall-clock time.
export function minutesFromDateTimeLocal(value) {
  const match = /T(\d{2}):(\d{2})/.exec(String(value || ""));

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function describeSessionForDateTimeLocal(value) {
  const minutes = minutesFromDateTimeLocal(value);
  return minutes === null ? null : describeSessionFromMinutes(minutes);
}

// --- Live IST helpers (use the real current time, converted to IST) -------------

function getIstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const lookup = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    hour: lookup("hour") % 24,
    minute: lookup("minute"),
    second: lookup("second"),
  };
}

export function getIstMinutes(date = new Date()) {
  const { hour, minute } = getIstParts(date);
  return hour * 60 + minute;
}

// 12-hour formatted IST clock, e.g. "09:15:42 PM".
export function formatIstClock(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

export function describeCurrentSession(date = new Date()) {
  return describeSessionFromMinutes(getIstMinutes(date));
}

// --- Duration -------------------------------------------------------------------

export function tradeDurationMinutes(entryValue, exitValue) {
  const entryMs = Date.parse(entryValue);
  const exitMs = Date.parse(exitValue);

  if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) {
    return null;
  }

  return Math.round((exitMs - entryMs) / 60000);
}

export function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) {
    return "--";
  }

  if (minutes === 0) {
    return "0m";
  }

  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / 60);
  const mins = minutes % 60;
  const parts = [];

  if (days) {
    parts.push(`${days}d`);
  }

  if (hours) {
    parts.push(`${hours}h`);
  }

  if (mins || parts.length === 0) {
    parts.push(`${mins}m`);
  }

  return parts.join(" ");
}
