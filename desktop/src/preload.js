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
      if (bootState.session.accessToken) {
        sessionStorage.setItem("nornia_auth_token", String(bootState.session.accessToken));
      }
      if (bootState.justLoggedIn) {
        sessionStorage.setItem("aida_just_logged_in", "1");
      }
      if (bootState.rememberMe) {
        localStorage.setItem("is_logged_in", "true");
        localStorage.setItem("current_user_id", String(bootState.session.userId));
        if (bootState.session.accessToken) {
          localStorage.setItem("nornia_auth_token", String(bootState.session.accessToken));
        }
      }
      if (bootState.session.tenantId) {
        localStorage.setItem("active_tenant_id", String(bootState.session.tenantId));
      }
      if (bootState.uiLanguage === "tr" || bootState.uiLanguage === "en") {
        localStorage.setItem("aida_ui_lang", bootState.uiLanguage);
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
  if (!/aida|aİda|aıda|runa|web\s+telefon|web\s+phone/i.test(str)) return str;
  return str
    .replace(/Web\s+Telefon/gi, "Telefon")
    .replace(/Web\s+Phone/gi, "Telefon")
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
    .replace(/(?<![/.])\baida\b(?![/.])/gi, "Runa");
}

function injectDesktopStyles() {
  if (typeof document === "undefined" || !document.head) return;
  if (document.getElementById("runa-desktop-custom-styles")) return;
  const style = document.createElement("style");
  style.id = "runa-desktop-custom-styles";
  style.textContent = `
    /* 1. Hide bottom-right "Web Telefon / Web Phone" floating widget on Desktop */
    div.fixed.bottom-5.right-5.z-\\[9999\\] {
      display: none !important;
    }

    /* 2. Remove Refresh buttons across all tabs (Missed Calls, History, Voicemail, Chat, etc.) */
    button[title="Listeyi Yenile"],
    button[title="Sesli postaları yenile"],
    button[title="Yenile"],
    button[title*="Yenile"],
    button[title*="yenile"] {
      display: none !important;
    }

    /* 3. Hide "Uygulamalar & İndir" and "Sunucu Adresini Değiştir" in Avatar dropdown & Profile modal */
    [data-runa-hide-desktop-menu="1"] {
      display: none !important;
    }

    /* 4. Kayıp Çağrılar: Keep title + switcher on left and Search + red (+) button on top-right */
    [data-runa-desktop-missed="1"] > div > div:first-child {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      width: 100% !important;
    }
    [data-runa-desktop-missed="1"] > div > div:first-child > div:first-child {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      gap: 12px !important;
      width: auto !important;
      min-width: 0 !important;
    }
    [data-runa-desktop-missed="1"] > div > div:first-child > div:last-child {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 8px !important;
      width: auto !important;
      margin-left: auto !important;
      flex-shrink: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

function rebrandDomToRuna() {
  try {
    if (typeof document === "undefined") return;
    injectDesktopStyles();
    if (document.title && /aida|aİda|runa/i.test(document.title)) {
      document.title = "Runa";
    }
    if (!document.body) return;

    // 0. Ensure topbar Runa R logo is applied
    const topbarLogoBox = document.querySelector("header.aida-app-topbar > div:first-child > div:first-child > div:first-child");
    if (topbarLogoBox && topbarLogoBox.getAttribute("data-runa-logo-applied") !== "1") {
      topbarLogoBox.setAttribute("data-runa-logo-applied", "1");
      topbarLogoBox.className = "h-8 w-8 shrink-0 rounded-xl flex items-center justify-center overflow-hidden shadow-sm bg-white dark:bg-slate-900";
      topbarLogoBox.innerHTML = `<svg viewBox="0 0 1024 1024" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" rx="225" fill="#F8FAFD"/><defs><clipPath id="rClip"><rect x="92" y="92" width="840" height="840" rx="168"/></clipPath></defs><g clip-path="url(#rClip)"><polygon points="0,0 512,0 448,250 250,480 0,680" fill="#16A34A"/><polygon points="482,0 1024,0 1024,495 760,435 418,250" fill="#0284C7"/><polygon points="1024,529 1024,1024 585,1024 475,760 760,469" fill="#DB2777"/><polygon points="0,722 250,522 490,760 619,1024 0,1024" fill="#EA580C"/><rect x="162" y="162" width="700" height="700" rx="108" fill="#F8FAFD"/></g><rect x="236" y="382" width="44" height="260" rx="22" fill="#16A34A"/><rect x="312" y="302" width="44" height="420" rx="22" fill="#0284C7"/><path d="M 434 704 L 434 320 L 604 320 C 684 320 738 370 738 442 C 738 514 684 562 604 562 L 518 562 M 594 562 L 732 704" fill="none" stroke="#5B21B6" stroke-width="82" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    // 1. Ensure topbar connected server pill always displays the true connected host (window.location.host)
    const realHost = (typeof window !== "undefined" && window.location && window.location.host) ? window.location.host : "";
    if (realHost) {
      document.querySelectorAll('header.aida-app-topbar span[title^="Bağlı Santral:"]').forEach((badge) => {
        badge.setAttribute("title", "Bağlı Santral: " + realHost);
        badge.setAttribute("data-runa-real-host", "1");
        const labelSpan = badge.querySelector("span.truncate");
        if (labelSpan && labelSpan.textContent !== realHost) {
          labelSpan.textContent = realHost;
        }
      });
    }

    // 2. Hide "Uygulamalar & İndir" and "Sunucu Adresini Değiştir" buttons in Avatar dropdown & Profile Settings modal
    document.querySelectorAll("button").forEach((btn) => {
      const txt = (btn.textContent || "").trim();
      if (
        txt.includes("Uygulamalar & İndir") ||
        txt.includes("Sunucu Adresini Değiştir")
      ) {
        if (btn.getAttribute("data-runa-hide-desktop-menu") !== "1") {
          btn.setAttribute("data-runa-hide-desktop-menu", "1");
        }
      }
    });

    // 3. Tag Kayıp Çağrılar & Sesli Posta Kutusu roots and resolve Voicemail contact names
    document.querySelectorAll("h2").forEach((h2) => {
      const h2Txt = (h2.textContent || "").trim();
      if (h2Txt.includes("Kayıp Çağrılar")) {
        const root = h2.closest(".overflow-y-auto");
        if (root && root.getAttribute("data-runa-desktop-missed") !== "1") {
          root.setAttribute("data-runa-desktop-missed", "1");
        }
      } else if (h2Txt.includes("Sesli Posta Kutusu")) {
        const root = h2.closest(".overflow-y-auto");
        if (root) {
          try {
            const nowTs = Date.now();
            if (!window.__runaVmContactsMap) {
              window.__runaVmContactsMap = {};
            }
            if (!window.__runaVmContactsFetching && (!window.__runaVmContactsTs || (nowTs - window.__runaVmContactsTs) > 30000)) {
              window.__runaVmContactsFetching = true;
              Promise.all([
                fetch("/api/contacts", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
                fetch("/api/agent/directory", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])).catch(() => [])
              ])
                .then((resArr) => {
                  const cList = Array.isArray(resArr[0]) ? resArr[0] : [];
                  const dList = Array.isArray(resArr[1]) ? resArr[1] : [];
                  const map = {};
                  cList.forEach((c) => {
                    if (!c) return;
                    const rawP = String(c.phone_number || c.phone || "");
                    const d = rawP.replace(/\D+/g, "");
                    const nm = ((c.first_name || "") + " " + (c.last_name || "")).trim() || String(c.name || "").trim();
                    if (d && nm) {
                      map[d] = nm;
                      if (d.length >= 10) map[d.slice(-10)] = nm;
                    }
                  });
                  dList.forEach((u) => {
                    if (!u) return;
                    const nm = String(u.full_name || u.name || u.username || "").trim();
                    if (!nm) return;
                    if (u.extension) map[String(u.extension).trim()] = nm;
                    ["phone", "gsm", "mobile", "phone_number"].forEach((k) => {
                      const d = String(u[k] || "").replace(/\D+/g, "");
                      if (d) {
                        map[d] = nm;
                        if (d.length >= 10) map[d.slice(-10)] = nm;
                      }
                    });
                  });
                  window.__runaVmContactsMap = map;
                  window.__runaVmContactsTs = Date.now();
                  window.__runaVmContactsFetching = false;
                })
                .catch(() => {
                  window.__runaVmContactsFetching = false;
                });
            }
            const cmap = window.__runaVmContactsMap || {};
            root.querySelectorAll("span.text-sm.font-extrabold").forEach((sp) => {
              const rawTxt = (sp.textContent || "").trim();
              if (!rawTxt || rawTxt.includes("(")) return;
              const digits = rawTxt.replace(/\D+/g, "");
              if (digits.length < 3) return;
              const matchedName = cmap[digits] || (digits.length >= 10 ? cmap[digits.slice(-10)] : "");
              if (matchedName) {
                sp.textContent = matchedName + " (" + rawTxt + ")";
              }
            });
          } catch (e) {}
        }
      }
    });

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
      const parentEl = node.parentElement;
      const parentTag = parentEl ? parentEl.tagName : "";
      if (parentTag === "SCRIPT" || parentTag === "STYLE" || parentTag === "NOSCRIPT") continue;
      if (parentEl && parentEl.closest('[data-runa-real-host="1"]')) continue;
      const val = node.nodeValue;
      if (val && /aida|aİda|aıda|RUNA|Web\s+Telefon|Web\s+Phone/i.test(val)) {
        const nextVal = rebrandTextValueToRuna(val);
        if (nextVal !== val) {
          node.nodeValue = nextVal;
        }
      }
    }

    document.querySelectorAll("[title],[placeholder],[aria-label],[alt],[download]").forEach((el) => {
      if (el.getAttribute("data-runa-real-host") === "1") return;
      ["title", "placeholder", "aria-label", "alt", "download"].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v && /aida|aİda|aıda|RUNA|Web\s+Telefon|Web\s+Phone/i.test(v)) {
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
