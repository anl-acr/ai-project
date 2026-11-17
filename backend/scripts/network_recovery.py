#!/usr/bin/env python3
"""
Nornia PBX - Sunucu Konsolu & SSH Acil Ağ Kurtarma ve Yapılandırma Aracı (CLI / TUI)
====================================================================================
Web arayüzüne erişilemeyen durumlarda doğrudan sunucu konsolundan (VMware, Proxmox,
KVM, iLO/iDRAC, Fiziksel Ekran) veya SSH üzerinden çalıştırılarak:
  1. Son çalışan ağ yedeğine tek tuşla geri dönülmesini (Rollback),
  2. Konsoldan yeni Statik IP / Subnet / Gateway / DNS tanımlanmasını,
  3. Arayüzün DHCP (Otomatik IP) moduna alınmasını,
  4. 60 saniyelik bağımsız işletim sistemi Watchdog (Dead-Man's Switch) korumasını sağlar.

Kullanım:
  - Etkileşimli Konsol Menüsü : sudo python3 /opt/ai-project/backend/scripts/network_recovery.py
  - Acil Geri Yükleme         : sudo python3 /opt/ai-project/backend/scripts/network_recovery.py --rollback
  - Tek Satır IP Değiştirme   : sudo python3 /opt/ai-project/backend/scripts/network_recovery.py --set-ip eth0 192.168.1.100/24 192.168.1.1 8.8.8.8,1.1.1.1
  - Durum Görüntüleme         : python3 /opt/ai-project/backend/scripts/network_recovery.py --status
"""

import argparse
import datetime
import ipaddress
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKUP_DIR = os.path.join(PROJECT_ROOT, "network_backups")
PENDING_LOCK_FILE = os.path.join(BACKUP_DIR, "pending_apply.json")
LATEST_GOOD_FILE = os.path.join(BACKUP_DIR, "latest_good_state.json")
SETTINGS_FILE = os.path.join(PROJECT_ROOT, "backend", "settings.json")


def _ensure_backup_dir():
    os.makedirs(BACKUP_DIR, exist_ok=True)


def _run_cmd(cmd: List[str], timeout: float = 5.0) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    except Exception as exc:
        cp = subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr=str(exc))
        return cp


def get_live_interfaces() -> List[Dict[str, Any]]:
    """Reads live network interfaces on Linux (ip -j) or macOS (ifconfig) fallback."""
    sys_name = platform.system().lower()
    interfaces: List[Dict[str, Any]] = []

    if sys_name == "linux":
        res_addr = _run_cmd(["ip", "-j", "addr", "show"])
        res_route = _run_cmd(["ip", "-j", "route", "show", "default"])
        default_gw_by_dev: Dict[str, str] = {}
        try:
            routes = json.loads(res_route.stdout or "[]")
            for r in routes:
                dev = r.get("dev")
                gw = r.get("gateway")
                if dev and gw and dev not in default_gw_by_dev:
                    default_gw_by_dev[dev] = gw
        except Exception:
            pass

        try:
            addr_list = json.loads(res_addr.stdout or "[]")
            for item in addr_list:
                ifname = str(item.get("ifname") or "")
                if not ifname or ifname == "lo" or ifname.startswith(("docker", "veth", "br-", "virbr")):
                    continue
                flags = item.get("flags") or []
                operstate = str(item.get("operstate") or "").upper()
                is_up = "UP" in flags or operstate == "UP"
                mac = str(item.get("address") or "")
                mtu = int(item.get("mtu") or 1500)
                ipv4_list = []
                dynamic_flag = False
                for ainfo in item.get("addr_info") or []:
                    if ainfo.get("family") == "inet":
                        local_ip = ainfo.get("local")
                        prefix = ainfo.get("prefixlen")
                        if local_ip and prefix is not None:
                            ipv4_list.append(f"{local_ip}/{prefix}")
                        if ainfo.get("dynamic"):
                            dynamic_flag = True
                primary_cidr = ipv4_list[0] if ipv4_list else ""
                secondary_cidrs = ipv4_list[1:] if len(ipv4_list) > 1 else []
                interfaces.append({
                    "name": ifname,
                    "mac": mac,
                    "mtu": mtu,
                    "is_up": is_up,
                    "operstate": "UP" if is_up else (operstate or "DOWN"),
                    "mode": "dhcp" if dynamic_flag else "static",
                    "primary_cidr": primary_cidr,
                    "secondary_cidrs": secondary_cidrs,
                    "gateway": default_gw_by_dev.get(ifname, ""),
                })
        except Exception:
            pass
    else:
        # macOS / BSD fallback for development environments
        res_if = _run_cmd(["ifconfig"])
        cur_if = None
        for raw_line in (res_if.stdout or "").splitlines():
            if raw_line and not raw_line.startswith(("\t", " ")):
                ifname = raw_line.split(":", 1)[0].strip()
                if ifname in ("lo0", "gif0", "stf0") or ifname.startswith(("bridge", "utun", "awdl", "llw", "anpi")):
                    cur_if = None
                    continue
                is_up = "UP" in raw_line and "RUNNING" in raw_line
                cur_if = {
                    "name": ifname,
                    "mac": "",
                    "mtu": 1500,
                    "is_up": is_up,
                    "operstate": "UP" if is_up else "DOWN",
                    "mode": "dhcp",
                    "primary_cidr": "",
                    "secondary_cidrs": [],
                    "gateway": "",
                }
                interfaces.append(cur_if)
            elif cur_if is not None:
                line = raw_line.strip()
                if line.startswith("ether "):
                    cur_if["mac"] = line.split()[1]
                elif line.startswith("inet "):
                    parts = line.split()
                    ip_val = parts[1]
                    mask_hex = parts[3] if len(parts) > 3 and parts[2] == "netmask" else "0xffffff00"
                    try:
                        mask_int = int(mask_hex, 16)
                        prefix = bin(mask_int).count("1")
                    except Exception:
                        prefix = 24
                    cidr = f"{ip_val}/{prefix}"
                    if not cur_if["primary_cidr"]:
                        cur_if["primary_cidr"] = cidr
                    else:
                        cur_if["secondary_cidrs"].append(cidr)
        res_gw = _run_cmd(["route", "-n", "get", "default"])
        gw_val = ""
        gw_if = ""
        for ln in (res_gw.stdout or "").splitlines():
            s = ln.strip()
            if s.startswith("gateway:"):
                gw_val = s.split(":", 1)[1].strip()
            elif s.startswith("interface:"):
                gw_if = s.split(":", 1)[1].strip()
        for iface in interfaces:
            if iface["name"] == gw_if or (not gw_if and iface["primary_cidr"]):
                iface["gateway"] = gw_val
                break

    return interfaces


def create_snapshot(label: str = "manual") -> str:
    """Saves current OS network state and Netplan files into network_backups/."""
    _ensure_backup_dir()
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    snap_id = f"net_backup_{ts}"
    snap_path = os.path.join(BACKUP_DIR, f"{snap_id}.json")

    netplan_files: Dict[str, str] = {}
    if os.path.isdir("/etc/netplan"):
        for fn in os.listdir("/etc/netplan"):
            if fn.endswith((".yaml", ".yml")):
                fp = os.path.join("/etc/netplan", fn)
                try:
                    with open(fp, "r", encoding="utf-8") as f:
                        netplan_files[fp] = f.read()
                except Exception:
                    pass

    resolv_content = ""
    if os.path.exists("/etc/resolv.conf"):
        try:
            with open("/etc/resolv.conf", "r", encoding="utf-8") as f:
                resolv_content = f.read()
        except Exception:
            pass

    hosts_content = ""
    if os.path.exists("/etc/hosts"):
        try:
            with open("/etc/hosts", "r", encoding="utf-8") as f:
                hosts_content = f.read()
        except Exception:
            pass

    snap_data = {
        "id": snap_id,
        "label": label,
        "created_at": datetime.datetime.now().isoformat(),
        "hostname": socket.gethostname(),
        "interfaces": get_live_interfaces(),
        "netplan_files": netplan_files,
        "resolv_conf": resolv_content,
        "hosts_file": hosts_content,
    }

    with open(snap_path, "w", encoding="utf-8") as f:
        json.dump(snap_data, f, ensure_ascii=False, indent=2)
    with open(LATEST_GOOD_FILE, "w", encoding="utf-8") as f:
        json.dump(snap_data, f, ensure_ascii=False, indent=2)

    return snap_path


def apply_interface_config_os(
    ifname: str,
    mode: str,
    primary_cidr: str = "",
    gateway: str = "",
    secondary_cidrs: Optional[List[str]] = None,
    dns_servers: Optional[List[str]] = None,
    mtu: int = 1500,
) -> Dict[str, Any]:
    """Applies interface configuration on Linux (Netplan / iproute2) and updates Nornia settings."""
    secondary_cidrs = [c.strip() for c in (secondary_cidrs or []) if c and str(c).strip()]
    dns_servers = [d.strip() for d in (dns_servers or []) if d and str(d).strip()]

    if mode == "static":
        try:
            iface_net = ipaddress.ip_interface(primary_cidr)
        except Exception as e:
            return {"ok": False, "error": f"Geçersiz IP/CIDR formatı ({primary_cidr}): {e}"}
        if gateway:
            try:
                gw_ip = ipaddress.ip_address(gateway)
                if gw_ip not in iface_net.network:
                    return {
                        "ok": False,
                        "error": f"Gateway ({gateway}) girilen alt ağ ({iface_net.network}) içinde değil! Erişim kaybını önlemek için işlem durduruldu.",
                    }
            except Exception as e:
                return {"ok": False, "error": f"Geçersiz Gateway IP adresi ({gateway}): {e}"}

    sys_name = platform.system().lower()
    if sys_name == "linux":
        # 1. Write Netplan YAML if /etc/netplan exists
        if os.path.isdir("/etc/netplan"):
            all_addrs = ([primary_cidr] if primary_cidr else []) + secondary_cidrs
            lines = [
                "# Generated by Nornia PBX Network Manager",
                "network:",
                "  version: 2",
                "  ethernets:",
                f"    {ifname}:",
            ]
            if mode == "dhcp":
                lines.append("      dhcp4: true")
            else:
                lines.append("      dhcp4: false")
                if all_addrs:
                    lines.append(f"      addresses: [{', '.join(all_addrs)}]")
                if gateway:
                    lines.append("      routes:")
                    lines.append("        - to: default")
                    lines.append(f"          via: {gateway}")
                if dns_servers:
                    lines.append("      nameservers:")
                    lines.append(f"        addresses: [{', '.join(dns_servers)}]")
            if mtu and int(mtu) != 1500:
                lines.append(f"      mtu: {int(mtu)}")

            netplan_file = f"/etc/netplan/90-nornia-{ifname}.yaml"
            try:
                with open(netplan_file, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines) + "\n")
                os.chmod(netplan_file, 0o600)
                _run_cmd(["netplan", "apply"], timeout=8.0)
            except Exception as np_err:
                print(f"[Nornia-Net] Netplan yazma/uygulama uyarısı: {np_err}")

        # 2. Ensure immediate runtime state via iproute2
        if mode == "static" and primary_cidr:
            _run_cmd(["ip", "addr", "flush", "dev", ifname])
            _run_cmd(["ip", "addr", "add", primary_cidr, "dev", ifname])
            for sec in secondary_cidrs:
                _run_cmd(["ip", "addr", "add", sec, "dev", ifname])
            _run_cmd(["ip", "link", "set", "dev", ifname, "mtu", str(mtu or 1500), "up"])
            if gateway:
                _run_cmd(["ip", "route", "replace", "default", "via", gateway, "dev", ifname])
        elif mode == "dhcp":
            _run_cmd(["dhclient", "-r", ifname], timeout=4.0)
            _run_cmd(["dhclient", ifname], timeout=6.0)

    # Sync Asterisk dialplan/PJSIP if script exists
    sync_script = os.path.join(PROJECT_ROOT, "backend", "scripts", "sync_asterisk.py")
    if os.path.exists(sync_script):
        _run_cmd([sys.executable, sync_script], timeout=5.0)

    return {"ok": True, "message": f"{ifname} arayüzü ({mode.upper()}) başarıyla yapılandırıldı."}


def sync_trunk_policy_routes_os(trunks_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Configures secondary /30 VLAN IPs and Source-Based Policy Routing (`ip rule from <local_ip> lookup <table_id>`)
    for multi-trunk operator setups sharing the same remote SBC / Media subnet (e.g. 10.99.1.0/24).
    """
    applied_policies: List[Dict[str, Any]] = []
    if not isinstance(trunks_list, list):
        return applied_policies

    live_ifaces = get_live_interfaces()
    default_dev = live_ifaces[0]["name"] if live_ifaces else "eth0"
    sys_name = platform.system().lower()

    bound_trunks = []
    for t in trunks_list:
        if not isinstance(t, dict) or t.get("is_active") is False:
            continue
        sh = t.get("sip_headers") or {}
        if isinstance(sh, str):
            try:
                sh = json.loads(sh)
            except Exception:
                sh = {}
        if not isinstance(sh, dict) or not sh.get("local_bind_enabled"):
            continue
        raw_cidr = str(sh.get("local_bind_cidr") or "").strip()
        if not raw_cidr:
            continue
        if "/" not in raw_cidr:
            raw_cidr = f"{raw_cidr}/30"
        try:
            ip_iface = ipaddress.ip_interface(raw_cidr)
        except Exception as e:
            print(f"[Trunk Policy Route] Geçersiz local_bind_cidr ({raw_cidr}): {e}")
            continue

        local_ip = str(ip_iface.ip)
        local_net = str(ip_iface.network)
        local_gw = str(sh.get("local_gateway") or "").strip()
        local_dev = str(sh.get("local_interface") or "").strip() or default_dev
        raw_targets = str(sh.get("target_subnets") or "").strip()
        host_str = str(t.get("host") or "").strip()

        subnets: List[str] = []
        for part in re.split(r"[,;\s]+", raw_targets):
            p = part.strip()
            if not p:
                continue
            if "/" not in p:
                p = f"{p}/32"
            try:
                net_obj = ipaddress.ip_network(p, strict=False)
                if str(net_obj) not in subnets:
                    subnets.append(str(net_obj))
            except Exception:
                pass

        # If target_subnets was not explicitly provided, derive /24 from the SBC host IP
        if host_str:
            try:
                h_ip = ipaddress.ip_address(host_str)
                if not subnets:
                    net24 = ipaddress.ip_network(f"{h_ip}/24", strict=False)
                    subnets.append(str(net24))
                host32 = f"{h_ip}/32"
                if host32 not in subnets:
                    subnets.append(host32)
            except Exception:
                pass

        bound_trunks.append({
            "trunk_name": str(t.get("trunk_name") or t.get("name") or "trunk"),
            "tenant_id": str(t.get("tenant_id") or "tenant-default"),
            "interface": local_dev,
            "local_cidr": str(ip_iface),
            "local_ip": local_ip,
            "local_net": local_net,
            "gateway": local_gw,
            "target_subnets": subnets,
            "sbc_host": host_str,
        })

    if sys_name == "linux" and bound_trunks:
        # Loose Reverse Path Filtering so multi-VLAN incoming RTP/SIP packets are never dropped by kernel
        _run_cmd(["sysctl", "-w", "net.ipv4.conf.all.rp_filter=2"], timeout=2.0)
        _run_cmd(["sysctl", "-w", "net.ipv4.conf.default.rp_filter=2"], timeout=2.0)

    for idx, bt in enumerate(bound_trunks):
        table_id = 201 + idx
        prio = 1001 + idx
        dev = bt["interface"]
        local_cidr = bt["local_cidr"]
        local_ip = bt["local_ip"]
        local_net = bt["local_net"]
        gw = bt["gateway"]
        subnets = bt["target_subnets"]

        if sys_name == "linux":
            _run_cmd(["sysctl", "-w", f"net.ipv4.conf.{dev}.rp_filter=2"], timeout=2.0)
            # 1. Assign secondary /30 IP on the interface without changing default gateway
            _run_cmd(["ip", "addr", "replace", local_cidr, "dev", dev], timeout=3.0)
            _run_cmd(["ip", "link", "set", "dev", dev, "up"], timeout=2.0)

            # 2. Configure isolated Policy Routing table for this trunk's source IP
            _run_cmd(["ip", "route", "flush", "table", str(table_id)], timeout=2.0)
            _run_cmd(
                ["ip", "route", "replace", local_net, "dev", dev, "scope", "link", "src", local_ip, "table", str(table_id)],
                timeout=2.0,
            )
            if gw:
                for snet in subnets:
                    _run_cmd(
                        ["ip", "route", "replace", snet, "via", gw, "dev", dev, "src", local_ip, "table", str(table_id)],
                        timeout=2.0,
                    )
                    # Also add a metric-isolated fallback route in main table so local tools / ARP / RPF work
                    _run_cmd(
                        ["ip", "route", "replace", snet, "via", gw, "dev", dev, "src", local_ip, "metric", str(table_id)],
                        timeout=2.0,
                    )
                _run_cmd(
                    ["ip", "route", "replace", "default", "via", gw, "dev", dev, "src", local_ip, "table", str(table_id)],
                    timeout=2.0,
                )

            # 3. Clean old ip rule for this source IP and insert fresh rule
            for _ in range(4):
                cp_del = _run_cmd(["ip", "rule", "del", "from", f"{local_ip}/32"], timeout=1.5)
                if cp_del.returncode != 0:
                    break
            _run_cmd(
                ["ip", "rule", "add", "from", f"{local_ip}/32", "lookup", str(table_id), "priority", str(prio)],
                timeout=2.0,
            )

        applied_policies.append({
            **bt,
            "table_id": table_id,
            "priority": prio,
        })

    return applied_policies


def restore_snapshot(snap_file: str = LATEST_GOOD_FILE) -> Dict[str, Any]:
    """Restores Netplan files and live IP/Gateway settings from a saved backup JSON."""
    if not os.path.exists(snap_file):
        return {"ok": False, "error": f"Yedek dosyası bulunamadı: {snap_file}"}

    try:
        with open(snap_file, "r", encoding="utf-8") as f:
            snap = json.load(f)
    except Exception as e:
        return {"ok": False, "error": f"Yedek okunamadı: {e}"}

    sys_name = platform.system().lower()
    if sys_name == "linux":
        netplan_files = snap.get("netplan_files") or {}
        if os.path.isdir("/etc/netplan") and netplan_files:
            for fp, content in netplan_files.items():
                try:
                    with open(fp, "w", encoding="utf-8") as wf:
                        wf.write(content)
                    os.chmod(fp, 0o600)
                except Exception:
                    pass
            _run_cmd(["netplan", "apply"], timeout=8.0)

        for iface in snap.get("interfaces") or []:
            ifname = iface.get("name")
            p_cidr = iface.get("primary_cidr")
            gw = iface.get("gateway")
            secs = iface.get("secondary_cidrs") or []
            if ifname and p_cidr:
                _run_cmd(["ip", "addr", "flush", "dev", ifname])
                _run_cmd(["ip", "addr", "add", p_cidr, "dev", ifname])
                for sc in secs:
                    _run_cmd(["ip", "addr", "add", sc, "dev", ifname])
                _run_cmd(["ip", "link", "set", "dev", ifname, "up"])
                if gw:
                    _run_cmd(["ip", "route", "replace", "default", "via", gw, "dev", ifname])

    if os.path.exists(PENDING_LOCK_FILE):
        try:
            os.remove(PENDING_LOCK_FILE)
        except Exception:
            pass

    return {"ok": True, "message": f"Ağ ayarları '{snap.get('id')}' yedeğine başarıyla geri döndürüldü."}


def run_watchdog(timeout_sec: int = 60):
    """Independent OS-level dead-man's switch process. Rolls back if pending_apply.json is not confirmed."""
    start_t = time.monotonic()
    while (time.monotonic() - start_t) < timeout_sec:
        time.sleep(2.0)
        if not os.path.exists(PENDING_LOCK_FILE):
            # Admin confirmed the change! Exit cleanly.
            return
    # Timeout expired and pending_apply.json still exists -> Admin lost connection! Roll back immediately.
    if os.path.exists(PENDING_LOCK_FILE):
        print("[Nornia-Net Watchdog] 60 saniye içinde onay alınamadı! Otomatik Rollback başlatılıyor...")
        restore_snapshot(LATEST_GOOD_FILE)


def interactive_console_menu():
    """Interactive Turkish CLI/TUI Rescue Menu for SSH & Server Console."""
    while True:
        print("\n" + "=" * 68)
        print("   NORNIA KURUMSAL SANTRAL — SUNUCU AĞ & ACİL KURTARMA KONSOLU")
        print("=" * 68)
        ifaces = get_live_interfaces()
        for idx, i in enumerate(ifaces, start=1):
            st_lbl = "AKTİF (UP)" if i["is_up"] else "PASİF (DOWN)"
            print(f"  [{idx}] {i['name']:10s} | Durum: {st_lbl:12s} | IP: {i['primary_cidr'] or 'Yok':18s} | GW: {i['gateway'] or '-'}")
        if os.path.exists(PENDING_LOCK_FILE):
            print("\n  [!] DİKKAT: Onay bekleyen bir ağ değişikliği var (Otomatik geri alma sayacı aktif)!")
        print("-" * 68)
        print("  1) ACİL KURTARMA: Son Çalışan Ağ Yedeğine Anında Geri Dön (Rollback)")
        print("  2) Konsoldan Statik IP / Alt Ağ (CIDR) / Gateway / DNS Yapılandır")
        print("  3) Ağ Kartını DHCP (Otomatik IP) Moduna Geçir")
        print("  4) Mevcut Çalışan Ağ Durumunu Yedekle (Snapshot Al)")
        print("  5) Kayıtlı Ağ Yedeklerini Listele ve Seçerek Geri Yükle")
        print("  6) Gateway & İnternet Erişim Testi (Ping Testi)")
        print("  7) Bekleyen Web Değişikliğini Kalıcı Olarak Onayla")
        print("  0) Çıkış")
        print("-" * 68)

        choice = input("Seçiminiz (0-7): ").strip()
        if choice == "0":
            print("Konsoldan çıkılıyor.")
            break
        elif choice == "1":
            res = restore_snapshot(LATEST_GOOD_FILE)
            print(f"\n>>> {res.get('message') or res.get('error')}")
        elif choice == "2":
            if not ifaces:
                print("Yapılandırılacak ağ kartı bulunamadı.")
                continue
            if_name = input(f"Arayüz adı [{ifaces[0]['name']}]: ").strip() or ifaces[0]["name"]
            ip_cidr = input("Yeni IPv4 ve CIDR (Örn: 192.168.1.100/24): ").strip()
            gw = input("Varsayılan Gateway (Örn: 192.168.1.1): ").strip()
            dns_in = input("DNS Sunucuları (virgülle, Örn: 8.8.8.8,1.1.1.1) [8.8.8.8,1.1.1.1]: ").strip() or "8.8.8.8,1.1.1.1"
            create_snapshot(label="console_before_static")
            res = apply_interface_config_os(
                ifname=if_name,
                mode="static",
                primary_cidr=ip_cidr,
                gateway=gw,
                dns_servers=[d.strip() for d in dns_in.split(",") if d.strip()],
            )
            print(f"\n>>> {res.get('message') or res.get('error')}")
        elif choice == "3":
            if not ifaces:
                continue
            if_name = input(f"DHCP'ye alınacak arayüz adı [{ifaces[0]['name']}]: ").strip() or ifaces[0]["name"]
            create_snapshot(label="console_before_dhcp")
            res = apply_interface_config_os(ifname=if_name, mode="dhcp")
            print(f"\n>>> {res.get('message') or res.get('error')}")
        elif choice == "4":
            path = create_snapshot(label="console_manual_backup")
            print(f"\n>>> Mevcut ağ durumu yedeklendi: {path}")
        elif choice == "5":
            _ensure_backup_dir()
            files = sorted([f for f in os.listdir(BACKUP_DIR) if f.startswith("net_backup_") and f.endswith(".json")], reverse=True)
            if not files:
                print("\n>>> Henüz kayıtlı yedek bulunmuyor.")
                continue
            for idx, fn in enumerate(files[:10], start=1):
                print(f"  {idx}) {fn}")
            sel = input("Geri yüklenecek yedek numarası (İptal için Enter): ").strip()
            if sel.isdigit() and 1 <= int(sel) <= len(files[:10]):
                chosen = os.path.join(BACKUP_DIR, files[int(sel) - 1])
                res = restore_snapshot(chosen)
                print(f"\n>>> {res.get('message') or res.get('error')}")
        elif choice == "6":
            target = input("Test edilecek IP / Host [8.8.8.8]: ").strip() or "8.8.8.8"
            cp = _run_cmd(["ping", "-c", "3", target], timeout=6.0)
            print(cp.stdout or cp.stderr)
        elif choice == "7":
            if os.path.exists(PENDING_LOCK_FILE):
                os.remove(PENDING_LOCK_FILE)
                create_snapshot(label="confirmed_via_console")
                print("\n>>> Bekleyen ağ değişikliği kalıcı olarak onaylandı!")
            else:
                print("\n>>> Onay bekleyen bir değişiklik bulunmuyor.")


def main():
    parser = argparse.ArgumentParser(description="Nornia PBX Konsol & SSH Ağ Kurtarma Aracı")
    parser.add_argument("--status", action="store_true", help="Mevcut ağ durumunu JSON olarak yazdırır")
    parser.add_argument("--rollback", action="store_true", help="Son çalışan ağ yedeğine anında geri döner")
    parser.add_argument("--watchdog", type=int, default=0, help="Belirtilen saniye sonunda onaylanmazsa otomatik rollback yapar")
    parser.add_argument("--set-ip", nargs="+", help="Kullanım: --set-ip <iface> <ip/cidr> <gateway> [dns1,dns2]")
    args = parser.parse_args()

    if args.status:
        print(json.dumps(get_live_interfaces(), ensure_ascii=False, indent=2))
        return
    if args.rollback:
        res = restore_snapshot(LATEST_GOOD_FILE)
        print(json.dumps(res, ensure_ascii=False))
        return
    if args.watchdog > 0:
        run_watchdog(args.watchdog)
        return
    if args.set_ip:
        if len(args.set_ip) < 2:
            print("Hata: --set-ip <arayuz> <ip/cidr> [gateway] [dns1,dns2]")
            sys.exit(1)
        ifname = args.set_ip[0]
        ip_cidr = args.set_ip[1]
        gw = args.set_ip[2] if len(args.set_ip) >= 3 else ""
        dns_list = args.set_ip[3].split(",") if len(args.set_ip) >= 4 else ["8.8.8.8", "1.1.1.1"]
        create_snapshot(label="cli_set_ip")
        res = apply_interface_config_os(ifname=ifname, mode="static", primary_cidr=ip_cidr, gateway=gw, dns_servers=dns_list)
        print(json.dumps(res, ensure_ascii=False))
        return

    interactive_console_menu()


if __name__ == "__main__":
    main()
