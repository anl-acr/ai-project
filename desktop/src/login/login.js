(function () {
  const api = window.aidaDesktop;
  const hostInput = document.getElementById("hostInput");
  const probeHostBtn = document.getElementById("probeHostBtn");
  const hostProbeBadge = document.getElementById("hostProbeBadge");
  const recentHostsWrap = document.getElementById("recentHostsWrap");
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const togglePwdBtn = document.getElementById("togglePwdBtn");
  const rememberCheckbox = document.getElementById("rememberCheckbox");
  const loginForm = document.getElementById("loginForm");
  const loginErrorBox = document.getElementById("loginErrorBox");
  const submitLoginBtn = document.getElementById("submitLoginBtn");
  const appVersionBadge = document.getElementById("appVersionBadge");
  const magicUrlInput = document.getElementById("magicUrlInput");
  const magicLoginBtn = document.getElementById("magicLoginBtn");

  const toggleHwBtn = document.getElementById("toggleHwBtn");
  const hwPanel = document.getElementById("hwPanel");
  const hwChevron = document.getElementById("hwChevron");
  const hwCountText = document.getElementById("hwCountText");
  const micSelect = document.getElementById("micSelect");
  const spkSelect = document.getElementById("spkSelect");
  const ringSpkSelect = document.getElementById("ringSpkSelect");

  const twoFactorForm = document.getElementById("twoFactorForm");
  const twoFaDesc = document.getElementById("twoFaDesc");
  const twoFaCodeInput = document.getElementById("twoFaCodeInput");
  const twoFaErrorBox = document.getElementById("twoFaErrorBox");
  const backToLoginBtn = document.getElementById("backToLoginBtn");
  const resend2faBtn = document.getElementById("resend2faBtn");
  const verify2faBtn = document.getElementById("verify2faBtn");

  let pending2faContext = null;

  function renderRecentHosts(list) {
    if (!Array.isArray(list) || list.length === 0) {
      recentHostsWrap.classList.add("hidden");
      recentHostsWrap.innerHTML = "";
      return;
    }
    recentHostsWrap.classList.remove("hidden");
    recentHostsWrap.innerHTML = "";
    list.forEach((h) => {
      const chip = document.createElement("span");
      chip.className = "host-chip";
      const label = document.createElement("span");
      label.textContent = h;
      label.addEventListener("click", () => {
        hostInput.value = h;
        runHostProbe(h);
      });

      const del = document.createElement("span");
      del.className = "remove-chip";
      del.textContent = "×";
      del.title = "Listeden kaldır";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (api && api.removeRecentHost) {
          const res = await api.removeRecentHost(h);
          if (res && res.recentHosts) renderRecentHosts(res.recentHosts);
        }
      });

      chip.appendChild(label);
      chip.appendChild(del);
      recentHostsWrap.appendChild(chip);
    });
  }

  async function runHostProbe(hostVal) {
    const target = String(hostVal !== undefined ? hostVal : hostInput.value || "").trim();
    if (!target || !api || !api.probeHost) return;
    probeHostBtn.disabled = true;
    probeHostBtn.textContent = "Test...";
    hostProbeBadge.className = "probe-badge";
    hostProbeBadge.textContent = "Kontrol ediliyor...";

    try {
      const res = await api.probeHost(target);
      if (res && res.ok) {
        hostProbeBadge.className = "probe-badge probe-ok";
        hostProbeBadge.textContent = "✓ Bağlantı Hazır (" + (res.version || "Aktif") + ")";
      } else {
        hostProbeBadge.className = "probe-badge probe-err";
        hostProbeBadge.textContent = "✕ Ulaşılamadı";
      }
    } catch (err) {
      hostProbeBadge.className = "probe-badge probe-err";
      hostProbeBadge.textContent = "✕ Hata";
    } finally {
      probeHostBtn.disabled = false;
      probeHostBtn.textContent = "Test Et";
    }
  }

  async function loadAudioHardware(savedPrefs = {}) {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function") {
      hwCountText.textContent = "Ses donanımı oturum açıldığında yüklenecek";
      return;
    }
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      if (!devices.some((d) => d.label) && typeof navigator.mediaDevices.getUserMedia === "function") {
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } finally {
          if (stream) stream.getTracks().forEach((t) => t.stop());
        }
        devices = await navigator.mediaDevices.enumerateDevices();
      }

      const inputs = devices.filter((d) => d.kind === "audioinput");
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      hwCountText.textContent = `${inputs.length} Mikrofon • ${outputs.length} Çıkış/Çalma Aygıtı Hazır`;

      const fillSelect = (sel, list, fallbackPrefix, preferredLabel) => {
        sel.innerHTML = "";
        list.forEach((d, idx) => {
          const opt = document.createElement("option");
          opt.value = d.label || d.deviceId;
          opt.textContent = d.label || `${fallbackPrefix} ${idx + 1}`;
          if (preferredLabel && d.label === preferredLabel) {
            opt.selected = true;
          }
          sel.appendChild(opt);
        });
      };

      fillSelect(micSelect, inputs, "Mikrofon", savedPrefs.micLabel || "");
      fillSelect(spkSelect, outputs, "Kulaklık/Hoparlör", savedPrefs.speakerLabel || "");
      fillSelect(ringSpkSelect, outputs, "Hoparlör", savedPrefs.ringtoneSpeakerLabel || "");
    } catch (e) {
      hwCountText.textContent = "Ses aygıtları hazır";
    }
  }

  async function persistAudioSelection() {
    if (!api || !api.updatePreferences) return;
    await api.updatePreferences({
      audioPrefs: {
        micLabel: micSelect.value || "",
        speakerLabel: spkSelect.value || "",
        ringtoneSpeakerLabel: ringSpkSelect.value || ""
      }
    });
  }

  // Hydrate initial values
  if (api && api.getConfigSync) {
    const cfg = api.getConfigSync() || {};
    if (cfg.version) appVersionBadge.textContent = "v" + String(cfg.version).replace(/^v/i, "");
    if (cfg.serverHost) hostInput.value = cfg.serverHost;
    if (cfg.savedUsername) usernameInput.value = cfg.savedUsername;
    rememberCheckbox.checked = cfg.rememberMe !== false;
    renderRecentHosts(cfg.recentHosts || []);
    loadAudioHardware(cfg.audioPrefs || {});
    if (cfg.serverHost) {
      runHostProbe(cfg.serverHost);
    }
  } else {
    loadAudioHardware({});
  }

  if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      const cfg = api && api.getConfigSync ? api.getConfigSync() : {};
      loadAudioHardware((cfg && cfg.audioPrefs) || {});
    });
  }

  micSelect.addEventListener("change", persistAudioSelection);
  spkSelect.addEventListener("change", persistAudioSelection);
  ringSpkSelect.addEventListener("change", persistAudioSelection);

  toggleHwBtn.addEventListener("click", () => {
    const isHidden = hwPanel.classList.toggle("hidden");
    hwChevron.style.transform = isHidden ? "rotate(0deg)" : "rotate(180deg)";
  });

  probeHostBtn.addEventListener("click", () => runHostProbe());

  if (magicLoginBtn && magicUrlInput) {
    const handleMagicUrlConnect = async () => {
      const val = String(magicUrlInput.value || "").trim();
      if (!val) {
        loginErrorBox.textContent = "Lütfen Kolay Giriş Linkini (URL) yapıştırınız.";
        loginErrorBox.classList.remove("hidden");
        magicUrlInput.focus();
        return;
      }
      loginErrorBox.classList.add("hidden");
      await persistAudioSelection();
      magicLoginBtn.disabled = true;
      magicLoginBtn.textContent = "Bağlanıyor...";
      try {
        const res = await api.loginWithUrl({
          url: val,
          rememberMe: rememberCheckbox ? rememberCheckbox.checked : true
        });
        if (!res || !res.ok) {
          loginErrorBox.textContent = (res && res.error) || "Kolay giriş bağlantısı doğrulanamadı.";
          loginErrorBox.classList.remove("hidden");
        }
      } catch (err) {
        loginErrorBox.textContent = err.message || "Kolay giriş sırasında hata oluştu.";
        loginErrorBox.classList.remove("hidden");
      } finally {
        magicLoginBtn.disabled = false;
        magicLoginBtn.textContent = "Link ile Bağlan";
      }
    };

    magicLoginBtn.addEventListener("click", handleMagicUrlConnect);
    magicUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleMagicUrlConnect();
      }
    });
  }

  togglePwdBtn.addEventListener("click", () => {
    const isPwd = passwordInput.type === "password";
    passwordInput.type = isPwd ? "text" : "password";
    togglePwdBtn.textContent = isPwd ? "Gizle" : "Göster";
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginErrorBox.classList.add("hidden");
    await persistAudioSelection();

    submitLoginBtn.disabled = true;
    submitLoginBtn.textContent = "Santrale Bağlanılıyor...";

    try {
      const res = await api.login({
        host: hostInput.value,
        username: usernameInput.value,
        password: passwordInput.value,
        rememberMe: rememberCheckbox.checked
      });

      if (!res || !res.ok) {
        loginErrorBox.textContent = (res && res.error) || "Giriş başarısız oldu.";
        loginErrorBox.classList.remove("hidden");
        submitLoginBtn.disabled = false;
        submitLoginBtn.textContent = "Santrale Bağlan ve Giriş Yap";
        return;
      }

      if (res.requires2fa) {
        pending2faContext = {
          ...res,
          username: usernameInput.value.trim(),
          rememberMe: rememberCheckbox.checked
        };
        loginForm.classList.add("hidden");
        twoFactorForm.classList.remove("hidden");
        if (res.method === "email" || res.method === "whatsapp") {
          resend2faBtn.classList.remove("hidden");
          twoFaDesc.textContent =
            res.method === "whatsapp"
              ? "WhatsApp hattınıza gönderilen 6 haneli doğrulama kodunu giriniz."
              : "E-posta adresinize gönderilen 6 haneli doğrulama kodunu giriniz.";
          api.send2faCode({
            apiOrigin: res.apiOrigin,
            userId: res.userId,
            method: res.method
          });
        } else {
          resend2faBtn.classList.add("hidden");
          twoFaDesc.textContent = "Google Authenticator uygulamanızdaki 6 haneli kodu giriniz.";
        }
        twoFaCodeInput.focus();
      }
    } catch (err) {
      loginErrorBox.textContent = err.message || "Beklenmeyen bir hata oluştu.";
      loginErrorBox.classList.remove("hidden");
    } finally {
      submitLoginBtn.disabled = false;
      submitLoginBtn.textContent = "Santrale Bağlan ve Giriş Yap";
    }
  });

  backToLoginBtn.addEventListener("click", () => {
    pending2faContext = null;
    twoFactorForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  });

  resend2faBtn.addEventListener("click", async () => {
    if (!pending2faContext) return;
    resend2faBtn.disabled = true;
    await api.send2faCode({
      apiOrigin: pending2faContext.apiOrigin,
      userId: pending2faContext.userId,
      method: pending2faContext.method
    });
    setTimeout(() => {
      resend2faBtn.disabled = false;
    }, 3000);
  });

  twoFactorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pending2faContext) return;
    twoFaErrorBox.classList.add("hidden");
    verify2faBtn.disabled = true;

    try {
      const res = await api.verify2faCode({
        ...pending2faContext,
        code: twoFaCodeInput.value
      });
      if (!res || !res.ok) {
        twoFaErrorBox.textContent = (res && res.error) || "Doğrulama kodu geçersiz.";
        twoFaErrorBox.classList.remove("hidden");
      }
    } catch (err) {
      twoFaErrorBox.textContent = err.message || "Doğrulama sırasında hata oluştu.";
      twoFaErrorBox.classList.remove("hidden");
    } finally {
      verify2faBtn.disabled = false;
    }
  });
})();
