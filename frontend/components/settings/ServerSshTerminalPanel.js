import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Terminal,
  Lock,
  Unlock,
  RefreshCw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Power,
  Cpu,
  Server,
  ShieldCheck,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

export default function ServerSshTerminalPanel({
  backendHost = "localhost:8000",
  userPermissions = ["*"],
}) {
  const { bg, hover, text, border, lightBg } = useTheme();
  const API_BASE = getApiBaseUrl();

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [hostname, setHostname] = useState("santral");
  const [hardwareId, setHardwareId] = useState("");
  const [subdomain, setSubdomain] = useState("app");
  const [remoteSshEnabled, setRemoteSshEnabled] = useState(true);
  const [emergencyOverride, setEmergencyOverride] = useState(false);

  // Terminal session state
  const [sessionMode, setSessionMode] = useState("bash"); // "bash" | "ssh"
  const [sshUsername, setSshUsername] = useState("aida");
  const [sshPassword, setSshPassword] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [commandInput, setCommandInput] = useState("");
  const [isPasswordPrompt, setIsPasswordPrompt] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState("");

  // Command history for Up/Down arrow keys
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const outputRef = useRef(null);
  const inputRef = useRef(null);

  const canUseWebSsh =
    !Array.isArray(userPermissions) ||
    userPermissions.includes("*") ||
    userPermissions.includes("server_ssh:access") ||
    userPermissions.includes("server_ssh");

  const sshAllowed = remoteSshEnabled || emergencyOverride;

  const appendOutput = useCallback((chunk) => {
    if (!chunk) return;
    setTerminalOutput((prev) => {
      const next = prev + chunk;
      return next.length > 180000 ? next.slice(-180000) : next;
    });
    const lower = chunk.toLowerCase();
    if (lower.includes("password:") || lower.includes("parola:")) {
      setIsPasswordPrompt(true);
    } else if (
      lower.includes("$ ") ||
      lower.includes("# ") ||
      lower.includes("last login") ||
      lower.includes("welcome to")
    ) {
      setIsPasswordPrompt(false);
    }
    setTimeout(() => {
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    }, 20);
  }, []);

  const fetchSshStatus = useCallback(async () => {
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ras/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.hostname) setHostname(data.hostname);
        if (data.hardware_id) setHardwareId(data.hardware_id);
        if (data.config) {
          setSubdomain(data.config.subdomain || "app");
          setRemoteSshEnabled(data.config.remote_ssh_enabled !== false);
          setEmergencyOverride(Boolean(data.config.emergency_ssh_override));
        }
      }
    } catch (e) {
      // silent
    } finally {
      setLoadingStatus(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchSshStatus();
    const t = setInterval(fetchSshStatus, 8000);
    return () => clearInterval(t);
  }, [fetchSshStatus]);

  const handleStartSession = async (overrideMode = null) => {
    if (!canUseWebSsh) return;
    const targetMode = overrideMode || sessionMode;
    setConnecting(true);
    try {
      if (sessionId) {
        await tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        }).catch(() => {});
      }
      setTerminalOutput("");
      setIsPasswordPrompt(false);

      const res = await tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: (sshUsername || "aida").trim() || "aida",
          password: sshPassword,
          mode: targetMode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.session_id) {
        setSessionId(data.session_id);
        appendOutput(data.output || "");
        setTimeout(() => inputRef.current?.focus(), 80);
      } else {
        setSessionId("");
        appendOutput(`\r\n❌ HATA: ${data.detail || "Terminal oturumu başlatılamadı."}\r\n`);
      }
    } catch (err) {
      appendOutput(`\r\n❌ Bağlantı hatası: ${err.message}\r\n`);
    } finally {
      setConnecting(false);
    }
  };

  const handleStopSession = async () => {
    if (!sessionId) return;
    const sid = sessionId;
    setSessionId("");
    setIsPasswordPrompt(false);
    try {
      await tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid }),
      });
    } catch (e) {}
    appendOutput("\r\n[Terminal Oturumu Sonlandırıldı]\r\n");
  };

  const handleSendInput = async (e, rawOverride = null) => {
    if (e) e.preventDefault();
    if (!sessionId) return;
    const toSend = rawOverride !== null ? rawOverride : commandInput + "\n";

    if (rawOverride === null) {
      const trimmed = commandInput.trim();
      if (trimmed && !isPasswordPrompt) {
        setCmdHistory((prev) => [trimmed, ...prev.filter((c) => c !== trimmed)].slice(0, 50));
      }
      setHistoryIdx(-1);
      setCommandInput("");
    }

    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, data: toSend }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.output) appendOutput(data.output);
        if (data.closed) {
          setSessionId("");
          setIsPasswordPrompt(false);
        }
      } else {
        appendOutput(`\r\n❌ ${data.detail || "Komut gönderilemedi."}\r\n`);
        if (res.status === 403 || res.status === 404) {
          setSessionId("");
        }
      }
    } catch (err) {}
  };

  const handleInputKeyDown = (e) => {
    if (isPasswordPrompt) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(nextIdx);
      setCommandInput(cmdHistory[nextIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setCommandInput("");
      } else {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setCommandInput(cmdHistory[nextIdx]);
      }
    } else if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      handleSendInput(null, "\x03");
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(async () => {
      try {
        const res = await tenantFetch(
          `${API_BASE}/api/settings/ras/web-ssh/poll?session_id=${encodeURIComponent(sessionId)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.output) appendOutput(data.output);
          if (data.closed) {
            setSessionId("");
            setIsPasswordPrompt(false);
          }
        }
      } catch (e) {}
    }, 320);
    return () => clearInterval(timer);
  }, [sessionId, API_BASE, appendOutput]);

  const copyText = (txt, key) => {
    navigator.clipboard.writeText(txt);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(""), 2000);
  };

  if (!canUseWebSsh) {
    return (
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <Lock size={22} />
        </div>
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
          Sunucu Web SSH Terminali Yetkiniz Bulunmuyor
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Bu ekranı görüntülemek ve kullanmak için rol profilinizde{" "}
          <code className="font-mono font-bold">Sunucu Web SSH Terminali (server_ssh:access)</code>{" "}
          yetkisinin açık olması gerekmektedir.
        </p>
      </div>
    );
  }

  const quickCommands = [
    { label: "PM2 Servisler", cmd: "pm2 status\n" },
    { label: "Ağ & IP Tablosu", cmd: "ip -br a && ip route\n" },
    { label: "Asterisk Dahililer", cmd: "sudo asterisk -rx 'pjsip show endpoints'\n" },
    { label: "Asterisk Trunklar", cmd: "sudo asterisk -rx 'pjsip show registrations'\n" },
    { label: "Aktif Çağrılar", cmd: "sudo asterisk -rx 'core show channels'\n" },
    { label: "CPU / RAM / Disk", cmd: "df -h && free -m && uptime\n" },
    { label: "Backend Log (Son 30)", cmd: "pm2 logs aida-backend --lines 30 --nostream\n" },
  ];

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-slate-950 p-4 sm:p-6 flex flex-col gap-4 overflow-hidden"
          : "space-y-5"
      }
    >
      {/* Top Header & Connection Control Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-2xl ${lightBg} ${text} flex items-center justify-center shrink-0`}>
              <Terminal size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Sunucu Web SSH Terminali
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {hostname} ({subdomain}.nornia.com.tr)
                </span>
                {sshAllowed ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Unlock size={11} />
                    <span>{emergencyOverride ? "Acil Konsol Yetkisi Açık" : "Merkez SSH Yetkisi Açık"}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <Lock size={11} />
                    <span>Merkez Sunucudan Kapatıldı</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Hiçbir ek TCP portu harcamadan doğrudan web tüneli üzerinden santralin Linux kabuğuna (Bash / SSH) tam genişlikte erişin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen((p) => !p)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title={isFullscreen ? "Tam Ekrandan Çık" : "Terminali Tam Ekran Yap"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFullscreen ? "Küçült" : "Tam Ekran"}</span>
            </button>
          </div>
        </div>

        {/* Connection Mode & Credentials Toolbar */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Selector */}
            <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-900 p-1 border border-slate-300/60 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSessionMode("bash")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  sessionMode === "bash"
                    ? `${bg} text-white shadow-xs`
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                ⚡ Doğrudan Sistem Kabuğu (Hızlı Bash)
              </button>
              <button
                type="button"
                onClick={() => setSessionMode("ssh")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  sessionMode === "ssh"
                    ? `${bg} text-white shadow-xs`
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                🔑 SSH Girişi (Kullanıcı & Parola)
              </button>
            </div>

            {sessionMode === "ssh" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Kullanıcı:</span>
                  <input
                    type="text"
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                    disabled={!sshAllowed}
                    placeholder="aida veya root"
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white w-28 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Parola:</span>
                  <input
                    type="password"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    disabled={!sshAllowed}
                    placeholder="Opsiyonel (Otomatik girer)"
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white w-44 focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={connecting || !sshAllowed}
              onClick={() => handleStartSession()}
              className={`px-4 py-2 rounded-xl text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-40 ${bg} ${hover}`}
            >
              <Terminal size={14} />
              <span>
                {connecting
                  ? "Bağlanıyor..."
                  : sessionId
                  ? "Oturumu Yeniden Başlat"
                  : "⚡ Terminal Oturumu Başlat"}
              </span>
            </button>

            {sessionId && (
              <button
                type="button"
                onClick={handleStopSession}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Power size={13} />
                <span>Kapat</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Terminal Viewport Card */}
      <div
        className={
          "rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl flex flex-col overflow-hidden " +
          (isFullscreen ? "flex-1 min-h-0" : "")
        }
      >
        {/* Terminal Top Bar & Quick Diagnostic Buttons */}
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block mr-2" />
            <span className="text-[11px] font-mono font-bold text-slate-400 mr-2">
              {sessionId ? `🟢 AKTİF OTURUM (${sessionId})` : "⚪ OTURUM BEKLENİYOR"}
            </span>

            {sessionId && !isPasswordPrompt && (
              <>
                {quickCommands.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => handleSendInput(null, q.cmd)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700/80 transition-colors cursor-pointer"
                  >
                    {q.label}
                  </button>
                ))}
              </>
            )}
          </div>

          {sessionId && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSendInput(null, "\x03")}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-mono font-bold cursor-pointer"
                title="Çalışan komutu durdur (SIGINT)"
              >
                Ctrl+C
              </button>
              <button
                type="button"
                onClick={() => setTerminalOutput("")}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={11} />
                <span>Ekranı Temizle</span>
              </button>
            </div>
          )}
        </div>

        {/* If SSH is locked by Central License Server */}
        {!sshAllowed ? (
          <div className="p-10 text-center space-y-3 bg-slate-950 text-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Lock size={22} />
            </div>
            <h4 className="text-sm font-extrabold text-white">
              Merkez Lisans Sunucusu Tarafından SSH Erişimi Kapatılmıştır
            </h4>
            <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
              Bu santralin SSH ve Web Terminal erişimi{" "}
              <strong className="text-slate-200">Merkezi Lisans Paneli (panel.nornia.com.tr)</strong>{" "}
              üzerinden kapatılmıştır. Oturum açmak için Merkez Lisans Panelinden{" "}
              <strong className="text-emerald-400">SSH Açık</strong> butonuna tıklayınız veya
              sanallaştırma konsolundan (VMware / Proxmox / KVM){" "}
              <code className="font-mono text-amber-300">sudo nornia-emergency-ssh on</code>{" "}
              komutunu çalıştırınız.
            </p>
          </div>
        ) : (
          <>
            {/* Terminal Output Area */}
            <div
              ref={outputRef}
              onClick={() => inputRef.current?.focus()}
              className={
                "bg-black px-5 py-4 overflow-y-auto font-mono text-[13px] text-emerald-400 whitespace-pre-wrap leading-relaxed select-text cursor-text " +
                (isFullscreen ? "flex-1 min-h-0" : "h-[520px]")
              }
            >
              {terminalOutput ||
                `🔒 Nornia Santral Web SSH Terminali Hazır (${hostname}).\n` +
                  `Başlamak için yukarıdaki "⚡ Terminal Oturumu Başlat" butonuna tıklayınız...`}
            </div>

            {/* Command Input Bar */}
            <form
              onSubmit={(e) => handleSendInput(e)}
              className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2.5"
            >
              <span className="font-mono text-xs font-extrabold text-emerald-400 pl-2 flex items-center gap-1 shrink-0">
                {isPasswordPrompt ? (
                  "🔑 Parola:"
                ) : (
                  <>
                    <span>{`${sshUsername || "aida"}@${hostname}:~$`}</span>
                    <ChevronRight size={14} />
                  </>
                )}
              </span>
              <input
                ref={inputRef}
                type={isPasswordPrompt ? "password" : "text"}
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={!sessionId}
                placeholder={
                  !sessionId
                    ? "Önce yukarıdan '⚡ Terminal Oturumu Başlat' butonuna tıklayın..."
                    : isPasswordPrompt
                    ? "Linux kullanıcı parolasını yazıp Enter'a basın..."
                    : "Komut yazıp Enter'a basın (Önceki komutlar için ↑ / ↓ ok tuşlarını kullanabilirsiniz)..."
                }
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/90 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!sessionId}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-extrabold cursor-pointer disabled:opacity-40 ${bg} ${hover}`}
              >
                Gönder ↵
              </button>
            </form>
          </>
        )}
      </div>

      {/* Virtualization Console Emergency Backdoor Info Strip */}
      {!isFullscreen && (
        <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
          <div>
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <Terminal size={14} />
              <span>Sanallaştırma Konsolu (VMware / Proxmox / KVM) Acil Durum SSH Arka Kapı Komutu:</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Merkez sunucudan SSH kapatılmış veya bağlantı kopmuş olsa bile, sanallaştırma konsolundan{" "}
              <code className="font-mono font-bold text-emerald-400">sudo nornia-emergency-ssh on</code>{" "}
              komutunu çalıştırarak yerel SSH ve Web SSH erişimini anında açabilirsiniz.
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyText("sudo nornia-emergency-ssh on", "emerg")}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {copiedCmd === "emerg" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>Komutu Kopyala</span>
          </button>
        </div>
      )}
    </div>
  );
}
