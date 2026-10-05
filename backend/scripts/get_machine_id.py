#!/usr/bin/env python3
"""
AIDA PBX & AI System - Client Server Machine ID Extractor
Run this script on a client's server during installation to obtain its unique Hardware Fingerprint.
"""
import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.services.hardware_info import get_system_hardware_fingerprint

def main():
    info = get_system_hardware_fingerprint()
    print("=" * 60)
    print(" 🛡️  AIDA PANELS - SUNUCU DONANIM KİMLİĞİ (MACHINE FINGERPRINT)")
    print("=" * 60)
    print(f" Sunucu Donanım ID  : {info['hardware_id']}")
    print(f" Temiz Hash (Clean) : {info['clean_hw_id']}")
    print(f" Ham Donanım Bilgisi : {info['raw_string']}")
    print("-" * 60)
    print(" 📌 Lisans anahtarı oluştururken bu Donanım ID'sini kullanınız.")
    print("=" * 60)

if __name__ == "__main__":
    main()
