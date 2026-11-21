import React, { useState, useEffect, useCallback } from "react";
import { Clock, Save, CheckCircle2, Users, RefreshCw, Sparkles, RotateCcw } from "lucide-react";
import { useTheme } from "../../utils/theme";

const DAY_LABELS = [
  { id: "monday", short: "Pzt" },
  { id: "tuesday", short: "Sal" },
  { id: "wednesday", short: "Çar" },
  { id: "thursday", short: "Per" },
  { id: "friday", short: "Cum" },
  { id: "saturday", short: "Cmt" },
  { id: "sunday", short: "Paz" }
];

export default function WfmShiftPlannerCard({ apiBase = "", tenantFetch, onSaved }) {
  const { bg, hover, text, lightBg, borderLight } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [presets, setPresets] = useState([]);
  const [defaultShift, setDefaultShift] = useState({
    enabled: true,
    shift_name: "Standart Gündüz (09:00 - 18:00)",
    start_time: "09:00",
    end_time: "18:00",
    work_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    planned_break_minutes: 60,
    tolerance_minutes: 5
  });
  const [agents, setAgents] = useState([]);
  const [byExt, setByExt] = useState({});

  const doFetch = useCallback(
    (url, opts) => (typeof tenantFetch === "function" ? tenantFetch(url, opts) : fetch(url, opts)),
    [tenantFetch]
  );

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await doFetch(`${apiBase}/api/settings/agent-shifts?t=${Date.now()}`);
      if (res.ok) {
        const d = await res.json();
        if (d.default_shift) setDefaultShift(d.default_shift);
        setByExt(d.by_extension || {});
        setPresets(Array.isArray(d.presets) ? d.presets : []);
        setAgents(Array.isArray(d.agents) ? d.agents : []);
      }
    } catch (e) {}
    finally {
      setLoading(false);
    }
  }, [apiBase, doFetch]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const toggleDefaultDay = (dayId) => {
    setDefaultShift((prev) => {
      const cur = Array.isArray(prev.work_days) ? prev.work_days : [];
      const next = cur.includes(dayId) ? cur.filter((d) => d !== dayId) : [...cur, dayId];
      return { ...prev, work_days: next.length > 0 ? next : cur };
    });
  };

  const updateAgentShiftField = (ext, patch) => {
    setByExt((prev) => {
      const base = prev[ext] || { ...defaultShift };
      return {
        ...prev,
        [ext]: { ...base, ...patch }
      };
    });
  };

  const resetAgentToDefault = (ext) => {
    setByExt((prev) => {
      const next = { ...prev };
      delete next[ext];
      return next;
    });
  };

  const handleSave = async (applyDefaultToAll = false) => {
    setSaving(true);
    setSavedMsg("");
    try {
      const payload = applyDefaultToAll
        ? { default_shift: defaultShift, apply_default_to_all: true }
        : { default_shift: defaultShift, by_extension: byExt };
      const res = await doFetch(`${apiBase}/api/settings/agent-shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        if (applyDefaultToAll) setByExt({});
        setSavedMsg(
          applyDefaultToAll
            ? "Varsayılan vardiya tüm temsilcilere uygulandı ve Adherence oranları güncellendi."
            : "Vardiya planları kaydedildi ve Adherence oranları yeniden hesaplandı."
        );
        setTimeout(() => setSavedMsg(""), 4500);
        if (typeof onSaved === "function") onSaved();
      }
    } catch (e) {}
    finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
        <RefreshCw size={14} className="animate-spin" />
        <span>Vardiya planları yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {savedMsg && (
        <div className="px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Default Shift Card */}
      <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border ${borderLight} shadow-sm space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center`}>
              <Clock size={18} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Varsayılan Vardiya Planı (WFM Adherence Referansı)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Geç giriş, erken çıkış ve Vardiya Uyum Oranı (% Adherence) bu planlara göre otomatik hesaplanır.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Varsayılanı Tümüne Uygula
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${bg} ${hover} text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50`}
            >
              <Save size={13} />
              <span>{saving ? "Kaydediliyor..." : "Vardiyaları Kaydet"}</span>
            </button>
          </div>
        </div>

        {/* Presets */}
        {presets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Sparkles size={11} /> Hazır Şablonlar:
            </span>
            {presets.map((pr) => (
              <button
                key={pr.id}
                type="button"
                onClick={() =>
                  setDefaultShift((prev) => ({
                    ...prev,
                    shift_name: pr.shift_name,
                    start_time: pr.start_time,
                    end_time: pr.end_time,
                    work_days: pr.work_days,
                    planned_break_minutes: pr.planned_break_minutes,
                    tolerance_minutes: pr.tolerance_minutes
                  }))
                }
                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {pr.shift_name}
              </button>
            ))}
          </div>
        )}

        {/* Default Shift Inputs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Başlangıç</label>
            <input
              type="time"
              value={defaultShift.start_time}
              onChange={(e) => setDefaultShift((p) => ({ ...p, start_time: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Bitiş</label>
            <input
              type="time"
              value={defaultShift.end_time}
              onChange={(e) => setDefaultShift((p) => ({ ...p, end_time: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Planlı Mola (dk)</label>
            <input
              type="number"
              min={0}
              max={240}
              value={defaultShift.planned_break_minutes}
              onChange={(e) => setDefaultShift((p) => ({ ...p, planned_break_minutes: Number(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tolerans (dk)</label>
            <input
              type="number"
              min={0}
              max={60}
              value={defaultShift.tolerance_minutes}
              onChange={(e) => setDefaultShift((p) => ({ ...p, tolerance_minutes: Number(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Çalışma Günleri</label>
            <div className="flex flex-wrap gap-1">
              {DAY_LABELS.map((d) => {
                const active = (defaultShift.work_days || []).includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDefaultDay(d.id)}
                    className={`px-1.5 py-1 rounded-md text-[10px] font-extrabold cursor-pointer transition-colors ${
                      active
                        ? `${bg} text-white`
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Agent Custom Shifts Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white">
            <Users size={14} className={text} />
            <span>Temsilci Bazlı Vardiya Atamaları ({agents.length})</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Özel saat girilmeyen temsilciler varsayılan vardiyayı kullanır.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[10px] font-extrabold uppercase text-slate-500">
                <th className="py-2.5 px-4">Temsilci</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3">Başlangıç</th>
                <th className="py-2.5 px-3">Bitiş</th>
                <th className="py-2.5 px-3">Planlı Mola (dk)</th>
                <th className="py-2.5 px-3">Tolerans (dk)</th>
                <th className="py-2.5 px-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {agents.map((ag) => {
                const isCustom = Boolean(byExt[ag.extension]);
                const eff = byExt[ag.extension] || defaultShift;
                return (
                  <tr key={ag.extension} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-white whitespace-nowrap">
                      {ag.full_name}{" "}
                      <span className="text-[11px] font-normal text-slate-400">({ag.extension})</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isCustom
                            ? `${lightBg} ${text} border ${borderLight}`
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {isCustom ? "Özel Vardiya" : "Varsayılan"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="time"
                        value={eff.start_time}
                        onChange={(e) => updateAgentShiftField(ag.extension, { start_time: e.target.value })}
                        className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="time"
                        value={eff.end_time}
                        onChange={(e) => updateAgentShiftField(ag.extension, { end_time: e.target.value })}
                        className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min={0}
                        max={240}
                        value={eff.planned_break_minutes}
                        onChange={(e) =>
                          updateAgentShiftField(ag.extension, {
                            planned_break_minutes: Number(e.target.value) || 0
                          })
                        }
                        className="w-20 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={eff.tolerance_minutes}
                        onChange={(e) =>
                          updateAgentShiftField(ag.extension, {
                            tolerance_minutes: Number(e.target.value) || 0
                          })
                        }
                        className="w-16 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => resetAgentToDefault(ag.extension)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Varsayılan Vardiyaya Döndür"
                        >
                          <RotateCcw size={11} />
                          <span>Varsayılan</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
