"""
Nornia Enterprise AI PBX — Core Security, Authentication, Password Hashing & SSRF Service.

Implements:
- SEC-01: Cryptographically signed stateless session tokens (NSESS) & HttpOnly cookies,
          2FA pre-auth challenge tokens (N2FA), and central API auth middleware allowlist.
- SEC-05: Adaptive password hashing (bcrypt cost 12, direct bcrypt API compatible with bcrypt 5.x,
          with stdlib PBKDF2-SHA256 fallback) + transparent rehash-on-login.
- SEC-07: Centralized outbound URL validator (SSRF protection blocking loopback, link-local /
          cloud metadata 169.254.169.254, multicast, and private RFC1918 networks by default).
- SEC-11: Sliding-window IP + username login rate limiting.
"""

from __future__ import annotations

import base64
import copy
import hashlib
import hmac
import ipaddress
import json
import os
import secrets
import socket
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

try:
    import bcrypt as _bcrypt
except Exception:
    _bcrypt = None

SESSION_COOKIE_NAME = "nornia_session"
SESSION_TTL_DEFAULT_SECONDS = 60 * 60 * 12        # 12 hours
SESSION_TTL_REMEMBER_SECONDS = 60 * 60 * 24 * 14  # 14 days
TWO_FA_CHALLENGE_TTL_SECONDS = 60 * 10            # 10 minutes

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_SESSION_SECRET_FILE = _BACKEND_DIR / ".session_secret"
_CACHED_SESSION_SECRET: Optional[str] = None

# Sliding-window login rate limiter: key -> list[timestamps]
_LOGIN_FAILURES: Dict[str, list[float]] = {}
LOGIN_RATE_WINDOW_SECONDS = 300   # 5 minutes
LOGIN_RATE_MAX_ATTEMPTS = 10


# =============================================================================
# 1. DEDICATED SESSION SIGNING SECRET (ISOLATED FROM LICENSE_MASTER_SECRET)
# =============================================================================

def get_session_secret() -> str:
    """
    Returns the dedicated HMAC signing secret for user web/API sessions.
    Priority:
      1. Environment variable NORNIA_SESSION_SECRET
      2. Persisted 0600 keyfile at backend/.session_secret (auto-generated on first boot)
    Never reuses LICENSE_MASTER_SECRET and never falls back to a static hardcoded literal.
    """
    global _CACHED_SESSION_SECRET
    env_val = (os.getenv("NORNIA_SESSION_SECRET") or "").strip()
    if len(env_val) >= 32:
        _CACHED_SESSION_SECRET = env_val
        return env_val
    if _CACHED_SESSION_SECRET:
        return _CACHED_SESSION_SECRET

    try:
        if _SESSION_SECRET_FILE.exists():
            stored = _SESSION_SECRET_FILE.read_text(encoding="utf-8").strip()
            if len(stored) >= 32:
                _CACHED_SESSION_SECRET = stored
                return stored
    except Exception:
        pass

    generated = secrets.token_hex(32)
    try:
        _SESSION_SECRET_FILE.write_text(generated + "\n", encoding="utf-8")
        os.chmod(_SESSION_SECRET_FILE, 0o600)
    except Exception:
        pass
    _CACHED_SESSION_SECRET = generated
    return generated


# =============================================================================
# 2. ADAPTIVE PASSWORD HASHING (SEC-05 — BCRYPT COST 12 + TRANSPARENT MIGRATION)
# =============================================================================

def is_password_hashed(value: Optional[str]) -> bool:
    if not value or not isinstance(value, str):
        return False
    return (
        value.startswith("$2b$")
        or value.startswith("$2a$")
        or value.startswith("$2y$")
        or value.startswith("$pbkdf2-sha256$")
    )


def _normalize_bcrypt_bytes(plain: str) -> bytes:
    """
    bcrypt operates on up to 72 bytes. If a password exceeds 72 UTF-8 bytes,
    pre-hash with SHA-256 hex (64 ASCII bytes) so long passphrases never fail on bcrypt 5.x.
    """
    raw = plain.encode("utf-8")
    if len(raw) > 72:
        return hashlib.sha256(raw).hexdigest().encode("ascii")
    return raw


def hash_password(plain: str) -> str:
    """Hash a web user password with bcrypt (cost=12), falling back to PBKDF2-SHA256."""
    if not plain:
        return ""
    if is_password_hashed(plain):
        return plain
    if _bcrypt is not None:
        salt = _bcrypt.gensalt(rounds=12)
        hashed = _bcrypt.hashpw(_normalize_bcrypt_bytes(plain), salt)
        return hashed.decode("ascii")
    # Fallback: stdlib PBKDF2-HMAC-SHA256 (260,000 iterations)
    salt_hex = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), bytes.fromhex(salt_hex), 260_000)
    return f"$pbkdf2-sha256$260000${salt_hex}${dk.hex()}"


def verify_password(plain: str, stored: Optional[str]) -> Tuple[bool, bool]:
    """
    Verify plaintext password against stored hash (or legacy plaintext).
    Returns: (is_valid, needs_rehash)
    """
    if plain is None or stored is None or stored == "":
        return False, False
    plain_str = str(plain)
    stored_str = str(stored)

    if stored_str.startswith(("$2b$", "$2a$", "$2y$")):
        if _bcrypt is None:
            return False, False
        try:
            ok = _bcrypt.checkpw(_normalize_bcrypt_bytes(plain_str), stored_str.encode("ascii"))
            return bool(ok), False
        except Exception:
            return False, False

    if stored_str.startswith("$pbkdf2-sha256$"):
        try:
            parts = stored_str.split("$")
            # ['', 'pbkdf2-sha256', iters, salt_hex, dk_hex]
            iters = int(parts[2])
            salt = bytes.fromhex(parts[3])
            expected = parts[4]
            actual = hashlib.pbkdf2_hmac("sha256", plain_str.encode("utf-8"), salt, iters).hex()
            ok = hmac.compare_digest(actual, expected)
            return ok, (_bcrypt is not None and ok)
        except Exception:
            return False, False

    # Legacy plaintext password comparison (constant-time) -> signal transparent rehash
    ok = hmac.compare_digest(plain_str.encode("utf-8"), stored_str.encode("utf-8"))
    return ok, ok


# =============================================================================
# 3. SIGNED SESSION & 2FA CHALLENGE TOKENS (SEC-01)
# =============================================================================

def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(val: str) -> bytes:
    pad = "=" * (-len(val) % 4)
    return base64.urlsafe_b64decode(val + pad)


def create_session_token(
    user_id: str,
    role: str = "agent",
    tenant_id: str = "tenant-default",
    is_root: bool = False,
    remember_me: bool = False,
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    now = int(time.time())
    ttl = SESSION_TTL_REMEMBER_SECONDS if remember_me else SESSION_TTL_DEFAULT_SECONDS
    payload: Dict[str, Any] = {
        "uid": str(user_id),
        "role": str(role or "agent"),
        "tid": str(tenant_id or "tenant-default"),
        "root": bool(is_root),
        "iat": now,
        "exp": now + ttl,
        "jti": secrets.token_hex(8),
    }
    if extra:
        for k, v in extra.items():
            if k not in payload:
                payload[k] = v
    b64 = _b64url_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    sig = hmac.new(
        get_session_secret().encode("utf-8"),
        f"NORNIA_WEB_SESSION:{b64}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32].upper()
    return f"NSESS.{b64}.{sig}"


def verify_session_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token or not isinstance(token, str):
        return None
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != "NSESS":
        return None
    b64, sig = parts[1], parts[2]
    expected = hmac.new(
        get_session_secret().encode("utf-8"),
        f"NORNIA_WEB_SESSION:{b64}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32].upper()
    if not hmac.compare_digest(sig.upper(), expected):
        return None
    try:
        payload = json.loads(_b64url_decode(b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        if not payload.get("uid"):
            return None
        return payload
    except Exception:
        return None


def create_2fa_challenge_token(user_id: str, tenant_id: str = "tenant-default", remember_me: bool = False) -> str:
    now = int(time.time())
    payload = {
        "uid": str(user_id),
        "tid": str(tenant_id or "tenant-default"),
        "rem": bool(remember_me),
        "iat": now,
        "exp": now + TWO_FA_CHALLENGE_TTL_SECONDS,
        "jti": secrets.token_hex(6),
    }
    b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(
        get_session_secret().encode("utf-8"),
        f"NORNIA_2FA_CHALLENGE:{b64}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32].upper()
    return f"N2FA.{b64}.{sig}"


def verify_2fa_challenge_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token or not isinstance(token, str):
        return None
    parts = token.strip().split(".")
    if len(parts) != 3 or parts[0] != "N2FA":
        return None
    b64, sig = parts[1], parts[2]
    expected = hmac.new(
        get_session_secret().encode("utf-8"),
        f"NORNIA_2FA_CHALLENGE:{b64}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32].upper()
    if not hmac.compare_digest(sig.upper(), expected):
        return None
    try:
        payload = json.loads(_b64url_decode(b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def extract_session_token_from_request(request: Any) -> Optional[str]:
    """Extracts NSESS token from Authorization header, HttpOnly cookie, or WS query param."""
    auth_hdr = request.headers.get("Authorization") or request.headers.get("authorization") or ""
    if auth_hdr.lower().startswith("bearer "):
        cand = auth_hdr[7:].strip()
        if cand.startswith("NSESS."):
            return cand
    cookie_val = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_val and cookie_val.startswith("NSESS."):
        return cookie_val
    q_tok = request.query_params.get("auth_token") or request.query_params.get("token")
    if q_tok and q_tok.startswith("NSESS."):
        return q_tok
    return None


def is_request_https(request: Any) -> bool:
    proto = (request.headers.get("X-Forwarded-Proto") or request.headers.get("x-forwarded-proto") or "").lower()
    if proto == "https":
        return True
    try:
        return str(request.url.scheme).lower() == "https"
    except Exception:
        return False


def set_session_cookie(response: Any, token: str, request: Any, remember_me: bool = False) -> None:
    max_age = SESSION_TTL_REMEMBER_SECONDS if remember_me else SESSION_TTL_DEFAULT_SECONDS
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=is_request_https(request),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Any, request: Any) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_request_https(request),
        samesite="lax",
    )


# =============================================================================
# 4. LOGIN RATE LIMITER (SEC-11)
# =============================================================================

def _prune_attempts(key: str, now: float) -> list[float]:
    cutoff = now - LOGIN_RATE_WINDOW_SECONDS
    entries = [ts for ts in _LOGIN_FAILURES.get(key, []) if ts >= cutoff]
    if entries:
        _LOGIN_FAILURES[key] = entries
    else:
        _LOGIN_FAILURES.pop(key, None)
    return entries


def check_login_rate_limit(client_ip: str, username: str) -> Tuple[bool, int]:
    """
    Returns (allowed, retry_after_seconds).
    Enforces limit on both (ip, username) and overall ip (3x threshold).
    """
    now = time.time()
    norm_user = (username or "").strip().lower()
    norm_ip = (client_ip or "unknown").strip()

    pair_key = f"pair:{norm_ip}:{norm_user}"
    ip_key = f"ip:{norm_ip}"

    pair_hits = _prune_attempts(pair_key, now)
    if len(pair_hits) >= LOGIN_RATE_MAX_ATTEMPTS:
        retry = max(1, int(LOGIN_RATE_WINDOW_SECONDS - (now - pair_hits[0])))
        return False, retry

    ip_hits = _prune_attempts(ip_key, now)
    if len(ip_hits) >= LOGIN_RATE_MAX_ATTEMPTS * 3:
        retry = max(1, int(LOGIN_RATE_WINDOW_SECONDS - (now - ip_hits[0])))
        return False, retry

    return True, 0


def record_login_failure(client_ip: str, username: str) -> None:
    now = time.time()
    norm_user = (username or "").strip().lower()
    norm_ip = (client_ip or "unknown").strip()
    _LOGIN_FAILURES.setdefault(f"pair:{norm_ip}:{norm_user}", []).append(now)
    _LOGIN_FAILURES.setdefault(f"ip:{norm_ip}", []).append(now)


def clear_login_failures(client_ip: str, username: str) -> None:
    norm_user = (username or "").strip().lower()
    norm_ip = (client_ip or "unknown").strip()
    _LOGIN_FAILURES.pop(f"pair:{norm_ip}:{norm_user}", None)


# =============================================================================
# 5. USER SANITIZATION (NEVER LEAK PASSWORD HASHES OR TOTP SECRETS)
# =============================================================================

def sanitize_user_for_client(user: Dict[str, Any], include_sip_password: bool = True) -> Dict[str, Any]:
    """
    Returns a deep copy of a user dict safe for API responses:
    - Strips web `password` (sets `""` + adds `has_password: bool`)
    - Strips `two_factor_secret` and `call_panel_prefs.twoFactorMeta.secret`
    """
    clean = copy.deepcopy(user)
    raw_pw = clean.get("password")
    clean["has_password"] = bool(raw_pw)
    clean["password"] = ""
    if "two_factor_secret" in clean:
        clean["two_factor_secret"] = ""
    if not include_sip_password:
        clean["sip_password"] = ""
        if isinstance(clean.get("sip_devices"), list):
            for dev in clean["sip_devices"]:
                if isinstance(dev, dict) and "sip_password" in dev:
                    dev["sip_password"] = ""
    prefs = clean.get("call_panel_prefs")
    if isinstance(prefs, dict):
        meta = prefs.get("twoFactorMeta")
        if isinstance(meta, dict) and "secret" in meta:
            meta["secret"] = ""
    return clean


# =============================================================================
# 6. OUTBOUND SSRF URL VALIDATOR (SEC-07)
# =============================================================================

_METADATA_HOSTS = {
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.goog",
    "100.100.100.200",
}


def _is_ip_blocked(ip_obj: ipaddress._BaseAddress, allow_private: bool = False) -> bool:
    if ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_multicast or ip_obj.is_unspecified:
        return True
    if not allow_private and ip_obj.is_private:
        return True
    # Always block AWS/GCP/Azure link-local metadata range 169.254.0.0/16
    if isinstance(ip_obj, ipaddress.IPv4Address) and ip_obj in ipaddress.ip_network("169.254.0.0/16"):
        return True
    return False


def validate_outbound_url(url: str, allow_private: bool = False) -> Tuple[bool, str]:
    """
    Validates an outbound HTTP/HTTPS URL against SSRF targets.
    Blocks non-HTTP(S) schemes, cloud metadata endpoints, loopback, link-local,
    multicast, and (unless allow_private=True for admin-configured LAN CRM) RFC1918 private IPs.
    """
    if not url or not isinstance(url, str):
        return False, "URL boş olamaz."
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        return False, f"Desteklenmeyen URL şeması: {parsed.scheme or 'yok'} (yalnızca http/https)."
    hostname = (parsed.hostname or "").strip().lower()
    if not hostname:
        return False, "Geçersiz hedef alan adı."
    if hostname in ("localhost", "localhost.localdomain") or hostname in _METADATA_HOSTS:
        return False, f"Güvenlik politikası gereği engellenen hedef: {hostname}"

    # Literal IP check
    try:
        ip_obj = ipaddress.ip_address(hostname)
        if _is_ip_blocked(ip_obj, allow_private=allow_private):
            return False, f"Güvenlik politikası gereği iç/özel IP hedefine izin verilmiyor: {hostname}"
        return True, ""
    except ValueError:
        pass

    # DNS resolution check
    try:
        infos = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
        if not infos:
            return False, f"Alan adı çözümlenemedi: {hostname}"
        for info in infos:
            addr = info[4][0]
            try:
                ip_obj = ipaddress.ip_address(addr)
                if _is_ip_blocked(ip_obj, allow_private=allow_private):
                    return False, f"Hedef alan adı engellenmiş iç/özel IP'ye ({addr}) çözümleniyor."
            except ValueError:
                continue
    except socket.gaierror:
        return False, f"Alan adı çözümlenemedi: {hostname}"
    except Exception as exc:
        return False, f"URL doğrulama hatası: {exc}"

    return True, ""


def is_trusted_nornia_hub_url(url: str) -> bool:
    """Restricts Nornia Connect Hub check URLs to trusted *.nornia.com.tr hosts (or configured env hub)."""
    if not url:
        return False
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("https", "http"):
        return False
    host = (parsed.hostname or "").strip().lower()
    if not host:
        return False
    if host == "nornia.com.tr" or host.endswith(".nornia.com.tr"):
        return True
    env_hub = (os.getenv("NORNIA_CONNECT_HUB_URL") or os.getenv("NORNIA_LICENSE_HUB_URL") or "").strip()
    if env_hub:
        env_host = (urlparse(env_hub).hostname or "").strip().lower()
        if env_host and host == env_host:
            return True
    return False


# =============================================================================
# 7. CENTRAL AUTH MIDDLEWARE ALLOWLIST (SEC-01)
# =============================================================================

# Exact public paths (always accessible without user session)
_PUBLIC_EXACT_PATHS = {
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/auth/sso-verify",
    "/api/auth/sso/providers",
    "/api/auth/sso/exchange",
    "/api/auth/oidc/login",
    "/api/auth/oidc/callback",
    "/api/auth/saml/metadata",
    "/api/auth/saml/login",
    "/api/auth/saml/acs",
    "/api/auth/verify-device",
    "/api/auth/verify_2fa",
    "/api/auth/2fa/send-email-otp",
    "/api/auth/2fa/send-whatsapp-otp",
    "/api/auth/send_2fa_email",
    "/api/auth/send_2fa_whatsapp",
    "/api/auth/password-reset/request",
    "/api/auth/password-reset/verify",
    "/api/auth/password-reset/confirm",
    "/api/auth/app-magic-login",
    "/api/setup/status",
    "/api/version",
    "/api/settings/version",
    "/api/system/health",
    "/api/system/ready",
    "/api/downloads/desktop-info",
    "/api/webhooks/telegram",
    "/api/webhooks/meta",
    "/api/webhooks/instagram",
    "/api/webhooks/facebook",
    "/api/federation/heartbeat",
    "/api/federation/config-pull",
    "/api/federation/config-ack",
    "/api/federation/sync/events",
    "/api/federation/sync/media",
}

# Public prefixes (endpoints that enforce their own token/API-key/provisioning-token auth or webhooks)
_PUBLIC_PREFIXES = (
    "/api/auth/setup_2fa/",
    "/api/webhooks/whatsapp",
    "/api/webhook/whatsapp",
    "/api/omnichannel/csat/rate/",
    "/api/pms/",
    "/api/downloads/desktop/",
    "/api/downloads/mobile/",
    "/api/prov/",
    "/api/phonebook/",
    "/uploads/",
    "/api/uploads/",
    "/static/",
    "/sdk/",
)

# Asterisk Dialplan & Localhost-ONLY Internal Daemon Endpoints
# ONLY permitted when directly called from 127.0.0.1 / ::1 with NO reverse-proxy forwarding headers!
_LOOPBACK_INTERNAL_PATHS = {
    "/api/acl/check_outbound_call",
    "/api/acl/check_subscriber_call",
    "/api/acl/verify_outbound_pin",
    "/api/calls/call-flip/filter-dial",
    "/api/calls/call-flip/mark-answered",
    "/api/calls/call-flip/resolve-pull",
    "/api/calls/call-flip/session-bridge",
    "/api/calls/call-flip/session-ring",
    "/api/calls/call-flip/trigger-dialplan",
    "/api/calls/end",
    "/api/calls/ivr-event",
    "/api/calls/log_invalid",
    "/api/calls/mark_transfer_leg",
    "/api/calls/register",
    "/api/calls/resolve_chanspy",
    "/api/calls/resolve_recording_pause",
    "/api/calls/active",
    "/api/conferences/participant_joined",
    "/api/conferences/resolve_dial",
    "/api/hotdesk/dialplan_login",
    "/api/hotdesk/resolve_channel_identity",
    "/api/inbound/resolve_trunk_forward",
    "/api/queues/evaluate_routing",
    "/api/queues/resolve_display_name",
    "/api/queues/survey/config",
    "/api/queues/survey/submit",
    "/api/subscriber/dial_feature_code",
    "/api/subscriber/dialplan_profile_switch",
    "/api/subscriber/resolve_agent_ring_targets",
    "/api/subscriber/resolve_feature_code",
    "/api/subscriber/resolve_forwarding",
    "/api/trunks/check_emergency",
    "/api/trunks/resolve_outbound_dial",
    "/api/voicemail/check_pin",
    "/api/voicemail/complete",
    "/api/voicemail/ivr_action",
    "/api/voicemail/ivr_list",
    "/api/voicemail/prepare",
    "/api/webrtc/resolve_pickup_channel",
    "/api/transcripts/broadcast",
    "/api/v1/demo/order-lookup",
    "/api/settings/ras/config",
    "/api/hotel/dialplan/housekeeping",
    "/api/hotel/dialplan/wakeup",
    "/api/hotel/dialplan/wakeup-cancel",
}


def is_direct_loopback_request(request: Any) -> bool:
    """
    Returns True ONLY when the TCP peer is 127.0.0.1 / ::1 AND the request was NOT
    reverse-proxied by Nginx or Nornia Connect RAS tunnel.
    In HA cluster deployments (Nornia Spark / Midgard / Odin), opt-in env vars
    NORNIA_INTERNAL_API_TOKEN or NORNIA_TRUSTED_INTERNAL_CIDRS allow decoupled
    Asterisk / Media nodes on the private Docker/VLAN/WireGuard network to reach
    internal dialplan endpoints securely.
    """
    peer = request.client.host if request.client else ""

    # Opt-in HA shared secret header (only active if NORNIA_INTERNAL_API_TOKEN is set)
    expected_internal_tok = (os.getenv("NORNIA_INTERNAL_API_TOKEN") or "").strip()
    if expected_internal_tok:
        provided_tok = (request.headers.get("x-nornia-internal-token") or "").strip()
        if provided_tok and hmac.compare_digest(provided_tok, expected_internal_tok):
            return True

    # Opt-in HA trusted private subnet CIDRs (e.g. Docker bridge / WireGuard VLAN)
    trusted_cidrs = (os.getenv("NORNIA_TRUSTED_INTERNAL_CIDRS") or "").strip()
    if trusted_cidrs and peer:
        # Never trust requests forwarded from public internet proxies
        if not request.headers.get("x-ras-forwarded") and not request.headers.get("x-nornia-ras-tunnel"):
            try:
                peer_ip = ipaddress.ip_address(peer)
                for cidr in trusted_cidrs.split(","):
                    cidr_clean = cidr.strip()
                    if cidr_clean and peer_ip in ipaddress.ip_network(cidr_clean, strict=False):
                        return True
            except Exception:
                pass

    if peer not in ("127.0.0.1", "::1", "localhost"):
        return False
    # Nginx & Nornia Connect RAS proxy always set forwarding headers
    for hdr in ("x-forwarded-for", "x-real-ip", "x-ras-forwarded", "x-nornia-ras-tunnel", "x-forwarded-host"):
        if request.headers.get(hdr):
            return False
    return True


def is_path_exempt_from_session_auth(request: Any, setup_completed: bool = True) -> bool:
    """
    Evaluates whether an incoming HTTP request may bypass NSESS session cookie/Bearer auth.
    """
    if request.method.upper() == "OPTIONS":
        return True

    path = request.scope.get("path", "") or ""
    norm = path.rstrip("/") or "/"

    # 1. Explicit public exact paths
    if norm in _PUBLIC_EXACT_PATHS:
        return True

    # 2. Explicit public prefixes (provisioning tokens, webhooks, downloads, static uploads)
    if any(path.startswith(p) for p in _PUBLIC_PREFIXES):
        return True

    # 3. Initial Setup Wizard endpoints — ONLY accessible before setup is completed!
    if path.startswith("/api/setup/") and not setup_completed:
        return True

    # 4. External Public REST API (/api/v1/*) — enforces its own X-API-Key / Bearer key check
    #    (Excludes /api/v1/demo/* which is handled via loopback below, and never matches /api/v1_old/*)
    if path.startswith("/api/v1/") and not path.startswith("/api/v1/demo/"):
        return True

    # 5. OpenAPI docs only when explicitly enabled via env var
    if os.getenv("NORNIA_ENABLE_DOCS", "0") == "1" and norm in ("/docs", "/redoc", "/openapi.json", "/api/docs", "/api/redoc", "/api/openapi.json"):
        return True

    # 6. Direct non-proxied loopback calls from Asterisk dialplan / AudioSocket / local daemons
    if norm in _LOOPBACK_INTERNAL_PATHS and is_direct_loopback_request(request):
        return True

    return False
