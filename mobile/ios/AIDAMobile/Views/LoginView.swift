import SwiftUI
import UIKit

struct LoginView: View {
    @ObservedObject var store: AppConfigStore

    @State private var hostInput: String = ""
    @State private var usernameInput: String = ""
    @State private var passwordInput: String = ""
    @State private var showPassword: Bool = false
    @State private var rememberMe: Bool = true

    @State private var isLoading: Bool = false
    @State private var errorMessage: String = ""
    @State private var infoMessage: String = ""

    @State private var pending2FA: Pending2FAContext? = nil
    @State private var otpCodeInput: String = ""
    @State private var isScannerPresented: Bool = false

    private let indigoStart = Color(red: 0.310, green: 0.275, blue: 0.898) // #4f46e5
    private let purpleMid = Color(red: 0.576, green: 0.200, blue: 0.918)   // #9333ea
    private let violetEnd = Color(red: 0.486, green: 0.227, blue: 0.929)   // #7c3aed

    private let rainbowColors: [Color] = [
        Color(red: 0.086, green: 0.639, blue: 0.290), // #16A34A
        Color(red: 0.008, green: 0.518, blue: 0.780), // #0284C7
        Color(red: 0.486, green: 0.227, blue: 0.929), // #7C3AED
        Color(red: 0.859, green: 0.153, blue: 0.467), // #DB2777
        Color(red: 0.918, green: 0.345, blue: 0.047)  // #EA580C
    ]

    private var isDark: Bool {
        store.isWebDarkMode
    }

    private var pageBg: Color {
        isDark
            ? Color(red: 0.024, green: 0.039, blue: 0.071)
            : Color(red: 0.973, green: 0.980, blue: 0.988) // #f8fafc
    }

    private var cardBg: Color {
        isDark
            ? Color(red: 0.059, green: 0.090, blue: 0.165).opacity(0.92)
            : Color.white
    }

    private var cardBorder: Color {
        isDark
            ? Color.white.opacity(0.09)
            : Color(red: 0.886, green: 0.910, blue: 0.941) // #e2e8f0
    }

    private var cardShadow: Color {
        isDark
            ? Color.black.opacity(0.55)
            : Color(red: 0.059, green: 0.090, blue: 0.165).opacity(0.08)
    }

    private var inputBg: Color {
        isDark
            ? Color(red: 0.02, green: 0.035, blue: 0.078).opacity(0.85)
            : Color(red: 0.973, green: 0.980, blue: 0.988) // #f8fafc
    }

    private var inputBorder: Color {
        isDark
            ? Color.white.opacity(0.11)
            : Color(red: 0.820, green: 0.855, blue: 0.902) // #cbd5e1
    }

    private var primaryText: Color {
        isDark
            ? Color.white
            : Color(red: 0.059, green: 0.090, blue: 0.165) // #0f172a
    }

    private var secondaryText: Color {
        isDark
            ? Color.white.opacity(0.65)
            : Color(red: 0.392, green: 0.455, blue: 0.545) // #64748b
    }

    private var mutedText: Color {
        isDark
            ? Color.white.opacity(0.55)
            : Color(red: 0.471, green: 0.529, blue: 0.616) // #78879d
    }

    private var dividerColor: Color {
        isDark
            ? Color.white.opacity(0.08)
            : Color(red: 0.886, green: 0.910, blue: 0.941)
    }

    var body: some View {
        ZStack {
            // Ambient Background
            pageBg
                .ignoresSafeArea()

            // Colorful Aurora Orbs matching Option 2
            Circle()
                .fill(Color(red: 0.086, green: 0.639, blue: 0.290).opacity(isDark ? 0.16 : 0.12))
                .frame(width: 280, height: 280)
                .blur(radius: 75)
                .offset(x: -130, y: -260)

            Circle()
                .fill(Color(red: 0.008, green: 0.518, blue: 0.780).opacity(isDark ? 0.16 : 0.12))
                .frame(width: 280, height: 280)
                .blur(radius: 75)
                .offset(x: 130, y: -210)

            Circle()
                .fill(Color(red: 0.486, green: 0.227, blue: 0.929).opacity(isDark ? 0.18 : 0.12))
                .frame(width: 300, height: 300)
                .blur(radius: 80)
                .offset(x: -100, y: 260)

            Circle()
                .fill(Color(red: 0.918, green: 0.345, blue: 0.047).opacity(isDark ? 0.15 : 0.11))
                .frame(width: 260, height: 260)
                .blur(radius: 75)
                .offset(x: 130, y: 240)

            // Decorative subtle soundwave curves in background
            GeometryReader { geo in
                let w = geo.size.width
                let midY = geo.size.height * 0.50
                ZStack {
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: midY))
                        path.addQuadCurve(
                            to: CGPoint(x: w * 0.5, y: midY),
                            control: CGPoint(x: w * 0.25, y: midY - 70)
                        )
                        path.addQuadCurve(
                            to: CGPoint(x: w, y: midY),
                            control: CGPoint(x: w * 0.75, y: midY + 70)
                        )
                    }
                    .stroke(
                        LinearGradient(colors: rainbowColors, startPoint: .leading, endPoint: .trailing),
                        style: StrokeStyle(lineWidth: 2.2, lineCap: .round)
                    )
                    .opacity(isDark ? 0.22 : 0.26)

                    Path { path in
                        path.move(to: CGPoint(x: 0, y: midY))
                        path.addQuadCurve(
                            to: CGPoint(x: w * 0.5, y: midY),
                            control: CGPoint(x: w * 0.25, y: midY + 70)
                        )
                        path.addQuadCurve(
                            to: CGPoint(x: w, y: midY),
                            control: CGPoint(x: w * 0.75, y: midY - 70)
                        )
                    }
                    .stroke(
                        LinearGradient(colors: rainbowColors, startPoint: .leading, endPoint: .trailing),
                        style: StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [6, 6])
                    )
                    .opacity(isDark ? 0.18 : 0.22)
                }
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    // Main Card with Rainbow Top Bar
                    VStack(spacing: 0) {
                        LinearGradient(
                            colors: rainbowColors,
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(height: 7)

                        VStack(spacing: 18) {
                            brandHeader
                            Divider().background(dividerColor)

                            if !errorMessage.isEmpty {
                                alertBanner(text: errorMessage, isError: true)
                            }
                            if !infoMessage.isEmpty {
                                alertBanner(text: infoMessage, isError: false)
                            }

                            if let ctx = pending2FA {
                                twoFactorSection(context: ctx)
                            } else {
                                credentialsForm
                            }
                        }
                        .padding(22)
                    }
                    .background(cardBg)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(cardBorder, lineWidth: 1)
                    )
                    .shadow(color: Color(red: 0.310, green: 0.275, blue: 0.898).opacity(isDark ? 0.28 : 0.12), radius: 28, x: 0, y: 14)

                    // Bottom 3 Capability Pills
                    HStack(spacing: 6) {
                        capabilityPill(icon: "waveform.badge.mic", iconColor: Color(red: 0.008, green: 0.518, blue: 0.780), title: "AI Sesli Asistan")
                        capabilityPill(icon: "bubble.left.and.bubble.right.fill", iconColor: Color(red: 0.486, green: 0.227, blue: 0.929), title: "Omnichannel")
                        runaMobilePill
                    }

                    Text("© 2026 RUNA. Tüm hakları saklıdır.")
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundColor(mutedText.opacity(0.85))
                        .padding(.top, 2)
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 20)
            }
        }
        .onAppear {
            hostInput = store.serverHost
            usernameInput = store.savedUsername
            rememberMe = store.rememberMe
        }
        .sheet(isPresented: $isScannerPresented) {
            QRScannerSheet { scannedStr in
                Task {
                    await submitQRLogin(scannedPayload: scannedStr)
                }
            }
        }
    }

    private var brandHeader: some View {
        HStack(spacing: 14) {
            Group {
                if let path = Bundle.main.path(forResource: "RunaLogo", ofType: "png"),
                   let uiImg = UIImage(contentsOfFile: path) {
                    Image(uiImage: uiImg)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 46, height: 46)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .shadow(color: Color.black.opacity(0.12), radius: 8, x: 0, y: 4)
                } else {
                    ZStack {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [Color(red: 0.388, green: 0.400, blue: 0.945), Color(red: 0.486, green: 0.227, blue: 0.929)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 46, height: 46)
                        Text("R")
                            .font(.system(size: 22, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("Runa")
                    .font(.system(size: 20, weight: .heavy))
                    .foregroundColor(primaryText)

                Text("MOBİL TEMSİLCİ ÇAĞRI PANELİ")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.8)
                    .foregroundColor(mutedText)
            }

            Spacer()

            // Top-Right QR Scanner Icon Button
            Button {
                AudioSessionManager.shared.triggerLightHaptic()
                errorMessage = ""
                infoMessage = ""
                isScannerPresented = true
            } label: {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(primaryText)
                    .frame(width: 42, height: 42)
                    .background(isDark ? Color.white.opacity(0.08) : Color(red: 0.945, green: 0.961, blue: 0.976))
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .stroke(isDark ? Color.white.opacity(0.14) : cardBorder, lineWidth: 1)
                    )
            }
            .accessibilityLabel("QR Kod ile Giriş")
        }
    }

    private var credentialsForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Host Field
            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("SUNUCU ADRESİ (HOST)")
                TextField("Örn: santral.sirketiniz.com veya 192.168.1.50", text: $hostInput)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(primaryText)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(inputBg)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(inputBorder, lineWidth: 1)
                    )

                if !store.recentHosts.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(store.recentHosts, id: \.self) { h in
                                HStack(spacing: 6) {
                                    Button {
                                        hostInput = h
                                    } label: {
                                        Text(h)
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundColor(isDark ? Color.white.opacity(0.8) : primaryText)
                                    }
                                    Button {
                                        store.removeRecentHost(h)
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.system(size: 9, weight: .bold))
                                            .foregroundColor(mutedText)
                                    }
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(isDark ? Color.white.opacity(0.06) : Color(red: 0.945, green: 0.961, blue: 0.976))
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(isDark ? Color.white.opacity(0.1) : cardBorder, lineWidth: 1))
                            }
                        }
                    }
                    .padding(.top, 2)
                }
            }

            // Username Field
            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("KULLANICI ADI VEYA DAHİLİ")
                TextField("1000, kullanici@firma.com veya admin", text: $usernameInput)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(primaryText)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(inputBg)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(inputBorder, lineWidth: 1)
                    )
            }

            // Password Field with Eye Icon
            VStack(alignment: .leading, spacing: 6) {
                fieldLabel("ŞİFRE")
                HStack(spacing: 8) {
                    Group {
                        if showPassword {
                            TextField("••••••••", text: $passwordInput)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled(true)
                        } else {
                            SecureField("••••••••", text: $passwordInput)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled(true)
                        }
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(primaryText)

                    Button {
                        showPassword.toggle()
                    } label: {
                        Image(systemName: showPassword ? "eye.slash" : "eye")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(mutedText)
                            .frame(width: 28, height: 28)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(inputBg)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(inputBorder, lineWidth: 1)
                )
            }

            rememberMeCheckbox

            primarySubmitButton(title: "Giriş Yap", loadingTitle: "Giriş Yapılıyor...") {
                Task { await submitCredentialsLogin() }
            }
        }
    }

    private func twoFactorSection(context: Pending2FAContext) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(indigoStart)
                VStack(alignment: .leading, spacing: 2) {
                    Text(
                        context.method == "google_auth"
                            ? "Google Authenticator Kodu"
                            : context.method == "whatsapp"
                            ? "WhatsApp Doğrulama Kodu"
                            : "E-Posta Doğrulama Kodu"
                    )
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundColor(primaryText)

                    Text("Lütfen 6 haneli güvenlik kodunu giriniz.")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(secondaryText)
                }
            }

            TextField("000000", text: $otpCodeInput)
                .keyboardType(.numberPad)
                .font(.system(size: 22, weight: .heavy, design: .monospaced))
                .multilineTextAlignment(.center)
                .foregroundColor(primaryText)
                .padding(.vertical, 12)
                .background(inputBg)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(inputBorder, lineWidth: 1)
                )

            primarySubmitButton(title: "Kodu Doğrula ve Giriş Yap", loadingTitle: "Doğrulanıyor...") {
                Task { await submit2FAVerification(context: context) }
            }

            HStack {
                Button {
                    pending2FA = nil
                    otpCodeInput = ""
                    errorMessage = ""
                    infoMessage = ""
                } label: {
                    Text("← Geri Dön")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(secondaryText)
                }

                Spacer()

                if context.method == "email" || context.method == "whatsapp" {
                    Button {
                        Task { await resend2FA(context: context) }
                    } label: {
                        Text("Kodu Tekrar Gönder")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(indigoStart)
                    }
                }
            }
        }
    }

    private var rememberMeCheckbox: some View {
        Button {
            rememberMe.toggle()
        } label: {
            HStack(spacing: 9) {
                Image(systemName: rememberMe ? "checkmark.square.fill" : "square")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(rememberMe ? Color(red: 0.388, green: 0.400, blue: 0.945) : mutedText)
                Text("Beni hatırla")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(isDark ? Color.white.opacity(0.75) : primaryText)
                Spacer()
            }
        }
        .buttonStyle(.plain)
    }

    private func capabilityPill(icon: String, iconColor: Color, title: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10.5, weight: .bold))
                .foregroundColor(iconColor)
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(isDark ? Color.white.opacity(0.85) : Color(red: 0.278, green: 0.333, blue: 0.412))
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .background(cardBg.opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .stroke(cardBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
    }

    private var runaMobilePill: some View {
        HStack(spacing: 4) {
            if let path = Bundle.main.path(forResource: "RunaLogo", ofType: "png"),
               let uiImg = UIImage(contentsOfFile: path) {
                Image(uiImage: uiImg)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 14, height: 14)
                    .clipShape(RoundedRectangle(cornerRadius: 3.5, style: .continuous))
            }
            Text("Runa Mobil")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(isDark ? Color.white.opacity(0.9) : Color(red: 0.20, green: 0.25, blue: 0.33))
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .background(cardBg.opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .stroke(cardBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
    }

    private func primarySubmitButton(title: String, loadingTitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.85)
                }
                Text(isLoading ? loadingTitle : title)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundColor(.white)
                if !isLoading {
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [indigoStart, purpleMid, violetEnd], startPoint: .leading, endPoint: .trailing)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: indigoStart.opacity(0.32), radius: 14, x: 0, y: 6)
        }
        .disabled(isLoading)
        .opacity(isLoading ? 0.7 : 1.0)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .heavy))
            .tracking(0.6)
            .foregroundColor(secondaryText)
    }

    private func alertBanner(text: String, isError: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .font(.system(size: 13, weight: .bold))
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
        .foregroundColor(
            isError
                ? (isDark ? Color(red: 0.99, green: 0.64, blue: 0.69) : Color(red: 0.75, green: 0.07, blue: 0.24))
                : (isDark ? Color(red: 0.43, green: 0.91, blue: 0.72) : Color(red: 0.02, green: 0.47, blue: 0.34))
        )
        .padding(11)
        .background(
            (isError ? Color(red: 0.95, green: 0.25, blue: 0.37) : Color(red: 0.06, green: 0.73, blue: 0.51))
                .opacity(0.14)
        )
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .stroke(
                    (isError ? Color(red: 0.95, green: 0.25, blue: 0.37) : Color(red: 0.06, green: 0.73, blue: 0.51))
                        .opacity(0.35),
                    lineWidth: 1
                )
        )
    }

    // MARK: - Actions

    private func submitCredentialsLogin() async {
        errorMessage = ""
        infoMessage = ""
        isLoading = true
        defer { isLoading = false }

        do {
            let outcome = try await PBXNetworkService.shared.loginWithCredentials(
                host: hostInput,
                username: usernameInput,
                password: passwordInput,
                rememberMe: rememberMe
            )
            switch outcome {
            case .authenticated(let session, let resolved, let popOnCall):
                AudioSessionManager.shared.triggerLightHaptic()
                store.recordLoginSuccess(
                    displayHost: resolved.displayHost,
                    apiOrigin: resolved.apiOrigin,
                    uiOrigin: resolved.uiOrigin,
                    rememberMe: rememberMe,
                    savedUsername: usernameInput.trimmingCharacters(in: .whitespacesAndNewlines),
                    session: session,
                    popWindowOnCall: popOnCall
                )
            case .requires2FA(let ctx):
                pending2FA = ctx
                if ctx.method == "email" || ctx.method == "whatsapp" {
                    if let msg = try? await PBXNetworkService.shared.send2FACode(
                        apiOrigin: ctx.apiOrigin,
                        userId: ctx.userId,
                        method: ctx.method
                    ) {
                        infoMessage = msg
                    }
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func submitQRLogin(scannedPayload: String) async {
        errorMessage = ""
        infoMessage = ""
        let targetStr = scannedPayload.trimmingCharacters(in: .whitespacesAndNewlines)
        isLoading = true
        defer { isLoading = false }

        do {
            let outcome = try await PBXNetworkService.shared.loginWithMagicUrl(
                targetStr,
                fallbackHost: hostInput.isEmpty ? store.serverHost : hostInput,
                rememberMe: rememberMe
            )
            if case .authenticated(let session, let resolved, let popOnCall) = outcome {
                AudioSessionManager.shared.triggerLightHaptic()
                store.recordLoginSuccess(
                    displayHost: resolved.displayHost,
                    apiOrigin: resolved.apiOrigin,
                    uiOrigin: resolved.uiOrigin,
                    rememberMe: rememberMe,
                    savedUsername: session.username,
                    session: session,
                    popWindowOnCall: popOnCall
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func submit2FAVerification(context: Pending2FAContext) async {
        errorMessage = ""
        infoMessage = ""
        let clean = otpCodeInput.filter { $0.isNumber }
        if clean.count < 6 {
            errorMessage = "Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz."
            return
        }
        isLoading = true
        defer { isLoading = false }

        do {
            let session = try await PBXNetworkService.shared.verify2FACode(context: context, code: clean)
            AudioSessionManager.shared.triggerLightHaptic()
            pending2FA = nil
            otpCodeInput = ""
            store.recordLoginSuccess(
                displayHost: context.displayHost,
                apiOrigin: context.apiOrigin,
                uiOrigin: context.uiOrigin,
                rememberMe: context.rememberMe,
                savedUsername: context.username,
                session: session
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func resend2FA(context: Pending2FAContext) async {
        errorMessage = ""
        infoMessage = ""
        do {
            let msg = try await PBXNetworkService.shared.send2FACode(
                apiOrigin: context.apiOrigin,
                userId: context.userId,
                method: context.method
            )
            infoMessage = msg
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
