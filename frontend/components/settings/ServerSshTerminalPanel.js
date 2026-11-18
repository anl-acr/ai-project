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
  KeyRound,
  User,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

// Helper to load local vendored xterm.js + fit addon once
let xtermLoaderPromise = null;
function ensureXtermLoaded() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Terminal && window.FitAddon) return Promise.resolve(true);
  if (xtermLoaderPromise) return xtermLoaderPromise;

  xtermLoaderPromise = new Promise((resolve) => {
    // 1. Load xterm.css
    if (!document.getElementById("nornia-xterm-css")) {
      const link = document.createElement("link");
      link.id = "nornia-xterm-css";
      link.rel = "stylesheet";
      link.href = "/vendor/xterm/xterm.css";
      document.head.appendChild(link);
    }

    const loadFit = () => {
      if (window.FitAddon) {
        resolve(true);
        return;
      }
      const s2 = document.createElement("script");
      s2.src = "/vendor/xterm/xterm-addon-fit.js";
      s2.onload = () => resolve(Boolean(window.Terminal));
      s2.onerror = () => resolve(Boolean(window.Terminal));
      document.body.appendChild(s2);
    };

    if (window.Terminal) {
      loadFit();
      return;
    }

    const s1 = document.createElement("script");
    s1.src = "/vendor/xterm/xterm.js";
    s1.onload = loadFit;
    s1.onerror = () => resolve(false);
    document.body.appendChild(s1);
  });

  return xtermLoaderPromise;
}

export default function ServerSshTerminalPanel({
  backendHost = "localhost:8000",
  userPermissions = ["*"],
}) {
  const { bg, hover, text, lightBg } = useTheme();
  const API_BASE = getApiBaseUrl();

  const [hostname, setHostname] = useState("santral");
  const [subdomain, setSubdomain] = useState("app");
  const [remoteSshEnabled, setRemoteSshEnabled] = useState(true);
  const [emergencyOverride, setEmergencyOverride] = useState(false);

  // Optional Quick Login Bar inputs
  const [loginUser, setLoginUser] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [sessionId, setSessionId] = useState("");
  const [activeUser, setActiveUser] = useState("");
  const [termDims, setTermDims] = useState({ cols: 120, rows: 32 });
  const [connecting, setConnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState("");
  const [xtermReady, setXtermReady] = useState(false);

  const termContainerRef = useRef(null);
  const termInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const sessionIdRef = useRef("");
  const sessionClosedRef = useRef(true);
  const inputQueueRef = useRef("");
  const flushingInputRef = useRef(false);
  const flushTimerRef = useRef(null);

  const canUseWebSsh =
    !Array.isArray(userPermissions) ||
    userPermissions.includes("*") ||
    userPermissions.includes("server_ssh:access") ||
    userPermissions.includes("server_ssh");

  const sshAllowed = remoteSshEnabled || emergencyOverride;

  // Fetch Central Server SSH lock status
  const fetchSshStatus = useCallback(async () => {
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/ras/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.hostname) setHostname(data.hostname);
        if (data.config) {
          setSubdomain(data.config.subdomain || "app");
          setRemoteSshEnabled(data.config.remote_ssh_enabled !== false);
          setEmergencyOverride(Boolean(data.config.emergency_ssh_override));
        }
      }
    } catch (e) {
      // silent
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchSshStatus();
    const t = setInterval(fetchSshStatus, 8000);
    return () => clearInterval(t);
  }, [fetchSshStatus]);

  // Flush queued keystrokes to backend PTY in strict FIFO order
  const flushKeystrokeQueue = useCallback(async () => {
    if (flushingInputRef.current) return;
    const sid = sessionIdRef.current;
    if (!sid || !inputQueueRef.current) return;

    flushingInputRef.current = true;
    while (inputQueueRef.current && sessionIdRef.current === sid) {
      const batch = inputQueueRef.current;
      inputQueueRef.current = "";
      try {
        const res = await tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sid, data: batch }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.output && termInstanceRef.current) {
            termInstanceRef.current.write(data.output);
          }
          if (data.username) {
            setActiveUser(data.username);
          }
          if (data.closed) {
            sessionClosedRef.current = true;
            sessionIdRef.current = "";
            setSessionId("");
            break;
          }
        } else if (res.status === 403 || res.status === 404) {
          sessionClosedRef.current = true;
          sessionIdRef.current = "";
          setSessionId("");
          break;
        }
      } catch (e) {
        break;
      }
    }
    flushingInputRef.current = false;
  }, [API_BASE]);

  const enqueueTerminalData = useCallback(
    (data) => {
      if (!data) return;
      // If session is closed and user presses Enter, automatically start a new session
      if (sessionClosedRef.current || !sessionIdRef.current) {
        if (data === "\r" || data === "\n") {
          startNewSshSession("", "");
        }
        return;
      }
      inputQueueRef.current += data;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        flushKeystrokeQueue();
      }, 18);
    },
    [flushKeystrokeQueue]
  );

  // Start a new authenticated SSH session
  const startNewSshSession = useCallback(
    async (explicitUser = "", explicitPass = "") => {
      if (!canUseWebSsh || !sshAllowed) return;
      setConnecting(true);
      try {
        if (sessionIdRef.current) {
          const oldSid = sessionIdRef.current;
          sessionIdRef.current = "";
          setSessionId("");
          await tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/stop`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: oldSid }),
          }).catch(() => {});
        }

        inputQueueRef.current = "";
        const term = termInstanceRef.current;
        const fit = fitAddonRef.current;
        let cols = 120;
        let rows = 32;
        if (term && fit) {
          try {
            fit.fit();
            cols = term.cols || 120;
            rows = term.rows || 32;
            setTermDims({ cols, rows });
          } catch (e) {}
          term.reset();
        }

        const res = await tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: explicitUser.trim(),
            password: explicitPass,
            cols,
            rows,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.session_id) {
          sessionIdRef.current = data.session_id;
          sessionClosedRef.current = Boolean(data.closed);
          setSessionId(data.session_id);
          setActiveUser(data.username || "");
          if (term && data.output) {
            term.write(data.output);
          }
          setTimeout(() => term?.focus(), 50);
        } else {
          sessionClosedRef.current = true;
          if (term) {
            term.write(`\r\n\x1b[1;31m❌ HATA: ${data.detail || "SSH oturumu başlatılamadı."}\x1b[0m\r\n`);
          }
        }
      } catch (err) {
        sessionClosedRef.current = true;
        if (termInstanceRef.current) {
          termInstanceRef.current.write(`\r\n\x1b[1;31m❌ Bağlantı hatası: ${err.message}\x1b[0m\r\n`);
        }
      } finally {
        setConnecting(false);
      }
    },
    [API_BASE, canUseWebSsh, sshAllowed]
  );

  const stopCurrentSession = async () => {
    const sid = sessionIdRef.current;
    sessionIdRef.current = "";
    sessionClosedRef.current = true;
    setSessionId("");
    setActiveUser("");
    if (sid) {
      await tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid }),
      }).catch(() => {});
    }
    if (termInstanceRef.current) {
      termInstanceRef.current.write(
        "\r\n\x1b[33m[Oturum Kapatıldı — Yeniden bağlanmak için Enter tuşuna veya 'Yeni SSH Oturumu' butonuna basın]\x1b[0m\r\n"
      );
    }
  };

  // Initialize xterm.js instance once container is mounted
  useEffect(() => {
    if (!canUseWebSsh) return;
    let disposed = false;

    ensureXtermLoaded().then((ok) => {
      if (disposed || !ok || !termContainerRef.current) return;
      if (termInstanceRef.current) return;

      const term = new window.Terminal({
        cursorBlink: true,
        cursorStyle: "block",
        fontFamily:
          '"SF Mono", Menlo, Monaco, "Cascadia Mono", "Fira Code", Consolas, "Liberation Mono", monospace',
        fontSize: 13.5,
        lineHeight: 1.28,
        scrollback: 10000,
        allowTransparency: false,
        macOptionIsMeta: true,
        rightClickSelectsWord: true,
        theme: {
          background: "#0b0f17",
          foreground: "#e6edf3",
          cursor: "#3fb950",
          cursorAccent: "#0b0f17",
          selectionBackground: "rgba(56, 139, 253, 0.35)",
          black: "#0b0f17",
          red: "#ff7b72",
          green: "#3fb950",
          yellow: "#d29922",
          blue: "#58a6ff",
          magenta: "#bc8cff",
          cyan: "#39c5cf",
          white: "#b1bac4",
          brightBlack: "#6e7681",
          brightRed: "#ffa198",
          brightGreen: "#56d364",
          brightYellow: "#e3b341",
          brightBlue: "#79c0ff",
          brightMagenta: "#d2a8ff",
          brightCyan: "#56d4dd",
          brightWhite: "#ffffff",
        },
      });

      let fitAddon = null;
      if (window.FitAddon && window.FitAddon.FitAddon) {
        fitAddon = new window.FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;
      }

      term.open(termContainerRef.current);
      if (fitAddon) {
        try {
          fitAddon.fit();
          setTermDims({ cols: term.cols, rows: term.rows });
        } catch (e) {}
      }

      term.onData((data) => {
        enqueueTerminalData(data);
      });

      termInstanceRef.current = term;
      setXtermReady(true);
      term.focus();
    });

    return () => {
      disposed = true;
    };
  }, [canUseWebSsh, enqueueTerminalData]);

  // Automatically start the interactive `login as: ` prompt once xterm is ready and SSH is allowed
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (xtermReady && sshAllowed && !autoStartedRef.current) {
      autoStartedRef.current = true;
      startNewSshSession("", "");
    }
  }, [xtermReady, sshAllowed, startNewSshSession]);

  // Handle window / fullscreen resize -> fit xterm & notify backend PTY (TIOCSWINSZ)
  useEffect(() => {
    if (!xtermReady) return;
    const handleResize = () => {
      if (!fitAddonRef.current || !termInstanceRef.current) return;
      try {
        fitAddonRef.current.fit();
        const cols = termInstanceRef.current.cols || 120;
        const rows = termInstanceRef.current.rows || 32;
        setTermDims({ cols, rows });
        if (sessionIdRef.current) {
          tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/resize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionIdRef.current, cols, rows }),
          }).catch(() => {});
        }
      } catch (e) {}
    };

    const t = setTimeout(handleResize, 80);
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", handleResize);
    };
  }, [xtermReady, isFullscreen, API_BASE]);

  // Background output polling for async command output (e.g. top, ping, pm2 logs)
  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        const res = await tenantFetch(
          `${API_BASE}/api/settings/ras/web-ssh/poll?session_id=${encodeURIComponent(sid)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.output && termInstanceRef.current) {
            termInstanceRef.current.write(data.output);
          }
          if (data.closed) {
            sessionClosedRef.current = true;
            sessionIdRef.current = "";
            setSessionId("");
          }
        }
      } catch (e) {}
    }, 220);
    return () => clearInterval(timer);
  }, [sessionId, API_BASE]);

  // Cleanup PTY session on unmount
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        const sid = sessionIdRef.current;
        sessionIdRef.current = "";
        tenantFetch(`${API_BASE}/api/settings/ras/web-ssh/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sid }),
        }).catch(() => {});
      }
      if (termInstanceRef.current) {
        try {
          termInstanceRef.current.dispose();
        } catch (e) {}
        termInstanceRef.current = null;
      }
    };
  }, [API_BASE]);

  const handleQuickLoginSubmit = (e) => {
    e.preventDefault();
    startNewSshSession(loginUser, loginPassword);
    setLoginPassword("");
  };

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

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-slate-950 p-3 sm:p-5 flex flex-col gap-3 overflow-hidden"
          : "space-y-4"
      }
    >
      {/* Top Compact SSH Auth & Status Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl ${lightBg} ${text} flex items-center justify-center shrink-0`}>
            <Terminal size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Sunucu Web SSH Terminali (macOS Terminal Emülatörü)
              </h3>
              {sshAllowed ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Unlock size={10} />
                  <span>{emergencyOverride ? "Acil Konsol Yetkisi" : "Merkez SSH Açık"}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                  <Lock size={10} />
                  <span>Merkezden Kapatıldı</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Doğrudan siyah terminal ekranına tıklayıp <code className="font-mono font-bold">login as:</code> ve{" "}
              <code className="font-mono font-bold">password:</code> yazabilir veya sağdaki hızlı giriş kutusunu kullanabilirsiniz.
            </p>
          </div>
        </div>

        {/* Right: Optional Quick SSH Login Form + Session Controls */}
        <form onSubmit={handleQuickLoginSubmit} className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center">
            <User size={13} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              disabled={!sshAllowed}
              placeholder="SSH Kullanıcı (örn: aida)"
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white w-44 focus:outline-none"
            />
          </div>

          <div className="relative flex items-center">
            <KeyRound size={13} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={!sshAllowed}
              placeholder="SSH Şifresi"
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white w-40 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={connecting || !sshAllowed}
            className={`px-3.5 py-1.5 rounded-xl text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40 ${bg} ${hover}`}
          >
            <Terminal size={13} />
            <span>{connecting ? "Bağlanıyor..." : "Yeni SSH Oturumu"}</span>
          </button>

          {sessionId && (
            <button
              type="button"
              onClick={stopCurrentSession}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer"
              title="Aktif SSH Oturumunu Sonlandır"
            >
              <Power size={12} />
              <span>Kapat</span>
            </button>
          )}
        </form>
      </div>

      {/* MACOS TERMINAL.APP WINDOW */}
      <div
        className={
          "rounded-2xl bg-[#0b0f17] border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden " +
          (isFullscreen ? "flex-1 min-h-0" : "")
        }
      >
        {/* macOS Window Title Bar */}
        <div className="px-4 py-2.5 bg-[#161b22] border-b border-slate-800 flex items-center justify-between select-none">
          {/* Left: Traffic Lights */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={stopCurrentSession}
              className="w-3 h-3 rounded-full bg-[#ff5f56] hover:opacity-80 transition-opacity cursor-pointer"
              title="SSH Oturumunu Kapat"
            />
            <button
              type="button"
              onClick={() => termInstanceRef.current?.clear()}
              className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:opacity-80 transition-opacity cursor-pointer"
              title="Terminal Ekranını Temizle (Ctrl+L)"
            />
            <button
              type="button"
              onClick={() => setIsFullscreen((p) => !p)}
              className="w-3 h-3 rounded-full bg-[#27c93f] hover:opacity-80 transition-opacity cursor-pointer"
              title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Yap"}
            />
          </div>

          {/* Center: macOS Terminal Title */}
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
            <Terminal size={13} className="text-emerald-400" />
            <span>
              {activeUser ? `${activeUser}@${hostname}` : `ssh — ${hostname}`} — {subdomain}.nornia.com.tr —{" "}
              {termDims.cols}×{termDims.rows}
            </span>
          </div>

          {/* Right: Quick Action Shortcuts */}
          <div className="flex items-center gap-1.5">
            {sessionId && (
              <>
                <button
                  type="button"
                  onClick={() => enqueueTerminalData("pm2 status\r")}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold cursor-pointer border border-slate-700"
                >
                  pm2 status
                </button>
                <button
                  type="button"
                  onClick={() => enqueueTerminalData("sudo asterisk -rx 'pjsip show endpoints'\r")}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold cursor-pointer border border-slate-700"
                >
                  pjsip endpoints
                </button>
                <button
                  type="button"
                  onClick={() => enqueueTerminalData("ip -br a\r")}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold cursor-pointer border border-slate-700"
                >
                  ip -br a
                </button>
                <button
                  type="button"
                  onClick={() => enqueueTerminalData("\x03")}
                  className="px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-mono font-bold cursor-pointer"
                  title="Ctrl+C Gönder"
                >
                  ^C
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen((p) => !p)}
              className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title={isFullscreen ? "Küçült" : "Tam Ekran"}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>

        {/* Locked State Overlay if Central Server disabled SSH */}
        {!sshAllowed && (
          <div className="p-10 text-center space-y-3 bg-[#0b0f17] text-slate-200 border-b border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Lock size={22} />
            </div>
            <h4 className="text-sm font-extrabold text-white">
              Merkez Lisans Sunucusu Tarafından SSH Erişimi Kapatılmıştır
            </h4>
            <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
              Bu santralin SSH erişimi{" "}
              <strong className="text-slate-200">Merkezi Lisans Paneli (panel.nornia.com.tr)</strong>{" "}
              üzerinden kapatılmıştır. Oturum açmak için Merkez Lisans Panelinden{" "}
              <strong className="text-emerald-400">SSH Açık</strong> şalterini aktif ediniz veya
              sanallaştırma konsolundan{" "}
              <code className="font-mono text-amber-300">sudo nornia-emergency-ssh on</code>{" "}
              komutunu çalıştırınız.
            </p>
          </div>
        )}

        {/* Real xterm.js Canvas / DOM Container */}
        <div
          ref={termContainerRef}
          onClick={() => termInstanceRef.current?.focus()}
          className={
            "w-full bg-[#0b0f17] p-3 overflow-hidden " +
            (isFullscreen ? "flex-1 min-h-0" : "h-[560px]")
          }
        />
      </div>

      {/* Bottom Emergency Virtualization Console Backdoor Info */}
      {!isFullscreen && (
        <div className="px-4 py-3 rounded-2xl bg-slate-900 text-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <Terminal size={14} className="text-amber-400 shrink-0" />
            <span className="font-bold text-amber-400">
              Sanallaştırma Konsolu (VMware / Proxmox / KVM) Acil Durum SSH Arka Kapısı:
            </span>
            <code className="font-mono font-bold text-emerald-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              sudo nornia-emergency-ssh on
            </code>
          </div>
          <button
            type="button"
            onClick={() => copyText("sudo nornia-emergency-ssh on", "emerg")}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {copiedCmd === "emerg" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>Kopyala</span>
          </button>
        </div>
      )}
    </div>
  );
}
