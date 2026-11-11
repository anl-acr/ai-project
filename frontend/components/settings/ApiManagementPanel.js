import React, { useState, useEffect, useMemo } from "react";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Trash2,
  Edit2,
  RotateCcw,
  Shield,
  BookOpen,
  Activity,
  Terminal,
  Lock,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  Download,
  Eye,
  Search
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";

export default function ApiManagementPanel({ backendHost = "localhost:8000" }) {
  const { bg, hover, text, border, ring, lightBg, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl(backendHost);

  const [activeTab, setActiveTab] = useState("keys"); // "keys" | "guide" | "logs"
  const [keys, setKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [permissionModules, setPermissionModules] = useState([]);
  const [endpointsCatalog, setEndpointsCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAllowedIps, setFormAllowedIps] = useState("");
  const [formExpiresDays, setFormExpiresDays] = useState("0");
  const [formRateLimit, setFormRateLimit] = useState("120");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");
  const [formWebhookSecret, setFormWebhookSecret] = useState("");
  const [formScopes, setFormScopes] = useState(["calls:read", "cdr:read"]);
  const [submitting, setSubmitting] = useState(false);

  // Newly Generated Raw Token Reveal Modal (Shown Once)
  const [revealedTokenObj, setRevealedTokenObj] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState("");

  // Custom Delete & Regenerate Confirmation Modals
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [regenerateTarget, setRegenerateTarget] = useState(null);
  const [clearLogsConfirm, setClearLogsConfirm] = useState(false);

  // Guide Filter
  const [guideSearch, setGuideSearch] = useState("");

  const getHeaders = () => ({
    "Content-Type": "application/json",
    "X-User-ID":
      (typeof window !== "undefined" &&
        (localStorage.getItem("current_user_id") ||
          localStorage.getItem("user_id"))) ||
      "admin",
    "X-Tenant-ID":
      (typeof window !== "undefined" &&
        (localStorage.getItem("active_tenant_id") ||
          localStorage.getItem("selected_tenant_id"))) ||
      "tenant-default"
  });

  const showToast = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/api-keys`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(Array.isArray(data.keys) ? data.keys : []);
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setPermissionModules(
          Array.isArray(data.permission_modules) ? data.permission_modules : []
        );
        setEndpointsCatalog(
          Array.isArray(data.endpoints_catalog) ? data.endpoints_catalog : []
        );
      }
    } catch (err) {
      console.error("API anahtarları yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [backendHost]);

  const allScopeCodes = useMemo(
    () =>
      permissionModules.flatMap((m) =>
        (m.actions || []).map((a) => a.code)
      ),
    [permissionModules]
  );

  const openCreateModal = () => {
    setEditingKey(null);
    setFormName("");
    setFormDesc("");
    setFormAllowedIps("");
    setFormExpiresDays("0");
    setFormRateLimit("120");
    setFormWebhookUrl("");
    setFormWebhookSecret("");
    setFormScopes(["calls:read", "cdr:read"]);
    setIsModalOpen(true);
  };

  const openEditModal = (k) => {
    setEditingKey(k);
    setFormName(k.name || "");
    setFormDesc(k.description || "");
    setFormAllowedIps(
      Array.isArray(k.allowed_ips) ? k.allowed_ips.join(", ") : ""
    );
    setFormExpiresDays("0");
    setFormRateLimit(String(k.rate_limit_per_minute || 120));
    setFormWebhookUrl(k.webhook_url || "");
    setFormWebhookSecret(k.webhook_secret || "");
    setFormScopes(Array.isArray(k.scopes) ? [...k.scopes] : []);
    setIsModalOpen(true);
  };

  const toggleScope = (code) => {
    setFormScopes((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]
    );
  };

  const selectPresetScopes = (mode) => {
    if (mode === "read_only") {
      setFormScopes(allScopeCodes.filter((c) => c.endsWith(":read")));
    } else if (mode === "full") {
      setFormScopes([...allScopeCodes]);
    } else if (mode === "crm_click_to_call") {
      setFormScopes([
        "calls:read",
        "calls:write",
        "cdr:read",
        "crm:read",
        "crm:write"
      ]);
    }
  };

  const handleSaveKey = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast("error", "Lütfen entegrasyon / uygulama adını girin.");
      return;
    }
    if (formScopes.length === 0) {
      showToast("error", "Lütfen en az bir işlem yetkisi (GET / POST / PUT / DELETE) seçin.");
      return;
    }

    setSubmitting(true);
    try {
      const ipList = formAllowedIps
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingKey) {
        const res = await fetch(`${API_BASE}/api/settings/api-keys/${editingKey.id}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim(),
            allowed_ips: ipList,
            rate_limit_per_minute: Number(formRateLimit) || 120,
            webhook_url: formWebhookUrl.trim(),
            webhook_secret: formWebhookSecret.trim(),
            scopes: formScopes
          })
        });
        if (!res.ok) throw new Error("Güncelleme başarısız oldu.");
        showToast("success", "API Anahtarı yetkileri ve güvenlik ayarları güncellendi.");
        setIsModalOpen(false);
        await fetchData();
      } else {
        const res = await fetch(`${API_BASE}/api/settings/api-keys`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim(),
            allowed_ips: ipList,
            expires_days: Number(formExpiresDays) || 0,
            rate_limit_per_minute: Number(formRateLimit) || 120,
            webhook_url: formWebhookUrl.trim(),
            webhook_secret: formWebhookSecret.trim(),
            scopes: formScopes
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "API Anahtarı oluşturulamadı.");
        setIsModalOpen(false);
        setRevealedTokenObj({
          name: data.key?.name,
          raw_token: data.raw_token
        });
        await fetchData();
      }
    } catch (err) {
      showToast("error", err.message || "İşlem sırasında hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (k) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/api-keys/${k.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ is_active: !k.is_active })
      });
      if (res.ok) {
        showToast(
          "success",
          `${k.name} anahtarı ${!k.is_active ? "Aktif" : "Pasif"} duruma getirildi.`
        );
        fetchData();
      }
    } catch (_) {}
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/api-keys/${deleteTarget.id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        showToast("success", `"${deleteTarget.name}" API Anahtarı kalıcı olarak silindi.`);
        setDeleteTarget(null);
        fetchData();
      }
    } catch (_) {
      showToast("error", "Silme işlemi başarısız oldu.");
    }
  };

  const handleConfirmRegenerate = async () => {
    if (!regenerateTarget) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/settings/api-keys/${regenerateTarget.id}/regenerate`,
        {
          method: "POST",
          headers: getHeaders()
        }
      );
      const data = await res.json();
      if (res.ok) {
        setRegenerateTarget(null);
        setRevealedTokenObj({
          name: data.key?.name,
          raw_token: data.raw_token
        });
        fetchData();
      }
    } catch (_) {
      showToast("error", "Anahtar yenileme başarısız oldu.");
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch(`${API_BASE}/api/settings/api-keys-logs`, {
        method: "DELETE",
        headers: getHeaders()
      });
      setClearLogsConfirm(false);
      setLogs([]);
      showToast("success", "API erişim günlükleri temizlendi.");
    } catch (_) {}
  };

  const copyToClipboard = (str, keyId = "token") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(str);
      if (keyId === "token") {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 3000);
      } else {
        setCopiedSnippet(keyId);
        setTimeout(() => setCopiedSnippet(""), 2500);
      }
    }
  };

  const downloadMarkdownDoc = () => {
    const lines = [
      "# AIDA PBX — Kurumsal Dış API (External REST API v1) Entegrasyon Kılavuzu",
      "",
      "## 1. Kimlik Doğrulama (Authentication / Token Gönderimi)",
      "Tüm API isteklerinde oluşturduğunuz API Anahtarını (`Token`) HTTP başlığında (`Header`) göndermeniz zorunludur:",
      "```http",
      "X-API-Key: aida_live_default_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "Content-Type: application/json",
      "```",
      "",
      "## 2. HTTP İstek Türleri (Metotların Türkçe ve Teknik Anlamları)",
      "- **Okuma / Görüntüleme (`GET`)**: Sistemde hiçbir veriyi değiştirmez; sadece rapor, liste veya ses kaydı sorgular.",
      "- **Yeni Ekleme / İşlem Başlatma (`POST`)**: Yeni kayıt (abone, kişi, randevu) ekler veya anlık eylem (Tıkla-Ara, WhatsApp mesajı, çağrı transferi) başlatır.",
      "- **Güncelleme / Düzenleme (`PUT`)**: Mevcut bir abonenin, kuyruğun veya kuralın ayarlarını değiştirir.",
      "- **Silme (`DELETE`)**: Sistemdeki bir kaydı (abone, kişi, kara liste numarası) kaldırır.",
      "",
      "## 3. Tüm API Uç Noktaları (`/api/v1/...`)"
    ];

    endpointsCatalog.forEach((cat) => {
      lines.push(`\n### ${cat.category}`);
      (cat.items || []).forEach((ep) => {
        lines.push(`#### [${ep.method_tr}] \`${ep.method} ${ep.path}\``);
        lines.push(`- **Açıklama**: ${ep.description}`);
        lines.push(`- **Gereken Yetki Kodu (Scope)**: \`${ep.scope}\``);
        if (ep.sample_body) {
          lines.push("- **Örnek Gönderilecek Veri (JSON Body)**:");
          lines.push("```json");
          lines.push(JSON.stringify(ep.sample_body, null, 2));
          lines.push("```");
        }
      });
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AIDA_PBX_API_Entegrasyon_Kilavuzu_v1.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPostmanCollection = (preFilledToken = "") => {
    const originUrl =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://aida.saphira.com.tr";
    const apiKeyValue =
      typeof preFilledToken === "string" && preFilledToken.trim()
        ? preFilledToken.trim()
        : "BURAYA_API_TOKEN_YAPISTIRIN";

    const folderItems = (endpointsCatalog || []).map((cat) => ({
      name: cat.category,
      item: (cat.items || []).map((ep) => {
        const cleanPath = String(ep.path || "").replace(/^\/+/, "");
        const pathParts = cleanPath.split("/").filter(Boolean);
        const reqObj = {
          method: ep.method,
          header: [
            {
              key: "X-API-Key",
              value: "{{api_key}}",
              type: "text",
              description: "AIDA PBX Kurumsal API Anahtarı (Token)"
            },
            {
              key: "Content-Type",
              value: "application/json",
              type: "text"
            }
          ],
          url: {
            raw: `{{base_url}}${ep.path}`,
            host: ["{{base_url}}"],
            path: pathParts
          },
          description: `${ep.description}\n\nİşlem Türü: ${ep.method_tr}\nGereken Yetki (Scope): ${ep.scope}`
        };

        if (ep.sample_body) {
          reqObj.body = {
            mode: "raw",
            raw: JSON.stringify(ep.sample_body, null, 2),
            options: {
              raw: {
                language: "json"
              }
            }
          };
        }

        return {
          name: `${ep.title} — [${ep.method_tr}]`,
          request: reqObj,
          response: []
        };
      })
    }));

    const collectionJson = {
      info: {
        _postman_id: "aida-pbx-external-api-v1-collection",
        name: "AIDA PBX — Kurumsal Dış API (v1) Hazır Test Koleksiyonu",
        description:
          "AIDA PBX santral sisteminin tüm dış API (v1) uç noktalarını (Okuma/GET, Ekleme-Başlatma/POST, Güncelleme/PUT, Silme/DELETE) içeren hazır Postman koleksiyonu.",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      variable: [
        {
          key: "base_url",
          value: originUrl,
          type: "string"
        },
        {
          key: "api_key",
          value: apiKeyValue,
          type: "string"
        }
      ],
      item: folderItems
    };

    const blob = new Blob([JSON.stringify(collectionJson, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AIDA_PBX_Postman_Collection_v1.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      "success",
      "Postman Koleksiyonu (.json) indirildi! Postman'de Sol Üstten 'Import' butonuna basıp dosyayı seçebilirsiniz."
    );
  };

  const getMethodBadgeStyle = (method) => {
    const m = String(method || "").toUpperCase();
    if (m === "GET")
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    if (m === "POST")
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
    if (m === "PUT" || m === "PATCH")
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    if (m === "DELETE")
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
    return "bg-slate-500/10 text-slate-600 border-slate-500/30";
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl ${lightBg} ${text} shrink-0`}>
              <KeyRound size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Kurumsal Dış API & Anahtar (Token) Yönetimi
                </h2>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${lightBg} ${text} border ${borderLight}`}
                >
                  REST API v1 • SHA-256 Token & IP Korumalı
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dış yazılımların (CRM, ERP, Çağrı Merkezi, Mobil Uygulama) santralinize güvenli bağlanması için API Anahtarı (Token) üretin,{" "}
                <strong>Okuma (GET)</strong>, <strong>Ekleme/Düzenleme (POST/PUT)</strong> ve{" "}
                <strong>Silme (DELETE)</strong> yetkilerini belirleyin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => downloadPostmanCollection("")}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border ${borderLight} ${lightBg} ${text} hover:opacity-90 flex items-center gap-1.5 transition-all shadow-sm`}
              title="Postman programına tek tıkla aktarmak (Import) için hazır JSON koleksiyonunu indir"
            >
              <Download size={14} />
              <span>Postman Koleksiyonu İndir (.json)</span>
            </button>
            <button
              type="button"
              onClick={downloadMarkdownDoc}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition-all"
              title="Yazılımcılara göndermek için Türkçe + Teknik API Dokümanını İndir"
            >
              <Download size={14} className={text} />
              <span>API Kılavuzunu İndir (.md)</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              title="Yeni API Anahtarı (Token) Oluştur"
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-8 w-8 flex items-center justify-center shrink-0 shadow-sm transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* HTTP Method Legend Bar (Türkçe + Parantez İçinde Teknik Anlamları) */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              GET
            </span>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                Okuma / Görüntüleme (GET)
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Sadece bilgi, liste ve ses kaydı çeker
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
              POST
            </span>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                Yeni Ekleme / Başlatma (POST)
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Kayıt ekler veya Tıkla-Ara çağrı başlatır
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
              PUT
            </span>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                Güncelleme / Düzenleme (PUT)
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Mevcut abone, kuyruk veya kuralı değiştirir
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
              DELETE
            </span>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                Kayıt Silme (DELETE)
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Abone, kişi veya kural kaydını siler
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
            feedback.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            {feedback.type === "error" ? (
              <AlertTriangle size={16} />
            ) : (
              <CheckCircle size={16} />
            )}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("keys")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
            activeTab === "keys"
              ? `${bg} text-white shadow-sm`
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <KeyRound size={14} />
          <span>API Anahtarları & Yetkiler ({keys.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("guide")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
            activeTab === "guide"
              ? `${bg} text-white shadow-sm`
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <BookOpen size={14} />
          <span>Türkçe & Teknik API Dokümantasyonu (Rehber)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
            activeTab === "logs"
              ? `${bg} text-white shadow-sm`
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Activity size={14} />
          <span>Canlı API Erişim & Güvenlik Günlüğü ({logs.length})</span>
        </button>
      </div>

      {/* TAB 1: API KEYS LIST */}
      {activeTab === "keys" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          {keys.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div
                className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${lightBg} ${text}`}
              >
                <KeyRound size={24} />
              </div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-white">
                Henüz Oluşturulmuş Bir API Anahtarı (Token) Bulunmuyor
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Dış yazılımların (CRM, ERP, Özel Yazılım) santralinize güvenli bağlanabilmesi için sağ üstteki{" "}
                <strong>+</strong> butonuna basarak ilk API Anahtarınızı oluşturun.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {k.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          k.is_active
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {k.is_active ? "Aktif" : "Pasif (Donduruldu)"}
                      </span>
                      <code className="px-2.5 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                        {k.masked_preview}
                      </code>
                    </div>

                    {k.description && (
                      <p className="text-xs text-slate-500">{k.description}</p>
                    )}

                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Globe size={12} />
                        <strong>İzinli IP:</strong>{" "}
                        {Array.isArray(k.allowed_ips) && k.allowed_ips.length > 0
                          ? k.allowed_ips.join(", ")
                          : "Tüm IP'ler (Kısıtlama Yok)"}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Hız Limiti:</strong> {k.rate_limit_per_minute || 120} istek/dk
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Son Kullanım:</strong>{" "}
                        {k.last_used_at
                          ? `${k.last_used_at} (${k.last_used_ip || "-"})`
                          : "Henüz kullanılmadı"}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Toplam İstek:</strong> {k.usage_count || 0}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(k.scopes || []).map((sc) => {
                        const isRead = sc.endsWith(":read");
                        const isWrite = sc.endsWith(":write");
                        const isDelete = sc.endsWith(":delete");
                        return (
                          <span
                            key={sc}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isRead
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                : isWrite
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                : isDelete
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {sc}{" "}
                            {isRead
                              ? "(Okuma / GET)"
                              : isWrite
                              ? "(Ekle-Düzenle / POST-PUT)"
                              : isDelete
                              ? "(Silme / DELETE)"
                              : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(k)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      {k.is_active ? "Pasife Al" : "Aktifleştir"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(k)}
                      title="Yetkileri ve IP Kısıtlamasını Düzenle"
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegenerateTarget(k)}
                      title="Yeni Token Üret (Eski Anahtarı İptal Eder)"
                      className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(k)}
                      title="API Anahtarını Sil"
                      className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INTERACTIVE TURKISH + TECHNICAL API DOCUMENTATION */}
      {activeTab === "guide" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Terminal size={16} className={text} />
                  Nasıl Bağlanılır? (Kimlik Doğrulama & Başlık Bilgisi)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Karşı tarafın yazılımcısı her istekte oluşturduğunuz Token anahtarını{" "}
                  <code>X-API-Key</code> başlığı (Header) içinde göndermelidir.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={guideSearch}
                  onChange={(e) => setGuideSearch(e.target.value)}
                  placeholder="İşlem veya adres ara (Örn: Tıkla-Ara, CDR)..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
              <div className="text-slate-400 mb-1">
                # Örnek Tıkla-Ara (Click-to-Call - Yeni İşlem Başlatma / POST) İsteği:
              </div>
              <code>
                curl -X POST https://SANTRAL_ADRESINIZ/api/v1/calls/originate \
                <br />
                &nbsp;&nbsp;-H &quot;X-API-Key: aida_live_default_SIZIN_ANAHTARINIZ&quot; \
                <br />
                &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \
                <br />
                &nbsp;&nbsp;-d &apos;&#123;&quot;extension&quot;: &quot;1000&quot;, &quot;destination&quot;: &quot;05321234567&quot;&#125;&apos;
              </code>
            </div>
          </div>

          {endpointsCatalog.map((cat, idx) => {
            const q = guideSearch.trim().toLowerCase();
            const filteredItems = (cat.items || []).filter(
              (it) =>
                !q ||
                it.title.toLowerCase().includes(q) ||
                it.path.toLowerCase().includes(q) ||
                it.description.toLowerCase().includes(q) ||
                it.method_tr.toLowerCase().includes(q)
            );
            if (filteredItems.length === 0) return null;

            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                  {cat.category}
                </h4>

                <div className="space-y-3">
                  {filteredItems.map((ep, epIdx) => {
                    const curlCmd = ep.sample_body
                      ? `curl -X ${ep.method} "${API_BASE}${ep.path}" -H "X-API-Key: TOKEN_BURAYA" -H "Content-Type: application/json" -d '${JSON.stringify(
                          ep.sample_body
                        )}'`
                      : `curl -X ${ep.method} "${API_BASE}${ep.path}" -H "X-API-Key: TOKEN_BURAYA"`;

                    return (
                      <div
                        key={epIdx}
                        className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold border ${getMethodBadgeStyle(
                                ep.method
                              )}`}
                            >
                              {ep.method_tr}
                            </span>
                            <code className="text-xs font-mono font-bold text-slate-900 dark:text-white bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded">
                              {ep.path}
                            </code>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500">
                              Yetki Kodu: <code>{ep.scope}</code>
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(curlCmd, ep.path)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 flex items-center gap-1"
                            >
                              {copiedSnippet === ep.path ? (
                                <>
                                  <Check size={12} className="text-emerald-500" />
                                  <span>Kopyalandı</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Örnek Kodu Kopyala</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {ep.title}
                        </div>
                        <p className="text-xs text-slate-500">{ep.description}</p>

                        {ep.sample_body && (
                          <pre className="p-2.5 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto">
                            {JSON.stringify(ep.sample_body, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: LIVE API ACCESS & AUDIT LOGS */}
      {activeTab === "logs" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Son Gelen Dış API İstekleri & Güvenlik Denetim Günlüğü
              </h3>
              <p className="text-xs text-slate-500">
                Dış yazılımlardan gelen başarılı (`200`) ve yetkisiz/hatalı (`401`, `403`, `429`) tüm istekler anlık olarak burada listelenir.
              </p>
            </div>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => setClearLogsConfirm(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Günlüğü Temizle</span>
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              Henüz kaydedilmiş bir dış API isteği bulunmuyor.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3 font-extrabold">Tarih / Saat</th>
                    <th className="py-2.5 px-3 font-extrabold">Entegrasyon / Anahtar</th>
                    <th className="py-2.5 px-3 font-extrabold">İşlem Türü (Metot)</th>
                    <th className="py-2.5 px-3 font-extrabold">Çağrılan Adres (Endpoint)</th>
                    <th className="py-2.5 px-3 font-extrabold">Kaynak IP</th>
                    <th className="py-2.5 px-3 font-extrabold">Durum & Açıklama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((lg) => (
                    <tr key={lg.id}>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {lg.timestamp}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                        {lg.key_name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${getMethodBadgeStyle(
                            lg.method
                          )}`}
                        >
                          {lg.method_label || lg.method}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {lg.path}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {lg.client_ip}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-bold ${
                            lg.status_code === 200
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          HTTP {lg.status_code} — {lg.detail}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT API KEY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveKey}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${lightBg} ${text}`}>
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {editingKey
                      ? `API Anahtarı Düzenle: ${editingKey.name}`
                      : "Yeni Dış API Anahtarı (Token) Oluştur"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bağlanacak dış sistemin adını, IP güvenliğini ve yapabileceği işlemleri (GET / POST / PUT / DELETE) seçin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Entegrasyon / Yazılım Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Örn: Logo ERP, Özel CRM, Mobil Uygulama"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Açıklama / Not (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Örn: Müşteri kartından Tıkla-Ara ve CDR çekimi için"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  İzin Verilen Sunucu IP Adresleri (IP Whitelist - Opsiyonel)
                </label>
                <input
                  type="text"
                  value={formAllowedIps}
                  onChange={(e) => setFormAllowedIps(e.target.value)}
                  placeholder="Boş = Tüm IP'ler | Örn: 195.175.40.12, 10.0.0.0/24"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <span className="text-[10px] text-slate-400">
                  Yazılırsa sadece bu IP adreslerinden gelen API istekleri kabul edilir.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {!editingKey && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Geçerlilik Süresi
                    </label>
                    <select
                      value={formExpiresDays}
                      onChange={(e) => setFormExpiresDays(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      <option value="0">Süresiz</option>
                      <option value="30">30 Gün</option>
                      <option value="90">90 Gün (3 Ay)</option>
                      <option value="180">180 Gün (6 Ay)</option>
                      <option value="365">1 Yıl (365 Gün)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dakikalık İstek Limiti
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={formRateLimit}
                    onChange={(e) => setFormRateLimit(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Canlı Olay Bildirimi (Webhook URL - Opsiyonel)
                </label>
                <input
                  type="url"
                  value={formWebhookUrl}
                  onChange={(e) => setFormWebhookUrl(e.target.value)}
                  placeholder="Örn: https://crm.sirketiniz.com/api/pbx-events"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <span className="text-[10px] text-slate-400">
                  Çağrı çaldığında, açıldığında veya kapandığında anlık bildirim (POST) gönderilir.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Webhook Güvenlik İmzası (HMAC Secret - Opsiyonel)
                </label>
                <input
                  type="text"
                  value={formWebhookSecret}
                  onChange={(e) => setFormWebhookSecret(e.target.value)}
                  placeholder="Örn: whsec_gizli_imza_anahtari_2026"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <span className="text-[10px] text-slate-400">
                  X-AIDA-Signature başlığıyla HMAC-SHA256 doğrulaması sağlar.
                </span>
              </div>
            </div>

            {/* Granular Permissions Selection */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Shield size={15} className={text} />
                  Modül Bazlı İşlem Yetkileri (Türkçe & Teknik HTTP Karşılıkları)
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => selectPresetScopes("read_only")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  >
                    Sadece Okuma / Görüntüleme (GET) Seç
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPresetScopes("crm_click_to_call")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                  >
                    Standart CRM (Tıkla-Ara + CDR + Rehber)
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPresetScopes("full")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  >
                    Tüm Yetkileri Seç
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {permissionModules.map((mod) => (
                  <div
                    key={mod.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 space-y-2"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {mod.title}
                      </div>
                      <div className="text-[11px] text-slate-500">{mod.description}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      {(mod.actions || []).map((act) => {
                        const checked = formScopes.includes(act.code);
                        return (
                          <label
                            key={act.code}
                            className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                              checked
                                ? `${lightBg} ${border} ring-1 ${ring}`
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleScope(act.code)}
                              className="mt-0.5 rounded"
                            />
                            <div>
                              <div className="font-extrabold text-slate-800 dark:text-slate-100">
                                {act.label}
                              </div>
                              <div className="text-[10px] text-slate-500 leading-snug mt-0.5">
                                {act.desc}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover}`}
              >
                {submitting
                  ? "Kaydediliyor..."
                  : editingKey
                  ? "Değişiklikleri Kaydet"
                  : "API Anahtarını (Token) Üret"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ONE-TIME RAW TOKEN REVEAL MODAL */}
      {revealedTokenObj && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-500">
                <CheckCircle size={24} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  API Anahtarınız (Token) Oluşturuldu!
                </h4>
                <p className="text-xs text-slate-500">
                  {revealedTokenObj.name}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 font-semibold leading-relaxed">
              Güvenlik gereği bu anahtar sistemde şifrelenerek (SHA-256) saklanır ve{" "}
              <strong>sadece şu an 1 kez</strong> tam olarak görüntülenir. Lütfen pencereyi kapatmadan önce kopyalayıp güvenli bir yere kaydedin.
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs break-all border border-slate-800 flex items-center justify-between gap-3">
              <span>{revealedTokenObj.raw_token}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(revealedTokenObj.raw_token, "token")}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-extrabold text-xs shrink-0 flex items-center gap-1.5"
              >
                {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedToken ? "Kopyalandı!" : "Kopyala"}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => downloadPostmanCollection(revealedTokenObj.raw_token)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-extrabold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 flex items-center justify-center gap-1.5"
              >
                <Download size={14} />
                <span>Bu Token İle Hazır Postman Koleksiyonu İndir (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => setRevealedTokenObj(null)}
                className={`w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover}`}
              >
                Kopyaladım, Pencereyi Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="API Anahtarını (Token) Sil"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" (${deleteTarget.masked_preview}) anahtarını silmek istediğinize emin misiniz? Bu anahtarı kullanan dış yazılımlar (CRM/ERP) anında bağlantıyı kaybedecektir.`
            : ""
        }
      />

      {/* CUSTOM DELETE CONFIRMATION FOR REGENERATE */}
      <ConfirmDeleteModal
        isOpen={Boolean(regenerateTarget)}
        onClose={() => setRegenerateTarget(null)}
        onConfirm={handleConfirmRegenerate}
        title="API Anahtarını Yenile (Eski Token İptal Edilir)"
        message={
          regenerateTarget
            ? `"${regenerateTarget.name}" için yeni bir Token üretilecek ve mevcut kullanılan eski Token anında geçersiz olacaktır. Devam etmek istiyor musunuz?`
            : ""
        }
      />

      {/* CUSTOM DELETE CONFIRMATION FOR LOGS */}
      <ConfirmDeleteModal
        isOpen={clearLogsConfirm}
        onClose={() => setClearLogsConfirm(false)}
        onConfirm={handleClearLogs}
        title="API Erişim Günlüğünü Temizle"
        message="Tüm dış API erişim ve güvenlik kayıtlarını temizlemek istediğinize emin misiniz?"
      />
    </div>
  );
}
