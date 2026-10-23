import * as SIP from "sip.js";
import { playRingtoneSound, stopRingtoneSound } from "./audioHelper";

class WebphoneManager {
  constructor() {
    this.listeners = new Set();
    this.userAgent = null;
    this.registerer = null;
    this.session = null;
    this.audioEl = null;
    this.durationInterval = null;
    this.registerNotifyInterval = null;
    this.activeUserKey = null;

    this.state = {
      isLoadingConfig: true,
      webrtcConfig: null,
      registered: false,
      callStatus: "Idle", // "Idle" | "Calling" | "Ringing" | "InCall"
      dialNumber: "",
      remoteNumber: "",
      remoteDisplayName: "",
      callDuration: 0,
      isMuted: false,
      isOnHold: false,
      callNotification: null,
      error: "",
      activeSipCallId: null,
      isWebphoneScreenActive: false,
      backendHost: "localhost:8000",
      currentUser: null
    };
  }

  ensureAudioElement() {
    if (typeof window === "undefined") return null;
    if (!this.audioEl) {
      let existing = document.getElementById("aida-global-webphone-audio");
      if (!existing) {
        existing = document.createElement("audio");
        existing.id = "aida-global-webphone-audio";
        existing.autoplay = true;
        existing.playsInline = true;
        existing.style.display = "none";
        document.body.appendChild(existing);
      }
      this.audioEl = existing;
    }
    return this.audioEl;
  }

  getState() {
    return this.state;
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error("[WebphoneManager] Listener error:", e);
      }
    }
  }

  setWebphoneScreenActive(isActive) {
    if (this.state.isWebphoneScreenActive !== isActive) {
      this.setState({ isWebphoneScreenActive: isActive });
    }
  }

  setDialNumber(val) {
    const clean = String(val ?? "").replace(/[^0-9*#+]/g, "");
    this.setState({ dialNumber: clean });
  }

  setCallNotification(notif) {
    this.setState({ callNotification: notif });
    if (notif) {
      setTimeout(() => {
        if (this.state.callNotification === notif) {
          this.setState({ callNotification: null });
        }
      }, 5000);
    }
  }

  getApiBase() {
    const host = this.state.backendHost || "localhost:8000";
    if (typeof window !== "undefined") {
      return `${window.location.protocol}//${host}`;
    }
    return `http://${host}`;
  }

  logWebrtcCallToBackend(action, payload = {}) {
    try {
      const apiBase = this.getApiBase();
      const ext = this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension || "";
      if (!ext) return;
      fetch(`${apiBase}/api/calls/webrtc-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          caller: payload.caller || ext,
          callee: payload.callee || this.state.remoteNumber || this.state.dialNumber || "",
          sip_call_id: payload.sip_call_id || this.state.activeSipCallId || "",
          status: payload.status || "",
          duration: payload.duration || this.state.callDuration || 0
        })
      }).catch(() => {});
    } catch (e) {}
  }

  recordTimelineEvent(actionType, detail) {
    try {
      const apiBase = this.getApiBase();
      const ext = this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension || "1000";
      const uid = this.state.currentUser?.id || ext;
      fetch(`${apiBase}/api/agent/timeline-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: uid,
          extension: ext,
          action_type: actionType,
          detail: detail || ""
        })
      }).catch(() => {});
    } catch (e) {}
  }

  async init({ backendHost, currentUser }) {
    if (typeof window === "undefined") return;
    if (backendHost) this.state.backendHost = backendHost;
    if (currentUser) this.state.currentUser = currentUser;

    const savedUserId = sessionStorage.getItem("current_user_id") || localStorage.getItem("current_user_id") || "";
    const isSuperAdmin =
      (currentUser?.username === "admin" || currentUser?.id === "admin" || (!currentUser && savedUserId === "admin")) &&
      !currentUser?.extension;

    if (isSuperAdmin) {
      this.setState({ isLoadingConfig: false });
      return;
    }

    const targetUserId = currentUser?.id || currentUser?.extension || savedUserId;
    const targetExt = currentUser?.extension || "";
    if (!targetUserId) return;

    const userKey = `${backendHost || "localhost:8000"}_${targetUserId}_${targetExt}`;
    if (this.activeUserKey === userKey && this.userAgent) {
      return;
    }
    this.activeUserKey = userKey;

    this.setState({ isLoadingConfig: true });
    try {
      const apiBase = this.getApiBase();
      const queryParams = new URLSearchParams();
      queryParams.set("user_id", targetUserId.toString());
      if (targetExt) {
        queryParams.set("extension", targetExt.toString());
      }

      const res = await fetch(`${apiBase}/api/webrtc/config?${queryParams.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": targetUserId.toString()
        }
      });

      if (res.ok) {
        const config = await res.json();
        this.setState({ webrtcConfig: config, isLoadingConfig: false });
        this.startUserAgent(config);
      } else {
        this.setState({ isLoadingConfig: false });
      }
    } catch (err) {
      console.error("[WebphoneManager] Config fetch error:", err);
      this.setState({ isLoadingConfig: false });
    }
  }

  startUserAgent(config) {
    if (!config?.asteriskWssUrl || !config?.agentExtension) return;

    if (this.userAgent) {
      try {
        this.userAgent.stop();
      } catch (e) {}
      this.userAgent = null;
    }

    const { asteriskWssUrl, agentExtension, password, agentName } = config;
    const hostOnly = asteriskWssUrl.split("/")[2].split(":")[0];
    const uri = SIP.UserAgent.makeURI(`sip:${agentExtension}@${hostOnly}`);
    const resolvedViaHost = config.viaHost || hostOnly;
    const displayLabel = agentName || this.state.currentUser?.full_name || `Temsilci ${agentExtension}`;

    const userAgentOptions = {
      uri,
      contactURI: uri,
      transportOptions: {
        server: asteriskWssUrl,
        traceSip: false
      },
      sessionDescriptionHandlerFactoryOptions: {
        iceGatheringTimeout: 400,
        peerConnectionConfiguration: {
          iceServers: []
        }
      },
      viaHost: resolvedViaHost,
      contactName: agentExtension,
      authorizationUsername: agentExtension,
      authorizationPassword: password,
      displayName: displayLabel,
      hackIpInContact: true,
      delegate: {
        onInvite: (invite) => this.handleIncomingInvite(invite)
      }
    };

    const ua = new SIP.UserAgent(userAgentOptions);
    this.userAgent = ua;

    if (ua.transport) {
      const originalOnMessage = ua.transport.onMessage;
      ua.transport.onMessage = (message) => {
        if (typeof message === "string" && message.includes("SIP/2.0 200 OK") && message.includes("REGISTER")) {
          this.setState({ registered: true, error: "" });
          this.startRegisterNotifyLoop();
        }
        if (originalOnMessage) {
          originalOnMessage.call(ua.transport, message);
        }
      };

      ua.transport.onDisconnect = (err) => {
        if (err) {
          this.setState({
            error: `Asterisk WSS Bağlantı Hatası (${err.message || "Bağlantı Kesildi"})`,
            registered: false
          });
        }
      };
    }

    ua.start()
      .then(() => {
        this.setState({ registered: true, error: "" });
        this.startRegisterNotifyLoop();
        const registerer = new SIP.Registerer(ua);
        this.registerer = registerer;
        registerer.stateChange.addListener((st) => {
          if (st === SIP.RegistererState.Registered) {
            this.setState({ registered: true, error: "" });
          }
        });
        return registerer.register();
      })
      .catch((err) => {
        console.error("[WebphoneManager] Start/Register error:", err);
        this.setState({
          error: `WebRTC Bağlantı Hatası: ${err.message || "Sunucu Yanıt Vermedi"}`,
          registered: false
        });
      });
  }

  startRegisterNotifyLoop() {
    if (this.registerNotifyInterval) clearInterval(this.registerNotifyInterval);
    const sendNotify = () => {
      const ext = this.state.webrtcConfig?.agentExtension;
      if (!this.state.registered || !ext) return;
      fetch(`${this.getApiBase()}/api/webrtc/register_notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension: ext,
          user_id: this.state.currentUser?.id
        })
      }).catch(() => {});
    };
    sendNotify();
    this.registerNotifyInterval = setInterval(sendNotify, 8000);
  }

  startDurationTimer() {
    if (this.durationInterval) clearInterval(this.durationInterval);
    this.setState({ callDuration: 0 });
    this.durationInterval = setInterval(() => {
      if (this.state.callStatus === "InCall") {
        this.setState({ callDuration: this.state.callDuration + 1 });
      }
    }, 1000);
  }

  stopDurationTimer() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    this.setState({
      callDuration: 0,
      isMuted: false,
      isOnHold: false
    });
  }

  attachRemoteAudio(sessionObj) {
    const audioEl = this.ensureAudioElement();
    const peerConnection = sessionObj?.sessionDescriptionHandler?.peerConnection;
    if (!peerConnection || !audioEl) return;

    const selectedSpeaker = typeof window !== "undefined" ? localStorage.getItem("selected_speaker") : null;

    const bindTrack = (track) => {
      if (track && track.kind === "audio") {
        const remoteStream = new MediaStream([track]);
        if (selectedSpeaker && typeof audioEl.setSinkId === "function") {
          audioEl.setSinkId(selectedSpeaker).catch(() => {});
        }
        audioEl.srcObject = remoteStream;
        audioEl.play().catch((e) => console.error("[WebphoneManager] Audio play error:", e));
      }
    };

    peerConnection.addEventListener("track", (event) => {
      bindTrack(event.track);
    });
    peerConnection.getReceivers().forEach((receiver) => {
      bindTrack(receiver.track);
    });
  }

  handleIncomingInvite(invite) {
    const curU = this.state.currentUser;
    if (curU && Array.isArray(curU.profiles) && curU.profiles.length > 0) {
      const actProfId = curU.active_profile || "available";
      const actProf = curU.profiles.find((p) => p.id === actProfId);
      if (actProf && Array.isArray(actProf.devices) && !actProf.devices.includes("web_phone")) {
        if (actProf.devices.length === 0) {
          try {
            invite.reject();
          } catch (e) {}
        }
        return;
      }
    }

    const callerNum = invite?.remoteIdentity?.uri?.user || "Bilinmeyen";
    const rawDisplayName = (invite?.remoteIdentity?.displayName || "").replace(/^"|"$/g, "").trim();
    const sipCallId = invite?.request?.callId || `sip-${Date.now()}`;

    this.session = invite;
    this.setState({
      callStatus: "Ringing",
      dialNumber: callerNum,
      remoteNumber: callerNum,
      remoteDisplayName: rawDisplayName && rawDisplayName !== callerNum ? rawDisplayName : "",
      activeSipCallId: sipCallId,
      callNotification: null
    });

    if (typeof window !== "undefined") {
      const selectedRingtone = localStorage.getItem("ringtone") || "classic";
      const ringtoneSpeaker = localStorage.getItem("selected_ringtone_speaker") || null;
      playRingtoneSound(selectedRingtone, ringtoneSpeaker);
      window.dispatchEvent(new CustomEvent("INCOMING_WEBPHONE_CALL", { detail: callerNum }));
    }

    invite.stateChange.addListener((state) => {
      if (state === SIP.SessionState.Established) {
        stopRingtoneSound();
        this.setState({ callStatus: "InCall" });
        this.startDurationTimer();
        this.attachRemoteAudio(invite);
      } else if (state === SIP.SessionState.Terminated) {
        stopRingtoneSound();
        this.stopDurationTimer();
        this.session = null;
        this.setState({
          callStatus: "Idle",
          remoteNumber: "",
          remoteDisplayName: "",
          activeSipCallId: null
        });
      }
    });
  }

  async answerCall() {
    if (!this.session || this.state.callStatus !== "Ringing") return;
    try {
      stopRingtoneSound();
      const selectedMic = typeof window !== "undefined" ? localStorage.getItem("selected_mic") : null;
      const constraints = {
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
        video: false
      };
      await this.session.accept({
        sessionDescriptionHandlerOptions: {
          constraints,
          iceGatheringTimeout: 400
        }
      });
      this.attachRemoteAudio(this.session);
      this.setState({ callStatus: "InCall" });
    } catch (err) {
      console.error("[WebphoneManager] Answer error:", err);
      this.setCallNotification({
        type: "error",
        message: "Çağrı yanıtlanamadı. Lütfen mikrofon izinlerinizi kontrol edin."
      });
    }
  }

  async makeCall(targetNum) {
    const cleanTarget = String(targetNum || this.state.dialNumber || "").replace(/[^0-9*#+]/g, "");
    if (!cleanTarget) return;

    if (!this.userAgent || !this.state.webrtcConfig) {
      this.setCallNotification({
        type: "error",
        message: "WebPhone bağlantısı hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin."
      });
      return;
    }

    const myExt = this.state.webrtcConfig.agentExtension || this.state.currentUser?.extension || "";
    const sipCallId = `webphone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.setState({
      callNotification: null,
      dialNumber: cleanTarget,
      remoteNumber: cleanTarget,
      remoteDisplayName: "",
      callStatus: "Calling",
      activeSipCallId: sipCallId
    });

    if (cleanTarget.startsWith("*8") || cleanTarget.startsWith("**")) {
      const pickupLbl = cleanTarget.startsWith("*8")
        ? "Grup Çağrı Toplama (*8)"
        : `Hedefli Çağrı Toplama (${cleanTarget})`;
      this.recordTimelineEvent("call_pickup", pickupLbl);
    }

    this.logWebrtcCallToBackend("start", {
      caller: myExt,
      callee: cleanTarget,
      sip_call_id: sipCallId,
      status: "in_progress"
    });

    const hostOnly = this.state.webrtcConfig.asteriskWssUrl.split("/")[2].split(":")[0];
    const targetURI = SIP.UserAgent.makeURI(`sip:${cleanTarget}@${hostOnly}`);
    const selectedMic = typeof window !== "undefined" ? localStorage.getItem("selected_mic") : null;
    const constraints = {
      audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      video: false
    };

    const inviter = new SIP.Inviter(this.userAgent, targetURI, {
      earlyMedia: true,
      sessionDescriptionHandlerOptions: {
        constraints,
        iceGatheringTimeout: 400
      }
    });

    this.session = inviter;
    let wasEstablished = false;
    let rejectStatusCode = null;

    inviter.stateChange.addListener((state) => {
      if (state === SIP.SessionState.Establishing) {
        this.attachRemoteAudio(inviter);
      } else if (state === SIP.SessionState.Established) {
        wasEstablished = true;
        this.setState({ callStatus: "InCall" });
        this.startDurationTimer();
        this.attachRemoteAudio(inviter);
        this.logWebrtcCallToBackend("answer", {
          caller: myExt,
          callee: cleanTarget,
          sip_call_id: sipCallId,
          status: "in_progress"
        });
      } else if (state === SIP.SessionState.Terminated) {
        const finalDuration = this.state.callDuration || 0;
        let finalStatus = wasEstablished ? "completed" : "no_answer";
        if (!wasEstablished) {
          if (rejectStatusCode === 486 || rejectStatusCode === 600) finalStatus = "busy";
          else if (rejectStatusCode === 403 || rejectStatusCode === 603) finalStatus = "blocked";
          else if (rejectStatusCode === 487) finalStatus = "cancelled";
        }
        this.logWebrtcCallToBackend("end", {
          caller: myExt,
          callee: cleanTarget,
          sip_call_id: sipCallId,
          status: finalStatus,
          duration: finalDuration
        });

        this.stopDurationTimer();
        this.session = null;
        this.setState({
          callStatus: "Idle",
          remoteNumber: "",
          remoteDisplayName: "",
          activeSipCallId: null
        });
      }
    });

    try {
      await inviter.invite({
        requestDelegate: {
          onProgress: () => {
            this.attachRemoteAudio(inviter);
          },
          onReject: (response) => {
            const code = response?.message?.statusCode;
            rejectStatusCode = code;
            if (code === 486 || code === 600) {
              this.setCallNotification({
                type: "error",
                message: `Aranan numara (${cleanTarget}) şu anda meşgul.`
              });
            } else if (code === 480 || code === 503 || code === 404) {
              this.setCallNotification({
                type: "error",
                message: `Aranan dahili veya numara (${cleanTarget}) şu anda çevrimdışı veya ulaşılamıyor.`
              });
            } else if (code === 403 || code === 603) {
              this.setCallNotification({
                type: "error",
                message: `Arama reddedildi veya bu numarayı (${cleanTarget}) arama yetkiniz bulunmuyor.`
              });
            }
          }
        }
      });
    } catch (err) {
      console.error("[WebphoneManager] Invite error:", err);
      this.setState({
        callStatus: "Idle",
        remoteNumber: "",
        remoteDisplayName: "",
        activeSipCallId: null
      });
      this.setCallNotification({
        type: "error",
        message: "Arama başlatılamadı. Lütfen mikrofon izninizi ve bağlantınızı kontrol edin."
      });
    }
  }

  hangupCall() {
    stopRingtoneSound();
    if (this.session) {
      const remoteNum = this.state.remoteNumber || this.state.dialNumber || "Bilinmeyen";
      try {
        if (this.state.callStatus === "Calling") {
          this.session.cancel();
        } else if (this.state.callStatus === "Ringing") {
          this.recordTimelineEvent("call_rejected", `${remoteNum} gelen çağrısı meşgule/redde atıldı`);
          this.session.reject();
        } else {
          this.session.bye();
        }
      } catch (e) {}
    }
    this.stopDurationTimer();
    this.session = null;
    this.setState({
      callStatus: "Idle",
      remoteNumber: "",
      remoteDisplayName: "",
      activeSipCallId: null
    });
  }

  toggleMute() {
    if (!this.session) return;
    const pc = this.session.sessionDescriptionHandler?.peerConnection;
    if (pc) {
      const nextMuted = !this.state.isMuted;
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === "audio") {
          sender.track.enabled = !nextMuted;
        }
      });
      if (nextMuted) {
        const num = this.state.remoteNumber || this.state.dialNumber;
        this.recordTimelineEvent(
          "call_mute",
          num ? `${num} görüşmesinde mikrofon kapatıldı` : "Görüşmede mikrofon kapatıldı"
        );
      }
      this.setState({ isMuted: nextMuted });
    }
  }

  toggleHold() {
    if (!this.session) return;
    const pc = this.session.sessionDescriptionHandler?.peerConnection;
    if (pc) {
      const nextHold = !this.state.isOnHold;
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === "audio") {
          sender.track.enabled = !nextHold;
        }
      });
      const num = this.state.remoteNumber || this.state.dialNumber;
      if (nextHold) {
        this.recordTimelineEvent("call_hold", num ? `${num} beklemeye alındı` : "Görüşme beklemeye alındı");
      } else {
        this.recordTimelineEvent("call_unhold", num ? `${num} beklemeden alındı` : "Beklemeden geri dönüldü");
      }
      this.setState({ isOnHold: nextHold });
    }
  }

  blindTransfer(target) {
    if (!this.session || !target || !this.state.webrtcConfig?.asteriskWssUrl) return;
    try {
      const remoteNum = this.state.remoteNumber || this.state.dialNumber || "Çağrı";
      this.recordTimelineEvent("call_blind_transfer", `${remoteNum} -> Hedef ${target}`);
      const domain = this.state.webrtcConfig.asteriskWssUrl.split("/")[2].split(":")[0];
      const targetURI = SIP.UserAgent.makeURI(`sip:${target}@${domain}`);
      this.session.refer(targetURI);
    } catch (err) {
      console.error("[WebphoneManager] Blind transfer error:", err);
    }
  }
}

export const webphoneManager = new WebphoneManager();
