import Foundation
import Combine

struct AgentSessionModel: Codable, Equatable {
    var userId: String
    var username: String
    var fullName: String
    var extensionNumber: String
    var tenantId: String

    enum CodingKeys: String, CodingKey {
        case userId
        case username
        case fullName
        case extensionNumber = "extension"
        case tenantId
    }
}

struct AudioPrefsModel: Codable, Equatable {
    var micLabel: String = ""
    var speakerLabel: String = ""
    var ringtoneSpeakerLabel: String = ""
}

struct LiveAgentStateModel: Equatable {
    var fullName: String = ""
    var extensionNumber: String = ""
    var profileId: String = "available"
    var profileLabel: String = "Uygun"
    var registered: Bool = false
    var callStatus: String = "Idle"
    var incomingCallerNumber: String = ""
    var incomingCallerName: String = ""
    var incomingCallWasLocked: Bool = true
    var isDynamicIslandBackgroundMode: Bool = false
    var isSystemCallKitActive: Bool = false
    var isCallKitUIPresented: Bool = false
    var isMuted: Bool = false
    var isOnHold: Bool = false
    var isSpeakerOn: Bool = false
    var callDurationSeconds: Int = 0
}

struct Pending2FAContext: Equatable {
    var apiOrigin: String
    var uiOrigin: String
    var displayHost: String
    var userId: String
    var sessionUserId: String
    var method: String
    var email: String
    var phone: String
    var fullName: String
    var extensionNumber: String
    var tenantId: String
    var username: String
    var rememberMe: Bool
}

@MainActor
final class AppConfigStore: ObservableObject {
    static let shared = AppConfigStore()

    private let defaults = UserDefaults.standard
    private let configKey = "com.aida.mobile.config.v1"

    @Published var serverHost: String = ""
    @Published var apiOrigin: String = ""
    @Published var uiOrigin: String = ""
    @Published var recentHosts: [String] = []
    @Published var rememberMe: Bool = true
    @Published var savedUsername: String = ""
    @Published var session: AgentSessionModel? = nil
    @Published var justLoggedIn: Bool = false

    @Published var osNotifications: Bool = true
    @Published var popWindowOnCall: Bool = true
    @Published var minimizeToTray: Bool = true
    @Published var startOnBoot: Bool = false
    @Published var audioPrefs: AudioPrefsModel = AudioPrefsModel()

    @Published var liveState: LiveAgentStateModel = LiveAgentStateModel()
    @Published var lastIncomingRingStartedAt: Date = .distantPast
    @Published var hasUserAnsweredCurrentCall: Bool = false
    @Published var coldLaunchPickupExten: String = ""
    @Published var coldLaunchCallerNumber: String = ""
    @Published var coldLaunchCallerName: String = ""
    @Published var isOfflineError: Bool = false
    @Published var isWebDarkMode: Bool = false
    @Published var webViewReloadTrigger: UUID = UUID()

    let appName = "Runa"
    let appVersion = "2.9.3"

    private struct PersistedBlob: Codable {
        var serverHost: String
        var apiOrigin: String
        var uiOrigin: String
        var recentHosts: [String]
        var rememberMe: Bool
        var savedUsername: String
        var session: AgentSessionModel?
        var osNotifications: Bool
        var popWindowOnCall: Bool
        var minimizeToTray: Bool
        var startOnBoot: Bool
        var audioPrefs: AudioPrefsModel
        var isWebDarkMode: Bool?
    }

    init() {
        loadFromDisk()
        #if targetEnvironment(simulator)
        preloadPendingSimulatorVoipPushIfPresent()
        #endif
    }

    #if targetEnvironment(simulator)
    func preloadPendingSimulatorVoipPushIfPresent() {
        let ringPath = "/tmp/aida_sim_test_ring.json"
        let fm = FileManager.default
        guard fm.fileExists(atPath: ringPath),
              let data = try? Data(contentsOf: URL(fileURLWithPath: ringPath)),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        if let ts = json["timestamp"] as? Double, Date().timeIntervalSince1970 - ts > 35.0 {
            try? fm.removeItem(atPath: ringPath)
            return
        }
        try? fm.removeItem(atPath: "/tmp/aida_sim_cancel_ring.json")
        let caller = (json["caller"] as? String) ?? "Gelen Çağrı"
        let callerName = (json["callerName"] as? String) ?? caller
        let pickupExten = (json["pickupExten"] as? String) ?? "1000"
        let isCold = (json["coldLaunch"] as? Bool) ?? true
        var wasLocked = (json["wasLocked"] as? Bool) ?? false
        if json["wasLocked"] == nil,
           let lockStr = try? String(contentsOfFile: "/tmp/aida_sim_was_locked_on_invite", encoding: .utf8)
               .trimmingCharacters(in: .whitespacesAndNewlines) {
            wasLocked = (lockStr == "1")
        }
        self.lastIncomingRingStartedAt = Date()
        if isCold {
            self.coldLaunchPickupExten = pickupExten
        }
        self.coldLaunchCallerNumber = caller
        self.coldLaunchCallerName = callerName
        self.liveState.incomingCallerNumber = caller
        self.liveState.incomingCallerName = callerName
        self.liveState.incomingCallWasLocked = wasLocked
        self.liveState.isDynamicIslandBackgroundMode = !wasLocked
        self.liveState.callStatus = "Ringing"
        self.liveState.isSystemCallKitActive = false
        self.liveState.isCallKitUIPresented = true
    }
    #endif

    func loadFromDisk() {
        guard let data = defaults.data(forKey: configKey),
              let decoded = try? JSONDecoder().decode(PersistedBlob.self, from: data) else {
            return
        }
        self.serverHost = decoded.serverHost.replacingOccurrences(of: "aida.saphira.com.tr", with: "runa.saphira.com.tr", options: [.caseInsensitive])
        self.apiOrigin = decoded.apiOrigin
        self.uiOrigin = decoded.uiOrigin
        self.recentHosts = decoded.recentHosts.map {
            $0.replacingOccurrences(of: "aida.saphira.com.tr", with: "runa.saphira.com.tr", options: [.caseInsensitive])
        }
        self.rememberMe = decoded.rememberMe
        self.savedUsername = decoded.savedUsername
        self.session = decoded.rememberMe ? decoded.session : nil
        self.osNotifications = decoded.osNotifications
        self.popWindowOnCall = decoded.popWindowOnCall
        self.minimizeToTray = decoded.minimizeToTray
        self.startOnBoot = decoded.startOnBoot
        self.audioPrefs = decoded.audioPrefs
        self.isWebDarkMode = decoded.isWebDarkMode ?? false

        if let s = self.session {
            self.liveState.fullName = s.fullName
            self.liveState.extensionNumber = s.extensionNumber
        }
    }

    func saveToDisk() {
        let blob = PersistedBlob(
            serverHost: serverHost,
            apiOrigin: apiOrigin,
            uiOrigin: uiOrigin,
            recentHosts: recentHosts,
            rememberMe: rememberMe,
            savedUsername: savedUsername,
            session: session,
            osNotifications: osNotifications,
            popWindowOnCall: popWindowOnCall,
            minimizeToTray: minimizeToTray,
            startOnBoot: startOnBoot,
            audioPrefs: audioPrefs,
            isWebDarkMode: isWebDarkMode
        )
        if let encoded = try? JSONEncoder().encode(blob) {
            defaults.set(encoded, forKey: configKey)
        }
    }

    func recordLoginSuccess(
        displayHost: String,
        apiOrigin: String,
        uiOrigin: String,
        rememberMe: Bool,
        savedUsername: String,
        session: AgentSessionModel,
        popWindowOnCall: Bool? = nil
    ) {
        self.serverHost = displayHost
        self.apiOrigin = apiOrigin
        self.uiOrigin = uiOrigin
        var nextRecent = [displayHost] + self.recentHosts.filter { $0 != displayHost }
        if nextRecent.count > 8 {
            nextRecent = Array(nextRecent.prefix(8))
        }
        self.recentHosts = nextRecent
        self.rememberMe = rememberMe
        self.savedUsername = savedUsername
        if let pop = popWindowOnCall {
            self.popWindowOnCall = pop
        }
        self.justLoggedIn = true
        self.isOfflineError = false
        self.liveState = LiveAgentStateModel(
            fullName: session.fullName,
            extensionNumber: session.extensionNumber,
            profileId: "available",
            profileLabel: "Uygun",
            registered: false,
            callStatus: "Idle"
        )
        self.session = session
        saveToDisk()
    }

    func removeRecentHost(_ hostStr: String) {
        recentHosts.removeAll { $0 == hostStr }
        saveToDisk()
    }

    func disconnectSession() {
        session = nil
        isOfflineError = false
        liveState = LiveAgentStateModel()
        saveToDisk()
    }

    func consumeBootStateDictionary() -> [String: Any] {
        let flag = justLoggedIn
        if flag {
            DispatchQueue.main.async { [weak self] in
                self?.justLoggedIn = false
            }
        }
        var sessionDict: Any = NSNull()
        if let s = session {
            sessionDict = [
                "userId": s.userId,
                "username": s.username,
                "fullName": s.fullName,
                "extension": s.extensionNumber,
                "tenantId": s.tenantId
            ]
        }
        return [
            "appName": appName,
            "version": appVersion,
            "platform": "ios",
            "serverHost": serverHost,
            "uiOrigin": uiOrigin,
            "apiOrigin": apiOrigin,
            "recentHosts": recentHosts,
            "rememberMe": rememberMe,
            "savedUsername": savedUsername,
            "session": sessionDict,
            "justLoggedIn": flag,
            "osNotifications": osNotifications,
            "popWindowOnCall": popWindowOnCall,
            "minimizeToTray": minimizeToTray,
            "startOnBoot": startOnBoot,
            "audioPrefs": [
                "micLabel": audioPrefs.micLabel,
                "speakerLabel": audioPrefs.speakerLabel,
                "ringtoneSpeakerLabel": audioPrefs.ringtoneSpeakerLabel
            ]
        ]
    }
}
