#!/usr/bin/env node
/**
 * Nornia Docs — Seviye-3 İç İçe Modallar & Alt Pencereler Canlı Görüntü Yakalayıcı (Chrome CDP)
 * ==============================================================================================
 * Kullanıcı→SIP→Cihaz Düzenle / Cihaz İncele (BLF/Softkeys/Autoprovision), Oto Provizyon
 * Tarama/Log/Ağ, Omnichannel Broadcast/Compose, AI Senaryo Asistanı/Düğüm Düzenle,
 * CallFlow Simülatör/Düğüm, API Anahtarı Oluştur/Erişim Günlüğü, Rol Düzenle, Multi-Site
 * Şube Ekle, Tenant & Offline Lisans, WhatsApp Hattı Ekle, Güvenlik IP Ban/Whitelist,
 * API Bütçe Yükleme/Eşik, Geri Yükleme Noktası, Dialer Liste Yükleme vb. 22+ derin alt
 * pencerenin canlı ekran görüntüsünü yakalar.
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
const OUT_ROOT = path.resolve(__dirname, "../../portals/docs-portal/public/screenshots/tabs/deep");
const CDP_PORT = Number(process.env.CDP_PORT || 9242);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChromeBinary() {
  for (const c of [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ].filter(Boolean)) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.addEventListener("open", res); this.ws.addEventListener("error", rej); });
    this.ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data.toString());
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) rej(new Error(m.error.message || JSON.stringify(m.error)));
        else res(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    return r?.result?.value;
  }
  async snap(fileName) {
    fs.mkdirSync(OUT_ROOT, { recursive: true });
    await this.eval(`document.querySelectorAll('input[type="password"]').forEach(e => { e.value = ""; });`);
    const r = await this.send("Page.captureScreenshot", { format: "jpeg", quality: 86 });
    const dest = path.join(OUT_ROOT, fileName);
    fs.writeFileSync(dest, Buffer.from(r.data, "base64"));
    console.log(`  [OK] deep/${fileName} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
  }
  close() { try { this.ws.close(); } catch (_) {} }
}

async function waitForTarget(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const l = await r.json();
      const t = l.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
      if (t) return t.webSocketDebuggerUrl;
    } catch (_) {}
    await sleep(250);
  }
  throw new Error("CDP açılmadı");
}

async function clickText(cdp, text, scope = "main", exact = false) {
  return cdp.eval(`
    (() => {
      const target = ${JSON.stringify(text)}.toLowerCase().trim();
      const exactMode = ${JSON.stringify(exact)};
      let root = document.querySelector('main') || document.body;
      if (${JSON.stringify(scope)} === "modal") {
        const modals = Array.from(document.querySelectorAll('div.fixed, [role="dialog"]')).filter(el => el.offsetWidth > 350 && el.offsetHeight > 220);
        if (modals.length) root = modals[modals.length - 1];
      }
      const btns = Array.from(root.querySelectorAll('button, [role="tab"]')).filter(b => b.offsetParent !== null);
      const f = btns.find(b => {
        const t = (b.innerText || b.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
        const ti = (b.getAttribute('title') || '').toLowerCase();
        return exactMode ? (t === target || ti === target) : (t.includes(target) || ti.includes(target));
      });
      if (f) { f.scrollIntoView({ block: 'nearest' }); f.click(); return "OK:" + (f.innerText || f.getAttribute('title') || '').replace(/\\s+/g, ' ').trim().slice(0, 35); }
      return "MISS:" + target;
    })()
  `);
}

async function main() {
  if (!PBX_PASS) { console.error("PBX_PASS gerekli"); process.exit(1); }
  const profileDir = `/tmp/nornia-chrome-deep-${Date.now()}`;
  const chrome = spawn(findChromeBinary(), [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--ignore-certificate-errors",
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
    "--window-size=1440,900", "about:blank"
  ], { stdio: "ignore" });

  let cdp = null;
  try {
    cdp = new CDP(await waitForTarget(CDP_PORT));
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1.35, mobile: false });

    await cdp.send("Page.navigate", { url: `${PBX_URL}/login` });
    await sleep(2500);
    await cdp.eval(`
      (() => {
        const s = (e, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); };
        s(document.querySelector('input[type="text"], input[type="email"]'), ${JSON.stringify(PBX_USER)});
        s(document.querySelector('input[type="password"]'), ${JSON.stringify(PBX_PASS)});
        document.querySelector('button[type="submit"]')?.click();
      })()
    `);
    await sleep(4500);

    // 1. KULLANICI → DÜZENLE → SIP → CİHAZ DÜZENLE & CİHAZ İNCELE (BLF/SOFTKEYS)
    console.log("\n=== [1] Kullanıcı → SIP → Seviye-3 Cihaz Modalları ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=kullanicilar` });
    await sleep(2300);
    await cdp.eval(`
      (() => {
        const main = document.querySelector('main');
        const b = Array.from(main.querySelectorAll('button')).find(x => (x.getAttribute('title')||'').toLowerCase()==='düzenle' || x.querySelector('svg.lucide-edit-2,svg.lucide-pencil'));
        if (b) b.click();
      })()
    `);
    await sleep(1200);
    console.log("  SIP tab:", await clickText(cdp, "SIP", "modal", true));
    await sleep(900);
    // 1a. Click '+' in SIP CİHAZLARI to open SIP Cihazı Ekle/Düzenle modal (or pencil on device)
    const devEditRes = await cdp.eval(`
      (() => {
        const modals = Array.from(document.querySelectorAll('div.fixed')).filter(el => el.offsetWidth > 400);
        const modal = modals[modals.length - 1];
        const btns = Array.from(modal.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        // Prefer pencil icon inside SIP CİHAZLARI or red '+' button
        const pencil = btns.find(b => b.querySelector('svg.lucide-edit-2, svg.lucide-pencil, svg.lucide-edit'));
        if (pencil) { pencil.click(); return "CLICKED_DEV_EDIT"; }
        const plus = btns.find(b => b.querySelector('svg.lucide-plus'));
        if (plus) { plus.click(); return "CLICKED_DEV_PLUS"; }
        return "MISS";
      })()
    `);
    await sleep(1100);
    process.stdout.write(`  (${devEditRes}) `);
    await cdp.snap("user-sip-device-edit.jpg");
    // Close inner modal & open Inspect (magnifying glass)
    await cdp.eval(`
      (() => {
        const modals = Array.from(document.querySelectorAll('div.fixed')).filter(el => el.offsetWidth > 350);
        if (modals.length >= 2) {
          const top = modals[modals.length - 1];
          const closeBtn = Array.from(top.querySelectorAll('button')).find(b => (b.innerText||'').includes('Vazgeç') || (b.innerText||'').includes('Kapat') || b.querySelector('svg.lucide-x'));
          if (closeBtn) closeBtn.click();
        }
      })()
    `);
    await sleep(700);
    // Open Cihaz İncele (Search / magnifying glass button inside SIP CİHAZLARI)
    const inspRes = await cdp.eval(`
      (() => {
        const modals = Array.from(document.querySelectorAll('div.fixed')).filter(el => el.offsetWidth > 400);
        const modal = modals[modals.length - 1];
        const btns = Array.from(modal.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        const searchBtn = btns.find(b => b.querySelector('svg.lucide-search, svg.lucide-eye'));
        if (searchBtn) { searchBtn.click(); return "CLICKED_INSPECT"; }
        return "MISS";
      })()
    `);
    await sleep(1100);
    process.stdout.write(`  (${inspRes}) `);
    await cdp.snap("user-sip-device-inspect.jpg");
    // Also open "+ Yeni SIP Cihazı Ekle" (Masa Telefonu ekleme formu)
    await cdp.eval(`
      (() => {
        const modals = Array.from(document.querySelectorAll('div.fixed')).filter(el => el.offsetWidth > 350);
        if (modals.length >= 2) {
          const top = modals[modals.length - 1];
          const c = Array.from(top.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-x') || (b.innerText||'').includes('Kapat'));
          if (c) c.click();
        }
      })()
    `);
    await sleep(700);
    const addDevRes = await cdp.eval(`
      (() => {
        const modals = Array.from(document.querySelectorAll('div.fixed')).filter(el => el.offsetWidth > 400);
        const modal = modals[modals.length - 1];
        const plus = Array.from(modal.querySelectorAll('button')).find(b => b.offsetParent !== null && b.querySelector('svg.lucide-plus'));
        if (plus) { plus.click(); return "CLICKED_ADD_SIP_DEVICE"; }
        return "MISS";
      })()
    `);
    await sleep(1000);
    process.stdout.write(`  (${addDevRes}) `);
    await cdp.snap("user-sip-device-add.jpg");

    // 2. OTO PROVİZYON — Tarama, Loglar, Ağ Sunucu Ayarı
    console.log("\n=== [2] Oto Provizyon Seviye-3 Modalları ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=otomatik-kurulum` });
    await sleep(2200);
    process.stdout.write(`  (${await clickText(cdp, "Ağı Tara", "main")}) `);
    await sleep(1100);
    await cdp.snap("autoprov-scan.jpg");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=otomatik-kurulum` });
    await sleep(1800);
    process.stdout.write(`  (${await clickText(cdp, "Provizyon Log", "main")}) `);
    await sleep(1000);
    await cdp.snap("autoprov-logs.jpg");

    // 3. ORTAK GELEN KUTUSU (OMNICHANNEL) — Broadcast & Yeni Sohbet
    console.log("\n=== [3] Omnichannel Seviye-3 Modalları ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=coklu-kanal` });
    await sleep(2300);
    process.stdout.write(`  (${await clickText(cdp, "Toplu", "main")}) `);
    await sleep(1000);
    await cdp.snap("omni-broadcast.jpg");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=coklu-kanal` });
    await sleep(1800);
    process.stdout.write(`  (${await clickText(cdp, "Yeni Sohbet", "main")}) `);
    await sleep(1000);
    await cdp.snap("omni-compose.jpg");

    // 4. AI TEMSİLCİLERİ → GÖRSEL SENARYO → AI SENARYO ASİSTANI MODALI
    console.log("\n=== [4] AI Senaryo Asistanı & Düğüm Düzenle ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=yapay-zeka-temsilcileri` });
    await sleep(2200);
    await clickText(cdp, "Düzenle & Yapılandır", "main");
    await sleep(1200);
    await clickText(cdp, "Görsel Senaryo Akışı", "main");
    await sleep(1400);
    process.stdout.write(`  (${await clickText(cdp, "AI ile", "main")}) `);
    await sleep(1000);
    await cdp.snap("ai-scenario-assistant.jpg");

    // 5. ARAMA AKIŞI (CALLFLOW) → CANLI SİMÜLATÖR
    console.log("\n=== [5] CallFlow Canlı Simülatör ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=arama-akislari` });
    await sleep(2300);
    process.stdout.write(`  (${await clickText(cdp, "Simüle", "main")}) `);
    await sleep(1000);
    await cdp.snap("callflow-simulator.jpg");

    // 6. API BÜTÇE — Ücret Yükleme & Eşik Düzenleme Modalları
    console.log("\n=== [6] API Bütçe Modalları ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=api-butce-ve-tuketim` });
    await sleep(2200);
    process.stdout.write(`  (${await clickText(cdp, "Yükle", "main")}) `);
    await sleep(1000);
    await cdp.snap("budget-add-credit.jpg");

    // 7. SİSTEM AYARLARI → ROLLER → ROL DÜZENLE MODALI
    console.log("\n=== [7] Roller → Rol Düzenle Modalı ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=ayarlar&subtab=rol-ve-yetkiler` });
    await sleep(2200);
    const roleEditRes = await cdp.eval(`
      (() => {
        const main = document.querySelector('main');
        const b = Array.from(main.querySelectorAll('button')).find(x => x.offsetParent !== null && ((x.getAttribute('title')||'').toLowerCase().includes('düzenle') || x.querySelector('svg.lucide-edit-2,svg.lucide-pencil')));
        if (b) { b.click(); return "OK_ROLE_EDIT"; }
        return "MISS";
      })()
    `);
    await sleep(1100);
    process.stdout.write(`  (${roleEditRes}) `);
    await cdp.snap("role-edit-modal.jpg");

    // 8. SİSTEM AYARLARI → KURUMSAL DIŞ API → YENİ ANAHTAR MODALI & ERİŞİM GÜNLÜĞÜ
    console.log("\n=== [8] Kurumsal Dış API Modalları ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=ayarlar&subtab=dis-api-ve-anahtar-yonetimi` });
    await sleep(2200);
    process.stdout.write(`  (${await clickText(cdp, "Canlı API Erişim", "main")}) `);
    await sleep(1000);
    await cdp.snap("api-access-logs.jpg");
    const apiCreateRes = await cdp.eval(`
      (() => {
        const main = document.querySelector('main');
        const b = Array.from(main.querySelectorAll('button')).find(x => x.offsetParent !== null && x.querySelector('svg.lucide-plus'));
        if (b) { b.click(); return "OK_API_PLUS"; }
        return "MISS";
      })()
    `);
    await sleep(1100);
    process.stdout.write(`  (${apiCreateRes}) `);
    await cdp.snap("api-key-create-modal.jpg");

    // 9. SİSTEM AYARLARI → ÇOK-ŞUBELİ SANTRAL → ŞUBE EKLE MODALI
    console.log("\n=== [9] Multi-Site Şube Ekle Modalı ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=ayarlar&subtab=cok-subeli-santral` });
    await sleep(2100);
    process.stdout.write(`  (${await clickText(cdp, "Yeni Şube", "main")}) `);
    await sleep(1000);
    await cdp.snap("federation-site-modal.jpg");

    // 10. SİSTEM AYARLARI → MÜŞTERİ (TENANT) → MÜŞTERİ DÜZENLE & OFFLINE LİSANS
    console.log("\n=== [10] Tenant & Offline Lisans Modalları ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=ayarlar&subtab=musteri-lisanslari` });
    await sleep(2100);
    const tenEditRes = await cdp.eval(`
      (() => {
        const main = document.querySelector('main');
        const b = Array.from(main.querySelectorAll('button')).find(x => x.offsetParent !== null && x.querySelector('svg.lucide-plus'));
        if (b) { b.click(); return "OK_TENANT_PLUS"; }
        return "MISS";
      })()
    `);
    await sleep(1000);
    process.stdout.write(`  (${tenEditRes}) `);
    await cdp.snap("tenant-edit-modal.jpg");

    // 11. SİSTEM AYARLARI → KANAL ENTEGRASYONLARI → YENİ WHATSAPP HATTI MODALI
    console.log("\n=== [11] Yeni WhatsApp Hattı Modalı ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=ayarlar&subtab=kanal-ayarlari` });
    await sleep(2100);
    process.stdout.write(`  (${await clickText(cdp, "Yeni Hat Ekle", "main")}) `);
    await sleep(1000);
    await cdp.snap("channel-wa-account-modal.jpg");

    // 12. SİSTEM AYARLARI → GERİ YÜKLEME NOKTASI → YENİ SNAPSHOT MODALI
    console.log("\n=== [12] Geri Yükleme Noktası Oluştur Modalı ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=ayarlar&subtab=geri-yukleme-noktasi` });
    await sleep(2100);
    const rpRes = await cdp.eval(`
      (() => {
        const main = document.querySelector('main');
        const b = Array.from(main.querySelectorAll('button')).find(x => x.offsetParent !== null && (x.querySelector('svg.lucide-plus') || (x.innerText||'').toLowerCase().includes('oluştur')));
        if (b) { b.click(); return "OK_RP_CREATE"; }
        return "MISS";
      })()
    `);
    await sleep(1000);
    process.stdout.write(`  (${rpRes}) `);
    await cdp.snap("restore-point-create.jpg");

    // 13. GÜVENLİK KALKANI → MANUEL IP YASAKLA & BEYAZ LİSTE MODALLARI
    console.log("\n=== [13] Güvenlik Kalkanı Modalları ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=security` });
    await sleep(2100);
    process.stdout.write(`  (${await clickText(cdp, "IP Yasakla", "main")}) `);
    await sleep(900);
    await cdp.snap("security-ban-modal.jpg");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=security` });
    await sleep(1700);
    process.stdout.write(`  (${await clickText(cdp, "Beyaz Liste", "main")}) `);
    await sleep(900);
    await cdp.snap("security-whitelist-modal.jpg");

    // 14. TOPLU KONFİGÜRASYON → İŞLEM GEÇMİŞİ & UNDO ÇEKMECESİ
    console.log("\n=== [14] Toplu Konfigürasyon Undo Geçmişi ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=toplu-konfigurasyon` });
    await sleep(2000);
    process.stdout.write(`  (${await clickText(cdp, "İşlem Geçmişi", "main")}) `);
    await sleep(900);
    await cdp.snap("bulk-history-drawer.jpg");

    // 15. CANLI İZLEME PANELİ (WALLBOARD) → DÜZENİ ÖZELLEŞTİR MODALI
    console.log("\n=== [15] Wallboard Özelleştirme Modalı ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=canli-wallboard` });
    await sleep(2100);
    process.stdout.write(`  (${await clickText(cdp, "Özelleştir", "main")}) `);
    await sleep(900);
    await cdp.snap("wallboard-customize.jpg");

    console.log("\n[DONE] Tüm Seviye-3 derin modal görüntüleri yakalandı ->", OUT_ROOT);
  } finally {
    if (cdp) cdp.close();
    try { chrome.kill("SIGKILL"); } catch (_) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
