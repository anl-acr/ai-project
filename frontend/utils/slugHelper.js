// Map of tab codes to clean Turkish URL slugs
export const TAB_TURKISH_SLUGS = {
  "dashboard": "pano",
  "wallboard": "canli-wallboard",
  "call-center": "cagri-merkezi",
  "omnichannel": "coklu-kanal",
  "ai-agents": "yapay-zeka-temsilcileri",
  "rag-kb": "bilgi-bankasi",
  "rule-editor": "kural-editoru",
  "users": "kullanicilar",
  "announcements": "anonslar",
  "acd-queues": "kuyruklar",
  "auto-provision": "otomatik-kurulum",
  "outbound-rules": "giden-arama-kurallari",
  "inbound-rules": "gelen-arama-kurallari",
  "call-pickup-groups": "cagri-toplama-gruplari",
  "subscriber-groups": "abone-gruplari",
  "contacts": "rehber",
  "trunks": "dis-hatlar-sip-trunk",
  "conferences": "konferans-odalari",
  "speed-dial": "hizli-arama",
  "blacklist": "karaliste",
  "call-flow": "arama-akislari",
  "dialer": "dis-arama-dialer",
  "calendar": "takvim",
  "reports-pano": "raporlar-pano",
  "reports-cdr": "raporlar-detayli-cagri",
  "reports-audio": "raporlar-ses-kayitlari",
  "reports-transcripts": "raporlar-ses-dokumleri",
  "reports-qa": "raporlar-kalite-degerlendirme",
  "settings": "ayarlar",
  "system-status": "sistem-durumu"
};

// Reverse map (Turkish Slug -> Internal Tab Code)
const SLUG_TO_TAB = Object.fromEntries(
  Object.entries(TAB_TURKISH_SLUGS).map(([tab, slug]) => [slug, tab])
);

export function getTurkishSlugForTab(tab) {
  return TAB_TURKISH_SLUGS[tab] || tab;
}

export function getTabFromTurkishSlug(slug) {
  return SLUG_TO_TAB[slug] || slug;
}

// Map of Settings subtab codes to clean Turkish URL slugs
export const SUBTAB_TURKISH_SLUGS = {
  "pbx": "santral-ayarlari",
  "trunks": "dis-hatlar",
  "channels": "kanal-ayarlari",
  "breaks": "mola-tanimlari",
  "users": "kullanici-yonetimi",
  "roles": "rol-ve-yetkiler",
  "tenants": "musteri-lisanslari",
  "ai_providers": "yapay-zeka-saglayicilari",
  "api_budgets": "api-butceleri"
};

const SLUG_TO_SUBTAB = Object.fromEntries(
  Object.entries(SUBTAB_TURKISH_SLUGS).map(([subtab, slug]) => [slug, subtab])
);

export function getTurkishSlugForSubtab(subtab) {
  return SUBTAB_TURKISH_SLUGS[subtab] || subtab;
}

export function getSubtabFromTurkishSlug(slug) {
  return SLUG_TO_SUBTAB[slug] || slug;
}
