/**
 * ============================================================================
 * Nornia Voice SDK (Web & Desktop / Electron) — v1.0.0
 * Zero-build, drop-in WebRTC Softphone & CTI SDK for Nornia Enterprise AI PBX
 * ============================================================================
 *
 * Hızlı Başlangıç (5 Satır):
 *   const phone = new NorniaVoiceSDK({
 *     serverUrl: "https://pbx.firma.com",
 *     apiKey: "aida_live_...",
 *     extension: "1001"
 *   });
 *   phone.on("incomingCall", (call) => console.log("Arayan:", call.callerNumber));
 *   await phone.connect();
 *   await phone.dial("05321234567");
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NorniaVoiceSDK = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_SIPJS_CDN = "https://cdn.jsdelivr.net/npm/sip.js@0.20.1/dist/sip.min.js";

  function loadScriptOnce(url) {
    return new Promise(function (resolve, reject) {
      if (typeof window === "undefined") {
        return reject(new Error("Tarayıcı veya Electron Renderer ortamı gereklidir."));
      }
      if (window.SIP && window.SIP.UserAgent) {
        return resolve(window.SIP);
      }
      var existing = document.querySelector('script[data-nornia-sipjs="1"]');
      if (existing) {
        existing.addEventListener("load", function () { resolve(window.SIP); });
        existing.addEventListener("error", reject);
        return;
      }
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.setAttribute("data-nornia-sipjs", "1");
      s.onload = function () {
        if (window.SIP && window.SIP.UserAgent) resolve(window.SIP);
        else reject(new Error("SIP.js yüklendi ancak window.SIP bulunamadı."));
      };
      s.onerror = function () {
        reject(new Error("SIP.js kütüphanesi indirilemedi: " + url));
      };
      document.head.appendChild(s);
    });
  }

  function NorniaVoiceSDK(options) {
    options = options || {};
    this.serverUrl = String(options.serverUrl || "").replace(/\/+$/, "");
    this.apiKey = String(options.apiKey || "").trim();
    this.extension = String(options.extension || "").trim();
    this.clientType = String(options.clientType || "web");
    this.sipJsUrl = String(options.sipJsUrl || DEFAULT_SIPJS_CDN);
    this.debug = Boolean(options.debug);
    this.autoAudioElement = options.autoAudioElement !== false;

    this._listeners = {};
    this._sessionConfig = null;
    this._ua = null;
    this._registerer = null;
    this._currentSession = null;
    this._incomingInvitation = null;
    this._audioEl = null;
    this._registered = false;
    this._muted = false;
    this._held = false;
  }

  NorniaVoiceSDK.prototype._log = function () {
    if (this.debug && typeof console !== "undefined") {
      var args = ["[NorniaVoiceSDK]"].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    }
  };

  /** Olay dinleyicisi ekler: registered, unregistered, incomingCall, ringing, connected, ended, error */
  NorniaVoiceSDK.prototype.on = function (eventName, handler) {
    if (!this._listeners[eventName]) this._listeners[eventName] = [];
    this._listeners[eventName].push(handler);
    return this;
  };

  /** Olay dinleyicisini kaldırır */
  NorniaVoiceSDK.prototype.off = function (eventName, handler) {
    if (!this._listeners[eventName]) return this;
    this._listeners[eventName] = this._listeners[eventName].filter(function (fn) {
      return fn !== handler;
    });
    return this;
  };

  NorniaVoiceSDK.prototype._emit = function (eventName, payload) {
    var list = this._listeners[eventName] || [];
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](payload);
      } catch (err) {
        if (typeof console !== "undefined") console.error("[NorniaVoiceSDK event error]", err);
      }
    }
  };

  NorniaVoiceSDK.prototype._ensureAudioEl = function () {
    if (!this.autoAudioElement || typeof document === "undefined") return null;
    if (this._audioEl && document.body.contains(this._audioEl)) return this._audioEl;
    var el = document.createElement("audio");
    el.autoplay = true;
    el.playsInline = true;
    el.style.display = "none";
    el.setAttribute("data-nornia-sdk-audio", "1");
    document.body.appendChild(el);
    this._audioEl = el;
    return el;
  };

  NorniaVoiceSDK.prototype._attachRemoteAudio = function (session) {
    try {
      var pc = session && session.sessionDescriptionHandler && session.sessionDescriptionHandler.peerConnection;
      if (!pc) return;
      var remoteStream = new MediaStream();
      pc.getReceivers().forEach(function (receiver) {
        if (receiver.track && receiver.track.kind === "audio") {
          remoteStream.addTrack(receiver.track);
        }
      });
      var audioEl = this._ensureAudioEl();
      if (audioEl) {
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(function () {});
      }
    } catch (e) {
      this._log("Remote audio attach uyarısı:", e);
    }
  };

  /** 1. Adım: Nornia santralinden WebRTC WSS & SIP oturum bilgilerini alır ve kayıt olur */
  NorniaVoiceSDK.prototype.connect = async function () {
    if (!this.serverUrl || !this.apiKey || !this.extension) {
      throw new Error("serverUrl, apiKey ve extension parametrelerinin tamamı zorunludur.");
    }

    var resp = await fetch(this.serverUrl + "/api/v1/sdk/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify({
        extension: this.extension,
        client_type: this.clientType,
      }),
    });

    if (!resp.ok) {
      var errTxt = await resp.text();
      throw new Error("Nornia SDK oturum alınamadı (HTTP " + resp.status + "): " + errTxt);
    }

    var cfg = await resp.json();
    this._sessionConfig = cfg;
    this._log("SDK oturum bilgisi alındı:", cfg.wss_url, cfg.sip_uri);

    var SIP = await loadScriptOnce(this.sipJsUrl);
    var uri = SIP.UserAgent.makeURI(cfg.sip_uri);
    if (!uri) throw new Error("Geçersiz SIP URI: " + cfg.sip_uri);

    var self = this;
    var uaOptions = {
      uri: uri,
      contactURI: uri,
      authorizationUsername: cfg.sip_username,
      authorizationPassword: cfg.sip_password,
      displayName: cfg.display_name || cfg.extension,
      transportOptions: {
        server: cfg.wss_url,
        keepAliveInterval: 25,
      },
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: {
          iceServers: cfg.ice_servers || [{ urls: "stun:stun.l.google.com:19302" }],
        },
      },
      logLevel: this.debug ? "debug" : "error",
      delegate: {
        onInvite: function (invitation) {
          self._handleIncomingInvite(invitation, SIP);
        },
      },
    };
    if (cfg.via_host && /^\d+\.\d+\.\d+\.\d+$/.test(cfg.via_host)) {
      uaOptions.viaHost = cfg.via_host;
    }

    this._ua = new SIP.UserAgent(uaOptions);

    // WebSocket 200 OK REGISTER interceptor (Nornia Asterisk PJSIP uyumluluk kuralı)
    if (this._ua.transport) {
      var origOnMessage = this._ua.transport.onMessage;
      this._ua.transport.onMessage = function (message) {
        if (typeof message === "string" && message.indexOf("SIP/2.0 200 OK") !== -1 && message.indexOf("REGISTER") !== -1) {
          if (!self._registered) {
            self._registered = true;
            self._emit("registered", { extension: self.extension, sipUri: cfg.sip_uri });
          }
        }
        if (origOnMessage) return origOnMessage.call(this, message);
      };
    }

    await this._ua.start();
    this._registerer = new SIP.Registerer(this._ua);
    this._registerer.stateChange.addListener(function (state) {
      if (state === SIP.RegistererState.Registered) {
        if (!self._registered) {
          self._registered = true;
          self._emit("registered", { extension: self.extension, sipUri: cfg.sip_uri });
        }
      } else if (state === SIP.RegistererState.Unregistered) {
        self._registered = false;
        self._emit("unregistered", { extension: self.extension });
      }
    });

    await this._registerer.register();
    return { status: "connected", extension: this.extension, wssUrl: cfg.wss_url };
  };

  NorniaVoiceSDK.prototype._bindSessionEvents = function (session, SIP, meta) {
    var self = this;
    this._currentSession = session;
    this._muted = false;
    this._held = false;

    session.stateChange.addListener(function (newState) {
      if (newState === SIP.SessionState.Establishing) {
        self._emit("ringing", meta);
      } else if (newState === SIP.SessionState.Established) {
        self._attachRemoteAudio(session);
        self._emit("connected", meta);
      } else if (newState === SIP.SessionState.Terminated) {
        if (self._currentSession === session) self._currentSession = null;
        if (self._incomingInvitation === session) self._incomingInvitation = null;
        self._emit("ended", meta);
      }
    });
  };

  NorniaVoiceSDK.prototype._handleIncomingInvite = function (invitation, SIP) {
    var fromUri = invitation.remoteIdentity && invitation.remoteIdentity.uri;
    var callerNumber = (fromUri && fromUri.user) || "Bilinmiyor";
    var callerName = (invitation.remoteIdentity && invitation.remoteIdentity.displayName) || callerNumber;
    var callId = (invitation.request && invitation.request.callId) || "";

    this._incomingInvitation = invitation;
    var meta = { direction: "inbound", callerNumber: callerNumber, callerName: callerName, callId: callId };
    this._bindSessionEvents(invitation, SIP, meta);
    this._emit("incomingCall", meta);
  };

  /** Dış numara veya dahili arar (WebRTC) */
  NorniaVoiceSDK.prototype.dial = async function (targetNumber) {
    if (!this._ua || !this._sessionConfig) {
      throw new Error("Önce await phone.connect() çağrılmalıdır.");
    }
    var SIP = window.SIP;
    var cleanTarget = String(targetNumber || "").replace(/\s+/g, "");
    if (!cleanTarget) throw new Error("Aranacak numara boş olamaz.");

    var targetUri = SIP.UserAgent.makeURI("sip:" + cleanTarget + "@" + this._sessionConfig.sip_domain);
    var inviter = new SIP.Inviter(this._ua, targetUri, {
      sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
    });
    var meta = { direction: "outbound", targetNumber: cleanTarget };
    this._bindSessionEvents(inviter, SIP, meta);
    await inviter.invite();
    return meta;
  };

  /** Gelen çağrıyı cevaplar */
  NorniaVoiceSDK.prototype.answer = async function () {
    if (!this._incomingInvitation) throw new Error("Cevaplanacak aktif gelen çağrı yok.");
    await this._incomingInvitation.accept({
      sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
    });
    this._incomingInvitation = null;
  };

  /** Gelen çağrıyı reddeder */
  NorniaVoiceSDK.prototype.reject = async function () {
    if (!this._incomingInvitation) return;
    await this._incomingInvitation.reject();
    this._incomingInvitation = null;
  };

  /** Aktif çağrıyı kapatır (çalıyorsa iptal eder, konuşuyorsa sonlandırır) */
  NorniaVoiceSDK.prototype.hangup = async function () {
    var s = this._currentSession || this._incomingInvitation;
    if (!s) return;
    var SIP = window.SIP;
    try {
      if (s.state === SIP.SessionState.Established) {
        await s.bye();
      } else if (typeof s.cancel === "function") {
        await s.cancel();
      } else if (typeof s.reject === "function") {
        await s.reject();
      }
    } finally {
      this._currentSession = null;
      this._incomingInvitation = null;
    }
  };

  /** Mikrofonu sessize alır / açar */
  NorniaVoiceSDK.prototype.mute = function (shouldMute) {
    this._muted = Boolean(shouldMute);
    var s = this._currentSession;
    var pc = s && s.sessionDescriptionHandler && s.sessionDescriptionHandler.peerConnection;
    if (pc) {
      pc.getSenders().forEach(function (sender) {
        if (sender.track && sender.track.kind === "audio") {
          sender.track.enabled = !shouldMute;
        }
      });
    }
    return this._muted;
  };

  /** Çağrıyı beklemeye alır / devam ettirir (Hold / Unhold) */
  NorniaVoiceSDK.prototype.hold = async function (shouldHold) {
    this._held = Boolean(shouldHold);
    this.mute(this._held);
    var s = this._currentSession;
    if (s && s.sessionDescriptionHandler && s.sessionDescriptionHandler.peerConnection) {
      var pc = s.sessionDescriptionHandler.peerConnection;
      pc.getReceivers().forEach(function (r) {
        if (r.track && r.track.kind === "audio") r.track.enabled = !shouldHold;
      });
    }
    return this._held;
  };

  /** IVR menüleri için DTMF tuşlaması gönderir (0-9, *, #) */
  NorniaVoiceSDK.prototype.sendDtmf = function (digit) {
    var s = this._currentSession;
    var pc = s && s.sessionDescriptionHandler && s.sessionDescriptionHandler.peerConnection;
    if (pc) {
      pc.getSenders().forEach(function (sender) {
        if (sender.dtmf) sender.dtmf.insertDTMF(String(digit), 120, 70);
      });
    }
  };

  /** Aktif çağrıyı başka bir dahiliye veya dış numaraya aktarır (Blind Transfer) */
  NorniaVoiceSDK.prototype.transfer = async function (targetExtension) {
    if (!this._currentSession || !this._sessionConfig) {
      throw new Error("Aktarılacak aktif bir görüşme yok.");
    }
    var SIP = window.SIP;
    var targetUri = SIP.UserAgent.makeURI("sip:" + String(targetExtension).trim() + "@" + this._sessionConfig.sip_domain);
    await this._currentSession.refer(targetUri);
  };

  /** WebRTC kullanmadan masa telefonu / dahili üzerinden Click-to-Call başlatır */
  NorniaVoiceSDK.prototype.clickToCall = async function (destinationNumber) {
    var resp = await fetch(this.serverUrl + "/api/v1/calls/originate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify({
        extension: this.extension,
        destination: String(destinationNumber || "").trim(),
      }),
    });
    if (!resp.ok) throw new Error("Click-to-Call başlatılamadı (HTTP " + resp.status + ")");
    return await resp.json();
  };

  /** Oturumu ve WebSocket bağlantısını temiz şekilde kapatır */
  NorniaVoiceSDK.prototype.disconnect = async function () {
    await this.hangup();
    if (this._registerer) {
      try { await this._registerer.unregister(); } catch (_) {}
      this._registerer = null;
    }
    if (this._ua) {
      try { await this._ua.stop(); } catch (_) {}
      this._ua = null;
    }
    this._registered = false;
  };

  return NorniaVoiceSDK;
});
