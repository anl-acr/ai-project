import { playRingtoneSound, stopRingtoneSound } from "./audioHelper";

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
      groupRingingCalls: []
    };

    this.startGlobalDurationLoop();
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
      callDuration: activeLine ? activeLine.callDuration : 0,
      isMuted: activeLine ? activeLine.isMuted : false,
      isOnHold: activeLine ? activeLine.isOnHold : false,
      activeSipCallId: activeLine ? activeLine.sipCallId : null
    };

    this.setState(patch);
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
          duration: payload.duration ?? this.state.callDuration ?? 0
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

  async startUserAgent(config) {
    if (!config?.asteriskWssUrl || !config?.agentExtension) return;
    if (typeof window === "undefined") return;

    await ensureSipLoaded();
    if (!SIP) return;

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

  attachRemoteAudioForLine(line) {
    if (!line || !line.session) return;
    const audioEl = this.ensureAudioElement(line.id);
    const peerConnection = line.session?.sessionDescriptionHandler?.peerConnection;
    if (!peerConnection || !audioEl) return;

    const selectedSpeaker = typeof window !== "undefined" ? localStorage.getItem("selected_speaker") : null;

    // Save original outgoing mic track if not yet stored
    peerConnection.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === "audio" && !line.origMicTrack) {
        line.origMicTrack = sender.track;
      }
    });

    const bindTrack = (track) => {
      if (track && track.kind === "audio") {
        line.remoteTrack = track;
        if (line.boundTrackId === track.id && audioEl.srcObject) {
          audioEl.muted = Boolean(line.isOnHold && !this.state.isConferenceActive);
          if (audioEl.paused) {
            audioEl.play().catch(() => {});
          }
          return;
        }
        line.boundTrackId = track.id;
        const remoteStream = new MediaStream([track]);
        line.remoteStream = remoteStream;
        if (selectedSpeaker && typeof audioEl.setSinkId === "function") {
          audioEl.setSinkId(selectedSpeaker).catch(() => {});
        }
        audioEl.srcObject = remoteStream;
        audioEl.muted = Boolean(line.isOnHold && !this.state.isConferenceActive);
        audioEl.play().catch((e) => console.warn("[WebphoneManager] Audio play warning:", e));
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

    const lineId = `line-${++this.lineCounter}-${Date.now()}`;
    const lineObj = {
      id: lineId,
      lineNumber: this.getNextLineNumber(),
      session: invite,
      remoteNumber: callerNum,
      remoteDisplayName: rawDisplayName && rawDisplayName !== callerNum ? rawDisplayName : "",
      callStatus: "Ringing",
      callDuration: 0,
      establishedAt: null,
      isMuted: false,
      isOnHold: false,
      sipCallId,
      direction: "inbound",
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
        playRingtoneSound(selectedRingtone, ringtoneSpeaker);
        window.dispatchEvent(new CustomEvent("INCOMING_WEBPHONE_CALL", { detail: callerNum }));
      }
    }

    invite.stateChange.addListener((state) => {
      const currentLine = this.linesMap.get(lineId);
      if (!currentLine) return;

      if (state === SIP.SessionState.Established) {
        stopRingtoneSound();
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

        this.logWebrtcCallToBackend("answer", {
          sip_call_id: sipCallId,
          caller: callerNum,
          callee: myExt,
          destination: myExt
        });
      } else if (state === SIP.SessionState.Terminated) {
        stopRingtoneSound();
        const durSec = currentLine.establishedAt
          ? Math.max(0, Math.round((Date.now() - currentLine.establishedAt) / 1000))
          : currentLine.callDuration || 0;

        this.logWebrtcCallToBackend("end", {
          sip_call_id: sipCallId,
          caller: callerNum,
          callee: myExt,
          destination: myExt,
          duration: durSec,
          status: durSec > 0 ? "completed" : "no_answer"
        });

        this.removeLineAudioElement(lineId);
        this.linesMap.delete(lineId);
        this.syncLinesToState();
        this.applyAllLinesAudioState();
      }
    });
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
    const hasCustomMic = Boolean(selectedMic && selectedMic !== "default");

    // 1. Try with preferred microphone (using ideal instead of exact so stale deviceId never crashes)
    if (hasCustomMic) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { ideal: selectedMic },
            echoCancellation: true,
            noiseSuppression: true
          },
          video: false
        });
      } catch (err1) {
        console.warn("[WebphoneManager] Preferred mic failed, clearing stale selected_mic and retrying default:", err1);
        try {
          localStorage.removeItem("selected_mic");
        } catch (e) {}
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
        message: "WebPhone bağlantısı hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin."
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

    let wasEstablished = false;
    let rejectStatusCode = null;

    inviter.stateChange.addListener((state) => {
      const currentLine = this.linesMap.get(lineId);
      if (!currentLine) return;

      if (state === SIP.SessionState.Establishing) {
        this.attachRemoteAudioForLine(currentLine);
      } else if (state === SIP.SessionState.Established) {
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
        const finalDuration = currentLine.establishedAt
          ? Math.max(0, Math.round((Date.now() - currentLine.establishedAt) / 1000))
          : currentLine.callDuration || 0;

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
    const lineId = targetLineId || this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : null;

    if (!line) {
      this.syncLinesToState();
      return;
    }

    const remoteNum = line.remoteNumber || "Bilinmeyen";
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
    const lineId = this.state.activeLineId;
    const line = lineId ? this.linesMap.get(lineId) : null;
    if (!line) return;
    const pc = line.session?.sessionDescriptionHandler?.peerConnection;
    if (!pc) return;
    const shouldEnable = !suppressed && !line.isMuted && !line.isOnHold;
    pc.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === "audio") {
        sender.track.enabled = shouldEnable;
      }
    });
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
        if (sender.track && !line.origMicTrack) {
          line.origMicTrack = sender.track;
        }
      });

      if (ttsTrack && audioSenders.length > 0) {
        await Promise.all(audioSenders.map((s) => s.replaceTrack(ttsTrack).catch(() => {})));
      }

      return await new Promise((resolve) => {
        source.onended = async () => {
          try {
            if (line.origMicTrack) {
              line.origMicTrack.enabled = !line.isMuted && !line.isOnHold;
              await Promise.all(
                pc
                  .getSenders()
                  .filter((s) => s.track && s.track.kind === "audio")
                  .map((s) => s.replaceTrack(line.origMicTrack).catch(() => {}))
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
}

export const webphoneManager = new WebphoneManager();
export default webphoneManager;
