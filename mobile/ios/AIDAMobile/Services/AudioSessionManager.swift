import Foundation
import Darwin
import AVFoundation
import UserNotifications
import PushKit
import CallKit
import MediaPlayer
import UIKit

final class AudioSessionManager: NSObject, UNUserNotificationCenterDelegate, PKPushRegistryDelegate, CXProviderDelegate {
    static let shared = AudioSessionManager()

    var onNotificationActionDispatch: ((String, Any?) -> Void)?

    private var ringtonePlayer: AVAudioPlayer?
    private var ringtoneHapticTimer: DispatchSourceTimer?
    private var silentKeepAlivePlayer: AVAudioPlayer?
    private var backgroundKeepAliveTimer: DispatchSourceTimer?
    private var simulatorVoipPushTimer: DispatchSourceTimer?
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    private var voipRegistry: PKPushRegistry?
    private var callKitProvider: CXProvider?
    private let callController = CXCallController()
    private(set) var activeCallUUID: UUID?
    private(set) var isSystemCallKitPresenting: Bool = false
    private var isPerformingCallKitAction: Bool = false
    private var activeIncomingNotificationId: String?

    private(set) var voipPushTokenHex: String = ""
    private(set) var apnsPushTokenHex: String = ""
    private var isCallCurrentlyActive: Bool = false
    private var currentCallStatus: String = "Idle"
    private var hasUserAnsweredCurrentCall: Bool = false
    private var currentMutedState: Bool = false
    private var currentHoldState: Bool = false
    private var currentSpeakerState: Bool = false
    private var isDeviceCurrentlyLocked: Bool = false
    private var lastDeviceUnlockedAt: Date = .distantPast
    private var ringLockButtonPressCount: Int = 0
    private var notifiedIds = Set<String>()
    private var callDurationTimer: DispatchSourceTimer?
    private var callAnsweredAt: Date?

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
        setupNotificationCategories()
        setupCallKitProvider()
        disableLockScreenMediaPlayerWidget()
        setupAudioInterruptionObserver()
        setupAppLifecycleObservers()
        #if targetEnvironment(simulator)
        setupSimulatorVoipPushWatcher()
        #endif
    }

    #if targetEnvironment(simulator)
    private func setupSimulatorVoipPushWatcher() {
        checkSimulatorVoipPushFiles()
        guard simulatorVoipPushTimer == nil else { return }
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + 0.15, repeating: 0.20)
        timer.setEventHandler { [weak self] in
            self?.checkSimulatorVoipPushFiles()
        }
        timer.resume()
        simulatorVoipPushTimer = timer
    }

    private func checkSimulatorVoipPushFiles() {
        let fm = FileManager.default
        if fm.fileExists(atPath: "/tmp/aida_sim_test_ring.json"),
           let data = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/aida_sim_test_ring.json")),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            try? fm.removeItem(atPath: "/tmp/aida_sim_test_ring.json")
            try? fm.removeItem(atPath: "/tmp/aida_sim_cancel_ring.json")
            if let ts = json["timestamp"] as? Double, Date().timeIntervalSince1970 - ts > 35.0 {
                return
            }
            if currentCallStatus == "InCall" || hasUserAnsweredCurrentCall {
                return
            }
            let caller = (json["caller"] as? String) ?? "905071796372"
            let callerName = (json["callerName"] as? String) ?? caller
            let callId = (json["callId"] as? String) ?? "sim-voip-push"
            let pickupExten = (json["pickupExten"] as? String) ?? "1000"
            let isCold = (json["coldLaunch"] as? Bool) ?? false
            let wasLocked = json["wasLocked"] as? Bool
            Task { @MainActor in
                if isCold {
                    AppConfigStore.shared.coldLaunchPickupExten = pickupExten
                    if wasLocked == false {
                        AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode = true
                    }
                } else if UIApplication.shared.applicationState != .active && wasLocked == false {
                    AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode = true
                }
                AppConfigStore.shared.coldLaunchCallerNumber = caller
                AppConfigStore.shared.coldLaunchCallerName = callerName
                for delay in [0.6, 1.5, 2.8] {
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                        self?.onNotificationActionDispatch?("SWITCH_AGENT_PANEL_SUBTAB", ["subTab": "webphone"])
                    }
                }
            }
            if currentCallStatus != "InCall" && !hasUserAnsweredCurrentCall {
                handleIncomingSipInvite(
                    caller: caller,
                    callerName: callerName,
                    callId: callId,
                    wasLocked: wasLocked
                )
            }
            return
        }
        if fm.fileExists(atPath: "/tmp/aida_sim_lock_btn_press.json"),
           let data = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/aida_sim_lock_btn_press.json")),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            try? fm.removeItem(atPath: "/tmp/aida_sim_lock_btn_press.json")
            let pressCount = (json["pressCount"] as? Int) ?? 1
            if currentCallStatus == "Ringing" {
                if pressCount == 1 {
                    stopNativeRingtone()
                } else if pressCount >= 2 {
                    performCallKitEndCall()
                }
            }
        }
        if fm.fileExists(atPath: "/tmp/aida_sim_ui_action.json"),
           let data = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/aida_sim_ui_action.json")),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            try? fm.removeItem(atPath: "/tmp/aida_sim_ui_action.json")
            self.onNotificationActionDispatch?("AIDA_SIM_UI_ACTION", json)
        }
        if fm.fileExists(atPath: "/tmp/aida_sim_cancel_ring.json") {
            let cancelData = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/aida_sim_cancel_ring.json"))
            let cancelJson = cancelData.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            try? fm.removeItem(atPath: "/tmp/aida_sim_cancel_ring.json")
            if let ts = cancelJson?["timestamp"] as? Double, Date().timeIntervalSince1970 - ts > 15.0 {
                return
            }
            if currentCallStatus == "Ringing" {
                Task { @MainActor in
                    guard AppConfigStore.shared.liveState.callStatus == "Ringing" else { return }
                    AppConfigStore.shared.lastIncomingRingStartedAt = .distantPast
                    AppConfigStore.shared.coldLaunchPickupExten = ""
                    AppConfigStore.shared.liveState.callStatus = "Idle"
                    self.updateCallActivityState(callStatus: "Idle")
                }
            }
        }
    }
    #endif

    func disableLockScreenMediaPlayerWidget() {
        DispatchQueue.main.async {
            UIApplication.shared.endReceivingRemoteControlEvents()
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            let cc = MPRemoteCommandCenter.shared()
            cc.playCommand.isEnabled = false
            cc.pauseCommand.isEnabled = false
            cc.togglePlayPauseCommand.isEnabled = false
            cc.stopCommand.isEnabled = false
            cc.nextTrackCommand.isEnabled = false
            cc.previousTrackCommand.isEnabled = false
            cc.changePlaybackPositionCommand.isEnabled = false
            cc.skipForwardCommand.isEnabled = false
            cc.skipBackwardCommand.isEnabled = false
        }
    }

    func bringAppToFrontOverLockScreenForIncomingCall() {
        DispatchQueue.main.async {
            #if targetEnvironment(simulator)
            Self.wakeSimulatorLockScreenOnHost()
            #endif
        }
    }

    #if targetEnvironment(simulator)
    private static func wakeSimulatorLockScreenOnHost() {
        try? "1".write(toFile: "/tmp/aida_sim_wake_lockscreen", atomically: true, encoding: .utf8)
    }
    #endif

    private func setupNotificationCategories() {
        let answerAction = UNNotificationAction(
            identifier: "AIDA_ANSWER_CALL",
            title: "Yanıtla",
            options: [.foreground]
        )
        let declineAction = UNNotificationAction(
            identifier: "AIDA_DECLINE_CALL",
            title: "Reddet",
            options: [.destructive, .foreground]
        )
        let callCategory = UNNotificationCategory(
            identifier: "AIDA_INCOMING_CALL",
            actions: [answerAction, declineAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        UNUserNotificationCenter.current().setNotificationCategories([callCategory])
    }

    func requestPermissionsAndActivateAudio() {
        // 1. Standard & Push Notifications
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }

        // 2. Register PushKit VoIP Push Registry (wakes app on incoming calls with 0 background battery drain)
        setupVoIPPushRegistry()

        // 3. Microphone permission
        AVAudioSession.sharedInstance().requestRecordPermission { _ in }

        // 4. Configure AVAudioSession while app is in foreground
        configureVoIPAudioSession()
    }

    // MARK: - PushKit (VoIP Push) & CallKit Setup

    private func setupVoIPPushRegistry() {
        guard voipRegistry == nil else { return }
        let registry = PKPushRegistry(queue: .main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        self.voipRegistry = registry
    }

    private func setupCallKitProvider() {
        #if targetEnvironment(simulator)
        // iOS Simulator does not host Apple's InCallService.app and callservicesd resets CXProvider
        // asynchronously right after init, which would otherwise trigger providerDidReset on cold launch.
        self.callKitProvider = nil
        #else
        let config = CXProviderConfiguration(localizedName: "Runa")
        config.supportsVideo = false
        config.maximumCallsPerCallGroup = 1
        config.maximumCallGroups = 1
        config.includesCallsInRecents = true
        config.supportedHandleTypes = [.phoneNumber, .generic]
        let provider = CXProvider(configuration: config)
        provider.setDelegate(self, queue: .main)
        self.callKitProvider = provider
        #endif
    }

    func didRegisterForRemoteNotifications(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        self.apnsPushTokenHex = hex
        syncPushTokensToBackend()
    }

    // PKPushRegistryDelegate
    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        let hex = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        self.voipPushTokenHex = hex
        syncPushTokensToBackend()
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else {
            completion()
            return
        }

        let dict = payload.dictionaryPayload
        let callerNumber = (dict["caller_number"] as? String) ?? (dict["caller"] as? String) ?? "Gelen Çağrı"
        let callerName = (dict["caller_name"] as? String) ?? callerNumber
        let callId = (dict["call_id"] as? String) ?? "voip-push-\(Int(Date().timeIntervalSince1970))"

        // Wake up WebRTC SIP connection immediately so it receives the SIP INVITE from Asterisk
        DispatchQueue.main.async { [weak self] in
            self?.onNotificationActionDispatch?("AIDA_IOS_WAKE_SIP", ["caller": callerNumber])
            self?.onNotificationActionDispatch?("SWITCH_AGENT_PANEL_SUBTAB", ["subTab": "webphone"])
        }

        handleIncomingSipInvite(caller: callerNumber, callerName: callerName, callId: callId, pushCompletion: completion)
    }

    // MARK: - CXProviderDelegate (2-Way Native iOS CallKit Integration)

    func providerDidReset(_ provider: CXProvider) {
        #if targetEnvironment(simulator)
        return
        #else
        if Date().timeIntervalSince(AppConfigStore.shared.lastIncomingRingStartedAt) < 35.0 {
            return
        }
        stopNativeRingtone()
        activeCallUUID = nil
        isSystemCallKitPresenting = false
        isCallCurrentlyActive = false
        currentCallStatus = "Idle"
        hasUserAnsweredCurrentCall = false
        currentMutedState = false
        currentHoldState = false
        currentSpeakerState = false
        Task { @MainActor in
            AppConfigStore.shared.liveState.callStatus = "Idle"
            AppConfigStore.shared.liveState.isSystemCallKitActive = false
            AppConfigStore.shared.liveState.isCallKitUIPresented = false
            AppConfigStore.shared.liveState.isMuted = false
            AppConfigStore.shared.liveState.isOnHold = false
            AppConfigStore.shared.liveState.isSpeakerOn = false
            AppConfigStore.shared.liveState.callDurationSeconds = 0
        }
        #endif
    }

    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        configureCallKitActiveAudioSession()
        callKitProvider?.reportOutgoingCall(with: action.callUUID, startedConnectingAt: Date())
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        performCallKitAnswer(fromSystemCallKit: true)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        performCallKitEndCall(fromSystemCallKit: true)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        performCallKitSetMuted(action.isMuted, fromSystemCallKit: true)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        performCallKitSetHeld(action.isOnHold, fromSystemCallKit: true)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXPlayDTMFCallAction) {
        performCallKitPlayDTMF(action.digits)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        configureCallKitActiveAudioSession()
        onNotificationActionDispatch?("AIDA_CALLKIT_AUDIO_ACTIVATED", nil)
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        if !isCallCurrentlyActive && UIApplication.shared.applicationState != .active {
            startSilentBackgroundKeepAlive()
        }
    }

    // MARK: - Unified CallKit Action Methods (Used by Native CXProvider & Simulator CallKit Screen)

    func performCallKitAnswer(fromSystemCallKit: Bool = false) {
        stopNativeRingtone()
        stopNativeCallDurationTimer()
        #if targetEnvironment(simulator)
        try? FileManager.default.removeItem(atPath: "/tmp/aida_sim_test_ring.json")
        #endif
        if let notifId = activeIncomingNotificationId {
            closeNativeNotification(id: notifId)
            activeIncomingNotificationId = nil
        }
        if currentCallStatus != "InCall" {
            currentCallStatus = "Calling"
        }
        hasUserAnsweredCurrentCall = true
        isCallCurrentlyActive = true
        configureCallKitActiveAudioSession()

        Task { @MainActor in
            let store = AppConfigStore.shared
            // Preserve ring guard timestamp during cold launch so premature "Idle" updates from
            // the booting WKWebView do not cancel the call before **1000 pickup connects!
            store.lastIncomingRingStartedAt = Date()
            store.hasUserAnsweredCurrentCall = true
            if store.liveState.callStatus != "InCall" {
                store.liveState.callDurationSeconds = 0
                store.liveState.callStatus = "Calling"
            }
            if !fromSystemCallKit && !store.liveState.isSystemCallKitActive {
                store.liveState.isCallKitUIPresented = true
            }
            let pickupExt = store.coldLaunchPickupExten
            let cNum = store.coldLaunchCallerNumber.isEmpty ? store.liveState.incomingCallerNumber : store.coldLaunchCallerNumber
            let cName = store.coldLaunchCallerName.isEmpty ? store.liveState.incomingCallerName : store.coldLaunchCallerName
            if cName.isEmpty || cName == cNum {
                self.resolveCallerContactNameFromBackend(callerNumber: cNum)
            }
            let answerPayload: [String: Any] = [
                "answer": true,
                "pickupExten": pickupExt,
                "callerNumber": cNum,
                "callerName": cName
            ]
            self.onNotificationActionDispatch?("SWITCH_AGENT_PANEL_SUBTAB", ["subTab": "webphone"])
            self.onNotificationActionDispatch?("AIDA_CALLKIT_ANSWER", answerPayload)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { [weak self] in
                self?.onNotificationActionDispatch?("AIDA_CALLKIT_AUDIO_ACTIVATED", nil)
            }
            if !pickupExt.isEmpty {
                for delay in [0.5, 1.2, 2.0, 3.0, 4.2, 5.5, 7.0, 9.0, 11.5] {
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                        guard let self = self,
                              self.currentCallStatus == "Calling" || self.currentCallStatus == "InCall" else { return }
                        self.onNotificationActionDispatch?("AIDA_CALLKIT_ANSWER", answerPayload)
                    }
                }
            }
        }
    }

    func performCallKitEndCall(fromSystemCallKit: Bool = false) {
        stopNativeRingtone()
        stopNativeCallDurationTimer()
        #if targetEnvironment(simulator)
        try? "1".write(toFile: "/tmp/aida_sim_reject_call", atomically: true, encoding: .utf8)
        try? FileManager.default.removeItem(atPath: "/tmp/aida_sim_test_ring.json")
        #endif
        if let notifId = activeIncomingNotificationId {
            closeNativeNotification(id: notifId)
            activeIncomingNotificationId = nil
        }

        if !fromSystemCallKit, let uuid = activeCallUUID {
            let endAction = CXEndCallAction(call: uuid)
            let tx = CXTransaction(action: endAction)
            callController.request(tx) { _ in }
        }

        activeCallUUID = nil
        isSystemCallKitPresenting = false
        isCallCurrentlyActive = false
        currentCallStatus = "Idle"
        hasUserAnsweredCurrentCall = false
        currentMutedState = false
        currentHoldState = false
        currentSpeakerState = false

        Task { @MainActor in
            let wasBackgroundIsland = AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode
            AppConfigStore.shared.lastIncomingRingStartedAt = .distantPast
            AppConfigStore.shared.hasUserAnsweredCurrentCall = false
            AppConfigStore.shared.coldLaunchPickupExten = ""
            AppConfigStore.shared.liveState.callStatus = "Idle"
            AppConfigStore.shared.liveState.isSystemCallKitActive = false
            AppConfigStore.shared.liveState.isCallKitUIPresented = false
            AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode = false
            AppConfigStore.shared.liveState.isMuted = false
            AppConfigStore.shared.liveState.isOnHold = false
            AppConfigStore.shared.liveState.isSpeakerOn = false
            AppConfigStore.shared.liveState.callDurationSeconds = 0
            #if targetEnvironment(simulator)
            if wasBackgroundIsland {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    UIControl().sendAction(#selector(URLSessionTask.suspend), to: UIApplication.shared, for: nil)
                }
            }
            #endif
        }

        onNotificationActionDispatch?("AIDA_CALLKIT_HANGUP", nil)
        onNotificationActionDispatch?("AIDA_IOS_HANGUP_CALL", nil)

        if UIApplication.shared.applicationState != .active {
            startSilentBackgroundKeepAlive()
        }
    }

    func performCallKitSetMuted(_ muted: Bool, fromSystemCallKit: Bool = false) {
        isPerformingCallKitAction = true
        currentMutedState = muted
        Task { @MainActor in
            AppConfigStore.shared.liveState.isMuted = muted
        }
        if !fromSystemCallKit, let uuid = activeCallUUID, isSystemCallKitPresenting {
            let muteAction = CXSetMutedCallAction(call: uuid, muted: muted)
            callController.request(CXTransaction(action: muteAction)) { _ in }
        }
        onNotificationActionDispatch?("AIDA_CALLKIT_MUTE", ["muted": muted])
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.isPerformingCallKitAction = false
        }
    }

    func performCallKitSetHeld(_ onHold: Bool, fromSystemCallKit: Bool = false) {
        isPerformingCallKitAction = true
        currentHoldState = onHold
        Task { @MainActor in
            AppConfigStore.shared.liveState.isOnHold = onHold
        }
        if !fromSystemCallKit, let uuid = activeCallUUID, isSystemCallKitPresenting {
            let holdAction = CXSetHeldCallAction(call: uuid, onHold: onHold)
            callController.request(CXTransaction(action: holdAction)) { _ in }
        }
        onNotificationActionDispatch?("AIDA_CALLKIT_HOLD", ["onHold": onHold])
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.isPerformingCallKitAction = false
        }
    }

    func performCallKitPlayDTMF(_ digits: String) {
        let clean = digits.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        triggerLightHaptic()
        onNotificationActionDispatch?("AIDA_CALLKIT_DTMF", ["digits": clean])
    }

    func performCallKitToggleSpeaker(_ speakerOn: Bool) {
        currentSpeakerState = speakerOn
        Task { @MainActor in
            AppConfigStore.shared.liveState.isSpeakerOn = speakerOn
        }
        triggerLightHaptic()
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetoothHFP, .allowBluetoothA2DP]
            )
            try audioSession.overrideOutputAudioPort(speakerOn ? .speaker : .none)
            try audioSession.setActive(true)
        } catch {
            print("[AIDA AudioSession] Speaker toggle warning:", error.localizedDescription)
        }
    }

    func updateCallKitTelemetry(
        callStatus: String,
        isMuted: Bool,
        isOnHold: Bool,
        callDuration: Int,
        remoteNumber: String,
        remoteDisplayName: String
    ) {
        Task { @MainActor in
            let store = AppConfigStore.shared
            let withinIncomingRingGuard = (
                callStatus == "Idle" &&
                (store.liveState.callStatus == "Ringing" || !store.coldLaunchPickupExten.isEmpty || store.hasUserAnsweredCurrentCall) &&
                Date().timeIntervalSince(store.lastIncomingRingStartedAt) < 35.0
            )
            if withinIncomingRingGuard {
                return
            }

            if callStatus == "InCall" {
                store.coldLaunchPickupExten = ""
                store.lastIncomingRingStartedAt = .distantPast
            }

            let isPickupCode = remoteNumber.hasPrefix("**") || remoteNumber.hasPrefix("*8")
            if !remoteNumber.isEmpty && !isPickupCode && remoteNumber != store.liveState.incomingCallerNumber {
                store.liveState.incomingCallerNumber = remoteNumber
            }
            if !remoteDisplayName.isEmpty && !remoteDisplayName.hasPrefix("**") && !remoteDisplayName.hasPrefix("Pickup:") && remoteDisplayName != store.liveState.incomingCallerName {
                store.liveState.incomingCallerName = remoteDisplayName
                if let uuid = self.activeCallUUID {
                    let update = CXCallUpdate()
                    let numPart = store.liveState.incomingCallerNumber
                    update.localizedCallerName = (numPart.isEmpty || numPart == remoteDisplayName)
                        ? remoteDisplayName
                        : "\(remoteDisplayName) (\(numPart))"
                    self.callKitProvider?.reportCall(with: uuid, updated: update)
                }
            }

            if callStatus == "InCall" {
                if callDuration > store.liveState.callDurationSeconds {
                    store.liveState.callDurationSeconds = callDuration
                }
            } else {
                store.liveState.callDurationSeconds = 0
            }

            if !self.isPerformingCallKitAction {
                if store.liveState.isMuted != isMuted {
                    store.liveState.isMuted = isMuted
                    self.currentMutedState = isMuted
                    if let uuid = self.activeCallUUID, self.isSystemCallKitPresenting {
                        let action = CXSetMutedCallAction(call: uuid, muted: isMuted)
                        self.callController.request(CXTransaction(action: action)) { _ in }
                    }
                }
                if store.liveState.isOnHold != isOnHold {
                    store.liveState.isOnHold = isOnHold
                    self.currentHoldState = isOnHold
                    if let uuid = self.activeCallUUID, self.isSystemCallKitPresenting {
                        let action = CXSetHeldCallAction(call: uuid, onHold: isOnHold)
                        self.callController.request(CXTransaction(action: action)) { _ in }
                    }
                }
            }

            let effectiveStatus: String
            if callStatus == "InCall" || store.liveState.callStatus == "InCall" {
                effectiveStatus = (callStatus == "Idle") ? "Idle" : "InCall"
            } else if callStatus == "Ringing" && store.hasUserAnsweredCurrentCall {
                effectiveStatus = "Calling"
            } else {
                effectiveStatus = callStatus
            }

            if store.liveState.callStatus != effectiveStatus {
                if effectiveStatus != "Ringing" && store.coldLaunchPickupExten.isEmpty && !store.hasUserAnsweredCurrentCall {
                    store.lastIncomingRingStartedAt = .distantPast
                }
                store.liveState.callStatus = effectiveStatus
                self.updateCallActivityState(callStatus: effectiveStatus)
            }
        }
    }

    func syncPushTokensToBackend() {
        Task { @MainActor in
            let store = AppConfigStore.shared
            guard let session = store.session else { return }
            let apiOrigin = store.apiOrigin.replacingOccurrences(of: "\\/+$", with: "", options: .regularExpression)
            let ext = session.extensionNumber.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !apiOrigin.isEmpty, !ext.isEmpty else { return }
            guard !voipPushTokenHex.isEmpty || !apnsPushTokenHex.isEmpty else { return }

            guard let url = URL(string: "\(apiOrigin)/api/webrtc/register_notify?extension=\(ext)") else { return }
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue(session.userId, forHTTPHeaderField: "X-User-ID")
            req.setValue(ext, forHTTPHeaderField: "X-User-Extension")
            req.setValue(session.tenantId.isEmpty ? "tenant-default" : session.tenantId, forHTTPHeaderField: "X-Tenant-ID")

            let body: [String: Any] = [
                "extension": ext,
                "user_id": session.userId,
                "platform": "ios",
                "voip_token": voipPushTokenHex,
                "apns_token": apnsPushTokenHex
            ]
            req.httpBody = try? JSONSerialization.data(withJSONObject: body, options: [])
            URLSession.shared.dataTask(with: req) { _, _, _ in }.resume()
        }
    }

    // MARK: - Battery-Smart Audio Session Lifecycle & Background SIP KeepAlive

    func startNativeCallDurationTimer() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.callAnsweredAt == nil {
                self.callAnsweredAt = Date()
            }
            guard self.callDurationTimer == nil else { return }
            let timer = DispatchSource.makeTimerSource(queue: .main)
            timer.schedule(deadline: .now() + 1.0, repeating: 1.0)
            timer.setEventHandler { [weak self] in
                guard let self = self else { return }
                guard self.currentCallStatus == "InCall" else {
                    self.stopNativeCallDurationTimer()
                    return
                }
                guard let start = self.callAnsweredAt else { return }
                let elapsed = max(1, Int(Date().timeIntervalSince(start)))
                Task { @MainActor in
                    let store = AppConfigStore.shared
                    if elapsed > store.liveState.callDurationSeconds {
                        store.liveState.callDurationSeconds = elapsed
                    }
                }
            }
            timer.resume()
            self.callDurationTimer = timer
        }
    }

    func stopNativeCallDurationTimer() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.callDurationTimer?.cancel()
            self.callDurationTimer = nil
            self.callAnsweredAt = nil
        }
    }

    func resolveCallerContactNameFromBackend(callerNumber: String) {
        let digitsOnly = callerNumber.filter { $0.isNumber }
        guard digitsOnly.count >= 7 else { return }
        let suffix10 = String(digitsOnly.suffix(10))

        Task { @MainActor in
            let store = AppConfigStore.shared
            var baseOrigin = store.apiOrigin.replacingOccurrences(of: "\\/+$", with: "", options: .regularExpression)
            if baseOrigin.isEmpty {
                baseOrigin = "https://aida.saphira.com.tr"
            }
            guard let url = URL(string: "\(baseOrigin)/api/contacts") else { return }
            var req = URLRequest(url: url)
            req.httpMethod = "GET"
            req.timeoutInterval = 5.0
            if let s = store.session {
                req.setValue(s.userId, forHTTPHeaderField: "X-User-ID")
                req.setValue(s.extensionNumber, forHTTPHeaderField: "X-User-Extension")
                req.setValue(s.tenantId.isEmpty ? "tenant-default" : s.tenantId, forHTTPHeaderField: "X-Tenant-ID")
            }

            URLSession.shared.dataTask(with: req) { [weak self] data, _, _ in
                guard let data = data,
                      let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                    return
                }
                for item in arr {
                    let phoneRaw = (item["phone_number"] as? String) ?? (item["phone"] as? String) ?? ""
                    let phoneDigits = phoneRaw.filter { $0.isNumber }
                    guard !phoneDigits.isEmpty else { continue }
                    let phoneSuffix10 = String(phoneDigits.suffix(10))
                    if phoneSuffix10 == suffix10 || phoneDigits == digitsOnly {
                        let first = (item["first_name"] as? String) ?? ""
                        let last = (item["last_name"] as? String) ?? ""
                        let full = "\(first) \(last)".trimmingCharacters(in: .whitespacesAndNewlines)
                        let fallbackName = (item["name"] as? String) ?? ""
                        let matchedName = !full.isEmpty ? full : fallbackName
                        guard !matchedName.isEmpty else { continue }

                        Task { @MainActor in
                            let st = AppConfigStore.shared
                            st.coldLaunchCallerName = matchedName
                            st.liveState.incomingCallerName = matchedName
                            if let uuid = self?.activeCallUUID {
                                let update = CXCallUpdate()
                                update.localizedCallerName = "\(matchedName) (\(callerNumber))"
                                self?.callKitProvider?.reportCall(with: uuid, updated: update)
                            }
                        }
                        break
                    }
                }
            }.resume()
        }
    }

    func updateCallActivityState(callStatus: String) {
        currentCallStatus = callStatus
        let active = (callStatus == "Ringing" || callStatus == "Calling" || callStatus == "InCall")
        isCallCurrentlyActive = active
        if callStatus == "Ringing" {
            if !isSystemCallKitPresenting {
                startNativeRingtone()
            }
        } else {
            stopNativeRingtone()
            if callStatus == "InCall" {
                startNativeCallDurationTimer()
                if let notifId = activeIncomingNotificationId {
                    closeNativeNotification(id: notifId)
                    activeIncomingNotificationId = nil
                }
            } else if !active {
                stopNativeCallDurationTimer()
                activeIncomingNotificationId = nil
            }
        }
        if !active {
            if let uuid = activeCallUUID {
                callKitProvider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
                let endAction = CXEndCallAction(call: uuid)
                let tx = CXTransaction(action: endAction)
                callController.request(tx) { _ in }
                activeCallUUID = nil
            }
            isSystemCallKitPresenting = false
            hasUserAnsweredCurrentCall = false
            currentMutedState = false
            currentHoldState = false
            currentSpeakerState = false
            Task { @MainActor in
                let wasBackgroundIsland = AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode
                AppConfigStore.shared.hasUserAnsweredCurrentCall = false
                AppConfigStore.shared.liveState.isSystemCallKitActive = false
                AppConfigStore.shared.liveState.isCallKitUIPresented = false
                AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode = false
                AppConfigStore.shared.liveState.isMuted = false
                AppConfigStore.shared.liveState.isOnHold = false
                AppConfigStore.shared.liveState.isSpeakerOn = false
                AppConfigStore.shared.liveState.callDurationSeconds = 0
                #if targetEnvironment(simulator)
                if wasBackgroundIsland {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        UIControl().sendAction(#selector(URLSessionTask.suspend), to: UIApplication.shared, for: nil)
                    }
                }
                #endif
            }
        }
        if !active && UIApplication.shared.applicationState != .active {
            startSilentBackgroundKeepAlive()
        }
    }

    func handleIncomingSipInvite(
        caller: String,
        callerName: String,
        callId: String,
        wasLocked: Bool? = nil,
        pushCompletion: (() -> Void)? = nil
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                pushCompletion?()
                return
            }
            if self.currentCallStatus == "InCall" || self.hasUserAnsweredCurrentCall {
                self.stopNativeRingtone()
                Task { @MainActor in
                    let store = AppConfigStore.shared
                    store.liveState.callStatus = "InCall"
                    let answerPayload: [String: Any] = [
                        "answer": true,
                        "pickupExten": store.coldLaunchPickupExten,
                        "callerNumber": caller.isEmpty ? store.liveState.incomingCallerNumber : caller,
                        "callerName": callerName.isEmpty ? store.liveState.incomingCallerName : callerName
                    ]
                    self.onNotificationActionDispatch?("AIDA_CALLKIT_ANSWER", answerPayload)
                }
                pushCompletion?()
                return
            }
            self.stopSilentBackgroundKeepAlive()
            self.disableLockScreenMediaPlayerWidget()
            self.currentCallStatus = "Ringing"
            self.isCallCurrentlyActive = true
            self.ringLockButtonPressCount = 0

            var resolvedWasLocked: Bool = self.isDeviceCurrentlyLocked || (Date().timeIntervalSince(self.lastDeviceUnlockedAt) < 2.2)
            if let explicitLock = wasLocked {
                resolvedWasLocked = explicitLock
            } else {
                #if targetEnvironment(simulator)
                if let lockFlag = try? String(contentsOfFile: "/tmp/aida_sim_was_locked_on_invite", encoding: .utf8)
                    .trimmingCharacters(in: .whitespacesAndNewlines) {
                    if lockFlag == "1" {
                        resolvedWasLocked = true
                    } else if lockFlag == "0" {
                        resolvedWasLocked = false
                    }
                }
                #endif
            }
            if UIApplication.shared.applicationState == .active && !self.isDeviceCurrentlyLocked && wasLocked == nil {
                resolvedWasLocked = false
            }

            let cleanCaller = caller.isEmpty ? "Gelen Çağrı" : caller
            let resolvedDisplayName = callerName.isEmpty ? cleanCaller : callerName
            let cleanName = (callerName.isEmpty || callerName == caller) ? cleanCaller : "\(callerName) (\(cleanCaller))"
            if callerName.isEmpty || callerName == caller {
                self.resolveCallerContactNameFromBackend(callerNumber: cleanCaller)
            }

            Task { @MainActor in
                let isColdOrBackground = (UIApplication.shared.applicationState != .active) || !AppConfigStore.shared.coldLaunchPickupExten.isEmpty || AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode
                AppConfigStore.shared.lastIncomingRingStartedAt = Date()
                if !cleanCaller.isEmpty && (AppConfigStore.shared.liveState.incomingCallerNumber.isEmpty || cleanCaller != "Gelen Çağrı") {
                    AppConfigStore.shared.liveState.incomingCallerNumber = cleanCaller
                }
                if !resolvedDisplayName.isEmpty && (AppConfigStore.shared.liveState.incomingCallerName.isEmpty || AppConfigStore.shared.liveState.incomingCallerName == AppConfigStore.shared.liveState.incomingCallerNumber || resolvedDisplayName != cleanCaller) {
                    AppConfigStore.shared.liveState.incomingCallerName = resolvedDisplayName
                }
                AppConfigStore.shared.liveState.incomingCallWasLocked = resolvedWasLocked
                if resolvedWasLocked {
                    AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode = false
                    if !self.isSystemCallKitPresenting {
                        AppConfigStore.shared.liveState.isCallKitUIPresented = true
                    }
                } else if isColdOrBackground {
                    AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode = true
                    if !self.isSystemCallKitPresenting {
                        AppConfigStore.shared.liveState.isCallKitUIPresented = true
                    }
                } else {
                    // App is already open & visible in the foreground on an unlocked screen:
                    // Let the in-app WebPhone Incoming Call UI handle it directly without covering it with Lock Screen CallKit!
                    AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode = false
                    AppConfigStore.shared.liveState.isCallKitUIPresented = false
                }
                AppConfigStore.shared.liveState.callStatus = "Ringing"
                AppConfigStore.shared.liveState.callDurationSeconds = 0
                AppConfigStore.shared.liveState.isMuted = false
                AppConfigStore.shared.liveState.isOnHold = false
            }

            let notifId = "call-invite-\(callId.isEmpty ? String(Int(Date().timeIntervalSince1970)) : callId)"
            self.activeIncomingNotificationId = notifId

            // Prepare VoIP audio session category for CallKit
            self.prepareAudioSessionForCallKit()

            #if targetEnvironment(simulator)
            // iOS Simulator does not include Apple's InCallService.app host UI, even when CXProvider
            // returns error == nil after ~0.8s. Keep our native CallKit experience view & ringtone active!
            self.activeCallUUID = nil
            self.isSystemCallKitPresenting = false
            Task { @MainActor in
                let isColdOrBackground = (UIApplication.shared.applicationState != .active) || !AppConfigStore.shared.coldLaunchPickupExten.isEmpty || AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode
                let shouldPresentSystemOverlay = resolvedWasLocked || isColdOrBackground
                AppConfigStore.shared.lastIncomingRingStartedAt = Date()
                AppConfigStore.shared.liveState.incomingCallerNumber = cleanCaller
                if AppConfigStore.shared.liveState.incomingCallerName.isEmpty || AppConfigStore.shared.liveState.incomingCallerName == cleanCaller {
                    AppConfigStore.shared.liveState.incomingCallerName = resolvedDisplayName
                }
                AppConfigStore.shared.liveState.incomingCallWasLocked = resolvedWasLocked
                AppConfigStore.shared.liveState.callStatus = "Ringing"
                AppConfigStore.shared.liveState.isSystemCallKitActive = false
                AppConfigStore.shared.liveState.isCallKitUIPresented = shouldPresentSystemOverlay
            }
            for reinforceDelay in [0.25, 0.65, 1.3] {
                DispatchQueue.main.asyncAfter(deadline: .now() + reinforceDelay) { [weak self] in
                    guard let self = self, self.currentCallStatus == "Ringing", !self.hasUserAnsweredCurrentCall else { return }
                    Task { @MainActor in
                        if AppConfigStore.shared.liveState.callStatus != "InCall" && !AppConfigStore.shared.hasUserAnsweredCurrentCall {
                            let shouldPresent = AppConfigStore.shared.liveState.incomingCallWasLocked || AppConfigStore.shared.liveState.isDynamicIslandBackgroundMode
                            AppConfigStore.shared.liveState.callStatus = "Ringing"
                            AppConfigStore.shared.liveState.isSystemCallKitActive = false
                            AppConfigStore.shared.liveState.isCallKitUIPresented = shouldPresent
                        }
                    }
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.04) { [weak self] in
                guard let self = self, self.currentCallStatus == "Ringing", !self.hasUserAnsweredCurrentCall else { return }
                self.configureVoIPAudioSession()
                self.startNativeRingtone()
            }
            if resolvedWasLocked || UIApplication.shared.applicationState != .active {
                self.bringAppToFrontOverLockScreenForIncomingCall()
            }
            pushCompletion?()
            return
            #else
            if let existingUUID = self.activeCallUUID {
                let update = CXCallUpdate()
                update.remoteHandle = CXHandle(type: .phoneNumber, value: cleanCaller)
                update.localizedCallerName = cleanName
                update.hasVideo = false
                update.supportsHolding = true
                update.supportsDTMF = true
                update.supportsGrouping = false
                update.supportsUngrouping = false
                self.callKitProvider?.reportCall(with: existingUUID, updated: update)
                pushCompletion?()
                return
            }

            let callUUID = UUID()
            self.activeCallUUID = callUUID
            let update = CXCallUpdate()
            update.remoteHandle = CXHandle(type: .phoneNumber, value: cleanCaller)
            update.localizedCallerName = cleanName
            update.hasVideo = false
            update.supportsHolding = true
            update.supportsDTMF = true
            update.supportsGrouping = false
            update.supportsUngrouping = false

            // Always report incoming calls to iOS CallKit (Yeastar Linkus architecture)
            self.callKitProvider?.reportNewIncomingCall(with: callUUID, update: update) { [weak self] error in
                defer { pushCompletion?() }
                guard let self = self else { return }
                if let error = error {
                    NSLog("[AIDA CallKit] reportNewIncomingCall fallback: %@", error.localizedDescription)
                    self.activeCallUUID = nil
                    self.isSystemCallKitPresenting = false
                    Task { @MainActor in
                        AppConfigStore.shared.liveState.isSystemCallKitActive = false
                        AppConfigStore.shared.liveState.isCallKitUIPresented = true
                    }
                    self.configureVoIPAudioSession()
                    self.startNativeRingtone()
                    self.bringAppToFrontOverLockScreenForIncomingCall()
                } else {
                    NSLog("[AIDA CallKit] reportNewIncomingCall succeeded for %@", cleanName)
                    self.isSystemCallKitPresenting = true
                    self.stopNativeRingtone()
                    Task { @MainActor in
                        AppConfigStore.shared.liveState.isSystemCallKitActive = true
                        AppConfigStore.shared.liveState.isCallKitUIPresented = false
                    }
                }
            }
            #endif
        }
    }

    func prepareAudioSessionForCallKit() {
        stopSilentBackgroundKeepAlive()
        disableLockScreenMediaPlayerWidget()
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetoothHFP, .allowBluetoothA2DP]
            )
        } catch {
            print("[AIDA AudioSession] Prepare CallKit warning:", error.localizedDescription)
        }
    }

    func configureCallKitActiveAudioSession() {
        stopSilentBackgroundKeepAlive()
        disableLockScreenMediaPlayerWidget()
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetoothHFP, .allowBluetoothA2DP]
            )
            try audioSession.overrideOutputAudioPort(currentSpeakerState ? .speaker : .none)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("[AIDA AudioSession] Active CallKit warning:", error.localizedDescription)
        }
    }

    func configureVoIPAudioSession() {
        stopSilentBackgroundKeepAlive()
        disableLockScreenMediaPlayerWidget()
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetoothHFP, .allowBluetoothA2DP, .defaultToSpeaker, .mixWithOthers]
            )
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("[AIDA AudioSession] Warning:", error.localizedDescription)
        }
    }

    func startSilentBackgroundKeepAlive() {
        guard !isCallCurrentlyActive else { return }
        stopNativeRingtone()
        disableLockScreenMediaPlayerWidget()

        // Begin background task assertion
        if backgroundTask == .invalid {
            backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "AIDA_SIP_WS_KEEPALIVE") { [weak self] in
                guard let self = self else { return }
                if self.backgroundTask != .invalid {
                    UIApplication.shared.endBackgroundTask(self.backgroundTask)
                    self.backgroundTask = .invalid
                }
            }
        }

        // Use .playback (NOT .playAndRecord) with .mixWithOthers while idle in background:
        // Hardware microphone stays 100% OFF (no orange mic dot, ultra-low power),
        // while keeping WKWebView's SIP WebSocket connection awake for incoming calls & chat alerts.
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try audioSession.setActive(true)
        } catch {}

        if silentKeepAlivePlayer == nil {
            if let silentData = Self.buildSilentWavData(),
               let player = try? AVAudioPlayer(data: silentData) {
                player.numberOfLoops = -1
                player.volume = 0.01
                player.prepareToPlay()
                silentKeepAlivePlayer = player
            }
        }
        if let player = silentKeepAlivePlayer, !player.isPlaying {
            player.play()
        }
        disableLockScreenMediaPlayerWidget()

        if backgroundKeepAliveTimer == nil {
            let timer = DispatchSource.makeTimerSource(queue: .main)
            timer.schedule(deadline: .now() + 0.4, repeating: 1.5)
            timer.setEventHandler { [weak self] in
                guard let self = self else { return }
                if UIApplication.shared.applicationState != .active {
                    self.disableLockScreenMediaPlayerWidget()
                    #if targetEnvironment(simulator)
                    if FileManager.default.fileExists(atPath: "/tmp/aida_sim_test_ring.json"),
                       let data = try? Data(contentsOf: URL(fileURLWithPath: "/tmp/aida_sim_test_ring.json")),
                       let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                        try? FileManager.default.removeItem(atPath: "/tmp/aida_sim_test_ring.json")
                        self.handleIncomingSipInvite(
                            caller: json["caller"] ?? "905071796372",
                            callerName: json["callerName"] ?? "ANIL ACAR",
                            callId: json["callId"] ?? "sim-call"
                        )
                        return
                    }
                    #endif
                    if !self.isCallCurrentlyActive {
                        if let player = self.silentKeepAlivePlayer, !player.isPlaying {
                            try? AVAudioSession.sharedInstance().setActive(true)
                            player.play()
                        }
                    }
                    // Keep WebKit's NetworkProcess & WebContent process assertion active while screen is locked
                    self.onNotificationActionDispatch?("AIDA_IOS_BG_PING", nil)
                }
            }
            timer.resume()
            backgroundKeepAliveTimer = timer
        }
    }

    func stopSilentBackgroundKeepAlive() {
        silentKeepAlivePlayer?.stop()
        backgroundKeepAliveTimer?.cancel()
        backgroundKeepAliveTimer = nil
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }

    // MARK: - Native Incoming Call Ringtone & Vibration

    func startNativeRingtone() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard self.currentCallStatus == "Ringing" else {
                self.stopNativeRingtone()
                return
            }
            self.configureVoIPAudioSession()
            if self.ringtonePlayer == nil {
                if let ringData = Self.buildRingtoneWavData() {
                    if let player = try? AVAudioPlayer(data: ringData) {
                        player.numberOfLoops = -1
                        player.volume = 0.9
                        player.prepareToPlay()
                        self.ringtonePlayer = player
                    }
                }
            }
            if let player = self.ringtonePlayer, !player.isPlaying {
                player.play()
            }
            self.triggerIncomingCallHaptic()
            if self.ringtoneHapticTimer == nil {
                let timer = DispatchSource.makeTimerSource(queue: .main)
                timer.schedule(deadline: .now() + 1.8, repeating: 1.8)
                timer.setEventHandler { [weak self] in
                    guard let self = self, self.currentCallStatus == "Ringing" else {
                        self?.stopNativeRingtone()
                        return
                    }
                    self.triggerIncomingCallHaptic()
                }
                timer.resume()
                self.ringtoneHapticTimer = timer
            }
        }
    }

    func stopNativeRingtone() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.ringtonePlayer?.stop()
            self.ringtonePlayer?.currentTime = 0
            self.ringtoneHapticTimer?.cancel()
            self.ringtoneHapticTimer = nil
        }
    }

    // MARK: - App Lifecycle Observers

    private func setupAudioInterruptionObserver() {
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notif in
            guard let info = notif.userInfo,
                  let typeVal = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeVal) else { return }
            if type == .ended && (self?.isCallCurrentlyActive == true || UIApplication.shared.applicationState == .active) {
                self?.configureVoIPAudioSession()
            }
        }
    }

    private func setupAppLifecycleObservers() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.protectedDataWillBecomeUnavailableNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self = self else { return }
            self.isDeviceCurrentlyLocked = true
            // iPhone Lock Button behavior during incoming call:
            // 1st press silences ringtone, 2nd press declines/rejects the call!
            if self.currentCallStatus == "Ringing" {
                self.ringLockButtonPressCount += 1
                if self.ringLockButtonPressCount == 1 {
                    self.stopNativeRingtone()
                    self.bringAppToFrontOverLockScreenForIncomingCall()
                } else if self.ringLockButtonPressCount >= 2 {
                    self.performCallKitEndCall()
                }
            }
        }

        NotificationCenter.default.addObserver(
            forName: UIApplication.protectedDataDidBecomeAvailableNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self = self else { return }
            self.isDeviceCurrentlyLocked = false
            self.lastDeviceUnlockedAt = Date()
        }

        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self = self else { return }
            if self.isCallCurrentlyActive {
                self.configureVoIPAudioSession()
            } else {
                // Keep SIP WebSocket & Omnichannel listener alive in background with zero microphone usage
                self.startSilentBackgroundKeepAlive()
            }
        }

        NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self = self else { return }
            self.stopSilentBackgroundKeepAlive()
            self.configureVoIPAudioSession()
            self.onNotificationActionDispatch?("AIDA_IOS_WAKE_SIP", nil)
        }
    }

    // MARK: - Haptics & Notification Dispatch

    func triggerIncomingCallHaptic() {
        DispatchQueue.main.async {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.warning)
        }
    }

    func triggerLightHaptic() {
        DispatchQueue.main.async {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
        }
    }

    func postNativeNotification(
        id: String,
        title: String,
        body: String,
        urgent: Bool,
        actionEvent: String?,
        actionDetailJSON: String?
    ) {
        if notifiedIds.contains(id) {
            return
        }
        notifiedIds.insert(id)

        if urgent {
            triggerIncomingCallHaptic()
        }

        let isCallAlert = id.hasPrefix("call-") || actionEvent == "OPEN_FULL_WEBPHONE" || title.contains("Gelen Çağrı")
        let isMissedFollowupAlert = id.hasPrefix("missed-") || title.contains("Geri Dönüş Bekleyen")

        // Suppress periodic "Geri Dönüş Bekleyen Cevapsız Çağrı" polling alerts from cluttering Lock Screen or Foreground
        if isMissedFollowupAlert {
            return
        }

        // Incoming calls are handled exclusively by iOS CallKit (Slide to Answer / InCallService).
        // Never post a UNNotificationRequest banner ("Pencereyi öne getirmek için tıklayın") for incoming calls;
        // only sync resolved caller name/number into CallKit!
        if isCallAlert {
            let parsedCaller = title
                .replacingOccurrences(of: "📞", with: "")
                .replacingOccurrences(of: "Gelen Çağrı:", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !parsedCaller.isEmpty {
                Task { @MainActor in
                    if AppConfigStore.shared.liveState.incomingCallerName.isEmpty ||
                        AppConfigStore.shared.liveState.incomingCallerName == AppConfigStore.shared.liveState.incomingCallerNumber {
                        AppConfigStore.shared.liveState.incomingCallerName = parsedCaller
                    }
                    if AppConfigStore.shared.liveState.incomingCallerNumber.isEmpty {
                        AppConfigStore.shared.liveState.incomingCallerNumber = parsedCaller
                    }
                }
                if let existingUUID = activeCallUUID {
                    let update = CXCallUpdate()
                    update.localizedCallerName = parsedCaller
                    callKitProvider?.reportCall(with: existingUUID, updated: update)
                }
            }
            return
        }

        var resolvedActionEvent = actionEvent
        var resolvedDetailJSON = actionDetailJSON
        if resolvedActionEvent == nil || resolvedActionEvent?.isEmpty == true {
            if id.hasPrefix("int-chat-") || id.hasPrefix("omni-chat-") || title.contains("Mesaj") || title.contains("Sohbet") {
                resolvedActionEvent = "SWITCH_AGENT_PANEL_SUBTAB"
                resolvedDetailJSON = "{\"subTab\":\"chat\"}"
            } else if title.contains("Gelen Çağrı") {
                resolvedActionEvent = "OPEN_FULL_WEBPHONE"
                resolvedDetailJSON = "{\"subTab\":\"webphone\"}"
            }
        }

        let content = UNMutableNotificationContent()
        content.title = title
            .replacingOccurrences(of: "AIDA Agent", with: "Runa")
            .replacingOccurrences(of: "AIDA Mobile", with: "Runa")
            .replacingOccurrences(of: "AIDA PBX", with: "Runa")
            .replacingOccurrences(of: "AİDA", with: "Runa")
            .replacingOccurrences(of: "AIDA", with: "Runa")
            .replacingOccurrences(of: "RUNA", with: "Runa")
            .replacingOccurrences(of: "Aida", with: "Runa")
        content.body = body
            .replacingOccurrences(of: "Pencereyi öne getirmek için tıklayın.", with: "Yanıtlamak için dokunun.")
            .replacingOccurrences(of: "AIDA Agent", with: "Runa")
            .replacingOccurrences(of: "AIDA Mobile", with: "Runa")
            .replacingOccurrences(of: "AIDA PBX", with: "Runa")
            .replacingOccurrences(of: "AİDA", with: "Runa")
            .replacingOccurrences(of: "AIDA", with: "Runa")
            .replacingOccurrences(of: "RUNA", with: "Runa")
            .replacingOccurrences(of: "Aida", with: "Runa")
        if isCallAlert {
            content.categoryIdentifier = "AIDA_INCOMING_CALL"
        }
        if urgent {
            content.sound = .defaultCritical
            if #available(iOS 15.0, *) {
                content.interruptionLevel = .active
            }
        } else {
            content.sound = .default
            if #available(iOS 15.0, *) {
                content.interruptionLevel = .active
            }
        }

        var userInfo: [String: String] = ["id": id]
        if let ev = resolvedActionEvent, !ev.isEmpty {
            userInfo["actionEvent"] = ev
        }
        if let dj = resolvedDetailJSON, !dj.isEmpty {
            userInfo["actionDetailJSON"] = dj
        }
        content.userInfo = userInfo

        let req = UNNotificationRequest(identifier: id, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }

    func closeNativeNotification(id: String) {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [id])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let info = notification.request.content.userInfo
        let type = (info["type"] as? String) ?? ""
        if type == "incoming_call" || type == "voip_call" {
            let caller = (info["caller_number"] as? String) ?? (info["caller"] as? String) ?? "905071796372"
            let callerName = (info["caller_name"] as? String) ?? "ANIL ACAR"
            let callId = (info["call_id"] as? String) ?? String(Int(Date().timeIntervalSince1970))
            handleIncomingSipInvite(caller: caller, callerName: callerName, callId: callId)
        }
        let id = (info["id"] as? String) ?? ""
        let actionEvent = (info["actionEvent"] as? String) ?? ""
        let title = notification.request.content.title
        let isCallAlert = id.hasPrefix("call-") || actionEvent == "OPEN_FULL_WEBPHONE" || title.contains("Gelen Çağrı")
        if UIApplication.shared.applicationState == .active && isCallAlert {
            completionHandler([])
            return
        }
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let info = response.notification.request.content.userInfo
        let actionEvent = (info["actionEvent"] as? String) ?? ""
        let actionId = response.actionIdentifier
        var parsedDetail: Any? = nil
        if let detailJSON = info["actionDetailJSON"] as? String,
           let data = detailJSON.data(using: .utf8) {
            parsedDetail = try? JSONSerialization.jsonObject(with: data, options: [])
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.stopSilentBackgroundKeepAlive()
            self.configureVoIPAudioSession()

            if actionId == "AIDA_DECLINE_CALL" {
                self.stopNativeRingtone()
                self.onNotificationActionDispatch?("AIDA_IOS_HANGUP_CALL", nil)
                return
            }

            if actionId == "AIDA_ANSWER_CALL" {
                self.stopNativeRingtone()
                self.onNotificationActionDispatch?("SWITCH_AGENT_PANEL_SUBTAB", ["subTab": "webphone"])
                self.onNotificationActionDispatch?("AIDA_IOS_WAKE_SIP", ["answer": true])
                return
            }

            self.onNotificationActionDispatch?("AIDA_IOS_WAKE_SIP", nil)
            if actionEvent == "OPEN_FULL_WEBPHONE" {
                self.onNotificationActionDispatch?("SWITCH_AGENT_PANEL_SUBTAB", ["subTab": "webphone"])
                self.onNotificationActionDispatch?("OPEN_FULL_WEBPHONE", parsedDetail)
            } else if !actionEvent.isEmpty {
                self.onNotificationActionDispatch?(actionEvent, parsedDetail)
            }
        }
        completionHandler()
    }

    private static func buildSilentWavData() -> Data? {
        let sampleRate = 8000
        let durationSeconds = 2
        let numSamples = durationSeconds * sampleRate
        let dataSize = numSamples * 2
        var data = Data(capacity: 44 + dataSize)

        func appendUInt32(_ v: UInt32) {
            var le = v.littleEndian
            data.append(Data(bytes: &le, count: 4))
        }
        func appendUInt16(_ v: UInt16) {
            var le = v.littleEndian
            data.append(Data(bytes: &le, count: 2))
        }

        data.append("RIFF".data(using: .ascii)!)
        appendUInt32(UInt32(36 + dataSize))
        data.append("WAVE".data(using: .ascii)!)
        data.append("fmt ".data(using: .ascii)!)
        appendUInt32(16)
        appendUInt16(1)
        appendUInt16(1)
        appendUInt32(UInt32(sampleRate))
        appendUInt32(UInt32(sampleRate * 2))
        appendUInt16(2)
        appendUInt16(16)
        data.append("data".data(using: .ascii)!)
        appendUInt32(UInt32(dataSize))
        data.append(Data(count: dataSize))
        return data
    }

    private static func buildRingtoneWavData() -> Data? {
        let sampleRate = 16000
        let durationSeconds = 3
        let numSamples = durationSeconds * sampleRate
        let dataSize = numSamples * 2
        var data = Data(capacity: 44 + dataSize)

        func appendUInt32(_ v: UInt32) {
            var le = v.littleEndian
            data.append(Data(bytes: &le, count: 4))
        }
        func appendUInt16(_ v: UInt16) {
            var le = v.littleEndian
            data.append(Data(bytes: &le, count: 2))
        }

        data.append("RIFF".data(using: .ascii)!)
        appendUInt32(UInt32(36 + dataSize))
        data.append("WAVE".data(using: .ascii)!)
        data.append("fmt ".data(using: .ascii)!)
        appendUInt32(16)
        appendUInt16(1)
        appendUInt16(1)
        appendUInt32(UInt32(sampleRate))
        appendUInt32(UInt32(sampleRate * 2))
        appendUInt16(2)
        appendUInt16(16)
        data.append("data".data(using: .ascii)!)
        appendUInt32(UInt32(dataSize))

        for i in 0..<numSamples {
            let t = Double(i) / Double(sampleRate)
            let isRingingSlice = (t >= 0.0 && t < 0.4) || (t >= 0.6 && t < 1.0)
            var sampleVal: Int16 = 0
            if isRingingSlice {
                let s1 = sin(2.0 * .pi * 440.0 * t)
                let s2 = sin(2.0 * .pi * 480.0 * t)
                let combined = (s1 + s2) * 0.5
                sampleVal = Int16(combined * 9000.0)
            }
            var le = sampleVal.littleEndian
            data.append(Data(bytes: &le, count: 2))
        }
        return data
    }
}
