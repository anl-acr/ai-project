import SwiftUI
import AVKit

struct WorkspaceContainerView: View {
    @ObservedObject var store: AppConfigStore
    @StateObject private var bridge = PBXWebViewControllerBridge()
    @State private var showQuickMenu: Bool = false

    private let crimson = Color(red: 0.882, green: 0.114, blue: 0.282)

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ((store.isWebDarkMode || store.liveState.isDynamicIslandBackgroundMode || store.liveState.callStatus != "Idle")
                ? Color(red: 0.035, green: 0.051, blue: 0.086)
                : Color(red: 0.973, green: 0.980, blue: 0.988))
                .ignoresSafeArea(.all)

            PBXWebView(
                store: store,
                bridge: bridge,
                onOpenQuickTray: {
                    AudioSessionManager.shared.triggerLightHaptic()
                    bridge.dispatchWindowEvent(name: "AIDA_IOS_OPEN_QUEUE_MODAL")
                }
            )
            .id(store.webViewReloadTrigger)
            .ignoresSafeArea(.all)

            if store.isOfflineError && !store.liveState.isDynamicIslandBackgroundMode {
                offlineOverlay
            }

            if store.liveState.isDynamicIslandBackgroundMode &&
                (store.liveState.callStatus == "Ringing" ||
                 store.liveState.callStatus == "InCall" ||
                 store.liveState.callStatus == "Calling") {
                SimulatorHomeScreenBackgroundView()
                    .transition(.opacity)
                    .zIndex(990)
            }

            if !store.liveState.isSystemCallKitActive {
                if store.liveState.isCallKitUIPresented &&
                    (store.liveState.callStatus == "Ringing" ||
                     store.liveState.callStatus == "InCall" ||
                     store.liveState.callStatus == "Calling") {
                    IOSCallKitSystemExperienceView(
                        store: store,
                        onOpenAppPBXControls: {
                            AudioSessionManager.shared.triggerLightHaptic()
                            store.liveState.isDynamicIslandBackgroundMode = false
                            store.liveState.isCallKitUIPresented = false
                            bridge.dispatchWindowEvent(name: "SWITCH_AGENT_PANEL_SUBTAB", detail: ["subTab": "webphone"])
                        }
                    )
                    .transition(.opacity)
                    .zIndex(999)
                } else if (store.liveState.callStatus == "InCall" || store.liveState.callStatus == "Calling") &&
                            !store.liveState.isCallKitUIPresented &&
                            store.liveState.incomingCallWasLocked {
                    VStack {
                        Button {
                            AudioSessionManager.shared.triggerLightHaptic()
                            store.liveState.isCallKitUIPresented = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "phone.fill")
                                    .font(.system(size: 12, weight: .bold))
                                Text("Arama Ekranına Dön • \(store.liveState.callStatus == "InCall" ? Self.formatCallDuration(store.liveState.callDurationSeconds) : "bağlanıyor...")")
                                    .font(.system(size: 12, weight: .bold))
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 6)
                            .background(Color(red: 0.16, green: 0.74, blue: 0.33))
                            .clipShape(Capsule())
                            .shadow(color: Color.black.opacity(0.22), radius: 6, x: 0, y: 2)
                        }
                        .padding(.top, 4)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .zIndex(950)
                }
            }
        }
        .statusBarHidden(store.liveState.isDynamicIslandBackgroundMode && store.liveState.callStatus != "Idle")
        .onAppear {
            AudioSessionManager.shared.onNotificationActionDispatch = { eventName, detail in
                bridge.dispatchWindowEvent(name: eventName, detail: detail)
            }
            if let pendingNav = store.pendingNotificationNav, !pendingNav.isEmpty {
                for delaySec in [0.15, 0.8, 1.8, 3.0, 4.5] {
                    DispatchQueue.main.asyncAfter(deadline: .now() + delaySec) {
                        bridge.dispatchWindowEvent(name: "SWITCH_AGENT_PANEL_SUBTAB", detail: pendingNav)
                    }
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("AIDAMobileSwitchTab"))) { note in
            if let tabId = note.object as? String, !tabId.isEmpty {
                if tabId == "more" {
                    bridge.dispatchWindowEvent(name: "AIDA_IOS_TOGGLE_MORE_POPOVER", detail: ["open": true])
                } else if tabId == "history-week" {
                    bridge.dispatchWindowEvent(name: "AIDA_IOS_TOGGLE_MORE_POPOVER", detail: ["open": false])
                    bridge.dispatchWindowEvent(name: "SWITCH_AGENT_PANEL_SUBTAB", detail: ["subTab": "history", "autoWeek": true])
                } else {
                    bridge.dispatchWindowEvent(name: "AIDA_IOS_TOGGLE_MORE_POPOVER", detail: ["open": false])
                    bridge.dispatchWindowEvent(name: "SWITCH_AGENT_PANEL_SUBTAB", detail: ["subTab": tabId])
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("AIDAMobileOpenQuickTray"))) { _ in
            bridge.dispatchWindowEvent(name: "AIDA_IOS_OPEN_QUEUE_MODAL")
        }
        .sheet(isPresented: $showQuickMenu) {
            QuickTraySheetView(store: store, bridge: bridge)
                .presentationDetents([.medium, .large])
        }
    }

    private var isDark: Bool {
        store.isWebDarkMode
    }

    static func formatCallDuration(_ totalSeconds: Int) -> String {
        let s = max(0, totalSeconds)
        let mins = s / 60
        let secs = s % 60
        return String(format: "%02d:%02d", mins, secs)
    }

    private var statusDotColor: Color {
        if store.liveState.callStatus == "InCall" {
            return Color.green
        }
        if store.liveState.callStatus == "Ringing" {
            return Color.orange
        }
        if !store.liveState.registered {
            return Color.yellow
        }
        switch store.liveState.profileId {
        case "away":
            return Color.yellow
        case "meeting":
            return crimson
        default:
            return Color.green
        }
    }

    private var statusIconName: String {
        if store.liveState.callStatus == "InCall" {
            return "phone.fill"
        }
        if store.liveState.callStatus == "Ringing" {
            return "bell.badge.fill"
        }
        return "headphones"
    }

    private var offlineOverlay: some View {
        ZStack {
            (isDark
                ? Color(red: 0.024, green: 0.039, blue: 0.071).opacity(0.96)
                : Color(red: 0.973, green: 0.980, blue: 0.988).opacity(0.97))
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(crimson.opacity(0.15))
                        .frame(width: 68, height: 68)
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(crimson)
                }

                Text("Santral Sunucusuna Ulaşılamıyor")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundColor(isDark ? .white : Color(red: 0.059, green: 0.090, blue: 0.165))

                Text("Runa santral sunucusuyla bağlantı kesildi. Ağ bağlantınızı kontrol edip yeniden deneyebilirsiniz.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(isDark ? Color.white.opacity(0.65) : Color(red: 0.392, green: 0.455, blue: 0.545))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)

                HStack(spacing: 12) {
                    Button {
                        store.isOfflineError = false
                        bridge.reloadWorkspace(uiOrigin: store.uiOrigin)
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.clockwise")
                            Text("Yeniden Bağlan")
                        }
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundColor(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .background(crimson)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    Button {
                        store.disconnectSession()
                    } label: {
                        Text("Sunucu Değiştir")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(isDark ? .white : Color(red: 0.059, green: 0.090, blue: 0.165))
                            .padding(.horizontal, 18)
                            .padding(.vertical, 12)
                            .background(isDark ? Color.white.opacity(0.1) : Color(red: 0.886, green: 0.910, blue: 0.941))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
                .padding(.top, 6)
            }
        }
    }
}

private struct QuickTraySheetView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: AppConfigStore
    @ObservedObject var bridge: PBXWebViewControllerBridge

    private var isDark: Bool {
        store.isWebDarkMode
    }

    static func formatCallDuration(_ totalSeconds: Int) -> String {
        let s = max(0, totalSeconds)
        let mins = s / 60
        let secs = s % 60
        return String(format: "%02d:%02d", mins, secs)
    }

    var body: some View {
        ZStack {
            (isDark
                ? Color(red: 0.04, green: 0.06, blue: 0.11)
                : Color(red: 0.973, green: 0.980, blue: 0.988))
                .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Header
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color(red: 0.388, green: 0.400, blue: 0.945))
                                .frame(width: 42, height: 42)
                            Image(systemName: "headphones")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.white)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(
                                store.liveState.fullName.isEmpty
                                    ? (store.session?.fullName ?? "Temsilci")
                                    : store.liveState.fullName
                            )
                            .font(.system(size: 15, weight: .heavy))
                            .foregroundColor(.white)

                            HStack(spacing: 6) {
                                Text("Dahili \(store.liveState.extensionNumber.isEmpty ? (store.session?.extensionNumber ?? "-") : store.liveState.extensionNumber)")
                                Text("•")
                                Text("Runa Santral")
                            }
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color.white.opacity(0.6))
                        }

                        Spacer()

                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 30, height: 30)
                                .background(Color.white.opacity(0.1))
                                .clipShape(Circle())
                        }
                    }

                    // Status Switcher (Same as Desktop System Tray)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("TEMSİLCİ DURUMU DEĞİŞTİR")
                            .font(.system(size: 10, weight: .heavy))
                            .tracking(0.6)
                            .foregroundColor(Color.white.opacity(0.55))

                        statusOptionButton(
                            id: "available",
                            title: "Uygun (Çağrıya Açık)",
                            dotColor: .green
                        )
                        statusOptionButton(
                            id: "away",
                            title: "Uzakta / Kısa Mola",
                            dotColor: .yellow
                        )
                        statusOptionButton(
                            id: "meeting",
                            title: "Toplantıda / Rahatsız Etmeyin",
                            dotColor: Color(red: 0.95, green: 0.25, blue: 0.37)
                        )
                    }

                    Divider().background(Color.white.opacity(0.08))

                    // Hardware / Audio Route & Actions
                    VStack(spacing: 10) {
                        Button {
                            dismiss()
                            bridge.dispatchWindowEvent(name: "OPEN_HARDWARE_SETTINGS")
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "speaker.wave.2.fill")
                                    .font(.system(size: 14, weight: .bold))
                                Text("Ses & Çalma Aygıtları Ayarları")
                                    .font(.system(size: 13, weight: .bold))
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(Color.white.opacity(0.4))
                            }
                            .foregroundColor(.white)
                            .padding(13)
                            .background(Color.white.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }

                        HStack(spacing: 10) {
                            Image(systemName: "airpodspro")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            Text("iOS Ses Çıkışı (Hoparlör / Bluetooth)")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            IOSAudioRoutePickerButton()
                                .frame(width: 32, height: 32)
                        }
                        .padding(.horizontal, 13)
                        .padding(.vertical, 8)
                        .background(Color.white.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                        Button {
                            dismiss()
                            bridge.reloadWorkspace(uiOrigin: store.uiOrigin)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "arrow.clockwise")
                                    .font(.system(size: 14, weight: .bold))
                                Text("Paneli Yenile")
                                    .font(.system(size: 13, weight: .bold))
                                Spacer()
                            }
                            .foregroundColor(.white)
                            .padding(13)
                            .background(Color.white.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }

                        Button {
                            dismiss()
                            bridge.dispatchWindowEvent(name: "TRIGGER_DESKTOP_LOGOUT")
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                                store.disconnectSession()
                            }
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .font(.system(size: 14, weight: .bold))
                                Text("Sunucu Değiştir / Oturumu Kapat")
                                    .font(.system(size: 13, weight: .heavy))
                                Spacer()
                            }
                            .foregroundColor(Color(red: 0.98, green: 0.44, blue: 0.52))
                            .padding(13)
                            .background(Color(red: 0.88, green: 0.11, blue: 0.28).opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                }
                .padding(20)
            }
        }
    }

    private func statusOptionButton(id: String, title: String, dotColor: Color) -> some View {
        let isSelected = store.liveState.profileId == id
        return Button {
            store.liveState.profileId = id
            bridge.dispatchWindowEvent(name: "SWITCH_AGENT_PROFILE_FROM_TRAY", detail: ["profileId": id])
            dismiss()
        } label: {
            HStack(spacing: 10) {
                Circle()
                    .fill(dotColor)
                    .frame(width: 9, height: 9)
                Text(title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }
            .padding(12)
            .background(isSelected ? Color.white.opacity(0.12) : Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isSelected ? Color.white.opacity(0.25) : Color.clear, lineWidth: 1)
            )
        }
    }
}

private struct IOSAudioRoutePickerButton: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let picker = AVRoutePickerView()
        picker.tintColor = .white
        picker.activeTintColor = UIColor(red: 0.388, green: 0.400, blue: 0.945, alpha: 1.0)
        return picker
    }

    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {}
}

private struct SimulatorHomeScreenBackgroundView: View {
    var body: some View {
        GeometryReader { geo in
            if let uiImage = UIImage(contentsOfFile: "/tmp/aida_sim_homescreen_bg.png") {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
            } else {
                LinearGradient(
                    colors: [
                        Color(red: 0.08, green: 0.12, blue: 0.22),
                        Color(red: 0.05, green: 0.07, blue: 0.14),
                        Color(red: 0.03, green: 0.04, blue: 0.08)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
        .ignoresSafeArea(.all)
    }
}

private struct IOSCallKitSystemExperienceView: View {
    @ObservedObject var store: AppConfigStore
    let onOpenAppPBXControls: () -> Void

    @State private var showKeypad: Bool = false
    @State private var dtmfDigitsTyped: String = ""
    @State private var isDynamicIslandManuallyExpanded: Bool = false

    private var isRinging: Bool {
        store.liveState.callStatus == "Ringing"
    }

    private var useCompactDynamicIslandBanner: Bool {
        store.liveState.isDynamicIslandBackgroundMode &&
        !store.liveState.incomingCallWasLocked &&
        !isDynamicIslandManuallyExpanded &&
        (store.liveState.callStatus == "Ringing" ||
         store.liveState.callStatus == "InCall" ||
         store.liveState.callStatus == "Calling")
    }

    private var callerTitle: String {
        let name = store.liveState.incomingCallerName.trimmingCharacters(in: .whitespacesAndNewlines)
        let num = store.liveState.incomingCallerNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty { return name }
        if !num.isEmpty { return num }
        return "Gelen Çağrı"
    }

    private var callerNumberOnly: String {
        let name = store.liveState.incomingCallerName.trimmingCharacters(in: .whitespacesAndNewlines)
        let num = store.liveState.incomingCallerNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        if !num.isEmpty && num != name {
            return num
        }
        return ""
    }

    private var callStatusSubtitle: String {
        if isRinging {
            if !callerNumberOnly.isEmpty {
                return "Runa Sesli Arama • \(callerNumberOnly)"
            }
            return "Runa Sesli Arama..."
        }
        if store.liveState.isOnHold {
            return "BEKLEMEDE"
        }
        if store.liveState.callStatus == "Calling" {
            return store.hasUserAnsweredCurrentCall ? "bağlanıyor..." : "aranıyor..."
        }
        return WorkspaceContainerView.formatCallDuration(store.liveState.callDurationSeconds)
    }

    private func expandDynamicIslandToFullApp() {
        AudioSessionManager.shared.triggerLightHaptic()
        withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) {
            store.liveState.isDynamicIslandBackgroundMode = false
            isDynamicIslandManuallyExpanded = true
        }
    }

    var body: some View {
        if useCompactDynamicIslandBanner {
            dynamicIslandIncomingBannerView
        } else {
            fullScreenCallKitView
        }
    }

    private var dynamicIslandIncomingBannerView: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                // Tappable Dynamic Island Left/Center Body (Opens full app call screen)
                HStack(spacing: 12) {
                    if isRinging {
                        ZStack {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            Color(red: 0.24, green: 0.27, blue: 0.34),
                                            Color(red: 0.14, green: 0.16, blue: 0.21)
                                        ],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 44, height: 44)

                            Image(systemName: "person.fill")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(Color.white.opacity(0.88))
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Image(systemName: "phone.fill")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(Color.white.opacity(0.55))
                                Text(callerNumberOnly.isEmpty ? "Runa Sesli Arama" : "Runa • \(callerNumberOnly)")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.62))
                                    .lineLimit(1)
                            }

                            Text(callerTitle)
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                        }
                    } else {
                        // Active Call inside Dynamic Island
                        ZStack {
                            Circle()
                                .fill(Color(red: 0.188, green: 0.820, blue: 0.345).opacity(0.22))
                                .frame(width: 42, height: 42)

                            Image(systemName: "waveform")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(Color(red: 0.22, green: 0.90, blue: 0.42))
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 5) {
                                Image(systemName: "phone.fill")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(Color(red: 0.22, green: 0.90, blue: 0.42))
                                Text(callStatusSubtitle)
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.22, green: 0.90, blue: 0.42))
                                    .monospacedDigit()
                                    .lineLimit(1)
                            }

                            Text(callerTitle)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(.white)
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                        }
                    }

                    Spacer(minLength: 4)
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    expandDynamicIslandToFullApp()
                }

                // Right-Side Dynamic Island Action Buttons
                if isRinging {
                    HStack(spacing: 12) {
                        Button {
                            AudioSessionManager.shared.triggerLightHaptic()
                            AudioSessionManager.shared.performCallKitEndCall()
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 1.0, green: 0.231, blue: 0.188))
                                    .frame(width: 42, height: 42)
                                Image(systemName: "phone.down.fill")
                                    .font(.system(size: 17, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }
                        .buttonStyle(.plain)

                        Button {
                            AudioSessionManager.shared.triggerLightHaptic()
                            AudioSessionManager.shared.performCallKitAnswer()
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.188, green: 0.820, blue: 0.345))
                                    .frame(width: 42, height: 42)
                                Image(systemName: "phone.fill")
                                    .font(.system(size: 17, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    HStack(spacing: 8) {
                        Button {
                            AudioSessionManager.shared.performCallKitSetMuted(!store.liveState.isMuted)
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(store.liveState.isMuted ? Color.white : Color.white.opacity(0.16))
                                    .frame(width: 38, height: 38)
                                Image(systemName: "mic.slash.fill")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(store.liveState.isMuted ? .black : .white)
                            }
                        }
                        .buttonStyle(.plain)

                        Button {
                            AudioSessionManager.shared.performCallKitToggleSpeaker(!store.liveState.isSpeakerOn)
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(store.liveState.isSpeakerOn ? Color.white : Color.white.opacity(0.16))
                                    .frame(width: 38, height: 38)
                                Image(systemName: "speaker.wave.3.fill")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(store.liveState.isSpeakerOn ? .black : .white)
                            }
                        }
                        .buttonStyle(.plain)

                        Button {
                            AudioSessionManager.shared.triggerLightHaptic()
                            AudioSessionManager.shared.performCallKitEndCall()
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 1.0, green: 0.231, blue: 0.188))
                                    .frame(width: 40, height: 40)
                                Image(systemName: "phone.down.fill")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.top, 40)
            .padding(.bottom, 16)
            .padding(.horizontal, 18)
            .background(
                RoundedRectangle(cornerRadius: 42, style: .continuous)
                    .fill(Color.black)
                    .overlay(
                        RoundedRectangle(cornerRadius: 42, style: .continuous)
                            .stroke(Color.white.opacity(0.14), lineWidth: 0.8)
                    )
                    .shadow(color: Color.black.opacity(0.55), radius: 24, x: 0, y: 12)
            )
            .padding(.horizontal, 11)
            .padding(.top, 11)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .ignoresSafeArea(.all)
    }

    private var fullScreenCallKitView: some View {
        ZStack {
            // Authentic iOS CallKit dark blurred wallpaper gradient
            LinearGradient(
                colors: [
                    Color(red: 0.11, green: 0.13, blue: 0.18),
                    Color(red: 0.06, green: 0.08, blue: 0.12),
                    Color(red: 0.03, green: 0.04, blue: 0.07)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea(.all)

            VStack(spacing: 0) {
                Spacer().frame(height: 84)

                // Top iOS CallKit Caller Identity & Live Timer Header
                VStack(spacing: 8) {
                    if showKeypad && !dtmfDigitsTyped.isEmpty {
                        Text(dtmfDigitsTyped)
                            .font(.system(size: 34, weight: .regular, design: .rounded))
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                            .padding(.horizontal, 28)
                    } else {
                        Text(callerTitle)
                            .font(.system(size: 36, weight: .medium))
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)
                            .padding(.horizontal, 24)

                        Text(callStatusSubtitle)
                            .font(.system(size: 19, weight: .regular))
                            .foregroundColor(Color.white.opacity(0.72))
                            .monospacedDigit()

                        if store.liveState.networkQuality == "poor" || store.liveState.networkQuality == "fair" {
                            HStack(spacing: 6) {
                                Image(systemName: "wifi.exclamationmark")
                                    .font(.system(size: 12, weight: .bold))
                                Text(
                                    store.liveState.networkQuality == "poor"
                                    ? "Ağ Kalitesi Zayıf (\(store.liveState.networkRttMs) ms) • Ses kesintisi olabilir"
                                    : "Ağ Dalgalı (\(store.liveState.networkRttMs) ms)"
                                )
                                .font(.system(size: 12, weight: .semibold))
                                .lineLimit(1)
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .background(
                                (store.liveState.networkQuality == "poor"
                                 ? Color(red: 0.94, green: 0.22, blue: 0.34)
                                 : Color(red: 0.92, green: 0.56, blue: 0.08))
                                .opacity(0.88)
                            )
                            .clipShape(Capsule())
                            .padding(.top, 4)
                        }
                    }
                }

                Spacer()

                if isRinging {
                    if store.liveState.incomingCallWasLocked {
                        // ==============================================================
                        // 1A. iOS LOCK SCREEN CALLKIT INCOMING CALL ("yanıtlamak için kaydırın")
                        //     No Reddet button (rejected by double-pressing Lock button)
                        // ==============================================================
                        VStack(spacing: 42) {
                            HStack {
                                VStack(spacing: 8) {
                                    Image(systemName: "alarm.fill")
                                        .font(.system(size: 21, weight: .regular))
                                        .foregroundColor(.white)
                                    Text("Anımsat")
                                        .font(.system(size: 13, weight: .regular))
                                        .foregroundColor(.white)
                                }
                                .opacity(0.9)

                                Spacer()

                                VStack(spacing: 8) {
                                    Image(systemName: "message.fill")
                                        .font(.system(size: 21, weight: .regular))
                                        .foregroundColor(.white)
                                    Text("Mesaj")
                                        .font(.system(size: 13, weight: .regular))
                                        .foregroundColor(.white)
                                }
                                .opacity(0.9)
                            }
                            .frame(width: 244)

                            // Native iOS "yanıtlamak için kaydırın" (Slide to Answer) Interactive Slider
                            SlideToAnswerCallKitBar {
                                AudioSessionManager.shared.performCallKitAnswer()
                            }
                        }
                        .padding(.bottom, 64)
                    } else {
                        // ==============================================================
                        // 1B. iOS UNLOCKED CALLKIT INCOMING CALL (Red "Reddet" & Green "Kabul Et")
                        // ==============================================================
                        VStack(spacing: 38) {
                            HStack(spacing: 112) {
                                VStack(spacing: 8) {
                                    Image(systemName: "alarm.fill")
                                        .font(.system(size: 21, weight: .regular))
                                        .foregroundColor(.white)
                                    Text("Anımsat")
                                        .font(.system(size: 13, weight: .regular))
                                        .foregroundColor(.white)
                                }
                                .frame(width: 78)
                                .opacity(0.9)

                                VStack(spacing: 8) {
                                    Image(systemName: "message.fill")
                                        .font(.system(size: 21, weight: .regular))
                                        .foregroundColor(.white)
                                    Text("Mesaj")
                                        .font(.system(size: 13, weight: .regular))
                                        .foregroundColor(.white)
                                }
                                .frame(width: 78)
                                .opacity(0.9)
                            }

                            HStack(spacing: 112) {
                                Button {
                                    AudioSessionManager.shared.triggerLightHaptic()
                                    AudioSessionManager.shared.performCallKitEndCall()
                                } label: {
                                    VStack(spacing: 12) {
                                        ZStack {
                                            Circle()
                                                .fill(Color(red: 1.0, green: 0.231, blue: 0.188))
                                                .frame(width: 76, height: 76)
                                                .shadow(color: Color(red: 1.0, green: 0.231, blue: 0.188).opacity(0.38), radius: 10, x: 0, y: 4)
                                            Image(systemName: "phone.down.fill")
                                                .font(.system(size: 30, weight: .semibold))
                                                .foregroundColor(.white)
                                        }
                                        Text("Reddet")
                                            .font(.system(size: 15, weight: .regular))
                                            .foregroundColor(.white)
                                    }
                                    .frame(width: 78)
                                }
                                .buttonStyle(.plain)

                                Button {
                                    AudioSessionManager.shared.triggerLightHaptic()
                                    AudioSessionManager.shared.performCallKitAnswer()
                                } label: {
                                    VStack(spacing: 12) {
                                        ZStack {
                                            Circle()
                                                .fill(Color(red: 0.188, green: 0.820, blue: 0.345))
                                                .frame(width: 76, height: 76)
                                                .shadow(color: Color(red: 0.188, green: 0.820, blue: 0.345).opacity(0.38), radius: 10, x: 0, y: 4)
                                            Image(systemName: "phone.fill")
                                                .font(.system(size: 30, weight: .semibold))
                                                .foregroundColor(.white)
                                        }
                                        Text("Kabul Et")
                                            .font(.system(size: 15, weight: .regular))
                                            .foregroundColor(.white)
                                    }
                                    .frame(width: 78)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.bottom, 64)
                    }
                } else {
                    // ==============================================================
                    // 2. iOS NATIVE CALLKIT IN-CALL SCREEN (6-Button Grid / DTMF Keypad)
                    // ==============================================================
                    if showKeypad {
                        callKitDTMFKeypadView
                            .padding(.bottom, 28)
                    } else {
                        callKitSixButtonGridView
                            .padding(.bottom, 44)
                    }

                    // Bottom Row: Red End Call Button (+ "Gizle" when Keypad is open)
                    ZStack {
                        Button {
                            AudioSessionManager.shared.triggerLightHaptic()
                            AudioSessionManager.shared.performCallKitEndCall()
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 1.0, green: 0.231, blue: 0.188))
                                    .frame(width: 76, height: 76)
                                    .shadow(color: Color(red: 1.0, green: 0.231, blue: 0.188).opacity(0.4), radius: 12, x: 0, y: 4)

                                Image(systemName: "phone.down.fill")
                                    .font(.system(size: 30, weight: .semibold))
                                    .foregroundColor(.white)
                            }
                        }
                        .buttonStyle(.plain)

                        if showKeypad {
                            HStack {
                                Spacer()
                                Button {
                                    AudioSessionManager.shared.triggerLightHaptic()
                                    withAnimation(.easeInOut(duration: 0.18)) {
                                        showKeypad = false
                                    }
                                } label: {
                                    Text("Gizle")
                                        .font(.system(size: 17, weight: .medium))
                                        .foregroundColor(.white)
                                        .padding(.trailing, 46)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 64)
                }
            }
        }
    }

    private var callKitSixButtonGridView: some View {
        VStack(spacing: 26) {
            HStack(spacing: 32) {
                callKitCircleControlButton(
                    icon: "mic.slash.fill",
                    label: "sessiz",
                    isActive: store.liveState.isMuted
                ) {
                    AudioSessionManager.shared.performCallKitSetMuted(!store.liveState.isMuted)
                }

                callKitCircleControlButton(
                    icon: "circle.grid.3x3.fill",
                    label: "klavye",
                    isActive: showKeypad
                ) {
                    AudioSessionManager.shared.triggerLightHaptic()
                    withAnimation(.easeInOut(duration: 0.18)) {
                        showKeypad = true
                    }
                }

                callKitCircleControlButton(
                    icon: "speaker.wave.3.fill",
                    label: "ses",
                    isActive: store.liveState.isSpeakerOn
                ) {
                    AudioSessionManager.shared.performCallKitToggleSpeaker(!store.liveState.isSpeakerOn)
                }
            }

            HStack(spacing: 32) {
                callKitCircleControlButton(
                    icon: "plus",
                    label: "arama ekle",
                    isActive: false
                ) {
                    onOpenAppPBXControls()
                }

                callKitCircleControlButton(
                    icon: "phone.connection.fill",
                    label: "Runa",
                    isActive: false
                ) {
                    onOpenAppPBXControls()
                }

                callKitCircleControlButton(
                    icon: "pause.fill",
                    label: "beklet",
                    isActive: store.liveState.isOnHold
                ) {
                    AudioSessionManager.shared.performCallKitSetHeld(!store.liveState.isOnHold)
                }
            }
        }
    }

    private var callKitDTMFKeypadView: some View {
        let rows: [[(digit: String, letters: String)]] = [
            [("1", ""), ("2", "ABC"), ("3", "DEF")],
            [("4", "GHI"), ("5", "JKL"), ("6", "MNO")],
            [("7", "PQRS"), ("8", "TUV"), ("9", "WXYZ")],
            [("*", ""), ("0", "+"), ("#", "")]
        ]
        return VStack(spacing: 16) {
            ForEach(0..<rows.count, id: \.self) { rIdx in
                HStack(spacing: 26) {
                    ForEach(rows[rIdx], id: \.digit) { item in
                        Button {
                            dtmfDigitsTyped.append(item.digit)
                            AudioSessionManager.shared.performCallKitPlayDTMF(item.digit)
                        } label: {
                            VStack(spacing: 1) {
                                Text(item.digit)
                                    .font(.system(size: 32, weight: .regular))
                                    .foregroundColor(.white)
                                if !item.letters.isEmpty {
                                    Text(item.letters)
                                        .font(.system(size: 10, weight: .bold))
                                        .tracking(1.4)
                                        .foregroundColor(Color.white.opacity(0.75))
                                }
                            }
                            .frame(width: 76, height: 76)
                            .background(Color.white.opacity(0.14))
                            .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func callKitCircleControlButton(
        icon: String,
        label: String,
        isActive: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(isActive ? Color.white : Color.white.opacity(0.14))
                        .frame(width: 76, height: 76)

                    Image(systemName: icon)
                        .font(.system(size: 28, weight: .regular))
                        .foregroundColor(isActive ? Color(red: 0.08, green: 0.10, blue: 0.15) : .white)
                }

                Text(label)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundColor(.white)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct SlideToAnswerCallKitBar: View {
    let onSlideCompleted: () -> Void

    private let trackWidth: CGFloat = 312
    private let trackHeight: CGFloat = 78
    private let knobSize: CGFloat = 68
    private let horizontalPadding: CGFloat = 5

    @State private var dragOffset: CGFloat = 0
    @State private var isAnswered: Bool = false

    private var maxDragDistance: CGFloat {
        trackWidth - knobSize - (horizontalPadding * 2)
    }

    var body: some View {
        ZStack(alignment: .leading) {
            // Frosted Glass Track
            Capsule(style: .continuous)
                .fill(Color.white.opacity(0.14))
                .frame(width: trackWidth, height: trackHeight)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(Color.white.opacity(0.18), lineWidth: 0.8)
                )

            // Centered "yanıtlamak için kaydırın" label
            HStack {
                Spacer().frame(width: knobSize + 10)
                Text("yanıtlamak için kaydırın")
                    .font(.system(size: 19, weight: .regular))
                    .foregroundColor(Color.white.opacity(Double(max(0.0, 0.88 - (dragOffset / maxDragDistance)))))
                Spacer()
            }
            .frame(width: trackWidth, height: trackHeight)

            // Draggable White/Green Phone Knob
            ZStack {
                Circle()
                    .fill(Color.white)
                    .frame(width: knobSize, height: knobSize)
                    .shadow(color: Color.black.opacity(0.25), radius: 6, x: 0, y: 3)

                Image(systemName: "phone.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundColor(Color(red: 0.18, green: 0.78, blue: 0.34))
            }
            .padding(.leading, horizontalPadding)
            .offset(x: dragOffset)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard !isAnswered else { return }
                        let clamped = min(max(0, value.translation.width), maxDragDistance)
                        dragOffset = clamped
                    }
                    .onEnded { value in
                        guard !isAnswered else { return }
                        if dragOffset >= maxDragDistance * 0.62 || value.predictedEndTranslation.width >= maxDragDistance * 0.75 {
                            isAnswered = true
                            withAnimation(.spring(response: 0.22, dampingFraction: 0.82)) {
                                dragOffset = maxDragDistance
                            }
                            let generator = UIImpactFeedbackGenerator(style: .rigid)
                            generator.impactOccurred()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
                                onSlideCompleted()
                            }
                        } else {
                            withAnimation(.spring(response: 0.32, dampingFraction: 0.78)) {
                                dragOffset = 0
                            }
                        }
                    }
            )
        }
        .frame(width: trackWidth, height: trackHeight)
    }
}
