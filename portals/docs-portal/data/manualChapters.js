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

export const MANUAL_META = {
  product: "Nornia Enterprise AI PBX",
  version: "v3.10.11",
  updatedAt: "24 Kasım 2026",
  totalPages: 88,
  fullPdfPath: "/pdfs/nornia-kullanim-kilavuzu-tam.pdf"
};

export const MANUAL_GROUPS = [
  {
    id: "baslangic",
    title: "Başlangıç & Kurulum",
    subtitle: "İlk kurulum sihirbazı, WebPhone/cihaz bağlantıları ve 11 sekmeli Kişisel Profil / Avatar Ayarları",
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
    title: "Çağrı Raporları & Analiz (44 Rapor)",
    subtitle: "44 ayrı kurumsal rapor: Özel Rapor Tasarımcısı, CDR, Ses Kayıtları, AI Analitik/QA, Puantaj/WFM, SLA ve VoIP MOS",
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
  return {
    ...ch,
    editFormSections: guide.editFormSections || ch.editFormSections || []
  };
});

export function getChapterById(slug) {
  return MANUAL_CHAPTERS.find((c) => c.id === slug) || null;
}
