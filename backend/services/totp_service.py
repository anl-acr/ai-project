import base64
import hashlib
import hmac
import secrets
import struct
import time
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple


# ============================================================================
# 1. RFC 6238 TOTP ENGINE (Zero External Dependencies)
# ============================================================================

BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"


def generate_totp_secret(length: int = 32) -> str:
    """Generates a random RFC 4648 Base32 secret key (default 32 chars = 160 bits)."""
    return "".join(secrets.choice(BASE32_ALPHABET) for _ in range(length))


def _normalize_base32_secret(secret: str) -> bytes:
    cleaned = "".join(ch for ch in str(secret or "").upper() if ch in BASE32_ALPHABET)
    if not cleaned:
        raise ValueError("Invalid Base32 secret")
    padding = (8 - (len(cleaned) % 8)) % 8
    cleaned += "=" * padding
    return base64.b32decode(cleaned, casefold=True)


def get_totp_code(
    secret: str,
    for_time: Optional[float] = None,
    interval: int = 30,
    digits: int = 6
) -> str:
    """Computes the 6-digit RFC 6238 TOTP code for the given secret and timestamp."""
    if for_time is None:
        for_time = time.time()
    counter = int(for_time // interval)
    key = _normalize_base32_secret(secret)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    code_int = binary % (10 ** digits)
    return str(code_int).zfill(digits)


def verify_totp_code(
    secret: str,
    code: str,
    window: int = 1,
    interval: int = 30
) -> bool:
    """
    Verifies a 6-digit TOTP code against the secret with a +/- `window` step tolerance
    (default +/- 30 seconds) to handle slight phone/server clock drift.
    """
    if not secret or not code:
        return False
    clean_code = "".join(ch for ch in str(code).strip() if ch.isdigit())
    if len(clean_code) != 6:
        return False
    now = time.time()
    try:
        for offset in range(-window, window + 1):
            candidate = get_totp_code(secret, for_time=now + (offset * interval), interval=interval)
            if hmac.compare_digest(candidate, clean_code):
                return True
    except Exception as e:
        print(f"[TOTP Verify Error]: {e}")
    return False


def build_otpauth_uri(
    secret: str,
    account_name: str,
    issuer: str = "AIDA",
    method: str = "google_auth"
) -> str:
    """
    Builds standard otpauth://totp/ URI compatible with both
    Google Authenticator and Microsoft Authenticator.
    """
    clean_issuer = str(issuer or "AIDA").strip()
    clean_account = str(account_name or "user").strip()
    label = urllib.parse.quote(f"{clean_issuer}:{clean_account}")
    params = urllib.parse.urlencode({
        "secret": secret,
        "issuer": clean_issuer,
        "algorithm": "SHA1",
        "digits": "6",
        "period": "30"
    })
    return f"otpauth://totp/{label}?{params}"


# ============================================================================
# 2. ISO/IEC 18004 QR CODE SVG GENERATOR (Zero External Dependencies)
# ============================================================================
# Supports QR Versions 1..10 at Error Correction Level L (up to 271 bytes)
# Byte mode (0100), Reed-Solomon GF(256), standard masks, SVG Data URI output.

# Format: version: (total_data_codewords, ec_codewords_per_block, num_blocks_g1, data_cw_g1, num_blocks_g2, data_cw_g2, alignment_centers)
_QR_VERSION_TABLE_L: Dict[int, Tuple[int, int, int, int, int, int, List[int]]] = {
    1:  (19,  7,  1, 19, 0, 0,  []),
    2:  (34,  10, 1, 34, 0, 0,  [6, 18]),
    3:  (55,  15, 1, 55, 0, 0,  [6, 22]),
    4:  (80,  20, 1, 80, 0, 0,  [6, 26]),
    5:  (108, 26, 1, 108, 0, 0, [6, 30]),
    6:  (136, 18, 2, 68, 0, 0,  [6, 34]),
    7:  (156, 20, 2, 78, 0, 0,  [6, 22, 38]),
    8:  (194, 24, 2, 97, 0, 0,  [6, 24, 42]),
    9:  (232, 30, 2, 116, 0, 0, [6, 26, 46]),
    10: (274, 18, 2, 68, 2, 69, [6, 28, 50]),
}

# GF(256) Exp & Log tables for primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
_GF_EXP = [0] * 512
_GF_LOG = [0] * 256


def _init_gf_tables():
    val = 1
    for i in range(255):
        _GF_EXP[i] = val
        _GF_LOG[val] = i
        val <<= 1
        if val & 0x100:
            val ^= 0x11D
    for i in range(255, 512):
        _GF_EXP[i] = _GF_EXP[i - 255]


_init_gf_tables()


def _gf_mul(x: int, y: int) -> int:
    if x == 0 or y == 0:
        return 0
    return _GF_EXP[_GF_LOG[x] + _GF_LOG[y]]


def _rs_generator_poly(degree: int) -> List[int]:
    poly = [1]
    for i in range(degree):
        next_poly = [0] * (len(poly) + 1)
        root = _GF_EXP[i]
        for j, coeff in enumerate(poly):
            next_poly[j] ^= coeff
            next_poly[j + 1] ^= _gf_mul(coeff, root)
        poly = next_poly
    return poly


def _rs_encode(data_bytes: List[int], ec_len: int) -> List[int]:
    gen = _rs_generator_poly(ec_len)
    reg = [0] * ec_len
    for b in data_bytes:
        factor = b ^ reg[0]
        reg = reg[1:] + [0]
        if factor != 0:
            for j in range(ec_len):
                reg[j] ^= _gf_mul(gen[j + 1], factor)
    return reg


def _encode_qr_codewords(payload: bytes) -> Tuple[int, List[int]]:
    length = len(payload)
    selected_ver = 0
    for ver in range(1, 11):
        total_data_cw = _QR_VERSION_TABLE_L[ver][0]
        # Mode indicator (4 bits) + char count indicator (8 bits for V1-9, 16 bits for V10)
        header_bits = 12 if ver <= 9 else 20
        max_bytes = (total_data_cw * 8 - header_bits) // 8
        if length <= max_bytes:
            selected_ver = ver
            break
    if selected_ver == 0:
        raise ValueError(f"QR payload too long ({length} bytes)")

    total_data_cw, ec_cw_per_block, nb1, dcw1, nb2, dcw2, _ = _QR_VERSION_TABLE_L[selected_ver]

    bits: List[int] = []

    def _append_bits(val: int, num_bits: int):
        for i in range(num_bits - 1, -1, -1):
            bits.append((val >> i) & 1)

    # Byte mode indicator = 0100 (4 bits)
    _append_bits(0b0100, 4)
    # Character count indicator (8 bits for V1..9, 16 bits for V10+)
    _append_bits(length, 8 if selected_ver <= 9 else 16)
    for b in payload:
        _append_bits(b, 8)

    capacity_bits = total_data_cw * 8
    terminator_len = min(4, capacity_bits - len(bits))
    _append_bits(0, terminator_len)

    while len(bits) % 8 != 0:
        bits.append(0)

    data_codewords: List[int] = []
    for i in range(0, len(bits), 8):
        byte_val = 0
        for b in bits[i:i + 8]:
            byte_val = (byte_val << 1) | b
        data_codewords.append(byte_val)

    pad_bytes = [0xEC, 0x11]
    pad_idx = 0
    while len(data_codewords) < total_data_cw:
        data_codewords.append(pad_bytes[pad_idx % 2])
        pad_idx += 1

    # Split into blocks and compute RS error correction
    data_blocks: List[List[int]] = []
    ec_blocks: List[List[int]] = []
    offset = 0
    for _ in range(nb1):
        blk = data_codewords[offset:offset + dcw1]
        offset += dcw1
        data_blocks.append(blk)
        ec_blocks.append(_rs_encode(blk, ec_cw_per_block))
    for _ in range(nb2):
        blk = data_codewords[offset:offset + dcw2]
        offset += dcw2
        data_blocks.append(blk)
        ec_blocks.append(_rs_encode(blk, ec_cw_per_block))

    # Interleave data codewords
    final_codewords: List[int] = []
    max_data_len = max(dcw1, dcw2)
    for i in range(max_data_len):
        for blk in data_blocks:
            if i < len(blk):
                final_codewords.append(blk[i])
    # Interleave EC codewords
    for i in range(ec_cw_per_block):
        for blk in ec_blocks:
            final_codewords.append(blk[i])

    return selected_ver, final_codewords


def _compute_format_bits(ec_level_bits: int, mask_pattern: int) -> int:
    # EC Level L = 01
    data = (ec_level_bits << 3) | mask_pattern
    rem = data << 10
    for i in range(14, 9, -1):
        if (rem >> i) & 1:
            rem ^= (0x537 << (i - 10))
    bits = ((data << 10) | rem) ^ 0x5412
    return bits


def _compute_version_bits(version: int) -> int:
    rem = version << 12
    for i in range(17, 11, -1):
        if (rem >> i) & 1:
            rem ^= (0x1F25 << (i - 12))
    return (version << 12) | rem


def build_qr_matrix(text: str) -> List[List[bool]]:
    """Builds the boolean 2D matrix (True = dark module, False = light module) for the QR Code."""
    payload = text.encode("utf-8")
    version, codewords = _encode_qr_codewords(payload)
    size = 17 + 4 * version

    matrix: List[List[Optional[bool]]] = [[None for _ in range(size)] for _ in range(size)]
    is_function: List[List[bool]] = [[False for _ in range(size)] for _ in range(size)]

    def _set_func(r: int, c: int, dark: bool):
        if 0 <= r < size and 0 <= c < size:
            matrix[r][c] = dark
            is_function[r][c] = True

    # 1. Finder patterns + separators
    def _place_finder(top_r: int, left_c: int):
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                r, c = top_r + dr, left_c + dc
                if 0 <= r < size and 0 <= c < size:
                    if 0 <= dr <= 6 and 0 <= dc <= 6:
                        is_border = dr in (0, 6) or dc in (0, 6)
                        is_center = 2 <= dr <= 4 and 2 <= dc <= 4
                        _set_func(r, c, is_border or is_center)
                    else:
                        _set_func(r, c, False)

    _place_finder(0, 0)
    _place_finder(0, size - 7)
    _place_finder(size - 7, 0)

    # 2. Timing patterns
    for i in range(8, size - 8):
        dark = (i % 2 == 0)
        if not is_function[6][i]:
            _set_func(6, i, dark)
        if not is_function[i][6]:
            _set_func(i, 6, dark)

    # 3. Alignment patterns
    centers = _QR_VERSION_TABLE_L[version][6]
    for cr in centers:
        for cc in centers:
            if (cr == 6 and cc == 6) or (cr == 6 and cc == size - 7) or (cr == size - 7 and cc == 6):
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    dist = max(abs(dr), abs(dc))
                    _set_func(cr + dr, cc + dc, dist in (0, 2))

    # 4. Dark module & reserved format info areas
    _set_func(4 * version + 9, 8, True)
    for i in range(9):
        if not is_function[8][i]:
            _set_func(8, i, False)
        if not is_function[i][8]:
            _set_func(i, 8, False)
    for i in range(8):
        if not is_function[8][size - 1 - i]:
            _set_func(8, size - 1 - i, False)
        if not is_function[size - 1 - i][8]:
            _set_func(size - 1 - i, 8, False)

    # 5. Version info (if version >= 7)
    if version >= 7:
        vbits = _compute_version_bits(version)
        for i in range(18):
            bit = bool((vbits >> i) & 1)
            a = size - 11 + (i % 3)
            b = i // 3
            _set_func(b, a, bit)
            _set_func(a, b, bit)

    # 6. Place data bits in zig-zag order
    data_bits: List[bool] = []
    for cw in codewords:
        for b in range(7, -1, -1):
            data_bits.append(bool((cw >> b) & 1))

    bit_idx = 0
    col = size - 1
    upward = True
    while col > 0:
        if col == 6:
            col -= 1
        row_iter = range(size - 1, -1, -1) if upward else range(size)
        for r in row_iter:
            for dc in (0, -1):
                c = col + dc
                if not is_function[r][c]:
                    dark = data_bits[bit_idx] if bit_idx < len(data_bits) else False
                    bit_idx += 1
                    # Apply Mask 0: (r + c) % 2 == 0
                    if (r + c) % 2 == 0:
                        dark = not dark
                    matrix[r][c] = dark
        upward = not upward
        col -= 2

    # 7. Write Format Information for EC Level L (01) and Mask 0 (000)
    fmt_bits = _compute_format_bits(0b01, 0)
    # First copy around top-left finder pattern (i=0 is LSB at (0,8), i=14 is MSB at (8,0))
    for i in range(6):
        _set_func(i, 8, bool((fmt_bits >> i) & 1))
    _set_func(7, 8, bool((fmt_bits >> 6) & 1))
    _set_func(8, 8, bool((fmt_bits >> 7) & 1))
    _set_func(8, 7, bool((fmt_bits >> 8) & 1))
    for i in range(9, 15):
        _set_func(8, 14 - i, bool((fmt_bits >> i) & 1))

    # Second copy: top-right horizontal (i=0..7) and bottom-left vertical (i=8..14)
    for i in range(8):
        _set_func(8, size - 1 - i, bool((fmt_bits >> i) & 1))
    for i in range(8, 15):
        _set_func(size - 15 + i, 8, bool((fmt_bits >> i) & 1))

    return [[bool(cell) for cell in row] for row in matrix]


def generate_qr_svg_data_uri(text: str, border: int = 4) -> str:
    """
    Generates a crisp, standalone SVG QR Code encoded as a `data:image/svg+xml;base64,...` URI.
    Works 100% offline with zero external packages.
    """
    matrix = build_qr_matrix(text)
    size = len(matrix)
    total = size + border * 2
    path_parts: List[str] = []
    for r, row in enumerate(matrix):
        for c, dark in enumerate(row):
            if dark:
                x = c + border
                y = r + border
                path_parts.append(f"M{x},{y}h1v1h-1z")
    path_d = "".join(path_parts)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" '
        f'width="240" height="240" shape-rendering="crispEdges">'
        f'<rect width="100%" height="100%" fill="#FFFFFF"/>'
        f'<path d="{path_d}" fill="#0F172A"/>'
        f'</svg>'
    )
    b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"


# ============================================================================
# 3. E-MAIL OTP ENGINE (6-Digit Time-Bound Verification Code via SMTP)
# ============================================================================

_EMAIL_OTP_CACHE: Dict[str, Dict[str, Any]] = {}


def mask_email_address(email_str: str) -> str:
    """Masks an email address like anil.acar@example.com -> an***r@example.com."""
    raw = str(email_str or "").strip()
    if "@" not in raw:
        return raw
    local, domain = raw.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "***" if local else "***"
    else:
        masked_local = local[:2] + "***" + local[-1]
    return f"{masked_local}@{domain}"


def generate_email_otp(user_key: str, email_str: str, ttl_seconds: int = 180) -> Dict[str, Any]:
    """Generates and stores a 6-digit numeric OTP code for the given user key."""
    code = str(secrets.randbelow(900000) + 100000)
    now = time.time()
    entry = {
        "code": code,
        "email": str(email_str or "").strip(),
        "sent_at": now,
        "expires_at": now + ttl_seconds
    }
    _EMAIL_OTP_CACHE[str(user_key)] = entry
    return {
        "code": code,
        "expires_in": ttl_seconds,
        "masked_email": mask_email_address(email_str)
    }


def verify_email_otp(user_key: str, code: str, consume: bool = True) -> bool:
    """Verifies a 6-digit E-Mail OTP code for the given user key."""
    if not user_key or not code:
        return False
    clean_code = "".join(ch for ch in str(code).strip() if ch.isdigit())
    if len(clean_code) != 6:
        return False
    entry = _EMAIL_OTP_CACHE.get(str(user_key))
    if not entry:
        return False
    if time.time() > float(entry.get("expires_at", 0)):
        _EMAIL_OTP_CACHE.pop(str(user_key), None)
        return False
    if hmac.compare_digest(str(entry.get("code", "")), clean_code):
        if consume:
            _EMAIL_OTP_CACHE.pop(str(user_key), None)
        return True
    return False


async def send_2fa_email_otp(
    settings_db: dict,
    tenant_id: str,
    to_email: str,
    user_name: str,
    otp_code: str,
    ttl_seconds: int = 180
) -> Dict[str, Any]:
    """
    Sends the 6-digit 2FA verification code via the configured SMTP server
    (checks E-Mail Notifications custom SMTP first, then Channels SMTP).
    """
    from backend.services.notification_service import get_tenant_notification_settings, _send_notification_email
    import datetime

    clean_to = str(to_email or "").strip()
    if not clean_to or "@" not in clean_to:
        return {"status": "error", "message": "Kullanıcıya tanımlı geçerli bir E-Posta adresi bulunamadı."}

    cfg = get_tenant_notification_settings(settings_db, tenant_id or "tenant-default")
    # If smtp_host and smtp_user are filled in notifications config even if use_custom_smtp toggle was left off, enable it for sending
    if cfg.get("smtp_host") and cfg.get("smtp_user"):
        cfg = dict(cfg)
        cfg["use_custom_smtp"] = True

    channels_cfg = settings_db.get("channels", {})
    tr_now = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%d.%m.%Y %H:%M:%S")
    minutes_valid = max(1, ttl_seconds // 60)

    subject = f"🔐 [AIDA] İki Faktörlü Doğrulama (2FA) Kodunuz: {otp_code}"
    plain_body = (
        f"Merhaba {user_name or 'Kullanıcı'},\n\n"
        f"AIDA sistemine giriş için tek kullanımlık 2FA doğrulama kodunuz:\n\n"
        f"    {otp_code}\n\n"
        f"Bu kod {minutes_valid} dakika ({ttl_seconds} saniye) boyunca geçerlidir.\n"
        f"Tarih/Saat: {tr_now}\n\n"
        f"Eğer bu giriş denemesini siz yapmadıysanız lütfen sistem yöneticinizle iletişime geçiniz."
    )
    html_body = f"""
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
          <div style="background: linear-gradient(135deg, #e11d48, #be123c); color: #ffffff; padding: 18px 24px; font-weight: 800; font-size: 16px;">
            🔐 AIDA İki Faktörlü Doğrulama (2FA)
          </div>
          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p style="margin-top: 0; color: #334155;">Merhaba <strong>{user_name or 'Kullanıcı'}</strong>,</p>
            <p style="color: #475569;">AIDA platformuna güvenli giriş yapabilmek için aşağıdaki 6 haneli doğrulama kodunu kullanabilirsiniz:</p>
            <div style="background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
              <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0f172a;">{otp_code}</span>
            </div>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 6px;">⏱️ Bu kod <strong>{minutes_valid} dakika ({ttl_seconds} saniye)</strong> boyunca geçerlidir.</p>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 0;">Zaman (TR): {tr_now}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 18px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin-bottom: 0;">Bu işlemi siz başlatmadıysanız lütfen şifrenizi güncelleyiniz veya sistem yöneticinize bilgi veriniz.</p>
          </div>
        </div>
      </body>
    </html>
    """
    return await _send_notification_email(cfg, channels_cfg, [clean_to], subject, html_body, plain_body)


# ============================================================================
# 4. WHATSAPP 2FA OTP ENGINE (User-Initiated "Giriş Kodu" & 24h Window Reply)
# ============================================================================

_WHATSAPP_OTP_CACHE: Dict[str, Dict[str, Any]] = {}


def normalize_phone_last10(phone_str: str) -> str:
    """Extracts the last 10 digits of a phone number (e.g. +90 507 123 45 67 -> 5071234567)."""
    digits = "".join(ch for ch in str(phone_str or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def mask_phone_number(phone_str: str) -> str:
    """Masks a phone number like 05071234567 -> 0507 *** ** 67."""
    last10 = normalize_phone_last10(phone_str)
    if len(last10) == 10:
        return f"0{last10[:3]} *** ** {last10[-2:]}"
    raw = str(phone_str or "").strip()
    if len(raw) > 4:
        return raw[:3] + "***" + raw[-2:]
    return raw


def generate_whatsapp_otp(keys: List[str], phone_str: str, ttl_seconds: int = 300) -> Dict[str, Any]:
    """
    Generates a 6-digit numeric WhatsApp OTP code valid for 5 minutes (300 seconds)
    and indexes it under all provided keys (user_id, extension, last-10 phone digits)
    so pre-generated 'Giriş Kodu' replies can be verified seamlessly at login time.
    """
    code = str(secrets.randbelow(900000) + 100000)
    now = time.time()
    last10 = normalize_phone_last10(phone_str)
    all_keys = set()
    for k in (keys or []):
        ks = str(k or "").strip()
        if ks:
            all_keys.add(ks)
    if last10:
        all_keys.add(last10)

    entry = {
        "code": code,
        "phone": str(phone_str or "").strip(),
        "last10": last10,
        "keys": list(all_keys),
        "sent_at": now,
        "expires_at": now + ttl_seconds
    }
    for k in all_keys:
        _WHATSAPP_OTP_CACHE[k] = entry

    return {
        "code": code,
        "expires_in": ttl_seconds,
        "masked_phone": mask_phone_number(phone_str)
    }


def verify_whatsapp_otp(keys: List[str], code: str, consume: bool = True) -> bool:
    """Verifies a 6-digit WhatsApp OTP code against any of the user's identifiers or phone digits."""
    if not code:
        return False
    clean_code = "".join(ch for ch in str(code).strip() if ch.isdigit())
    if len(clean_code) != 6:
        return False

    now = time.time()
    candidate_keys = []
    for k in (keys or []):
        ks = str(k or "").strip()
        if ks and ks not in candidate_keys:
            candidate_keys.append(ks)
        l10 = normalize_phone_last10(ks)
        if len(l10) == 10 and l10 not in candidate_keys:
            candidate_keys.append(l10)

    for k in candidate_keys:
        entry = _WHATSAPP_OTP_CACHE.get(k)
        if not entry:
            continue
        if now > float(entry.get("expires_at", 0)):
            for rk in entry.get("keys", [k]):
                _WHATSAPP_OTP_CACHE.pop(rk, None)
            continue
        if hmac.compare_digest(str(entry.get("code", "")), clean_code):
            if consume:
                for rk in entry.get("keys", [k]):
                    _WHATSAPP_OTP_CACHE.pop(rk, None)
            return True
    return False


def format_whatsapp_2fa_message(user_name: str, otp_code: str, ttl_seconds: int = 300) -> str:
    """Formats the WhatsApp 2FA verification message."""
    minutes_valid = max(1, ttl_seconds // 60)
    return (
        f"🔐 *AIDA İki Faktörlü Doğrulama (2FA)*\n\n"
        f"Merhaba *{user_name or 'Kullanıcı'}*,\n"
        f"Sisteme güvenli giriş için tek kullanımlık doğrulama kodunuz:\n\n"
        f"👉 *{otp_code}*\n\n"
        f"⏱️ Bu kod *{minutes_valid} dakika ({ttl_seconds} saniye)* boyunca geçerlidir.\n"
        f"Giriş ekranındaki 6 haneli doğrulama alanına bu kodu yazarak giriş yapabilirsiniz."
    )


def resolve_business_whatsapp_number(settings_db: dict, tenant_id: str = "tenant-default") -> str:
    """Returns the active WhatsApp Business phone number (digits only, e.g. 908503607390)."""
    channels = (settings_db or {}).get("channels", {})
    wa_accounts = channels.get("whatsapp_accounts", [])
    if isinstance(wa_accounts, list):
        for acc in wa_accounts:
            if not isinstance(acc, dict):
                continue
            if acc.get("enabled", True) and acc.get("display_phone"):
                digits = "".join(ch for ch in str(acc.get("display_phone")) if ch.isdigit())
                if len(digits) >= 10:
                    if digits.startswith("0") and len(digits) == 11:
                        return "9" + digits
                    if len(digits) == 10:
                        return "90" + digits
                    return digits
    return "908503607390"


# ============================================================================
# 5. PASSWORD RESET TOKEN & SYSTEM-THEMED EMAIL ENGINE
# ============================================================================

_USED_PASSWORD_RESET_JTIS: Dict[str, float] = {}

_THEME_HEX_MAP: Dict[str, Tuple[str, str, str]] = {
    "indigo": ("#4f46e5", "#7c3aed", "#eef2ff"),
    "violet": ("#6d28d9", "#7c3aed", "#f5f3ff"),
    "rose": ("#e11d48", "#be123c", "#fff1f2"),
    "blue": ("#2563eb", "#4f46e5", "#eff6ff"),
    "emerald": ("#059669", "#047857", "#ecfdf5"),
    "amber": ("#d97706", "#b45309", "#fffbeb"),
    "orange": ("#ea580c", "#c2410c", "#fff7ed"),
    "cyan": ("#0891b2", "#0e7490", "#ecfeff"),
    "teal": ("#0d9488", "#0f766e", "#f0fdfa"),
    "fuchsia": ("#c026d3", "#a21caf", "#fdf4ff"),
    "sky": ("#0284c7", "#0369a1", "#f0f9ff"),
    "slate": ("#334155", "#0f172a", "#f8fafc"),
}


def _get_reset_signing_secret() -> bytes:
    import os
    raw = os.environ.get("AIDA_RESET_SECRET") or os.environ.get("JWT_SECRET") or "AIDA_PBX_SECURE_PW_RESET_HMAC_2026"
    return raw.encode("utf-8")


def compute_password_fingerprint(password_val: Optional[str]) -> str:
    raw = str(password_val or "")
    return hashlib.sha256(f"aida-pwh:{raw}".encode("utf-8")).hexdigest()[:16]


def validate_password_complexity(pw: str) -> Tuple[bool, str]:
    """
    Validates password against the 5 security criteria:
    - At least 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 digit
    - At least 1 special character
    """
    import re
    s = str(pw or "")
    if len(s) < 8:
        return False, "Şifre en az 8 karakter uzunluğunda olmalıdır."
    if not re.search(r"[A-ZÇĞİÖŞÜ]", s):
        return False, "Şifre en az 1 büyük harf içermelidir."
    if not re.search(r"[a-zçğıöşü]", s):
        return False, "Şifre en az 1 küçük harf içermelidir."
    if not re.search(r"\d", s):
        return False, "Şifre en az 1 rakam içermelidir."
    if not re.search(r"[^A-Za-z0-9ÇĞİÖŞÜçğıöşü\s]", s):
        return False, "Şifre en az 1 özel karakter (!@#$%^&*._-+ vb.) içermelidir."
    return True, "OK"


def create_password_reset_token(
    user_id: str,
    email_str: str,
    current_password: Optional[str],
    ttl_seconds: int = 1800
) -> str:
    import json
    now = int(time.time())
    payload_obj = {
        "uid": str(user_id),
        "email": str(email_str or "").strip().lower(),
        "exp": now + int(ttl_seconds),
        "jti": secrets.token_hex(8),
        "pwh": compute_password_fingerprint(current_password),
    }
    payload_bytes = json.dumps(payload_obj, separators=(",", ":"), sort_keys=True).encode("utf-8")
    b64_payload = base64.urlsafe_b64encode(payload_bytes).decode("ascii").rstrip("=")
    sig = hmac.new(_get_reset_signing_secret(), b64_payload.encode("ascii"), hashlib.sha256).digest()
    b64_sig = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    return f"{b64_payload}.{b64_sig}"


def verify_password_reset_token(token_str: str, expected_current_password: Optional[str] = None, check_pwh: bool = False) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    import json
    raw = str(token_str or "").strip()
    if "." not in raw:
        return False, None, "Geçersiz şifre sıfırlama bağlantısı."

    b64_payload, b64_sig = raw.split(".", 1)
    expected_sig = hmac.new(_get_reset_signing_secret(), b64_payload.encode("ascii"), hashlib.sha256).digest()
    expected_b64_sig = base64.urlsafe_b64encode(expected_sig).decode("ascii").rstrip("=")
    if not hmac.compare_digest(b64_sig, expected_b64_sig):
        return False, None, "Şifre sıfırlama bağlantısı doğrulanamadı."

    try:
        pad = "=" * ((4 - len(b64_payload) % 4) % 4)
        payload_obj = json.loads(base64.urlsafe_b64decode(b64_payload + pad).decode("utf-8"))
    except Exception:
        return False, None, "Şifre sıfırlama bağlantısı çözümlenemedi."

    now = time.time()
    # Prune expired JTI entries
    for k, exp_ts in list(_USED_PASSWORD_RESET_JTIS.items()):
        if now > exp_ts:
            _USED_PASSWORD_RESET_JTIS.pop(k, None)

    exp_val = float(payload_obj.get("exp", 0))
    if now > exp_val:
        return False, None, "Bu şifre sıfırlama bağlantısının süresi dolmuş (30 dakika). Lütfen giriş ekranından yeni bağlantı talep edin."

    jti = str(payload_obj.get("jti") or "")
    if jti and jti in _USED_PASSWORD_RESET_JTIS:
        return False, None, "Bu şifre sıfırlama bağlantısı daha önce kullanılmış."

    if check_pwh:
        curr_fp = compute_password_fingerprint(expected_current_password)
        if not hmac.compare_digest(str(payload_obj.get("pwh") or ""), curr_fp):
            return False, None, "Bu şifre sıfırlama bağlantısı artık geçerli değil (şifreniz zaten güncellenmiş)."

    return True, payload_obj, "OK"


def mark_password_reset_token_used(payload_obj: Dict[str, Any]) -> None:
    jti = str((payload_obj or {}).get("jti") or "")
    exp_val = float((payload_obj or {}).get("exp") or (time.time() + 3600))
    if jti:
        _USED_PASSWORD_RESET_JTIS[jti] = exp_val + 300


async def send_password_reset_email(
    settings_db: dict,
    tenant_id: str,
    to_email: str,
    full_name: str,
    extension: str,
    role: str,
    theme_color: str,
    reset_url: str,
    ttl_seconds: int = 1800
) -> Dict[str, Any]:
    """
    Dispatches a system-theme-styled HTML password reset e-mail containing
    the user's full name & account summary at the top and the password reset link at the bottom.
    """
    import datetime
    import html
    from backend.services.notification_service import get_tenant_notification_settings, _send_notification_email

    clean_to = str(to_email or "").strip()
    if not clean_to or "@" not in clean_to:
        return {"status": "error", "message": "Geçerli bir e-posta adresi bulunamadı."}

    theme_key = str(theme_color or "indigo").strip().lower()
    primary_hex, secondary_hex, soft_bg_hex = _THEME_HEX_MAP.get(theme_key, ("#4f46e5", "#7c3aed", "#eef2ff"))

    safe_name = html.escape(str(full_name or "Kullanıcı").strip())
    safe_email = html.escape(clean_to)
    safe_ext = html.escape(str(extension or "-").strip())
    role_tr_map = {
        "admin": "Sistem Yöneticisi",
        "supervisor": "Süpervizör",
        "agent": "Müşteri Temsilcisi",
        "operator": "Santral Operatörü",
    }
    safe_role = html.escape(role_tr_map.get(str(role or "").lower(), str(role or "Kullanıcı")))
    safe_url = html.escape(str(reset_url))

    tr_now = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%d.%m.%Y %H:%M:%S")
    minutes_valid = max(1, int(ttl_seconds) // 60)

    cfg = get_tenant_notification_settings(settings_db, tenant_id or "tenant-default")
    if cfg.get("smtp_host") and cfg.get("smtp_user"):
        cfg = dict(cfg)
        cfg["use_custom_smtp"] = True
    channels_cfg = settings_db.get("channels", {})

    subject = "🔐 AIDA PBX — Şifre Sıfırlama Bağlantınız"
    plain_body = (
        f"Sayın {full_name or 'Kullanıcı'},\n\n"
        f"AIDA PBX hesabınız için şifre sıfırlama talebinde bulunuldu.\n\n"
        f"Kullanıcı Ön Bilgileri:\n"
        f"- Ad Soyad: {full_name or 'Kullanıcı'}\n"
        f"- E-Posta: {clean_to}\n"
        f"- Dahili / Rol: {extension or '-'} / {safe_role}\n"
        f"- Talep Zamanı: {tr_now}\n"
        f"- Geçerlilik Süresi: {minutes_valid} dakika (Tek Kullanımlık)\n\n"
        f"Yeni şifrenizi belirlemek için lütfen aşağıdaki şifre sıfırlama bağlantısını açın:\n"
        f"{reset_url}\n"
    )

    html_body = f"""<!DOCTYPE html>
<html lang="tr">
  <body style="margin: 0; padding: 28px 14px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a;">
    <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 45px -15px rgba(15, 23, 42, 0.10);">
      
      <!-- AIDA System-Themed Header -->
      <div style="background: linear-gradient(135deg, {primary_hex} 0%, {secondary_hex} 100%); padding: 28px 32px; text-align: center; color: #ffffff;">
        <div style="display: inline-block; background: rgba(255, 255, 255, 0.16); border: 1px solid rgba(255, 255, 255, 0.28); border-radius: 14px; padding: 8px 16px; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 10px;">
          <span style="color: #fda4af;">AI</span>DA PBX
        </div>
        <div style="font-size: 18px; font-weight: 800; letter-spacing: -0.2px;">Şifre Sıfırlama Talebi</div>
        <div style="font-size: 11px; opacity: 0.86; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Çok Kanallı Yapay Zeka Santral Platformu</div>
      </div>

      <!-- Content Body -->
      <div style="padding: 30px 32px; font-size: 14px; line-height: 1.65; color: #334155;">
        <p style="margin: 0 0 14px 0; font-size: 15px; color: #0f172a;">
          Sayın <strong>{safe_name}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; color: #475569;">
          <strong>AIDA PBX</strong> sistemindeki kullanıcı hesabınız için şifre sıfırlama talebi alınmıştır. İşleme devam etmeden önce aşağıdaki hesap ön bilgilerinizi kontrol edebilirsiniz:
        </p>

        <!-- User Pre-Info Summary Card -->
        <div style="background-color: {soft_bg_hex}; border: 1px solid #e2e8f0; border-left: 4px solid {primary_hex}; border-radius: 14px; padding: 16px 20px; margin: 0 0 24px 0;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: {primary_hex}; margin-bottom: 10px;">
            Kullanıcı Ön Bilgisi
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #1e293b;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 135px;">Ad Soyad:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">{safe_name}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">E-Posta Adresi:</td>
              <td style="padding: 4px 0; font-weight: 600;">{safe_email}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Dahili / Rol:</td>
              <td style="padding: 4px 0; font-weight: 600;">{safe_ext} &bull; {safe_role}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Talep Zamanı:</td>
              <td style="padding: 4px 0;">{tr_now} (TSİ)</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Geçerlilik:</td>
              <td style="padding: 4px 0; font-weight: 600;">{minutes_valid} Dakika (Tek Kullanımlık)</td>
            </tr>
          </table>
        </div>

        <p style="margin: 0 0 22px 0; font-size: 13px; color: #64748b;">
          Bu talebi siz oluşturmadıysanız bu e-postayı dikkate almayabilirsiniz; mevcut şifreniz güvenle korunmaya devam edecektir. Yeni şifrenizi oluşturmak için aşağıdaki bağlantıyı kullanabilirsiniz:
        </p>

        <!-- Bottom Password Reset CTA & Link -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; text-align: center;">
          <a href="{safe_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, {primary_hex} 0%, {secondary_hex} 100%); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 14px 32px; border-radius: 14px; box-shadow: 0 8px 20px -6px rgba(79, 70, 229, 0.45);">
            Yeni Şifre Oluştur &rarr;
          </a>
          <div style="margin-top: 16px; font-size: 11px; color: #64748b; word-break: break-all;">
            Şifre Sıfırlama Linki:<br />
            <a href="{safe_url}" target="_blank" style="color: {primary_hex}; text-decoration: underline; font-weight: 600;">{safe_url}</a>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
        &copy; 2026 AIDA PBX &mdash; Otomatik Güvenlik Bildirimi
      </div>
    </div>
  </body>
</html>"""

    return await _send_notification_email(cfg, channels_cfg, [clean_to], subject, html_body, plain_body)


