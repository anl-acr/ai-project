import SwiftUI
import WebKit
import AVFoundation

@MainActor
final class PBXWebViewControllerBridge: ObservableObject {
    weak var webView: WKWebView?
    private var isBackgroundKeepAliveRunning = false

    init() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.webView?.evaluateJavaScript("window.__aidaAppInForeground = false; window.__ACTIVE_VISIBLE_INTERNAL_PEERS__ = [];", completionHandler: nil)
            }
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.webView?.evaluateJavaScript("window.__aidaAppInForeground = false; window.__ACTIVE_VISIBLE_INTERNAL_PEERS__ = [];", completionHandler: nil)
                self?.startBackgroundJSKeepAliveLoop()
            }
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.stopBackgroundJSKeepAliveLoop()
                self?.webView?.evaluateJavaScript("window.__aidaAppInForeground = true;", completionHandler: nil)
            }
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.webView?.evaluateJavaScript("window.__aidaAppInForeground = true;", completionHandler: nil)
            }
        }
    }

    func startBackgroundJSKeepAliveLoop() {
        guard !isBackgroundKeepAliveRunning else { return }
        isBackgroundKeepAliveRunning = true
        runNextBackgroundKeepAliveTick()
    }

    func stopBackgroundJSKeepAliveLoop() {
        isBackgroundKeepAliveRunning = false
    }

    private func runNextBackgroundKeepAliveTick() {
        guard isBackgroundKeepAliveRunning,
              UIApplication.shared.applicationState != .active,
              let webView = webView else {
            isBackgroundKeepAliveRunning = false
            return
        }
        // Holding an active callAsyncJavaScript Promise keeps WebKit's
        // 'WebPageProxy::runJavaScriptInFrameInScriptWorld' process assertion alive continuously
        // so WebContent & NetworkProcess never suspend while the iPhone screen is locked.
        let asyncJS = """
        await new Promise(function(resolve) {
          setTimeout(resolve, 1800);
        });
        return 1;
        """
        webView.callAsyncJavaScript(asyncJS, arguments: [:], in: nil, in: .page) { [weak self] _ in
            Task { @MainActor in
                guard let self = self, self.isBackgroundKeepAliveRunning else { return }
                self.runNextBackgroundKeepAliveTick()
            }
        }
    }

    func dispatchWindowEvent(name: String, detail: Any? = nil) {
        guard let webView = webView else { return }
        var detailJS = "null"
        if let detail = detail,
           JSONSerialization.isValidJSONObject(detail),
           let data = try? JSONSerialization.data(withJSONObject: detail, options: []),
           let str = String(data: data, encoding: .utf8) {
            detailJS = str
        }
        let js = """
        try {
          window.dispatchEvent(new CustomEvent(\(Self.quoteJS(name)), { detail: \(detailJS) }));
        } catch (e) {}
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    func reloadWorkspace(uiOrigin: String) {
        guard let webView = webView else { return }
        let clean = uiOrigin.replacingOccurrences(of: "\\/+$", with: "", options: .regularExpression)
        if let url = URL(string: "\(clean)/?desktop=1&mobile=1") {
            webView.load(URLRequest(url: url))
        }
    }

    static func quoteJS(_ s: String) -> String {
        if let data = try? JSONEncoder().encode(s), let str = String(data: data, encoding: .utf8) {
            return str
        }
        return "\"\(s)\""
    }
}

struct PBXWebView: UIViewRepresentable {
    @ObservedObject var store: AppConfigStore
    @ObservedObject var bridge: PBXWebViewControllerBridge
    var onOpenQuickTray: (() -> Void)? = nil

    func makeCoordinator() -> Coordinator {
        Coordinator(store: store, bridge: bridge, onOpenQuickTray: onOpenQuickTray)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.allowsAirPlayForMediaPlayback = false
        config.mediaTypesRequiringUserActionForPlayback = []
        config.suppressesIncrementalRendering = false

        let contentController = WKUserContentController()
        let bootDict = store.consumeBootStateDictionary()
        let bootJSON: String = {
            if let data = try? JSONSerialization.data(withJSONObject: bootDict, options: []),
               let str = String(data: data, encoding: .utf8) {
                return str
            }
            return "{}"
        }()

        let preloadScriptSource = Self.buildPreloadJS(bootJSON: bootJSON)
        let userScript = WKUserScript(
            source: preloadScriptSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        contentController.addUserScript(userScript)

        let mobileOptimizerScript = WKUserScript(
            source: Self.buildMobileUIOptimizerJS(),
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        contentController.addUserScript(mobileOptimizerScript)

        contentController.add(context.coordinator, name: "aidaNative")
        config.userContentController = contentController

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = context.coordinator
        wv.uiDelegate = context.coordinator
        wv.scrollView.delegate = context.coordinator
        wv.scrollView.bounces = false
        wv.scrollView.isScrollEnabled = false
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.isOpaque = false
        wv.backgroundColor = .clear
        wv.scrollView.backgroundColor = .clear

        if #available(iOS 16.4, *) {
            wv.isInspectable = true
        }

        bridge.webView = wv

        let cleanOrigin = store.uiOrigin.replacingOccurrences(of: "\\/+$", with: "", options: .regularExpression)
        if let targetURL = URL(string: "\(cleanOrigin)/?desktop=1&mobile=1") {
            wv.load(URLRequest(url: targetURL))
        }

        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.onOpenQuickTray = onOpenQuickTray
    }

    private static func buildPreloadJS(bootJSON: String) -> String {
        return """
        (function() {
          const bootState = \(bootJSON);
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
              if (bootState.pendingNav && bootState.pendingNav.subTab) {
                const targetSub = String(bootState.pendingNav.subTab);
                window.__AIDA_PENDING_NOTIF_NAV__ = bootState.pendingNav;
                window.__CURRENT_AGENT_SUBTAB__ = targetSub;
                if (bootState.pendingNav.peerSenderId) {
                  window.__AIDA_PENDING_CHAT_PEER__ = String(bootState.pendingNav.peerSenderId);
                }
                sessionStorage.removeItem("aida_just_logged_in");
                try {
                  localStorage.setItem("aida_last_visited_agent_subtab", targetSub);
                  if (bootState.session.userId) {
                    localStorage.setItem("aida_last_visited_agent_subtab_" + String(bootState.session.userId), targetSub);
                  }
                  if (bootState.session.extension) {
                    localStorage.setItem("aida_last_visited_agent_subtab_" + String(bootState.session.extension), targetSub);
                  }
                } catch (e) {}
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
                const mChat = t.match(/^(?:Dahili\\s+)?([0-9]{1,6})\\s*-\\s*(Yeni İç Mesaj.*)$/i);
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
          window.__aidaAppInForeground = true;
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
                        const isReInvite = /^(?:To|t)\\s*:.*;\\s*tag=/im.test(raw);
                        if (!isReInvite) {
                          window.__aidaSipInviteWindowUntil = Date.now() + 10000;
                          let callerNum = "";
                          let callerName = "";
                          let callId = "";
                          try {
                            const fromMatch = raw.match(/^(?:From|f)\\s*:\\s*(?:"([^"]*)"\\s*)?<?sip:([^@>;\\s]+)/im);
                            if (fromMatch) {
                              callerName = (fromMatch[1] || "").trim();
                              callerNum = (fromMatch[2] || "").trim();
                            }
                            const cidMatch = raw.match(/^(?:Call-ID|i)\\s*:\\s*([^\\r\\n\\s]+)/im);
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
                      } else if (raw.startsWith("SIP/2.0 200") && /CSeq\\s*:\\s*\\d+\\s+REGISTER/i.test(raw)) {
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
        """
    }

    private static func buildMobileUIOptimizerJS() -> String {
        return #"""
        (function() {
          if (window.__AIDA_IOS_OPTIMIZER_INSTALLED__) return;
          window.__AIDA_IOS_OPTIMIZER_INSTALLED__ = true;

          let morePopoverOpen = false;
          let lastSyncedDark = null;

          // Primary 4 Bottom Bubble Tabs (Left to Right) + 5th "Daha Fazlası" trigger
          const PRIMARY_BOTTOM_TABS = [
            {
              id: "history",
              label: "Çağrı Geçmişi",
              shortLabel: "Geçmiş",
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`
            },
            {
              id: "directory",
              label: "Rehber",
              shortLabel: "Rehber",
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
            },
            {
              id: "webphone",
              label: "Telefon",
              shortLabel: "Telefon",
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`
            },
            {
              id: "chat",
              label: "Sohbet",
              shortLabel: "Sohbet",
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
            }
          ];

          // Secondary Tabs inside "Daha Fazlası" Popover Window (No Deskphone, No Subtitles)
          const MORE_POPOVER_TABS = [
            {
              id: "dashboard",
              label: "Pano",
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`
            },
            {
              id: "agents",
              label: "Temsilciler",
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>`
            },
            {
              id: "speeddial",
              label: "Hızlı Arama",
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`
            },
            {
              id: "missed",
              label: "Kayıp Çağrı",
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="16" y1="2" y2="8"/><line x1="16" x2="22" y1="2" y2="8"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`
            },
            {
              id: "voicemail",
              label: "Sesli Posta",
              svg: `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="4"/><circle cx="18" cy="12" r="4"/><line x1="6" x2="18" y1="16" y2="16"/></svg>`
            }
          ];

          function ensureMobileViewport() {
            let meta = document.querySelector('meta[name="viewport"]');
            if (!meta) {
              meta = document.createElement('meta');
              meta.name = 'viewport';
              document.head.appendChild(meta);
            }
            const desired = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
            if (meta.content !== desired) {
              meta.content = desired;
            }
            if (!document.documentElement.classList.contains('aida-ios-mobile')) {
              document.documentElement.classList.add('aida-ios-mobile');
            }

            const isDark = document.documentElement.classList.contains('dark');
            if (lastSyncedDark !== isDark) {
              lastSyncedDark = isDark;
              if (window.aidaDesktop && typeof window.aidaDesktop.syncThemeMode === 'function') {
                window.aidaDesktop.syncThemeMode(isDark);
              }
            }
          }

          function injectMobileStyles() {
            if (document.getElementById('aida-ios-mobile-styles')) return;
            const style = document.createElement('style');
            style.id = 'aida-ios-mobile-styles';
            style.textContent = `
              /* ==============================================================
                 1. FULL-BLEED EDGE-TO-EDGE SHELL (NO TOP OR BOTTOM BLACK BARS)
                 ============================================================== */
              html.aida-ios-mobile,
              html.aida-ios-mobile body {
                width: 100vw !important;
                max-width: 100vw !important;
                height: 100vh !important;
                height: 100dvh !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                overscroll-behavior: none !important;
                -webkit-text-size-adjust: 100% !important;
                -webkit-tap-highlight-color: transparent !important;
              }

              html.aida-ios-mobile .aida-app-shell {
                height: 100vh !important;
                height: 100dvh !important;
                width: 100vw !important;
                overflow: hidden !important;
              }

              html.aida-ios-mobile .aida-app-shell > main {
                height: 100vh !important;
                height: 100dvh !important;
                width: 100vw !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
              }

              /* Topbar extends seamlessly behind iOS Status Bar / Dynamic Island */
              html.aida-ios-mobile header.aida-app-topbar {
                padding-top: env(safe-area-inset-top, 54px) !important;
                height: calc(48px + env(safe-area-inset-top, 54px)) !important;
                min-height: calc(48px + env(safe-area-inset-top, 54px)) !important;
                padding-left: 14px !important;
                padding-right: 14px !important;
                padding-bottom: 0 !important;
                gap: 6px !important;
                flex-shrink: 0 !important;
                justify-content: space-between !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                transform: none !important;
                background: #ffffff !important;
              }
              html.aida-ios-mobile.dark header.aida-app-topbar {
                background: #0f172a !important;
              }

              /* Hide long subtitle "TEMSİLCİ ÇAĞRI PANELİ" in topbar */
              html.aida-ios-mobile header.aida-app-topbar .text-\\[9px\\].uppercase.tracking-wider {
                display: none !important;
              }

              html.aida-ios-mobile header.aida-app-topbar > div:first-child {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
              }
              html.aida-ios-mobile header.aida-app-topbar > div:first-child .h-8.w-8 {
                width: 32px !important;
                height: 32px !important;
                border-radius: 10px !important;
              }
              html.aida-ios-mobile header.aida-app-topbar > div:first-child .pr-2 {
                padding-right: 2px !important;
                gap: 8px !important;
              }
              html.aida-ios-mobile header.aida-app-topbar > div:nth-child(2),
              html.aida-ios-mobile header.aida-app-topbar #agent-top-nav-slot {
                display: none !important;
              }

              html.aida-ios-mobile header.aida-app-topbar > div:last-child {
                margin-left: auto !important;
                gap: 8px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: flex-end !important;
              }

              /* Hide Notification Bell & Theme Toggle in Topbar Right Zone on Mobile, plus duplicate web chat toast */
              html.aida-ios-mobile header.aida-app-topbar > div:last-child > *[data-aida-hide-topbar-item="1"],
              html.aida-ios-mobile [data-aida-internal-chat-toast="1"],
              html.aida-ios-mobile div.fixed.top-20.right-6.z-\\[9500\\] {
                display: none !important;
              }

              /* Headset (Queue Login / Logout / Break) Icon Button — only shown if user is in a queue */
              html.aida-ios-mobile #aida-ios-quicktray-btn:not([data-aida-queue-member="1"]) {
                display: none !important;
              }
              html.aida-ios-mobile #aida-ios-quicktray-btn[data-aida-queue-member="1"] {
                position: relative !important;
                width: 36px !important;
                height: 36px !important;
                border-radius: 9999px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 0 !important;
                flex-shrink: 0 !important;
                transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease !important;
              }
              #aida-ios-quicktray-dot {
                position: absolute !important;
                bottom: 0px !important;
                right: 0px !important;
                width: 10px !important;
                height: 10px !important;
                border-radius: 9999px !important;
                border: 2px solid #ffffff !important;
                background: #ef4444 !important;
                transition: background-color 0.2s ease !important;
              }
              html.dark #aida-ios-quicktray-dot {
                border-color: #0f172a !important;
              }

              /* Mobile Network Quality Topbar Button & Warning Banner */
              html.aida-ios-mobile #aida-ios-net-quality-btn {
                position: relative !important;
                width: 36px !important;
                height: 36px !important;
                border-radius: 9999px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 0 !important;
                flex-shrink: 0 !important;
                transition: all 0.2s ease !important;
              }
              html.aida-ios-mobile #aida-ios-net-quality-btn[data-net-tier="good"] {
                color: #10b981 !important;
              }
              html.aida-ios-mobile #aida-ios-net-quality-btn[data-net-tier="fair"] {
                color: #f59e0b !important;
                border-color: rgba(245, 158, 11, 0.45) !important;
                background-color: rgba(245, 158, 11, 0.1) !important;
              }
              html.aida-ios-mobile #aida-ios-net-quality-btn[data-net-tier="poor"] {
                color: #f43f5e !important;
                border-color: rgba(244, 63, 94, 0.55) !important;
                background-color: rgba(244, 63, 94, 0.12) !important;
              }
              #aida-mobile-net-quality-banner {
                position: fixed !important;
                top: calc(58px + env(safe-area-inset-top, 0px)) !important;
                left: 12px !important;
                right: 12px !important;
                z-index: 9850 !important;
                border-radius: 18px !important;
                padding: 11px 13px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 10px !important;
                backdrop-filter: blur(20px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
                box-shadow: 0 14px 32px -6px rgba(15, 23, 42, 0.28) !important;
                transition: opacity 0.22s ease, transform 0.22s ease !important;
              }
              #aida-mobile-net-quality-banner[data-hidden="1"] {
                display: none !important;
              }
              #aida-mobile-net-quality-banner[data-net-tier="poor"] {
                background: linear-gradient(135deg, rgba(225, 29, 72, 0.96), rgba(190, 18, 60, 0.96)) !important;
                border: 1px solid rgba(255, 255, 255, 0.22) !important;
                color: #ffffff !important;
              }
              #aida-mobile-net-quality-banner[data-net-tier="fair"] {
                background: linear-gradient(135deg, rgba(217, 119, 6, 0.96), rgba(180, 83, 9, 0.96)) !important;
                border: 1px solid rgba(255, 255, 255, 0.22) !important;
                color: #ffffff !important;
              }
              #aida-mobile-net-quality-banner[data-net-tier="good"] {
                background: linear-gradient(135deg, rgba(5, 150, 105, 0.96), rgba(4, 120, 87, 0.96)) !important;
                border: 1px solid rgba(255, 255, 255, 0.22) !important;
                color: #ffffff !important;
              }

              /* Mobile Queue Session & Break Modal (Theme-aware Light/Dark) */
              #aida-ios-queue-modal-backdrop {
                position: fixed !important;
                inset: 0 !important;
                z-index: 9800 !important;
                background: rgba(15, 23, 42, 0.55) !important;
                backdrop-filter: blur(4px) !important;
                -webkit-backdrop-filter: blur(4px) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 16px !important;
              }
              .aida-ios-queue-modal-card {
                width: 100% !important;
                max-width: 370px !important;
                max-height: 82dvh !important;
                border-radius: 24px !important;
                background: #ffffff !important;
                border: 1px solid rgba(226, 232, 240, 0.95) !important;
                box-shadow: 0 24px 48px -12px rgba(15, 23, 42, 0.25) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                color: #0f172a !important;
              }
              html.dark .aida-ios-queue-modal-card {
                background: #0f172a !important;
                border: 1px solid rgba(30, 41, 59, 0.95) !important;
                box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.65) !important;
                color: #f8fafc !important;
              }
              .aida-ios-queue-modal-header {
                padding: 14px 16px !important;
                border-bottom: 1px solid rgba(226, 232, 240, 0.9) !important;
                background: #f8fafc !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 10px !important;
              }
              html.dark .aida-ios-queue-modal-header {
                background: rgba(2, 6, 23, 0.55) !important;
                border-bottom: 1px solid rgba(30, 41, 59, 0.9) !important;
              }
              .aida-ios-queue-modal-body {
                padding: 16px !important;
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 12px !important;
              }
              .aida-ios-queue-break-item {
                width: 100% !important;
                padding: 12px 14px !important;
                border-radius: 14px !important;
                border: 1px solid rgba(226, 232, 240, 0.95) !important;
                background: #f8fafc !important;
                color: #0f172a !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 10px !important;
                text-align: left !important;
                cursor: pointer !important;
                transition: all 0.15s ease !important;
              }
              html.dark .aida-ios-queue-break-item {
                background: rgba(2, 6, 23, 0.5) !important;
                border-color: rgba(30, 41, 59, 0.95) !important;
                color: #f8fafc !important;
              }

              /* Circular Avatar-Only Button in Topbar */
              html.aida-ios-mobile header.aida-app-topbar button[aria-label="Kullanıcı Profili ve Menüsü"] {
                padding: 2px !important;
                width: 36px !important;
                height: 36px !important;
                min-width: 36px !important;
                max-width: 36px !important;
                border-radius: 9999px !important;
                gap: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              html.aida-ios-mobile header.aida-app-topbar button[aria-label="Kullanıcı Profili ve Menüsü"] > div:first-child img {
                width: 30px !important;
                height: 30px !important;
                border-radius: 9999px !important;
              }
              html.aida-ios-mobile header.aida-app-topbar button[aria-label="Kullanıcı Profili ve Menüsü"] > div:nth-child(2),
              html.aida-ios-mobile header.aida-app-topbar button[aria-label="Kullanıcı Profili ve Menüsü"] > svg {
                display: none !important;
              }

              /* Hide WebPhone System Diagnostics Warning Modal & Trigger on Mobile */
              html.aida-ios-mobile [data-aida-hide-diagnostics="1"],
              html.aida-ios-mobile button[title*="Web Telefon sorunlarını görüntülemek"] {
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
              }
              html.aida-ios-mobile button[title*="Sistem Kontrolü"],
              html.aida-ios-mobile button[title*="Sorun Giderme Ekranını Aç"] {
                pointer-events: none !important;
                cursor: default !important;
              }

              /* ==============================================================
                 2. MAIN STAGE FULL HEIGHT TO BOTTOM EDGE (NO BOTTOM BLACK BAR)
                 ============================================================== */
              html.aida-ios-mobile .aida-stage-active {
                flex: 1 1 0% !important;
                min-height: 0 !important;
                width: 100% !important;
                height: auto !important;
                padding: 0 !important;
                overflow: hidden !important;
              }

              html.aida-ios-mobile .aida-stage-active > div.aida-panel-enter > div.flex.h-full.w-full {
                display: flex !important;
                flex-direction: column !important;
                gap: 0 !important;
                width: 100% !important;
                height: 100% !important;
                overflow: hidden !important;
              }

              /* Hide original top horizontal mobile tab bar visually (keep in DOM for badge/state sync) */
              html.aida-ios-mobile .aida-stage-active > div.aida-panel-enter > div.flex.h-full.w-full > div.md\\:hidden {
                position: absolute !important;
                width: 0 !important;
                height: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                overflow: hidden !important;
              }

              /* Full-bleed Tab Content Area all the way to the bottom edge */
              html.aida-ios-mobile .aida-stage-active > div.aida-panel-enter > div.flex.h-full.w-full > div.flex-1 {
                flex: 1 1 0% !important;
                min-height: 0 !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 0 !important;
                border-left: none !important;
                border-right: none !important;
                border-bottom: none !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch !important;
              }

              /* ==============================================================
                 3. FLOATING BOTTOM BUBBLE BAR & "DAHA FAZLASI" POPOVER
                 ============================================================== */
              #aida-ios-bottom-dock {
                position: fixed !important;
                left: 10px !important;
                right: 10px !important;
                bottom: calc(6px + env(safe-area-inset-bottom, 14px)) !important;
                height: 62px !important;
                z-index: 9100 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 4px !important;
                padding: 5px 6px !important;
                border-radius: 9999px !important;
                background: rgba(255, 255, 255, 0.92) !important;
                backdrop-filter: blur(22px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(22px) saturate(180%) !important;
                border: 1px solid rgba(203, 213, 225, 0.75) !important;
                box-shadow: 0 12px 32px -6px rgba(15, 23, 42, 0.18), 0 4px 12px -2px rgba(15, 23, 42, 0.08) !important;
                user-select: none !important;
                -webkit-user-select: none !important;
              }

              html.dark #aida-ios-bottom-dock {
                background: rgba(15, 23, 42, 0.90) !important;
                border: 1px solid rgba(51, 65, 85, 0.75) !important;
                box-shadow: 0 14px 34px -6px rgba(0, 0, 0, 0.55) !important;
              }

              .aida-ios-dock-btn {
                position: relative !important;
                flex: 1 1 0% !important;
                min-width: 0 !important;
                height: 50px !important;
                border-radius: 9999px !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 2px !important;
                padding: 4px 2px !important;
                border: none !important;
                background: transparent !important;
                color: #475569 !important;
                font-size: 9.3px !important;
                letter-spacing: -0.2px !important;
                font-weight: 700 !important;
                line-height: 1.1 !important;
                transition: all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
                cursor: pointer !important;
              }

              html.dark .aida-ios-dock-btn {
                color: #94a3b8 !important;
              }

              .aida-ios-dock-btn:active {
                transform: scale(0.94) !important;
              }

              .aida-ios-dock-btn[data-active="1"] {
                color: #ffffff !important;
                font-weight: 800 !important;
                box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.22) !important;
              }

              .aida-ios-dock-btn span.aida-dock-label {
                max-width: 100% !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                padding: 0 2px !important;
              }

              .aida-ios-dock-badge {
                position: absolute !important;
                top: 3px !important;
                right: calc(50% - 22px) !important;
                min-width: 16px !important;
                height: 16px !important;
                padding: 0 4px !important;
                border-radius: 9999px !important;
                background: #f43f5e !important;
                color: #ffffff !important;
                font-size: 9px !important;
                font-weight: 900 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border: 1.5px solid #ffffff !important;
                line-height: 1 !important;
              }

              html.dark .aida-ios-dock-badge {
                border-color: #0f172a !important;
              }

              /* Backdrop & Popover for "Daha Fazlası" */
              #aida-ios-more-backdrop {
                position: fixed !important;
                inset: 0 !important;
                z-index: 9090 !important;
                background: rgba(15, 23, 42, 0.18) !important;
                backdrop-filter: blur(2px) !important;
                -webkit-backdrop-filter: blur(2px) !important;
              }

              #aida-ios-more-popover {
                position: fixed !important;
                right: 12px !important;
                bottom: calc(76px + env(safe-area-inset-bottom, 14px)) !important;
                width: 196px !important;
                z-index: 9110 !important;
                padding: 6px !important;
                border-radius: 20px !important;
                background: rgba(255, 255, 255, 0.97) !important;
                backdrop-filter: blur(24px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
                border: 1px solid rgba(203, 213, 225, 0.85) !important;
                box-shadow: 0 20px 44px -8px rgba(15, 23, 42, 0.25), 0 6px 16px -3px rgba(15, 23, 42, 0.10) !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 2px !important;
                transform-origin: bottom right !important;
                animation: aidaMorePopIn 0.16s cubic-bezier(0.2, 0.85, 0.3, 1) !important;
              }

              html.dark #aida-ios-more-popover {
                background: rgba(15, 23, 42, 0.96) !important;
                border: 1px solid rgba(51, 65, 85, 0.85) !important;
                box-shadow: 0 20px 44px -8px rgba(0, 0, 0, 0.65) !important;
              }

              @keyframes aidaMorePopIn {
                from {
                  opacity: 0;
                  transform: scale(0.92) translateY(8px);
                }
                to {
                  opacity: 1;
                  transform: scale(1) translateY(0);
                }
              }

              .aida-ios-more-item {
                width: 100% !important;
                padding: 10px 12px !important;
                border-radius: 14px !important;
                border: none !important;
                background: transparent !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 10px !important;
                text-align: left !important;
                color: #1e293b !important;
                cursor: pointer !important;
                transition: background 0.15s ease !important;
              }

              html.dark .aida-ios-more-item {
                color: #f1f5f9 !important;
              }

              .aida-ios-more-item:active {
                transform: scale(0.98) !important;
              }

              .aida-ios-more-item[data-active="1"] {
                color: #ffffff !important;
              }

              .aida-ios-more-item-left {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                min-width: 0 !important;
              }

              .aida-ios-more-item-title {
                font-size: 13px !important;
                font-weight: 800 !important;
                line-height: 1.2 !important;
              }

              .aida-ios-more-badge {
                padding: 2px 7px !important;
                border-radius: 9999px !important;
                font-size: 10px !important;
                font-weight: 900 !important;
                background: #f43f5e !important;
                color: #ffffff !important;
                flex-shrink: 0 !important;
              }

              /* ==============================================================
                 4. TELEFON TAB (IPHONE-STYLE DIALPAD & CIRCULAR CALL BUTTON)
                 ============================================================== */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] {
                height: 100% !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch !important;
                padding: 10px 12px calc(84px + env(safe-area-inset-bottom, 16px)) 12px !important;
                display: flex !important;
                flex-direction: column !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid {
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
                flex: 1 1 auto !important;
                height: auto !important;
                min-height: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div {
                height: auto !important;
                overflow: visible !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="0"][data-idle-banners="0"] > div.grid > div:first-child {
                flex: 1 1 auto !important;
                display: flex !important;
                flex-direction: column !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="0"][data-idle-banners="0"] > div.grid > div:nth-child(2) {
                display: none !important;
              }
              /* Hide "Son Görüşmeler" & "Hızlı Rehber & Dahililer" grid on mobile Telefon tab */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:nth-child(2) .grid.grid-cols-1.xl\\:grid-cols-2 {
                display: none !important;
              }
              /* Keep Floating CallChatWidget hidden on mobile */
              html.aida-ios-mobile div.fixed.bottom-5.right-5.z-\\[9999\\] {
                position: fixed !important;
                top: -9999px !important;
                left: -9999px !important;
                width: 1px !important;
                height: 1px !important;
                opacity: 0 !important;
                pointer-events: none !important;
                overflow: hidden !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2),
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-idle-banners="1"] > div.grid > div:nth-child(2) {
                order: -1 !important;
                flex: 1 1 auto !important;
              }
              /* Hide Dialpad during incoming ringing OR active call (unless keypad toggle is open) OR during Post-Call ACW screen */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-show-incall-keypad="1"]) > div.grid > div:first-child,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="0"][data-acw-active="1"] > div.grid > div:first-child {
                display: none !important;
              }
              /* When in-call keypad is open, hide the call card so keypad fits cleanly on screen */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-keypad="1"] > div.grid > div:nth-child(2) {
                display: none !important;
              }
              #aida-ios-return-to-call-btn,
              #aida-ios-translator-return-btn {
                display: none;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-keypad="1"] #aida-ios-return-to-call-btn,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-translator="1"] #aida-ios-translator-return-btn {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 8px !important;
                width: 100% !important;
                padding: 10px 14px !important;
                margin-bottom: 6px !important;
                border-radius: 16px !important;
                background: rgba(16, 185, 129, 0.14) !important;
                border: 1px solid rgba(16, 185, 129, 0.4) !important;
                color: #059669 !important;
                font-size: 13px !important;
                font-weight: 800 !important;
                cursor: pointer !important;
                flex-shrink: 0 !important;
              }
              html.dark.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-keypad="1"] #aida-ios-return-to-call-btn,
              html.dark.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-translator="1"] #aida-ios-translator-return-btn {
                background: rgba(16, 185, 129, 0.22) !important;
                color: #34d399 !important;
              }

              /* ==============================================================
                 4a. MOBILE-NATIVE IPHONE-STYLE INCOMING & ACTIVE CALL SCREEN
                 ============================================================== */
              /* Hide Group Ringing Banner during active/ringing call on mobile */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div.shrink-0.space-y-2 {
                display: none !important;
              }
              /* Hide LiveTranslatorPanel by default on mobile unless user opens it via "Çeviri" button */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-show-incall-translator="1"]) [data-aida-translator-wrap="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-show-incall-translator="1"]) > div.grid > div:nth-child(2) > div > div:not(.rounded-3xl):not(.rounded-2xl) {
                display: none !important;
              }
              /* When LiveTranslatorPanel sheet is open via "Çeviri" button, hide main call card and fit translator to mobile screen */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-translator="1"] [data-aida-call-card="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-translator="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-translator="1"] > div.grid > div:nth-child(2) > div > div.p-3\\.5.rounded-2xl {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-translator="1"] [data-aida-translator-wrap="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-translator="1"] > div.grid > div:nth-child(2) > div > div:not(.rounded-3xl):not(.rounded-2xl) {
                display: flex !important;
                flex-direction: column !important;
                height: calc(100dvh - 215px) !important;
                max-height: 525px !important;
                min-height: 380px !important;
                gap: 8px !important;
                overflow: hidden !important;
              }
              /* Mobile-Native LiveTranslatorPanel Inner Card */
              html.aida-ios-mobile [data-aida-translator-card="1"] {
                flex: 1 1 auto !important;
                height: 100% !important;
                padding: 14px 14px 12px 14px !important;
                border-radius: 26px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
                overflow: hidden !important;
                box-shadow: 0 16px 36px -10px rgba(15, 23, 42, 0.12) !important;
              }
              /* Translator Header: Stack title row + organized 2-row control toolbar cleanly */
              html.aida-ios-mobile [data-aida-translator-card="1"] > div:first-child {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 8px !important;
                padding-bottom: 10px !important;
              }
              html.aida-ios-mobile [data-aida-translator-card="1"] > div:first-child > div:first-child {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-translator-card="1"] > div:first-child > div:nth-child(2) {
                display: grid !important;
                grid-template-columns: 1fr auto !important;
                gap: 8px !important;
                width: 100% !important;
                align-items: center !important;
              }
              /* Oto. Sesli Çeviri Toggle Button */
              html.aida-ios-mobile [data-aida-translator-card="1"] > div:first-child > div:nth-child(2) > button:first-child {
                width: 100% !important;
                min-height: 36px !important;
                justify-content: center !important;
                border-radius: 12px !important;
                font-size: 11.5px !important;
                padding: 6px 10px !important;
              }
              /* 3-Segment TTS Output Target Bar (Sadece Müşteri | Müşteri + Ben | Sadece Ben) spans full width */
              html.aida-ios-mobile [data-aida-translator-card="1"] > div:first-child > div:nth-child(2) > div[role="group"] {
                grid-column: 1 / -1 !important;
                order: 3 !important;
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                width: 100% !important;
                padding: 3px !important;
                border-radius: 12px !important;
                gap: 3px !important;
              }
              html.aida-ios-mobile [data-aida-translator-card="1"] > div:first-child > div:nth-child(2) > div[role="group"] > button {
                width: 100% !important;
                min-height: 32px !important;
                justify-content: center !important;
                border-radius: 9px !important;
                font-size: 10.5px !important;
                padding: 4px 4px !important;
              }
              /* Hide redundant "Yazarak Seslendir" toggle & duplicate small close button on mobile */
              html.aida-ios-mobile [data-aida-translator-card="1"] button[title*="Yazarak Çevir"],
              html.aida-ios-mobile [data-aida-translator-card="1"] button[aria-label="Canlı çeviri panelini kapat"] {
                display: none !important;
              }
              /* Language Selector Pill on Top Right of Control Row */
              html.aida-ios-mobile [data-aida-translator-card="1"] > div:first-child > div:nth-child(2) > div:has(select) {
                min-height: 36px !important;
                padding: 4px 10px !important;
                border-radius: 12px !important;
                display: flex !important;
                align-items: center !important;
              }
              /* Translator Chat Stream Area */
              html.aida-ios-mobile [data-aida-translator-card="1"] > div.max-h-72 {
                flex: 1 1 auto !important;
                max-height: none !important;
                min-height: 140px !important;
                border-radius: 16px !important;
                padding: 8px !important;
              }
              /* Translator Bottom Input Form ("Türkçe yanıt yazın" + "Çevir & Seslendir") */
              html.aida-ios-mobile [data-aida-translator-card="1"] > form {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 8px !important;
                padding-top: 8px !important;
              }
              html.aida-ios-mobile [data-aida-translator-card="1"] > form > input[type="text"] {
                width: 100% !important;
                min-height: 42px !important;
                padding: 10px 14px !important;
                border-radius: 14px !important;
                font-size: 13px !important;
              }
              html.aida-ios-mobile [data-aida-translator-card="1"] > form > button[type="submit"] {
                width: 100% !important;
                min-height: 42px !important;
                justify-content: center !important;
                border-radius: 14px !important;
                font-size: 13px !important;
              }

              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div {
                display: flex !important;
                flex-direction: column !important;
                flex: 1 1 auto !important;
                height: auto !important;
                gap: 10px !important;
                overflow: visible !important;
              }

              /* Compact Multi-Line / 2. Hat Bar (when "Yeni Hat" is tapped or 2 lines are active) */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-3\\.5.rounded-2xl {
                padding: 10px 12px !important;
                border-radius: 20px !important;
                gap: 8px !important;
              }

              /* Hide Desktop Hardware Mic/Speaker Bars & Desktop Inline CRM Card inside Call Card on mobile */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.grid.rounded-2xl,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.p-3\\.5.rounded-2xl,
              html.aida-ios-mobile [data-aida-call-audiobars="1"],
              html.aida-ios-mobile [data-aida-call-crm="1"] {
                display: none !important;
              }

              /* Hide Disposition & Call Note Bar inside Call Card unless "Not & Kod" button is opened */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-show-incall-notes="1"]) [data-aida-incall-notes-sheet="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-show-incall-notes="1"]) > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.pt-3.border-t {
                display: none !important;
              }

              /* When "Not & Kod" button is tapped, present Disposition & Call Note Bar as a Mobile Sheet Modal */
              #aida-ios-notes-sheet-header {
                display: none;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-incall-notes-sheet="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.pt-3.border-t {
                display: flex !important;
                flex-direction: column !important;
                gap: 14px !important;
                position: fixed !important;
                left: 14px !important;
                right: 14px !important;
                top: 46% !important;
                transform: translateY(-50%) !important;
                max-width: 390px !important;
                margin: 0 auto !important;
                padding: 18px 16px !important;
                border-radius: 26px !important;
                background: #ffffff !important;
                border: 1px solid rgba(226, 232, 240, 0.95) !important;
                z-index: 9700 !important;
                box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.45), 0 0 0 100vmax rgba(15, 23, 42, 0.55) !important;
              }
              html.dark.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-incall-notes-sheet="1"],
              html.dark.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.pt-3.border-t {
                background: #0f172a !important;
                border-color: rgba(51, 65, 85, 0.9) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] #aida-ios-notes-sheet-header {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
                width: 100% !important;
                padding-bottom: 12px !important;
                border-bottom: 1px solid rgba(148, 163, 184, 0.2) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-disp-row="1"] {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 10px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-disp-grid="1"] {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 8px 10px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-disp-grid="1"] > span:first-child {
                grid-column: 1 / -1 !important;
                margin-bottom: 2px !important;
                font-size: 11px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-disp-grid="1"] > button {
                width: 100% !important;
                min-height: 40px !important;
                padding: 8px 10px !important;
                border-radius: 13px !important;
                font-size: 12.5px !important;
                font-weight: 700 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                text-align: center !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-disp-grid="1"] > button:last-child:nth-of-type(odd) {
                grid-column: 1 / -1 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-disp-row="1"] > div:nth-child(2) > button {
                width: 100% !important;
                min-height: 40px !important;
                border-radius: 13px !important;
                justify-content: center !important;
                font-size: 12.5px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-input-row="1"] {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 10px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-input-row="1"] > div.relative {
                width: 100% !important;
                flex: 0 0 auto !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-input-row="1"] > div.relative input[type="text"] {
                width: 100% !important;
                min-height: 46px !important;
                font-size: 13px !important;
                padding: 11px 44px 11px 14px !important;
                border-radius: 14px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"][data-show-incall-notes="1"] [data-aida-notes-input-row="1"] > button {
                width: 100% !important;
                min-height: 46px !important;
                justify-content: center !important;
                border-radius: 14px !important;
                font-size: 13px !important;
              }

              /* Post-Call ACW ("Çağrı Sonrası İşlem") Mobile-Native Full Card Styling */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div {
                display: flex !important;
                flex-direction: column !important;
                height: auto !important;
                overflow: visible !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl {
                padding: 18px 16px !important;
                border-radius: 26px !important;
                gap: 14px !important;
                width: 100% !important;
                box-shadow: 0 12px 32px -8px rgba(15, 23, 42, 0.10) !important;
              }
              /* Top Header of ACW Card: Stack Identity + Close Button cleanly on mobile */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 12px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child {
                display: flex !important;
                align-items: flex-start !important;
                gap: 12px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:first-child {
                width: 42px !important;
                height: 42px !important;
                border-radius: 14px !important;
                flex-shrink: 0 !important;
                margin-top: 2px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) {
                flex: 1 1 0% !important;
                min-width: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 4px !important;
              }
              /* ACW Timer Pill & Talk Duration */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:first-child {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                gap: 6px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:first-child > span:first-child {
                font-size: 10.5px !important;
                padding: 4px 10px !important;
                letter-spacing: 0.01em !important;
              }
              /* Caller Name, Phone Number & 360 Card Button */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:nth-child(2) {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                gap: 6px 8px !important;
                margin-top: 2px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:nth-child(2) > h3 {
                font-size: 17px !important;
                font-weight: 800 !important;
                line-height: 1.2 !important;
              }
              /* ACW Kapat Button: Full-width subtle action bar */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > button {
                width: 100% !important;
                height: 38px !important;
                border-radius: 12px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px !important;
                background: rgba(241, 245, 249, 0.85) !important;
                font-size: 12px !important;
                font-weight: 700 !important;
              }
              html.dark.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > button {
                background: rgba(30, 41, 59, 0.85) !important;
              }
              /* ACW Body: Disposition Codes, AI Note Assistant, Full-Width Note Input & Side-by-Side Action Buttons */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t {
                padding-top: 14px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 14px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:first-child {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 10px !important;
              }
              /* Disposition Chips 2-Column Spacious Grid */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:first-child > div:first-child {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 8px 10px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:first-child > div:first-child > span:first-child {
                grid-column: 1 / -1 !important;
                margin-bottom: 2px !important;
                font-size: 11px !important;
                letter-spacing: 0.03em !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:first-child > div:first-child > button {
                width: 100% !important;
                min-height: 40px !important;
                padding: 9px 12px !important;
                border-radius: 13px !important;
                font-size: 12.5px !important;
                font-weight: 700 !important;
                text-align: center !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              /* If odd number of disposition buttons (e.g. 5th "İptal / Şikayet"), span full width cleanly */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:first-child > div:first-child > button:last-child:nth-of-type(odd) {
                grid-column: 1 / -1 !important;
              }
              /* AI Not Çıkar Button Row */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:first-child > div:nth-child(2) {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:first-child > div:nth-child(2) > button {
                width: 100% !important;
                min-height: 40px !important;
                border-radius: 13px !important;
                justify-content: center !important;
                font-size: 12.5px !important;
              }
              /* Bottom Input & Action Buttons Row: Full-width Note Input on top, 2 Action Buttons below */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:last-child {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) !important;
                gap: 10px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:last-child > div.relative {
                grid-column: 1 / -1 !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:last-child > div.relative input[type="text"] {
                width: 100% !important;
                min-height: 48px !important;
                padding: 12px 46px 12px 14px !important;
                border-radius: 14px !important;
                font-size: 13.5px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:last-child > div.relative button {
                right: 8px !important;
                width: 34px !important;
                height: 34px !important;
                border-radius: 10px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-acw-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div.border-t > div:last-child > button {
                width: 100% !important;
                min-height: 46px !important;
                padding: 10px 12px !important;
                border-radius: 14px !important;
                font-size: 13px !important;
                font-weight: 800 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px !important;
              }

              /* Wrapper inside Call Card: Top Caller Info + Call Controls */
              html.aida-ios-mobile [data-aida-call-card="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl {
                flex: 1 1 auto !important;
                height: calc(100dvh - 210px) !important;
                max-height: 530px !important;
                min-height: 390px !important;
                padding: 22px 18px 20px 18px !important;
                border-radius: 30px !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                overflow: hidden !important;
                box-shadow: 0 18px 40px -12px rgba(15, 23, 42, 0.12) !important;
              }
              html.aida-ios-mobile [data-aida-call-main-row="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child {
                flex: 1 1 auto !important;
                height: 100% !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: space-between !important;
                width: 100% !important;
                gap: 12px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] [data-aida-call-main-row="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child {
                justify-content: space-between !important;
                padding: 18px 4px 10px 4px !important;
                gap: 24px !important;
              }

              /* Centered Caller Identity Block at Top */
              html.aida-ios-mobile [data-aida-call-identity="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                text-align: center !important;
                width: 100% !important;
                gap: 10px !important;
                margin-top: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] [data-aida-call-identity="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child {
                gap: 14px !important;
                margin-top: 8px !important;
              }

              /* Circular Avatar / Phone Icon */
              html.aida-ios-mobile [data-aida-call-avatar="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:first-child {
                width: 56px !important;
                height: 56px !important;
                border-radius: 9999px !important;
                box-shadow: 0 10px 24px -6px rgba(16, 185, 129, 0.30) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] [data-aida-call-avatar="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:first-child {
                width: 88px !important;
                height: 88px !important;
                border-radius: 9999px !important;
                box-shadow: 0 0 0 10px rgba(245, 158, 11, 0.10), 0 14px 32px -6px rgba(245, 158, 11, 0.38) !important;
              }
              html.aida-ios-mobile [data-aida-call-avatar="1"] svg,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:first-child svg {
                width: 24px !important;
                height: 24px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] [data-aida-call-avatar="1"] svg,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:first-child svg {
                width: 36px !important;
                height: 36px !important;
              }

              /* Centered Status Badge Row ("Gelen Çağrı...", "Görüşme Aktif • 00:12") */
              html.aida-ios-mobile [data-aida-call-textblock="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                width: 100% !important;
                gap: 6px !important;
              }
              html.aida-ios-mobile [data-aida-call-textblock="1"] > div:first-child,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:first-child {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px !important;
              }
              html.aida-ios-mobile [data-aida-call-textblock="1"] > div:first-child > span:first-child,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:first-child > span:first-child {
                font-size: 11px !important;
                padding: 4px 12px !important;
                border-radius: 9999px !important;
              }

              /* Caller Name, Number & Quick Action Buttons ("Rehbere Ekle", "360° Kart", "CRM Aç") */
              html.aida-ios-mobile [data-aida-call-textblock="1"] > div:nth-child(2),
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:nth-child(2) {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px 8px !important;
                margin-top: 2px !important;
                text-align: center !important;
              }
              html.aida-ios-mobile [data-aida-call-textblock="1"] > div:nth-child(2) > h2,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:nth-child(2) > h2 {
                width: 100% !important;
                font-size: 22px !important;
                font-weight: 800 !important;
                line-height: 1.2 !important;
                text-align: center !important;
                word-break: break-word !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] [data-aida-call-textblock="1"] > div:nth-child(2) > h2,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:nth-child(2) > h2 {
                font-size: 26px !important;
                margin-top: 2px !important;
              }
              html.aida-ios-mobile [data-aida-call-textblock="1"] > div:nth-child(2) > span,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:nth-child(2) > span {
                width: 100% !important;
                font-size: 14px !important;
                margin-bottom: 2px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] [data-aida-call-textblock="1"] > div:nth-child(2) > span,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:nth-child(2) > span {
                font-size: 15.5px !important;
                margin-bottom: 4px !important;
              }
              html.aida-ios-mobile [data-aida-call-textblock="1"] > div:nth-child(2) > button,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:first-child > div:nth-child(2) > div:nth-child(2) > button {
                border-radius: 9999px !important;
                padding: 5px 12px !important;
                font-size: 11px !important;
              }

              /* INCOMING CALL (RINGING): Two Large Balanced Action Buttons (Reddet Left, Yanıtla Right) */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] #aida-ios-incall-keypad-btn,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] #aida-ios-incall-notes-btn {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] [data-aida-call-controls="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:last-child {
                width: 100% !important;
                align-self: stretch !important;
                min-height: 68px !important;
                flex-shrink: 0 !important;
                display: flex !important;
                flex-direction: row-reverse !important;
                flex-wrap: nowrap !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 14px !important;
                margin-top: auto !important;
                padding: 8px 4px 4px 4px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] [data-aida-call-controls="1"] > button,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:last-child > button {
                flex: 1 1 0% !important;
                min-width: 0 !important;
                max-width: calc(50% - 7px) !important;
                height: 60px !important;
                min-height: 60px !important;
                border-radius: 20px !important;
                font-size: 16px !important;
                font-weight: 800 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 10px !important;
                box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.22) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] [data-aida-call-controls="1"] > button svg,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-ringing="1"] > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:last-child > button svg {
                width: 22px !important;
                height: 22px !important;
              }

              /* ACTIVE CALL (IN-CALL / CALLING): 5x2 Symmetric Call Action Grid + Dedicated Bottom Centered Red Hangup Button */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) [data-aida-call-controls="1"],
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:last-child {
                width: 100% !important;
                max-width: 356px !important;
                margin: 4px auto 0 auto !important;
                display: grid !important;
                grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                gap: 22px 6px !important;
                justify-items: center !important;
                align-items: center !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) [data-aida-call-controls="1"] > div.relative,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) > div.grid > div:nth-child(2) > div > div.p-5.rounded-3xl > div:first-child > div:last-child > div.relative {
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-call-label] {
                position: relative !important;
                width: 50px !important;
                height: 50px !important;
                border-radius: 9999px !important;
                margin-bottom: 16px !important;
                box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.06) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-call-label] svg {
                width: 20px !important;
                height: 20px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-call-label]::after {
                content: attr(data-aida-call-label) !important;
                position: absolute !important;
                bottom: -18px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                font-size: 10.5px !important;
                font-weight: 700 !important;
                white-space: nowrap !important;
                color: #475569 !important;
                letter-spacing: -0.2px !important;
              }
              html.dark.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-call-label]::after {
                color: #94a3b8 !important;
              }

              /* 3 Distinct Visual States for "Ses Modu" (Noise Suppression): AI (Rose/Red), Standart (Blue), Kapalı (Slate) */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-incall-noise-mode="ai"] {
                background-color: rgba(244, 63, 94, 0.16) !important;
                border-color: rgba(244, 63, 94, 0.48) !important;
                color: #e11d48 !important;
                box-shadow: 0 6px 16px -3px rgba(244, 63, 94, 0.25) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-incall-noise-mode="ai"]::after {
                color: #e11d48 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-incall-noise-mode="standard"] {
                background-color: rgba(37, 99, 235, 0.16) !important;
                border-color: rgba(59, 130, 246, 0.52) !important;
                color: #2563eb !important;
                box-shadow: 0 6px 16px -3px rgba(37, 99, 235, 0.25) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-incall-noise-mode="standard"]::after {
                color: #2563eb !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-incall-noise-mode="off"] {
                background-color: rgba(241, 245, 249, 0.95) !important;
                border-color: rgba(203, 213, 225, 0.90) !important;
                color: #64748b !important;
              }
              html.dark.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[data-aida-incall-noise-mode="off"] {
                background-color: rgba(30, 41, 59, 0.85) !important;
                border-color: rgba(71, 85, 105, 0.85) !important;
                color: #94a3b8 !important;
              }

              /* Large Red Circular Hangup Button centered on its own dedicated bottom row */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[title="Çağrıyı Sonlandır"] {
                grid-column: 1 / -1 !important;
                justify-self: center !important;
                width: 64px !important;
                height: 64px !important;
                border-radius: 9999px !important;
                margin-top: 4px !important;
                box-shadow: 0 14px 28px -4px rgba(225, 29, 72, 0.50) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"][data-call-active="1"]:not([data-call-ringing="1"]) button[title="Çağrıyı Sonlandır"] svg {
                width: 25px !important;
                height: 25px !important;
              }

              /* Center Transfer & Conference Popovers on Mobile Screen with Solid Opaque Background & Searchable Directory List */
              html.aida-ios-mobile [data-aida-popover-open="1"] {
                z-index: 9800 !important;
              }
              html.aida-ios-mobile #aida-ios-active-popover-modal,
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] div.absolute.w-72 {
                position: fixed !important;
                left: 14px !important;
                right: 14px !important;
                top: 46% !important;
                transform: translateY(-50%) !important;
                width: auto !important;
                max-width: 380px !important;
                margin: 0 auto !important;
                padding: 18px 16px !important;
                border-radius: 26px !important;
                background: #ffffff !important;
                background-color: #ffffff !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                opacity: 1 !important;
                border: 1px solid rgba(226, 232, 240, 0.98) !important;
                z-index: 9900 !important;
                box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.55), 0 0 0 100vmax rgba(15, 23, 42, 0.65) !important;
              }
              html.dark.aida-ios-mobile #aida-ios-active-popover-modal,
              html.dark.aida-ios-mobile [data-aida-mobile-webphone="1"] div.absolute.w-72 {
                background: #0f172a !important;
                background-color: #0f172a !important;
                border-color: rgba(51, 65, 85, 0.98) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] div.absolute.w-72 input[type="text"] {
                min-height: 44px !important;
                padding: 10px 14px !important;
                border-radius: 14px !important;
                font-size: 13px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] div.absolute.w-72 button {
                min-height: 42px !important;
                border-radius: 14px !important;
                font-size: 13px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] div.absolute.w-72 > div:first-child button {
                min-height: 30px !important;
                width: 30px !important;
                height: 30px !important;
                border-radius: 10px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: rgba(148, 163, 184, 0.14) !important;
              }
              .aida-ios-dir-picker {
                max-height: 175px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding: 4px 2px;
                margin: 4px 0;
                border-top: 1px solid rgba(148, 163, 184, 0.18);
                border-bottom: 1px solid rgba(148, 163, 184, 0.18);
              }
              .aida-ios-dir-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 8px 10px;
                border-radius: 12px;
                background: rgba(248, 250, 252, 0.95);
                border: 1px solid rgba(226, 232, 240, 0.85);
                cursor: pointer;
                text-align: left;
                transition: all 0.15s ease;
              }
              html.dark .aida-ios-dir-item {
                background: rgba(30, 41, 59, 0.75);
                border-color: rgba(51, 65, 85, 0.85);
              }
              .aida-ios-dir-item[data-selected="1"] {
                background: rgba(16, 185, 129, 0.14) !important;
                border-color: rgba(16, 185, 129, 0.55) !important;
              }
              /* Balanced Dialpad Card without empty top/bottom voids */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:first-child > div {
                padding: 14px 16px 16px 16px !important;
                border-radius: 26px !important;
                flex: 1 1 auto !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-evenly !important;
                gap: 6px !important;
              }
              /* Status bar + Number Input Box */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:first-child > div > div:first-of-type {
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:first-child > div > div:first-of-type > div.relative {
                padding-top: 14px !important;
                padding-bottom: 14px !important;
                border-radius: 18px !important;
                margin-top: 0 !important;
              }
              /* Scope 22px font ONLY to Dialpad number input so Note/Transfer/Conference inputs stay clean 13px */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:first-child input[type="text"] {
                font-size: 22px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:nth-child(2) input[type="text"] {
                font-size: 13px !important;
              }
              /* Keypad Grid: True iPhone Circular Keys & Aligned Character Baselines */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] .grid.grid-cols-3 {
                width: 100% !important;
                max-width: 284px !important;
                margin: 0 auto !important;
                gap: 14px 22px !important;
                padding: 0 !important;
                justify-items: center !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] .grid.grid-cols-3 > button {
                width: 76px !important;
                height: 76px !important;
                border-radius: 9999px !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 3px !important;
                padding: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] .grid.grid-cols-3 > button > span:first-child {
                font-size: 28px !important;
                font-weight: 700 !important;
                line-height: 1 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] .grid.grid-cols-3 > button > span:nth-child(2) {
                font-size: 9.5px !important;
                font-weight: 800 !important;
                letter-spacing: 0.16em !important;
                padding-left: 0.16em !important;
                margin-top: 1px !important;
                line-height: 1 !important;
              }
              /* Invisible sub-label placeholder on key "1" so "1" aligns horizontally with "2" & "3" */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] .grid.grid-cols-3 > button:first-child::after {
                content: "A" !important;
                visibility: hidden !important;
                font-size: 9.5px !important;
                line-height: 1 !important;
                margin-top: 1px !important;
                display: block !important;
              }
              /* Balance "*" and "#" keys visually with "0 / +" */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] .grid.grid-cols-3 > button:nth-child(10) > span:first-child {
                font-size: 30px !important;
                transform: translateY(2px) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] .grid.grid-cols-3 > button:nth-child(12) > span:first-child {
                font-size: 25px !important;
              }
              /* iPhone-Style Circular Call Button with Handset Icon Only */
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:first-child > div > div:last-child {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding-top: 2px !important;
                padding-bottom: 2px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:first-child > div > div:last-child > button {
                width: 72px !important;
                height: 72px !important;
                min-width: 72px !important;
                min-height: 72px !important;
                border-radius: 9999px !important;
                padding: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-shadow: 0 10px 24px -4px rgba(16, 185, 129, 0.45) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:first-child > div > div:last-child > button > span {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:first-child > div > div:last-child > button > svg {
                width: 28px !important;
                height: 28px !important;
                margin: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:nth-child(2) .grid.grid-cols-1.md\\:grid-cols-2 {
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
                height: auto !important;
              }
              html.aida-ios-mobile [data-aida-mobile-webphone="1"] > div.grid > div:nth-child(2) .grid.grid-cols-1.md\\:grid-cols-2 > div {
                max-height: 260px !important;
                min-height: 180px !important;
              }

              /* ==============================================================
                 4b. AUDIO MODE BUTTON COLORS & SUPPRESS NOISE BANNER POPUP
                 ============================================================== */
              html.aida-ios-mobile [data-aida-noise-banner="1"] {
                display: none !important;
              }
              html.aida-ios-mobile button[data-aida-noise-mode] {
                padding: 4px 9px !important;
                border-radius: 9999px !important;
                font-size: 9.5px !important;
                font-weight: 800 !important;
                transition: all 0.16s ease !important;
              }
              html.aida-ios-mobile button[data-aida-noise-mode="ai"] {
                background-color: rgba(245, 158, 11, 0.16) !important;
                border-color: rgba(245, 158, 11, 0.48) !important;
                color: #d97706 !important;
              }
              html.dark.aida-ios-mobile button[data-aida-noise-mode="ai"] {
                background-color: rgba(245, 158, 11, 0.22) !important;
                border-color: rgba(245, 158, 11, 0.52) !important;
                color: #fbbf24 !important;
              }
              html.aida-ios-mobile button[data-aida-noise-mode="standard"] {
                background-color: rgba(16, 185, 129, 0.16) !important;
                border-color: rgba(16, 185, 129, 0.48) !important;
                color: #059669 !important;
              }
              html.dark.aida-ios-mobile button[data-aida-noise-mode="standard"] {
                background-color: rgba(16, 185, 129, 0.22) !important;
                border-color: rgba(16, 185, 129, 0.52) !important;
                color: #34d399 !important;
              }
              html.aida-ios-mobile button[data-aida-noise-mode="off"] {
                background-color: rgba(244, 63, 94, 0.14) !important;
                border-color: rgba(244, 63, 94, 0.42) !important;
                color: #e11d48 !important;
              }
              html.dark.aida-ios-mobile button[data-aida-noise-mode="off"] {
                background-color: rgba(244, 63, 94, 0.22) !important;
                border-color: rgba(244, 63, 94, 0.48) !important;
                color: #fb7185 !important;
              }

              /* ==============================================================
                 5. REMOVE REFRESH BUTTONS ACROSS HISTORY, CHAT, MISSED & VOICEMAIL
                 ============================================================== */
              html.aida-ios-mobile button[title="Listeyi Yenile"],
              html.aida-ios-mobile button[title="Sesli postaları yenile"],
              html.aida-ios-mobile button[title="Yenile"],
              html.aida-ios-mobile button[title*="Yenile"],
              html.aida-ios-mobile button[title*="yenile"] {
                display: none !important;
              }

              /* ==============================================================
                 6. ÇAĞRI GEÇMİŞİ (HISTORY TAB) HEADER & MOBILE CARD LIST
                 ============================================================== */
              /* Hide "Kişisel Çağrı Geçmişim" title & keep Filter/Search on the right */
              html.aida-ios-mobile [data-aida-mobile-history="1"] > div > div:first-child {
                display: flex !important;
                flex-wrap: nowrap !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 8px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] > div > div:first-child > div:first-child {
                display: flex !important;
                flex-wrap: nowrap !important;
                align-items: center !important;
                gap: 6px !important;
                min-width: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] > div > div:first-child > div:first-child > h2 {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] > div > div:first-child > div:last-child {
                margin-left: auto !important;
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                flex-shrink: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] > div > div:first-child > div:last-child > div:first-child.w-64 {
                width: 175px !important;
                max-width: 175px !important;
              }
              /* Convert History 6-column Table into Zero-Scroll Mobile Cards */
              html.aida-ios-mobile [data-aida-mobile-history="1"] .overflow-x-auto {
                overflow-x: hidden !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] table {
                display: block !important;
                width: 100% !important;
                min-width: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] thead {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody {
                display: flex !important;
                flex-direction: column !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody > tr {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) auto auto !important;
                grid-template-rows: auto auto !important;
                gap: 7px 10px !important;
                padding: 12px 14px !important;
                align-items: center !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody > tr > td {
                padding: 0 !important;
                border: none !important;
              }
              /* Row 1 Left: Caller Name & Number (td:nth-child(3)) */
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody > tr > td:nth-child(3) {
                grid-column: 1 / 2 !important;
                grid-row: 1 !important;
                min-width: 0 !important;
              }
              /* Row 1 Right: Call / Transcript / Play Actions (td:nth-child(6)) */
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody > tr > td:nth-child(6) {
                grid-column: 2 / 4 !important;
                grid-row: 1 !important;
                justify-self: end !important;
              }
              /* Row 2 Left: Direction Badge (td:nth-child(2)) */
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody > tr > td:nth-child(2) {
                grid-column: 1 / 2 !important;
                grid-row: 2 !important;
                justify-self: start !important;
              }
              /* Row 2 Middle: Duration (td:nth-child(5)) */
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody > tr > td:nth-child(5) {
                grid-column: 2 / 3 !important;
                grid-row: 2 !important;
                justify-self: end !important;
                font-size: 11.5px !important;
                font-variant-numeric: tabular-nums !important;
                white-space: nowrap !important;
              }
              /* Row 2 Right: Timestamp (td:nth-child(1)) - Remove Red LED & align tabular numbers */
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody > tr > td:nth-child(1) {
                grid-column: 3 / 4 !important;
                grid-row: 2 !important;
                justify-self: end !important;
                font-size: 11px !important;
                font-variant-numeric: tabular-nums !important;
                white-space: nowrap !important;
                opacity: 0.85 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody > tr > td:nth-child(1) span.rounded-full {
                display: none !important;
              }
              /* Hide redundant status column (td:nth-child(4)) since badge + duration show it */
              html.aida-ios-mobile [data-aida-mobile-history="1"] tbody > tr > td:nth-child(4) {
                display: none !important;
              }

              /* ==============================================================
                 6b. KAYIP ÇAĞRILAR (MISSED CALLS TAB) HEADER & MOBILE CARD LIST
                 ============================================================== */
              html.aida-ios-mobile [data-aida-mobile-missed="1"] > div > div:first-child {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 10px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] > div > div:first-child h2 {
                display: none !important;
              }
              /* Legacy & updated DOM structure support for Switcher Pills */
              html.aida-ios-mobile [data-aida-mobile-missed="1"] > div > div:first-child > div:first-child {
                width: 100% !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] div.inline-flex.p-1.rounded-xl,
              html.aida-ios-mobile [data-aida-mobile-missed="1"] div.grid.grid-cols-2.p-1.rounded-xl {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                width: 100% !important;
                padding: 4px !important;
                border-radius: 14px !important;
                gap: 4px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] div.inline-flex.p-1.rounded-xl > button,
              html.aida-ios-mobile [data-aida-mobile-missed="1"] div.grid.grid-cols-2.p-1.rounded-xl > button {
                width: 100% !important;
                justify-content: center !important;
                padding: 8px 10px !important;
                border-radius: 10px !important;
                font-size: 12px !important;
              }
              /* Search + Filter + Red Plus Button Row: Stretch Search to 100% and pin + to right */
              html.aida-ios-mobile [data-aida-mobile-missed="1"] > div > div:first-child > div:last-child {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 8px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] > div > div:first-child > div:last-child > select {
                height: 38px !important;
                border-radius: 12px !important;
                font-size: 12px !important;
                padding: 0 10px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] > div > div:first-child > div:last-child div:has(> input[placeholder*="Numara veya kişi ara"]) {
                flex: 1 1 0% !important;
                width: auto !important;
                min-width: 140px !important;
                max-width: none !important;
                height: 38px !important;
                border-radius: 12px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] button[title="Yeni Geri Arama Hatırlatıcısı Ekle"] {
                width: 38px !important;
                height: 38px !important;
                border-radius: 12px !important;
                flex-shrink: 0 !important;
                margin-left: auto !important;
              }
              /* Convert Missed Calls 5-column Table into Zero-Scroll Mobile Cards */
              html.aida-ios-mobile [data-aida-mobile-missed="1"] .overflow-x-auto {
                overflow-x: hidden !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] table {
                display: block !important;
                width: 100% !important;
                min-width: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] thead {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] tbody {
                display: flex !important;
                flex-direction: column !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] tbody > tr {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 8px 10px !important;
                padding: 12px 14px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] tbody > tr > td {
                padding: 0 !important;
                border: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] tbody > tr > td:first-child {
                flex: 1 1 55% !important;
                min-width: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-missed="1"] tbody > tr > td:last-child {
                margin-left: auto !important;
              }

              /* ==============================================================
                 6c. SESLİ POSTA KUTUSU (VOICEMAIL TAB) MOBILE HEADER & CARDS
                 ============================================================== */
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div {
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
              }
              /* Strip bulky outer header box and hide redundant title/icon block */
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div:first-child {
                padding: 0 !important;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                gap: 0 !important;
                margin: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div:first-child > div:first-child {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div:first-child > div:last-child {
                width: 100% !important;
                display: block !important;
              }
              /* Full-width 2-column segmented switcher: Tümü (X) | Okunmamış (Y) */
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div:first-child > div:last-child > div:first-child {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                width: 100% !important;
                padding: 4px !important;
                border-radius: 14px !important;
                gap: 4px !important;
                background: #ffffff !important;
                border: 1px solid rgba(226, 232, 240, 0.85) !important;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
              }
              html.dark.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div:first-child > div:last-child > div:first-child {
                background: #0f172a !important;
                border-color: rgba(30, 41, 59, 0.85) !important;
              }
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div:first-child > div:last-child > div:first-child > button {
                width: 100% !important;
                justify-content: center !important;
                text-align: center !important;
                padding: 8px 10px !important;
                border-radius: 10px !important;
                font-size: 12px !important;
                font-weight: 800 !important;
              }
              /* Compact Search Input */
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div:nth-child(2) {
                margin-top: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div:nth-child(2) input {
                height: 38px !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                border-radius: 12px !important;
                font-size: 12px !important;
              }
              /* Compact Voicemail Cards */
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div.space-y-3 {
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
                margin-top: 0 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div.space-y-3 > div {
                margin-top: 0 !important;
                padding: 13px 14px !important;
                border-radius: 18px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div.space-y-3 > div > div.flex.flex-col {
                gap: 10px !important;
              }
              /* Audio Player + Action Bar inside Voicemail Card */
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div.space-y-3 > div > div.flex.flex-col > div:last-child {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 9px !important;
                width: 100% !important;
                max-width: 100% !important;
              }
              /* Action Buttons Row: Stretch "Geri Ara" & align Read/Delete cleanly, hide desktop .wav download */
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] > div > div.space-y-3 > div > div.flex.flex-col > div:last-child > div:last-child {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] button[title="Geri Ara"] {
                flex: 1 1 0% !important;
                justify-content: center !important;
                height: 36px !important;
                border-radius: 11px !important;
                font-size: 12px !important;
                font-weight: 800 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] a[download] {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] button[title*="Okun"],
              html.aida-ios-mobile [data-aida-mobile-voicemail="1"] button[title="Sesli Mesajı Sil"] {
                width: 36px !important;
                height: 36px !important;
                border-radius: 11px !important;
                flex-shrink: 0 !important;
              }
              html.aida-ios-mobile div.fixed.bottom-6.left-1\\/2.-translate-x-1\\/2,
              html.aida-ios-mobile [data-aida-mobile-audio-popup="1"] {
                bottom: calc(78px + env(safe-area-inset-bottom, 14px)) !important;
                width: calc(100vw - 24px) !important;
                max-width: 420px !important;
                border-radius: 22px !important;
                padding: 14px !important;
              }
              html.aida-ios-mobile:not(.dark) div.fixed.bottom-6.left-1\\/2.-translate-x-1\\/2,
              html.aida-ios-mobile:not(.dark) [data-aida-mobile-audio-popup="1"] {
                background-color: rgba(255, 255, 255, 0.98) !important;
                backdrop-filter: blur(20px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
                border: 1px solid #cbd5e1 !important;
                box-shadow: 0 20px 44px -10px rgba(15, 23, 42, 0.24), 0 4px 14px -2px rgba(15, 23, 42, 0.08) !important;
              }
              html.aida-ios-mobile:not(.dark) div.fixed.bottom-6.left-1\\/2.-translate-x-1\\/2 p.text-white,
              html.aida-ios-mobile:not(.dark) [data-aida-mobile-audio-popup="1"] p.text-white {
                color: #0f172a !important;
              }
              html.aida-ios-mobile:not(.dark) div.fixed.bottom-6.left-1\\/2.-translate-x-1\\/2 p.text-slate-400,
              html.aida-ios-mobile:not(.dark) [data-aida-mobile-audio-popup="1"] p.text-slate-400 {
                color: #64748b !important;
              }
              html.aida-ios-mobile:not(.dark) div.fixed.bottom-6.left-1\\/2.-translate-x-1\\/2 button[title="Kapat"],
              html.aida-ios-mobile:not(.dark) [data-aida-mobile-audio-popup="1"] button[title="Kapat"] {
                background-color: #f1f5f9 !important;
                color: #475569 !important;
              }

              /* ==============================================================
                 7. ALL OTHER TABS BOTTOM PADDING FOR FLOATING BUBBLE BAR
                 ============================================================== */
              html.aida-ios-mobile .aida-stage-active > div.aida-panel-enter > div.flex.h-full.w-full > div.flex-1 > div > div:not([data-aida-mobile-chat-root="1"]) {
                padding: 12px 12px calc(92px + env(safe-area-inset-bottom, 16px)) 12px !important;
              }
              html.aida-ios-mobile .aida-stagger-grid.grid-cols-2 {
                gap: 8px !important;
              }
              html.aida-ios-mobile .aida-stagger-grid.grid-cols-2 > div {
                padding: 12px 10px !important;
                border-radius: 16px !important;
              }
              html.aida-ios-mobile .aida-stagger-grid.grid-cols-2 > div .text-3xl {
                font-size: 22px !important;
                line-height: 1.2 !important;
                margin-top: 4px !important;
              }
              html.aida-ios-mobile .aida-stagger-grid.grid-cols-2 > div .text-2xl {
                font-size: 18px !important;
                line-height: 1.2 !important;
                margin-top: 4px !important;
              }

              /* ==============================================================
                 8. SOHBET (CHAT TAB) FULL-BLEED MOBILE MASTER-DETAIL VIEW
                 ============================================================== */
              html.aida-ios-mobile div[data-aida-mobile-chat-root="1"] {
                padding: 0 0 calc(76px + env(safe-area-inset-bottom, 14px)) 0 !important;
                height: 100% !important;
                overflow: hidden !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-chat-root="1"] > div {
                gap: 0 !important;
                margin: 0 !important;
                height: 100% !important;
              }
              /* Hide "Takım İçi Sohbet ve Bana Atananlar" top title bar on mobile */
              html.aida-ios-mobile div[data-aida-mobile-chat-root="1"] > div > div:first-child {
                display: none !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] {
                position: relative !important;
                width: 100% !important;
                height: 100% !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                margin: 0 !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div[role="separator"] {
                display: none !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"]:not([data-mobile-chat-view="thread"]) > div:first-child {
                width: 100% !important;
                max-width: 100% !important;
                flex: 1 1 100% !important;
                height: 100% !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"]:not([data-mobile-chat-view="thread"]) > div:last-child {
                display: none !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"][data-mobile-chat-view="thread"] > div:first-child {
                display: none !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"][data-mobile-chat-view="thread"] > div:last-child {
                display: flex !important;
                flex-direction: column !important;
                width: 100% !important;
                max-width: 100% !important;
                flex: 1 1 100% !important;
                height: 100% !important;
                overflow: hidden !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:first-child > div:first-child {
                padding: 10px 12px !important;
              }
              /* Chat Thread Header: Clean Single-Row Flex Layout without Overflow */
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.h-16 {
                height: 56px !important;
                min-height: 56px !important;
                padding: 0 10px !important;
                gap: 8px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                overflow: hidden !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.h-16 > div:first-child {
                flex: 1 1 0% !important;
                min-width: 0 !important;
                gap: 8px !important;
                display: flex !important;
                align-items: center !important;
                overflow: hidden !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.h-16 > div:first-child .w-10.h-10 {
                width: 34px !important;
                height: 34px !important;
                font-size: 13px !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.h-16 > div:first-child > div:last-child {
                flex: 1 1 0% !important;
                min-width: 0 !important;
                overflow: hidden !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.h-16 h3 {
                display: block !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                font-size: 13px !important;
                line-height: 1.25 !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.h-16 h3 .aida-info-btn {
                display: none !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.h-16 p {
                display: block !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                font-size: 10px !important;
                line-height: 1.2 !important;
                margin-top: 2px !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.h-16 > div:last-child {
                flex-shrink: 0 !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.h-16 > div:last-child button {
                padding: 6px 9px !important;
                font-size: 10.5px !important;
                border-radius: 10px !important;
                white-space: nowrap !important;
              }
              html.aida-ios-mobile .aida-mobile-chat-back-btn {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 3px !important;
                padding: 6px 9px !important;
                border-radius: 10px !important;
                font-size: 11px !important;
                font-weight: 800 !important;
                background: rgba(225, 29, 72, 0.12) !important;
                color: #f43f5e !important;
                border: 1px solid rgba(225, 29, 72, 0.25) !important;
                margin-right: 2px !important;
                flex-shrink: 0 !important;
              }
              /* Chat Thread Messages Area & Email Card Mobile Sizing */
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.flex-1.overflow-y-auto {
                padding: 12px !important;
              }
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.flex-1.overflow-y-auto > div.max-w-\\[92\\%\\] {
                max-width: 100% !important;
                width: 100% !important;
              }
              /* Chat Thread Bottom Reply Input Area */
              html.aida-ios-mobile div[style*="--agent-sidebar-w"] > div:last-child > div.p-4.border-t {
                padding: 8px 10px !important;
              }
              html.aida-ios-mobile #agent-chat-reply-input {
                min-height: 40px !important;
                max-height: 72px !important;
                height: 40px !important;
                padding: 9px 12px !important;
                font-size: 14px !important;
                line-height: 1.35 !important;
              }

              html.aida-ios-mobile table:not([data-aida-mobile-history="1"] table):not([data-aida-mobile-missed="1"] table) {
                min-width: 540px !important;
              }
              html.aida-ios-mobile div:has(> table):not([data-aida-mobile-history="1"] div):not([data-aida-mobile-missed="1"] div) {
                overflow-x: auto !important;
                -webkit-overflow-scrolling: touch !important;
              }

              html.aida-ios-mobile .aida-stage-active .grid.grid-cols-1.xl\\:grid-cols-12 {
                display: flex !important;
                flex-direction: column !important;
                gap: 12px !important;
              }

              /* ==============================================================
                 7. FULL-SCREEN PROFILE PAGE & MODALS ON 393px SCREEN
                 ============================================================== */
              html.aida-ios-mobile header.aida-app-topbar .w-80,
              html.aida-ios-mobile header.aida-app-topbar .w-96 {
                max-width: calc(100vw - 20px) !important;
                right: 0 !important;
              }

              /* Full-Screen Profile Page when Avatar is tapped */
              html.aida-ios-mobile[data-aida-profile-open="1"] header.aida-app-topbar {
                z-index: 9600 !important;
              }
              html.aida-ios-mobile[data-aida-profile-open="1"] #aida-ios-bottom-dock,
              html.aida-ios-mobile[data-aida-profile-open="1"] #aida-ios-more-popover,
              html.aida-ios-mobile[data-aida-profile-open="1"] #aida-ios-more-backdrop {
                display: none !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                max-width: 100vw !important;
                height: 100vh !important;
                height: 100dvh !important;
                max-height: 100dvh !important;
                margin: 0 !important;
                border-radius: 0 !important;
                border: none !important;
                z-index: 9600 !important;
                display: flex !important;
                flex-direction: column !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding-top: env(safe-area-inset-top, 54px) !important;
                padding-bottom: calc(16px + env(safe-area-inset-bottom, 14px)) !important;
                background: #f8fafc !important;
                box-shadow: none !important;
              }
              html.aida-ios-mobile.dark div[data-aida-mobile-profile-page="1"] {
                background: #020617 !important;
              }

              /* Top Navigation Bar inside Full-Screen Profile Page */
              .aida-mobile-profile-topbar {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 8px 16px 12px 16px !important;
                border-bottom: 1px solid rgba(226, 232, 240, 0.9) !important;
                background: #ffffff !important;
                flex-shrink: 0 !important;
              }
              html.dark .aida-mobile-profile-topbar {
                background: #0f172a !important;
                border-bottom: 1px solid rgba(30, 41, 59, 0.9) !important;
              }
              .aida-mobile-profile-back-btn {
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;
                padding: 7px 12px !important;
                border-radius: 12px !important;
                font-size: 13px !important;
                font-weight: 800 !important;
                border: 1px solid rgba(203, 213, 225, 0.8) !important;
                background: #f8fafc !important;
                color: #0f172a !important;
                cursor: pointer !important;
              }
              html.dark .aida-mobile-profile-back-btn {
                background: #1e293b !important;
                border-color: rgba(51, 65, 85, 0.8) !important;
                color: #f8fafc !important;
              }
              .aida-mobile-profile-title {
                font-size: 15px !important;
                font-weight: 800 !important;
                color: #0f172a !important;
              }
              html.dark .aida-mobile-profile-title {
                color: #f8fafc !important;
              }
              .aida-mobile-profile-theme-btn {
                width: 36px !important;
                height: 36px !important;
                border-radius: 12px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border: 1px solid rgba(203, 213, 225, 0.8) !important;
                background: #f8fafc !important;
                color: #334155 !important;
                cursor: pointer !important;
              }
              html.dark .aida-mobile-profile-theme-btn {
                background: #1e293b !important;
                border-color: rgba(51, 65, 85, 0.8) !important;
                color: #fbbf24 !important;
              }

              /* User Header Card inside Full-Screen Profile Page */
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-3\\.5 {
                margin: 14px 16px 6px 16px !important;
                padding: 16px !important;
                border-radius: 20px !important;
                background: #ffffff !important;
                border: 1px solid rgba(226, 232, 240, 0.9) !important;
                box-shadow: 0 4px 14px -4px rgba(15, 23, 42, 0.05) !important;
              }
              html.aida-ios-mobile.dark div[data-aida-mobile-profile-page="1"] > div.p-3\\.5 {
                background: #0f172a !important;
                border: 1px solid rgba(30, 41, 59, 0.9) !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-3\\.5 img {
                width: 52px !important;
                height: 52px !important;
                border-radius: 16px !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-3\\.5 h4 {
                font-size: 15px !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-3\\.5 p {
                font-size: 12px !important;
              }

              /* Active Profile Switcher Card inside Full-Screen Profile Page */
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-3 {
                margin: 6px 16px !important;
                padding: 16px !important;
                border-radius: 20px !important;
                background: #ffffff !important;
                border: 1px solid rgba(226, 232, 240, 0.9) !important;
                box-shadow: 0 4px 14px -4px rgba(15, 23, 42, 0.05) !important;
              }
              html.aida-ios-mobile.dark div[data-aida-mobile-profile-page="1"] > div.p-3 {
                background: #0f172a !important;
                border: 1px solid rgba(30, 41, 59, 0.9) !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-3 > div.grid {
                gap: 10px !important;
                margin-top: 10px !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-3 > div.grid > button {
                min-height: 46px !important;
                padding: 10px 14px !important;
                border-radius: 14px !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-3 > div.grid > button span.text-\\[11px\\] {
                font-size: 13px !important;
              }

              /* Options & Bottom Red Logout Bar inside Full-Screen Profile Page */
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-1\\.5 {
                flex: 1 1 auto !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
                padding: 6px 16px 0 16px !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-1\\.5 > button:not([data-aida-mobile-logout-btn="1"]):not([data-aida-hide-profile-settings-btn="1"]):not([data-aida-hide-app-download="1"]) {
                background: #ffffff !important;
                border: 1px solid rgba(226, 232, 240, 0.9) !important;
                border-radius: 16px !important;
                padding: 13px 16px !important;
                font-size: 14px !important;
                min-height: 48px !important;
                box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.04) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: flex-start !important;
                gap: 12px !important;
              }
              html.aida-ios-mobile.dark div[data-aida-mobile-profile-page="1"] > div.p-1\\.5 > button:not([data-aida-mobile-logout-btn="1"]):not([data-aida-hide-profile-settings-btn="1"]):not([data-aida-hide-app-download="1"]) {
                background: #0f172a !important;
                border: 1px solid rgba(30, 41, 59, 0.9) !important;
              }

              /* Hide "Profil Ayarları" & "Uygulamalar & İndir" on mobile Avatar page */
              html.aida-ios-mobile [data-aida-hide-profile-settings-btn="1"],
              html.aida-ios-mobile [data-aida-hide-app-download="1"] {
                display: none !important;
              }

              /* Hide divider line before Logout button */
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] > div.p-1\\.5 > div.h-px {
                display: none !important;
              }

              /* Full-width Red Logout Strip at the very bottom of Profile Page */
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] button[data-aida-mobile-logout-btn="1"] {
                margin-top: auto !important;
                width: 100% !important;
                height: 52px !important;
                min-height: 52px !important;
                border-radius: 16px !important;
                background: linear-gradient(135deg, #e11d48 0%, #be123c 100%) !important;
                color: #ffffff !important;
                border: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 10px !important;
                font-size: 14px !important;
                font-weight: 800 !important;
                box-shadow: 0 10px 24px -6px rgba(225, 29, 72, 0.45) !important;
              }
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] button[data-aida-mobile-logout-btn="1"] svg,
              html.aida-ios-mobile div[data-aida-mobile-profile-page="1"] button[data-aida-mobile-logout-btn="1"] span {
                color: #ffffff !important;
                stroke: #ffffff !important;
              }

              /* ==============================================================
                 7b. FULL-SCREEN MOBILE PROFILE SETTINGS (MASTER LIST -> DETAIL)
                 ============================================================== */
              html.aida-ios-mobile[data-aida-settings-open="1"] #aida-ios-bottom-dock,
              html.aida-ios-mobile[data-aida-settings-open="1"] #aida-ios-more-popover,
              html.aida-ios-mobile[data-aida-settings-open="1"] #aida-ios-more-backdrop {
                display: none !important;
              }

              html.aida-ios-mobile div.fixed.inset-0.z-\\[150\\] {
                padding: 0 !important;
                z-index: 9700 !important;
                background: #f8fafc !important;
              }
              html.aida-ios-mobile.dark div.fixed.inset-0.z-\\[150\\] {
                background: #020617 !important;
              }

              html.aida-ios-mobile .aida-settings-modal-dialog {
                width: 100vw !important;
                max-width: 100vw !important;
                height: 100vh !important;
                height: 100dvh !important;
                max-height: 100dvh !important;
                margin: 0 !important;
                border-radius: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: #f8fafc !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
              }
              html.aida-ios-mobile.dark .aida-settings-modal-dialog {
                background: #020617 !important;
              }

              /* Settings Top Header Bar with Safe Area */
              html.aida-ios-mobile .aida-settings-modal-dialog > div:first-child {
                padding: calc(8px + env(safe-area-inset-top, 54px)) 16px 12px 16px !important;
                background: #ffffff !important;
                border-bottom: 1px solid rgba(226, 232, 240, 0.9) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 10px !important;
                flex-shrink: 0 !important;
              }
              html.aida-ios-mobile.dark .aida-settings-modal-dialog > div:first-child {
                background: #0f172a !important;
                border-bottom: 1px solid rgba(30, 41, 59, 0.9) !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog > div:first-child > div:first-child > div:first-child {
                display: none !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog > div:first-child p {
                display: none !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog > div:first-child h3 {
                font-size: 15px !important;
                font-weight: 800 !important;
                text-transform: none !important;
                letter-spacing: -0.2px !important;
                color: #0f172a !important;
              }
              html.aida-ios-mobile.dark .aida-settings-modal-dialog > div:first-child h3 {
                color: #f8fafc !important;
              }

              .aida-mobile-settings-back-btn {
                display: inline-flex !important;
                align-items: center !important;
                gap: 5px !important;
                padding: 7px 12px !important;
                border-radius: 12px !important;
                font-size: 13px !important;
                font-weight: 800 !important;
                border: 1px solid rgba(203, 213, 225, 0.85) !important;
                background: #f8fafc !important;
                color: #0f172a !important;
                cursor: pointer !important;
                flex-shrink: 0 !important;
              }
              html.dark .aida-mobile-settings-back-btn {
                background: #1e293b !important;
                border-color: rgba(51, 65, 85, 0.85) !important;
                color: #f8fafc !important;
              }

              /* Body wrapper inside .aida-settings-modal-dialog */
              html.aida-ios-mobile .aida-settings-modal-dialog > div:nth-child(2) {
                flex: 1 1 0% !important;
                min-height: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
              }

              /* STATE 1: MASTER LIST VIEW (data-mobile-settings-view="list") */
              html.aida-ios-mobile .aida-settings-modal-dialog[data-mobile-settings-view="list"] .aida-settings-modal-sidebar {
                flex: 1 1 0% !important;
                width: 100% !important;
                height: auto !important;
                max-height: none !important;
                padding: 14px 16px 24px 16px !important;
                border: none !important;
                background: transparent !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog[data-mobile-settings-view="list"] .aida-settings-modal-sidebar > nav {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 10px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog[data-mobile-settings-view="list"] .aida-settings-modal-sidebar > nav > button:not([data-aida-hide-settings-tab="1"]):not([data-aida-hide-app-download="1"]) {
                margin: 0 !important;
                width: 100% !important;
                min-height: 54px !important;
                padding: 14px 16px !important;
                border-radius: 16px !important;
                font-size: 14px !important;
                font-weight: 700 !important;
                background: #ffffff !important;
                border: 1px solid rgba(226, 232, 240, 0.9) !important;
                color: #0f172a !important;
                box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.04) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: flex-start !important;
                gap: 12px !important;
              }
              html.aida-ios-mobile.dark .aida-settings-modal-dialog[data-mobile-settings-view="list"] .aida-settings-modal-sidebar > nav > button:not([data-aida-hide-settings-tab="1"]):not([data-aida-hide-app-download="1"]) {
                background: #0f172a !important;
                border: 1px solid rgba(30, 41, 59, 0.9) !important;
                color: #f8fafc !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog .aida-settings-modal-sidebar > nav > button[data-aida-hide-settings-tab="1"],
              html.aida-ios-mobile .aida-settings-modal-dialog .aida-settings-modal-sidebar > nav > button[data-aida-hide-app-download="1"] {
                display: none !important;
              }
              .aida-mobile-tab-chevron {
                margin-left: auto !important;
                font-size: 18px !important;
                font-weight: 700 !important;
                color: #94a3b8 !important;
                line-height: 1 !important;
              }

              /* In LIST mode, hide the right detail scroll pane, keep only the bottom footer */
              html.aida-ios-mobile .aida-settings-modal-dialog[data-mobile-settings-view="list"] > div:nth-child(2) > div:nth-child(2) {
                flex: 0 0 auto !important;
                min-height: 0 !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog[data-mobile-settings-view="list"] > div:nth-child(2) > div:nth-child(2) > div:first-child {
                display: none !important;
              }

              /* STATE 2: DETAIL VIEW (data-mobile-settings-view="detail") */
              html.aida-ios-mobile .aida-settings-modal-dialog[data-mobile-settings-view="detail"] .aida-settings-modal-sidebar {
                display: none !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog[data-mobile-settings-view="detail"] > div:nth-child(2) > div:nth-child(2) {
                flex: 1 1 0% !important;
                min-height: 0 !important;
                width: 100% !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog[data-mobile-settings-view="detail"] > div:nth-child(2) > div:nth-child(2) > div:first-child {
                flex: 1 1 0% !important;
                min-height: 0 !important;
                width: 100% !important;
                padding: 14px 16px 24px 16px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                -webkit-overflow-scrolling: touch !important;
              }

              /* Remove nested scroll traps inside detail views */
              html.aida-ios-mobile .aida-settings-modal-dialog .max-h-\\[62vh\\],
              html.aida-ios-mobile .aida-settings-modal-dialog .max-h-\\[65vh\\] {
                max-height: none !important;
                overflow: visible !important;
                padding-right: 0 !important;
              }

              /* Hide non-mobile tabs in Profil Ayarları master list */
              html.aida-ios-mobile [data-aida-hide-settings-tab="1"] {
                display: none !important;
              }

              /* Mobile-friendly Detail Content Adaptations */
              /* 1. Avatar & Tema */
              html.aida-ios-mobile .aida-settings-modal-dialog button[title*="basılı tutun"],
              html.aida-ios-mobile .aida-settings-modal-dialog [role="group"][aria-label="Avatar kategori filtresi"],
              html.aida-ios-mobile [data-aida-hide-ui-templates="1"],
              html.aida-ios-mobile [data-aida-hide-360-toggle="1"],
              html.aida-ios-mobile [data-aida-hide-auto-theme-orig="1"],
              html.aida-ios-mobile [data-aida-hide-desc="1"],
              html.aida-ios-mobile [data-aida-hide-security-item="1"] {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-avatar-upload-btn="1"] {
                width: 38px !important;
                height: 38px !important;
                min-width: 38px !important;
                padding: 0 !important;
                border-radius: 12px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              html.aida-ios-mobile [data-aida-mobile-avatar-upload-btn="1"] > span {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-avatar-upload-btn="1"] > svg {
                width: 16px !important;
                height: 16px !important;
                margin: 0 !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog .grid.grid-cols-5 {
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 8px !important;
                max-height: 240px !important;
              }

              /* Mobile 3-Option Theme Mode & Animation Selectors */
              .aida-mobile-theme-mode-box {
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
              }
              .aida-mobile-theme-mode-label {
                font-size: 11px !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.04em !important;
                color: #1e293b !important;
              }
              html.dark .aida-mobile-theme-mode-label {
                color: #f8fafc !important;
              }
              .aida-mobile-theme-mode-grid {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 8px !important;
              }
              .aida-mobile-theme-mode-btn {
                height: 44px !important;
                border-radius: 12px !important;
                border: 1px solid rgba(203, 213, 225, 0.9) !important;
                background: #ffffff !important;
                color: #334155 !important;
                font-size: 12px !important;
                font-weight: 800 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px !important;
                cursor: pointer !important;
                transition: all 0.16s ease !important;
                padding: 0 8px !important;
              }
              html.dark .aida-mobile-theme-mode-btn {
                background: #0f172a !important;
                border-color: rgba(51, 65, 85, 0.9) !important;
                color: #cbd5e1 !important;
              }
              .aida-mobile-theme-mode-btn[data-active="1"] {
                background: rgb(var(--color-primary, 217 119 6)) !important;
                border-color: transparent !important;
                color: #ffffff !important;
                box-shadow: 0 6px 16px -4px rgba(15, 23, 42, 0.25) !important;
              }
              html.dark .aida-mobile-theme-mode-btn[data-active="1"] {
                background: rgb(var(--color-primary, 217 119 6)) !important;
                border-color: transparent !important;
                color: #ffffff !important;
              }

              /* Mobile Animation Section styled identically to Görünüm Modu */
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] {
                padding-top: 12px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div:first-child p,
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div:first-child > span,
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div:first-child h6 > svg {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div:first-child h6 {
                font-size: 11px !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.04em !important;
                color: #1e293b !important;
              }
              html.dark.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div:first-child h6 {
                color: #f8fafc !important;
              }
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div.grid {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 8px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div.grid > button {
                height: 44px !important;
                border-radius: 12px !important;
                border: 1px solid rgba(203, 213, 225, 0.9) !important;
                background: #ffffff !important;
                color: #334155 !important;
                padding: 0 8px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                text-align: center !important;
                box-shadow: none !important;
              }
              html.dark.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div.grid > button {
                background: #0f172a !important;
                border-color: rgba(51, 65, 85, 0.9) !important;
                color: #cbd5e1 !important;
              }
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div.grid > button > p,
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div.grid > button svg {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div.grid > button > div {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div.grid > button > div > span {
                font-size: 12px !important;
                font-weight: 800 !important;
                color: inherit !important;
              }
              html.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div.grid > button[data-motion-active="1"] {
                background: rgb(var(--color-primary, 217 119 6)) !important;
                border-color: transparent !important;
                color: #ffffff !important;
                box-shadow: 0 6px 16px -4px rgba(15, 23, 42, 0.25) !important;
              }
              html.dark.aida-ios-mobile [data-aida-mobile-motion-box="1"] > div.grid > button[data-motion-active="1"] {
                background: rgb(var(--color-primary, 217 119 6)) !important;
                border-color: transparent !important;
                color: #ffffff !important;
              }

              /* 2. Profiller & Yönlendirme */
              html.aida-ios-mobile .aida-settings-modal-dialog .p-5.rounded-2xl {
                padding: 14px !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog .grid.grid-cols-12 {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 8px !important;
              }

              /* 3. Güvenlik Grids (keep 4-col theme presets as 4 columns) */
              html.aida-ios-mobile .aida-settings-modal-dialog .grid.grid-cols-3:not(.aida-mobile-theme-mode-grid) {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 8px !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog .grid.grid-cols-4.sm\\:grid-cols-7 {
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 8px !important;
              }

              /* 4. Canlı İzleme Paneli (Wallboard Studio) Top Cards Mobile Cleanup */
              html.aida-ios-mobile [data-aida-mobile-wallboard-studio="1"] > div:first-child p {
                display: none !important;
              }
              html.aida-ios-mobile [data-aida-mobile-wallboard-studio="1"] > div:first-child h5 {
                font-size: 11px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-wallboard-studio="1"] > div:first-child > div:nth-child(2) {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 6px !important;
                width: 100% !important;
                padding: 4px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-wallboard-studio="1"] > div:first-child > div:nth-child(2) > button {
                width: 100% !important;
                height: 36px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 11.5px !important;
                border-radius: 10px !important;
              }
              html.aida-ios-mobile [data-aida-mobile-wallboard-studio="1"] > div:nth-child(2) {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 8px !important;
                width: 100% !important;
              }
              html.aida-ios-mobile [data-aida-mobile-wallboard-studio="1"] > div:nth-child(2) > button {
                width: 100% !important;
                min-height: 42px !important;
                padding: 8px 10px !important;
                border-radius: 12px !important;
                font-size: 11.5px !important;
                justify-content: flex-start !important;
              }
              html.aida-ios-mobile [data-aida-mobile-wallboard-studio="1"] > div:nth-child(3) > div:first-child > div:first-child p {
                display: none !important;
              }

              /* Bottom Sticky Footer ("Vazgeç" & "Kaydet") */
              html.aida-ios-mobile .aida-settings-modal-dialog > div:nth-child(2) > div:nth-child(2) > div:last-child {
                padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 14px)) 16px !important;
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                background: #ffffff !important;
                border-top: 1px solid rgba(226, 232, 240, 0.9) !important;
                flex-shrink: 0 !important;
              }
              html.aida-ios-mobile.dark .aida-settings-modal-dialog > div:nth-child(2) > div:nth-child(2) > div:last-child {
                background: #0f172a !important;
                border-top: 1px solid rgba(30, 41, 59, 0.9) !important;
              }
              html.aida-ios-mobile .aida-settings-modal-dialog > div:nth-child(2) > div:nth-child(2) > div:last-child > button {
                flex: 1 1 0% !important;
                height: 46px !important;
                border-radius: 14px !important;
                font-size: 13px !important;
                font-weight: 800 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
              }

              /* Hide Floating Desktop CallChatWidget completely on mobile (Telefon tab handles all calls) */
              html.aida-ios-mobile div.fixed.bottom-5.right-5.z-\\[9999\\] {
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
              }
            `;
            document.head.appendChild(style);
          }

          function switchSubTab(tabId) {
            try {
              window.dispatchEvent(new CustomEvent('SWITCH_AGENT_PANEL_SUBTAB', { detail: { subTab: tabId } }));
            } catch (e) {}
          }

          function readTabMetaFromDOM() {
            const meta = {
              activeTab: window.__CURRENT_AGENT_SUBTAB__ || 'dashboard',
              activeBgColor: '#d97706',
              badges: {}
            };

            // Read active background color & badge counts from the hidden .md:hidden tab buttons
            const mobileTabBar = document.querySelector('.aida-stage-active > div.aida-panel-enter > div.flex.h-full.w-full > div.md\\:hidden');
            const nameToId = {
              'Pano': 'dashboard',
              'Web Telefon': 'webphone',
              'Temsilciler': 'agents',
              'Hızlı Arama': 'speeddial',
              'Kayıp Çağrı': 'missed',
              'Rehber': 'directory',
              'Çağrı Geçmişi': 'history',
              'Sesli Posta': 'voicemail',
              'Sohbet': 'chat',
              'Masa Telefonum': 'deskphone'
            };

            if (mobileTabBar) {
              const buttons = mobileTabBar.querySelectorAll('button');
              buttons.forEach(function(btn) {
                const labelSpan = btn.querySelector('span.text-xs');
                const label = labelSpan ? labelSpan.textContent.trim() : '';
                const tabId = nameToId[label];
                if (!tabId) return;

                if (btn.classList.contains('text-white')) {
                  meta.activeTab = tabId;
                  try {
                    const comp = window.getComputedStyle(btn).backgroundColor;
                    if (comp && comp !== 'rgba(0, 0, 0, 0)' && comp !== 'transparent') {
                      meta.activeBgColor = comp;
                    }
                  } catch (e) {}
                }

                // Check numeric badge or dot badge
                const spans = btn.querySelectorAll('span');
                spans.forEach(function(sp) {
                  if (sp === labelSpan) return;
                  const t = (sp.textContent || '').trim();
                  if (/^\d+$/.test(t) && Number(t) > 0) {
                    meta.badges[tabId] = Number(t);
                  } else if (sp.classList.contains('w-2') && !meta.badges[tabId]) {
                    meta.badges[tabId] = '•';
                  }
                });
              });
            }

            // Fallback theme color from topbar logo icon if needed
            if (!meta.activeBgColor || meta.activeBgColor === '#d97706') {
              const logoBox = document.querySelector('header.aida-app-topbar .h-8.w-8');
              if (logoBox) {
                try {
                  const comp = window.getComputedStyle(logoBox).backgroundColor;
                  if (comp && comp !== 'rgba(0, 0, 0, 0)' && comp !== 'transparent') {
                    meta.activeBgColor = comp;
                  }
                } catch (e) {}
              }
            }

            return meta;
          }

          function renderBottomFloatingDock() {
            const stageExists = document.querySelector('.aida-stage-active > div.aida-panel-enter > div.flex.h-full.w-full');
            let dock = document.getElementById('aida-ios-bottom-dock');
            let popover = document.getElementById('aida-ios-more-popover');
            let backdrop = document.getElementById('aida-ios-more-backdrop');

            if (!stageExists) {
              if (dock) dock.remove();
              if (popover) popover.remove();
              if (backdrop) backdrop.remove();
              return;
            }

            const meta = readTabMetaFromDOM();
            const isMoreTabActive = MORE_POPOVER_TABS.some(function(t) { return t.id === meta.activeTab; });

            // Calculate combined badge count for "Daha Fazlası"
            let moreBadgeTotal = 0;
            MORE_POPOVER_TABS.forEach(function(t) {
              const b = meta.badges[t.id];
              if (typeof b === 'number' && b > 0) {
                moreBadgeTotal += b;
              }
            });

            if (!dock) {
              dock = document.createElement('nav');
              dock.id = 'aida-ios-bottom-dock';
              dock.setAttribute('aria-label', 'Mobil Alt Navigasyon');
              document.body.appendChild(dock);
            }

            // Build signature so we only update innerHTML when state/badges/theme change
            const sig = JSON.stringify({
              a: meta.activeTab,
              c: meta.activeBgColor,
              b: meta.badges,
              m: morePopoverOpen
            });

            if (dock.getAttribute('data-sig') !== sig) {
              dock.setAttribute('data-sig', sig);

              const primaryHtml = PRIMARY_BOTTOM_TABS.map(function(tab) {
                const isAct = !morePopoverOpen && meta.activeTab === tab.id;
                const badgeVal = meta.badges[tab.id];
                const styleAttr = isAct ? `style="background-color: ${meta.activeBgColor} !important;"` : '';
                const badgeHtml = badgeVal
                  ? `<span class="aida-ios-dock-badge">${badgeVal}</span>`
                  : '';
                return `
                  <button type="button" class="aida-ios-dock-btn" data-tab-id="${tab.id}" data-active="${isAct ? '1' : '0'}" ${styleAttr}>
                    ${tab.svg}
                    <span class="aida-dock-label">${tab.label}</span>
                    ${badgeHtml}
                  </button>
                `;
              }).join('');

              const moreActive = morePopoverOpen || isMoreTabActive;
              const moreStyleAttr = moreActive ? `style="background-color: ${meta.activeBgColor} !important;"` : '';
              const moreBadgeHtml = moreBadgeTotal > 0
                ? `<span class="aida-ios-dock-badge">${moreBadgeTotal}</span>`
                : '';
              const moreLabel = isMoreTabActive && !morePopoverOpen
                ? (MORE_POPOVER_TABS.find(function(t) { return t.id === meta.activeTab; })?.label || 'Daha Fazlası')
                : 'Daha Fazlası';

              const moreBtnHtml = `
                <button type="button" class="aida-ios-dock-btn" data-more-trigger="1" data-active="${moreActive ? '1' : '0'}" ${moreStyleAttr}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
                  <span class="aida-dock-label">${moreLabel}</span>
                  ${moreBadgeHtml}
                </button>
              `;

              dock.innerHTML = primaryHtml + moreBtnHtml;

              dock.querySelectorAll('button[data-tab-id]').forEach(function(btn) {
                btn.addEventListener('click', function(ev) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  const tid = btn.getAttribute('data-tab-id');
                  morePopoverOpen = false;
                  switchSubTab(tid);
                  renderBottomFloatingDock();
                });
              });

              const moreTrigger = dock.querySelector('button[data-more-trigger="1"]');
              if (moreTrigger) {
                moreTrigger.addEventListener('click', function(ev) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  morePopoverOpen = !morePopoverOpen;
                  renderBottomFloatingDock();
                });
              }
            }

            // Render or remove "Daha Fazlası" Popover Window
            if (morePopoverOpen) {
              if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = 'aida-ios-more-backdrop';
                backdrop.addEventListener('click', function() {
                  morePopoverOpen = false;
                  renderBottomFloatingDock();
                });
                document.body.appendChild(backdrop);
              }
              if (!popover) {
                popover = document.createElement('div');
                popover.id = 'aida-ios-more-popover';
                document.body.appendChild(popover);
              }
              if (popover.getAttribute('data-sig') !== sig) {
                popover.setAttribute('data-sig', sig);
                const itemsHtml = MORE_POPOVER_TABS.map(function(item) {
                  const isAct = meta.activeTab === item.id;
                  const bVal = meta.badges[item.id];
                  const st = isAct ? `style="background-color: ${meta.activeBgColor} !important;"` : '';
                  const bHtml = bVal ? `<span class="aida-ios-more-badge">${bVal}</span>` : '';
                  return `
                    <button type="button" class="aida-ios-more-item" data-more-tab-id="${item.id}" data-active="${isAct ? '1' : '0'}" ${st}>
                      <div class="aida-ios-more-item-left">
                        ${item.svg}
                        <div class="aida-ios-more-item-title">${item.label}</div>
                      </div>
                      ${bHtml}
                    </button>
                  `;
                }).join('');

                popover.innerHTML = itemsHtml;
                popover.querySelectorAll('button[data-more-tab-id]').forEach(function(btn) {
                  btn.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const tid = btn.getAttribute('data-more-tab-id');
                    morePopoverOpen = false;
                    switchSubTab(tid);
                    renderBottomFloatingDock();
                  });
                });
              }
            } else {
              if (popover) popover.remove();
              if (backdrop) backdrop.remove();
            }
          }

          // Prevent Element.prototype.scrollIntoView from scrolling root document / topbar into Dynamic Island
          try {
            const origScrollIntoView = Element.prototype.scrollIntoView;
            Element.prototype.scrollIntoView = function(arg) {
              try {
                let parent = this.parentElement;
                while (parent && parent !== document.body && parent !== document.documentElement) {
                  const st = window.getComputedStyle(parent);
                  if (st.overflowY === 'auto' || st.overflowY === 'scroll') {
                    parent.scrollTop = parent.scrollHeight;
                    return;
                  }
                  parent = parent.parentElement;
                }
              } catch (e) {}
              if (this !== document.body && this !== document.documentElement) {
                return;
              }
              return origScrollIntoView.call(this, arg);
            };
          } catch (e) {}

          // iOS WebKit WAV Header Repair Engine (fixes 0-size RIFF/data headers from Asterisk MixMonitor & 405 HEAD probes)
          const wavPromiseCache = new Map();
          function repairWavArrayBuffer(buf) {
            if (!buf || buf.byteLength < 44) return buf;
            try {
              const view = new DataView(buf);
              if (view.getUint32(0, false) === 0x52494646 && view.getUint32(8, false) === 0x57415645) {
                const riffSize = view.getUint32(4, true);
                if (riffSize === 0 || riffSize > buf.byteLength) {
                  view.setUint32(4, buf.byteLength - 8, true);
                }
                let offset = 12;
                while (offset + 8 <= buf.byteLength) {
                  const chunkId = view.getUint32(offset, false);
                  const chunkSize = view.getUint32(offset + 4, true);
                  if (chunkId === 0x64617461) {
                    const actualDataLen = buf.byteLength - (offset + 8);
                    if (chunkSize === 0 || chunkSize > actualDataLen) {
                      view.setUint32(offset + 4, actualDataLen, true);
                    }
                    break;
                  }
                  if (chunkSize <= 0) break;
                  offset += 8 + chunkSize;
                }
              }
            } catch (e) {}
            return buf;
          }

          function resolveRepairedAudioUrl(rawUrl) {
            if (!rawUrl || rawUrl.startsWith('blob:')) return Promise.resolve(rawUrl);
            if (wavPromiseCache.has(rawUrl)) return wavPromiseCache.get(rawUrl);
            const p = fetch(rawUrl, { credentials: 'include' })
              .then(function(res) {
                if (!res.ok) throw new Error('Audio fetch failed: ' + res.status);
                return res.arrayBuffer();
              })
              .then(function(buf) {
                const fixedBuf = repairWavArrayBuffer(buf);
                const blob = new Blob([fixedBuf], { type: 'audio/wav' });
                return URL.createObjectURL(blob);
              });
            wavPromiseCache.set(rawUrl, p);
            return p;
          }

          try {
            const origMediaPlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function() {
              const mediaEl = this;
              const currentSrc = mediaEl.getAttribute('data-aida-orig-src') || mediaEl.currentSrc || mediaEl.src || '';
              const isRecordingWav =
                currentSrc &&
                !currentSrc.startsWith('blob:') &&
                (currentSrc.includes('/api/recordings/') ||
                  currentSrc.includes('/api/voicemails/') ||
                  /\.wav(\?|$)/i.test(currentSrc));

              if (isRecordingWav && !(mediaEl.src || '').startsWith('blob:')) {
                mediaEl.setAttribute('data-aida-orig-src', currentSrc);
                return resolveRepairedAudioUrl(currentSrc).then(function(blobUrl) {
                  if (mediaEl.src !== blobUrl) {
                    mediaEl.src = blobUrl;
                    mediaEl.load();
                  }
                  return origMediaPlay.call(mediaEl);
                });
              }
              return origMediaPlay.call(mediaEl);
            };
          } catch (e) {}

          // Block WebPhoneDiagnosticsModal open event on mobile (only needed on Web browser)
          window.addEventListener('OPEN_WEBPHONE_DIAGNOSTICS', function(ev) {
            ev.stopImmediatePropagation();
          }, true);

          // Mobile Queue Session & Break State Controller (Mirrors Web/Desktop AgentSessionCard)
          let mobileQueueState = {
            loaded: false,
            isQueueMember: false,
            agentState: { is_logged_in: false, status: 'offline', current_break: null },
            statusFetchedAtMs: Date.now(),
            baseElapsedSec: 0,
            breaks: [],
            users: [],
            roles: [],
            queues: [],
            userId: '',
            extension: '',
            modalOpen: false,
            loading: false,
            errorMsg: ''
          };

          function resolveCurrentMobileUser() {
            let uid = '';
            let ext = '';
            try {
              const cfg = window.aidaDesktop && typeof window.aidaDesktop.getConfigSync === 'function'
                ? window.aidaDesktop.getConfigSync()
                : null;
              if (cfg && cfg.session) {
                uid = String(cfg.session.userId || cfg.session.username || '').trim();
                ext = String(cfg.session.extension || '').trim();
              }
            } catch (e) {}
            try {
              if (!uid) {
                uid = String(sessionStorage.getItem('current_user_id') || localStorage.getItem('current_user_id') || '').trim();
              }
            } catch (e) {}
            if (Array.isArray(mobileQueueState.users) && mobileQueueState.users.length > 0) {
              const matched = mobileQueueState.users.find(function(u) {
                if (!u) return false;
                const uId = String(u.id || '').trim();
                const uName = String(u.username || '').trim();
                const uExt = String(u.extension || '').trim();
                return (uid && (uId === uid || uName === uid || uExt === uid)) || (ext && uExt === ext);
              });
              if (matched) {
                if (matched.id) uid = String(matched.id).trim();
                if (matched.extension) ext = String(matched.extension).trim();
              }
            }
            mobileQueueState.userId = uid;
            mobileQueueState.extension = ext;
            return { uid: uid, ext: ext };
          }

          function computeIsQueueMember() {
            const { uid, ext } = resolveCurrentMobileUser();
            if (!uid && !ext) return false;
            const safeQueues = Array.isArray(mobileQueueState.queues) ? mobileQueueState.queues : [];
            const myQueues = safeQueues.filter(function(q) {
              let members = q.queueMembers || q.members || [];
              if (typeof members === 'string') {
                try { members = JSON.parse(members); } catch (e) { members = []; }
              }
              if (!Array.isArray(members)) return false;
              return members.some(function(m) {
                if (m && typeof m === 'object') {
                  const mExt = String(m.extension || '').trim();
                  const mUid = String(m.user_id || '').trim();
                  const mId = String(m.id || '').trim();
                  return (
                    (ext && (mExt === ext || mUid === ext || mId === ext)) ||
                    (uid && (mUid === uid || mExt === uid || mId === uid))
                  );
                }
                const mStr = String(m || '').trim();
                return (ext && mStr === ext) || (uid && mStr === uid);
              });
            });
            return myQueues.length > 0;
          }

          function computeAllowedBreaks() {
            const { uid, ext } = resolveCurrentMobileUser();
            const safeUsers = Array.isArray(mobileQueueState.users) ? mobileQueueState.users : [];
            const safeRoles = Array.isArray(mobileQueueState.roles) ? mobileQueueState.roles : [];
            const safeBreaks = Array.isArray(mobileQueueState.breaks) ? mobileQueueState.breaks : [];
            const loggedUser = safeUsers.find(function(u) {
              return (uid && String(u.id) === String(uid)) || (ext && String(u.extension) === String(ext));
            });
            const roleObj = loggedUser ? safeRoles.find(function(r) { return r.role_code === loggedUser.role; }) : null;
            const allowedIds = roleObj && Array.isArray(roleObj.allowed_breaks) ? roleObj.allowed_breaks : [];
            const roleFiltered = safeBreaks.filter(function(b) { return allowedIds.includes(b.id); });
            return roleFiltered.length > 0 ? roleFiltered : safeBreaks;
          }

          function applyNewAgentState(nextSt) {
            if (!nextSt || typeof nextSt !== 'object') return;
            const prev = mobileQueueState.agentState || {};
            const sameStatus =
              Boolean(prev.is_logged_in) === Boolean(nextSt.is_logged_in) &&
              prev.status === nextSt.status &&
              ((prev.current_break && (prev.current_break.id || prev.current_break.name)) || null) ===
                ((nextSt.current_break && (nextSt.current_break.id || nextSt.current_break.name)) || null);

            mobileQueueState.agentState = nextSt;
            if (typeof nextSt.elapsed_seconds === 'number' && nextSt.elapsed_seconds >= 0) {
              mobileQueueState.baseElapsedSec = Math.floor(nextSt.elapsed_seconds);
              mobileQueueState.statusFetchedAtMs = Date.now();
            } else if (!sameStatus) {
              mobileQueueState.baseElapsedSec = 0;
              mobileQueueState.statusFetchedAtMs = Date.now();
            }
          }

          function formatQueueTimer(agentSt) {
            if (!agentSt || !agentSt.is_logged_in) return '00:00';
            const startIso = agentSt.status === 'break'
              ? (agentSt.break_start_utc || (agentSt.current_break && agentSt.current_break.start_time_utc) || agentSt.status_since_utc)
              : agentSt.status_since_utc;
            let sec = 0;
            if (startIso) {
              const ms = Date.now() - new Date(startIso).getTime();
              if (!isNaN(ms) && ms >= 0) {
                sec = Math.floor(ms / 1000);
              } else {
                const delta = Math.max(0, Math.floor((Date.now() - (mobileQueueState.statusFetchedAtMs || Date.now())) / 1000));
                sec = (mobileQueueState.baseElapsedSec || 0) + delta;
              }
            } else {
              const delta = Math.max(0, Math.floor((Date.now() - (mobileQueueState.statusFetchedAtMs || Date.now())) / 1000));
              sec = (mobileQueueState.baseElapsedSec || 0) + delta;
            }
            const hrs = Math.floor(sec / 3600);
            const mins = Math.floor((sec % 3600) / 60);
            const rem = sec % 60;
            const pad = function(n) { return String(n).padStart(2, '0'); };
            return hrs > 0 ? (pad(hrs) + ':' + pad(mins) + ':' + pad(rem)) : (pad(mins) + ':' + pad(rem));
          }

          function computeStatusSubtitle(st, timerStr) {
            if (!st || !st.is_logged_in) {
              return 'Durum: Çevrimdışı (Giriş Yapılmadı)';
            }
            if (st.status === 'break' && st.current_break) {
              return 'Aktif Mola: ' + (st.current_break.name || 'Mola') + ' (' + timerStr + ')';
            }
            if (st.status === 'acw') {
              return 'Durum: ACW • ' + timerStr;
            }
            return 'Durum: Müsait • ' + timerStr;
          }

          function updateMobileQueueTimerLabelsInPlace() {
            if (!mobileQueueState.modalOpen) return;
            const existing = document.getElementById('aida-ios-queue-modal-backdrop');
            if (!existing) return;
            const st = mobileQueueState.agentState || {};
            const timerStr = formatQueueTimer(st);
            const subEl = existing.querySelector('#aida-ios-q-subtitle');
            if (subEl) {
              const nextSub = computeStatusSubtitle(st, timerStr);
              if (subEl.textContent !== nextSub) subEl.textContent = nextSub;
            }
            const badgeEl = existing.querySelector('#aida-ios-q-timer-badge');
            if (badgeEl && badgeEl.textContent !== timerStr) {
              badgeEl.textContent = timerStr;
            }
          }

          function closeMobileQueueModal() {
            mobileQueueState.modalOpen = false;
            const existing = document.getElementById('aida-ios-queue-modal-backdrop');
            if (existing) existing.remove();
          }

          function hexToRgba(hex, alpha) {
            const clean = String(hex || '').replace('#', '').trim();
            if (clean.length === 3) {
              const r = parseInt(clean[0] + clean[0], 16);
              const g = parseInt(clean[1] + clean[1], 16);
              const b = parseInt(clean[2] + clean[2], 16);
              if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
              }
            } else if (clean.length === 6) {
              const r = parseInt(clean.substring(0, 2), 16);
              const g = parseInt(clean.substring(2, 4), 16);
              const b = parseInt(clean.substring(4, 6), 16);
              if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
              }
            }
            return 'rgba(245, 158, 11, ' + alpha + ')';
          }

          function syncHeadsetButtonUI(rebuildModal) {
            const btn = document.getElementById('aida-ios-quicktray-btn');
            if (!btn) return;
            const isMember = computeIsQueueMember();
            mobileQueueState.isQueueMember = isMember;
            const targetAttr = isMember ? '1' : '0';
            if (btn.getAttribute('data-aida-queue-member') !== targetAttr) {
              btn.setAttribute('data-aida-queue-member', targetAttr);
            }

            const st = mobileQueueState.agentState || {};
            let statusColor = '#ef4444'; // Logout -> Kırmızı
            if (st.is_logged_in) {
              if (st.status === 'break') {
                statusColor = (st.current_break && st.current_break.color) ? st.current_break.color : '#f59e0b'; // Mola -> Mola rengi
              } else {
                statusColor = '#10b981'; // Login (Müsait / Online) -> Yeşil
              }
            }

            const isDark = document.documentElement.classList.contains('dark');
            btn.style.color = statusColor;
            btn.style.backgroundColor = hexToRgba(statusColor, isDark ? 0.18 : 0.12);
            btn.style.borderColor = hexToRgba(statusColor, isDark ? 0.45 : 0.35);
            btn.style.boxShadow = '0 2px 8px ' + hexToRgba(statusColor, isDark ? 0.22 : 0.15);

            const dot = document.getElementById('aida-ios-quicktray-dot');
            if (dot) {
              dot.style.backgroundColor = statusColor;
            }
            if (mobileQueueState.modalOpen) {
              if (rebuildModal) {
                renderMobileQueueModal();
              } else {
                updateMobileQueueTimerLabelsInPlace();
              }
            }
          }

          function fetchMobileQueueData() {
            const ts = Date.now();
            Promise.all([
              fetch('/api/settings/queues?_t=' + ts, { credentials: 'include', cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; }),
              fetch('/api/settings/breaks?_t=' + ts, { credentials: 'include', cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; }),
              fetch('/api/settings/users?_t=' + ts, { credentials: 'include', cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; }),
              fetch('/api/settings/roles?_t=' + ts, { credentials: 'include', cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; })
            ]).then(function(results) {
              const qData = results[0];
              const bData = results[1];
              const uData = results[2];
              const rData = results[3];
              mobileQueueState.queues = Array.isArray(qData) ? qData : (qData && Array.isArray(qData.queues) ? qData.queues : []);
              mobileQueueState.breaks = Array.isArray(bData) ? bData : (bData && Array.isArray(bData.breaks) ? bData.breaks : []);
              mobileQueueState.users = Array.isArray(uData) ? uData : (uData && Array.isArray(uData.users) ? uData.users : []);
              mobileQueueState.roles = Array.isArray(rData) ? rData : (rData && Array.isArray(rData.roles) ? rData.roles : []);
              mobileQueueState.loaded = true;
              fetchMobileAgentStatus(true);
            });
          }

          function fetchMobileAgentStatus(forceRebuildModal) {
            const { uid, ext } = resolveCurrentMobileUser();
            if (!uid && !ext) {
              syncHeadsetButtonUI(Boolean(forceRebuildModal));
              return;
            }
            const params = new URLSearchParams();
            if (uid) params.set('user_id', uid);
            if (ext) params.set('extension', ext);
            fetch('/api/agent/status?' + params.toString(), { credentials: 'include', cache: 'no-store' })
              .then(function(r) { return r.ok ? r.json() : null; })
              .then(function(data) {
                let stateChanged = Boolean(forceRebuildModal);
                if (data) {
                  const nextSt = data.agent_state || data.state || data;
                  const prev = mobileQueueState.agentState || {};
                  if (
                    Boolean(prev.is_logged_in) !== Boolean(nextSt.is_logged_in) ||
                    prev.status !== nextSt.status ||
                    ((prev.current_break && prev.current_break.id) || null) !== ((nextSt.current_break && nextSt.current_break.id) || null)
                  ) {
                    stateChanged = true;
                  }
                  applyNewAgentState(nextSt);
                }
                syncHeadsetButtonUI(stateChanged);
              })
              .catch(function() {
                syncHeadsetButtonUI(false);
              });
          }

          function updateMobileAgentStatus(nextPatch) {
            const { uid, ext } = resolveCurrentMobileUser();
            mobileQueueState.loading = false;
            mobileQueueState.errorMsg = '';

            // Optimistically update status & close the popup immediately for a sleek mobile UX
            const optimisticState = Object.assign({}, mobileQueueState.agentState || {}, nextPatch, {
              user_id: uid,
              extension: ext,
              status_since_utc: new Date().toISOString(),
              break_start_utc: nextPatch.status === 'break' ? new Date().toISOString() : null,
              elapsed_seconds: 0
            });
            applyNewAgentState(optimisticState);
            closeMobileQueueModal();
            syncHeadsetButtonUI(false);

            const payload = Object.assign({}, nextPatch, {
              user_id: uid,
              extension: ext
            });
            fetch('/api/agent/status', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
              .then(function(res) {
                return res.json().then(function(data) { return { ok: res.ok, data: data }; });
              })
              .then(function(result) {
                if (result.ok && result.data && result.data.status === 'success') {
                  const updated = result.data.agent_state || result.data.state || payload;
                  applyNewAgentState(updated);
                  window.dispatchEvent(new CustomEvent('AGENT_STATUS_UPDATED', { detail: updated }));
                  syncHeadsetButtonUI(false);
                } else {
                  mobileQueueState.errorMsg = (result.data && result.data.detail) || 'Durum değiştirilemedi.';
                  mobileQueueState.modalOpen = true;
                  fetchMobileAgentStatus(true);
                }
              })
              .catch(function() {
                fetchMobileAgentStatus(false);
              });
          }

          function renderMobileQueueModal() {
            let existing = document.getElementById('aida-ios-queue-modal-backdrop');
            if (!mobileQueueState.modalOpen) {
              if (existing) existing.remove();
              return;
            }
            if (!existing) {
              existing = document.createElement('div');
              existing.id = 'aida-ios-queue-modal-backdrop';
              existing.addEventListener('click', function(ev) {
                if (ev.target === existing) {
                  closeMobileQueueModal();
                }
              });
              document.body.appendChild(existing);
            }

            const st = mobileQueueState.agentState || {};
            const isLoggedIn = Boolean(st.is_logged_in);
            const timerStr = formatQueueTimer(st);
            const allowedBreaks = computeAllowedBreaks();
            const statusSubtitle = computeStatusSubtitle(st, timerStr);

            let bodyHtml = '';
            if (mobileQueueState.errorMsg) {
              bodyHtml += `<div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">${mobileQueueState.errorMsg}</div>`;
            }

            if (!isLoggedIn) {
              bodyHtml += `
                <button type="button" id="aida-ios-q-login-btn" class="w-full py-3.5 px-4 rounded-xl bg-primary text-white text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
                  <span>Sistem Girişi Yap (Login)</span>
                </button>
              `;
            } else {
              bodyHtml += `
                <button type="button" id="aida-ios-q-logout-btn" class="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                  <span>Oturumu Kapat (Logout)</span>
                </button>
              `;

              if (st.status === 'break' || st.status === 'acw') {
                bodyHtml += `
                  <button type="button" id="aida-ios-q-endbreak-btn" class="w-full py-3 px-4 rounded-xl bg-primary text-white text-xs font-extrabold shadow-md transition-all flex items-center justify-between cursor-pointer">
                    <span class="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                      <span>Molayı Bitir ve Müsait Duruma Geç</span>
                    </span>
                    <span id="aida-ios-q-timer-badge" class="px-2 py-0.5 rounded-lg bg-white/20 text-[10px] font-mono">${timerStr}</span>
                  </button>
                `;
              }

              bodyHtml += `
                <div class="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mola Türü Seçin (${allowedBreaks.length})</span>
                  </div>
                  <div class="flex flex-col gap-2">
                    ${allowedBreaks.length === 0 ? `
                      <div class="text-xs text-slate-400 text-center py-4">Tanımlı mola bulunmamaktadır.</div>
                    ` : allowedBreaks.map(function(b, idx) {
                      const isCurrent = st.status === 'break' && st.current_break && String(st.current_break.id) === String(b.id);
                      const maxMin = Number(b.max_duration_minutes || 0);
                      const subTxt = maxMin > 0 ? ('Maks ' + maxMin + ' dk') : 'Süre sınırı yok';
                      const dotCol = b.color || '#f59e0b';
                      return `
                        <button type="button" class="aida-ios-queue-break-item" data-break-idx="${idx}">
                          <div class="flex items-center gap-2.5 min-w-0">
                            <span style="width:11px;height:11px;border-radius:9999px;background:${dotCol};flex-shrink:0;display:inline-block;"></span>
                            <div class="min-w-0 text-left">
                              <div class="text-xs font-bold truncate">${b.name || 'Mola'}</div>
                              <div class="text-[10px] text-slate-400 font-semibold">${subTxt}</div>
                            </div>
                          </div>
                          ${isCurrent ? `<span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-primary text-white shrink-0">Aktif</span>` : ''}
                        </button>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }

            existing.innerHTML = `
              <div class="aida-ios-queue-modal-card">
                <div class="aida-ios-queue-modal-header">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>
                    </div>
                    <div class="min-w-0 text-left">
                      <div class="text-sm font-extrabold leading-tight truncate">Mola Durumları & Oturum</div>
                      <div id="aida-ios-q-subtitle" class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">${statusSubtitle}</div>
                    </div>
                  </div>
                  <button type="button" id="aida-ios-q-close-btn" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
                <div class="aida-ios-queue-modal-body">
                  ${bodyHtml}
                </div>
              </div>
            `;

            const closeBtn = existing.querySelector('#aida-ios-q-close-btn');
            if (closeBtn) {
              closeBtn.addEventListener('click', function() {
                closeMobileQueueModal();
              });
            }
            const loginBtn = existing.querySelector('#aida-ios-q-login-btn');
            if (loginBtn) {
              loginBtn.addEventListener('click', function() {
                updateMobileAgentStatus({ is_logged_in: true, status: 'online', current_break: null });
              });
            }
            const logoutBtn = existing.querySelector('#aida-ios-q-logout-btn');
            if (logoutBtn) {
              logoutBtn.addEventListener('click', function() {
                updateMobileAgentStatus({ is_logged_in: false, status: 'offline', current_break: null });
              });
            }
            const endBreakBtn = existing.querySelector('#aida-ios-q-endbreak-btn');
            if (endBreakBtn) {
              endBreakBtn.addEventListener('click', function() {
                updateMobileAgentStatus({ is_logged_in: true, status: 'online', current_break: null });
              });
            }
            existing.querySelectorAll('.aida-ios-queue-break-item').forEach(function(itemBtn) {
              itemBtn.addEventListener('click', function() {
                const idx = Number(itemBtn.getAttribute('data-break-idx'));
                const chosen = allowedBreaks[idx];
                if (chosen) {
                  updateMobileAgentStatus({ is_logged_in: true, status: 'break', current_break: chosen });
                }
              });
            });
          }

          window.addEventListener('AGENT_STATUS_UPDATED', function() {
            fetchMobileAgentStatus(false);
          });
          window.addEventListener('AIDA_IOS_OPEN_QUEUE_MODAL', function() {
            mobileQueueState.errorMsg = '';
            mobileQueueState.modalOpen = true;
            renderMobileQueueModal();
            fetchMobileQueueData();
          });
          setTimeout(fetchMobileQueueData, 600);
          setInterval(function() {
            if (document.visibilityState !== 'hidden') {
              fetchMobileAgentStatus(false);
            }
          }, 10000);
          setInterval(function() {
            if (mobileQueueState.modalOpen) {
              updateMobileQueueTimerLabelsInPlace();
            }
          }, 1000);

          function rebrandTextValueToRuna(str) {
            if (!str || typeof str !== 'string') return str;
            if (!/aida|aİda|aıda|runa/i.test(str)) return str;
            return str
              .replace(/AIDA\s+Agent/gi, 'Runa')
              .replace(/AIDA\s+Mobile/gi, 'Runa')
              .replace(/RUNA\s+Agent/gi, 'Runa')
              .replace(/RUNA\s+Mobile/gi, 'Runa')
              .replace(/AIDA-Mobile-iOS/gi, 'Runa-Mobile-iOS')
              .replace(/RUNA-Mobile-iOS/gi, 'Runa-Mobile-iOS')
              .replace(/AIDA\s+PBX/gi, 'Runa PBX')
              .replace(/RUNA\s+PBX/gi, 'Runa PBX')
              .replace(/AİDA/g, 'Runa')
              .replace(/AIDA/g, 'Runa')
              .replace(/RUNA/g, 'Runa')
              .replace(/Aida/g, 'Runa')
              .replace(/@aida\.local/gi, '@runa.local')
              .replace(/aida-backend/gi, 'runa-backend')
              .replace(/aida-agent:\/\//gi, 'runa://')
              .replace(/aida-mobile:\/\//gi, 'runa-mobile://')
              .replace(/aida\.saphira\.com\.tr/gi, 'runa.saphira.com.tr')
              .replace(/\baida\b/gi, 'Runa');
          }

          function rebrandDomToRuna() {
            try {
              if (document.title && /aida|aİda|runa/i.test(document.title)) {
                document.title = rebrandTextValueToRuna(document.title);
              }
              if (!document.body) return;

              // 0. Replace topbar left robot icon with Runa Option 4 SVG Logo
              const topbarLogoBox = document.querySelector('header.aida-app-topbar > div:first-child > div:first-child > div:first-child');
              if (topbarLogoBox && topbarLogoBox.getAttribute('data-runa-logo-applied') !== '1') {
                topbarLogoBox.setAttribute('data-runa-logo-applied', '1');
                topbarLogoBox.className = 'h-8 w-8 shrink-0 rounded-xl flex items-center justify-center overflow-hidden shadow-sm bg-white dark:bg-slate-900';
                topbarLogoBox.innerHTML = `<svg viewBox="0 0 1024 1024" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="rOuterClip"><rect x="78" y="78" width="868" height="868" rx="176"/></clipPath><linearGradient id="rTL" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#0EA5E9"/><stop offset="100%" stop-color="#4F46E5"/></linearGradient><linearGradient id="rTR" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7C3AED"/><stop offset="100%" stop-color="#DB2777"/></linearGradient><linearGradient id="rBR" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F43F5E"/><stop offset="100%" stop-color="#FF7319"/></linearGradient><linearGradient id="rBL" x1="1" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#F59E0B"/><stop offset="100%" stop-color="#10B981"/></linearGradient><linearGradient id="rB1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F43F5E"/><stop offset="100%" stop-color="#FB923C"/></linearGradient><linearGradient id="rB2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0EA5E9"/><stop offset="100%" stop-color="#10B981"/></linearGradient><linearGradient id="rRG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1E1B4B"/><stop offset="100%" stop-color="#4338CA"/></linearGradient></defs><rect width="1024" height="1024" rx="220" fill="#F8FAFD"/><g clip-path="url(#rOuterClip)"><polygon points="0,634 240,449 525,512 455,0 0,0" fill="url(#rTL)"/><polygon points="455,0 1024,0 1024,439 780,379 525,512" fill="url(#rTR)"/><polygon points="1024,439 1024,1024 595,1024 525,512 780,379" fill="url(#rBR)"/><polygon points="595,1024 0,1024 0,634 240,449 525,512" fill="url(#rBL)"/><rect x="162" y="162" width="700" height="700" rx="108" fill="#F8FAFD"/><polygon points="50,659 200,529 200,476 50,606" fill="#F8FAFD"/><polygon points="825,390 975,428 975,474 825,436" fill="#F8FAFD"/></g><rect x="248" y="350" width="58" height="324" rx="29" fill="url(#rB1)"/><rect x="330" y="266" width="58" height="492" rx="29" fill="url(#rB2)"/><path d="M 454 714 L 454 314 L 592 314 C 660 314 710 362 710 426 C 710 490 660 538 592 538 L 535 538 L 712 718" fill="none" stroke="url(#rRG)" stroke-width="88" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
              }

              // 1. Convert split brand logo spans: <span>AI</span>DA (or <span>RU</span>NA) -> rainbow "Runa"
              document.querySelectorAll('span').forEach(function(sp) {
                if (sp.children.length === 0) {
                  const t = (sp.textContent || '').trim();
                  if (t === 'AI' || t === 'Aİ' || t === 'RU' || t === 'Runa' || t === 'RUNA' || t === 'Nornia') {
                    const next = sp.nextSibling;
                    if (t === 'Runa' || t === 'RUNA' || t === 'Nornia') {
                      sp.textContent = 'Runa';
                      sp.setAttribute('data-runa-brand', '1');
                      sp.classList.remove('text-rose-600', 'text-rose-500', 'dark:text-rose-500', 'drop-shadow-sm');
                      sp.style.backgroundImage = 'linear-gradient(90deg, #16A34A 0%, #0284C7 28%, #7C3AED 58%, #DB2777 80%, #EA580C 100%)';
                      sp.style.webkitBackgroundClip = 'text';
                      sp.style.backgroundClip = 'text';
                      sp.style.webkitTextFillColor = 'transparent';
                      sp.style.color = 'transparent';
                    } else if (next && next.nodeType === 3 && /^\s*(DA|NA)\b/i.test(next.nodeValue || '')) {
                      sp.textContent = 'Runa';
                      sp.setAttribute('data-runa-brand', '1');
                      sp.classList.remove('text-rose-600', 'text-rose-500', 'dark:text-rose-500', 'drop-shadow-sm');
                      sp.style.backgroundImage = 'linear-gradient(90deg, #16A34A 0%, #0284C7 28%, #7C3AED 58%, #DB2777 80%, #EA580C 100%)';
                      sp.style.webkitBackgroundClip = 'text';
                      sp.style.backgroundClip = 'text';
                      sp.style.webkitTextFillColor = 'transparent';
                      sp.style.color = 'transparent';
                      next.nodeValue = (next.nodeValue || '').replace(/^\s*(DA|NA)(\s+(Agent|Mobile))?/i, '');
                      let sib = next.nextSibling;
                      while (sib && sib.nodeType === 3) {
                        const curSib = sib;
                        sib = sib.nextSibling;
                        if (/^\s*(Agent|Mobile)\s*$/i.test(curSib.nodeValue || '')) {
                          curSib.nodeValue = '';
                        }
                      }
                    }
                  }
                }
              });

              // 2. Walk all text nodes in document.body
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
              let node;
              while ((node = walker.nextNode())) {
                const parentTag = node.parentElement ? node.parentElement.tagName : '';
                if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'NOSCRIPT') continue;
                const val = node.nodeValue;
                if (val && /aida|aİda|aıda|RUNA/.test(val)) {
                  const nextVal = rebrandTextValueToRuna(val);
                  if (nextVal !== val) {
                    node.nodeValue = nextVal;
                  }
                }
              }

              // 3. Sanitize attributes (title, placeholder, aria-label, alt, download)
              document.querySelectorAll('[title],[placeholder],[aria-label],[alt],[download]').forEach(function(el) {
                ['title', 'placeholder', 'aria-label', 'alt', 'download'].forEach(function(attr) {
                  const v = el.getAttribute(attr);
                  if (v && /aida|aİda|aıda|RUNA/.test(v)) {
                    const nv = rebrandTextValueToRuna(v);
                    if (nv !== v) el.setAttribute(attr, nv);
                  }
                });
              });
            } catch (e) {}
          }

          function applyDOMAdaptations() {
            ensureMobileViewport();
            injectMobileStyles();
            rebrandDomToRuna();

            // 1. Topbar: Show Left App Icon ("RUNA"), Headset Icon (only if in queue), and Circular Avatar (hide Bell & Theme toggle)
            const topbarRight = document.querySelector('header.aida-app-topbar > div:last-child');
            const profileBtn = document.querySelector('header.aida-app-topbar button[aria-label="Kullanıcı Profili ve Menüsü"]');
            const profileContainer = profileBtn ? profileBtn.parentElement : null;

            if (topbarRight) {
              if (!document.getElementById('aida-ios-net-quality-btn')) {
                const netBtn = document.createElement('button');
                netBtn.id = 'aida-ios-net-quality-btn';
                netBtn.type = 'button';
                netBtn.title = 'Ağ Kalitesi Durumu';
                netBtn.setAttribute('data-net-tier', 'good');
                netBtn.className = 'p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-emerald-500 shadow-sm cursor-pointer shrink-0';
                netBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>`;
                netBtn.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (typeof window.__aidaToggleNetQualityBanner === 'function') {
                    window.__aidaToggleNetQualityBanner();
                  }
                });
                topbarRight.insertBefore(netBtn, topbarRight.firstChild);
              }
              if (!document.getElementById('aida-ios-quicktray-btn')) {
                const btn = document.createElement('button');
                btn.id = 'aida-ios-quicktray-btn';
                btn.type = 'button';
                btn.title = 'Kuyruk Oturumu & Mola';
                btn.setAttribute('data-aida-queue-member', mobileQueueState.isQueueMember ? '1' : '0');
                btn.className = 'p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-sm cursor-pointer shrink-0';
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg><span id="aida-ios-quicktray-dot"></span>`;
                btn.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  mobileQueueState.modalOpen = true;
                  fetchMobileQueueData();
                  renderMobileQueueModal();
                });
                topbarRight.insertBefore(btn, topbarRight.firstChild);
                syncHeadsetButtonUI();
              }

              const quickTrayBtn = document.getElementById('aida-ios-quicktray-btn');
              const netQualBtn = document.getElementById('aida-ios-net-quality-btn');
              if (quickTrayBtn) {
                syncHeadsetButtonUI(false);
              }
              Array.from(topbarRight.children).forEach(function(child) {
                if (child !== profileContainer && child !== quickTrayBtn && child !== netQualBtn) {
                  if (child.getAttribute('data-aida-hide-topbar-item') !== '1') {
                    child.setAttribute('data-aida-hide-topbar-item', '1');
                  }
                }
              });
            }

            // 1b. Transform Profile Dropdown Popup into a Full-Screen Mobile Page when opened
            if (profileBtn && profileContainer) {
              const dropdown = profileBtn.nextElementSibling;
              if (dropdown) {
                if (document.documentElement.getAttribute('data-aida-profile-open') !== '1') {
                  document.documentElement.setAttribute('data-aida-profile-open', '1');
                }
                if (dropdown.getAttribute('data-aida-mobile-profile-page') !== '1') {
                  dropdown.setAttribute('data-aida-mobile-profile-page', '1');
                }

                // Inject Top Navigation Bar ("← Geri" + Title) into Profile Page
                if (!dropdown.querySelector('.aida-mobile-profile-topbar')) {
                  const topbar = document.createElement('div');
                  topbar.className = 'aida-mobile-profile-topbar';

                  const backBtn = document.createElement('button');
                  backBtn.type = 'button';
                  backBtn.className = 'aida-mobile-profile-back-btn';
                  backBtn.innerHTML = '← Geri';
                  backBtn.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    profileBtn.click();
                  });

                  const titleSpan = document.createElement('span');
                  titleSpan.className = 'aida-mobile-profile-title';
                  titleSpan.textContent = 'Profil ve Hesap';

                  const rightSpacer = document.createElement('span');
                  rightSpacer.style.width = '56px';

                  topbar.appendChild(backBtn);
                  topbar.appendChild(titleSpan);
                  topbar.appendChild(rightSpacer);
                  dropdown.insertBefore(topbar, dropdown.firstChild);
                }

                // Hide "Profil Ayarları" & "Uygulamalar & İndir", inject direct settings tabs, and tag "Çıkış Yap"
                let origProfileSettingsBtn = null;
                dropdown.querySelectorAll('button').forEach(function(b) {
                  const txt = (b.textContent || '').trim();
                  if (txt === 'Profil Ayarları') {
                    origProfileSettingsBtn = b;
                    if (b.getAttribute('data-aida-hide-profile-settings-btn') !== '1') {
                      b.setAttribute('data-aida-hide-profile-settings-btn', '1');
                    }
                  } else if (txt === 'Profilleri Özelleştir') {
                    if (!b.__aidaCustomProfilesBound) {
                      b.__aidaCustomProfilesBound = true;
                      b.addEventListener('click', function() {
                        window.__AIDA_MOBILE_TARGET_SETTINGS_TAB__ = {
                          match: 'Profiller',
                          title: 'Profiller & Yönlendirme'
                        };
                      }, true);
                    }
                  } else if (txt.includes('Uygulamalar') && txt.includes('İndir')) {
                    if (b.getAttribute('data-aida-hide-app-download') !== '1') {
                      b.setAttribute('data-aida-hide-app-download', '1');
                    }
                  } else if (txt.includes('Çıkış Yap')) {
                    if (b.getAttribute('data-aida-mobile-logout-btn') !== '1') {
                      b.setAttribute('data-aida-mobile-logout-btn', '1');
                    }
                  }
                });

                const actionsContainer = origProfileSettingsBtn ? origProfileSettingsBtn.parentElement : null;
                if (actionsContainer && origProfileSettingsBtn && !actionsContainer.querySelector('.aida-mobile-direct-settings-btn')) {
                  const directTabs = [
                    {
                      match: 'Avatar & Tema',
                      title: 'Avatar & Tema',
                      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 shrink-0"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`
                    },
                    {
                      match: 'Profiller',
                      title: 'Profiller & Yönlendirme',
                      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
                    },
                    {
                      match: 'Güvenlik',
                      title: 'Güvenlik',
                      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 shrink-0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`
                    },
                    {
                      match: 'Canlı İzleme',
                      title: 'Canlı İzleme Paneli',
                      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 shrink-0"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`
                    }
                  ];

                  directTabs.forEach(function(item) {
                    const tabBtn = document.createElement('button');
                    tabBtn.type = 'button';
                    tabBtn.className = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors aida-mobile-direct-settings-btn';
                    tabBtn.innerHTML = item.svg + `<span>${item.title}</span><span class="aida-mobile-tab-chevron">›</span>`;
                    tabBtn.addEventListener('click', function(ev) {
                      ev.preventDefault();
                      ev.stopPropagation();
                      window.__AIDA_MOBILE_TARGET_SETTINGS_TAB__ = {
                        match: item.match,
                        title: item.title
                      };
                      origProfileSettingsBtn.click();
                    });
                    actionsContainer.insertBefore(tabBtn, origProfileSettingsBtn);
                  });
                }
              } else {
                if (document.documentElement.hasAttribute('data-aida-profile-open')) {
                  document.documentElement.removeAttribute('data-aida-profile-open');
                }
              }
            } else {
              if (document.documentElement.hasAttribute('data-aida-profile-open')) {
                document.documentElement.removeAttribute('data-aida-profile-open');
              }
            }

            // 1b-2. Full-Screen Profile Settings Modal (Direct Detail Screen Navigation from Avatar Page)
            const settingsDialog = document.querySelector('.aida-settings-modal-dialog');
            if (settingsDialog) {
              if (document.documentElement.getAttribute('data-aida-settings-open') !== '1') {
                document.documentElement.setAttribute('data-aida-settings-open', '1');
              }
              if (settingsDialog.getAttribute('data-mobile-settings-view') !== 'detail') {
                settingsDialog.setAttribute('data-mobile-settings-view', 'detail');
              }

              // If launched via one of the direct tab buttons on the Avatar page, switch to that tab immediately
              if (window.__AIDA_MOBILE_TARGET_SETTINGS_TAB__) {
                const targetTab = window.__AIDA_MOBILE_TARGET_SETTINGS_TAB__;
                window.__AIDA_MOBILE_TARGET_SETTINGS_TAB__ = null;
                settingsDialog.setAttribute('data-mobile-active-title', targetTab.title);
                settingsDialog.querySelectorAll('.aida-settings-modal-sidebar button').forEach(function(sb) {
                  const sbTxt = (sb.textContent || '').trim();
                  if (sbTxt.includes(targetTab.match)) {
                    sb.click();
                  }
                });
                setTimeout(function() {
                  const bodyWrap = settingsDialog.children[1];
                  const rightCol = bodyWrap ? bodyWrap.children[1] : null;
                  const scrollPane = rightCol ? rightCol.firstElementChild : null;
                  if (scrollPane) scrollPane.scrollTop = 0;
                }, 30);
              }

              const sHeader = settingsDialog.firstElementChild;
              const sHeaderLeft = sHeader ? sHeader.firstElementChild : null;
              const sTitle = sHeader ? sHeader.querySelector('h3') : null;
              const sCloseBtn = sHeader ? sHeader.lastElementChild : null;

              if (sHeaderLeft && !sHeaderLeft.querySelector('.aida-mobile-settings-back-btn')) {
                const sBackBtn = document.createElement('button');
                sBackBtn.type = 'button';
                sBackBtn.className = 'aida-mobile-settings-back-btn';
                sBackBtn.textContent = '← Geri';
                sBackBtn.addEventListener('click', function(ev) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  if (sCloseBtn && typeof sCloseBtn.click === 'function') {
                    sCloseBtn.click();
                  }
                  setTimeout(function() {
                    const topProfileBtn = document.querySelector('header.aida-app-topbar div.relative > button');
                    if (topProfileBtn && !document.querySelector('div[data-aida-mobile-profile-page="1"]')) {
                      topProfileBtn.click();
                    }
                  }, 30);
                });
                sHeaderLeft.insertBefore(sBackBtn, sHeaderLeft.firstChild);
              }

              const activeBackBtn = sHeaderLeft ? sHeaderLeft.querySelector('.aida-mobile-settings-back-btn') : null;
              if (activeBackBtn && activeBackBtn.textContent !== '← Geri') {
                activeBackBtn.textContent = '← Geri';
              }
              const detailTitle = settingsDialog.getAttribute('data-mobile-active-title') || 'Avatar & Tema';
              if (sTitle && sTitle.textContent !== detailTitle) {
                sTitle.textContent = detailTitle;
              }

              settingsDialog.querySelectorAll('.aida-settings-modal-sidebar button').forEach(function(b) {
                const rawTxt = (b.textContent || '').trim();
                const shouldHideTab =
                  rawTxt.includes('Başlangıç Ekranı') ||
                  rawTxt.includes('Donanım') ||
                  rawTxt.includes('Klavye Kısayolları') ||
                  rawTxt.includes('Ortak Masa Telefonu') ||
                  (rawTxt.includes('Uygulamalar') && rawTxt.includes('İndir')) ||
                  rawTxt.includes('Çağrı Paneli') ||
                  rawTxt.includes('Üst Bar Özelleştirme');

                if (shouldHideTab) {
                  if (b.getAttribute('data-aida-hide-settings-tab') !== '1') {
                    b.setAttribute('data-aida-hide-settings-tab', '1');
                  }
                  return;
                }

                if (!b.querySelector('.aida-mobile-tab-chevron')) {
                  const chev = document.createElement('span');
                  chev.className = 'aida-mobile-tab-chevron';
                  chev.textContent = '›';
                  b.appendChild(chev);
                }

                if (!b.__aidaSettingsTabBound) {
                  b.__aidaSettingsTabBound = true;
                  b.addEventListener('click', function() {
                    const cleanLabel = (b.textContent || '')
                      .replace(/›/g, '')
                      .replace(/AKTİF/g, '')
                      .replace(/YENİ/g, '')
                      .trim();
                    settingsDialog.setAttribute('data-mobile-active-title', cleanLabel || 'Profil Ayarları');
                    settingsDialog.setAttribute('data-mobile-settings-view', 'detail');
                    if (sTitle) sTitle.textContent = cleanLabel || 'Profil Ayarları';
                    if (activeBackBtn) activeBackBtn.textContent = '← Liste';
                    setTimeout(function() {
                      const bodyWrap = settingsDialog.children[1];
                      const rightCol = bodyWrap ? bodyWrap.children[1] : null;
                      const scrollPane = rightCol ? rightCol.firstElementChild : null;
                      if (scrollPane) scrollPane.scrollTop = 0;
                    }, 30);
                  });
                }
              });

              // Adapt "Avatar & Tema", "Canlı İzleme Paneli" & "Güvenlik" detail sections on mobile
              const bodyWrap = settingsDialog.children[1];
              const rightCol = bodyWrap ? bodyWrap.children[1] : null;
              const scrollPane = rightCol ? rightCol.firstElementChild : null;
              if (scrollPane) {
                Array.from(scrollPane.children).forEach(function(sec) {
                  const secTxt = (sec.textContent || '');

                  // 0. Avatar Selection: Make "Avatar Yükle" icon-only & hide description next to it
                  if (secTxt.includes('Profil Avatarı Seçin veya Yükleyin')) {
                    sec.querySelectorAll('span').forEach(function(sp) {
                      const t = (sp.textContent || '').trim();
                      if (t.includes('hazır avatardan') || t.includes('telifsiz sinema')) {
                        if (sp.getAttribute('data-aida-hide-desc') !== '1') {
                          sp.setAttribute('data-aida-hide-desc', '1');
                        }
                      }
                    });
                    sec.querySelectorAll('label').forEach(function(lbl) {
                      if ((lbl.textContent || '').includes('Avatar Yükle')) {
                        if (lbl.getAttribute('data-aida-mobile-avatar-upload-btn') !== '1') {
                          lbl.setAttribute('data-aida-mobile-avatar-upload-btn', '1');
                          lbl.setAttribute('title', 'Avatar Yükle');
                        }
                      }
                    });
                    return;
                  }

                  // 1. Hide "Arayüz Görünüm Şablonu" section
                  if (secTxt.includes('Arayüz Görünüm Şablonu')) {
                    if (sec.getAttribute('data-aida-hide-ui-templates') !== '1') {
                      sec.setAttribute('data-aida-hide-ui-templates', '1');
                    }
                    return;
                  }

                  // 1b. Sistem Tema Rengi: Hide description under label
                  if (secTxt.includes('Sistem Tema Rengi') && secTxt.includes('Renk Paleti')) {
                    sec.querySelectorAll('span').forEach(function(sp) {
                      const t = (sp.textContent || '').trim();
                      if (t.includes('Genişletilmiş hazır renklerden')) {
                        if (sp.getAttribute('data-aida-hide-desc') !== '1') {
                          sp.setAttribute('data-aida-hide-desc', '1');
                        }
                      }
                    });
                    return;
                  }

                  // 2. Adapt "Otomatik Karanlık Mod & Görünüm Zamanlaması", "Gelen Çağrıda Müşteri 360°" & "Animasyon"
                  if (
                    (secTxt.includes('Otomatik Karanlık Mod') && secTxt.includes('Görünüm Zamanlaması')) ||
                    sec.querySelector('.aida-mobile-theme-mode-box')
                  ) {
                    let manualBtn = null;
                    let systemBtn = null;

                    sec.querySelectorAll('button').forEach(function(btn) {
                      const bTxt = (btn.textContent || '');
                      if (bTxt.includes('Manuel Seçim')) manualBtn = btn;
                      else if (bTxt.includes('İşletim Sistemiyle Eşitle')) systemBtn = btn;
                    });

                    Array.from(sec.children).forEach(function(child) {
                      if (child.classList.contains('aida-mobile-theme-mode-box')) return;
                      const cTxt = (child.textContent || '');
                      if (cTxt.includes('Gelen Çağrıda Müşteri 360')) {
                        if (child.getAttribute('data-aida-hide-360-toggle') !== '1') {
                          child.setAttribute('data-aida-hide-360-toggle', '1');
                        }
                      } else if (
                        cTxt.includes('Arayüz Geçiş & Grafik Animasyonları') ||
                        cTxt.includes('Animasyon') && (cTxt.includes('Akıcı') || cTxt.includes('Minimal'))
                      ) {
                        if (child.getAttribute('data-aida-mobile-motion-box') !== '1') {
                          child.setAttribute('data-aida-mobile-motion-box', '1');
                        }
                        const h6Span = child.querySelector('h6 span');
                        if (h6Span && h6Span.textContent !== 'Animasyon') {
                          h6Span.textContent = 'Animasyon';
                        }
                        child.querySelectorAll('div.grid > button').forEach(function(mBtn) {
                          const titleSp = mBtn.querySelector('div > span');
                          if (titleSp) {
                            const rawT = (titleSp.textContent || '').trim();
                            if (rawT.startsWith('Akıcı') && rawT !== 'Akıcı') titleSp.textContent = 'Akıcı';
                            else if (rawT.startsWith('Minimal') && rawT !== 'Minimal') titleSp.textContent = 'Minimal';
                            else if (rawT.startsWith('Kapalı') && rawT !== 'Kapalı') titleSp.textContent = 'Kapalı';
                          }
                          const isSel = Boolean(mBtn.querySelector('svg'));
                          const nextAct = isSel ? '1' : '0';
                          if (mBtn.getAttribute('data-motion-active') !== nextAct) {
                            mBtn.setAttribute('data-motion-active', nextAct);
                          }
                        });
                      } else {
                        if (child.getAttribute('data-aida-hide-auto-theme-orig') !== '1') {
                          child.setAttribute('data-aida-hide-auto-theme-orig', '1');
                        }
                      }
                    });

                    let themeBox = sec.querySelector('.aida-mobile-theme-mode-box');
                    if (!themeBox) {
                      themeBox = document.createElement('div');
                      themeBox.className = 'aida-mobile-theme-mode-box';
                      themeBox.innerHTML = `
                        <div class="aida-mobile-theme-mode-label">Görünüm Modu</div>
                        <div class="aida-mobile-theme-mode-grid">
                          <button type="button" class="aida-mobile-theme-mode-btn" data-theme-choice="light">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                            <span>Açık</span>
                          </button>
                          <button type="button" class="aida-mobile-theme-mode-btn" data-theme-choice="dark">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                            <span>Koyu</span>
                          </button>
                          <button type="button" class="aida-mobile-theme-mode-btn" data-theme-choice="system">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                            <span>Sisteme Göre</span>
                          </button>
                        </div>
                      `;
                      sec.insertBefore(themeBox, sec.firstChild);

                      themeBox.querySelectorAll('button[data-theme-choice]').forEach(function(mBtn) {
                        mBtn.addEventListener('click', function(ev) {
                          ev.preventDefault();
                          ev.stopPropagation();
                          const choice = mBtn.getAttribute('data-theme-choice');
                          const topThemeBtn = document.querySelector('header.aida-app-topbar button[title*="Mod"], header.aida-app-topbar button[title*="Tema"]');

                          let curManualBtn = null;
                          let curSystemBtn = null;
                          sec.querySelectorAll('button').forEach(function(b) {
                            const t = (b.textContent || '');
                            if (t.includes('Manuel Seçim')) curManualBtn = b;
                            else if (t.includes('İşletim Sistemiyle Eşitle')) curSystemBtn = b;
                          });

                          if (choice === 'system') {
                            if (curSystemBtn) curSystemBtn.click();
                          } else if (choice === 'light') {
                            if (curManualBtn) curManualBtn.click();
                            setTimeout(function() {
                              if (document.documentElement.classList.contains('dark')) {
                                if (topThemeBtn) topThemeBtn.click();
                                else {
                                  document.documentElement.classList.remove('dark');
                                  try { localStorage.setItem('theme', 'light'); } catch (e) {}
                                }
                              }
                            }, 25);
                          } else if (choice === 'dark') {
                            if (curManualBtn) curManualBtn.click();
                            setTimeout(function() {
                              if (!document.documentElement.classList.contains('dark')) {
                                if (topThemeBtn) topThemeBtn.click();
                                else {
                                  document.documentElement.classList.add('dark');
                                  try { localStorage.setItem('theme', 'dark'); } catch (e) {}
                                }
                              }
                            }, 25);
                          }
                        });
                      });
                    }

                    // Sync active button state (Açık / Koyu / Sisteme Göre)
                    const isSystemActive = Boolean(systemBtn && systemBtn.querySelector('svg'));
                    const isDarkNow = document.documentElement.classList.contains('dark');
                    const activeChoice = isSystemActive ? 'system' : (isDarkNow ? 'dark' : 'light');
                    themeBox.querySelectorAll('button[data-theme-choice]').forEach(function(mBtn) {
                      const c = mBtn.getAttribute('data-theme-choice');
                      const nextAct = c === activeChoice ? '1' : '0';
                      if (mBtn.getAttribute('data-active') !== nextAct) {
                        mBtn.setAttribute('data-active', nextAct);
                      }
                    });
                    return;
                  }

                  // 3. Canlı İzleme Paneli (Wallboard Studio) top cards layout cleanup
                  if (secTxt.includes('Canlı İzleme Paneli (Wallboard)') || secTxt.includes('Durum & Mola Renkleri')) {
                    if (sec.getAttribute('data-aida-mobile-wallboard-studio') !== '1') {
                      sec.setAttribute('data-aida-mobile-wallboard-studio', '1');
                    }
                    const studioTitle = sec.querySelector('h5');
                    if (studioTitle && (studioTitle.textContent || '').includes('Canlı İzleme Paneli (Wallboard)')) {
                      studioTitle.textContent = 'Görünüm Şablonları';
                    }
                    return;
                  }

                  // 4. Güvenlik Section: Rename PC device key, remove session timeout, remove detailed 2FA QR/test panels
                  if (secTxt.includes('Şifre Değiştirme') && secTxt.includes('İki Faktörlü Doğrulama')) {
                    Array.from(sec.children).forEach(function(card) {
                      const cardTxt = (card.textContent || '');
                      // 4a. Rename "Bu Bilgisayarın Cihaz Anahtarı (Güvenilir PC Kimliği)" -> "Bu Cihaz İçin Güvenilir Anahtar"
                      if (cardTxt.includes('Bu Bilgisayarın Cihaz Anahtarı') || cardTxt.includes('Bu Cihaz İçin Güvenilir Anahtar')) {
                        const h5 = card.querySelector('h5');
                        if (h5 && h5.textContent !== 'Bu Cihaz İçin Güvenilir Anahtar') {
                          h5.textContent = 'Bu Cihaz İçin Güvenilir Anahtar';
                        }
                      }
                      // 4b. Hide "Arayüz Oturum Süresi & Ekran Kapatma"
                      else if (cardTxt.includes('Arayüz Oturum Süresi') && cardTxt.includes('Ekran Kapatma')) {
                        if (card.getAttribute('data-aida-hide-security-item') !== '1') {
                          card.setAttribute('data-aida-hide-security-item', '1');
                        }
                      }
                      // 4c. In "İki Faktörlü Doğrulama (2FA)", hide detailed enrollment/QR/test boxes (keep only mode & method selectors)
                      else if (cardTxt.includes('İki Faktörlü Doğrulama')) {
                        const expanded2fa = card.children[1];
                        if (expanded2fa) {
                          Array.from(expanded2fa.children).forEach(function(subBox, idx) {
                            // idx 0 = Doğrulama Çalışma Modu, idx 1 = 2FA Doğrulama Yöntemi Seçiniz
                            // idx >= 2 = Email test box, WhatsApp test box, Google/Microsoft QR setup box
                            const subTxt = (subBox.textContent || '');
                            if (
                              idx >= 2 &&
                              (subTxt.includes('Test Kodu') ||
                               subTxt.includes('Authenticator QR') ||
                               subTxt.includes('Yeni QR Üret') ||
                               subTxt.includes('WhatsApp Aç') ||
                               subTxt.includes('Uygulamadaki 6 haneli kod'))
                            ) {
                              if (subBox.getAttribute('data-aida-hide-security-item') !== '1') {
                                subBox.setAttribute('data-aida-hide-security-item', '1');
                              }
                            }
                          });
                        }
                      }
                    });
                  }
                });
              }
            } else {
              if (document.documentElement.hasAttribute('data-aida-settings-open')) {
                document.documentElement.removeAttribute('data-aida-settings-open');
              }
            }

            // 1c. Suppress & auto-close WebPhoneDiagnosticsModal ("Web Telefon Sistem Uyarısı") on mobile
            document.querySelectorAll('div.fixed.inset-0.z-\\[120\\]').forEach(function(modal) {
              const mTxt = (modal.textContent || '');
              if (
                mTxt.includes('Sistem Uyarısı') ||
                mTxt.includes('Sistem Kontrolü') ||
                mTxt.includes('Çalışmasını Engelleyen Sorun') ||
                mTxt.includes('Bu Bilgisayarın Cihaz')
              ) {
                modal.setAttribute('data-aida-hide-diagnostics', '1');
                const closeBtn = modal.querySelector('button[title="Kapat"]');
                if (closeBtn) {
                  try { closeBtn.click(); } catch (e) {}
                }
              }
            });

            // 2. Tag Telefon Tab root, strip "Web Telefon" labels, colorize Audio Mode button & suppress noise banner
            const stage = document.querySelector('.aida-stage-active > div.aida-panel-enter > div.flex.h-full.w-full > div.flex-1');
            if (stage) {
              const wpWrapper = stage.firstElementChild;
              if (wpWrapper && wpWrapper.firstElementChild) {
                const wpRoot = wpWrapper.firstElementChild;
                if (wpRoot.getAttribute('data-aida-mobile-webphone') !== '1') {
                  wpRoot.setAttribute('data-aida-mobile-webphone', '1');
                }

                // Remove "Web Telefon" wording from status indicator & tooltips on mobile
                wpRoot.querySelectorAll('button span, h2, h3').forEach(function(el) {
                  if (el.children.length === 0 && el.textContent && el.textContent.includes('Web Telefon')) {
                    el.textContent = el.textContent.replace(/Web Telefonu?/gi, '').replace(/^\s+/, '');
                  }
                });

                // Colorize Dialpad Noise Suppression pill button directly & strip "Tarayıcı" explanation (ignore in-call icon button)
                wpRoot.querySelectorAll('button').forEach(function(btn) {
                  const ttl = btn.getAttribute('title') || '';
                  const txt = (btn.textContent || '').trim();
                  if (txt === 'AI Ses' || txt === 'Standart' || txt === 'Ham Ses') {
                    const modeKey = txt === 'AI Ses' ? 'ai' : txt === 'Standart' ? 'standard' : 'off';
                    if (btn.getAttribute('data-aida-noise-mode') !== modeKey) {
                      btn.setAttribute('data-aida-noise-mode', modeKey);
                    }
                    if (ttl.includes('Tarayıcı')) {
                      btn.setAttribute('title', 'Ses Modu: ' + txt);
                    }
                  }
                });

                // Suppress & auto-dismiss "Gürültü Engelleme: ..." notification banner at top of dialpad
                wpRoot.querySelectorAll('div.mb-3.p-3.rounded-2xl').forEach(function(banner) {
                  const bTxt = (banner.textContent || '').trim();
                  if (bTxt.includes('Gürültü Engelleme')) {
                    banner.setAttribute('data-aida-noise-banner', '1');
                    const closeBtn = banner.querySelector('button');
                    if (closeBtn) {
                      try { closeBtn.click(); } catch (e) {}
                    }
                  }
                });

                const statusText = wpRoot.textContent || '';
                const isRinging = statusText.includes('Gelen Çağrı...');
                const isCalling = statusText.includes('Aranıyor...');
                const isInCall =
                  statusText.includes('Görüşme Aktif') ||
                  statusText.includes('Beklemede') ||
                  statusText.includes('Konferans (');
                const isCallActive = isInCall || isCalling || isRinging;
                const isAcwActive = statusText.includes('Çağrı Sonrası İşlem (ACW)');
                const hasIdleBanners =
                  statusText.includes('Grubunda Çağrı Var') ||
                  isAcwActive;

                const liveLineObj = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
                const resolvedCallStatus = (liveLineObj && liveLineObj.callStatus)
                  ? String(liveLineObj.callStatus)
                  : isRinging
                  ? 'Ringing'
                  : isCalling
                  ? 'Calling'
                  : isInCall
                  ? 'InCall'
                  : 'Idle';
                if (window.__AIDA_LAST_NATIVE_CALL_STATUS__ !== resolvedCallStatus) {
                  window.__AIDA_LAST_NATIVE_CALL_STATUS__ = resolvedCallStatus;
                  postToNative('updateTrayState', { callStatus: resolvedCallStatus });
                }

                // Ensure ringtone ("dıt dıt") and ringback audio elements stop immediately once answered or idle
                if (!isRinging) {
                  const ringEl = document.getElementById('aida-ringtone-audio-el');
                  if (ringEl && !ringEl.paused) {
                    try {
                      ringEl.pause();
                      ringEl.currentTime = 0;
                    } catch (e) {}
                  }
                }
                if (isInCall || !isCallActive) {
                  const rbEl = document.getElementById('aida-ringback-audio-el');
                  if (rbEl && !rbEl.paused) {
                    try {
                      rbEl.pause();
                      rbEl.currentTime = 0;
                    } catch (e) {}
                  }
                }

                // Bind immediate native ringtone stop on Yanıtla / Reddet buttons
                if (isRinging) {
                  wpRoot.querySelectorAll('button').forEach(function(b) {
                    const bTxt = (b.textContent || '').trim();
                    if ((bTxt === 'Yanıtla' || bTxt === 'Reddet') && !b.__aidaRingStopBound) {
                      b.__aidaRingStopBound = true;
                      b.addEventListener('click', function() {
                        const nextSt = bTxt === 'Yanıtla' ? 'Calling' : 'Idle';
                        if (bTxt === 'Yanıtla') {
                          window.__aidaAnsweredCurrentCall = true;
                        }
                        window.__AIDA_LAST_NATIVE_CALL_STATUS__ = nextSt;
                        postToNative('updateTrayState', { callStatus: nextSt });
                        const ringEl = document.getElementById('aida-ringtone-audio-el');
                        if (ringEl) {
                          try {
                            ringEl.pause();
                            ringEl.currentTime = 0;
                          } catch (e) {}
                        }
                      }, true);
                    }
                  });
                }

                // Tag Call Card, Header Identity, Controls Bar, Hardware Audio Bars & Inline CRM Card for mobile redesign
                if (isCallActive) {
                  const callCard = wpRoot.querySelector('div.grid > div:nth-child(2) div.p-5.rounded-3xl') || wpRoot.querySelector('div.p-5.rounded-3xl');
                  if (callCard) {
                    const strayTrBtn = callCard.querySelector('#aida-ios-translator-return-btn');
                    if (strayTrBtn) {
                      strayTrBtn.remove();
                    }
                    if (callCard.getAttribute('data-aida-call-card') !== '1') {
                      callCard.setAttribute('data-aida-call-card', '1');
                    }
                    const mainRow = Array.from(callCard.children).find(function(ch) {
                      return ch.tagName === 'DIV' && ch.querySelector('h2');
                    }) || callCard.querySelector(':scope > div:first-of-type');
                    if (mainRow) {
                      if (mainRow.getAttribute('data-aida-call-main-row') !== '1') {
                        mainRow.setAttribute('data-aida-call-main-row', '1');
                      }
                      const identityBlock = mainRow.children[0];
                      const controlsBar = mainRow.children[1] || mainRow.lastElementChild;
                      if (identityBlock) {
                        if (identityBlock.getAttribute('data-aida-call-identity') !== '1') {
                          identityBlock.setAttribute('data-aida-call-identity', '1');
                        }
                        const avatarBox = identityBlock.children[0];
                        const textBlock = identityBlock.children[1];
                        if (avatarBox && avatarBox.getAttribute('data-aida-call-avatar') !== '1') {
                          avatarBox.setAttribute('data-aida-call-avatar', '1');
                        }
                        if (textBlock) {
                          if (textBlock.getAttribute('data-aida-call-textblock') !== '1') {
                            textBlock.setAttribute('data-aida-call-textblock', '1');
                          }
                          if (isCalling && window.__aidaAnsweredCurrentCall) {
                            textBlock.querySelectorAll('span').forEach(function(sp) {
                              if ((sp.textContent || '').includes('Aranıyor')) {
                                sp.textContent = sp.textContent.replace('Aranıyor...', 'Bağlanıyor...').replace('Aranıyor', 'Bağlanıyor...');
                              }
                            });
                          }
                        }
                      }
                      if (controlsBar && controlsBar !== identityBlock && controlsBar.getAttribute('data-aida-call-controls') !== '1') {
                        controlsBar.setAttribute('data-aida-call-controls', '1');
                      }
                    }
                    Array.from(callCard.children).forEach(function(ch) {
                      const chTxt = (ch.textContent || '').trim();
                      if (chTxt.includes('Mikrofon') && chTxt.includes('Hoparlör')) {
                        if (ch.getAttribute('data-aida-call-audiobars') !== '1') {
                          ch.setAttribute('data-aida-call-audiobars', '1');
                        }
                      } else if (chTxt.includes('Canlı CRM Müşteri Kartı') || chTxt.includes('CANLI CRM MÜŞTERİ KARTI')) {
                        if (ch.getAttribute('data-aida-call-crm') !== '1') {
                          ch.setAttribute('data-aida-call-crm', '1');
                        }
                      }
                    });
                  }
                } else {
                  [
                    'data-aida-call-card',
                    'data-aida-call-main-row',
                    'data-aida-call-identity',
                    'data-aida-call-avatar',
                    'data-aida-call-textblock',
                    'data-aida-call-controls',
                    'data-aida-call-audiobars',
                    'data-aida-call-crm'
                  ].forEach(function(attr) {
                    wpRoot.querySelectorAll('[' + attr + ']').forEach(function(el) {
                      el.removeAttribute(attr);
                    });
                  });
                }

                const nextCallAttr = isCallActive ? '1' : '0';
                const nextRingAttr = isRinging ? '1' : '0';
                const nextBannerAttr = hasIdleBanners ? '1' : '0';
                const nextAcwAttr = isAcwActive ? '1' : '0';
                if (wpRoot.getAttribute('data-call-active') !== nextCallAttr) {
                  wpRoot.setAttribute('data-call-active', nextCallAttr);
                  if (!isCallActive) {
                    wpRoot.removeAttribute('data-show-incall-keypad');
                    wpRoot.removeAttribute('data-show-incall-notes');
                    wpRoot.removeAttribute('data-show-incall-translator');
                  }
                }
                if (wpRoot.getAttribute('data-call-ringing') !== nextRingAttr) {
                  wpRoot.setAttribute('data-call-ringing', nextRingAttr);
                }
                if (wpRoot.getAttribute('data-idle-banners') !== nextBannerAttr) {
                  wpRoot.setAttribute('data-idle-banners', nextBannerAttr);
                }
                if (wpRoot.getAttribute('data-acw-active') !== nextAcwAttr) {
                  wpRoot.setAttribute('data-acw-active', nextAcwAttr);
                }

                // Remove injected in-call keypad/notes buttons when ringing or idle so incoming call buttons never shift or overflow
                if (isRinging || !isCallActive) {
                  wpRoot.querySelectorAll('#aida-ios-incall-keypad-btn, #aida-ios-incall-notes-btn').forEach(function(el) {
                    el.remove();
                  });
                }

                // Inject "← Görüşmeye Dön" button at the top of dialpad card when in-call keypad is open
                const dialpadCard = wpRoot.querySelector('div.grid > div:first-child > div');
                if (dialpadCard && !dialpadCard.querySelector('#aida-ios-return-to-call-btn')) {
                  const retBtn = document.createElement('button');
                  retBtn.id = 'aida-ios-return-to-call-btn';
                  retBtn.type = 'button';
                  retBtn.innerHTML = '← Görüşmeye Dön';
                  retBtn.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    wpRoot.setAttribute('data-show-incall-keypad', '0');
                  });
                  dialpadCard.insertBefore(retBtn, dialpadCard.firstChild);
                }

                // Inject Header + Close button inside In-Call Disposition & Notes Sheet and tag its sub-sections
                const inCallNotesBar = wpRoot.querySelector('div.p-5.rounded-3xl > div.pt-3.border-t');
                if (inCallNotesBar) {
                  if (inCallNotesBar.getAttribute('data-aida-incall-notes-sheet') !== '1') {
                    inCallNotesBar.setAttribute('data-aida-incall-notes-sheet', '1');
                  }
                  if (!inCallNotesBar.querySelector('#aida-ios-notes-sheet-header')) {
                    const hdr = document.createElement('div');
                    hdr.id = 'aida-ios-notes-sheet-header';
                    hdr.innerHTML = `
                      <span style="font-size:14px;font-weight:800;color:inherit;letter-spacing:-0.2px;">Görüşme Notu &amp; Sonuç Kodu</span>
                      <button type="button" id="aida-ios-close-notes-sheet-btn" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:12px;font-size:12px;font-weight:800;background:rgba(148,163,184,0.16);color:inherit;width:auto !important;min-height:32px !important;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        <span>Kapat</span>
                      </button>
                    `;
                    inCallNotesBar.insertBefore(hdr, inCallNotesBar.firstChild);
                    const closeNotesBtn = hdr.querySelector('#aida-ios-close-notes-sheet-btn');
                    if (closeNotesBtn) {
                      closeNotesBtn.addEventListener('click', function(ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        wpRoot.setAttribute('data-show-incall-notes', '0');
                      });
                    }
                  }
                  const nonHdrDivs = Array.from(inCallNotesBar.children).filter(function(el) {
                    return el.tagName === 'DIV' && el.id !== 'aida-ios-notes-sheet-header';
                  });
                  if (nonHdrDivs.length > 0) {
                    const dispRow = nonHdrDivs[0];
                    if (dispRow.getAttribute('data-aida-notes-disp-row') !== '1') {
                      dispRow.setAttribute('data-aida-notes-disp-row', '1');
                    }
                    const dispGrid = dispRow.firstElementChild;
                    if (dispGrid && dispGrid.getAttribute('data-aida-notes-disp-grid') !== '1') {
                      dispGrid.setAttribute('data-aida-notes-disp-grid', '1');
                    }
                    const inputRow = nonHdrDivs[nonHdrDivs.length - 1];
                    if (inputRow && inputRow !== dispRow && inputRow.getAttribute('data-aida-notes-input-row') !== '1') {
                      inputRow.setAttribute('data-aida-notes-input-row', '1');
                    }
                  }
                }

                // Tag & Adapt LiveTranslatorPanel wrapper and inner card ONLY when call is active
                if (isCallActive) {
                  const activeCallCardEl = wpRoot.querySelector('[data-aida-call-card="1"]');
                  const translatorWrap = activeCallCardEl ? activeCallCardEl.nextElementSibling : null;
                  if (translatorWrap) {
                    if (translatorWrap.getAttribute('data-aida-translator-wrap') !== '1') {
                      translatorWrap.setAttribute('data-aida-translator-wrap', '1');
                    }
                    const trCard = translatorWrap.querySelector(':scope > div.rounded-2xl') || translatorWrap.querySelector('div.rounded-2xl');
                    if (trCard) {
                      if (trCard.getAttribute('data-aida-translator-card') !== '1') {
                        trCard.setAttribute('data-aida-translator-card', '1');
                      }
                      // Strip unsupported regional flag emojis that render as [?] [?] in iOS Simulator
                      trCard.querySelectorAll('select option').forEach(function(opt) {
                        const cleanOpt = (opt.textContent || '').replace(/[\uD83C][\uDDE6-\uDDFF]/g, '').replace(/\s+/g, ' ').trim();
                        if (cleanOpt && opt.textContent !== cleanOpt) {
                          opt.textContent = cleanOpt;
                        }
                      });
                      const trInp = trCard.querySelector('form input[type="text"]');
                      if (trInp) {
                        const ph = trInp.getAttribute('placeholder') || '';
                        const cleanPh = ph.replace(/[\uD83C][\uDDE6-\uDDFF]/g, '').replace(/\(\s+/g, '(').replace(/\s+/g, ' ').trim();
                        if (cleanPh && ph !== cleanPh) {
                          trInp.setAttribute('placeholder', cleanPh);
                        }
                      }
                    }
                    if (!translatorWrap.querySelector('#aida-ios-translator-return-btn')) {
                      const trRetBtn = document.createElement('button');
                      trRetBtn.id = 'aida-ios-translator-return-btn';
                      trRetBtn.type = 'button';
                      trRetBtn.innerHTML = '← Görüşmeye Dön';
                      trRetBtn.addEventListener('click', function(ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        wpRoot.setAttribute('data-show-incall-translator', '0');
                      });
                      translatorWrap.insertBefore(trRetBtn, translatorWrap.firstChild);
                    }
                  }
                }

                // Tag open Transfer / Conference popover containers & inject Searchable Directory + Contacts Picker
                wpRoot.querySelectorAll('div.relative').forEach(function(relEl) {
                  const popover = relEl.querySelector(':scope > div.absolute.w-72');
                  if (popover) {
                    if (popover.id !== 'aida-ios-active-popover-modal') {
                      popover.id = 'aida-ios-active-popover-modal';
                    }
                    if (!popover.classList.contains('fixed')) {
                      popover.classList.add('fixed');
                    }
                    const isDarkNow = document.documentElement.classList.contains('dark');
                    popover.style.setProperty('background-color', isDarkNow ? '#0f172a' : '#ffffff', 'important');
                    popover.style.setProperty('background', isDarkNow ? '#0f172a' : '#ffffff', 'important');
                    if (relEl.getAttribute('data-aida-popover-open') !== '1') {
                      relEl.setAttribute('data-aida-popover-open', '1');
                    }
                    // Ensure directory & contacts cache is loaded
                    if (!window.__aidaDirectoryFetchStarted || (Date.now() - (window.__aidaDirectoryFetchTs || 0) > 30000)) {
                      window.__aidaDirectoryFetchStarted = true;
                      window.__aidaDirectoryFetchTs = Date.now();
                      const tenantId = sessionStorage.getItem('tenant_id') || localStorage.getItem('tenant_id') || 'tenant-default';
                      const userId = sessionStorage.getItem('current_user_id') || localStorage.getItem('current_user_id') || '';
                      const myExt = sessionStorage.getItem('current_user_ext') || localStorage.getItem('current_user_ext') || '';
                      const hdrs = {
                        'X-Tenant-ID': tenantId,
                        'X-User-ID': String(userId),
                        'X-User-Extension': String(myExt)
                      };
                      Promise.all([
                        fetch('/api/settings/users?tenant_id=' + encodeURIComponent(tenantId), { headers: hdrs }).then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; }),
                        fetch('/api/contacts', { headers: hdrs }).then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; })
                      ]).then(function(results) {
                        const usersList = Array.isArray(results[0]) ? results[0] : [];
                        const contactsList = Array.isArray(results[1]) ? results[1] : [];
                        const merged = [];
                        const seenNums = {};
                        usersList.forEach(function(u) {
                          if (!u || !u.extension) return;
                          const extStr = String(u.extension).trim();
                          if (!extStr || seenNums[extStr]) return;
                          seenNums[extStr] = true;
                          const fullName = String(u.full_name || u.name || u.username || ('Dahili ' + extStr)).trim();
                          merged.push({
                            name: fullName,
                            number: extStr,
                            isInternal: true,
                            isOnline: Boolean(u.is_online || u.status === 'online' || u.ip_address)
                          });
                        });
                        contactsList.forEach(function(c) {
                          if (!c) return;
                          const numStr = String(c.phone_number || c.phone || '').trim();
                          if (!numStr || seenNums[numStr]) return;
                          seenNums[numStr] = true;
                          const cName = (String(c.first_name || '') + ' ' + String(c.last_name || '')).trim() || String(c.name || numStr).trim();
                          merged.push({
                            name: cName,
                            number: numStr,
                            isInternal: false,
                            isOnline: false
                          });
                        });
                        window.__aidaMobileDirectoryItems = merged;
                        if (typeof window.__aidaRefreshOpenPopoverDirectory === 'function') {
                          window.__aidaRefreshOpenPopoverDirectory();
                        }
                      });
                    }

                    const inp = popover.querySelector('input[type="text"]');
                    if (inp) {
                      if (!inp.getAttribute('data-aida-dir-bound')) {
                        inp.setAttribute('data-aida-dir-bound', '1');
                        inp.setAttribute('placeholder', 'İsim, dahili veya numara ara (Örn: Murat, 1001)...');
                      }
                      const setReactInputVal = function(el, val) {
                        const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
                        if (desc && desc.set) {
                          desc.set.call(el, val);
                        } else {
                          el.value = val;
                        }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                      };
                      let picker = popover.querySelector('.aida-ios-dir-picker');
                      if (!picker) {
                        picker = document.createElement('div');
                        picker.className = 'aida-ios-dir-picker';
                        inp.insertAdjacentElement('afterend', picker);
                      }
                      const renderPickerList = function() {
                        const allItems = Array.isArray(window.__aidaMobileDirectoryItems) ? window.__aidaMobileDirectoryItems : [];
                        const rawVal = (inp.value || '').trim();
                        const qLower = rawVal.toLowerCase();
                        const isSelectedExactNum = (inp.__aidaSelectedNum && rawVal === inp.__aidaSelectedNum);
                        const filtered = allItems.filter(function(item) {
                          if (!qLower || isSelectedExactNum) return true;
                          return item.name.toLowerCase().includes(qLower) || item.number.toLowerCase().includes(qLower);
                        }).slice(0, 25);

                        const sig = filtered.map(function(i) { return i.number + ':' + (rawVal === i.number ? '1' : '0'); }).join('|') + '::' + rawVal;
                        if (picker.getAttribute('data-render-sig') === sig) return;
                        picker.setAttribute('data-render-sig', sig);
                        picker.innerHTML = '';

                        if (filtered.length === 0) {
                          const emptyEl = document.createElement('div');
                          emptyEl.style.cssText = 'padding:10px 6px;font-size:11.5px;color:#94a3b8;text-align:center;font-weight:600;';
                          emptyEl.textContent = allItems.length === 0 ? 'Rehber yükleniyor...' : 'Eşleşen kişi veya dahili bulunamadı.';
                          picker.appendChild(emptyEl);
                          return;
                        }

                        filtered.forEach(function(item) {
                          const rowBtn = document.createElement('button');
                          rowBtn.type = 'button';
                          rowBtn.className = 'aida-ios-dir-item';
                          const isSel = (rawVal === item.number);
                          if (isSel) {
                            rowBtn.setAttribute('data-selected', '1');
                          }
                          const badgeBg = item.isInternal ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.14)';
                          const badgeColor = item.isInternal ? '#4f46e5' : '#d97706';
                          const badgeTxt = item.isInternal ? ('Dahili ' + item.number) : 'Rehber';
                          rowBtn.innerHTML = `
                            <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                              <div style="width:28px;height:28px;border-radius:9px;background:${badgeBg};color:${badgeColor};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">
                                ${(item.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div style="min-width:0;flex:1;">
                                <div style="font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                  ${item.name}
                                </div>
                                <div style="font-size:10.5px;color:#64748b;font-family:monospace;font-weight:700;">
                                  ${item.number} • <span style="color:${badgeColor};">${badgeTxt}</span>
                                </div>
                              </div>
                            </div>
                            <span style="font-size:11px;font-weight:800;padding:4px 8px;border-radius:8px;background:${isSel ? '#10b981' : 'rgba(148,163,184,0.15)'};color:${isSel ? '#ffffff' : 'inherit'};flex-shrink:0;">
                              ${isSel ? '✓ Seçildi' : 'Seç'}
                            </span>
                          `;
                          rowBtn.addEventListener('click', function(ev) {
                            ev.preventDefault();
                            ev.stopPropagation();
                            inp.__aidaSelectedName = item.name;
                            inp.__aidaSelectedNum = item.number;
                            setReactInputVal(inp, item.number);
                            renderPickerList();
                          });
                          picker.appendChild(rowBtn);
                        });
                      };
                      window.__aidaRefreshOpenPopoverDirectory = renderPickerList;
                      if (!inp.__aidaDirInputListener) {
                        inp.__aidaDirInputListener = true;
                        inp.addEventListener('input', function() {
                          renderPickerList();
                        });
                      }
                      renderPickerList();

                      // If user typed a name (e.g. "Murat") and tapped an action button directly, auto-resolve to matching number!
                      popover.querySelectorAll('button').forEach(function(actBtn) {
                        if (actBtn.classList.contains('aida-ios-dir-item')) return;
                        const bTxt = (actBtn.textContent || '').trim();
                        if ((bTxt.includes('Transfer') || bTxt.includes('Konferansa Ekle')) && !actBtn.__aidaAutoResolveBound) {
                          actBtn.__aidaAutoResolveBound = true;
                          actBtn.addEventListener('click', function() {
                            const curV = (inp.value || '').trim();
                            if (curV && /[^0-9+*#]/.test(curV)) {
                              const allItems = Array.isArray(window.__aidaMobileDirectoryItems) ? window.__aidaMobileDirectoryItems : [];
                              const match = allItems.find(function(it) {
                                return it.name.toLowerCase().includes(curV.toLowerCase());
                              });
                              if (match && match.number) {
                                setReactInputVal(inp, match.number);
                              }
                            }
                          }, true);
                        }
                      });
                    }
                  } else if (relEl.hasAttribute('data-aida-popover-open')) {
                    relEl.removeAttribute('data-aida-popover-open');
                  }
                });

                // Inject In-Call Keypad ("Tuşlar") & Notes ("Not & Kod") Toggle Buttons & Label All WebPhone Call Controls
                const hangupBtn = wpRoot.querySelector('button[title="Çağrıyı Sonlandır"]');
                if (isCallActive && !isRinging && hangupBtn && hangupBtn.parentElement) {
                  const ctrlBar = hangupBtn.parentElement;
                  let kpBtn = ctrlBar.querySelector('#aida-ios-incall-keypad-btn');
                  if (!kpBtn) {
                    kpBtn = document.createElement('button');
                    kpBtn.id = 'aida-ios-incall-keypad-btn';
                    kpBtn.type = 'button';
                    kpBtn.title = 'Tuş Takımı (DTMF)';
                    kpBtn.setAttribute('data-aida-call-label', 'Tuşlar');
                    kpBtn.className = 'h-11 w-11 rounded-2xl border flex items-center justify-center transition-all bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200';
                    kpBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="4" height="4" x="3" y="3" rx="1"/><rect width="4" height="4" x="10" y="3" rx="1"/><rect width="4" height="4" x="17" y="3" rx="1"/><rect width="4" height="4" x="3" y="10" rx="1"/><rect width="4" height="4" x="10" y="10" rx="1"/><rect width="4" height="4" x="17" y="10" rx="1"/><rect width="4" height="4" x="3" y="17" rx="1"/><rect width="4" height="4" x="10" y="17" rx="1"/><rect width="4" height="4" x="17" y="17" rx="1"/></svg>`;
                    kpBtn.addEventListener('click', function(ev) {
                      ev.preventDefault();
                      ev.stopPropagation();
                      const cur = wpRoot.getAttribute('data-show-incall-keypad') === '1';
                      wpRoot.setAttribute('data-show-incall-keypad', cur ? '0' : '1');
                      wpRoot.setAttribute('data-show-incall-notes', '0');
                      wpRoot.setAttribute('data-show-incall-translator', '0');
                    });
                    ctrlBar.insertBefore(kpBtn, hangupBtn);
                  }

                  let notesBtn = ctrlBar.querySelector('#aida-ios-incall-notes-btn');
                  if (!notesBtn) {
                    notesBtn = document.createElement('button');
                    notesBtn.id = 'aida-ios-incall-notes-btn';
                    notesBtn.type = 'button';
                    notesBtn.title = 'Görüşme Notu & Sonuç Kodu';
                    notesBtn.setAttribute('data-aida-call-label', 'Not & Kod');
                    notesBtn.className = 'h-11 w-11 rounded-2xl border flex items-center justify-center transition-all bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200';
                    notesBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
                    notesBtn.addEventListener('click', function(ev) {
                      ev.preventDefault();
                      ev.stopPropagation();
                      const cur = wpRoot.getAttribute('data-show-incall-notes') === '1';
                      wpRoot.setAttribute('data-show-incall-notes', cur ? '0' : '1');
                    });
                    ctrlBar.insertBefore(notesBtn, hangupBtn);
                  }

                  // Always keep Tuşlar & Not & Kod right before Hangup button so the 5x2 grid order never shifts
                  if (kpBtn.nextElementSibling !== notesBtn) {
                    ctrlBar.insertBefore(kpBtn, hangupBtn);
                  }
                  if (notesBtn.nextElementSibling !== hangupBtn) {
                    ctrlBar.insertBefore(notesBtn, hangupBtn);
                  }

                  ctrlBar.querySelectorAll('button').forEach(function(b) {
                    if (b === hangupBtn || b === kpBtn || b === notesBtn) return;
                    if (b.hasAttribute('data-aida-hide-incall-btn')) {
                      b.removeAttribute('data-aida-hide-incall-btn');
                    }
                    const t = b.getAttribute('title') || '';
                    if (t.includes('Sessize Al')) {
                      if (b.getAttribute('data-aida-call-label') !== 'Sessiz') {
                        b.setAttribute('data-aida-call-label', 'Sessiz');
                      }
                    } else if (t.includes('Sesi Aç')) {
                      if (b.getAttribute('data-aida-call-label') !== 'Sesi Aç') {
                        b.setAttribute('data-aida-call-label', 'Sesi Aç');
                      }
                    } else if (t.includes('Beklemeye Al')) {
                      if (b.getAttribute('data-aida-call-label') !== 'Beklet') {
                        b.setAttribute('data-aida-call-label', 'Beklet');
                      }
                    } else if (t.includes('Devam Et')) {
                      if (b.getAttribute('data-aida-call-label') !== 'Devam') {
                        b.setAttribute('data-aida-call-label', 'Devam');
                      }
                    } else if (t.includes('Gürültü Engelleme') || t.includes('Ses Modu')) {
                      const savedMode = (localStorage.getItem('webphone_noise_mode') || '').trim();
                      const noiseMode = t.includes('Yapay Zeka')
                        ? 'ai'
                        : t.includes('Standart')
                        ? 'standard'
                        : t.includes('Kapalı')
                        ? 'off'
                        : (savedMode === 'ai' || savedMode === 'standard' || savedMode === 'off')
                        ? savedMode
                        : 'off';
                      const noiseLabel = noiseMode === 'ai'
                        ? 'Ses: AI'
                        : noiseMode === 'standard'
                        ? 'Ses: Standart'
                        : 'Ses: Kapalı';
                      if (b.hasAttribute('data-aida-noise-mode')) {
                        b.removeAttribute('data-aida-noise-mode');
                      }
                      if (b.getAttribute('data-aida-incall-noise-mode') !== noiseMode) {
                        b.setAttribute('data-aida-incall-noise-mode', noiseMode);
                      }
                      if (b.getAttribute('data-aida-call-label') !== noiseLabel) {
                        b.setAttribute('data-aida-call-label', noiseLabel);
                      }
                    } else if (t.includes('KVKK') || t.includes('Maskelemeyi')) {
                      if (b.getAttribute('data-aida-call-label') !== 'KVKK') {
                        b.setAttribute('data-aida-call-label', 'KVKK');
                      }
                    } else if (t === 'Çağrı Transferi') {
                      if (b.getAttribute('data-aida-call-label') !== 'Transfer') {
                        b.setAttribute('data-aida-call-label', 'Transfer');
                      }
                    } else if (t === 'Konferans Görüşmesi') {
                      if (b.getAttribute('data-aida-call-label') !== 'Konferans') {
                        b.setAttribute('data-aida-call-label', 'Konferans');
                      }
                    } else if (t.includes('Yeni Çağrı') || t.includes('2. Hat')) {
                      if (b.getAttribute('data-aida-call-label') !== 'Yeni Hat') {
                        b.setAttribute('data-aida-call-label', 'Yeni Hat');
                      }
                    } else if (t.includes('Çeviri')) {
                      if (b.getAttribute('data-aida-call-label') !== 'Çeviri') {
                        b.setAttribute('data-aida-call-label', 'Çeviri');
                      }
                      if (!b.__aidaMobileTranslatorBound) {
                        b.__aidaMobileTranslatorBound = true;
                        b.addEventListener('click', function(ev) {
                          const activeCardEl = wpRoot.querySelector('[data-aida-call-card="1"]');
                          const trDiv = wpRoot.querySelector('[data-aida-translator-wrap="1"]') || (activeCardEl ? activeCardEl.nextElementSibling : null);
                          const isReactHidden = trDiv && trDiv.classList.contains('hidden');
                          const curMobileOpen = wpRoot.getAttribute('data-show-incall-translator') === '1';
                          const nextMobileOpen = !curMobileOpen;
                          wpRoot.setAttribute('data-show-incall-translator', nextMobileOpen ? '1' : '0');
                          wpRoot.setAttribute('data-show-incall-keypad', '0');
                          wpRoot.setAttribute('data-show-incall-notes', '0');
                          if (nextMobileOpen && !isReactHidden) {
                            // React already has LiveTranslatorPanel mounted; stop click from unmounting it
                            ev.preventDefault();
                            ev.stopPropagation();
                          } else if (!nextMobileOpen && !isReactHidden) {
                            // Keep React mounted in background, just hide on mobile via attribute
                            ev.preventDefault();
                            ev.stopPropagation();
                          }
                        }, true);
                      }
                    }
                  });
                }
              }

              // Tag History Tab, Missed Calls Tab, or Voicemail Tab root when active
              const otherWrapper = stage.children[1];
              if (otherWrapper && otherWrapper.firstElementChild) {
                const otherRoot = otherWrapper.firstElementChild;
                const h2 = otherRoot.querySelector('h2');
                const h2Txt = h2 ? (h2.textContent || '') : '';
                if (h2Txt.includes('Kişisel Çağrı Geçmişim')) {
                  if (otherRoot.getAttribute('data-aida-mobile-history') !== '1') {
                    otherRoot.setAttribute('data-aida-mobile-history', '1');
                  }
                } else if (h2Txt.includes('Kayıp Çağrılar')) {
                  if (otherRoot.getAttribute('data-aida-mobile-missed') !== '1') {
                    otherRoot.setAttribute('data-aida-mobile-missed', '1');
                  }
                } else if (h2Txt.includes('Sesli Posta Kutusu')) {
                  if (otherRoot.getAttribute('data-aida-mobile-voicemail') !== '1') {
                    otherRoot.setAttribute('data-aida-mobile-voicemail', '1');
                  }
                  try {
                    const nowTs = Date.now();
                    if (!window.__aidaVmContactsMap) {
                      window.__aidaVmContactsMap = {};
                    }
                    if (!window.__aidaVmContactsFetching && (!window.__aidaVmContactsTs || (nowTs - window.__aidaVmContactsTs) > 30000)) {
                      window.__aidaVmContactsFetching = true;
                      Promise.all([
                        fetch('/api/contacts', { credentials: 'include' }).then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; }),
                        fetch('/api/agent/directory', { credentials: 'include' }).then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; })
                      ]).then(function(resArr) {
                        const cList = Array.isArray(resArr[0]) ? resArr[0] : [];
                        const dList = Array.isArray(resArr[1]) ? resArr[1] : [];
                        const map = {};
                        cList.forEach(function(c) {
                          if (!c) return;
                          const rawP = String(c.phone_number || c.phone || '');
                          const d = rawP.replace(/\D+/g, '');
                          const nm = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || String(c.name || '').trim();
                          if (d && nm) {
                            map[d] = nm;
                            if (d.length >= 10) map[d.slice(-10)] = nm;
                          }
                        });
                        dList.forEach(function(u) {
                          if (!u) return;
                          const nm = String(u.full_name || u.name || u.username || '').trim();
                          if (!nm) return;
                          if (u.extension) map[String(u.extension).trim()] = nm;
                          ['phone', 'gsm', 'mobile', 'phone_number'].forEach(function(k) {
                            const d = String(u[k] || '').replace(/\D+/g, '');
                            if (d) {
                              map[d] = nm;
                              if (d.length >= 10) map[d.slice(-10)] = nm;
                            }
                          });
                        });
                        window.__aidaVmContactsMap = map;
                        window.__aidaVmContactsTs = Date.now();
                        window.__aidaVmContactsFetching = false;
                      }).catch(function() {
                        window.__aidaVmContactsFetching = false;
                      });
                    }
                    const cmap = window.__aidaVmContactsMap || {};
                    otherRoot.querySelectorAll('span.text-sm.font-extrabold').forEach(function(sp) {
                      const rawTxt = (sp.textContent || '').trim();
                      if (!rawTxt || rawTxt.includes('(')) return;
                      const digits = rawTxt.replace(/\D+/g, '');
                      if (digits.length < 3) return;
                      const matchedName = cmap[digits] || (digits.length >= 10 ? cmap[digits.slice(-10)] : '');
                      if (matchedName) {
                        sp.textContent = matchedName + ' (' + rawTxt + ')';
                      }
                    });
                  } catch (e) {}
                }
              }
            }

            // 2b. Proactively repair WAV headers on any mounted <audio> elements & tag Floating Audio Popup
            document.querySelectorAll('audio').forEach(function(audioEl) {
              const rawSrc = audioEl.getAttribute('src') || '';
              if (
                rawSrc &&
                !rawSrc.startsWith('blob:') &&
                (rawSrc.includes('/api/recordings/') ||
                  rawSrc.includes('/api/voicemails/') ||
                  /\.wav(\?|$)/i.test(rawSrc))
              ) {
                audioEl.setAttribute('data-aida-orig-src', rawSrc);
                resolveRepairedAudioUrl(rawSrc).then(function(blobUrl) {
                  if (audioEl.src !== blobUrl) {
                    const wasPlaying = !audioEl.paused;
                    audioEl.src = blobUrl;
                    audioEl.load();
                    if (wasPlaying || audioEl.autoplay) {
                      audioEl.play().catch(function() {});
                    }
                  }
                }).catch(function() {});
              }
              const popupParent = audioEl.closest('div.fixed.bottom-6');
              if (popupParent && popupParent.getAttribute('data-aida-mobile-audio-popup') !== '1') {
                popupParent.setAttribute('data-aida-mobile-audio-popup', '1');
              }
            });

            // 3. Adapt Sohbet (AgentChatTab) Split View for Full-Bleed Mobile Master-Detail Navigation
            const chatSplit = document.querySelector('div[style*="--agent-sidebar-w"]');
            if (chatSplit) {
              const chatOuter = chatSplit.parentElement && chatSplit.parentElement.parentElement;
              if (chatOuter) {
                if (chatOuter.getAttribute('data-aida-mobile-chat-root') !== '1') {
                  chatOuter.setAttribute('data-aida-mobile-chat-root', '1');
                }
                if (chatOuter.getAttribute('data-no-info-collapse') !== 'true') {
                  chatOuter.setAttribute('data-no-info-collapse', 'true');
                }
              }

              const leftPane = chatSplit.firstElementChild;
              const rightPane = chatSplit.lastElementChild;
              const chatHeader = rightPane ? rightPane.querySelector('div.h-16.shrink-0.border-b') : null;

              if (!chatHeader) {
                if (chatSplit.getAttribute('data-mobile-chat-view') !== 'list') {
                  chatSplit.setAttribute('data-mobile-chat-view', 'list');
                }
              } else {
                if (window.__AIDA_FORCE_MOBILE_CHAT_THREAD__) {
                  window.__AIDA_FORCE_MOBILE_CHAT_THREAD__ = false;
                  if (chatSplit.getAttribute('data-mobile-chat-view') !== 'thread') {
                    chatSplit.setAttribute('data-mobile-chat-view', 'thread');
                  }
                }
                // Clean up any SystemInfoHintManager "(i)" button & un-collapse subtitle inside Chat Header
                chatHeader.querySelectorAll('.aida-info-btn').forEach(function(b) { b.remove(); });
                chatHeader.querySelectorAll('[data-aida-hint-collapsed="true"]').forEach(function(p) {
                  p.removeAttribute('data-aida-hint-collapsed');
                });

                const headerLeft = chatHeader.firstElementChild;
                if (headerLeft && !headerLeft.querySelector('.aida-mobile-chat-back-btn')) {
                  const backBtn = document.createElement('button');
                  backBtn.type = 'button';
                  backBtn.className = 'aida-mobile-chat-back-btn';
                  backBtn.innerHTML = '← Liste';
                  backBtn.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    window.__AIDA_FORCE_MOBILE_CHAT_THREAD__ = false;
                    if (document.activeElement && typeof document.activeElement.blur === 'function') {
                      document.activeElement.blur();
                    }
                    chatSplit.setAttribute('data-mobile-chat-view', 'list');
                  });
                  headerLeft.insertBefore(backBtn, headerLeft.firstChild);
                }
              }

              if (leftPane && !leftPane.__aidaMobileBound) {
                leftPane.__aidaMobileBound = true;
                leftPane.addEventListener('click', function(ev) {
                  const listContainer = leftPane.querySelector('.flex-1.overflow-y-auto');
                  if (listContainer && listContainer.contains(ev.target)) {
                    const btn = ev.target.closest('button');
                    if (btn && !btn.title?.includes('Sil')) {
                      setTimeout(function() {
                        const hdr = rightPane ? rightPane.querySelector('div.h-16.shrink-0.border-b') : null;
                        if (hdr) {
                          const replyInput = document.getElementById('agent-chat-reply-input');
                          if (replyInput) {
                            replyInput.style.pointerEvents = 'none';
                            replyInput.blur();
                            setTimeout(function() {
                              replyInput.style.pointerEvents = '';
                            }, 350);
                          }
                          chatSplit.setAttribute('data-mobile-chat-view', 'thread');
                          if (window.scrollTo) window.scrollTo(0, 0);
                        }
                      }, 50);
                    }
                  }
                });
              }
            }

            // 4. Hide Floating CallChatWidget ONLY when it is collapsed and idle
            const floatingWidget = document.querySelector('div.fixed.bottom-5.right-5.z-\\[9999\\]');
            if (floatingWidget) {
              const txt = (floatingWidget.textContent || '').trim();
              const isExpanded = floatingWidget.querySelector('.w-\\[390px\\]') !== null;
              const isIdlePill =
                !isExpanded &&
                (txt.startsWith('Web Telefon (') || txt.startsWith('Bağlanıyor...'));
              floatingWidget.setAttribute('data-aida-widget-idle', isIdlePill ? '1' : '0');
            }

            // 5. Render Bottom Floating Bubble Navigation Bar & "Daha Fazlası" Popover
            renderBottomFloatingDock();
          }

          function performPendingNotifNavigation(navObj) {
            if (!navObj || !navObj.subTab) return;
            const targetSub = String(navObj.subTab);
            const targetPeer = navObj.peerSenderId ? String(navObj.peerSenderId).trim() : '';
            morePopoverOpen = false;
            closeMobileQueueModal();
            window.__CURRENT_AGENT_SUBTAB__ = targetSub;

            const idToLabel = {
              'dashboard': 'Pano',
              'webphone': 'Web Telefon',
              'agents': 'Temsilciler',
              'speeddial': 'Hızlı Arama',
              'missed': 'Kayıp Çağrı',
              'directory': 'Rehber',
              'history': 'Çağrı Geçmişi',
              'voicemail': 'Sesli Posta',
              'chat': 'Sohbet',
              'deskphone': 'Masa Telefonum'
            };
            const targetLabel = idToLabel[targetSub];
            const curMeta = readTabMetaFromDOM();
            if (curMeta.activeTab !== targetSub && targetLabel) {
              const mobileTabBar = document.querySelector('.aida-stage-active > div.aida-panel-enter > div.flex.h-full.w-full > div.md\\:hidden');
              if (mobileTabBar) {
                mobileTabBar.querySelectorAll('button').forEach(function(btn) {
                  const sp = btn.querySelector('span.text-xs');
                  if (sp && sp.textContent.trim() === targetLabel) {
                    try { btn.click(); } catch (e) {}
                  }
                });
              }
            }

            if (targetSub === 'chat' && targetPeer) {
              window.__AIDA_FORCE_MOBILE_CHAT_THREAD__ = true;
              try {
                window.dispatchEvent(new CustomEvent('OPEN_INTERNAL_CHAT_PEER', { detail: { peerSenderId: targetPeer } }));
              } catch (e) {}
              const chatSplit = document.querySelector('div[style*="--agent-sidebar-w"]');
              if (chatSplit) {
                const leftPane = chatSplit.firstElementChild;
                const rightPane = chatSplit.lastElementChild;
                if (leftPane) {
                  leftPane.querySelectorAll('button').forEach(function(b) {
                    const bTxt = (b.textContent || '').trim();
                    if (bTxt.includes('İç Yazışma') && !b.className.includes('shadow')) {
                      try { b.click(); } catch (e) {}
                    }
                  });
                  const listContainer = leftPane.querySelector('.flex-1.overflow-y-auto');
                  if (listContainer) {
                    listContainer.querySelectorAll('button').forEach(function(rowBtn) {
                      const rTxt = (rowBtn.textContent || '');
                      if (rTxt.includes(targetPeer) && !rowBtn.title?.includes('Sil')) {
                        try { rowBtn.click(); } catch (e) {}
                      }
                    });
                  }
                }
                const chatHeader = rightPane ? rightPane.querySelector('div.h-16.shrink-0.border-b') : null;
                if (chatHeader) {
                  chatSplit.setAttribute('data-mobile-chat-view', 'thread');
                }
              }
            }
            renderBottomFloatingDock();
          }

          let rafPending = false;
          function scheduleDOMAdaptations() {
            if (rafPending) return;
            rafPending = true;
            if (document.visibilityState === 'hidden') {
              setTimeout(function() {
                rafPending = false;
                try {
                  applyDOMAdaptations();
                } catch (e) {}
              }, 20);
            } else {
              requestAnimationFrame(function() {
                rafPending = false;
                try {
                  applyDOMAdaptations();
                } catch (e) {}
              });
            }
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyDOMAdaptations);
          } else {
            applyDOMAdaptations();
          }

          window.addEventListener('AGENT_SUBTAB_CHANGED', function() {
            setTimeout(applyDOMAdaptations, 20);
          });

          window.addEventListener('AIDA_IOS_TOGGLE_MORE_POPOVER', function(e) {
            if (e && e.detail && typeof e.detail.open === 'boolean') {
              morePopoverOpen = e.detail.open;
            } else {
              morePopoverOpen = !morePopoverOpen;
            }
            renderBottomFloatingDock();
          });

          if (window.__AIDA_PENDING_NOTIF_NAV__ && window.__AIDA_PENDING_NOTIF_NAV__.subTab) {
            const bootNav = window.__AIDA_PENDING_NOTIF_NAV__;
            [150, 500, 1000, 1700, 2600].forEach(function(ms) {
              setTimeout(function() {
                performPendingNotifNavigation(bootNav);
              }, ms);
            });
          }

          window.addEventListener('SWITCH_AGENT_PANEL_SUBTAB', function(e) {
            if (e && e.detail && e.detail.subTab) {
              const navDetail = e.detail;
              performPendingNotifNavigation(navDetail);
              [120, 400, 850, 1500].forEach(function(ms) {
                setTimeout(function() {
                  performPendingNotifNavigation(navDetail);
                }, ms);
              });
            }
            if (e && e.detail && e.detail.autoWeek) {
              setTimeout(function() {
                document.querySelectorAll('button').forEach(function(b) {
                  if ((b.textContent || '').includes('Son 1 Haftayı Göster')) {
                    b.click();
                  }
                });
              }, 400);
            }
          });

          function focusMobileWebphoneForIncomingCall() {
            try {
              morePopoverOpen = false;
              closeMobileQueueModal();
              const settingsCloseBtn = document.querySelector('.aida-settings-modal-dialog button[title="Kapat"]');
              if (settingsCloseBtn) {
                try { settingsCloseBtn.click(); } catch (e) {}
              }
              switchSubTab('webphone');
              setTimeout(applyDOMAdaptations, 30);
            } catch (e) {}
          }

          window.addEventListener('INCOMING_WEBPHONE_CALL', function() {
            focusMobileWebphoneForIncomingCall();
          });

          window.addEventListener('OPEN_FULL_WEBPHONE', function() {
            focusMobileWebphoneForIncomingCall();
          });

          function syncMobileCallKitTelemetry() {
            try {
              const line = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
              if (!line) {
                if (window.__aidaColdPickupRequest) {
                  return;
                }
                if (!window.__aidaHadActiveSipLine) {
                  return;
                }
                window.__aidaHadActiveSipLine = false;
                window.__aidaAnsweredCurrentCall = false;
                const idleSig = 'Idle|0|0|0||';
                if (window.__AIDA_LAST_CALLKIT_TELEMETRY_SIG__ !== idleSig) {
                  window.__AIDA_LAST_CALLKIT_TELEMETRY_SIG__ = idleSig;
                  postToNative('updateCallKitTelemetry', {
                    callStatus: 'Idle',
                    isMuted: false,
                    isOnHold: false,
                    callDuration: 0,
                    remoteNumber: '',
                    remoteDisplayName: ''
                  });
                }
                return;
              }

              let callStatus = String(line.callStatus || 'Idle');
              if (callStatus === 'Ringing' || callStatus === 'Calling' || callStatus === 'InCall') {
                window.__aidaHadActiveSipLine = true;
              }
              if (window.__aidaAnsweredCurrentCall && callStatus === 'Ringing') {
                callStatus = 'Calling';
              }
              let isMuted = Boolean(line.isMuted);
              let isOnHold = Boolean(line.isOnHold);
              let callDuration = 0;
              let remoteNumber = String(line.remoteNumber || '');
              let remoteDisplayName = String(line.remoteDisplayName || '');

              if (remoteNumber.indexOf('**') === 0 || remoteNumber.indexOf('*8') === 0) {
                if (window.__aidaColdLaunchCallerNumber) {
                  remoteNumber = window.__aidaColdLaunchCallerNumber;
                }
                if (window.__aidaColdLaunchCallerName) {
                  remoteDisplayName = window.__aidaColdLaunchCallerName;
                }
              }

              // Sync resolved contact display name (e.g. "Anıl Özel") from AgentWebphoneTab DOM if available
              try {
                const wpH2 = document.querySelector('[data-aida-mobile-webphone="1"] > div.grid > div:nth-child(2) div.p-5.rounded-3xl h2');
                if (wpH2) {
                  const domName = (wpH2.textContent || '').trim();
                  if (domName && domName.indexOf('**') !== 0 && domName.indexOf('*8') !== 0 && domName !== remoteNumber) {
                    remoteDisplayName = domName;
                  }
                }
              } catch (e) {}

              if (line.callStatus === 'InCall' && line.establishedAt) {
                callDuration = Math.max(0, Math.floor((Date.now() - line.establishedAt) / 1000));
              } else if (typeof line.callDuration === 'number') {
                callDuration = line.callDuration;
              }

              const sig = [
                callStatus,
                isMuted ? '1' : '0',
                isOnHold ? '1' : '0',
                String(callDuration),
                remoteNumber,
                remoteDisplayName
              ].join('|');

              if (window.__AIDA_LAST_CALLKIT_TELEMETRY_SIG__ !== sig) {
                window.__AIDA_LAST_CALLKIT_TELEMETRY_SIG__ = sig;
                postToNative('updateCallKitTelemetry', {
                  callStatus: callStatus,
                  isMuted: isMuted,
                  isOnHold: isOnHold,
                  callDuration: callDuration,
                  remoteNumber: remoteNumber,
                  remoteDisplayName: remoteDisplayName
                });
              }
            } catch (e) {}
          }

          setInterval(syncMobileCallKitTelemetry, 500);

          function triggerMobileAnswerCall(detail) {
            try {
              const d = detail || {};
              const pickupExten = String(d.pickupExten || '').trim();
              if (d.callerNumber) {
                window.__aidaColdLaunchCallerNumber = String(d.callerNumber);
              }
              if (d.callerName) {
                window.__aidaColdLaunchCallerName = String(d.callerName);
              }

              const curLine = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
              if (window.__aidaAnsweredCurrentCall && curLine && (curLine.callStatus === 'InCall' || curLine.callStatus === 'Calling')) {
                return;
              }

              const ringEl = document.getElementById('aida-ringtone-audio-el');
              if (ringEl) {
                try { ringEl.pause(); ringEl.currentTime = 0; } catch (e) {}
              }
              focusMobileWebphoneForIncomingCall();

              let attempts = 0;
              const tryAnswer = function() {
                attempts++;
                let answered = false;

                // 1. Try always-mounted CallChatWidget inline answer button
                const widgetAnswerBtn = document.querySelector('button[title="Çağrıyı Cevapla"]');
                if (widgetAnswerBtn) {
                  answered = true;
                  window.__aidaAnsweredCurrentCall = true;
                  widgetAnswerBtn.click();
                }

                // 2. Try AgentWebphoneTab answer button
                if (!answered) {
                  document.querySelectorAll('button').forEach(function(b) {
                    const t = (b.textContent || '').trim();
                    if (!answered && (t === 'Yanıtla' || t === 'Gelen Çağrıyı Yanıtla')) {
                      answered = true;
                      window.__aidaAnsweredCurrentCall = true;
                      b.click();
                    }
                  });
                }

                // 3. Direct SIP.js session accept fallback if button not yet mounted
                const activeLine = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
                if (!answered && activeLine && activeLine.callStatus === 'Ringing' && activeLine.session && attempts >= 2) {
                  try {
                    if (typeof activeLine.session.accept === 'function') {
                      answered = true;
                      window.__aidaAnsweredCurrentCall = true;
                      activeLine.session.accept({
                        sessionDescriptionHandlerOptions: {
                          constraints: { audio: true, video: false },
                          iceGatheringTimeout: 400
                        }
                      });
                    }
                  } catch (e) {}
                }

                // 4. Cold-Launch VoIP Push Call Pickup Fallback:
                // When the app was closed (terminated) and woken up by a VoIP Push while Dahili 1000 is ringing on Asterisk,
                // SIP.js connects after the initial INVITE was sent. Dialing **1000 triggers Asterisk PickupChan to bridge the call!
                if (!answered && pickupExten && !activeLine) {
                  if (!window.__aidaColdPickupRequest) {
                    window.__aidaColdPickupRequest = {
                      pickupExten: pickupExten,
                      callerNumber: window.__aidaColdLaunchCallerNumber || '',
                      callerName: window.__aidaColdLaunchCallerName || '',
                      startedAt: Date.now(),
                      lastTriggerAt: 0,
                      triggerCount: 0,
                      recordedPickup: false
                    };
                  } else {
                    window.__aidaColdPickupRequest.pickupExten = pickupExten;
                    if (window.__aidaColdLaunchCallerNumber) {
                      window.__aidaColdPickupRequest.callerNumber = window.__aidaColdLaunchCallerNumber;
                    }
                    if (window.__aidaColdLaunchCallerName) {
                      window.__aidaColdPickupRequest.callerName = window.__aidaColdLaunchCallerName;
                    }
                  }
                  if (!window.__aidaColdPickupTimer) {
                    window.__aidaColdPickupTimer = setInterval(function() {
                      try {
                        const req = window.__aidaColdPickupRequest;
                        if (!req) {
                          clearInterval(window.__aidaColdPickupTimer);
                          window.__aidaColdPickupTimer = null;
                          return;
                        }
                        if (Date.now() - req.startedAt > 24000) {
                          window.__aidaColdPickupRequest = null;
                          clearInterval(window.__aidaColdPickupTimer);
                          window.__aidaColdPickupTimer = null;
                          return;
                        }
                        const cur = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
                        if (cur) {
                          if (cur.callStatus === 'Ringing' && cur.session && typeof cur.session.accept === 'function') {
                            window.__aidaAnsweredCurrentCall = true;
                            window.__aidaColdPickupRequest = null;
                            clearInterval(window.__aidaColdPickupTimer);
                            window.__aidaColdPickupTimer = null;
                            cur.session.accept({
                              sessionDescriptionHandlerOptions: {
                                constraints: { audio: true, video: false },
                                iceGatheringTimeout: 400
                              }
                            });
                            setTimeout(syncMobileCallKitTelemetry, 80);
                            return;
                          }
                          if (cur.callStatus === 'Calling' || cur.callStatus === 'InCall') {
                            if (req.callerNumber && (String(cur.remoteNumber || '').indexOf('**') === 0 || String(cur.remoteNumber || '').indexOf('*8') === 0)) {
                              cur.remoteNumber = req.callerNumber;
                              if (req.callerName && req.callerName !== req.callerNumber) {
                                cur.remoteDisplayName = req.callerName;
                              }
                            }
                            window.__aidaAnsweredCurrentCall = true;
                            window.__aidaHadActiveSipLine = true;
                            if (cur.callStatus === 'InCall') {
                              window.__aidaColdPickupRequest = null;
                              clearInterval(window.__aidaColdPickupTimer);
                              window.__aidaColdPickupTimer = null;
                            }
                            setTimeout(syncMobileCallKitTelemetry, 80);
                            return;
                          }
                        }
                        const webphoneReady = Boolean(window.__aidaSipWsRegistered);
                        const webphoneMounted = Boolean(document.querySelector('[data-aida-mobile-webphone="1"]'));
                        const minWaitMs = req.triggerCount === 0 ? 0 : 7500;
                        if (webphoneReady && webphoneMounted && req.triggerCount < 2 && (Date.now() - (req.lastTriggerAt || 0) >= minWaitMs)) {
                          req.lastTriggerAt = Date.now();
                          req.triggerCount = (req.triggerCount || 0) + 1;
                          focusMobileWebphoneForIncomingCall();
                          if (!req.recordedPickup) {
                            req.recordedPickup = true;
                            try {
                              fetch('/api/webrtc/pickup-call', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  picker_extension: req.pickupExten,
                                  ringing_extension: req.pickupExten,
                                  caller_number: req.callerNumber || ''
                                })
                              }).catch(function() {});
                            } catch (e) {}
                          }
                          const dialCode = '**' + req.pickupExten;
                          window.dispatchEvent(new CustomEvent('TRIGGER_CALL', { detail: dialCode }));
                        }
                      } catch (e) {}
                    }, 220);
                  }
                  answered = true;
                }

                if (!answered && attempts < 18) {
                  setTimeout(tryAnswer, 120);
                } else {
                  setTimeout(syncMobileCallKitTelemetry, 80);
                }
              };
              tryAnswer();
            } catch (e) {}
          }

          window.addEventListener('AIDA_CALLKIT_ANSWER', function(ev) {
            triggerMobileAnswerCall(ev && ev.detail ? ev.detail : {});
          });

          window.addEventListener('AIDA_CALLKIT_AUDIO_ACTIVATED', function() {
            try {
              // Ensure all WebRTC remote <audio> elements are unmuted and playing
              document.querySelectorAll('audio[id^="aida-webphone-audio-"]').forEach(function(el) {
                try {
                  el.muted = false;
                  if (el.paused) {
                    el.play().catch(function() {});
                  }
                } catch (e) {}
              });

              // Verify active line's RTCPeerConnection has a live microphone track
              const line = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
              if (line && line.callStatus === 'Ringing') {
                triggerMobileAnswerCall();
              } else if (line && line.session && line.session.sessionDescriptionHandler) {
                const pc = line.session.sessionDescriptionHandler.peerConnection;
                if (pc && typeof pc.getSenders === 'function') {
                  pc.getSenders().forEach(function(sender) {
                    if (sender.track && sender.track.kind === 'audio') {
                      sender.track.enabled = !line.isMuted && !line.isOnHold;
                    }
                  });
                }
              }
              syncMobileCallKitTelemetry();
            } catch (e) {}
          });

          window.addEventListener('AIDA_SIM_UI_ACTION', function(ev) {
            try {
              const d = (ev && ev.detail) || {};
              const act = String(d.action || '');
              const wpRoot = document.querySelector('[data-aida-mobile-webphone="1"]');
              if (act === 'answer') {
                triggerMobileAnswerCall({});
              } else if (act === 'hangup') {
                window.dispatchEvent(new CustomEvent('AIDA_CALLKIT_HANGUP'));
              } else if (act === 'cycle_noise') {
                const nb = wpRoot ? wpRoot.querySelector('button[title*="Gürültü Engelleme"], button[data-aida-noise-mode]') : null;
                if (nb) nb.click();
              } else if (act === 'open_transfer') {
                const tb = wpRoot ? wpRoot.querySelector('button[title="Çağrı Transferi"]') : null;
                if (tb) tb.click();
              } else if (act === 'open_conference') {
                const cb = wpRoot ? wpRoot.querySelector('button[title="Konferans Görüşmesi"]') : null;
                if (cb) cb.click();
              } else if (act === 'open_notes') {
                const ntb = document.getElementById('aida-ios-incall-notes-btn');
                if (ntb) ntb.click();
              } else if (act === 'open_translator') {
                const trb = wpRoot ? wpRoot.querySelector('button[title*="Çeviri"]') : null;
                if (trb) trb.click();
              } else if (act === 'sim_poor_net') {
                if (typeof window.__aidaSimulatePoorNetwork === 'function') {
                  window.__aidaSimulatePoorNetwork({ tier: 'poor', rttMs: 560, jitterMs: 128, lossPct: 6.4 });
                }
              } else if (act === 'sim_good_net') {
                if (typeof window.__aidaSimulatePoorNetwork === 'function') {
                  window.__aidaSimulatePoorNetwork(null);
                }
              }
              setTimeout(applyDOMAdaptations, 50);
            } catch (e) {}
          });

          window.addEventListener('AIDA_CALLKIT_HANGUP', function() {
            try {
              const ringEl = document.getElementById('aida-ringtone-audio-el');
              if (ringEl) {
                try { ringEl.pause(); ringEl.currentTime = 0; } catch (e) {}
              }
              let handled = false;
              const rejectBtn = document.querySelector('button[title="Çağrıyı Reddet"]');
              if (rejectBtn) {
                handled = true;
                rejectBtn.click();
              }
              if (!handled) {
                const hangupBtn = document.querySelector('button[title="Çağrıyı Sonlandır"]');
                if (hangupBtn) {
                  handled = true;
                  hangupBtn.click();
                }
              }
              if (!handled) {
                document.querySelectorAll('button').forEach(function(b) {
                  if (!handled && (b.textContent || '').trim() === 'Reddet') {
                    handled = true;
                    b.click();
                  }
                });
              }
              if (!handled) {
                window.dispatchEvent(new CustomEvent('softphone-action', { detail: { type: 'hangup' } }));
              }
              setTimeout(syncMobileCallKitTelemetry, 80);
            } catch (e) {}
          });

          window.addEventListener('AIDA_CALLKIT_MUTE', function(ev) {
            try {
              const targetMuted = Boolean(ev && ev.detail && ev.detail.muted);
              const line = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
              const currentMuted = line ? Boolean(line.isMuted) : Boolean(document.querySelector('button[title="Mikrofonu Aç"], button[title*="Sesi Aç"]'));
              if (currentMuted !== targetMuted) {
                const muteBtn = document.querySelector(
                  'button[title="Mikrofonu Kapat"], button[title="Mikrofonu Aç"], button[title*="Sessize Al"], button[title*="Sesi Aç"]'
                );
                if (muteBtn) {
                  muteBtn.click();
                } else if (line) {
                  line.isMuted = targetMuted;
                  const pc = line.session && line.session.sessionDescriptionHandler && line.session.sessionDescriptionHandler.peerConnection;
                  if (pc && typeof pc.getSenders === 'function') {
                    pc.getSenders().forEach(function(s) {
                      if (s.track && s.track.kind === 'audio') {
                        s.track.enabled = !targetMuted;
                      }
                    });
                  }
                }
              }
              setTimeout(syncMobileCallKitTelemetry, 60);
            } catch (e) {}
          });

          window.addEventListener('AIDA_CALLKIT_HOLD', function(ev) {
            try {
              const targetHold = Boolean(ev && ev.detail && ev.detail.onHold);
              const line = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
              const currentHold = line ? Boolean(line.isOnHold) : Boolean(document.querySelector('button[title="Görüşmeye Devam Et"], button[title*="Devam Et"]'));
              if (currentHold !== targetHold) {
                window.dispatchEvent(new CustomEvent('softphone-action', { detail: { type: 'hold' } }));
              }
              setTimeout(syncMobileCallKitTelemetry, 60);
            } catch (e) {}
          });

          window.addEventListener('AIDA_CALLKIT_DTMF', function(ev) {
            try {
              const digits = String((ev && ev.detail && ev.detail.digits) || '').trim();
              if (!digits) return;
              const line = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
              if (line && line.session) {
                const sdh = line.session.sessionDescriptionHandler;
                if (sdh && typeof sdh.sendDtmf === 'function') {
                  sdh.sendDtmf(digits);
                  return;
                }
                const pc = sdh && sdh.peerConnection;
                if (pc && typeof pc.getSenders === 'function') {
                  const sender = pc.getSenders().find(function(s) { return s.track && s.track.kind === 'audio' && s.dtmf; });
                  if (sender && sender.dtmf) {
                    sender.dtmf.insertDTMF(digits, 120, 70);
                    return;
                  }
                }
                if (typeof line.session.info === 'function') {
                  line.session.info({
                    requestOptions: {
                      body: {
                        contentDisposition: 'render',
                        contentType: 'application/dtmf-relay',
                        content: 'Signal=' + digits + '\r\nDuration=120'
                      }
                    }
                  });
                }
              }
            } catch (e) {}
          });

          window.addEventListener('AIDA_IOS_WAKE_SIP', function(ev) {
            try {
              const ws = window.__aidaActiveSipWs;
              if (!ws || ws.readyState === 2 || ws.readyState === 3) {
                window.dispatchEvent(new Event('online'));
              }
              focusMobileWebphoneForIncomingCall();
              if (ev && ev.detail && ev.detail.answer) {
                triggerMobileAnswerCall();
              }
              setTimeout(applyDOMAdaptations, 50);
            } catch (e) {}
          });

          window.addEventListener('AIDA_IOS_BG_PING', function() {
            try {
              const ws = window.__aidaActiveSipWs;
              if (!ws || ws.readyState === 2 || ws.readyState === 3) {
                window.dispatchEvent(new Event('online'));
              } else if (ws.readyState === 1) {
                const now = Date.now();
                if (now - (window.__aidaLastWsPingTs || 0) >= 15000) {
                  window.__aidaLastWsPingTs = now;
                  try { ws.send('\r\n\r\n'); } catch (e) {}
                }
              }
            } catch (e) {}
          });

          window.addEventListener('AIDA_IOS_HANGUP_CALL', function() {
            try {
              window.dispatchEvent(new CustomEvent('AIDA_CALLKIT_HANGUP'));
            } catch (e) {}
          });

          // ==============================================================
          // MOBILE NETWORK QUALITY MONITOR & POOR CONNECTION WARNING BANNER
          // ==============================================================
          const mobileNetState = {
            tier: 'good', // 'good' | 'fair' | 'poor'
            rttMs: 0,
            jitterMs: 0,
            lossPct: 0,
            offline: false,
            rttHistory: [],
            probeOutcomes: [], // 1 = ok, 0 = fail
            prevPacketsLost: null,
            prevPacketsRecv: null,
            dismissedUntilTs: 0,
            manualInspectOpen: false,
            checkingNow: false
          };

          function ensureMobileNetQualityBanner() {
            let banner = document.getElementById('aida-mobile-net-quality-banner');
            if (!banner && document.body) {
              banner = document.createElement('div');
              banner.id = 'aida-mobile-net-quality-banner';
              banner.setAttribute('data-hidden', '1');
              banner.setAttribute('data-net-tier', 'good');
              banner.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
                  <div id="aida-net-banner-icon" style="width:34px;height:34px;border-radius:11px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></svg>
                  </div>
                  <div style="min-width:0;flex:1;">
                    <div id="aida-net-banner-title" style="font-size:12.5px;font-weight:800;line-height:1.25;letter-spacing:-0.15px;">
                      Ağ Kalitesi Zayıf • Ses Kesintisi Yaşanabilir
                    </div>
                    <div id="aida-net-banner-sub" style="font-size:10.5px;font-weight:600;opacity:0.94;margin-top:2px;line-height:1.3;">
                      Gecikme: -- ms • Jitter: -- ms • Kayıp: %0
                    </div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                  <button type="button" id="aida-net-banner-retest-btn" style="padding:5px 9px;border-radius:10px;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:800;border:none;cursor:pointer;width:auto !important;min-height:28px !important;white-space:nowrap;">
                    Tekrar Ölç
                  </button>
                  <button type="button" id="aida-net-banner-close-btn" aria-label="Kapat" style="width:28px !important;height:28px !important;min-height:28px !important;border-radius:9px;background:rgba(0,0,0,0.18);color:#ffffff;display:inline-flex;align-items:center;justify-content:center;border:none;cursor:pointer;padding:0;flex-shrink:0;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              `;
              document.body.appendChild(banner);

              const retestBtn = banner.querySelector('#aida-net-banner-retest-btn');
              if (retestBtn) {
                retestBtn.addEventListener('click', function(ev) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  retestBtn.textContent = 'Ölçülüyor...';
                  measureMobileNetworkQuality(true);
                });
              }
              const closeBtn = banner.querySelector('#aida-net-banner-close-btn');
              if (closeBtn) {
                closeBtn.addEventListener('click', function(ev) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  mobileNetState.manualInspectOpen = false;
                  mobileNetState.dismissedUntilTs = Date.now() + 60000;
                  renderMobileNetQualityUI();
                });
              }
            }
            return banner;
          }

          function renderMobileNetQualityUI() {
            const tier = mobileNetState.tier;
            const rtt = Math.round(mobileNetState.rttMs || 0);
            const jitter = Math.round(mobileNetState.jitterMs || 0);
            const loss = Number(mobileNetState.lossPct || 0).toFixed(1).replace(/\.0$/, '');

            const netBtn = document.getElementById('aida-ios-net-quality-btn');
            if (netBtn) {
              if (netBtn.getAttribute('data-net-tier') !== tier) {
                netBtn.setAttribute('data-net-tier', tier);
              }
              if (tier === 'poor') {
                netBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8" stroke-opacity="0.28"/><path d="M17 20V8" stroke-opacity="0.28"/><path d="M22 4v16" stroke-opacity="0.28"/></svg>`;
              } else if (tier === 'fair') {
                netBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8" stroke-opacity="0.28"/><path d="M22 4v16" stroke-opacity="0.28"/></svg>`;
              } else {
                netBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>`;
              }
            }

            const banner = ensureMobileNetQualityBanner();
            if (!banner) return;

            const isAutoWarning = (tier === 'poor' || tier === 'fair') && (Date.now() > mobileNetState.dismissedUntilTs);
            const shouldShow = isAutoWarning || mobileNetState.manualInspectOpen;

            if (!shouldShow) {
              banner.setAttribute('data-hidden', '1');
              return;
            }

            banner.setAttribute('data-hidden', '0');
            banner.setAttribute('data-net-tier', tier);

            const titleEl = banner.querySelector('#aida-net-banner-title');
            const subEl = banner.querySelector('#aida-net-banner-sub');
            const retestBtn = banner.querySelector('#aida-net-banner-retest-btn');
            if (retestBtn && !mobileNetState.checkingNow) {
              retestBtn.textContent = 'Tekrar Ölç';
            }

            if (titleEl) {
              if (mobileNetState.offline) {
                titleEl.textContent = 'Ağ Bağlantısı Kopuk • Sunucuya Erişilemiyor';
              } else if (tier === 'poor') {
                titleEl.textContent = 'Ağ Kalitesi Zayıf • Ses Kesintisi Yaşanabilir';
              } else if (tier === 'fair') {
                titleEl.textContent = 'Ağ Bağlantısı Dalgalı • Yavaş Yanıt Süresi';
              } else {
                titleEl.textContent = 'Ağ Kalitesi İyi • Santral Bağlantısı Stabil';
              }
            }
            if (subEl) {
              if (mobileNetState.offline) {
                subEl.textContent = 'Lütfen Wi-Fi veya Mobil Veri bağlantınızı kontrol edin.';
              } else {
                subEl.textContent = 'Gecikme: ' + rtt + ' ms • Jitter: ' + jitter + ' ms • Kayıp: %' + loss;
              }
            }
          }

          window.__aidaToggleNetQualityBanner = function() {
            mobileNetState.manualInspectOpen = !mobileNetState.manualInspectOpen;
            if (mobileNetState.manualInspectOpen) {
              mobileNetState.dismissedUntilTs = 0;
              measureMobileNetworkQuality(true);
            }
            renderMobileNetQualityUI();
          };

          window.__aidaSimulatePoorNetwork = function(simOpts) {
            if (!simOpts) {
              window.__AIDA_SIMULATE_NET_QUALITY__ = null;
            } else {
              window.__AIDA_SIMULATE_NET_QUALITY__ = simOpts;
              mobileNetState.dismissedUntilTs = 0;
            }
            measureMobileNetworkQuality(true);
          };

          async function measureMobileNetworkQuality(forceShowIfBad) {
            if (mobileNetState.checkingNow) return;
            mobileNetState.checkingNow = true;
            try {
              if (forceShowIfBad) {
                mobileNetState.dismissedUntilTs = 0;
              }

              // Allow simulation override for automated/manual testing
              if (window.__AIDA_SIMULATE_NET_QUALITY__) {
                const sim = window.__AIDA_SIMULATE_NET_QUALITY__;
                mobileNetState.tier = sim.tier || 'poor';
                mobileNetState.rttMs = sim.rttMs !== undefined ? sim.rttMs : 580;
                mobileNetState.jitterMs = sim.jitterMs !== undefined ? sim.jitterMs : 135;
                mobileNetState.lossPct = sim.lossPct !== undefined ? sim.lossPct : 7.4;
                mobileNetState.offline = Boolean(sim.offline);
                postToNative('updateTrayState', {
                  networkQuality: mobileNetState.tier,
                  networkRttMs: Math.round(mobileNetState.rttMs),
                  networkJitterMs: Math.round(mobileNetState.jitterMs),
                  networkLossPct: Number(mobileNetState.lossPct)
                });
                mobileNetState.checkingNow = false;
                renderMobileNetQualityUI();
                return;
              }

              // 1. Measure HTTP RTT to PBX server
              const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
              let probeOk = false;
              let measuredRtt = 0;
              try {
                const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
                const timerId = ctrl ? setTimeout(function() { ctrl.abort(); }, 3500) : null;
                const resp = await fetch('/api/version?netprobe=' + Date.now(), {
                  method: 'GET',
                  cache: 'no-store',
                  signal: ctrl ? ctrl.signal : undefined
                });
                if (timerId) clearTimeout(timerId);
                if (resp && resp.ok) {
                  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                  measuredRtt = Math.max(1, Math.round(t1 - t0));
                  probeOk = true;
                }
              } catch (err) {
                probeOk = false;
              }

              mobileNetState.probeOutcomes.push(probeOk ? 1 : 0);
              if (mobileNetState.probeOutcomes.length > 6) {
                mobileNetState.probeOutcomes.shift();
              }
              const failCount = mobileNetState.probeOutcomes.filter(function(v) { return v === 0; }).length;
              let lossPct = (failCount / mobileNetState.probeOutcomes.length) * 100;

              if (probeOk) {
                mobileNetState.offline = false;
                mobileNetState.rttHistory.push(measuredRtt);
                if (mobileNetState.rttHistory.length > 5) {
                  mobileNetState.rttHistory.shift();
                }
                const hist = mobileNetState.rttHistory;
                const avgRtt = hist.reduce(function(a, b) { return a + b; }, 0) / hist.length;
                let jitterSum = 0;
                for (let i = 1; i < hist.length; i++) {
                  jitterSum += Math.abs(hist[i] - hist[i - 1]);
                }
                const avgJitter = hist.length > 1 ? (jitterSum / (hist.length - 1)) : 0;
                mobileNetState.rttMs = Math.round(avgRtt);
                mobileNetState.jitterMs = Math.round(avgJitter);
              } else {
                const recentFails = mobileNetState.probeOutcomes.slice(-2).filter(function(v) { return v === 0; }).length;
                if (recentFails >= 2) {
                  mobileNetState.offline = true;
                }
                mobileNetState.rttMs = Math.max(mobileNetState.rttMs, 950);
                mobileNetState.jitterMs = Math.max(mobileNetState.jitterMs, 150);
              }

              // 2. If in an active WebRTC call, also inspect RTCPeerConnection RTP audio stats
              try {
                const line = typeof window.__aidaGetActiveLine === 'function' ? window.__aidaGetActiveLine() : null;
                const pc = line && line.session && line.session.sessionDescriptionHandler && line.session.sessionDescriptionHandler.peerConnection;
                if (pc && typeof pc.getStats === 'function') {
                  const stats = await pc.getStats();
                  stats.forEach(function(report) {
                    if (report.type === 'inbound-rtp' && (report.kind === 'audio' || report.mediaType === 'audio')) {
                      if (typeof report.jitter === 'number') {
                        const rtpJitterMs = Math.round(report.jitter * 1000);
                        if (rtpJitterMs > mobileNetState.jitterMs) {
                          mobileNetState.jitterMs = rtpJitterMs;
                        }
                      }
                      const pLost = Number(report.packetsLost || 0);
                      const pRecv = Number(report.packetsReceived || 0);
                      if (mobileNetState.prevPacketsRecv !== null && pRecv >= mobileNetState.prevPacketsRecv) {
                        const dLost = Math.max(0, pLost - (mobileNetState.prevPacketsLost || 0));
                        const dRecv = Math.max(0, pRecv - mobileNetState.prevPacketsRecv);
                        if (dLost + dRecv > 10) {
                          const rtpLoss = (dLost / (dLost + dRecv)) * 100;
                          if (rtpLoss > lossPct) lossPct = rtpLoss;
                        }
                      }
                      mobileNetState.prevPacketsLost = pLost;
                      mobileNetState.prevPacketsRecv = pRecv;
                    } else if (report.type === 'candidate-pair' && report.state === 'succeeded' && typeof report.currentRoundTripTime === 'number') {
                      const rtpRttMs = Math.round(report.currentRoundTripTime * 1000);
                      if (rtpRttMs > 0) {
                        mobileNetState.rttMs = Math.round((mobileNetState.rttMs + rtpRttMs) / 2);
                      }
                    }
                  });
                } else {
                  mobileNetState.prevPacketsLost = null;
                  mobileNetState.prevPacketsRecv = null;
                }
              } catch (e) {}

              mobileNetState.lossPct = Math.round(lossPct * 10) / 10;

              // 3. Classify quality tier
              let nextTier = 'good';
              if (
                mobileNetState.offline ||
                !probeOk ||
                mobileNetState.rttMs >= 450 ||
                mobileNetState.jitterMs >= 110 ||
                mobileNetState.lossPct >= 5.0
              ) {
                nextTier = 'poor';
              } else if (
                mobileNetState.rttMs >= 220 ||
                mobileNetState.jitterMs >= 55 ||
                mobileNetState.lossPct >= 2.0
              ) {
                nextTier = 'fair';
              }

              const prevTier = mobileNetState.tier;
              mobileNetState.tier = nextTier;
              if (prevTier === 'good' && (nextTier === 'poor' || nextTier === 'fair')) {
                mobileNetState.dismissedUntilTs = 0;
              }

              postToNative('updateTrayState', {
                networkQuality: nextTier,
                networkRttMs: Math.round(mobileNetState.rttMs),
                networkJitterMs: Math.round(mobileNetState.jitterMs),
                networkLossPct: Number(mobileNetState.lossPct)
              });
            } catch (e) {}
            mobileNetState.checkingNow = false;
            renderMobileNetQualityUI();
          }

          setTimeout(function() { measureMobileNetworkQuality(false); }, 1800);
          setInterval(function() {
            if (window.__aidaAppInForeground !== false) {
              measureMobileNetworkQuality(false);
            }
          }, 5000);

          const observer = new MutationObserver(function() {
            scheduleDOMAdaptations();
          });
          if (document.documentElement) {
            observer.observe(document.documentElement, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['class']
            });
          }
        })();
        """#
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, UIScrollViewDelegate {
        let store: AppConfigStore
        let bridge: PBXWebViewControllerBridge
        var onOpenQuickTray: (() -> Void)?

        init(store: AppConfigStore, bridge: PBXWebViewControllerBridge, onOpenQuickTray: (() -> Void)?) {
            self.store = store
            self.bridge = bridge
            self.onOpenQuickTray = onOpenQuickTray
        }

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            if scrollView.contentOffset.x != 0 || scrollView.contentOffset.y != 0 {
                scrollView.contentOffset = .zero
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "aidaNative",
                  let dict = message.body as? [String: Any],
                  let action = dict["action"] as? String else { return }
            let payload = dict["payload"] as? [String: Any] ?? [:]

            Task { @MainActor in
                switch action {
                case "openQuickTray":
                    onOpenQuickTray?()

                case "syncThemeMode":
                    if let dark = payload["dark"] as? Bool {
                        store.isWebDarkMode = dark
                        store.saveToDisk()
                    }

                case "sipInviteArrived":
                    let caller = (payload["caller"] as? String) ?? ""
                    let callerName = (payload["callerName"] as? String) ?? ""
                    let callId = (payload["callId"] as? String) ?? ""
                    if store.hasUserAnsweredCurrentCall || store.liveState.callStatus == "InCall" {
                        store.liveState.callStatus = "InCall"
                        if !caller.isEmpty && !caller.hasPrefix("**") && !caller.hasPrefix("*8") {
                            store.liveState.incomingCallerNumber = caller
                        }
                        if !callerName.isEmpty && !callerName.hasPrefix("**") && !callerName.hasPrefix("Pickup:") {
                            store.liveState.incomingCallerName = callerName
                        }
                        let answerPayload: [String: Any] = [
                            "answer": true,
                            "pickupExten": store.coldLaunchPickupExten,
                            "callerNumber": caller.isEmpty ? store.liveState.incomingCallerNumber : caller,
                            "callerName": callerName.isEmpty ? store.liveState.incomingCallerName : callerName
                        ]
                        bridge.dispatchWindowEvent(name: "AIDA_CALLKIT_ANSWER", detail: answerPayload)
                        break
                    }
                    store.lastIncomingRingStartedAt = Date()
                    store.liveState.callStatus = "Ringing"
                    AudioSessionManager.shared.handleIncomingSipInvite(
                        caller: caller,
                        callerName: callerName,
                        callId: callId
                    )
                    bridge.dispatchWindowEvent(name: "SWITCH_AGENT_PANEL_SUBTAB", detail: ["subTab": "webphone"])

                case "sipCancelOrByeArrived":
                    let method = (payload["method"] as? String) ?? ""
                    if method == "CANCEL" && (store.liveState.callStatus == "InCall" || store.hasUserAnsweredCurrentCall || !store.coldLaunchPickupExten.isEmpty) {
                        break
                    }
                    store.lastIncomingRingStartedAt = .distantPast
                    store.hasUserAnsweredCurrentCall = false
                    store.coldLaunchPickupExten = ""
                    store.liveState.callStatus = "Idle"
                    AudioSessionManager.shared.updateCallActivityState(callStatus: "Idle")

                case "updateCallKitTelemetry":
                    let cstat = (payload["callStatus"] as? String) ?? store.liveState.callStatus
                    let isMuted = (payload["isMuted"] as? Bool) ?? store.liveState.isMuted
                    let isOnHold = (payload["isOnHold"] as? Bool) ?? store.liveState.isOnHold
                    let callDuration = (payload["callDuration"] as? Int) ?? store.liveState.callDurationSeconds
                    let remoteNumber = (payload["remoteNumber"] as? String) ?? ""
                    let remoteDisplayName = (payload["remoteDisplayName"] as? String) ?? ""
                    AudioSessionManager.shared.updateCallKitTelemetry(
                        callStatus: cstat,
                        isMuted: isMuted,
                        isOnHold: isOnHold,
                        callDuration: callDuration,
                        remoteNumber: remoteNumber,
                        remoteDisplayName: remoteDisplayName
                    )

                case "updateTrayState":
                    if let fullName = payload["fullName"] as? String {
                        store.liveState.fullName = fullName
                    }
                    if let ext = payload["extension"] as? String {
                        store.liveState.extensionNumber = ext
                    }
                    if let pid = payload["profileId"] as? String {
                        store.liveState.profileId = pid
                    }
                    if let plabel = payload["profileLabel"] as? String {
                        store.liveState.profileLabel = plabel
                    }
                    if let reg = payload["registered"] as? Bool {
                        store.liveState.registered = reg
                    }
                    if let netQ = payload["networkQuality"] as? String {
                        store.liveState.networkQuality = netQ
                    }
                    if let netRtt = payload["networkRttMs"] as? Int {
                        store.liveState.networkRttMs = netRtt
                    }
                    if let netJit = payload["networkJitterMs"] as? Int {
                        store.liveState.networkJitterMs = netJit
                    }
                    if let netLoss = payload["networkLossPct"] as? Double {
                        store.liveState.networkLossPct = netLoss
                    }
                    if let rawCstat = payload["callStatus"] as? String {
                        let cstat: String
                        if rawCstat == "InCall" || store.liveState.callStatus == "InCall" {
                            cstat = (rawCstat == "Idle") ? "Idle" : "InCall"
                        } else if rawCstat == "Ringing" && store.hasUserAnsweredCurrentCall {
                            cstat = "Calling"
                        } else {
                            cstat = rawCstat
                        }
                        let withinIncomingRingGuard = ((cstat == "Idle") && (store.liveState.callStatus == "Ringing" || !store.coldLaunchPickupExten.isEmpty || store.hasUserAnsweredCurrentCall) && Date().timeIntervalSince(store.lastIncomingRingStartedAt) < 35.0)
                        if !withinIncomingRingGuard {
                            if cstat != "Ringing" && store.coldLaunchPickupExten.isEmpty && !store.hasUserAnsweredCurrentCall {
                                store.lastIncomingRingStartedAt = .distantPast
                            }
                            if rawCstat == "InCall" {
                                store.coldLaunchPickupExten = ""
                                store.lastIncomingRingStartedAt = .distantPast
                            }
                            if cstat == "Idle" {
                                store.hasUserAnsweredCurrentCall = false
                            }
                            store.liveState.callStatus = cstat
                            AudioSessionManager.shared.updateCallActivityState(callStatus: cstat)
                        }
                    }

                case "notify":
                    let id = (payload["id"] as? String) ?? "aida-notif-\(Int(Date().timeIntervalSince1970))"
                    let title = (payload["title"] as? String) ?? ""
                    let body = (payload["body"] as? String) ?? ""
                    let urgent = (payload["urgent"] as? Bool) ?? false
                    let actionEvent = payload["actionEvent"] as? String
                    if (actionEvent == "OPEN_FULL_WEBPHONE" || title.contains("Gelen Çağrı")) && store.liveState.callStatus != "InCall" && !store.hasUserAnsweredCurrentCall {
                        store.liveState.callStatus = "Ringing"
                        AudioSessionManager.shared.updateCallActivityState(callStatus: "Ringing")
                    }
                    var detailJSON: String? = nil
                    if let detail = payload["actionDetail"],
                       JSONSerialization.isValidJSONObject(detail),
                       let data = try? JSONSerialization.data(withJSONObject: detail, options: []) {
                        detailJSON = String(data: data, encoding: .utf8)
                    }
                    if !title.isEmpty {
                        AudioSessionManager.shared.postNativeNotification(
                            id: id,
                            title: title,
                            body: body,
                            urgent: urgent,
                            actionEvent: actionEvent,
                            actionDetailJSON: detailJSON
                        )
                    }

                case "closeNotification":
                    if let id = payload["id"] as? String, !id.isEmpty {
                        if id.hasPrefix("call-") {
                            AudioSessionManager.shared.stopNativeRingtone()
                            if UIApplication.shared.applicationState == .active || store.liveState.callStatus == "InCall" {
                                AudioSessionManager.shared.closeNativeNotification(id: id)
                            }
                        } else {
                            AudioSessionManager.shared.closeNativeNotification(id: id)
                        }
                    }

                case "focusWindow":
                    let urgent = (payload["urgent"] as? Bool) ?? false
                    if urgent {
                        AudioSessionManager.shared.triggerIncomingCallHaptic()
                    }

                case "updatePreferences":
                    if let notif = payload["osNotifications"] as? Bool {
                        store.osNotifications = notif
                    }
                    if let pop = payload["popWindowOnCall"] as? Bool {
                        store.popWindowOnCall = pop
                    }
                    if let tray = payload["minimizeToTray"] as? Bool {
                        store.minimizeToTray = tray
                    }
                    if let audio = payload["audioPrefs"] as? [String: Any] {
                        if let m = audio["micLabel"] as? String { store.audioPrefs.micLabel = m }
                        if let s = audio["speakerLabel"] as? String { store.audioPrefs.speakerLabel = s }
                        if let r = audio["ringtoneSpeakerLabel"] as? String { store.audioPrefs.ringtoneSpeakerLabel = r }
                    }
                    store.saveToDisk()

                case "disconnectServer":
                    store.disconnectSession()

                case "reconnectWorkspace":
                    store.isOfflineError = false
                    bridge.reloadWorkspace(uiOrigin: store.uiOrigin)

                default:
                    break
                }
            }
        }

        func webView(
            _ webView: WKWebView,
            didReceive challenge: URLAuthenticationChallenge,
            completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
        ) {
            if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
               let trust = challenge.protectionSpace.serverTrust {
                completionHandler(.useCredential, URLCredential(trust: trust))
            } else {
                completionHandler(.performDefaultHandling, nil)
            }
        }

        @available(iOS 15.0, *)
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            decisionHandler(.grant)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            let nsErr = error as NSError
            if nsErr.code == NSURLErrorCancelled { return }
            Task { @MainActor in
                store.isOfflineError = true
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { @MainActor in
                store.isOfflineError = false
                AudioSessionManager.shared.configureVoIPAudioSession()
                if let pendingNav = store.pendingNotificationNav, !pendingNav.isEmpty {
                    store.pendingNotificationNav = nil
                    for delaySec in [0.1, 0.6, 1.4, 2.5, 3.8] {
                        DispatchQueue.main.asyncAfter(deadline: .now() + delaySec) { [weak bridge] in
                            bridge?.dispatchWindowEvent(name: "SWITCH_AGENT_PANEL_SUBTAB", detail: pendingNav)
                        }
                    }
                }
            }
        }
    }
}
