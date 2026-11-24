#!/usr/bin/env node
/**
 * Nornia Docs — Tam Kapsamlı Sekme & Modal Ekran Görüntüsü Yakalayıcı (Chrome CDP)
 * ================================================================================
 * Canlı `https://app.nornia.com.tr` üzerinden:
 *  - Kullanıcı Düzenle (11 sekme)
 *  - ACD Kuyruk Düzenle (11 sekme)
 *  - Dış Hat (SIP Trunk) Düzenle (4 sekme)
 *  - AI Temsilcisi Düzenle (7 sekme + Görsel Senaryo Akışı)
 *  - Bilgi Bankası RAG (5 sekme)
 *  - Anons Yönetimi (3 sekme)
 *  - Toplu Konfigürasyon (4 modül sekmesi)
 *  - Temsilci Çağrı Paneli (tüm iç sekmeler)
 *  - Diğer Santral / Dialer / CallFlow Ekle-Düzenle Modalları
 *  - Sistem Ayarları'nın TÜM 35 alt ekranı
 * için tek tek ayrı, yüksek çözünürlüklü JPEG ekran görüntüleri yakalar.
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
const OUT_ROOT = path.resolve(__dirname, "../../portals/docs-portal/public/screenshots/tabs");
const CDP_PORT = Number(process.env.CDP_PORT || 9239);

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
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    return res?.result?.value;
  }
  async snap(relFile) {
    const dest = path.join(OUT_ROOT, relFile);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await this.eval(`
      (() => {
        document.querySelectorAll('input[type="password"]').forEach((el) => { el.value = ""; });
      })()
    `);
    const res = await this.send("Page.captureScreenshot", { format: "jpeg", quality: 86 });
    fs.writeFileSync(dest, Buffer.from(res.data, "base64"));
    const kb = Math.round(fs.statSync(dest).size / 1024);
    console.log(`  [OK] tabs/${relFile} (${kb} KB)`);
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
        const t = list.find((x) => x.type === "page" && x.webSocketDebuggerUrl);
        if (t) return t.webSocketDebuggerUrl;
      }
    } catch (_) {}
    await sleep(250);
  }
  throw new Error("Chrome CDP açılamadı.");
}

async function clickButtonInScope(cdp, matchText, scope = "modal_or_main", exact = false) {
  return cdp.eval(`
    (() => {
      const target = ${JSON.stringify(matchText)}.toLowerCase().trim();
      const exactMode = ${JSON.stringify(exact)};
      let root = document.querySelector('main') || document.body;
      if (${JSON.stringify(scope)} === "modal") {
        const modals = Array.from(document.querySelectorAll('div.fixed, [role="dialog"]')).filter((el) => el.offsetWidth > 400 && el.offsetHeight > 300);
        if (modals.length > 0) root = modals[modals.length - 1];
      }
      const btns = Array.from(root.querySelectorAll('button, [role="tab"]')).filter((b) => {
        if (${JSON.stringify(scope)} !== "modal" && (b.closest('aside') || b.closest('nav'))) return false;
        return b.offsetParent !== null;
      });
      const found = btns.find((b) => {
        const txt = (b.innerText || b.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
        return exactMode ? txt === target : txt.includes(target);
      });
      if (found) {
        found.scrollIntoView({ block: 'nearest' });
        found.click();
        return "CLICKED:" + (found.innerText || found.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
      }
      return "NOT_FOUND:" + target;
    })()
  `);
}

async function clickFirstRowEdit(cdp) {
  return cdp.eval(`
    (() => {
      const main = document.querySelector('main') || document.body;
      const btns = Array.from(main.querySelectorAll('button')).filter((b) => {
        if (b.closest('aside') || b.closest('nav')) return false;
        const t = (b.getAttribute('title') || '').toLowerCase();
        if (t.includes('toplu')) return false;
        return b.offsetParent !== null;
      });
      const editBtn = btns.find((b) => {
        const t = (b.getAttribute('title') || '').toLowerCase();
        const txt = (b.innerText || '').toLowerCase();
        return t === 'düzenle' || t.includes('düzenle') || txt.includes('düzenle & yapılandır') || Boolean(b.querySelector('svg.lucide-edit-2, svg.lucide-pencil, svg.lucide-edit, svg.lucide-square-pen'));
      });
      if (editBtn) { editBtn.click(); return "EDIT:" + (editBtn.getAttribute('title') || editBtn.innerText || 'icon').trim().slice(0, 30); }
      const plusBtn = btns.find((b) => (b.getAttribute('title') || '').toLowerCase().includes('ekle') || Boolean(b.querySelector('svg.lucide-plus')));
      if (plusBtn) { plusBtn.click(); return "PLUS:" + (plusBtn.getAttribute('title') || 'plus'); }
      return "NONE";
    })()
  `);
}

async function main() {
  if (!PBX_PASS) { console.error("PBX_PASS gerekli"); process.exit(1); }
  const chromeBin = findChromeBinary();
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const profileDir = `/tmp/nornia-chrome-tabs-${Date.now()}`;
  const chrome = spawn(chromeBin, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--ignore-certificate-errors",
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
    "--window-size=1440,900", "about:blank"
  ], { stdio: "ignore" });

  let cdp = null;
  try {
    const wsUrl = await waitForCdpTarget(CDP_PORT);
    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1.35, mobile: false });

    console.log(`[LOGIN] ${PBX_URL}/login ...`);
    await cdp.send("Page.navigate", { url: `${PBX_URL}/login` });
    await sleep(2600);
    await cdp.eval(`
      (() => {
        const s = (e, v) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v);
          e.dispatchEvent(new Event('input', { bubbles: true }));
          e.dispatchEvent(new Event('change', { bubbles: true }));
        };
        s(document.querySelector('input[type="text"], input[type="email"]'), ${JSON.stringify(PBX_USER)});
        s(document.querySelector('input[type="password"]'), ${JSON.stringify(PBX_PASS)});
        document.querySelector('button[type="submit"]')?.click();
      })()
    `);
    await sleep(4500);

    // =========================================================================
    // 1. KULLANICI DÜZENLE — TÜM 11 SEKME
    // =========================================================================
    console.log("\n=== [1] KULLANICI DÜZENLE (11 SEKME) ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=kullanicilar` });
    await sleep(2500);
    console.log("  Open modal:", await clickFirstRowEdit(cdp));
    await sleep(1400);
    const userTabs = [
      { file: "users/01-genel.jpg", label: "Genel", exact: true },
      { file: "users/02-sip.jpg", label: "SIP", exact: true },
      { file: "users/03-profiller-yonlendirme.jpg", label: "Profiller & Yönlendirme" },
      { file: "users/04-ozellikler.jpg", label: "Özellikler", exact: true },
      { file: "users/05-guvenlik.jpg", label: "Güvenlik", exact: true },
      { file: "users/06-uygulamalar.jpg", label: "Uygulamalar", exact: true },
      { file: "users/07-cti.jpg", label: "CTI", exact: true },
      { file: "users/08-avatar-tema.jpg", label: "Avatar & Tema" },
      { file: "users/09-arayuz-panel.jpg", label: "Arayüz & Panel Düzeni" },
      { file: "users/10-rapor-filtre.jpg", label: "Rapor & Yönetim Filtresi" },
      { file: "users/11-musteri-tenant.jpg", label: "Müşteri / Tenant" }
    ];
    for (const t of userTabs) {
      const r = await clickButtonInScope(cdp, t.label, "modal", Boolean(t.exact));
      await sleep(750);
      process.stdout.write(`  (${r}) `);
      await cdp.snap(t.file);
    }

    // =========================================================================
    // 2. ACD KUYRUK DÜZENLE — TÜM 11 SEKME
    // =========================================================================
    console.log("\n=== [2] ACD KUYRUK DÜZENLE (11 SEKME) ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=kuyruklar` });
    await sleep(2400);
    console.log("  Open modal:", await clickFirstRowEdit(cdp));
    await sleep(1300);
    const queueTabs = [
      { file: "queues/01-genel.jpg", label: "Genel", exact: true },
      { file: "queues/02-sonuc-kodlari.jpg", label: "Çağrı Sonuç Kodları" },
      { file: "queues/03-rona.jpg", label: "Otomatik Mola (RONA)" },
      { file: "queues/04-logout.jpg", label: "Otomatik Logout" },
      { file: "queues/05-anons-bekleme.jpg", label: "Anons & Bekleme" },
      { file: "queues/06-maks-bekleme.jpg", label: "Maksimum Bekleme Süresi" },
      { file: "queues/07-periyodik-anons.jpg", label: "Periyodik Anons" },
      { file: "queues/08-uyeler-yoneticiler.jpg", label: "Üyeler & Yöneticiler" },
      { file: "queues/09-tum-agent-mesgul.jpg", label: "Tüm Agent" },
      { file: "queues/10-geri-arama.jpg", label: "Otomatik Geri Arama" },
      { file: "queues/11-anket.jpg", label: "Memnuniyet Anketi" }
    ];
    for (const t of queueTabs) {
      const r = await clickButtonInScope(cdp, t.label, "modal", Boolean(t.exact));
      await sleep(700);
      process.stdout.write(`  (${r}) `);
      await cdp.snap(t.file);
    }

    // =========================================================================
    // 3. DIŞ HAT (SIP TRUNK) DÜZENLE — TÜM 4 SEKME
    // =========================================================================
    console.log("\n=== [3] DIŞ HAT DÜZENLE (4 SEKME) ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=dis-hatlar-sip-trunk` });
    await sleep(2300);
    console.log("  Open modal:", await clickFirstRowEdit(cdp));
    await sleep(1200);
    const trunkTabs = [
      { file: "trunks/01-genel.jpg", label: "Genel" },
      { file: "trunks/02-dakika-paketi.jpg", label: "Dakika Paketi" },
      { file: "trunks/03-gelismis.jpg", label: "Gelişmiş" },
      { file: "trunks/04-sip-basliklari.jpg", label: "SIP Başlıkları" }
    ];
    for (const t of trunkTabs) {
      const r = await clickButtonInScope(cdp, t.label, "modal", false);
      await sleep(700);
      process.stdout.write(`  (${r}) `);
      await cdp.snap(t.file);
    }

    // =========================================================================
    // 4. AI TEMSİLCİLERİ DÜZENLE — TÜM 7 SEKME + GÖRSEL SENARYO AKIŞI
    // =========================================================================
    console.log("\n=== [4] AI TEMSİLCİLERİ (7 SEKME + SENARYO) ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=yapay-zeka-temsilcileri` });
    await sleep(2300);
    console.log("  Open editor:", await clickFirstRowEdit(cdp));
    await sleep(1300);
    const aiTabs = [
      { file: "ai-agents/01-kimlik-prompt.jpg", label: "Kimlik & Sistem Talimatı" },
      { file: "ai-agents/02-ses-motoru.jpg", label: "Ses Motoru (STT & TTS)" },
      { file: "ai-agents/03-arka-plan-test.jpg", label: "Arka Plan Sesi" },
      { file: "ai-agents/04-soz-kesme-vad.jpg", label: "Söz Kesme & Dinleme" },
      { file: "ai-agents/05-zeka-llm-rag.jpg", label: "Zeka Motoru (LLM)" },
      { file: "ai-agents/06-dogallik-guvenlik.jpg", label: "Konuşma Doğallığı" },
      { file: "ai-agents/07-crm-entegrasyonu.jpg", label: "Müşteri CRM" }
    ];
    for (const t of aiTabs) {
      const r = await clickButtonInScope(cdp, t.label, "main", false);
      await sleep(750);
      process.stdout.write(`  (${r}) `);
      await cdp.snap(t.file);
    }
    const scRes = await clickButtonInScope(cdp, "Görsel Senaryo Akışı", "main", false);
    await sleep(1600);
    process.stdout.write(`  (${scRes}) `);
    await cdp.snap("ai-agents/08-gorsel-senaryo.jpg");

    // =========================================================================
    // 5. BİLGİ BANKASI (RAG) — TÜM 5 SEKME
    // =========================================================================
    console.log("\n=== [5] BİLGİ BANKASI RAG (5 SEKME) ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=bilgi-bankasi` });
    await sleep(2200);
    const ragTabs = [
      { file: "rag/01-kaynaklar.jpg", label: "Veri Kaynakları" },
      { file: "rag/02-veri-ekleme.jpg", label: "Veri Ekleme" },
      { file: "rag/03-medya-katalog.jpg", label: "Medya" },
      { file: "rag/04-vektor-test.jpg", label: "Vektör Arama" },
      { file: "rag/05-tuning.jpg", label: "Parametreler" }
    ];
    for (const t of ragTabs) {
      const r = await clickButtonInScope(cdp, t.label, "main", false);
      await sleep(800);
      process.stdout.write(`  (${r}) `);
      await cdp.snap(t.file);
    }

    // =========================================================================
    // 6. TEMSİLCİ ÇAĞRI PANELİ — TÜM ALT SEKMELER
    // =========================================================================
    console.log("\n=== [6] TEMSİLCİ ÇAĞRI PANELİ (ALT SEKMELER) ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=cagri-merkezi` });
    await sleep(2400);
    const agentTabs = [
      { file: "call-panel/01-pano.jpg", label: "Pano", exact: true },
      { file: "call-panel/02-webphone.jpg", label: "Web Telefon" },
      { file: "call-panel/03-temsilciler.jpg", label: "Temsilciler", exact: true },
      { file: "call-panel/04-hizli-arama.jpg", label: "Hızlı Arama" },
      { file: "call-panel/05-kayip-cagri.jpg", label: "Kayıp Çağrı" },
      { file: "call-panel/06-rehber.jpg", label: "Rehber", exact: true },
      { file: "call-panel/07-cagri-gecmisi.jpg", label: "Çağrı Geçmişi" },
      { file: "call-panel/08-sesli-posta.jpg", label: "Sesli Posta" },
      { file: "call-panel/09-sohbet.jpg", label: "Sohbet", exact: true },
      { file: "call-panel/10-masa-telefonum.jpg", label: "Masa Telefonum" }
    ];
    for (const t of agentTabs) {
      const r = await clickButtonInScope(cdp, t.label, "main", Boolean(t.exact));
      await sleep(850);
      process.stdout.write(`  (${r}) `);
      await cdp.snap(t.file);
    }

    // =========================================================================
    // 7. ANONSLAR, TOPLU KONFİGÜRASYON & SANTRAL EKLE/DÜZENLE MODALLARI
    // =========================================================================
    console.log("\n=== [7] SANTRAL & ÇAĞRI MODALLARI ===");
    // Anonslar
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=anonslar` });
    await sleep(2000);
    await clickButtonInScope(cdp, "Bekleme Müzikleri", "main");
    await sleep(700);
    await cdp.snap("modals/anons-moh.jpg");
    await clickButtonInScope(cdp, "Özel Anonslar", "main");
    await sleep(700);
    console.log("  Anons + modal:", await clickFirstRowEdit(cdp));
    await sleep(900);
    await cdp.snap("modals/anons-tts-modal.jpg");

    // Toplu Konfigürasyon 4 modül sekmesi
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=toplu-konfigurasyon` });
    await sleep(2000);
    for (const [f, lbl] of [
      ["modals/bulk-users.jpg", "Kullanıcılar & Aboneler"],
      ["modals/bulk-subgroups.jpg", "Abone Grupları"],
      ["modals/bulk-queues.jpg", "ACD Arama Kuyrukları"],
      ["modals/bulk-outbound.jpg", "Giden Arama Kuralları"]
    ]) {
      const r = await clickButtonInScope(cdp, lbl, "main");
      await sleep(750);
      process.stdout.write(`  (${r}) `);
      await cdp.snap(f);
    }

    // Diğer tekil Ekle/Düzenle modalları
    const simpleModals = [
      { url: `${PBX_URL}/?tab=giden-arama-kurallari`, file: "modals/outbound-rule-edit.jpg" },
      { url: `${PBX_URL}/?tab=gelen-arama-kurallari`, file: "modals/inbound-rule-edit.jpg" },
      { url: `${PBX_URL}/?tab=cagri-toplama-gruplari`, file: "modals/pickup-group-edit.jpg" },
      { url: `${PBX_URL}/?tab=abone-gruplari`, file: "modals/subscriber-group-edit.jpg" },
      { url: `${PBX_URL}/?tab=konferans-odalari`, file: "modals/conference-edit.jpg" },
      { url: `${PBX_URL}/?tab=hizli-arama`, file: "modals/speed-dial-edit.jpg" },
      { url: `${PBX_URL}/?tab=karaliste`, file: "modals/blacklist-edit.jpg" },
      { url: `${PBX_URL}/?tab=zamanlanmis-raporlar`, file: "modals/scheduled-report-edit.jpg" },
      { url: `${PBX_URL}/?tab=dis-arama-dialer`, file: "modals/dialer-edit.jpg" },
      { url: `${PBX_URL}/?tab=otomatik-kurulum`, file: "modals/autoprovision-edit.jpg" },
      { url: `${PBX_URL}/?tab=rehber`, file: "modals/contact-edit.jpg" }
    ];
    for (const m of simpleModals) {
      await cdp.send("Page.navigate", { url: m.url });
      await sleep(2000);
      const r = await clickFirstRowEdit(cdp);
      await sleep(1100);
      process.stdout.write(`  (${r}) `);
      await cdp.snap(m.file);
    }

    // =========================================================================
    // 8. SİSTEM AYARLARI — TÜM 5 GRUP × 35 ALT EKRAN
    // =========================================================================
    console.log("\n=== [8] SİSTEM AYARLARI (TÜM 35 ALT EKRAN) ===");
    await cdp.send("Page.navigate", { url: `${PBX_URL}/?tab=ayarlar&subtab=santral-ayarlari` });
    await sleep(2400);

    const settingsGroups = [
      {
        groupBtn: "Santral & Ağ",
        items: [
          ["settings/01-santral-entegrasyonu.jpg", "Santral Entegrasyonu"],
          ["settings/02-sunucu-ag.jpg", "Sunucu Ağ (Network)"],
          ["settings/03-nornia-connect.jpg", "Nornia Connect"],
          ["settings/04-cok-subeli.jpg", "Çok-Şubeli Santral"],
          ["settings/05-web-ssh.jpg", "Sunucu Web SSH"],
          ["settings/06-nat.jpg", "NAT ve Dış IP"],
          ["settings/07-numara-plani.jpg", "Numara Planı"],
          ["settings/08-otoprovizyon-sablon.jpg", "Otoprovizyon Şablonları"],
          ["settings/09-ssl.jpg", "SSL Sertifikaları"]
        ]
      },
      {
        groupBtn: "Organizasyon & Lisans",
        items: [
          ["settings/10-roller.jpg", "Roller"],
          ["settings/11-kvkk.jpg", "KVKK & Gizlilik"],
          ["settings/12-active-directory.jpg", "Active Directory"],
          ["settings/13-lokasyon-departman.jpg", "Lokasyon ve Departmanlar"],
          ["settings/14-mola-tanimlari.jpg", "Mola Tanımları"],
          ["settings/15-musteri-tenant.jpg", "Müşteri (Tenant)"],
          ["settings/16-lisans-key.jpg", "Lisans & Key"]
        ]
      },
      {
        groupBtn: "Yapay Zeka & Analiz",
        items: [
          ["settings/17-ai-api.jpg", "Yapay Zeka API"],
          ["settings/18-ai-task-routing.jpg", "AI Görev & Model"],
          ["settings/19-qa.jpg", "Çağrı Kalite Kontrol"],
          ["settings/20-dil-algilama.jpg", "Otomatik Dil Algılama"],
          ["settings/21-duygu.jpg", "Dinamik Duygu"],
          ["settings/22-ai-fisildama.jpg", "AI Fısıldama"],
          ["settings/23-biyometrik-ses.jpg", "Biyometrik Ses"],
          ["settings/24-roi.jpg", "ROI Rapor Ayarları"]
        ]
      },
      {
        groupBtn: "Kanallar & Entegrasyon",
        items: [
          ["settings/25-kanallar.jpg", "Kanal Entegrasyonları"],
          ["settings/26-hazir-crm.jpg", "Hazır CRM"],
          ["settings/27-hizli-cevaplar.jpg", "Hızlı Cevaplar"],
          ["settings/28-evrensel-api.jpg", "Evrensel API"],
          ["settings/29-dis-api.jpg", "Kurumsal Dış API"],
          ["settings/30-email-bildirim.jpg", "E-Mail Bildirimleri"]
        ]
      },
      {
        groupBtn: "Bakım & Sistem",
        items: [
          ["settings/31-tarih-saat.jpg", "Tarih, Saat"],
          ["settings/32-sistem-yedekleme.jpg", "Sistem Yedekleme"],
          ["settings/33-geri-yukleme.jpg", "Geri Yükleme Noktası"],
          ["settings/34-kayit-saklama.jpg", "Kayıt & Saklama"],
          ["settings/35-sistem-versiyonu.jpg", "Sistem Versiyonu"]
        ]
      }
    ];

    for (const grp of settingsGroups) {
      const gr = await clickButtonInScope(cdp, grp.groupBtn, "main");
      console.log(`  [GRUP] ${grp.groupBtn} -> ${gr}`);
      await sleep(750);
      for (const [file, lbl] of grp.items) {
        const r = await clickButtonInScope(cdp, lbl, "main");
        await sleep(1100);
        process.stdout.write(`    (${r}) `);
        await cdp.snap(file);
      }
    }

    console.log("\n[DONE] Tüm sekme ve alt-ayar ekran görüntüleri tamamlandı ->", OUT_ROOT);
  } finally {
    if (cdp) cdp.close();
    try { chrome.kill("SIGKILL"); } catch (_) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
