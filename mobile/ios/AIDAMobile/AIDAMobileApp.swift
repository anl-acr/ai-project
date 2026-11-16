import SwiftUI
import UIKit
import UserNotifications

final class AIDAAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = AudioSessionManager.shared
        return true
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = AudioSessionManager.shared
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        AudioSessionManager.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        let type = (userInfo["type"] as? String) ?? ""
        if type == "voip_call" || type == "incoming_call" {
            let caller = (userInfo["caller_number"] as? String) ?? (userInfo["caller"] as? String) ?? "905071796372"
            let callerName = (userInfo["caller_name"] as? String) ?? "ANIL ACAR"
            let callId = (userInfo["call_id"] as? String) ?? String(Int(Date().timeIntervalSince1970))
            AudioSessionManager.shared.handleIncomingSipInvite(
                caller: caller,
                callerName: callerName,
                callId: callId
            )
            DispatchQueue.main.async {
                AudioSessionManager.shared.onNotificationActionDispatch?("AIDA_IOS_WAKE_SIP", nil)
                AudioSessionManager.shared.onNotificationActionDispatch?("SWITCH_AGENT_PANEL_SUBTAB", ["subTab": "webphone"])
            }
        }
        completionHandler(.newData)
    }
}

@main
struct AIDAMobileApp: App {
    @UIApplicationDelegateAdaptor(AIDAAppDelegate.self) private var appDelegate
    @StateObject private var store = AppConfigStore.shared
    @State private var deepLinkError: String? = nil

    var body: some Scene {
        WindowGroup {
            Group {
                if store.session != nil && !store.uiOrigin.isEmpty {
                    WorkspaceContainerView(store: store)
                } else {
                    LoginView(store: store)
                }
            }
            .preferredColorScheme(store.isWebDarkMode ? .dark : .light)
            .onAppear {
                UIApplication.shared.isIdleTimerDisabled = true
                AudioSessionManager.shared.requestPermissionsAndActivateAudio()
            }
            .onOpenURL { incomingURL in
                handleIncomingDeepLink(incomingURL)
            }
            .alert("Kolay Giriş Hatası", isPresented: Binding(
                get: { deepLinkError != nil },
                set: { if !$0 { deepLinkError = nil } }
            )) {
                Button("Tamam", role: .cancel) { deepLinkError = nil }
            } message: {
                Text(deepLinkError ?? "")
            }
        }
    }

    private func handleIncomingDeepLink(_ url: URL) {
        let schemeLower = url.scheme?.lowercased() ?? ""
        if (schemeLower == "runa-mobile" || schemeLower == "runa" || schemeLower == "aida-mobile"),
           url.host?.lowercased() == "tab" {
            let tabId = url.path.replacingOccurrences(of: "/", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !tabId.isEmpty {
                NotificationCenter.default.post(name: NSNotification.Name("AIDAMobileSwitchTab"), object: tabId)
            }
            return
        }
        if (schemeLower == "runa-mobile" || schemeLower == "runa" || schemeLower == "aida-mobile"),
           url.host?.lowercased() == "quicktray" {
            NotificationCenter.default.post(name: NSNotification.Name("AIDAMobileOpenQuickTray"), object: nil)
            return
        }

        let rawStr = url.absoluteString
        Task { @MainActor in
            do {
                let outcome = try await PBXNetworkService.shared.loginWithMagicUrl(
                    rawStr,
                    fallbackHost: store.serverHost,
                    rememberMe: true
                )
                if case .authenticated(let session, let resolved, let popOnCall) = outcome {
                    AudioSessionManager.shared.triggerLightHaptic()
                    store.recordLoginSuccess(
                        displayHost: resolved.displayHost,
                        apiOrigin: resolved.apiOrigin,
                        uiOrigin: resolved.uiOrigin,
                        rememberMe: true,
                        savedUsername: session.username,
                        session: session,
                        popWindowOnCall: popOnCall
                    )
                    AudioSessionManager.shared.syncPushTokensToBackend()
                    store.webViewReloadTrigger = UUID()
                }
            } catch {
                deepLinkError = error.localizedDescription
            }
        }
    }
}
