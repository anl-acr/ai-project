import datetime
import hashlib
import hmac

LICENSE_MASTER_SECRET = "AIDA_MASTER_LICENSE_SECRET_KEY_2026_SECURE_SALT_99"

def compute_license_signature(tenant_code: str, expiry_date_str: str) -> str:
    """
    Computes an 8-character uppercase HMAC-SHA256 signature for a tenant code and expiry date (YYYY-MM-DD).
    """
    msg = f"{tenant_code.strip().lower()}:{expiry_date_str.strip()}"
    signature = hmac.new(
        LICENSE_MASTER_SECRET.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()[:8].upper()
    return signature

def generate_license_key(tenant_code: str, expiry_date_str: str) -> str:
    """
    Generates a cryptographically signed license key string.
    Format: AIDA-{TENANT_CODE}-{YYYYMMDD}-{SIG8}
    Example: generate_license_key("default", "2026-12-31") -> "AIDA-DEFAULT-20261231-9F4A2B8C"
    """
    clean_code = tenant_code.strip().upper().replace("-", "")
    clean_date_digits = expiry_date_str.strip().replace("-", "")[:8]
    sig = compute_license_signature(tenant_code, expiry_date_str)
    return f"AIDA-{clean_code}-{clean_date_digits}-{sig}"

def verify_license_key(tenant_code: str, license_key: str) -> dict:
    """
    Verifies a cryptographic license key for a given tenant.
    Returns dict: {"valid": bool, "expires_at": str, "reason": str}
    """
    if not license_key or not isinstance(license_key, str):
        return {"valid": False, "expires_at": None, "reason": "Lisans anahtarı bulunamadı veya boş."}

    # Allow unlimited / legacy bypass if explicitly configured
    lk_lower = license_key.strip().lower()
    if any(kw in lk_lower for kw in ["unlimited", "limitsiz", "suresiz", "master"]):
        return {"valid": True, "expires_at": "unlimited", "reason": "Süresiz Lisans"}

    parts = license_key.strip().split("-")
    # Expected format: AIDA-TENANTCODE-YYYYMMDD-SIG8
    if len(parts) < 4 or parts[0] != "AIDA":
        return {"valid": False, "expires_at": None, "reason": "Lisans anahtarı formatı geçersiz."}

    date_part = parts[2]
    sig_part = parts[3]

    if len(date_part) != 8:
        return {"valid": False, "expires_at": None, "reason": "Tarih biçimi geçersiz."}

    yyyy = date_part[:4]
    mm = date_part[4:6]
    dd = date_part[6:8]
    expiry_date_str = f"{yyyy}-{mm}-{dd}"

    expected_sig = compute_license_signature(tenant_code, expiry_date_str)
    if sig_part.upper() != expected_sig:
        return {"valid": False, "expires_at": expiry_date_str, "reason": "Lisans imza doğrulaması başarısız (Lisans Anahtarı Geçersiz veya Değiştirilmiş)."}

    # Expiry Check
    try:
        exp_date = datetime.datetime.strptime(expiry_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        now = datetime.datetime.utcnow()
        if exp_date < now:
            return {"valid": False, "expires_at": expiry_date_str, "reason": f"Lisans süreniz dolmuştur (Bitiş Tarihi: {expiry_date_str})."}
    except Exception as e:
        return {"valid": False, "expires_at": expiry_date_str, "reason": f"Tarih hesaplama hatası: {e}"}

    return {"valid": True, "expires_at": expiry_date_str, "reason": "Lisans Geçerli"}
