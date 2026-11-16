import SwiftUI
import AVFoundation

struct QRScannerSheet: View {
    @Environment(\.dismiss) private var dismiss
    var onScanned: (String) -> Void

    @State private var torchOn: Bool = false

    var body: some View {
        ZStack {
            Color(red: 0.035, green: 0.05, blue: 0.086)
                .ignoresSafeArea()

            VStack(spacing: 18) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("QR Kod ile Giriş")
                            .font(.system(size: 17, weight: .heavy))
                            .foregroundColor(.white)
                        Text("Web paneldeki Uygulamalar sekmesinde yer alan QR kodu okutun")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.65))
                    }
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 34, height: 34)
                            .background(Color.white.opacity(0.1))
                            .clipShape(Circle())
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)

                ZStack {
                    QRCameraPreview(torchOn: $torchOn) { code in
                        AudioSessionManager.shared.triggerLightHaptic()
                        dismiss()
                        onScanned(code)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .stroke(Color.white.opacity(0.16), lineWidth: 1)
                    )

                    // Viewfinder frame
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [Color(red: 0.88, green: 0.11, blue: 0.28), Color(red: 0.39, green: 0.4, blue: 0.95)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            style: StrokeStyle(lineWidth: 3, dash: [18, 8])
                        )
                        .frame(width: 230, height: 230)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 360)
                .padding(.horizontal, 20)

                HStack(spacing: 12) {
                    Button {
                        torchOn.toggle()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: torchOn ? "flashlight.on.fill" : "flashlight.off.fill")
                            Text(torchOn ? "Fener Açık" : "Feneri Aç")
                        }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.vertical, 12)
                        .frame(maxWidth: .infinity)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }

                    Button {
                        dismiss()
                    } label: {
                        Text("Vazgeç")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.vertical, 12)
                            .frame(maxWidth: .infinity)
                            .background(Color.white.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
                .padding(.horizontal, 20)

                Spacer()
            }
        }
    }
}

struct QRCameraPreview: UIViewControllerRepresentable {
    @Binding var torchOn: Bool
    var onCodeDetected: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerVC {
        let vc = ScannerVC()
        vc.onCodeDetected = onCodeDetected
        return vc
    }

    func updateUIViewController(_ uiViewController: ScannerVC, context: Context) {
        uiViewController.setTorch(torchOn)
    }

    final class ScannerVC: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
        var onCodeDetected: ((String) -> Void)?
        private let captureSession = AVCaptureSession()
        private var previewLayer: AVCaptureVideoPreviewLayer?
        private var didDetect = false

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = UIColor(red: 0.05, green: 0.07, blue: 0.12, alpha: 1.0)
            setupCamera()
        }

        override func viewDidLayoutSubviews() {
            super.viewDidLayoutSubviews()
            previewLayer?.frame = view.bounds
        }

        private func setupCamera() {
            guard let videoCaptureDevice = AVCaptureDevice.default(for: .video),
                  let videoInput = try? AVCaptureDeviceInput(device: videoCaptureDevice),
                  captureSession.canAddInput(videoInput) else {
                let label = UILabel()
                label.text = "Kamera başlatılıyor...\n(Gerçek iPhone cihazda QR kodu çerçeveye hizalayın)"
                label.textColor = UIColor.white.withAlphaComponent(0.7)
                label.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
                label.numberOfLines = 0
                label.textAlignment = .center
                label.translatesAutoresizingMaskIntoConstraints = false
                view.addSubview(label)
                NSLayoutConstraint.activate([
                    label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
                    label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
                    label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
                ])
                return
            }

            captureSession.addInput(videoInput)
            let metadataOutput = AVCaptureMetadataOutput()
            if captureSession.canAddOutput(metadataOutput) {
                captureSession.addOutput(metadataOutput)
                metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
                metadataOutput.metadataObjectTypes = [.qr]
            }

            let layer = AVCaptureVideoPreviewLayer(session: captureSession)
            layer.frame = view.layer.bounds
            layer.videoGravity = .resizeAspectFill
            view.layer.addSublayer(layer)
            self.previewLayer = layer

            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.captureSession.startRunning()
            }
        }

        func setTorch(_ on: Bool) {
            guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else { return }
            try? device.lockForConfiguration()
            device.torchMode = on ? .on : .off
            device.unlockForConfiguration()
        }

        func metadataOutput(
            _ output: AVCaptureMetadataOutput,
            didOutput metadataObjects: [AVMetadataObject],
            from connection: AVCaptureConnection
        ) {
            guard !didDetect,
                  let readable = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
                  let str = readable.stringValue,
                  !str.isEmpty else { return }
            didDetect = true
            captureSession.stopRunning()
            onCodeDetected?(str)
        }
    }
}
