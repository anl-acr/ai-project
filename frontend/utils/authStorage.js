const REMEMBER_FLAG_KEY = "aida_remember_me";
const REMEMBER_USER_KEY = "aida_remembered_username";
const REMEMBER_SECRET_KEY = "aida_remembered_secret";
const CACHED_USER_PROFILE_KEY = "aida_cached_user_profile";
const AUTH_TOKEN_KEY = "nornia_auth_token";
const PROVIDER_ROOT_KEY = "nornia_is_provider_root";

export function isProviderRootSession(userObj = null) {
  if (typeof window === "undefined") {
    return Boolean(userObj?.is_provider_root);
  }
  try {
    if (sessionStorage.getItem("is_nornia_root") === "true") return true;
    const storedFlag = sessionStorage.getItem(PROVIDER_ROOT_KEY) || localStorage.getItem(PROVIDER_ROOT_KEY);
    if (storedFlag === "true") return true;
    if (storedFlag === "false") return false;
    if (userObj && typeof userObj === "object") {
      if (typeof userObj.is_provider_root === "boolean") return userObj.is_provider_root;
      const role = String(userObj.role || "").trim().toLowerCase();
      const tid = String(userObj.tenant_id || "tenant-default").trim();
      return (role === "admin" || role === "superadmin") && (tid === "" || tid === "tenant-default" || tid === "default");
    }
    const activeTid = localStorage.getItem("active_tenant_id") || "tenant-default";
    const savedUid = sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id") || "";
    return savedUid === "admin" && (activeTid === "" || activeTid === "tenant-default" || activeTid === "default" || activeTid === "all");
  } catch (e) {
    return false;
  }
}

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

export function persistAuthenticatedSession(userId, rememberMe, userObj = null, isProviderRootOverride = null) {
  if (typeof window === "undefined") return;
  const uidStr = String(userId || "").trim();
  if (!uidStr) return;

  try {
    sessionStorage.setItem("is_logged_in", "true");
    sessionStorage.setItem("current_user_id", uidStr);

    const resolvedTenantId = String(userObj?.tenant_id || "tenant-default").trim() || "tenant-default";
    const roleLower = String(userObj?.role || "").trim().toLowerCase();
    const resolvedProviderRoot =
      typeof isProviderRootOverride === "boolean"
        ? isProviderRootOverride
        : typeof userObj?.is_provider_root === "boolean"
          ? userObj.is_provider_root
          : (roleLower === "admin" || roleLower === "superadmin") &&
            (resolvedTenantId === "tenant-default" || resolvedTenantId === "default");

    sessionStorage.setItem(PROVIDER_ROOT_KEY, resolvedProviderRoot ? "true" : "false");
    localStorage.setItem("active_tenant_id", resolvedTenantId);

    if (rememberMe) {
      localStorage.setItem("is_logged_in", "true");
      localStorage.setItem("current_user_id", uidStr);
      localStorage.setItem(PROVIDER_ROOT_KEY, resolvedProviderRoot ? "true" : "false");
      if (userObj && typeof userObj === "object") {
        const safeSnapshot = {
          id: userObj.id,
          full_name: userObj.full_name,
          username: userObj.username,
          email: userObj.email,
          extension: userObj.extension,
          role: userObj.role,
          tenant_id: resolvedTenantId,
          is_provider_root: resolvedProviderRoot,
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
      localStorage.removeItem(PROVIDER_ROOT_KEY);
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
    localStorage.removeItem(PROVIDER_ROOT_KEY);
    localStorage.removeItem("active_tenant_id");
    localStorage.removeItem("active_tenant_name");
    sessionStorage.removeItem("is_logged_in");
    sessionStorage.removeItem("current_user_id");
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(PROVIDER_ROOT_KEY);
    sessionStorage.removeItem("is_nornia_root");
  } catch (e) {}
}
