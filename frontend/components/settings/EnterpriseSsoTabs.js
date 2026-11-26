import React, { useState, useEffect } from "react";
import {
  Shield,
  KeyRound,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Play,
  Globe,
  FileCode2,
  Users,
  Lock,
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";

const OIDC_PRESETS = [
  {
    id: "entra_id",
    label: "Microsoft Entra ID (Azure AD)",
    display_name: "Microsoft ile Giriş Yap",
    discovery_url: "https://login.microsoftonline.com/<TENANT_ID>/v2.0/.well-known/openid-configuration",
    scopes: "openid profile email",
    claim_username: "preferred_username",
    claim_email: "email",
    claim_name: "name",
    claim_groups: "groups",
  },
  {
    id: "okta",
    label: "Okta Workforce Identity",
    display_name: "Okta ile Giriş Yap",
    discovery_url: "https://<DOMAIN>.okta.com/oauth2/default/.well-known/openid-configuration",
    scopes: "openid profile email groups",
    claim_username: "preferred_username",
    claim_email: "email",
    claim_name: "name",
    claim_groups: "groups",
  },
  {
    id: "keycloak",
    label: "Keycloak / RedHat SSO",
    display_name: "Keycloak SSO ile Giriş Yap",
    discovery_url: "https://sso.kurum.com/realms/<REALM>/.well-known/openid-configuration",
    scopes: "openid profile email",
    claim_username: "preferred_username",
    claim_email: "email",
    claim_name: "name",
    claim_groups: "groups",
  },
  {
    id: "google",
    label: "Google Workspace",
    display_name: "Google ile Giriş Yap",
    discovery_url: "https://accounts.google.com/.well-known/openid-configuration",
    scopes: "openid profile email",
    claim_username: "email",
    claim_email: "email",
    claim_name: "name",
    claim_groups: "groups",
  },
];

const SAML_PRESETS = [
  {
    id: "entra_id",
    label: "Microsoft Entra ID (SAML 2.0)",
    display_name: "Microsoft Entra SAML ile Giriş",
    attr_email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    attr_username: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    attr_name: "http://schemas.microsoft.com/identity/claims/displayname",
    attr_groups: "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
  },
  {
    id: "adfs",
    label: "Microsoft ADFS (On-Premise)",
    display_name: "ADFS Kurumsal Giriş",
    attr_email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    attr_username: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
    attr_name: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    attr_groups: "http://schemas.xmlsoap.org/claims/Group",
  },
  {
    id: "okta",
    label: "Okta SAML 2.0",
    display_name: "Okta SAML ile Giriş",
    attr_email: "email",
    attr_username: "username",
    attr_name: "displayName",
    attr_groups: "groups",
  },
  {
    id: "keycloak",
    label: "Keycloak SAML 2.0",
    display_name: "Keycloak SAML ile Giriş",
    attr_email: "email",
    attr_username: "username",
    attr_name: "firstName",
    attr_groups: "Role",
  },
];

export default function EnterpriseSsoTabs({ mode = "oidc", backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingOidc, setTestingOidc] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [endpoints, setEndpoints] = useState({});
  const [ssoConfig, setSsoConfig] = useState({
    oidc: {
      enabled: false,
      provider_preset: "entra_id",
      display_name: "Microsoft ile Giriş Yap",
      issuer_url: "",
      discovery_url: "",
      authorization_endpoint: "",
      token_endpoint: "",
      userinfo_endpoint: "",
      jwks_uri: "",
      client_id: "",
      client_secret: "",
      scopes: "openid profile email",
      claim_username: "preferred_username",
      claim_email: "email",
      claim_name: "name",
      claim_groups: "groups",
      auto_create_users: true,
      auto_assign_extension: true,
      extension_start_range: 1050,
      default_role: "agent",
      group_role_mapping: {},
      verify_tls: true,
    },
    saml: {
      enabled: false,
      provider_preset: "entra_id",
      display_name: "Kurumsal SAML 2.0",
      sp_entity_id: "",
      idp_entity_id: "",
      idp_sso_url: "",
      idp_slo_url: "",
      idp_x509_cert: "",
      name_id_format: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      want_assertions_signed: true,
      attr_email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      attr_username: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
      attr_name: "http://schemas.microsoft.com/identity/claims/displayname",
      attr_groups: "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
      auto_create_users: true,
      auto_assign_extension: true,
      extension_start_range: 1050,
      default_role: "agent",
      group_role_mapping: {},
    },
    allow_local_login: true,
  });

  const [newMapGroup, setNewMapGroup] = useState("");
  const [newMapRole, setNewMapRole] = useState("supervisor");

  const safeFetch = async (path, options = {}) => {
    const apiBase = getApiBaseUrl(backendHost);
    return await tenantFetch(`${apiBase}${path}`, options);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await safeFetch("/api/settings/sso");
        if (res.ok) {
          const data = await res.json();
          if (data?.config) {
            setSsoConfig((prev) => ({
              ...prev,
              ...data.config,
              oidc: { ...prev.oidc, ...(data.config.oidc || {}) },
              saml: { ...prev.saml, ...(data.config.saml || {}) },
            }));
          }
          if (data?.endpoints) setEndpoints(data.endpoints);
        }
      } catch (e) {
        console.warn("SSO settings load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [backendHost]);

  const copyText = (val, key) => {
    if (!val) return;
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 1800);
  };

  const updateSection = (sec, patch) => {
    setSsoConfig((prev) => ({
      ...prev,
      [sec]: { ...prev[sec], ...patch },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await safeFetch("/api/settings/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ssoConfig),
      });
      const data = await res.json();
      if (res.ok) {
        if (data?.config) {
          setSsoConfig((prev) => ({
            ...prev,
            ...data.config,
            oidc: { ...prev.oidc, ...(data.config.oidc || {}) },
            saml: { ...prev.saml, ...(data.config.saml || {}) },
          }));
        }
        setFeedback({ type: "success", message: "Kurumsal SSO ayarları başarıyla kaydedildi." });
      } else {
        setFeedback({ type: "error", message: data?.detail || "SSO ayarları kaydedilemedi." });
      }
    } catch (e) {
      setFeedback({ type: "error", message: "Sunucu ile bağlantı kurulamadı." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestOidcDiscovery = async () => {
    setTestingOidc(true);
    setFeedback(null);
    try {
      const res = await safeFetch("/api/settings/sso/test-oidc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discovery_url: ssoConfig.oidc.discovery_url,
          issuer_url: ssoConfig.oidc.issuer_url,
          verify_tls: ssoConfig.oidc.verify_tls,
        }),
      });
      const data = await res.json();
      if (data?.status === "success" && data?.discovered) {
        updateSection("oidc", {
          issuer_url: data.discovered.issuer_url || ssoConfig.oidc.issuer_url,
          authorization_endpoint: data.discovered.authorization_endpoint || ssoConfig.oidc.authorization_endpoint,
          token_endpoint: data.discovered.token_endpoint || ssoConfig.oidc.token_endpoint,
          userinfo_endpoint: data.discovered.userinfo_endpoint || ssoConfig.oidc.userinfo_endpoint,
          jwks_uri: data.discovered.jwks_uri || ssoConfig.oidc.jwks_uri,
        });
        setFeedback({ type: "success", message: data.message });
      } else {
        setFeedback({ type: "error", message: data?.message || "OIDC Discovery testi başarısız." });
      }
    } catch (e) {
      setFeedback({ type: "error", message: "OIDC Discovery isteği sırasında ağ hatası oluştu." });
    } finally {
      setTestingOidc(false);
    }
  };

  const addGroupMapping = (sec) => {
    const g = newMapGroup.trim();
    if (!g) return;
    const curMap = { ...(ssoConfig[sec]?.group_role_mapping || {}) };
    curMap[g] = newMapRole;
    updateSection(sec, { group_role_mapping: curMap });
    setNewMapGroup("");
  };

  const removeGroupMapping = (sec, grp) => {
    const curMap = { ...(ssoConfig[sec]?.group_role_mapping || {}) };
    delete curMap[grp];
    updateSection(sec, { group_role_mapping: curMap });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <RefreshCw size={16} className="animate-spin" />
        <span>Kurumsal SSO yapılandırması yükleniyor...</span>
      </div>
    );
  }

  const isOidc = mode === "oidc";
  const secKey = isOidc ? "oidc" : "saml";
  const secCfg = ssoConfig[secKey] || {};
  const inputCls = `w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring}`;

  return (
    <div className="space-y-5">
      {/* Top Action Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-2xl ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}>
            {isOidc ? <Globe size={22} /> : <FileCode2 size={22} />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {isOidc ? "OpenID Connect (OIDC / OAuth 2.0) SSO" : "SAML 2.0 Kurumsal SSO (Service Provider)"}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  secCfg.enabled
                    ? `${lightBg} ${text} ${borderLight}`
                    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                }`}
              >
                {secCfg.enabled ? "Aktif (Login Ekranında Görünür)" : "Pasif"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isOidc
                ? "Microsoft Entra ID (Azure AD), Okta, Keycloak ve Google Workspace üzerinden PKCE + JWKS imza doğrulamalı tek oturum açma (SSO)."
                : "ADFS, Microsoft Entra ID, Okta ve Shibboleth ile X.509 XML-DSig imza doğrulamalı SAML 2.0 kurumsal tek oturum açma."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => updateSection(secKey, { enabled: !secCfg.enabled })}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center gap-2 ${
              secCfg.enabled
                ? `${lightBg} ${borderLight} ${text}`
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${secCfg.enabled ? `${bg} animate-pulse` : "bg-slate-400"}`} />
            <span>{secCfg.enabled ? `${isOidc ? "OIDC" : "SAML 2.0"} Açık` : `${isOidc ? "OIDC" : "SAML 2.0"} Etkinleştir`}</span>
          </button>

          {isOidc && (
            <button
              type="button"
              onClick={handleTestOidcDiscovery}
              disabled={testingOidc}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {testingOidc ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} className={text} />}
              <span>Discovery Test Et</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50`}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Ayarları Kaydet</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
            feedback.type === "success"
              ? `${lightBg} ${borderLight} ${text}`
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Copyable Service Provider Endpoints Box */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <KeyRound size={13} className={text} />
          <span>{isOidc ? "IdP Tarafına Tanımlanacak Redirect (Callback) Adresi" : "IdP Tarafına Tanımlanacak Nornia SAML 2.0 SP Bilgileri"}</span>
        </div>

        {isOidc ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-200 truncate">
              {endpoints.oidc_callback_url || `${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/oidc/callback`}
            </code>
            <button
              type="button"
              onClick={() => copyText(endpoints.oidc_callback_url, "oidc_cb")}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copiedKey === "oidc_cb" ? <Check size={13} className={text} /> : <Copy size={13} />}
              <span>{copiedKey === "oidc_cb" ? "Kopyalandı" : "Kopyala"}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500">ACS (Assertion Consumer Service — HTTP-POST)</div>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-200 truncate">
                  {endpoints.saml_acs_url || "/api/auth/saml/acs"}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(endpoints.saml_acs_url, "saml_acs")}
                  className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="ACS URL Kopyala"
                >
                  {copiedKey === "saml_acs" ? <Check size={13} className={text} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500">SP Metadata XML (IdP Import)</div>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-200 truncate">
                  {endpoints.saml_metadata_url || "/api/auth/saml/metadata"}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(endpoints.saml_metadata_url, "saml_meta")}
                  className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title="Metadata URL Kopyala"
                >
                  {copiedKey === "saml_meta" ? <Check size={13} className={text} /> : <Copy size={13} />}
                </button>
                <a
                  href={`${getApiBaseUrl(backendHost)}/api/auth/saml/metadata`}
                  target="_blank"
                  rel="noreferrer"
                  className={`px-3 py-2 rounded-xl text-[11px] font-extrabold text-white ${bg} ${hover} flex items-center gap-1 shrink-0`}
                >
                  <ExternalLink size={12} />
                  <span>XML</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provider Presets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {(isOidc ? OIDC_PRESETS : SAML_PRESETS).map((preset) => {
          const active = secCfg.provider_preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (isOidc) {
                  updateSection("oidc", {
                    provider_preset: preset.id,
                    display_name: preset.display_name,
                    discovery_url: secCfg.discovery_url || preset.discovery_url,
                    scopes: preset.scopes,
                    claim_username: preset.claim_username,
                    claim_email: preset.claim_email,
                    claim_name: preset.claim_name,
                    claim_groups: preset.claim_groups,
                  });
                } else {
                  updateSection("saml", {
                    provider_preset: preset.id,
                    display_name: preset.display_name,
                    attr_email: preset.attr_email,
                    attr_username: preset.attr_username,
                    attr_name: preset.attr_name,
                    attr_groups: preset.attr_groups,
                  });
                }
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                active
                  ? `${lightBg} ${border} ring-1 ${ring}`
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className={`text-xs font-extrabold ${active ? text : "text-slate-800 dark:text-slate-100"}`}>
                {preset.label}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Hazır şablonu uygula</div>
            </button>
          );
        })}
      </div>

      {/* Main Config Form */}
      {isOidc ? (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Giriş Buton Metni</label>
            <input
              type="text"
              className={inputCls}
              value={secCfg.display_name || ""}
              onChange={(e) => updateSection("oidc", { display_name: e.target.value })}
              placeholder="Microsoft ile Giriş Yap"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">OIDC Discovery URL (.well-known/openid-configuration)</label>
            <input
              type="text"
              className={inputCls}
              value={secCfg.discovery_url || ""}
              onChange={(e) => updateSection("oidc", { discovery_url: e.target.value })}
              placeholder="https://login.microsoftonline.com/<TENANT>/v2.0/.well-known/openid-configuration"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Client ID (Application ID)</label>
            <input
              type="text"
              className={inputCls}
              value={secCfg.client_id || ""}
              onChange={(e) => updateSection("oidc", { client_id: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Client Secret</label>
            <input
              type="password"
              className={inputCls}
              value={secCfg.client_secret || ""}
              onChange={(e) => updateSection("oidc", { client_secret: e.target.value })}
              placeholder="IdP Client Secret"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Scopes</label>
            <input
              type="text"
              className={inputCls}
              value={secCfg.scopes || "openid profile email"}
              onChange={(e) => updateSection("oidc", { scopes: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Issuer URL (Discovery ile otomatik dolar)</label>
            <input
              type="text"
              className={inputCls}
              value={secCfg.issuer_url || ""}
              onChange={(e) => updateSection("oidc", { issuer_url: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Email Claim</label>
              <input type="text" className={inputCls} value={secCfg.claim_email || "email"} onChange={(e) => updateSection("oidc", { claim_email: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Username Claim</label>
              <input type="text" className={inputCls} value={secCfg.claim_username || "preferred_username"} onChange={(e) => updateSection("oidc", { claim_username: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Ad Soyad Claim</label>
              <input type="text" className={inputCls} value={secCfg.claim_name || "name"} onChange={(e) => updateSection("oidc", { claim_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Grup Claim</label>
              <input type="text" className={inputCls} value={secCfg.claim_groups || "groups"} onChange={(e) => updateSection("oidc", { claim_groups: e.target.value })} />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Giriş Buton Metni</label>
            <input
              type="text"
              className={inputCls}
              value={secCfg.display_name || ""}
              onChange={(e) => updateSection("saml", { display_name: e.target.value })}
              placeholder="Kurumsal SAML 2.0 ile Giriş"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">SP Entity ID (Boşsa Metadata URL kullanılır)</label>
            <input
              type="text"
              className={inputCls}
              value={secCfg.sp_entity_id || ""}
              onChange={(e) => updateSection("saml", { sp_entity_id: e.target.value })}
              placeholder={endpoints.saml_default_entity_id || "https://pbx.firma.com/api/auth/saml/metadata"}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">IdP SSO URL (Login Redirect Adresi)</label>
            <input
              type="text"
              className={inputCls}
              value={secCfg.idp_sso_url || ""}
              onChange={(e) => updateSection("saml", { idp_sso_url: e.target.value })}
              placeholder="https://login.microsoftonline.com/<TENANT>/saml2 veya https://adfs.kurum.com/adfs/ls/"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">IdP Entity ID (Issuer)</label>
            <input
              type="text"
              className={inputCls}
              value={secCfg.idp_entity_id || ""}
              onChange={(e) => updateSection("saml", { idp_entity_id: e.target.value })}
              placeholder="https://sts.windows.net/<TENANT>/"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              IdP X.509 İmza Sertifikası (PEM / Base64 — XML-DSig doğrulaması için)
            </label>
            <textarea
              rows={4}
              className={`${inputCls} font-mono text-[11px]`}
              value={secCfg.idp_x509_cert || ""}
              onChange={(e) => updateSection("saml", { idp_x509_cert: e.target.value })}
              placeholder="-----BEGIN CERTIFICATE-----&#10;MIID...&#10;-----END CERTIFICATE-----"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <input
              id="saml-want-signed"
              type="checkbox"
              checked={secCfg.want_assertions_signed !== false}
              onChange={(e) => updateSection("saml", { want_assertions_signed: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="saml-want-signed" className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Lock size={13} className={text} />
              <span>Zorunlu X.509 XML-DSig İmza Doğrulaması (Üretim ortamında açık bırakın)</span>
            </label>
          </div>
        </div>
      )}

      {/* JIT Provisioning & Group -> Role Mapping */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white">
          <Users size={15} className={text} />
          <span>Otomatik Hesap Oluşturma (JIT) &amp; Grup → Rol Eşleme</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(secCfg.auto_create_users)}
              onChange={(e) => updateSection(secKey, { auto_create_users: e.target.checked })}
            />
            <span>İlk SSO girişinde otomatik kullanıcı oluştur (JIT)</span>
          </label>
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(secCfg.auto_assign_extension)}
              onChange={(e) => updateSection(secKey, { auto_assign_extension: e.target.checked })}
            />
            <span>Yeni kullanıcıya boş dahili ata (Başlangıç: {secCfg.extension_start_range || 1050})</span>
          </label>
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={ssoConfig.allow_local_login !== false}
              onChange={(e) => setSsoConfig((p) => ({ ...p, allow_local_login: e.target.checked }))}
            />
            <span>Yerel şifre ile giriş seçeneğini de koru</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={newMapGroup}
            onChange={(e) => setNewMapGroup(e.target.value)}
            placeholder="IdP Grup Adı / Object ID (örn: Nornia-Admins veya CagriMerkezi-Lider)"
          />
          <select
            className={`${inputCls} sm:w-44`}
            value={newMapRole}
            onChange={(e) => setNewMapRole(e.target.value)}
          >
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="agent">Temsilci (Agent)</option>
          </select>
          <button
            type="button"
            onClick={() => addGroupMapping(secKey)}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} cursor-pointer shrink-0`}
          >
            Eşleme Ekle
          </button>
        </div>

        {Object.keys(secCfg.group_role_mapping || {}).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(secCfg.group_role_mapping).map(([grp, r]) => (
              <span
                key={grp}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${lightBg} ${borderLight} ${text}`}
              >
                <span>{grp} → {r}</span>
                <button
                  type="button"
                  onClick={() => removeGroupMapping(secKey, grp)}
                  className="hover:opacity-70 cursor-pointer font-black"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
