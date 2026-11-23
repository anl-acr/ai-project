#!/usr/bin/env node
/**
 * Nornia Docs — Sıfır Bağımlılıklı Canlı Santral Ekran Görüntüsü Yakalayıcı (Chrome CDP)
 * ======================================================================================
 * Tüm 48 benzersiz PBX menü ekranını canlı `https://app.nornia.com.tr` üzerinden
 * 1440×900 1.5x Retina (2160×1350) yüksek kaliteli JPEG olarak yakalar.
 *
 * Kullanım:
 *   PBX_URL="https://app.nornia.com.tr" PBX_USER="anl.acr@gmail.com" PBX_PASS="test" \
 *     node scripts/portals/capture_pbx_screenshots.mjs
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PBX_URL = (process.env.PBX_URL || "https://app.nornia.com.tr").replace(/\/+$/, "");
const PBX_USER = process.env.PBX_USER || "anl.acr@gmail.com";
const PBX_PASS = process.env.PBX_PASS || "";
const OUT_ROOT = path.resolve(__dirname, "../../portals/docs-portal/public/screenshots");
const CDP_PORT = Number(process.env.CDP_PORT || 9235);

const TARGETS = [
  { file: "01-system-status.jpg", url: `${PBX_URL}/?tab=sistem-durumu` },
  { file: "02-dashboard.jpg", url: `${PBX_URL}/?tab=pano` },
  { file: "03-wallboard.jpg", url: `${PBX_URL}/?tab=canli-wallboard` },
  { file: "04-realtime-calls.jpg", url: `${PBX_URL}/?tab=canli-cagri-izleme` },
  { file: "04-call-center.jpg", url: `${PBX_URL}/?tab=cagri-merkezi` },
  { file: "05-omnichannel.jpg", url: `${PBX_URL}/?tab=coklu-kanal` },
  { file: "06-api-budgets.jpg", url: `${PBX_URL}/?tab=api-butce-ve-tuketim` },
  { file: "07-ai-config-assistant.jpg", url: `${PBX_URL}/?tab=ai-konfigurasyon-asistani` },
  { file: "08-ai-agents.jpg", url: `${PBX_URL}/?tab=yapay-zeka-temsilcileri` },
  { file: "09-rag-kb.jpg", url: `${PBX_URL}/?tab=bilgi-bankasi` },
  { file: "10-rule-editor.jpg", url: `${PBX_URL}/?tab=kural-editoru` },
  { file: "11-users.jpg", url: `${PBX_URL}/?tab=kullanicilar` },
  { file: "12-announcements.jpg", url: `${PBX_URL}/?tab=anonslar` },
  { file: "13-acd-queues.jpg", url: `${PBX_URL}/?tab=kuyruklar` },
  { file: "14-autoprovision.jpg", url: `${PBX_URL}/?tab=otomatik-kurulum` },
  { file: "15-outbound-rules.jpg", url: `${PBX_URL}/?tab=giden-arama-kurallari` },
  { file: "16-inbound-rules.jpg", url: `${PBX_URL}/?tab=gelen-arama-kurallari` },
  { file: "17-call-pickup-groups.jpg", url: `${PBX_URL}/?tab=cagri-toplama-gruplari` },
  { file: "18-subscriber-groups.jpg", url: `${PBX_URL}/?tab=abone-gruplari` },
  { file: "19-bulk-config.jpg", url: `${PBX_URL}/?tab=toplu-konfigurasyon` },
  { file: "20-contacts.jpg", url: `${PBX_URL}/?tab=rehber` },
  { file: "21-trunks.jpg", url: `${PBX_URL}/?tab=dis-hatlar-sip-trunk` },
  { file: "22-conferences.jpg", url: `${PBX_URL}/?tab=konferans-odalari` },
  { file: "23-speed-dial.jpg", url: `${PBX_URL}/?tab=hizli-arama` },
  { file: "24-blacklist.jpg", url: `${PBX_URL}/?tab=karaliste` },
  { file: "25-scheduled-reports.jpg", url: `${PBX_URL}/?tab=zamanlanmis-raporlar` },
  { file: "26-call-flow.jpg", url: `${PBX_URL}/?tab=arama-akislari` },
  { file: "27-work-hours.jpg", url: `${PBX_URL}/?tab=mesai-ve-tatiller` },
  { file: "28-dialer.jpg", url: `${PBX_URL}/?tab=dis-arama-dialer` },
  { file: "29-calendar.jpg", url: `${PBX_URL}/?tab=takvim` },
  { file: "30-reports-custom-builder.jpg", url: `${PBX_URL}/?tab=ozel-rapor-tasarimcisi` },
  { file: "31-reports-cdr.jpg", url: `${PBX_URL}/?tab=raporlar-detayli-cagri` },
  { file: "32-reports-audio.jpg", url: `${PBX_URL}/?tab=raporlar-ses-kayitlari` },
  { file: "33-reports-qa.jpg", url: `${PBX_URL}/?tab=raporlar-kalite-degerlendirme` },
  { file: "34-reports-breaks.jpg", url: `${PBX_URL}/?tab=mola-ve-puantaj-raporu` },
  { file: "35-reports-queue-sla.jpg", url: `${PBX_URL}/?tab=kuyruk-sla-ve-hiz-dilimleri` },
  { file: "36-reports-voip-quality.jpg", url: `${PBX_URL}/?tab=voip-ses-kalitesi-mos-raporu` },
  { file: "37-settings-pbx.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=santral-ayarlari` },
  { file: "38-settings-ras.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=nornia-connect` },
  { file: "39-settings-federation.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=cok-subeli-santral` },
  { file: "40-settings-roles.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=rol-ve-yetkiler` },
  { file: "41-settings-license.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=musteri-lisanslari` },
  { file: "42-settings-ai-providers.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=yapay-zeka-saglayicilari` },
  { file: "43-settings-api-management.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=dis-api-ve-anahtar-yonetimi` },
  { file: "44-settings-retention.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=sistem-versiyonu` },
  { file: "45-event-logs.jpg", url: `${PBX_URL}/?tab=event-logs` },
  { file: "46-sip-debugger.jpg", url: `${PBX_URL}/?tab=sorun-inceleme` },
  { file: "47-security.jpg", url: `${PBX_URL}/?tab=security` }
];

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    return res?.result?.value;
  }

  async screenshotJpeg(destPath) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const res = await this.send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
    fs.writeFileSync(destPath, Buffer.from(res.data, "base64"));
  }

  close() {
    try {
      this.ws.close();
    } catch (_) {}
  }
}

async function waitForCdpTarget(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const pageTarget = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (pageTarget) return pageTarget.webSocketDebuggerUrl;
      }
    } catch (_) {}
    await sleep(250);
  }
  throw new Error("Chrome CDP hedefleri zamanında açılamadı.");
}

async function main() {
  if (!PBX_PASS) {
    console.error("[HATA] PBX_PASS ortam değişkenini giriniz.");
    process.exit(1);
  }
  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    console.error("[HATA] Google Chrome / Chromium bulunamadı.");
    process.exit(1);
  }

  // Clean old screenshot folders so only current crisp JPEGs exist
  if (fs.existsSync(OUT_ROOT)) {
    fs.rmSync(OUT_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  const profileDir = `/tmp/nornia-chrome-shot-${Date.now()}`;
  const chrome = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--ignore-certificate-errors",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      "--window-size=1440,900",
      "about:blank"
    ],
    { stdio: "ignore" }
  );

  let cdp = null;
  try {
    const wsUrl = await waitForCdpTarget(CDP_PORT);
    cdp = new CDPClient(wsUrl);
    await cdp.connect();

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1.5,
      mobile: false
    });

    console.log(`[1/2] ${PBX_URL}/login üzerinden ${PBX_USER} ile oturum açılıyor...`);
    await cdp.send("Page.navigate", { url: `${PBX_URL}/login` });
    await sleep(2800);

    const loginStatus = await cdp.eval(`
      (() => {
        const setVal = (el, val) => {
          const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          proto.call(el, val);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const uEl = document.querySelector('input[type="text"], input[type="email"], input[name="username"]');
        const pEl = document.querySelector('input[type="password"]');
        if (!uEl || !pEl) return "INPUT_NOT_FOUND";
        setVal(uEl, ${JSON.stringify(PBX_USER)});
        setVal(pEl, ${JSON.stringify(PBX_PASS)});
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
        return "SUBMITTED";
      })()
    `);
    console.log("  → Form durumu:", loginStatus);
    await sleep(4500);

    const hasSession = await cdp.eval("Boolean(localStorage.getItem('current_user_id') || sessionStorage.getItem('current_user_id'))");
    if (!hasSession) {
      throw new Error("Giriş başarısız görünüyor (oturum çerezi/storage oluşmadı).");
    }

    console.log(`[2/2] ${TARGETS.length} menü ekran görüntüsü yakalanıyor...`);
    for (let i = 0; i < TARGETS.length; i++) {
      const t = TARGETS[i];
      process.stdout.write(`  [${String(i + 1).padStart(2, "0")}/${TARGETS.length}] ${t.file} ... `);
      await cdp.send("Page.navigate", { url: t.url });
      await sleep(2100);
      await cdp.eval(`
        (() => {
          document.querySelectorAll('input[type="password"]').forEach((el) => { el.value = ""; });
        })()
      `);
      await cdp.screenshotJpeg(path.join(OUT_ROOT, t.file));
      const sz = Math.round(fs.statSync(path.join(OUT_ROOT, t.file)).size / 1024);
      console.log(`${sz} KB`);
    }

    console.log(`[OK] Tüm ${TARGETS.length} ekran görüntüsü kaydedildi -> ${OUT_ROOT}`);
  } finally {
    if (cdp) cdp.close();
    try {
      chrome.kill("SIGKILL");
    } catch (_) {}
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch((err) => {
  console.error("[HATA]", err);
  process.exit(1);
});
