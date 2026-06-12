export const CURRENT_USER_STORAGE_KEY = "fx.currentUser";

export const USERS = {
  sumitfraudiya: {
    username: "sumitfraudiya",
    password: "krishnaismydaddy",
    displayName: "Sumit",
  },
  krishnasher: {
    username: "krishnasher",
    password: "topoftheworld",
    displayName: "Krishna",
  },
};

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

export function getUser(username) {
  return USERS[normalizeUsername(username)] || null;
}

export function getStoredUser() {
  const username = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  const user = getUser(username);

  if (!user && username) {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  }

  return user;
}

export function authenticateUser(username, password) {
  const user = getUser(username);

  if (!user || user.password !== String(password || "")) {
    return null;
  }

  localStorage.setItem(CURRENT_USER_STORAGE_KEY, user.username);
  return user;
}

export function logoutUser() {
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}
