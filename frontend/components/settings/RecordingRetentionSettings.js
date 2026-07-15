import React, { useState, useEffect } from "react";
import { HardDrive, Save, CheckCircle, ShieldAlert } from "lucide-react";

export default function RecordingRetentionSettings({ backendHost = "localhost:8000" }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [writePermission, setWritePermission] = useState(false);
  
  // Settings Form States
  const [deleteByDisk, setDeleteByDisk] = useState(true);
  const [diskThresholdPct, setDiskThresholdPct] = useState(80);
  const [deleteByDays, setDeleteByDays] = useState(false);
  const [keepDays, setKeepDays] = useState(90);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    const fetchSettingsAndPermissions = async () => {
      setLoading(true);
      try {
        // Check permissions
        const resStatus = await fetch(`${API_BASE}/api/agent/status`);
        const statusData = await resStatus.json();
        if (!statusData.is_logged_in) {
          setWritePermission(true);
        } else {
          const resUsers = await fetch(`${API_BASE}/api/settings/users`);
          const usersData = await resUsers.json();
          const currentUser = usersData.find(u => u.id === statusData.user_id);
          if (currentUser) {
            const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
            const rolesData = await resRoles.json();
            const currentRole = rolesData.find(r => r.role_code === currentUser.role);
            if (currentRole) {
              setWritePermission(currentRole.permissions.includes("recording_retention:write"));
            } else {
              setWritePermission(true);
            }
          } else {
            setWritePermission(true);
          }
        }

        // Fetch settings
        const resSettings = await fetch(`${API_BASE}/api/settings/recording-retention`);
        if (resSettings.ok) {
          const data = await resSettings.json();
          setDeleteByDisk(data.delete_by_disk ?? true);
          setDiskThresholdPct(data.disk_threshold_pct ?? 80);
          setDeleteByDays(data.delete_by_days ?? false);
          setKeepDays(data.keep_days ?? 90);
        }
      } catch (err) {
        console.error("Ses kayıt ayarları yüklenirken hata:", err);
        setWritePermission(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSettingsAndPermissions();
  }, [backendHost]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!writePermission) return;
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/settings/recording-retention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delete_by_disk: deleteByDisk,
          disk_threshold_pct: parseInt(diskThresholdPct) || 80,
          delete_by_days: deleteByDays,
          keep_days: parseInt(keepDays) || 90
        })
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Ses kayıt ayarları kaydedilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-rose-50 dark:bg-rose-950/20 text-rose-550 dark:text-rose-400 rounded-xl flex items-center justify-center shrink-0">
            <HardDrive size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-850 dark:text-slate-100">Ses Kayıt Saklama ve Silme Ayarları</h3>
            <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-0.5">Voice Recording Lifecycle Management</p>
          </div>
        </div>
      </div>

      {!writePermission && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <ShieldAlert size={16} className="text-primary" />
          <span>Düzenleme yetkiniz bulunmamaktadır. Ayarları sadece görüntüleyebilirsiniz.</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle size={16} />
          <span>Ayarlar başarıyla kaydedildi ve uygulandı.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Option 1: Disk threshold retention */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-black text-xs text-slate-800 dark:text-slate-200">Disk Doluluk Oranına Göre Silme</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Sistem diski belirlenen limitin üzerine çıktığında en eski ses kayıtlarını otomatik olarak temizler.</p>
            </div>
            <input 
              type="checkbox"
              checked={deleteByDisk}
              disabled={!writePermission}
              onChange={(e) => setDeleteByDisk(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer disabled:opacity-50"
            />
          </div>

          {deleteByDisk && (
            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-xl mt-1 animate-in slide-in-from-top-2 duration-150">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Silme Eşiği (Disk Doluluğu)</span>
                  <span className="text-xs font-black text-primary dark:text-rose-450">%{diskThresholdPct}</span>
                </div>
                <input 
                  type="range"
                  min="50"
                  max="95"
                  value={diskThresholdPct}
                  disabled={!writePermission}
                  onChange={(e) => setDiskThresholdPct(e.target.value)}
                  className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-600 disabled:opacity-50"
                />
              </div>
            </div>
          )}
        </div>

        {/* Option 2: Days based retention */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-850 rounded-2xl flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-black text-xs text-slate-800 dark:text-slate-200">Zaman Aşımına Göre Silme (Periyodik)</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Belirtilen gün sayısından daha eski olan tüm ses kayıtlarını düzenli olarak sistemden temizler.</p>
            </div>
            <input 
              type="checkbox"
              checked={deleteByDays}
              disabled={!writePermission}
              onChange={(e) => setDeleteByDays(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-rose-500 h-4 w-4 cursor-pointer disabled:opacity-50"
            />
          </div>

          {deleteByDays && (
            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 p-4 rounded-xl mt-1 animate-in slide-in-from-top-2 duration-150">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">Kayıt Tutma Süresi (Gün)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    min="1"
                    max="3650"
                    value={keepDays}
                    disabled={!writePermission}
                    onChange={(e) => setKeepDays(e.target.value)}
                    className="w-32 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500 font-bold"
                  />
                  <span className="text-xs font-semibold text-slate-550 dark:text-slate-455">gün sonra silinir.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Never delete safeguard */}
        {!deleteByDisk && !deleteByDays && (
          <div className="p-4 bg-rose-50/50 dark:bg-rose-955/10 border border-rose-100/65 dark:border-rose-900/30 rounded-2xl flex flex-col gap-1">
            <h4 className="font-black text-xs text-primary dark:text-rose-455">⚠️ Koruma Modu Aktif (Ömür Boyu Saklama)</h4>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 leading-relaxed">
              Her iki silme filtresi de kapalı olduğu için ses kayıtları <strong>asla otomatik olarak silinmeyecektir</strong>. 
              Disk dolup sistem kilitlenene kadar tüm geçmiş kayıtlar muhafaza edilir.
            </p>
          </div>
        )}

        {/* Save action button */}
        {writePermission && (
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-primary hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>{loading ? "Kaydediliyor..." : "Ayarları Kaydet"}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
