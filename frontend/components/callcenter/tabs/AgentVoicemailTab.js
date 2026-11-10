import React, { useState, useEffect, useCallback } from "react";
import {
  Voicemail,
  PhoneCall,
  Download,
  Trash2,
  CheckCircle2,
  MailOpen,
  Mail,
  RefreshCw,
  Search,
  Clock,
  Calendar,
  AlertTriangle,
  Headphones
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { maskPhoneLast4 } from "../../../utils/contactUtils";
import WaveformAudioPlayer from "../../common/WaveformAudioPlayer";

export default function AgentVoicemailTab({
  backendHost = "localhost:8000",
  currentUser,
  callPanelPerms = {},
  onUnreadCountChange
}) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const myExt = String(currentUser?.extension || "1000").trim();
  const maskPhoneNumbers = Boolean(callPanelPerms?.maskPhoneNumbers);

  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState("all"); // "all" | "unread"
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const getApiBase = () => {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    const host =
      backendHost ||
      (typeof window !== "undefined" ? `${window.location.hostname}:8000` : "localhost:8000");
    return `${protocol}//${host}`;
  };

  const syncUnreadBadge = useCallback(
    (count) => {
      setUnreadCount(count);
      if (typeof onUnreadCountChange === "function") {
        onUnreadCountChange(count);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("VOICEMAIL_UNREAD_UPDATED", { detail: count }));
      }
    },
    [onUnreadCountChange]
  );

  const fetchVoicemails = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetch(
          `${getApiBase()}/api/agent/voicemail?extension=${encodeURIComponent(myExt)}&t=${Date.now()}`
        );
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
          setMessages(list);
          const unread =
            typeof data?.unread_count === "number"
              ? data.unread_count
              : list.filter((m) => !m.is_read).length;
          syncUnreadBadge(unread);
        }
      } catch (err) {
        console.error("Voicemail fetch error:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [backendHost, myExt, syncUnreadBadge]
  );

  useEffect(() => {
    fetchVoicemails(false);
    const interval = setInterval(() => fetchVoicemails(true), 15000);
    return () => clearInterval(interval);
  }, [fetchVoicemails]);

  const handleToggleRead = async (vm, nextRead) => {
    try {
      const res = await fetch(`${getApiBase()}/api/voicemail/${vm.id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: nextRead })
      });
      if (res.ok) {
        setMessages((prev) => {
          const updated = prev.map((item) =>
            String(item.id) === String(vm.id) ? { ...item, is_read: nextRead } : item
          );
          syncUnreadBadge(updated.filter((m) => !m.is_read).length);
          return updated;
        });
      }
    } catch (err) {
      console.error("Voicemail mark read error:", err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`${getApiBase()}/api/voicemail/${deleteTarget.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setMessages((prev) => {
          const updated = prev.filter((item) => String(item.id) !== String(deleteTarget.id));
          syncUnreadBadge(updated.filter((m) => !m.is_read).length);
          return updated;
        });
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error("Voicemail delete error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleCallback = (callerNumber) => {
    if (!callerNumber || callerNumber === "Anonim") return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("TRIGGER_CALL", { detail: callerNumber }));
    }
  };

  const formatDuration = (secs) => {
    const total = Math.max(0, Number(secs) || 0);
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(total % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatTimestamp = (iso) => {
    if (!iso) return "-";
    try {
      const normalized =
        !String(iso).endsWith("Z") && !String(iso).includes("+") ? `${iso}Z` : String(iso);
      const dt = new Date(normalized);
      if (isNaN(dt.getTime())) return String(iso);
      return dt.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return String(iso);
    }
  };

  const filteredMessages = messages.filter((vm) => {
    if (filterMode === "unread" && vm.is_read) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const num = String(vm.caller_number || "").toLowerCase();
      const name = String(vm.caller_name || "").toLowerCase();
      return num.includes(q) || name.includes(q);
    }
    return true;
  });

  return (
    <div className="w-full h-full bg-slate-50/70 dark:bg-slate-950/40 p-5 md:p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl ${lightBg} ${text}`}>
              <Voicemail size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Sesli Posta Kutusu
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${lightBg} ${text} border ${borderLight}`}
                >
                  Dahili {myExt}
                </span>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500 text-white">
                    {unreadCount} Okunmamış
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bırakılan sesli mesajları doğrudan tarayıcıdan dinleyebilir, indirebilir veya masa telefonunuzdan{" "}
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">*97</span> tuşlayarak erişebilirsiniz.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === "all"
                    ? `${bg} text-white shadow-sm`
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tümü ({messages.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("unread")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === "unread"
                    ? `${bg} text-white shadow-sm`
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Okunmamış ({unreadCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchVoicemails(true)}
              disabled={refreshing}
              title="Sesli postaları yenile"
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center transition-all"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Arayan numara veya kişi adına göre filtrele..."
            className={`w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 ${ring}`}
          />
        </div>

        {/* Content List */}
        {loading ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center">
            <RefreshCw size={24} className={`mx-auto mb-3 animate-spin ${text}`} />
            <p className="text-xs font-semibold text-slate-500">Sesli mesajlar yükleniyor...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div
            className={`bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm p-12 text-center`}
          >
            <div className={`w-14 h-14 rounded-2xl ${lightBg} ${text} flex items-center justify-center mx-auto mb-4`}>
              <Voicemail size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {filterMode === "unread"
                ? "Okunmamış sesli mesajınız bulunmuyor"
                : "Sesli posta kutunuz şu anda boş"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Cevapsız kalan veya yönlendirilen aramalarda bırakılan sesli mesajlar burada listelenir.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((vm) => {
              const rawCaller = vm.caller_number || "Anonim";
              const displayCaller = maskPhoneNumbers ? maskPhoneLast4(rawCaller) : rawCaller;
              const audioSrc = `${getApiBase()}/api/voicemail/${vm.id}/audio`;
              const downloadUrl = `${getApiBase()}/api/voicemail/${vm.id}/audio?download=1`;

              return (
                <div
                  key={vm.id}
                  className={`p-4 md:p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-sm ${
                    !vm.is_read
                      ? `${border} ring-1 ${ring}`
                      : "border-slate-200/80 dark:border-slate-800"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Caller Info */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          !vm.is_read
                            ? `${bg} text-white shadow-sm`
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <Headphones size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {vm.caller_name ? `${vm.caller_name} (${displayCaller})` : displayCaller}
                          </span>
                          {!vm.is_read ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white">
                              YENİ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              <CheckCircle2 size={11} />
                              Dinlendi
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} />
                            {formatTimestamp(vm.created_at)}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Clock size={12} />
                            Süre: {formatDuration(vm.duration)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Audio Player & Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 lg:justify-end flex-1 max-w-2xl">
                      <WaveformAudioPlayer
                        src={audioSrc}
                        initialDuration={vm.duration}
                        title={`${displayCaller} sesli mesajı`}
                        onPlay={() => {
                          if (!vm.is_read) handleToggleRead(vm, true);
                        }}
                        className="w-full sm:w-80 md:w-96 flex-1"
                      />

                      <div className="flex items-center gap-1.5 shrink-0">
                        {rawCaller && rawCaller !== "Anonim" && (
                          <button
                            type="button"
                            onClick={() => handleCallback(rawCaller)}
                            title="Geri Ara"
                            className={`h-9 px-3 rounded-xl ${bg} ${hover} text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all`}
                          >
                            <PhoneCall size={14} />
                            <span>Geri Ara</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleRead(vm, !vm.is_read)}
                          title={vm.is_read ? "Okunmadı Olarak İşaretle" : "Okundu Olarak İşaretle"}
                          className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-all"
                        >
                          {vm.is_read ? <Mail size={15} /> : <MailOpen size={15} />}
                        </button>

                        <a
                          href={downloadUrl}
                          download={`sesli_posta_${vm.id}.wav`}
                          title="Ses Dosyasını (.wav) İndir"
                          className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-all"
                        >
                          <Download size={15} />
                        </a>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(vm)}
                          title="Sesli Mesajı Sil"
                          className="h-9 w-9 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 flex items-center justify-center transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 animate-pulse">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Sesli Mesajı Sil
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {deleteTarget.caller_name || deleteTarget.caller_number || "Anonim"}
                  </span>{" "}
                  tarafından bırakılan sesli mesaj kalıcı olarak silinecektir. Bu işlem geri alınamaz.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition-all"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                {deleting ? "Siliniyor..." : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
