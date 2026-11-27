/// ============================================================================
/// Nornia Mobile Voice SDK (Flutter — iOS & Android) — v1.0.0
/// Gereksinimler (pubspec.yaml):
///   http: ^1.2.0
///   sip_ua: ^1.0.0
///
/// Kullanım:
///   final nornia = NorniaMobileSDK(
///     serverUrl: 'https://pbx.firma.com',
///     apiKey: 'aida_live_...',
///     extension: '1001',
///   );
///   await nornia.connect();
///   await nornia.dial('05321234567');
/// ============================================================================

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:sip_ua/sip_ua.dart';

class NorniaSdkSession {
  final String sipUri;
  final String sipUsername;
  final String sipPassword;
  final String sipDomain;
  final String wssUrl;
  final String displayName;
  final List<Map<String, dynamic>> iceServers;

  NorniaSdkSession({
    required this.sipUri,
    required this.sipUsername,
    required this.sipPassword,
    required this.sipDomain,
    required this.wssUrl,
    required this.displayName,
    required this.iceServers,
  });

  factory NorniaSdkSession.fromJson(Map<String, dynamic> j) {
    return NorniaSdkSession(
      sipUri: j['sip_uri'] ?? '',
      sipUsername: j['sip_username'] ?? '',
      sipPassword: j['sip_password'] ?? '',
      sipDomain: j['sip_domain'] ?? '',
      wssUrl: j['wss_url'] ?? '',
      displayName: j['display_name'] ?? '',
      iceServers: List<Map<String, dynamic>>.from(j['ice_servers'] ?? []),
    );
  }
}

class NorniaMobileSDK implements SipUaHelperListener {
  final String serverUrl;
  final String apiKey;
  final String extension;
  final void Function(Call call, String callerNumber)? onIncomingCall;
  final void Function(bool registered)? onRegistrationChanged;
  final void Function(Call call, CallState state)? onCallStateChanged;

  final SIPUAHelper _helper = SIPUAHelper();
  NorniaSdkSession? _session;
  Call? activeCall;

  NorniaMobileSDK({
    required this.serverUrl,
    required this.apiKey,
    required this.extension,
    this.onIncomingCall,
    this.onRegistrationChanged,
    this.onCallStateChanged,
  });

  /// 1. Nornia santralinden tek çağrıda SIP/WSS oturumunu alır ve WebRTC'ye kayıt olur
  Future<void> connect() async {
    final uri = Uri.parse('${serverUrl.replaceAll(RegExp(r"/+$"), "")}/api/v1/sdk/session');
    final resp = await http.post(
      uri,
      headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
      body: jsonEncode({'extension': extension, 'client_type': 'flutter'}),
    );
    if (resp.statusCode != 200) {
      throw Exception('Nornia SDK oturumu alınamadı: HTTP ${resp.statusCode} ${resp.body}');
    }
    _session = NorniaSdkSession.fromJson(jsonDecode(resp.body));

    final settings = UaSettings()
      ..webSocketUrl = _session!.wssUrl
      ..uri = _session!.sipUri
      ..authorizationUser = _session!.sipUsername
      ..password = _session!.sipPassword
      ..displayName = _session!.displayName
      ..userAgent = 'NorniaMobileSDK/1.0 Flutter'
      ..dtmfMode = DtmfMode.RFC2833
      ..iceServers = _session!.iceServers;

    _helper.addSipUaHelperListener(this);
    await _helper.start(settings);
  }

  /// Dış numara veya dahili arar
  Future<void> dial(String targetNumber) async {
    final clean = targetNumber.replaceAll(RegExp(r'\s+'), '');
    await _helper.call(clean, voiceonly: true);
  }

  /// Gelen çağrıyı cevaplar
  void answer() {
    activeCall?.answer(_helper.buildCallOptions(true));
  }

  /// Çağrıyı sonlandırır / reddeder
  void hangup() {
    activeCall?.hangup();
    activeCall = null;
  }

  /// Sessize al / aç
  void mute(bool muted) {
    if (muted) {
      activeCall?.mute(true, false);
    } else {
      activeCall?.unmute(true, false);
    }
  }

  /// DTMF tuşlaması gönderir
  void sendDtmf(String digit) => activeCall?.sendDTMF(digit);

  /// Çağrıyı başka dahiliye aktarır
  void transfer(String targetExtension) => activeCall?.refer(targetExtension);

  /// Bağlantıyı kapatır
  void disconnect() {
    hangup();
    _helper.unregister(true);
    _helper.stop();
  }

  @override
  void registrationStateChanged(RegistrationState state) {
    onRegistrationChanged?.call(state.state == RegistrationStateEnum.REGISTERED);
  }

  @override
  void callStateChanged(Call call, CallState state) {
    activeCall = call;
    if (state.state == CallStateEnum.PROGRESS && call.direction == 'INCOMING') {
      onIncomingCall?.call(call, call.remote_identity ?? 'Bilinmiyor');
    }
    if (state.state == CallStateEnum.ENDED || state.state == CallStateEnum.FAILED) {
      activeCall = null;
    }
    onCallStateChanged?.call(call, state);
  }

  @override
  void transportStateChanged(TransportState state) {}
  @override
  void onNewMessage(SIPMessageRequest msg) {}
  @override
  void onNewNotify(Notify ntf) {}
}
