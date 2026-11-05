const { contextBridge, ipcRenderer } = require("electron");

// Synchronously retrieve active desktop session & preferences before web page scripts execute
let bootState = null;
try {
  bootState = ipcRenderer.sendSync("aida:get-boot-state-sync");
} catch (e) {
  bootState = null;
}

// Automatically hydrate authenticated session into the PBX workspace origin before Next.js mounts
if (bootState && bootState.session && bootState.uiOrigin && typeof window !== "undefined") {
  try {
    const currentOrigin = window.location.origin;
    if (currentOrigin && currentOrigin === bootState.uiOrigin) {
      sessionStorage.setItem("aida_desktop_mode", "1");
      sessionStorage.setItem("is_logged_in", "true");
      sessionStorage.setItem("current_user_id", String(bootState.session.userId));
      if (bootState.justLoggedIn) {
        sessionStorage.setItem("aida_just_logged_in", "1");
      }
      if (bootState.rememberMe) {
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("current_user_id", String(bootState.session.userId));
      }
      if (bootState.session.tenantId) {
        localStorage.setItem("active_tenant_id", String(bootState.session.tenantId));
      }
      if (bootState.audioPrefs) {
        if (bootState.audioPrefs.micLabel && !localStorage.getItem("selected_mic_label")) {
          localStorage.setItem("selected_mic_label", bootState.audioPrefs.micLabel);
        }
        if (bootState.audioPrefs.speakerLabel && !localStorage.getItem("selected_speaker_label")) {
          localStorage.setItem("selected_speaker_label", bootState.audioPrefs.speakerLabel);
        }
        if (bootState.audioPrefs.ringtoneSpeakerLabel && !localStorage.getItem("selected_ringtone_speaker_label")) {
          localStorage.setItem("selected_ringtone_speaker_label", bootState.audioPrefs.ringtoneSpeakerLabel);
        }
      }
    }
  } catch (e) {}
}

// Forward Main-process commands (from OS Notifications & System Tray) to the web workspace as CustomEvents
ipcRenderer.on("aida:dispatch-window-event", (_event, payload) => {
  if (!payload || !payload.name || typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(payload.name, { detail: payload.detail || null }));
  } catch (e) {}
});

contextBridge.exposeInMainWorld("aidaDesktop", {
  isDesktop: true,
  platform: process.platform,
  appName: (bootState && bootState.appName) || "AIDA Agent",
  version: (bootState && bootState.version) || "2.9.3",

  getConfigSync: () => {
    try {
      return ipcRenderer.sendSync("aida:get-boot-state-sync");
    } catch (e) {
      return bootState || {};
    }
  },

  probeHost: (rawHost) => ipcRenderer.invoke("aida:probe-host", rawHost),
  login: (payload) => ipcRenderer.invoke("aida:login", payload),
  send2faCode: (payload) => ipcRenderer.invoke("aida:send-2fa", payload),
  verify2faCode: (payload) => ipcRenderer.invoke("aida:verify-2fa", payload),
  removeRecentHost: (hostStr) => ipcRenderer.invoke("aida:remove-recent-host", hostStr),

  reconnectWorkspace: () => ipcRenderer.invoke("aida:reconnect-workspace"),
  disconnectServer: () => ipcRenderer.invoke("aida:disconnect-server"),

  updatePreferences: (patch) => ipcRenderer.invoke("aida:update-preferences", patch),

  notify: (payload) => ipcRenderer.send("aida:notify", payload),
  closeNotification: (notifId) => ipcRenderer.send("aida:close-notification", notifId),
  focusWindow: (opts) => ipcRenderer.send("aida:focus-window", opts || {}),
  updateTrayState: (trayState) => ipcRenderer.send("aida:update-tray-state", trayState || {})
});
