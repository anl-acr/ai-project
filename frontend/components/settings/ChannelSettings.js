import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Bot, User, HelpCircle, Save, CheckCircle, Smartphone, Copy, Check, Sparkles, Plus, Trash2, Edit3, AlertTriangle, Layers, PhoneCall } from "lucide-react";
import { useTheme } from "../../utils/theme";

export default function ChannelSettings({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  const [channels, setChannels] = useState({
    whatsapp_token: "",
    whatsapp_phone_number_id: "",
    whatsapp_verify_token: "ai_pbx_whatsapp_verify_token_secure",
    whatsapp_persona: "samimi",
    whatsapp_welcome_menu_enabled: true,
    whatsapp_after_hours_enabled: true,
    whatsapp_work_hours_start: "09:00",
    whatsapp_work_hours_end: "18:00",
    whatsapp_accounts: [],
    telegram_token: "",
    instagram_token: "",
    facebook_token: "",
    email_smtp_host: "smtp.gmail.com",
    email_smtp_port: "587",
    email_smtp_user: "",
    email_smtp_pass: "",
    email_imap_host: "imap.gmail.com",
    email_imap_port: "993"
  });
  
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("whatsapp"); // whatsapp, telegram, meta
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Multi-WhatsApp Account Modal States
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({
    id: "",
    name: "",
    display_phone_number: "",
    phone_number_id: "",
    access_token: "",
    persona: "samimi",
    welcome_menu_enabled: true
  });
  const [deleteAccountTarget, setDeleteAccountTarget] = useState(null);

  const handleOpenAddAccount = () => {
    setAccountForm({
      id: "wa_" + Date.now(),
      name: "",
      display_phone_number: "",
      phone_number_id: "",
      access_token: "",
      persona: "samimi",
      welcome_menu_enabled: true
    });
    setShowAccountModal(true);
  };

  const handleEditAccount = (acc) => {
    setAccountForm({ ...acc });
    setShowAccountModal(true);
  };

  const handleSaveAccount = (e) => {
    e.preventDefault();
    if (!accountForm.name || !accountForm.phone_number_id) return;
    
    setChannels((prev) => {
      const existing = prev.whatsapp_accounts || [];
      const idx = existing.findIndex((a) => a.id === accountForm.id);
      let updated = [];
      if (idx >= 0) {
        updated = [...existing];
        updated[idx] = accountForm;
      } else {
        updated = [...existing, accountForm];
      }
      return { ...prev, whatsapp_accounts: updated };
    });
    setShowAccountModal(false);
  };

  const handleDeleteAccountConfirm = () => {
    if (!deleteAccountTarget) return;
    setChannels((prev) => ({
      ...prev,
      whatsapp_accounts: (prev.whatsapp_accounts || []).filter((a) => a.id !== deleteAccountTarget.id)
    }));
    setDeleteAccountTarget(null);
  };

  // Chat Copilot States
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "bot",
      text: "Merhaba! Ben Entegrasyon Yardımcınız. WhatsApp Business API, Telegram Botu veya Meta webhook bağlantılarını kurarken takıldığınız her şeyi bana sorabilirsiniz. Kuruluma hangi kanaldan başlamak istersiniz?"
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const chatEndRef = useRef(null);

  const API_BASE = `${window.location.protocol}//${backendHost}`;
  const WEBHOOK_WHATSAPP_URL = `${API_BASE}/api/webhooks/whatsapp`;

  useEffect(() => {
    fetch(`${API_BASE}/api/settings/channels`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setChannels((prev) => ({ ...prev, ...data }));
      })
      .catch((err) => console.error("[Channels Settings] Ayarlar yuklenemedi:", err));
  }, [API_BASE]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setChannels((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/settings/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(channels)
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[Channels Settings] Kayit hatasi:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (textToCopy, setCopiedState) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  // Setup Copilot Chatbot logic
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userText = userInput;
    setChatMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setUserInput("");

    setTimeout(() => {
      let botResponse = "Bu entegrasyon adımıyla ilgili size nasıl yardımcı olacağımı tam olarak anlayamadım. Lütfen WhatsApp, Telegram veya Meta Webhook konularında daha spesifik bir soru sorun.";

      const textLower = userText.toLowerCase();
      if (textLower.includes("whatsapp") || textLower.includes("wa")) {
        botResponse = `WhatsApp Business Cloud API entegrasyonu için:\n1. developers.facebook.com adresine gidin.\n2. Bir Business App oluşturun ve 'WhatsApp' ürününü ekleyin.\n3. Panelden 'Permanent Access Token' (Kalıcı Erişim Jetonu) ve 'Phone Number ID' (Telefon Numarası Kimliği) bilgilerini alarak buraya kaydedin.\n4. Webhook URL alanına '${WEBHOOK_WHATSAPP_URL}' yazın.\n5. Verify Token kutusuna belirlediğiniz Doğrulama Jetonunu girin.`;
      } else if (textLower.includes("telegram") || textLower.includes("tg")) {
        botResponse = "Telegram Bot entegrasyonu için:\n1. Telegram'da @BotFather hesabını aratın ve '/newbot' komutunu gönderin.\n2. Botunuza bir isim ve kullanıcı adı verin.\n3. BotFather'ın size vereceği HTTP API Token kodunu (örn. 123456:ABC...) kopyalayıp sol paneldeki 'Telegram Bot Jetonu' alanına yapıştırın.";
      } else if (textLower.includes("webhook") || textLower.includes("doğrulama") || textLower.includes("verify")) {
        botResponse = `Meta Webhook doğrulaması için:\n1. Meta panelinde Webhook URL olarak '${WEBHOOK_WHATSAPP_URL}' yazın.\n2. Verify Token (Doğrulama Jetonu) kutusuna '${channels.whatsapp_verify_token || "ai_pbx_whatsapp_verify_token_secure"}' girin.\n3. Meta panelinden 'Kaydet ve Doğrula' butonuna basın. Sistemimiz gelen doğrulamayı otomatik onaylayacaktır.`;
      }

      setChatMessages((prev) => [...prev, { sender: "bot", text: botResponse }]);
    }, 800);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className={"p-3 rounded-2xl border " + lightBg + " " + text + " " + borderLight}>
          <Smartphone size={24} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Sosyal Medya ve Kanal Entegrasyonları</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">WhatsApp, Telegram ve Meta kanallarından gelen mesajları yapay zekaya bağlayın.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Side: Setup Forms (3/5 Wide) */}
        <div className="flex flex-col lg:col-span-3 p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl gap-5 shadow-sm transition-colors duration-300">
          {/* Tab Headers */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 gap-4 text-xs font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setActiveTab("whatsapp")}
              className={`pb-2 transition ${activeTab === "whatsapp" ? text + " border-b-2 " + border : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}
            >
              WhatsApp API
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("telegram")}
              className={`pb-2 transition ${activeTab === "telegram" ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 dark:border-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}
            >
              Telegram Bot
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("meta")}
              className={`pb-2 transition ${activeTab === "meta" ? "text-pink-600 dark:text-pink-400 border-b-2 border-pink-500 dark:border-pink-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}
            >
              Instagram & FB
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("email")}
              className={`pb-2 transition ${activeTab === "email" ? "text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 dark:border-emerald-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}
            >
              E-Posta (SMTP/IMAP)
            </button>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {activeTab === "whatsapp" && (
              <div className="flex flex-col gap-4">
                <h4 className="font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">WhatsApp Business Cloud API Bağlantısı</h4>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    WhatsApp Erişim Jetonu (Permanent Access Token)
                  </label>
                  <textarea
                    name="whatsapp_token"
                    value={channels.whatsapp_token || ""}
                    onChange={handleChange}
                    placeholder="EAAGz..."
                    rows={3}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      Telefon Numarası Kimliği (Phone Number ID)
                    </label>
                    <input
                      type="text"
                      name="whatsapp_phone_number_id"
                      value={channels.whatsapp_phone_number_id || ""}
                      onChange={handleChange}
                      placeholder="Örn: 109283746592817"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      Webhook Doğrulama Jetonu (Verify Token)
                    </label>
                    <input
                      type="text"
                      name="whatsapp_verify_token"
                      value={channels.whatsapp_verify_token || ""}
                      onChange={handleChange}
                      placeholder="ai_pbx_whatsapp_verify_token_secure"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Gelişmiş AI Özellikleri: Persona, Karşılama ve Mesai Dışı */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1 flex flex-col gap-3.5">
                  <h4 className="font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles size={14} className={text} /> WhatsApp Yapay Zeka Davranış & Özelleştirme Ayarları
                  </h4>

                  {/* Persona Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      Yapay Zeka Temsilci Personası & Konuşma Üslubu
                    </label>
                    <select
                      name="whatsapp_persona"
                      value={channels.whatsapp_persona || "samimi"}
                      onChange={handleChange}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
                    >
                      <option value="samimi">😃 Samimi & Emoji Destekli (Varsayılan - Sıcakkanlı & Dostça)</option>
                      <option value="satis">🎯 Satış & Randevu Odaklı (İkna Edici & Teklif Odaklı)</option>
                      <option value="destek">🛠️ Çözüm & Teknik Destek Odaklı (Sakin & Adım Adım Rehber)</option>
                      <option value="kurumsal">💼 Resmi & Kurumsal (Ciddi, Saygılı - Siz/Efendim)</option>
                    </select>
                  </div>

                  {/* Interactive Welcome Menu Toggle */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">İnteraktif Karşılama Menüsü</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Yeni başlayan sohbetlerde [Fiyat ve Bilgi], [Randevu Al], [Canlı Temsilci] hızlı butonları sunulur.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        name="whatsapp_welcome_menu_enabled"
                        checked={channels.whatsapp_welcome_menu_enabled !== false}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className={"w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all " + (channels.whatsapp_welcome_menu_enabled !== false ? bg : "")} />
                    </label>
                  </div>

                  {/* After Hours Mode & Work Hours */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 rounded-xl flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Mesai Dışı Otomatik Bilgilendirme</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          Mesai saatleri dışında ve hafta sonlarında AI mesai dışı olunduğunu bildirerek talebi kaydeder.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          name="whatsapp_after_hours_enabled"
                          checked={channels.whatsapp_after_hours_enabled !== false}
                          onChange={handleChange}
                          className="sr-only peer"
                        />
                        <div className={"w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all " + (channels.whatsapp_after_hours_enabled !== false ? bg : "")} />
                      </label>
                    </div>

                    {channels.whatsapp_after_hours_enabled !== false && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/50 dark:border-slate-800/60">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Mesai Başlangıç Saati</label>
                          <input
                            type="text"
                            name="whatsapp_work_hours_start"
                            value={channels.whatsapp_work_hours_start || "09:00"}
                            onChange={handleChange}
                            placeholder="09:00"
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Mesai Bitiş Saati</label>
                          <input
                            type="text"
                            name="whatsapp_work_hours_end"
                            value={channels.whatsapp_work_hours_end || "18:00"}
                            onChange={handleChange}
                            placeholder="18:00"
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multi-WhatsApp Hatları & Numaraları */}
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                          <Layers size={14} className={text} /> Çoklu WhatsApp Hatları & Numaraları
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                          Birden fazla WhatsApp numaranız varsa her hat için özel isim, Phone Number ID ve Yapay Zeka Personası atayın.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddAccount}
                        title="Yeni WhatsApp Hattı Ekle"
                        className="bg-rose-600 hover:bg-rose-500 rounded-xl h-8 w-8 flex items-center justify-center shrink-0 text-white shadow-sm transition"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Account List */}
                    {(!channels.whatsapp_accounts || channels.whatsapp_accounts.length === 0) ? (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        Henüz özel bir WhatsApp hattı eklenmedi. Yukarıdaki varsayılan jetonlar kullanılır veya '+' butonuna basarak yeni hat ekleyebilirsiniz.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {channels.whatsapp_accounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className={"p-2 rounded-lg border " + lightBg + " " + text + " " + borderLight}>
                                <PhoneCall size={16} />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{acc.name}</span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                  <span>{acc.display_phone_number || "Numara Yok"}</span>
                                  <span>•</span>
                                  <span>ID: {acc.phone_number_id}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={"px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border " + lightBg + " " + text + " " + borderLight}>
                                {acc.persona === "satis" ? "🎯 Satış" : acc.persona === "destek" ? "🛠️ Destek" : acc.persona === "kurumsal" ? "💼 Kurumsal" : "😃 Samimi"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleEditAccount(acc)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                                title="Hattı Düzenle"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteAccountTarget(acc)}
                                className="p-1.5 text-rose-500 hover:text-rose-600 transition"
                                title="Hattı Sil"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                {/* Webhook Connection Details Card */}
                <div className={"p-3 rounded-xl border text-[11px] leading-relaxed flex flex-col gap-2 " + lightBg + " " + borderLight}>
                  <p className={"font-bold text-xs " + text}>Meta Developer Portal Webhook Yapılandırma Bilgileri:</p>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Callback URL:</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono bg-white dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 truncate">
                        {WEBHOOK_WHATSAPP_URL}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(WEBHOOK_WHATSAPP_URL, setCopiedUrl)}
                        className={"px-2.5 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 text-white shrink-0 transition " + bg + " " + hover}
                      >
                        {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
                        {copiedUrl ? "Kopyalandı" : "Kopyala"}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Verify Token:</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono bg-white dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300">
                        {channels.whatsapp_verify_token || "ai_pbx_whatsapp_verify_token_secure"}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(channels.whatsapp_verify_token || "ai_pbx_whatsapp_verify_token_secure", setCopiedToken)}
                        className={"px-2.5 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 text-white shrink-0 transition " + bg + " " + hover}
                      >
                        {copiedToken ? <Check size={12} /> : <Copy size={12} />}
                        {copiedToken ? "Kopyalandı" : "Kopyala"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "telegram" && (
              <div className="flex flex-col gap-3">
                <h4 className="font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">Telegram Bot API</h4>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Telegram Bot Token (HTTP API Token)</label>
                  <input
                    type="text"
                    name="telegram_token"
                    value={channels.telegram_token || ""}
                    onChange={handleChange}
                    placeholder="123456789:ABCdefGhI..."
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-xl text-[10px] text-slate-550 dark:text-slate-400 leading-relaxed font-medium">
                  <p className="font-bold text-blue-600 dark:text-blue-400 mb-1">Webhook URL Bilginiz:</p>
                  <p className="font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 select-all text-slate-700 dark:text-slate-300">
                    {API_BASE}/api/webhooks/telegram
                  </p>
                </div>
              </div>
            )}

            {activeTab === "meta" && (
              <div className="flex flex-col gap-3">
                <h4 className="font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">Instagram & Facebook Messenger</h4>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Instagram Sayfa Erişim Jetonu (Page Access Token)</label>
                  <input
                    type="text"
                    name="instagram_token"
                    value={channels.instagram_token || ""}
                    onChange={handleChange}
                    placeholder="EAAO..."
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Facebook Sayfa Erişim Jetonu</label>
                  <input
                    type="text"
                    name="facebook_token"
                    value={channels.facebook_token || ""}
                    onChange={handleChange}
                    placeholder="EAAO..."
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>
            )}

            {activeTab === "email" && (
              <div className="flex flex-col gap-3">
                <h4 className="font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">E-Posta Entegrasyonu (SMTP / IMAP)</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">SMTP Sunucu Adresi</label>
                    <input
                      type="text"
                      name="email_smtp_host"
                      value={channels.email_smtp_host || ""}
                      onChange={handleChange}
                      placeholder="smtp.gmail.com"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">SMTP Portu</label>
                    <input
                      type="text"
                      name="email_smtp_port"
                      value={channels.email_smtp_port || "587"}
                      onChange={handleChange}
                      placeholder="587 veya 465"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">E-Posta Adresi (Kullanıcı)</label>
                    <input
                      type="email"
                      name="email_smtp_user"
                      value={channels.email_smtp_user || ""}
                      onChange={handleChange}
                      placeholder="destek@company.com"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">E-Posta Şifresi / Uygulama Şifresi</label>
                    <input
                      type="password"
                      name="email_smtp_pass"
                      value={channels.email_smtp_pass || ""}
                      onChange={handleChange}
                      placeholder="••••••••••••"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">IMAP Sunucu Adresi (Gelen Kutusu)</label>
                    <input
                      type="text"
                      name="email_imap_host"
                      value={channels.email_imap_host || ""}
                      onChange={handleChange}
                      placeholder="imap.gmail.com"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">IMAP Portu</label>
                    <input
                      type="text"
                      name="email_imap_port"
                      value={channels.email_imap_port || "993"}
                      onChange={handleChange}
                      placeholder="993"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Ayarları kaydettikten sonra yapay zeka mesaj almaya ve göndermeye hazır olacaktır.</p>
              <button
                type="submit"
                disabled={loading}
                className={"flex items-center gap-2 px-5 py-2.5 text-white disabled:opacity-50 transition rounded-xl font-bold text-xs shadow-md " + bg + " " + hover}
              >
                <Save size={14} /> {loading ? "Kaydediliyor..." : "Bağlantıları Kaydet"}
              </button>
            </div>
          </form>

          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle size={15} />
              <span>Entegrasyon jetonları başarıyla kaydedildi!</span>
            </div>
          )}
        </div>

        {/* Right Side: Setup Copilot Chatbot (2/5 Wide) */}
        <div className="flex flex-col lg:col-span-2 p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl h-[520px] shadow-sm transition-colors duration-300">
          {/* Copilot Header */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-3">
            <div className={"p-1.5 border rounded-xl " + lightBg + " " + text + " " + borderLight}>
              <Sparkles size={16} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Entegrasyon Asistanı</h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Kurulum kılavuzu chat botu</p>
            </div>
          </div>

          {/* Copilot Chat Window */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs mb-3 scrollbar-thin">
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2 max-w-[85%] ${
                  msg.sender === "bot" ? "mr-auto flex-row" : "ml-auto flex-row-reverse"
                }`}
              >
                <div className={`h-6 w-6 rounded-xl flex items-center justify-center shrink-0 border ${
                  msg.sender === "bot" 
                    ? lightBg + " " + text + " " + borderLight 
                    : "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/40"
                }`}>
                  {msg.sender === "bot" ? <Bot size={12} /> : <User size={12} />}
                </div>
                <div className={`p-2.5 rounded-2xl border leading-relaxed whitespace-pre-line text-xs font-semibold shadow-sm ${
                  msg.sender === "bot" 
                    ? "bg-slate-50 dark:bg-slate-950/65 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none" 
                    : lightBg + " " + borderLight + " " + text + " rounded-tr-none"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Copilot Chat Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Jetonu nereden alacağım? Webhook..."
              className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-rose-500 text-slate-800 dark:text-slate-200 font-medium"
            />
            <button
              type="submit"
              className={"flex items-center justify-center p-2 text-white transition rounded-xl shrink-0 shadow-md " + bg + " " + hover}
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      </div>

      {/* Account Add/Edit Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <PhoneCall size={18} className={text} />
                {accountForm.id ? "WhatsApp Hattı Düzenle" : "Yeni WhatsApp Hattı Ekle"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Hat Tanımı / Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Satış & Danışma Hattı"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Görünecek Telefon Numarası</label>
                  <input
                    type="text"
                    placeholder="+90 850 360 7390"
                    value={accountForm.display_phone_number}
                    onChange={(e) => setAccountForm({ ...accountForm, display_phone_number: e.target.value })}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Phone Number ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="1391907340666153"
                    value={accountForm.phone_number_id}
                    onChange={(e) => setAccountForm({ ...accountForm, phone_number_id: e.target.value })}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Hatta Özel Erişim Jetonu (Opsiyonel)</label>
                <textarea
                  rows={2}
                  placeholder="Boş bırakılırsa genel WhatsApp jetonu kullanılır"
                  value={accountForm.access_token}
                  onChange={(e) => setAccountForm({ ...accountForm, access_token: e.target.value })}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:outline-none resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Bu Hatta Atanacak Yapay Zeka Personası</label>
                <select
                  value={accountForm.persona}
                  onChange={(e) => setAccountForm({ ...accountForm, persona: e.target.value })}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="samimi">😃 Samimi & Emoji Destekli (Varsayılan)</option>
                  <option value="satis">🎯 Satış & Randevu Odaklı</option>
                  <option value="destek">🛠️ Çözüm & Teknik Destek Odaklı</option>
                  <option value="kurumsal">💼 Resmi & Kurumsal</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className={"px-4 py-2 text-white rounded-xl text-xs font-bold shadow-md transition " + bg + " " + hover}
                >
                  Hattı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application-Native Custom Delete Confirmation Modal */}
      {deleteAccountTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 flex items-center justify-center animate-pulse">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">WhatsApp Hattını Sil</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                <strong className="text-slate-800 dark:text-slate-200">{deleteAccountTarget.name}</strong> hattını silmek istediğinize emin misiniz?
              </p>
            </div>

            <div className="flex items-center gap-3 w-full mt-2">
              <button
                type="button"
                onClick={() => setDeleteAccountTarget(null)}
                className="flex-1 py-2 px-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeleteAccountConfirm}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-md transition"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
