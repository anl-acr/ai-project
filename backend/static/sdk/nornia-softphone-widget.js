/**
 * ============================================================================
 * Nornia Softphone Widget (3 Satırda Hazır Gömülebilir Mini WebRTC Telefon)
 * Web CRM, ERP ve Electron Desktop Uygulamaları İçin — v1.0.0
 * ============================================================================
 *
 * Kullanım:
 *   <script src="https://pbx.firma.com/api/v1/sdk/nornia-voice-sdk.js"></script>
 *   <script src="https://pbx.firma.com/api/v1/sdk/nornia-softphone-widget.js"></script>
 *   <script>
 *     NorniaSoftphoneWidget.mount({
 *       serverUrl: "https://pbx.firma.com",
 *       apiKey: "aida_live_...",
 *       extension: "1001",
 *       onIncomingCall: (call) => { console.log("CRM Screen Pop:", call.callerNumber); }
 *     });
 *   </script>
 */
(function (root) {
  "use strict";

  function formatTimer(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function mount(options) {
    options = options || {};
    if (typeof document === "undefined") return null;
    if (!root.NorniaVoiceSDK) {
      throw new Error("Önce nornia-voice-sdk.js yüklenmelidir.");
    }

    var accent = options.themeColor || "#4f46e5";
    var posRight = options.position !== "bottom-left";
    var phone = new root.NorniaVoiceSDK(options);

    // Shadow DOM izolasyonu — müşterinin CRM CSS'iyle asla çakışmaz!
    var host = document.createElement("div");
    host.id = "nornia-softphone-widget-host";
    host.style.position = "fixed";
    host.style.bottom = "20px";
    host.style[posRight ? "right" : "left"] = "20px";
    host.style.zIndex = "2147483000";
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML =
      '<style>' +
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}' +
      '.fab{width:56px;height:56px;border-radius:18px;border:none;background:' + accent + ';color:#fff;cursor:pointer;box-shadow:0 12px 30px rgba(15,23,42,.28);display:flex;align-items:center;justify-content:center;position:relative;font-size:22px;}' +
      '.dot{width:12px;height:12px;border-radius:50%;position:absolute;top:-2px;right:-2px;border:2px solid #fff;background:#94a3b8;}' +
      '.dot.on{background:#10b981;}' +
      '.card{width:300px;background:#0f172a;color:#f8fafc;border-radius:20px;box-shadow:0 20px 50px rgba(2,6,23,.45);border:1px solid rgba(255,255,255,.12);overflow:hidden;display:none;margin-bottom:12px;}' +
      '.card.open{display:block;}' +
      '.hdr{padding:12px 14px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:700;}' +
      '.badge{font-size:10px;padding:3px 8px;border-radius:99px;background:rgba(148,163,184,.2);color:#cbd5e1;}' +
      '.badge.on{background:rgba(16,185,129,.2);color:#6ee7b7;}' +
      '.body{padding:14px;}' +
      '.num{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:#1e293b;color:#fff;font-size:15px;font-weight:700;text-align:center;outline:none;margin-bottom:10px;}' +
      '.pad{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px;}' +
      '.key{padding:10px 0;border-radius:11px;border:1px solid rgba(255,255,255,.08);background:#1e293b;color:#f8fafc;font-size:15px;font-weight:700;cursor:pointer;}' +
      '.key:hover{background:#334155;}' +
      '.row{display:flex;gap:8px;}' +
      '.btn{flex:1;padding:11px;border-radius:12px;border:none;font-weight:800;font-size:12px;cursor:pointer;color:#fff;}' +
      '.call{background:#10b981;} .hang{background:#e11d48;} .sec{background:#334155;color:#e2e8f0;}' +
      '.state{text-align:center;padding:8px 0 12px;font-size:12px;color:#94a3b8;}' +
      '.caller{font-size:16px;font-weight:800;color:#fff;margin-bottom:2px;}' +
      '</style>' +
      '<div class="card" id="card">' +
      '  <div class="hdr"><span>Nornia Telefon • ' + (options.extension || "") + '</span><span class="badge" id="statusBadge">Bağlanıyor</span></div>' +
      '  <div class="body">' +
      '    <div class="state" id="callState" style="display:none;"><div class="caller" id="callerText"></div><div id="timerText">00:00</div></div>' +
      '    <input class="num" id="numInput" placeholder="Numara veya dahili..." />' +
      '    <div class="pad" id="pad"></div>' +
      '    <div class="row" id="idleBtns"><button class="btn call" id="dialBtn">Ara</button></div>' +
      '    <div class="row" id="inBtns" style="display:none;"><button class="btn call" id="ansBtn">Cevapla</button><button class="btn hang" id="rejBtn">Reddet</button></div>' +
      '    <div class="row" id="actBtns" style="display:none;margin-bottom:8px;"><button class="btn sec" id="muteBtn">Sessiz</button><button class="btn sec" id="xferBtn">Aktar</button><button class="btn hang" id="hangBtn">Kapat</button></div>' +
      '  </div>' +
      '</div>' +
      '<button class="fab" id="fab" title="Nornia Telefon">📞<span class="dot" id="fabDot"></span></button>';

    var $ = function (id) { return shadow.getElementById(id); };
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
    keys.forEach(function (k) {
      var b = document.createElement("button");
      b.className = "key";
      b.textContent = k;
      b.onclick = function () {
        $("numInput").value += k;
        phone.sendDtmf(k);
      };
      $("pad").appendChild(b);
    });

    var timerHandle = null;
    var elapsed = 0;

    function setUiMode(mode, label) {
      $("idleBtns").style.display = mode === "idle" ? "flex" : "none";
      $("inBtns").style.display = mode === "incoming" ? "flex" : "none";
      $("actBtns").style.display = mode === "active" ? "flex" : "none";
      $("callState").style.display = mode === "idle" ? "none" : "block";
      if (label) $("callerText").textContent = label;
      if (mode === "active") {
        elapsed = 0;
        $("timerText").textContent = "00:00";
        clearInterval(timerHandle);
        timerHandle = setInterval(function () {
          elapsed += 1;
          $("timerText").textContent = formatTimer(elapsed);
        }, 1000);
      } else {
        clearInterval(timerHandle);
        if (mode === "incoming") $("timerText").textContent = "Gelen Çağrı...";
      }
    }

    $("fab").onclick = function () { $("card").classList.toggle("open"); };
    $("dialBtn").onclick = function () {
      var n = $("numInput").value.trim();
      if (!n) return;
      setUiMode("active", n);
      $("timerText").textContent = "Aranıyor...";
      phone.dial(n).catch(function (e) { setUiMode("idle"); alert(e.message); });
    };
    $("ansBtn").onclick = function () { phone.answer().catch(function () {}); };
    $("rejBtn").onclick = function () { phone.reject().catch(function () {}); setUiMode("idle"); };
    $("hangBtn").onclick = function () { phone.hangup().catch(function () {}); setUiMode("idle"); };
    $("muteBtn").onclick = function () {
      var muted = phone.mute(!phone._muted);
      $("muteBtn").textContent = muted ? "Sesi Aç" : "Sessiz";
    };
    $("xferBtn").onclick = function () {
      var t = prompt("Aktarılacak dahili veya numara:");
      if (t) phone.transfer(t).catch(function (e) { alert(e.message); });
    };

    phone.on("registered", function () {
      $("statusBadge").textContent = "Çevrimiçi";
      $("statusBadge").classList.add("on");
      $("fabDot").classList.add("on");
    });
    phone.on("unregistered", function () {
      $("statusBadge").textContent = "Çevrimdışı";
      $("statusBadge").classList.remove("on");
      $("fabDot").classList.remove("on");
    });
    phone.on("incomingCall", function (call) {
      $("card").classList.add("open");
      setUiMode("incoming", call.callerName || call.callerNumber);
      if (typeof options.onIncomingCall === "function") options.onIncomingCall(call);
    });
    phone.on("connected", function (call) {
      setUiMode("active", (call && (call.callerName || call.callerNumber || call.targetNumber)) || "Görüşmede");
      if (typeof options.onConnected === "function") options.onConnected(call);
    });
    phone.on("ended", function (call) {
      setUiMode("idle");
      $("muteBtn").textContent = "Sessiz";
      if (typeof options.onEnded === "function") options.onEnded(call);
    });

    phone.connect().catch(function (e) {
      $("statusBadge").textContent = "Hata";
      if (typeof console !== "undefined") console.error("[NorniaSoftphoneWidget]", e);
    });

    return {
      phone: phone,
      open: function () { $("card").classList.add("open"); },
      close: function () { $("card").classList.remove("open"); },
      destroy: function () {
        phone.disconnect();
        host.remove();
      },
    };
  }

  root.NorniaSoftphoneWidget = { mount: mount };
})(typeof self !== "undefined" ? self : this);
