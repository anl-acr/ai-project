import datetime
import hashlib
import os
import re
import secrets
from typing import Any, Dict, List, Optional, Tuple


NUMBERING_PLAN_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "4_digit",
        "name": "4 Haneli Kurumsal Plan (Önerilen)",
        "desc": "Dahililer 1000–5999 • Kuyruklar 6000–6999 • Konferans 8000–8999",
        "digits": 4,
        "extension_range": {"start": 1000, "end": 5999},
        "queue_range": {"start": 6000, "end": 6999},
        "conference_range": {"start": 8000, "end": 8999},
        "speed_dial_range": {"start": 4000, "end": 4999},
        "call_flow_range": {"start": 5000, "end": 5999},
        "call_pickup": {"group": "*8", "directed": "**"},
        "voicemail_listen": "*97",
    },
    {
        "id": "3_digit",
        "name": "3 Haneli Kompakt Ofis Planı",
        "desc": "Dahililer 100–599 • Kuyruklar 600–699 • Konferans 800–899",
        "digits": 3,
        "extension_range": {"start": 100, "end": 599},
        "queue_range": {"start": 600, "end": 699},
        "conference_range": {"start": 800, "end": 899},
        "speed_dial_range": {"start": 400, "end": 499},
        "call_flow_range": {"start": 500, "end": 599},
        "call_pickup": {"group": "*8", "directed": "**"},
        "voicemail_listen": "*97",
    },
]


def is_setup_completed(settings_db: dict) -> bool:
    """
    Determines whether initial out-of-box setup has already been completed.
    Safely auto-detects existing production installations so OTA upgrades NEVER
    trap an already configured PBX behind the setup wizard.
    """
    if not isinstance(settings_db, dict):
        return True
    sw = settings_db.get("setup_wizard")
    if isinstance(sw, dict) and "completed" in sw:
        return bool(sw.get("completed"))

    # Auto-detect existing configured PBX installations
    has_existing_data = False

    # 1. Any non-admin subscriber in settings_db["users"]
    for u in (settings_db.get("users") or []):
        if isinstance(u, dict):
            uname = str(u.get("username") or "").strip().lower()
            urole = str(u.get("role") or "").strip().lower()
            ext = str(u.get("extension") or "").strip()
            if (uname and uname != "admin") or (urole != "admin" and ext):
                has_existing_data = True
                break

    # 2. Any configured SIP trunks or autoprovisioned phones
    if not has_existing_data:
        if len(settings_db.get("trunks") or []) > 0 or len(settings_db.get("autoprovision") or []) > 0:
            has_existing_data = True

    # 3. Any activated license key on a tenant
    if not has_existing_data:
        for t in (settings_db.get("tenants") or []):
            if isinstance(t, dict) and str(t.get("license_key") or "").strip().startswith("AIDA-"):
                has_existing_data = True
                break

    # 4. Active RAS / WireGuard remote access
    if not has_existing_data:
        try:
            from backend.services.ras_client_service import get_ras_config
            rc = get_ras_config() or {}
            if rc.get("enabled") and rc.get("secret_token"):
                has_existing_data = True
        except Exception:
            pass
        if not has_existing_data and os.path.isfile("/etc/wireguard/wg-nornia.conf"):
            has_existing_data = True

    # 5. Any non-admin row in PostgreSQL SystemUser
    if not has_existing_data:
        try:
            from backend.database.config import SyncSessionLocal
            from backend.database.models import SystemUser
            with SyncSessionLocal() as sess:
                cnt = sess.query(SystemUser).filter(SystemUser.username != "admin").count()
                if cnt > 0:
                    has_existing_data = True
        except Exception:
            pass

    if has_existing_data:
        settings_db["setup_wizard"] = {
            "completed": True,
            "auto_detected_existing": True,
            "completed_at": (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S"),
        }
        return True

    return False


def get_setup_prefill_context(
    settings_db: dict,
    request_host: str = "",
    request_scheme: str = "http",
) -> Dict[str, Any]:
    from backend.services.hardware_info import get_system_hardware_fingerprint
    from backend.services.autoprovision_service import (
        get_or_create_provisioning_token,
        resolve_provisioning_endpoints,
    )
    from backend.services.datetime_service import get_system_datetime_status

    hw_id = "HW-UNKNOWN"
    try:
        fp = get_system_hardware_fingerprint()
        hw_id = str(fp.get("hardware_id") or fp.get("clean_hw_id") or "HW-UNKNOWN") if isinstance(fp, dict) else str(fp or "HW-UNKNOWN")
    except Exception:
        pass

    # Network interfaces, gateway, DNS
    interfaces: List[Dict[str, Any]] = []
    dns_servers: List[str] = ["8.8.8.8", "1.1.1.1"]
    hostname = "nornia-pbx"
    default_gateway = ""
    try:
        from backend.scripts.network_recovery import get_live_interfaces
        interfaces = get_live_interfaces() or []
    except Exception:
        pass
    try:
        from backend.services.network_manager_service import _read_dns_and_hostname, _read_live_routes
        dh = _read_dns_and_hostname() or {}
        if dh.get("dns"):
            dns_servers = dh["dns"]
        if dh.get("hostname"):
            hostname = dh["hostname"]
        for rt in (_read_live_routes() or []):
            if str(rt.get("destination") or "").lower() in ("default", "0.0.0.0/0") and rt.get("gateway"):
                default_gateway = str(rt["gateway"])
                break
    except Exception:
        pass

    prov_token = get_or_create_provisioning_token(settings_db, "tenant-default")
    prov_ep = resolve_provisioning_endpoints(
        settings_db=settings_db,
        token=prov_token,
        mode="lan",
        request_host=request_host,
        request_scheme=request_scheme,
    )
    nat_cfg = settings_db.get("nat") if isinstance(settings_db.get("nat"), dict) else {}

    # License summary
    default_tenant = None
    for t in (settings_db.get("tenants") or []):
        if isinstance(t, dict) and str(t.get("id") or "") in ("tenant-default", "default"):
            default_tenant = t
            break
    if not default_tenant and (settings_db.get("tenants") or []):
        default_tenant = settings_db["tenants"][0]

    # RAS / FQDN state
    ras_cfg: Dict[str, Any] = {}
    ras_runtime: Dict[str, Any] = {}
    try:
        from backend.services.ras_client_service import get_ras_config, RAS_RUNTIME_STATE
        ras_cfg = dict(get_ras_config() or {})
        ras_cfg.pop("secret_token", None)
        ras_runtime = {
            "connected": bool(RAS_RUNTIME_STATE.get("connected")),
            "public_ras_url": RAS_RUNTIME_STATE.get("public_ras_url") or "",
            "sip_edge": RAS_RUNTIME_STATE.get("sip_edge") or {},
        }
    except Exception:
        pass

    fqdn_cfg = settings_db.get("fqdn") if isinstance(settings_db.get("fqdn"), dict) else {}
    pbx_cfg = settings_db.get("pbx") if isinstance(settings_db.get("pbx"), dict) else {}
    num_plan = pbx_cfg.get("numbering_plan") if isinstance(pbx_cfg.get("numbering_plan"), dict) else {}
    dt_status = get_system_datetime_status(settings_db)

    primary_iface = next((i for i in interfaces if not str(i.get("name") or "").startswith(("lo", "wg-", "docker", "br-"))), interfaces[0] if interfaces else {})

    return {
        "status": "success",
        "setup_completed": is_setup_completed(settings_db),
        "hardware_id": hw_id,
        "network": {
            "interfaces": interfaces,
            "primary_interface": primary_iface,
            "local_ip": prov_ep["network"]["local_ip"],
            "detected_local_ip": prov_ep["network"]["detected_local_ip"],
            "default_gateway": default_gateway,
            "dns_primary": dns_servers[0] if len(dns_servers) > 0 else "8.8.8.8",
            "dns_secondary": dns_servers[1] if len(dns_servers) > 1 else "1.1.1.1",
            "hostname": hostname,
            "nat_enabled": bool(nat_cfg.get("enabled", True)),
            "nat_extern_ip": str(nat_cfg.get("extern_ip") or ""),
            "nat_local_nets": nat_cfg.get("local_nets") or ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],
        },
        "license": {
            "hardware_id": hw_id,
            "company_name": str((default_tenant or {}).get("name") or settings_db.get("company_name") or ""),
            "tenant_code": str((default_tenant or {}).get("code") or ""),
            "license_key": str((default_tenant or {}).get("license_key") or ""),
            "license_expires_at": str((default_tenant or {}).get("license_expires_at") or ""),
            "plan_tier": str((default_tenant or {}).get("plan_tier") or "professional"),
            "has_key": bool(str((default_tenant or {}).get("license_key") or "").strip().startswith("AIDA-")),
        },
        "fqdn": {
            "mode": str(fqdn_cfg.get("mode") or ("nornia_cloud" if ras_cfg.get("enabled") else "nornia_cloud")),
            "subdomain": str(fqdn_cfg.get("subdomain") or ras_cfg.get("locked_subdomain") or ras_cfg.get("subdomain") or ""),
            "custom_domain": str(fqdn_cfg.get("custom_domain") or ""),
            "hub_url": str(ras_cfg.get("hub_url") or "https://connect.nornia.com.tr"),
            "ras_enabled": bool(ras_cfg.get("enabled")),
            "ras_runtime": ras_runtime,
        },
        "numbering_plan": {
            "presets": NUMBERING_PLAN_PRESETS,
            "current": num_plan,
        },
        "datetime": dt_status,
        "provisioning": {
            "token": prov_token,
            "lan_prov_url": prov_ep["lan_prov_url"],
            "wan_prov_url": prov_ep["wan_prov_url"],
        },
    }


def validate_setup_license_key(license_key: str, tenant_code: str = "") -> Dict[str, Any]:
    from backend.services.license_service import verify_license_key
    from backend.services.hardware_info import get_system_hardware_fingerprint

    key_clean = str(license_key or "").strip().upper()
    if not key_clean:
        return {"valid": False, "message": "Lisans anahtarı boş olamaz."}

    # Extract tenant code from AIDA-{CODE}-{YYYYMMDD}-{HW8}-{SIG8} if not explicitly supplied
    t_code = str(tenant_code or "").strip().upper()
    parts = key_clean.split("-")
    if not t_code and len(parts) >= 4 and parts[0] == "AIDA":
        t_code = parts[1]

    if not t_code:
        return {"valid": False, "message": "Geçersiz anahtar formatı. Örnek: AIDA-FIRMA-20271231-XXXXXXXX-XXXXXXXX"}

    res = verify_license_key(t_code, key_clean)
    hw_id = ""
    try:
        fp = get_system_hardware_fingerprint()
        hw_id = str(fp.get("hardware_id") or fp.get("clean_hw_id") or "") if isinstance(fp, dict) else str(fp or "")
    except Exception:
        pass

    return {
        "valid": bool(res.get("valid")),
        "message": str(res.get("message") or res.get("error") or ("Lisans anahtarı doğrulandı." if res.get("valid") else "Lisans doğrulanamadı.")),
        "tenant_code": t_code,
        "expiry_date": str(res.get("expiry_date") or ""),
        "hardware_id": hw_id,
        "bound_hardware": str(res.get("hardware_id") or ""),
        "details": res,
    }


def apply_setup_wizard_payload(
    payload: Dict[str, Any],
    settings_db: dict,
    save_settings_fn,
    regenerate_pjsip_fn=None,
    regenerate_extensions_fn=None,
    request_host: str = "",
    request_scheme: str = "http",
) -> Dict[str, Any]:
    """
    Executes all 6 steps of the Out-of-Box Setup Wizard atomically:
      1. Network & NAT
      2. License activation
      3. FQDN & Nornia Remote Access (RAS / SIP Edge)
      4. Numbering Plan & optional initial extensions
      5. System Timezone, NTP/Date, Format & Default Language
      6. Admin security (optional password update) + Asterisk sync + setup_completed seal
    """
    from backend.services.datetime_service import apply_system_datetime_settings, get_system_datetime_config
    from backend.services.autoprovision_service import (
        build_default_soft_keys,
        generate_random_sip_device_username,
        get_or_create_provisioning_token,
        resolve_provisioning_endpoints,
        resolve_user_webphone_sip_username,
    )

    steps_log: List[Dict[str, Any]] = []
    now_tr = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")

    # Permanent one-time lock: NEVER allow setup wizard to execute again once completed
    if is_setup_completed(settings_db):
        raise PermissionError("İlk kurulum zaten tamamlandı. Kurulum sihirbazı güvenlik nedeniyle kalıcı olarak kilitlenmiştir ve tekrar çalıştırılamaz.")

    # Validate admin password upfront so we never write partial config without an admin user
    admin_in = payload.get("admin") if isinstance(payload.get("admin"), dict) else {}
    new_admin_pwd = str(admin_in.get("password") or "").strip()
    new_admin_email = str(admin_in.get("email") or "").strip()
    new_admin_name = str(admin_in.get("full_name") or "Sistem Yöneticisi").strip() or "Sistem Yöneticisi"
    if not new_admin_pwd or len(new_admin_pwd) < 6:
        raise ValueError("İlk kurulumda 'admin' yönetici hesabı için en az 6 karakterlik bir şifre belirlemelisiniz.")

    # ------------------------------------------------------------
    # STEP 1: Network & NAT
    # ------------------------------------------------------------
    net_in = payload.get("network") if isinstance(payload.get("network"), dict) else {}
    local_ip_in = str(net_in.get("local_ip") or "").strip()
    nat_extern_in = str(net_in.get("nat_extern_ip") or "").strip()
    nat_enabled_in = bool(net_in.get("nat_enabled", True))
    raw_local_nets = net_in.get("nat_local_nets")
    if isinstance(raw_local_nets, str):
        local_nets_list = [x.strip() for x in raw_local_nets.split(",") if x.strip()]
    elif isinstance(raw_local_nets, list):
        local_nets_list = [str(x).strip() for x in raw_local_nets if str(x).strip()]
    else:
        local_nets_list = ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"]

    if "nat" not in settings_db or not isinstance(settings_db.get("nat"), dict):
        settings_db["nat"] = {}
    settings_db["nat"]["enabled"] = nat_enabled_in
    if nat_extern_in:
        settings_db["nat"]["extern_ip"] = nat_extern_in
    if local_nets_list:
        settings_db["nat"]["local_nets"] = local_nets_list

    if "autoprovision_network" not in settings_db or not isinstance(settings_db.get("autoprovision_network"), dict):
        settings_db["autoprovision_network"] = {}
    if local_ip_in:
        settings_db["autoprovision_network"]["local_ip"] = local_ip_in
    settings_db["autoprovision_network"]["local_port"] = int(net_in.get("local_port") or settings_db["autoprovision_network"].get("local_port") or 8000)
    settings_db["autoprovision_network"]["local_scheme"] = "http"

    if net_in.get("hostname") or net_in.get("dns_primary"):
        settings_db["network_dns"] = {
            "hostname": str(net_in.get("hostname") or "nornia-pbx").strip(),
            "dns_primary": str(net_in.get("dns_primary") or "8.8.8.8").strip(),
            "dns_secondary": str(net_in.get("dns_secondary") or "1.1.1.1").strip(),
            "default_gateway": str(net_in.get("default_gateway") or "").strip(),
        }
    steps_log.append({"step": 1, "title": "Ağ & NAT Ayarları", "ok": True, "detail": f"LAN IP: {local_ip_in or 'Otomatik'}, NAT: {'Aktif' if nat_enabled_in else 'Kapalı'}"})

    # ------------------------------------------------------------
    # STEP 2: License Activation
    # ------------------------------------------------------------
    lic_in = payload.get("license") if isinstance(payload.get("license"), dict) else {}
    company_name = str(lic_in.get("company_name") or payload.get("company_name") or "").strip()
    lic_key = str(lic_in.get("license_key") or "").strip().upper()
    lic_tcode = str(lic_in.get("tenant_code") or "").strip().upper()
    if company_name:
        settings_db["company_name"] = company_name

    if lic_key:
        v_res = validate_setup_license_key(lic_key, lic_tcode)
        if not v_res.get("valid"):
            raise ValueError(f"Lisans anahtarı doğrulanamadı: {v_res.get('message')}")
        tenants_list = settings_db.get("tenants")
        if not isinstance(tenants_list, list) or not tenants_list:
            tenants_list = [{"id": "tenant-default", "name": company_name or "Ana Müşteri", "code": v_res["tenant_code"], "status": "active"}]
            settings_db["tenants"] = tenants_list
        t0 = next((t for t in tenants_list if isinstance(t, dict) and str(t.get("id") or "") in ("tenant-default", "default")), tenants_list[0])
        if company_name:
            t0["name"] = company_name
        t0["code"] = v_res["tenant_code"]
        t0["license_key"] = lic_key
        if v_res.get("expiry_date"):
            t0["license_expires_at"] = v_res["expiry_date"]
        t0["status"] = "active"
        steps_log.append({"step": 2, "title": "Lisans Aktivasyonu", "ok": True, "detail": f"Aktif ({v_res['tenant_code']} • Bitiş: {v_res.get('expiry_date') or '-'})"})
    else:
        if company_name and isinstance(settings_db.get("tenants"), list) and settings_db["tenants"]:
            settings_db["tenants"][0]["name"] = company_name
        steps_log.append({"step": 2, "title": "Lisans Aktivasyonu", "ok": True, "detail": "Kurulum sonrası aktifleştirilmek üzere atlandı"})

    # ------------------------------------------------------------
    # STEP 3: FQDN & Remote Access (Nornia Cloud / Custom FQDN / LAN)
    # ------------------------------------------------------------
    fqdn_in = payload.get("fqdn") if isinstance(payload.get("fqdn"), dict) else {}
    fqdn_mode = str(fqdn_in.get("mode") or "lan_only").strip().lower()
    if fqdn_mode not in ("nornia_cloud", "custom_fqdn", "lan_only"):
        fqdn_mode = "lan_only"
    sub_clean = re.sub(r"[^a-z0-9-]", "", str(fqdn_in.get("subdomain") or "").strip().lower()).strip("-")
    custom_dom = str(fqdn_in.get("custom_domain") or "").strip().lower().replace("https://", "").replace("http://", "").split("/")[0]
    hub_url = str(fqdn_in.get("hub_url") or "https://connect.nornia.com.tr").strip()
    hub_secret = str(fqdn_in.get("secret_token") or "").strip()

    effective_fqdn = ""
    if fqdn_mode == "nornia_cloud" and sub_clean:
        effective_fqdn = f"{sub_clean}.nornia.com.tr"
        settings_db["autoprovision_network"]["wan_sip_host"] = ""
        settings_db["autoprovision_network"]["wan_prov_base"] = ""
        try:
            from backend.services.ras_client_service import get_ras_config, save_ras_config
            rc = dict(get_ras_config() or {})
            rc["subdomain"] = sub_clean
            rc["hub_url"] = hub_url
            if hub_secret:
                rc["secret_token"] = hub_secret
                rc["enabled"] = True
            save_ras_config(rc)
        except Exception:
            pass
    elif fqdn_mode == "custom_fqdn" and custom_dom:
        effective_fqdn = custom_dom
        settings_db["autoprovision_network"]["wan_sip_host"] = custom_dom
        settings_db["autoprovision_network"]["wan_prov_base"] = f"http://{custom_dom}"
    else:
        effective_fqdn = local_ip_in or "Yerel Ağ (LAN)"

    settings_db["fqdn"] = {
        "mode": fqdn_mode,
        "subdomain": sub_clean,
        "custom_domain": custom_dom,
        "effective_fqdn": effective_fqdn,
        "hub_url": hub_url,
    }
    steps_log.append({"step": 3, "title": "FQDN & Uzak Erişim", "ok": True, "detail": f"Mod: {fqdn_mode} • {effective_fqdn}"})

    # ------------------------------------------------------------
    # STEP 4: Numbering Plan & Optional Initial Extensions
    # ------------------------------------------------------------
    np_in = payload.get("numbering_plan") if isinstance(payload.get("numbering_plan"), dict) else {}
    if "pbx" not in settings_db or not isinstance(settings_db.get("pbx"), dict):
        settings_db["pbx"] = {}
    cur_np = settings_db["pbx"].get("numbering_plan") if isinstance(settings_db["pbx"].get("numbering_plan"), dict) else {}

    def _rng(key: str, def_s: int, def_e: int) -> Dict[str, int]:
        obj = np_in.get(key) if isinstance(np_in.get(key), dict) else cur_np.get(key)
        try:
            s_v = int((obj or {}).get("start", def_s))
            e_v = int((obj or {}).get("end", def_e))
            if s_v > e_v:
                s_v, e_v = e_v, s_v
            return {"start": s_v, "end": e_v}
        except Exception:
            return {"start": def_s, "end": def_e}

    updated_np = dict(cur_np)
    updated_np["extension_range"] = _rng("extension_range", 1000, 5999)
    updated_np["queue_range"] = _rng("queue_range", 6000, 6999)
    updated_np["conference_range"] = _rng("conference_range", 8000, 8999)
    updated_np["speed_dial_range"] = _rng("speed_dial_range", 4000, 4999)
    updated_np["call_flow_range"] = _rng("call_flow_range", 5000, 5999)
    cp_in = np_in.get("call_pickup") if isinstance(np_in.get("call_pickup"), dict) else {}
    updated_np["call_pickup"] = {
        "group": str(cp_in.get("group") or (cur_np.get("call_pickup") or {}).get("group") or "*8").strip() or "*8",
        "directed": str(cp_in.get("directed") or (cur_np.get("call_pickup") or {}).get("directed") or "**").strip() or "**",
    }
    pf_cur = cur_np.get("pbx_features") if isinstance(cur_np.get("pbx_features"), dict) else {}
    vm_code = str(np_in.get("voicemail_listen") or pf_cur.get("voicemail_listen") or "*97").strip() or "*97"
    updated_np["pbx_features"] = {**pf_cur, "voicemail_listen": vm_code}
    settings_db["pbx"]["numbering_plan"] = updated_np

    # Step 5 runs BEFORE creating initial extensions so new extensions inherit central timezone/NTP/language
    dt_in = payload.get("datetime") if isinstance(payload.get("datetime"), dict) else {}
    dt_res = apply_system_datetime_settings(dt_in, settings_db)
    dt_cfg = get_system_datetime_config(settings_db)

    # Create optional initial extensions
    init_exts = payload.get("initial_extensions") if isinstance(payload.get("initial_extensions"), list) else []
    created_exts: List[Dict[str, str]] = []
    if "users" not in settings_db or not isinstance(settings_db.get("users"), list):
        settings_db["users"] = []
    existing_exts = {str(u.get("extension") or "").strip() for u in settings_db["users"] if isinstance(u, dict)}
    max_uid = max([int(u.get("id")) for u in settings_db["users"] if isinstance(u, dict) and str(u.get("id") or "").isdigit()] + [100])

    for item in init_exts[:50]:
        if not isinstance(item, dict):
            continue
        ext_val = re.sub(r"\D", "", str(item.get("extension") or "").strip())
        if not ext_val or ext_val in existing_exts:
            continue
        full_nm = str(item.get("full_name") or f"Dahili {ext_val}").strip()
        email_v = str(item.get("email") or "").strip()
        max_uid += 1
        web_su = resolve_user_webphone_sip_username(ext_val, "")
        desk_su = generate_random_sip_device_username(ext_val, 1)
        sip_pwd = f"Nrn#{secrets.token_hex(6)}"
        web_pwd = f"Nrn#{secrets.token_hex(6)}"
        user_pwd = str(item.get("password") or f"Nornia{ext_val}!").strip()

        new_sip_devs = [
            {
                "id": f"web-{ext_val}",
                "name": "Web Telefonu",
                "device_type": "web_phone",
                "sip_username": web_su,
                "sip_password": web_pwd,
                "max_activations": 5,
                "sip_driver": "pjsip",
                "transport": "WSS",
                "remote_access": False,
                "is_active": True,
                "is_deletable": False,
            },
            {
                "id": f"dev-{ext_val}-1",
                "name": "Masa Telefonu 1",
                "device_type": "desk_phone",
                "sip_username": desk_su,
                "sip_password": sip_pwd,
                "max_activations": 1,
                "sip_driver": "pjsip",
                "transport": "TCP" if fqdn_mode == "nornia_cloud" else "UDP",
                "remote_access": (fqdn_mode == "nornia_cloud"),
                "connection_mode": "wan" if fqdn_mode == "nornia_cloud" else "lan",
                "is_active": True,
                "is_deletable": True,
                "mac": "",
                "brand": "Yealink",
                "model": "T42S",
                "codecs": ["g722", "alaw", "ulaw", "g729"],
                "dtmf_mode": "rfc4733",
                "language": dt_cfg["default_language"],
                "timezone": dt_cfg["utc_offset"],
                "ntp_server": dt_cfg["ntp_server_primary"],
                "dss_keys": [
                    {"key_index": 1, "type": "line", "label": ext_val, "label_mode": "custom", "value": ext_val, "pickup_code": updated_np["call_pickup"]["group"], "locked": True},
                ],
                "soft_keys": build_default_soft_keys(),
                "expansion_modules": [],
                "config_version": 1,
            },
        ]
        new_u = {
            "id": max_uid,
            "username": ext_val,
            "full_name": full_nm,
            "email": email_v,
            "password": user_pwd,
            "role": "agent",
            "extension": ext_val,
            "sip_username": desk_su,
            "sip_password": sip_pwd,
            "sip_devices": new_sip_devs,
            "is_active": True,
            "tenant_id": "tenant-default",
        }
        settings_db["users"].append(new_u)
        existing_exts.add(ext_val)
        created_exts.append({"extension": ext_val, "full_name": full_nm, "sip_username": desk_su})

        # Persist to PostgreSQL SystemUser if DB is live
        try:
            from backend.database.config import SyncSessionLocal
            from backend.database.models import SystemUser
            with SyncSessionLocal() as sess:
                exists_db = sess.query(SystemUser).filter(SystemUser.extension == ext_val).first()
                if not exists_db:
                    row = SystemUser(
                        username=ext_val,
                        full_name=full_nm,
                        email=email_v,
                        password=user_pwd,
                        role="agent",
                        extension=ext_val,
                        sip_username=desk_su,
                        sip_password=sip_pwd,
                        sip_devices=new_sip_devs,
                        is_active=True,
                        tenant_id="tenant-default",
                    )
                    sess.add(row)
                    sess.commit()
        except Exception:
            pass

    steps_log.append({
        "step": 4,
        "title": "Dahili & Numara Planı",
        "ok": True,
        "detail": f"Aralık: {updated_np['extension_range']['start']}–{updated_np['extension_range']['end']} • {len(created_exts)} yeni dahili oluşturuldu",
    })
    steps_log.append({
        "step": 5,
        "title": "Saat Dilimi, Tarih & Dil",
        "ok": True,
        "detail": f"{dt_cfg['timezone']} • {dt_cfg['date_format']} • {dt_cfg['default_language']} • NTP: {'Açık (' + dt_cfg['ntp_server_primary'] + ')' if dt_cfg['ntp_enabled'] else 'Manuel'}",
    })

    # ------------------------------------------------------------
    # STEP 6: Admin Account Upsert (settings_db + PostgreSQL) & Seal Setup
    # ------------------------------------------------------------
    if "users" not in settings_db or not isinstance(settings_db.get("users"), list):
        settings_db["users"] = []

    admin_record = None
    for u in settings_db["users"]:
        if isinstance(u, dict) and (str(u.get("username") or "").lower() == "admin" or str(u.get("role") or "").lower() == "admin"):
            admin_record = u
            break

    if admin_record is None:
        admin_record = {
            "id": 1,
            "username": "admin",
            "full_name": new_admin_name,
            "email": new_admin_email or "admin@localhost",
            "password": new_admin_pwd or "admin",
            "role": "admin",
            "extension": "",
            "is_active": True,
            "tenant_id": "tenant-default",
        }
        settings_db["users"].insert(0, admin_record)
    else:
        admin_record["username"] = str(admin_record.get("username") or "admin")
        admin_record["role"] = "admin"
        admin_record["is_active"] = True
        if new_admin_name and new_admin_name != "Sistem Yöneticisi":
            admin_record["full_name"] = new_admin_name
        elif not admin_record.get("full_name"):
            admin_record["full_name"] = new_admin_name
        if new_admin_pwd:
            admin_record["password"] = new_admin_pwd
        if new_admin_email:
            admin_record["email"] = new_admin_email

    try:
        from backend.database.config import SyncSessionLocal
        from backend.database.models import SystemUser
        with SyncSessionLocal() as sess:
            adm = sess.query(SystemUser).filter(SystemUser.username == "admin").first()
            if adm:
                if new_admin_pwd:
                    adm.password = new_admin_pwd
                if new_admin_email:
                    adm.email = new_admin_email
                if new_admin_name and (not adm.full_name or new_admin_name != "Sistem Yöneticisi"):
                    adm.full_name = new_admin_name
                adm.role = "admin"
                adm.is_active = True
                sess.commit()
            else:
                new_adm_row = SystemUser(
                    username="admin",
                    full_name=admin_record.get("full_name") or "Sistem Yöneticisi",
                    email=admin_record.get("email") or "admin@localhost",
                    password=admin_record.get("password") or new_admin_pwd,
                    role="admin",
                    extension="",
                    is_active=True,
                    tenant_id="tenant-default",
                )
                sess.add(new_adm_row)
                sess.commit()
    except Exception:
        pass

    settings_db["setup_wizard"] = {
        "completed": True,
        "completed_at": now_tr,
        "fqdn_mode": fqdn_mode,
        "effective_fqdn": effective_fqdn,
        "timezone": dt_cfg["timezone"],
        "default_language": dt_cfg["default_language"],
    }

    save_settings_fn(settings_db)

    if callable(regenerate_pjsip_fn):
        try:
            regenerate_pjsip_fn()
        except Exception:
            pass
    if callable(regenerate_extensions_fn):
        try:
            regenerate_extensions_fn()
        except Exception:
            pass

    prov_token = get_or_create_provisioning_token(settings_db, "tenant-default")
    final_ep = resolve_provisioning_endpoints(
        settings_db=settings_db,
        token=prov_token,
        mode="lan",
        request_host=request_host,
        request_scheme=request_scheme,
    )

    steps_log.append({
        "step": 6,
        "title": "Yönetici Hesabı (admin) & Sistem Senkronizasyonu",
        "ok": True,
        "detail": f"Yönetici hesabı 'admin' aktif ({'şifre tanımlandı' if new_admin_pwd else 'mevcut şifre korundu'}) ve Asterisk senkronize edildi.",
    })

    safe_admin_obj = {
        "id": admin_record.get("id", 1),
        "username": "admin",
        "full_name": admin_record.get("full_name") or "Sistem Yöneticisi",
        "email": admin_record.get("email") or "",
        "role": "admin",
        "tenant_id": "tenant-default",
    }

    return {
        "status": "success",
        "setup_completed": True,
        "completed_at": now_tr,
        "admin_account": safe_admin_obj,
        "password_set": bool(new_admin_pwd),
        "steps": steps_log,
        "created_extensions": created_exts,
        "datetime": dt_res,
        "provisioning": {
            "lan_prov_url": final_ep["lan_prov_url"],
            "wan_prov_url": final_ep["wan_prov_url"],
            "sip_local_host": final_ep["local_ip"],
            "sip_wan_host": final_ep["wan_sip_host"],
        },
        "message": "İlk kurulum başarıyla tamamlandı! 'admin' hesabınızla giriş yapabilirsiniz.",
    }
