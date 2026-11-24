import datetime
import hashlib
import hmac
import os
import base64
import json
from backend.services.hardware_info import get_system_hardware_fingerprint, compute_system_serial_number, _load_serial_secret

def get_license_master_secret() -> str:
    """Reads the license HMAC secret dynamically from NORNIA_LICENSE_SECRET / LICENSE_MASTER_SECRET or /etc/nornia/license.secret."""
    return _load_serial_secret()

LICENSE_MASTER_SECRET = get_license_master_secret()

def generate_tenant_serial_number(tenant_code: str, tenant_num_id: int = 100) -> str:
    """
    Generates a unique, contract-grade cryptographic Tenant Serial Number.
    Format: SN-TNT-2026-{NUM4}-{HASH6} (e.g. SN-TNT-2026-0100-A4F91C)
    """
    clean_code = (tenant_code or "default").strip().lower().replace("tenant-", "").replace(" ", "-")
    try:
        num_val = int(tenant_num_id or 100)
    except Exception:
        num_val = 100
    num_part = f"{num_val:04d}"
    sig = hmac.new(
        get_license_master_secret().encode("utf-8"),
        f"TENANT_SERIAL:{clean_code}:{num_part}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()[:6].upper()
    return f"SN-TNT-2026-{num_part}-{sig}"

PLAN_LIMITS = {
    "trial": {
        "max_users": 50,
        "max_channels": 10,
        "max_ai_agents": 10,
        "max_tenants": 3,
        "label": "Trial / Deneme Paketi (30 Gün)"
    },
    "starter": {
        "max_users": 5,
        "max_channels": 2,
        "max_ai_agents": 1,
        "max_tenants": 1,
        "label": "Starter Paket"
    },
    "professional": {
        "max_users": 25,
        "max_channels": 10,
        "max_ai_agents": 3,
        "max_tenants": 3,
        "label": "Professional Paket"
    },
    "enterprise": {
        "max_users": 100,
        "max_channels": 30,
        "max_ai_agents": 10,
        "max_tenants": 10,
        "label": "Enterprise Paket"
    },
    "unlimited": {
        "max_users": 9999,
        "max_channels": 9999,
        "max_ai_agents": 9999,
        "max_tenants": 9999,
        "label": "Limitsiz / Özel Paket"
    }
}

def get_plan_limits(plan_tier: str = "professional") -> dict:
    tier = (plan_tier or "professional").strip().lower()
    return PLAN_LIMITS.get(tier, PLAN_LIMITS["professional"])

def compute_license_signature(tenant_code: str, expiry_date_str: str, hw_id: str = "UNBOUND") -> str:
    """
    Computes an 8-character uppercase HMAC-SHA256 signature mapping tenant code, expiry date (YYYY-MM-DD), and hardware ID.
    """
    clean_code = tenant_code.strip().lower().replace("-", "")
    clean_date = expiry_date_str.strip()
    clean_hw = hw_id.strip().upper().replace("-", "").replace("HW", "")
    msg = f"{clean_code}:{clean_date}:{clean_hw}"
    signature = hmac.new(
        get_license_master_secret().encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()[:8].upper()
    return signature

def generate_license_key(tenant_code: str, expiry_date_str: str, hw_id: str = "UNBOUND", custom_quotas: dict = None) -> str:
    """
    Generates a cryptographically signed machine-bound or unbound license key string.
    Format: AIDA-{TENANT_CODE}-{YYYYMMDD}-{HW8}-{SIG8}[.{BASE64_QUOTAS}]
    """
    clean_code = tenant_code.strip().upper().replace("-", "")
    clean_date_digits = expiry_date_str.strip().replace("-", "")[:8]
    clean_hw = hw_id.strip().upper().replace("-", "").replace("HW", "") or "UNBOUND"
    sig = compute_license_signature(tenant_code, expiry_date_str, clean_hw)
    base_key = f"AIDA-{clean_code}-{clean_date_digits}-{clean_hw}-{sig}"

    if custom_quotas and isinstance(custom_quotas, dict) and len(custom_quotas) > 0:
        q_bytes = json.dumps(custom_quotas, separators=(',', ':')).encode("utf-8")
        b64_q = base64.urlsafe_b64encode(q_bytes).decode("utf-8").rstrip("=")
        return f"{base_key}.{b64_q}"

    return base_key

def verify_license_key(tenant_code: str, license_key: str) -> dict:
    """
    Verifies a cryptographic, machine-bound license key for a given tenant.
    Returns dict: {"valid": bool, "expires_at": str, "reason": str, "hardware_id": str, "custom_quotas": dict}
    """
    if not license_key or not isinstance(license_key, str):
        return {"valid": False, "expires_at": None, "reason": "Lisans anahtarı bulunamadı veya boş."}

    raw_key = license_key.strip()
    custom_quotas = None
    if "." in raw_key:
        main_part, b64_part = raw_key.split(".", 1)
        raw_key = main_part
        try:
            padded = b64_part + "=" * (-len(b64_part) % 4)
            q_json = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
            custom_quotas = json.loads(q_json)
        except Exception:
            pass

    lk_upper = raw_key.upper()

    # Vendor Developer Mode / Bypass Check (for internal testing or migrations)
    if os.getenv("AIDA_DEVELOPER_MODE") == "true" or "DEVELOPER-MASTER-BYPASS" in lk_upper:
        return {"valid": True, "expires_at": "unlimited", "reason": "Geliştirici / İç Kurulum Bypass Modu", "custom_quotas": custom_quotas}

    # Unlimited / Legacy Key Bypass
    if any(kw in lk_upper for kw in ["UNLIMITED", "LIMITSIZ", "SURESIZ", "MASTER"]):
        return {"valid": True, "expires_at": "unlimited", "reason": "Süresiz Lisans", "custom_quotas": custom_quotas}

    parts = lk_upper.split("-")
    
    # Check 5-part machine-bound format: AIDA-TENANTCODE-YYYYMMDD-HW8-SIG8
    if len(parts) >= 5 and parts[0] == "AIDA":
        key_tenant_code = parts[1].strip().lower()
        date_part = parts[2]
        hw_part = parts[3]
        sig_part = parts[4]
    elif len(parts) == 4 and parts[0] == "AIDA":
        # Legacy 4-part unbound format: AIDA-TENANTCODE-YYYYMMDD-SIG8
        key_tenant_code = parts[1].strip().lower()
        date_part = parts[2]
        hw_part = "UNBOUND"
        sig_part = parts[3]
    else:
        return {"valid": False, "expires_at": None, "reason": "Lisans anahtarı biçimi geçersiz."}

    if len(date_part) != 8:
        return {"valid": False, "expires_at": None, "reason": "Tarih biçimi geçersiz."}

    yyyy = date_part[:4]
    mm = date_part[4:6]
    dd = date_part[6:8]
    expiry_date_str = f"{yyyy}-{mm}-{dd}"

    # Hardware Binding Validation (Anti-Cloning Enforcement)
    current_hw_info = get_system_hardware_fingerprint()
    current_clean_hw = current_hw_info["clean_hw_id"]

    if hw_part not in ["UNBOUND", "ANY"]:
        if hw_part.upper() != current_clean_hw.upper():
            return {
                "valid": False,
                "expires_at": expiry_date_str,
                "reason": f"Lisans bu donanıma (sunucuya) ait değildir. Sunucu kopyalanmış veya taşınmış olabilir. (Lisanslı Donanım: {hw_part}, Mevcut Sunucu: {current_clean_hw})"
            }

    # HMAC Signature Verification (Check both embedded key_tenant_code and passed tenant_code)
    sig_1 = compute_license_signature(key_tenant_code, expiry_date_str, hw_part)
    sig_2 = compute_license_signature(tenant_code, expiry_date_str, hw_part)

    if sig_part.upper() not in [sig_1, sig_2]:
        return {"valid": False, "expires_at": expiry_date_str, "reason": "Lisans imza doğrulaması başarısız (Lisans Anahtarı Geçersiz veya Değiştirilmiş)."}

    # Expiry Check (Evaluated in Turkey UTC+3 local time so expiry date is valid through 23:59:59 TR)
    try:
        exp_date = datetime.datetime.strptime(expiry_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        now_tr = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
        if exp_date < now_tr:
            return {
                "valid": False,
                "expired_only": True,
                "expires_at": expiry_date_str,
                "reason": f"Lisans süreniz dolmuştur (Bitiş Tarihi: {expiry_date_str}).",
                "hardware_id": current_hw_info["hardware_id"],
                "embedded_tenant_code": key_tenant_code,
                "custom_quotas": custom_quotas,
            }
    except Exception as e:
        return {"valid": False, "expires_at": expiry_date_str, "reason": f"Tarih hesaplama hatası: {e}"}

    return {"valid": True, "expired_only": False, "expires_at": expiry_date_str, "reason": "Lisans ve Donanım Doğrulaması Başarılı", "hardware_id": current_hw_info["hardware_id"], "embedded_tenant_code": key_tenant_code, "custom_quotas": custom_quotas}


def evaluate_tenant_effective_license(tenant: dict) -> dict:
    """
    Single-source evaluator for a tenant's effective license state, combining:
    - Cryptographic HMAC & hardware-binding verification (verify_license_key)
    - Central remote kill-switch / suspension flag (remotely_suspended)
    - Optional Grace Period ("Ek Süre" -> license_grace_until: YYYY-MM-DD)

    Grace Period ONLY extends naturally expired (validly signed & hardware-bound) licenses;
    it never bypasses hardware cloning, invalid signatures, or explicit central suspension.
    """
    if not isinstance(tenant, dict):
        return {
            "valid": False,
            "hard_expired": True,
            "in_grace_period": False,
            "is_unlimited": False,
            "days_left": 0,
            "grace_days_left": None,
            "expires_at": None,
            "license_grace_until": "",
            "reason": "Kiracı kaydı bulunamadı.",
            "verification": {},
            "custom_quotas": {},
        }

    t_code = tenant.get("code") or str(tenant.get("id", "default")).replace("tenant-", "")
    t_key = tenant.get("license_key") or ""
    verification = verify_license_key(t_code, t_key)
    embedded_q = verification.get("custom_quotas") if isinstance(verification.get("custom_quotas"), dict) else {}

    now_tr = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
    today_tr = now_tr.date()

    # Resolve grace date (tenant field takes precedence, fallback to embedded key quotas)
    raw_grace = tenant.get("license_grace_until")
    if raw_grace is None:
        raw_grace = embedded_q.get("license_grace_until")
    grace_str = str(raw_grace or "").strip()[:10]
    grace_date_obj = None
    if len(grace_str) == 10:
        try:
            grace_date_obj = datetime.datetime.strptime(grace_str, "%Y-%m-%d").date()
        except Exception:
            grace_str = ""
            grace_date_obj = None
    else:
        grace_str = ""

    # Determine unlimited & days_left
    ver_exp = verification.get("expires_at")
    is_unlimited = bool(
        ver_exp == "unlimited"
        or str(tenant.get("license_expires_at") or "").strip().lower() in ("unlimited", "limitsiz", "suresiz")
        or str(tenant.get("plan_tier") or "").strip().lower() == "unlimited"
    )
    eff_exp_str = ver_exp if (ver_exp and ver_exp != "unlimited") else str(tenant.get("license_expires_at") or "").strip()[:10]
    days_left = None
    if not is_unlimited and eff_exp_str and len(eff_exp_str) == 10:
        try:
            exp_d_obj = datetime.datetime.strptime(eff_exp_str, "%Y-%m-%d").date()
            days_left = max(0, (exp_d_obj - today_tr).days)
        except Exception:
            days_left = None

    # Explicit central kill-switch / suspension always locks hard
    if tenant.get("remotely_suspended"):
        return {
            "valid": False,
            "hard_expired": True,
            "in_grace_period": False,
            "is_unlimited": is_unlimited,
            "days_left": days_left,
            "grace_days_left": None,
            "expires_at": "unlimited" if is_unlimited else eff_exp_str,
            "license_grace_until": grace_str,
            "reason": "Lisansınız merkezi yönetim paneli tarafından askıya alınmıştır.",
            "verification": verification,
            "custom_quotas": embedded_q,
        }

    # Case 1: Cryptographically valid and not expired
    if verification.get("valid"):
        # Check if manually set to passive without grace/reason (only if remotely_suspended wasn't set,
        # check_and_update_tenant_expiration reactivates valid keys automatically).
        return {
            "valid": True,
            "hard_expired": False,
            "in_grace_period": False,
            "is_unlimited": is_unlimited,
            "days_left": days_left,
            "grace_days_left": None,
            "expires_at": "unlimited" if is_unlimited else (eff_exp_str or verification.get("expires_at")),
            "license_grace_until": grace_str,
            "reason": verification.get("reason") or "Lisans ve Donanım Doğrulaması Başarılı",
            "verification": verification,
            "custom_quotas": embedded_q,
        }

    # Case 2: Validly signed & hardware-matched, ONLY expired — check Grace Period ("Ek Süre")
    if verification.get("expired_only") and grace_date_obj is not None and grace_date_obj >= today_tr:
        grace_days_left = max(0, (grace_date_obj - today_tr).days)
        return {
            "valid": True,
            "hard_expired": False,
            "in_grace_period": True,
            "is_unlimited": False,
            "days_left": 0,
            "grace_days_left": grace_days_left,
            "expires_at": eff_exp_str or verification.get("expires_at"),
            "license_grace_until": grace_str,
            "reason": f"Ana lisans süresi doldu, Ek Süre (Grace Period) devrede (Son Tarih: {grace_str}).",
            "verification": verification,
            "custom_quotas": embedded_q,
        }

    # Case 3: Hard expired, tampered, hardware-mismatched, or missing key
    reason_msg = verification.get("reason") or "Lisans süreniz dolmuştur."
    if verification.get("expired_only") and grace_str:
        reason_msg = f"Lisans ve tanımlı ek süre ({grace_str}) sona ermiştir."

    return {
        "valid": False,
        "hard_expired": True,
        "in_grace_period": False,
        "is_unlimited": False,
        "days_left": 0,
        "grace_days_left": 0 if grace_str else None,
        "expires_at": eff_exp_str or verification.get("expires_at"),
        "license_grace_until": grace_str,
        "reason": reason_msg,
        "verification": verification,
        "custom_quotas": embedded_q,
    }


def is_tenant_license_hard_expired(settings_obj: dict, tenant_id: str = "tenant-default") -> tuple:
    """
    Fast helper for call, AI, Omnichannel, IMAP, and Dialer enforcement points.
    Returns (is_hard_expired: bool, reason: str).
    """
    if not isinstance(settings_obj, dict):
        return (False, "")
    tenants = settings_obj.get("tenants")
    if not isinstance(tenants, list) or len(tenants) == 0:
        return (False, "")
    tid_norm = str(tenant_id or "tenant-default").strip().lower()
    matched = next(
        (
            t for t in tenants
            if str(t.get("id") or "").strip().lower() == tid_norm
            or str(t.get("code") or "").strip().lower() == tid_norm
        ),
        tenants[0]
    )
    if not matched:
        return (False, "")
    ev = evaluate_tenant_effective_license(matched)
    return (bool(ev.get("hard_expired")), str(ev.get("reason") or ""))


def verify_nornia_root_sso_token(token: str) -> dict:
    """
    Verifies a short-lived HMAC-SHA256 signed Nornia Root SSO Token generated by Nornia Cloud Center.
    Format: NSSO.{b64_payload}.{sig16}
    """
    import time
    if not token or not isinstance(token, str) or not token.startswith("NSSO."):
        return {"valid": False, "reason": "Geçersiz SSO token biçimi."}

    parts = token.strip().split(".")
    if len(parts) != 3:
        return {"valid": False, "reason": "SSO token parçaları eksik."}

    _, b64_payload, sig = parts
    expected_sig = hmac.new(
        get_license_master_secret().encode("utf-8"),
        f"NORNIA_ROOT_SSO:{b64_payload}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16].upper()

    if not hmac.compare_digest(sig.upper(), expected_sig):
        return {"valid": False, "reason": "SSO token kriptografik imza doğrulaması başarısız."}

    try:
        padded = b64_payload + "=" * (-len(b64_payload) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))
    except Exception:
        return {"valid": False, "reason": "SSO token içeriği çözümlenemedi."}

    exp_ts = int(payload.get("exp") or 0)
    if int(time.time()) > exp_ts:
        return {"valid": False, "reason": "SSO token süresi dolmuş (5 dakika geçerlilik süresi aşıldı)."}

    token_hw = (payload.get("hw") or "UNBOUND").strip().upper().replace("-", "").replace("HW", "")
    if token_hw not in ("UNBOUND", "ANY", "UNKNOWN", ""):
        current_hw_info = get_system_hardware_fingerprint()
        current_clean_hw = current_hw_info["clean_hw_id"].upper()
        if token_hw != current_clean_hw:
            return {"valid": False, "reason": "SSO token bu santral donanımına ait değil."}

    return {
        "valid": True,
        "tenant_code": payload.get("t") or "default",
        "master_username": payload.get("u") or "admin",
        "role": "nornia_root",
    }


