const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const APP_BRAND = {
  appName: "AIDA Agent",
  appId: "com.aida.agent.desktop",
  version: "2.9.3"
};

const DEFAULT_CONFIG = {
  serverHost: "",
  uiOrigin: "",
  apiOrigin: "",
  recentHosts: [],
  rememberMe: true,
  savedUsername: "",
  session: null, // { userId, username, fullName, extension, tenantId }
  osNotifications: true,
  popWindowOnCall: true,
  minimizeToTray: true,
  startOnBoot: false,
  trayHintShown: false,
  audioPrefs: {
    micLabel: "",
    speakerLabel: "",
    ringtoneSpeakerLabel: ""
  },
  windowBounds: {
    width: 1380,
    height: 860
  }
};

function getConfigFilePath() {
  const userDataDir = app.getPath("userData");
  return path.join(userDataDir, "aida-agent-config.json");
}

let _memConfig = null;

function loadAppConfig() {
  if (_memConfig) {
    return { ..._memConfig };
  }
  try {
    const file = getConfigFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      const parsed = JSON.parse(raw);
      _memConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        windowBounds: {
          ...DEFAULT_CONFIG.windowBounds,
          ...(parsed.windowBounds || {})
        },
        recentHosts: Array.isArray(parsed.recentHosts) ? parsed.recentHosts.slice(0, 8) : []
      };
      return { ..._memConfig };
    }
  } catch (err) {
    console.warn("[AIDA Config] Failed to read config, using defaults:", err.message);
  }
  _memConfig = { ...DEFAULT_CONFIG };
  return { ..._memConfig };
}

function saveAppConfig(patch = {}) {
  const current = loadAppConfig();
  const next = {
    ...current,
    ...patch
  };
  _memConfig = next;
  try {
    const file = getConfigFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf-8");
  } catch (err) {
    console.error("[AIDA Config] Failed to save config:", err.message);
  }
  return next;
}

module.exports = {
  APP_BRAND,
  DEFAULT_CONFIG,
  loadAppConfig,
  saveAppConfig
};
