#!/usr/bin/env python3
"""
Nornia Kurumsal Satış & Tanıtım Kataloğu — 10 Sayfalık A4 Vektörel PDF Üretici
Kullanım:
    python3 scripts/portals/build_sales_brochure_pdf.py
"""
import base64
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_PUBLIC = REPO_ROOT / "portals" / "web-portal" / "public"
DOCS_PUBLIC = REPO_ROOT / "portals" / "docs-portal" / "public"
OUT_PDF_WEB = WEB_PUBLIC / "Nornia-Kurumsal-Tanitim-Katalogu.pdf"
OUT_PDF_PREBUILT = REPO_ROOT / "portals" / "prebuilt" / "nornia-web" / "Nornia-Kurumsal-Tanitim-Katalogu.pdf"
HTML_TMP = Path("/tmp/nornia_sales_brochure.html")

CHROME_CANDIDATES = [
    os.environ.get("CHROME_BIN", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]


def img_data_uri(path: Path) -> str:
    ext = path.suffix.lower().lstrip(".")
    mime = "image/svg+xml" if ext == "svg" else ("image/png" if ext == "png" else "image/jpeg")
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def build_html() -> str:
    logo_svg = img_data_uri(WEB_PUBLIC / "favicon.svg")
    runa_logo = img_data_uri(WEB_PUBLIC / "runa-logo.png")
    shot_active_call = img_data_uri(WEB_PUBLIC / "screenshots" / "active-call-panel.jpg")
    shot_ai_agents = img_data_uri(WEB_PUBLIC / "screenshots" / "08-ai-agents.jpg")
    shot_omnichannel = img_data_uri(WEB_PUBLIC / "screenshots" / "05-omnichannel.jpg")
    shot_reports = img_data_uri(WEB_PUBLIC / "screenshots" / "35-reports-queue-sla.jpg")
    shot_runa_mobile = img_data_uri(WEB_PUBLIC / "screenshots" / "runa-mobile-real.jpg")
    shot_runa_desktop = img_data_uri(WEB_PUBLIC / "screenshots" / "runa-desktop-real.jpg")
    shot_callflow = img_data_uri(WEB_PUBLIC / "screenshots" / "26-call-flow.jpg")

    def footer(page_num: int, total: int = 11) -> str:
        return f"""
        <div class="page-footer">
          <div class="pf-left">
            <img src="{logo_svg}" class="pf-logo" alt="Nornia" />
            <span><strong>Nornia</strong> — Kurumsal Yapay Zeka İletişim Platformu</span>
          </div>
          <div class="pf-right">
            <span>www.nornia.com.tr</span>
            <span class="dot">•</span>
            <span>0850 360 73 90</span>
            <span class="dot">•</span>
            <span class="pf-num">{page_num:02d} / {total:02d}</span>
          </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Nornia — Kurumsal Satış ve Tanıtım Kataloğu</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
<style>
  @page {{
    size: A4 portrait;
    margin: 0;
  }}

  * {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}

  html, body {{
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 10pt;
    line-height: 1.5;
  }}

  h1, h2, h3, h4 {{
    font-family: "Plus Jakarta Sans", "Inter", sans-serif;
    margin: 0;
    letter-spacing: -0.025em;
  }}

  p {{
    margin: 0;
  }}

  .page {{
    width: 210mm;
    height: 297mm;
    position: relative;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    background: #ffffff;
    display: flex;
    flex-direction: column;
  }}

  .page:last-child {{
    page-break-after: auto;
    break-after: auto;
  }}

  /* Top signature prism ribbon */
  .prism-bar {{
    height: 4.5px;
    width: 100%;
    background: linear-gradient(90deg, #0ea5e9 0%, #4f46e5 28%, #7c3aed 50%, #db2777 72%, #f59e0b 88%, #10b981 100%);
    flex-shrink: 0;
  }}

  .content {{
    flex: 1;
    padding: 13mm 15mm 18mm 15mm;
    display: flex;
    flex-direction: column;
  }}

  /* Page Footer */
  .page-footer {{
    position: absolute;
    left: 15mm;
    right: 15mm;
    bottom: 7.5mm;
    padding-top: 3mm;
    border-top: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 7.8pt;
    color: #64748b;
  }}
  .pf-left {{
    display: flex;
    align-items: center;
    gap: 6px;
  }}
  .pf-logo {{
    width: 15px;
    height: 15px;
    border-radius: 4px;
  }}
  .pf-right {{
    display: flex;
    align-items: center;
    gap: 6px;
  }}
  .pf-right .dot {{ color: #cbd5e1; }}
  .pf-num {{
    background: #eef2ff;
    color: #312e81;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 7.5pt;
  }}

  /* Eyebrow & Section Header */
  .eyebrow {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 11px;
    border-radius: 999px;
    font-size: 7.8pt;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    background: #eef2ff;
    color: #3730a3;
    border: 1px solid #c7d2fe;
    width: fit-content;
  }}
  .eyebrow.emerald {{
    background: #ecfdf5;
    color: #047857;
    border-color: #a7f3d0;
  }}
  .eyebrow.rose {{
    background: #fff1f2;
    color: #be123c;
    border-color: #fecdd3;
  }}
  .eyebrow.sky {{
    background: #f0f9ff;
    color: #0369a1;
    border-color: #bae6fd;
  }}
  .eyebrow.amber {{
    background: #fffbeb;
    color: #b45309;
    border-color: #fde68a;
  }}

  .sec-title {{
    margin-top: 9px;
    font-size: 21pt;
    font-weight: 800;
    line-height: 1.15;
    color: #0f172a;
  }}
  .sec-sub {{
    margin-top: 7px;
    font-size: 10pt;
    color: #475569;
    line-height: 1.55;
    max-width: 175mm;
  }}

  /* Browser / App Frame */
  .shot-frame {{
    border: 1px solid #dbe2ee;
    border-radius: 14px;
    background: #ffffff;
    overflow: hidden;
    box-shadow: 0 14px 32px -14px rgba(15, 23, 42, 0.14);
  }}
  .shot-bar {{
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 7.6pt;
    color: #64748b;
    font-weight: 600;
  }}
  .shot-dots {{
    display: flex;
    gap: 5px;
  }}
  .shot-dots span {{
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #cbd5e1;
  }}
  .shot-dots span:nth-child(1) {{ background: #fb7185; }}
  .shot-dots span:nth-child(2) {{ background: #fbbf24; }}
  .shot-dots span:nth-child(3) {{ background: #34d399; }}
  .shot-img {{
    display: block;
    width: 100%;
    height: auto;
  }}

  /* Cards & Grids */
  .grid-2 {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }}
  .grid-3 {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 11px;
  }}
  .grid-4 {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }}

  .card {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 13px 14px;
  }}
  .card.soft {{
    background: #f8fafc;
  }}
  .card.indigo {{
    background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
    border-color: #c7d2fe;
  }}
  .card.dark {{
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
    border-color: #312e81;
    color: #ffffff;
  }}

  .card-title {{
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 10.2pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
  }}
  .card.dark .card-title {{ color: #ffffff; }}
  .card-desc {{
    font-size: 8.7pt;
    line-height: 1.48;
    color: #475569;
  }}
  .card.dark .card-desc {{ color: #cbd5e1; }}

  /* Feature list */
  .feat-list {{
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }}
  .feat-list li {{
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 9pt;
    color: #334155;
    line-height: 1.45;
  }}
  .check {{
    width: 16px;
    height: 16px;
    border-radius: 999px;
    background: #d1fae5;
    color: #047857;
    font-weight: 800;
    font-size: 9pt;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }}

  /* KPI Boxes */
  .kpi-val {{
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 20pt;
    font-weight: 800;
    color: #1e1b4b;
    line-height: 1.1;
  }}
  .kpi-lbl {{
    margin-top: 4px;
    font-size: 8.2pt;
    font-weight: 600;
    color: #475569;
    line-height: 1.3;
  }}

  /* Cover specific */
  .cover-bg {{
    background:
      radial-gradient(65% 45% at 88% 12%, rgba(79, 70, 229, 0.12) 0%, rgba(14, 165, 233, 0.06) 48%, transparent 78%),
      radial-gradient(50% 42% at 8% 82%, rgba(244, 63, 94, 0.07) 0%, rgba(16, 185, 129, 0.05) 45%, transparent 75%),
      linear-gradient(180deg, #fafbff 0%, #ffffff 60%, #f8fafc 100%);
  }}
  .cover-top {{
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}
  .brand-lockup {{
    display: flex;
    align-items: center;
    gap: 11px;
  }}
  .brand-lockup img {{
    width: 44px;
    height: 44px;
    border-radius: 12px;
    box-shadow: 0 8px 20px -6px rgba(30, 27, 75, 0.25);
  }}
  .brand-name {{
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 21pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.03em;
  }}
  .brand-tag {{
    font-size: 8.2pt;
    font-weight: 600;
    color: #64748b;
  }}
  .cover-badge {{
    padding: 5px 12px;
    border-radius: 999px;
    background: #1e1b4b;
    color: #ffffff;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }}
  .cover-h1 {{
    margin-top: 22px;
    font-size: 31pt;
    font-weight: 800;
    line-height: 1.09;
    color: #0f172a;
  }}
  .cover-h1 .accent {{
    background: linear-gradient(95deg, #312e81 0%, #4f46e5 45%, #0ea5e9 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }}
  .cover-lead {{
    margin-top: 13px;
    font-size: 11pt;
    line-height: 1.55;
    color: #475569;
    max-width: 170mm;
  }}

  /* Comparison Table */
  .cmp-table {{
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    overflow: hidden;
    font-size: 8.7pt;
  }}
  .cmp-table th {{
    text-align: left;
    padding: 9px 12px;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-weight: 700;
    font-size: 8.6pt;
    background: #f8fafc;
    color: #334155;
    border-bottom: 1px solid #e2e8f0;
  }}
  .cmp-table th.nornia-col {{
    background: #1e1b4b;
    color: #ffffff;
  }}
  .cmp-table td {{
    padding: 8.5px 12px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
    color: #475569;
  }}
  .cmp-table tr:last-child td {{ border-bottom: none; }}
  .cmp-table td.feat-col {{
    font-weight: 700;
    color: #0f172a;
    width: 26%;
  }}
  .cmp-table td.nornia-cell {{
    background: #fafbff;
    color: #1e1b4b;
    font-weight: 600;
  }}

  /* Language pill */
  .lang-pill {{
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 10px;
    font-size: 8.3pt;
    font-weight: 700;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #1e293b;
  }}
  .lang-pill.active {{
    background: #1e1b4b;
    color: #ffffff;
    border-color: #1e1b4b;
  }}

  /* Phone mockup inside PDF */
  .phone-bezel {{
    width: 145px;
    border: 4px solid #0f172a;
    border-radius: 22px;
    background: #ffffff;
    overflow: hidden;
    box-shadow: 0 12px 28px -10px rgba(15, 23, 42, 0.25);
    flex-shrink: 0;
  }}
  .phone-notch {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 10px 3px 10px;
    font-size: 6.5pt;
    font-weight: 700;
    color: #334155;
  }}
  .phone-island {{
    width: 38px;
    height: 9px;
    background: #0f172a;
    border-radius: 99px;
  }}
  .pill-tag {{
    display: inline-block;
    padding: 3px 8px;
    border-radius: 7px;
    font-size: 7.4pt;
    font-weight: 700;
    background: #eef2ff;
    color: #3730a3;
  }}
  .pill-tag.green {{
    background: #ecfdf5;
    color: #047857;
  }}
</style>
</head>
<body>

<!-- ======================================================================
     SAYFA 1 — LÜKS KURUMSAL KAPAK
     ====================================================================== -->
<section class="page cover-bg">
  <div class="prism-bar"></div>
  <div class="content" style="justify-content: space-between; padding-bottom: 13mm;">
    <div>
      <div class="cover-top">
        <div class="brand-lockup">
          <img src="{logo_svg}" alt="Nornia Logo" />
          <div>
            <div class="brand-name">Nornia</div>
            <div class="brand-tag">Akıllı İletişim Platformu</div>
          </div>
        </div>
        <div class="cover-badge">Kurumsal Ürün Kataloğu</div>
      </div>

      <h1 class="cover-h1">
        Tüm Kurumsal İletişiminiz<br/>
        <span class="accent">Tek Akıllı Platformda</span>
      </h1>

      <p class="cover-lead">
        Yapay zeka destekli kurumsal santral, 7/24 Türkçe konuşan sesli asistan,
        6 dilde canlı çağrı çevirisi, WhatsApp &amp; Instagram ortak gelen kutusu ve
        44+ yönetici raporuyla müşteri deneyiminizi bir üst seviyeye taşıyın.
      </p>

      <!-- 4 Executive Value Pills -->
      <div class="grid-4" style="margin-top: 16px;">
        <div class="card" style="padding: 10px 12px;">
          <div class="kpi-val" style="font-size: 16pt;">7/24</div>
          <div class="kpi-lbl">AI Sesli Asistan</div>
        </div>
        <div class="card" style="padding: 10px 12px;">
          <div class="kpi-val" style="font-size: 16pt; color: #0369a1;">6 Dil</div>
          <div class="kpi-lbl">Anlık Çağrı Çevirisi</div>
        </div>
        <div class="card" style="padding: 10px 12px;">
          <div class="kpi-val" style="font-size: 16pt; color: #047857;">44+</div>
          <div class="kpi-lbl">Canlı &amp; AI Rapor</div>
        </div>
        <div class="card" style="padding: 10px 12px;">
          <div class="kpi-val" style="font-size: 16pt; color: #be123c;">KVKK</div>
          <div class="kpi-lbl">Tam Veri Güvencesi</div>
        </div>
      </div>

      <!-- Real Live Product Hero Window -->
      <div class="shot-frame" style="margin-top: 18px;">
        <div class="shot-bar">
          <div class="shot-dots"><span></span><span></span><span></span></div>
          <span>Nornia Temsilci Çağrı Paneli — Canlı Görüşme &amp; AI Asistan</span>
          <span class="pill-tag green">Canlı Arayüz</span>
        </div>
        <img src="{shot_active_call}" class="shot-img" style="max-height: 112mm; object-fit: cover; object-position: top;" alt="Nornia Canlı Arayüz" />
      </div>
    </div>

    <!-- Cover Bottom Strip -->
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 14px; background: #0f172a; color: #ffffff;">
      <div>
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10pt; font-weight: 700;">
          Kendi Sunucunuzda (On-Premise) veya Yönetilen Bulutta Hazır
        </div>
        <div style="font-size: 8.2pt; color: #cbd5e1; margin-top: 2px;">
          Mevcut 0850 / 0212 hatlarınız ve Yealink, Cisco, Fanvil telefonlarınızla aynı gün devreye alın.
        </div>
      </div>
      <div style="text-align: right; font-size: 8.4pt; line-height: 1.45; flex-shrink: 0; padding-left: 12px;">
        <div style="font-weight: 800; color: #38bdf8;">www.nornia.com.tr</div>
        <div style="color: #e2e8f0;">0850 360 73 90 • info@nornia.com.tr</div>
      </div>
    </div>
  </div>
</section>

<!-- ======================================================================
     SAYFA 2 — NEDEN NORNIA? YÖNETİCİ ÖZETİ & ROI
     ====================================================================== -->
<section class="page">
  <div class="prism-bar"></div>
  <div class="content">
    <span class="eyebrow">Yönetici Özeti • İş Değeri</span>
    <h2 class="sec-title">Neden Kurumlar Nornia&apos;ya Geçiyor?</h2>
    <p class="sec-sub">
      Müşteriler artık telefonda dakikalarca beklemek ya da WhatsApp&apos;tan yazdığı sorunun
      ertesi güne kalmasını istemiyor. Nornia; telefon santralini, çağrı merkezini, WhatsApp/sosyal
      medyayı ve yapay zekayı tek çatı altında birleştirerek hem maliyeti düşürür hem satışları artırır.
    </p>

    <!-- 4 Big Impact Cards -->
    <div class="grid-4" style="margin-top: 16px;">
      <div class="card indigo">
        <div class="kpi-val">%65</div>
        <div class="kpi-lbl">Rutin çağrılarda yapay zeka ile anında çözüm ve iş yükü tasarrufu</div>
      </div>
      <div class="card soft">
        <div class="kpi-val" style="color: #047857;">%0</div>
        <div class="kpi-lbl">Cevapsız kalan müşteri — kaçan çağrılara otomatik WhatsApp dönüşü</div>
      </div>
      <div class="card soft">
        <div class="kpi-val" style="color: #0369a1;">3x</div>
        <div class="kpi-lbl">Tek ekrandan ses, WhatsApp, Instagram ve e-posta yöneten temsilci hızı</div>
      </div>
      <div class="card soft">
        <div class="kpi-val" style="color: #7c3aed;">Aynı Gün</div>
        <div class="kpi-lbl">Hızlı kurulum, mevcut numara ve masa telefonlarıyla kesintisiz geçiş</div>
      </div>
    </div>

    <!-- Comparison Table -->
    <div style="margin-top: 18px;">
      <h3 style="font-size: 11.5pt; font-weight: 800; color: #0f172a; margin-bottom: 9px;">
        Geleneksel Santraller ile Nornia Arasındaki Fark
      </h3>
      <table class="cmp-table">
        <thead>
          <tr>
            <th>İhtiyaç Alanı</th>
            <th>Geleneksel Santral Sistemleri</th>
            <th class="nornia-col">Nornia Akıllı İletişim Platformu</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="feat-col">Mesai Dışı &amp; Yoğun Saatler</td>
            <td>Müşteri bekler, hattı kapatır veya telesekretere mesaj bırakıp rakibe gider.</td>
            <td class="nornia-cell">7/24 doğal Türkçe konuşan AI Asistan anında karşılar, bilgi verir ve randevu/sipariş alır.</td>
          </tr>
          <tr>
            <td class="feat-col">Yabancı Müşteri Görüşmeleri</td>
            <td>Her dil için ayrı yabancı dil bilen personel istihdamı ve yüksek maliyet gerekir.</td>
            <td class="nornia-cell">6 dilde canlı çağrı çevirisi ile mevcut ekibiniz yabancı müşterilerle akıcı görüşür.</td>
          </tr>
          <tr>
            <td class="feat-col">WhatsApp &amp; Sosyal Medya</td>
            <td>Dağınık cep telefonlarında kaybolan mesajlar, ölçülemez yanıt süreleri.</td>
            <td class="nornia-cell">0850 WhatsApp, Instagram, Facebook, Telegram ve e-posta tek kurumsal gelen kutusunda.</td>
          </tr>
          <tr>
            <td class="feat-col">Ofis Dışı &amp; Hibrit Çalışma</td>
            <td>Sadece ofis masasına bağlı çalışma veya karmaşık uzaktan bağlantı sorunları.</td>
            <td class="nornia-cell">Runa Mobil, Runa Masaüstü ve tarayıcı Web Telefon ile evden ve sahadan HD kesintisiz erişim.</td>
          </tr>
          <tr>
            <td class="feat-col">Yönetici Raporlaması</td>
            <td>Yalnızca kimin kimi aradığını gösteren karmaşık ham listeler.</td>
            <td class="nornia-cell">44+ görsel rapor: müşteri duygu analizi, çağrı özeti, kalite puanı ve sabah e-posta özeti.</td>
          </tr>
          <tr>
            <td class="feat-col">Veri Güvenliği &amp; Sahiplik</td>
            <td>Verileriniz kontrolünüz dışındaki yabancı bulutlarda tutulur.</td>
            <td class="nornia-cell">İster kendi sunucunuzda %100 size ait kurulum, ister yönetilen Nornia Bulut — tam KVKK uyumu.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Bottom Executive Takeaway -->
    <div class="card dark" style="margin-top: 16px; padding: 15px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
      <div>
        <div class="card-title" style="font-size: 11pt;">Tek Platform, Tek Muhatap, Sürprizsiz Büyüme</div>
        <div class="card-desc" style="margin-top: 3px;">
          Santral, çağrı merkezi yazılımı, yapay zeka asistan, WhatsApp yönetim paneli ve raporlama aracı için
          5 farklı tedarikçiye ayrı ayrı lisans ödemek yerine tümünü Nornia ile tek merkezden yönetin.
        </div>
      </div>
      <div style="text-align: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; padding: 10px 16px; flex-shrink: 0;">
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16pt; font-weight: 800; color: #34d399;">5&apos;i 1 Arada</div>
        <div style="font-size: 7.6pt; color: #e2e8f0;">Bütünleşik Platform</div>
      </div>
    </div>
  </div>
  {footer(2)}
</section>

<!-- ======================================================================
     SAYFA 3 — 7/24 YAPAY ZEKA SESLİ ASİSTAN
     ====================================================================== -->
<section class="page">
  <div class="prism-bar"></div>
  <div class="content">
    <span class="eyebrow">Yapay Zeka Sesli Asistan</span>
    <h2 class="sec-title">Hiç Yorulmayan, 7/24 Doğal Konuşan Dijital Ekip Arkadaşınız</h2>
    <p class="sec-sub">
      Nornia&apos;nın yapay zeka sesli asistanı robotik tuşlama menülerinin aksine müşterilerinizle
      gerçek bir insan gibi akıcı Türkçe konuşur, şirketinizin dokümanlarını bilir, randevu oluşturur
      ve gerektiğinde çağrıyı saniyeler içinde doğru personele aktarır.
    </p>

    <div class="shot-frame" style="margin-top: 14px;">
      <div class="shot-bar">
        <div class="shot-dots"><span></span><span></span><span></span></div>
        <span>Nornia Yapay Zeka Temsilcileri &amp; Senaryo Stüdyosu</span>
        <span class="pill-tag">Kodsuz Görsel Tasarım</span>
      </div>
      <img src="{shot_ai_agents}" class="shot-img" style="max-height: 92mm; object-fit: cover; object-position: top;" alt="AI Sesli Asistan" />
    </div>

    <div class="grid-2" style="margin-top: 14px;">
      <div class="card">
        <div class="card-title">Kurumsal Bilgi Hafızanızdan Doğru Yanıt</div>
        <div class="card-desc">
          Web sitenizi, fiyat listenizi, hizmet kataloğunuzu veya sık sorulan sorular PDF&apos;inizi
          sisteme yüklemeniz yeterli. Asistan saniyeler içinde şirketinizi öğrenir ve müşterilere
          her zaman güncel, tutarlı bilgi verir.
        </div>
      </div>
      <div class="card">
        <div class="card-title">Görüşme Esnasında Canlı İşlem &amp; Randevu</div>
        <div class="card-desc">
          Sadece sohbet etmez — iş yapar. Müşterinin tarih/saat tercihini alır, uygunluğu kontrol
          eder, randevuyu takvime işler, sipariş durumunu sorgular ve özetini WhatsApp veya e-posta ile iletir.
        </div>
      </div>
      <div class="card">
        <div class="card-title">İsimle Doğru Personele Akıllı Aktarım</div>
        <div class="card-desc">
          Müşteri &ldquo;Muhasebeden Selin Hanım ile görüşmek istiyorum&rdquo; dediğinde dahili numara
          bilmesine gerek kalmaz; yapay zeka şirket rehberinden kişiyi bulup çağrıyı doğrudan bağlar.
        </div>
      </div>
      <div class="card">
        <div class="card-title">KVKK Onayı &amp; Kurumsal Konuşma Üslubu</div>
        <div class="card-desc">
          Görüşme başında sesli KVKK aydınlatmasını ve onayını otomatik alır. Markanızın kimliğine göre
          samimi, satış odaklı veya resmi kurumsal konuşma tonunu tek tıkla belirleyebilirsiniz.
        </div>
      </div>
    </div>

    <!-- Real Life Scenario Box -->
    <div class="card indigo" style="margin-top: 14px; padding: 13px 16px;">
      <div style="font-size: 8.2pt; font-weight: 800; color: #3730a3; text-transform: uppercase; letter-spacing: 0.04em;">
        Örnek Gerçek Müşteri Senaryosu — Gece 23:15
      </div>
      <div class="grid-3" style="margin-top: 8px; gap: 10px;">
        <div style="background: #ffffff; border-radius: 10px; padding: 9px 11px; border: 1px solid #e0e7ff;">
          <div style="font-size: 8pt; font-weight: 800; color: #1e1b4b;">1. Müşteri Arar</div>
          <div style="font-size: 8.1pt; color: #475569; margin-top: 2px;">Ofis kapalıyken arayan müşteri yarın için randevu ve fiyat bilgisi ister.</div>
        </div>
        <div style="background: #ffffff; border-radius: 10px; padding: 9px 11px; border: 1px solid #e0e7ff;">
          <div style="font-size: 8pt; font-weight: 800; color: #1e1b4b;">2. AI Anında Çözer</div>
          <div style="font-size: 8.1pt; color: #475569; margin-top: 2px;">Asistan 1 saniyede yanıtlar, doğru fiyatı paylaşır ve uygun saate randevu açar.</div>
        </div>
        <div style="background: #ffffff; border-radius: 10px; padding: 9px 11px; border: 1px solid #e0e7ff;">
          <div style="font-size: 8pt; font-weight: 800; color: #1e1b4b;">3. Onay &amp; Kayıt</div>
          <div style="font-size: 8.1pt; color: #475569; margin-top: 2px;">Sabah ekibiniz masasına oturduğunda randevu, ses kaydı ve görüşme özeti hazırdır.</div>
        </div>
      </div>
    </div>
  </div>
  {footer(3)}
</section>

<!-- ======================================================================
     SAYFA 4 — 6 DİLDE CANLI ÇAĞRI ÇEVİRİSİ (YILDIZ ÖZELLİK)
     ====================================================================== -->
<section class="page">
  <div class="prism-bar"></div>
  <div class="content">
    <span class="eyebrow sky">Benzersiz Rekabet Avantajı • Simultane Tercüman</span>
    <h2 class="sec-title">Yabancı Dil Bariyerini Kaldıran 6 Dilde Canlı Çağrı Çevirisi</h2>
    <p class="sec-sub">
      Yurt dışından arayan müşterileriniz için her dilde ayrı personel bulmanıza gerek yok.
      Nornia&apos;nın canlı çağrı çevirmeni aktif telefon görüşmesi sırasında iki taraf arasında
      anlık altyazı ve çift yönlü sesli tercüme yaparak ekibinizi küresel bir satış gücüne dönüştürür.
    </p>

    <!-- 6 Languages Strip -->
    <div style="display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px;">
      <span class="lang-pill active">EN • İngilizce</span>
      <span class="lang-pill">DE • Almanca</span>
      <span class="lang-pill">RU • Rusça</span>
      <span class="lang-pill">AR • Arapça</span>
      <span class="lang-pill">FR • Fransızca</span>
      <span class="lang-pill">ES • İspanyolca</span>
      <span class="lang-pill" style="background: #ecfdf5; border-color: #a7f3d0; color: #047857;">↔ Türkçe Çift Yönlü</span>
    </div>

    <!-- Visual Live Dialogue Box -->
    <div class="card soft" style="margin-top: 14px; padding: 16px; border-color: #c7d2fe;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px;">
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10.5pt; font-weight: 800; color: #1e1b4b;">
          Canlı Telefon Görüşmesinde Nasıl Çalışır?
        </div>
        <span class="pill-tag green">Anlık Altyazı + Çift Yönlü Sesli Dublaj</span>
      </div>

      <div class="grid-2" style="gap: 12px;">
        <div class="card" style="padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; font-size: 7.6pt; font-weight: 700; color: #64748b;">
            <span>YABANCI MÜŞTERİ KONUŞUR (EN)</span>
            <span style="color: #4f46e5;">→ TEMSİLCİYE TÜRKÇE</span>
          </div>
          <p style="margin-top: 7px; font-size: 8.6pt; font-style: italic; color: #64748b;">
            &ldquo;Hello, I would like to book an appointment and ask about your corporate package.&rdquo;
          </p>
          <p style="margin-top: 7px; font-size: 9.6pt; font-weight: 700; color: #0f172a; background: #f8fafc; padding: 8px 10px; border-radius: 9px; border-left: 3px solid #4f46e5;">
            &ldquo;Merhaba, randevu almak ve kurumsal paketleriniz hakkında bilgi istemek için aradım.&rdquo;
          </p>
        </div>

        <div class="card" style="padding: 12px 14px; background: #f5f7ff; border-color: #c7d2fe;">
          <div style="display: flex; justify-content: space-between; font-size: 7.6pt; font-weight: 700; color: #3730a3;">
            <span>TEMSİLCİ TÜRKÇE YANITLAR (TR)</span>
            <span style="color: #047857;">→ MÜŞTERİYE SESLİ OKUNUR</span>
          </div>
          <p style="margin-top: 7px; font-size: 8.6pt; color: #475569;">
            &ldquo;Memnuniyetle yardımcı olayım, yarın saat 14:00 sizin için uygun mudur?&rdquo;
          </p>
          <p style="margin-top: 7px; font-size: 9.6pt; font-weight: 700; color: #1e1b4b; background: #ffffff; padding: 8px 10px; border-radius: 9px; border-left: 3px solid #10b981;">
            &ldquo;I would be happy to help, would tomorrow at 2:00 PM work for you?&rdquo;
          </p>
        </div>
      </div>
    </div>

    <!-- 3 Key Capabilities -->
    <div class="grid-3" style="margin-top: 14px;">
      <div class="card">
        <div class="pill-tag" style="margin-bottom: 7px;">Konuşarak Çeviri</div>
        <div class="card-title">Akıllı Ses Dengeleme</div>
        <div class="card-desc">
          Müşteri yabancı dilde konuşurken orijinal ses yumuşakça kısılır ve Türkçe tercüme
          net biçimde temsilcinizin kulaklığına verilir.
        </div>
      </div>
      <div class="card">
        <div class="pill-tag green" style="margin-bottom: 7px;">Yazarak Seslendir</div>
        <div class="card-title">Yazın, Nornia Konuşsun</div>
        <div class="card-desc">
          Temsilciniz cevabı Türkçe yazıp Enter&apos;a bastığında Nornia anında müşterinin diline
          çevirir ve doğrudan telefon hattına doğal sesle okur.
        </div>
      </div>
      <div class="card">
        <div class="pill-tag" style="margin-bottom: 7px; background: #fffbeb; color: #b45309;">Esnek Kontrol</div>
        <div class="card-title">3 Farklı Dinleme Modu</div>
        <div class="card-desc">
          Çevrilen sesin yalnızca müşteriye, hem müşteriye hem temsilciye veya ön dinleme için
          yalnızca temsilciye gitmesini tek tıkla seçebilirsiniz.
        </div>
      </div>
    </div>

    <!-- Business Impact Box -->
    <div class="card dark" style="margin-top: 15px; padding: 15px 18px;">
      <div class="card-title" style="font-size: 10.8pt;">Hangi İşletmeler İçin Oyun Değiştirici?</div>
      <div class="grid-2" style="margin-top: 9px; gap: 10px;">
        <div style="font-size: 8.6pt; color: #e2e8f0; line-height: 1.48;">
          • <strong style="color: #38bdf8;">Sağlık Turizmi &amp; Klinikler:</strong> İngilizce, Almanca, Arapça ve Rusça hasta aramalarında anında güven veren iletişim.<br/>
          • <strong style="color: #38bdf8;">Oteller &amp; Turizm:</strong> Rezervasyon ve misafir taleplerinde dil engeli olmadan %100 memnuniyet.
        </div>
        <div style="font-size: 8.6pt; color: #e2e8f0; line-height: 1.48;">
          • <strong style="color: #34d399;">İhracat &amp; Lojistik:</strong> Yurt dışı müşteri ve tedarikçi çağrılarında anında net anlaşma.<br/>
          • <strong style="color: #34d399;">Global E-Ticaret:</strong> Ek personel almadan uluslararası müşteri desteği sunma imkanı.
        </div>
      </div>
    </div>
  </div>
  {footer(4)}
</section>

<!-- ======================================================================
     SAYFA 5 — TEMSİLCİ ÇAĞRI PANELİ
     ====================================================================== -->
<section class="page">
  <div class="prism-bar"></div>
  <div class="content">
    <span class="eyebrow emerald">Temsilci Çalışma Alanı</span>
    <h2 class="sec-title">Yüzlerce Temsilci İçin Kurulumsuz, Hızlı ve Akıllı Çağrı Paneli</h2>
    <p class="sec-sub">
      Bir kurumda 1–2 yönetici ama onlarca veya yüzlerce çalışan bulunur. Nornia Temsilci Çağrı Paneli,
      ekibinizin ekstra program kurmadan yalnızca tarayıcıdan tüm çağrıları, notları, mola sürelerini ve
      müşteri geçmişini tek ekrandan yönetmesi için tasarlandı.
    </p>

    <div class="shot-frame" style="margin-top: 13px;">
      <div class="shot-bar">
        <div class="shot-dots"><span></span><span></span><span></span></div>
        <span>Temsilci Çağrı Paneli — Aktif Görüşme, 360° Müşteri Kartı &amp; AI Not Çıkar</span>
        <span class="pill-tag green">Tarayıcıdan Anında Hazır</span>
      </div>
      <img src="{shot_active_call}" class="shot-img" style="max-height: 98mm; object-fit: cover; object-position: top;" alt="Temsilci Çağrı Paneli" />
    </div>

    <div class="grid-2" style="margin-top: 14px; gap: 12px;">
      <div class="card">
        <div class="card-title">Görüşme İçi Tüm Profesyonel Kontroller</div>
        <ul class="feat-list" style="margin-top: 7px;">
          <li><span class="check">✓</span><span><strong>Kör &amp; Danışmalı Aktarım:</strong> Çağrıyı önce iş arkadaşınızla konuşup sonra aktarın veya tek tıkla yönlendirin.</span></li>
          <li><span class="check">✓</span><span><strong>Çoklu Konferans &amp; Çift Hat:</strong> Aynı anda iki hattı yönetin, üçüncü kişiyi görüşmeye dahil edin.</span></li>
          <li><span class="check">✓</span><span><strong>AI Not Çıkar:</strong> Görüşme bitiminde tek tıkla konuşmanın profesyonel özetini ve sonuç kodunu kaydedin.</span></li>
        </ul>
      </div>
      <div class="card">
        <div class="card-title">360° Müşteri Hafızası &amp; Ekip Yönetimi</div>
        <ul class="feat-list" style="margin-top: 7px;">
          <li><span class="check">✓</span><span><strong>Anında Müşteri Kartı:</strong> Telefon çaldığı anda arayanın geçmiş çağrıları, notları ve CRM bilgisi ekranda açılır.</span></li>
          <li><span class="check">✓</span><span><strong>Mola &amp; Vardiya Takibi:</strong> Temsilciler yemek/ihtiyaç molalarını tek tıkla seçer, günlük performansını canlı görür.</span></li>
          <li><span class="check">✓</span><span><strong>Yönetici Koçluğu (Fısıldama):</strong> Süpervizörler görüşmeyi canlı dinleyebilir, müşteriye duyurmadan temsilciye yol gösterebilir.</span></li>
        </ul>
      </div>
    </div>
  </div>
  {footer(5)}
</section>

<!-- ======================================================================
     SAYFA 6 — OMNICHANNEL ORTAK GELEN KUTUSU
     ====================================================================== -->
<section class="page">
  <div class="prism-bar"></div>
  <div class="content">
    <span class="eyebrow emerald">Omnichannel • Çok Kanallı İletişim</span>
    <h2 class="sec-title">WhatsApp, Instagram, Telegram ve E-Posta Tek Gelen Kutusunda</h2>
    <p class="sec-sub">
      Müşterileriniz size hangi kanaldan ulaşırsa ulaşsın dağınık telefonlar ve unutulan mesajlar
      tarih olur. Tüm yazılı kanalları kurumsal hafıza altında toplayın; yapay zeka ilk yanıtı anında
      versin, ihtiyaç duyulduğunda canlı temsilciniz devralsın.
    </p>

    <div class="shot-frame" style="margin-top: 13px;">
      <div class="shot-bar">
        <div class="shot-dots"><span></span><span></span><span></span></div>
        <span>Ortak Gelen Kutusu — WhatsApp 0850, Instagram DM, Facebook, Telegram &amp; E-Posta</span>
        <span class="pill-tag green">5 Kanal Tek Ekranda</span>
      </div>
      <img src="{shot_omnichannel}" class="shot-img" style="max-height: 92mm; object-fit: cover; object-position: top;" alt="Omnichannel Gelen Kutusu" />
    </div>

    <div class="grid-2" style="margin-top: 14px;">
      <div class="card indigo">
        <div class="card-title">Cevapsız Çağrılara Otomatik WhatsApp Dönüşü</div>
        <div class="card-desc">
          Yoğunluk veya mesai dışı nedeniyle yanıtlanamayan bir arama olduğunda Nornia arayan müşteriye
          saniyeler içinde kurumsal WhatsApp hattınızdan nazik bir karşılama mesajı gönderir.
          Hiçbir satış fırsatı boşa gitmez.
        </div>
      </div>
      <div class="card">
        <div class="card-title">Çoklu 0850 WhatsApp Hattı &amp; Akıllı Menü</div>
        <div class="card-desc">
          Satış, destek veya farklı şubeleriniz için birden fazla resmi WhatsApp hattını tek panelde
          yönetin. İlk mesajda <em>Fiyat &amp; Bilgi</em>, <em>Randevu Al</em>, <em>Canlı Temsilci</em>
          gibi hızlı seçim butonları sunun.
        </div>
      </div>
      <div class="card">
        <div class="card-title">Toplu Kampanya &amp; Müşteri Bilgilendirme</div>
        <div class="card-desc">
          Excel/CSV müşteri listenizi tek tıkla yükleyerek kampanya duyuruları, randevu hatırlatmaları
          ve özel bilgilendirmeleri kurumsal WhatsApp hattınız üzerinden güvenle ulaştırın.
        </div>
      </div>
      <div class="card">
        <div class="card-title">Yapay Zeka + Canlı Temsilci Uyumlu Devir</div>
        <div class="card-desc">
          Mesai dışında veya rutin sorularda yapay zeka yanıt verir; müşteri canlı temsilci istediğinde
          sohbet tüm geçmişiyle birlikte anında ilgili temsilcinin ekranına aktarılır.
        </div>
      </div>
    </div>
  </div>
  {footer(6)}
</section>

<!-- ======================================================================
     SAYFA 7 — RUNA MOBİL, RUNA MASAÜSTÜ & MASA TELEFONLARI
     ====================================================================== -->
<section class="page">
  <div class="prism-bar"></div>
  <div class="content">
    <span class="eyebrow">Her Cihazda Kesintisiz İletişim</span>
    <h2 class="sec-title">Runa Mobil &amp; Runa Masaüstü: Ofis Dahiliniz Her Yerde</h2>
    <p class="sec-sub">
      Ekibiniz ister ofiste masa başında, ister evde, ister müşteri ziyaretinde olsun — kurumsal
      numaranızla yüksek ses kalitesinde iletişim kurar; kişisel telefon numaralarını paylaşmak zorunda kalmaz.
    </p>

    <div class="grid-2" style="margin-top: 14px; gap: 14px;">
      <!-- Runa Mobile Showcase Card -->
      <div class="card soft" style="padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="pill-tag">iOS &amp; Android Uygulaması</span>
          <h3 style="font-size: 12pt; font-weight: 800; color: #0f172a; margin-top: 7px;">Runa Mobil</h3>
          <div style="display: flex; align-items: center; gap: 12px; margin-top: 11px;">
            <div class="phone-bezel">
              <div class="phone-notch">
                <span>09:41</span>
                <div class="phone-island"></div>
                <span>5G</span>
              </div>
              <div style="display: flex; align-items: center; gap: 5px; padding: 3px 7px; border-bottom: 1px solid #f1f5f9;">
                <img src="{runa_logo}" style="width: 14px; height: 14px; border-radius: 4px;" alt="Runa" />
                <span style="font-size: 7pt; font-weight: 800; color: #0f172a;">Runa Mobil</span>
                <span style="margin-left: auto; font-size: 6.2pt; font-weight: 700; color: #047857;">● Aktif</span>
              </div>
              <img src="{shot_runa_mobile}" style="display: block; width: 100%; height: 185px; object-fit: contain; background: #fff; padding: 2px;" alt="Runa Mobil Gerçek Ekran" />
            </div>

            <div style="display: flex; flex-direction: column; gap: 7px; flex: 1;">
              <div class="card" style="padding: 8px 10px;">
                <div style="font-size: 8.2pt; font-weight: 800; color: #0f172a;">QR ile 3 sn Kurulum</div>
                <div style="font-size: 7.4pt; color: #475569; margin-top: 1px;">Şifre yazmadan tek taramayla anında oturum açın.</div>
              </div>
              <div class="card" style="padding: 8px 10px;">
                <div style="font-size: 8.2pt; font-weight: 800; color: #0f172a;">Call Flip</div>
                <div style="font-size: 7.4pt; color: #475569; margin-top: 1px;">Görüşmeyi kesmeden masadan cebe, cepten masaya aktarın.</div>
              </div>
              <div class="card" style="padding: 8px 10px;">
                <div style="font-size: 8.2pt; font-weight: 800; color: #0f172a;">Anında Çalma</div>
                <div style="font-size: 7.4pt; color: #475569; margin-top: 1px;">Uygulama kapalıyken bile pil tüketmeden çağrıları bildirir.</div>
              </div>
            </div>
          </div>
        </div>
        <p style="margin-top: 11px; font-size: 8.2pt; color: #475569; line-height: 1.45;">
          Kurumsal rehber, çağrı geçmişi, sesli posta ve ekip içi sohbet ofis dışındayken de cebinizde.
        </p>
      </div>

      <!-- Runa Desktop Showcase Card -->
      <div class="card soft" style="padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="pill-tag green">macOS &amp; Windows (.dmg / .exe)</span>
          <h3 style="font-size: 12pt; font-weight: 800; color: #0f172a; margin-top: 7px;">Runa Masaüstü</h3>
          <div class="shot-frame" style="margin-top: 11px;">
            <div class="shot-bar" style="padding: 5px 9px;">
              <div class="shot-dots"><span></span><span></span><span></span></div>
              <span style="font-size: 7pt;">Runa Masaüstü • Dahili 1000</span>
              <span style="color: #047857; font-size: 6.8pt;">● Müsait</span>
            </div>
            <img src="{shot_runa_desktop}" style="display: block; width: 100%; height: 158px; object-fit: cover; object-position: top;" alt="Runa Masaüstü Gerçek Ekran" />
          </div>

          <div class="grid-2" style="margin-top: 9px; gap: 7px;">
            <div class="card" style="padding: 8px 10px;">
              <div style="font-size: 8pt; font-weight: 800; color: #0f172a;">3 Bağımsız Ses Aygıtı</div>
              <div style="font-size: 7.3pt; color: #475569; margin-top: 2px;">Mikrofon, kulaklık ve zil hoparlörünü ayrı ayrı seçin.</div>
            </div>
            <div class="card" style="padding: 8px 10px;">
              <div style="font-size: 8pt; font-weight: 800; color: #0f172a;">Akıllı Masaüstü Bildirimi</div>
              <div style="font-size: 7.3pt; color: #475569; margin-top: 2px;">Çağrı geldiğinde pencere otomatik öne çıkar; sistem tepsisinde çalışır.</div>
            </div>
          </div>
        </div>
        <p style="margin-top: 11px; font-size: 8.2pt; color: #475569; line-height: 1.45;">
          E-postayla gönderilen tek tık kolay giriş linkiyle BT desteği beklemeden saniyeler içinde hazır.
        </p>
      </div>
    </div>

    <!-- Hardware Phones + Visual Call Flow Banner -->
    <div class="card" style="margin-top: 14px; padding: 14px 16px; display: flex; align-items: center; gap: 16px;">
      <div style="flex: 1;">
        <div class="eyebrow amber" style="margin-bottom: 6px;">Mevcut Yatırımınızı Koruyun</div>
        <div class="card-title" style="font-size: 11pt;">Masa Telefonlarınızla Sıfır Dokunuşlu Uyum</div>
        <div class="card-desc" style="margin-top: 4px;">
          Elinizdeki <strong>Yealink, Cisco, Fanvil ve Grandstream</strong> IP masa telefonlarını
          değiştirmenize gerek yok. Nornia telefonlarınızı otomatik tanır, tuşlarını ve kurumsal
          rehberini uzaktan yapılandırır. Çalışanlarınız masa telefonu, bilgisayar ve cep telefonunu
          birlikte uyumlu biçimde kullanabilir.
        </div>
      </div>
      <div style="width: 175px; flex-shrink: 0;">
        <div class="shot-frame">
          <img src="{shot_callflow}" class="shot-img" style="height: 82px; object-fit: cover;" alt="Görsel Arama Akışı" />
        </div>
        <div style="text-align: center; font-size: 7.2pt; font-weight: 600; color: #64748b; margin-top: 4px;">
          Sürükle-bırak karşılama &amp; IVR akışı
        </div>
      </div>
    </div>
  </div>
  {footer(7)}
</section>

<!-- ======================================================================
     SAYFA 8 — 44+ YÖNETİCİ RAPORU & AI ANALİTİK
     ====================================================================== -->
<section class="page">
  <div class="prism-bar"></div>
  <div class="content">
    <span class="eyebrow rose">44+ Yönetici Raporu &amp; İş Zekası</span>
    <h2 class="sec-title">Tahmin Etmeyin — Her Görüşmeyi Net Verilerle Yönetin</h2>
    <p class="sec-sub">
      Nornia yalnızca çağrıları kaydetmekle kalmaz; yapay zeka ile her görüşmeyi dinler, metne döker,
      müşterinin memnuniyet düzeyini ölçer ve yöneticilere her sabah tek bakışta aksiyon alabilecekleri
      anlaşılır raporlar sunar.
    </p>

    <div class="shot-frame" style="margin-top: 13px;">
      <div class="shot-bar">
        <div class="shot-dots"><span></span><span></span><span></span></div>
        <span>Nornia Analitik — Kuyruk SLA, Cevaplama Hızı &amp; Canlı Performans Grafikleri</span>
        <span class="pill-tag" style="background: #fff1f2; color: #be123c;">Excel &amp; PDF Dışa Aktarım</span>
      </div>
      <img src="{shot_reports}" class="shot-img" style="max-height: 92mm; object-fit: cover; object-position: top;" alt="44+ Rapor Ekranı" />
    </div>

    <div class="grid-3" style="margin-top: 14px;">
      <div class="card">
        <div class="card-title">Yönetici &amp; CEO Özeti</div>
        <div class="card-desc">
          Günlük/haftalık kaç çağrı geldi, kaçı yanıtlandı, ortalama bekleme süresi ve ekip
          verimliliği tek bakışta özetlenir; belirlediğiniz saatte e-postanıza otomatik gönderilir.
        </div>
      </div>
      <div class="card">
        <div class="card-title">Duygu Analizi &amp; Şikayet Radarı</div>
        <div class="card-desc">
          Hangi görüşmede müşteri memnun ayrıldı, hangi konuda gerginlik yaşandı, müşterilerin en sık
          şikayet ettiği noktalar neler — yapay zeka otomatik tespit edip raporlar.
        </div>
      </div>
      <div class="card">
        <div class="card-title">Otomatik Kalite Puanlama (QA)</div>
        <div class="card-desc">
          Tüm görüşmelerin yalnızca %1&apos;ini değil, %100&apos;ünü kendi kurumsal kalite kriterlerinize
          göre yapay zeka puanlar; eğitim ihtiyacı olan temsilcileri anında gösterir.
        </div>
      </div>
      <div class="card soft">
        <div class="card-title">AI vs İnsan Verimlilik (ROI)</div>
        <div class="card-desc">
          Yapay zeka asistanın kaç saatlik görüşmeyi üstlendiğini ve işletmenize sağladığı net
          zaman/maliyet kazancını şeffaf grafiklerle görün.
        </div>
      </div>
      <div class="card soft">
        <div class="card-title">Kaçan Çağrı &amp; Tekrar Arayanlar</div>
        <div class="card-desc">
          Cevapsız kalan ve henüz geri dönülmemiş müşterileri kırmızı listede yakalayın; ilk aramada
          çözüm (FCR) oranınızı düzenli artırın.
        </div>
      </div>
      <div class="card soft">
        <div class="card-title">Özel Rapor Tasarımcısı</div>
        <div class="card-desc">
          Hazır 44+ rapora ek olarak sürükle-bırak arayüzle kendi departmanınıza özel tablolar
          oluşturup tek tıkla Excel veya PDF indirin.
        </div>
      </div>
    </div>
  </div>
  {footer(8)}
</section>

<!-- ======================================================================
     SAYFA 9 — SEKTÖREL ÇÖZÜMLER, GÜVENLİK & ESNEK MODELLER
     ====================================================================== -->
<section class="page">
  <div class="prism-bar"></div>
  <div class="content">
    <span class="eyebrow">Sektörel Çözümler &amp; Sahiplik Modelleri</span>
    <h2 class="sec-title">Sektörünüze Hazır, Büyümenize Uyumlu Kurulum Seçenekleri</h2>
    <p class="sec-sub">
      İster 10 kişilik butik bir klinik, ister 1.000+ temsilcili çok şubeli bir çağrı merkezi olun;
      Nornia iş modelinize ve veri gizliliği politikanıza birebir uyum sağlar.
    </p>

    <!-- 4 Sector Cards -->
    <div class="grid-2" style="margin-top: 13px; gap: 10px;">
      <div class="card soft" style="padding: 11px 13px;">
        <div class="card-title">Çağrı Merkezleri &amp; Müşteri Hizmetleri</div>
        <div class="card-desc">
          Akıllı kuyruk dağıtımı, canlı wallboard ekranları, mola puantajı, dış arama kampanyaları ve
          otomatik kalite puanlama ile yüksek hacimde tam kontrol.
        </div>
      </div>
      <div class="card soft" style="padding: 11px 13px;">
        <div class="card-title">Sağlık, Hastane &amp; Klinikler</div>
        <div class="card-desc">
          7/24 sesli ve WhatsApp randevu asistanı, sağlık turizmi için 6 dilde canlı çağrı çevirisi,
          sesli KVKK onayı ve cevapsız hasta aramalarına anında WhatsApp dönüşü.
        </div>
      </div>
      <div class="card soft" style="padding: 11px 13px;">
        <div class="card-title">E-Ticaret &amp; Perakende</div>
        <div class="card-desc">
          Telefon, WhatsApp ve Instagram&apos;dan gelen sipariş, kargo ve iade sorularına anında yanıt;
          kampanya dönemlerinde kuyruk birikmeden kesintisiz müşteri memnuniyeti.
        </div>
      </div>
      <div class="card soft" style="padding: 11px 13px;">
        <div class="card-title">Çok Şubeli Kurumlar, Oteller &amp; Finans</div>
        <div class="card-desc">
          Tüm şubelerinizi tek merkezden yönetin; departmanlar arası ücretsiz dahili görüşme,
          kurumsal yetkilendirme ve tam veri izolasyonu ile regülasyonlara uyun.
        </div>
      </div>
    </div>

    <!-- 3 Deployment / Ownership Models -->
    <h3 style="font-size: 11.2pt; font-weight: 800; color: #0f172a; margin-top: 16px; margin-bottom: 9px;">
      Size En Uygun Kullanım Modelini Seçin
    </h3>
    <div class="grid-3" style="gap: 10px;">
      <div class="card" style="padding: 13px;">
        <div class="pill-tag" style="margin-bottom: 7px;">Tam Veri Hakimiyeti</div>
        <div class="card-title">Kendi Sunucunuzda (On-Premise)</div>
        <ul class="feat-list" style="margin-top: 8px; gap: 6px;">
          <li style="font-size: 8.2pt;"><span class="check" style="width:14px;height:14px;font-size:8pt;">✓</span><span>Tüm ses kayıtları ve müşteri verileri kendi kurumunuzda kalır.</span></li>
          <li style="font-size: 8.2pt;"><span class="check" style="width:14px;height:14px;font-size:8pt;">✓</span><span>İsteğe bağlı kurum içi yapay zeka ile sıfır dış veri çıkışı.</span></li>
          <li style="font-size: 8.2pt;"><span class="check" style="width:14px;height:14px;font-size:8pt;">✓</span><span>Mevcut IP telefonlar ve CRM sistemleriyle tam entegrasyon.</span></li>
        </ul>
      </div>

      <div class="card indigo" style="padding: 13px; border: 2px solid #4f46e5;">
        <div class="pill-tag" style="background: #1e1b4b; color: #ffffff; margin-bottom: 7px;">En Çok Tercih Edilen</div>
        <div class="card-title">Nornia Bulut (Yönetilen)</div>
        <ul class="feat-list" style="margin-top: 8px; gap: 6px;">
          <li style="font-size: 8.2pt;"><span class="check" style="width:14px;height:14px;font-size:8pt;">✓</span><span>Sunucu yatırımı ve bakım zahmeti olmadan aynı gün başlangıç.</span></li>
          <li style="font-size: 8.2pt;"><span class="check" style="width:14px;height:14px;font-size:8pt;">✓</span><span>Size özel kurumsal erişim adresi (sirketiniz.nornia.com.tr).</span></li>
          <li style="font-size: 8.2pt;"><span class="check" style="width:14px;height:14px;font-size:8pt;">✓</span><span>7/24 izleme, otomatik günlük yedekleme ve anında ölçekleme.</span></li>
        </ul>
      </div>

      <div class="card" style="padding: 13px;">
        <div class="pill-tag green" style="margin-bottom: 7px;">Büyük Ölçek</div>
        <div class="card-title">Çok Şubeli &amp; Enterprise</div>
        <ul class="feat-list" style="margin-top: 8px; gap: 6px;">
          <li style="font-size: 8.2pt;"><span class="check" style="width:14px;height:14px;font-size:8pt;">✓</span><span>Sınırsız şube birleştirme ve birbirinden izole şirket yönetimi.</span></li>
          <li style="font-size: 8.2pt;"><span class="check" style="width:14px;height:14px;font-size:8pt;">✓</span><span>Yüksek erişilebilirlik, özel ERP/CRM entegrasyonu ve SLA.</span></li>
          <li style="font-size: 8.2pt;"><span class="check" style="width:14px;height:14px;font-size:8pt;">✓</span><span>Kurumunuza özel markalama ve adanmış mühendislik desteği.</span></li>
        </ul>
      </div>
    </div>

    <!-- Trust & Zero-Friction Security Bar -->
    <div class="card" style="margin-top: 13px; background: #ecfdf5; border-color: #a7f3d0; padding: 12px 15px;">
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9.6pt; font-weight: 800; color: #065f46;">
        Güvenli Uzaktan Erişim &amp; KVKK Güvencesi Bir Arada
      </div>
      <div style="font-size: 8.4pt; color: #065f46; margin-top: 3px; line-height: 1.48;">
        Nornia Connect güvenli bağlantı teknolojisi sayesinde ofis internetinizde karmaşık güvenlik duvarı
        ayarları yapmadan evden, şubeden ve mobilden güvenle bağlanırsınız. Çift aşamalı doğrulama,
        detaylı rol yetkileri ve otomatik ses kaydı saklama kurallarıyla kurum verileriniz her an koruma altındadır.
      </div>
    </div>
  </div>
  {footer(9)}
</section>

<!-- ======================================================================
     SAYFA 10 — YÜKSEK ERİŞİLEBİLİRLİK & COĞRAFİ YEDEKLİLİK (SPARK • MIDGARD • ODIN)
     ====================================================================== -->
<section class="page">
  <div class="prism-bar"></div>
  <div class="content">
    <span class="eyebrow">İş Sürekliliği • Yüksek Erişilebilirlik &amp; Coğrafi Yedeklilik</span>
    <h2 class="sec-title">Her Ölçekte Sıfır Kesinti: Nornia Spark, Midgard ve Odin</h2>
    <p class="sec-sub">
      Santraliniz bir işletmenin can damarıdır. Nornia; tek sunucuda sıfır kesintili güncelleme sunan
      konteyner mimarisinden, tüm bir veri merkezinin devre dışı kalmasına karşı koruma sağlayan
      coğrafi yedekli bulut kümesine kadar üç hazır kurumsal mimari sunar.
    </p>

    <!-- 3 Named HA Edition Cards -->
    <div class="grid-3" style="margin-top: 13px; gap: 10px;">
      <!-- SPARK -->
      <div class="card" style="padding: 13px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div class="pill-tag" style="margin-bottom: 6px;">Seçenek 1 • Tek Sunucu HA</div>
          <div class="card-title" style="font-size: 11.4pt; color: #0f172a;">Nornia Spark</div>
          <div style="font-size: 7.8pt; color: #475569; margin-top: 2px; font-weight: 600;">
            Always-Up Docker Yüksek Erişilebilirlik
          </div>
          <ul class="feat-list" style="margin-top: 9px; gap: 5.5px;">
            <li style="font-size: 8pt;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;">✓</span><span><strong>2× Backend + 2× Frontend</strong> Aktif-Aktif HAProxy arkasında.</span></li>
            <li style="font-size: 8pt;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;">✓</span><span><strong>Sıfır Kesintili Güncelleme:</strong> Canlı oturumlar kopmadan yeni sürüm geçişi.</span></li>
            <li style="font-size: 8pt;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;">✓</span><span>Redis 7 küme senkronu, PostgreSQL 16 ve MinIO S3 ses kayıt kasası.</span></li>
            <li style="font-size: 8pt;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;">✓</span><span><strong>Air-Gapped ISO:</strong> İnternetsiz sahada tek medyadan otomatik kurulum.</span></li>
          </ul>
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 7.6pt; color: #334155;">
          <strong>Min:</strong> 4 vCPU / 8 GB RAM • <strong>Önerilen:</strong> 8 vCPU / 16 GB
        </div>
      </div>

      <!-- MIDGARD -->
      <div class="card indigo" style="padding: 13px; border: 2px solid #4f46e5; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div class="pill-tag" style="background: #1e1b4b; color: #ffffff; margin-bottom: 6px;">Seçenek 2 • Tam SIP-HA</div>
          <div class="card-title" style="font-size: 11.4pt; color: #1e1b4b;">Nornia Midgard</div>
          <div style="font-size: 7.8pt; color: #4338ca; margin-top: 2px; font-weight: 600;">
            Kamailio + RTPEngine + 2× Asterisk
          </div>
          <ul class="feat-list" style="margin-top: 9px; gap: 5.5px;">
            <li style="font-size: 8pt;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;">✓</span><span>Nornia Spark&apos;ın tüm uygulama ve arayüz yedekliliği dahildir.</span></li>
            <li style="font-size: 8pt;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;">✓</span><span><strong>Kamailio SIP/WSS Edge:</strong> 5 saniyede otomatik Asterisk failover.</span></li>
            <li style="font-size: 8pt;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;">✓</span><span><strong>RTPEngine Medya Proxy:</strong> WebRTC DTLS-SRTP yükünü hafifletir, NAT sorunlarını çözer.</span></li>
            <li style="font-size: 8pt;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;">✓</span><span><strong>2× Aktif-Aktif Asterisk</strong> + otomatik AMI failover &amp; Air-Gapped ISO.</span></li>
          </ul>
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #c7d2fe; font-size: 7.6pt; color: #1e1b4b;">
          <strong>Min:</strong> 6 vCPU / 12 GB RAM • <strong>Önerilen:</strong> 8–12 vCPU / 16–24 GB
        </div>
      </div>

      <!-- ODIN -->
      <div class="card dark" style="padding: 13px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div class="pill-tag" style="background: rgba(56,189,248,0.18); color: #7dd3fc; border: 1px solid rgba(56,189,248,0.35); margin-bottom: 6px;">Seçenek 3 • Enterprise Geo-DR</div>
          <div class="card-title" style="font-size: 11.4pt; color: #ffffff;">Nornia Odin</div>
          <div style="font-size: 7.8pt; color: #94a3b8; margin-top: 2px; font-weight: 600;">
            Çoklu Sunucu &amp; Coğrafi Yedeklilik (%99.99)
          </div>
          <ul class="feat-list" style="margin-top: 9px; gap: 5.5px;">
            <li style="font-size: 8pt; color: #e2e8f0;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;background:#0ea5e9;">✓</span><span><strong>2 Veri Merkezi + Witness Quorum:</strong> Split-Brain sıfır, tam DC koruması.</span></li>
            <li style="font-size: 8pt; color: #e2e8f0;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;background:#0ea5e9;">✓</span><span><strong>Çift İçi-DC PostgreSQL Patroni (RPO=0)</strong> + coğrafi replika.</span></li>
            <li style="font-size: 8pt; color: #e2e8f0;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;background:#0ea5e9;">✓</span><span><strong>Ayrıştırılmış Harici Asterisk Havuzu</strong> &amp; Keepalived Floating VIP.</span></li>
            <li style="font-size: 8pt; color: #e2e8f0;"><span class="check" style="width:13px;height:13px;font-size:7.5pt;background:#0ea5e9;">✓</span><span><strong>MinIO Geo-S3 File Server</strong> &amp; Multi-HQ taşra şube failover.</span></li>
          </ul>
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.15); font-size: 7.6pt; color: #cbd5e1;">
          <strong>Ölçek:</strong> 7–13 Sunucu • 1.000–5.000+ Eşzamanlı Çağrı
        </div>
      </div>
    </div>

    <!-- Compact Comparison Table -->
    <div style="margin-top: 13px; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse; font-size: 7.9pt;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; text-align: left;">
            <th style="padding: 7px 10px; font-weight: 800;">Karşılaştırma Kriteri</th>
            <th style="padding: 7px 10px; font-weight: 800;">Nornia Spark</th>
            <th style="padding: 7px 10px; font-weight: 800; color: #a5b4fc;">Nornia Midgard</th>
            <th style="padding: 7px 10px; font-weight: 800; color: #7dd3fc;">Nornia Odin</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6.5px 10px; font-weight: 700; color: #0f172a;">Mimari Topoloji</td>
            <td style="padding: 6.5px 10px; color: #334155;">Tek Sunucu (8 Konteyner)</td>
            <td style="padding: 6.5px 10px; color: #334155;">Tek Sunucu (11 Konteyner)</td>
            <td style="padding: 6.5px 10px; color: #334155;">Çoklu Sunucu • 2+1 Veri Merkezi</td>
          </tr>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6.5px 10px; font-weight: 700; color: #0f172a;">SIP / WebRTC Yedekliliği</td>
            <td style="padding: 6.5px 10px; color: #334155;">HAProxy WSS + 1× Asterisk</td>
            <td style="padding: 6.5px 10px; color: #334155;">Kamailio + RTPEngine + 2× Asterisk</td>
            <td style="padding: 6.5px 10px; color: #334155;">VIP Edge + Harici Asterisk Havuzu</td>
          </tr>
          <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6.5px 10px; font-weight: 700; color: #0f172a;">Veritabanı &amp; Ses Kaydı</td>
            <td style="padding: 6.5px 10px; color: #334155;">PG 16 + Yerel MinIO S3</td>
            <td style="padding: 6.5px 10px; color: #334155;">PG 16 + Yerel MinIO S3</td>
            <td style="padding: 6.5px 10px; color: #334155;">Patroni RPO=0 + Geo-S3 File Server</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 6.5px 10px; font-weight: 700; color: #0f172a;">Kesinti Koruması &amp; ISO</td>
            <td style="padding: 6.5px 10px; color: #047857; font-weight: 700;">Uygulama &amp; Güncelleme • ISO Hazır</td>
            <td style="padding: 6.5px 10px; color: #4338ca; font-weight: 700;">Uygulama + SIP/Ses • ISO Hazır</td>
            <td style="padding: 6.5px 10px; color: #0369a1; font-weight: 700;">Tam Veri Merkezi &amp; Coğrafi DR • ISO</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Bottom Highlight -->
    <div class="card" style="margin-top: 12px; background: #eff6ff; border-color: #bfdbfe; padding: 11px 14px;">
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9.4pt; font-weight: 800; color: #1e3a8a;">
        Taşra Şube Hayatta Kalma (Multi-HQ) &amp; Derin Sağlık Kontrolü Güvencesi
      </div>
      <div style="font-size: 8.2pt; color: #1e40af; margin-top: 3px; line-height: 1.46;">
        Nornia Odin ile entegre çalışan <strong>Çok-Şubeli Dağıtık Santral</strong> mimarisi sayesinde taşra şubeleriniz,
        birincil merkez veri merkezi devre dışı kaldığında saniyeler içinde coğrafi yedek merkeze bağlanır; iki merkezle de
        internet kesilse dahi şube içi ve dış hat çağrılarını yerel olarak kesintisiz sürdürür.
      </div>
    </div>
  </div>
  {footer(10)}
</section>

<!-- ======================================================================
     SAYFA 11 — HEMEN BAŞLAYIN & İLETİŞİM (KAPANIŞ)
     ====================================================================== -->
<section class="page cover-bg">
  <div class="prism-bar"></div>
  <div class="content" style="justify-content: space-between; padding-bottom: 15mm;">
    <div>
      <span class="eyebrow">Hemen Başlayın • Canlı Demo</span>
      <h2 class="sec-title" style="font-size: 25pt; margin-top: 12px;">
        Nornia&apos;yı Kendi Senaryonuzla<br/>15 Dakikada Canlı Deneyimleyin
      </h2>
      <p class="sec-sub" style="font-size: 10.5pt; margin-top: 10px;">
        Mevcut telefon numaralarınızı değiştirmeden, iş akışınızı kesintiye uğratmadan
        yapay zeka destekli yeni nesil kurumsal iletişime geçiş yapın.
      </p>

      <!-- 3 Easy Onboarding Steps -->
      <div class="grid-3" style="margin-top: 22px; gap: 14px;">
        <div class="card" style="padding: 18px 16px;">
          <div style="width: 34px; height: 34px; border-radius: 10px; background: #1e1b4b; color: #ffffff; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 11pt; display: flex; align-items: center; justify-content: center;">
            01
          </div>
          <div class="card-title" style="margin-top: 12px; font-size: 10.8pt;">15 Dakika Canlı Demo</div>
          <div class="card-desc" style="margin-top: 5px;">
            AI Sesli Asistanı, 6 dilde canlı çeviriyi, WhatsApp panelini ve raporları gerçek bir çağrı
            üzerinde canlı olarak deneyimleyin.
          </div>
        </div>

        <div class="card" style="padding: 18px 16px;">
          <div style="width: 34px; height: 34px; border-radius: 10px; background: #4f46e5; color: #ffffff; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 11pt; display: flex; align-items: center; justify-content: center;">
            02
          </div>
          <div class="card-title" style="margin-top: 12px; font-size: 10.8pt;">Size Özel Planlama</div>
          <div class="card-desc" style="margin-top: 5px;">
            Ekip büyüklüğünüz, mevcut telefonlarınız ve hedeflerinize göre en ekonomik On-Premise veya
            Bulut teklifinizi aynı gün hazırlayalım.
          </div>
        </div>

        <div class="card" style="padding: 18px 16px;">
          <div style="width: 34px; height: 34px; border-radius: 10px; background: #059669; color: #ffffff; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 11pt; display: flex; align-items: center; justify-content: center;">
            03
          </div>
          <div class="card-title" style="margin-top: 12px; font-size: 10.8pt;">Aynı Gün Canlıya Geçiş</div>
          <div class="card-desc" style="margin-top: 5px;">
            Karşılama senaryonuz, kurumsal bilgi bankanız ve kullanıcılarınız uzman ekibimizle birlikte
            hızla devreye alınır.
          </div>
        </div>
      </div>

      <!-- Summary Highlights Checklist -->
      <div class="card" style="margin-top: 20px; padding: 18px 20px;">
        <div class="card-title" style="font-size: 11pt; margin-bottom: 10px;">
          Nornia İle Tek Pakette Sahip Olacağınız Her Şey
        </div>
        <div class="grid-2" style="gap: 8px 18px;">
          <ul class="feat-list">
            <li><span class="check">✓</span><span>7/24 Doğal Konuşan AI Sesli Asistan &amp; Bilgi Bankası</span></li>
            <li><span class="check">✓</span><span>6 Dilde Çift Yönlü Canlı Çağrı Çevirisi (Simultane)</span></li>
            <li><span class="check">✓</span><span>Tarayıcı Web Telefonu &amp; Temsilci Çağrı Paneli</span></li>
            <li><span class="check">✓</span><span>Runa Mobil (iOS/Android) &amp; Runa Masaüstü</span></li>
          </ul>
          <ul class="feat-list">
            <li><span class="check">✓</span><span>WhatsApp 0850, Instagram, Telegram &amp; E-Posta</span></li>
            <li><span class="check">✓</span><span>44+ Yönetici Raporu, Duygu Analizi &amp; Otomatik QA</span></li>
            <li><span class="check">✓</span><span>Yealink, Cisco, Fanvil, Grandstream Tam Uyum</span></li>
            <li><span class="check">✓</span><span>KVKK Uyumlu On-Premise veya Yönetilen Bulut</span></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Executive Dark Contact Card -->
    <div class="card dark" style="padding: 22px 24px; border-radius: 18px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="{logo_svg}" style="width: 46px; height: 46px; border-radius: 12px; background: #fff; padding: 3px;" alt="Nornia" />
          <div>
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16pt; font-weight: 800; color: #ffffff;">
              Nornia
            </div>
            <div style="font-size: 8.6pt; color: #cbd5e1;">
              Kurumsal Yapay Zeka Santral ve İletişim Platformu
            </div>
          </div>
        </div>
        <div style="background: rgba(56,189,248,0.16); border: 1px solid rgba(56,189,248,0.35); color: #7dd3fc; padding: 6px 14px; border-radius: 999px; font-size: 8.2pt; font-weight: 700;">
          Ücretsiz Canlı Demo İçin Bize Ulaşın
        </div>
      </div>

      <div class="grid-3" style="margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.14); gap: 14px;">
        <div>
          <div style="font-size: 7.4pt; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 700;">Telefon &amp; WhatsApp</div>
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12pt; font-weight: 800; color: #ffffff; margin-top: 3px;">0850 360 73 90</div>
        </div>
        <div>
          <div style="font-size: 7.4pt; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 700;">Kurumsal E-Posta</div>
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11.5pt; font-weight: 800; color: #ffffff; margin-top: 3px;">info@nornia.com.tr</div>
        </div>
        <div>
          <div style="font-size: 7.4pt; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 700;">Web &amp; Kaynaklar</div>
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11pt; font-weight: 800; color: #38bdf8; margin-top: 3px;">www.nornia.com.tr</div>
          <div style="font-size: 7.8pt; color: #cbd5e1; margin-top: 2px;">dokuman.nornia.com.tr • api.nornia.com.tr</div>
        </div>
      </div>
    </div>
  </div>
</section>

</body>
</html>
"""


def find_chrome() -> str:
    for c in CHROME_CANDIDATES:
        if c and os.path.exists(c):
            return c
    raise FileNotFoundError("Google Chrome / Chromium bulunamadı.")


def main():
    html = build_html()
    HTML_TMP.write_text(html, encoding="utf-8")
    chrome = find_chrome()
    OUT_PDF_WEB.parent.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--no-pdf-header-footer",
            "--print-to-pdf-no-header",
            "--virtual-time-budget=4000",
            f"--print-to-pdf={OUT_PDF_WEB}",
            f"file://{HTML_TMP}",
        ],
        check=True,
    )

    if OUT_PDF_PREBUILT.parent.exists():
        OUT_PDF_PREBUILT.write_bytes(OUT_PDF_WEB.read_bytes())

    size_kb = OUT_PDF_WEB.stat().st_size // 1024
    print(f"[OK] Satış kataloğu PDF üretildi: {OUT_PDF_WEB} ({size_kb} KB)")


if __name__ == "__main__":
    main()
