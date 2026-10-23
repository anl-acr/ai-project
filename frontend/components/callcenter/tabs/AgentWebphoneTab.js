import React, { useState, useEffect, useRef } from "react";
import TranscriptPanel from "../../dashboard/TranscriptPanel";
import AgentSessionCard from "../../phone/AgentSessionCard";
import {
  Phone,
  PhoneOff,
  PhonePlus,
  Mic,
  MicOff,
  Pause,
  Play,
  UserPlus,
  UserCheck,
  X,
  ArrowRight,
  ArrowLeftRight,
  Radio,
  GitMerge,
  PhoneForwarded,
  Users
} from "lucide-react";
import { useTheme } from "../../../utils/theme";
import { findContactByPhone, maskPhoneLast4 } from "../../../utils/contactUtils";
import { webphoneManager } from "../../../utils/webphoneManager";

export default function AgentWebphoneTab({
  backendHost,
  currentUser,
  activeCallId,
  pendingDial,
  setPendingDial,
  isWebphoneScreenActive = true,
  callPanelPerms = {}
}) {
  const { bg, text, lightBg, borderLight } = useTheme();
  const [wpState, setWpState] = useState(() => webphoneManager.getState());

  const canSaveContact = callPanelPerms.canSaveContact !== false;
  const canTransfer = callPanelPerms.canTransfer !== false;
  const canConference = callPanelPerms.canConference !== false;
  const canRejectCall = callPanelPerms.canRejectCall !== false;
  const maskPhoneNumbers = Boolean(callPanelPerms.maskPhoneNumbers);

  // In-Call Transfer & Conference Popovers
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [conferenceOpen, setConferenceOpen] = useState(false);
  const [conferenceTarget, setConferenceTarget] = useState("");
  const [newCallInput, setNewCallInput] = useState("");
  const [isNewCallOpen, setIsNewCallOpen] = useState(false);

  // Contacts & Add Contact Modal State
  const [contacts, setContacts] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: "", lastName: "", email: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState("");

  const inputRef = useRef(null);

  useEffect(() => {
    const unsub = webphoneManager.subscribe((state) => {
      setWpState({ ...state });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (backendHost || currentUser) {
      webphoneManager.init({ backendHost, currentUser });
    }
  }, [backendHost, currentUser]);

  useEffect(() => {
    webphoneManager.setWebphoneScreenActive(Boolean(isWebphoneScreenActive));
    return () => {
      webphoneManager.setWebphoneScreenActive(false);
    };
  }, [isWebphoneScreenActive]);

  // Fetch system contacts & directory
  const fetchContactsAndDirectory = async () => {
    try {
      const protocol = window.location.protocol;
      const [contactsRes, dirRes] = await Promise.all([
        fetch(`${protocol}//${backendHost}/api/contacts`),
        fetch(`${protocol}//${backendHost}/api/agent/directory`)
      ]);
      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        setContacts(Array.isArray(cData) ? cData : []);
      }
      if (dirRes.ok) {
        const dData = await dirRes.json();
        setDirectory(Array.isArray(dData) ? dData : []);
      }
    } catch (err) {
      console.error("Rehber verileri alınamadı:", err);
    }
  };

  useEffect(() => {
    fetchContactsAndDirectory();
    const handleContactsUpdated = () => fetchContactsAndDirectory();
    window.addEventListener("CONTACTS_UPDATED", handleContactsUpdated);
    return () => window.removeEventListener("CONTACTS_UPDATED", handleContactsUpdated);
  }, [backendHost]);

  const {
    dialNumber,
    remoteNumber,
    remoteDisplayName,
    callStatus,
    registered: isRegistered,
    callDuration,
    isMuted,
    isOnHold,
    callNotification,
    lines = [],
    activeLineId,
    isConferenceActive,
    attendedTransferPending
  } = wpState;

  useEffect(() => {
    if (callStatus === "Idle" && lines.length === 0) {
      setTransferOpen(false);
      setConferenceOpen(false);
      setIsNewCallOpen(false);
      setTransferTarget("");
      setConferenceTarget("");
      setNewCallInput("");
    }
  }, [callStatus, lines.length]);

  const setDialNumber = (val) => {
    if (typeof val === "function") {
      const next = val(webphoneManager.getState().dialNumber);
      webphoneManager.setDialNumber(next);
    } else {
      webphoneManager.setDialNumber(val);
    }
  };

  const setCallNotification = (notif) => {
    webphoneManager.setCallNotification(notif);
  };

  const formatDuration = (secs) => {
    const m = Math.floor((secs || 0) / 60).toString().padStart(2, "0");
    const s = ((secs || 0) % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleDial = (num) => {
    webphoneManager.setDialNumber((webphoneManager.getState().dialNumber || "") + String(num));
  };

  const handleAnswerCall = (lineId = null) => {
    webphoneManager.answerCall(lineId);
  };

  const handleCall = (targetNum = dialNumber) => {
    const clean = String(targetNum || "").trim();
    if (!clean) return;
    const match = findContactByPhone(clean, contacts, directory);
    webphoneManager.makeCall(clean, { displayName: match?.displayName || "" });
  };

  const handleHangup = (lineId = null) => {
    webphoneManager.hangupCall(lineId);
    if (lines.length <= 1) {
      webphoneManager.setDialNumber("");
    }
  };

  const toggleMute = () => {
    webphoneManager.toggleMute();
  };

  const toggleHold = () => {
    webphoneManager.toggleHold();
  };

  const handleSaveContact = async () => {
    if (!newContact.firstName.trim() || !newContact.lastName.trim()) {
      setContactError("Lütfen Ad ve Soyad alanlarını doldurun.");
      return;
    }
    setSavingContact(true);
    setContactError("");
    const phoneToSave = (remoteNumber || dialNumber || "").trim();
    try {
      const protocol = window.location.protocol;
      const res = await fetch(`${protocol}//${backendHost}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: newContact.firstName.trim(),
          last_name: newContact.lastName.trim(),
          phone_number: phoneToSave,
          email: newContact.email.trim() || null
        })
      });
      if (res.ok) {
        await fetchContactsAndDirectory();
        window.dispatchEvent(new CustomEvent("CONTACTS_UPDATED"));
        setIsAddContactOpen(false);
      } else {
        const errData = await res.json();
        setContactError(errData.detail || "Kayıt eklenirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("Contact save error:", err);
      setContactError("Bağlantı hatası oluştu.");
    } finally {
      setSavingContact(false);
    }
  };

  // Support dialing from Rehber / Hızlı Arama even while already in a call (automatically opens 2nd line)
  useEffect(() => {
    if (pendingDial) {
      const numToDial = String(pendingDial);
      webphoneManager.setDialNumber(numToDial);
      if (isRegistered) {
        setPendingDial(null);
        const match = findContactByPhone(numToDial, contacts, directory);
        setTimeout(() => webphoneManager.makeCall(numToDial, { displayName: match?.displayName || "" }), 80);
      }
    }
  }, [pendingDial, isRegistered]);

  const activePhoneNum = callStatus !== "Idle" ? (remoteNumber || dialNumber) : dialNumber;
  const matchedContact = findContactByPhone(activePhoneNum, contacts, directory);
  const resolvedDisplayName =
    matchedContact?.displayName || (remoteDisplayName && remoteDisplayName !== activePhoneNum ? remoteDisplayName : "");
  const resolvedIsInternal = Boolean(
    matchedContact?.isInternal || (activePhoneNum && String(activePhoneNum).length <= 5 && resolvedDisplayName)
  );
  const displayPhoneNum =
    callStatus !== "Idle" && maskPhoneNumbers ? maskPhoneLast4(activePhoneNum, true) : activePhoneNum;

  const inCallLinesCount = lines.filter((l) => l.callStatus === "InCall").length;
  const hasMultipleLines = lines.length >= 2;

  const resolveLineLabel = (line) => {
    const m = findContactByPhone(line.remoteNumber, contacts, directory);
    const name = m?.displayName || line.remoteDisplayName || "";
    const num = maskPhoneNumbers ? maskPhoneLast4(line.remoteNumber, true) : line.remoteNumber;
    return { name, num };
  };

  return (
    <div className="w-full h-full p-4 lg:p-6 overflow-hidden flex flex-col relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        {/* Left Column: Phone Controls & Session */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 h-full overflow-y-auto hide-scrollbar pb-6">
          <div className="w-full shrink-0 animate-in fade-in slide-in-from-left-4 duration-500">
            <AgentSessionCard backendHost={backendHost} currentUser={currentUser} />
          </div>

          {/* Enhanced Dialpad (Always active so user can dial a new line anytime) */}
          <div className={`p-6 bg-white dark:bg-slate-900 border ${borderLight} rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 flex flex-col items-center shrink-0 animate-in fade-in slide-in-from-left-4 duration-700`}>
            {callNotification && (
              <div
                className={`w-full mb-4 p-3 rounded-2xl border text-xs font-semibold flex items-start justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
                  callNotification.type === "info"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400"
                }`}
              >
                <span>{callNotification.message}</span>
                <button
                  type="button"
                  onClick={() => setCallNotification(null)}
                  className="opacity-70 hover:opacity-100 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Status Display */}
            <div className="text-center mb-6 w-full">
              <p className={`text-[10px] font-extrabold uppercase tracking-widest ${callStatus !== "Idle" ? "text-emerald-500" : "text-slate-400 dark:text-slate-500"}`}>
                {isConferenceActive
                  ? `Konferans Aktif (${lines.length} Hat)`
                  : callStatus === "InCall"
                  ? lines.length > 1
                    ? `Görüşme Aktif (${lines.length} Hat Açık)`
                    : "Görüşme Aktif"
                  : callStatus === "Calling"
                  ? "Aranıyor..."
                  : callStatus === "Ringing"
                  ? "Gelen Çağrı..."
                  : "Hat Müsait"}
              </p>
              <div className="mt-1 flex flex-col items-center justify-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value.replace(/[^0-9*#+]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && dialNumber && handleCall(dialNumber)}
                  placeholder={callStatus !== "Idle" ? "Yeni Hat İçin Numara..." : "Numara Girin..."}
                  className="w-full text-center text-2xl font-mono font-bold tracking-widest text-slate-800 dark:text-white bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-700 h-10"
                  autoFocus
                />
                {resolvedDisplayName && callStatus !== "Idle" && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center justify-center gap-1.5 animate-in fade-in">
                    <UserCheck size={14} />
                    {resolvedDisplayName}
                  </p>
                )}
              </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-5 w-full px-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    handleDial(num);
                    inputRef.current?.focus();
                  }}
                  className={`w-14 h-14 mx-auto rounded-full bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm border ${borderLight} hover:shadow-md`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4 mt-8 w-full">
              <button
                onClick={() => (callStatus === "Ringing" ? handleAnswerCall() : handleCall(dialNumber))}
                disabled={!dialNumber && callStatus !== "Ringing"}
                title={
                  callStatus === "Ringing"
                    ? "Gelen Çağrıyı Yanıtla"
                    : callStatus !== "Idle"
                    ? "Mevcut Çağrıyı Beklemeye Alıp Yeni Hat Ara"
                    : "Çağrı Başlat"
                }
                className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <Phone size={24} className="fill-current" />
              </button>

              {callStatus !== "Idle" && (callStatus !== "Ringing" || canRejectCall) && (
                <button
                  onClick={() => handleHangup()}
                  title="Seçili Hattı Sonlandır"
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-105 active:scale-95 animate-in zoom-in"
                >
                  <PhoneOff size={22} className="fill-current" />
                </button>
              )}
            </div>
            {callStatus !== "Idle" && (
              <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 text-center">
                Görüşme esnasında numara tuşlayıp <strong className="text-emerald-600 dark:text-emerald-400">Yeşil Arama</strong> tuşuna basarak 2. hattı arayabilirsiniz.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Active Multi-Line Call Panel & Transcripts */}
        <div className="lg:col-span-8 xl:col-span-9 h-full flex flex-col gap-3 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-700 delay-100">
          {/* Group Ringing Visual Alert Banner (No Ringtone Sound) */}
          {Array.isArray(wpState.groupRingingCalls) && wpState.groupRingingCalls.length > 0 && (
            <div className="shrink-0 space-y-2">
              {wpState.groupRingingCalls.map((rc) => {
                const rcCallerMasked = maskPhoneLast4(rc.caller_number || "Bilinmeyen", maskPhoneNumbers);
                const rcCallerDisplay = rc.caller_name
                  ? `${rc.caller_name} (${rcCallerMasked})`
                  : rcCallerMasked || "Bilinmeyen Numara";
                return (
                  <div
                    key={`${rc.ringing_extension}_${rc.caller_number}`}
                    className="p-4 rounded-2xl border-2 border-amber-400 dark:border-amber-500/80 bg-amber-50/90 dark:bg-amber-950/40 shadow-md flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-200"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="h-11 w-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
                        <PhoneIncoming size={20} className="animate-bounce" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500 text-white">
                            Grubunda Çağrı Var
                          </span>
                          {rc.group_name && (
                            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                              • {rc.group_name}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="text-slate-700 dark:text-slate-200">
                            <strong className="text-slate-500 dark:text-slate-400">Çalan Dahili:</strong>{" "}
                            <span className="font-extrabold text-slate-900 dark:text-white">
                              {rc.ringing_extension} {rc.ringing_name ? `(${rc.ringing_name})` : ""}
                            </span>
                          </span>
                          <span className="text-slate-700 dark:text-slate-200">
                            <strong className="text-slate-500 dark:text-slate-400">Arayan:</strong>{" "}
                            <span className="font-extrabold font-mono text-amber-700 dark:text-amber-300">
                              {rcCallerDisplay}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => webphoneManager.pickupGroupCall(rc)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs tracking-wide shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all shrink-0"
                    >
                      <Phone size={15} />
                      Aç / Çağrıyı Çek ({rc.ringing_extension})
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {callStatus !== "Idle" ? (
            <div className="flex flex-col h-full gap-4 overflow-y-auto">
              {/* Multi-Line Switcher & Action Bar */}
              <div className={`p-3.5 bg-white dark:bg-slate-900 border ${borderLight} rounded-2xl shadow-sm flex flex-col gap-3 shrink-0`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Aktif Hatlar ({lines.length})
                    </span>
                    {isConferenceActive && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                        <Radio size={12} className="animate-pulse" />
                        Konferans Birleştirildi
                      </span>
                    )}
                    {attendedTransferPending && hasMultipleLines && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 border border-violet-300 dark:border-violet-500/30">
                        <PhoneForwarded size={12} />
                        Kontrollü Transfer Danışma Hattı
                      </span>
                    )}
                  </div>

                  {/* Quick Multi-Line Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {hasMultipleLines && (
                      <button
                        type="button"
                        onClick={() => webphoneManager.swapLines()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all"
                        title="Çağrılar Arasında Geçiş Yap (Beklet / Devam Et)"
                      >
                        <ArrowLeftRight size={14} />
                        Hat Değiştir (Swap)
                      </button>
                    )}

                    {hasMultipleLines && canTransfer && (
                      <button
                        type="button"
                        onClick={() => webphoneManager.completeAttendedTransfer()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-all"
                        title="İki hattı birbirine bağla ve görüşmeden çık (Kontrollü Transferi Tamamla)"
                      >
                        <PhoneForwarded size={14} />
                        Kontrollü Transferi Tamamla (Aktar)
                      </button>
                    )}

                    {inCallLinesCount >= 2 && canConference && (
                      <button
                        type="button"
                        onClick={() =>
                          isConferenceActive ? webphoneManager.stopConference() : webphoneManager.startConference()
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${
                          isConferenceActive
                            ? "bg-amber-600 hover:bg-amber-500"
                            : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                        title={
                          isConferenceActive
                            ? "Konferansı ayır ve tekli hatta dön"
                            : "Tüm hatları konferansta birleştir (3'lü Görüşme)"
                        }
                      >
                        <GitMerge size={14} />
                        {isConferenceActive ? "Konferansı Ayır" : "Konferansta Birleştir"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsNewCallOpen((p) => !p)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        isNewCallOpen
                          ? `${bg} text-white border-transparent`
                          : `${lightBg} ${text} ${borderLight} hover:opacity-90`
                      }`}
                      title="Mevcut çağrıyı beklemeye alarak yeni bir numara/dahili ara"
                    >
                      <PhonePlus size={14} />
                      + Yeni Çağrı Ekle
                    </button>
                  </div>
                </div>

                {/* Inline New Call Bar */}
                {isNewCallOpen && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={newCallInput}
                      onChange={(e) => setNewCallInput(e.target.value.replace(/[^0-9*#+]/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCallInput.trim()) {
                          handleCall(newCallInput.trim());
                          setNewCallInput("");
                          setIsNewCallOpen(false);
                        }
                      }}
                      placeholder="Yeni hat için dahili veya telefon numarası girin (Örn: 1002)..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCallInput.trim()) return;
                        handleCall(newCallInput.trim());
                        setNewCallInput("");
                        setIsNewCallOpen(false);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Phone size={13} />
                      Yeni Hat Ara
                    </button>
                    {canTransfer && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCallInput.trim()) return;
                          const m = findContactByPhone(newCallInput.trim(), contacts, directory);
                          webphoneManager.startAttendedTransfer(newCallInput.trim(), m?.displayName || "");
                          setNewCallInput("");
                          setIsNewCallOpen(false);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                        title="Mevcut arayanı beklemeye al ve kontrollü transfer için bu numarayı ara"
                      >
                        <PhoneForwarded size={13} />
                        Kontrollü Transfer İçin Ara
                      </button>
                    )}
                    {canConference && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCallInput.trim()) return;
                          const m = findContactByPhone(newCallInput.trim(), contacts, directory);
                          webphoneManager.addParticipantToConference(newCallInput.trim(), m?.displayName || "");
                          setNewCallInput("");
                          setIsNewCallOpen(false);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                        title="Bu numarayı ara ve açıldığında otomatik konferansa birleştir"
                      >
                        <Users size={13} />
                        Konferans İçin Ara
                      </button>
                    )}
                  </div>
                )}

                {/* Line Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {lines.map((line) => {
                    const isSelected = line.id === activeLineId;
                    const { name, num } = resolveLineLabel(line);
                    const statusBadge = isConferenceActive
                      ? { label: "Konferansta", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" }
                      : line.callStatus === "Ringing"
                      ? { label: "Gelen Çağrı", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 animate-pulse" }
                      : line.callStatus === "Calling"
                      ? { label: "Aranıyor...", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 animate-pulse" }
                      : line.isOnHold
                      ? { label: "Beklemede", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" }
                      : { label: "Aktif", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" };

                    return (
                      <div
                        key={line.id}
                        onClick={() => webphoneManager.switchLine(line.id)}
                        className={`cursor-pointer p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                              Hat {line.lineNumber}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge.cls}`}>
                              {statusBadge.label}
                            </span>
                            {line.callStatus === "InCall" && (
                              <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                {formatDuration(line.callDuration)}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 truncate font-bold text-sm text-slate-800 dark:text-white">
                            {name ? `${name} (${num})` : num}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {line.callStatus === "Ringing" ? (
                            <button
                              type="button"
                              onClick={() => handleAnswerCall(line.id)}
                              className="h-8 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                              title="Bu Hattı Yanıtla"
                            >
                              <Phone size={13} />
                              Yanıtla
                            </button>
                          ) : !isSelected || line.isOnHold ? (
                            <button
                              type="button"
                              onClick={() => webphoneManager.switchLine(line.id)}
                              className="h-8 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 text-xs font-bold flex items-center gap-1"
                              title="Bu Hatta Geç"
                            >
                              <Play size={12} />
                              Geç
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleHangup(line.id)}
                            className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500 dark:hover:text-white flex items-center justify-center transition-colors"
                            title="Bu Hattı Kapat"
                          >
                            <PhoneOff size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sleek Active Call Panel */}
              <div className="p-6 bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl dark:shadow-2xl flex flex-col items-center justify-center relative overflow-hidden shrink-0 min-h-[250px]">
                {/* Pulsing Background when active */}
                <div className={`absolute inset-0 bg-emerald-500/10 ${callStatus === "InCall" ? "animate-pulse" : "animate-none"}`}></div>

                <div className="relative z-10 flex flex-col items-center w-full">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-md dark:shadow-xl transition-all duration-500 ${
                      callStatus === "InCall"
                        ? "bg-emerald-100 border-2 border-emerald-400 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-amber-100 border-2 border-amber-400 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400"
                    }`}
                  >
                    {isConferenceActive ? (
                      <Users size={28} />
                    ) : isOnHold ? (
                      <Pause size={28} />
                    ) : (
                      <Phone size={28} className={callStatus === "Calling" || callStatus === "Ringing" ? "animate-bounce" : ""} />
                    )}
                  </div>

                  {isConferenceActive ? (
                    <div className="flex flex-col items-center text-center">
                      <div className="flex items-center gap-1.5 mb-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-extrabold tracking-wide shadow-sm">
                        <Radio size={14} className="animate-pulse" />
                        <span>Çoklu Konferans Görüşmesi ({lines.length} Katılımcı)</span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide mb-2">
                        {lines
                          .map((l) => {
                            const lbl = resolveLineLabel(l);
                            return lbl.name || lbl.num;
                          })
                          .join(" & ")}
                      </h2>
                    </div>
                  ) : resolvedDisplayName ? (
                    <div className="flex flex-col items-center text-center">
                      <div className="flex items-center gap-1.5 mb-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-extrabold tracking-wide shadow-sm">
                        <UserCheck size={14} />
                        <span>{resolvedIsInternal ? "Dahili Abone" : "Rehberde Kayıtlı"}</span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide mb-1">
                        {resolvedDisplayName}
                      </h2>
                      <p className="text-lg font-mono font-semibold text-slate-500 dark:text-slate-400 tracking-widest mb-2">
                        {displayPhoneNum}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      {maskPhoneNumbers && (
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                          Kayıtsız Numara
                        </span>
                      )}
                      <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white tracking-widest mb-2 font-mono drop-shadow-sm dark:drop-shadow-lg">
                        {displayPhoneNum}
                      </h2>
                      {canSaveContact && (
                        <button
                          onClick={() => {
                            setNewContact({ firstName: "", lastName: "", email: "" });
                            setContactError("");
                            setIsAddContactOpen(true);
                          }}
                          title="Kişiyi Rehbere Kaydet"
                          className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all shrink-0 cursor-pointer"
                        >
                          <UserPlus size={15} />
                          Rehbere Kaydet
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-1">
                    <span className="relative flex h-3 w-3">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          callStatus === "InCall" ? "bg-emerald-500 dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"
                        }`}
                      ></span>
                      <span
                        className={`relative inline-flex rounded-full h-3 w-3 ${
                          callStatus === "InCall" ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      ></span>
                    </span>
                    <p
                      className={`font-semibold tracking-widest uppercase text-xs ${
                        callStatus === "InCall" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {callStatus === "InCall"
                        ? isOnHold
                          ? "Hat Beklemede"
                          : `Görüşme Aktif - ${formatDuration(callDuration)}`
                        : callStatus === "Ringing"
                        ? "Gelen Çağrı..."
                        : "Aranıyor..."}
                    </p>
                  </div>

                  {/* Call Controls */}
                  <div className="flex flex-wrap items-center justify-center gap-4 mt-6 relative">
                    {callStatus === "Ringing" ? (
                      <>
                        <button
                          onClick={() => handleAnswerCall()}
                          className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all hover:scale-110 group"
                          title="Yanıtla"
                        >
                          <Phone size={24} className="fill-current group-hover:scale-110 transition-transform" />
                        </button>
                        {canRejectCall && (
                          <button
                            onClick={() => handleHangup()}
                            className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-110 group"
                            title="Reddet"
                          >
                            <PhoneOff size={24} className="group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={toggleMute}
                          title={isMuted ? "Sesi Aç" : "Sessize Al"}
                          className={`w-13 h-13 p-3.5 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${
                            isMuted
                              ? "bg-rose-100 border-rose-300 text-rose-500 dark:bg-rose-500/20 dark:border-rose-500/50 dark:text-rose-400"
                              : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                          }`}
                        >
                          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                        <button
                          onClick={toggleHold}
                          title={isOnHold ? "Beklemeden Al (Devam Et)" : "Hattı Beklemeye Al"}
                          className={`w-13 h-13 p-3.5 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${
                            isOnHold
                              ? "bg-amber-100 border-amber-300 text-amber-600 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-400"
                              : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                          }`}
                        >
                          {isOnHold ? <Play size={20} /> : <Pause size={20} />}
                        </button>

                        {/* Transfer Button & Popover (Both Unattended/Blind & Attended/Warm Transfer) */}
                        {callStatus === "InCall" && canTransfer && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setTransferOpen((p) => !p);
                                setConferenceOpen(false);
                              }}
                              title="Kontrollü / Kontrolsüz Çağrı Transferi"
                              className={`w-13 h-13 p-3.5 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${
                                transferOpen
                                  ? "bg-violet-100 border-violet-300 text-violet-600 dark:bg-violet-500/20 dark:border-violet-500/50 dark:text-violet-400"
                                  : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                              }`}
                            >
                              <ArrowRight size={20} />
                            </button>
                            {transferOpen && (
                              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-72 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-30 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                    Çağrı Transferi
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setTransferOpen(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Hedef Dahili veya Numara (Örn: 1001)"
                                  value={transferTarget}
                                  onChange={(e) => setTransferTarget(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                                />
                                <div className="grid grid-cols-1 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!transferTarget.trim()) return;
                                      const m = findContactByPhone(transferTarget.trim(), contacts, directory);
                                      webphoneManager.blindTransfer(transferTarget.trim(), m?.displayName || "");
                                      setTransferOpen(false);
                                      setTransferTarget("");
                                    }}
                                    className="w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                                  >
                                    <ArrowRight size={14} />
                                    Kontrolsüz Transfer (Direkt Aktar)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!transferTarget.trim()) return;
                                      const m = findContactByPhone(transferTarget.trim(), contacts, directory);
                                      webphoneManager.startAttendedTransfer(transferTarget.trim(), m?.displayName || "");
                                      setTransferOpen(false);
                                      setTransferTarget("");
                                    }}
                                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                                  >
                                    <PhoneForwarded size={14} />
                                    Kontrollü Transfer (Önce Ara & Danış)
                                  </button>
                                  {hasMultipleLines && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        webphoneManager.completeAttendedTransfer();
                                        setTransferOpen(false);
                                      }}
                                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      <GitMerge size={14} />
                                      Mevcut 2 Hattı Birleştir & Çık
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Conference Button & Popover */}
                        {callStatus === "InCall" && canConference && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setConferenceOpen((p) => !p);
                                setTransferOpen(false);
                              }}
                              title="Konferans Görüşmesi"
                              className={`w-13 h-13 p-3.5 rounded-full border flex items-center justify-center transition-all hover:scale-110 ${
                                conferenceOpen || isConferenceActive
                                  ? "bg-emerald-100 border-emerald-300 text-emerald-600 dark:bg-emerald-500/20 dark:border-emerald-500/50 dark:text-emerald-400"
                                  : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                              }`}
                            >
                              <Radio size={20} />
                            </button>
                            {conferenceOpen && (
                              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-72 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-30 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                    Konferans Yönetimi
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setConferenceOpen(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Katılımcı Dahili veya No (Örn: 1002)"
                                  value={conferenceTarget}
                                  onChange={(e) => setConferenceTarget(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                                />
                                <div className="grid grid-cols-1 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!conferenceTarget.trim()) return;
                                      const m = findContactByPhone(conferenceTarget.trim(), contacts, directory);
                                      webphoneManager.addParticipantToConference(conferenceTarget.trim(), m?.displayName || "");
                                      setConferenceOpen(false);
                                      setConferenceTarget("");
                                    }}
                                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                                  >
                                    <UserPlus size={14} />
                                    Katılımcıyı Ara & Konferansa Ekle
                                  </button>
                                  {inCallLinesCount >= 2 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isConferenceActive) {
                                          webphoneManager.stopConference();
                                        } else {
                                          webphoneManager.startConference();
                                        }
                                        setConferenceOpen(false);
                                      }}
                                      className={`w-full py-2 px-3 rounded-xl text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                                        isConferenceActive ? "bg-amber-600 hover:bg-amber-500" : "bg-cyan-600 hover:bg-cyan-500"
                                      }`}
                                    >
                                      <GitMerge size={14} />
                                      {isConferenceActive ? "Konferansı Ayır (Tekli Hat)" : "Mevcut Hatları Konferansta Birleştir"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => handleHangup()}
                          title="Seçili Hattı Sonlandır"
                          className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-110 group"
                        >
                          <PhoneOff size={24} className="group-hover:scale-110 transition-transform" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Transcript Panel shrinks to fill remaining space */}
              <div className="flex-1 min-h-[220px] overflow-hidden">
                <TranscriptPanel callId={activeCallId} backendHost={backendHost} callPanelPerms={callPanelPerms} />
              </div>
            </div>
          ) : (
            <TranscriptPanel callId={activeCallId} backendHost={backendHost} callPanelPerms={callPanelPerms} />
          )}
        </div>
      </div>

      {/* In-Call Add Contact Modal */}
      {isAddContactOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-slate-800 dark:text-white font-bold">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-xl">
                  <UserPlus size={18} />
                </div>
                <span>Rehbere Kişi Ekle</span>
              </div>
              <button
                onClick={() => setIsAddContactOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {contactError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium">
                {contactError}
              </div>
            )}

            <div className="space-y-3 text-left">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Telefon Numarası</label>
                <input
                  type="text"
                  value={displayPhoneNum || dialNumber}
                  disabled
                  className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-mono font-bold border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Ad *</label>
                  <input
                    type="text"
                    value={newContact.firstName}
                    onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                    placeholder="Örn: Ahmet"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Soyad *</label>
                  <input
                    type="text"
                    value={newContact.lastName}
                    onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                    placeholder="Örn: Yılmaz"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">E-posta (İsteğe Bağlı)</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="ahmet@ornek.com"
                  className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsAddContactOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSaveContact}
                disabled={savingContact}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingContact ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
