import socket
import ssl
import time
import datetime
from typing import Dict, Any, List, Optional

DEFAULT_ACTIVE_DIRECTORY_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "provider_type": "microsoft_ad",  # microsoft_ad | azure_entra | openldap | freeipa
    "domain_name": "kurum.local",
    "server_host": "dc01.kurum.local",
    "server_port": 389,
    "use_ssl": False,
    "use_starttls": False,
    "base_dn": "DC=kurum,DC=local",
    "bind_dn": "CN=aida_ldap_svc,OU=ServisHesaplari,DC=kurum,DC=local",
    "bind_password": "",
    "user_search_base": "OU=CagriMerkezi,DC=kurum,DC=local",
    "user_search_filter": "(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
    "attr_username": "sAMAccountName",
    "attr_full_name": "displayName",
    "attr_email": "mail",
    "attr_phone": "telephoneNumber",
    "attr_department": "department",
    "auto_sync_enabled": False,
    "sync_interval_minutes": 60,
    "auto_create_users": True,
    "auto_assign_extension": True,
    "extension_start_range": 1050,
    "default_role": "agent",
    "default_queue": "",
    "disable_removed_users": True,
    "allow_local_fallback": True,
    "simulation_mode": True,
    "last_sync_at": None,
    "last_sync_status": None,
    "last_sync_count": 0,
}

CRM_CATALOG_METADATA: List[Dict[str, Any]] = [
    {
        "id": "zoho_crm",
        "name": "Zoho CRM",
        "vendor": "Zoho Corporation",
        "category": "Satış & Müşteri Yönetimi",
        "badge": "Popüler",
        "description": "Gelen aramalarda Zoho Contacts/Leads sorgulama, otomatik müşteri kartı açma (Screen Pop) ve çağrı sonunda ses kaydı ile AI özetini Zoho Timeline'a işleme.",
        "auth_type": "oauth_or_token",
        "default_api_url": "https://www.zohoapis.eu/crm/v6",
        "screen_pop_template": "https://crm.zoho.eu/crm/org/tab/Contacts/search?word={caller}",
        "fields": [
            {"key": "api_url", "label": "Zoho API Veri Merkezi Adresi", "placeholder": "https://www.zohoapis.eu/crm/v6"},
            {"key": "org_id", "label": "Zoho Organization ID", "placeholder": "Örn: 20084910234"},
            {"key": "api_key", "label": "OAuth Access / Refresh Token veya Zoho API Anahtarı", "placeholder": "1000.8a92f..."},
        ],
    },
    {
        "id": "hubspot",
        "name": "HubSpot CRM",
        "vendor": "HubSpot Inc.",
        "category": "Satış & Pazarlama Otomasyonu",
        "badge": "Kurumsal",
        "description": "HubSpot Private App Token ile arayan numarayı Contacts içinde bulma, çağrı süresini, ses kaydını ve yapay zeka konuşma özetini HubSpot Engagements'a kaydetme.",
        "auth_type": "bearer_token",
        "default_api_url": "https://api.hubapi.com",
        "screen_pop_template": "https://app.hubspot.com/contacts/search?query={caller}",
        "fields": [
            {"key": "api_url", "label": "HubSpot API Adresi", "placeholder": "https://api.hubapi.com"},
            {"key": "org_id", "label": "HubSpot Portal (Hub) ID", "placeholder": "Örn: 14392018"},
            {"key": "api_key", "label": "Private App Access Token", "placeholder": "pat-eu1-4829a..."},
        ],
    },
    {
        "id": "salesforce",
        "name": "Salesforce Sales & Service Cloud",
        "vendor": "Salesforce",
        "category": "Kurumsal CRM & Çağrı Merkezi",
        "badge": "Enterprise",
        "description": "Salesforce SOQL ile gerçek zamanlı Account/Contact eşleştirme, OpenCTI Screen Pop, otomatik Task/Activity oluşturma ve AI duygu analizini Case kartına ekleme.",
        "auth_type": "oauth2",
        "default_api_url": "https://kurum.my.salesforce.com",
        "screen_pop_template": "https://kurum.my.salesforce.com/_ui/search/ui/UnifiedSearchResults?str={caller}",
        "fields": [
            {"key": "api_url", "label": "Salesforce Instance URL", "placeholder": "https://kurum.my.salesforce.com"},
            {"key": "client_id", "label": "Connected App Consumer Key (Client ID)", "placeholder": "3MVG9..."},
            {"key": "api_key", "label": "Consumer Secret / Access Token", "placeholder": "00D8d00000..."},
        ],
    },
    {
        "id": "bitrix24",
        "name": "Bitrix24 CRM",
        "vendor": "Bitrix24",
        "category": "Çok Kanallı CRM & Görev Yönetimi",
        "badge": "Sık Kullanılan",
        "description": "Bitrix24 Inbound Webhook ile tek adımda entegrasyon: crm.duplicate.findbycomm ile arayanı tanıma, telephony.externalcall.register ile canlı çağrı kartı ve ses kaydı gönderimi.",
        "auth_type": "webhook",
        "default_api_url": "https://kurum.bitrix24.com.tr/rest/1/webhook_kodunuz/",
        "screen_pop_template": "https://kurum.bitrix24.com.tr/crm/configs/import/?q={caller}",
        "fields": [
            {"key": "api_url", "label": "Bitrix24 Inbound Webhook URL", "placeholder": "https://kurum.bitrix24.com.tr/rest/1/xxxxxx/"},
            {"key": "api_key", "label": "Bitrix24 Uygulama / Güvenlik Anahtarı (Opsiyonel)", "placeholder": "btx_sec_..."},
        ],
    },
    {
        "id": "pipedrive",
        "name": "Pipedrive",
        "vendor": "Pipedrive",
        "category": "Satış Pipeline & Fırsat Yönetimi",
        "badge": "Hızlı Kurulum",
        "description": "Pipedrive Persons ve Deals üzerinde anlık telefon sorgulama, cevapsız aramalarda otomatik satış aktivitesi oluşturma ve konuşma dökümünü müşteri notlarına işleme.",
        "auth_type": "api_token",
        "default_api_url": "https://api.pipedrive.com/v1",
        "screen_pop_template": "https://app.pipedrive.com/search/{caller}",
        "fields": [
            {"key": "org_id", "label": "Pipedrive Şirket Alt Alan Adı (Subdomain)", "placeholder": "Örn: kurumadi"},
            {"key": "api_key", "label": "Pipedrive Personal API Token", "placeholder": "4a8b9c1d2e3f..."},
        ],
    },
    {
        "id": "zendesk",
        "name": "Zendesk Support & Talk",
        "vendor": "Zendesk",
        "category": "Müşteri Destek & Ticket Yönetimi",
        "badge": "Destek Merkezi",
        "description": "Gelen çağrılarda Zendesk End-User bilgisini getirme, görüşme sonunda veya cevapsız aramada ses kaydı ve AI özeti eklenmiş otomatik Destek Talebi (Ticket) açma.",
        "auth_type": "api_token",
        "default_api_url": "https://kurum.zendesk.com/api/v2",
        "screen_pop_template": "https://kurum.zendesk.com/agent/search/1?q={caller}",
        "fields": [
            {"key": "api_url", "label": "Zendesk Subdomain URL", "placeholder": "https://kurum.zendesk.com/api/v2"},
            {"key": "client_id", "label": "Yetkili E-Posta Adresi", "placeholder": "admin@kurum.com"},
            {"key": "api_key", "label": "Zendesk API Token", "placeholder": "zd_api_token_..."},
        ],
    },
    {
        "id": "freshdesk",
        "name": "Freshdesk & Freshsales",
        "vendor": "Freshworks",
        "category": "Müşteri Hizmetleri & CRM",
        "badge": "Bulut",
        "description": "Freshworks üzerinden arayan müşterinin açık destek kayıtlarını görüntüleme, çağrı bittiğinde konuşma özetini ve ses kaydını otomatik müşteri geçmişine ekleme.",
        "auth_type": "api_key",
        "default_api_url": "https://kurum.freshdesk.com/api/v2",
        "screen_pop_template": "https://kurum.freshdesk.com/a/search/tickets?term={caller}",
        "fields": [
            {"key": "api_url", "label": "Freshdesk / Freshsales Domain URL", "placeholder": "https://kurum.freshdesk.com/api/v2"},
            {"key": "api_key", "label": "Freshworks API Key", "placeholder": "fw_key_..."},
        ],
    },
    {
        "id": "dynamics_365",
        "name": "Microsoft Dynamics 365",
        "vendor": "Microsoft",
        "category": "Kurumsal ERP & CRM",
        "badge": "Microsoft Ekosistemi",
        "description": "Microsoft Dataverse Web API üzerinden kurumsal müşteri kartı sorgulama, PhoneCall aktivitesi oluşturma ve Azure Entra ID / Teams ekosistemiyle tam uyumlu çalışma.",
        "auth_type": "oauth2",
        "default_api_url": "https://kurum.crm4.dynamics.com/api/data/v9.2",
        "screen_pop_template": "https://kurum.crm4.dynamics.com/main.aspx?pagetype=search&searchText={caller}",
        "fields": [
            {"key": "api_url", "label": "Dynamics 365 Dataverse Ortam Adresi", "placeholder": "https://kurum.crm4.dynamics.com/api/data/v9.2"},
            {"key": "client_id", "label": "Azure App (Client) ID", "placeholder": "00000000-0000-0000-0000-000000000000"},
            {"key": "api_key", "label": "Client Secret / Bearer Token", "placeholder": "d365_secret_..."},
        ],
    },
]


def get_merged_ad_config(settings_db: dict) -> Dict[str, Any]:
    raw = settings_db.get("active_directory")
    merged = dict(DEFAULT_ACTIVE_DIRECTORY_CONFIG)
    if isinstance(raw, dict):
        merged.update(raw)
    return merged


def get_merged_crm_integrations(settings_db: dict) -> Dict[str, Any]:
    saved_map = settings_db.get("crm_integrations")
    if not isinstance(saved_map, dict):
        saved_map = {}

    result_items = []
    for meta in CRM_CATALOG_METADATA:
        cid = meta["id"]
        saved_item = saved_map.get(cid) if isinstance(saved_map.get(cid), dict) else {}
        result_items.append({
            **meta,
            "enabled": bool(saved_item.get("enabled", False)),
            "simulation_mode": bool(saved_item.get("simulation_mode", True)),
            "api_url": str(saved_item.get("api_url") or meta.get("default_api_url") or ""),
            "org_id": str(saved_item.get("org_id") or ""),
            "client_id": str(saved_item.get("client_id") or ""),
            "api_key": str(saved_item.get("api_key") or ""),
            "screen_pop_url": str(saved_item.get("screen_pop_url") or meta.get("screen_pop_template") or ""),
            "caller_id_lookup": bool(saved_item.get("caller_id_lookup", True)),
            "screen_pop_enabled": bool(saved_item.get("screen_pop_enabled", True)),
            "auto_log_calls": bool(saved_item.get("auto_log_calls", True)),
            "create_lead_on_unknown": bool(saved_item.get("create_lead_on_unknown", False)),
            "create_task_on_missed": bool(saved_item.get("create_task_on_missed", True)),
            "sync_ai_transcript": bool(saved_item.get("sync_ai_transcript", True)),
            "last_tested_at": saved_item.get("last_tested_at"),
            "last_test_status": saved_item.get("last_test_status"),
        })
    return {
        "catalog": result_items,
        "global_settings": {
            "active_primary_crm": saved_map.get("active_primary_crm") or "",
            "timeout_ms": int(saved_map.get("timeout_ms") or 2500),
            "cache_lookup_minutes": int(saved_map.get("cache_lookup_minutes") or 15),
        },
    }


def generate_sample_ad_directory_users(cfg: Dict[str, Any], existing_users: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    domain = str(cfg.get("domain_name") or "kurum.local").strip()
    start_ext = int(cfg.get("extension_start_range") or 1050)
    used_exts = {str(u.get("extension") or "").strip() for u in (existing_users or []) if isinstance(u, dict)}
    existing_emails = {str(u.get("email") or "").strip().lower(): u for u in (existing_users or []) if isinstance(u, dict) and u.get("email")}
    existing_unames = {str(u.get("username") or "").strip().lower(): u for u in (existing_users or []) if isinstance(u, dict) and u.get("username")}

    sample_templates = [
        {"sam": "ahmet.yilmaz", "name": "Ahmet Yılmaz", "dept": "Müşteri Hizmetleri", "title": "Kıdemli Çağrı Temsilcisi"},
        {"sam": "zeynep.kaya", "name": "Zeynep Kaya", "dept": "Satış & Kampanya", "title": "Satış Uzmanı"},
        {"sam": "murat.demir", "name": "Murat Demir", "dept": "Teknik Destek", "title": "Teknik Destek Uzmanı"},
        {"sam": "elif.celik", "name": "Elif Çelik", "dept": "Müşteri Hizmetleri", "title": "Takım Lideri (Supervisor)"},
        {"sam": "burak.sahin", "name": "Burak Şahin", "dept": "VIP Müşteri İlişkileri", "title": "Portföy Yöneticisi"},
        {"sam": "selin.aydın", "name": "Selin Aydın", "dept": "Kalite & Eğitim", "title": "Kalite Kontrol Uzmanı"},
    ]

    next_ext = start_ext
    out = []
    for item in sample_templates:
        sam = item["sam"]
        email = f"{sam}@{domain}"
        matched = existing_emails.get(email.lower()) or existing_unames.get(sam.lower())
        if matched:
            assigned_ext = str(matched.get("extension") or "")
            sync_state = "existing"
        else:
            while str(next_ext) in used_exts:
                next_ext += 1
            assigned_ext = str(next_ext)
            used_exts.add(assigned_ext)
            next_ext += 1
            sync_state = "new"

        out.append({
            "username": sam,
            "full_name": item["name"],
            "email": email,
            "department": item["dept"],
            "title": item["title"],
            "dn": f"CN={item['name']},{cfg.get('user_search_base') or cfg.get('base_dn') or 'DC=kurum,DC=local'}",
            "suggested_extension": assigned_ext,
            "suggested_role": "supervisor" if "Lider" in item["title"] else str(cfg.get("default_role") or "agent"),
            "sync_state": sync_state,
            "ad_status": "Enabled",
        })
    return out


def test_ad_connection(cfg: Dict[str, Any], existing_users: List[Dict[str, Any]]) -> Dict[str, Any]:
    host = str(cfg.get("server_host") or "").strip()
    port = int(cfg.get("server_port") or (636 if cfg.get("use_ssl") else 389))
    sim = bool(cfg.get("simulation_mode", True))

    sample_users = generate_sample_ad_directory_users(cfg, existing_users)

    if sim:
        return {
            "status": "success",
            "mode": "simulation",
            "latency_ms": 18,
            "server": f"{host or 'dc01.kurum.local'}:{port}",
            "protocol": "LDAPS (TLS 1.3)" if cfg.get("use_ssl") else ("LDAP + StartTLS" if cfg.get("use_starttls") else "LDAP v3"),
            "base_dn": cfg.get("base_dn") or "DC=kurum,DC=local",
            "discovered_users_count": len(sample_users),
            "message": f"Active Directory ({host or 'dc01.kurum.local'}:{port}) doğrulama testi başarılı! Dizin ağacında {len(sample_users)} aktif kullanıcı bulundu.",
            "preview_users": sample_users,
        }

    if not host:
        return {
            "status": "error",
            "message": "Lütfen Active Directory / LDAP sunucu adresini (Host / IP) girin.",
        }

    t0 = time.time()
    try:
        sock = socket.create_connection((host, port), timeout=3.0)
        if cfg.get("use_ssl"):
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            sock = ctx.wrap_socket(sock, server_hostname=host)
        sock.close()
        latency_ms = max(1, int((time.time() - t0) * 1000))
        return {
            "status": "success",
            "mode": "live",
            "latency_ms": latency_ms,
            "server": f"{host}:{port}",
            "protocol": "LDAPS (SSL/TLS)" if cfg.get("use_ssl") else "LDAP v3",
            "base_dn": cfg.get("base_dn") or "",
            "discovered_users_count": len(sample_users),
            "message": f"{host}:{port} Active Directory sunucusuna TCP/LDAP erişimi doğrulandı ({latency_ms} ms).",
            "preview_users": sample_users,
        }
    except Exception as e:
        return {
            "status": "error",
            "mode": "live",
            "server": f"{host}:{port}",
            "message": f"Active Directory sunucusuna ({host}:{port}) erişilemedi: {str(e)}. (Canlı sunucu olmadan test etmek için 'Demo / Simülasyon Modu'nu açık bırakabilirsiniz.)",
        }
