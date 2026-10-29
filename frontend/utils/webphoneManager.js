import {
  playRingtoneSound,
  stopRingtoneSound,
  playRingbackTone,
  stopRingbackTone,
  resolveAudioDeviceId
} from "./audioHelper";

let SIP = null;
async function ensureSipLoaded() {
  if (!SIP && typeof window !== "undefined") {
    SIP = await import("sip.js");
  }
  return SIP;
}

class WebphoneManager {
  constructor() {
    this.listeners = new Set();
    this.userAgent = null;
    this.registerer = null;
    this.session = null;
    this.linesMap = new Map(); // lineId -> lineObj
    this.lineCounter = 0;
    this.audioEl = null;
    this.durationInterval = null;
    this.registerNotifyInterval = null;
    this.groupRingingInterval = null;
    this.notifiedGroupCallIds = new Set();
    this.activeUserKey = null;
    this.confAudioCtx = null;
    this.confMicStream = null;

    this.state = {
      isLoadingConfig: true,
      webrtcConfig: null,
      registered: false,
      callStatus: "Idle", // "Idle" | "Calling" | "Ringing" | "InCall"
      dialNumber: "",
      remoteNumber: "",
      remoteDisplayName: "",
      queueName: "",
      callDuration: 0,
      isMuted: false,
      isOnHold: false,
      callNotification: null,
      error: "",
      activeSipCallId: null,
      isWebphoneScreenActive: false,
      backendHost: "localhost:8000",
      currentUser: null,
      // Multi-line & Conference state
      lines: [],
      activeLineId: null,
      isConferenceActive: false,
      attendedTransferPending: false,
      // Group ringing calls alert state (visual only, no ringtone)
      groupRingingCalls: [],
      // CTI & CRM Customer Card / Screen Pop state
      ctiCustomerInfo: null
    };

    this.startGlobalDurationLoop();
    this.initAudioDeviceHotSwapListeners();
  }

  initAudioDeviceHotSwapListeners() {
    if (typeof window === "undefined") return;
    const handleUpdate = () => {
      if (this._deviceSwapDebounce) clearTimeout(this._deviceSwapDebounce);
      this._deviceSwapDebounce = setTimeout(() => {
        this.applyAudioDevicePreferences();
      }, 300);
    };
    window.addEventListener("AUDIO_DEVICES_UPDATED", handleUpdate);
    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
      navigator.mediaDevices.addEventListener("devicechange", handleUpdate);
    }
  }

  ensureAudioElement(lineId = "global") {
    if (typeof window === "undefined") return null;
    const domId = `aida-webphone-audio-${lineId}`;
    let existing = document.getElementById(domId);
    if (!existing) {
      existing = document.createElement("audio");
      existing.id = domId;
      existing.autoplay = true;
      existing.playsInline = true;
      existing.style.display = "none";
      document.body.appendChild(existing);
    }
    if (lineId === "global") {
      this.audioEl = existing;
    }
    return existing;
  }

  removeLineAudioElement(lineId) {
    if (typeof window === "undefined" || !lineId) return;
    const domId = `aida-webphone-audio-${lineId}`;
    const el = document.getElementById(domId);
    if (el) {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch (e) {}
    }
  }

  startGlobalDurationLoop() {
    if (typeof window === "undefined") return;
    if (this.durationInterval) clearInterval(this.durationInterval);
    this.durationInterval = setInterval(() => {
      let changed = false;
      for (const line of this.linesMap.values()) {
        if (line.callStatus === "InCall" && line.establishedAt) {
          const nextDur = Math.max(0, Math.floor((Date.now() - line.establishedAt) / 1000));
          if (nextDur !== line.callDuration) {
            line.callDuration = nextDur;
            changed = true;
          }
        }
      }
      if (changed) {
        this.syncLinesToState();
      }
    }, 1000);
  }

  getNextLineNumber() {
    const used = new Set();
    for (const l of this.linesMap.values()) {
      used.add(l.lineNumber);
    }
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }

  syncLinesToState(extraPatch = {}) {
    const allLines = Array.from(this.linesMap.values()).sort((a, b) => a.lineNumber - b.lineNumber);
    let actId = extraPatch.activeLineId !== undefined ? extraPatch.activeLineId : this.state.activeLineId;

    if (!actId || !this.linesMap.has(actId)) {
      const inCallOrRinging =
        allLines.find((l) => l.callStatus === "Ringing") ||
        allLines.find((l) => l.callStatus === "Calling") ||
        allLines.find((l) => l.callStatus === "InCall" && !l.isOnHold) ||
        allLines[0] ||
        null;
      actId = inCallOrRinging ? inCallOrRinging.id : null;
    }

    const activeLine = actId ? this.linesMap.get(actId) : null;
    this.session = activeLine ? activeLine.session : null;

    const serializedLines = allLines.map((l) => ({
      id: l.id,
      lineNumber: l.lineNumber,
      remoteNumber: l.remoteNumber,
      remoteDisplayName: l.remoteDisplayName,
      queueName: l.queueName || "",
      callStatus: l.callStatus,
      callDuration: l.callDuration,
      isMuted: l.isMuted,
      isOnHold: l.isOnHold,
      sipCallId: l.sipCallId,
      direction: l.direction
    }));

    const inCallLines = allLines.filter((l) => l.callStatus === "InCall");
    const nextConfActive =
      inCallLines.length >= 2
        ? extraPatch.isConferenceActive !== undefined
          ? extraPatch.isConferenceActive
          : this.state.isConferenceActive
        : false;

    if (!nextConfActive && this.confAudioCtx) {
      this.teardownConferenceAudioBridge();
    }

    const nextAttendedPending =
      allLines.length >= 2
        ? extraPatch.attendedTransferPending !== undefined
          ? extraPatch.attendedTransferPending
          : this.state.attendedTransferPending
        : false;

    const patch = {
      ...extraPatch,
      lines: serializedLines,
      activeLineId: actId,
      isConferenceActive: nextConfActive,
      attendedTransferPending: nextAttendedPending,
      callStatus: activeLine ? activeLine.callStatus : "Idle",
      remoteNumber: activeLine ? activeLine.remoteNumber : "",
      remoteDisplayName: activeLine ? activeLine.remoteDisplayName : "",
      queueName: activeLine ? activeLine.queueName || "" : "",
      callDuration: activeLine ? activeLine.callDuration : 0,
      isMuted: activeLine ? activeLine.isMuted : false,
      isOnHold: activeLine ? activeLine.isOnHold : false,
      activeSipCallId: activeLine ? activeLine.sipCallId : null
    };

    const prevCallStatus = this.state.callStatus;
    this.setState(patch);
    if (prevCallStatus !== patch.callStatus) {
      this.sendPresenceNotify();
    }
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

  showNotification(message, type = "info") {
    this.setCallNotification({ type, message });
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
          callee: payload.callee || payload.destination || this.state.remoteNumber || this.state.dialNumber || "",
          sip_call_id: payload.sip_call_id || this.state.activeSipCallId || "",
          status: payload.status || "",
          duration: payload.duration ?? this.state.callDuration ?? 0,
          terminated_by: payload.terminated_by || ""
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
    if (this.activeUserKey === userKey && this.userAgent && this.state.registered) {
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
        this.scheduleReconnect(null, true);
      }
    } catch (err) {
      console.error("[WebphoneManager] Config fetch error:", err);
      this.setState({ isLoadingConfig: false });
      this.scheduleReconnect(null, true);
    }
  }

  scheduleReconnect(config, refetchConfig = false) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this._reconnectAttempt = (this._reconnectAttempt || 0) + 1;
    const delayMs = Math.min(4000 + (this._reconnectAttempt % 3) * 1500, 8000);
    this.reconnectTimer = setTimeout(() => {
      if (this.state.registered) return;
      if (refetchConfig || !config || this._reconnectAttempt % 3 === 0) {
        this.activeUserKey = null;
        this.init({
          backendHost: this.state.backendHost,
          currentUser: this.state.currentUser
        });
      } else {
        this.startUserAgent(config);
      }
    }, delayMs);
  }

  async startUserAgent(config) {
    if (!config?.asteriskWssUrl || !config?.agentExtension) return;
    if (typeof window === "undefined") return;

    await ensureSipLoaded();
    if (!SIP) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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

    const customSdhFactory =
      SIP?.Web?.defaultSessionDescriptionHandlerFactory
        ? SIP.Web.defaultSessionDescriptionHandlerFactory((constraints) =>
            this.acquireAudioStreamWithFallback(constraints)
          )
        : undefined;

    const userAgentOptions = {
      uri,
      contactURI: uri,
      transportOptions: {
        server: asteriskWssUrl,
        connectionTimeout: 8,
        traceSip: false
      },
      ...(customSdhFactory ? { sessionDescriptionHandlerFactory: customSdhFactory } : {}),
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
      hackIpInContact: resolvedViaHost || true,
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
          this._reconnectAttempt = 0;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.setState({ registered: true, error: "" });
          this.startRegisterNotifyLoop();
          if (ua.contact && ua.contact.uri) {
            const expectedUri = ua.contact.uri.toString();
            message = message.replace(
              /^Contact:\s*(?:[^<\r\n]*<[^>]+>|[^\r\n;]+)(.*)$/gim,
              (fullMatch, tail) => {
                const safeTail = tail && /expires\s*=/i.test(tail) ? tail : `${tail || ""};expires=600`;
                return `Contact: <${expectedUri}>${safeTail}`;
              }
            );
          }
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
          this.scheduleReconnect(config, false);
        }
      };
    }

    ua.start()
      .then(() => {
        this._reconnectAttempt = 0;
        this.setState({ registered: true, error: "" });
        this.startRegisterNotifyLoop();
        const registerer = new SIP.Registerer(ua);
        this.registerer = registerer;
        registerer.stateChange.addListener((st) => {
          if (st === SIP.RegistererState.Registered) {
            this._reconnectAttempt = 0;
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
        this.scheduleReconnect(config, false);
      });
  }

  sendPresenceNotify() {
    const ext = this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension;
    if (!this.state.registered || !ext) return;
    const allLines = Array.from(this.linesMap.values());
    let callState = "online";
    if (allLines.some((l) => l.callStatus === "InCall" || l.callStatus === "Calling")) {
      callState = "busy";
    } else if (allLines.some((l) => l.callStatus === "Ringing")) {
      callState = "ringing";
    }
    fetch(`${this.getApiBase()}/api/webrtc/register_notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        extension: ext,
        user_id: this.state.currentUser?.id,
        call_state: callState
      })
    }).catch(() => {});
  }

  startRegisterNotifyLoop() {
    if (this.registerNotifyInterval) clearInterval(this.registerNotifyInterval);
    this.sendPresenceNotify();
    this.registerNotifyInterval = setInterval(() => this.sendPresenceNotify(), 5000);
    this.startGroupRingingLoop();
  }

  startGroupRingingLoop() {
    if (this.groupRingingInterval) clearInterval(this.groupRingingInterval);
    const pollGroupRinging = async () => {
      const ext = this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension;
      const uid = this.state.currentUser?.id || "";
      if (!ext) return;
      try {
        const res = await fetch(
          `${this.getApiBase()}/api/agent/group-ringing?extension=${encodeURIComponent(ext)}&user_id=${encodeURIComponent(uid)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const ringingList = Array.isArray(data?.ringing_calls) ? data.ringing_calls : [];

        // Keep track of active keys to fire visual popup event only when a new group call starts ringing
        const activeKeys = new Set();
        let hasNewRinging = false;
        for (const rc of ringingList) {
          const key = `${rc.ringing_extension}_${rc.caller_number || rc.call_id || ""}`;
          activeKeys.add(key);
          if (!this.notifiedGroupCallIds.has(key)) {
            this.notifiedGroupCallIds.add(key);
            hasNewRinging = true;
          }
        }
        // Clean up finished ringing calls from notified set
        for (const oldKey of Array.from(this.notifiedGroupCallIds)) {
          if (!activeKeys.has(oldKey)) {
            this.notifiedGroupCallIds.delete(oldKey);
          }
        }

        const prevJson = JSON.stringify(this.state.groupRingingCalls || []);
        const nextJson = JSON.stringify(ringingList);
        if (prevJson !== nextJson) {
          this.setState({ groupRingingCalls: ringingList });
        }

        // Visual-only alert (DO NOT play ringtone sound!)
        if (hasNewRinging && ringingList.length > 0 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("GROUP_CALL_RINGING", { detail: ringingList }));
        }
      } catch (e) {}
    };
    pollGroupRinging();
    this.groupRingingInterval = setInterval(pollGroupRinging, 2000);
  }

  async pickupGroupCall(ringingCall) {
    if (!ringingCall || !ringingCall.ringing_extension) return;
    const targetExt = String(ringingCall.ringing_extension).trim();
    const callerNum = String(ringingCall.caller_number || "").trim();
    const callerName = String(ringingCall.caller_name || "").trim();
    const ringingName = String(ringingCall.ringing_name || "").trim();
    const myExt = String(this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension || "1000").trim();

    // Immediately record pickup in backend CDR before dialing **ext
    try {
      await fetch(`${this.getApiBase()}/api/webrtc/pickup-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          picker_extension: myExt,
          ringing_extension: targetExt,
          caller_number: callerNum,
          call_id: ringingCall.call_id || ""
        })
      });
    } catch (e) {}

    // Optimistically remove from groupRingingCalls UI
    const remaining = (this.state.groupRingingCalls || []).filter(
      (rc) => String(rc.ringing_extension) !== targetExt
    );
    this.setState({ groupRingingCalls: remaining });

    const displayLabel = callerName
      ? `${callerName} (Pickup: ${targetExt})`
      : ringingName
        ? `Pickup: ${ringingName} (${targetExt})`
        : `Pickup: Dahili ${targetExt}`;

    this.recordTimelineEvent(
      "call_pickup",
      `Grup Çağrı Çekme: Arayan ${callerNum || "Bilinmeyen"} -> Çalan Dahili ${targetExt} (${myExt} tarafından çekildi)`
    );

    await this.makeCall(`**${targetExt}`, {
      displayName: displayLabel,
      overrideRemoteNumber: callerNum && callerNum !== "Bilinmeyen" ? callerNum : `**${targetExt}`
    });
  }

  async applySpeakerSinkToElement(audioEl) {
    if (!audioEl || typeof window === "undefined") return;
    if (typeof audioEl.setSinkId !== "function") return;
    const savedSpeaker = localStorage.getItem("selected_speaker") || "";
    const savedSpeakerLabel = localStorage.getItem("selected_speaker_label") || "";
    try {
      const resolvedSinkId = await resolveAudioDeviceId("audiooutput", savedSpeaker, savedSpeakerLabel);
      if (resolvedSinkId && resolvedSinkId !== "default" && resolvedSinkId !== savedSpeaker) {
        try {
          localStorage.setItem("selected_speaker", resolvedSinkId);
        } catch (e) {}
      }
      await audioEl.setSinkId(resolvedSinkId === "default" ? "" : resolvedSinkId);
    } catch (err) {
      console.warn("[WebphoneManager] setSinkId failed, falling back to default output:", err);
      try {
        await audioEl.setSinkId("");
      } catch (e2) {}
    }
  }

  async applyAudioDevicePreferences() {
    if (typeof window === "undefined") return;
    for (const line of this.linesMap.values()) {
      const audioEl = this.ensureAudioElement(line.id);
      if (audioEl) {
        await this.applySpeakerSinkToElement(audioEl);
      }

      // Live replace microphone track on active calls if headset/mic changed or reconnected
      if ((line.callStatus === "InCall" || line.callStatus === "Calling") && !this.state.isConferenceActive) {
        const pc = line.session?.sessionDescriptionHandler?.peerConnection;
        if (pc) {
          try {
            const savedMic = localStorage.getItem("selected_mic") || "";
            const savedMicLabel = localStorage.getItem("selected_mic_label") || "";
            const resolvedMicId = await resolveAudioDeviceId("audioinput", savedMic, savedMicLabel);
            const audioSender = pc.getSenders().find((s) => s.track && s.track.kind === "audio");
            if (audioSender && resolvedMicId && resolvedMicId !== "default") {
              const currentSettings = typeof audioSender.track.getSettings === "function" ? audioSender.track.getSettings() : {};
              if (currentSettings.deviceId !== resolvedMicId) {
                const newStream = await navigator.mediaDevices.getUserMedia({
                  audio: {
                    deviceId: { exact: resolvedMicId },
                    echoCancellation: true,
                    noiseSuppression: true
                  },
                  video: false
                });
                const newTrack = newStream.getAudioTracks()[0];
                if (newTrack) {
                  newTrack.enabled = !line.isMuted && !line.isOnHold && this.state.activeLineId === line.id;
                  const oldTrack = audioSender.track;
                  await audioSender.replaceTrack(newTrack);
                  line.origMicTrack = newTrack;
                  if (oldTrack) {
                    try {
                      oldTrack.stop();
                    } catch (e) {}
                  }
                }
              }
            }
          } catch (micErr) {
            // Keep existing microphone track if preferred mic is not currently available
          }
        }
      }
    }
  }

  attachRemoteAudioForLine(line) {
    if (!line || !line.session) return;
    const audioEl = this.ensureAudioElement(line.id);
    const peerConnection = line.session?.sessionDescriptionHandler?.peerConnection;
    if (!peerConnection || !audioEl) return;

    // Save original outgoing mic track if not yet stored
    peerConnection.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === "audio" && !line.origMicTrack) {
        line.origMicTrack = sender.track;
      }
    });

    const bindTrack = async (track) => {
      if (track && track.kind === "audio") {
        line.remoteTrack = track;
        if (line.boundTrackId !== track.id || !audioEl.srcObject) {
          line.boundTrackId = track.id;
          const remoteStream = new MediaStream([track]);
          line.remoteStream = remoteStream;
          audioEl.srcObject = remoteStream;
        }
        await this.applySpeakerSinkToElement(audioEl);
        audioEl.muted = Boolean(line.isOnHold && !this.state.isConferenceActive);
        if (audioEl.paused) {
          audioEl.play().catch((e) => console.warn("[WebphoneManager] Audio play warning:", e));
        }
      }
    };

    if (!line.trackListenerBound) {
      line.trackListenerBound = true;
      peerConnection.addEventListener("track", (event) => {
        bindTrack(event.track);
      });
    }
    peerConnection.getReceivers().forEach((receiver) => {
      bindTrack(receiver.track);
    });
  }

  applyLineAudioState(line) {
    if (!line) return;
    const audioEl = this.ensureAudioElement(line.id);
    const inConf = this.state.isConferenceActive;
    const shouldReceiveAudio = inConf || (!line.isOnHold && this.state.activeLineId === line.id);
    const shouldSendMic = !line.isMuted && (inConf || (!line.isOnHold && this.state.activeLineId === line.id));

    if (audioEl) {
      audioEl.muted = !shouldReceiveAudio;
    }

    const pc = line.session?.sessionDescriptionHandler?.peerConnection;
    if (pc && !inConf) {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === "audio") {
          sender.track.enabled = shouldSendMic;
        }
      });
    }
  }

  applyAllLinesAudioState() {
    for (const line of this.linesMap.values()) {
      this.applyLineAudioState(line);
    }
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
    const myExt = String(this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension || "1000");

    let parsedQueueName = "";
    let cleanedDisplayName = rawDisplayName;
    const qMatch = rawDisplayName.match(/^\[(?:QUEUE|Q):([^\]]+)\]\s*(.*)$/i);
    if (qMatch) {
      parsedQueueName = (qMatch[1] || "").trim();
      cleanedDisplayName = (qMatch[2] || "").trim();
    }

    const lineId = `line-${++this.lineCounter}-${Date.now()}`;
    const lineObj = {
      id: lineId,
      lineNumber: this.getNextLineNumber(),
      session: invite,
      remoteNumber: callerNum,
      remoteDisplayName: cleanedDisplayName && cleanedDisplayName !== callerNum ? cleanedDisplayName : "",
      queueName: parsedQueueName,
      callStatus: "Ringing",
      callDuration: 0,
      establishedAt: null,
      isMuted: false,
      isOnHold: false,
      sipCallId,
      direction: "inbound",
      myExtension: myExt,
      endLogged: false,
      origMicTrack: null,
      remoteTrack: null
    };

    this.linesMap.set(lineId, lineObj);

    // If no active call is currently in progress, focus the ringing line immediately
    const hasInCall = Array.from(this.linesMap.values()).some((l) => l.id !== lineId && l.callStatus === "InCall");
    this.syncLinesToState({
      activeLineId: hasInCall ? this.state.activeLineId : lineId,
      dialNumber: hasInCall ? this.state.dialNumber : callerNum,
      callNotification: null
    });

    // Live check against backend /api/queues/active-call-queue so toggling 'show_queue_name'
    // in Queue Settings works immediately even without Asterisk dialplan reload
    try {
      const apiBase = this.getApiBase();
      fetch(
        `${apiBase}/api/queues/active-call-queue?caller=${encodeURIComponent(callerNum)}&extension=${encodeURIComponent(myExt)}&queue_hint=${encodeURIComponent(parsedQueueName)}`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((qData) => {
          const activeLineObj = this.linesMap.get(lineId);
          if (!activeLineObj || !qData) return;
          if (qData.is_queue_call) {
            const resolvedQ = qData.show_queue_name ? String(qData.queue_name || "").trim() : "";
            if (activeLineObj.queueName !== resolvedQ) {
              activeLineObj.queueName = resolvedQ;
              this.syncLinesToState();
            }
          }
        })
        .catch(() => {});
    } catch (e) {}

    this.logWebrtcCallToBackend("ringing", {
      sip_call_id: sipCallId,
      caller: callerNum,
      callee: myExt,
      destination: myExt
    });

    const isChanSpyAutoAnswer =
      rawDisplayName.toLowerCase().includes("canli dinleme") ||
      rawDisplayName.toLowerCase().includes("canlı dinleme") ||
      rawDisplayName.toLowerCase().includes("chanspy");

    if (typeof window !== "undefined") {
      if (isChanSpyAutoAnswer) {
        setTimeout(() => {
          this.answerCall(lineId);
        }, 120);
      } else {
        const selectedRingtone = localStorage.getItem("ringtone") || "classic";
        const ringtoneSpeaker = localStorage.getItem("selected_ringtone_speaker") || null;
        const ringtoneSpeakerLabel = localStorage.getItem("selected_ringtone_speaker_label") || null;
        playRingtoneSound(selectedRingtone, ringtoneSpeaker, ringtoneSpeakerLabel);
        this.triggerIncomingDesktopNotification(lineObj, myExt);
        this.fetchCtiCustomerLookup(lineObj);
        this.triggerCtiScreenPop(lineObj, "on_ring", false);
        window.dispatchEvent(new CustomEvent("INCOMING_WEBPHONE_CALL", { detail: callerNum }));
      }
    }

    invite.stateChange.addListener((state) => {
      const currentLine = this.linesMap.get(lineId);
      if (!currentLine) return;

      if (state === SIP.SessionState.Established) {
        stopRingtoneSound();
        this.closeLineDesktopNotification(currentLine);
        // Put other active lines on hold when this incoming call is answered
        for (const other of this.linesMap.values()) {
          if (other.id !== lineId && other.callStatus === "InCall") {
            other.isOnHold = true;
          }
        }
        currentLine.callStatus = "InCall";
        currentLine.isOnHold = false;
        currentLine.establishedAt = Date.now();
        this.attachRemoteAudioForLine(currentLine);
        this.syncLinesToState({ activeLineId: lineId });
        this.applyAllLinesAudioState();
        this.triggerCtiScreenPop(currentLine, "on_answer", false);

        this.logWebrtcCallToBackend("answer", {
          sip_call_id: sipCallId,
          caller: callerNum,
          callee: myExt,
          destination: myExt
        });
      } else if (state === SIP.SessionState.Terminated) {
        stopRingtoneSound();
        this.closeLineDesktopNotification(currentLine);
        const durSec = currentLine.establishedAt
          ? (() => {
              const elapsedMs = Date.now() - currentLine.establishedAt;
              return elapsedMs >= 250 ? Math.max(1, Math.floor(elapsedMs / 1000)) : 0;
            })()
          : currentLine.callDuration || 0;

        if (!currentLine.endLogged) {
          currentLine.endLogged = true;
          const remoteEndedBy =
            callerNum && /^\d+$/.test(callerNum) && callerNum.length <= 6
              ? `ext:${callerNum}`
              : "customer";
          this.logWebrtcCallToBackend("end", {
            sip_call_id: sipCallId,
            caller: callerNum,
            callee: myExt,
            destination: myExt,
            duration: durSec,
            status: durSec > 0 ? "completed" : "no_answer",
            terminated_by: remoteEndedBy
          });
        }

        this.removeLineAudioElement(lineId);
        this.linesMap.delete(lineId);
        const remainingLines = Array.from(this.linesMap.values());
        this.syncLinesToState({
          ctiCustomerInfo: remainingLines.length > 0 ? remainingLines[0].ctiCustomerInfo || null : null
        });
        this.applyAllLinesAudioState();
      }
    });
  }

  resolveUserCtiConfig() {
    let curU = this.state.currentUser;
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("current_user") || "null");
        if (stored && stored.cti_config) {
          curU = { ...(curU || {}), ...stored };
        }
      } catch (e) {}
    }
    let cfg = curU?.cti_config;
    if (typeof cfg === "string") {
      try {
        cfg = JSON.parse(cfg);
      } catch (e) {
        cfg = null;
      }
    }
    return cfg && typeof cfg === "object" ? cfg : {};
  }

  buildCtiScreenPopUrl(lineObj) {
    const cfg = this.resolveUserCtiConfig();
    const tpl = String(cfg.screen_pop_url || "").trim();
    if (!tpl) return "";
    const callerRaw = String(lineObj?.remoteNumber || this.state.remoteNumber || "").trim();
    const callerClean = callerRaw.replace(/\D/g, "");
    const last10 = callerClean.slice(-10);
    const myExt = String(this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension || "1000");
    const callId = String(lineObj?.sipCallId || this.state.activeSipCallId || "");
    const queueVal = String(lineObj?.queueName || this.state.queueName || "");
    const agentName = String(this.state.currentUser?.full_name || this.state.currentUser?.username || "");

    return tpl
      .replace(/\{caller\}/g, encodeURIComponent(callerRaw))
      .replace(/\{caller_clean\}/g, encodeURIComponent(callerClean))
      .replace(/\{phone\}/g, encodeURIComponent(callerClean))
      .replace(/\{last10\}/g, encodeURIComponent(last10))
      .replace(/\{extension\}/g, encodeURIComponent(myExt))
      .replace(/\{call_id\}/g, encodeURIComponent(callId))
      .replace(/\{queue\}/g, encodeURIComponent(queueVal))
      .replace(/\{agent_name\}/g, encodeURIComponent(agentName));
  }

  setCtiPermissionAllowed(allowed) {
    this.ctiPermissionAllowed = allowed !== false;
  }

  triggerCtiScreenPop(lineObj, phase = "on_ring", forceOpen = false) {
    if (typeof window === "undefined") return false;
    if (this.ctiPermissionAllowed === false) return false;
    const cfg = this.resolveUserCtiConfig();
    if (!forceOpen && !cfg.enabled) return false;

    const targetLine =
      lineObj ||
      (this.state.activeLineId ? this.linesMap.get(this.state.activeLineId) : null) ||
      Array.from(this.linesMap.values())[0];
    if (!targetLine && !forceOpen) return false;

    const url = this.buildCtiScreenPopUrl(targetLine);
    if (!url) return false;

    const triggerMode = cfg.trigger_mode || "on_ring";
    if (!forceOpen) {
      if (targetLine?.ctiScreenPopOpened) return false;
      const shouldOpenNow =
        triggerMode === phase || (phase === "on_answer" && targetLine?.ctiPopupBlockedOnRing);
      if (!shouldOpenNow) return false;
    }

    const targetTab = cfg.open_mode === "reuse_tab" ? "aida_crm_tab" : "_blank";
    try {
      const win = window.open(url, targetTab, "noopener,noreferrer");
      if (win) {
        if (targetLine) {
          targetLine.ctiScreenPopOpened = true;
          targetLine.ctiPopupBlockedOnRing = false;
        }
        return true;
      } else if (targetLine && phase === "on_ring") {
        // Browser popup blocker blocked background ring popup; retry automatically on Answer click!
        targetLine.ctiPopupBlockedOnRing = true;
      }
    } catch (e) {
      if (targetLine && phase === "on_ring") {
        targetLine.ctiPopupBlockedOnRing = true;
      }
    }
    return false;
  }

  async fetchCtiCustomerLookup(lineObj) {
    if (!lineObj || !lineObj.remoteNumber) return;
    const myExt = String(this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension || "1000");
    const curU = this.state.currentUser;
    try {
      const res = await fetch(`${this.getApiBase()}/api/cti/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caller: lineObj.remoteNumber,
          call_id: lineObj.sipCallId || "",
          extension: myExt,
          queue: lineObj.queueName || "",
          agent_id: curU?.id || myExt
        })
      });
      if (!res.ok) return;
      const data = await res.json();
      const activeLine = this.linesMap.get(lineObj.id);
      if (activeLine && data && data.status === "success") {
        activeLine.ctiCustomerInfo = data;
        const foundName = data.customer_summary?.name || data.local_contact?.name || "";
        if (foundName && (!activeLine.remoteDisplayName || activeLine.remoteDisplayName === activeLine.remoteNumber)) {
          activeLine.remoteDisplayName = foundName;
        }
        this.syncLinesToState({ ctiCustomerInfo: data });
      }
    } catch (e) {}
  }

  closeLineDesktopNotification(lineObj) {
    if (lineObj && lineObj.desktopNotification) {
      try {
        lineObj.desktopNotification.close();
      } catch (e) {}
      lineObj.desktopNotification = null;
    }
  }

  triggerIncomingDesktopNotification(lineObj, myExt = "") {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const callerLabel =
      lineObj.remoteDisplayName && lineObj.remoteDisplayName !== lineObj.remoteNumber
        ? `${lineObj.remoteDisplayName} (${lineObj.remoteNumber})`
        : lineObj.remoteNumber || "Bilinmeyen Numara";
    const queuePrefix = lineObj.queueName ? `[${lineObj.queueName}] ` : "";
    const title = `📞 Gelen Çağrı: ${queuePrefix}${callerLabel}`;
    const body = lineObj.queueName
      ? `${lineObj.queueName} kuyruğundan Dahili ${myExt || this.state.webrtcConfig?.agentExtension || ""} hattınıza çağrı geliyor.`
      : `Dahili ${myExt || this.state.webrtcConfig?.agentExtension || ""} hattınıza çağrı geliyor. Pencereyi öne getirmek için tıklayın.`;
    const uniqueTag = `aida-call-${lineObj.id}-${Date.now()}`;

    try {
      const notif = new Notification(title, {
        body,
        tag: uniqueTag,
        requireInteraction: true,
        silent: false
      });
      notif.onclick = () => {
        try {
          window.focus();
          window.dispatchEvent(new CustomEvent("OPEN_FULL_WEBPHONE"));
          notif.close();
        } catch (e) {}
      };
      lineObj.desktopNotification = notif;
    } catch (err) {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready
          .then((reg) =>
            reg.showNotification(title, {
              body,
              tag: uniqueTag,
              requireInteraction: true
            })
          )
          .catch(() => {});
      }
    }
  }

  async requestAndTestDesktopNotification() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      this.showNotification("Tarayıcınız masaüstü bildirimlerini desteklemiyor.", "error");
      return "unsupported";
    }
    let perm = Notification.permission;
    if (perm === "default") {
      try {
        perm = await Notification.requestPermission();
      } catch (e) {}
    }
    if (perm === "granted") {
      try {
        const n = new Notification("🔔 AIDA Masaüstü Bildirimi Aktif", {
          body: "Farklı bir sekmede veya uygulamada olduğunuzda gelen çağrılar bu şekilde ekranda belirecektir.",
          tag: `aida-test-${Date.now()}`
        });
        n.onclick = () => {
          try {
            window.focus();
            n.close();
          } catch (e) {}
        };
        this.showNotification("Masaüstü bildirimi gönderildi! Sağ üst/alt köşeyi kontrol edin.", "info");
      } catch (e) {
        this.showNotification("Bildirim oluşturulamadı: " + (e.message || ""), "error");
      }
    } else if (perm === "denied") {
      this.showNotification(
        "Tarayıcı bildirim izni engellenmiş. Adres çubuğundaki kilit (🔒) ikonundan 'Bildirimler -> İzin Ver' seçin.",
        "error"
      );
    }
    return perm;
  }

  createSilentFallbackAudioStream() {
    if (typeof window === "undefined") return null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.silentFallbackCtx || this.silentFallbackCtx.state === "closed") {
        this.silentFallbackCtx = new AudioCtx();
      }
      if (this.silentFallbackCtx.state === "suspended") {
        this.silentFallbackCtx.resume().catch(() => {});
      }
      const dst = this.silentFallbackCtx.createMediaStreamDestination();
      const osc = this.silentFallbackCtx.createOscillator();
      const gain = this.silentFallbackCtx.createGain();
      gain.gain.value = 0.00001; // Virtually silent keepalive audio track
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      return dst.stream;
    } catch (e) {
      console.error("[WebphoneManager] Silent fallback stream error:", e);
      return null;
    }
  }

  async requestSafeMicrophoneStream(preferredDeviceId = null) {
    return this.acquireAudioStreamWithFallback(preferredDeviceId ? { audio: { deviceId: { ideal: preferredDeviceId } } } : undefined);
  }

  async acquireAudioStreamWithFallback(requestedConstraints) {
    if (typeof window === "undefined") {
      throw new Error("Tarayıcı ortamı bulunamadı.");
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      const silent = this.createSilentFallbackAudioStream();
      if (silent) {
        this.showNotification(
          "Güvenli bağlantı (HTTPS) olmadığı için mikrofon açılamadı; arama dinleme moduyla başlatıldı.",
          "info"
        );
        return silent;
      }
      throw new Error("Tarayıcı mikrofon API erişimi için HTTPS bağlantısı gereklidir.");
    }

    const selectedMic = localStorage.getItem("selected_mic") || "";
    const selectedMicLabel = localStorage.getItem("selected_mic_label") || "";
    const resolvedMicId = await resolveAudioDeviceId("audioinput", selectedMic, selectedMicLabel);

    if (resolvedMicId && resolvedMicId !== "default" && resolvedMicId !== selectedMic) {
      try {
        localStorage.setItem("selected_mic", resolvedMicId);
      } catch (e) {}
    }

    const hasCustomMic = Boolean(resolvedMicId && resolvedMicId !== "default");

    // 1. Try with exact resolved microphone first so Chrome strictly uses the selected headset mic
    if (hasCustomMic) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: resolvedMicId },
            echoCancellation: true,
            noiseSuppression: true
          },
          video: false
        });
      } catch (errExact) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { ideal: resolvedMicId },
              echoCancellation: true,
              noiseSuppression: true
            },
            video: false
          });
        } catch (errIdeal) {
          console.warn("[WebphoneManager] Preferred mic temporarily unavailable, falling back to system default mic:", errIdeal);
        }
      }
    }

    // 2. Try default system microphone ({ audio: true })
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        },
        video: false
      });
    } catch (err2) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err3) {
        console.warn("[WebphoneManager] Default getUserMedia failed, using silent fallback stream:", err3);
        const errName = String(err3?.name || "");
        const silentStream = this.createSilentFallbackAudioStream();
        if (silentStream) {
          if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
            this.showNotification(
              "Bilgisayarda takılı/aktif mikrofon bulunamadı. Arama sessiz mikrofon (dinleme) moduyla başlatıldı.",
              "info"
            );
          } else if (errName === "NotReadableError" || errName === "TrackStartError") {
            this.showNotification(
              "Mikrofon başka bir uygulama tarafından kullanılıyor. Arama sessiz mikrofon moduyla başlatıldı.",
              "info"
            );
          } else {
            this.showNotification(
              "Mikrofon kaynağına erişilemedi (İşletim sistemi gizlilik ayarlarını kontrol edin). Arama sessiz mikrofonla başlatıldı.",
              "info"
            );
          }
          return silentStream;
        }
        throw err3;
      }
    }
  }

  buildSafeSessionConstraints() {
    const selectedMic = typeof window !== "undefined" ? localStorage.getItem("selected_mic") : null;
    const hasValidMic = Boolean(selectedMic && selectedMic !== "default");
    return {
      audio: hasValidMic
        ? { deviceId: { ideal: selectedMic }, echoCancellation: true, noiseSuppression: true }
        : true,
      video: false
    };
  }

  getUnlockedAudioContext() {
    if (typeof window === "undefined") return null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.sharedAudioCtx || this.sharedAudioCtx.state === "closed") {
        this.sharedAudioCtx = new AudioCtx();
      }
      if (this.sharedAudioCtx.state === "suspended") {
        this.sharedAudioCtx.resume().catch(() => {});
      }
      return this.sharedAudioCtx;
    } catch (e) {
      return null;
    }
  }

  async answerCall(targetLineId = null) {
    this.getUnlockedAudioContext();
    const line =
      (targetLineId && this.linesMap.get(targetLineId)) ||
      Array.from(this.linesMap.values()).find((l) => l.callStatus === "Ringing") ||
      (this.state.activeLineId ? this.linesMap.get(this.state.activeLineId) : null);

    if (!line || line.callStatus !== "Ringing") return;

    try {
      stopRingtoneSound();
      this.triggerCtiScreenPop(line, "on_answer", false);
      // Place any other active lines on hold before answering
      for (const other of this.linesMap.values()) {
        if (other.id !== line.id && other.callStatus === "InCall") {
          other.isOnHold = true;
        }
      }

      const constraints = this.buildSafeSessionConstraints();
      await line.session.accept({
        sessionDescriptionHandlerOptions: {
          constraints,
          iceGatheringTimeout: 400
        }
      });
      line.callStatus = "InCall";
      line.isOnHold = false;
      if (!line.establishedAt) line.establishedAt = Date.now();
      this.attachRemoteAudioForLine(line);
      this.syncLinesToState({ activeLineId: line.id });
      this.applyAllLinesAudioState();
    } catch (err) {
      console.error("[WebphoneManager] Answer error:", err);
      this.setCallNotification({
        type: "error",
        message: `Çağrı yanıtlanamadı (${err?.message || "Bağlantı/Medya hatası"}).`
      });
    }
  }

  async makeCall(targetNum, options = {}) {
    this.getUnlockedAudioContext();
    const cleanTarget = String(targetNum || this.state.dialNumber || "").replace(/[^0-9*#+]/g, "");
    if (!cleanTarget) return;

    if (!this.userAgent || !this.state.webrtcConfig) {
      this.setCallNotification({
        type: "error",
        message: "Web Telefon bağlantısı hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin."
      });
      return;
    }

    // Ensure WebSocket transport is connected before dialing
    try {
      if (this.userAgent.transport && typeof this.userAgent.transport.isConnected === "function" && !this.userAgent.transport.isConnected()) {
        await this.userAgent.transport.connect();
      }
    } catch (eTrans) {
      console.warn("[WebphoneManager] Transport reconnect before makeCall:", eTrans);
    }

    // Place existing active lines on hold when starting a new call
    for (const existing of this.linesMap.values()) {
      if (existing.callStatus === "InCall" && !existing.isOnHold && !this.state.isConferenceActive) {
        existing.isOnHold = true;
        this.recordTimelineEvent("call_hold", `${existing.remoteNumber} yeni hat araması için beklemeye alındı`);
      }
    }

    const myExt = this.state.webrtcConfig.agentExtension || this.state.currentUser?.extension || "";
    const sipCallId = `webphone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const lineId = `line-${++this.lineCounter}-${Date.now()}`;

    const hostOnly = this.state.webrtcConfig.asteriskWssUrl.split("/")[2].split(":")[0];
    const targetURI = SIP.UserAgent.makeURI(`sip:${cleanTarget}@${hostOnly}`);
    const constraints = this.buildSafeSessionConstraints();

    const inviter = new SIP.Inviter(this.userAgent, targetURI, {
      earlyMedia: true,
      sessionDescriptionHandlerOptions: {
        constraints,
        iceGatheringTimeout: 400
      }
    });

    const uiRemoteNum = String(options.overrideRemoteNumber || cleanTarget).trim();

    const lineObj = {
      id: lineId,
      lineNumber: this.getNextLineNumber(),
      session: inviter,
      remoteNumber: uiRemoteNum,
      rawTarget: cleanTarget,
      myExtension: myExt,
      endLogged: false,
      remoteDisplayName: String(options.displayName || "").trim(),
      callStatus: "Calling",
      callDuration: 0,
      establishedAt: null,
      isMuted: false,
      isOnHold: false,
      sipCallId,
      direction: "outbound",
      autoConferenceOnAnswer: Boolean(options.joinConference),
      origMicTrack: null,
      remoteTrack: null
    };

    this.linesMap.set(lineId, lineObj);
    this.syncLinesToState({
      activeLineId: lineId,
      dialNumber: uiRemoteNum,
      callNotification: null,
      attendedTransferPending: Boolean(options.attendedTransfer) || this.state.attendedTransferPending
    });
    this.applyAllLinesAudioState();

    const isPickupCode = cleanTarget.startsWith("*8") || cleanTarget.startsWith("**");
    if (isPickupCode) {
      const pickupLbl = cleanTarget.startsWith("*8")
        ? "Grup Çağrı Toplama (*8)"
        : `Hedefli Çağrı Toplama (${cleanTarget})`;
      this.recordTimelineEvent("call_pickup", pickupLbl);
    } else if (typeof window !== "undefined") {
      const selectedSpeaker = localStorage.getItem("selected_speaker") || null;
      const selectedSpeakerLabel = localStorage.getItem("selected_speaker_label") || null;
      playRingbackTone(selectedSpeaker, selectedSpeakerLabel);
    }

    this.logWebrtcCallToBackend("start", {
      caller: myExt,
      callee: cleanTarget,
      sip_call_id: sipCallId,
      status: "in_progress"
    });

    let wasEstablished = false;
    let rejectStatusCode = null;

    inviter.stateChange.addListener((state) => {
      const currentLine = this.linesMap.get(lineId);
      if (!currentLine) return;

      if (state === SIP.SessionState.Establishing) {
        this.attachRemoteAudioForLine(currentLine);
      } else if (state === SIP.SessionState.Established) {
        stopRingbackTone();
        wasEstablished = true;
        currentLine.callStatus = "InCall";
        currentLine.isOnHold = false;
        currentLine.establishedAt = Date.now();
        this.attachRemoteAudioForLine(currentLine);
        this.syncLinesToState({ activeLineId: lineId });
        this.applyAllLinesAudioState();

        if (currentLine.autoConferenceOnAnswer) {
          currentLine.autoConferenceOnAnswer = false;
          setTimeout(() => {
            this.startConference();
          }, 300);
        }

        this.logWebrtcCallToBackend("answer", {
          caller: myExt,
          callee: cleanTarget,
          sip_call_id: sipCallId,
          status: "in_progress"
        });
      } else if (state === SIP.SessionState.Terminated) {
        stopRingbackTone();
        const finalDuration = currentLine.establishedAt
          ? (() => {
              const elapsedMs = Date.now() - currentLine.establishedAt;
              return elapsedMs >= 250 ? Math.max(1, Math.floor(elapsedMs / 1000)) : 0;
            })()
          : currentLine.callDuration || 0;

        let finalStatus = wasEstablished ? "completed" : "no_answer";
        if (!wasEstablished) {
          if (rejectStatusCode === 486 || rejectStatusCode === 600) finalStatus = "busy";
          else if (rejectStatusCode === 403 || rejectStatusCode === 603) finalStatus = "blocked";
          else if (rejectStatusCode === 487) finalStatus = "cancelled";
        }
        if (!currentLine.endLogged) {
          currentLine.endLogged = true;
          const remoteEndedBy =
            !wasEstablished && (rejectStatusCode === 403 || rejectStatusCode === 603)
              ? "system"
              : cleanTarget && /^\d+$/.test(cleanTarget) && cleanTarget.length <= 6
              ? `ext:${cleanTarget}`
              : "customer";
          this.logWebrtcCallToBackend("end", {
            caller: myExt,
            callee: cleanTarget,
            sip_call_id: sipCallId,
            status: finalStatus,
            duration: finalDuration,
            terminated_by: remoteEndedBy
          });
        }

        this.removeLineAudioElement(lineId);
        this.linesMap.delete(lineId);
        // If another line remains on hold and no other line is active, keep it selected so user can resume or auto-resume
        this.syncLinesToState();
        this.applyAllLinesAudioState();
      }
    });

    try {
      await inviter.invite({
        requestDelegate: {
          onProgress: () => {
            const currentLine = this.linesMap.get(lineId);
            if (currentLine) this.attachRemoteAudioForLine(currentLine);
          },
          onReject: (response) => {
            stopRingbackTone();
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
      stopRingbackTone();
      console.error("[WebphoneManager] Invite error:", err);
      this.removeLineAudioElement(lineId);
      this.linesMap.delete(lineId);
      this.syncLinesToState();
      this.applyAllLinesAudioState();
      const errDetail = err?.message || err?.name || "Bilinmeyen Hata";
      this.setCallNotification({
        type: "error",
        message: `Arama başlatılamadı (${errDetail}).`
      });
    }
  }

  switchLine(targetLineId) {
    const targetLine = this.linesMap.get(targetLineId);
    if (!targetLine) return;

    if (targetLine.callStatus === "Ringing") {
      this.answerCall(targetLineId);
      return;
    }

    if (!this.state.isConferenceActive) {
      for (const line of this.linesMap.values()) {
        if (line.id === targetLineId) {
          if (line.isOnHold) {
            line.isOnHold = false;
            this.recordTimelineEvent("call_unhold", `${line.remoteNumber} hattına geçiş yapıldı (beklemeden alındı)`);
          }
        } else if (line.callStatus === "InCall" && !line.isOnHold) {
          line.isOnHold = true;
          this.recordTimelineEvent("call_hold", `${line.remoteNumber} hattı beklemeye alındı`);
        }
      }
    }

    this.syncLinesToState({
      activeLineId: targetLineId,
      dialNumber: targetLine.remoteNumber
    });
    this.applyAllLinesAudioState();
  }

  swapLines() {
    const allLines = Array.from(this.linesMap.values()).sort((a, b) => a.lineNumber - b.lineNumber);
    if (allLines.length < 2) return;
    const currentIndex = allLines.findIndex((l) => l.id === this.state.activeLineId);
    const nextIndex = (currentIndex + 1) % allLines.length;
    this.switchLine(allLines[nextIndex].id);
  }

  hangupCall(targetLineId = null) {
    stopRingtoneSound();
    stopRingbackTone();
    const lineId = targetLineId || this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : null;

    if (!line) {
      this.syncLinesToState();
      return;
    }

    const remoteNum = line.remoteNumber || "Bilinmeyen";
    const myExt = String(line.myExtension || this.state.currentUser?.extension || "").trim();
    const durSec = line.establishedAt
      ? (() => {
          const elapsedMs = Date.now() - line.establishedAt;
          return elapsedMs >= 250 ? Math.max(1, Math.floor(elapsedMs / 1000)) : 0;
        })()
      : line.callDuration || 0;

    if (!line.endLogged) {
      line.endLogged = true;
      const isInbound = line.direction === "inbound";
      const callerVal = isInbound ? remoteNum : myExt;
      const calleeVal = isInbound ? myExt : (line.rawTarget || remoteNum);
      const finalStatus =
        durSec > 0 || line.callStatus === "InCall"
          ? "completed"
          : isInbound
          ? "no_answer"
          : "cancelled";
      this.logWebrtcCallToBackend("end", {
        sip_call_id: line.sipCallId,
        caller: callerVal,
        callee: calleeVal,
        duration: durSec,
        status: finalStatus,
        terminated_by: myExt ? `ext:${myExt}` : "agent"
      });
    }

    try {
      if (line.callStatus === "Calling") {
        line.session.cancel();
      } else if (line.callStatus === "Ringing") {
        this.recordTimelineEvent("call_rejected", `${remoteNum} gelen çağrısı meşgule/redde atıldı`);
        line.session.reject();
      } else {
        line.session.bye();
      }
    } catch (e) {}

    this.removeLineAudioElement(line.id);
    this.linesMap.delete(line.id);
    this.syncLinesToState();
    this.applyAllLinesAudioState();
  }

  hangupAllCalls() {
    const ids = Array.from(this.linesMap.keys());
    ids.forEach((id) => this.hangupCall(id));
  }

  toggleMute(targetLineId = null) {
    const lineId = targetLineId || this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : null;
    if (!line) return;

    const nextMuted = !line.isMuted;
    line.isMuted = nextMuted;

    if (this.state.isConferenceActive) {
      // In conference mode, mute/unmute all lines' mic state
      for (const l of this.linesMap.values()) {
        l.isMuted = nextMuted;
      }
      if (this.confMicStream) {
        this.confMicStream.getAudioTracks().forEach((t) => {
          t.enabled = !nextMuted;
        });
      }
    }

    if (nextMuted) {
      this.recordTimelineEvent(
        "call_mute",
        line.remoteNumber ? `${line.remoteNumber} görüşmesinde mikrofon kapatıldı` : "Görüşmede mikrofon kapatıldı"
      );
    }

    this.syncLinesToState();
    this.applyAllLinesAudioState();
  }

  toggleHold(targetLineId = null) {
    const lineId = targetLineId || this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : null;
    if (!line || line.callStatus !== "InCall") return;

    const nextHold = !line.isOnHold;
    line.isOnHold = nextHold;

    if (!nextHold && !this.state.isConferenceActive) {
      // Unholding this line automatically holds other lines
      for (const other of this.linesMap.values()) {
        if (other.id !== line.id && other.callStatus === "InCall") {
          other.isOnHold = true;
        }
      }
    }

    if (nextHold) {
      this.recordTimelineEvent("call_hold", line.remoteNumber ? `${line.remoteNumber} beklemeye alındı` : "Görüşme beklemeye alındı");
    } else {
      this.recordTimelineEvent("call_unhold", line.remoteNumber ? `${line.remoteNumber} beklemeden alındı` : "Beklemeden geri dönüldü");
    }

    this.syncLinesToState({ activeLineId: line.id });
    this.applyAllLinesAudioState();
  }

  async blindTransfer(target, targetName = "", targetLineId = null) {
    const cleanTarget = String(target || "").trim().replace(/\s+/g, "");
    const lineId = targetLineId || this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : null;
    if (!cleanTarget || !line) return;

    const remoteNum = line.remoteNumber || "Çağrı";
    const myExt = String(this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension || "1000").trim();
    const label = targetName ? `${targetName} (${cleanTarget})` : cleanTarget;

    this.recordTimelineEvent("call_blind_transfer", `${remoteNum} -> Hedef ${label} (Kontrolsüz Transfer)`);

    try {
      const res = await fetch(`${this.getApiBase()}/api/webrtc/blind-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_extension: myExt,
          remote_number: remoteNum,
          target: cleanTarget
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.transferred_via_ami) {
          this.showNotification(`Çağrı (${remoteNum}) kontrolsüz olarak ${label} numarasına aktarıldı.`, "info");
          this.hangupCall(line.id);
          return;
        }
      }
    } catch (e) {
      // Fallback to SIP REFER below
    }

    try {
      if (line.session && this.state.webrtcConfig?.asteriskWssUrl) {
        const domain = this.state.webrtcConfig.asteriskWssUrl.split("/")[2].split(":")[0];
        const targetURI = SIP.UserAgent.makeURI(`sip:${cleanTarget}@${domain}`);
        if (targetURI) {
          await line.session.refer(targetURI);
          this.showNotification(`Çağrı (${remoteNum}) kontrolsüz olarak ${label} numarasına aktarıldı.`, "info");
          setTimeout(() => {
            this.hangupCall(line.id);
          }, 600);
        }
      }
    } catch (err) {
      console.error("[WebphoneManager] Blind transfer error:", err);
    }
  }

  async startAttendedTransfer(target, targetName = "") {
    const cleanTarget = String(target || "").trim().replace(/\s+/g, "");
    if (!cleanTarget) return;
    this.recordTimelineEvent(
      "call_attended_transfer_consult",
      `Kontrollü transfer için ${targetName ? `${targetName} (${cleanTarget})` : cleanTarget} aranıyor`
    );
    await this.makeCall(cleanTarget, {
      attendedTransfer: true,
      displayName: targetName
    });
  }

  async completeAttendedTransfer(line1Id = null, line2Id = null) {
    const allLines = Array.from(this.linesMap.values()).sort((a, b) => a.lineNumber - b.lineNumber);
    if (allLines.length < 2) {
      this.showNotification("Kontrollü transferi tamamlamak için en az 2 aktif hat olmalıdır.", "error");
      return;
    }

    const line1 = (line1Id && this.linesMap.get(line1Id)) || allLines[0];
    const line2 = (line2Id && this.linesMap.get(line2Id)) || allLines.find((l) => l.id !== line1.id);
    if (!line1 || !line2) return;

    const myExt = String(this.state.webrtcConfig?.agentExtension || this.state.currentUser?.extension || "1000").trim();
    const rem1 = line1.remoteNumber;
    const rem2 = line2.remoteNumber;

    this.recordTimelineEvent("call_attended_transfer_complete", `Kontrollü Transfer Tamamlandı: ${rem1} <-> ${rem2}`);

    try {
      const res = await fetch(`${this.getApiBase()}/api/webrtc/attended-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_extension: myExt,
          remote_number_1: rem1,
          remote_number_2: rem2
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.transferred_via_ami) {
          this.showNotification(`Kontrollü transfer tamamlandı: ${rem1} ve ${rem2} birbirine bağlandı.`, "info");
          this.hangupAllCalls();
          return;
        }
      }
    } catch (e) {
      // Fallback to SIP.js attended refer
    }

    try {
      if (line1.session && line2.session) {
        await line1.session.refer(line2.session);
        this.showNotification(`Kontrollü transfer tamamlandı: ${rem1} ve ${rem2} birbirine bağlandı.`, "info");
        setTimeout(() => {
          this.hangupAllCalls();
        }, 600);
      }
    } catch (err) {
      console.error("[WebphoneManager] Attended transfer error:", err);
      this.showNotification("Kontrollü transfer sırasında bir hata oluştu.", "error");
    }
  }

  async addParticipantToConference(target, targetName = "") {
    const cleanTarget = String(target || "").trim().replace(/\s+/g, "");
    if (!cleanTarget) return;
    this.recordTimelineEvent(
      "call_conference_invite",
      `${targetName ? `${targetName} (${cleanTarget})` : cleanTarget} konferans görüşmesi için aranıyor`
    );
    await this.makeCall(cleanTarget, {
      joinConference: true,
      displayName: targetName
    });
  }

  async startConference() {
    const inCallLines = Array.from(this.linesMap.values()).filter((l) => l.callStatus === "InCall");
    if (inCallLines.length < 2) {
      this.showNotification("Konferans başlatmak için en az 2 aktif görüşme hattı olmalıdır.", "error");
      return;
    }

    // Unhold all lines in the conference
    for (const line of inCallLines) {
      line.isOnHold = false;
    }

    await this.setupConferenceAudioBridge(inCallLines);

    const nums = inCallLines.map((l) => l.remoteNumber).join(" + ");
    this.recordTimelineEvent("call_conference", `Konferans birleştirildi (${nums})`);
    this.showNotification(`Konferans görüşmesi aktif (${nums})`, "info");

    this.syncLinesToState({
      isConferenceActive: true,
      attendedTransferPending: false
    });
    this.applyAllLinesAudioState();
  }

  stopConference() {
    this.teardownConferenceAudioBridge();
    const allLines = Array.from(this.linesMap.values());
    const activeId = this.state.activeLineId;
    for (const line of allLines) {
      if (line.callStatus === "InCall") {
        line.isOnHold = line.id !== activeId;
      }
    }
    this.recordTimelineEvent("call_conference_split", "Konferans görüşmesi ayrıldı, tekli hatta dönüldü");
    this.syncLinesToState({ isConferenceActive: false });
    this.applyAllLinesAudioState();
  }

  async setupConferenceAudioBridge(inCallLines) {
    if (typeof window === "undefined") return;
    this.teardownConferenceAudioBridge();

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.confAudioCtx = ctx;

      const micStream = await this.acquireAudioStreamWithFallback();
      this.confMicStream = micStream;
      const micSource = ctx.createMediaStreamSource(micStream);

      const lineSources = new Map();
      for (const line of inCallLines) {
        const pc = line.session?.sessionDescriptionHandler?.peerConnection;
        if (!pc) continue;
        const receivers = pc.getReceivers().filter((r) => r.track && r.track.kind === "audio");
        if (receivers.length > 0) {
          const remoteStream = new MediaStream([receivers[0].track]);
          const srcNode = ctx.createMediaStreamSource(remoteStream);
          lineSources.set(line.id, srcNode);
        }
      }

      // Mix Mic + all other lines' remote audio into each line's outgoing RTP sender
      for (const line of inCallLines) {
        const pc = line.session?.sessionDescriptionHandler?.peerConnection;
        if (!pc) continue;
        const dest = ctx.createMediaStreamDestination();
        micSource.connect(dest);

        for (const [otherId, otherSourceNode] of lineSources.entries()) {
          if (otherId !== line.id) {
            otherSourceNode.connect(dest);
          }
        }

        const mixedTrack = dest.stream.getAudioTracks()[0];
        if (mixedTrack) {
          pc.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === "audio") {
              if (!line.origMicTrack) {
                line.origMicTrack = sender.track;
              }
              sender.replaceTrack(mixedTrack).catch(() => {});
            }
          });
        }
      }
    } catch (err) {
      console.error("[WebphoneManager] Conference audio mixer error:", err);
    }
  }

  teardownConferenceAudioBridge() {
    for (const line of this.linesMap.values()) {
      const pc = line.session?.sessionDescriptionHandler?.peerConnection;
      if (pc && line.origMicTrack) {
        pc.getSenders().forEach((sender) => {
          if (sender.track && sender.track.kind === "audio") {
            sender.replaceTrack(line.origMicTrack).catch(() => {});
          }
        });
      }
    }
    if (this.confMicStream) {
      try {
        this.confMicStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      this.confMicStream = null;
    }
    if (this.confAudioCtx) {
      try {
        this.confAudioCtx.close();
      } catch (e) {}
      this.confAudioCtx = null;
    }
  }

  /**
   * Returns a MediaStream containing the active call line's incoming remote audio track
   * so LiveTranslatorPanel can capture customer speech in real-time.
   */
  getActiveRemoteStream() {
    if (typeof window === "undefined") return null;
    const lineId = this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : Array.from(this.linesMap.values())[0];
    if (!line) return null;

    if (line.remoteStream && line.remoteTrack && line.remoteTrack.readyState === "live") {
      return line.remoteStream;
    }

    if (line.remoteTrack && line.remoteTrack.readyState === "live") {
      line.remoteStream = new MediaStream([line.remoteTrack]);
      return line.remoteStream;
    }

    const pc = line.session?.sessionDescriptionHandler?.peerConnection;
    if (!pc) return null;
    const receivers = pc.getReceivers().filter((r) => r.track && r.track.kind === "audio" && r.track.readyState === "live");
    if (receivers.length > 0) {
      line.remoteTrack = receivers[0].track;
      line.remoteStream = new MediaStream([receivers[0].track]);
      return line.remoteStream;
    }
    return null;
  }

  /**
   * Returns a MediaStream containing the active call line's outgoing microphone audio track
   * so LiveTranslatorPanel can perform hands-free agent speech translation without extra getUserMedia calls.
   */
  getActiveLocalStream() {
    if (typeof window === "undefined") return null;
    const lineId = this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : Array.from(this.linesMap.values())[0];
    if (!line) return null;

    if (line.origMicTrack && line.origMicTrack.readyState === "live") {
      if (!line.localStream) {
        line.localStream = new MediaStream([line.origMicTrack]);
      }
      return line.localStream;
    }

    const pc = line.session?.sessionDescriptionHandler?.peerConnection;
    if (!pc) return null;
    const senders = pc.getSenders().filter((s) => s.track && s.track.kind === "audio" && s.track.readyState === "live");
    if (senders.length > 0) {
      if (!line.origMicTrack) {
        line.origMicTrack = senders[0].track;
      }
      line.localStream = new MediaStream([senders[0].track]);
      return line.localStream;
    }
    return null;
  }

  /**
   * Lowers or restores the customer's raw audio volume in the agent's headset
   * while Turkish voice translation is being played (Simultaneous Interpreter Ducking).
   */
  setRemoteAudioDucking(ducked = false, duckVolume = 0.2) {
    if (typeof window === "undefined") return;
    const lineId = this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : null;
    if (!line) return;
    const audioEl = this.ensureAudioElement(line.id);
    if (audioEl) {
      audioEl.volume = ducked ? Math.max(0.05, Math.min(1.0, duckVolume)) : 1.0;
    }
  }

  /**
   * Temporarily suppresses outgoing raw microphone audio to the customer while the agent
   * records Turkish speech for translation into target language.
   */
  setRawMicSuppressed(suppressed = false) {
    this.rawMicSuppressed = Boolean(suppressed);
    const lineId = this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : Array.from(this.linesMap.values())[0];
    if (!line) return;
    const pc = line.session?.sessionDescriptionHandler?.peerConnection;
    if (!pc) return;

    const audioSenders = pc.getSenders().filter((s) => s.track && s.track.kind === "audio");
    audioSenders.forEach((sender) => {
      if (sender.track && !line.origMicTrack) {
        line.origMicTrack = sender.track;
      }
    });

    if (this.rawMicSuppressed) {
      if (line.origMicTrack) {
        line.origMicTrack.enabled = !line.isMuted && !line.isOnHold;
      }
      if (!this.silentRtpTrack || this.silentRtpTrack.readyState !== "live") {
        const sStream = this.createSilentFallbackAudioStream();
        this.silentRtpTrack = sStream?.getAudioTracks()?.[0] || null;
      }
      if (this.silentRtpTrack) {
        audioSenders.forEach((s) => s.replaceTrack(this.silentRtpTrack).catch(() => {}));
      }
    } else if (line.origMicTrack) {
      line.origMicTrack.enabled = !line.isMuted && !line.isOnHold;
      audioSenders.forEach((s) => s.replaceTrack(line.origMicTrack).catch(() => {}));
    }
  }

  /**
   * Decodes base64 synthesized speech (e.g. English TTS) and injects it directly into
   * the active WebRTC call's outgoing RTP audio track so the customer on the phone hears it,
   * while also playing a gentle monitor copy for the agent.
   */
  async playAudioIntoActiveCallLine(audioBase64, mimeType = "audio/mpeg", alsoPlayLocalMonitor = true) {
    if (typeof window === "undefined" || !audioBase64) return false;
    const lineId = this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : Array.from(this.linesMap.values())[0];

    // Convert base64 to ArrayBuffer
    const cleanB64 = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
    const binaryStr = window.atob(cleanB64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // If there is no active WebRTC peerConnection (e.g. Demo Mode), play locally only
    const pc = line?.session?.sessionDescriptionHandler?.peerConnection;
    if (!pc) {
      if (alsoPlayLocalMonitor) {
        const audio = new Audio(`data:${mimeType};base64,${cleanB64}`);
        await audio.play().catch(() => {});
      }
      return true;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

      const dest = ctx.createMediaStreamDestination();
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);

      if (alsoPlayLocalMonitor) {
        const monitorGain = ctx.createGain();
        monitorGain.gain.value = 0.55;
        source.connect(monitorGain);
        monitorGain.connect(ctx.destination);
      }

      const ttsTrack = dest.stream.getAudioTracks()[0];
      const audioSenders = pc.getSenders().filter((s) => s.track && s.track.kind === "audio");

      // Save original mic track reference
      audioSenders.forEach((sender) => {
        if (sender.track && !line.origMicTrack && sender.track !== this.silentRtpTrack) {
          line.origMicTrack = sender.track;
        }
      });

      if (ttsTrack && audioSenders.length > 0) {
        await Promise.all(audioSenders.map((s) => s.replaceTrack(ttsTrack).catch(() => {})));
      }

      return await new Promise((resolve) => {
        source.onended = async () => {
          try {
            const restoreTrack =
              this.rawMicSuppressed && this.silentRtpTrack && this.silentRtpTrack.readyState === "live"
                ? this.silentRtpTrack
                : line.origMicTrack;
            if (line.origMicTrack) {
              line.origMicTrack.enabled = !line.isMuted && !line.isOnHold;
            }
            if (restoreTrack) {
              await Promise.all(
                pc
                  .getSenders()
                  .filter((s) => s.track && s.track.kind === "audio")
                  .map((s) => s.replaceTrack(restoreTrack).catch(() => {}))
              );
            }
          } catch (e) {}
          try {
            await ctx.close();
          } catch (e) {}
          resolve(true);
        };
        source.start(0);
      });
    } catch (err) {
      console.error("[WebphoneManager] playAudioIntoActiveCallLine error:", err);
      // Fallback local playback
      if (alsoPlayLocalMonitor) {
        const audio = new Audio(`data:${mimeType};base64,${cleanB64}`);
        await audio.play().catch(() => {});
      }
      return false;
    }
  }

  sendDtmf(digit) {
    const clean = String(digit ?? "").trim();
    if (!clean) return;
    const line =
      (this.state.activeLineId && this.linesMap.get(this.state.activeLineId)) ||
      Array.from(this.linesMap.values()).find((l) => l.callStatus === "InCall");
    if (!line || !line.session) return;

    try {
      const sdh = line.session.sessionDescriptionHandler;
      if (sdh && typeof sdh.sendDtmf === "function") {
        sdh.sendDtmf(clean);
        return;
      }
      const pc = sdh?.peerConnection;
      if (pc) {
        const audioSender = pc.getSenders().find((s) => s.track && s.track.kind === "audio" && s.dtmf);
        if (audioSender && audioSender.dtmf) {
          audioSender.dtmf.insertDTMF(clean, 120, 70);
          return;
        }
      }
      if (typeof line.session.info === "function") {
        line.session.info({
          requestOptions: {
            body: {
              contentDisposition: "render",
              contentType: "application/dtmf-relay",
              content: `Signal=${clean}\r\nDuration=120`
            }
          }
        });
      }
    } catch (e) {
      console.warn("[WebphoneManager] sendDtmf error:", e);
    }
  }
}

export const webphoneManager = new WebphoneManager();
export default webphoneManager;
