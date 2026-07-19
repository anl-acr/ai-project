import React, { useState } from "react";
import { MessageSquare, Send, PhoneCall, ArrowRight } from "lucide-react";
import { useTheme } from "../../../utils/theme";

export default function AgentChatTab({ backendHost, currentUser }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();

  // Internal Chat States
  const [chatTab, setChatTab] = useState("internal"); // "customer" | "internal"
  
  const [chatSessions, setChatSessions] = useState([
    {
      id: "chat-1",
      customerName: "Ahmet Yılmaz",
      platform: "WhatsApp",
      unread: 1,
      messages: [
        { sender: "customer", text: "Merhaba, Asterisk WebRTC bağlantı ayarlarında bir sorun yaşıyorum. Yardımcı olabilir misiniz?", time: "23:42" },
        { sender: "ai", text: "Merhaba Ahmet Bey. WebRTC bağlantı sorununuzu çözmek için size birkaç adım önerebilirim. Hangi tarayıcıyı kullanıyorsunuz?", time: "23:42" },
        { sender: "customer", text: "Chrome kullanıyorum ama adımlarla uğraşmak istemiyorum, direkt bir müşteri temsilcisine bağlanabilir miyim?", time: "23:44" },
        { sender: "system", text: "Bu görüşme AI Asistan tarafından size devredilmiştir.", time: "23:44" }
      ]
    },
    {
      id: "chat-2",
      customerName: "Elif Kaya",
      platform: "Telegram",
      unread: 2,
      messages: [
        { sender: "customer", text: "Yarın saat 14:00 için randevu almıştım.", time: "23:38" },
        { sender: "ai", text: "Sistemde randevunuzu görüntülüyorum. İptal etmek veya değiştirmek mi istersiniz?", time: "23:38" },
        { sender: "customer", text: "Hayır asistan Eda üzerinden almıştım. Bunu teyit etmek istiyorum.", time: "23:40" },
        { sender: "system", text: "Bu görüşme AI Asistan tarafından size devredilmiştir.", time: "23:40" }
      ]
    }
  ]);

  const [internalChatSessions, setInternalChatSessions] = useState([
    {
      id: "internal-1",
      customerName: "Sistem Yöneticisi",
      platform: "İç Yazışma",
      unread: 0,
      online: true,
      messages: [
        { sender: "customer", text: "Merhaba, bugünkü yoğunluk hakkında bir rapor hazırlayabilir misiniz?", time: "09:30", status: "seen" },
        { sender: "agent", text: "Tabii ki, öğleden sonra iletiyorum.", time: "09:35", status: "seen" }
      ]
    }
  ]);

  const [systemUsers, setSystemUsers] = useState([
    { id: "u1", name: "Sistem Yöneticisi", role: "Yönetici", online: true },
    { id: "u2", name: "Ayşe Yılmaz", role: "Takım Lideri", online: true },
    { id: "u3", name: "Mehmet Demir", role: "Temsilci", online: false },
    { id: "u4", name: "Canan Şahin", role: "Teknik Destek", online: true }
  ]);
  
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatId) return;

    const timeString = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const newMsg = { sender: "agent", text: chatInput.trim(), time: timeString, status: "sent" };

    if (chatTab === "customer") {
      setChatSessions(prev =>
        prev.map(chat => {
          if (chat.id === activeChatId) {
            return { ...chat, messages: [...chat.messages, newMsg] };
          }
          return chat;
        })
      );
      setChatInput("");

      setTimeout(() => {
        const autoReply = { sender: "customer", text: "Teşekkürler, dönüşünüzü bekliyorum.", time: timeString };
        setChatSessions(prev =>
          prev.map(chat => {
            if (chat.id === activeChatId) {
              return { ...chat, messages: [...chat.messages, autoReply] };
            }
            return chat;
          })
        );
      }, 3000);
    } else {
      setInternalChatSessions(prev =>
        prev.map(chat => {
          if (chat.id === activeChatId) {
            return { ...chat, messages: [...chat.messages, newMsg] };
          }
          return chat;
        })
      );
      setChatInput("");

      // Simulate seen status
      setTimeout(() => {
        setInternalChatSessions(prev =>
          prev.map(chat => {
            if (chat.id === activeChatId) {
              const updatedMessages = chat.messages.map(m => m.sender === "agent" ? { ...m, status: "seen" } : m);
              return { ...chat, messages: updatedMessages };
            }
            return chat;
          })
        );
      }, 1500);

      // Simulate reply
      setTimeout(() => {
        const replyTime = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        const autoReply = { sender: "customer", text: "Anlaşıldı, ilgileniyorum.", time: replyTime, status: "seen" };
        setInternalChatSessions(prev =>
          prev.map(chat => {
            if (chat.id === activeChatId) {
              return { ...chat, messages: [...chat.messages, autoReply] };
            }
            return chat;
          })
        );
      }, 4000);
    }
  };

  const handleStartInternalChat = (user) => {
    const existingChat = internalChatSessions.find(c => c.customerName === user.name);
    if (existingChat) {
      setActiveChatId(existingChat.id);
    } else {
      const newChatId = `internal-${Date.now()}`;
      setInternalChatSessions(prev => [
        {
          id: newChatId,
          customerName: user.name,
          platform: "İç Yazışma",
          unread: 0,
          online: user.online,
          messages: []
        },
        ...prev
      ]);
      setActiveChatId(newChatId);
    }
    setIsNewChatModalOpen(false);
  };

  const selectedChat = chatTab === "customer" 
    ? chatSessions.find(c => c.id === activeChatId)
    : internalChatSessions.find(c => c.id === activeChatId);

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col items-center">
      <div className="max-w-6xl w-full h-full flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Takım İçi Sohbet ve Bana Atananlar</h2>
        </div>
        
        <div className={`flex-1 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex overflow-hidden`}>
          
          {/* Left Sidebar - Chat List */}
          <div className={`w-80 shrink-0 border-r ${borderLight} flex flex-col bg-slate-50/30 dark:bg-slate-900/20`}>
            {/* Tabs */}
            <div className={`p-4 border-b ${borderLight}`}>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => { setChatTab("customer"); setIsNewChatModalOpen(false); setActiveChatId(null); }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                    chatTab === "customer" 
                      ? `${bg} text-white shadow-sm` 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Bana Atananlar
                </button>
                <button
                  onClick={() => { setChatTab("internal"); setIsNewChatModalOpen(false); setActiveChatId(null); }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                    chatTab === "internal" 
                      ? `${bg} text-white shadow-sm` 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  İç Yazışma
                </button>
              </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {!isNewChatModalOpen ? (
                <div className="space-y-2">
                  {(chatTab === "customer" ? chatSessions : internalChatSessions).map((session) => (
                    <button
                      key={session.id}
                      onClick={() => {
                        setActiveChatId(session.id);
                        if (chatTab === "customer") {
                          setChatSessions(prev => prev.map(c => c.id === session.id ? { ...c, unread: 0 } : c));
                        } else {
                          setInternalChatSessions(prev => prev.map(c => c.id === session.id ? { ...c, unread: 0 } : c));
                        }
                      }}
                      className={`w-full p-3 hover:bg-white dark:hover:bg-slate-800 border rounded-xl flex items-center justify-between gap-3 transition-colors text-left ${
                        activeChatId === session.id 
                          ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" 
                          : "bg-transparent border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 relative ${
                           activeChatId === session.id ? "bg-primary text-white" : "bg-primary/10 text-primary dark:bg-primary/20"
                        }`}>
                          {session.customerName.charAt(0)}
                          {chatTab === "internal" && (
                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${session.online ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                          )}
                        </div>
                        <div className="truncate">
                          <p className={`text-sm font-bold flex items-center gap-2 ${activeChatId === session.id ? "text-primary" : "text-slate-800 dark:text-white"}`}>
                            {session.customerName}
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                              chatTab === "customer" 
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-200/30"
                                : "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200/30"
                            }`}>
                              {session.platform}
                            </span>
                          </p>
                          <p className="text-xs text-slate-450 dark:text-slate-500 truncate mt-1 font-medium">
                            {session.messages.length > 0 ? session.messages[session.messages.length - 1].text : "Mesaj yok..."}
                          </p>
                        </div>
                      </div>
                      {session.unread > 0 && (
                        <span className="h-5 w-5 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm">
                          {session.unread}
                        </span>
                      )}
                    </button>
                  ))}
                  
                  {chatTab === "internal" && (
                    <button 
                      onClick={() => setIsNewChatModalOpen(true)}
                      className={`w-full mt-4 p-3 border-2 border-dashed ${borderLight} rounded-xl text-sm font-bold text-slate-500 hover:text-primary hover:border-primary/50 transition-all flex items-center justify-center gap-2`}
                    >
                      <span className="text-xl leading-none">+</span> Yeni İç Yazışma
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col h-full space-y-2">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-2">
                    <button
                      onClick={() => setIsNewChatModalOpen(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1"
                    >
                      ← Geri
                    </button>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Kişi Seç</span>
                  </div>
                  {systemUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleStartInternalChat(user)}
                      className="w-full p-3 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-xl flex items-center gap-3 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm shrink-0 relative">
                        {user.name.charAt(0)}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${user.online ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{user.name}</p>
                        <p className="text-xs text-slate-450 dark:text-slate-500">{user.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Area - Chat Detail */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900/50">
            {activeChatId && selectedChat ? (
              <>
                {/* Chat Header */}
                <div className={`h-16 shrink-0 border-b ${borderLight} px-6 flex items-center justify-between bg-white dark:bg-slate-900`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-bold text-lg relative">
                      {selectedChat.customerName.charAt(0)}
                      {chatTab === "internal" && (
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${selectedChat.online ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">{selectedChat.customerName}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {chatTab === "internal" ? (selectedChat.online ? 'Çevrimiçi' : 'Çevrimdışı') : selectedChat.platform}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
                  {selectedChat.messages.map((m, idx) => {
                    const isSystem = m.sender === "system";
                    const isAI = m.sender === "ai";

                    if (isSystem) {
                      return (
                        <div key={idx} className="flex justify-center my-6">
                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border border-amber-200 dark:border-amber-800/50 flex items-center gap-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                            {m.text}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col max-w-[70%] ${
                          m.sender === "agent" ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        {isAI && (
                          <span className="text-[10px] font-bold text-indigo-500 mb-1.5 ml-1 flex items-center gap-1.5 uppercase tracking-wider">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/><path d="M12 8V4H8"/></svg>
                            AI Asistan
                          </span>
                        )}
                        <div
                          className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            m.sender === "agent"
                              ? `${bg} text-white rounded-tr-none`
                              : isAI
                                ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 text-slate-800 dark:text-slate-200 rounded-tl-none"
                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none"
                          }`}
                        >
                          {m.text}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 px-1">
                          <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 tracking-wider">
                            {m.time}
                          </span>
                          {m.sender === "agent" && chatTab === "internal" && (
                            <span className={`text-[10px] font-bold ${m.status === 'seen' ? 'text-blue-500' : 'text-slate-400'}`}>
                              {m.status === 'seen' ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input Area */}
                <div className={`p-4 bg-white dark:bg-slate-900 border-t ${borderLight} shrink-0`}>
                  <form onSubmit={handleSendChatMessage} className="flex items-center gap-3">
                    <button type="button" className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-800 rounded-xl" title="Dosya Ekle">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </button>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Mesajınızı yazın..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="w-full text-sm px-4 py-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary/50"
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Emoji">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className={`p-3 ${bg} hover:opacity-90 text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 transition-opacity shadow-sm`}
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <MessageSquare size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium text-slate-500">Görüntülemek için bir sohbet seçin</p>
                <p className="text-sm mt-2">Sol menüden bir konuşmaya tıklayın veya yeni sohbet başlatın.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
