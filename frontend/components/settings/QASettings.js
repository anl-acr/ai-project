import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, CheckCircle, Search, FileText, Check, X, ShieldAlert } from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

export default function QASettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Form Fields
  const [questionText, setQuestionText] = useState("");
  const [maxScore, setMaxScore] = useState(10);
  const [isActive, setIsActive] = useState(true);

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/qa/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } catch (err) {
      console.error("QA soruları yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingQuestion(null);
    setQuestionText("");
    setMaxScore(10);
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (q) => {
    setEditingQuestion(q);
    setQuestionText(q.question);
    setMaxScore(q.max_score);
    setIsActive(q.is_active);
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    const payload = {
      question: questionText.trim(),
      max_score: Number(maxScore),
      is_active: isActive
    };

    try {
      let res;
      if (editingQuestion) {
        res = await fetch(`${API_BASE}/api/qa/questions/${editingQuestion.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/api/qa/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setSuccess(true);
        fetchQuestions();
        setShowModal(false);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Kural kaydedilemedi:", err);
    }
  };

  const handleDelete = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/qa/questions/${deleteTargetId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSuccess(true);
        setDeleteTargetId(null);
        fetchQuestions();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Kural silinemedi:", err);
    }
  };

  const toggleActiveStatus = async (q) => {
    const payload = {
      question: q.question,
      max_score: q.max_score,
      is_active: !q.is_active
    };
    try {
      const res = await fetch(`${API_BASE}/api/qa/questions/${q.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchQuestions();
      }
    } catch (err) {
      console.error("Durum güncellenemedi:", err);
    }
  };

  const filteredQuestions = questions.filter((q) =>
    q.question.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full space-y-6">
      {/* Standalone Header Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 ${lightBg} ${text} rounded-xl`}>
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Otomatik Kalite Değerlendirme (QA)</h3>
            <p className="text-[10px] text-slate-555 dark:text-slate-400 mt-0.5 font-medium">
              Yapay zeka için sesli ve yazılı görüşmeleri değerlendirme kriterleri oluşturun, ceza puanları belirleyin ve koçluk raporları alın.
            </p>
          </div>
        </div>

        {/* Search Bar + "+" Icon Wrapper */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Kurallarda ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} dark:focus:ring-rose-400/25 transition-all`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555" />
          </div>

          <button
            onClick={openAddModal}
            className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
            title="Yeni Kriter Ekle"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-200/50 dark:border-emerald-900/30 rounded-2xl text-primary dark:text-emerald-455 text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle size={15} /> İşlem başarıyla kaydedildi!
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-xs text-slate-500">Değerlendirme kuralları yükleniyor...</div>
      ) : filteredQuestions.length === 0 ? (
        <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-550 dark:text-slate-455 text-xs">
          Kayıtlı kalite değerlendirme kuralı bulunamadı.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuestions.map((q) => (
            <div
              key={q.id}
              className={`p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-6 transition-all hover:shadow-sm ${
                !q.is_active ? "opacity-60" : ""
              }`}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                  {q.question}
                </p>
                <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-555 font-bold">
                  <span className="bg-rose-50 dark:bg-rose-950/20 text-primary dark:text-rose-455 px-2 py-0.5 rounded-lg">
                    Maks Ceza: -{q.max_score} Puan
                  </span>
                  <span>Durum: {q.is_active ? "Aktif" : "Pasif"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => toggleActiveStatus(q)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 focus:outline-none flex items-center ${
                    q.is_active ? "bg-primary justify-end" : "bg-slate-200 dark:bg-slate-800 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>

                <button
                  onClick={() => openEditModal(q)}
                  className="p-2 text-slate-450 hover:text-slate-700 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 transition-all"
                  title="Düzenle"
                >
                  <Edit2 size={12} />
                </button>

                <button
                  onClick={() => handleDelete(q.id)}
                  className="p-2 text-slate-450 hover:text-primary rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-rose-50/20 dark:hover:bg-rose-950/20 transition-all"
                  title="Sil"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">
                  {editingQuestion ? "Değerlendirme Kuralını Düzenle" : "Yeni Değerlendirme Kuralı"}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">
                  Kural Sorusu (AI Kontrol Kriteri)
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="Örn: Temsilci KVKK aydınlatma metnini müşteriye okudu mu veya onay aldı mı?"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">
                  Maksimum Ceza Puanı (İhlal Halinde Düşülecek)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">
                  Kural Aktiflik Durumu
                </span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all duration-200 focus:outline-none flex items-center ${
                    isActive ? "bg-primary justify-end" : "bg-slate-200 dark:bg-slate-800 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold border dark: dark: dark: hover: transition-all bg-slate-500 hover:bg-slate-600 text-white border-transparent"
                >Vazgeç</button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary text-white transition-all shadow-md shadow-indigo-500/10"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Kriteri Sil"
        message="Seçilen otomatik kalite kriterini silmek istediğinize emin misiniz? Bu işlem geçmiş değerlendirmeleri etkilemez ancak yeni görüşmelerde bu kriter artık sorgulanmayacaktır."
      />
    </div>
  );
}
