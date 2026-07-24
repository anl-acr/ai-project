import React, { useState, useEffect } from "react";
import { HardDrive, CheckCircle, Save, Plus, Database, AlertCircle, TrendingUp } from "lucide-react";
import { useTheme } from "../../utils/theme";

const PROVIDERS_INFO = {
  openai: { name: "OpenAI", color: "emerald", iconBg: "bg-emerald-50 dark:bg-emerald-900/20", iconColor: "text-emerald-600 dark:text-emerald-400" },
  anthropic: { name: "Anthropic (Claude)", color: "rose", iconBg: "bg-rose-50 dark:bg-rose-900/20", iconColor: "text-rose-600 dark:text-rose-400" },
  groq: { name: "Groq", color: "orange", iconBg: "bg-orange-50 dark:bg-orange-900/20", iconColor: "text-orange-600 dark:text-orange-400" },
  google: { name: "Google (Gemini)", color: "blue", iconBg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600 dark:text-blue-400" },
  elevenlabs: { name: "ElevenLabs (TTS)", color: "purple", iconBg: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-600 dark:text-purple-400" }
};

export default function APIBudgetSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  
  const [budgets, setBudgets] = useState({
    openai: { loaded_credit: 0, spent_credit: 0 },
    anthropic: { loaded_credit: 0, spent_credit: 0 },
    groq: { loaded_credit: 0, spent_credit: 0 },
    google: { loaded_credit: 0, spent_credit: 0 },
    elevenlabs: { loaded_credit: 0, spent_credit: 0 }
  });
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [addFundMode, setAddFundMode] = useState(null); // stores provider key
  const [addAmount, setAddAmount] = useState("");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    checkPermissionsAndFetchData();
  }, [backendHost]);

  const checkPermissionsAndFetchData = async () => {
    setLoading(true);
    try {
      const resStatus = await fetch(`${API_BASE}/api/agent/status`);
      const statusData = await resStatus.json();
      
      let canWrite = false;
      if (statusData.is_logged_in) {
        const resUsers = await fetch(`${API_BASE}/api/settings/users`);
        const usersData = await resUsers.json();
        const currentUser = usersData.find(u => u.id === statusData.user_id);
        if (currentUser) {
          const resRoles = await fetch(`${API_BASE}/api/settings/roles`);
          const rolesData = await resRoles.json();
          const currentRole = rolesData.find(r => r.role_code === currentUser.role);
          if (currentRole && currentRole.permissions.includes("api_budgets:write")) {
            canWrite = true;
          }
        }
      } else {
        canWrite = true; 
      }
      setHasWritePermission(canWrite);
      await fetchBudgets();
    } catch (err) {
      console.error("Yetki/Veri yükleme hatası:", err);
      setError("Veriler yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/api-budgets`);
      if (res.ok) {
        const data = await res.json();
        setBudgets(data);
      }
    } catch (e) {
      console.error("Failed to load budgets", e);
    }
  };

  const saveBudgets = async (updatedBudgets) => {
    if (!hasWritePermission) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/settings/api-budgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedBudgets)
      });
      if (res.ok) {
        setSuccess("Bütçe ayarları başarıyla güncellendi.");
        setTimeout(() => setSuccess(""), 3000);
        await fetchBudgets();
      } else {
        setError("Ayarlar kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
      setAddFundMode(null);
      setAddAmount("");
    }
  };

  const handleAddFund = (provider) => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Lütfen geçerli bir tutar girin.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const updatedBudgets = { ...budgets };
    updatedBudgets[provider].loaded_credit += amount;
    
    saveBudgets(updatedBudgets);
  };

  const getPercentage = (loaded, spent) => {
    if (loaded <= 0) return 0;
    const p = (spent / loaded) * 100;
    return p > 100 ? 100 : p;
  };

  const getRemaining = (loaded, spent) => {
    const rem = loaded - spent;
    return rem < 0 ? 0 : rem;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm w-full animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/85 dark:border-slate-800/80 pb-5 mb-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <Database size={20} className="text-emerald-500" />
            API Bütçe ve Tüketim Takibi
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Servislere yüklediğiniz bakiyeleri girin. PBX sistemi yapılan aramaların token kullanımına göre tahmini harcamayı ve kalan bakiyeyi hesaplar.
          </p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400 text-xs font-semibold">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-red-50 border border-red-100 text-red-800 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 text-xs font-semibold">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.keys(budgets).map(provider => {
          const data = budgets[provider];
          const info = PROVIDERS_INFO[provider];
          const spentPct = getPercentage(data.loaded_credit, data.spent_credit);
          const remaining = getRemaining(data.loaded_credit, data.spent_credit);
          const isDanger = spentPct >= 90;
          const isWarning = spentPct >= 75 && !isDanger;

          return (
            <div key={provider} className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${info.iconBg} ${info.iconColor}`}>
                      <TrendingUp size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{info.name}</h3>
                  </div>
                  {hasWritePermission && addFundMode !== provider && (
                    <button 
                      onClick={() => setAddFundMode(provider)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-7 w-7 flex items-center justify-center shrink-0 transition-colors shadow-sm"
                      title="Bakiye Ekle"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider mb-1">Toplam Bütçe</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">${data.loaded_credit.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider mb-1">Kalan Tahmini</p>
                    <p className={`text-lg font-bold ${isDanger ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-emerald-500'}`}>
                      ${remaining.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-[10px] font-semibold">
                    <span className="text-slate-500">Tüketim: ${data.spent_credit.toFixed(2)}</span>
                    <span className={isDanger ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-emerald-500'}>
                      {spentPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${isDanger ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${spentPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {addFundMode === provider && (
                <div className="absolute inset-0 bg-white dark:bg-slate-800 p-5 z-10 flex flex-col justify-center border-t-2 border-emerald-500 shadow-xl animate-in slide-in-from-bottom-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">{info.name} İçin Yüklenen Bakiye Ekle</h4>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input 
                        type="number" 
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-sm pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    </div>
                    <button 
                      onClick={() => handleAddFund(provider)}
                      className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm"
                    >
                      Ekle
                    </button>
                    <button 
                      onClick={() => { setAddFundMode(null); setAddAmount(""); }}
                      className="px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
    </div>
  );
}
