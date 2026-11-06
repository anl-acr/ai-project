const REMEMBER_FLAG_KEY = "aida_remember_me";
const REMEMBER_USER_KEY = "aida_remembered_username";
const REMEMBER_SECRET_KEY = "aida_remembered_secret";
const CACHED_USER_PROFILE_KEY = "aida_cached_user_profile";
const OBFUSCATION_SALT = "AIDA_PBX_REMEMBER_V1";

function encodeRememberedSecret(plainText) {
  if (!plainText) return "";
  try {
    const utf8 = encodeURIComponent(String(plainText));
    let xored = "";
    for (let i = 0; i < utf8.length; i += 1) {
      const code = utf8.charCodeAt(i) ^ OBFUSCATION_SALT.charCodeAt(i % OBFUSCATION_SALT.length);
      xored += String.fromCharCode(code);
    }
    return typeof window !== "undefined" ? `v1:${window.btoa(xored)}` : "";
  } catch (e) {
    return "";
  }
}

function decodeRememberedSecret(encoded) {
  if (!encoded || typeof encoded !== "string") return "";
  try {
    const raw = encoded.startsWith("v1:") ? encoded.slice(3) : encoded;
    const xored = typeof window !== "undefined" ? window.atob(raw) : "";
    let utf8 = "";
    for (let i = 0; i < xored.length; i += 1) {
      const code = xored.charCodeAt(i) ^ OBFUSCATION_SALT.charCodeAt(i % OBFUSCATION_SALT.length);
      utf8 += String.fromCharCode(code);
    }
    return decodeURIComponent(utf8);
  } catch (e) {
    return "";
  }
}

export function setRememberMePreference(enabled) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMEMBER_FLAG_KEY, enabled ? "true" : "false");
    if (!enabled) {
      localStorage.removeItem(REMEMBER_USER_KEY);
      localStorage.removeItem(REMEMBER_SECRET_KEY);
    }
  } catch (e) {}
}

export function saveRememberedCredentials(username, password, rememberMe) {
  if (typeof window === "undefined") return;
  try {
    if (rememberMe) {
      const cleanUser = String(username || "").trim();
      localStorage.setItem(REMEMBER_FLAG_KEY, "true");
      if (cleanUser) {
        localStorage.setItem(REMEMBER_USER_KEY, cleanUser);
      }
      if (password !== undefined && password !== null && String(password).length > 0) {
        localStorage.setItem(REMEMBER_SECRET_KEY, encodeRememberedSecret(String(password)));
      }
    } else {
      localStorage.setItem(REMEMBER_FLAG_KEY, "false");
      localStorage.removeItem(REMEMBER_USER_KEY);
      localStorage.removeItem(REMEMBER_SECRET_KEY);
    }
  } catch (e) {}
}

export function updateRememberedPasswordIfSaved(newPassword) {
  if (typeof window === "undefined" || !newPassword) return;
  try {
    if (localStorage.getItem(REMEMBER_FLAG_KEY) === "true" && localStorage.getItem(REMEMBER_USER_KEY)) {
      localStorage.setItem(REMEMBER_SECRET_KEY, encodeRememberedSecret(String(newPassword)));
    }
  } catch (e) {}
}

export function loadRememberedCredentials() {
  if (typeof window === "undefined") {
    return { rememberMe: true, username: "", password: "" };
  }
  try {
    const rawFlag = localStorage.getItem(REMEMBER_FLAG_KEY);
    const rememberMe = rawFlag === null ? true : rawFlag === "true";
    if (!rememberMe) {
      return { rememberMe: false, username: "", password: "" };
    }
    const username = localStorage.getItem(REMEMBER_USER_KEY) || "";
    const password = decodeRememberedSecret(localStorage.getItem(REMEMBER_SECRET_KEY) || "");
    return { rememberMe: true, username, password };
  } catch (e) {
    return { rememberMe: true, username: "", password: "" };
  }
}

export function persistAuthenticatedSession(userId, rememberMe, userObj = null) {
  if (typeof window === "undefined") return;
  const uidStr = String(userId || "").trim();
  if (!uidStr) return;

  try {
    sessionStorage.setItem("is_logged_in", "true");
    sessionStorage.setItem("current_user_id", uidStr);

    if (rememberMe) {
      localStorage.setItem("is_logged_in", "true");
      localStorage.setItem("current_user_id", uidStr);
      if (userObj && typeof userObj === "object") {
        const safeSnapshot = {
          id: userObj.id,
          full_name: userObj.full_name,
          username: userObj.username,
          email: userObj.email,
          extension: userObj.extension,
          role: userObj.role,
          tenant_id: userObj.tenant_id,
          avatar: userObj.avatar,
          theme_color: userObj.theme_color,
          theme_mode: userObj.theme_mode,
          active_profile: userObj.active_profile,
          profiles: userObj.profiles,
          call_panel_prefs: userObj.call_panel_prefs
        };
        localStorage.setItem(CACHED_USER_PROFILE_KEY, JSON.stringify(safeSnapshot));
      }
    } else {
      localStorage.removeItem("is_logged_in");
      localStorage.removeItem("current_user_id");
      localStorage.removeItem(CACHED_USER_PROFILE_KEY);
    }
  } catch (e) {}
}

export function loadCachedUserProfile(expectedUserId) {
  if (typeof window === "undefined" || !expectedUserId) return null;
  try {
    const raw = localStorage.getItem(CACHED_USER_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const exp = String(expectedUserId);
    if (
      String(parsed.id) === exp ||
      String(parsed.extension) === exp ||
      parsed.username === exp ||
      parsed.email === exp ||
      (exp === "admin" && parsed.role === "admin")
    ) {
      return parsed;
    }
  } catch (e) {}
  return null;
}

export function clearAuthenticatedSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("is_logged_in");
    localStorage.removeItem("current_user_id");
    localStorage.removeItem(CACHED_USER_PROFILE_KEY);
    localStorage.removeItem("agent_avatar");
    sessionStorage.removeItem("is_logged_in");
    sessionStorage.removeItem("current_user_id");
  } catch (e) {}
}
