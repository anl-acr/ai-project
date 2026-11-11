"""
AIDA PBX — Kurumsal Dış API (External REST API v1) Güvenlik, Anahtar (Token) Yönetimi ve Tüm Santral İşlemleri Servisi
========================================================================================================================
Bu modül:
1. Kriptografik API Anahtarı (Token) üretimi (`aida_live_<tenant>_<32hex>`) ve SHA-256 hash doğrulaması,
2. Modül ve işlem türü bazlı yetki kontrolü:
   - Okuma / Görüntüleme (GET) -> `:read`
   - Ekleme & Düzenleme / İşlem Başlatma (POST / PUT) -> `:write`
   - Silme (DELETE) -> `:delete`
3. IP Beyaz Liste (IP Whitelist / CIDR), Son Kullanma Tarihi ve Dakikalık İstek Limiti (Rate Limit) denetimi,
4. Gerçek zamanlı API Erişim & Hata Günlüğü (`api_access_logs`),
5. Santraldeki tüm modüller için (`/api/v1/...`) standart, güvenli REST uç noktaları sunar.
"""

import hashlib
import secrets
import time
import ipaddress
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, Request

# Yetki Kategorileri (Türkçe + Parantez İçinde Teknik HTTP Metot Karşılıkları)
API_PERMISSION_MODULES = [
    {
        "id": "calls",
        "title": "Canlı Çağrı & Santral Kontrolü (Click-to-Call / Transfer / Hangup)",
        "description": "Dış yazılımlardan (CRM/ERP) Tıkla-Ara (Click-to-Call) başlatma, aktif çağrıları listeleme, aktarma ve sonlandırma.",
        "actions": [
            {"code": "calls:read", "label": "Okuma / Görüntüleme (GET)", "http_methods": ["GET"], "desc": "Aktif çağrıları ve canlı kanal durumlarını sorgulama"},
            {"code": "calls:write", "label": "Ekleme & İşlem Başlatma (POST / PUT)", "http_methods": ["POST", "PUT"], "desc": "Tıkla-Ara başlatma, çağrı transfer etme ve sonlandırma"},
        ],
    },
    {
        "id": "cdr",
        "title": "Çağrı Raporları (CDR), Ses Kayıtları & Transkript",
        "description": "Çağrı geçmişi (CDR), transfer/pickup zinciri, ses kaydı (MP3/WAV) indirme ve AI konuşma dökümü okuma.",
        "actions": [
            {"code": "cdr:read", "label": "Okuma / Görüntüleme (GET)", "http_methods": ["GET"], "desc": "CDR raporlarını, ses kayıtlarını ve konuşma metinlerini çekme"},
        ],
    },
    {
        "id": "extensions",
        "title": "Dahili Aboneler, Kullanıcılar & Mola Durumu",
        "description": "Dahili abone listeleme, yeni abone açma, ses kaydı/yönlendirme değiştirme, temsilci mola durumu yönetimi ve silme.",
        "actions": [
            {"code": "extensions:read", "label": "Okuma / Görüntüleme (GET)", "http_methods": ["GET"], "desc": "Dahili aboneleri, SIP durumlarını ve mola istatistiklerini listeleme"},
            {"code": "extensions:write", "label": "Ekleme & Düzenleme (POST / PUT)", "http_methods": ["POST", "PUT"], "desc": "Yeni abone oluşturma, abone ayarlarını ve mola durumunu güncelleme"},
            {"code": "extensions:delete", "label": "Silme (DELETE)", "http_methods": ["DELETE"], "desc": "Dahili aboneyi santralden silme"},
        ],
    },
    {
        "id": "queues",
        "title": "ACD Arama Kuyrukları & Abone Grupları",
        "description": "Çağrı kuyrukları, kuyruk temsilcileri (member ekle/çıkar), çalma stratejileri ve abone grupları yönetimi.",
        "actions": [
            {"code": "queues:read", "label": "Okuma / Görüntüleme (GET)", "http_methods": ["GET"], "desc": "Kuyrukları, kuyruk üyelerini ve abone gruplarını listeleme"},
            {"code": "queues:write", "label": "Ekleme & Düzenleme (POST / PUT)", "http_methods": ["POST", "PUT"], "desc": "Kuyruk oluşturma, ayar değiştirme, temsilci ekleme/çıkarma"},
            {"code": "queues:delete", "label": "Silme (DELETE)", "http_methods": ["DELETE"], "desc": "Kuyruk veya abone grubu silme"},
        ],
    },
    {
        "id": "routing",
        "title": "Gelen / Giden Arama Kuralları, Dış Hatlar (SIP Trunk) & Toplu Konfigürasyon",
        "description": "DID gelen arama yönlendirmeleri, giden arama rotaları, SIP Trunk durumları ve Toplu Konfigürasyon (Bulk Config) işlemleri.",
        "actions": [
            {"code": "routing:read", "label": "Okuma / Görüntüleme (GET)", "http_methods": ["GET"], "desc": "Gelen/giden arama kurallarını ve SIP Trunk durumlarını görüntüleme"},
            {"code": "routing:write", "label": "Ekleme & Düzenleme (POST / PUT)", "http_methods": ["POST", "PUT"], "desc": "Arama kuralı ekleme/güncelleme ve Toplu Konfigürasyon uygulama"},
            {"code": "routing:delete", "label": "Silme (DELETE)", "http_methods": ["DELETE"], "desc": "Arama kuralı silme"},
        ],
    },
    {
        "id": "crm",
        "title": "CRM Rehber (Kişiler), Kara Liste & Randevu Takvimi",
        "description": "Müşteri rehberi senkronizasyonu, numara engelleme (Blacklist) ve randevu kayıtları yönetimi.",
        "actions": [
            {"code": "crm:read", "label": "Okuma / Görüntüleme (GET)", "http_methods": ["GET"], "desc": "Rehber kişilerini, kara listeyi ve randevuları sorgulama"},
            {"code": "crm:write", "label": "Ekleme & Düzenleme (POST / PUT)", "http_methods": ["POST", "PUT"], "desc": "Rehbere kişi ekleme/güncelleme, numara engelleme, randevu oluşturma"},
            {"code": "crm:delete", "label": "Silme (DELETE)", "http_methods": ["DELETE"], "desc": "Rehber kaydı, kara liste numarası veya randevu silme"},
        ],
    },
    {
        "id": "ai_omnichannel",
        "title": "Yapay Zeka Asistanları, Otomatik Dış Arama (Dialer) & Omnichannel (WhatsApp/E-Posta)",
        "description": "AI sesli asistan yönetimi, dış arama kampanyası tetikleme ve WhatsApp / Telegram / E-Posta mesaj gönderimi.",
        "actions": [
            {"code": "ai_omnichannel:read", "label": "Okuma / Görüntüleme (GET)", "http_methods": ["GET"], "desc": "AI asistanlarını, sohbet oturumlarını ve mesaj geçmişini okuma"},
            {"code": "ai_omnichannel:write", "label": "Ekleme & Gönderim Başlatma (POST / PUT)", "http_methods": ["POST", "PUT"], "desc": "WhatsApp/E-Posta mesajı gönderme, AI araması başlatma, AI asistan güncelleme"},
        ],
    },
    {
        "id": "pbx_features",
        "title": "Konferans Odaları, Hızlı Arama, Sesli Posta (Voicemail), Anonslar & Sistem Kapasitesi",
        "description": "Konferans odası yönetimi, hızlı arama kodları, sesli posta mesajları, sesli anonslar, Webhook abonelikleri ve sistem kapasite/sağlık bilgileri.",
        "actions": [
            {"code": "pbx_features:read", "label": "Okuma / Görüntüleme (GET)", "http_methods": ["GET"], "desc": "Konferans, hızlı arama, sesli posta, anons ve sistem kapasite bilgilerini okuma"},
            {"code": "pbx_features:write", "label": "Ekleme & Düzenleme (POST / PUT)", "http_methods": ["POST", "PUT"], "desc": "Konferans odası, hızlı arama ve Webhook aboneliği oluşturma/güncelleme"},
            {"code": "pbx_features:delete", "label": "Silme (DELETE)", "http_methods": ["DELETE"], "desc": "Konferans odası, hızlı arama veya sesli posta kaydı silme"},
        ],
    },
]

ALL_SCOPE_CODES = [
    action["code"]
    for mod in API_PERMISSION_MODULES
    for action in mod["actions"]
]

# Bellekte Rate Limit Takibi: { key_id: [timestamp1, timestamp2, ...] }
_RATE_LIMIT_BUCKETS: Dict[str, List[float]] = {}
# Başarısız Kimlik Doğrulama Koruması (Brute-force Shield): { ip: [timestamp1, ...] }
_FAILED_AUTH_ATTEMPTS: Dict[str, List[float]] = {}


def hash_api_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_api_token_pair(tenant_id: str = "tenant-default") -> Dict[str, str]:
    clean_tenant = "".join(c for c in str(tenant_id).replace("tenant-", "") if c.isalnum()).lower()[:10] or "default"
    secret_part = secrets.token_hex(20)  # 40 karakter kriptografik hex
    raw_token = f"aida_live_{clean_tenant}_{secret_part}"
    token_hash = hash_api_token(raw_token)
    masked_preview = f"{raw_token[:18]}...{raw_token[-6:]}"
    return {
        "raw_token": raw_token,
        "token_hash": token_hash,
        "masked_preview": masked_preview,
    }


def _extract_client_ip(request: Request) -> str:
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("X-Real-IP")
    if xri:
        return xri.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def _is_ip_allowed(client_ip: str, allowed_ips: List[str]) -> bool:
    if not allowed_ips:
        return True
    cleaned = [str(x).strip() for x in allowed_ips if str(x).strip() and str(x).strip() != "*"]
    if not cleaned:
        return True
    if client_ip in ("127.0.0.1", "::1", "localhost"):
        return True
    try:
        ip_obj = ipaddress.ip_address(client_ip)
    except Exception:
        return client_ip in cleaned

    for rule in cleaned:
        try:
            if "/" in rule:
                net = ipaddress.ip_network(rule, strict=False)
                if ip_obj in net:
                    return True
            else:
                if ip_obj == ipaddress.ip_address(rule):
                    return True
        except Exception:
            if client_ip == rule:
                return True
    return False


def record_api_access_log(
    settings_db: dict,
    *,
    key_id: str,
    key_name: str,
    tenant_id: str,
    method: str,
    path: str,
    client_ip: str,
    status_code: int,
    detail: str = "",
):
    logs = settings_db.get("external_api_logs")
    if not isinstance(logs, list):
        logs = []
    method_tr_map = {
        "GET": "Okuma / Görüntüleme (GET)",
        "POST": "Yeni Ekleme / Tetikleme (POST)",
        "PUT": "Güncelleme / Düzenleme (PUT)",
        "PATCH": "Kısmi Güncelleme (PATCH)",
        "DELETE": "Silme (DELETE)",
    }
    entry = {
        "id": f"apilog_{int(time.time() * 1000)}_{secrets.token_hex(3)}",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "key_id": key_id,
        "key_name": key_name,
        "tenant_id": tenant_id,
        "method": method.upper(),
        "method_label": method_tr_map.get(method.upper(), method.upper()),
        "path": path,
        "client_ip": client_ip,
        "status_code": status_code,
        "detail": detail,
    }
    logs.insert(0, entry)
    settings_db["external_api_logs"] = logs[:250]


def verify_external_api_request(
    request: Request,
    settings_db: dict,
    save_settings_fn,
    required_scope: str,
) -> Dict[str, Any]:
    """
    Dış API isteklerini doğrular:
    1. Brute-force koruması (IP başına dakikada maks 25 hatalı deneme)
    2. X-API-Key veya Authorization: Bearer <token> başlığı
    3. SHA-256 Hash eşleşmesi, Aktiflik ve Son Kullanma Tarihi
    4. IP Beyaz Liste (IP Whitelist) kontrolü
    5. Rate Limit (Dakikalık istek limiti)
    6. Yetki Kapsamı (Scope - GET/POST/PUT/DELETE) kontrolü
    """
    client_ip = _extract_client_ip(request)
    now_ts = time.time()

    # 1. Brute-force koruması
    failed_list = [ts for ts in _FAILED_AUTH_ATTEMPTS.get(client_ip, []) if now_ts - ts < 60]
    _FAILED_AUTH_ATTEMPTS[client_ip] = failed_list
    if len(failed_list) >= 25:
        record_api_access_log(
            settings_db,
            key_id="blocked",
            key_name="Brute-Force Koruması",
            tenant_id="unknown",
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            status_code=429,
            detail="Çok fazla hatalı API anahtarı denemesi nedeniyle IP geçici olarak engellendi (60 sn).",
        )
        raise HTTPException(
            status_code=429,
            detail="Çok fazla hatalı kimlik doğrulama denemesi yapıldı. Lütfen 1 dakika sonra tekrar deneyin.",
        )

    # 2. Token Çıkarımı
    raw_token = request.headers.get("X-API-Key") or request.headers.get("x-api-key") or ""
    if not raw_token:
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization") or ""
        if auth_header.lower().startswith("bearer "):
            raw_token = auth_header[7:].strip()

    if not raw_token:
        _FAILED_AUTH_ATTEMPTS.setdefault(client_ip, []).append(now_ts)
        record_api_access_log(
            settings_db,
            key_id="missing",
            key_name="Anahtar Gönderilmedi",
            tenant_id="unknown",
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            status_code=401,
            detail="X-API-Key veya Authorization: Bearer başlığı eksik.",
        )
        raise HTTPException(
            status_code=401,
            detail="API Anahtarı (Token) bulunamadı. Lütfen 'X-API-Key: <anahtar>' veya 'Authorization: Bearer <anahtar>' başlığı gönderin.",
        )

    incoming_hash = hash_api_token(raw_token.strip())
    api_keys = settings_db.get("external_api_keys")
    if not isinstance(api_keys, list):
        api_keys = []

    matched_key = None
    for k in api_keys:
        if isinstance(k, dict) and k.get("token_hash") == incoming_hash:
            matched_key = k
            break

    if not matched_key:
        _FAILED_AUTH_ATTEMPTS.setdefault(client_ip, []).append(now_ts)
        record_api_access_log(
            settings_db,
            key_id="invalid",
            key_name="Geçersiz Anahtar",
            tenant_id="unknown",
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            status_code=401,
            detail="Gönderilen API Anahtarı sistemde bulunamadı veya silinmiş.",
        )
        raise HTTPException(status_code=401, detail="Geçersiz veya iptal edilmiş API Anahtarı (Token).")

    key_id = str(matched_key.get("id") or "")
    key_name = str(matched_key.get("name") or "API Anahtarı")
    tenant_id = str(matched_key.get("tenant_id") or "tenant-default")

    # 3. Aktiflik ve Süre Kontrolü
    if not matched_key.get("is_active", True):
        record_api_access_log(
            settings_db,
            key_id=key_id,
            key_name=key_name,
            tenant_id=tenant_id,
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            status_code=403,
            detail="Pasif (dondurulmuş) API anahtarı ile erişim denemesi.",
        )
        raise HTTPException(status_code=403, detail="Bu API Anahtarı pasif durumdadır. Yönetici panelinden aktif hale getirin.")

    expires_at = matched_key.get("expires_at")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(str(expires_at).replace("Z", ""))
            if datetime.now() > exp_dt:
                record_api_access_log(
                    settings_db,
                    key_id=key_id,
                    key_name=key_name,
                    tenant_id=tenant_id,
                    method=request.method,
                    path=request.url.path,
                    client_ip=client_ip,
                    status_code=403,
                    detail=f"Süresi dolmuş API anahtarı (Bitiş: {expires_at}).",
                )
                raise HTTPException(status_code=403, detail=f"Bu API Anahtarının geçerlilik süresi dolmuştur ({expires_at}).")
        except HTTPException:
            raise
        except Exception:
            pass

    # 4. IP Beyaz Liste Kontrolü
    allowed_ips = matched_key.get("allowed_ips") if isinstance(matched_key.get("allowed_ips"), list) else []
    if not _is_ip_allowed(client_ip, allowed_ips):
        record_api_access_log(
            settings_db,
            key_id=key_id,
            key_name=key_name,
            tenant_id=tenant_id,
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            status_code=403,
            detail=f"Yetkisiz IP adresi ({client_ip}). İzin verilen IP listesinde değil.",
        )
        raise HTTPException(
            status_code=403,
            detail=f"Erişim reddedildi: İstek yapılan IP adresi ({client_ip}) bu API Anahtarının izinli IP listesinde (IP Whitelist) yer almıyor.",
        )

    # 5. Rate Limit (Dakikalık Hız Sınırı)
    rate_limit = int(matched_key.get("rate_limit_per_minute") or 120)
    bucket = [ts for ts in _RATE_LIMIT_BUCKETS.get(key_id, []) if now_ts - ts < 60]
    if len(bucket) >= rate_limit:
        record_api_access_log(
            settings_db,
            key_id=key_id,
            key_name=key_name,
            tenant_id=tenant_id,
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            status_code=429,
            detail=f"Dakikalık istek limiti aşıldı ({rate_limit} istek/dk).",
        )
        raise HTTPException(
            status_code=429,
            detail=f"Dakikalık API istek sınırı ({rate_limit} istek/dakika) aşıldı. Lütfen biraz bekleyin.",
        )
    bucket.append(now_ts)
    _RATE_LIMIT_BUCKETS[key_id] = bucket

    # 6. Yetki Kapsamı (Scope) Kontrolü
    scopes = matched_key.get("scopes") if isinstance(matched_key.get("scopes"), list) else []
    has_scope = (
        "admin:full" in scopes
        or "*" in scopes
        or required_scope in scopes
    )
    if not has_scope:
        record_api_access_log(
            settings_db,
            key_id=key_id,
            key_name=key_name,
            tenant_id=tenant_id,
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            status_code=403,
            detail=f"Yetki yetersiz. Gereken yetki: '{required_scope}' ({request.method}).",
        )
        raise HTTPException(
            status_code=403,
            detail=f"Bu işlem için yetkiniz bulunmuyor. Gereken API Yetkisi: '{required_scope}' (HTTP {request.method}).",
        )

    # Başarılı doğrulama -> Son kullanım bilgisini ve sayacını güncelle
    matched_key["last_used_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    matched_key["last_used_ip"] = client_ip
    matched_key["usage_count"] = int(matched_key.get("usage_count") or 0) + 1

    record_api_access_log(
        settings_db,
        key_id=key_id,
        key_name=key_name,
        tenant_id=tenant_id,
        method=request.method,
        path=request.url.path,
        client_ip=client_ip,
        status_code=200,
        detail=f"Başarılı ({required_scope})",
    )

    return {
        "key_id": key_id,
        "key_name": key_name,
        "tenant_id": tenant_id,
        "client_ip": client_ip,
        "scopes": scopes,
        "user_info": {
            "user_id": f"api:{key_name}",
            "role": "admin",
            "tenant_id": tenant_id,
            "ip_address": client_ip,
        },
    }


# ============================================================================
# TÜRKÇE INTERAKTİF API REFERANS KATALOĞU (Arayüzde ve Dokümanda Gösterilir)
# ============================================================================
API_ENDPOINTS_CATALOG = [
    {
        "category": "1. Canlı Çağrı & Santral Kontrolü (Click-to-Call / Transfer / Hangup)",
        "scope_module": "calls",
        "items": [
            {
                "method": "POST",
                "method_tr": "Yeni İşlem Başlatma (POST)",
                "path": "/api/v1/calls/originate",
                "scope": "calls:write",
                "title": "Tıkla-Ara (Click-to-Call) Çağrı Başlatma",
                "description": "Önce temsilcinin dahili telefonunu (WebPhone / Masa Telefonu / Mobil) çaldırır; temsilci açtığında otomatik olarak hedef müşteri numarasını arar ve iki tarafı bağlar.",
                "sample_body": {
                    "extension": "1000",
                    "destination": "05321234567",
                    "caller_id": "908503607390",
                    "timeout": 30
                },
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/calls/active",
                "scope": "calls:read",
                "title": "Aktif (Canlı) Çağrıları Listeleme",
                "description": "Santral üzerinde o an konuşulan veya çalmakta olan tüm canlı çağrıları ve kanal bilgilerini döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "İşlem Başlatma (POST)",
                "path": "/api/v1/calls/{call_id}/transfer",
                "scope": "calls:write",
                "title": "Canlı Çağrıyı Başka Dahiliye veya Kuyruğa Aktarma (Transfer)",
                "description": "Devam eden bir görüşmeyi belirtilen dahili numaraya (örn. 1002), kuyruğa (örn. 2000) veya dış numaraya aktarır.",
                "sample_body": {
                    "target_extension": "1002",
                    "context": "webrtc_agents"
                },
            },
            {
                "method": "POST",
                "method_tr": "İşlem Başlatma (POST)",
                "path": "/api/v1/calls/{call_id}/hangup",
                "scope": "calls:write",
                "title": "Aktif Çağrıyı Sonlandırma (Hangup)",
                "description": "Belirtilen çağrı kimliğine (call_id) veya kanala ait aktif görüşmeyi sonlandırır.",
                "sample_body": {},
            },
            {
                "method": "POST",
                "method_tr": "İşlem Başlatma (POST)",
                "path": "/api/v1/calls/{call_id}/recording-pause",
                "scope": "calls:write",
                "title": "Canlı Çağrıda Ses Kaydını Duraklatma / Devam Ettirme (KVKK & Kredi Kartı Maskeleme)",
                "description": "Görüşme esnasında müşteri kredi kartı veya KVKK hassas bilgisi söylerken ses kaydını (MixMonitor) duraklatır (`paused: true`) ve işlem bitince tekrar başlatır (`paused: false`).",
                "sample_body": {
                    "extension": "1000",
                    "paused": True
                },
            },
            {
                "method": "POST",
                "method_tr": "İşlem Başlatma (POST)",
                "path": "/api/v1/calls/{call_id}/hold",
                "scope": "calls:write",
                "title": "Canlı Çağrıyı Beklemeye Alma / Beklemeden Çıkarma (Hold / Unhold)",
                "description": "Aktif görüşmedeki müşteriyi bekleme müziğine (MoH) alır (`hold: true`) veya beklemeden çıkarıp görüşmeye geri döndürür (`hold: false`).",
                "sample_body": {
                    "extension": "1000",
                    "hold": True
                },
            },
            {
                "method": "POST",
                "method_tr": "İşlem Başlatma (POST)",
                "path": "/api/v1/calls/monitor",
                "scope": "calls:write",
                "title": "Süpervizör Canlı Çağrı Dinleme, Fısıldama (Whisper) ve Araya Girme (Barge-In)",
                "description": "Yöneticinin (`supervisor_extension`) seçilen temsilcinin (`target_extension`) aktif görüşmesini sessiz dinlemesini (`listen`), sadece temsilciye sufle vermesini (`whisper`) veya konferans olarak araya girmesini (`barge`) başlatır.",
                "sample_body": {
                    "supervisor_extension": "1000",
                    "target_extension": "1001",
                    "mode": "whisper"
                },
            },
        ],
    },
    {
        "category": "2. Çağrı Raporları (CDR), Ses Kayıtları & Transkript",
        "scope_module": "cdr",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/cdr?limit=50&direction=inbound",
                "scope": "cdr:read",
                "title": "Detaylı Çağrı Geçmişi (CDR) ve Transfer/Pickup Zinciri Sorgulama",
                "description": "Tarih aralığı, yön (inbound/outbound), arayan numara, dahili abone ve durum filtreleriyle tüm çağrı kayıtlarını, ses kaydı URL'lerini ve transfer bacaklarını (call_legs) döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/cdr/{call_id}",
                "scope": "cdr:read",
                "title": "Tekil Çağrı Detayı, Ses Kaydı Bağlantıları & Konuşma Dökümü (Transcript)",
                "description": "Belirtilen çağrının tüm bacaklarını, duygu analizini, AI özetini, konuşma metnini (transkript) ve ses kaydı indirme bağlantılarını getirir.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / İndirme (GET)",
                "path": "/api/v1/cdr/{call_id}/recording",
                "scope": "cdr:read",
                "title": "Çağrı Ses Kaydı Dosyasını (WAV / MP3) İndirme veya Dinleme",
                "description": "Çağrının tam ses kaydını veya `leg_index` parametresiyle sadece belirli bir transfer görüşmesinin ses kaydını stream olarak indirir.",
                "sample_body": None,
            },
        ],
    },
    {
        "category": "3. Dahili Aboneler (Kullanıcılar) & Temsilci Mola Yönetimi",
        "scope_module": "extensions",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/extensions",
                "scope": "extensions:read",
                "title": "Tüm Dahili Aboneleri ve Anlık Durumlarını Listeleme",
                "description": "Sistemdeki tüm kullanıcıları, dahili numaralarını, çevrimiçi IP durumlarını, ses kaydı ve çağrı yönlendirme ayarlarını listeler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Yeni Kayıt Ekleme (POST)",
                "path": "/api/v1/extensions",
                "scope": "extensions:write",
                "title": "Yeni Dahili Abone (Kullanıcı) Oluşturma",
                "description": "Santrale yeni bir dahili numara ve kullanıcı ekler, Asterisk PJSIP yapılandırmasını otomatik senkronize eder.",
                "sample_body": {
                    "username": "ahmet.yilmaz",
                    "full_name": "Ahmet Yılmaz",
                    "extension": "1025",
                    "email": "ahmet@sirket.com",
                    "role": "agent",
                    "recording_active": True
                },
            },
            {
                "method": "PUT",
                "method_tr": "Güncelleme / Düzenleme (PUT)",
                "path": "/api/v1/extensions/{extension}",
                "scope": "extensions:write",
                "title": "Dahili Abone Ayarlarını Güncelleme (Ses Kaydı, Yönlendirme, Dış Arama)",
                "description": "Mevcut bir abonenin ses kayıt durumunu, çağrı yönlendirmelerini (Her Zaman / Meşgul / Cevapsız), CallerID veya aktiflik durumunu günceller.",
                "sample_body": {
                    "recording_active": False,
                    "outbound_caller_id": "908503607390",
                    "forwarding_no_answer": {"active": True, "type": "external", "target": "05321234567", "timeout": 25}
                },
            },
            {
                "method": "POST",
                "method_tr": "İşlem Başlatma (POST)",
                "path": "/api/v1/extensions/{extension}/status",
                "scope": "extensions:write",
                "title": "Temsilci Durumunu Değiştirme (Müsait / Molaya Çıkar)",
                "description": "Temsilciyi dış sistemden (CRM/WFM) Müsait (available) duruma geçirir veya belirtilen mola türüyle molaya (break) çıkarır.",
                "sample_body": {
                    "status": "break",
                    "break_reason": "Yemek Molası"
                },
            },
            {
                "method": "DELETE",
                "method_tr": "Silme (DELETE)",
                "path": "/api/v1/extensions/{extension}",
                "scope": "extensions:delete",
                "title": "Dahili Aboneyi Silme",
                "description": "Belirtilen dahili aboneyi santralden ve PJSIP yapılandırmasından kaldırır.",
                "sample_body": None,
            },
        ],
    },
    {
        "category": "4. ACD Arama Kuyrukları & Abone Grupları",
        "scope_module": "queues",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/queues",
                "scope": "queues:read",
                "title": "ACD Çağrı Kuyruklarını ve Üyelerini Listeleme",
                "description": "Tüm çağrı kuyruklarını, çalma stratejilerini, RONA/anket ayarlarını ve kuyruktaki dahili temsilcileri listeler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Yeni Kayıt Ekleme (POST)",
                "path": "/api/v1/queues",
                "scope": "queues:write",
                "title": "Yeni ACD Çağrı Kuyruğu Oluşturma",
                "description": "Yeni bir çağrı kuyruğu oluşturur ve Asterisk queues.conf dosyasını otomatik günceller.",
                "sample_body": {
                    "name": "VIP Destek Kuyruğu",
                    "extension": "2050",
                    "strategy": "rrmemory",
                    "timeout": 20,
                    "wrapup_time": 10,
                    "members": ["1000", "1001"]
                },
            },
            {
                "method": "PUT",
                "method_tr": "Güncelleme / Düzenleme (PUT)",
                "path": "/api/v1/queues/{queue_id}",
                "scope": "queues:write",
                "title": "Kuyruk Ayarlarını veya Temsilcilerini Güncelleme",
                "description": "Kuyruğun çalma stratejisini, bekleme sürelerini, anonslarını günceller veya kuyruğa temsilci ekler/çıkarır.",
                "sample_body": {
                    "strategy": "leastrecent",
                    "timeout": 25,
                    "member_action": "add",
                    "member_extensions": ["1005"]
                },
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/subscriber-groups",
                "scope": "queues:read",
                "title": "Abone Gruplarını Listeleme",
                "description": "Santraldeki tüm abone gruplarını, grup üyelerini ve atanmış giden arama kurallarını döndürür.",
                "sample_body": None,
            },
        ],
    },
    {
        "category": "5. Gelen / Giden Arama Kuralları, SIP Trunk & Toplu Konfigürasyon",
        "scope_module": "routing",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/inbound-rules",
                "scope": "routing:read",
                "title": "Gelen Arama (DID) Yönlendirme Kurallarını Listeleme",
                "description": "Dış hat numaralarına (DID) gelen çağrıların hangi kuyruk, dahili veya AI asistana yönlendirildiğini listeler.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/outbound-rules",
                "scope": "routing:read",
                "title": "Giden Arama Kurallarını Listeleme",
                "description": "Giden arama kurallarını, önekleri (prefix), kullanılan SIP Trunk ve PIN politikalarını listeler.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/trunks",
                "scope": "routing:read",
                "title": "Dış Hatları (SIP Trunks) ve Kayıt Durumlarını Listeleme",
                "description": "Operatör SIP Trunk tanımlarını, DID numaralarını ve anlık SIP kayıt durumlarını döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Toplu İşlem Başlatma (POST)",
                "path": "/api/v1/bulk-config/apply",
                "scope": "routing:write",
                "title": "Toplu Konfigürasyon (Bulk Config) Uygulama",
                "description": "Kullanıcılar, abone grupları, kuyruklar veya arama kuralları üzerinde tek istekle toplu özellik değişikliği uygular.",
                "sample_body": {
                    "module": "users",
                    "target_mode": "all",
                    "changes": {"recording_active": False}
                },
            },
            {
                "method": "POST",
                "method_tr": "Yeni Kayıt Ekleme (POST)",
                "path": "/api/v1/inbound-rules",
                "scope": "routing:write",
                "title": "Yeni Gelen Arama (DID) Yönlendirme Kuralı Ekleme",
                "description": "Belirtilen DID numarasına gelen çağrıları seçilen kuyruk, dahili veya AI asistana yönlendiren yeni kural oluşturur.",
                "sample_body": {
                    "did_number": "908503607390",
                    "destination_type": "queue",
                    "destination_value": "2000",
                    "description": "Ana Hat -> Satış Kuyruğu"
                },
            },
            {
                "method": "POST",
                "method_tr": "Yeni Kayıt Ekleme (POST)",
                "path": "/api/v1/outbound-rules",
                "scope": "routing:write",
                "title": "Yeni Giden Arama Kuralı Ekleme",
                "description": "Belirtilen önek (prefix) ve SIP Trunk üzerinden dış arama kuralı oluşturur.",
                "sample_body": {
                    "name": "Yurtiçi GSM Aramaları",
                    "prefix": "05",
                    "trunk_id": 1,
                    "caller_id": "908503607390"
                },
            },
        ],
    },
    {
        "category": "6. CRM Rehber (Kişiler), Kara Liste & Randevu Takvimi",
        "scope_module": "crm",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/contacts",
                "scope": "crm:read",
                "title": "Santral Rehberindeki Kişileri Listeleme / Arama",
                "description": "Rehberde kayıtlı müşterileri telefon numarası veya isme göre filtreleyerek döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Yeni Kayıt Ekleme (POST)",
                "path": "/api/v1/contacts",
                "scope": "crm:write",
                "title": "Rehbere Yeni Müşteri / Kişi Ekleme",
                "description": "Dış CRM veya ERP sisteminden santral rehberine yeni müşteri kartı ekler (Arayan kimliği eşleşmesi için).",
                "sample_body": {
                    "name": "Mehmet Demir",
                    "phone": "05329876543",
                    "company": "Demir Lojistik A.Ş.",
                    "email": "mehmet@demirlojistik.com",
                    "notes": "Kurumsal VIP Müşteri"
                },
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/blacklist",
                "scope": "crm:read",
                "title": "Engellenen Numaraları (Kara Liste) Listeleme",
                "description": "Kara listedeki tüm telefon numaralarını ve engellenme nedenlerini döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Yeni Kayıt Ekleme (POST)",
                "path": "/api/v1/blacklist",
                "scope": "crm:write",
                "title": "Numarayı Kara Listeye Ekleme (Engelleme)",
                "description": "Belirtilen telefon numarasını santral kara listesine ekler.",
                "sample_body": {
                    "phone_number": "05320001122",
                    "reason": "Spam / İstenmeyen Arama"
                },
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/appointments",
                "scope": "crm:read",
                "title": "Randevu Kayıtlarını Listeleme",
                "description": "AI Asistan veya temsilciler tarafından oluşturulan tüm randevuları listeler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Yeni Kayıt Ekleme (POST)",
                "path": "/api/v1/appointments",
                "scope": "crm:write",
                "title": "Yeni Randevu Oluşturma",
                "description": "Takvime yeni bir müşteri randevusu ekler.",
                "sample_body": {
                    "customer_name": "Ayşe Kaya",
                    "customer_phone": "05421112233",
                    "appointment_date": "2026-11-15 14:30",
                    "notes": "Ürün Demo Görüşmesi"
                },
            },
        ],
    },
    {
        "category": "7. Yapay Zeka Asistanları & Omnichannel (WhatsApp / E-Posta Gönderimi)",
        "scope_module": "ai_omnichannel",
        "items": [
            {
                "method": "POST",
                "method_tr": "Mesaj Gönderimi Başlatma (POST)",
                "path": "/api/v1/omnichannel/whatsapp/send",
                "scope": "ai_omnichannel:write",
                "title": "Dış Sistemden Müşteriye WhatsApp Mesajı Gönderme",
                "description": "Santrale bağlı resmi WhatsApp Business hattı üzerinden müşteriye anlık bildirim veya mesaj gönderir.",
                "sample_body": {
                    "phone": "905321234567",
                    "message": "Sayın müşterimiz, siparişiniz kargoya verilmiştir."
                },
            },
            {
                "method": "POST",
                "method_tr": "AI Arama Başlatma (POST)",
                "path": "/api/v1/ai-calls/originate",
                "scope": "ai_omnichannel:write",
                "title": "Yapay Zeka Asistanı ile Otomatik Dış Arama Başlatma",
                "description": "Belirtilen müşteri numarasını doğrudan seçilen AI Sesli Asistan ile arar ve senaryoyu konuşturur.",
                "sample_body": {
                    "phone_number": "05321234567",
                    "agent_name": "Sales_AI",
                    "custom_context": "Müşteri adı: Ali Veli, Randevu teyidi için aranıyor."
                },
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/ai-agents",
                "scope": "ai_omnichannel:read",
                "title": "Yapay Zeka Sesli Asistanlarını Listeleme",
                "description": "Sistemdeki tüm AI sesli temsilcilerini, kullandıkları dil modellerini ve senaryo talimatlarını döndürür.",
                "sample_body": None,
            },
        ],
    },
    {
        "category": "8. Konferans Odaları, Hızlı Arama, Sesli Posta (Voicemail), Webhook & Sistem Kapasitesi",
        "scope_module": "pbx_features",
        "items": [
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/system/capacity",
                "scope": "pbx_features:read",
                "title": "Santral Kapasite, Lisans ve Anlık Kanal Sağlığı Sorgulama",
                "description": "Toplam dahili abone sayısını, çevrimiçi SIP cihazlarını, aktif çağrı kanallarını, kuyrukları, SIP Trunk durumunu ve lisans kapasitesini döndürür.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/conferences",
                "scope": "pbx_features:read",
                "title": "Konferans Odalarını Listeleme",
                "description": "Santraldeki tüm konferans odalarını, oda numaralarını ve PIN ayarlarını döndürür.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Yeni Kayıt Ekleme (POST)",
                "path": "/api/v1/conferences",
                "scope": "pbx_features:write",
                "title": "Yeni Konferans Odası Oluşturma",
                "description": "Yeni bir sesli konferans odası oluşturur.",
                "sample_body": {
                    "name": "Yönetim Kurulu Konferansı",
                    "room_number": "3010",
                    "pin": "1453"
                },
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/speed-dials",
                "scope": "pbx_features:read",
                "title": "Hızlı Arama (Speed Dial) Kodlarını Listeleme",
                "description": "Tanımlı hızlı arama kodlarını ve hedef numaralarını listeler.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/voicemails",
                "scope": "pbx_features:read",
                "title": "Sesli Posta (Voicemail) Kayıtlarını Listeleme",
                "description": "Bırakılan sesli posta mesajlarını, arayan numarayı, süreyi ve ses dosyası bağlantılarını listeler.",
                "sample_body": None,
            },
            {
                "method": "GET",
                "method_tr": "Okuma / Görüntüleme (GET)",
                "path": "/api/v1/announcements",
                "scope": "pbx_features:read",
                "title": "Santral Sesli Anonslarını (Prompts) Listeleme",
                "description": "Karşılama, mesai dışı ve IVR anons dosyalarını listeler.",
                "sample_body": None,
            },
            {
                "method": "POST",
                "method_tr": "Yeni Abonelik / Güncelleme (POST)",
                "path": "/api/v1/webhooks/subscribe",
                "scope": "pbx_features:write",
                "title": "Gerçek Zamanlı Çağrı Olay Bildirimi (Webhook / Event Push) Tanımlama",
                "description": "Santralde çağrı başladığında (`call.ringing`), cevaplandığında (`call.answered`), aktarıldığında (`call.transferred`) veya kapandığında (`call.ended`) dış CRM/ERP adresinize (`webhook_url`) anlık HTTP POST bildirimi gönderilmesini sağlar.",
                "sample_body": {
                    "webhook_url": "https://crm.sirketiniz.com/api/pbx-events",
                    "secret": "gizli_imza_anahtari_123",
                    "events": ["call.ringing", "call.answered", "call.transferred", "call.ended"]
                },
            },
        ],
    },
]


async def dispatch_external_api_webhook_event(
    settings_db: dict,
    event_name: str = "",
    payload_data: Optional[Dict[str, Any]] = None,
    tenant_id: str = "tenant-default",
    event_type: str = "",
    payload: Optional[Dict[str, Any]] = None,
):
    """
    Santralde bir çağrı olayı ('call.ringing', 'call.answered', 'call.transferred', 'call.ended')
    gerçekleştiğinde, o müşteriye (tenant) ait API anahtarlarında veya genel webhook aboneliklerinde
    tanımlı URL adreslerine HMAC-SHA256 imzalı HTTP POST bildirimi gönderir.
    """
    import hmac
    import json
    import httpx

    event_name = event_name or event_type
    payload_data = payload_data if payload_data is not None else (payload or {})

    targets = []
    # 1. API anahtarlarının içindeki webhook_url tanımları
    for k in (settings_db.get("external_api_keys") or []):
        if not isinstance(k, dict) or not k.get("is_active", True):
            continue
        k_ten = k.get("tenant_id") or "tenant-default"
        if tenant_id not in ("all", "global") and k_ten != tenant_id:
            continue
        wh_url = str(k.get("webhook_url") or "").strip()
        if not wh_url:
            continue
        wh_events = k.get("webhook_events") if isinstance(k.get("webhook_events"), list) else []
        if wh_events and event_name not in wh_events and "*" not in wh_events:
            continue
        targets.append({
            "url": wh_url,
            "secret": str(k.get("webhook_secret") or k.get("masked_preview") or "aida_webhook"),
            "key_name": k.get("name") or "API Webhook",
        })

    # 2. Bağımsız Webhook abonelikleri
    for sub in (settings_db.get("external_api_webhooks") or []):
        if not isinstance(sub, dict) or not sub.get("is_active", True):
            continue
        s_ten = sub.get("tenant_id") or "tenant-default"
        if tenant_id not in ("all", "global") and s_ten != tenant_id:
            continue
        wh_url = str(sub.get("webhook_url") or "").strip()
        if not wh_url:
            continue
        wh_events = sub.get("events") if isinstance(sub.get("events"), list) else []
        if wh_events and event_name not in wh_events and "*" not in wh_events:
            continue
        targets.append({
            "url": wh_url,
            "secret": str(sub.get("secret") or "aida_webhook"),
            "key_name": sub.get("name") or "Webhook Aboneliği",
        })

    if not targets:
        return

    body_dict = {
        "event": event_name,
        "timestamp": datetime.now().isoformat(),
        "tenant_id": tenant_id,
        "data": payload_data,
    }
    body_bytes = json.dumps(body_dict, ensure_ascii=False).encode("utf-8")

    async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
        for t in targets:
            sig = hmac.new(
                t["secret"].encode("utf-8"),
                body_bytes,
                hashlib.sha256,
            ).hexdigest()
            try:
                await client.post(
                    t["url"],
                    content=body_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "AIDA-PBX-Webhook/1.0",
                        "X-AIDA-Event": event_name,
                        "X-AIDA-Signature": f"sha256={sig}",
                    },
                )
            except Exception as e_wh:
                print(f"[ExternalAPI Webhook Error] {t['url']} -> {e_wh}")
