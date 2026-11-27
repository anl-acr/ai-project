/**
 * ============================================================================
 * Nornia Mobile Voice SDK (React Native — iOS & Android) — v1.0.0
 * Kurulum:
 *   npm install sip.js@0.20.1 react-native-webrtc
 *
 * Kullanım:
 *   import { NorniaReactNativeSDK } from "./nornia-mobile-sdk";
 *   const phone = new NorniaReactNativeSDK({
 *     serverUrl: "https://pbx.firma.com",
 *     apiKey: "aida_live_...",
 *     extension: "1001"
 *   });
 *   await phone.connect();
 *   await phone.dial("05321234567");
 * ============================================================================
 */
import { UserAgent, Registerer, Inviter, SessionState, RegistererState } from "sip.js";
import { registerGlobals } from "react-native-webrtc";

let _webrtcGlobalsReady = false;

export class NorniaReactNativeSDK {
  constructor({ serverUrl, apiKey, extension, onIncomingCall, onRegistered, onEnded }) {
    this.serverUrl = String(serverUrl || "").replace(/\/+$/, "");
    this.apiKey = String(apiKey || "").trim();
    this.extension = String(extension || "").trim();
    this.onIncomingCall = onIncomingCall;
    this.onRegistered = onRegistered;
    this.onEnded = onEnded;
    this.ua = null;
    this.registerer = null;
    this.session = null;
    this.config = null;
  }

  async connect() {
    if (!_webrtcGlobalsReady) {
      registerGlobals();
      _webrtcGlobalsReady = true;
    }

    const res = await fetch(`${this.serverUrl}/api/v1/sdk/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify({ extension: this.extension, client_type: "react-native" }),
    });
    if (!res.ok) {
      throw new Error(`Nornia SDK oturum hatası (HTTP ${res.status})`);
    }
    this.config = await res.json();

    const uri = UserAgent.makeURI(this.config.sip_uri);
    this.ua = new UserAgent({
      uri,
      contactURI: uri,
      authorizationUsername: this.config.sip_username,
      authorizationPassword: this.config.sip_password,
      displayName: this.config.display_name || this.extension,
      viaHost: this.config.via_host || undefined,
      transportOptions: { server: this.config.wss_url, keepAliveInterval: 25 },
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: { iceServers: this.config.ice_servers || [] },
      },
      delegate: {
        onInvite: (invitation) => {
          this.session = invitation;
          const caller = invitation.remoteIdentity?.uri?.user || "Bilinmiyor";
          invitation.stateChange.addListener((st) => {
            if (st === SessionState.Terminated) {
              this.session = null;
              this.onEnded?.();
            }
          });
          this.onIncomingCall?.({ callerNumber: caller, invitation });
        },
      },
    });

    await this.ua.start();
    this.registerer = new Registerer(this.ua);
    this.registerer.stateChange.addListener((st) => {
      this.onRegistered?.(st === RegistererState.Registered);
    });
    await this.registerer.register();
    return this.config;
  }

  async dial(targetNumber) {
    const clean = String(targetNumber || "").replace(/\s+/g, "");
    const targetUri = UserAgent.makeURI(`sip:${clean}@${this.config.sip_domain}`);
    const inviter = new Inviter(this.ua, targetUri, {
      sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
    });
    this.session = inviter;
    inviter.stateChange.addListener((st) => {
      if (st === SessionState.Terminated) {
        this.session = null;
        this.onEnded?.();
      }
    });
    await inviter.invite();
  }

  async answer() {
    if (!this.session) return;
    await this.session.accept({
      sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
    });
  }

  async hangup() {
    if (!this.session) return;
    if (this.session.state === SessionState.Established) await this.session.bye();
    else if (typeof this.session.cancel === "function") await this.session.cancel();
    else if (typeof this.session.reject === "function") await this.session.reject();
    this.session = null;
  }

  async transfer(targetExtension) {
    if (!this.session) return;
    const uri = UserAgent.makeURI(`sip:${String(targetExtension).trim()}@${this.config.sip_domain}`);
    await this.session.refer(uri);
  }

  async disconnect() {
    await this.hangup();
    await this.registerer?.unregister().catch(() => {});
    await this.ua?.stop().catch(() => {});
  }
}
