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
    <div className="flex flex-col gap-6 text-white max-w-4xl w-full">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-600/20 text-indigo-400 border border-indigo-800 rounded-2xl">
          <Sliders size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold">Kural ve Senaryo Editörü</h2>
          <p className="text-sm text-slate-400">Yapay zekanın davranışlarını, karakter tonunu ve yönlendirme mantığını görsel kurallarla yönetin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Add Rule Form (Left Panel - 1/3 wide) */}
        <div className="flex flex-col p-5 bg-slate-900 border border-slate-800 rounded-2xl md:col-span-1 h-fit">
          <h3 className="font-semibold text-sm mb-4 border-b border-slate-800 pb-2">Yeni Kural Tanımla</h3>
          <form onSubmit={handleAddRule} className="flex flex-col gap-4">
            
            {/* Rule Type Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Kural Türü</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="faq">Soru-Cevap (FAQ) Eşleşmesi</option>
                <option value="routing">Özel Yönlendirme (Aksiyon)</option>
                <option value="prompt">Karakter & Prompt Eklemesi</option>
              </select>
            </div>

            {/* Keyword Input (if not Prompt type) */}
            {ruleType !== "prompt" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">
                  {ruleType === "faq" ? "Müşteri Konuşması (Anahtar Kelime)" : "Yönlendirme Tetikleyicisi"}
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={ruleType === "faq" ? "Örn: indirim, kampanya" : "Örn: teknik sorun, sikayet"}
                  required
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Action Selector (only for Routing rules) */}
            {ruleType === "routing" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Çalıştırılacak Aksiyon</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="transfer_to_human">İnsana Çağrı/Chat Transferi Başlat</option>
                  <option value="book_appointment">Randevu Oluşturma Ajanını Tetikle</option>
                </select>
              </div>
            )}

            {/* Response/Prompt Text Input */}
            {ruleType !== "routing" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">
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
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className="mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 transition rounded-xl font-medium text-sm"
            >
              <Plus size={16} /> Kuralı Ekle
            </button>
          </form>

          {successMsg && (
            <div className="mt-4 p-2 bg-emerald-950/50 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-1.5 animate-pulse">
              <CheckCircle size={14} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Rule List Panel (Right Panel - 2/3 wide) */}
        <div className="flex flex-col p-5 bg-slate-900 border border-slate-800 rounded-2xl md:col-span-2">
          <h3 className="font-semibold text-sm mb-4 border-b border-slate-800 pb-2">Aktif Yapay Zeka Kuralları</h3>
          
          {loading ? (
            <p className="text-xs text-slate-500 text-center py-10">Kurallar yükleniyor...</p>
          ) : rules.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">Henüz tanımlanmış bir kural bulunmuyor. Sol panelden ilk kuralınızı tanımlayabilirsiniz.</p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {rules.map((rule) => (
                <div 
                  key={rule.id}
                  className="flex items-start justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition"
                >
                  <div className="flex flex-col gap-1.5 max-w-[85%]">
                    {/* Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        rule.rule_type === "faq" 
                          ? "bg-blue-600/20 text-blue-400 border border-blue-800/50"
                          : rule.rule_type === "routing"
                          ? "bg-rose-600/20 text-rose-400 border border-rose-800/50"
                          : "bg-purple-600/20 text-purple-400 border border-purple-800/50"
                      }`}>
                        {rule.rule_type === "faq" ? "SORU-CEVAP" : rule.rule_type === "routing" ? "YÖNLENDİRME" : "PROMPT / KARAKTER"}
                      </span>
                      {rule.rule_type !== "prompt" && (
                        <span className="text-xs font-mono text-slate-400 font-bold">"{rule.trigger_keyword}"</span>
                      )}
                    </div>

                    {/* Rule Body */}
                    {rule.rule_type === "routing" ? (
                      <div className="flex items-center text-xs text-slate-300 gap-1 mt-1">
                        <CornerDownRight size={14} className="text-rose-400" />
                        <span>Aksiyon Çalıştır:</span>
                        <span className="font-semibold text-white font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {rule.action_to_trigger}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">{rule.response_text}</p>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full text-white shadow-2xl p-6 flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="h-12 w-12 rounded-full bg-rose-600/20 text-rose-400 border border-rose-800/40 flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Kuralı Sil</h3>
              <p className="text-xs text-slate-400 mt-2">Bu kuralı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
            </div>
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => setDeleteConfirm({ show: false, id: null })}
                className="flex-1 py-2 bg-slate-850 hover:bg-slate-800 transition rounded-xl font-semibold text-xs text-slate-300"
              >
                İptal Et
              </button>
              <button
                onClick={executeDeleteRule}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 transition rounded-xl font-semibold text-xs text-white"
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
