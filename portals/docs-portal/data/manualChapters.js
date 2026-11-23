import { CHAPTERS_BASLANGIC } from "./chapters/01_baslangic";
import { CHAPTERS_OPERASYON } from "./chapters/02_operasyon";
import { CHAPTERS_YAPAY_ZEKA } from "./chapters/03_yapay_zeka";
import { CHAPTERS_SANTRAL_A } from "./chapters/04a_santral";
import { CHAPTERS_SANTRAL_B } from "./chapters/04b_santral";
import { CHAPTERS_CAGRI_YONLENDIRME } from "./chapters/05_cagri_yonlendirme";
import { CHAPTERS_RAPORLAR } from "./chapters/06_raporlar";
import { CHAPTERS_YONETIM_A } from "./chapters/07a_ayarlar";
import { CHAPTERS_YONETIM_B } from "./chapters/07b_sistem";

import { EDIT_GUIDES_PART1 } from "./editGuides/part1_baslangic_operasyon_ai";
import { EDIT_GUIDES_PART2 } from "./editGuides/part2_santral_core";
import { EDIT_GUIDES_PART3 } from "./editGuides/part3_santral_rest_callflow";
import { EDIT_GUIDES_PART4 } from "./editGuides/part4_raporlar";
import { EDIT_GUIDES_PART5 } from "./editGuides/part5_yonetim_ayarlar";

const ALL_EDIT_GUIDES = {
  ...EDIT_GUIDES_PART1,
  ...EDIT_GUIDES_PART2,
  ...EDIT_GUIDES_PART3,
  ...EDIT_GUIDES_PART4,
  ...EDIT_GUIDES_PART5
};

const EXTRA_SCREENSHOTS = {
  "kullanicilar": [
    {
      src: "/screenshots/61-user-edit-modal.jpg",
      caption: "Kullanıcı Düzenle Penceresi — Genel Bilgiler, SIP/Cihaz, Profiller & Yönlendirme, BLF, CRM ve 2FA Sekmeleri",
      routeHint: "Santral → Kullanıcılar → Düzenle"
    }
  ],
  "acd-kuyruk": [
    {
      src: "/screenshots/62-queue-edit-modal.jpg",
      caption: "ACD Kuyruk Düzenle Penceresi — Dağıtım Stratejisi, RONA, Auto-Logout, Smart Callback ve CSAT Anketi",
      routeHint: "Santral → ACD Kuyruk → Düzenle"
    }
  ],
  "dis-hat-tanimi": [
    {
      src: "/screenshots/63-trunk-edit-modal.jpg",
      caption: "Dış Hat (SIP Trunk) Düzenle Penceresi — Genel, Dakika Paketi, Gelişmiş Kodekler ve SIP Başlıkları / VLAN",
      routeHint: "Santral → Dış Hat Tanımı → Düzenle"
    }
  ],
  "ai-temsilcileri": [
    {
      src: "/screenshots/64-ai-agent-edit-modal.jpg",
      caption: "Yapay Zeka Temsilcisi Düzenle Penceresi — 7 Sekmeli Ses, VAD, LLM/RAG, Ambiyans ve CRM Yapılandırması",
      routeHint: "Yapay Zeka & Bilgi → AI Temsilcileri → Düzenle"
    }
  ],
  "santral-entegrasyonu-ve-nat": [
    {
      src: "/screenshots/52-settings-numbering.jpg",
      caption: "Sistem Ayarları → Numara Planı — Acil Durumlar, 5 Numara Aralığı ve *XX Santral Özellik Kodları",
      routeHint: "Sistem Ayarları → Numara Planı"
    }
  ],
  "sunucu-ag-ve-nornia-connect": [
    {
      src: "/screenshots/51-settings-network.jpg",
      caption: "Sistem Ayarları → Sunucu Ağ (Network) Yönetimi — NIC, Statik Rotalar, DNS/Hosts ve 60 sn Güvenli Rollback",
      routeHint: "Sistem Ayarları → Sunucu Ağ Yönetimi"
    }
  ],
  "roller-kvkk-ve-ldap": [
    {
      src: "/screenshots/53-settings-kvkk.jpg",
      caption: "Sistem Ayarları → KVKK & Gizlilik Politikası Onay Yönetimi ve Hukuki Denetim Tablosu",
      routeHint: "Sistem Ayarları → KVKK & Gizlilik Politikası"
    },
    {
      src: "/screenshots/54-settings-ad-ldap.jpg",
      caption: "Sistem Ayarları → Active Directory (LDAP & Azure Entra ID) Kullanıcı Senkronizasyonu",
      routeHint: "Sistem Ayarları → Active Directory (LDAP & SSO)"
    }
  ],
  "yapay-zeka-ayar-ve-yonlendirme": [
    {
      src: "/screenshots/55-settings-ai-routing.jpg",
      caption: "Sistem Ayarları → AI Görev & Model Yönlendirme — 12 Görev Matrisi, Yerel Ollama ve Token Tasarrufu",
      routeHint: "Sistem Ayarları → AI Görev & Model Yönlendirme"
    }
  ],
  "kanallar-crm-ve-dis-api": [
    {
      src: "/screenshots/56-settings-channels.jpg",
      caption: "Sistem Ayarları → Kanal Entegrasyonları — Çoklu WhatsApp Hatları, Telegram, Meta ve SMTP/IMAP",
      routeHint: "Sistem Ayarları → Kanal Entegrasyonları"
    },
    {
      src: "/screenshots/57-settings-crm.jpg",
      caption: "Sistem Ayarları → Hazır CRM Entegrasyon Marketi (Zoho, HubSpot, Salesforce, Bitrix24)",
      routeHint: "Sistem Ayarları → Hazır CRM Entegrasyonları"
    },
    {
      src: "/screenshots/58-settings-email.jpg",
      caption: "Sistem Ayarları → E-Mail & WhatsApp Sistem Bildirimleri ve 10+ Olay Tetikleyicisi",
      routeHint: "Sistem Ayarları → E-Mail Bildirimleri"
    }
  ],
  "bakim-yedekleme-ve-kayit-saklama": [
    {
      src: "/screenshots/59-settings-restore.jpg",
      caption: "Sistem Ayarları → Geri Yükleme Noktaları (Anlık Snapshot Yönetimi)",
      routeHint: "Sistem Ayarları → Geri Yükleme Noktası"
    },
    {
      src: "/screenshots/60-settings-datetime.jpg",
      caption: "Sistem Ayarları → Tarih, Saat Dilimi, NTP ve Varsayılan Dil Ayarları",
      routeHint: "Sistem Ayarları → Tarih, Saat & Bölge Ayarları"
    }
  ]
};

export const MANUAL_META = {
  product: "Nornia Enterprise AI PBX",
  version: "v3.10.11",
  updatedAt: "23 Kasım 2026",
  totalPages: 50,
  fullPdfPath: "/pdfs/nornia-kullanim-kilavuzu-tam.pdf"
};

export const MANUAL_GROUPS = [
  {
    id: "baslangic",
    title: "Başlangıç & Kurulum",
    subtitle: "İlk kurulum sihirbazı, mimari ve WebPhone/cihaz bağlantıları",
    color: "indigo"
  },
  {
    id: "operasyon",
    title: "Operasyon & İzleme",
    subtitle: "AI Pano, Wallboard, Canlı Çağrı, Temsilci Paneli, Omnichannel ve API Bütçe",
    color: "emerald"
  },
  {
    id: "yapay-zeka",
    title: "Yapay Zeka & Bilgi",
    subtitle: "AI Konfigürasyon Asistanı, Sesli AI Temsilciler, RAG Bilgi Bankası ve Kurallar",
    color: "purple"
  },
  {
    id: "santral",
    title: "Santral",
    subtitle: "Kullanıcılar, Anonslar, ACD Kuyruk, Oto Provizyon, Kurallar, Trunk, Konferans ve tüm PBX modülleri",
    color: "sky"
  },
  {
    id: "cagri-yonlendirme",
    title: "Çağrı & Yönlendirme",
    subtitle: "Görsel Arama Akışları (CallFlow), Mesai/Tatiller, Dış Arama (Dialer) ve Randevu Takvimi",
    color: "amber"
  },
  {
    id: "raporlar",
    title: "Çağrı Raporları & Analiz",
    subtitle: "Özel Rapor Tasarımcısı, CDR, Ses Kayıtları, AI Analitik/QA, Puantaj/WFM, SLA ve VoIP MOS",
    color: "rose"
  },
  {
    id: "yonetim",
    title: "Yönetim & Sistem Ayarları",
    subtitle: "Santral/NAT, Ağ/Nornia Connect, Multi-Site, Roller/KVKK/LDAP, Lisans, AI/Kanal Ayarları, sngrep ve Güvenlik",
    color: "slate"
  }
];

const RAW_CHAPTERS = [
  ...CHAPTERS_BASLANGIC,
  ...CHAPTERS_OPERASYON,
  ...CHAPTERS_YAPAY_ZEKA,
  ...CHAPTERS_SANTRAL_A,
  ...CHAPTERS_SANTRAL_B,
  ...CHAPTERS_CAGRI_YONLENDIRME,
  ...CHAPTERS_RAPORLAR,
  ...CHAPTERS_YONETIM_A,
  ...CHAPTERS_YONETIM_B
];

export const MANUAL_CHAPTERS = RAW_CHAPTERS.map((ch) => {
  const guide = ALL_EDIT_GUIDES[ch.id] || {};
  const extraShots = EXTRA_SCREENSHOTS[ch.id] || [];
  return {
    ...ch,
    screenshots: [...(ch.screenshots || []), ...extraShots],
    editFormSections: guide.editFormSections || ch.editFormSections || []
  };
});

export function getChapterById(slug) {
  return MANUAL_CHAPTERS.find((c) => c.id === slug) || null;
}
