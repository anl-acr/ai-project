import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Login from "../components/auth/Login";
import { getBackendHost } from "../utils/apiHost";
import {
  persistAuthenticatedSession,
  saveRememberedCredentials,
  setAuthToken
} from "../utils/authStorage";
import {
  getDeviceKeySync,
  getClientBrowserAndOs,
  verifyUserDeviceAccess
} from "../utils/deviceIdentity";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const backendHost = getBackendHost();
  const pending2faUserRef = React.useRef(null);

  const build2faPayloadFromUser = (u, fallbackUid = "admin") => {
    const tfMeta = u?.call_panel_prefs?.twoFactorMeta && typeof u.call_panel_prefs.twoFactorMeta === "object"
      ? u.call_panel_prefs.twoFactorMeta
      : null;
    const rawMethod = u?.two_factor_method || tfMeta?.method || "google_auth";
    const normMethod = !rawMethod || rawMethod === "app" ? "google_auth" : rawMethod;
    const rawList = Array.isArray(u?.two_factor_active_methods)
      ? u.two_factor_active_methods
      : Array.isArray(tfMeta?.active_methods)
        ? tfMeta.active_methods
        : [];
    const validIds = ["email", "whatsapp", "google_auth", "microsoft_auth"];
    const activeMethods = [];
    rawList.forEach((item) => {
      const s = String(item || "").trim().toLowerCase();
      const nm = s === "app" ? "google_auth" : s;
      if (validIds.includes(nm) && !activeMethods.includes(nm)) {
        activeMethods.push(nm);
      }
    });
    if (activeMethods.length === 0) {
      activeMethods.push(validIds.includes(normMethod) ? normMethod : "google_auth");
    }
    const rawMode = String(u?.two_factor_multi_mode || tfMeta?.multi_mode || "").trim().toLowerCase();
    const multiMode = activeMethods.length <= 1 ? "single" : (rawMode === "any" ? "any" : "all");
    const methodsMap = tfMeta?.methods && typeof tfMeta.methods === "object" ? tfMeta.methods : {};
    const firstMethod = activeMethods[0];
    const firstEnrolled =
      methodsMap[firstMethod] && typeof methodsMap[firstMethod] === "object"
        ? Boolean(methodsMap[firstMethod].enrolled)
        : Boolean(u?.two_factor_enrolled ?? tfMeta?.enrolled);

    pending2faUserRef.current = u;
    return {
      success: true,
      requires2fa: true,
      user_id: String(u?.id ?? fallbackUid),
      method: firstMethod,
      active_methods: activeMethods,
      multi_mode: multiMode,
      methods_map: methodsMap,
      enrolled: firstEnrolled,
      email: u?.email || "",
      phone: u?.gsm_number || u?.follow_me?.mobile_number || tfMeta?.phone || "",
      full_name: u?.full_name || "Sistem Yöneticisi"
    };
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search || "");
      const appToken = params.get("app_token");
      if (appToken) {
        const protocol = window.location.protocol || "http:";
        fetch(`${protocol}//${backendHost}/api/auth/app-magic-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: appToken,
            url: window.location.href,
            platform: window.aidaDesktop ? "desktop" : "web"
          })
        })
          .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
          .then(({ ok, data }) => {
            if (ok && data?.status === "success" && data?.user) {
              if (data.access_token) {
                setAuthToken(data.access_token, true);
              }
              persistAuthenticatedSession(String(data.user.id), true, data.user);
              sessionStorage.setItem("aida_just_logged_in", "1");
              router.replace("/");
            } else {
              setError(data?.detail || "Kolay giriş bağlantısı geçersiz veya süresi dolmuş.");
            }
          })
          .catch(() => {
            setError("Kolay giriş bağlantısı doğrulanırken hata oluştu.");
          });
        return;
      }

      const hasPersistentAuth =
        localStorage.getItem("is_logged_in") === "true" &&
        Boolean(localStorage.getItem("current_user_id"));
      const hasSessionAuth =
        sessionStorage.getItem("is_logged_in") === "true" &&
        Boolean(sessionStorage.getItem("current_user_id"));
      if (hasPersistentAuth || hasSessionAuth) {
        router.replace("/");
        return;
      }

      // Fresh installation check: redirect to /setup if out-of-box setup is not yet completed
      const proto = window.location.protocol || "http:";
      fetch(`${proto}//${backendHost}/api/setup/status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.setup_completed === false) {
            router.replace("/setup");
          }
        })
        .catch(() => {});
    }
  }, [router, backendHost]);

  const handleLoginSuccess = () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("aida_just_logged_in", "1");
      }
    } catch (e) {}
    router.replace("/");
  };

  const handleLogin = async (username, password, rememberMe = true, tenantCode = "") => {
    setError("");
    try {
      const cleanUsername = (username || "").trim();
      const cleanTenantCode = (tenantCode || "").trim();
      const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const curDk = getDeviceKeySync();
      const res = await fetch(`${protocol}//${backendHost}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(curDk ? { "X-Device-Key": curDk } : {})
        },
        body: JSON.stringify({
          username: cleanUsername,
          password: password || "",
          remember_me: Boolean(rememberMe),
          device_key: curDk || undefined,
          tenant_code: cleanTenantCode || undefined,
          client_type: "web"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.detail || "Geçersiz kullanıcı adı veya şifre.";
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      if (data.requires_2fa && data.user) {
        const enriched2faUser = {
          ...data.user,
          tenant_id: data.tenant_id || data.user.tenant_id || "tenant-default",
          is_provider_root: Boolean(data.is_provider_root)
        };
        const p = build2faPayloadFromUser(enriched2faUser, enriched2faUser.id || "admin");
        return {
          ...p,
          two_factor_token: data.two_factor_token || ""
        };
      }

      const loggedUser = {
        ...(data.user || { id: "admin", username: cleanUsername, role: "admin" }),
        tenant_id: data.tenant_id || data.user?.tenant_id || "tenant-default",
        is_provider_root: Boolean(data.is_provider_root)
      };
      if (data.access_token) {
        setAuthToken(data.access_token, rememberMe);
      }
      const storeId = String(loggedUser.id ?? "admin");
      persistAuthenticatedSession(storeId, rememberMe, loggedUser, Boolean(data.is_provider_root));
      saveRememberedCredentials(cleanUsername, "", rememberMe);
      handleLoginSuccess();
      return { success: true };
    } catch (err) {
      setError("Giriş yapılırken bir hata oluştu.");
      return { success: false, error: err.message };
    }
  };

  const complete2FALogin = (userId, rememberMe) => {
    const storeId = String(userId);
    const pendingU = pending2faUserRef.current || undefined;
    persistAuthenticatedSession(storeId, rememberMe, pendingU, typeof pendingU?.is_provider_root === "boolean" ? pendingU.is_provider_root : null);
    handleLoginSuccess();
  };

  return <Login onLogin={handleLogin} onComplete2FA={complete2FALogin} error={error} backendHost={backendHost} />;
}
