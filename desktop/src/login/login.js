(function () {
  const api = window.aidaDesktop;
  const hostInput = document.getElementById("hostInput");
  const recentHostsWrap = document.getElementById("recentHostsWrap");
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const togglePwdBtn = document.getElementById("togglePwdBtn");
  const eyeOpenIcon = document.getElementById("eyeOpenIcon");
  const eyeClosedIcon = document.getElementById("eyeClosedIcon");
  const rememberCheckbox = document.getElementById("rememberCheckbox");
  const loginForm = document.getElementById("loginForm");
  const loginErrorBox = document.getElementById("loginErrorBox");
  const submitLoginBtn = document.getElementById("submitLoginBtn");
  const magicUrlInput = document.getElementById("magicUrlInput");
  const magicLoginBtn = document.getElementById("magicLoginBtn");

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

  // Hydrate initial values
  if (api && api.getConfigSync) {
    const cfg = api.getConfigSync() || {};
    if (cfg.serverHost) hostInput.value = cfg.serverHost;
    if (cfg.savedUsername) usernameInput.value = cfg.savedUsername;
    rememberCheckbox.checked = cfg.rememberMe !== false;
    renderRecentHosts(cfg.recentHosts || []);
  }

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
        magicLoginBtn.textContent = "Bağlan";
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
    if (eyeOpenIcon && eyeClosedIcon) {
      if (isPwd) {
        eyeOpenIcon.classList.add("hidden");
        eyeClosedIcon.classList.remove("hidden");
      } else {
        eyeOpenIcon.classList.remove("hidden");
        eyeClosedIcon.classList.add("hidden");
      }
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginErrorBox.classList.add("hidden");

    submitLoginBtn.disabled = true;
    submitLoginBtn.textContent = "Giriş Yapılıyor...";

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
        submitLoginBtn.textContent = "Giriş Yap";
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
      submitLoginBtn.textContent = "Giriş Yap";
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
