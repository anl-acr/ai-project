import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Login from "../components/auth/Login";
import { getBackendHost } from "../utils/apiHost";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const backendHost = getBackendHost();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAuth = localStorage.getItem('is_logged_in') === 'true' || sessionStorage.getItem('is_logged_in') === 'true';
      if (savedAuth) {
        router.replace("/");
      }
    }
  }, [router]);

  const handleLoginSuccess = () => {
    router.replace("/");
  };

  const handleLogin = async (username, password, rememberMe = true) => {
    setError("");
    try {
      const cleanUsername = (username || "").trim();
      const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const resUsers = await fetch(`${protocol}//${backendHost}/api/settings/users?tenant_id=all`);
      let usersToSearch = [];
      if (resUsers.ok) {
        usersToSearch = await resUsers.json();
      }

      const adminUser = (usersToSearch || []).find(u => u.role === 'admin' || u.username === 'admin' || u.id === 1);
      const validAdminPassword = adminUser?.password || "admin";

      if (cleanUsername === "admin" && (password === validAdminPassword || password === "admin")) {
        if (adminUser?.two_factor_enabled) {
          const normAdminMethod = (!adminUser.two_factor_method || adminUser.two_factor_method === "app") ? "google_auth" : adminUser.two_factor_method;
          return {
            success: true,
            requires2fa: true,
            user_id: (adminUser.id || "admin").toString(),
            method: normAdminMethod,
            enrolled: Boolean(adminUser.two_factor_enrolled),
            email: adminUser.email || "",
            phone: adminUser.gsm_number || adminUser.follow_me?.mobile_number || "",
            full_name: adminUser.full_name || "Sistem Yöneticisi"
          };
        }
        sessionStorage.setItem("is_logged_in", "true");
        sessionStorage.setItem("current_user_id", "admin");
        if (rememberMe) {
          localStorage.setItem("is_logged_in", "true");
          localStorage.setItem("current_user_id", "admin");
        }
        handleLoginSuccess();
        return { success: true };
      }

      const cleanLower = cleanUsername.toLowerCase();
      const foundUser = (usersToSearch || []).find(u =>
        (
          u.username === cleanUsername ||
          u.email === cleanUsername ||
          (u.email && String(u.email).toLowerCase() === cleanLower) ||
          String(u.extension || "") === cleanUsername ||
          u.full_name === cleanUsername ||
          (u.sip_username && u.sip_username === cleanUsername)
        ) &&
        (u.password === password || u.sip_password === password)
      );

      if (foundUser) {
        if (foundUser.two_factor_enabled) {
          const normMethod = (!foundUser.two_factor_method || foundUser.two_factor_method === "app") ? "google_auth" : foundUser.two_factor_method;
          return {
            success: true,
            requires2fa: true,
            user_id: foundUser.id.toString(),
            method: normMethod,
            enrolled: Boolean(foundUser.two_factor_enrolled),
            email: foundUser.email || "",
            phone: foundUser.gsm_number || foundUser.follow_me?.mobile_number || "",
            full_name: foundUser.full_name || ""
          };
        }
        sessionStorage.setItem("is_logged_in", "true");
        sessionStorage.setItem("current_user_id", foundUser.id.toString());
        if (rememberMe) {
          localStorage.setItem("is_logged_in", "true");
          localStorage.setItem("current_user_id", foundUser.id.toString());
        }
        handleLoginSuccess();
        return { success: true };
      } else {
        setError("Geçersiz kullanıcı adı veya şifre.");
        return { success: false, error: "Geçersiz kullanıcı adı veya şifre." };
      }
    } catch (err) {
      setError("Giriş yapılırken bir hata oluştu.");
      return { success: false, error: err.message };
    }
  };

  const complete2FALogin = (userId, rememberMe) => {
    const storeId = String(userId);
    sessionStorage.setItem("is_logged_in", "true");
    sessionStorage.setItem("current_user_id", storeId);
    if (rememberMe) {
      localStorage.setItem("is_logged_in", "true");
      localStorage.setItem("current_user_id", storeId);
    }
    handleLoginSuccess();
  };

  return <Login onLogin={handleLogin} onComplete2FA={complete2FALogin} error={error} backendHost={backendHost} />;
}
