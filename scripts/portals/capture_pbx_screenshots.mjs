#!/usr/bin/env node
/**
 * Nornia Docs — Sıfır Bağımlılıklı Canlı Santral Ekran Görüntüsü Yakalayıcı (Chrome CDP)
 * ======================================================================================
 * Varsayılan hedef: https://app.saphira.com.tr
 * Yerel Google Chrome / Chromium ikilisi + Node.js yerleşik WebSocket (CDP) ile çalışır.
 *
 * Kullanım:
 *   PBX_URL="https://app.saphira.com.tr" PBX_USER="anl.acr@gmail.com" PBX_PASS="..." \
 *     node scripts/portals/capture_pbx_screenshots.mjs
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PBX_URL = (process.env.PBX_URL || "https://app.nornia.com.tr").replace(/\/+$/, "");
const PBX_USER = process.env.PBX_USER || "admin";
const PBX_PASS = process.env.PBX_PASS || "";
const OUT_ROOT = path.resolve(__dirname, "../../portals/docs-portal/public/screenshots");
const CDP_PORT = Number(process.env.CDP_PORT || 9233);

const TARGETS = [
  { file: "kurulum-ve-ilk-baslangic/02-system-info.png", url: `${PBX_URL}/?tab=sistem-durumu` },
  { file: "kullanicilar-ve-numara-plani/01-users-list.png", url: `${PBX_URL}/?tab=kullanicilar` },
  { file: "kullanicilar-ve-numara-plani/02-numbering-plan.png", url: `${PBX_URL}/?tab=ayarlar&subtab=santral-ayarlari` },
  { file: "dis-hatlar-ve-arama-kurallari/01-trunks.png", url: `${PBX_URL}/?tab=dis-hatlar-sip-trunk` },
  { file: "dis-hatlar-ve-arama-kurallari/02-inbound-outbound.png", url: `${PBX_URL}/?tab=gelen-arama-kurallari` },
  { file: "arama-akisi-ve-ivr/01-call-flow.png", url: `${PBX_URL}/?tab=arama-akislari` },
  { file: "cagri-merkezi-ve-acd/01-call-panel.png", url: `${PBX_URL}/?tab=cagri-merkezi` },
  { file: "cagri-merkezi-ve-acd/02-wallboard.png", url: `${PBX_URL}/?tab=canli-wallboard` },
  { file: "cagri-merkezi-ve-acd/03-queues.png", url: `${PBX_URL}/?tab=kuyruklar` },
  { file: "yapay-zeka-suite/01-ai-agents.png", url: `${PBX_URL}/?tab=yapay-zeka-temsilcileri` },
  { file: "yapay-zeka-suite/02-rag-kb.png", url: `${PBX_URL}/?tab=bilgi-bankasi` },
  { file: "yapay-zeka-suite/03-ai-providers.png", url: `${PBX_URL}/?tab=ayarlar&subtab=yapay-zeka-saglayicilari` },
  { file: "omnichannel-ve-crm/01-omnichannel.png", url: `${PBX_URL}/?tab=coklu-kanal` },
  { file: "omnichannel-ve-crm/02-channels.png", url: `${PBX_URL}/?tab=ayarlar&subtab=kanal-ayarlari` },
  { file: "oto-provizyon-ve-cihazlar/01-autoprovision.png", url: `${PBX_URL}/?tab=otomatik-kurulum` },
  { file: "raporlama-ve-analitik/01-reports-hub.png", url: `${PBX_URL}/?tab=raporlar-pano` },
  { file: "raporlama-ve-analitik/02-cdr.png", url: `${PBX_URL}/?tab=raporlar-detayli-cagri` },
  { file: "ag-guvenlik-ve-merkezi-panel/01-security.png", url: `${PBX_URL}/?tab=ayarlar&subtab=rol-ve-yetkiler` },
  { file: "ag-guvenlik-ve-merkezi-panel/02-sngrep.png", url: `${PBX_URL}/?tab=sorun-inceleme` }
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

  async screenshot(destPath) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const res = await this.send("Page.captureScreenshot", { format: "png" });
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
      deviceScaleFactor: 2,
      mobile: false
    });

    // 1. Login ekranı
    console.log(`[1/3] Giriş ekranı yakalanıyor: ${PBX_URL}/login`);
    await cdp.send("Page.navigate", { url: `${PBX_URL}/login` });
    await sleep(3200);
    await cdp.screenshot(path.join(OUT_ROOT, "kurulum-ve-ilk-baslangic/01-login.png"));

    // 2. React kontrollü form ile giriş yap
    console.log(`[2/3] ${PBX_USER} ile oturum açılıyor...`);
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
    await sleep(5000);

    const curPath = await cdp.eval("window.location.href");
    const hasSession = await cdp.eval("Boolean(localStorage.getItem('current_user_id') || sessionStorage.getItem('current_user_id'))");
    console.log(`  → Oturum sonrası URL: ${curPath} | Oturum: ${hasSession}`);
    if (!hasSession) {
      throw new Error("Giriş başarısız görünüyor (oturum çerezi/storage oluşmadı).");
    }

    // 3. Modül ekran görüntülerini tek tek yakala
    console.log(`[3/3] ${TARGETS.length} modül ekran görüntüsü yakalanıyor...`);
    for (const t of TARGETS) {
      console.log(`  → ${t.file} (${t.url})`);
      await cdp.send("Page.navigate", { url: t.url });
      await sleep(3200);
      // Hassas şifre alanlarını gizle ve açık toast/modal varsa sadeleştir
      await cdp.eval(`
        (() => {
          document.querySelectorAll('input[type="password"]').forEach((el) => { el.value = ""; });
        })()
      `);
      await cdp.screenshot(path.join(OUT_ROOT, t.file));
    }

    console.log(`[OK] Tüm ekran görüntüleri başarıyla kaydedildi -> ${OUT_ROOT}`);
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
