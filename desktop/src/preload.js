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

function rebrandTextValueToRuna(str) {
  if (!str || typeof str !== "string") return str;
  if (!/aida|aİda|aıda|runa/i.test(str)) return str;
  return str
    .replace(/AIDA\s+Agent/gi, "Runa")
    .replace(/AIDA\s+Mobile/gi, "Runa")
    .replace(/RUNA\s+Agent/gi, "Runa")
    .replace(/RUNA\s+Mobile/gi, "Runa")
    .replace(/AIDA-Mobile-iOS/gi, "Runa-Mobile-iOS")
    .replace(/RUNA-Mobile-iOS/gi, "Runa-Mobile-iOS")
    .replace(/AIDA\s+PBX/gi, "Runa PBX")
    .replace(/RUNA\s+PBX/gi, "Runa PBX")
    .replace(/AİDA/g, "Runa")
    .replace(/AIDA/g, "Runa")
    .replace(/RUNA/g, "Runa")
    .replace(/Aida/g, "Runa")
    .replace(/@aida\.local/gi, "@runa.local")
    .replace(/aida-backend/gi, "runa-backend")
    .replace(/aida-agent:\/\//gi, "runa://")
    .replace(/aida-mobile:\/\//gi, "runa-mobile://")
    .replace(/aida\.saphira\.com\.tr/gi, "runa.saphira.com.tr")
    .replace(/\baida\b/gi, "Runa");
}

function rebrandDomToRuna() {
  try {
    if (typeof document === "undefined") return;
    if (document.title && /aida|aİda|runa/i.test(document.title)) {
      document.title = rebrandTextValueToRuna(document.title);
    }
    if (!document.body) return;

    const topbarLogoBox = document.querySelector("header.aida-app-topbar > div:first-child > div:first-child > div:first-child");
    if (topbarLogoBox && topbarLogoBox.getAttribute("data-runa-logo-applied") !== "1") {
      topbarLogoBox.setAttribute("data-runa-logo-applied", "1");
      topbarLogoBox.className = "h-8 w-8 shrink-0 rounded-xl flex items-center justify-center overflow-hidden shadow-sm bg-white dark:bg-slate-900";
      topbarLogoBox.innerHTML = `<svg viewBox="0 0 1024 1024" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="rOuterClip"><rect x="78" y="78" width="868" height="868" rx="176"/></clipPath><linearGradient id="rTL" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#0EA5E9"/><stop offset="100%" stop-color="#4F46E5"/></linearGradient><linearGradient id="rTR" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7C3AED"/><stop offset="100%" stop-color="#DB2777"/></linearGradient><linearGradient id="rBR" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F43F5E"/><stop offset="100%" stop-color="#FF7319"/></linearGradient><linearGradient id="rBL" x1="1" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#F59E0B"/><stop offset="100%" stop-color="#10B981"/></linearGradient><linearGradient id="rB1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F43F5E"/><stop offset="100%" stop-color="#FB923C"/></linearGradient><linearGradient id="rB2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0EA5E9"/><stop offset="100%" stop-color="#10B981"/></linearGradient><linearGradient id="rRG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1E1B4B"/><stop offset="100%" stop-color="#4338CA"/></linearGradient></defs><rect width="1024" height="1024" rx="220" fill="#F8FAFD"/><g clip-path="url(#rOuterClip)"><polygon points="0,634 240,449 525,512 455,0 0,0" fill="url(#rTL)"/><polygon points="455,0 1024,0 1024,439 780,379 525,512" fill="url(#rTR)"/><polygon points="1024,439 1024,1024 595,1024 525,512 780,379" fill="url(#rBR)"/><polygon points="595,1024 0,1024 0,634 240,449 525,512" fill="url(#rBL)"/><rect x="162" y="162" width="700" height="700" rx="108" fill="#F8FAFD"/><polygon points="50,659 200,529 200,476 50,606" fill="#F8FAFD"/><polygon points="825,390 975,428 975,474 825,436" fill="#F8FAFD"/></g><rect x="248" y="350" width="58" height="324" rx="29" fill="url(#rB1)"/><rect x="330" y="266" width="58" height="492" rx="29" fill="url(#rB2)"/><path d="M 454 714 L 454 314 L 592 314 C 660 314 710 362 710 426 C 710 490 660 538 592 538 L 535 538 L 712 718" fill="none" stroke="url(#rRG)" stroke-width="88" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    document.querySelectorAll("span").forEach((sp) => {
      if (sp.children.length === 0) {
        const t = (sp.textContent || "").trim();
        if (t === "AI" || t === "Aİ" || t === "RU" || t === "Runa" || t === "RUNA" || t === "Nornia") {
          const next = sp.nextSibling;
          if (t === "Runa" || t === "RUNA" || t === "Nornia") {
            sp.textContent = "Runa";
            sp.setAttribute("data-runa-brand", "1");
            sp.classList.remove("text-rose-600", "text-rose-500", "dark:text-rose-500", "drop-shadow-sm");
            sp.style.backgroundImage = "linear-gradient(90deg, #16A34A 0%, #0284C7 28%, #7C3AED 58%, #DB2777 80%, #EA580C 100%)";
            sp.style.webkitBackgroundClip = "text";
            sp.style.backgroundClip = "text";
            sp.style.webkitTextFillColor = "transparent";
            sp.style.color = "transparent";
          } else if (next && next.nodeType === 3 && /^\s*(DA|NA)\b/i.test(next.nodeValue || "")) {
            sp.textContent = "Runa";
            sp.setAttribute("data-runa-brand", "1");
            sp.classList.remove("text-rose-600", "text-rose-500", "dark:text-rose-500", "drop-shadow-sm");
            sp.style.backgroundImage = "linear-gradient(90deg, #16A34A 0%, #0284C7 28%, #7C3AED 58%, #DB2777 80%, #EA580C 100%)";
            sp.style.webkitBackgroundClip = "text";
            sp.style.backgroundClip = "text";
            sp.style.webkitTextFillColor = "transparent";
            sp.style.color = "transparent";
            next.nodeValue = (next.nodeValue || "").replace(/^\s*(DA|NA)(\s+(Agent|Mobile))?/i, "");
            let sib = next.nextSibling;
            while (sib && sib.nodeType === 3) {
              const curSib = sib;
              sib = sib.nextSibling;
              if (/^\s*(Agent|Mobile)\s*$/i.test(curSib.nodeValue || "")) {
                curSib.nodeValue = "";
              }
            }
          }
        }
      }
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parentTag = node.parentElement ? node.parentElement.tagName : "";
      if (parentTag === "SCRIPT" || parentTag === "STYLE" || parentTag === "NOSCRIPT") continue;
      const val = node.nodeValue;
      if (val && /aida|aİda|aıda|RUNA/.test(val)) {
        const nextVal = rebrandTextValueToRuna(val);
        if (nextVal !== val) {
          node.nodeValue = nextVal;
        }
      }
    }

    document.querySelectorAll("[title],[placeholder],[aria-label],[alt],[download]").forEach((el) => {
      ["title", "placeholder", "aria-label", "alt", "download"].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v && /aida|aİda|aıda|RUNA/.test(v)) {
          const nv = rebrandTextValueToRuna(v);
          if (nv !== v) el.setAttribute(attr, nv);
        }
      });
    });
  } catch (e) {}
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    rebrandDomToRuna();
    try {
      const obs = new MutationObserver(() => rebrandDomToRuna());
      obs.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    } catch (e) {}
  });
}

contextBridge.exposeInMainWorld("aidaDesktop", {
  isDesktop: true,
  platform: process.platform,
  appName: (bootState && bootState.appName) || "Runa",
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
  loginWithUrl: (payload) => ipcRenderer.invoke("aida:login-with-url", payload),
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
