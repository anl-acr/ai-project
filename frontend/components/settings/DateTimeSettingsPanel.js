import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Calendar,
  Globe,
  RefreshCw,
  Save,
  CheckCircle,
  AlertTriangle,
  Search,
  Server,
  Languages,
  Check,
  X,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getBackendHost } from "../../utils/apiHost";

function formatClockPreview(epochMs, dateFormat, timeFormat) {
  const d = new Date(epochMs);
  const pad = (n) => String(n).padStart(2, "0");
  const DD = pad(d.getDate());
  const MM = pad(d.getMonth() + 1);
  const YYYY = d.getFullYear();
  let dateStr = `${DD}.${MM}.${YYYY}`;
  if (dateFormat === "DD/MM/YYYY") dateStr = `${DD}/${MM}/${YYYY}`;
  else if (dateFormat === "YYYY-MM-DD") dateStr = `${YYYY}-${MM}-${DD}`;
  else if (dateFormat === "MM/DD/YYYY") dateStr = `${MM}/${DD}/${YYYY}`;

  let h = d.getHours();
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  if (timeFormat === "12") {
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return { dateStr, timeStr: `${pad(h)}:${min}:${sec} ${ampm}` };
  }
  return { dateStr, timeStr: `${pad(h)}:${min}:${sec}` };
}

export default function DateTimeSettingsPanel({ backendHost, canWrite = true }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const resolvedHost = backendHost || getBackendHost();
  const apiBase =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${resolvedHost}`
      : `http://${resolvedHost}`;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState(null);

  const [timezones, setTimezones] = useState([]);
  const [tzSearch, setTzSearch] = useState("");
  const [liveInfo, setLiveInfo] = useState(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Editable config fields
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [ntpEnabled, setNtpEnabled] = useState(true);
  const [ntpPrimary, setNtpPrimary] = useState("pool.ntp.org");
  const [ntpSecondary, setNtpSecondary] = useState("tr.pool.ntp.org");
  const [manualDatetime, setManualDatetime] = useState("");
  const [dateFormat, setDateFormat] = useState("DD.MM.YYYY");
  const [timeFormat, setTimeFormat] = useState("24");
  const [defaultLanguage, setDefaultLanguage] = useState("Turkish");

  const flashBanner = (ok, msg) => {
    setBanner({ ok, text: msg });
    setTimeout(() => setBanner(null), 5500);
  };

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/datetime`);
      if (!res.ok) throw new Error("Tarih ve saat ayarları alınamadı.");
      const data = await res.json();
      const cfg = data.config || {};
      setTimezone(cfg.timezone || "Europe/Istanbul");
      setNtpEnabled(cfg.ntp_enabled !== false);
      setNtpPrimary(cfg.ntp_server_primary || "pool.ntp.org");
      setNtpSecondary(cfg.ntp_server_secondary || "");
      setManualDatetime(cfg.manual_datetime || "");
      setDateFormat(cfg.date_format || "DD.MM.YYYY");
      setTimeFormat(cfg.time_format || "24");
      setDefaultLanguage(cfg.default_language || "Turkish");
      if (Array.isArray(data.timezones)) setTimezones(data.timezones);
      if (data.live) {
        setLiveInfo(data.live);
        if (data.live.server_epoch_ms) {
          setClockOffsetMs(Number(data.live.server_epoch_ms) - Date.now());
        }
      }
    } catch (err) {
      flashBanner(false, err.message || "Sunucu zaman bilgisi okunamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredTimezones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return timezones;
    return timezones.filter(
      (z) =>
        z.id.toLowerCase().includes(q) ||
        z.label.toLowerCase().includes(q) ||
        z.utc_offset.toLowerCase().includes(q)
    );
  }, [timezones, tzSearch]);

  const liveClock = useMemo(
    () => formatClockPreview(nowMs + clockOffsetMs, dateFormat, timeFormat),
    [nowMs, clockOffsetMs, dateFormat, timeFormat]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/datetime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          ntp_enabled: ntpEnabled,
          ntp_server_primary: ntpPrimary.trim() || "pool.ntp.org",
          ntp_server_secondary: ntpSecondary.trim(),
          manual_datetime: ntpEnabled ? "" : manualDatetime,
          date_format: dateFormat,
          time_format: timeFormat,
          default_language: defaultLanguage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Kayıt sırasında hata oluştu.");
      if (data.live) {
        setLiveInfo(data.live);
        if (data.live.server_epoch_ms) {
          setClockOffsetMs(Number(data.live.server_epoch_ms) - Date.now());
        }
      }
      flashBanner(
        true,
        data.notes?.length
          ? `${data.message} (${data.notes[0]})`
          : data.message || "Tarih, saat ve bölge ayarları kaydedildi."
      );
    } catch (err) {
      flashBanner(false, err.message || "Ayarlar kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNtp = async () => {
    if (!canWrite) return;
    setSyncing(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/datetime/sync-ntp`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "NTP eşitleme başarısız.");
      if (data.live) {
        setLiveInfo(data.live);
        if (data.live.server_epoch_ms) {
          setClockOffsetMs(Number(data.live.server_epoch_ms) - Date.now());
        }
      }
      flashBanner(true, data.message || "NTP eşitlemesi tamamlandı.");
    } catch (err) {
      flashBanner(false, err.message || "NTP eşitlemesi sırasında hata oluştu.");
    } finally {
      setSyncing(false);
    }
  };

  const selectedTzObj = timezones.find((z) => z.id === timezone);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/85 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
            <Clock size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Tarih, Saat Dilimi &amp; Bölge Ayarları
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Santral sunucu saati, NTP zaman eşitlemesi, tarih formatı ve IP telefon varsayılan dil/saat ayarları.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canWrite && (
            <button
              type="button"
              onClick={handleSyncNtp}
              disabled={syncing || !ntpEnabled}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-45"
              title="NTP sunucusu ile saati şimdi eşitle"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              <span>{syncing ? "Eşitleniyor..." : "NTP ile Şimdi Eşitle"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
            banner.ok
              ? "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Live Server Clock Hero Card */}
      <div className={`p-6 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5`}>
        <div className="space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Canlı Santral Saati
          </span>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {liveClock.timeStr}
            </span>
            <span className={`text-sm font-extrabold font-mono ${text}`}>
              {liveClock.dateStr}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saat Dilimi: <strong className="text-slate-700 dark:text-slate-200">{selectedTzObj?.label || timezone}</strong>
            {liveInfo?.os_timezone ? ` • OS: ${liveInfo.os_timezone}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
              liveInfo?.ntp_synchronized
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                : ntpEnabled
                ? `${lightBg} ${borderLight} ${text}`
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <Server size={13} />
            {liveInfo?.ntp_synchronized
              ? "NTP Senkronize"
              : ntpEnabled
              ? `NTP Aktif (${ntpPrimary})`
              : "Manuel Saat Modu"}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            <Languages size={13} />
            {defaultLanguage === "English" ? "English" : "Türkçe"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <RefreshCw size={24} className={`animate-spin ${text}`} />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Card: Timezone & NTP / Manual Sync */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Globe size={15} className={text} />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Saat Dilimi &amp; Zaman Sunucusu (NTP)
                </h3>
              </div>

              {/* Searchable Timezone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Sistem Saat Dilimi
                </label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tzSearch}
                    onChange={(e) => setTzSearch(e.target.value)}
                    placeholder="Saat dilimi ara (örn: Istanbul, Berlin, UTC+3)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none"
                  />
                </div>
                <select
                  disabled={!canWrite}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                >
                  {filteredTimezones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* NTP vs Manual Toggle */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Saat Senkronizasyon Yöntemi
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => setNtpEnabled(true)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      ntpEnabled
                        ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                        : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <div className="text-xs font-extrabold">Otomatik (NTP)</div>
                    <div className="text-[10px] opacity-75 mt-0.5">İnternet / yerel NTP sunucusu</div>
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => setNtpEnabled(false)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      !ntpEnabled
                        ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                        : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <div className="text-xs font-extrabold">Manuel Tarih / Saat</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Kapalı ağlar için elle ayar</div>
                  </button>
                </div>
              </div>

              {ntpEnabled ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Birincil NTP Sunucusu
                    </label>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={ntpPrimary}
                      onChange={(e) => setNtpPrimary(e.target.value)}
                      placeholder="pool.ntp.org"
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {["pool.ntp.org", "tr.pool.ntp.org", "time.google.com", "time.cloudflare.com"].map((srv) => (
                        <button
                          key={srv}
                          type="button"
                          disabled={!canWrite}
                          onClick={() => setNtpPrimary(srv)}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          {srv}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Yedek (İkincil) NTP Sunucusu <span className="font-normal text-slate-400">(Opsiyonel)</span>
                    </label>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={ntpSecondary}
                      onChange={(e) => setNtpSecondary(e.target.value)}
                      placeholder="tr.pool.ntp.org"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="pt-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Manuel Sunucu Tarih ve Saati
                  </label>
                  <input
                    type="datetime-local"
                    disabled={!canWrite}
                    value={manualDatetime}
                    onChange={(e) => setManualDatetime(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Kaydedildiğinde Linux sunucuda <code>timedatectl set-time</code> ile anında uygulanır.
                  </p>
                </div>
              )}
            </div>

            {/* Right Card: Date/Time Format & Default System Language */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Calendar size={15} className={text} />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Tarih / Saat Formatı &amp; Sistem Varsayılan Dili
                </h3>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Tarih Gösterim Formatı
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "DD.MM.YYYY", ex: "22.11.2026 (TR)" },
                    { id: "DD/MM/YYYY", ex: "22/11/2026 (EU)" },
                    { id: "YYYY-MM-DD", ex: "2026-11-22 (ISO)" },
                    { id: "MM/DD/YYYY", ex: "11/22/2026 (US)" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => setDateFormat(f.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        dateFormat === f.id
                          ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                          : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="text-xs font-extrabold font-mono">{f.id}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{f.ex}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Saat Formatı
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "24", title: "24 Saat", desc: "Örn: 14:30 (Önerilen)" },
                    { id: "12", title: "12 Saat (AM/PM)", desc: "Örn: 02:30 PM" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => setTimeFormat(t.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        timeFormat === t.id
                          ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                          : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="text-xs font-extrabold">{t.title}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Sistem Varsayılan Dili
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "Turkish", title: "Türkçe", desc: "Web + IP Telefon Menüsü" },
                    { id: "English", title: "English", desc: "Web + IP Phone GUI" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => setDefaultLanguage(l.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                        defaultLanguage === l.id
                          ? `${lightBg} ${border} ${text} ring-1 ${ring}`
                          : "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-extrabold">{l.title}</div>
                        <div className="text-[10px] opacity-75 mt-0.5">{l.desc}</div>
                      </div>
                      {defaultLanguage === l.id && <Check size={15} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`p-3 rounded-xl ${lightBg} border ${borderLight} text-[11px] text-slate-700 dark:text-slate-300`}>
                Bu ekranda kaydedilen <strong>Saat Dilimi, NTP Sunucusu, Tarih/Saat Formatı ve Dil</strong> ayarları, oto-provizyon ile bağlanan tüm masa telefonlarına (Yealink, Grandstream, Fanvil, Cisco) otomatik varsayılan olarak aktarılır.
              </div>
            </div>
          </div>

          {canWrite && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm transition cursor-pointer disabled:opacity-50`}
              >
                <Save size={15} />
                <span>{saving ? "Kaydediliyor..." : "Tarih, Saat ve Bölge Ayarlarını Kaydet"}</span>
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
