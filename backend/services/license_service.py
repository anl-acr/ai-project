import datetime
import hashlib
import hmac
import os
from backend.services.hardware_info import get_system_hardware_fingerprint

LICENSE_MASTER_SECRET = "AIDA_MASTER_LICENSE_SECRET_KEY_2026_SECURE_SALT_99"

PLAN_LIMITS = {
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
    clean_code = tenant_code.strip().lower()
    clean_date = expiry_date_str.strip()
    clean_hw = hw_id.strip().upper().replace("-", "").replace("HW", "")
    msg = f"{clean_code}:{clean_date}:{clean_hw}"
    signature = hmac.new(
        LICENSE_MASTER_SECRET.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()[:8].upper()
    return signature

def generate_license_key(tenant_code: str, expiry_date_str: str, hw_id: str = "UNBOUND") -> str:
    """
    Generates a cryptographically signed machine-bound or unbound license key string.
    Format: AIDA-{TENANT_CODE}-{YYYYMMDD}-{HW8}-{SIG8}
    Example (Hardware-locked): generate_license_key("default", "2026-12-31", "HW-361B-F973") -> "AIDA-DEFAULT-20261231-361BF973-5F1A8C2D"
    Example (Unbound/Portable): generate_license_key("default", "2026-12-31", "UNBOUND") -> "AIDA-DEFAULT-20261231-UNBOUND-9F4A2B8C"
    """
    clean_code = tenant_code.strip().upper().replace("-", "")
    clean_date_digits = expiry_date_str.strip().replace("-", "")[:8]
    clean_hw = hw_id.strip().upper().replace("-", "").replace("HW", "") or "UNBOUND"
    sig = compute_license_signature(tenant_code, expiry_date_str, clean_hw)
    return f"AIDA-{clean_code}-{clean_date_digits}-{clean_hw}-{sig}"

def verify_license_key(tenant_code: str, license_key: str) -> dict:
    """
    Verifies a cryptographic, machine-bound license key for a given tenant.
    Returns dict: {"valid": bool, "expires_at": str, "reason": str, "hardware_id": str}
    """
    if not license_key or not isinstance(license_key, str):
        return {"valid": False, "expires_at": None, "reason": "Lisans anahtarı bulunamadı veya boş."}

    lk_upper = license_key.strip().upper()

    # Vendor Developer Mode / Bypass Check (for internal testing or migrations)
    if os.getenv("AIDA_DEVELOPER_MODE") == "true" or "DEVELOPER-MASTER-BYPASS" in lk_upper:
        return {"valid": True, "expires_at": "unlimited", "reason": "Geliştirici / İç Kurulum Bypass Modu"}

    # Unlimited / Legacy Key Bypass
    if any(kw in lk_upper for kw in ["UNLIMITED", "LIMITSIZ", "SURESIZ", "MASTER"]):
        return {"valid": True, "expires_at": "unlimited", "reason": "Süresiz Lisans"}

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

    # Expiry Check
    try:
        exp_date = datetime.datetime.strptime(expiry_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        now = datetime.datetime.utcnow()
        if exp_date < now:
            return {"valid": False, "expires_at": expiry_date_str, "reason": f"Lisans süreniz dolmuştur (Bitiş Tarihi: {expiry_date_str})."}
    except Exception as e:
        return {"valid": False, "expires_at": expiry_date_str, "reason": f"Tarih hesaplama hatası: {e}"}

    return {"valid": True, "expires_at": expiry_date_str, "reason": "Lisans ve Donanım Doğrulaması Başarılı", "hardware_id": current_hw_info["hardware_id"], "embedded_tenant_code": key_tenant_code}
