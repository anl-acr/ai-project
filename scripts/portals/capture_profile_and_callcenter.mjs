#!/usr/bin/env node
/**
 * Captures:
 * 1) Top-Right Avatar Dropdown + ALL 11 tabs of "Temsilci Profil Ayarları" + Ctrl+K Global Search
 * 2) Temsilci Çağrı Paneli (Agent Workspace) deep inner modals & Deskphone Visual Simulator + CFG Preview
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = "https://app.nornia.com.tr";
const PROF_DIR = "/Users/anilacar/ai-project/portals/docs-portal/public/screenshots/tabs/profile";
const CP_DEEP_DIR = "/Users/anilacar/ai-project/portals/docs-portal/public/screenshots/tabs/call-panel/deep";
const CDP_PORT = 9341;
const EMAIL = "anl.acr@gmail.com";
const PASS = "test";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(PROF_DIR, { recursive: true });
fs.mkdirSync(CP_DEEP_DIR, { recursive: true });

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const res = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
    return res.result?.value;
  }
  close() { try { this.ws?.close(); } catch {} }
}

async function waitForChrome() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("Chrome CDP timeout");
}

async function sanitizeDom(cdp) {
  await cdp.eval(`(() => {
    document.querySelectorAll('input[type="password"]').forEach(i => {
      try { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); } catch {}
    });
    const tokRe = /\\/api\\/prov\\/[A-Za-z0-9_-]{12,}/g;
    const passRe = /(password\\s*=\\s*)([^\\n<]+)/gi;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue) {
        if (tokRe.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(tokRe, '/api/prov/ORNEK-PROV-TOKEN');
        if (passRe.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(passRe, '$1********');
      }
    }
  })()`);
}

async function shot(cdp, outPath) {
  await sanitizeDom(cdp);
  await sleep(350);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 83 });
  fs.writeFileSync(outPath, Buffer.from(data, "base64"));
  console.log(`  [SHOT] ${path.basename(outPath)} (${Math.round(Buffer.from(data, "base64").length / 1024)} KB)`);
}

async function clickBtn(cdp, textOrTitle, scope = "body", exact = false) {
  return await cdp.eval(`(() => {
    const q = ${JSON.stringify(textOrTitle)}.toLocaleLowerCase('tr-TR');
    const exactMode = ${Boolean(exact)};
    const root = document.querySelector(${JSON.stringify(scope)}) || document.body;
    const els = Array.from(root.querySelectorAll('button, [role="tab"]'));
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const t = (el.innerText || '').replace(/\\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
      const ti = (el.getAttribute('title') || '').toLocaleLowerCase('tr-TR');
      if (exactMode ? (t === q || ti === q) : (t.includes(q) || ti.includes(q))) {
        el.scrollIntoView({ block: 'center' });
        el.click();
        return 'OK:' + (el.innerText || el.title || '').replace(/\\s+/g, ' ').trim().slice(0, 50);
      }
    }
    return 'MISS:' + q;
  })()`);
}

async function main() {
  const userDataDir = `/tmp/nornia_cdp_prof_${Date.now()}`;
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--ignore-certificate-errors",
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${userDataDir}`,
    "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });

  let cdp;
  try {
    cdp = new CDP(await waitForChrome());
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1.35, mobile: false });

    await cdp.send("Page.navigate", { url: `${BASE_URL}/login` });
    await sleep(2400);
    await cdp.eval(`(() => {
      const s = (e, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); };
      s(document.querySelector('input[type="text"], input[type="email"]'), ${JSON.stringify(EMAIL)});
      s(document.querySelector('input[type="password"]'), ${JSON.stringify(PASS)});
      document.querySelector('button[type="submit"]')?.click();
    })()`);
    await sleep(4000);

    // 1. GLOBAL SEARCH (Ctrl+K)
    console.log("\n=== [1] Üst Bar Global Arama (Ctrl+K) ===");
    await cdp.eval(`(() => {
      const header = document.querySelector('header');
      const searchBtn = Array.from(header?.querySelectorAll('button, input') || []).find(el => (el.innerText || el.placeholder || '').includes('Ctrl+K') || (el.innerText || el.placeholder || '').includes('Menü, ayar'));
      if (searchBtn) searchBtn.click();
    })()`);
    await sleep(800);
    await shot(cdp, path.join(PROF_DIR, "12-global-arama-ctrl-k.jpg"));
    await cdp.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(400);

    // 2. TOP-RIGHT AVATAR DROPDOWN
    console.log("\n=== [2] Sağ Üst Avatar Menüsü ===");
    const avatarRes = await cdp.eval(`(() => {
      const header = document.querySelector('header');
      const btns = Array.from(header?.querySelectorAll('button') || []);
      const av = btns.find(b => (b.innerText || '').includes('Anıl') || (b.innerText || '').includes('Müsait'));
      if (av) { av.click(); return 'OK:' + av.innerText.replace(/\\s+/g, ' ').trim(); }
      return 'MISS';
    })()`);
    console.log("  Avatar click:", avatarRes);
    await sleep(800);
    await shot(cdp, path.join(PROF_DIR, "00-avatar-dropdown.jpg"));

    // 3. OPEN "Profil Ayarları" & CAPTURE ALL 11 TABS
    console.log("\n=== [3] Temsilci Profil Ayarları — 11 Sekmenin Tamamı ===");
    console.log("  Open Profil Ayarları:", await clickBtn(cdp, "Profil Ayarları", "header"));
    await sleep(1000);

    const profTabs = [
      { label: "Avatar & Tema", file: "01-avatar-tema.jpg" },
      { label: "Başlangıç Ekranı", file: "02-baslangic-ekrani.jpg" },
      { label: "Profiller & Yönlendirme", file: "03-profiller-yonlendirme.jpg" },
      { label: "Donanım", file: "04-donanim.jpg" },
      { label: "Klavye Kısayolları", file: "05-klavye-kisayollari.jpg" },
      { label: "Ortak Masa Telefonu", file: "06-ortak-masa-telefonu.jpg" },
      { label: "Güvenlik", file: "07-guvenlik.jpg" },
      { label: "Uygulamalar & İndir", file: "08-uygulamalar-indir.jpg" },
      { label: "Çağrı Paneli", file: "09-cagri-paneli.jpg" },
      { label: "Üst Bar Özelleştirme", file: "10-ust-bar.jpg" },
      { label: "Canlı İzleme Paneli", file: "11-canli-izleme.jpg" },
    ];
    for (const pt of profTabs) {
      const r = await clickBtn(cdp, pt.label, ".aida-settings-modal-sidebar");
      console.log(`  Profile Tab [${pt.label}]:`, r);
      await sleep(750);
      if (r.startsWith("OK")) await shot(cdp, path.join(PROF_DIR, pt.file));
    }
    // Close Profile Settings modal with Vazgeç/X (never Save!)
    await cdp.eval(`document.querySelectorAll('button').forEach(b => { if ((b.innerText||'').trim() === 'Vazgeç') b.click(); });`);
    await sleep(500);

    // 4. TEMSİLCİ ÇAĞRI PANELİ (AGENT WORKSPACE) DEEP INNER MODALS
    console.log("\n=== [4] Temsilci Çağrı Paneli Derin Alt Pencereleri ===");
    // Click "Temsilci Çağrı Paneli" in sidebar
    await cdp.eval(`(() => {
      const aside = document.querySelector('aside, nav');
      const b = Array.from(aside?.querySelectorAll('button') || []).find(x => (x.innerText||'').includes('Temsilci Çağrı Paneli'));
      if (b) b.click();
    })()`);
    await sleep(2400);

    // 4a. Web Telefon tab -> Diagnostics + Translator
    console.log("  Tab Web Telefon:", await clickBtn(cdp, "Web Telefon", "main"));
    await sleep(900);
    let r = await clickBtn(cdp, "Web Telefon Sistem Kontrolü", "main");
    console.log("  WebPhone Diagnostics:", r);
    await sleep(900);
    if (r.startsWith("OK")) {
      await shot(cdp, path.join(CP_DEEP_DIR, "webphone-diagnostics.jpg"));
      await cdp.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.querySelectorAll('button').forEach(b => { if ((b.innerText||'').trim() === 'Kapat') b.click(); });`);
      await sleep(450);
    }

    r = await clickBtn(cdp, "Canlı Konuşma & Çeviri Akışı", "main");
    console.log("  WebPhone Translator:", r);
    await sleep(900);
    if (r.startsWith("OK")) {
      await shot(cdp, path.join(CP_DEEP_DIR, "webphone-translator.jpg"));
      await cdp.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.querySelectorAll('button').forEach(b => { if ((b.innerText||'').trim() === 'Kapat') b.click(); });`);
      await sleep(450);
    }

    // 4b. Hızlı Arama tab -> Yeni Hızlı Arama Ekle Modal
    console.log("  Tab Hızlı Arama:", await clickBtn(cdp, "Hızlı Arama", "main"));
    await sleep(800);
    r = await clickBtn(cdp, "Yeni Hızlı Arama Ekle", "main");
    console.log("  SpeedDial Add:", r);
    await sleep(800);
    if (r.startsWith("OK")) {
      await shot(cdp, path.join(CP_DEEP_DIR, "speeddial-add-modal.jpg"));
      await clickBtn(cdp, "Vazgeç", "body", true);
      await sleep(400);
    }

    // 4c. Kayıp Çağrı tab -> Yeni Geri Arama Hatırlatıcısı Ekle Modal
    console.log("  Tab Kayıp Çağrı:", await clickBtn(cdp, "Kayıp Çağrı", "main"));
    await sleep(800);
    r = await clickBtn(cdp, "Yeni Geri Arama Hatırlatıcısı Ekle", "main");
    console.log("  Missed Callback Modal:", r);
    await sleep(800);
    if (r.startsWith("OK")) {
      await shot(cdp, path.join(CP_DEEP_DIR, "missed-callback-modal.jpg"));
      await clickBtn(cdp, "Vazgeç", "body", true);
      await sleep(400);
    }

    // 4d. Çağrı Geçmişi tab -> Filtreler
    console.log("  Tab Çağrı Geçmişi:", await clickBtn(cdp, "Çağrı Geçmişi", "main"));
    await sleep(800);
    r = await clickBtn(cdp, "Filtreler", "main");
    console.log("  History Filters:", r);
    await sleep(800);
    if (r.startsWith("OK")) await shot(cdp, path.join(CP_DEEP_DIR, "history-filters.jpg"));

    // 4e. Sohbet tab -> Yeni İç Yazışma Başlat Modal
    console.log("  Tab Sohbet:", await clickBtn(cdp, "Sohbet", "main"));
    await sleep(900);
    r = await clickBtn(cdp, "Yeni İç Yazışma Başlat", "main");
    console.log("  New Internal Chat Modal:", r);
    await sleep(800);
    if (r.startsWith("OK")) {
      await shot(cdp, path.join(CP_DEEP_DIR, "chat-new-modal.jpg"));
      await clickBtn(cdp, "Vazgeç", "body", true);
      await sleep(400);
    }

    // 4f. Masa Telefonum tab -> Visual Designer + Auto-Fill BLF + CFG Preview
    console.log("  Tab Masa Telefonum:", await clickBtn(cdp, "Masa Telefonum", "main"));
    await sleep(1400);
    await shot(cdp, path.join(CP_DEEP_DIR, "deskphone-visual-simulator.jpg"));

    r = await clickBtn(cdp, "Güncel Oto-Provizyon Kodunu Önizle", "main");
    console.log("  Deskphone CFG Preview:", r);
    await sleep(1000);
    if (r.startsWith("OK")) {
      await shot(cdp, path.join(CP_DEEP_DIR, "deskphone-cfg-preview.jpg"));
      await clickBtn(cdp, "Kapat", "body", true);
      await sleep(400);
    }

    r = await clickBtn(cdp, "otomatik BLF olarak doldur", "main");
    console.log("  Deskphone Auto-Fill BLF:", r);
    await sleep(800);
    if (r.startsWith("OK")) await shot(cdp, path.join(CP_DEEP_DIR, "deskphone-autofill-blf.jpg"));

    console.log("\nDONE Profile & CallCenter Deep Capture!");
  } finally {
    if (cdp) cdp.close();
    try { proc.kill("SIGKILL"); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
