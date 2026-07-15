import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Bot, User, HelpCircle, Save, CheckCircle, Smartphone, SendToBack, Sparkles } from "lucide-react";

export default function ChannelSettings({ backendHost = "localhost:8000" }) {
  const [channels, setChannels] = useState({
    whatsapp_token: "",
    telegram_token: "",
    instagram_token: "",
    facebook_token: ""
  });
  
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("whatsapp"); // whatsapp, telegram, meta

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

  useEffect(() => {
    fetch(`${API_BASE}/api/settings/channels`)
      .then((res) => res.json())
      .then((data) => {
        if (data) setChannels(data);
      })
      .catch((err) => console.error("[Channels Settings] Ayarlar yuklenemedi:", err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setChannels((prev) => ({ ...prev, [name]: value }));
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

  // Setup Copilot Chatbot logic
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userText = userInput;
    setChatMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setUserInput("");

    // Simulate AI Connection helper response (decision tree or quick guide agent)
    setTimeout(() => {
      let botResponse = "Bu entegrasyon adımıyla ilgili size nasıl yardımcı olacağımı tam olarak anlayamadım. Lütfen WhatsApp, Telegram veya Meta Webhook konularında daha spesifik bir soru sorun.";

      const textLower = userText.toLowerCase();
      if (textLower.includes("whatsapp") || textLower.includes("wa")) {
        botResponse = "WhatsApp Business API entegrasyonu için:\n1. developers.facebook.com adresine gidin.\n2. Bir Business App oluşturun ve 'WhatsApp' ürününü ekleyin.\n3. Panelden geçici veya kalıcı erişim jetonunu (Token) alarak sol paneldeki 'WhatsApp Jetonu' alanına yapıştırın.\n4. Webhook URL kısmına bizim sunucumuzun `/api/webhook/whatsapp` adresini yazın.";
      } else if (textLower.includes("telegram") || textLower.includes("tg")) {
        botResponse = "Telegram Bot entegrasyonu için:\n1. Telegram'da @BotFather hesabını aratın ve '/newbot' komutunu gönderin.\n2. Botunuza bir isim ve kullanıcı adı verin.\n3. BotFather'ın size vereceği HTTP API Token kodunu (örn. 123456:ABC...) kopyalayıp sol paneldeki 'Telegram Bot Jetonu' alanına yapıştırın.";
      } else if (textLower.includes("webhook") || textLower.includes("doğrulama") || textLower.includes("verify")) {
        botResponse = "Meta Webhook doğrulaması için:\n1. Meta panelinde Webhook URL olarak `https://sizin-sunucu-adresiniz/api/webhook/whatsapp` yazın.\n2. Verify Token (Doğrulama Jetonu) kutusuna bizim sistemde belirlediğimiz gizli anahtarı girin (varsayılan: `ai_pbx_verify_secure_token_1`).\n3. Meta panelinden 'Kaydet ve Doğrula' butonuna basın. Sistemimiz gelen doğrulamayı otomatik onaylayacaktır.";
      }

      setChatMessages((prev) => [...prev, { sender: "bot", text: botResponse }]);
    }, 800);
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-50 dark:bg-primary/20 text-primary dark:text-purple-400 border border-purple-100 dark:border-purple-800 rounded-2xl">
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
              onClick={() => setActiveTab("whatsapp")}
              className={`pb-2 transition ${activeTab === "whatsapp" ? "text-primary dark:text-purple-400 border-b-2 border-purple-500 dark:border-purple-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}
            >
              WhatsApp API
            </button>
            <button
              onClick={() => setActiveTab("telegram")}
              className={`pb-2 transition ${activeTab === "telegram" ? "text-primary dark:text-blue-400 border-b-2 border-blue-500 dark:border-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}
            >
              Telegram Bot
            </button>
            <button
              onClick={() => setActiveTab("meta")}
              className={`pb-2 transition ${activeTab === "meta" ? "text-pink-600 dark:text-pink-400 border-b-2 border-pink-550 dark:border-pink-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}
            >
              Instagram & FB
            </button>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {activeTab === "whatsapp" && (
              <div className="flex flex-col gap-3">
                <h4 className="font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">WhatsApp Business Cloud API</h4>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">WhatsApp Erişim Jetonu (Access Token)</label>
                  <textarea
                    name="whatsapp_token"
                    value={channels.whatsapp_token}
                    onChange={handleChange}
                    placeholder="EAAGz..."
                    rows={4}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-xl text-[10px] text-slate-550 dark:text-slate-400 leading-relaxed font-medium">
                  <p className="font-bold text-primary dark:text-purple-400 mb-1">Webhook URL Bilginiz:</p>
                  <p className="font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-850 select-all text-slate-700 dark:text-slate-300">
                    {API_BASE}/api/webhook/whatsapp
                  </p>
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
                    value={channels.telegram_token}
                    onChange={handleChange}
                    placeholder="123456789:ABCdefGhI..."
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-xl text-[10px] text-slate-550 dark:text-slate-400 leading-relaxed font-medium">
                  <p className="font-bold text-primary dark:text-blue-400 mb-1">Webhook URL Bilginiz:</p>
                  <p className="font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-855 select-all text-slate-700 dark:text-slate-300">
                    {API_BASE}/api/webhook/telegram
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
                    value={channels.instagram_token}
                    onChange={handleChange}
                    placeholder="EAAO..."
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Facebook Sayfa Erişim Jetonu</label>
                  <input
                    type="text"
                    name="facebook_token"
                    value={channels.facebook_token}
                    onChange={handleChange}
                    placeholder="EAAO..."
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-850 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Ayarları kaydettikten sonra yapay zeka mesaj almaya hazır olacaktır.</p>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary text-white disabled:bg-purple-800 transition rounded-xl font-bold text-xs shadow-md shadow-purple-500/10"
              >
                <Save size={14} /> {loading ? "Kaydediliyor..." : "Bağlantıları Kaydet"}
              </button>
            </div>
          </form>

          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-305 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle size={15} />
              <span>Entegrasyon jetonları başarıyla kaydedildi!</span>
            </div>
          )}
        </div>

        {/* Right Side: Setup Copilot Chatbot (2/5 Wide) */}
        <div className="flex flex-col lg:col-span-2 p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl h-[500px] shadow-sm transition-colors duration-300">
          {/* Copilot Header */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-3">
            <div className="p-1.5 bg-purple-50 dark:bg-primary/15 text-primary dark:text-purple-400 border border-purple-100 dark:border-purple-800/40 rounded-xl">
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
                    ? "bg-purple-50 dark:bg-primary/20 text-primary dark:text-primary border-purple-100 dark:border-purple-800/45" 
                    : "bg-blue-50 dark:bg-primary/20 text-primary dark:text-blue-450 border-blue-100 dark:border-blue-800/45"
                }`}>
                  {msg.sender === "bot" ? <Bot size={12} /> : <User size={12} />}
                </div>
                <div className={`p-2.5 rounded-2xl border leading-relaxed whitespace-pre-line text-xs font-semibold shadow-sm ${
                  msg.sender === "bot" 
                    ? "bg-slate-50 dark:bg-slate-950/65 border-slate-200/60 dark:border-slate-850 text-slate-700 dark:text-slate-300 rounded-tl-none" 
                    : "bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30 text-purple-750 dark:text-purple-200 rounded-tr-none"
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
              className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-200 font-medium"
            />
            <button
              type="submit"
              className="flex items-center justify-center p-2 bg-primary hover:bg-primary text-white transition rounded-xl shrink-0 shadow-md shadow-purple-550/15"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
