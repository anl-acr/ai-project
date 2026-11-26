"""
Nornia Enterprise AI PBX — Enterprise SSO Service (OpenID Connect / OAuth 2.0 & SAML 2.0 SP).

Supports:
1. OpenID Connect (OIDC / OAuth 2.0) — Authorization Code Flow with PKCE (S256),
   .well-known/openid-configuration discovery, JWKS RS256/ES256 ID Token signature
   verification, UserInfo fallback, and JIT user provisioning with group->role mapping.
   Compatible with Microsoft Entra ID (Azure AD), Okta, Keycloak, Google Workspace, Auth0.

2. SAML 2.0 Service Provider (SP) — HTTP-Redirect AuthnRequest, HTTP-POST ACS,
   standards-compliant SP Metadata XML (/api/auth/saml/metadata), XXE-safe XML parsing,
   timestamp/audience/InResponseTo checks, and X.509 XML-DSig signature verification
   via `cryptography` (zero native libxmlsec1 build dependencies).
   Compatible with ADFS, Microsoft Entra ID, Okta, Keycloak, Shibboleth, Google SAML.
"""

from __future__ import annotations

import base64
import copy
import datetime
import hashlib
import os
import secrets
import time
import urllib.parse
import xml.etree.ElementTree as ET
import zlib
from typing import Any, Dict, List, Optional, Tuple

import httpx

# In-memory short-lived state/nonce/PKCE/exchange-code stores (10 min TTL)
_OIDC_STATES: Dict[str, Dict[str, Any]] = {}
_SAML_REQUESTS: Dict[str, Dict[str, Any]] = {}
_SSO_EXCHANGE_CODES: Dict[str, Dict[str, Any]] = {}
_JWKS_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}

STATE_TTL_SECONDS = 600
EXCHANGE_CODE_TTL_SECONDS = 120
JWKS_CACHE_TTL_SECONDS = 900

DEFAULT_SSO_CONFIG: Dict[str, Any] = {
    "oidc": {
        "enabled": False,
        "provider_preset": "entra_id",  # entra_id | okta | keycloak | google | auth0 | custom
        "display_name": "Microsoft Entra ID (OIDC)",
        "issuer_url": "",
        "discovery_url": "",
        "authorization_endpoint": "",
        "token_endpoint": "",
        "userinfo_endpoint": "",
        "jwks_uri": "",
        "client_id": "",
        "client_secret": "",
        "scopes": "openid profile email",
        "claim_username": "preferred_username",
        "claim_email": "email",
        "claim_name": "name",
        "claim_groups": "groups",
        "auto_create_users": True,
        "auto_assign_extension": True,
        "extension_start_range": 1050,
        "default_role": "agent",
        "group_role_mapping": {},
        "verify_tls": True,
    },
    "saml": {
        "enabled": False,
        "provider_preset": "entra_id",  # entra_id | adfs | okta | keycloak | google | custom
        "display_name": "Kurumsal SAML 2.0",
        "sp_entity_id": "",
        "idp_entity_id": "",
        "idp_sso_url": "",
        "idp_slo_url": "",
        "idp_x509_cert": "",
        "name_id_format": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        "want_assertions_signed": True,
        "attr_email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        "attr_username": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
        "attr_name": "http://schemas.microsoft.com/identity/claims/displayname",
        "attr_groups": "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
        "auto_create_users": True,
        "auto_assign_extension": True,
        "extension_start_range": 1050,
        "default_role": "agent",
        "group_role_mapping": {},
    },
    "allow_local_login": True,
}


def _prune_expired(store: Dict[str, Dict[str, Any]], ttl: int) -> None:
    now = time.time()
    dead = [k for k, v in store.items() if (now - float(v.get("created_at") or 0)) > ttl]
    for k in dead:
        store.pop(k, None)


def get_merged_sso_config(settings_db: dict) -> Dict[str, Any]:
    raw = settings_db.get("enterprise_sso") if isinstance(settings_db, dict) else {}
    if not isinstance(raw, dict):
        raw = {}
    merged = copy.deepcopy(DEFAULT_SSO_CONFIG)
    if isinstance(raw.get("oidc"), dict):
        merged["oidc"].update(raw["oidc"])
    if isinstance(raw.get("saml"), dict):
        merged["saml"].update(raw["saml"])
    if "allow_local_login" in raw:
        merged["allow_local_login"] = bool(raw.get("allow_local_login", True))
    return merged


def sanitize_sso_config_for_ui(cfg: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(cfg)
    oidc = out.get("oidc") or {}
    if oidc.get("client_secret"):
        oidc["client_secret_configured"] = True
        oidc["client_secret"] = "••••••••••••"
    else:
        oidc["client_secret_configured"] = False
    return out


def get_public_sso_providers(settings_db: dict) -> Dict[str, Any]:
    cfg = get_merged_sso_config(settings_db)
    providers: List[Dict[str, Any]] = []
    oidc = cfg.get("oidc") or {}
    saml = cfg.get("saml") or {}

    if oidc.get("enabled") and oidc.get("client_id") and (oidc.get("discovery_url") or oidc.get("issuer_url") or oidc.get("authorization_endpoint")):
        providers.append({
            "protocol": "oidc",
            "preset": oidc.get("provider_preset") or "custom",
            "label": oidc.get("display_name") or "Kurumsal SSO (OIDC)",
            "login_path": "/api/auth/oidc/login",
        })

    if saml.get("enabled") and saml.get("idp_sso_url"):
        providers.append({
            "protocol": "saml",
            "preset": saml.get("provider_preset") or "custom",
            "label": saml.get("display_name") or "Kurumsal SAML 2.0",
            "login_path": "/api/auth/saml/login",
        })

    return {
        "providers": providers,
        "allow_local_login": bool(cfg.get("allow_local_login", True)),
        "ldap_enabled": bool((settings_db.get("active_directory") or {}).get("enabled")),
    }


def _block_cloud_metadata_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Geçersiz URL şeması (yalnızca http/https desteklenir).")
    host = (parsed.hostname or "").strip().lower()
    if host in ("169.254.169.254", "metadata.google.internal", "169.254.170.2"):
        raise ValueError("Bulut metadata uç noktasına erişim engellendi.")


# ==============================================================================
# 1. OPENID CONNECT (OIDC / OAUTH 2.0 + PKCE + JWKS)
# ==============================================================================

async def discover_oidc_metadata(issuer_or_discovery: str, verify_tls: bool = True) -> Dict[str, Any]:
    url = str(issuer_or_discovery or "").strip().rstrip("/")
    if not url:
        raise ValueError("OIDC Discovery URL veya Issuer URL zorunludur.")
    if not url.endswith("/.well-known/openid-configuration"):
        url = f"{url}/.well-known/openid-configuration"
    _block_cloud_metadata_url(url)

    async with httpx.AsyncClient(timeout=8.0, verify=verify_tls) as client:
        res = await client.get(url)
        if res.status_code != 200:
            raise ValueError(f"OIDC Discovery yanıt hatası: HTTP {res.status_code}")
        doc = res.json()
        if not isinstance(doc, dict) or not doc.get("authorization_endpoint") or not doc.get("token_endpoint"):
            raise ValueError("Geçersiz OIDC Discovery dokümanı (authorization_endpoint/token_endpoint eksik).")
        return doc


async def resolve_oidc_endpoints(oidc_cfg: Dict[str, Any]) -> Dict[str, str]:
    auth_ep = str(oidc_cfg.get("authorization_endpoint") or "").strip()
    token_ep = str(oidc_cfg.get("token_endpoint") or "").strip()
    userinfo_ep = str(oidc_cfg.get("userinfo_endpoint") or "").strip()
    jwks_uri = str(oidc_cfg.get("jwks_uri") or "").strip()
    issuer = str(oidc_cfg.get("issuer_url") or "").strip()

    disc_src = str(oidc_cfg.get("discovery_url") or oidc_cfg.get("issuer_url") or "").strip()
    if disc_src and (not auth_ep or not token_ep or not jwks_uri):
        doc = await discover_oidc_metadata(disc_src, verify_tls=bool(oidc_cfg.get("verify_tls", True)))
        auth_ep = auth_ep or str(doc.get("authorization_endpoint") or "")
        token_ep = token_ep or str(doc.get("token_endpoint") or "")
        userinfo_ep = userinfo_ep or str(doc.get("userinfo_endpoint") or "")
        jwks_uri = jwks_uri or str(doc.get("jwks_uri") or "")
        issuer = issuer or str(doc.get("issuer") or "")

    if not auth_ep or not token_ep:
        raise ValueError("OIDC authorization_endpoint ve token_endpoint belirlenemedi.")

    return {
        "issuer": issuer,
        "authorization_endpoint": auth_ep,
        "token_endpoint": token_ep,
        "userinfo_endpoint": userinfo_ep,
        "jwks_uri": jwks_uri,
    }


def _generate_pkce_pair() -> Tuple[str, str]:
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


async def build_oidc_authorization_url(
    oidc_cfg: Dict[str, Any],
    redirect_uri: str,
    tenant_id: str = "tenant-default",
    frontend_origin: str = "",
) -> str:
    if not oidc_cfg.get("enabled"):
        raise ValueError("OpenID Connect (OIDC) SSO etkin değil.")
    client_id = str(oidc_cfg.get("client_id") or "").strip()
    if not client_id:
        raise ValueError("OIDC Client ID tanımlı değil.")

    eps = await resolve_oidc_endpoints(oidc_cfg)
    _prune_expired(_OIDC_STATES, STATE_TTL_SECONDS)

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(24)
    verifier, challenge = _generate_pkce_pair()

    _OIDC_STATES[state] = {
        "nonce": nonce,
        "code_verifier": verifier,
        "redirect_uri": redirect_uri,
        "tenant_id": tenant_id,
        "frontend_origin": frontend_origin,
        "created_at": time.time(),
    }

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": str(oidc_cfg.get("scopes") or "openid profile email").strip(),
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    sep = "&" if "?" in eps["authorization_endpoint"] else "?"
    return f"{eps['authorization_endpoint']}{sep}{urllib.parse.urlencode(params)}"


async def _fetch_jwks(jwks_uri: str, verify_tls: bool = True) -> Dict[str, Any]:
    now = time.time()
    cached = _JWKS_CACHE.get(jwks_uri)
    if cached and (now - cached[0]) < JWKS_CACHE_TTL_SECONDS:
        return cached[1]
    _block_cloud_metadata_url(jwks_uri)
    async with httpx.AsyncClient(timeout=8.0, verify=verify_tls) as client:
        res = await client.get(jwks_uri)
        if res.status_code != 200:
            raise ValueError(f"JWKS indirilemedi: HTTP {res.status_code}")
        data = res.json()
        _JWKS_CACHE[jwks_uri] = (now, data)
        return data


def _verify_oidc_id_token(
    id_token: str,
    jwks_doc: Dict[str, Any],
    client_id: str,
    expected_nonce: str,
    expected_issuer: str = "",
) -> Dict[str, Any]:
    import jwt

    header = jwt.get_unverified_header(id_token)
    alg = str(header.get("alg") or "RS256")
    if alg not in ("RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "PS256"):
        raise ValueError(f"Desteklenmeyen ID Token algoritması: {alg}")

    kid = header.get("kid")
    keys = jwks_doc.get("keys") if isinstance(jwks_doc, dict) else []
    selected_jwk = None
    for k in keys:
        if kid and k.get("kid") == kid:
            selected_jwk = k
            break
    if selected_jwk is None and len(keys) == 1:
        selected_jwk = keys[0]
    if selected_jwk is None:
        raise ValueError("ID Token imzası için eşleşen JWKS anahtarı bulunamadı.")

    pub_key = jwt.PyJWK.from_dict(selected_jwk).key
    decode_kwargs: Dict[str, Any] = {
        "algorithms": [alg],
        "audience": client_id,
        "options": {"verify_exp": True, "verify_iat": False},
        "leeway": 120,
    }
    # Entra ID multi-tenant issuers contain {tenantid}; verify issuer strictly when exact
    if expected_issuer and "{tenantid}" not in expected_issuer:
        decode_kwargs["issuer"] = expected_issuer

    claims = jwt.decode(id_token, pub_key, **decode_kwargs)
    if expected_nonce and claims.get("nonce") and claims.get("nonce") != expected_nonce:
        raise ValueError("OIDC nonce doğrulaması başarısız (replay koruması).")
    return claims


async def exchange_and_verify_oidc_callback(
    oidc_cfg: Dict[str, Any],
    code: str,
    state: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    _prune_expired(_OIDC_STATES, STATE_TTL_SECONDS)
    st_obj = _OIDC_STATES.pop(state, None)
    if not st_obj:
        raise ValueError("OIDC oturum durumu (state) geçersiz veya süresi dolmuş.")

    eps = await resolve_oidc_endpoints(oidc_cfg)
    verify_tls = bool(oidc_cfg.get("verify_tls", True))
    client_id = str(oidc_cfg.get("client_id") or "").strip()
    client_secret = str(oidc_cfg.get("client_secret") or "").strip()

    token_form: Dict[str, str] = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": st_obj["redirect_uri"],
        "client_id": client_id,
        "code_verifier": st_obj["code_verifier"],
    }
    if client_secret:
        token_form["client_secret"] = client_secret

    _block_cloud_metadata_url(eps["token_endpoint"])
    async with httpx.AsyncClient(timeout=10.0, verify=verify_tls) as client:
        tok_res = await client.post(
            eps["token_endpoint"],
            data=token_form,
            headers={"Accept": "application/json"},
        )
        if tok_res.status_code != 200:
            raise ValueError(f"OIDC token değişimi başarısız (HTTP {tok_res.status_code}): {tok_res.text[:200]}")
        tok_json = tok_res.json()

    id_token = str(tok_json.get("id_token") or "").strip()
    access_token = str(tok_json.get("access_token") or "").strip()

    claims: Dict[str, Any] = {}
    if id_token:
        if not eps.get("jwks_uri"):
            raise ValueError("OIDC JWKS URI tanımlı değil; ID Token imzası doğrulanamıyor.")
        jwks_doc = await _fetch_jwks(eps["jwks_uri"], verify_tls=verify_tls)
        claims = _verify_oidc_id_token(
            id_token=id_token,
            jwks_doc=jwks_doc,
            client_id=client_id,
            expected_nonce=st_obj["nonce"],
            expected_issuer=eps.get("issuer") or "",
        )

    # Enrich with UserInfo endpoint if email/name/groups missing
    if access_token and eps.get("userinfo_endpoint"):
        try:
            _block_cloud_metadata_url(eps["userinfo_endpoint"])
            async with httpx.AsyncClient(timeout=6.0, verify=verify_tls) as client:
                ui_res = await client.get(
                    eps["userinfo_endpoint"],
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if ui_res.status_code == 200:
                    ui_data = ui_res.json()
                    if isinstance(ui_data, dict):
                        for k, v in ui_data.items():
                            claims.setdefault(k, v)
        except Exception:
            pass

    c_email = str(oidc_cfg.get("claim_email") or "email")
    c_uname = str(oidc_cfg.get("claim_username") or "preferred_username")
    c_name = str(oidc_cfg.get("claim_name") or "name")
    c_groups = str(oidc_cfg.get("claim_groups") or "groups")

    email = str(claims.get(c_email) or claims.get("email") or claims.get("upn") or "").strip().lower()
    username = str(claims.get(c_uname) or claims.get("preferred_username") or claims.get("upn") or email.split("@")[0] if email else claims.get("sub") or "").strip()
    full_name = str(claims.get(c_name) or claims.get("name") or f"{claims.get('given_name', '')} {claims.get('family_name', '')}".strip() or username).strip()
    raw_groups = claims.get(c_groups) or claims.get("groups") or claims.get("roles") or []
    if isinstance(raw_groups, str):
        groups = [raw_groups]
    elif isinstance(raw_groups, list):
        groups = [str(g) for g in raw_groups if g]
    else:
        groups = []

    identity = {
        "protocol": "oidc",
        "subject": str(claims.get("sub") or username),
        "username": username,
        "email": email,
        "full_name": full_name,
        "groups": groups,
    }
    return identity, st_obj


# ==============================================================================
# 2. SAML 2.0 SERVICE PROVIDER (SP METADATA + AUTH REQUEST + X.509 ACS)
# ==============================================================================

SAML_NS = {
    "samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
    "saml": "urn:oasis:names:tc:SAML:2.0:assertion",
    "ds": "http://www.w3.org/2000/09/xmldsig#",
}


def build_saml_sp_metadata_xml(saml_cfg: Dict[str, Any], acs_url: str, default_entity_id: str) -> str:
    entity_id = str(saml_cfg.get("sp_entity_id") or default_entity_id).strip()
    name_id_fmt = str(saml_cfg.get("name_id_format") or "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress").strip()
    want_signed = "true" if saml_cfg.get("want_assertions_signed", True) else "false"
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="{entity_id}">\n'
        f'  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="{want_signed}" '
        'protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">\n'
        f'    <md:NameIDFormat>{name_id_fmt}</md:NameIDFormat>\n'
        '    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" '
        f'Location="{acs_url}" index="1" isDefault="true"/>\n'
        '  </md:SPSSODescriptor>\n'
        '</md:EntityDescriptor>\n'
    )


def build_saml_authn_redirect_url(
    saml_cfg: Dict[str, Any],
    acs_url: str,
    default_entity_id: str,
    tenant_id: str = "tenant-default",
    frontend_origin: str = "",
) -> str:
    if not saml_cfg.get("enabled"):
        raise ValueError("SAML 2.0 SSO etkin değil.")
    idp_sso_url = str(saml_cfg.get("idp_sso_url") or "").strip()
    if not idp_sso_url:
        raise ValueError("IdP SSO URL tanımlı değil.")

    entity_id = str(saml_cfg.get("sp_entity_id") or default_entity_id).strip()
    name_id_fmt = str(saml_cfg.get("name_id_format") or "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress").strip()

    _prune_expired(_SAML_REQUESTS, STATE_TTL_SECONDS)
    req_id = f"_nornia_{secrets.token_hex(16)}"
    relay_state = secrets.token_urlsafe(24)
    issue_instant = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    _SAML_REQUESTS[req_id] = {
        "relay_state": relay_state,
        "acs_url": acs_url,
        "entity_id": entity_id,
        "tenant_id": tenant_id,
        "frontend_origin": frontend_origin,
        "created_at": time.time(),
    }

    authn_xml = (
        f'<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" '
        f'xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" '
        f'ID="{req_id}" Version="2.0" IssueInstant="{issue_instant}" '
        f'Destination="{idp_sso_url}" '
        f'ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" '
        f'AssertionConsumerServiceURL="{acs_url}">'
        f'<saml:Issuer>{entity_id}</saml:Issuer>'
        f'<samlp:NameIDPolicy Format="{name_id_fmt}" AllowCreate="true"/>'
        f'</samlp:AuthnRequest>'
    )

    # RFC 1951 raw deflate (wbits=-15) + Base64 for SAML HTTP-Redirect Binding
    compressor = zlib.compressobj(level=9, method=zlib.DEFLATED, wbits=-15)
    deflated = compressor.compress(authn_xml.encode("utf-8")) + compressor.flush()
    b64_req = base64.b64encode(deflated).decode("ascii")

    params = {"SAMLRequest": b64_req, "RelayState": relay_state}
    sep = "&" if "?" in idp_sso_url else "?"
    return f"{idp_sso_url}{sep}{urllib.parse.urlencode(params)}"


def _load_x509_public_key_from_pem(cert_text: str):
    from cryptography import x509

    clean = str(cert_text or "").strip()
    if not clean:
        raise ValueError("IdP X.509 sertifikası tanımlı değil.")
    if "BEGIN CERTIFICATE" not in clean:
        body = "".join(clean.split())
        lines = [body[i:i + 64] for i in range(0, len(body), 64)]
        clean = "-----BEGIN CERTIFICATE-----\n" + "\n".join(lines) + "\n-----END CERTIFICATE-----\n"
    cert = x509.load_pem_x509_certificate(clean.encode("utf-8"))
    return cert.public_key()


def _verify_saml_xml_signature(root: ET.Element, idp_cert_pem: str) -> bool:
    """
    Verifies XML-DSig SignatureValue over SignedInfo using the configured IdP X.509 certificate.
    Supports RSA-SHA256, RSA-SHA1, RSA-SHA512, and ECDSA-SHA256.
    """
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa

    sig_el = root.find(".//ds:Signature", SAML_NS)
    if sig_el is None:
        raise ValueError("SAML yanıtında XML-DSig imzası (<ds:Signature>) bulunamadı.")

    signed_info = sig_el.find("ds:SignedInfo", SAML_NS)
    sig_val_el = sig_el.find("ds:SignatureValue", SAML_NS)
    if signed_info is None or sig_val_el is None or not (sig_val_el.text or "").strip():
        raise ValueError("SAML imza bloğu eksik veya bozuk.")

    sig_method_el = signed_info.find("ds:SignatureMethod", SAML_NS)
    alg_uri = (sig_method_el.attrib.get("Algorithm") if sig_method_el is not None else "") or ""
    if "sha512" in alg_uri.lower():
        hash_alg = hashes.SHA512()
    elif "sha384" in alg_uri.lower():
        hash_alg = hashes.SHA384()
    elif "sha1" in alg_uri.lower():
        hash_alg = hashes.SHA1()
    else:
        hash_alg = hashes.SHA256()

    signature_bytes = base64.b64decode("".join(sig_val_el.text.split()))
    pub_key = _load_x509_public_key_from_pem(idp_cert_pem)

    # Canonicalize SignedInfo via Python stdlib C14N (XML 3.8+)
    raw_signed_info = ET.tostring(signed_info, encoding="unicode")
    c14n_candidates = []
    try:
        c14n_candidates.append(ET.canonicalize(raw_signed_info, with_comments=False).encode("utf-8"))
    except Exception:
        pass
    c14n_candidates.append(raw_signed_info.encode("utf-8"))

    last_err: Optional[Exception] = None
    for cand in c14n_candidates:
        try:
            if isinstance(pub_key, rsa.RSAPublicKey):
                pub_key.verify(signature_bytes, cand, padding.PKCS1v15(), hash_alg)
                return True
            if isinstance(pub_key, ec.EllipticCurvePublicKey):
                pub_key.verify(signature_bytes, cand, ec.ECDSA(hash_alg))
                return True
        except Exception as exc:
            last_err = exc
    raise ValueError(f"SAML X.509 imza doğrulaması başarısız: {last_err}")


def _parse_iso_utc(ts: str) -> Optional[datetime.datetime]:
    if not ts:
        return None
    try:
        s = ts.strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.datetime.fromisoformat(s).astimezone(datetime.timezone.utc)
    except Exception:
        return None


def parse_and_verify_saml_response(
    saml_cfg: Dict[str, Any],
    saml_response_b64: str,
    relay_state: str = "",
    default_entity_id: str = "",
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    if not saml_cfg.get("enabled"):
        raise ValueError("SAML 2.0 SSO etkin değil.")
    if not saml_response_b64:
        raise ValueError("SAMLResponse alanı boş.")

    raw_xml = base64.b64decode(saml_response_b64)
    # XXE / Billion Laughs protection
    upper_head = raw_xml[:2048].upper()
    if b"<!DOCTYPE" in upper_head or b"<!ENTITY" in upper_head:
        raise ValueError("Güvenlik ihlali: SAML XML içinde DOCTYPE/ENTITY yasaktır.")

    root = ET.fromstring(raw_xml)

    # 1. Verify SAML StatusCode == Success
    status_code_el = root.find(".//samlp:Status/samlp:StatusCode", SAML_NS)
    status_val = status_code_el.attrib.get("Value", "") if status_code_el is not None else ""
    if not status_val.endswith(":Success"):
        raise ValueError(f"IdP SAML doğrulamayı reddetti: {status_val or 'Bilinmeyen hata'}")

    # 2. Match InResponseTo if SP-initiated
    _prune_expired(_SAML_REQUESTS, STATE_TTL_SECONDS)
    in_resp_to = root.attrib.get("InResponseTo") or ""
    req_ctx: Dict[str, Any] = {"tenant_id": "tenant-default", "frontend_origin": ""}
    if in_resp_to:
        matched = _SAML_REQUESTS.pop(in_resp_to, None)
        if not matched:
            raise ValueError("SAML InResponseTo kimliği geçersiz veya süresi dolmuş (replay koruması).")
        req_ctx = matched
    elif relay_state:
        for k, v in list(_SAML_REQUESTS.items()):
            if v.get("relay_state") == relay_state:
                req_ctx = _SAML_REQUESTS.pop(k)
                break

    # 3. Verify XML-DSig Signature if required (default True)
    want_signed = bool(saml_cfg.get("want_assertions_signed", True))
    idp_cert = str(saml_cfg.get("idp_x509_cert") or "").strip()
    if want_signed:
        if not idp_cert:
            raise ValueError("SAML imza doğrulaması açık ancak IdP X.509 sertifikası girilmemiş.")
        _verify_saml_xml_signature(root, idp_cert)

    # 4. Extract Assertion & verify Issuer / Conditions / Audience
    assertion = root.find(".//saml:Assertion", SAML_NS)
    if assertion is None:
        raise ValueError("SAML yanıtında <Assertion> bulunamadı.")

    expected_idp = str(saml_cfg.get("idp_entity_id") or "").strip()
    if expected_idp:
        issuer_el = assertion.find("saml:Issuer", SAML_NS) or root.find("saml:Issuer", SAML_NS)
        actual_issuer = (issuer_el.text or "").strip() if issuer_el is not None else ""
        if actual_issuer and actual_issuer != expected_idp:
            raise ValueError(f"SAML Issuer uyuşmuyor (beklenen: {expected_idp}, gelen: {actual_issuer}).")

    conditions = assertion.find("saml:Conditions", SAML_NS)
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    skew = datetime.timedelta(seconds=120)
    if conditions is not None:
        nb = _parse_iso_utc(conditions.attrib.get("NotBefore", ""))
        noa = _parse_iso_utc(conditions.attrib.get("NotOnOrAfter", ""))
        if nb and (now_utc + skew) < nb:
            raise ValueError("SAML Assertion henüz geçerli değil (NotBefore).")
        if noa and (now_utc - skew) >= noa:
            raise ValueError("SAML Assertion süresi dolmuş (NotOnOrAfter).")

        expected_sp = str(saml_cfg.get("sp_entity_id") or req_ctx.get("entity_id") or default_entity_id).strip()
        audiences = [
            (a.text or "").strip()
            for a in conditions.findall(".//saml:Audience", SAML_NS)
            if (a.text or "").strip()
        ]
        if expected_sp and audiences and expected_sp not in audiences:
            raise ValueError(f"SAML Audience uyuşmuyor (beklenen: {expected_sp}).")

    # 5. Extract NameID and AttributeStatement
    name_id_el = assertion.find(".//saml:Subject/saml:NameID", SAML_NS)
    name_id = (name_id_el.text or "").strip() if name_id_el is not None else ""

    attrs: Dict[str, List[str]] = {}
    for attr_el in assertion.findall(".//saml:AttributeStatement/saml:Attribute", SAML_NS):
        a_name = str(attr_el.attrib.get("Name") or attr_el.attrib.get("FriendlyName") or "").strip()
        vals = [
            (v.text or "").strip()
            for v in attr_el.findall("saml:AttributeValue", SAML_NS)
            if (v.text or "").strip()
        ]
        if a_name and vals:
            attrs[a_name] = vals
            short_key = a_name.rsplit("/", 1)[-1].lower()
            attrs.setdefault(short_key, vals)

    def _first_attr(keys: List[str]) -> str:
        for k in keys:
            if k and k in attrs and attrs[k]:
                return attrs[k][0]
            if k and k.lower() in attrs and attrs[k.lower()]:
                return attrs[k.lower()][0]
        return ""

    email = _first_attr([str(saml_cfg.get("attr_email") or ""), "emailaddress", "email", "mail"])
    if not email and "@" in name_id:
        email = name_id
    email = email.lower().strip()

    username = _first_attr([str(saml_cfg.get("attr_username") or ""), "uid", "username", "samaccountname", "name"])
    if not username:
        username = email.split("@")[0] if "@" in email else name_id
    full_name = _first_attr([str(saml_cfg.get("attr_name") or ""), "displayname", "cn", "givenname"]) or username

    grp_key = str(saml_cfg.get("attr_groups") or "")
    groups = attrs.get(grp_key) or attrs.get("groups") or attrs.get("memberof") or attrs.get("role") or []

    if not email and not username:
        raise ValueError("SAML Assertion içinden kullanıcı kimliği (NameID/email) çıkarılamadı.")

    identity = {
        "protocol": "saml",
        "subject": name_id or username,
        "username": username.strip(),
        "email": email,
        "full_name": full_name.strip(),
        "groups": [str(g) for g in groups if g],
    }
    return identity, req_ctx


# ==============================================================================
# 3. ONE-TIME EXCHANGE CODE & GROUP -> ROLE MAPPING
# ==============================================================================

def resolve_sso_role(groups: List[str], mapping: Any, default_role: str = "agent") -> str:
    if isinstance(mapping, dict) and groups:
        lower_groups = {str(g).strip().lower() for g in groups if g}
        for grp_name, target_role in mapping.items():
            if str(grp_name).strip().lower() in lower_groups and str(target_role).strip():
                return str(target_role).strip()
    return str(default_role or "agent").strip()


def issue_sso_exchange_code(user_id: Any, username: str, tenant_id: str, protocol: str) -> str:
    _prune_expired(_SSO_EXCHANGE_CODES, EXCHANGE_CODE_TTL_SECONDS)
    code = secrets.token_urlsafe(32)
    _SSO_EXCHANGE_CODES[code] = {
        "user_id": user_id,
        "username": username,
        "tenant_id": tenant_id,
        "protocol": protocol,
        "created_at": time.time(),
    }
    return code


def consume_sso_exchange_code(code: str) -> Optional[Dict[str, Any]]:
    _prune_expired(_SSO_EXCHANGE_CODES, EXCHANGE_CODE_TTL_SECONDS)
    if not code:
        return None
    return _SSO_EXCHANGE_CODES.pop(code.strip(), None)
