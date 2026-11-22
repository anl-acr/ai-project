#!/usr/bin/env python3
"""
Nornia — Kısıtlı 'destek' Hesabı İçin Beyaz-Listeli Sistem & Ağ İşlem Motoru
=============================================================================
Bu betik /etc/sudoers.d/nornia-destek üzerinden YALNIZCA root olarak
(NOEXEC bayrağı ile) çalıştırılır ve 'destek' kullanıcısının sadece
izin verilen ağ analizi, IP yapılandırma ve servis sağlık kontrolü
işlemlerini güvenli biçimde yürütmesini sağlar.

Kesinlikle shell=True kullanmaz; tüm IP/alan adı/port girdileri sıkı
regex ve ipaddress doğrulamasından geçer.
"""

import argparse
import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import sys
from typing import List

PROJECT_ROOT = "/opt/ai-project"
if not os.path.isdir(PROJECT_ROOT):
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

NETWORK_RECOVERY_SCRIPT = os.path.join(PROJECT_ROOT, "backend", "scripts", "network_recovery.py")
SETTINGS_FILE = os.path.join(PROJECT_ROOT, "backend", "settings.json")

HOST_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$")
DNS_TYPES = {"A", "AAAA", "SRV", "NAPTR", "MX", "TXT", "PTR", "NS", "CNAME"}


def _validate_host(raw: str) -> str:
    val = str(raw or "").strip()
    if not val or len(val) > 253:
        raise ValueError("Geçersiz hedef adres.")
    try:
        ipaddress.ip_address(val)
        return val
    except ValueError:
        pass
    if not HOST_RE.match(val) or ".." in val or val.startswith("-"):
        raise ValueError("Geçersiz alan adı veya IP adresi.")
    return val


def _run_cmd(argv: List[str], timeout: float = 30.0, capture: bool = False) -> int:
    try:
        if capture:
            cp = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, check=False)
            if cp.stdout:
                sys.stdout.write(cp.stdout)
            if cp.stderr:
                sys.stderr.write(cp.stderr)
            return cp.returncode
        cp = subprocess.run(argv, timeout=timeout, check=False)
        return cp.returncode
    except subprocess.TimeoutExpired:
        print("\n[ZAMAN AŞIMI] İşlem izin verilen süre içinde tamamlanmadı.")
        return 124
    except FileNotFoundError:
        print(f"\n[HATA] Gerekli araç kurulu değil: {argv[0]}")
        return 127
    except KeyboardInterrupt:
        print("\n[İPTAL] İşlem kullanıcı tarafından durduruldu.")
        return 130


def cmd_net_summary() -> int:
    print("══════════════════════════════════════════════════════════════")
    print("  1) AĞ ARAYÜZLERİ (IPv4 / IPv6)")
    print("══════════════════════════════════════════════════════════════")
    if shutil.which("ip"):
        _run_cmd(["ip", "-br", "addr"])
        print("\n══════════════════════════════════════════════════════════════")
        print("  2) YÖNLENDİRME TABLOSU (ROUTE)")
        print("══════════════════════════════════════════════════════════════")
        _run_cmd(["ip", "route", "show"])
        print("\n══════════════════════════════════════════════════════════════")
        print("  3) ARP / KOMŞU TABLOSU")
        print("══════════════════════════════════════════════════════════════")
        _run_cmd(["ip", "neigh", "show"])
    else:
        _run_cmd(["ifconfig"])

    print("\n══════════════════════════════════════════════════════════════")
    print("  4) DNS SUNUCULARI (/etc/resolv.conf)")
    print("══════════════════════════════════════════════════════════════")
    try:
        with open("/etc/resolv.conf", "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                s = line.strip()
                if s and not s.startswith("#"):
                    print(f"  {s}")
    except Exception as exc:
        print(f"  DNS okunamadı: {exc}")

    print("\n══════════════════════════════════════════════════════════════")
    print("  5) DİNLEYEN AĞ PORTLARI (TCP / UDP)")
    print("══════════════════════════════════════════════════════════════")
    if shutil.which("ss"):
        _run_cmd(["ss", "-tulpn"])
    elif shutil.which("netstat"):
        _run_cmd(["netstat", "-tulpn"])
    return 0


def cmd_net_recovery() -> int:
    if not os.path.isfile(NETWORK_RECOVERY_SCRIPT):
        print(f"[HATA] Ağ kurtarma aracı bulunamadı: {NETWORK_RECOVERY_SCRIPT}")
        return 1
    return _run_cmd([sys.executable, NETWORK_RECOVERY_SCRIPT], timeout=600.0)


def cmd_net_rollback() -> int:
    if not os.path.isfile(NETWORK_RECOVERY_SCRIPT):
        print(f"[HATA] Ağ kurtarma aracı bulunamadı: {NETWORK_RECOVERY_SCRIPT}")
        return 1
    return _run_cmd([sys.executable, NETWORK_RECOVERY_SCRIPT, "--rollback"], timeout=60.0)


def cmd_ping(host: str, count: int) -> int:
    target = _validate_host(host)
    cnt = max(1, min(20, int(count)))
    print(f"→ Ping başlatılıyor: {target} ({cnt} paket)\n")
    return _run_cmd(["ping", "-c", str(cnt), "-W", "2", target], timeout=cnt * 4 + 10)


def cmd_traceroute(host: str) -> int:
    target = _validate_host(host)
    print(f"→ Traceroute başlatılıyor: {target}\n")
    if shutil.which("traceroute"):
        return _run_cmd(["traceroute", "-n", "-m", "20", "-w", "2", target], timeout=60.0)
    if shutil.which("tracepath"):
        return _run_cmd(["tracepath", "-n", target], timeout=60.0)
    print("[HATA] traceroute veya tracepath kurulu değil.")
    return 1


def cmd_mtr(host: str) -> int:
    target = _validate_host(host)
    print(f"→ MTR ağ kalite analizi (5 döngü): {target}\n")
    if shutil.which("mtr"):
        return _run_cmd(["mtr", "-r", "-c", "5", "-n", target], timeout=45.0)
    print("[BİLGİ] mtr kurulu değil, traceroute ile devam ediliyor...")
    return cmd_traceroute(target)


def cmd_dns(domain: str, qtype: str) -> int:
    target = _validate_host(domain)
    qt = str(qtype or "A").strip().upper()
    if qt not in DNS_TYPES:
        raise ValueError(f"Desteklenmeyen DNS kayıt tipi: {qt}")
    print(f"→ DNS Sorgusu: {target} ({qt})\n")
    if shutil.which("dig"):
        return _run_cmd(["dig", "+noall", "+answer", "+stats", "+time=3", "+tries=1", target, qt], timeout=15.0)
    try:
        infos = socket.getaddrinfo(target, None)
        addrs = sorted({x[4][0] for x in infos})
        for a in addrs:
            print(f"  {target} -> {a}")
        return 0
    except Exception as exc:
        print(f"  DNS çözümlenemedi: {exc}")
        return 1


def cmd_port_test(host: str, port: int, proto: str) -> int:
    target = _validate_host(host)
    p = int(port)
    if p < 1 or p > 65535:
        raise ValueError("Port 1 ile 65535 arasında olmalıdır.")
    pr = str(proto or "tcp").strip().lower()
    if pr not in ("tcp", "udp"):
        raise ValueError("Protokol sadece tcp veya udp olabilir.")
    print(f"→ Bağlantı testi: {target}:{p} ({pr.upper()})")
    if pr == "tcp":
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(4.0)
        try:
            s.connect((target, p))
            print(f"  [BAŞARILI] TCP {target}:{p} portu erişilebilir (AÇIK).")
            return 0
        except Exception as exc:
            print(f"  [BAŞARISIZ] TCP {target}:{p} erişilemedi: {exc}")
            return 1
        finally:
            s.close()
    else:
        if shutil.which("nc"):
            rc = _run_cmd(["nc", "-z", "-v", "-u", "-w", "3", target, str(p)], timeout=10.0)
            return rc
        print("  [BİLGİ] UDP testi için nc aracı bulunamadı.")
        return 1


def cmd_sip_trace(packets: int) -> int:
    cnt = max(5, min(100, int(packets)))
    print(f"→ Salt-okunur SIP/WSS paket özeti (en fazla {cnt} paket, 25 sn zaman aşımı)")
    print("  Filtre: port 5060 or port 5061 or port 8089 (durdurmak için Ctrl+C)\n")
    if shutil.which("tcpdump"):
        return _run_cmd(
            [
                "tcpdump",
                "-n",
                "-l",
                "-i",
                "any",
                "-c",
                str(cnt),
                "port",
                "5060",
                "or",
                "port",
                "5061",
                "or",
                "port",
                "8089",
            ],
            timeout=25.0,
        )
    print("[HATA] tcpdump kurulu değil.")
    return 1


def _check_systemd_active(unit: str) -> str:
    if not shutil.which("systemctl"):
        return "BİLİNMİYOR"
    cp = subprocess.run(["systemctl", "is-active", unit], capture_output=True, text=True, timeout=3, check=False)
    st = (cp.stdout or "").strip()
    return "AKTİF" if st == "active" else (st.upper() if st else "PASİF")


def _check_tcp_local(port: int) -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1.0)
    try:
        s.connect(("127.0.0.1", port))
        return "AKTİF"
    except Exception:
        return "PASİF"
    finally:
        s.close()


def _detect_primary_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1.0)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        pass
    try:
        cp = subprocess.run(["hostname", "-I"], capture_output=True, text=True, timeout=2, check=False)
        for tok in (cp.stdout or "").split():
            if "." in tok and not tok.startswith("127."):
                return tok
    except Exception:
        pass
    return "127.0.0.1"


def _detect_hw_id() -> str:
    try:
        sys.path.insert(0, PROJECT_ROOT)
        from backend.services.hardware_info import get_system_hardware_fingerprint
        fp = get_system_hardware_fingerprint()
        if isinstance(fp, dict):
            return str(fp.get("hardware_id") or fp.get("clean_hw_id") or "HW-UNKNOWN")
        return str(fp or "HW-UNKNOWN")
    except Exception:
        return "HW-UNKNOWN"


def _is_setup_done() -> bool:
    try:
        if os.path.isfile(SETTINGS_FILE):
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            sw = data.get("setup_wizard")
            if isinstance(sw, dict) and sw.get("completed"):
                return True
            if len(data.get("users") or []) > 0 or len(data.get("trunks") or []) > 0:
                return True
    except Exception:
        pass
    return False


def cmd_health(as_json: bool = False) -> int:
    ip = _detect_primary_ip()
    setup_done = _is_setup_done()
    web_url = f"http://{ip}" if setup_done else f"http://{ip}/setup"
    hw_id = _detect_hw_id()

    services = {
        "asterisk": _check_systemd_active("asterisk"),
        "postgresql": _check_systemd_active("postgresql"),
        "nginx": _check_systemd_active("nginx"),
        "wireguard": _check_systemd_active("wg-quick@wg-nornia"),
        "backend_api_8000": _check_tcp_local(8000),
        "frontend_ui_3000": _check_tcp_local(3000),
        "audiosocket_9092": _check_tcp_local(9092),
    }

    payload = {
        "ip": ip,
        "web_url": web_url,
        "setup_completed": setup_done,
        "hardware_id": hw_id,
        "services": services,
    }

    if as_json:
        print(json.dumps(payload, ensure_ascii=False))
        return 0

    print("══════════════════════════════════════════════════════════════")
    print("  NORNIA SİSTEM & SERVİS SAĞLIK DURUMU (SALT-OKUNUR)")
    print("══════════════════════════════════════════════════════════════")
    print(f"  Sunucu IP         : {ip}")
    print(f"  Web Erişim URL    : {web_url}")
    print(f"  Donanım Kimliği   : {hw_id}")
    print(f"  İlk Kurulum       : {'Tamamlandı' if setup_done else 'Bekleniyor (/setup)'}")
    print("──────────────────────────────────────────────────────────────")
    labels = [
        ("Asterisk PBX", services["asterisk"]),
        ("PostgreSQL DB (5444)", services["postgresql"]),
        ("Nginx Web Proxy", services["nginx"]),
        ("Nornia Backend (8000)", services["backend_api_8000"]),
        ("Nornia Web UI (3000)", services["frontend_ui_3000"]),
        ("AudioSocket AI (9092)", services["audiosocket_9092"]),
        ("Nornia Connect (WG)", services["wireguard"]),
    ]
    for name, st in labels:
        mark = "●" if st == "AKTİF" else "○"
        print(f"  [{mark}] {name:<26} : {st}")
    print("══════════════════════════════════════════════════════════════")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="nornia-destek-ops", add_help=False)
    sub = parser.add_subparsers(dest="action")

    sub.add_parser("net-summary")
    sub.add_parser("net-recovery")
    sub.add_parser("net-rollback")

    p_ping = sub.add_parser("ping")
    p_ping.add_argument("host")
    p_ping.add_argument("--count", type=int, default=4)

    p_tr = sub.add_parser("traceroute")
    p_tr.add_argument("host")

    p_mtr = sub.add_parser("mtr")
    p_mtr.add_argument("host")

    p_dns = sub.add_parser("dns")
    p_dns.add_argument("domain")
    p_dns.add_argument("--type", dest="qtype", default="A")

    p_port = sub.add_parser("port-test")
    p_port.add_argument("host")
    p_port.add_argument("port", type=int)
    p_port.add_argument("--proto", default="tcp")

    p_sip = sub.add_parser("sip-trace")
    p_sip.add_argument("--packets", type=int, default=30)

    p_health = sub.add_parser("health")
    p_health.add_argument("--json", action="store_true", dest="as_json")

    args = parser.parse_args()
    try:
        if args.action == "net-summary":
            return cmd_net_summary()
        if args.action == "net-recovery":
            return cmd_net_recovery()
        if args.action == "net-rollback":
            return cmd_net_rollback()
        if args.action == "ping":
            return cmd_ping(args.host, args.count)
        if args.action == "traceroute":
            return cmd_traceroute(args.host)
        if args.action == "mtr":
            return cmd_mtr(args.host)
        if args.action == "dns":
            return cmd_dns(args.domain, args.qtype)
        if args.action == "port-test":
            return cmd_port_test(args.host, args.port, args.proto)
        if args.action == "sip-trace":
            return cmd_sip_trace(args.packets)
        if args.action == "health":
            return cmd_health(as_json=args.as_json)
        print("Geçersiz işlem.")
        return 2
    except ValueError as ve:
        print(f"[GEÇERSİZ GİRDİ] {ve}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
