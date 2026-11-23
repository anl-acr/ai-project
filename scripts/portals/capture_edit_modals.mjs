#!/usr/bin/env node
/**
 * Nornia Docs — Düzenleme Modalları & Alt Ayar Ekranları Canlı Görüntü Yakalayıcı
 * ===============================================================================
 * Kullanıcı Düzenle, Kuyruk Düzenle, Dış Hat Düzenle, AI Temsilci Düzenle modalları
 * ve Sistem Ayarları alt ekranlarının canlı ekran görüntülerini yakalar.
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
const CDP_PORT = Number(process.env.CDP_PORT || 9236);

const SUB_SETTINGS_TARGETS = [
  { file: "51-settings-network.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=sunucu-ag-ayarlari` },
  { file: "52-settings-numbering.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=santral-ayarlari`, clickText: "Numara Planı" },
  { file: "53-settings-kvkk.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=kvkk-gizlilik-onayi` },
  { file: "54-settings-ad-ldap.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=active-directory-ldap` },
  { file: "55-settings-ai-routing.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=ai-gorev-yonlendirme` },
  { file: "56-settings-channels.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=kanal-ayarlari` },
  { file: "57-settings-crm.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=hazir-crm-entegrasyonlari` },
  { file: "58-settings-email.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=email-bildirimleri` },
  { file: "59-settings-restore.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=geri-yukleme-noktasi` },
  { file: "60-settings-datetime.jpg", url: `${PBX_URL}/?tab=ayarlar&subtab=tarih-saat` }
];

const MODAL_TARGETS = [
  { file: "61-user-edit-modal.jpg", url: `${PBX_URL}/?tab=kullanicilar`, mode: "edit_first" },
  { file: "62-queue-edit-modal.jpg", url: `${PBX_URL}/?tab=kuyruklar`, mode: "edit_first" },
  { file: "63-trunk-edit-modal.jpg", url: `${PBX_URL}/?tab=dis-hatlar-sip-trunk`, mode: "edit_first" },
  { file: "64-ai-agent-edit-modal.jpg", url: `${PBX_URL}/?tab=yapay-zeka-temsilcileri`, mode: "edit_first" }
];

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
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
    const res = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    return res?.result?.value;
  }
  async screenshotJpeg(destPath) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const res = await this.send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
    fs.writeFileSync(destPath, Buffer.from(res.data, "base64"));
  }
  close() {
    try { this.ws.close(); } catch (_) {}
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
    console.error("[HATA] PBX_PASS gerekli.");
    process.exit(1);
  }
  const chromeBin = findChromeBinary();
  const profileDir = `/tmp/nornia-chrome-modal-${Date.now()}`;
  const chrome = spawn(
    chromeBin,
    [
      "--headless=new", "--disable-gpu", "--no-sandbox", "--ignore-certificate-errors",
      `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
      "--window-size=1440,900", "about:blank"
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
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1.5, mobile: false });

    await cdp.send("Page.navigate", { url: `${PBX_URL}/login` });
    await sleep(2600);
    await cdp.eval(`
      (() => {
        const setVal = (el, val) => {
          const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          proto.call(el, val);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const uEl = document.querySelector('input[type="text"], input[type="email"]');
        const pEl = document.querySelector('input[type="password"]');
        if (uEl && pEl) {
          setVal(uEl, ${JSON.stringify(PBX_USER)});
          setVal(pEl, ${JSON.stringify(PBX_PASS)});
          document.querySelector('button[type="submit"]')?.click();
        }
      })()
    `);
    await sleep(4200);

    // 1. Sub-settings screens (skip if ONLY_MODALS=1)
    if (process.env.ONLY_MODALS !== "1") {
      for (const t of SUB_SETTINGS_TARGETS) {
        process.stdout.write(`  → ${t.file} ... `);
        await cdp.send("Page.navigate", { url: t.url });
        await sleep(2100);
        if (t.clickText) {
          await cdp.eval(`
            (() => {
              const root = document.querySelector('main') || document.body;
              const btns = Array.from(root.querySelectorAll('button'));
              const b = btns.find((el) => (el.textContent || '').includes(${JSON.stringify(t.clickText)}));
              if (b) b.click();
            })()
          `);
          await sleep(1400);
        }
        await cdp.eval(`document.querySelectorAll('input[type="password"]').forEach((e) => e.value = "");`);
        await cdp.screenshotJpeg(path.join(OUT_ROOT, t.file));
        console.log(`${Math.round(fs.statSync(path.join(OUT_ROOT, t.file)).size / 1024)} KB`);
      }
    }

    // 2. Edit Modals (strictly inside <main>, NEVER sidebar!)
    for (const t of MODAL_TARGETS) {
      process.stdout.write(`  → ${t.file} ... `);
      await cdp.send("Page.navigate", { url: t.url });
      await sleep(2600);
      const clicked = await cdp.eval(`
        (() => {
          const mainEl = document.querySelector('main') || document.body;
          const btns = Array.from(mainEl.querySelectorAll('button')).filter((b) => !b.closest('aside') && !b.closest('nav'));
          const editBtn = btns.find((b) => {
            const title = (b.getAttribute('title') || '').toLowerCase();
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const hasPencil = Boolean(b.querySelector('svg.lucide-edit-2, svg.lucide-pencil, svg.lucide-edit, svg.lucide-square-pen'));
            return title.includes('düzenle') || aria.includes('düzenle') || hasPencil;
          });
          if (editBtn) { editBtn.click(); return "CLICKED_EDIT:" + (editBtn.getAttribute('title') || editBtn.textContent || '').trim().slice(0, 30); }
          const plusBtn = btns.find((b) => (b.getAttribute('title') || '').toLowerCase().includes('ekle') || b.querySelector('svg.lucide-plus'));
          if (plusBtn) { plusBtn.click(); return "CLICKED_PLUS"; }
          return "NONE";
        })()
      `);
      await sleep(1800);
      await cdp.eval(`document.querySelectorAll('input[type="password"]').forEach((e) => e.value = "");`);
      await cdp.screenshotJpeg(path.join(OUT_ROOT, t.file));
      console.log(`${clicked} — ${Math.round(fs.statSync(path.join(OUT_ROOT, t.file)).size / 1024)} KB`);
    }

    console.log("[OK] 14 ek düzenleme/alt-ayar ekran görüntüsü yakalandı.");
  } finally {
    if (cdp) cdp.close();
    try { chrome.kill("SIGKILL"); } catch (_) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
