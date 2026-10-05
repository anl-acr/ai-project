#!/usr/bin/env python3
"""
AIDA PBX & AI System - Vendor License Key Generator CLI
Run this script on vendor laptop/server to generate cryptographically signed, machine-bound or unbound license keys for clients.
Usage:
  python3 backend/scripts/generate_client_license.py --tenant nolto --expiry 2027-12-31 --hw HW-361B-F973
"""
import sys
import os
import argparse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.services.license_service import generate_license_key, verify_license_key

def main():
    parser = argparse.ArgumentParser(description="AIDA Cryptographic License Key Generator")
    parser.add_argument("--tenant", "-t", required=True, help="Tenant / Müşteri Kodu (Örn: default, nolto, abc-holding)")
    parser.add_argument("--expiry", "-e", required=True, help="Lisans Bitiş Tarihi (Format: YYYY-MM-DD, Örn: 2027-12-31 veya unlimited)")
    parser.add_argument("--hw", "-w", default="UNBOUND", help="Sunucu Donanım ID (Örn: HW-361B-F973 veya UNBOUND)")

    args = parser.parse_args()

    tenant_code = args.tenant.strip().lower()
    expiry_date = args.expiry.strip()
    hw_id = args.hw.strip().upper()

    if expiry_date.lower() in ["unlimited", "suresiz", "limitsiz"]:
        key = f"AIDA-{tenant_code.upper()}-UNLIMITED-MASTER"
    else:
        key = generate_license_key(tenant_code, expiry_date, hw_id)

    verification = verify_license_key(tenant_code, key)

    print("=" * 65)
    print(" 🛡️  AIDA PANELS - KRİPTOGRAFİK LİSANS ANAHTARI ÜRETİCİ")
    print("=" * 65)
    print(f" Müşteri / Tenant Kodu : {tenant_code}")
    print(f" Bitiş Tarihi          : {expiry_date}")
    print(f" Hedef Donanım (HW)    : {hw_id}")
    print("-" * 65)
    print(f" 🗝️  ÜRETİLEN LİSANS KEY : {key}")
    print("-" * 65)
    print(f" Doğrulama Testi       : {'✅ GEÇERLİ' if verification.get('valid') else '❌ GEÇERSİZ'}")
    print(f" Açıklama              : {verification.get('reason')}")
    print("=" * 65)

if __name__ == "__main__":
    main()
