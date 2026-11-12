// Deterministic & Cryptographically Sealed Device Identity (Trusted PC / WebPhone Binding)
// Format: AIDA-DEV-XXXX-YYYY (e.g. AIDA-DEV-8F3A-91C4)

const STORAGE_KEY_SEAL = "aida_trusted_device_seal_v1";
const STORAGE_KEY_FULL = "aida_trusted_device_key_v1";
const COOKIE_NAME = "aida_trusted_device_seal_v1";
const IDB_NAME = "aida_device_security_db";
const IDB_STORE = "device_identity";

let cachedDeviceKey = "";

function fnv1aHex4(inputStr) {
  const str = String(inputStr || "aida-default-hw");
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  return (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function collectHardwareTraitsString() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "server-ssr";
  }
  try {
    // Check if Electron / Desktop Bridge provides native machine ID
    const desktopHw =
      window.aidaDesktop?.hardwareId ||
      window.electronAPI?.hardwareId ||
      "";
    if (desktopHw) {
      return `desktop:${desktopHw}`;
    }

    const ua = navigator.userAgent || "";
    let osFamily = "UnknownOS";
    if (/Windows/i.test(ua)) osFamily = "Windows";
    else if (/Macintosh|Mac OS X/i.test(ua)) osFamily = "macOS";
    else if (/CrOS/i.test(ua)) osFamily = "ChromeOS";
    else if (/Android/i.test(ua)) osFamily = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) osFamily = "iOS";
    else if (/Linux/i.test(ua)) osFamily = "Linux";

    const cores = navigator.hardwareConcurrency || 0;
    const mem = navigator.deviceMemory || 0;
    const maxTouch = navigator.maxTouchPoints || 0;
    const colorDepth = typeof screen !== "undefined" ? screen.colorDepth || 24 : 24;

    let gpuRenderer = "";
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        if (dbg) {
          gpuRenderer = String(
            gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || ""
          ).trim();
        }
      }
    } catch (_) {}

    return [osFamily, cores, mem, maxTouch, colorDepth, gpuRenderer].join("|");
  } catch (_) {
    return "browser-default";
  }
}

function readCookieSeal() {
  if (typeof document === "undefined") return "";
  try {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + COOKIE_NAME + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]).trim().toUpperCase() : "";
  } catch (_) {
    return "";
  }
}

function writeCookieSeal(seal) {
  if (typeof document === "undefined" || !seal) return;
  try {
    const maxAge = 60 * 60 * 24 * 365 * 10; // 10 years
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
      seal
    )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch (_) {}
}

function generateRandomHex4() {
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const arr = new Uint16Array(1);
      crypto.getRandomValues(arr);
      return arr[0].toString(16).toUpperCase().padStart(4, "0");
    }
  } catch (_) {}
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .toUpperCase()
    .slice(-4)
    .padStart(4, "0");
}

function syncSealWithIndexedDB(sealToSave) {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      } catch (_) {}
    };
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        const getReq = store.get("seal");
        getReq.onsuccess = () => {
          const existing = String(getReq.result || "")
            .trim()
            .toUpperCase();
          if (/^[0-9A-F]{4}$/.test(existing)) {
            if (existing !== sealToSave) {
              try {
                localStorage.setItem(STORAGE_KEY_SEAL, existing);
                writeCookieSeal(existing);
                const hwPart = fnv1aHex4(collectHardwareTraitsString());
                const restoredKey = `AIDA-DEV-${hwPart}-${existing}`;
                localStorage.setItem(STORAGE_KEY_FULL, restoredKey);
                cachedDeviceKey = restoredKey;
              } catch (_) {}
            }
          } else if (/^[0-9A-F]{4}$/.test(sealToSave)) {
            try {
              store.put(sealToSave, "seal");
            } catch (_) {}
          }
        };
      } catch (_) {}
    };
  } catch (_) {}
}

export function normalizeDeviceKey(rawKey) {
  const clean = String(rawKey || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!clean) return "";
  if (clean.startsWith("AIDA-DEV-")) return clean;
  // If user pasted 8 hex chars or XXXX-YYYY without prefix, normalize to AIDA-DEV-XXXX-YYYY
  const alnum = clean.replace(/[^A-Z0-9]/g, "");
  if (alnum.length === 8) {
    return `AIDA-DEV-${alnum.slice(0, 4)}-${alnum.slice(4, 8)}`;
  }
  return clean;
}

export function getDeviceKeySync() {
  if (typeof window === "undefined") return "";
  if (cachedDeviceKey && /^AIDA-DEV-[0-9A-F]{4}-[0-9A-F]{4}$/.test(cachedDeviceKey)) {
    return cachedDeviceKey;
  }

  try {
    const hwPart = fnv1aHex4(collectHardwareTraitsString());
    let seal = "";
    try {
      seal = String(localStorage.getItem(STORAGE_KEY_SEAL) || "")
        .trim()
        .toUpperCase();
    } catch (_) {}

    if (!/^[0-9A-F]{4}$/.test(seal)) {
      const cookieSeal = readCookieSeal();
      if (/^[0-9A-F]{4}$/.test(cookieSeal)) {
        seal = cookieSeal;
      }
    }

    if (!/^[0-9A-F]{4}$/.test(seal)) {
      const existingFull = String(localStorage.getItem(STORAGE_KEY_FULL) || "")
        .trim()
        .toUpperCase();
      const m = existingFull.match(/^AIDA-DEV-[0-9A-F]{4}-([0-9A-F]{4})$/);
      if (m) {
        seal = m[1];
      }
    }

    if (!/^[0-9A-F]{4}$/.test(seal)) {
      seal = generateRandomHex4();
    }

    const fullKey = `AIDA-DEV-${hwPart}-${seal}`;
    cachedDeviceKey = fullKey;
    try {
      localStorage.setItem(STORAGE_KEY_SEAL, seal);
      localStorage.setItem(STORAGE_KEY_FULL, fullKey);
    } catch (_) {}
    writeCookieSeal(seal);
    syncSealWithIndexedDB(seal);
    return fullKey;
  } catch (_) {
    return cachedDeviceKey || "AIDA-DEV-0000-0000";
  }
}

export function getClientBrowserAndOs() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { browser: "", os: "" };
  }
  const ua = navigator.userAgent || "";
  let osName = "";
  if (/Windows/i.test(ua)) osName = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) osName = "iOS";
  else if (/Macintosh|Mac OS X/i.test(ua)) osName = "macOS";
  else if (/Android/i.test(ua)) osName = "Android";
  else if (/CrOS/i.test(ua)) osName = "ChromeOS";
  else if (/Linux/i.test(ua)) osName = "Linux";

  let browserName = "";
  if (/AidaAgentDesktop|Electron\//i.test(ua)) browserName = "Masaüstü Uygulama";
  else if (/Edg\//i.test(ua)) browserName = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browserName = "Opera";
  else if (/Firefox\//i.test(ua)) browserName = "Firefox";
  else if (/Chrome\/|CriOS\//i.test(ua)) browserName = "Chrome";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browserName = "Safari";

  return { browser: browserName, os: osName };
}

export function extractUserDeviceSecurity(userObj) {
  if (!userObj || typeof userObj !== "object") {
    return { deviceLockEnabled: false, trustedDevices: [] };
  }
  let rawCpp = userObj.call_panel_prefs;
  if (typeof rawCpp === "string") {
    try {
      rawCpp = JSON.parse(rawCpp);
    } catch (_) {
      rawCpp = {};
    }
  }
  const secPol =
    rawCpp && typeof rawCpp === "object" && rawCpp.securityPolicy && typeof rawCpp.securityPolicy === "object"
      ? rawCpp.securityPolicy
      : {};

  const deviceLockEnabled = Boolean(
    userObj.device_lock_enabled !== undefined
      ? userObj.device_lock_enabled
      : secPol.device_lock_enabled ?? false
  );

  const rawList = Array.isArray(userObj.trusted_devices)
    ? userObj.trusted_devices
    : Array.isArray(secPol.trusted_devices)
      ? secPol.trusted_devices
      : [];

  const seen = new Set();
  const trustedDevices = [];
  rawList.forEach((item, idx) => {
    const rawK = typeof item === "string" ? item : item?.key || item?.device_key || "";
    const normK = normalizeDeviceKey(rawK);
    if (!normK || seen.has(normK)) return;
    seen.add(normK);
    trustedDevices.push({
      key: normK,
      label:
        (typeof item === "object" && (item?.label || item?.name)) ||
        `Güvenilir Cihaz ${idx + 1}`,
      browser: (typeof item === "object" && item?.browser) || "",
      os: (typeof item === "object" && item?.os) || "",
      ip_address: (typeof item === "object" && item?.ip_address) || "",
      added_at: (typeof item === "object" && item?.added_at) || ""
    });
  });

  return { deviceLockEnabled, trustedDevices };
}

export function verifyUserDeviceAccess(userObj, currentDeviceKey = "") {
  const dk = normalizeDeviceKey(currentDeviceKey || getDeviceKeySync());
  const { deviceLockEnabled, trustedDevices } = extractUserDeviceSecurity(userObj);
  if (!deviceLockEnabled) {
    return {
      allowed: true,
      deviceLockEnabled: false,
      deviceKey: dk,
      trustedDevices,
      matchedDevice: null
    };
  }
  const matched = trustedDevices.find((d) => normalizeDeviceKey(d.key) === dk) || null;
  return {
    allowed: Boolean(matched),
    deviceLockEnabled: true,
    deviceKey: dk,
    trustedDevices,
    matchedDevice: matched
  };
}
