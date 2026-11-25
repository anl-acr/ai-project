"""
Nornia PBX — IP Phone Central Firmware Repository & Deployment Service.

Manages uploaded IP phone firmware files (.rom, .bin, .zip, .z, .loads),
model-based target policies, single-device (pilot) deployments, live User-Agent
firmware version detection, Active Call Guard, and brand-specific provisioning
injection (Yealink, Grandstream, Fanvil, Cisco MPP).
"""

import datetime
import hashlib
import html
import os
import re
import shutil
import uuid
import zipfile
from typing import Any, Dict, List, Optional, Tuple


ALLOWED_FW_EXTENSIONS = {".rom", ".bin", ".z", ".loads", ".zip"}
MAX_FW_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB safety ceiling

# Common filename -> (brand, compatible_models) hints for faster admin uploads
_YEALINK_PREFIX_MODEL_HINTS: Dict[str, List[str]] = {
    "28": ["T46G"],
    "29": ["T42G"],
    "34": ["T21P E2"],
    "35": ["T48G"],
    "44": ["T23G"],
    "45": ["T27G"],
    "46": ["T29G"],
    "51": ["T58A", "T58W"],
    "66": ["T41S", "T42S", "T46S", "T48S"],
    "76": ["T40G"],
    "96": ["T53", "T53W", "T54W", "T57W"],
    "108": ["T42U", "T43U", "T46U", "T48U"],
    "124": ["T30P", "T31P", "T31G", "T33P", "T33G"],
}

_GRANDSTREAM_FILE_MODEL_HINTS: List[Tuple[str, List[str]]] = [
    ("grp260x", ["GRP2601", "GRP2601P", "GRP2602", "GRP2602P", "GRP2602W", "GRP2603", "GRP2603P", "GRP2604", "GRP2604P"]),
    ("grp261x", ["GRP2612", "GRP2612P", "GRP2613", "GRP2614", "GRP2615", "GRP2616"]),
    ("grp2624", ["GRP2624"]),
    ("grp2634", ["GRP2634", "GRP2636"]),
    ("gxp16", ["GXP1610", "GXP1615", "GXP1620", "GXP1625", "GXP1628", "GXP1630"]),
    ("gxp21", ["GXP2130", "GXP2135", "GXP2140", "GXP2160", "GXP2170"]),
]


def get_firmware_storage_root() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root = os.path.join(base_dir, "data", "firmware")
    os.makedirs(root, exist_ok=True)
    return root


def _now_tr_str() -> str:
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")


def sanitize_fw_filename(filename: str) -> str:
    base = os.path.basename(str(filename or "").strip())
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return cleaned or "firmware.bin"


def ensure_firmware_settings_schema(settings_db: Dict[str, Any]) -> None:
    if not isinstance(settings_db.get("phone_firmwares"), list):
        settings_db["phone_firmwares"] = []
    if not isinstance(settings_db.get("phone_firmware_policies"), dict):
        settings_db["phone_firmware_policies"] = {}
    if not isinstance(settings_db.get("phone_firmware_overrides"), dict):
        settings_db["phone_firmware_overrides"] = {}
    if not isinstance(settings_db.get("phone_firmware_status"), dict):
        settings_db["phone_firmware_status"] = {}
    if not isinstance(settings_db.get("phone_firmware_logs"), list):
        settings_db["phone_firmware_logs"] = []


def _is_default_fw_tenant(tenant_id: Optional[str]) -> bool:
    return str(tenant_id or "").strip().lower() in ("", "default", "tenant-default")


def fw_belongs_to_tenant(fw_item: Dict[str, Any], target_tenant: str, include_shared_default: bool = False) -> bool:
    if not isinstance(fw_item, dict):
        return False
    t_low = str(target_tenant or "tenant-default").strip().lower()
    if t_low in ("all", "global"):
        return True
    item_tid = str(fw_item.get("tenant_id") or "tenant-default").strip().lower()
    if _is_default_fw_tenant(t_low):
        return _is_default_fw_tenant(item_tid)
    if item_tid == t_low:
        return True
    if include_shared_default and _is_default_fw_tenant(item_tid):
        return True
    return False


def make_policy_key(brand: str, model: str, tenant_id: str = "tenant-default") -> str:
    b = re.sub(r"\s+", " ", str(brand or "").strip()).lower()
    m = re.sub(r"\s+", " ", str(model or "").strip()).lower()
    if _is_default_fw_tenant(tenant_id):
        return f"{b}::{m}"
    return f"{str(tenant_id).strip().lower()}::{b}::{m}"


def normalize_model_key(model: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(model or "").strip().lower())


def model_matches_compatible_list(device_brand: str, device_model: str, fw_item: Dict[str, Any]) -> bool:
    if not isinstance(fw_item, dict):
        return False
    fw_b = str(fw_item.get("brand") or "").strip().lower()
    dev_b = str(device_brand or "").strip().lower()
    if fw_b and dev_b and fw_b != dev_b:
        return False
    compat = fw_item.get("compatible_models") or []
    if not compat:
        return False
    dev_m_norm = normalize_model_key(device_model)
    if not dev_m_norm:
        return False
    for cm in compat:
        cm_norm = normalize_model_key(cm)
        if not cm_norm:
            continue
        if cm_norm == dev_m_norm:
            return True
        # Handle GRP2602 vs GRP2602P / GRP2602W / T30 vs T30P minor suffix match only when exact base prefix
        if dev_m_norm.startswith(cm_norm) and len(dev_m_norm) - len(cm_norm) <= 2:
            return True
        if cm_norm.startswith(dev_m_norm) and len(cm_norm) - len(dev_m_norm) <= 2:
            return True
    return False


def parse_firmware_version_from_ua(user_agent: str, brand: str = "") -> str:
    """
    Extracts running firmware version string from SIP / HTTP User-Agent.
    Examples:
      - 'Yealink SIP-T42S 66.86.0.160' -> '66.86.0.160'
      - 'Grandstream GRP2602P 1.0.7.71' -> '1.0.7.71'
      - 'Grandstream Model HW GRP2602P SW 1.0.7.71 DevId c074ad2ec223' -> '1.0.7.71'
      - 'Fanvil X4U 2.4.12.2' -> '2.4.12.2'
      - 'Cisco-CP-7841-3PCC/11.3.7' -> '11.3.7'
    """
    ua = str(user_agent or "").strip()
    if not ua:
        return ""
    # Grandstream HTTP provisioning UA: "... SW 1.0.7.71 ..."
    m_sw = re.search(r"\bSW\s+([0-9]+(?:\.[0-9]+){1,4})\b", ua, re.IGNORECASE)
    if m_sw:
        return m_sw.group(1).strip()
    # Cisco slash style: Cisco-CP-7841-3PCC/11.3.7 or (11-3-7...)
    m_slash = re.search(r"/([0-9]+(?:[.\-][0-9]+){1,4})", ua)
    if m_slash:
        return m_slash.group(1).replace("-", ".").strip()
    # Standard space-delimited version token (3-4 dot-separated numbers like 66.86.0.160 or 1.0.7.71)
    m_dots = re.findall(r"\b([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(?:\.[0-9]{1,4})?)\b", ua)
    if m_dots:
        # Filter out IPv4-like patterns if any appear after '@'
        return m_dots[-1].strip()
    m_two = re.findall(r"\b([0-9]{1,3}\.[0-9]{1,4})\b", ua)
    if m_two:
        return m_two[-1].strip()
    return ""


def _version_tuple(ver: str) -> Optional[Tuple[int, ...]]:
    s = str(ver or "").strip()
    if not s:
        return None
    nums = re.findall(r"\d+", s)
    if not nums:
        return None
    try:
        return tuple(int(n) for n in nums[:6])
    except Exception:
        return None


def compare_fw_versions(current_ver: str, target_ver: str) -> str:
    """Returns 'equal', 'upgrade', 'downgrade', or 'unknown'."""
    cur_s = str(current_ver or "").strip()
    tgt_s = str(target_ver or "").strip()
    if not cur_s or not tgt_s:
        return "unknown"
    if cur_s.lower() == tgt_s.lower():
        return "equal"
    t_cur = _version_tuple(cur_s)
    t_tgt = _version_tuple(tgt_s)
    if t_cur is None or t_tgt is None:
        return "upgrade" if cur_s != tgt_s else "equal"
    # Pad tuples to equal length
    max_len = max(len(t_cur), len(t_tgt))
    t_cur_p = t_cur + (0,) * (max_len - len(t_cur))
    t_tgt_p = t_tgt + (0,) * (max_len - len(t_tgt))
    if t_cur_p == t_tgt_p:
        return "equal"
    return "upgrade" if t_tgt_p > t_cur_p else "downgrade"


def inspect_uploaded_firmware_filename(filename: str) -> Dict[str, Any]:
    """Best-effort auto-suggestion for brand, version, and compatible models from filename."""
    fn = sanitize_fw_filename(filename)
    low = fn.lower()
    brand = ""
    version = ""
    models: List[str] = []

    # Detect version pattern
    m_ver = re.search(r"([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(?:\.[0-9]{1,4})?)", fn)
    if m_ver:
        version = m_ver.group(1)

    if low.endswith(".rom"):
        brand = "Yealink"
        if version:
            prefix = version.split(".")[0]
            models = list(_YEALINK_PREFIX_MODEL_HINTS.get(prefix, []))
    elif "grp" in low or "gxp" in low or "grandstream" in low:
        brand = "Grandstream"
        for key, mlist in _GRANDSTREAM_FILE_MODEL_HINTS:
            if key in low:
                models = list(mlist)
                break
    elif low.endswith(".z") or "fanvil" in low:
        brand = "Fanvil"
    elif low.endswith(".loads") or "cisco" in low or "sip78" in low or "sip88" in low:
        brand = "Cisco"

    return {"brand": brand, "version": version, "compatible_models": models}


def save_uploaded_firmware(
    settings_db: Dict[str, Any],
    file_bytes: bytes,
    original_filename: str,
    brand: str,
    version: str,
    compatible_models: List[str],
    release_notes: str = "",
    uploaded_by: str = "admin",
    tenant_id: str = "tenant-default",
) -> Dict[str, Any]:
    ensure_firmware_settings_schema(settings_db)

    if not file_bytes:
        raise ValueError("Yüklenen firmware dosyası boş.")
    if len(file_bytes) > MAX_FW_UPLOAD_BYTES:
        raise ValueError("Firmware dosyası 200 MB sınırını aşıyor.")

    safe_name = sanitize_fw_filename(original_filename)
    _, ext = os.path.splitext(safe_name)
    ext_low = ext.lower()
    if ext_low not in ALLOWED_FW_EXTENSIONS:
        raise ValueError(f"Desteklenmeyen dosya uzantısı ({ext_low}). İzin verilenler: .rom, .bin, .zip, .z, .loads")

    brand_clean = str(brand or "").strip()
    version_clean = str(version or "").strip()
    if not brand_clean:
        raise ValueError("Marka seçimi zorunludur.")
    if not version_clean:
        raise ValueError("Firmware sürüm numarası zorunludur (ör. 1.0.7.71 veya 66.86.0.160).")

    models_clean = []
    for m in (compatible_models or []):
        ms = str(m or "").strip()
        if ms and ms not in models_clean:
            models_clean.append(ms)
    if not models_clean:
        raise ValueError("En az bir uyumlu telefon modeli seçmelisiniz.")

    fw_id = f"fw_{uuid.uuid4().hex[:12]}"
    fw_dir = os.path.join(get_firmware_storage_root(), fw_id)
    os.makedirs(fw_dir, exist_ok=True)

    primary_path = os.path.join(fw_dir, safe_name)
    with open(primary_path, "wb") as f:
        f.write(file_bytes)

    sha256_hex = hashlib.sha256(file_bytes).hexdigest()
    extracted_files: List[str] = []

    # If Grandstream (or other brand) uploaded as .zip bundle, safely extract firmware binaries inside
    if ext_low == ".zip":
        try:
            with zipfile.ZipFile(primary_path, "r") as zf:
                for member in zf.infolist():
                    if member.is_dir():
                        continue
                    member_base = sanitize_fw_filename(os.path.basename(member.filename))
                    _, m_ext = os.path.splitext(member_base)
                    if m_ext.lower() in {".bin", ".rom", ".z", ".loads"}:
                        dest = os.path.join(fw_dir, member_base)
                        with zf.open(member, "r") as src, open(dest, "wb") as dst:
                            shutil.copyfileobj(src, dst)
                        if member_base not in extracted_files:
                            extracted_files.append(member_base)
        except zipfile.BadZipFile:
            shutil.rmtree(fw_dir, ignore_errors=True)
            raise ValueError("Geçersiz veya bozuk ZIP arşivi.")
        if not extracted_files:
            shutil.rmtree(fw_dir, ignore_errors=True)
            raise ValueError("ZIP arşivi içinde geçerli firmware dosyası (.bin, .rom, .z, .loads) bulunamadı.")
    else:
        extracted_files.append(safe_name)

    record = {
        "id": fw_id,
        "tenant_id": tenant_id,
        "brand": brand_clean,
        "version": version_clean,
        "compatible_models": models_clean,
        "filename": safe_name,
        "extracted_files": extracted_files,
        "size_bytes": len(file_bytes),
        "sha256": sha256_hex,
        "release_notes": str(release_notes or "").strip()[:1000],
        "uploaded_by": str(uploaded_by or "admin"),
        "uploaded_at": _now_tr_str(),
        "download_count": 0,
        "last_downloaded_at": "",
    }
    settings_db["phone_firmwares"].insert(0, record)
    append_firmware_log(
        settings_db,
        event="UPLOAD",
        brand=brand_clean,
        version=version_clean,
        detail=f"{safe_name} ({round(len(file_bytes) / (1024 * 1024), 2)} MB) yüklendi — Modeller: {', '.join(models_clean)}",
        actor=uploaded_by,
    )
    return record


def delete_firmware_package(
    settings_db: Dict[str, Any],
    fw_id: str,
    actor: str = "admin",
    tenant_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    ensure_firmware_settings_schema(settings_db)
    target = next((f for f in settings_db["phone_firmwares"] if str(f.get("id")) == str(fw_id)), None)
    if not target:
        return None
    if tenant_id and not fw_belongs_to_tenant(target, tenant_id):
        raise PermissionError("Bu firmware paketi başka bir müşteriye (tenant) aittir.")

    settings_db["phone_firmwares"] = [
        f for f in settings_db["phone_firmwares"] if str(f.get("id")) != str(fw_id)
    ]
    # Remove any model policies or device overrides pointing to this deleted package
    for pkey in list(settings_db["phone_firmware_policies"].keys()):
        if str((settings_db["phone_firmware_policies"].get(pkey) or {}).get("fw_id")) == str(fw_id):
            del settings_db["phone_firmware_policies"][pkey]
    for mkey in list(settings_db["phone_firmware_overrides"].keys()):
        if str((settings_db["phone_firmware_overrides"].get(mkey) or {}).get("fw_id")) == str(fw_id):
            del settings_db["phone_firmware_overrides"][mkey]

    fw_dir = os.path.join(get_firmware_storage_root(), str(fw_id))
    if os.path.isdir(fw_dir):
        shutil.rmtree(fw_dir, ignore_errors=True)

    append_firmware_log(
        settings_db,
        event="DELETE",
        brand=str(target.get("brand") or ""),
        version=str(target.get("version") or ""),
        detail=f"{target.get('filename')} silindi.",
        actor=actor,
    )
    return target


def get_firmware_by_id(settings_db: Dict[str, Any], fw_id: str) -> Optional[Dict[str, Any]]:
    ensure_firmware_settings_schema(settings_db)
    return next((f for f in settings_db["phone_firmwares"] if str(f.get("id")) == str(fw_id)), None)


def resolve_firmware_file_on_disk(
    settings_db: Dict[str, Any],
    fw_id: str,
    requested_filename: str = "",
) -> Tuple[Optional[Dict[str, Any]], Optional[str], str]:
    """
    Locates the exact firmware binary on disk for a download request.
    For Grandstream directory requests (/gs/{fw_id}/grp260xfw.bin), matches exact filename
    case-insensitively, or falls back to the sole .bin file if compatible.
    Returns (fw_record, abs_file_path, served_filename).
    """
    fw = get_firmware_by_id(settings_db, fw_id)
    if not fw:
        return None, None, ""
    fw_dir = os.path.join(get_firmware_storage_root(), str(fw_id))
    if not os.path.isdir(fw_dir):
        return fw, None, ""

    req_clean = sanitize_fw_filename(requested_filename) if requested_filename else ""
    req_low = req_clean.lower()
    candidates = list(fw.get("extracted_files") or [])
    if fw.get("filename") and fw["filename"] not in candidates:
        candidates.append(fw["filename"])

    # 1. Exact case-insensitive match
    if req_low:
        for c in candidates:
            if c.lower() == req_low:
                p = os.path.join(fw_dir, c)
                if os.path.isfile(p):
                    return fw, p, c

    # 2. Grandstream suffix/prefix tolerance (e.g., phone asks grp260xfw.bin and uploaded file is grp260xfw_1.0.7.71.bin)
    if req_low.endswith(".bin"):
        req_stem = req_low[:-4]  # e.g. grp260xfw
        for c in candidates:
            c_low = c.lower()
            if c_low.endswith(".bin") and (req_stem in c_low or c_low[:-4] in req_stem):
                p = os.path.join(fw_dir, c)
                if os.path.isfile(p):
                    return fw, p, c
        # If package contains only one .bin file, serve it (model was already validated at policy/deploy time!)
        bin_files = [c for c in candidates if c.lower().endswith(".bin") and os.path.isfile(os.path.join(fw_dir, c))]
        if len(bin_files) == 1:
            return fw, os.path.join(fw_dir, bin_files[0]), bin_files[0]

    # 3. Default primary non-zip file
    for c in candidates:
        if not c.lower().endswith(".zip"):
            p = os.path.join(fw_dir, c)
            if os.path.isfile(p):
                return fw, p, c

    return fw, None, ""


def set_model_firmware_policy(
    settings_db: Dict[str, Any],
    brand: str,
    model: str,
    fw_id: Optional[str],
    auto_apply: bool = True,
    actor: str = "admin",
    tenant_id: str = "tenant-default",
) -> Dict[str, Any]:
    ensure_firmware_settings_schema(settings_db)
    pkey = make_policy_key(brand, model, tenant_id=tenant_id)
    if not fw_id:
        settings_db["phone_firmware_policies"].pop(pkey, None)
        append_firmware_log(
            settings_db,
            event="POLICY_CLEAR",
            brand=brand,
            version="",
            detail=f"{brand} {model} için hedef firmware politikası kaldırıldı.",
            actor=actor,
            tenant_id=tenant_id,
        )
        return {"policy_key": pkey, "removed": True}

    fw = get_firmware_by_id(settings_db, fw_id)
    if not fw or not fw_belongs_to_tenant(fw, tenant_id):
        raise ValueError("Seçilen firmware paketi bulunamadı.")
    if not model_matches_compatible_list(brand, model, fw):
        raise ValueError(f"Bu firmware ({fw.get('version')}) {brand} {model} modeli ile uyumlu değil.")

    pol = {
        "policy_key": pkey,
        "tenant_id": tenant_id,
        "brand": brand,
        "model": model,
        "fw_id": fw["id"],
        "version": fw["version"],
        "auto_apply": bool(auto_apply),
        "updated_by": actor,
        "updated_at": _now_tr_str(),
    }
    settings_db["phone_firmware_policies"][pkey] = pol
    append_firmware_log(
        settings_db,
        event="POLICY_SET",
        brand=brand,
        version=fw["version"],
        detail=f"{brand} {model} hedef sürümü {fw['version']} olarak ayarlandı.",
        actor=actor,
        tenant_id=tenant_id,
    )
    return pol


def resolve_target_firmware_for_device(
    settings_db: Dict[str, Any],
    brand: str,
    model: str,
    mac_hex: str = "",
    current_version: str = "",
    tenant_id: str = "tenant-default",
) -> Dict[str, Any]:
    """
    Determines whether a device has a target firmware (via device override or model policy)
    scoped strictly to `tenant_id`.
    """
    ensure_firmware_settings_schema(settings_db)
    mac_k = str(mac_hex or "").strip().lower()
    fw: Optional[Dict[str, Any]] = None
    source = ""
    force_reinstall = False
    allow_downgrade = False

    # 1. Device-specific override (pilot / manual deploy)
    ov = settings_db["phone_firmware_overrides"].get(mac_k) if mac_k else None
    if isinstance(ov, dict) and ov.get("fw_id"):
        cand = get_firmware_by_id(settings_db, ov["fw_id"])
        if cand and fw_belongs_to_tenant(cand, tenant_id) and model_matches_compatible_list(brand, model, cand):
            fw = cand
            source = "device_override"
            force_reinstall = bool(ov.get("force", False))
            allow_downgrade = bool(ov.get("allow_downgrade", False))

    # 2. Model-level policy (tenant-isolated)
    if fw is None:
        pkey = make_policy_key(brand, model, tenant_id=tenant_id)
        pol = settings_db["phone_firmware_policies"].get(pkey)
        if not isinstance(pol, dict):
            dev_m_n = normalize_model_key(model)
            b_low = str(brand or "").strip().lower()
            for _, p_val in settings_db["phone_firmware_policies"].items():
                if not isinstance(p_val, dict):
                    continue
                if not fw_belongs_to_tenant(p_val, tenant_id):
                    continue
                if str(p_val.get("brand") or "").strip().lower() == b_low and normalize_model_key(p_val.get("model") or "") == dev_m_n:
                    pol = p_val
                    break
        if isinstance(pol, dict) and pol.get("fw_id"):
            cand = get_firmware_by_id(settings_db, pol["fw_id"])
            if cand and fw_belongs_to_tenant(cand, tenant_id) and model_matches_compatible_list(brand, model, cand):
                fw = cand
                source = "model_policy"

    if not fw:
        return {
            "has_target": False,
            "should_inject": False,
            "fw": None,
            "source": "",
            "comparison": "unmanaged",
            "force": False,
            "allow_downgrade": False,
        }

    cmp_res = compare_fw_versions(current_version, str(fw.get("version") or ""))
    # Anti-reboot-loop guard: if phone already runs target version and force=False, do NOT inject!
    should_inject = True
    if cmp_res == "equal" and not force_reinstall:
        should_inject = False
        # Clean up completed single-device override automatically
        if source == "device_override" and mac_k in settings_db["phone_firmware_overrides"]:
            settings_db["phone_firmware_overrides"].pop(mac_k, None)
            mark_device_firmware_status(
                settings_db,
                mac_k,
                status="completed",
                fw_id=fw["id"],
                target_version=fw["version"],
                current_version=current_version,
                message=f"Sürüm {current_version} başarıyla doğrulandı.",
            )
    elif cmp_res == "downgrade" and not allow_downgrade and source == "model_policy":
        # Protect phones running newer firmware from accidental model-policy downgrade
        should_inject = False

    return {
        "has_target": True,
        "should_inject": should_inject,
        "fw": fw,
        "source": source,
        "comparison": cmp_res,
        "force": force_reinstall,
        "allow_downgrade": allow_downgrade,
    }


def build_firmware_provisioning_directive(
    settings_db: Dict[str, Any],
    brand: str,
    model: str,
    mac_hex: str,
    provision_server_url: str,
    current_user_agent: str = "",
    tenant_id: str = "tenant-default",
) -> Dict[str, Any]:
    """
    Builds brand-specific firmware provisioning directives for `generate_provisioning_config`.
    """
    cur_ver = parse_firmware_version_from_ua(current_user_agent, brand=brand)
    res = resolve_target_firmware_for_device(
        settings_db,
        brand=brand,
        model=model,
        mac_hex=mac_hex,
        current_version=cur_ver,
        tenant_id=tenant_id,
    )
    b_low = str(brand or "").strip().lower()
    base_url = str(provision_server_url or "").strip().rstrip("/")

    out: Dict[str, Any] = {
        "active": False,
        "brand_low": b_low,
        "yealink_lines": [],
        "grandstream_lines": [],
        "fanvil_lines": [],
        "cisco_lines": [],
        "fw_id": "",
        "fw_version": "",
        "download_url": "",
        "comparison": res["comparison"],
    }

    if not base_url:
        return out

    if not res["should_inject"] or not res["fw"]:
        # Explicitly tell Grandstream to skip firmware check when already up-to-date so it never loops
        if "grandstream" in b_low:
            out["grandstream_lines"] = [
                "    <!-- Nornia Firmware: Guncel / Atlandi -->",
                "    <P238>2</P238>",
            ]
        return out

    fw = res["fw"]
    fw_id = str(fw["id"])
    fw_ver = str(fw.get("version") or "")
    primary_file = next(
        (c for c in (fw.get("extracted_files") or []) if not c.lower().endswith(".zip")),
        fw.get("filename") or "",
    )
    out["active"] = True
    out["fw_id"] = fw_id
    out["fw_version"] = fw_ver

    if "yealink" in b_low:
        dl_url = f"{base_url}/firmware/file/{fw_id}/{primary_file}"
        out["download_url"] = dl_url
        out["yealink_lines"] = [
            f"# --- Nornia Merkezi Firmware Yonetimi (Hedef: {fw_ver}) ---",
            f"static.firmware.url = {dl_url}",
        ]
    elif "grandstream" in b_low:
        # Grandstream P192 expects directory URL WITHOUT scheme; phone appends its model .bin filename (e.g. grp260xfw.bin)
        proto_code = "2" if base_url.lower().startswith("https://") else "1"
        no_scheme = re.sub(r"^https?://", "", base_url, flags=re.IGNORECASE)
        gs_dir = f"{no_scheme}/firmware/gs/{fw_id}"
        out["download_url"] = f"{base_url}/firmware/gs/{fw_id}/{primary_file}"
        gs_lines = [
            f"    <!-- Nornia Merkezi Firmware Yonetimi (Hedef: {html.escape(fw_ver)}) -->",
            f"    <P212>{proto_code}</P212>",
            f"    <P192>{html.escape(gs_dir)}</P192>",
            "    <P238>0</P238>",
        ]
        if res.get("allow_downgrade") or res.get("comparison") == "downgrade":
            # GRP26xx Allow Firmware Downgrade
            gs_lines.append("    <P8466>1</P8466>")
        out["grandstream_lines"] = gs_lines
    elif "fanvil" in b_low:
        dl_url = f"{base_url}/firmware/file/{fw_id}/{primary_file}"
        out["download_url"] = dl_url
        out["fanvil_lines"] = [
            f"# --- Nornia Merkezi Firmware Yonetimi (Hedef: {fw_ver}) ---",
            f"Default Firmware     :{dl_url}",
            "Upgrade Mode         :1",
        ]
    elif "cisco" in b_low:
        dl_url = f"{base_url}/firmware/file/{fw_id}/{primary_file}"
        out["download_url"] = dl_url
        out["cisco_lines"] = [
            f'  <!-- Nornia Merkezi Firmware Yonetimi (Hedef: {html.escape(fw_ver)}) -->',
            '  <Upgrade_Enable ua="na">Yes</Upgrade_Enable>',
            f'  <Upgrade_Rule ua="na">{html.escape(dl_url)}</Upgrade_Rule>',
        ]

    return out


def mark_device_firmware_status(
    settings_db: Dict[str, Any],
    mac_hex: str,
    status: str,
    fw_id: str = "",
    target_version: str = "",
    current_version: str = "",
    message: str = "",
    sip_username: str = "",
) -> None:
    ensure_firmware_settings_schema(settings_db)
    mac_k = str(mac_hex or "").strip().lower()
    if not mac_k:
        return
    prev = settings_db["phone_firmware_status"].get(mac_k)
    if not isinstance(prev, dict):
        prev = {}
    settings_db["phone_firmware_status"][mac_k] = {
        **prev,
        "mac_hex": mac_k,
        "status": status,
        "fw_id": fw_id or prev.get("fw_id") or "",
        "target_version": target_version or prev.get("target_version") or "",
        "current_version": current_version or prev.get("current_version") or "",
        "sip_username": sip_username or prev.get("sip_username") or "",
        "message": message,
        "updated_at": _now_tr_str(),
    }


def append_firmware_log(
    settings_db: Dict[str, Any],
    event: str,
    brand: str = "",
    version: str = "",
    mac_hex: str = "",
    detail: str = "",
    actor: str = "system",
    tenant_id: str = "tenant-default",
) -> None:
    ensure_firmware_settings_schema(settings_db)
    logs = settings_db["phone_firmware_logs"]
    logs.insert(
        0,
        {
            "timestamp": _now_tr_str(),
            "tenant_id": tenant_id,
            "event": event,
            "brand": brand,
            "version": version,
            "mac_hex": mac_hex,
            "detail": detail,
            "actor": actor,
        },
    )
    if len(logs) > 200:
        del logs[200:]


def compute_firmware_storage_stats(settings_db: Dict[str, Any], target_tenant: str = "all") -> Dict[str, Any]:
    ensure_firmware_settings_schema(settings_db)
    pkgs = [f for f in settings_db["phone_firmwares"] if fw_belongs_to_tenant(f, target_tenant)]
    pols = [p for p in settings_db["phone_firmware_policies"].values() if isinstance(p, dict) and fw_belongs_to_tenant(p, target_tenant)]
    total_bytes = sum(int(f.get("size_bytes") or 0) for f in pkgs)
    return {
        "package_count": len(pkgs),
        "policy_count": len(pols),
        "total_bytes": total_bytes,
        "total_mb": round(total_bytes / (1024 * 1024), 2),
    }
