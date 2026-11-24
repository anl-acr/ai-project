#!/usr/bin/env node
/**
 * Captures ALL 4 sub-tabs of the Level-3 "Masa Telefonu — Cihaz İnceleme & Telefon Ayarları"
 * modal (Genel/Donanım + Autoprovision, BLF 1-24 + Softkeys F1-F4, Telefon Ayarları/Kodek/DTMF/NTP, PJSIP Detay)
 * AND the Masa Telefonu "SIP Cihazı Düzenle" modal for Dahili 1000.
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = "https://app.nornia.com.tr";
const DEEP_DIR = "/Users/anilacar/ai-project/portals/docs-portal/public/screenshots/tabs/deep";
const CDP_PORT = 9337;
const EMAIL = "anl.acr@gmail.com";
const PASS = "test";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function shot(cdp, filename) {
  await cdp.eval(`document.querySelectorAll('input[type="password"]').forEach(i => { try { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); } catch {} });`);
  await sleep(350);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 84 });
  const out = path.join(DEEP_DIR, filename);
  fs.writeFileSync(out, Buffer.from(data, "base64"));
  console.log(`  [SHOT] deep/${filename} (${Math.round(Buffer.from(data, "base64").length / 1024)} KB)`);
}

async function main() {
  const userDataDir = `/tmp/nornia_cdp_desk_${Date.now()}`;
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

    // Go to Users and edit Dahili 1000 (first user)
    await cdp.send("Page.navigate", { url: `${BASE_URL}/?tab=kullanicilar` });
    await sleep(2400);
    await cdp.eval(`(() => {
      const main = document.querySelector('main');
      const b = Array.from(main.querySelectorAll('button')).find(x => (x.getAttribute('title')||'').toLocaleLowerCase('tr-TR')==='düzenle' || x.querySelector('svg.lucide-edit-2, svg.lucide-pencil'));
      if (b) b.click();
    })()`);
    await sleep(1200);

    // Click SIP tab
    await cdp.eval(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText||'').trim() === 'SIP');
      if (b) b.click();
    })()`);
    await sleep(900);

    // Inspect all search (inspect) buttons in SIP CİHAZLARI
    const devices = await cdp.eval(`(() => {
      const modals = Array.from(document.querySelectorAll('div.fixed')).filter(el => el.offsetWidth > 400);
      const modal = modals[modals.length - 1];
      const searchBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.offsetParent !== null && b.querySelector('svg.lucide-search'));
      return searchBtns.map((b, i) => {
        const card = b.closest('div.rounded-2xl, div.rounded-xl') || b.parentElement?.parentElement;
        return { i, text: (card?.innerText || '').replace(/\\s+/g, ' ').slice(0, 140) };
      });
    })()`);
    console.log("SIP devices on Dahili 1000:", devices);

    // Pick the physical deskphone card (index >= 1 or non-WebRTC)
    let deskIdx = devices.findIndex(d => !d.text.includes("ORTAK WEBRTC") && !d.text.includes("Yazılım İstemcileri"));
    if (deskIdx < 0 && devices.length > 1) deskIdx = 1;
    console.log("Selected deskphone index:", deskIdx);

    if (deskIdx >= 0) {
      await cdp.eval(`(() => {
        const modals = Array.from(document.querySelectorAll('div.fixed')).filter(el => el.offsetWidth > 400);
        const modal = modals[modals.length - 1];
        const searchBtns = Array.from(modal.querySelectorAll('button')).filter(b => b.offsetParent !== null && b.querySelector('svg.lucide-search'));
        searchBtns[${deskIdx}].scrollIntoView({ block: 'center' });
        searchBtns[${deskIdx}].click();
      })()`);
      await sleep(1300);

      const tabs = await cdp.eval(`(() => {
        const dlg = document.querySelector('dialog[open]');
        if (!dlg) return 'NO_DIALOG';
        return Array.from(dlg.querySelectorAll('[role="tab"]')).map(t => ({ id: t.id, text: t.innerText.trim() }));
      })()`);
      console.log("Deskphone Inspect tabs:", tabs);

      // Tab 1: Overview (Donanım, MAC, Marka/Model, LAN/WAN, Autoprovision, Check-Sync, Reboot)
      await shot(cdp, "deskphone-inspect-overview.jpg");

      // Tab 2: BLF & Tuş Tanımları (1-24 + Softkeys F1-F4)
      await cdp.eval(`document.querySelector('#inspect-tab-blf')?.click()`);
      await sleep(800);
      await shot(cdp, "deskphone-inspect-blf.jpg");

      // Tab 3: Diğer Telefon Ayarları (Kodek Önceliği, DTMF, Dil, Saat Dilimi, NTP, Auto-Answer, Ghost Call)
      await cdp.eval(`document.querySelector('#inspect-tab-phone_settings')?.click()`);
      await sleep(800);
      await shot(cdp, "deskphone-inspect-settings.jpg");

      // Tab 4: PJSIP Dahili Detay (asterisk -rx "pjsip show endpoint")
      await cdp.eval(`document.querySelector('#inspect-tab-pjsip')?.click()`);
      await sleep(900);
      await shot(cdp, "deskphone-inspect-pjsip.jpg");

      // Also click "SIP Kimlik Bilgilerini Düzenle" to capture the Deskphone Edit modal!
      await cdp.eval(`(() => {
        const dlg = document.querySelector('dialog[open]');
        const b = Array.from(dlg?.querySelectorAll('button') || []).find(x => (x.innerText||'').includes('SIP Kimlik Bilgilerini Düzenle'));
        if (b) b.click();
      })()`);
      await sleep(900);
      await shot(cdp, "deskphone-sip-credentials-edit.jpg");
    }

    console.log("DONE Deskphone 4-tab capture!");
  } finally {
    if (cdp) cdp.close();
    try { proc.kill("SIGKILL"); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
