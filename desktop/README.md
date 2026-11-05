# AIDA Agent — Masaüstü Temsilci Uygulaması (macOS & Windows)

`AIDA Agent`, çağrı merkezi temsilcilerinin tarayıcıya ihtiyaç duymadan bilgisayarlarında çalıştırabilecekleri, **Temsilci Çağrı Paneli**'ndeki 10 modülün tamamını, yetkiye bağlı **Omnichannel** ekranını, işletim sistemi bildirimlerini ve **3 bağımsız ses donanımı yönlendirmesini** (Mikrofon, Görüşme Kulaklığı, Çalma Tonu Hoparlörü) barındıran Electron tabanlı masaüstü uygulamasıdır.

## Geliştirme Modunda Çalıştırma

```bash
cd desktop
npm install
npm start
```

## Kurulum Paketi Üretme (`.dmg` ve `.exe`)

- **macOS Kurulum Paketi (`.dmg` & `.zip` - Apple Silicon + Intel):**
  ```bash
  cd desktop
  npm run dist:mac
  ```
  Üretilen paketler `desktop/dist/` klasörüne kaydedilir.

- **Windows Kurulum Sihirbazı (`.exe` NSIS Setup & Portable):**
  ```bash
  cd desktop
  npm run dist:win
  ```
  Üretilen `.exe` kurulum dosyaları `desktop/dist/` klasörüne kaydedilir.

## Uygulama İsmini Değiştirme

İleride uygulama adını değiştirmek için yalnızca şu iki dosyadaki `AIDA Agent` değerini güncellemeniz yeterlidir:
1. `desktop/package.json` (`build.productName` ve `build.nsis.shortcutName`)
2. `desktop/src/config.js` (`APP_BRAND.appName`)
