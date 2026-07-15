import React, { useState } from "react";
import { X, User, Phone, Mail, CheckCircle } from "lucide-react";

export default function AddContactModal({ isOpen, onClose, initialPhone = "", initialEmail = "", backendHost = "localhost:8000", onSaveSuccess }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const API_BASE = `${window.location.protocol}//${backendHost}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setErrorMsg("Lütfen zorunlu alanları (Ad, Soyad, Telefon) doldurun.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
          email: email.trim() || null
        })
      });

      if (res.ok) {
        setSuccess(true);
        if (onSaveSuccess) onSaveSuccess();
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1500);
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || "Kişi kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("[AddContactModal] Save error:", err);
      setErrorMsg("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-955/65 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-155">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
          <h3 className="text-xs font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">Hızlı Rehbere Kaydet</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 transition">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-primary dark:text-rose-400 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-primary dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle size={14} />
              <span>Kişi başarıyla rehbere kaydedildi!</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Ad *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Soyad *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Telefon Numarası *</label>
            <div className="relative">
              <Phone size={13} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="pl-9 pr-3 py-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">E-posta</label>
            <div className="relative">
              <Mail size={13} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@posta.com"
                className="pl-9 pr-3 py-2 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 hover: dark: dark:hover: dark: border dark: rounded-xl font-bold transition bg-slate-500 hover:bg-slate-600 text-white border-transparent"
            >Vazgeç</button>
            
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary hover:bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/10 transition"
            >
              {loading ? "Kaydediliyor..." : "Rehbere Ekle"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
