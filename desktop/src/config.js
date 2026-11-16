const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const APP_BRAND = {
  appName: "Runa",
  appId: "com.runa.agent.desktop",
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
  return path.join(userDataDir, "runa-config.json");
}

function getLegacyConfigPaths() {
  const userDataDir = app.getPath("userData");
  const parentDir = path.dirname(userDataDir);
  return [
    path.join(userDataDir, "aida-agent-config.json"),
    path.join(parentDir, "AIDA Agent", "aida-agent-config.json"),
    path.join(parentDir, "aida-agent-desktop", "aida-agent-config.json")
  ];
}

let _memConfig = null;

function loadAppConfig() {
  if (_memConfig) {
    return { ..._memConfig };
  }
  try {
    let file = getConfigFilePath();
    if (!fs.existsSync(file)) {
      for (const leg of getLegacyConfigPaths()) {
        if (fs.existsSync(leg)) {
          file = leg;
          break;
        }
      }
    }
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      const parsed = JSON.parse(raw);
      let trueOriginHost = "";
      try {
        if (parsed.uiOrigin) {
          trueOriginHost = new URL(parsed.uiOrigin).host;
        }
      } catch (e) {}
      const normHost = (h) => {
        const s = String(h || "").trim();
        if (s.toLowerCase() === "runa.saphira.com.tr") {
          return trueOriginHost || "aida.saphira.com.tr";
        }
        return s;
      };
      _memConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        serverHost: normHost(parsed.serverHost || trueOriginHost),
        windowBounds: {
          ...DEFAULT_CONFIG.windowBounds,
          ...(parsed.windowBounds || {})
        },
        recentHosts: Array.isArray(parsed.recentHosts)
          ? Array.from(new Set(parsed.recentHosts.map(normHost).filter(Boolean))).slice(0, 8)
          : []
      };
      return { ..._memConfig };
    }
  } catch (err) {
    console.warn("[RUNA Config] Failed to read config, using defaults:", err.message);
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
    console.error("[RUNA Config] Failed to save config:", err.message);
  }
  return next;
}

module.exports = {
  APP_BRAND,
  DEFAULT_CONFIG,
  loadAppConfig,
  saveAppConfig
};
