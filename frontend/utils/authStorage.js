const REMEMBER_FLAG_KEY = "aida_remember_me";
const REMEMBER_USER_KEY = "aida_remembered_username";
const REMEMBER_SECRET_KEY = "aida_remembered_secret";
const CACHED_USER_PROFILE_KEY = "aida_cached_user_profile";
const AUTH_TOKEN_KEY = "nornia_auth_token";

export function setAuthToken(token, rememberMe = true) {
  if (typeof window === "undefined") return;
  try {
    if (!token) {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return;
    }
    sessionStorage.setItem(AUTH_TOKEN_KEY, String(token));
    if (rememberMe) {
      localStorage.setItem(AUTH_TOKEN_KEY, String(token));
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (e) {}
}

export function getAuthToken() {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch (e) {
    return "";
  }
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {}
}

export function setRememberMePreference(enabled) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMEMBER_FLAG_KEY, enabled ? "true" : "false");
    localStorage.removeItem(REMEMBER_SECRET_KEY);
    if (!enabled) {
      localStorage.removeItem(REMEMBER_USER_KEY);
    }
  } catch (e) {}
}

export function saveRememberedCredentials(username, _password, rememberMe) {
  if (typeof window === "undefined") return;
  try {
    // SEC-05: Never store plaintext/XOR-encoded passwords in localStorage; remember username only
    localStorage.removeItem(REMEMBER_SECRET_KEY);
    if (rememberMe) {
      const cleanUser = String(username || "").trim();
      localStorage.setItem(REMEMBER_FLAG_KEY, "true");
      if (cleanUser) {
        localStorage.setItem(REMEMBER_USER_KEY, cleanUser);
      }
    } else {
      localStorage.setItem(REMEMBER_FLAG_KEY, "false");
      localStorage.removeItem(REMEMBER_USER_KEY);
    }
  } catch (e) {}
}

export function updateRememberedPasswordIfSaved(_newPassword) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(REMEMBER_SECRET_KEY);
  } catch (e) {}
}

export function loadRememberedCredentials() {
  if (typeof window === "undefined") {
    return { rememberMe: true, username: "", password: "" };
  }
  try {
    localStorage.removeItem(REMEMBER_SECRET_KEY);
    const rawFlag = localStorage.getItem(REMEMBER_FLAG_KEY);
    const rememberMe = rawFlag === null ? true : rawFlag === "true";
    if (!rememberMe) {
      return { rememberMe: false, username: "", password: "" };
    }
    const username = localStorage.getItem(REMEMBER_USER_KEY) || "";
    return { rememberMe: true, username, password: "" };
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
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem("is_logged_in");
    sessionStorage.removeItem("current_user_id");
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {}
}
