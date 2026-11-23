#!/usr/bin/env node
/**
 * Nornia Docs — Canlı Santral Ekran Görüntüsü Yakalayıcı (Playwright)
 * ====================================================================
 * Varsayılan hedef: https://app.saphira.com.tr
 *
 * Kullanım:
 *   PBX_URL="https://app.saphira.com.tr" PBX_USER="admin" PBX_PASS="SIFRENIZ" \
 *     node scripts/portals/capture_pbx_screenshots.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch (e) {
    console.error("[HATA] Playwright bulunamadı. Kurmak için: npm i -D playwright && npx playwright install chromium");
    process.exit(1);
  }

  const PBX_URL = (process.env.PBX_URL || "https://app.saphira.com.tr").replace(/\/+$/, "");
  const PBX_USER = process.env.PBX_USER || "admin";
  const PBX_PASS = process.env.PBX_PASS || "";
  const OUT_ROOT = path.resolve(__dirname, "../../portals/docs-portal/public/screenshots");

  if (!PBX_PASS) {
    console.error("[HATA] Lütfen PBX_PASS ortam değişkenini verin (örn. PBX_PASS='...' node scripts/portals/capture_pbx_screenshots.mjs)");
    process.exit(1);
  }

  const TARGETS = [
    { file: "kurulum-ve-ilk-baslangic/01-login.png", url: `${PBX_URL}/login`, needsAuth: false },
    { file: "kurulum-ve-ilk-baslangic/02-system-info.png", url: `${PBX_URL}/?tab=system_status`, needsAuth: true },
    { file: "kullanicilar-ve-numara-plani/01-users-list.png", url: `${PBX_URL}/?tab=users`, needsAuth: true },
    { file: "kullanicilar-ve-numara-plani/02-numbering-plan.png", url: `${PBX_URL}/?tab=settings&subtab=numara-plani`, needsAuth: true },
    { file: "dis-hatlar-ve-arama-kurallari/01-trunks.png", url: `${PBX_URL}/?tab=trunks`, needsAuth: true },
    { file: "dis-hatlar-ve-arama-kurallari/02-inbound-outbound.png", url: `${PBX_URL}/?tab=inbound_rules`, needsAuth: true },
    { file: "arama-akisi-ve-ivr/01-call-flow.png", url: `${PBX_URL}/?tab=call_flow`, needsAuth: true },
    { file: "cagri-merkezi-ve-acd/01-call-panel.png", url: `${PBX_URL}/?tab=call_panel`, needsAuth: true },
    { file: "cagri-merkezi-ve-acd/02-wallboard.png", url: `${PBX_URL}/?tab=wallboard`, needsAuth: true },
    { file: "cagri-merkezi-ve-acd/03-queues.png", url: `${PBX_URL}/?tab=acd_queues`, needsAuth: true },
    { file: "yapay-zeka-suite/01-ai-agents.png", url: `${PBX_URL}/?tab=ai_agents`, needsAuth: true },
    { file: "yapay-zeka-suite/02-rag-kb.png", url: `${PBX_URL}/?tab=rag_kb`, needsAuth: true },
    { file: "yapay-zeka-suite/03-ai-providers.png", url: `${PBX_URL}/?tab=settings&subtab=ai-providers`, needsAuth: true },
    { file: "omnichannel-ve-crm/01-omnichannel.png", url: `${PBX_URL}/?tab=omnichannel`, needsAuth: true },
    { file: "omnichannel-ve-crm/02-channels.png", url: `${PBX_URL}/?tab=settings&subtab=kanallar`, needsAuth: true },
    { file: "oto-provizyon-ve-cihazlar/01-autoprovision.png", url: `${PBX_URL}/?tab=autoprovision`, needsAuth: true },
    { file: "raporlama-ve-analitik/01-reports-hub.png", url: `${PBX_URL}/?tab=reports`, needsAuth: true },
    { file: "raporlama-ve-analitik/02-cdr.png", url: `${PBX_URL}/?tab=reports&subtab=cdr`, needsAuth: true },
    { file: "ag-guvenlik-ve-merkezi-panel/01-security.png", url: `${PBX_URL}/?tab=security`, needsAuth: true },
    { file: "ag-guvenlik-ve-merkezi-panel/02-sngrep.png", url: `${PBX_URL}/?tab=troubleshooting`, needsAuth: true }
  ];

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  // 1. Login sayfası görseli
  console.log(`[1/2] Giriş ekranı yakalanıyor: ${PBX_URL}/login`);
  await page.goto(`${PBX_URL}/login`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const loginShot = path.join(OUT_ROOT, "kurulum-ve-ilk-baslangic/01-login.png");
  fs.mkdirSync(path.dirname(loginShot), { recursive: true });
  await page.screenshot({ path: loginShot, fullPage: false });

  // 2. Oturum aç
  console.log(`[2/2] ${PBX_USER} ile oturum açılıyor...`);
  const userInput = page.locator('input[type="text"], input[type="email"], input[name="username"]').first();
  const passInput = page.locator('input[type="password"]').first();
  await userInput.fill(PBX_USER);
  await passInput.fill(PBX_PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);

  for (const t of TARGETS.filter((x) => x.needsAuth)) {
    const dest = path.join(OUT_ROOT, t.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    console.log(`  → Yakalanıyor: ${t.file} (${t.url})`);
    try {
      await page.goto(t.url, { waitUntil: "networkidle", timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(1800);
      // Hassas şifre/API anahtarı alanlarını maskele
      await page.evaluate(() => {
        document.querySelectorAll('input[type="password"]').forEach((el) => {
          el.value = "";
        });
      });
      await page.screenshot({ path: dest, fullPage: false });
    } catch (err) {
      console.warn(`  [UYARI] ${t.file} yakalanamadı: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`[OK] Tüm ekran görüntüleri kaydedildi -> ${OUT_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
