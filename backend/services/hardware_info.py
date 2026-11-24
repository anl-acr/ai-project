import os
import sys
import subprocess
import hashlib
import hmac

def _load_serial_secret() -> str:
    env_val = (os.getenv("NORNIA_LICENSE_SECRET") or os.getenv("LICENSE_MASTER_SECRET") or "").strip()
    if env_val:
        return env_val
    for candidate in ("/etc/nornia/license.secret", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".license_secret")):
        try:
            if os.path.exists(candidate):
                val = open(candidate, "r", encoding="utf-8").read().strip()
                if val:
                    return val
        except Exception:
            pass
    # Ephemeral fallback so unsigned dev environments never use a static hardcoded secret in source
    return os.getenv("NORNIA_DEV_LICENSE_SEED", "UNCONFIGURED_LICENSE_SECRET")


def compute_system_serial_number(hw_id: str) -> str:
    """
    Computes a deterministic, tamper-evident System (Server) Serial Number from the Hardware ID.
    Format: SN-SRV-2026-{HW8}-{CHK4} (e.g. SN-SRV-2026-361BF973-8A4C)
    """
    clean_hw = (hw_id or "UNBOUND").strip().upper().replace("-", "").replace("HW", "")[:8] or "00000000"
    chk = hmac.new(
        _load_serial_secret().encode("utf-8"),
        f"SYSTEM_SERIAL:{clean_hw}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()[:4].upper()
    return f"SN-SRV-2026-{clean_hw}-{chk}"


def _extract_colon_field(output: str, field_name: str) -> str:
    for line in output.splitlines():
        if field_name in line and ":" in line:
            return line.split(":", 1)[1].strip()
    return ""


def get_system_hardware_fingerprint() -> dict:
    """
    Extracts unique hardware and OS installation identifiers.
    Returns dict with 'hardware_id' (e.g. HW-4667-716A), 'clean_hw_id' (4667716A), and raw components.
    """
    components = []

    # 1. System Motherboard / DMI UUID (Linux/macOS)
    try:
        if sys.platform == 'darwin':
            raw_out = subprocess.check_output(
                ["system_profiler", "SPHardwareDataType"],
                stderr=subprocess.DEVNULL,
                timeout=5,
            ).decode("utf-8", errors="ignore")
            res = _extract_colon_field(raw_out, "Hardware UUID")
            if res:
                components.append(f"DMI:{res}")
        elif os.path.exists('/sys/class/dmi/id/product_uuid'):
            with open('/sys/class/dmi/id/product_uuid', 'r') as f:
                res = f.read().strip()
                if res and len(res) > 5:
                    components.append(f"DMI:{res}")
    except Exception:
        pass

    # 2. Linux OS Machine ID or macOS Volume UUID
    try:
        if os.path.exists('/etc/machine-id'):
            with open('/etc/machine-id', 'r') as f:
                res = f.read().strip()
                if res:
                    components.append(f"MID:{res}")
        elif sys.platform == 'darwin':
            raw_out = subprocess.check_output(
                ["diskutil", "info", "/"],
                stderr=subprocess.DEVNULL,
                timeout=5,
            ).decode("utf-8", errors="ignore")
            res = _extract_colon_field(raw_out, "Volume UUID")
            if res:
                components.append(f"VOL:{res}")
    except Exception:
        pass

    # 3. Primary NIC MAC Address
    try:
        net_dir = '/sys/class/net'
        if os.path.exists(net_dir):
            interfaces = sorted([i for i in os.listdir(net_dir) if i != 'lo'])
            for iface in interfaces:
                mac_path = os.path.join(net_dir, iface, 'address')
                if os.path.exists(mac_path):
                    with open(mac_path, 'r') as f:
                        mac = f.read().strip()
                        if mac and mac != '00:00:00:00:00:00':
                            components.append(f"MAC:{mac}")
                            break
    except Exception:
        pass

    # Fallback if virtual container without DMI/MAC
    if not components:
        import platform
        components.append(f"FALLBACK:{platform.node()}:{platform.machine()}")

    raw_str = "|".join(components)
    hw_hash = hashlib.sha256(raw_str.encode('utf-8')).hexdigest()[:8].upper()
    hw_id = f"HW-{hw_hash[:4]}-{hw_hash[4:]}"
    clean_hw = hw_hash.upper()
    system_serial = compute_system_serial_number(hw_id)

    return {
        "hardware_id": hw_id,
        "clean_hw_id": clean_hw,
        "system_serial_number": system_serial,
        "raw_components": components,
        "raw_string": raw_str
    }


get_hardware_fingerprint = get_system_hardware_fingerprint


if __name__ == "__main__":
    info = get_system_hardware_fingerprint()
    print(f"Sunucu Donanım Kimliği (Hardware ID): {info['hardware_id']}")
    print(f"Sistem Seri Numarası (System Serial): {info['system_serial_number']}")
    print(f"Raw Bilgi: {info['raw_string']}")
