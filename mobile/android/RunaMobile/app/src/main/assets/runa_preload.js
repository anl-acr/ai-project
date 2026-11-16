(function() {
  if (typeof window !== "undefined" && window.RunaAndroidBridge && (!window.webkit || !window.webkit.messageHandlers)) {
    window.webkit = {
      messageHandlers: {
        aidaNative: {
          postMessage: function(payload) {
            try {
              window.RunaAndroidBridge.postMessage(JSON.stringify(payload || {}));
            } catch (e) {}
          }
        }
      }
    };
  }
})();

        (function() {
          const bootState = __RUNA_BOOT_STATE_JSON__;
          try {
            if (bootState && bootState.session && typeof window !== "undefined") {
              sessionStorage.setItem("aida_desktop_mode", "1");
              sessionStorage.setItem("aida_mobile_mode", "1");
              sessionStorage.setItem("is_logged_in", "true");
              sessionStorage.setItem("current_user_id", String(bootState.session.userId));
              if (bootState.justLoggedIn) {
                sessionStorage.setItem("aida_just_logged_in", "1");
              }
              localStorage.setItem("is_logged_in", "true");
              localStorage.setItem("current_user_id", String(bootState.session.userId));
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
              // Force navPosition = "left" on mobile so AgentPanel keeps the .md:hidden tab buttons in DOM
              const forceLeftNavInKey = function(k) {
                try {
                  const raw = localStorage.getItem(k);
                  const parsed = raw ? JSON.parse(raw) : {};
                  if (parsed && typeof parsed === "object") {
                    parsed.navPosition = "left";
                    localStorage.setItem(k, JSON.stringify(parsed));
                  }
                } catch (err) {}
              };
              forceLeftNavInKey("agent_call_panel_prefs");
              if (bootState.session.userId) {
                forceLeftNavInKey("agent_call_panel_prefs_" + String(bootState.session.userId));
              }
              if (bootState.session.extension) {
                forceLeftNavInKey("agent_call_panel_prefs_" + String(bootState.session.extension));
              }
            }
          } catch (e) {}

          function postToNative(action, payload) {
            try {
              if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.aidaNative) {
                window.webkit.messageHandlers.aidaNative.postMessage({
                  action: action,
                  payload: payload || {}
                });
              }
            } catch (e) {}
          }

          window.__aidaExtNameMap = window.__aidaExtNameMap || {};
          function ensureExtNameMapLoaded() {
            if (window.__aidaExtNameMapLoading) return;
            window.__aidaExtNameMapLoading = true;
            try {
              fetch("/api/settings/users?tenant_id=all")
                .then(function(r) { return r.ok ? r.json() : []; })
                .then(function(list) {
                  if (Array.isArray(list)) {
                    const m = {};
                    list.forEach(function(u) {
                      const uid = String((u && u.id) || "").trim();
                      const ext = String((u && u.extension) || "").trim();
                      const full = String((u && (u.full_name || u.name || u.username)) || "").trim();
                      if (!full) return;
                      const label = (ext && ext.toLowerCase() !== full.toLowerCase() && full.indexOf(ext) === -1)
                        ? (ext + " - " + full)
                        : full;
                      if (ext) m[ext] = label;
                      if (uid) m[uid] = label;
                    });
                    window.__aidaExtNameMap = m;
                  }
                })
                .catch(function() {})
                .finally(function() { window.__aidaExtNameMapLoading = false; });
            } catch (e) {
              window.__aidaExtNameMapLoading = false;
            }
          }
          setTimeout(ensureExtNameMapLoaded, 600);

          window.aidaDesktop = {
            isDesktop: true,
            isMobile: true,
            platform: "ios",
            appName: (bootState && bootState.appName) || "Runa",
            version: (bootState && bootState.version) || "2.9.3",
            getConfigSync: function() {
              return bootState || {};
            },
            openQuickTray: function() {
              postToNative("openQuickTray", {});
            },
            syncThemeMode: function(isDark) {
              postToNative("syncThemeMode", { dark: Boolean(isDark) });
            },
            reconnectWorkspace: function() {
              postToNative("reconnectWorkspace", {});
              return Promise.resolve({ ok: true });
            },
            disconnectServer: function() {
              postToNative("disconnectServer", {});
              return Promise.resolve({ ok: true });
            },
            updatePreferences: function(patch) {
              Object.assign(bootState, patch || {});
              postToNative("updatePreferences", patch || {});
              return Promise.resolve(bootState);
            },
            notify: function(payload) {
              const p = Object.assign({}, payload || {});
              if (typeof p.title === "string") {
                let t = p.title.replace(/^[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]+/, "").trim();
                const mChat = t.match(/^(?:Dahili\s+)?([0-9]{1,6})\s*-\s*(Yeni İç Mesaj.*)$/i);
                if (mChat) {
                  const key = mChat[1];
                  const suffix = mChat[2];
                  const mapped = window.__aidaExtNameMap && window.__aidaExtNameMap[key];
                  if (mapped) {
                    t = mapped + " - " + suffix;
                  } else {
                    ensureExtNameMapLoaded();
                  }
                }
                p.title = t;
              }
              postToNative("notify", p);
            },
            closeNotification: function(notifId) {
              postToNative("closeNotification", { id: notifId });
            },
            focusWindow: function(opts) {
              postToNative("focusWindow", opts || {});
            },
            updateTrayState: function(trayState) {
              postToNative("updateTrayState", trayState || {});
            }
          };

          // 0b. Ensure webphoneManager incoming call device filter recognizes this iOS client as "mobile_app"
          // even on older server bundles that check `actProf.devices.includes("pc_app")` when `aidaDesktop.isDesktop` is true,
          // or when localStorage.current_user has stale cached devices before profile sync completes.
          window.__aidaServerMobileAllowed = true;
          try {
            const origIncludes = Array.prototype.includes;
            Object.defineProperty(Array.prototype, "includes", {
              configurable: true,
              writable: true,
              value: function(searchElement, fromIndex) {
                if (
                  (searchElement === "pc_app" || searchElement === "mobile_app" || searchElement === "web_phone") &&
                  Array.isArray(this) &&
                  this.length <= 4
                ) {
                  let isDeviceArray = true;
                  for (let i = 0; i < this.length; i++) {
                    const v = this[i];
                    if (v !== "desk_phone" && v !== "mobile_app" && v !== "web_phone" && v !== "pc_app") {
                      isDeviceArray = false;
                      break;
                    }
                  }
                  if (isDeviceArray) {
                    const inInviteWindow = Date.now() < (window.__aidaSipInviteWindowUntil || 0);
                    let isDeviceSettingsOpen = false;
                    if (!inInviteWindow) {
                      try {
                        isDeviceSettingsOpen = Boolean(
                          typeof document !== "undefined" &&
                          (document.querySelector(".aida-settings-modal-dialog") ||
                            (document.body && document.body.innerText && document.body.innerText.indexOf("Çalacak Cihazlar") !== -1))
                        );
                      } catch (e) {}
                    }
                    if (inInviteWindow || !isDeviceSettingsOpen) {
                      if (origIncludes.call(this, "mobile_app", fromIndex)) {
                        return true;
                      }
                      if (inInviteWindow && window.__aidaServerMobileAllowed !== false) {
                        return true;
                      }
                      if (searchElement === "pc_app") {
                        return origIncludes.call(this, "mobile_app", fromIndex);
                      }
                    }
                  }
                }
                return origIncludes.call(this, searchElement, fromIndex);
              }
            });
          } catch (e) {}

          // 1. Keep document.visibilityState = "visible" and document.hidden = false
          // so WebRTC SIP, chat polling, and notification polling never pause when backgrounded/locked.
          try {
            Object.defineProperty(Document.prototype, "hidden", {
              configurable: true,
              get: function() { return false; }
            });
            Object.defineProperty(Document.prototype, "visibilityState", {
              configurable: true,
              get: function() { return "visible"; }
            });
            window.addEventListener("visibilitychange", function(ev) {
              try { ev.stopImmediatePropagation(); } catch (e) {}
            }, true);
          } catch (e) {}

          // 1b. Completely disable WebKit's Lock Screen "Now Playing" Music Player widget ("AIDA PBX").
          // Native Swift AudioSessionManager already plays the incoming call ringtone natively,
          // so block HTML5 <audio id="aida-ringtone-audio-el"> from triggering iOS MediaSession / MPNowPlayingInfoCenter.
          try {
            if (typeof navigator !== "undefined" && navigator.mediaSession) {
              try { navigator.mediaSession.metadata = null; } catch (e) {}
              try { navigator.mediaSession.playbackState = "none"; } catch (e) {}
              try { navigator.mediaSession.setActionHandler = function() {}; } catch (e) {}
              try { navigator.mediaSession.setPositionState = function() {}; } catch (e) {}
            }
            if (typeof HTMLMediaElement !== "undefined" && HTMLMediaElement.prototype) {
              const origPlay = HTMLMediaElement.prototype.play;
              HTMLMediaElement.prototype.play = function() {
                try {
                  const elId = String(this.id || "");
                  const elSrc = String(this.src || "");
                  if (elId === "aida-ringtone-audio-el" || elId.includes("ringtone") || elSrc.startsWith("data:audio/wav")) {
                    try { this.pause(); } catch (e) {}
                    return Promise.resolve();
                  }
                } catch (e) {}
                return origPlay.apply(this, arguments);
              };
            }
          } catch (e) {}

          // 2. Give iOS Mobile its own SIP Contact suffix (_mob instead of _pc) on Asterisk WSS
          // so Desktop PC App (_pc), Web Browser (_web), and Mobile App (_mob) stay registered simultaneously,
          // and detect incoming SIP INVITE frames immediately.
          try {
            const OrigWebSocket = window.WebSocket;
            if (typeof OrigWebSocket === "function" && !OrigWebSocket.__aidaIosPatched) {
              const origSend = OrigWebSocket.prototype.send;
              OrigWebSocket.prototype.send = function(data) {
                try {
                  const wsUrl = String(this.url || "");
                  const isSipWs = this.protocol === "sip" || wsUrl.includes(":8089") || wsUrl.endsWith("/ws");
                  if (isSipWs && typeof data === "string" && data.includes("_pc@")) {
                    data = data.replace(/_pc@/g, "_mob@");
                  }
                } catch (e) {}
                return origSend.call(this, data);
              };

              const PatchedWebSocket = function(url, protocols) {
                const ws = arguments.length > 1 ? new OrigWebSocket(url, protocols) : new OrigWebSocket(url);
                try {
                  const wsUrl = String(url || "");
                  const isSipWs = protocols === "sip" || (Array.isArray(protocols) && protocols.includes("sip")) || wsUrl.includes(":8089") || wsUrl.endsWith("/ws");
                  if (isSipWs) {
                    window.__aidaActiveSipWs = ws;
                    const wrapMsgData = function(raw) {
                      if (typeof raw !== "string") return raw;
                      if (raw.startsWith("INVITE ")) {
                        const isReInvite = /^(?:To|t)\s*:.*;\s*tag=/im.test(raw);
                        if (!isReInvite) {
                          window.__aidaSipInviteWindowUntil = Date.now() + 10000;
                          let callerNum = "";
                          let callerName = "";
                          let callId = "";
                          try {
                            const fromMatch = raw.match(/^(?:From|f)\s*:\s*(?:"([^"]*)"\s*)?<?sip:([^@>;\s]+)/im);
                            if (fromMatch) {
                              callerName = (fromMatch[1] || "").trim();
                              callerNum = (fromMatch[2] || "").trim();
                            }
                            const cidMatch = raw.match(/^(?:Call-ID|i)\s*:\s*([^\r\n\s]+)/im);
                            if (cidMatch) {
                              callId = (cidMatch[1] || "").trim();
                            }
                          } catch (e) {}
                          if (window.__aidaAnsweredCurrentCall || window.__aidaColdPickupRequest) {
                            setTimeout(function() {
                              window.dispatchEvent(new CustomEvent("AIDA_CALLKIT_ANSWER", { detail: { answer: true } }));
                            }, 80);
                            setTimeout(function() {
                              window.dispatchEvent(new CustomEvent("AIDA_CALLKIT_ANSWER", { detail: { answer: true } }));
                            }, 320);
                          } else {
                            window.__aidaAnsweredCurrentCall = false;
                            postToNative("sipInviteArrived", {
                              caller: callerNum,
                              callerName: callerName,
                              callId: callId
                            });
                          }
                        }
                      } else if (raw.startsWith("SIP/2.0 200") && /CSeq\s*:\s*\d+\s+REGISTER/i.test(raw)) {
                        window.__aidaSipWsRegistered = true;
                      } else if (raw.startsWith("CANCEL ") || raw.startsWith("BYE ")) {
                        const isCancel = raw.startsWith("CANCEL ");
                        setTimeout(function() {
                          if (!window.__aidaColdPickupRequest) {
                            postToNative("sipCancelOrByeArrived", { method: isCancel ? "CANCEL" : "BYE" });
                          }
                        }, 150);
                      }
                      if (raw.includes("_mob@")) {
                        return raw.replace(/_mob@/g, "_pc@");
                      }
                      return raw;
                    };
                    ws.addEventListener("message", function(ev) {
                      try {
                        if (ev && typeof ev.data === "string") {
                          const transformed = wrapMsgData(ev.data);
                          if (transformed !== ev.data) {
                            Object.defineProperty(ev, "data", {
                              configurable: true,
                              get: function() { return transformed; }
                            });
                          }
                        }
                      } catch (e) {}
                    }, true);
                  }
                } catch (e) {}
                return ws;
              };
              PatchedWebSocket.prototype = OrigWebSocket.prototype;
              PatchedWebSocket.CONNECTING = OrigWebSocket.CONNECTING;
              PatchedWebSocket.OPEN = OrigWebSocket.OPEN;
              PatchedWebSocket.CLOSING = OrigWebSocket.CLOSING;
              PatchedWebSocket.CLOSED = OrigWebSocket.CLOSED;
              PatchedWebSocket.__aidaIosPatched = true;
              window.WebSocket = PatchedWebSocket;
            }
          } catch (e) {}

          // 3. Periodically sync user profiles from server into localStorage so device selection changes
          // made on the Web UI take effect immediately in WKWebView without requiring re-login.
          try {
            const syncMobileUserProfileCache = function() {
              try {
                const ext = (bootState && bootState.session && bootState.session.extension) || "1000";
                fetch("/api/settings/users", { headers: { "X-Tenant-ID": "tenant-default" } })
                  .then(function(r) { return r.ok ? r.json() : null; })
                  .then(function(users) {
                    if (!Array.isArray(users)) return;
                    const me = users.find(function(u) { return String(u && u.extension) === String(ext); });
                    if (!me || !Array.isArray(me.profiles)) return;
                    const actId = me.active_profile || "available";
                    const actP = me.profiles.find(function(p) { return p && p.id === actId; }) || me.profiles[0];
                    if (actP && Array.isArray(actP.devices)) {
                      window.__aidaServerMobileAllowed = actP.devices.indexOf("mobile_app") !== -1;
                    }
                    try {
                      const curRaw = localStorage.getItem("current_user");
                      const curObj = curRaw ? JSON.parse(curRaw) : {};
                      curObj.active_profile = actId;
                      curObj.profiles = me.profiles;
                      curObj.profiles_updated_ts = me.profiles_updated_ts || Date.now();
                      localStorage.setItem("current_user", JSON.stringify(curObj));
                    } catch (e) {}
                  })
                  .catch(function() {});
              } catch (e) {}
            };
            setTimeout(syncMobileUserProfileCache, 800);
            setInterval(syncMobileUserProfileCache, 5000);
          } catch (e) {}

          // 4. Capture webphoneManager.linesMap automatically for 2-way iOS CallKit bridge
          try {
            const origMapSet = Map.prototype.set;
            Map.prototype.set = function(k, v) {
              try {
                if (typeof k === "string" && k.indexOf("line-") === 0 && v && typeof v === "object" && v.session && v.callStatus) {
                  window.__aidaLinesMap = this;
                  window.__aidaLatestLineObj = v;
                }
              } catch (e) {}
              return origMapSet.call(this, k, v);
            };
            window.__aidaGetActiveLine = function() {
              try {
                const map = window.__aidaLinesMap;
                if (map && typeof map.values === "function") {
                  const arr = Array.from(map.values());
                  return (
                    arr.find(function(l) { return l && l.callStatus === "Ringing"; }) ||
                    arr.find(function(l) { return l && l.callStatus === "Calling"; }) ||
                    arr.find(function(l) { return l && l.callStatus === "InCall" && !l.isOnHold; }) ||
                    arr[0] ||
                    null
                  );
                }
              } catch (e) {}
              return null;
            };
          } catch (e) {}
        })();
