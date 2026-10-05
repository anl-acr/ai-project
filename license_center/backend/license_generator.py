import datetime
import hashlib
import hmac
import base64
import json

LICENSE_MASTER_SECRET = "AIDA_MASTER_LICENSE_SECRET_KEY_2026_SECURE_SALT_99"

def compute_license_signature(tenant_code: str, expiry_date_str: str, hw_id: str = "UNBOUND") -> str:
    """
    Computes an 8-character uppercase HMAC-SHA256 signature for tenant_code, expiry_date, and hardware_id.
    """
    clean_code = tenant_code.strip().lower().replace("-", "")
    clean_date = expiry_date_str.strip()
    clean_hw = hw_id.strip().upper().replace("-", "").replace("HW", "")
    msg = f"{clean_code}:{clean_date}:{clean_hw}"
    signature = hmac.new(
        LICENSE_MASTER_SECRET.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()[:8].upper()
    return signature

def generate_signed_license_key(tenant_code: str, expiry_date_str: str, hw_id: str = "UNBOUND", custom_quotas: dict = None) -> str:
    """
    Generates a cryptographically signed machine-bound or unbound license key string.
    Supports embedding Base64 custom quotas payload.
    Format: AIDA-{TENANT_CODE}-{YYYYMMDD}-{HW8}-{SIG8}[.{BASE64_QUOTAS}]
    """
    clean_code = tenant_code.strip().upper().replace("-", "")
    clean_date_digits = expiry_date_str.strip().replace("-", "")[:8]
    clean_hw = hw_id.strip().upper().replace("-", "").replace("HW", "") or "UNBOUND"
    
    if expiry_date_str.lower() in ["unlimited", "suresiz", "limitsiz"]:
        base_key = f"AIDA-{clean_code}-UNLIMITED-MASTER"
    else:
        sig = compute_license_signature(tenant_code, expiry_date_str, clean_hw)
        base_key = f"AIDA-{clean_code}-{clean_date_digits}-{clean_hw}-{sig}"

    if custom_quotas and isinstance(custom_quotas, dict) and len(custom_quotas) > 0:
        q_bytes = json.dumps(custom_quotas, separators=(',', ':')).encode("utf-8")
        b64_q = base64.urlsafe_b64encode(q_bytes).decode("utf-8").rstrip("=")
        return f"{base_key}.{b64_q}"

    return base_key

def verify_signed_license_key(tenant_code: str, license_key: str, current_hw_id: str = "UNBOUND") -> dict:
    """
    Validates a cryptographic license key string and decodes embedded custom quotas if present.
    """
    if not license_key or not isinstance(license_key, str):
        return {"valid": False, "reason": "Lisans anahtarı bulunamadı veya boş."}

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
    if any(kw in lk_upper for kw in ["UNLIMITED", "LIMITSIZ", "SURESIZ", "MASTER"]):
        return {"valid": True, "expires_at": "unlimited", "reason": "Süresiz Lisans", "custom_quotas": custom_quotas}

    parts = lk_upper.split("-")
    if len(parts) >= 5 and parts[0] == "AIDA":
        date_part = parts[2]
        hw_part = parts[3]
        sig_part = parts[4]
    elif len(parts) == 4 and parts[0] == "AIDA":
        date_part = parts[2]
        hw_part = "UNBOUND"
        sig_part = parts[3]
    else:
        return {"valid": False, "reason": "Lisans anahtarı biçimi geçersiz."}

    if len(date_part) != 8:
        return {"valid": False, "reason": "Tarih biçimi geçersiz."}

    yyyy = date_part[:4]
    mm = date_part[4:6]
    dd = date_part[6:8]
    expiry_date_str = f"{yyyy}-{mm}-{dd}"

    # Hardware ID match check if bound
    if hw_part not in ["UNBOUND", "ANY"]:
        clean_current = current_hw_id.upper().replace("-", "").replace("HW", "")
        if hw_part != clean_current:
            return {
                "valid": False,
                "expires_at": expiry_date_str,
                "reason": f"Lisans başka donanıma ait (Lisanslı: {hw_part}, Mevcut: {clean_current})"
            }

    expected_sig = compute_license_signature(tenant_code, expiry_date_str, hw_part)
    if sig_part.upper() != expected_sig:
        return {"valid": False, "expires_at": expiry_date_str, "reason": "Lisans imza doğrulaması başarısız."}

    try:
        exp_date = datetime.datetime.strptime(expiry_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        if exp_date < datetime.datetime.utcnow():
            return {"valid": False, "expires_at": expiry_date_str, "reason": "Lisans süreniz dolmuştur."}
    except Exception as e:
        return {"valid": False, "expires_at": expiry_date_str, "reason": f"Tarih hatası: {e}"}

    return {"valid": True, "expires_at": expiry_date_str, "reason": "Lisans Geçerli", "custom_quotas": custom_quotas}
