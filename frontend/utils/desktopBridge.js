// Unified Desktop Bridge (Electron macOS/Windows <-> Next.js Web Workspace)

export function isDesktopApp() {
  if (typeof window === "undefined") return false;
  if (window.aidaDesktop && window.aidaDesktop.isDesktop === true) {
    return true;
  }
  try {
    if (sessionStorage.getItem("aida_desktop_mode") === "1") {
      return true;
    }
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("desktop") === "1") {
      sessionStorage.setItem("aida_desktop_mode", "1");
      return true;
    }
  } catch (e) {}
  return false;
}

export function isNativeElectron() {
  return typeof window !== "undefined" && Boolean(window.aidaDesktop && window.aidaDesktop.isDesktop === true);
}

let _cachedElectronConfig = null;
let _lastTraySignature = "";

export function getDesktopPrefs() {
  if (typeof window === "undefined") {
    return {
      osNotifications: true,
      popWindowOnCall: true,
      minimizeToTray: true,
      startOnBoot: false,
      serverHost: "",
      appName: "AIDA Agent",
      platform: "web"
    };
  }

  let osNotifications = true;
  let popWindowOnCall = true;
  try {
    const savedNotif = localStorage.getItem("aida_os_notifications");
    if (savedNotif !== null) osNotifications = savedNotif !== "false";
    const savedPop = localStorage.getItem("aida_pop_on_call");
    if (savedPop !== null) popWindowOnCall = savedPop !== "false";
  } catch (e) {}

  if (isNativeElectron() && typeof window.aidaDesktop.getConfigSync === "function") {
    try {
      if (!_cachedElectronConfig) {
        _cachedElectronConfig = window.aidaDesktop.getConfigSync() || {};
      }
      const cfg = _cachedElectronConfig;
      return {
        osNotifications: cfg.osNotifications !== undefined ? Boolean(cfg.osNotifications) : osNotifications,
        popWindowOnCall: cfg.popWindowOnCall !== undefined ? Boolean(cfg.popWindowOnCall) : popWindowOnCall,
        minimizeToTray: cfg.minimizeToTray !== undefined ? Boolean(cfg.minimizeToTray) : true,
        startOnBoot: Boolean(cfg.startOnBoot),
        serverHost: cfg.serverHost || window.location.host || "",
        appName: cfg.appName || "AIDA Agent",
        platform: cfg.platform || "desktop"
      };
    } catch (e) {}
  }

  return {
    osNotifications,
    popWindowOnCall,
    minimizeToTray: true,
    startOnBoot: false,
    serverHost: window.location.host || "",
    appName: "AIDA Agent",
    platform: "web"
  };
}

export async function updateDesktopPrefs(patch = {}) {
  if (typeof window === "undefined") return getDesktopPrefs();
  try {
    if (patch.osNotifications !== undefined) {
      localStorage.setItem("aida_os_notifications", patch.osNotifications ? "true" : "false");
    }
    if (patch.popWindowOnCall !== undefined) {
      localStorage.setItem("aida_pop_on_call", patch.popWindowOnCall ? "true" : "false");
    }
  } catch (e) {}

  if (_cachedElectronConfig && patch && typeof patch === "object") {
    _cachedElectronConfig = { ..._cachedElectronConfig, ...patch };
  }

  if (isNativeElectron() && typeof window.aidaDesktop.updatePreferences === "function") {
    try {
      const updated = await window.aidaDesktop.updatePreferences(patch);
      if (updated && typeof updated === "object") {
        _cachedElectronConfig = { ...(_cachedElectronConfig || {}), ...updated };
      }
    } catch (e) {
      console.warn("[DesktopBridge] updatePreferences error:", e);
    }
  }
  return getDesktopPrefs();
}

/**
 * Dispatches an OS-level notification (via Electron native Notification on macOS/Windows,
 * or standard Web Notification API in browsers).
 * Returns a handle with `.close()` when applicable.
 */
export function sendDesktopNotification({
  title,
  body = "",
  tag = "",
  urgent = false,
  focusOnClick = true,
  popWindow = false,
  actionEvent = "",
  actionDetail = null,
  forceEvenIfDisabled = false
} = {}) {
  if (typeof window === "undefined" || !title) return null;

  const prefs = getDesktopPrefs();
  if (!forceEvenIfDisabled && !prefs.osNotifications) {
    // Still pop window on urgent incoming call if popWindowOnCall is enabled
    if (popWindow && prefs.popWindowOnCall && isNativeElectron() && typeof window.aidaDesktop.focusWindow === "function") {
      window.aidaDesktop.focusWindow({ urgent: true });
    }
    return null;
  }

  // 1. Native Electron OS Notification + Window Pop / Taskbar Flash / Dock Bounce
  if (isNativeElectron() && typeof window.aidaDesktop.notify === "function") {
    try {
      const notifId = tag || `aida-notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      window.aidaDesktop.notify({
        id: notifId,
        title,
        body,
        urgent: Boolean(urgent),
        popWindow: Boolean(popWindow && prefs.popWindowOnCall),
        focusOnClick: Boolean(focusOnClick),
        actionEvent: actionEvent || "",
        actionDetail: actionDetail || null
      });
      return {
        close: () => {
          try {
            if (typeof window.aidaDesktop.closeNotification === "function") {
              window.aidaDesktop.closeNotification(notifId);
            }
          } catch (e) {}
        }
      };
    } catch (e) {
      console.warn("[DesktopBridge] Electron native notify failed, falling back to Web Notification:", e);
    }
  }

  // 2. Standard Web Browser Notification Fallback
  if (!("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;

  try {
    const notif = new Notification(title, {
      body,
      tag: tag || `aida-web-${Date.now()}`,
      requireInteraction: Boolean(urgent),
      silent: false
    });
    notif.onclick = () => {
      try {
        if (focusOnClick) window.focus();
        if (actionEvent) {
          window.dispatchEvent(new CustomEvent(actionEvent, { detail: actionDetail }));
        }
        notif.close();
      } catch (e) {}
    };
    return notif;
  } catch (e) {
    return null;
  }
}

export function syncDesktopTrayState(payload = {}) {
  if (!isNativeElectron() || typeof window.aidaDesktop.updateTrayState !== "function") return;
  try {
    const sig = `${payload.fullName || ""}|${payload.extension || ""}|${payload.profileId || ""}|${payload.profileLabel || ""}|${Boolean(payload.registered)}|${payload.callStatus || "Idle"}`;
    if (sig === _lastTraySignature) return;
    _lastTraySignature = sig;
    window.aidaDesktop.updateTrayState(payload);
  } catch (e) {}
}

export async function disconnectDesktopServer() {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("aida_desktop_mode");
    } catch (e) {}
  }
  if (isNativeElectron() && typeof window.aidaDesktop.disconnectServer === "function") {
    await window.aidaDesktop.disconnectServer();
    return true;
  }
  return false;
}
