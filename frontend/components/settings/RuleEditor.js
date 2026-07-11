import React, { useState, useEffect } from "react";
import { Sliders, Plus, Trash2, Save, HelpCircle, CornerDownRight, CheckCircle } from "lucide-react";

export default function RuleEditor({ backendHost = "localhost:8000" }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Rule Form States
  const [ruleType, setRuleType] = useState("faq");
  const [keyword, setKeyword] = useState("");
  const [response, setResponse] = useState("");
  const [action, setAction] = useState("transfer_to_human");

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  // Fetch active rules from database
  const fetchRules = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/rules`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setRules(data);
      })
      .catch((err) => console.error("[Rules] Kurallar alinamadi:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRules();
  }, []);

  // Handle new rule submission
  const handleAddRule = async (e) => {
    e.preventDefault();
    setSuccessMsg("");

    const payload = {
      rule_type: ruleType,
      trigger_keyword: ruleType === "prompt" ? "sistem_yonergesi" : keyword,
      response_text: response,
      action_to_trigger: ruleType === "routing" ? action : null,
      is_active: true
    };

    try {
      const res = await fetch(`${API_BASE}/api/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg("Kural başarıyla eklendi ve yapay zekaya öğretildi!");
        setKeyword("");
        setResponse("");
        fetchRules();
        // Clear message after 3s
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("[Rules] Kural ekleme hatasi:", err);
    }
  };

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });

  // Trigger Delete Confirmation Modal
  const handleDeleteRule = (id) => {
    setDeleteConfirm({ show: true, id: id });
  };

  // Actual Delete Execution
  const executeDeleteRule = async () => {
    const id = deleteConfirm.id;
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/rules/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDeleteConfirm({ show: false, id: null });
        fetchRules();
      }
    } catch (err) {
      console.error("[Rules] Kural silme hatasi:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 max-w-4xl w-full">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-600/20 text-indigo-500 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-2xl">
          <Sliders size={24} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Kural ve Senaryo Editörü</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Yapay zekanın davranışlarını, karakter tonunu ve yönlendirme mantığını görsel kurallarla yönetin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Add Rule Form (Left Panel - 1/3 wide) */}
        <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl md:col-span-1 h-fit shadow-sm transition-colors duration-300">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-350 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">Yeni Kural Tanımla</h3>
          <form onSubmit={handleAddRule} className="flex flex-col gap-4">
            
            {/* Rule Type Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Kural Türü</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="faq">Soru-Cevap (FAQ) Eşleşmesi</option>
                <option value="routing">Özel Yönlendirme (Aksiyon)</option>
                <option value="prompt">Karakter & Prompt Eklemesi</option>
              </select>
            </div>

            {/* Keyword Input (if not Prompt type) */}
            {ruleType !== "prompt" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
                  {ruleType === "faq" ? "Müşteri Konuşması (Anahtar Kelime)" : "Yönlendirme Tetikleyicisi"}
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={ruleType === "faq" ? "Örn: indirim, kampanya" : "Örn: teknik sorun, sikayet"}
                  required
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>
            )}

            {/* Action Selector (only for Routing rules) */}
            {ruleType === "routing" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Çalıştırılacak Aksiyon</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-700 dark:text-slate-350 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="transfer_to_human">İnsana Çağrı/Chat Transferi Başlat</option>
                  <option value="book_appointment">Randevu Oluşturma Ajanını Tetikle</option>
                </select>
              </div>
            )}

            {/* Response/Prompt Text Input */}
            {ruleType !== "routing" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">
                  {ruleType === "faq" ? "Yapay Zeka Cevabı" : "Karakter/Talimat Metni"}
                </label>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder={
                    ruleType === "faq" 
                      ? "Müşteri bu anahtar kelimeden bahsettiğinde verilecek net cevabı yazın..." 
                      : "Yapay zekaya eklemek istediğiniz karakter talimatını yazın..."
                  }
                  required
                  rows={4}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-medium"
                />
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className="mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white transition rounded-xl font-bold text-xs shadow-md shadow-indigo-500/10"
            >
              <Plus size={14} /> Kuralı Ekle
            </button>
          </form>

          {successMsg && (
            <div className="mt-4 p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-250 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-305 text-xs flex items-center gap-1.5 font-semibold">
              <CheckCircle size={14} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Rule List Panel (Right Panel - 2/3 wide) */}
        <div className="flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl md:col-span-2 shadow-sm transition-colors duration-300">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-350 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">Aktif Yapay Zeka Kuralları</h3>
          
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-10 font-semibold animate-pulse">Kurallar yükleniyor...</p>
          ) : rules.length === 0 ? (
            <p className="text-xs text-slate-450 dark:text-slate-500 text-center py-10 font-semibold">Henüz tanımlanmış bir kural bulunmuyor. Sol panelden ilk kuralınızı tanımlayabilirsiniz.</p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
              {rules.map((rule) => (
                <div 
                  key={rule.id}
                  className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="flex flex-col gap-1.5 max-w-[85%]">
                    {/* Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        rule.rule_type === "faq" 
                          ? "bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50"
                          : rule.rule_type === "routing"
                          ? "bg-rose-50 dark:bg-rose-600/20 text-rose-600 dark:text-rose-455 border border-rose-100 dark:border-rose-800/50"
                          : "bg-purple-50 dark:bg-purple-600/20 text-purple-650 dark:text-purple-400 border border-purple-100 dark:border-purple-800/50"
                      }`}>
                        {rule.rule_type === "faq" ? "SORU-CEVAP" : rule.rule_type === "routing" ? "YÖNLENDİRME" : "PROMPT / KARAKTER"}
                      </span>
                      {rule.rule_type !== "prompt" && (
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400 font-bold">"{rule.trigger_keyword}"</span>
                      )}
                    </div>

                    {/* Rule Body */}
                    {rule.rule_type === "routing" ? (
                      <div className="flex items-center text-xs text-slate-600 dark:text-slate-300 gap-1 mt-1 font-semibold">
                        <CornerDownRight size={14} className="text-rose-550 dark:text-rose-400" />
                        <span>Aksiyon Çalıştır:</span>
                        <span className="font-semibold text-slate-800 dark:text-white font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                          {rule.action_to_trigger}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap font-medium">{rule.response_text}</p>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full text-slate-850 dark:text-white shadow-2xl p-6 flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="h-12 w-12 rounded-full bg-rose-50 dark:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40 flex items-center justify-center shadow-sm">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Kuralı Sil</h3>
              <p className="text-xs text-slate-550 dark:text-slate-400 mt-2 font-medium">Bu kuralı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
            </div>
            <div className="flex gap-3 w-full mt-2 font-bold">
              <button
                onClick={() => setDeleteConfirm({ show: false, id: null })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 transition rounded-xl text-xs text-slate-600 dark:text-slate-300"
              >
                İptal Et
              </button>
              <button
                onClick={executeDeleteRule}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white transition rounded-xl text-xs shadow-md shadow-rose-500/10"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
