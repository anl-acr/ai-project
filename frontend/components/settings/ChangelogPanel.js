import React, { useState, useEffect } from "react";
import { GitCommit, Sparkles, CheckCircle2, AlertCircle, ArrowLeft, Calendar, ShieldCheck, Copy, Check, RefreshCw, Server, Cpu } from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function ChangelogPanel({ onBack, backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const [versionData, setVersionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const API_BASE = typeof window !== "undefined" ? `${window.location.protocol}//${backendHost}` : "";

  const fetchVersionInfo = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/settings/version`)
      .then((res) => res.json())
      .then((data) => {
        setVersionData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Changelog] Versiyon yüklenemedi:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchVersionInfo();
  }, [API_BASE]);

  const copyVersionInfo = () => {
    if (!versionData) return;
    const strToCopy = `Sistem Versiyonu: ${versionData.version} | Commit: ${versionData.commit_hash} | Çıkış: ${versionData.release_date}`;
    navigator.clipboard.writeText(strToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentVer = versionData?.version || "v2.4.1";
  const commitHash = versionData?.commit_hash || "55906cc";
  const changelogList = versionData?.changelog || [];

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-sm p-6 space-y-6 transition-colors duration-300 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className={"p-3 rounded-2xl border " + lightBg + " " + text + " " + borderLight + " flex items-center justify-center shadow-sm"}>
            <GitCommit size={22} />
          </div>
          <div>
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
              Sistem Versiyonu ve Değişiklik Günlüğü
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30">
                {currentVer}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Sunucu ve local versiyon senkronizasyonunu takip edin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchVersionInfo}
            title="Versiyon Bilgisini Yenile"
            className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft size={13} />
              Geri Dön
            </button>
          )}
        </div>
      </div>

      {/* Hero Version Card */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white rounded-2xl shadow-md border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <Cpu size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Aktif Yayın Sürümü</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {versionData?.status || "Güncel / Canlıda"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black font-mono tracking-tight text-white">{currentVer}</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                Commit: {commitHash}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={copyVersionInfo}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs font-bold text-slate-200 rounded-xl transition cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? "Kopyalandı!" : "Versiyon Kodu Kopyala"}</span>
          </button>
        </div>
      </div>

      {/* Changelog Timeline */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Sürüm Geçmişi ve Değişiklik Listesi
          </h3>
          <span className="text-xs text-slate-400 font-medium">Toplam {changelogList.length} Sürüm Kaydı</span>
        </div>

        <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-8 py-2">
          {changelogList.map((item, idx) => {
            const isCurrent = item.version === currentVer;
            return (
              <div key={idx} className="relative group">
                {/* Timeline Node Dot */}
                <span className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-all duration-300 ${
                  isCurrent 
                    ? "bg-rose-600 ring-4 ring-rose-500/20 scale-110" 
                    : "bg-slate-300 dark:bg-slate-700"
                }`} />

                {/* Content Card */}
                <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 dark:border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 dark:text-white">{item.version}</span>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded">
                        #{item.commit_hash}
                      </span>
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                          isCurrent
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-medium">
                      <Calendar size={13} />
                      {item.release_date}
                    </div>
                  </div>

                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {item.title || item.summary}
                  </h4>

                  {item.summary && item.title && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                      {item.summary}
                    </p>
                  )}

                  {/* Features List */}
                  {item.features && item.features.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Eklenecek / Yenilenen Özellikler</div>
                      <div className="grid grid-cols-1 gap-2">
                        {item.features.map((feat, fIdx) => (
                          <div key={fIdx} className="p-3 bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80 rounded-xl space-y-1">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                              {typeof feat === "string" ? feat : feat.title}
                            </h5>
                            {typeof feat !== "string" && feat.desc && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-5 font-medium">
                                {feat.desc}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fixes List */}
                  {item.fixes && item.fixes.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Düzeltmeler ve İyileştirmeler</div>
                      <ul className="space-y-1 pl-1">
                        {item.fixes.map((fix, fxIdx) => (
                          <li key={fxIdx} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 font-medium">
                            <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                            <span>{fix}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
