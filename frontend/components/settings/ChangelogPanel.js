import React from "react";
import { GitCommit, Sparkles, CheckCircle2, AlertCircle, ArrowLeft, Calendar, ShieldCheck } from "lucide-react";

export default function ChangelogPanel({ onBack }) {
  const currentVersion = "1.1.0";
  
  const changelogData = [
    {
      version: "1.1.0",
      date: "12 Temmuz 2026",
      badge: "Güncel",
      badgeColor: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30",
      type: "major",
      summary: "Görsel Arama Akışı Yönetimi ve Sol Menü Akordiyon Güncellemesi",
      features: [
        {
          title: "Yapay Zeka (AI Agent) Dinamik Çıkış Portları",
          desc: "AI Agent düğümlerine eklenen müşteri niyetleri (intents) artık kanvas üzerinde ayrı birer çıkış portu olarak render edilmektedir. Bu sayede çağrılar anons, menü, senaryo gibi dilediğiniz şema düğümüne sürüklenerek bağlanabilir."
        },
        {
          title: "Akordiyon Sol Menü Sistemi",
          desc: "Sol menüdeki çok sayıda ve karmaşık bağlantı, 4 ana mantıksal grup altında gruplandı. Açılıp kapanabilir akordiyon tasarımıyla menünün dikey karmaşası giderildi."
        },
        {
          title: "Yıldız Geçidi (YG Giriş & Çıkış) Portalları",
          desc: "Akış şemasının sonundan en başına bağlantı yaparken çizgilerin karışmasını engellemek amacıyla YG Giriş ve YG Çıkış düğümleri eklendi. Aynı portal ismine sahip düğümler arka planda otomatik eşleşerek parıldayan (glowing border) görsel bir aura ile indike edilir."
        },
        {
          title: "Çağrı Kapat (Hangup) Düğümü",
          desc: "IVR akışlarının sonlandırılması veya aramaların otomatik kesilmesi gereken durumlar için çıkış portu bulunmayan şık 'Kapat' düğümü akış editörüne eklendi."
        }
      ],
      fixes: [
        "Arama Akış Editörü'ndeki düğüm portlarının hizalama kaymaları giderildi.",
        "Özelleştirilmiş premium silme doğrulama modalı entegre edildi.",
        "Arayüz genelindeki Tailwind renk uyumsuzlukları standart palete çekildi."
      ]
    },
    {
      version: "1.0.1",
      date: "10 Temmuz 2026",
      badge: "Stabil",
      badgeColor: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-900/30",
      type: "minor",
      summary: "Kalite Değerlendirme Modülü ve DID Yönetim Entegrasyonu",
      features: [
        {
          title: "Yapay Zeka QA Kriterleri & Kurallar Sekmesi",
          desc: "Sistem ayarlarına yapay zeka kalite kuralları yönetimi eklendi. QA ses analiz motoru, puan kesintileri ve koçluk raporları devreye alındı."
        },
        {
          title: "Rehber (Contacts) & DID Yönetimi",
          desc: "DID eşleştirme ayarları ve dinamik rehber listeleri akış editörüne eklendi."
        }
      ],
      fixes: [
        "Yapay zeka çağrı analizi sonrasındaki rapor görüntüleme sorunları düzeltildi."
      ]
    },
    {
      version: "1.0.0",
      date: "01 Temmuz 2026",
      badge: "İlk Kurulum",
      badgeColor: "bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400 border-slate-200 dark:border-slate-800",
      type: "release",
      summary: "Çok Kanallı Yapay Zeka Destekli PBX Santral Paneli Yayını",
      features: [
        {
          title: "Çok Kanallı Santral Paneli",
          desc: "Gerçek zamanlı AI pano, canlı izleme ekranı, WebRTC tabanlı temsilci çağrı paneli ve ortak gelen kutusu (Omnichannel) yayına alındı."
        }
      ],
      fixes: []
    }
  ];

  return (
    <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-sm p-6 space-y-6 transition-colors duration-300 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/50 dark:border-indigo-900/30 shadow-sm">
            <GitCommit size={20} />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-800 dark:text-white tracking-wide">Sistem Sürüm Bilgileri</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider mt-0.5">Sürüm Geçmişi ve Değişiklik Günlüğü (Changelog)</p>
          </div>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-350 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft size={13} />
            Geri Dön
          </button>
        )}
      </div>

      {/* Hero Badge */}
      <div className="p-4 bg-gradient-to-r from-indigo-50/50 via-purple-50/20 to-violet-50/30 dark:from-indigo-950/20 dark:via-purple-950/5 dark:to-violet-950/10 border border-indigo-100/40 dark:border-indigo-900/20 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles size={15} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Mevcut Sistem Sürümü</div>
            <div className="text-[10px] text-slate-400 dark:text-slate-550 font-semibold mt-0.5">Son güncelleme: 12 Temmuz 2026</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
            v{currentVersion}
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] rounded-xl">
            <ShieldCheck size={12} />
            Güvenli & Çevrimiçi
          </span>
        </div>
      </div>

      {/* Changelog Timeline */}
      <div className="relative border-l border-slate-150 dark:border-slate-800/80 ml-4 pl-6 space-y-8 py-2">
        {changelogData.map((item, idx) => (
          <div key={idx} className="relative group">
            {/* Timeline Dot */}
            <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-950 shadow-sm transition-all duration-300 ${
              item.version === currentVersion 
                ? "bg-indigo-500 group-hover:scale-125 ring-4 ring-indigo-500/15" 
                : "bg-slate-300 dark:bg-slate-700"
            }`} />

            {/* Content Card */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-xs text-slate-800 dark:text-white">v{item.version}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${item.badgeColor}`}>
                  {item.badge}
                </span>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-550 font-medium">
                  <Calendar size={11} />
                  {item.date}
                </div>
              </div>

              <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                {item.summary}
              </h3>

              {/* Features List */}
              {item.features.length > 0 && (
                <div className="space-y-2 pt-1.5">
                  <div className="text-[9px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Eklenecek Özellikler</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {item.features.map((feat, fIdx) => (
                      <div key={fIdx} className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-xl space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                          {feat.title}
                        </h4>
                        <p className="text-[9px] text-slate-550 dark:text-slate-450 leading-relaxed font-semibold">
                          {feat.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fixes List */}
              {item.fixes.length > 0 && (
                <div className="space-y-1.5 pt-1.5">
                  <div className="text-[9px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">İyileştirmeler & Hata Gidermeleri</div>
                  <ul className="space-y-1">
                    {item.fixes.map((fix, fxIdx) => (
                      <li key={fxIdx} className="text-[10px] text-slate-500 dark:text-slate-450 flex items-start gap-1.5 font-semibold">
                        <AlertCircle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                        <span>{fix}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
