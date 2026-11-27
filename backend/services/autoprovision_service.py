import hashlib
import html
import ipaddress
import os
import re
import secrets
import socket
import subprocess
from typing import Any, Dict, List, Optional, Tuple

VENDOR_OUI_MAP: Dict[str, str] = {
    "00:15:65": "Yealink",
    "80:5e:c0": "Yealink",
    "80:5e:0c": "Yealink",
    "24:9a:d8": "Yealink",
    "c4:fc:e4": "Yealink",
    "00:0b:82": "Grandstream",
    "c0:74:ad": "Grandstream",
    "ec:74:d7": "Grandstream",
    "0c:38:3e": "Fanvil",
    "00:a8:59": "Fanvil",
    "d0:7a:b5": "Fanvil",
    "00:04:13": "Snom",
    "00:08:5d": "Aastra",
    "00:0e:08": "Cisco",
    "68:bc:0c": "Cisco",
    "00:1b:d4": "Cisco",
    "7c:2f:80": "Gigaset",
}

SUPPORTED_PHONE_MODELS: Dict[str, List[str]] = {
    "Yealink": [
        "T21P E2", "T23G", "T27G", "T29G",
        "T30P", "T31P", "T31G", "T33P", "T33G",
        "T40G", "T41P", "T41S", "T42G", "T42S", "T42U", "T43U", "T46S", "T46U", "T48S", "T48U",
        "T53", "T53W", "T54W", "T57W", "T58W",
    ],
    "Grandstream": [
        "GXP1625", "GXP1628", "GXP2135", "GXP2140", "GXP2170",
        "GRP2602", "GRP2612", "GRP2613", "GRP2614", "GRP2615", "GRP2616",
        "GRP2624", "GRP2634", "GRP2636",
    ],
    "Fanvil": [
        "X3S", "X3SP", "X3U", "X4U", "X5U", "X6U", "X7", "X7C", "X210",
        "V62", "V64", "V65",
    ],
    "Cisco": [
        "3905",
        "7811", "7821", "7841", "7861",
        "7940", "7941", "7942", "7945", "7960", "7961", "7962", "7965", "7975",
        "8811", "8841", "8845", "8851", "8861",
        "8941", "8945", "8961",
    ],
}

EXPANSION_MODULE_CATALOG: Dict[str, Dict[str, Any]] = {
    "EXP43": {
        "id": "EXP43",
        "brand": "Yealink",
        "name": "Yealink EXP43 (Renkli Ekran • 20×3 = 60 Tuş)",
        "keys_per_page": 20,
        "pages": 3,
        "total_keys": 60,
        "max_chain": 3,
        "screen": "color",
    },
    "EXP50": {
        "id": "EXP50",
        "brand": "Yealink",
        "name": "Yealink EXP50 (Renkli Ekran • 20×3 = 60 Tuş)",
        "keys_per_page": 20,
        "pages": 3,
        "total_keys": 60,
        "max_chain": 3,
        "screen": "color",
    },
    "EXP40": {
        "id": "EXP40",
        "brand": "Yealink",
        "name": "Yealink EXP40 (Monokrom LCD • 20×2 = 40 Tuş)",
        "keys_per_page": 20,
        "pages": 2,
        "total_keys": 40,
        "max_chain": 4,
        "screen": "mono",
    },
    "GBX20": {
        "id": "GBX20",
        "brand": "Grandstream",
        "name": "Grandstream GBX20 (Renkli Ekran • 20×2 = 40 Tuş)",
        "keys_per_page": 20,
        "pages": 2,
        "total_keys": 40,
        "max_chain": 4,
        "screen": "color",
    },
    "GXP2200EXT": {
        "id": "GXP2200EXT",
        "brand": "Grandstream",
        "name": "Grandstream GXP2200EXT (LCD • 20×2 = 40 Tuş)",
        "keys_per_page": 20,
        "pages": 2,
        "total_keys": 40,
        "max_chain": 4,
        "screen": "mono",
    },
    "CP-8800-KEM": {
        "id": "CP-8800-KEM",
        "brand": "Cisco",
        "name": "Cisco CP-8800 Key Expansion Module (18×2 = 36 Tuş)",
        "keys_per_page": 18,
        "pages": 2,
        "total_keys": 36,
        "max_chain": 3,
        "screen": "color",
    },
    "Fanvil-E20": {
        "id": "Fanvil-E20",
        "brand": "Fanvil",
        "name": "Fanvil Harici DSS Genişletme Modülü (20×2 = 40 Tuş)",
        "keys_per_page": 20,
        "pages": 2,
        "total_keys": 40,
        "max_chain": 4,
        "screen": "color",
    },
}

PHONE_MODEL_CATALOG: List[Dict[str, Any]] = [
    # --- YEALINK ---
    {"brand": "Yealink", "model": "T21P E2", "label": "Yealink SIP-T21P E2 (2 Hat • Monokrom LCD)", "screen": "mono", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T23G", "label": "Yealink SIP-T23G (3 Hat • Monokrom Gigabit)", "screen": "mono", "layout": "left_only", "dss_per_page": 3, "dss_pages": 1, "max_dss": 3, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T27G", "label": "Yealink SIP-T27G (8 Tuş × 3 Sayfa • EXP40 Destekli)", "screen": "mono", "layout": "split", "dss_per_page": 8, "dss_pages": 3, "max_dss": 21, "soft_keys": 4, "expansion_model": "EXP40", "max_expansions": 4},
    {"brand": "Yealink", "model": "T29G", "label": "Yealink SIP-T29G (10 Tuş × 3 Sayfa • Renkli • EXP40)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 3, "max_dss": 27, "soft_keys": 4, "expansion_model": "EXP40", "max_expansions": 4},
    {"brand": "Yealink", "model": "T30P", "label": "Yealink SIP-T30 / T30P (Giriş • Monokrom)", "screen": "mono", "layout": "compact", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T31P", "label": "Yealink SIP-T31P (2 Hat • Monokrom LCD)", "screen": "mono", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T31G", "label": "Yealink SIP-T31G (2 Hat • Gigabit Monokrom)", "screen": "mono", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T33P", "label": "Yealink SIP-T33P (4 Tuş × 3 Sayfa • Renkli)", "screen": "color", "layout": "split", "dss_per_page": 4, "dss_pages": 3, "max_dss": 12, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T33G", "label": "Yealink SIP-T33G (4 Tuş × 3 Sayfa • Renkli Gigabit)", "screen": "color", "layout": "split", "dss_per_page": 4, "dss_pages": 3, "max_dss": 12, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T40G", "label": "Yealink SIP-T40G (3+3 Tuş • Monokrom)", "screen": "mono", "layout": "split", "dss_per_page": 6, "dss_pages": 3, "max_dss": 15, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T41P", "label": "Yealink SIP-T41P (6 Tuş × 3 Sayfa • Monokrom)", "screen": "mono", "layout": "split", "dss_per_page": 6, "dss_pages": 3, "max_dss": 15, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T41S", "label": "Yealink SIP-T41S (6 Tuş × 3 Sayfa • Monokrom)", "screen": "mono", "layout": "split", "dss_per_page": 6, "dss_pages": 3, "max_dss": 15, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T42G", "label": "Yealink SIP-T42G (6 Tuş × 3 Sayfa • Monokrom Gigabit)", "screen": "mono", "layout": "split", "dss_per_page": 6, "dss_pages": 3, "max_dss": 15, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T42S", "label": "Yealink SIP-T42S (6 Tuş • Tek Sayfa • Monokrom Gigabit)", "screen": "mono", "layout": "split", "dss_per_page": 6, "dss_pages": 1, "max_dss": 6, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T42U", "label": "Yealink SIP-T42U (6 Tuş × 3 Sayfa • Monokrom)", "screen": "mono", "layout": "split", "dss_per_page": 6, "dss_pages": 3, "max_dss": 15, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Yealink", "model": "T43U", "label": "Yealink SIP-T43U (8 Tuş × 3 Sayfa • EXP43 Destekli)", "screen": "mono", "layout": "split", "dss_per_page": 8, "dss_pages": 3, "max_dss": 21, "soft_keys": 4, "expansion_model": "EXP43", "max_expansions": 3},
    {"brand": "Yealink", "model": "T46S", "label": "Yealink SIP-T46S (10 Tuş × 3 Sayfa • Renkli • EXP40)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 3, "max_dss": 27, "soft_keys": 4, "expansion_model": "EXP40", "max_expansions": 4},
    {"brand": "Yealink", "model": "T46U", "label": "Yealink SIP-T46U (10 Tuş × 3 Sayfa • Renkli • EXP43)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 3, "max_dss": 27, "soft_keys": 4, "expansion_model": "EXP43", "max_expansions": 3},
    {"brand": "Yealink", "model": "T48S", "label": "Yealink SIP-T48S (7\" Dokunmatik • 29 Tuş • EXP40)", "screen": "touch", "layout": "touch_grid", "dss_per_page": 10, "dss_pages": 3, "max_dss": 29, "soft_keys": 4, "expansion_model": "EXP40", "max_expansions": 4},
    {"brand": "Yealink", "model": "T48U", "label": "Yealink SIP-T48U (7\" Dokunmatik • 29 Tuş • EXP43)", "screen": "touch", "layout": "touch_grid", "dss_per_page": 10, "dss_pages": 3, "max_dss": 29, "soft_keys": 4, "expansion_model": "EXP43", "max_expansions": 3},
    {"brand": "Yealink", "model": "T53", "label": "Yealink SIP-T53 (8 Tuş × 3 Sayfa • EXP50 Destekli)", "screen": "mono", "layout": "split", "dss_per_page": 8, "dss_pages": 3, "max_dss": 21, "soft_keys": 4, "expansion_model": "EXP50", "max_expansions": 3},
    {"brand": "Yealink", "model": "T53W", "label": "Yealink SIP-T53W (8 Tuş × 3 Sayfa • Wi-Fi • EXP50)", "screen": "mono", "layout": "split", "dss_per_page": 8, "dss_pages": 3, "max_dss": 21, "soft_keys": 4, "expansion_model": "EXP50", "max_expansions": 3},
    {"brand": "Yealink", "model": "T54W", "label": "Yealink SIP-T54W (10 Tuş × 3 Sayfa • Renkli • EXP50)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 3, "max_dss": 27, "soft_keys": 4, "expansion_model": "EXP50", "max_expansions": 3},
    {"brand": "Yealink", "model": "T57W", "label": "Yealink SIP-T57W (7\" Dokunmatik • 29 Tuş • EXP50)", "screen": "touch", "layout": "touch_grid", "dss_per_page": 10, "dss_pages": 3, "max_dss": 29, "soft_keys": 4, "expansion_model": "EXP50", "max_expansions": 3},
    {"brand": "Yealink", "model": "T58W", "label": "Yealink SIP-T58W (Android Dokunmatik • 27 Tuş • EXP50)", "screen": "touch", "layout": "touch_grid", "dss_per_page": 10, "dss_pages": 3, "max_dss": 27, "soft_keys": 4, "expansion_model": "EXP50", "max_expansions": 3},
    # --- GRANDSTREAM ---
    {"brand": "Grandstream", "model": "GXP1625", "label": "Grandstream GXP1625 (2 Hat • Monokrom)", "screen": "mono", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 3, "expansion_model": None, "max_expansions": 0},
    {"brand": "Grandstream", "model": "GXP1628", "label": "Grandstream GXP1628 (2 Hat + 8 Fiziksel BLF)", "screen": "mono", "layout": "side_mpk", "dss_per_page": 10, "dss_pages": 1, "max_dss": 10, "soft_keys": 3, "expansion_model": None, "max_expansions": 0},
    {"brand": "Grandstream", "model": "GXP2135", "label": "Grandstream GXP2135 (8 Tuş × 4 Sayfa = 32 VPK)", "screen": "color", "layout": "split", "dss_per_page": 8, "dss_pages": 4, "max_dss": 32, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Grandstream", "model": "GXP2140", "label": "Grandstream GXP2140 (4 Hat • GXP2200EXT × 4 Destekli)", "screen": "color", "layout": "split", "dss_per_page": 4, "dss_pages": 1, "max_dss": 4, "soft_keys": 4, "expansion_model": "GXP2200EXT", "max_expansions": 4},
    {"brand": "Grandstream", "model": "GXP2170", "label": "Grandstream GXP2170 (12 Tuş × 4 Sayfa • GXP2200EXT × 4)", "screen": "color", "layout": "split", "dss_per_page": 12, "dss_pages": 4, "max_dss": 48, "soft_keys": 4, "expansion_model": "GXP2200EXT", "max_expansions": 4},
    {"brand": "Grandstream", "model": "GRP2602", "label": "Grandstream GRP2602 (2 Hat • Monokrom)", "screen": "mono", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Grandstream", "model": "GRP2612", "label": "Grandstream GRP2612 (4 Tuş × 4 Sayfa = 16 VPK)", "screen": "color", "layout": "split", "dss_per_page": 4, "dss_pages": 4, "max_dss": 16, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Grandstream", "model": "GRP2613", "label": "Grandstream GRP2613 (6 Tuş × 4 Sayfa = 24 VPK)", "screen": "color", "layout": "split", "dss_per_page": 6, "dss_pages": 4, "max_dss": 24, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Grandstream", "model": "GRP2614", "label": "Grandstream GRP2614 (Çift Ekran • 4 Hat + 24 MPK)", "screen": "dual_screen", "layout": "side_mpk", "dss_per_page": 12, "dss_pages": 3, "max_dss": 28, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Grandstream", "model": "GRP2615", "label": "Grandstream GRP2615 (10 Tuş × 4 Sayfa • GBX20 × 4)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 4, "max_dss": 40, "soft_keys": 4, "expansion_model": "GBX20", "max_expansions": 4},
    {"brand": "Grandstream", "model": "GRP2616", "label": "Grandstream GRP2616 (Çift Ekran • 6 Hat + 24 MPK)", "screen": "dual_screen", "layout": "side_mpk", "dss_per_page": 12, "dss_pages": 3, "max_dss": 30, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Grandstream", "model": "GRP2624", "label": "Grandstream GRP2624 (8 Tuş × 4 Sayfa • GBX20 × 4)", "screen": "color", "layout": "split", "dss_per_page": 8, "dss_pages": 4, "max_dss": 32, "soft_keys": 4, "expansion_model": "GBX20", "max_expansions": 4},
    {"brand": "Grandstream", "model": "GRP2634", "label": "Grandstream GRP2634 (8 Hat + 10 MPK • GBX20 × 4)", "screen": "color", "layout": "side_mpk", "dss_per_page": 10, "dss_pages": 3, "max_dss": 30, "soft_keys": 4, "expansion_model": "GBX20", "max_expansions": 4},
    {"brand": "Grandstream", "model": "GRP2636", "label": "Grandstream GRP2636 (12 Hat + 24 MPK • GBX20 × 4)", "screen": "dual_screen", "layout": "side_mpk", "dss_per_page": 12, "dss_pages": 3, "max_dss": 36, "soft_keys": 4, "expansion_model": "GBX20", "max_expansions": 4},
    # --- FANVIL ---
    {"brand": "Fanvil", "model": "X3S", "label": "Fanvil X3S (2 Hat • Renkli LCD)", "screen": "color", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Fanvil", "model": "X3SP", "label": "Fanvil X3SP (2 Hat • PoE • Renkli LCD)", "screen": "color", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Fanvil", "model": "X3U", "label": "Fanvil X3U (3 Hat • Renkli LCD Gigabit)", "screen": "color", "layout": "left_only", "dss_per_page": 3, "dss_pages": 1, "max_dss": 3, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Fanvil", "model": "X4U", "label": "Fanvil X4U (Çift Renkli Ekran • 6 Yan DSS × 5 Sayfa = 30)", "screen": "dual_screen", "layout": "side_mpk", "dss_per_page": 6, "dss_pages": 5, "max_dss": 30, "soft_keys": 4, "expansion_model": "Fanvil-E20", "max_expansions": 4},
    {"brand": "Fanvil", "model": "X5U", "label": "Fanvil X5U (Çift Renkli Ekran • 6 Yan DSS × 5 Sayfa = 30)", "screen": "dual_screen", "layout": "side_mpk", "dss_per_page": 6, "dss_pages": 5, "max_dss": 30, "soft_keys": 4, "expansion_model": "Fanvil-E20", "max_expansions": 4},
    {"brand": "Fanvil", "model": "X6U", "label": "Fanvil X6U (Üçlü Ekran • 12 Yan DSS × 5 Sayfa = 60)", "screen": "dual_screen", "layout": "split", "dss_per_page": 12, "dss_pages": 5, "max_dss": 60, "soft_keys": 4, "expansion_model": "Fanvil-E20", "max_expansions": 4},
    {"brand": "Fanvil", "model": "X7", "label": "Fanvil X7 (7\" Dokunmatik • 20 DSS × 3 Sayfa = 60)", "screen": "touch", "layout": "touch_grid", "dss_per_page": 12, "dss_pages": 5, "max_dss": 60, "soft_keys": 4, "expansion_model": "Fanvil-E20", "max_expansions": 4},
    {"brand": "Fanvil", "model": "X7C", "label": "Fanvil X7C (5\" Renkli • 12 DSS × 5 Sayfa = 60)", "screen": "color", "layout": "split", "dss_per_page": 12, "dss_pages": 5, "max_dss": 60, "soft_keys": 4, "expansion_model": "Fanvil-E20", "max_expansions": 4},
    {"brand": "Fanvil", "model": "X210", "label": "Fanvil X210 (Santral Operatör • Çift Yan Ekran = 96 DSS)", "screen": "dual_screen", "layout": "split", "dss_per_page": 12, "dss_pages": 8, "max_dss": 96, "soft_keys": 4, "expansion_model": "Fanvil-E20", "max_expansions": 4},
    {"brand": "Fanvil", "model": "V62", "label": "Fanvil V62 (6 Tuş × 3 Sayfa = 18 DSS • V-Serisi)", "screen": "color", "layout": "split", "dss_per_page": 6, "dss_pages": 3, "max_dss": 18, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Fanvil", "model": "V64", "label": "Fanvil V64 (8 Tuş × 3 Sayfa = 21 DSS • V-Serisi)", "screen": "color", "layout": "split", "dss_per_page": 8, "dss_pages": 3, "max_dss": 21, "soft_keys": 4, "expansion_model": "Fanvil-E20", "max_expansions": 4},
    {"brand": "Fanvil", "model": "V65", "label": "Fanvil V65 (10 Tuş × 4 Sayfa = 40 DSS • V-Serisi)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 4, "max_dss": 40, "soft_keys": 4, "expansion_model": "Fanvil-E20", "max_expansions": 4},
    # --- CISCO ---
    {"brand": "Cisco", "model": "3905", "label": "Cisco IP Phone 3905 (1 Hat • Monokrom SIP)", "screen": "mono", "layout": "left_only", "dss_per_page": 0, "dss_pages": 0, "max_dss": 0, "soft_keys": 0, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7811", "label": "Cisco IP Phone 7811 (1 Hat • Monokrom)", "screen": "mono", "layout": "left_only", "dss_per_page": 1, "dss_pages": 1, "max_dss": 1, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7821", "label": "Cisco IP Phone 7821 (2 Hat • Monokrom)", "screen": "mono", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7841", "label": "Cisco IP Phone 7841 (4 Hat • Monokrom Gigabit)", "screen": "mono", "layout": "left_only", "dss_per_page": 4, "dss_pages": 1, "max_dss": 4, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7861", "label": "Cisco IP Phone 7861 (16 Hat/BLF • Monokrom)", "screen": "mono", "layout": "split", "dss_per_page": 16, "dss_pages": 1, "max_dss": 16, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7940", "label": "Cisco IP Phone 7940 (2 Hat • Klasik Enterprise)", "screen": "mono", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7941", "label": "Cisco IP Phone 7941 (2 Hat • Monokrom)", "screen": "mono", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7942", "label": "Cisco IP Phone 7942G (2 Hat • Wideband)", "screen": "mono", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7945", "label": "Cisco IP Phone 7945G (2 Hat • Renkli Gigabit)", "screen": "color", "layout": "left_only", "dss_per_page": 2, "dss_pages": 1, "max_dss": 2, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7960", "label": "Cisco IP Phone 7960 (6 Hat • Klasik Enterprise)", "screen": "mono", "layout": "left_only", "dss_per_page": 6, "dss_pages": 1, "max_dss": 6, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7961", "label": "Cisco IP Phone 7961G (6 Hat • Monokrom)", "screen": "mono", "layout": "left_only", "dss_per_page": 6, "dss_pages": 1, "max_dss": 6, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7962", "label": "Cisco IP Phone 7962G (6 Hat • Wideband)", "screen": "mono", "layout": "left_only", "dss_per_page": 6, "dss_pages": 1, "max_dss": 6, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7965", "label": "Cisco IP Phone 7965G (6 Hat • Renkli Gigabit)", "screen": "color", "layout": "left_only", "dss_per_page": 6, "dss_pages": 1, "max_dss": 6, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "7975", "label": "Cisco IP Phone 7975G (8 Hat • Renkli Dokunmatik)", "screen": "color", "layout": "left_only", "dss_per_page": 8, "dss_pages": 1, "max_dss": 8, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "8811", "label": "Cisco IP Phone 8811 (10 Tuş • Monokrom)", "screen": "mono", "layout": "split", "dss_per_page": 10, "dss_pages": 1, "max_dss": 10, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "8841", "label": "Cisco IP Phone 8841 (10 Tuş • Renkli 5\" LCD)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 1, "max_dss": 10, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "8845", "label": "Cisco IP Phone 8845 (10 Tuş • Renkli Video)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 1, "max_dss": 10, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "8851", "label": "Cisco IP Phone 8851 (10 Tuş • Renkli • KEM × 3 Destekli)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 1, "max_dss": 10, "soft_keys": 4, "expansion_model": "CP-8800-KEM", "max_expansions": 3},
    {"brand": "Cisco", "model": "8861", "label": "Cisco IP Phone 8861 (10 Tuş • Renkli Wi-Fi • KEM × 3)", "screen": "color", "layout": "split", "dss_per_page": 10, "dss_pages": 1, "max_dss": 10, "soft_keys": 4, "expansion_model": "CP-8800-KEM", "max_expansions": 3},
    {"brand": "Cisco", "model": "8941", "label": "Cisco IP Phone 8941 (4 Hat • Renkli Video)", "screen": "color", "layout": "left_only", "dss_per_page": 4, "dss_pages": 1, "max_dss": 4, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "8945", "label": "Cisco IP Phone 8945 (4 Hat • Renkli Video Bluetooth)", "screen": "color", "layout": "left_only", "dss_per_page": 4, "dss_pages": 1, "max_dss": 4, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
    {"brand": "Cisco", "model": "8961", "label": "Cisco IP Phone 8961 (5 Hat • Renkli Enterprise)", "screen": "color", "layout": "left_only", "dss_per_page": 5, "dss_pages": 1, "max_dss": 5, "soft_keys": 4, "expansion_model": None, "max_expansions": 0},
]

DEFAULT_PHONE_PREFS: Dict[str, Any] = {
    "ringtone": "Ring1.wav",
    "ring_volume": 6,
    "handset_volume": 7,
    "speaker_volume": 6,
    "headset_volume": 7,
    "call_waiting": True,
    "call_waiting_tone": True,
    "auto_answer": False,
    "intercom_mute": False,
    "headset_mode": "rj9",  # rj9 | ehs | usb | bluetooth
    "language": "Turkish",
    "time_format": "24",  # 24 | 12
    "date_format": "DD.MM.YYYY",
    "backlight_active": 8,  # 1..10
    "backlight_inactive": 2,  # 0..10
    "backlight_timeout": 60,  # seconds (0 = always on)
    "screensaver_wait": 300,  # seconds (0 = disabled)
    "screen_label": "",
    "missed_call_led": True,
    "mwi_led": True,
    "dnd_default": False,
}


def build_system_default_templates() -> List[Dict[str, Any]]:
    """
    Generates 56 built-in, vendor-accurate provisioning templates — one for every model in PHONE_MODEL_CATALOG
    (Yealink, Grandstream, Fanvil, Cisco). Admins can inspect or clone any built-in template into a custom template.
    """
    templates: List[Dict[str, Any]] = []
    for item in PHONE_MODEL_CATALOG:
        b = item["brand"]
        m = item["model"]
        b_low = b.lower()
        slug = re.sub(r"[^a-z0-9]+", "_", f"{b}_{m}".lower()).strip("_")
        screen_lbl = {
            "mono": "Monokrom",
            "color": "Renkli LCD",
            "touch": "Dokunmatik",
            "dual_screen": "Çift Ekran",
        }.get(item.get("screen"), "LCD")
        exp_note = f" • {item['expansion_model']} ×{item['max_expansions']}" if item.get("max_expansions", 0) > 0 else ""

        if b_low == "grandstream":
            fmt = "xml"
            content = f"""<?xml version="1.0" encoding="UTF-8" ?>
<!-- Nornia Sistem Şablonu: Grandstream {m} ({item['dss_per_page']}×{item['dss_pages']} = {item['max_dss']} DSS{exp_note}) -->
<gs_provision version="1">
  <mac>{{MAC}}</mac>
  <config version="1">
    <P212>{{PROVISION_PROTO_CODE}}</P212>
    <P237>{{PROVISION_URL_NO_SCHEME}}</P237>
    <P194>1</P194>
    <P240>0</P240>
    <P4428>1</P4428>
    <P95030>0</P95030>
    <P22421>0</P22421>
    <P6752>1</P6752>
    <P271>1</P271>
    <P270>{{LABEL}}</P270>
    <P47>{{SIP_SERVER}}:{{SIP_PORT}}</P47>
    <P35>{{SIP_USERNAME}}</P35>
    <P36>{{SIP_USERNAME}}</P36>
    <P34>{{SIP_PASSWORD}}</P34>
    <P3>{{DISPLAY_NAME}}</P3>
    <P130>{{TRANSPORT_CODE}}</P130>
    <P52>2</P52>
    <P33>{{VOICEMAIL_CODE}}</P33>
    <P1347>{{PICKUP_DIRECTED}}</P1347>
    <P64>TZT-3</P64>
    <P30>pool.ntp.org</P30>
    <P122>{{TIME_FORMAT_24_BIT}}</P122>
    <P1362>{{GS_LANGUAGE_CODE}}</P1362>
    <P334>{{BACKLIGHT_ACTIVE_PCT}}</P334>
    <P330>1</P330>
    <P331>{{PHONEBOOK_URL_NO_SCHEME}}</P331>
    <P332>60</P332>
{{SYNC_FEATURE_BLOCK}}
{{DSS_KEYS_BLOCK}}
{{EXPANSION_MODULES_BLOCK}}
{{SOFTKEYS_BLOCK}}
  </config>
</gs_provision>
"""
        elif b_low == "fanvil":
            fmt = "cfg"
            content = f"""<<VOIP CONFIG FILE>>Version:2.0000
# Nornia Sistem Şablonu: Fanvil {m} ({item['dss_per_page']}×{item['dss_pages']} = {item['max_dss']} DSS{exp_note})

<GLOBAL CONFIG MODULE>
Enable SNTP          :1
SNTP Server          :{{NTP_SERVER}}
Second SNTP Server   :pool.ntp.org
SNTP Timeout         :60
Time Zone            :{{FANVIL_TZ_INDEX}}
Time Zone Name       :{{FANVIL_TZ_NAME}}
Enable DST           :0

<AUTOUPDATE CONFIG MODULE>
Auto Server URL      :{{PROVISION_URL}}
Update Mode          :1
SIP Notify Update    :1

<SIP CONFIG MODULE>
--SIP Line List--  :
SIP1 Enable          :1
SIP1 Enable Reg      :1
SIP1 Phone Number    :{{SIP_USERNAME}}
SIP1 Display Name    :{{LABEL}}
SIP1 Sip Name        :{{DISPLAY_NAME}}
SIP1 Register Addr   :{{SIP_SERVER}}
SIP1 Register Port   :{{SIP_PORT}}
SIP1 Register User   :{{SIP_USERNAME}}
SIP1 Register Pswd   :{{SIP_PASSWORD}}
SIP1 Register TTL    :300
SIP1 Transport       :{{TRANSPORT_CODE}}
SIP1 Rport           :1
SIP1 Keep Alive Type :1
SIP1 Keep Alive Intvl:30
SIP1 Subscribe Expire:1800
SIP1 MWI Num         :{{VOICEMAIL_CODE}}
SIP1 Ring Type       :{{RINGTONE}}
{{FANVIL_SIP_SYNC_BLOCK}}

<PHONE CONFIG MODULE>
Time Display 24H     :{{TIME_FORMAT_24_BIT}}
Backlight Level      :{{BACKLIGHT_ACTIVE}}
Language             :{{LANGUAGE}}
{{FANVIL_PHONE_SYNC_BLOCK}}

<DSSKEY CONFIG MODULE>
{{DSS_KEYS_BLOCK}}
{{EXPANSION_MODULES_BLOCK}}

<TELEPHONE BOOK MODULE>
Phonebook Cloud1 Name :Nornia Telefon Rehberi
Phonebook Cloud1 URL  :{{PHONEBOOK_URL}}

<<END OF FILE>>
"""
        elif b_low == "cisco":
            fmt = "xml"
            content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!-- Nornia Sistem Şablonu: Cisco Enterprise {m} ({item['dss_per_page']}×{item['dss_pages']} = {item['max_dss']} DSS{exp_note}) -->
<device>
  <deviceProtocol>SIP</deviceProtocol>
  <sshUserId>admin</sshUserId>
  <sshPassword>nornia7800</sshPassword>
  <devicePool>
    <dateTimeSetting>
      <dateTemplate>D/M/Y</dateTemplate>
      <timeZone>Saudi Arabia Standard Time</timeZone>
      <ntps>
        <ntp>
          <name>162.159.200.1</name>
          <ntpMode>Unicast</ntpMode>
        </ntp>
      </ntps>
    </dateTimeSetting>
    <callManagerGroup>
      <members>
        <member priority="0">
          <callManager>
            <ports>
              <ethernetPhonePort>2000</ethernetPhonePort>
              <sipPort>{{SIP_PORT}}</sipPort>
              <securedSipPort>5061</securedSipPort>
            </ports>
            <processNodeName>{{SIP_SERVER}}</processNodeName>
          </callManager>
        </member>
      </members>
    </callManagerGroup>
  </devicePool>
  <sipProfile>
    <sipProxies>
      <registerWithProxy>true</registerWithProxy>
    </sipProxies>
    <phoneLabel>{{DISPLAY_NAME}}</phoneLabel>
    <sipLines>
      <line button="1">
        <featureID>9</featureID>
        <featureLabel>{{LABEL}}</featureLabel>
        <proxy>USECALLMANAGER</proxy>
        <port>{{SIP_PORT}}</port>
        <name>{{SIP_USERNAME}}</name>
        <displayName>{{DISPLAY_NAME}}</displayName>
        <authName>{{SIP_USERNAME}}</authName>
        <authPassword>{{SIP_PASSWORD}}</authPassword>
        <contact>{{SIP_USERNAME}}</contact>
        <messagesNumber>{{VOICEMAIL_CODE}}</messagesNumber>
      </line>
{{DSS_KEYS_BLOCK}}
    </sipLines>
    <voipControlPort>5060</voipControlPort>
    <dialTemplate>dialplan.xml</dialTemplate>
  </sipProfile>
  <transportLayerProtocol>1</transportLayerProtocol>
</device>
"""
        else:
            fmt = "cfg"
            content = f"""#!version:1.0.0.1
# Nornia Sistem Şablonu: Yealink {m} ({item['dss_per_page']}×{item['dss_pages']} = {item['max_dss']} DSS • {screen_lbl}{exp_note})

# --- Oto-Provizyon & Uzaktan Reboot ---
static.auto_provision.server.url = {{PROVISION_URL}}
static.auto_provision.power_on = 1
static.auto_provision.repeat.enable = 1
static.auto_provision.repeat.minutes = 60
static.security.trust_certificates = 0
sip.notify_reboot_enable = 0

# --- SIP Hesap 1 ---
account.1.enable = 1
account.1.label = {{LABEL}}
account.1.display_name = {{DISPLAY_NAME}}
account.1.auth_name = {{SIP_USERNAME}}
account.1.user_name = {{SIP_USERNAME}}
account.1.password = {{SIP_PASSWORD}}
account.1.sip_server.1.address = {{SIP_SERVER}}
account.1.sip_server.1.port = {{SIP_PORT}}
account.1.sip_server.1.transport_type = {{TRANSPORT_CODE}}
account.1.sip_server.1.expires = 300
account.1.nat.udp_update_enable = 1
account.1.nat.udp_update_time = 30
account.1.nat.rport = 1
account.1.dtmf.type = 2
account.1.cid_source = 4
voice_mail.number.1 = {{VOICEMAIL_CODE}}
account.1.direct_pickup_code = {{PICKUP_DIRECTED}}
account.1.group_pickup_code = {{PICKUP_GROUP}}
account.1.dialoginfo_callpickup = 1

# --- Kodek Onceligi ---
account.1.codec.g722.enable = 1
account.1.codec.g722.priority = 1
account.1.codec.pcma.enable = 1
account.1.codec.pcma.priority = 2
account.1.codec.pcmu.enable = 1
account.1.codec.pcmu.priority = 3
account.1.codec.g729.enable = 1
account.1.codec.g729.priority = 4

# --- Dil, Saat, Zil ve Ekran Tercihleri ---
lang.gui = {{LANGUAGE}}
lang.wui = {{LANGUAGE}}
local_time.time_zone = {{TIMEZONE}}
local_time.time_zone_name = {{TIMEZONE_NAME}}
local_time.ntp_server1 = {{NTP_SERVER}}
local_time.summer_time = 0
local_time.time_format = {{TIME_FORMAT_24_BIT}}
phone_setting.ring_type = {{RINGTONE}}
phone_setting.active_backlight_level = {{BACKLIGHT_ACTIVE}}
features.direct_ip_call_enable = 0

# --- DSS / BLF Tuslari (Masa Telefonum ile Dinamik Dolar) ---
{{DSS_KEYS_BLOCK}}

# --- Mesguliyet Modulleri (Expansion Modules 1-4) ---
{{EXPANSION_MODULES_BLOCK}}

# --- Ekran Alti Softkeys (F1-F4) ---
{{SOFTKEYS_BLOCK}}

# --- Canli Cift Yonlu DND & Cagri Yonlendirme Senkronizasyonu ---
{{SYNC_FEATURE_BLOCK}}

# --- Uzak XML Rehber ---
features.remote_phonebook.enable = 1
features.remote_phonebook.flash_time = 3600
remote_phonebook.data.1.url = {{PHONEBOOK_URL}}
remote_phonebook.data.1.name = Telefon Rehberi
"""

        templates.append({
            "id": f"sys_tpl_{slug}",
            "name": f"{b} {m} — Sistem Şablonu",
            "brand": b,
            "model": m,
            "format": fmt,
            "screen": screen_lbl,
            "dss_summary": f"{item['dss_per_page']}×{item['dss_pages']} ({item['max_dss']} DSS){exp_note}",
            "is_system": True,
            "xml_content": content,
        })
    return templates


def resolve_phone_model_spec(brand: str = "Yealink", model: str = "T46U") -> Dict[str, Any]:
    b_low = str(brand or "Yealink").strip().lower()
    m_low = str(model or "T46U").strip().lower().replace("sip-", "")
    for item in PHONE_MODEL_CATALOG:
        if item["brand"].lower() == b_low and item["model"].lower() == m_low:
            return dict(item)
    for item in PHONE_MODEL_CATALOG:
        if m_low and (m_low in item["model"].lower() or item["model"].lower() in m_low):
            return dict(item)
    for item in PHONE_MODEL_CATALOG:
        if item["brand"].lower() == b_low:
            return dict(item)
    return dict(PHONE_MODEL_CATALOG[10])  # Yealink T46U fallback


def normalize_phone_prefs(raw: Any, fallback_lang: str = "Turkish", fallback_auto_answer: bool = False) -> Dict[str, Any]:
    p = dict(DEFAULT_PHONE_PREFS)
    if fallback_lang:
        p["language"] = str(fallback_lang).strip() or "Turkish"
    p["auto_answer"] = bool(fallback_auto_answer)
    if not isinstance(raw, dict):
        return p
    if raw.get("ringtone"):
        p["ringtone"] = str(raw["ringtone"]).strip()[:64]
    for int_k, lo, hi in (
        ("ring_volume", 0, 10),
        ("handset_volume", 1, 10),
        ("speaker_volume", 1, 10),
        ("headset_volume", 1, 10),
        ("backlight_active", 1, 10),
        ("backlight_inactive", 0, 10),
        ("backlight_timeout", 0, 3600),
        ("screensaver_wait", 0, 7200),
    ):
        if raw.get(int_k) is not None:
            try:
                p[int_k] = max(lo, min(hi, int(raw[int_k])))
            except Exception:
                pass
    for bool_k in ("call_waiting", "call_waiting_tone", "auto_answer", "intercom_mute", "missed_call_led", "mwi_led", "dnd_default"):
        if raw.get(bool_k) is not None:
            p[bool_k] = bool(raw[bool_k])
    if raw.get("headset_mode") in ("rj9", "ehs", "usb", "bluetooth"):
        p["headset_mode"] = raw["headset_mode"]
    if raw.get("language"):
        p["language"] = str(raw["language"]).strip()
    if str(raw.get("time_format") or "") in ("12", "24"):
        p["time_format"] = str(raw["time_format"])
    if raw.get("date_format"):
        p["date_format"] = str(raw["date_format"]).strip()[:20]
    if raw.get("screen_label") is not None:
        p["screen_label"] = str(raw["screen_label"]).strip()[:48]
    return p


def normalize_expansion_modules(raw: Any) -> List[Dict[str, Any]]:
    """Normalizes daisy-chained expansion modules (1..4 sidecars) and their keys."""
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for m_idx, mod in enumerate(raw[:4]):
        if not isinstance(mod, dict):
            continue
        mod_idx = max(1, min(4, int(mod.get("module_index") or (m_idx + 1))))
        mod_model = str(mod.get("model") or "EXP43").strip()
        if mod_model not in EXPANSION_MODULE_CATALOG:
            mod_model = "EXP43"
        keys_out: List[Dict[str, Any]] = []
        raw_keys = mod.get("keys") if isinstance(mod.get("keys"), list) else []
        for k_i, k_item in enumerate(raw_keys[:60]):
            if not isinstance(k_item, dict):
                continue
            lmode = str(k_item.get("label_mode") or "auto").strip().lower()
            if lmode not in ("auto", "custom"):
                lmode = "auto"
            keys_out.append({
                "key_index": max(1, min(60, int(k_item.get("key_index") or (k_i + 1)))),
                "type": str(k_item.get("type") or "none").strip(),
                "label": str(k_item.get("label") or "").strip(),
                "label_mode": lmode,
                "value": str(k_item.get("value") or "").strip(),
                "pickup_code": str(k_item.get("pickup_code") or "*8").strip() or "*8",
            })
        out.append({
            "module_index": mod_idx,
            "model": mod_model,
            "keys": keys_out,
        })
    return out


def resolve_dynamic_key_labels(
    keys: Optional[List[Dict[str, Any]]],
    ext_name_map: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    """
    Dynamically resolves live PBX subscriber names for keys whose `label_mode == 'auto'`
    (or whose label is blank while targeting a known extension).
    If an extension's name changes in the PBX, every phone referencing it in auto mode
    automatically receives the new display label on next provisioning fetch / reboot!
    """
    if not isinstance(keys, list):
        return []
    name_map = ext_name_map if isinstance(ext_name_map, dict) else {}
    resolved: List[Dict[str, Any]] = []
    for k in keys:
        if not isinstance(k, dict):
            continue
        item = dict(k)
        kval = str(item.get("value") or "").strip()
        klbl = str(item.get("label") or "").strip()
        lmode = str(item.get("label_mode") or "").strip().lower()
        ktype = str(item.get("type") or "none").strip().lower()

        if lmode not in ("auto", "custom"):
            # Backward compatibility: if label already matches known ext name or is blank, treat as auto
            live_match = name_map.get(kval)
            if kval and live_match and (not klbl or klbl == live_match or klbl == f"Dahili {kval}"):
                lmode = "auto"
            else:
                lmode = "custom" if klbl else "auto"

        if lmode == "auto" and kval and kval in name_map and ktype in ("blf", "speed_dial", "transfer", "intercom", "forward", "line"):
            item["label"] = name_map[kval]
        elif not klbl and kval and kval in name_map:
            item["label"] = name_map[kval]
        item["label_mode"] = lmode
        resolved.append(item)
    return resolved


def build_default_soft_keys() -> List[Dict[str, Any]]:
    """Standard Nornia first-boot F1-F4 softkeys: Geçmiş, Rehber, Yönlendir, Menü."""
    return [
        {"key_index": 1, "type": "history", "label": "Geçmiş", "value": ""},
        {"key_index": 2, "type": "directory", "label": "Rehber", "value": ""},
        {"key_index": 3, "type": "forward", "label": "Yönlendir", "value": ""},
        {"key_index": 4, "type": "menu", "label": "Menü", "value": ""},
    ]


def enforce_primary_line_key(
    dss_keys: Optional[List[Dict[str, Any]]],
    ext: str,
    default_label: str = "",
) -> List[Dict[str, Any]]:
    """
    Guarantees that Key 1 (T1) is ALWAYS locked as Primary Line (`type='line'`) on Account 1
    across all IP phone vendors (Yealink, Grandstream, Fanvil, Cisco) so a user can never
    accidentally wipe out their own extension line and break calling / call-waiting.
    Preserves custom display label if the user customized T1's label.
    """
    ext_s = str(ext or "").strip()
    fallback_lbl = str(default_label or (ext_s if ext_s else "Hat 1")).strip()
    items = [dict(k) for k in (dss_keys or []) if isinstance(k, dict)]
    t1_idx = None
    for i, k in enumerate(items):
        if int(k.get("key_index") or 0) == 1:
            t1_idx = i
            break
    if t1_idx is not None:
        existing_lbl = str(items[t1_idx].get("label") or "").strip()
        existing_type = str(items[t1_idx].get("type") or "").strip().lower()
        # Migrate legacy verbose default "Hat <ext>" to compact "<ext>" so it fits narrow LCD labels (e.g. T42S)
        is_legacy_hat = bool(ext_s and existing_lbl.lower() == f"hat {ext_s}".lower())
        items[t1_idx] = {
            **items[t1_idx],
            "key_index": 1,
            "type": "line",
            "value": ext_s,
            "label": existing_lbl if (existing_type == "line" and existing_lbl and not is_legacy_hat) else fallback_lbl,
            "label_mode": "custom",
            "locked": True,
        }
    else:
        items.insert(0, {
            "key_index": 1,
            "type": "line",
            "value": ext_s,
            "label": fallback_lbl,
            "label_mode": "custom",
            "pickup_code": "*8",
            "locked": True,
        })
    items.sort(key=lambda x: int(x.get("key_index") or 999))
    return items


def resolve_user_sip_username(ext_val: Any, raw_sip_user: Any = "", tenant_id: Any = "tenant-default") -> str:
    """
    Returns a clean, deterministic PJSIP endpoint identifier for physical IP phones / SIP clients.
    - Uses user's configured `sip_username` (Kullanıcı Ayarları > SIP > Kullanıcı Adı) when valid and non-numeric.
    - For `tenant-default` (single-tenant/local installs), preserves the exact legacy seed so existing
      provisioned phones keep their SIP usernames untouched.
    - For secondary cloud tenants (`tenant-acme`, etc.), salts the seed with `tenant_id` so two tenants
      can both have extension 1000 without colliding in Asterisk PJSIP.
    """
    ext_s = str(ext_val or "").strip()
    cand = re.sub(r"[^a-zA-Z0-9_.-]", "", str(raw_sip_user or "").strip())
    if cand and cand != ext_s and not cand.isdigit():
        return cand
    t_clean = str(tenant_id or "tenant-default").strip()
    if t_clean in ("", "tenant-default", "default"):
        seed = f"AIDA_SIP_USER_V1_{ext_s or '1000'}"
    else:
        seed = f"AIDA_SIP_USER_V1_{t_clean}_{ext_s or '1000'}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    alpha_up = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    alpha_lo = "abcdefghijkmnopqrstuvwxyz"
    digits = "23456789"
    b = bytes.fromhex(digest[:16])
    chars = [
        alpha_up[b[0] % len(alpha_up)],
        alpha_lo[b[1] % len(alpha_lo)],
        digits[b[2] % len(digits)],
        alpha_up[b[3] % len(alpha_up)],
        alpha_lo[b[4] % len(alpha_lo)],
        digits[b[5] % len(digits)],
        alpha_up[b[6] % len(alpha_up)],
        digits[b[7] % len(digits)],
    ]
    return "".join(chars)


def resolve_user_webphone_sip_username(ext_val: Any, raw_web_sip_user: Any = "", tenant_id: Any = "tenant-default") -> str:
    """
    Returns a clean, deterministic alphanumeric PJSIP endpoint identifier for the browser WebRTC phone (`web_phone`).
    Never returns a numeric extension so Asterisk `pjsip show endpoints` contains zero extension numbers.
    Salts secondary cloud tenants by `tenant_id` while preserving exact legacy values for `tenant-default`.
    """
    ext_s = str(ext_val or "").strip()
    cand = re.sub(r"[^a-zA-Z0-9_.-]", "", str(raw_web_sip_user or "").strip())
    if cand and cand != ext_s and not cand.isdigit():
        return cand
    t_clean = str(tenant_id or "tenant-default").strip()
    if t_clean in ("", "tenant-default", "default"):
        seed = f"AIDA_WEBPHONE_SIP_V1_{ext_s or '1000'}"
    else:
        seed = f"AIDA_WEBPHONE_SIP_V1_{t_clean}_{ext_s or '1000'}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    alpha_up = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    alpha_lo = "abcdefghijkmnopqrstuvwxyz"
    digits = "23456789"
    b = bytes.fromhex(digest[:16])
    chars = [
        "W",
        alpha_lo[b[1] % len(alpha_lo)],
        digits[b[2] % len(digits)],
        alpha_up[b[3] % len(alpha_up)],
        alpha_lo[b[4] % len(alpha_lo)],
        digits[b[5] % len(digits)],
        alpha_up[b[6] % len(alpha_up)],
        digits[b[7] % len(digits)],
    ]
    return "".join(chars)


def generate_random_sip_device_username(ext_val: Any = "", index: int = 1) -> str:
    """Generates a unique 8-char alphanumeric SIP username for additional SIP devices."""
    alpha_up = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    alpha_lo = "abcdefghijkmnopqrstuvwxyz"
    digits = "23456789"
    pool = alpha_up + alpha_lo + digits
    chars = [
        secrets.choice(alpha_up),
        secrets.choice(alpha_lo),
        secrets.choice(digits),
    ] + [secrets.choice(pool) for _ in range(5)]
    return "".join(chars)


def normalize_user_sip_devices(
    user_dict: Dict[str, Any],
    autoprovision_list: Optional[List[Dict[str, Any]]] = None,
    deskphone_configs: Optional[Dict[str, Any]] = None,
    fallback_password_fn=None,
) -> List[Dict[str, Any]]:
    """
    Ensures every subscriber has a normalized `sip_devices` list (with at least 1 default SIP device
    migrated seamlessly from legacy `sip_username` / `sip_password` / `autoprovision` / `user_deskphone_configs`).
    """
    import json as _json_mod

    ext_s = str(user_dict.get("extension") or "").strip()
    uid_s = str(user_dict.get("id") or "").strip()
    u_tid = str(user_dict.get("tenant_id") or "tenant-default").strip() or "tenant-default"
    raw_devices = user_dict.get("sip_devices")
    if isinstance(raw_devices, str):
        try:
            raw_devices = _json_mod.loads(raw_devices)
        except Exception:
            raw_devices = None

    ap_list = autoprovision_list if isinstance(autoprovision_list, list) else []
    dp_cfgs = deskphone_configs if isinstance(deskphone_configs, dict) else {}
    legacy_dp = dp_cfgs.get(ext_s) if (ext_s and isinstance(dp_cfgs.get(ext_s), dict)) else {}

    bound_ap_devices: List[Dict[str, Any]] = []
    match_keys = {k for k in (ext_s, uid_s) if k}
    for d in ap_list:
        if not isinstance(d, dict):
            continue
        d_tid = str(d.get("tenant_id") or "tenant-default").strip() or "tenant-default"
        if (u_tid in ("tenant-default", "default")) != (d_tid in ("tenant-default", "default")):
            continue
        if u_tid not in ("tenant-default", "default") and d_tid != u_tid:
            continue
        assigned = str(d.get("assigned_user") or d.get("extension") or "").strip()
        if assigned and assigned in match_keys:
            bound_ap_devices.append(d)

    def _clean_pwd(raw_p: Any) -> str:
        p_s = str(raw_p or "").strip()
        if fallback_password_fn:
            return fallback_password_fn(ext_s or "1000", p_s)
        if len(p_s) >= 8:
            return p_s
        dg = hashlib.sha256(f"AIDA_PBX_SIP_V2_SECRET_{ext_s or '1000'}_8842".encode("utf-8")).hexdigest()[:12]
        return f"Aida#{dg}"

    valid_codecs = ("g722", "alaw", "ulaw", "opus", "g729", "gsm")

    cti_cfg = user_dict.get("cti_config") if isinstance(user_dict.get("cti_config"), dict) else {}
    explicitly_empty = bool(cti_cfg.get("sip_devices_empty")) and isinstance(raw_devices, list) and len(raw_devices) == 0
    is_system_admin_no_ext = (not ext_s) and (
        str(user_dict.get("role") or "").strip().lower() == "admin" or uid_s in ("admin", "9999")
    )

    if not isinstance(raw_devices, list) or len(raw_devices) == 0:
        if is_system_admin_no_ext:
            return []
        if explicitly_empty:
            raw_devices = []
        else:
            primary_sip_u = resolve_user_sip_username(ext_s, user_dict.get("sip_username") or "", tenant_id=u_tid)
            primary_pwd = _clean_pwd(user_dict.get("sip_password") or "")
            try:
                primary_max_act = max(1, min(5, int(user_dict.get("max_activations") or 1)))
            except Exception:
                primary_max_act = 1
            primary_tr = str(user_dict.get("transport") or "UDP").strip().upper()
            if primary_tr not in ("UDP", "TCP", "TLS"):
                primary_tr = "UDP"

            ap0 = bound_ap_devices[0] if bound_ap_devices else {}
            mac0, _ = normalize_mac_address(ap0.get("mac") or legacy_dp.get("mac") or "")
            brand0 = str(ap0.get("brand") or legacy_dp.get("brand") or (detect_brand_from_mac(mac0, "") if mac0 else "")).strip()
            model0 = str(ap0.get("model") or legacy_dp.get("model") or "").strip()
            ip0 = str(ap0.get("ip") or legacy_dp.get("ip") or "").strip()
            dss0 = ap0.get("dss_keys") if isinstance(ap0.get("dss_keys"), list) and ap0.get("dss_keys") else (legacy_dp.get("dss_keys") if isinstance(legacy_dp.get("dss_keys"), list) else [])
            soft0 = ap0.get("soft_keys") if isinstance(ap0.get("soft_keys"), list) and ap0.get("soft_keys") else (legacy_dp.get("soft_keys") if isinstance(legacy_dp.get("soft_keys"), list) else [])

            raw_devices = [
                {
                    "id": f"dev-{ext_s or '1'}-1",
                    "name": "Masa Telefonu 1",
                    "device_type": "desk_phone",
                    "sip_username": primary_sip_u,
                    "sip_password": primary_pwd,
                    "max_activations": primary_max_act,
                    "transport": primary_tr,
                    "is_active": True,
                    "mac": mac0,
                    "ip": ip0,
                    "brand": brand0,
                    "model": model0,
                    "codecs": ["g722", "alaw", "ulaw", "g729"],
                    "dtmf_mode": "rfc4733",
                    "language": "Turkish",
                    "timezone": "+3",
                    "ntp_server": "pool.ntp.org",
                    "auto_answer": False,
                    "direct_ip_call_block": True,
                    "dss_keys": dss0,
                    "soft_keys": soft0,
                }
            ]

    # Ensure exactly one Web Telefonu (`web_phone`) sits at index 0 for every subscriber with an extension
    if ext_s or any(isinstance(d, dict) and str(d.get("device_type") or "").strip().lower() == "web_phone" for d in raw_devices):
        existing_web_devs = [
            d for d in raw_devices
            if isinstance(d, dict) and str(d.get("device_type") or "").strip().lower() == "web_phone"
        ]
        other_devs = [
            d for d in raw_devices
            if isinstance(d, dict) and str(d.get("device_type") or "").strip().lower() != "web_phone"
        ]
        if existing_web_devs:
            web_seed_item = dict(existing_web_devs[0])
        else:
            web_seed_item = {
                "id": f"dev-web-{ext_s or uid_s or '1'}",
                "name": "Web Telefonu",
                "device_type": "web_phone",
                "sip_username": resolve_user_webphone_sip_username(ext_s, ""),
                "sip_password": _clean_pwd(user_dict.get("sip_password") or ""),
                "max_activations": 5,
                "transport": "WSS",
                "is_active": True,
            }
        raw_devices = [web_seed_item] + other_devs

    normalized: List[Dict[str, Any]] = []
    seen_sip_users = {ext_s.lower()} if ext_s else set()
    assigned_primary_real_sip = False

    for idx, dev in enumerate(raw_devices):
        if not isinstance(dev, dict):
            continue
        dev_type = str(dev.get("device_type") or "desk_phone").strip().lower()
        if dev_type not in ("web_phone", "desk_phone", "softphone", "dect", "virtual_subscriber"):
            dev_type = "desk_phone"

        if dev_type == "web_phone":
            dev_id = str(dev.get("id") or f"dev-web-{ext_s or 'u'}").strip()
            default_dev_label = "Web Telefonu"
        elif dev_type == "virtual_subscriber":
            dev_id = str(dev.get("id") or f"dev-{ext_s or 'u'}-{idx + 1}").strip()
            default_dev_label = f"Sanal Abone {idx}"
        else:
            dev_id = str(dev.get("id") or f"dev-{ext_s or 'u'}-{idx + 1}").strip()
            default_dev_label = f"SIP Cihazı {idx}"
        dev_name = str(dev.get("name") or default_dev_label).strip() or default_dev_label

        dev_trunk = str(dev.get("trunk") or "").strip()
        dev_prefix = re.sub(r"[^0-9a-zA-Z*#+_.-]", "", str(dev.get("prefix") or "").strip())
        raw_vmode = str(dev.get("virtual_target_mode") or "extension").strip().lower()
        dev_vmode = "custom" if raw_vmode == "custom" else "extension"
        dev_custom_target = re.sub(r"[^0-9a-zA-Z*#+_.-]", "", str(dev.get("custom_target") or "").strip())

        if dev_type == "virtual_subscriber":
            cand_su = ""
            dev_pwd = ""
        elif dev_type == "web_phone":
            raw_su = str(dev.get("sip_username") or "").strip()
            cand_su = resolve_user_webphone_sip_username(ext_s, raw_su, tenant_id=u_tid)
            while cand_su.lower() in seen_sip_users or cand_su.isdigit():
                cand_su = "W" + generate_random_sip_device_username(ext_s, idx + 1)[1:]
            seen_sip_users.add(cand_su.lower())
            dev_pwd = _clean_pwd(dev.get("sip_password") or user_dict.get("sip_password") or "")
        else:
            raw_su = str(dev.get("sip_username") or "").strip()
            if not assigned_primary_real_sip:
                cand_su = resolve_user_sip_username(ext_s, raw_su or user_dict.get("sip_username") or "", tenant_id=u_tid)
                assigned_primary_real_sip = True
            else:
                cand_su = re.sub(r"[^a-zA-Z0-9_.-]", "", raw_su)
                if not cand_su or cand_su.isdigit() or cand_su.lower() in seen_sip_users:
                    cand_su = generate_random_sip_device_username(ext_s, idx + 1)
            while cand_su.lower() in seen_sip_users or cand_su.isdigit():
                cand_su = generate_random_sip_device_username(ext_s, idx + 2)
            seen_sip_users.add(cand_su.lower())
            dev_pwd = _clean_pwd(dev.get("sip_password") or (user_dict.get("sip_password") if not normalized else ""))
        try:
            max_upper = 10 if dev_type == "web_phone" else 5
            min_lower = 5 if dev_type == "web_phone" else 1
            default_max_act = 5 if dev_type == "web_phone" else 1
            dev_max_act = max(min_lower, min(max_upper, int(dev.get("max_activations") or default_max_act)))
        except Exception:
            dev_max_act = 5 if dev_type == "web_phone" else 1

        if dev_type == "web_phone":
            dev_tr = "WSS"
            dev_driver = "pjsip"
            dev_remote = False
        elif dev_type == "virtual_subscriber":
            dev_tr = "UDP"
            dev_driver = "pjsip"
            dev_remote = False
        else:
            raw_drv = str(dev.get("sip_driver") or "pjsip").strip().lower()
            dev_driver = "chan_sip" if raw_drv in ("chan_sip", "sip", "cisco_sip") else "pjsip"
            dev_remote = bool(dev.get("remote_access", False))
            if dev_driver == "pjsip" and dev_remote:
                dev_tr = "TCP"
            else:
                dev_tr = str(dev.get("transport") or ("TCP" if dev_driver == "chan_sip" else "UDP")).strip().upper()
                if dev_tr not in ("UDP", "TCP", "TLS"):
                    dev_tr = "TCP" if dev_driver == "chan_sip" else "UDP"

        mac_colon, _ = normalize_mac_address(dev.get("mac") or "")
        matched_ap = None
        if dev_type not in ("web_phone", "virtual_subscriber"):
            for ap_d in bound_ap_devices:
                ap_su = str(ap_d.get("sip_username") or "").strip()
                ap_mac, _ = normalize_mac_address(ap_d.get("mac") or "")
                if (cand_su and ap_su and ap_su == cand_su) or (mac_colon and ap_mac and ap_mac == mac_colon):
                    matched_ap = ap_d
                    break
        if matched_ap and not mac_colon:
            mac_colon, _ = normalize_mac_address(matched_ap.get("mac") or "")
        raw_brand = str(dev.get("brand") or (matched_ap.get("brand") if matched_ap else "") or "").strip()
        dev_brand = detect_brand_from_mac(mac_colon, "") if (mac_colon and not raw_brand) else raw_brand
        dev_model = str(dev.get("model") or (matched_ap.get("model") if matched_ap else "") or "").strip()
        if (
            dev_type not in ("web_phone", "virtual_subscriber")
            and "cisco" in dev_brand.lower()
            and not any(tok in dev_model.lower() for tok in ("mpp", "3pcc", "spa"))
        ):
            dev_driver = "chan_sip"
            if dev_tr not in ("TCP", "UDP"):
                dev_tr = "TCP"
        dev_manual_model = bool(dev.get("manual_model_selected", False))
        # Strip legacy auto-injected "Yealink T46U" default on unpaired devices (no MAC, no AutoProv match, no BLF keys)
        if (
            dev_type not in ("web_phone", "virtual_subscriber")
            and not mac_colon
            and not matched_ap
            and not dev_manual_model
            and dev_brand.lower() == "yealink"
            and dev_model.lower() == "t46u"
            and not (
                isinstance(dev.get("dss_keys"), list)
                and any(isinstance(k, dict) and str(k.get("type") or "").strip().lower() not in ("", "none") for k in dev.get("dss_keys"))
            )
        ):
            dev_brand = ""
            dev_model = ""
        dev_ip = str(dev.get("ip") or (matched_ap.get("ip") if matched_ap else "") or "").strip()

        raw_codecs = dev.get("codecs")
        if isinstance(raw_codecs, str):
            raw_codecs = [c.strip().lower() for c in raw_codecs.split(",") if c.strip()]
        dev_codecs: List[str] = []
        if isinstance(raw_codecs, list):
            for c in raw_codecs:
                cl = str(c or "").strip().lower()
                if cl == "pcma":
                    cl = "alaw"
                elif cl == "pcmu":
                    cl = "ulaw"
                if cl in valid_codecs and cl not in dev_codecs:
                    dev_codecs.append(cl)
        if not dev_codecs:
            dev_codecs = ["g722", "alaw", "ulaw", "g729"]

        dtmf_m = str(dev.get("dtmf_mode") or "rfc4733").strip().lower()
        if dtmf_m not in ("rfc4733", "info", "inband"):
            dtmf_m = "rfc4733"

        dss_list: List[Dict[str, Any]] = []
        if isinstance(dev.get("dss_keys"), list):
            for k_idx, k_item in enumerate(dev.get("dss_keys")):
                if not isinstance(k_item, dict):
                    continue
                lm = str(k_item.get("label_mode") or "").strip().lower()
                if lm not in ("auto", "custom"):
                    lm = "auto" if not str(k_item.get("label") or "").strip() else "custom"
                dss_list.append({
                    "key_index": int(k_item.get("key_index") or (k_idx + 1)),
                    "type": str(k_item.get("type") or "blf").strip(),
                    "label": str(k_item.get("label") or "").strip(),
                    "label_mode": lm,
                    "value": str(k_item.get("value") or "").strip(),
                    "pickup_code": str(k_item.get("pickup_code") or "**").strip() or "**",
                })

        soft_list: List[Dict[str, Any]] = []
        if isinstance(dev.get("soft_keys"), list):
            for s_idx, s_item in enumerate(dev.get("soft_keys")):
                if not isinstance(s_item, dict):
                    continue
                soft_list.append({
                    "key_index": int(s_item.get("key_index") or (s_idx + 1)),
                    "type": str(s_item.get("type") or "history").strip(),
                    "label": str(s_item.get("label") or "").strip(),
                    "value": str(s_item.get("value") or "").strip(),
                })

        exp_mods_norm = normalize_expansion_modules(dev.get("expansion_modules"))
        phone_prefs_norm = normalize_phone_prefs(
            dev.get("phone_prefs"),
            fallback_lang=str(dev.get("language") or "Turkish"),
            fallback_auto_answer=bool(dev.get("auto_answer", False)),
        )

        base_is_active = dev.get("is_active") is not False
        raw_ca = dev.get("client_access") if isinstance(dev.get("client_access"), dict) else None
        if dev_type == "web_phone":
            if raw_ca is not None:
                client_access_norm = {
                    "web_phone": bool(raw_ca.get("web_phone", True)),
                    "pc_app": bool(raw_ca.get("pc_app", True)),
                    "mobile_app": bool(raw_ca.get("mobile_app", True)),
                }
                eff_is_active = any(client_access_norm.values())
            else:
                client_access_norm = {
                    "web_phone": base_is_active,
                    "pc_app": base_is_active,
                    "mobile_app": base_is_active,
                }
                eff_is_active = base_is_active
        else:
            client_access_norm = None
            eff_is_active = base_is_active

        raw_cm = str(dev.get("connection_mode") or "").strip().lower()
        if raw_cm not in ("lan", "wan", "auto"):
            raw_cm = "wan" if dev_remote else "lan"

        dev_out = {
            "id": dev_id,
            "name": dev_name,
            "device_type": dev_type,
            "sip_username": cand_su,
            "sip_password": dev_pwd,
            "max_activations": dev_max_act,
            "sip_driver": dev_driver,
            "remote_access": dev_remote,
            "connection_mode": raw_cm,
            "transport": dev_tr,
            "is_active": eff_is_active,
            "is_deletable": dev_type != "web_phone",
            "trunk": dev_trunk,
            "prefix": dev_prefix,
            "virtual_target_mode": dev_vmode,
            "custom_target": dev_custom_target,
            "mac": mac_colon,
            "ip": dev_ip,
            "brand": dev_brand,
            "model": dev_model,
            "manual_model_selected": dev_manual_model,
            "codecs": dev_codecs,
            "dtmf_mode": dtmf_m,
            "language": str(dev.get("language") or "Turkish").strip() or "Turkish",
            "timezone": str(dev.get("timezone") or "+3").strip() or "+3",
            "ntp_server": str(dev.get("ntp_server") or "pool.ntp.org").strip() or "pool.ntp.org",
            "auto_answer": bool(dev.get("auto_answer", False)),
            "direct_ip_call_block": dev.get("direct_ip_call_block") is not False,
            "dss_keys": dss_list,
            "soft_keys": soft_list,
            "expansion_modules": exp_mods_norm,
            "phone_prefs": phone_prefs_norm,
            "config_version": int(dev.get("config_version") or 1),
            "last_provisioned_at": str(dev.get("last_provisioned_at") or ""),
            "last_provisioned_ip": str(dev.get("last_provisioned_ip") or ""),
        }
        if client_access_norm is not None:
            dev_out["client_access"] = client_access_norm
        normalized.append(dev_out)

    return normalized


def normalize_mac_address(raw_mac: Any) -> Tuple[str, str]:
    """
    Normalizes any MAC string ('00-15-65-AA-BB-CC', '001565aabbcc', '00:15:65:a:b:c')
    into ('00:15:65:aa:bb:cc', '001565aabbcc'). Returns ('', '') if invalid.
    """
    s = str(raw_mac or "").strip().lower()
    if not s:
        return "", ""
    if ":" in s or "-" in s:
        sep = ":" if ":" in s else "-"
        parts = [p.strip() for p in s.split(sep) if p.strip()]
        if len(parts) == 6 and all(re.fullmatch(r"[0-9a-f]{1,2}", p) for p in parts):
            padded = [p.zfill(2) for p in parts]
            return ":".join(padded), "".join(padded)
    hex_only = re.sub(r"[^0-9a-f]", "", s)
    if len(hex_only) == 12:
        colon = ":".join(hex_only[i : i + 2] for i in range(0, 12, 2))
        return colon, hex_only
    return "", ""


def extract_mac_from_provision_filename(filename: str) -> str:
    """
    Extracts 12-hex lowercase MAC from common vendor provisioning request filenames:
    - Yealink / Fanvil: 805ec0112233.cfg, 001565aabbcc.boot, 001565aabbcc-local.cfg
    - Grandstream: cfg000b82112233.xml, cfg000b82112233
    - Snom / Cisco: snomD785-000413112233.htm, spa000e08112233.xml, SEP000E08112233.cnf.xml
    """
    fn = str(filename or "").strip()
    m = re.search(r"([0-9a-fA-F]{12})", fn)
    if m:
        return m.group(1).lower()
    return ""


def detect_brand_from_mac(mac_colon: str, fallback_brand: str = "Yealink") -> str:
    oui = str(mac_colon or "").lower()[:8]
    return VENDOR_OUI_MAP.get(oui) or (str(fallback_brand or "").strip() or "Yealink")


def generate_device_token(mac_val: Any = "") -> str:
    """Generates a deterministic-or-random URL-safe provisioning token for a MAC-bound SIP device."""
    clean_mac = re.sub(r"[^0-9a-fA-F]", "", str(mac_val or "")).lower()
    if clean_mac:
        digest = hashlib.sha256(f"AIDA_AP_DEV_TOKEN_{clean_mac}".encode("utf-8")).hexdigest()
        return digest[:24]
    return secrets.token_urlsafe(18).replace("-", "").replace("_", "")[:24]


def get_or_create_provisioning_token(settings_db: dict, tenant_id: str = "tenant-default", force_rotate: bool = False) -> str:
    t_key = "tenant-default" if not tenant_id or tenant_id in ("default", "tenant-default", "all", "global") else str(tenant_id)
    tokens_map = settings_db.get("provisioning_tokens")
    if not isinstance(tokens_map, dict):
        tokens_map = {}
        settings_db["provisioning_tokens"] = tokens_map
    existing = str(tokens_map.get(t_key) or "").strip()
    if existing and len(existing) >= 16 and not force_rotate:
        return existing
    new_tok = secrets.token_urlsafe(18).replace("-", "").replace("_", "")[:24]
    tokens_map[t_key] = new_tok
    return new_tok


def resolve_tenant_by_provisioning_token(settings_db: dict, token: str) -> Optional[str]:
    tok_s = str(token or "").strip()
    if not tok_s:
        return None
    tokens_map = settings_db.get("provisioning_tokens")
    if isinstance(tokens_map, dict):
        for tid, tval in tokens_map.items():
            if str(tval or "").strip() == tok_s:
                return tid
    return None


def is_private_lan_ip(ip_str: str) -> bool:
    """
    Returns True if `ip_str` is an RFC1918 local LAN IPv4 address (10.x, 172.16-31.x, 192.168.x),
    excluding loopback (127.x), Docker bridges (172.17.x), and Nornia Connect WireGuard tunnel (10.200.x).
    """
    raw = str(ip_str or "").strip().split("%")[0]
    if not raw:
        return False
    try:
        addr = ipaddress.ip_address(raw)
        if addr.version != 4:
            return False
        if addr.is_loopback or addr.is_link_local or addr.is_multicast:
            return False
        if not addr.is_private:
            return False
        # Exclude WireGuard tunnel subnet (10.200.0.0/16) and default Docker bridge (172.17.0.0/16)
        if addr in ipaddress.ip_network("10.200.0.0/16") or addr in ipaddress.ip_network("172.17.0.0/16"):
            return False
        return True
    except Exception:
        return False


def detect_server_local_ip() -> str:
    """
    Detects the PBX server's primary LAN IPv4 address (e.g. 172.20.5.252 / 192.168.1.50),
    skipping loopback, Docker bridges, and WireGuard tunnel interfaces (wg0 / 10.200.x.x).
    """
    # 1. Linux `ip -4 -o addr show` (most accurate on production Ubuntu PBX servers)
    try:
        res = subprocess.run(
            ["ip", "-4", "-o", "addr", "show", "scope", "global"],
            capture_output=True,
            text=True,
            timeout=1.5,
        )
        if res.returncode == 0 and res.stdout:
            preferred: List[str] = []
            secondary: List[str] = []
            for line in res.stdout.splitlines():
                parts = line.split()
                if len(parts) < 4:
                    continue
                iface = parts[1].strip()
                if iface.startswith(("lo", "wg", "docker", "br-", "veth", "tun", "virbr")):
                    continue
                ip_val = parts[3].split("/")[0].strip()
                if is_private_lan_ip(ip_val):
                    if iface.startswith(("ens", "enp", "eno", "eth")):
                        preferred.append(ip_val)
                    else:
                        secondary.append(ip_val)
            if preferred:
                return preferred[0]
            if secondary:
                return secondary[0]
    except Exception:
        pass

    # 2. Cross-platform UDP route lookup (works on macOS + Linux without sending packets)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        try:
            s.connect(("8.8.8.8", 80))
            cand = s.getsockname()[0]
            if is_private_lan_ip(cand):
                return cand
        finally:
            s.close()
    except Exception:
        pass

    # 3. Hostname lookup fallback
    try:
        cand = socket.gethostbyname(socket.gethostname())
        if is_private_lan_ip(cand):
            return cand
    except Exception:
        pass

    return "127.0.0.1"


def get_provisioning_network_settings(
    settings_db: dict,
    request_host: str = "",
    request_scheme: str = "https",
) -> Dict[str, Any]:
    """
    Resolves LAN & WAN provisioning network settings combining:
    - Saved user overrides in `settings_db["autoprovision_network"]`
    - Auto-detected PBX Local LAN IP (`detect_server_local_ip()`)
    - NAT external IP (`settings_db["nat"]["extern_ip"]`)
    - Current public HTTP request host (for WAN/tunnel provisioning URL)
    """
    ap_net = settings_db.get("autoprovision_network") if isinstance(settings_db.get("autoprovision_network"), dict) else {}
    nat_cfg = settings_db.get("nat") if isinstance(settings_db.get("nat"), dict) else {}

    detected_local = detect_server_local_ip()
    configured_local = str(ap_net.get("local_ip") or "").strip()
    local_ip = configured_local or detected_local

    local_scheme = str(ap_net.get("local_scheme") or "http").strip().lower()
    if local_scheme not in ("http", "https"):
        local_scheme = "http"

    try:
        local_port = int(ap_net.get("local_port") or 8000)
        if local_port < 1 or local_port > 65535:
            local_port = 8000
    except Exception:
        local_port = 8000

    nat_extern_ip = str(nat_cfg.get("extern_ip") or "").strip()
    req_host_clean = str(request_host or "").strip()
    req_host_only = req_host_clean.split(":")[0].strip()

    # Detect active Nornia Remote Access / SIP Edge domain (e.g. app.nornia.com.tr)
    # When SIP Edge (Kamailio + WireGuard) is active, remote WAN desk phones MUST register to
    # the SIP Edge domain (5060 TCP) rather than the office's behind-NAT ISP IP (nat_extern_ip)!
    ras_sip_domain = ""
    ras_public_url = ""
    try:
        from backend.services.ras_client_service import RAS_RUNTIME_STATE, get_ras_config
        ras_cfg = get_ras_config() or {}
        se = RAS_RUNTIME_STATE.get("sip_edge") if isinstance(RAS_RUNTIME_STATE.get("sip_edge"), dict) else {}
        ras_public_url = str(RAS_RUNTIME_STATE.get("public_ras_url") or "").strip().rstrip("/")
        se_dom = str(se.get("sip_domain") or "").strip()
        if se_dom:
            ras_sip_domain = se_dom
        elif ras_cfg.get("enabled") or os.path.isfile("/etc/wireguard/wg-nornia.conf"):
            if ras_public_url:
                ras_sip_domain = ras_public_url.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0].strip()
            if not ras_sip_domain:
                sub = str(ras_cfg.get("locked_subdomain") or ras_cfg.get("subdomain") or "").strip()
                if sub:
                    ras_sip_domain = f"{sub}.nornia.com.tr"
    except Exception:
        pass
    # Also respect Setup Wizard FQDN settings (nornia_cloud / custom_fqdn) even while tunnel is connecting
    if not ras_sip_domain:
        fqdn_cfg = settings_db.get("fqdn") if isinstance(settings_db.get("fqdn"), dict) else {}
        fqdn_mode = str(fqdn_cfg.get("mode") or "").strip().lower()
        if fqdn_mode == "nornia_cloud":
            f_sub = str(fqdn_cfg.get("subdomain") or "").strip().lower()
            if f_sub:
                ras_sip_domain = f"{f_sub}.nornia.com.tr"
        elif fqdn_mode == "custom_fqdn":
            f_dom = str(fqdn_cfg.get("custom_domain") or fqdn_cfg.get("effective_fqdn") or "").strip().lower()
            if f_dom and "." in f_dom and not is_private_lan_ip(f_dom):
                ras_sip_domain = f_dom
    # Fallback: if accessed over a *.nornia.com.tr tunnel host and wg-nornia exists, treat that host as SIP Edge domain
    if not ras_sip_domain and req_host_only and req_host_only.lower().endswith(".nornia.com.tr"):
        ras_sip_domain = req_host_only

    configured_wan_sip = str(ap_net.get("wan_sip_host") or "").strip()
    wan_sip_host = (
        configured_wan_sip
        or ras_sip_domain
        or (nat_extern_ip if nat_extern_ip not in ("", "127.0.0.1", "localhost", "0.0.0.0") else "")
        or (req_host_only if req_host_only and not is_private_lan_ip(req_host_only) and req_host_only not in ("127.0.0.1", "localhost") else "")
        or local_ip
    )

    configured_wan_prov = str(ap_net.get("wan_prov_base") or "").strip().rstrip("/")
    if configured_wan_prov:
        wan_prov_base = configured_wan_prov
    elif ras_sip_domain:
        # Zero-Touch DHCP Option 66: Hub Nginx proxies http://<sub.nornia.com.tr>/api/ directly on port 80
        # without 301-to-HTTPS redirect, so factory-default Yealink/Grandstream/Fanvil/Cisco phones
        # pull configs out-of-the-box with ZERO manual certificate edits on the phone UI!
        wan_prov_base = f"http://{ras_sip_domain}"
    elif ras_public_url:
        wan_prov_base = ras_public_url.replace("https://", "http://", 1)
    elif req_host_clean and req_host_only not in ("127.0.0.1", "localhost", "0.0.0.0"):
        wan_prov_base = f"http://{req_host_clean}"
    else:
        wan_prov_base = f"http://{wan_sip_host}"

    default_mode = str(ap_net.get("default_mode") or "lan").strip().lower()
    if default_mode not in ("lan", "wan", "auto"):
        default_mode = "lan"

    if (local_scheme == "http" and local_port == 80) or (local_scheme == "https" and local_port == 443):
        lan_base = f"{local_scheme}://{local_ip}"
    else:
        lan_base = f"{local_scheme}://{local_ip}:{local_port}"

    return {
        "local_ip": local_ip,
        "configured_local_ip": configured_local,
        "detected_local_ip": detected_local,
        "local_scheme": local_scheme,
        "local_port": local_port,
        "lan_base": lan_base,
        "wan_sip_host": wan_sip_host,
        "configured_wan_sip_host": configured_wan_sip,
        "sip_edge_active": bool(ras_sip_domain),
        "ras_sip_domain": ras_sip_domain,
        "nat_extern_ip": nat_extern_ip,
        "wan_prov_base": wan_prov_base,
        "configured_wan_prov_base": configured_wan_prov,
        "default_mode": default_mode,
    }


def resolve_provisioning_endpoints(
    settings_db: dict,
    token: str,
    mode: str = "lan",
    request_host: str = "",
    request_scheme: str = "https",
    client_ip: str = "",
) -> Dict[str, Any]:
    """
    Computes LAN, WAN, Auto provisioning URLs AND picks the active SIP server + Phonebook base URL
    based on requested/configured mode (`lan` | `wan` | `auto`) and client IP.
    """
    net = get_provisioning_network_settings(settings_db, request_host=request_host, request_scheme=request_scheme)
    req_mode = str(mode or net["default_mode"] or "lan").strip().lower()
    if req_mode not in ("lan", "wan", "auto"):
        req_mode = "lan"

    req_host_only = str(request_host or "").split(":")[0].strip()
    if req_mode == "auto":
        if is_private_lan_ip(client_ip) or is_private_lan_ip(req_host_only):
            eff_mode = "lan"
        else:
            eff_mode = "wan"
    else:
        eff_mode = req_mode

    lan_prov_url = f"{net['lan_base']}/api/prov/{token}/lan"
    wan_prov_url = f"{net['wan_prov_base']}/api/prov/{token}/wan"
    auto_prov_url = f"{net['lan_base']}/api/prov/{token}"

    if eff_mode == "lan":
        sip_server = net["local_ip"]
        phonebook_base = f"{net['lan_base']}/api/phonebook"
        active_prov_url = lan_prov_url
    else:
        sip_server = net["wan_sip_host"]
        phonebook_base = f"{net['wan_prov_base']}/api/phonebook"
        active_prov_url = wan_prov_url

    return {
        "requested_mode": req_mode,
        "effective_mode": eff_mode,
        "pbx_host": sip_server,
        "phonebook_base_url": phonebook_base,
        "active_prov_url": active_prov_url,
        "lan_prov_url": lan_prov_url,
        "wan_prov_url": wan_prov_url,
        "auto_prov_url": auto_prov_url,
        "local_ip": net["local_ip"],
        "wan_sip_host": net["wan_sip_host"],
        "network": net,
    }


def resolve_pbx_sip_server_host(
    settings_db: dict,
    request_host: str = "",
    mode: str = "auto",
    client_ip: str = "",
) -> str:
    """
    Resolves the SIP server IP/host written into phone configs.
    - mode='lan': returns the PBX's local LAN IP (never tunnel domain!)
    - mode='wan': returns the public NAT external IP / WAN SIP host
    - mode='auto': returns local LAN IP when client_ip or request_host is on LAN, else WAN host.
    """
    net = get_provisioning_network_settings(settings_db, request_host=request_host)
    m = str(mode or "auto").strip().lower()
    if m == "lan":
        return net["local_ip"]
    if m == "wan":
        return net["wan_sip_host"]
    req_h = str(request_host or "").split(":")[0].strip()
    if is_private_lan_ip(client_ip) or is_private_lan_ip(req_h):
        return net["local_ip"]
    if net["default_mode"] == "lan" and not client_ip:
        return net["local_ip"]
    return net["wan_sip_host"] or net["local_ip"]


def ensure_pjsip_notify_conf(asterisk_config_dir: str) -> None:
    """Writes pjsip_notify.conf so Asterisk CLI `pjsip send notify <type> endpoint <sip_username>` works across IP phone brands.
    NOTE: Asterisk config parser treats unescaped `;` as a comment delimiter, so `;reboot=false/true` MUST be escaped as `\\;`.
    """
    notify_content = """; ==========================================
; AIDA Otoprovizyon SIP NOTIFY (check-sync) Tanımları
; ==========================================

[default-yealink]
Event=>check-sync\\;reboot=false

[yealink-reboot]
Event=>check-sync\\;reboot=true

[grandstream-check-sync]
Event=>check-sync\\;reboot=false

[grandstream-reboot]
Event=>check-sync\\;reboot=true

[fanvil-check-sync]
Event=>check-sync\\;reboot=false

[fanvil-reboot]
Event=>check-sync\\;reboot=true

[cisco-check-sync]
Event=>check-sync\\;reboot=false

[cisco-reboot]
Event=>check-sync\\;reboot=true
"""
    try:
        os.makedirs(asterisk_config_dir, exist_ok=True)
        with open(os.path.join(asterisk_config_dir, "pjsip_notify.conf"), "w", encoding="utf-8") as f:
            f.write(notify_content)
    except Exception:
        pass

    if os.path.exists("/etc/asterisk"):
        try:
            with open("/etc/asterisk/pjsip_notify.conf", "w", encoding="utf-8") as f:
                f.write(notify_content)
            os.chmod("/etc/asterisk/pjsip_notify.conf", 0o644)
        except Exception:
            pass


def trigger_phone_sip_notify(sip_username: str, brand: str = "Yealink", reboot: bool = False) -> Tuple[bool, str]:
    """Triggers SIP NOTIFY check-sync on the user's PJSIP hardware endpoint (<sip_username>)."""
    ep = re.sub(r"[^a-zA-Z0-9_.-]", "", str(sip_username or "").strip())
    if not ep:
        return False, "Geçersiz SIP kullanıcı adı."

    b_low = str(brand or "Yealink").lower()
    if "grandstream" in b_low:
        notify_type = "grandstream-reboot" if reboot else "grandstream-check-sync"
    elif "fanvil" in b_low:
        notify_type = "fanvil-reboot" if reboot else "fanvil-check-sync"
    elif "cisco" in b_low:
        notify_type = "cisco-reboot" if reboot else "cisco-check-sync"
    else:
        notify_type = "yealink-reboot" if reboot else "default-yealink"

    # Auto-heal /etc/asterisk/pjsip_notify.conf if stale (e.g. legacy sys-control or missing notify section)
    try:
        ast_notify_path = "/etc/asterisk/pjsip_notify.conf"
        needs_reload = False
        if os.path.exists("/etc/asterisk"):
            cur_txt = ""
            if os.path.isfile(ast_notify_path):
                try:
                    with open(ast_notify_path, "r", encoding="utf-8") as _nf:
                        cur_txt = _nf.read()
                except Exception:
                    cur_txt = ""
            if (
                (f"[{notify_type}]" not in cur_txt)
                or ("Event=>sys-control" in cur_txt)
                or ("Event=>check-sync;reboot=" in cur_txt)
            ):
                ensure_pjsip_notify_conf(os.path.join(os.path.dirname(os.path.dirname(__file__)), "asterisk_config"))
                needs_reload = True
        if needs_reload:
            subprocess.run(
                ["asterisk", "-rx", "module reload res_pjsip_notify.so"],
                capture_output=True,
                text=True,
                timeout=2.5,
                check=False,
            )
    except Exception:
        pass

    try:
        proc = subprocess.run(
            ["asterisk", "-rx", f"pjsip send notify {notify_type} endpoint {ep}"],
            capture_output=True,
            text=True,
            timeout=2.5,
            check=False,
        )
        out = (proc.stdout or proc.stderr or "").strip()
        if proc.returncode == 0 and "Unable to find" not in out and "No such command" not in out:
            return True, out or f"SIP NOTIFY ({notify_type}) -> {ep} gönderildi."
        return False, out or f"Asterisk endpoint ({ep}) aktif değil veya ulaşılamadı."
    except FileNotFoundError:
        return False, "Bu ortamda Asterisk servisi bulunamadı (yalnızca üretim sunucusunda çalışır)."
    except Exception as e:
        return False, str(e)


def inspect_asterisk_pjsip_endpoint(sip_username: str) -> Dict[str, Any]:
    """Runs `asterisk -rx 'pjsip show endpoint <sip_username>'` to verify endpoint existence, live contact IP/Port/RTT, User-Agent, and PJSIP parameters."""
    ep = re.sub(r"[^a-zA-Z0-9_.-]", "", str(sip_username or "").strip())
    if not ep:
        return {"exists": False, "endpoint": "", "online": False, "contacts": [], "parsed": {}, "raw": "SIP kullanıcı adı boş."}

    parsed: Dict[str, Any] = {
        "ip_address": "",
        "port": "",
        "rtt_ms": "",
        "user_agent": "",
        "device_state": "",
        "context": "",
        "transport": "",
        "allow": "",
        "dtmf_mode": "",
        "callerid": "",
        "named_call_group": "",
        "named_pickup_group": "",
        "max_contacts": "",
    }

    def _run_ast_cli(cmd_str: str, timeout_s: float = 2.5) -> Tuple[bool, str]:
        try:
            proc = subprocess.run(
                ["asterisk", "-rx", cmd_str],
                capture_output=True,
                text=True,
                timeout=timeout_s,
                check=False,
            )
            return True, (proc.stdout or proc.stderr or "").strip()
        except FileNotFoundError:
            try:
                proc_d = subprocess.run(
                    ["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", cmd_str],
                    capture_output=True,
                    text=True,
                    timeout=timeout_s,
                    check=False,
                )
                if proc_d.returncode == 0 or (proc_d.stdout or "").strip():
                    return True, (proc_d.stdout or proc_d.stderr or "").strip()
            except Exception:
                pass
            return False, ""

    try:
        cli_ok, raw = _run_ast_cli(f"pjsip show endpoint {ep}", 2.5)
        if not cli_ok:
            return {
                "exists": False,
                "endpoint": ep,
                "online": False,
                "contacts": [],
                "parsed": parsed,
                "cli_available": False,
                "contact_raw": "",
                "raw": "Asterisk CLI bu makinede kurulu değil (üretim sunucusunda `asterisk -rx \"pjsip show endpoint " + ep + "\"` çıktısı canlı olarak görüntülenir).",
            }
        exists = bool(raw) and ("Unable to find object" not in raw) and ("No objects found" not in raw)
        online = exists and ("Avail" in raw or "NonQual" in raw or ("Contact:" in raw and "Unavailable" not in raw))
        contacts: List[str] = []
        contact_id_for_ua = ""
        contact_raw = ""
        for line in raw.splitlines():
            ls = line.strip()
            if ls.startswith("Endpoint:") and not parsed["device_state"]:
                for st_lbl in ("Not in use", "In use", "Ringing", "Busy", "On hold", "Unavailable", "Invalid"):
                    if st_lbl in ls:
                        parsed["device_state"] = st_lbl
                        break
            elif ls.startswith("Contact:"):
                contacts.append(ls)
                m_uri = re.search(r"sip:[^@\s]+@([0-9a-fA-F\.\:]+?)(?::(\d+))?(?:[;\s]|$)", ls)
                if m_uri and not parsed["ip_address"]:
                    parsed["ip_address"] = m_uri.group(1)
                    parsed["port"] = m_uri.group(2) or "5060"
                m_rtt = re.search(r"(?:Avail|NonQual)\s+([0-9]+(?:\.[0-9]+)?)", ls)
                if m_rtt and not parsed["rtt_ms"]:
                    parsed["rtt_ms"] = m_rtt.group(1)
                m_cid = re.match(r"^Contact:\s+([^\s]+)", ls)
                if m_cid and not contact_id_for_ua:
                    contact_id_for_ua = m_cid.group(1).strip()
            elif ls.startswith("Aor:") and not parsed["max_contacts"]:
                m_mc = re.search(r"\s(\d+)\s*$", ls)
                if m_mc:
                    parsed["max_contacts"] = m_mc.group(1)
            elif ":" in ls:
                k_raw, _, v_raw = ls.partition(":")
                k_clean = k_raw.strip().lower()
                v_clean = v_raw.strip()
                if k_clean in parsed and v_clean:
                    parsed[k_clean] = v_clean

        if contact_id_for_ua:
            try:
                c_ok, c_out = _run_ast_cli(f"pjsip show contact {contact_id_for_ua}", 1.5)
                if c_ok and c_out and "Unable to find object" not in c_out:
                    contact_raw = c_out
                    for cline in c_out.splitlines():
                        cls = cline.strip()
                        if cls.lower().startswith("user_agent"):
                            _, _, ua_v = cls.partition(":")
                            if ua_v.strip():
                                parsed["user_agent"] = ua_v.strip()
                                break
            except Exception:
                pass

        return {
            "exists": exists,
            "endpoint": ep,
            "online": online,
            "contacts": contacts,
            "parsed": parsed,
            "cli_available": True,
            "contact_raw": contact_raw,
            "raw": raw,
        }
    except Exception as e:
        return {"exists": False, "endpoint": ep, "online": False, "contacts": [], "parsed": parsed, "cli_available": False, "contact_raw": "", "raw": str(e)}


def inspect_asterisk_chan_sip_peer(peer_name: str) -> Dict[str, Any]:
    """Runs `asterisk -rx 'sip show peer <peer_name>'` for Cisco UseCallManager / chan_sip devices."""
    ep = re.sub(r"[^a-zA-Z0-9_.-]", "", str(peer_name or "").strip())
    if not ep:
        return {"exists": False, "endpoint": "", "online": False, "contacts": [], "parsed": {}, "cli_available": False, "contact_raw": "", "raw": "SIP peer adı boş."}

    parsed: Dict[str, Any] = {
        "ip_address": "",
        "port": "",
        "rtt_ms": "",
        "user_agent": "",
        "device_state": "",
        "context": "",
        "transport": "",
        "allow": "",
        "dtmf_mode": "",
        "callerid": "",
        "named_call_group": "",
        "named_pickup_group": "",
        "max_contacts": "1",
    }

    def _run_ast_cli(cmd_str: str, timeout_s: float = 2.5) -> Tuple[bool, str]:
        try:
            proc = subprocess.run(
                ["asterisk", "-rx", cmd_str],
                capture_output=True,
                text=True,
                timeout=timeout_s,
                check=False,
            )
            return True, (proc.stdout or proc.stderr or "").strip()
        except FileNotFoundError:
            try:
                proc_d = subprocess.run(
                    ["docker", "exec", "ai_pbx_asterisk", "asterisk", "-rx", cmd_str],
                    capture_output=True,
                    text=True,
                    timeout=timeout_s,
                    check=False,
                )
                if proc_d.returncode == 0 or (proc_d.stdout or "").strip():
                    return True, (proc_d.stdout or proc_d.stderr or "").strip()
            except Exception:
                pass
            return False, ""

    try:
        cli_ok, raw = _run_ast_cli(f"sip show peer {ep}", 2.5)
        if not cli_ok:
            return {
                "exists": False,
                "endpoint": ep,
                "online": False,
                "contacts": [],
                "parsed": parsed,
                "cli_available": False,
                "contact_raw": "",
                "raw": "Asterisk CLI bu makinede kurulu değil (`asterisk -rx \"sip show peer " + ep + "\"`).",
            }
        exists = bool(raw) and ("Peer " + ep + " not found" not in raw) and ("not found" not in raw.lower()) and ("no such command" not in raw.lower())
        online = False
        contacts: List[str] = []
        reg_contact_line = ""
        path_line = ""
        addr_ip_line = ""

        for line in raw.splitlines():
            ls = line.strip()
            if ":" not in ls:
                continue
            k_raw, _, v_raw = ls.partition(":")
            k_low = k_raw.strip().lower()
            v_clean = v_raw.strip()
            if not v_clean:
                continue
            if k_low == "status":
                if v_clean.upper().startswith("OK"):
                    online = True
                    parsed["device_state"] = "Not in use"
                    m_rtt = re.search(r"OK\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*ms\s*\)", v_clean, re.IGNORECASE)
                    if m_rtt:
                        parsed["rtt_ms"] = m_rtt.group(1)
                else:
                    parsed["device_state"] = v_clean
            elif k_low == "useragent":
                parsed["user_agent"] = v_clean
            elif k_low == "context":
                parsed["context"] = v_clean
            elif k_low == "dtmfmode":
                parsed["dtmf_mode"] = v_clean
            elif k_low == "callerid":
                parsed["callerid"] = v_clean
            elif k_low == "codecs":
                parsed["allow"] = v_clean
            elif k_low in ("def. transport", "allowed. trnsp"):
                if not parsed["transport"]:
                    parsed["transport"] = v_clean
            elif k_low == "named callgroup":
                parsed["named_call_group"] = v_clean
            elif k_low == "named pickupgroup":
                parsed["named_pickup_group"] = v_clean
            elif k_low == "reg. contact":
                reg_contact_line = v_clean
                contacts.append(f"Contact: {ep}/{v_clean}")
            elif k_low in ("path", "sip path"):
                path_line = v_clean
            elif k_low == "addr->ip":
                addr_ip_line = v_clean

        # Prioritize real client IP from Path (received=sip:...) or Reg. Contact over WireGuard relay IP (10.200.0.1)
        m_rcv = re.search(r"received=sips?:(?:\[)?((?:\d{1,3}\.){3}\d{1,3})(?::(\d+))?", path_line, re.IGNORECASE)
        if m_rcv and m_rcv.group(1) not in ("127.0.0.1", "0.0.0.0", "10.200.0.1"):
            parsed["ip_address"] = m_rcv.group(1)
            parsed["port"] = m_rcv.group(2) or "5160"
        if not parsed["ip_address"] and reg_contact_line:
            m_rc = re.search(r"sips?:[^@\s]+@((?:\d{1,3}\.){3}\d{1,3})(?::(\d+))?", reg_contact_line, re.IGNORECASE)
            if m_rc and m_rc.group(1) not in ("127.0.0.1", "0.0.0.0", "10.200.0.1"):
                parsed["ip_address"] = m_rc.group(1)
                parsed["port"] = m_rc.group(2) or "5160"
        if not parsed["ip_address"] and addr_ip_line:
            m_ad = re.search(r"((?:\d{1,3}\.){3}\d{1,3})(?::(\d+))?", addr_ip_line)
            if m_ad and m_ad.group(1) not in ("0.0.0.0", "127.0.0.1"):
                parsed["ip_address"] = m_ad.group(1)
                parsed["port"] = m_ad.group(2) or "5160"

        # With qualify=no (required over Kamailio Path for chan_sip), registered peers report Status: Unmonitored
        if (
            not online
            and parsed.get("device_state", "").lower() == "unmonitored"
            and (parsed["ip_address"] or (reg_contact_line and "(null)" not in reg_contact_line.lower()))
        ):
            online = True
            parsed["device_state"] = "Not in use"

        return {
            "exists": exists,
            "endpoint": ep,
            "online": online,
            "contacts": contacts,
            "parsed": parsed,
            "cli_available": True,
            "contact_raw": reg_contact_line,
            "raw": raw,
            "driver": "chan_sip",
        }
    except Exception as e:
        return {"exists": False, "endpoint": ep, "online": False, "contacts": [], "parsed": parsed, "cli_available": False, "contact_raw": "", "raw": str(e), "driver": "chan_sip"}


def generate_yealink_common_boot_cfg(settings_db: Optional[dict] = None) -> str:
    """Common Yealink boot/model config (y0000000000xx.cfg) requested prior to <mac>.cfg."""
    lang_v = "Turkish"
    tz_off = "+3"
    tz_name = "Turkey(Ankara)"
    ntp_v = "pool.ntp.org"
    try:
        from backend.services.datetime_service import get_system_datetime_config
        dt_cfg = get_system_datetime_config(settings_db)
        lang_v = dt_cfg["default_language"]
        tz_off = dt_cfg["utc_offset"]
        tz_name = dt_cfg["yealink_tz_name"]
        ntp_v = dt_cfg["ntp_server_primary"]
    except Exception:
        pass
    return "\n".join(
        [
            "#!version:1.0.0.1",
            "# Nornia PBX Yealink Common Provisioning Profile",
            f"lang.gui = {lang_v}",
            f"lang.wui = {lang_v}",
            f"local_time.time_zone = {tz_off}",
            f"local_time.time_zone_name = {tz_name}",
            f"local_time.ntp_server1 = {ntp_v}",
            "local_time.summer_time = 0",
            "sip.notify_reboot_enable = 0",
            "static.auto_provision.custom.protect = 0",
            "static.auto_provision.custom.sync = 0",
            "static.auto_provision.power_on = 1",
            "static.security.trust_certificates = 0",
            "features.direct_ip_call_enable = 0",
            "",
        ]
    )


def _resolve_fanvil_timezone(tz_raw: Any) -> Tuple[str, str]:
    """Maps UTC offset / IANA timezone to Fanvil `(Time Zone index = offset*4, Time Zone Name)`."""
    s = str(tz_raw or "+3").strip()
    if s in ("", "+3", "3", "Europe/Istanbul", "Turkey", "UTC+3"):
        return "12", "UTC+3"
    m = re.match(r"^([+-]?\d+(?:\.\d+)?)$", s.replace("UTC", "").replace("GMT", "").strip())
    if m:
        try:
            hrs = float(m.group(1))
            idx = int(round(hrs * 4))
            sign = "+" if hrs >= 0 else ""
            lbl = f"UTC{sign}{int(hrs) if hrs.is_integer() else hrs}"
            return str(idx), lbl
        except Exception:
            pass
    return "12", "UTC+3"


def _resolve_grandstream_lang_code(eff_language: str) -> str:
    """Maps Nornia language preference to official Grandstream P1362 language code (defaults to Turkish `tr`)."""
    low = str(eff_language or "Turkish").strip().lower()
    if low.startswith("en"):
        return "en"
    if low.startswith("de") or low.startswith("ger"):
        return "de"
    if low.startswith("fr"):
        return "fr"
    if low.startswith("es") or low.startswith("spa"):
        return "es"
    if low.startswith("ru"):
        return "ru"
    if low.startswith("ar"):
        return "ar"
    return "tr"


def _build_grandstream_softkeys_xml_lines(
    soft_list: List[Dict[str, Any]],
    model_name: str = "",
    pickup_group: str = "*8",
) -> List[str]:
    """
    Generates official Grandstream GRP260x (GRP2601/GRP2602/GRP2603/GRP2604) Idle Screen Softkeys XML:
      - `<P2939>1</P2939>`: Custom Idle Screen Softkey Layout = Yes
      - `<P8348>...</P8348>`: Comma-separated left-to-right softkey tokens matching the visual UI bar
        (default: `Custom-History,Custom-Contacts,Custom-IdleForwardAll,Custom-Menu` -> Geçmiş | Rehber | Yönlendir | Menü)
      - `<P2987>..<P2998>`: Custom Softkey 1..3 definitions when SpeedDial / Voicemail softkeys are chosen.
    """
    m_low = str(model_name or "").strip().lower()
    # GRP261x/262x/263x use P8348 for "Hide System Softkey on Idle Page" rather than custom layout string;
    # GRP260x (GRP2601/2602/2603/2604) uses P2939=1 + P8348 for the exact Custom Idle Screen Softkey Layout.
    is_grp260x = any(tag in m_low for tag in ("grp2601", "grp2602", "grp2603", "grp2604"))
    if not is_grp260x:
        return []

    effective_softs = soft_list if soft_list else [
        {"key_index": 1, "type": "history", "label": "Geçmiş", "value": ""},
        {"key_index": 2, "type": "directory", "label": "Rehber", "value": ""},
        {"key_index": 3, "type": "forward", "label": "Yönlendir", "value": ""},
        {"key_index": 4, "type": "menu", "label": "Menü", "value": ""},
    ]
    ordered = sorted(effective_softs, key=lambda s: int(s.get("key_index") or 99))[:4]

    token_map = {
        "history": "Custom-History",
        "directory": "Custom-Contacts",
        # Note: GRP260x hides legacy `Custom-IdleForwardAll` when BroadSoft DFKS (P2325=1) is enabled;
        # `Custom-CallSettings` stays visible on slot 3 and opens the DFKS-synced Forwarding/DND menu in 1 press.
        "forward": "Custom-CallSettings",
        "menu": "Custom-Menu",
        "dnd": "Custom-DND",
        "redial": "Custom-Redial",
        "pickup": "BLF-Pickup",
        "transfer": "Custom-CallSettings",
    }

    out_lines: List[str] = [
        "    <!-- Ekran Alti Softkeys (GRP260x Custom Idle Screen Softkey Layout) -->",
        "    <P2939>1</P2939>",
    ]
    layout_tokens: List[str] = []
    custom_slot = 0  # Custom1 (P2987..2990), Custom2 (P2991..2994), Custom3 (P2995..2998)

    for sk in ordered:
        st = str(sk.get("type") or "history").strip().lower()
        lbl = str(sk.get("label") or "").strip()
        val = str(sk.get("value") or "").strip()
        if st in token_map:
            layout_tokens.append(token_map[st])
        elif st in ("speed_dial", "voicemail") and custom_slot < 3:
            custom_slot += 1
            base_p = 2987 + ((custom_slot - 1) * 4)
            mode_val = "6" if st == "voicemail" else "0"
            eff_val = val or ("*97" if st == "voicemail" else pickup_group)
            eff_lbl = lbl or ("Sesli Mesaj" if st == "voicemail" else "Hızlı Ara")
            out_lines.extend([
                f"    <P{base_p}>{mode_val}</P{base_p}>",
                f"    <P{base_p + 1}>0</P{base_p + 1}>",
                f"    <P{base_p + 2}>{html.escape(eff_lbl)}</P{base_p + 2}>",
                f"    <P{base_p + 3}>{html.escape(eff_val)}</P{base_p + 3}>",
            ])
            layout_tokens.append(f"Custom{custom_slot}")

    # Disable unused Custom1..3 slots cleanly
    for unused_idx in range(custom_slot + 1, 4):
        base_p = 2987 + ((unused_idx - 1) * 4)
        out_lines.append(f"    <P{base_p}>-1</P{base_p}>")

    if layout_tokens:
        out_lines.append(f"    <P8348>{','.join(layout_tokens)}</P8348>")
    return out_lines


def generate_cisco_dialplan_xml() -> str:
    """Standard Cisco Enterprise dialplan.xml for instant Turkish/internal dialing without 15s wait."""
    return (
        "<DIALTEMPLATE>\n"
        '  <TEMPLATE MATCH="112" Timeout="0"/>\n'
        '  <TEMPLATE MATCH="155" Timeout="0"/>\n'
        '  <TEMPLATE MATCH="110" Timeout="0"/>\n'
        '  <TEMPLATE MATCH="*.." Timeout="1"/>\n'
        '  <TEMPLATE MATCH="**...." Timeout="1"/>\n'
        '  <TEMPLATE MATCH="0.........." Timeout="0"/>\n'
        '  <TEMPLATE MATCH="90.........." Timeout="0"/>\n'
        '  <TEMPLATE MATCH="00*" Timeout="3"/>\n'
        '  <TEMPLATE MATCH="...." Timeout="1"/>\n'
        '  <TEMPLATE MATCH="..." Timeout="2"/>\n'
        '  <TEMPLATE MATCH="*" Timeout="4"/>\n'
        "</DIALTEMPLATE>\n"
    )


def generate_cisco_xml_default(pbx_host: str, sip_port: int = 5060) -> str:
    """Minimal XMLDefault.cnf.xml for Cisco Enterprise phones during initial TFTP boot."""
    h = html.escape(str(pbx_host or "127.0.0.1"))
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Default>\n"
        "  <callManagerGroup>\n"
        "    <members>\n"
        '      <member priority="0">\n'
        "        <callManager>\n"
        "          <ports>\n"
        "            <ethernetPhonePort>2000</ethernetPhonePort>\n"
        f"            <sipPort>{sip_port}</sipPort>\n"
        "            <securedSipPort>5061</securedSipPort>\n"
        "          </ports>\n"
        f"          <processNodeName>{h}</processNodeName>\n"
        "        </callManager>\n"
        "      </member>\n"
        "    </members>\n"
        "  </callManagerGroup>\n"
        "</Default>\n"
    )


def generate_provisioning_config(
    ext: str,
    sip_username: str,
    sip_password: str,
    full_name: str,
    pbx_host: str,
    brand: str = "Yealink",
    model: str = "T46U",
    mac_colon: str = "",
    transport: str = "UDP",
    dss_keys: Optional[List[Dict[str, Any]]] = None,
    soft_keys: Optional[List[Dict[str, Any]]] = None,
    pickup_group: str = "*8",
    pickup_directed: str = "**",
    template_obj: Optional[Dict[str, Any]] = None,
    requested_filename: str = "",
    codecs: Optional[List[str]] = None,
    dtmf_mode: str = "rfc4733",
    language: str = "Turkish",
    timezone: str = "+3",
    ntp_server: str = "pool.ntp.org",
    auto_answer: bool = False,
    direct_ip_call_block: bool = True,
    phonebooks: Optional[List[Dict[str, Any]]] = None,
    phonebook_base_url: str = "",
    connection_mode: str = "lan",
    provision_server_url: str = "",
    failover_pbx_host: str = "",
    expansion_modules: Optional[List[Dict[str, Any]]] = None,
    phone_prefs: Optional[Dict[str, Any]] = None,
    ext_name_map: Optional[Dict[str, str]] = None,
    live_sync_state: Optional[Dict[str, Any]] = None,
    phone_sync_base_url: str = "",
    fwd_codes: Optional[Dict[str, str]] = None,
    firmware_directive: Optional[Dict[str, Any]] = None,
    sip_driver: str = "pjsip",
) -> Tuple[str, str, str]:
    """
    Generates multi-vendor provisioning content using `sip_username` (Kullanıcı > SIP > Kullanıcı Adı)
    as the SIP Register & Auth Username so it authenticates directly against `[<sip_username>]` in Asterisk PJSIP
    (port 5060) or Asterisk chan_sip / Cisco UseCallManager (port 5160).
    Supports dynamic PBX subscriber name resolution (`label_mode == 'auto'`), daisy-chained expansion modules (1..4),
    and rich user-facing phone preferences (ringtone, screen brightness, time format, call waiting, headset, LEDs).
    Returns (content_text, media_type, suggested_filename).
    """
    ext_s = str(ext or "").strip()
    sip_u = str(sip_username or "").strip() or resolve_user_sip_username(ext_s, "")
    disp_name = str(full_name or f"Dahili {ext_s}").strip()
    prefs = normalize_phone_prefs(phone_prefs, fallback_lang=language, fallback_auto_answer=auto_answer)
    custom_screen_label = str(prefs.get("screen_label") or "").strip()
    line_label = custom_screen_label or (ext_s if ext_s else disp_name)
    mac_norm, mac_hex = normalize_mac_address(mac_colon)
    tr_up = str(transport or "UDP").strip().upper()
    drv_low = str(sip_driver or "pjsip").strip().lower()
    is_chan_sip = drv_low in ("chan_sip", "sip", "cisco_sip")
    sip_port = 5160 if is_chan_sip else (5061 if tr_up == "TLS" else 5060)
    pb_base = str(phonebook_base_url or f"http://{pbx_host}:8000/api/phonebook").rstrip("/")
    pb_list = [p for p in (phonebooks or []) if isinstance(p, dict) and p.get("id") and p.get("name")]

    model_spec = resolve_phone_model_spec(brand, model)
    max_dss_for_model = max(2, int(model_spec.get("max_dss") or 6))
    t1_default_lbl = ext_s if ext_s else "Hat 1"
    dss_list = enforce_primary_line_key(
        resolve_dynamic_key_labels(dss_keys if isinstance(dss_keys, list) else [], ext_name_map),
        ext=ext_s,
        default_label=t1_default_lbl,
    )
    # Trim any overflow beyond this model's physical/paged capacity & pad T2..max_dss cleanly as empty (Boş)
    dss_by_idx = {int(k.get("key_index") or 0): k for k in dss_list if isinstance(k, dict) and 1 <= int(k.get("key_index") or 0) <= max_dss_for_model}
    dss_list = [
        dss_by_idx[i] if i in dss_by_idx else {"key_index": i, "type": "none", "label": "", "label_mode": "auto", "value": "", "pickup_code": "*8"}
        for i in range(1, max_dss_for_model + 1)
    ]

    raw_soft = soft_keys if isinstance(soft_keys, list) and len(soft_keys) > 0 else build_default_soft_keys()
    soft_list = [
        {
            "key_index": int(sk.get("key_index") or sk.get("key") or (idx + 1)),
            "type": str(sk.get("type") or "history"),
            "label": str(sk.get("label") or ""),
            "value": str(sk.get("value") or ""),
        }
        for idx, sk in enumerate(raw_soft)
        if isinstance(sk, dict)
    ]
    exp_list_raw = normalize_expansion_modules(expansion_modules)
    exp_list: List[Dict[str, Any]] = []
    for mod in exp_list_raw:
        mod_copy = dict(mod)
        mod_copy["keys"] = resolve_dynamic_key_labels(mod.get("keys") or [], ext_name_map)
        exp_list.append(mod_copy)

    # Effective language & auto-answer from phone_prefs
    eff_language = str(prefs.get("language") or language or "Turkish").strip() or "Turkish"
    eff_auto_answer = bool(prefs.get("auto_answer", auto_answer))

    # Build vendor bi-directional DND & Call Forwarding sync config blocks (Yealink, Grandstream, Fanvil)
    from backend.services.deskphone_sync_service import (
        build_yealink_sync_cfg_lines,
        build_grandstream_sync_xml_lines,
        format_grandstream_live_lcd_label,
        build_fanvil_sync_sip_lines,
        build_fanvil_sync_phone_lines,
    )
    eff_live_sync = dict(live_sync_state) if isinstance(live_sync_state, dict) else {}
    if not eff_live_sync and prefs.get("dnd_default"):
        eff_live_sync["dnd_enabled"] = True
    eff_live_arg = eff_live_sync if eff_live_sync else None

    yealink_sync_lines = build_yealink_sync_cfg_lines(
        ext=ext_s,
        sip_username=sip_u,
        live_state=eff_live_arg,
        sync_base_url=phone_sync_base_url,
        fwd_codes=fwd_codes,
    )
    yealink_sync_block = "\n".join(yealink_sync_lines)

    grandstream_sync_lines = build_grandstream_sync_xml_lines(
        ext=ext_s,
        sip_username=sip_u,
        live_state=eff_live_arg,
        sync_base_url=phone_sync_base_url,
        fwd_codes=fwd_codes,
    )
    grandstream_sync_block = "\n".join(grandstream_sync_lines)
    gs_live_label = format_grandstream_live_lcd_label(line_label, eff_live_arg)

    fanvil_sip_sync_lines = build_fanvil_sync_sip_lines(
        live_state=eff_live_arg,
        fwd_codes=fwd_codes,
    )
    fanvil_sip_sync_block = "\n".join(fanvil_sip_sync_lines)
    fanvil_phone_sync_lines = build_fanvil_sync_phone_lines(
        ext=ext_s,
        sip_username=sip_u,
        live_state=eff_live_arg,
        sync_base_url=phone_sync_base_url,
    )
    fanvil_phone_sync_block = "\n".join(fanvil_phone_sync_lines)

    fw_dir = firmware_directive if isinstance(firmware_directive, dict) else {}
    fw_yealink_lines = list(fw_dir.get("yealink_lines") or [])
    fw_grandstream_lines = list(fw_dir.get("grandstream_lines") or [])
    fw_fanvil_lines = list(fw_dir.get("fanvil_lines") or [])
    fw_cisco_lines = list(fw_dir.get("cisco_lines") or [])

    # 1. If a custom/system XML/CFG template is explicitly assigned, interpolate ALL variables + live DSS/Expansion/Softkey blocks
    # Guard: Cisco Enterprise phones (SEP<MAC>.cnf.xml: 3905/78xx/79xx/88xx/89xx) CANNOT parse SPA/MPP <flat-profile>
    # templates and should use the native Enterprise <device><sipProfile> generator (unless a custom <device> template is assigned).
    _req_fn_low_g = str(requested_filename or "").strip().lower()
    _brand_low_g = str(brand or "").strip().lower()
    _model_low_g = str(model or "").strip().lower()
    _is_cisco_ent_req = (
        (_req_fn_low_g.startswith("sep") and _req_fn_low_g.endswith(".cnf.xml"))
        or (
            "cisco" in _brand_low_g
            and not any(tok in _model_low_g for tok in ("mpp", "3pcc", "spa"))
            and (is_chan_sip or not _req_fn_low_g.startswith("spa"))
        )
    )
    _tpl_raw_preview = str(template_obj.get("xml_content") or "").strip() if isinstance(template_obj, dict) else ""
    _skip_tpl_for_cisco_ent = bool(
        isinstance(template_obj, dict)
        and _is_cisco_ent_req
        and (
            "<flat-profile" in _tpl_raw_preview.lower()
            or bool(template_obj.get("is_system"))
            or str(template_obj.get("id") or "").startswith("sys-")
        )
    )
    if isinstance(template_obj, dict) and _tpl_raw_preview and not _skip_tpl_for_cisco_ent:
        raw_tpl = str(template_obj.get("xml_content") or "")
        tpl_b_low = str(template_obj.get("brand") or brand or "Yealink").strip().lower()

        # Build vendor-specific dynamic key blocks for template placeholders
        dss_block_lines: List[str] = []
        exp_block_lines: List[str] = []
        soft_block_lines: List[str] = []
        if "grandstream" in tpl_b_low:
            # Grandstream GRP26xx / GXP21xx Official Fixed VPK Mode (verified from grp26xx template):
            # -1=None, 0=SpeedDial, 1=BLF, 5=DialDTMF, 6=VoiceMail, 8=Transfer, 9=CallPark,
            # 10=Intercom, 12=Conference, 21=Forward, 22=DND, 31=Default/Line, 32=SharedLine
            gs_m = {
                "none": "-1",
                "line": "31",
                "speed_dial": "0",
                "blf": "1",
                "dtmf": "5",
                "voicemail": "6",
                "transfer": "8",
                "park": "9",
                "intercom": "10",
                "conference": "12",
                "forward": "21",
                "dnd": "22",
                "pickup": "0",
                "hold": "0",
            }
            for i0, k in enumerate(dss_list[:48]):
                k_idx0 = max(0, int(k.get("key_index") or (i0 + 1)) - 1)
                kt = str(k.get("type") or "none").strip().lower()
                mc = gs_m.get(kt, "0")
                raw_kl = str(k.get("label") or "").strip()
                if k_idx0 == 0 and kt == "line" and gs_live_label and (not raw_kl or raw_kl == line_label or raw_kl == ext_s):
                    raw_kl = gs_live_label
                kl = html.escape(raw_kl)
                kv = html.escape(
                    str(
                        k.get("value")
                        or ("*97" if kt == "voicemail" else (pickup_group if kt == "pickup" else ("*78" if kt == "dnd" else "")))
                    )
                )
                if k_idx0 < 6:
                    # Fixed VPK 1..6: Mode=P1363+2i, Account=P1364+2i, Desc=P1465+2i, Val=P1466+2i
                    if kt == "none":
                        dss_block_lines.extend([
                            f"    <P{1363 + k_idx0 * 2}>-1</P{1363 + k_idx0 * 2}>",
                            f"    <P{1465 + k_idx0 * 2}></P{1465 + k_idx0 * 2}>",
                            f"    <P{1466 + k_idx0 * 2}></P{1466 + k_idx0 * 2}>",
                        ])
                    else:
                        dss_block_lines.extend([
                            f"    <P{1363 + k_idx0 * 2}>{mc}</P{1363 + k_idx0 * 2}>",
                            f"    <P{1364 + k_idx0 * 2}>0</P{1364 + k_idx0 * 2}>",
                            f"    <P{1465 + k_idx0 * 2}>{kl}</P{1465 + k_idx0 * 2}>",
                            f"    <P{1466 + k_idx0 * 2}>{kv}</P{1466 + k_idx0 * 2}>",
                        ])
                else:
                    # VPK 7..48: sequential starting at P23800 in groups of 4 (Mode, Account, Desc, Val)
                    off = k_idx0 - 6
                    base_p = 23800 + (off * 4)
                    if kt == "none":
                        dss_block_lines.append(f"    <P{base_p}>-1</P{base_p}>")
                    else:
                        dss_block_lines.extend([
                            f"    <P{base_p}>{mc}</P{base_p}>",
                            f"    <P{base_p + 1}>0</P{base_p + 1}>",
                            f"    <P{base_p + 2}>{kl}</P{base_p + 2}>",
                            f"    <P{base_p + 3}>{kv}</P{base_p + 3}>",
                        ])
            for mod in exp_list[:4]:
                mi = int(mod.get("module_index") or 1)
                mb = 23000 + ((mi - 1) * 400)
                for ek in (mod.get("keys") or [])[:40]:
                    et = str(ek.get("type") or "none").strip().lower()
                    if et == "none":
                        continue
                    pb = mb + ((max(1, int(ek.get("key_index") or 1)) - 1) * 4)
                    exp_block_lines.extend([
                        f"    <P{pb}>{gs_m.get(et, '1')}</P{pb}>",
                        f"    <P{pb + 1}>0</P{pb + 1}>",
                        f"    <P{pb + 2}>{html.escape(str(ek.get('label') or ''))}</P{pb + 2}>",
                        f"    <P{pb + 3}>{html.escape(str(ek.get('value') or ''))}</P{pb + 3}>",
                    ])
            soft_block_lines.extend(
                _build_grandstream_softkeys_xml_lines(
                    soft_list,
                    model_name=str(template_obj.get("model") or model or ""),
                    pickup_group=pickup_group,
                )
            )
        elif "fanvil" in tpl_b_low:
            for k in dss_list:
                idx = int(k.get("key_index") or 1)
                kt = str(k.get("type") or "none")
                kl = str(k.get("label") or "")
                kv = str(k.get("value") or "")
                pu = str(k.get("pickup_code") or pickup_directed)
                if kt == "line":
                    dss_block_lines.extend([f"Dsskey{idx} Type         :2", f"Dsskey{idx} Line         :1", f"Dsskey{idx} Title        :{kl or line_label}"])
                elif kt == "blf" and kv:
                    dss_block_lines.extend([f"Dsskey{idx} Type         :1", f"Dsskey{idx} Line         :1", f"Dsskey{idx} Value        :{kv}@1/ba{pu}{kv}", f"Dsskey{idx} Title        :{kl}"])
                elif kt in ("speed_dial", "voicemail", "park", "forward") and (kv or kt == "voicemail"):
                    dss_block_lines.extend([f"Dsskey{idx} Type         :1", f"Dsskey{idx} Line         :1", f"Dsskey{idx} Value        :{kv or '*97'}@1/f", f"Dsskey{idx} Title        :{kl}"])
            for mod in exp_list[:4]:
                mi = int(mod.get("module_index") or 1)
                for ek in (mod.get("keys") or [])[:40]:
                    ei = int(ek.get("key_index") or 1)
                    et = str(ek.get("type") or "none")
                    ev = str(ek.get("value") or "")
                    el = str(ek.get("label") or "")
                    ep = str(ek.get("pickup_code") or pickup_directed)
                    if et == "blf" and ev:
                        exp_block_lines.extend([f"Ext{mi}Key{ei} Type       :1", f"Ext{mi}Key{ei} Value      :{ev}@1/ba{ep}{ev}", f"Ext{mi}Key{ei} Title      :{el}"])
        elif "cisco" in tpl_b_low:
            for k in dss_list[:10]:
                idx = max(1, int(k.get("key_index") or 1))
                kt = str(k.get("type") or "none")
                kl = html.escape(str(k.get("label") or ""))
                kv = html.escape(str(k.get("value") or ""))
                if idx == 1 and kt == "line":
                    continue
                if kt == "blf" and kv:
                    dss_block_lines.append(f'  <Extended_Function_{idx}_ ua="na">fnc=blf+sd+cp;sub={kv}@$PROXY;ext={kv}@$PROXY;nme={kl}</Extended_Function_{idx}_>')
                elif kt in ("speed_dial", "park", "voicemail") and (kv or kt == "voicemail"):
                    dss_block_lines.append(f'  <Extended_Function_{idx}_ ua="na">fnc=sd;ext={kv or "*97"}@$PROXY;nme={kl}</Extended_Function_{idx}_>')
            for mod in exp_list[:3]:
                mi = int(mod.get("module_index") or 1)
                for ek in (mod.get("keys") or [])[:36]:
                    ei = max(1, int(ek.get("key_index") or 1))
                    et = str(ek.get("type") or "none")
                    ev = html.escape(str(ek.get("value") or ""))
                    el = html.escape(str(ek.get("label") or ""))
                    if et == "blf" and ev:
                        exp_block_lines.append(f'  <Unit_{mi}_Key_{ei} ua="na">fnc=blf+sd+cp;sub={ev}@$PROXY;ext={ev}@$PROXY;nme={el}</Unit_{mi}_Key_{ei}>')
        else:
            yl_tm = {"none": 0, "conference": 1, "forward": 2, "transfer": 3, "hold": 4, "dnd": 5, "pickup": 23, "park": 10, "dtmf": 11, "speed_dial": 13, "intercom": 14, "line": 15, "blf": 16, "voicemail": 13}
            for k in dss_list:
                idx = int(k.get("key_index") or 1)
                kt = str(k.get("type") or "none")
                kl = str(k.get("label") or "")
                kv = str(k.get("value") or ("*97" if kt == "voicemail" else (pickup_group if kt == "pickup" else "")))
                pu = str(k.get("pickup_code") or pickup_directed)
                dss_block_lines.extend([f"linekey.{idx}.type = {yl_tm.get(kt, 0)}", f"linekey.{idx}.line = 1", f"linekey.{idx}.value = {kv}", f"linekey.{idx}.label = {kl}"])
                if kt == "blf":
                    dss_block_lines.append(f"linekey.{idx}.extension = {pu}")
            for mod in exp_list[:4]:
                mi = int(mod.get("module_index") or 1)
                for ek in (mod.get("keys") or [])[:60]:
                    ei = int(ek.get("key_index") or 1)
                    et = str(ek.get("type") or "none")
                    el = str(ek.get("label") or "")
                    ev = str(ek.get("value") or "")
                    ep = str(ek.get("pickup_code") or pickup_directed)
                    exp_block_lines.extend([
                        f"expansion_module.{mi}.key.{ei}.type = {yl_tm.get(et, 0)}",
                        f"expansion_module.{mi}.key.{ei}.line = 1",
                        f"expansion_module.{mi}.key.{ei}.value = {ev}",
                        f"expansion_module.{mi}.key.{ei}.label = {el}",
                    ])
                    if et == "blf":
                        exp_block_lines.append(f"expansion_module.{mi}.key.{ei}.extension = {ep}")
            yl_sm = {"history": 28, "directory": 22, "dnd": 5, "transfer": 3, "forward": 2, "speed_dial": 13, "redial": 27, "voicemail": 13, "pickup": 23, "menu": 30}
            for sk in soft_list:
                si = int(sk.get("key_index") or 1)
                st = str(sk.get("type") or "history")
                soft_block_lines.extend([
                    f"programablekey.{si}.type = {yl_sm.get(st, 0)}",
                    f"programablekey.{si}.line = 1",
                    f"programablekey.{si}.value = {str(sk.get('value') or '')}",
                    f"programablekey.{si}.label = {str(sk.get('label') or '')}",
                ])

        pb_full_url = f"{pb_base}/{ext_s or 'all'}/{'fanvil.xml' if 'fanvil' in tpl_b_low else 'yealink.xml'}"
        tr_code = "2" if tr_up == "TLS" else ("1" if tr_up == "TCP" else "0")
        replacements = {
            "{MAC}": mac_hex,
            "{MAC_UPPER}": mac_hex.upper(),
            "{MAC_COLON}": mac_norm,
            "{EXTENSION}": ext_s,
            "{SIP_USERNAME}": sip_u,
            "{USERNAME}": sip_u,
            "{AUTH_NAME}": sip_u,
            "{SIP_PASSWORD}": sip_password,
            "{PASSWORD}": sip_password,
            "{DISPLAY_NAME}": disp_name,
            "{FULL_NAME}": disp_name,
            "{LABEL}": html.escape(gs_live_label) if "grandstream" in tpl_b_low else line_label,
            "{SIP_SERVER}": pbx_host,
            "{PBX_HOST}": pbx_host,
            "{SIP_PORT}": str(sip_port),
            "{TRANSPORT}": tr_up,
            "{TRANSPORT_CODE}": tr_code,
            "{VOICEMAIL_CODE}": "*97",
            "{PICKUP_GROUP}": pickup_group,
            "{PICKUP_DIRECTED}": pickup_directed,
            "{PROVISION_URL}": provision_server_url,
            "{PROVISION_URL_NO_SCHEME}": provision_server_url.replace("http://", "").replace("https://", ""),
            "{PROVISION_PROTO_CODE}": "2" if str(provision_server_url or "").lower().startswith("https://") else "1",
            "{PHONEBOOK_URL}": pb_full_url,
            "{PHONEBOOK_URL_NO_SCHEME}": pb_full_url.replace("http://", "").replace("https://", ""),
            "{RINGTONE}": prefs["ringtone"],
            "{BACKLIGHT_ACTIVE}": str(prefs["backlight_active"]),
            "{BACKLIGHT_ACTIVE_PCT}": str(max(10, min(100, prefs["backlight_active"] * 10))),
            "{LANGUAGE}": eff_language,
            "{GS_LANGUAGE_CODE}": _resolve_grandstream_lang_code(eff_language),
            "{TIMEZONE}": str(timezone or "+3").strip() or "+3",
            "{TIMEZONE_NAME}": "Turkey(Ankara)" if str(timezone or "+3").strip() in ("+3", "Europe/Istanbul") else str(timezone or "+3"),
            "{FANVIL_TZ_INDEX}": _resolve_fanvil_timezone(timezone)[0],
            "{FANVIL_TZ_NAME}": _resolve_fanvil_timezone(timezone)[1],
            "{NTP_SERVER}": str(ntp_server or "pool.ntp.org").strip() or "pool.ntp.org",
            "{TIME_FORMAT_24_BIT}": "1" if prefs["time_format"] == "24" else "0",
            "{DSS_KEYS_BLOCK}": "\n".join(dss_block_lines),
            "{EXPANSION_MODULES_BLOCK}": "\n".join(exp_block_lines),
            "{SOFTKEYS_BLOCK}": "\n".join(soft_block_lines),
            "{SYNC_FEATURE_BLOCK}": (
                yealink_sync_block
                if "yealink" in tpl_b_low
                else (grandstream_sync_block if "grandstream" in tpl_b_low else "")
            ),
            "{FANVIL_SIP_SYNC_BLOCK}": fanvil_sip_sync_block if "fanvil" in tpl_b_low else "",
            "{FANVIL_PHONE_SYNC_BLOCK}": fanvil_phone_sync_block if "fanvil" in tpl_b_low else "",
        }
        rendered = raw_tpl
        for k, v in replacements.items():
            rendered = rendered.replace(k, str(v))
        if "yealink" in tpl_b_low:
            if "{SYNC_FEATURE_BLOCK}" not in raw_tpl:
                rendered = rendered.replace("sip.notify_reboot_enable = 1", "sip.notify_reboot_enable = 0")
                rendered = rendered.rstrip() + "\n" + yealink_sync_block + "\n"
            if fw_yealink_lines:
                rendered = re.sub(r"(?m)^\s*static\.firmware\.url\s*=.*$", "", rendered)
                rendered = rendered.rstrip() + "\n\n" + "\n".join(fw_yealink_lines) + "\n"
        elif "grandstream" in tpl_b_low:
            # Always enforce Authenticate Conf File = No (P240=0) & Disable SIP NOTIFY Auth = Yes (P4428=1)
            # even on user-copied/custom Grandstream templates so XML updates & remote Check-Sync/Reboot never lock out.
            rendered = re.sub(r"<P240>\s*1\s*</P240>", "<P240>0</P240>", rendered)
            if fw_grandstream_lines:
                rendered = re.sub(r"\s*<P192>.*?</P192>", "", rendered)
                rendered = re.sub(r"\s*<P238>.*?</P238>", "", rendered)
            if "</config>" in rendered:
                inject_gs = []
                if "<P240>" not in rendered:
                    inject_gs.append("    <P240>0</P240>")
                if "<P4428>" not in rendered:
                    inject_gs.append("    <P4428>1</P4428>")
                if "<P1362>" not in rendered:
                    inject_gs.append(f"    <P1362>{_resolve_grandstream_lang_code(eff_language)}</P1362>")
                if "{SYNC_FEATURE_BLOCK}" not in raw_tpl:
                    inject_gs.append(grandstream_sync_block)
                if "{SOFTKEYS_BLOCK}" not in raw_tpl and soft_block_lines:
                    inject_gs.append("\n".join(soft_block_lines))
                if fw_grandstream_lines:
                    inject_gs.append("\n".join(fw_grandstream_lines))
                if inject_gs:
                    rendered = rendered.replace("</config>", "\n".join(inject_gs) + "\n  </config>", 1)
        elif "fanvil" in tpl_b_low:
            if "{FANVIL_SIP_SYNC_BLOCK}" not in raw_tpl and "<SIP CONFIG MODULE>" in rendered:
                if "<PHONE CONFIG MODULE>" in rendered:
                    rendered = rendered.replace("<PHONE CONFIG MODULE>", fanvil_sip_sync_block + "\n\n<PHONE CONFIG MODULE>", 1)
            if "{FANVIL_PHONE_SYNC_BLOCK}" not in raw_tpl and "<PHONE CONFIG MODULE>" in rendered:
                if "<DSSKEY CONFIG MODULE>" in rendered:
                    rendered = rendered.replace("<DSSKEY CONFIG MODULE>", fanvil_phone_sync_block + "\n\n<DSSKEY CONFIG MODULE>", 1)
            if fw_fanvil_lines and "<SIP CONFIG MODULE>" in rendered:
                rendered = rendered.replace("<SIP CONFIG MODULE>", "\n".join(fw_fanvil_lines) + "\n\n<SIP CONFIG MODULE>", 1)
        elif "cisco" in tpl_b_low and fw_cisco_lines and "</flat-profile>" in rendered:
            rendered = rendered.replace("</flat-profile>", "\n".join(fw_cisco_lines) + "\n</flat-profile>", 1)
        is_xml = rendered.lstrip().startswith("<") and not rendered.lstrip().startswith("<<VOIP CONFIG FILE>>")
        ext_suffix = "xml" if is_xml else "cfg"
        fname = f"{mac_hex or ('ext_' + ext_s)}.{ext_suffix}"
        return rendered, ("application/xml; charset=utf-8" if is_xml else "text/plain; charset=utf-8"), fname

    b_low = str(brand or "Yealink").strip().lower()
    fn_low = str(requested_filename or "").strip().lower()
    if fn_low.startswith("cfg") and fn_low.endswith(".xml"):
        b_low = "grandstream"
    elif fn_low.startswith("spa") and fn_low.endswith(".xml"):
        b_low = "cisco"

    # --- GRANDSTREAM XML (GRP26xx / GXP16xx / GXP21xx + GBX20 / GXP2200EXT 1..4) ---
    if "grandstream" in b_low:
        gs_tr = "2" if tr_up == "TLS" else ("1" if tr_up == "TCP" else "0")
        gs_mpk_lines: List[str] = []
        # Grandstream GRP26xx / GXP21xx Official Fixed VPK Mode (verified from grp26xx template):
        # -1=None, 0=SpeedDial, 1=BLF, 5=DialDTMF, 6=VoiceMail, 8=Transfer, 9=CallPark,
        # 10=Intercom, 12=Conference, 21=Forward, 22=DND, 31=Default/Line, 32=SharedLine
        gs_mode_map = {
            "none": "-1",
            "line": "31",
            "speed_dial": "0",
            "blf": "1",
            "dtmf": "5",
            "voicemail": "6",
            "transfer": "8",
            "park": "9",
            "intercom": "10",
            "conference": "12",
            "forward": "21",
            "dnd": "22",
            "pickup": "0",
            "hold": "0",
        }
        for idx_zero, k in enumerate(dss_list[:48]):
            k_idx0 = max(0, int(k.get("key_index") or (idx_zero + 1)) - 1)
            ktype = str(k.get("type") or "none").strip().lower()
            mode_code = gs_mode_map.get(ktype, "0")
            raw_klbl = str(k.get("label") or "").strip()
            if k_idx0 == 0 and ktype == "line" and gs_live_label and (not raw_klbl or raw_klbl == line_label or raw_klbl == ext_s):
                raw_klbl = gs_live_label
            klbl = html.escape(raw_klbl)
            kval = html.escape(
                str(
                    k.get("value")
                    or ("*97" if ktype == "voicemail" else (pickup_group if ktype == "pickup" else ("*78" if ktype == "dnd" else "")))
                )
            )
            if k_idx0 < 6:
                # Fixed VPK 1..6
                p_mode = 1363 + (k_idx0 * 2)
                p_acct = 1364 + (k_idx0 * 2)
                p_desc = 1465 + (k_idx0 * 2)
                p_val = 1466 + (k_idx0 * 2)
                if ktype == "none":
                    gs_mpk_lines.append(f"    <P{p_mode}>-1</P{p_mode}>")
                    gs_mpk_lines.append(f"    <P{p_desc}></P{p_desc}>")
                    gs_mpk_lines.append(f"    <P{p_val}></P{p_val}>")
                else:
                    gs_mpk_lines.append(f"    <P{p_mode}>{mode_code}</P{p_mode}>")
                    gs_mpk_lines.append(f"    <P{p_acct}>0</P{p_acct}>")
                    gs_mpk_lines.append(f"    <P{p_desc}>{klbl}</P{p_desc}>")
                    gs_mpk_lines.append(f"    <P{p_val}>{kval}</P{p_val}>")
            else:
                # Extended VPK 7..48 (P23800+ series)
                off = k_idx0 - 6
                base_p = 23800 + (off * 4)
                if ktype == "none":
                    gs_mpk_lines.append(f"    <P{base_p}>-1</P{base_p}>")
                else:
                    gs_mpk_lines.append(f"    <P{base_p}>{mode_code}</P{base_p}>")
                    gs_mpk_lines.append(f"    <P{base_p + 1}>0</P{base_p + 1}>")
                    gs_mpk_lines.append(f"    <P{base_p + 2}>{klbl}</P{base_p + 2}>")
                    gs_mpk_lines.append(f"    <P{base_p + 3}>{kval}</P{base_p + 3}>")

        # Daisy-chained Grandstream GBX20 / GXP2200EXT Expansion Modules (1..4, 40 keys each)
        # Module 1: P23000 block -> standard Grandstream EXT bases: Board 1=23000, Board 2=23400, Board 3=23800, Board 4=24200
        gs_ext_lines: List[str] = []
        for mod in exp_list[:4]:
            m_idx = int(mod.get("module_index") or 1)
            m_model = html.escape(str(mod.get("model") or "GBX20"))
            gs_ext_lines.append(f"    <!-- Expansion Module #{m_idx} ({m_model}) -->")
            mod_base = 23000 + ((m_idx - 1) * 400)
            for ek in (mod.get("keys") or [])[:40]:
                ek_type = str(ek.get("type") or "none")
                if ek_type == "none":
                    continue
                k_i = max(1, int(ek.get("key_index") or 1)) - 1
                p_b = mod_base + (k_i * 4)
                ek_mode = gs_mode_map.get(ek_type, "2")
                ek_lbl = html.escape(str(ek.get("label") or ""))
                ek_val = html.escape(str(ek.get("value") or ""))
                gs_ext_lines.append(f"    <P{p_b}>{ek_mode}</P{p_b}>")
                gs_ext_lines.append(f"    <P{p_b + 1}>0</P{p_b + 1}>")
                gs_ext_lines.append(f"    <P{p_b + 2}>{ek_lbl}</P{p_b + 2}>")
                gs_ext_lines.append(f"    <P{p_b + 3}>{ek_val}</P{p_b + 3}>")

        gs_soft_lines = _build_grandstream_softkeys_xml_lines(soft_list, model_name=model, pickup_group=pickup_group)
        mpk_block = "\n".join(gs_mpk_lines + gs_ext_lines + gs_soft_lines + fw_grandstream_lines)
        gs_prov_url = html.escape(provision_server_url.replace("http://", "").replace("https://", "")) if provision_server_url else ""
        gs_prov_proto = "2" if provision_server_url.startswith("https://") else "1"
        gs_time_fmt = "1" if prefs["time_format"] == "24" else "0"
        gs_cw = "0" if prefs["call_waiting"] else "1"  # Grandstream P91: 0=Enable CW, 1=Disable CW
        gs_aa = "1" if eff_auto_answer else "0"
        gs_bl_active = str(max(10, min(100, prefs["backlight_active"] * 10)))
        gs_bl_idle = str(max(0, min(100, prefs["backlight_inactive"] * 10)))
        gs_lang_code = _resolve_grandstream_lang_code(eff_language)
        gs_prov_lines = (
            f"    <P212>{gs_prov_proto}</P212>\n    <P237>{gs_prov_url}</P237>\n    <P194>1</P194>\n    <P240>0</P240>\n    <P4428>1</P4428>\n    <P95030>0</P95030>\n    <P22421>0</P22421>\n    <P6752>1</P6752>\n"
            if gs_prov_url
            else "    <P194>1</P194>\n    <P240>0</P240>\n    <P4428>1</P4428>\n    <P95030>0</P95030>\n    <P22421>0</P22421>\n    <P6752>1</P6752>\n"
        )
        xml_out = f"""<?xml version="1.0" encoding="UTF-8" ?>
<!-- AIDA PBX Grandstream Auto-Provisioning ({html.escape(model)}) | Ext: {html.escape(ext_s)} | SIP Endpoint: {html.escape(sip_u)} -->
<gs_provision version="1">
  <mac>{html.escape(mac_hex)}</mac>
  <config version="1">
{gs_prov_lines}    <P271>1</P271>
    <P270>{html.escape(gs_live_label)}</P270>
    <P47>{html.escape(pbx_host)}:{sip_port}</P47>
    <P35>{html.escape(sip_u)}</P35>
    <P36>{html.escape(sip_u)}</P36>
    <P34>{html.escape(sip_password)}</P34>
    <P3>{html.escape(disp_name)}</P3>
    <P130>{gs_tr}</P130>
    <P52>2</P52>
    <P33>*97</P33>
    <P1347>{html.escape(pickup_directed)}</P1347>
    <P64>TZT-3</P64>
    <P30>{html.escape(ntp_server or 'pool.ntp.org')}</P30>
    <P122>{gs_time_fmt}</P122>
    <P91>{gs_cw}</P91>
    <P90>{gs_aa}</P90>
    <P1362>{gs_lang_code}</P1362>
    <P334>{gs_bl_active}</P334>
    <P335>{gs_bl_idle}</P335>
    <P1348>{1 if prefs['missed_call_led'] else 0}</P1348>
    <P330>1</P330>
    <P331>{html.escape(pb_base.replace('http://', '').replace('https://', ''))}/{html.escape(ext_s or 'all')}</P331>
    <P332>60</P332>
{grandstream_sync_block}
{mpk_block}
  </config>
</gs_provision>
"""
        fname = f"cfg{mac_hex}.xml" if mac_hex else f"cfg_ext_{ext_s}.xml"
        return xml_out, "application/xml; charset=utf-8", fname

    # --- FANVIL CFG (X3S / X3SP / X3U / X4U / X5U / X6U / X7 / X210 / V62 / V64 / V65 + External Modules 1..4) ---
    if "fanvil" in b_low:
        fv_tr = "2" if tr_up == "TLS" else ("1" if tr_up == "TCP" else "0")
        fv_tz_idx, fv_tz_name = _resolve_fanvil_timezone(timezone)
        fv_ntp = str(ntp_server or "pool.ntp.org").strip() or "pool.ntp.org"
        fv_lines = [
            "<<VOIP CONFIG FILE>>Version:2.0000",
            f"# AIDA PBX Fanvil Auto-Provisioning ({model}) | Ext: {ext_s} | SIP Endpoint: {sip_u}",
            "",
            "<GLOBAL CONFIG MODULE>",
            "Enable SNTP          :1",
            f"SNTP Server          :{fv_ntp}",
            "Second SNTP Server   :pool.ntp.org",
            "SNTP Timeout         :60",
            f"Time Zone            :{fv_tz_idx}",
            f"Time Zone Name       :{fv_tz_name}",
            "Enable DST           :0",
            "",
            "<AUTOUPDATE CONFIG MODULE>",
            f"Auto Server URL      :{provision_server_url}" if provision_server_url else "Auto Server URL      :",
            "Update Mode          :1",
            "SIP Notify Update    :1",
            *fw_fanvil_lines,
            "",
            "<SIP CONFIG MODULE>",
            "--SIP Line List--  :",
            "SIP1 Enable          :1",
            "SIP1 Enable Reg      :1",
            f"SIP1 Phone Number    :{sip_u}",
            f"SIP1 Display Name    :{line_label}",
            f"SIP1 Sip Name        :{disp_name}",
            f"SIP1 Register Addr   :{pbx_host}",
            f"SIP1 Register Port   :{sip_port}",
            f"SIP1 Register User   :{sip_u}",
            f"SIP1 Register Pswd   :{sip_password}",
            "SIP1 Register TTL    :300",
            f"SIP1 Transport       :{fv_tr}",
            "SIP1 Rport           :1",
            "SIP1 Keep Alive Type :1",
            "SIP1 Keep Alive Intvl:30",
            "SIP1 Subscribe Expire:1800",
            "SIP1 MWI Num         :*97",
            f"SIP1 Auto Answer     :{1 if eff_auto_answer else 0}",
            f"SIP1 Ring Type       :{prefs['ringtone']}",
            *fanvil_sip_sync_lines,
            "",
            "<PHONE CONFIG MODULE>",
            f"Call Waiting         :{1 if prefs['call_waiting'] else 0}",
            f"Call Waiting Tone    :{1 if prefs['call_waiting_tone'] else 0}",
            f"Intercom Mute        :{1 if prefs['intercom_mute'] else 0}",
            f"Time Display 24H     :{1 if prefs['time_format'] == '24' else 0}",
            f"Backlight Level      :{prefs['backlight_active']}",
            f"Backlight Idle       :{prefs['backlight_inactive']}",
            f"Backlight Timeout    :{prefs['backlight_timeout']}",
            f"Screensaver Timeout  :{prefs['screensaver_wait']}",
            f"Ring Volume          :{prefs['ring_volume']}",
            f"Handset Volume       :{prefs['handset_volume']}",
            f"Speaker Volume       :{prefs['speaker_volume']}",
            f"Headset Volume       :{prefs['headset_volume']}",
            f"Missed Call LED      :{1 if prefs['missed_call_led'] else 0}",
            f"MWI LED              :{1 if prefs['mwi_led'] else 0}",
            f"Language             :{eff_language}",
            *fanvil_phone_sync_lines,
            "",
            "<DSSKEY CONFIG MODULE>",
        ]
        # Fanvil DSS Type: 1=MemoryKey(BLF/SpeedDial/Intercom/Park), 2=Line, 3=KeyEvent(DND/Hold/Transfer/Conf/Pickup)
        for k in dss_list:
            idx = int(k.get("key_index") or 1)
            ktype = str(k.get("type") or "none")
            klbl = str(k.get("label") or "")
            kval = str(k.get("value") or "")
            pickup = str(k.get("pickup_code") or pickup_directed)
            if ktype == "line":
                fv_lines.append(f"Dsskey{idx} Type         :2")
                fv_lines.append(f"Dsskey{idx} Line         :1")
                fv_lines.append(f"Dsskey{idx} Title        :{klbl or line_label}")
            elif ktype == "blf" and kval:
                fv_lines.append(f"Dsskey{idx} Type         :1")
                fv_lines.append(f"Dsskey{idx} Line         :1")
                fv_lines.append(f"Dsskey{idx} Value        :{kval}@1/ba{pickup}{kval}")
                fv_lines.append(f"Dsskey{idx} Title        :{klbl}")
            elif ktype in ("speed_dial", "voicemail", "park", "forward", "dtmf") and (kval or ktype == "voicemail"):
                eff_v = kval or "*97"
                fv_lines.append(f"Dsskey{idx} Type         :1")
                fv_lines.append(f"Dsskey{idx} Line         :1")
                fv_lines.append(f"Dsskey{idx} Value        :{eff_v}@1/f")
                fv_lines.append(f"Dsskey{idx} Title        :{klbl}")
            elif ktype == "intercom" and kval:
                fv_lines.append(f"Dsskey{idx} Type         :1")
                fv_lines.append(f"Dsskey{idx} Line         :1")
                fv_lines.append(f"Dsskey{idx} Value        :{kval}@1/i")
                fv_lines.append(f"Dsskey{idx} Title        :{klbl}")
            elif ktype in ("dnd", "hold", "transfer", "conference", "pickup"):
                fv_ev_map = {"dnd": "F_DND", "hold": "F_HOLD", "transfer": "F_TRANSFER", "conference": "F_CONF", "pickup": "F_PICKUP"}
                fv_lines.append(f"Dsskey{idx} Type         :3")
                fv_lines.append(f"Dsskey{idx} Value        :{fv_ev_map.get(ktype, 'F_DND')}")
                fv_lines.append(f"Dsskey{idx} Title        :{klbl}")

        # Daisy-chained Fanvil Expansion Modules (Ext1..Ext4)
        for mod in exp_list[:4]:
            m_idx = int(mod.get("module_index") or 1)
            fv_lines.append(f"# --- Fanvil Genisletme Modulu #{m_idx} ({mod.get('model')}) ---")
            for ek in (mod.get("keys") or [])[:40]:
                ek_idx = int(ek.get("key_index") or 1)
                ek_type = str(ek.get("type") or "none")
                ek_lbl = str(ek.get("label") or "")
                ek_val = str(ek.get("value") or "")
                ek_pu = str(ek.get("pickup_code") or pickup_directed)
                if ek_type == "blf" and ek_val:
                    fv_lines.append(f"Ext{m_idx}Key{ek_idx} Type       :1")
                    fv_lines.append(f"Ext{m_idx}Key{ek_idx} Value      :{ek_val}@1/ba{ek_pu}{ek_val}")
                    fv_lines.append(f"Ext{m_idx}Key{ek_idx} Title      :{ek_lbl}")
                elif ek_type in ("speed_dial", "park", "intercom", "forward") and ek_val:
                    fv_lines.append(f"Ext{m_idx}Key{ek_idx} Type       :1")
                    fv_lines.append(f"Ext{m_idx}Key{ek_idx} Value      :{ek_val}@1/f")
                    fv_lines.append(f"Ext{m_idx}Key{ek_idx} Title      :{ek_lbl}")

        fv_lines.append("")
        fv_lines.append("<TELEPHONE BOOK MODULE>")
        if pb_list:
            for pb_idx, pb_item in enumerate(pb_list[:5], start=1):
                pb_id = str(pb_item.get("id"))
                pb_nm = str(pb_item.get("name") or f"Rehber {pb_idx}")
                fv_lines.append(f"Phonebook Cloud{pb_idx} Name :{pb_nm}")
                fv_lines.append(f"Phonebook Cloud{pb_idx} URL  :{pb_base}/{pb_id}/fanvil.xml")
        else:
            fv_lines.append("Phonebook Cloud1 Name :AIDA Telefon Rehberi")
            fv_lines.append(f"Phonebook Cloud1 URL  :{pb_base}/{ext_s or 'all'}/fanvil.xml")
        fv_lines.append("")
        fv_lines.append("<<END OF FILE>>")
        fname = f"{mac_hex}.cfg" if mac_hex else f"fanvil_{ext_s}.cfg"
        return "\n".join(fv_lines) + "\n", "text/plain; charset=utf-8", fname

    # --- CISCO ENTERPRISE (SEP<MAC>.cnf.xml: CP-7821/7841/7861/8811/8841/8851/79xx) & MPP/3PCC (spa<mac>.xml) ---
    if "cisco" in b_low:
        req_fn_low = str(requested_filename or "").strip().lower()
        model_low = str(model or "").strip().lower()
        is_cp3905 = ("3905" in model_low or "3911" in model_low)
        is_sep_enterprise = (
            (req_fn_low.startswith("sep") and req_fn_low.endswith(".cnf.xml"))
            or (
                not req_fn_low.startswith("spa")
                and "3pcc" not in model_low
                and "mpp" not in model_low
                and "spa" not in model_low
                and (
                    is_chan_sip
                    or int(sip_port or 5060) == 5160
                    or any(m in model_low for m in ("3905", "3911", "7811", "7821", "7841", "7861", "8811", "8841", "8845", "8851", "8861", "7940", "7941", "7942", "7945", "7960", "7961", "7962", "7965", "7975", "8941", "8945", "8961"))
                )
            )
        )

        if is_sep_enterprise:
            # Transport: 1=TCP, 2=UDP, 3=TLS.
            # On chan_sip (5160 UseCallManager), TCP (1) is standard for 78xx/79xx/88xx/89xx (BLF/Softkey/Conf).
            # CP-3905 defaults to UDP (2) on PJSIP (5060), and follows transport (TCP/UDP) on chan_sip (5160).
            if is_cp3905 and not is_chan_sip:
                cisco_tr_code = "2"
            elif is_chan_sip:
                cisco_tr_code = "2" if tr_up == "UDP" else "1"
            else:
                cisco_tr_code = "1" if tr_up == "TCP" else ("3" if tr_up == "TLS" else "2")
            # PJSIP (port 5060) uses direct host in <proxy>, whereas chan_sip (5160 cisco_usecallmanager) uses USECALLMANAGER
            cisco_line_proxy = "USECALLMANAGER" if (is_chan_sip or int(sip_port or 5060) == 5160) else html.escape(pbx_host)
            cisco_outbound_proxy = "" if (is_chan_sip or int(sip_port or 5060) == 5160) else html.escape(pbx_host)
            # WAN/Tunnel mode uses NAT traversal + keepalive
            is_wan_mode = str(connection_mode or "").strip().lower() == "wan"
            nat_flag = "true" if is_wan_mode else "false"
            sep_lines: List[str] = []
            if not is_cp3905:
                btn_idx = 2
                for k in dss_list[:10]:
                    ktype = str(k.get("type") or "none")
                    klbl = html.escape(str(k.get("label") or ""))
                    kval = html.escape(str(k.get("value") or ""))
                    if int(k.get("key_index") or 1) == 1 and ktype == "line":
                        continue
                    if ktype == "blf" and kval:
                        sep_lines.append(
                            f'      <line button="{btn_idx}">\n'
                            f'        <featureID>21</featureID>\n'
                            f'        <featureLabel>{klbl or kval}</featureLabel>\n'
                            f'        <speedDialNumber>{kval}</speedDialNumber>\n'
                            f'        <contact>{kval}</contact>\n'
                            f'        <featureOptionMask>1</featureOptionMask>\n'
                            f'      </line>'
                        )
                        btn_idx += 1
                    elif ktype in ("speed_dial", "park", "intercom", "voicemail", "forward") and (kval or ktype == "voicemail"):
                        eff_v = kval or "*97"
                        sep_lines.append(
                            f'      <line button="{btn_idx}">\n'
                            f'        <featureID>2</featureID>\n'
                            f'        <featureLabel>{klbl or eff_v}</featureLabel>\n'
                            f'        <speedDialNumber>{eff_v}</speedDialNumber>\n'
                            f'      </line>'
                        )
                        btn_idx += 1

            extra_lines_xml = "\n".join(sep_lines)
            mac_upper = mac_hex.upper() if mac_hex else f"{ext_s}"
            def _cisco_lcd_clean(raw_txt: str) -> str:
                s_val = str(raw_txt or "").strip()
                if not is_cp3905:
                    return s_val
                tr_map = str.maketrans("ıİğĞüÜşŞöÖçÇ", "iIgGuUsSoOcC")
                return s_val.translate(tr_map)

            _disp_lcd = _cisco_lcd_clean(disp_name)
            _custom_lcd = _cisco_lcd_clean(custom_screen_label)
            if _custom_lcd:
                cisco_phone_label = _custom_lcd
                cisco_feature_label = _custom_lcd
            elif ext_s and _disp_lcd and _disp_lcd != ext_s and not _disp_lcd.startswith(f"Dahili {ext_s}"):
                cisco_phone_label = f"{ext_s} {_disp_lcd}"[:24]
                cisco_feature_label = f"{ext_s} - {_disp_lcd}"[:24]
            else:
                cisco_phone_label = _disp_lcd or ext_s or sip_u
                cisco_feature_label = ext_s or _disp_lcd or sip_u
            # Show real extension (e.g. 1001) on screen via <name> while keeping cryptographic sip_u (XT6AoiKP) in <authName> & <contact>
            cisco_line_name = ext_s if (is_chan_sip and ext_s) else sip_u
            # Cisco CUCM / CP-3905 (incl. 9.2.1) strict <dateTimeSetting> rules:
            # 1) Exact CUCM timezone string for permanent UTC+3 (no DST) is 'Saudi Arabia Standard Time'
            #    ('Turkey Standard Time' and 'Arab Standard Time' are NOT in Cisco CUCM's built-in table -> fallback to UTC+0!).
            # 2) Do NOT include <olsonTimeZone> on CP-3905 9.2.1 (unknown XML tag causes parser to drop entire <dateTimeSetting> block!).
            # 3) <dateTemplate>D/M/Y</dateTemplate> is universally accepted 24-hour Day/Month/Year format.
            # 4) <ntp><name> should be a numeric IPv4 address (CP-3905 9.2.1 often ignores DNS hostnames in <ntp>).
            _tz_s = str(timezone or "+3").strip()
            _cisco_tz_map = {
                "+3": "Saudi Arabia Standard Time",
                "3": "Saudi Arabia Standard Time",
                "0": "GMT Standard/Daylight Time",
                "+0": "GMT Standard/Daylight Time",
                "+1": "Central Europe Standard/Daylight Time",
                "+2": "E. Europe Standard/Daylight Time",
                "+4": "Arabian Standard Time",
                "+5": "West Asia Standard Time",
                "+8": "China Standard Time",
                "+9": "Tokyo Standard Time",
                "-5": "Eastern Standard/Daylight Time",
                "-8": "Pacific Standard/Daylight Time",
            }
            cisco_tz_name = _cisco_tz_map.get(_tz_s, "Saudi Arabia Standard Time")
            cisco_date_tpl = "D/M/YA" if str(prefs.get("time_format") or "24") == "12" else "D/M/Y"
            _raw_ntp = str(ntp_server or "").strip()
            if re.match(r"^(?:\d{1,3}\.){3}\d{1,3}$", _raw_ntp):
                cisco_ntp_ip = _raw_ntp
            else:
                cisco_ntp_ip = "162.159.200.1"
                if _raw_ntp and _raw_ntp.lower() not in ("pool.ntp.org", "tr.pool.ntp.org"):
                    try:
                        import socket as _sock_ntp
                        _res_ip = _sock_ntp.gethostbyname(_raw_ntp)
                        if re.match(r"^(?:\d{1,3}\.){3}\d{1,3}$", _res_ip or ""):
                            cisco_ntp_ip = _res_ip
                    except Exception:
                        pass
            sep_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!-- Nornia PBX Cisco Enterprise Auto-Provisioning ({html.escape(model)}) | Ext: {html.escape(ext_s)} | Mode: {html.escape(str(connection_mode or 'lan').upper())} -->
<device>
  <deviceProtocol>SIP</deviceProtocol>
  <sshUserId>admin</sshUserId>
  <sshPassword>nornia7800</sshPassword>
  <devicePool>
    <dateTimeSetting>
      <dateTemplate>{cisco_date_tpl}</dateTemplate>
      <timeZone>{cisco_tz_name}</timeZone>
      <ntps>
        <ntp>
          <name>{html.escape(cisco_ntp_ip)}</name>
          <ntpMode>Unicast</ntpMode>
        </ntp>
      </ntps>
    </dateTimeSetting>
    <callManagerGroup>
      <members>
        <member priority="0">
          <callManager>
            <ports>
              <ethernetPhonePort>2000</ethernetPhonePort>
              <sipPort>{sip_port}</sipPort>
              <securedSipPort>5061</securedSipPort>
            </ports>
            <processNodeName>{html.escape(pbx_host)}</processNodeName>
          </callManager>
        </member>
      </members>
    </callManagerGroup>
  </devicePool>
  <sipProfile>
    <sipProxies>
      <backupProxy></backupProxy>
      <backupProxyPort>{sip_port}</backupProxyPort>
      <emergencyProxy></emergencyProxy>
      <emergencyProxyPort>{sip_port}</emergencyProxyPort>
      <outboundProxy>{cisco_outbound_proxy}</outboundProxy>
      <outboundProxyPort>{sip_port}</outboundProxyPort>
      <registerWithProxy>true</registerWithProxy>
    </sipProxies>
    <sipCallFeatures>
      <cnfJoinEnabled>true</cnfJoinEnabled>
      <callForwardURI>x-serviceuri-cfwdall</callForwardURI>
      <callPickupURI>x-cisco-serviceuri-pickup</callPickupURI>
      <callPickupListURI>x-cisco-serviceuri-opickup</callPickupListURI>
      <callPickupGroupURI>x-cisco-serviceuri-gpickup</callPickupGroupURI>
      <meetMeServiceURI>x-cisco-serviceuri-meetme</meetMeServiceURI>
      <abbreviatedDialURI>x-cisco-serviceuri-abbrdial</abbreviatedDialURI>
      <rfc2543Hold>false</rfc2543Hold>
      <callHoldRingback>2</callHoldRingback>
      <localCfwdEnable>true</localCfwdEnable>
      <semiAttendedTransfer>true</semiAttendedTransfer>
      <anonymousCallBlock>2</anonymousCallBlock>
      <callerIdBlocking>2</callerIdBlocking>
      <dndControl>0</dndControl>
      <remoteCcEnable>true</remoteCcEnable>
    </sipCallFeatures>
    <sipStack>
      <sipInviteRetx>6</sipInviteRetx>
      <sipRetx>10</sipRetx>
      <timerInviteExpires>180</timerInviteExpires>
      <timerRegisterExpires>120</timerRegisterExpires>
      <timerRegisterDelta>5</timerRegisterDelta>
      <timerKeepAliveExpires>60</timerKeepAliveExpires>
      <timerSubscribeExpires>120</timerSubscribeExpires>
      <timerSubscribeDelta>5</timerSubscribeDelta>
      <timerT1>500</timerT1>
      <timerT2>4000</timerT2>
      <maxRedirects>70</maxRedirects>
      <remotePartyID>true</remotePartyID>
      <userInfo>None</userInfo>
    </sipStack>
    <autoAnswerTimer>1</autoAnswerTimer>
    <autoAnswerAltBehavior>false</autoAnswerAltBehavior>
    <autoAnswerOverride>true</autoAnswerOverride>
    <transferOnhookEnabled>true</transferOnhookEnabled>
    <enableVad>false</enableVad>
    <preferredCodec>g711alaw</preferredCodec>
    <dtmfAvtPayload>101</dtmfAvtPayload>
    <dtmfDbLevel>3</dtmfDbLevel>
    <dtmfOutofBand>avt</dtmfOutofBand>
    <alwaysUsePrimeLine>false</alwaysUsePrimeLine>
    <alwaysUsePrimeLineVoiceMail>false</alwaysUsePrimeLineVoiceMail>
    <kpml>3</kpml>
    <phoneLabel>{html.escape(cisco_phone_label)}</phoneLabel>
    <stutterMsgWaiting>1</stutterMsgWaiting>
    <callStats>false</callStats>
    <silentPeriodBetweenCallWaitingBursts>10</silentPeriodBetweenCallWaitingBursts>
    <disableLocalSpeedDialConfig>false</disableLocalSpeedDialConfig>
    <natEnabled>{nat_flag}</natEnabled>
    <natReceivedProcessing>true</natReceivedProcessing>
    <sipLines>
      <line button="1">
        <featureID>9</featureID>
        <featureLabel>{html.escape(cisco_feature_label)}</featureLabel>
        <proxy>{cisco_line_proxy}</proxy>
        <port>{sip_port}</port>
        <name>{html.escape(cisco_line_name)}</name>
        <displayName>{html.escape(_disp_lcd)}</displayName>
        <autoAnswer>
          <autoAnswerEnabled>{'2' if eff_auto_answer else '0'}</autoAnswerEnabled>
        </autoAnswer>
        <callWaiting>{'3' if prefs['call_waiting'] else '0'}</callWaiting>
        <authName>{html.escape(cisco_line_name)}</authName>
        <authPassword>{html.escape(sip_password)}</authPassword>
        <sharedLine>false</sharedLine>
        <messageWaitingLampPolicy>1</messageWaitingLampPolicy>
        <messagesNumber>*97</messagesNumber>
        <ringSettingIdle>4</ringSettingIdle>
        <ringSettingActive>5</ringSettingActive>
        <contact>{html.escape(cisco_line_name)}</contact>
        <forwardCallInfoDisplay>
          <callerName>true</callerName>
          <callerNumber>true</callerNumber>
          <redirectedNumber>false</redirectedNumber>
          <dialedNumber>true</dialedNumber>
        </forwardCallInfoDisplay>
      </line>
{extra_lines_xml}
    </sipLines>
    <voipControlPort>5060</voipControlPort>
    <startMediaPort>16384</startMediaPort>
    <stopMediaPort>32766</stopMediaPort>
    <dscpForAudio>184</dscpForAudio>
    <ringSettingBusyStationPolicy>0</ringSettingBusyStationPolicy>
    <dialTemplate>dialplan.xml</dialTemplate>
  </sipProfile>
  <commonProfile>
    <phonePassword></phonePassword>
    <backgroundImageAccess>true</backgroundImageAccess>
    <callLogBlfEnabled>2</callLogBlfEnabled>
  </commonProfile>
  <vendorConfig>
    <disableSpeaker>false</disableSpeaker>
    <disableSpeakerAndHeadset>false</disableSpeakerAndHeadset>
    <pcPort>0</pcPort>
    <settingsAccess>1</settingsAccess>
    <garp>0</garp>
    <voiceVlanAccess>0</voiceVlanAccess>
    <videoCapability>0</videoCapability>
    <autoSelectLineEnable>0</autoSelectLineEnable>
    <webAccess>0</webAccess>
    <daysDisplayNotActive>1,7</daysDisplayNotActive>
    <displayOnTime>08:00</displayOnTime>
    <displayOnDuration>10:00</displayOnDuration>
    <displayIdleTimeout>00:10</displayIdleTimeout>
  </vendorConfig>
  <networkLocale>{"" if is_cp3905 else "Turkey"}</networkLocale>
  <capfAuthMode>0</capfAuthMode>
  <transportLayerProtocol>{cisco_tr_code}</transportLayerProtocol>
</device>
"""
            fname = f"SEP{mac_upper}.cnf.xml"
            return sep_xml, "application/xml; charset=utf-8", fname

        cs_lines: List[str] = []
        for k in dss_list[:10]:
            idx = max(1, int(k.get("key_index") or 1))
            ktype = str(k.get("type") or "none")
            klbl = html.escape(str(k.get("label") or ""))
            kval = html.escape(str(k.get("value") or ""))
            if idx == 1 and ktype == "line":
                continue
            if ktype == "blf" and kval:
                cs_lines.append(f'  <Extension_{idx}_ ua="na">Disabled</Extension_{idx}_>')
                cs_lines.append(f'  <Short_Name_{idx}_ ua="na">{klbl}</Short_Name_{idx}_>')
                cs_lines.append(f'  <Extended_Function_{idx}_ ua="na">fnc=blf+sd+cp;sub={kval}@$PROXY;ext={kval}@$PROXY;nme={klbl}</Extended_Function_{idx}_>')
            elif ktype in ("speed_dial", "park", "intercom", "voicemail", "forward") and (kval or ktype == "voicemail"):
                eff_v = kval or "*97"
                cs_lines.append(f'  <Extension_{idx}_ ua="na">Disabled</Extension_{idx}_>')
                cs_lines.append(f'  <Short_Name_{idx}_ ua="na">{klbl}</Short_Name_{idx}_>')
                cs_lines.append(f'  <Extended_Function_{idx}_ ua="na">fnc=sd;ext={eff_v}@$PROXY;nme={klbl}</Extended_Function_{idx}_>')

        # Daisy-chained Cisco CP-8800 KEM Modules (Unit 1..3, 36 keys each)
        for mod in exp_list[:3]:
            m_idx = int(mod.get("module_index") or 1)
            cs_lines.append(f'  <!-- Cisco CP-8800 KEM Unit {m_idx} -->')
            for ek in (mod.get("keys") or [])[:36]:
                ek_idx = max(1, int(ek.get("key_index") or 1))
                ek_type = str(ek.get("type") or "none")
                ek_lbl = html.escape(str(ek.get("label") or ""))
                ek_val = html.escape(str(ek.get("value") or ""))
                if ek_type == "blf" and ek_val:
                    cs_lines.append(f'  <Unit_{m_idx}_Key_{ek_idx} ua="na">fnc=blf+sd+cp;sub={ek_val}@$PROXY;ext={ek_val}@$PROXY;nme={ek_lbl}</Unit_{m_idx}_Key_{ek_idx}>')
                elif ek_type in ("speed_dial", "park", "intercom", "forward") and ek_val:
                    cs_lines.append(f'  <Unit_{m_idx}_Key_{ek_idx} ua="na">fnc=sd;ext={ek_val}@$PROXY;nme={ek_lbl}</Unit_{m_idx}_Key_{ek_idx}>')

        cs_block = "\n".join(cs_lines + fw_cisco_lines)
        cs_prof = html.escape(provision_server_url) if provision_server_url else ""
        cs_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!-- AIDA PBX Cisco MPP Auto-Provisioning ({html.escape(model)}) | Ext: {html.escape(ext_s)} | SIP Endpoint: {html.escape(sip_u)} -->
<flat-profile>
  <Resync_On_Reset ua="na">Yes</Resync_On_Reset>
  <Resync_Periodic ua="na">3600</Resync_Periodic>
  <Profile_Rule ua="na">{cs_prof}</Profile_Rule>
  <SIP_Transport_1_ ua="na">{tr_up}</SIP_Transport_1_>
  <Proxy_1_ ua="na">{html.escape(pbx_host)}:{sip_port}</Proxy_1_>
  <Display_Name_1_ ua="na">{html.escape(disp_name)}</Display_Name_1_>
  <Short_Name_1_ ua="na">{html.escape(line_label)}</Short_Name_1_>
  <User_ID_1_ ua="na">{html.escape(sip_u)}</User_ID_1_>
  <Auth_ID_1_ ua="na">{html.escape(sip_u)}</Auth_ID_1_>
  <Password_1_ ua="na">{html.escape(sip_password)}</Password_1_>
  <Voice_Mail_Number ua="na">*97</Voice_Mail_Number>
  <Call_Pickup_Code ua="na">{html.escape(pickup_directed)}</Call_Pickup_Code>
  <Group_Call_Pickup_Code ua="na">{html.escape(pickup_group)}</Group_Call_Pickup_Code>
  <Call_Waiting_Serv ua="na">{'Yes' if prefs['call_waiting'] else 'No'}</Call_Waiting_Serv>
  <Auto_Answer_Page ua="na">{'Yes' if eff_auto_answer else 'No'}</Auto_Answer_Page>
  <DND_Setting ua="na">{'Yes' if prefs['dnd_default'] else 'No'}</DND_Setting>
  <Time_Format ua="na">{'24hr' if prefs['time_format'] == '24' else '12hr'}</Time_Format>
  <Back_Light_Timer ua="na">{prefs['backlight_timeout'] or 'Always On'}</Back_Light_Timer>
  <LCD_Contrast ua="na">{prefs['backlight_active']}</LCD_Contrast>
  <Default_Ring_1_ ua="na">{html.escape(prefs['ringtone'])}</Default_Ring_1_>
  <Primary_NTP_Server ua="na">{html.escape(ntp_server or 'pool.ntp.org')}</Primary_NTP_Server>
  <Time_Zone ua="na">GMT+03:00</Time_Zone>
{cs_block}
</flat-profile>
"""
        fname = f"spa{mac_hex}.xml" if mac_hex else f"cisco_{ext_s}.xml"
        return cs_xml, "application/xml; charset=utf-8", fname

    # --- DEFAULT: YEALINK CFG (T3x / T4x / T5x + EXP40 / EXP43 / EXP50 1..4) ---
    yl_tr = 2 if tr_up == "TLS" else (1 if tr_up == "TCP" else 0)
    dtmf_low = str(dtmf_mode or "rfc4733").strip().lower()
    yl_dtmf = 0 if dtmf_low == "inband" else (3 if dtmf_low == "info" else 2)
    codec_list = codecs if isinstance(codecs, list) and codecs else ["g722", "alaw", "ulaw", "g729"]
    yl_codec_map = {"g722": "g722", "alaw": "pcma", "ulaw": "pcmu", "opus": "opus", "g729": "g729"}
    codec_cfg_lines: List[str] = []
    prio_num = 1
    for ck in codec_list:
        yl_ck = yl_codec_map.get(str(ck).lower())
        if yl_ck:
            codec_cfg_lines.append(f"account.1.codec.{yl_ck}.enable = 1")
            codec_cfg_lines.append(f"account.1.codec.{yl_ck}.priority = {prio_num}")
            prio_num += 1
    for ck_all, yl_ck in yl_codec_map.items():
        if ck_all not in [str(x).lower() for x in codec_list]:
            codec_cfg_lines.append(f"account.1.codec.{yl_ck}.enable = 0")

    lang_val = eff_language
    tz_val = str(timezone or "+3").strip() or "+3"
    ntp_val = str(ntp_server or "pool.ntp.org").strip() or "pool.ntp.org"
    yl_time_fmt = 1 if prefs["time_format"] == "24" else 0
    yl_date_map = {"DD.MM.YYYY": 5, "DD/MM/YYYY": 2, "YYYY-MM-DD": 0, "MM/DD/YYYY": 4}
    yl_date_fmt = yl_date_map.get(prefs["date_format"], 5)

    lines = [
        "#!version:1.0.0.1",
        f"# AIDA PBX Auto-Provisioning ({brand or 'Yealink'} {model or 'T46U'})",
        f"# Dahili: {ext_s} ({disp_name}) | PJSIP Endpoint / SIP Kullanici Adi: {sip_u} | Ag Modu: {str(connection_mode or 'lan').upper()}",
        "",
        *(
            [
                "# --- Oto-Provizyon Sunucu Adresi & Acilista Guncelleme ---",
                f"static.auto_provision.server.url = {provision_server_url}",
                "static.auto_provision.power_on = 1",
                "static.auto_provision.repeat.enable = 1",
                "static.auto_provision.repeat.minutes = 60",
                "static.security.trust_certificates = 0",
                "",
            ]
            if provision_server_url
            else [
                "static.auto_provision.power_on = 1",
                "static.security.trust_certificates = 0",
                "",
            ]
        ),
        "# --- SIP Hesap 1 (Kullanici SIP Aktivasyon Kimligi ile Kayit) ---",
        "account.1.enable = 1",
        f"account.1.label = {line_label}",
        f"account.1.display_name = {disp_name}",
        f"account.1.auth_name = {sip_u}",
        f"account.1.user_name = {sip_u}",
        f"account.1.password = {sip_password}",
        f"account.1.sip_server.1.address = {pbx_host}",
        f"account.1.sip_server.1.port = {sip_port}",
        f"account.1.sip_server.1.transport_type = {yl_tr}",
        "account.1.sip_server.1.expires = 3600",
        *(
            [
                "# --- SRST Yedek (Failover) Yerel Santral ---",
                f"account.1.sip_server.2.address = {failover_pbx_host}",
                f"account.1.sip_server.2.port = {sip_port}",
                f"account.1.sip_server.2.transport_type = {yl_tr}",
                "account.1.sip_server.2.expires = 300",
                "account.1.fallback.redundancy_type = 1",
                "account.1.fallback.timeout = 30",
            ]
            if failover_pbx_host and failover_pbx_host != pbx_host
            else []
        ),
        f"account.1.nat.udp_update_enable = {3 if str(connection_mode or 'lan').lower() == 'wan' else 1}",
        "account.1.nat.udp_update_time = 30",
        "account.1.nat.rport = 1",
        f"account.1.dtmf.type = {yl_dtmf}",
        "account.1.dtmf.info_type = 0",
        "account.1.cid_source = 4",
        "account.1.cp_source = 0",
        f"account.1.auto_answer = {1 if eff_auto_answer else 0}",
        f"account.1.ringtone.ring_type = {prefs['ringtone']}",
        "voice_mail.number.1 = *97",
        "account.1.direct_pickup_code = " + pickup_directed,
        "account.1.group_pickup_code = " + pickup_group,
        "account.1.dialoginfo_callpickup = 1",
        "",
        "# --- Ses Kodek Onceligi ---",
        *codec_cfg_lines,
        "",
        "# --- Kisisel Ses, Zil Sesi, Ekran ve LED Tercihleri ---",
        f"phone_setting.ring_type = {prefs['ringtone']}",
        f"voice.ring_vol = {prefs['ring_volume']}",
        f"voice.handset.tone_vol = {prefs['handset_volume']}",
        f"voice.handfree.tone_vol = {prefs['speaker_volume']}",
        f"voice.headset.tone_vol = {prefs['headset_volume']}",
        f"call_waiting.enable = {1 if prefs['call_waiting'] else 0}",
        f"call_waiting.tone = {1 if prefs['call_waiting_tone'] else 0}",
        f"features.intercom.allow = 1",
        f"features.intercom.mute = {1 if prefs['intercom_mute'] else 0}",
        f"features.headset_prior = {1 if prefs['headset_mode'] in ('ehs', 'usb', 'bluetooth') else 0}",
        f"phone_setting.missed_call_power_led_flash.enable = {1 if prefs['missed_call_led'] else 0}",
        f"phone_setting.mail_power_led_flash_enable = {1 if prefs['mwi_led'] else 0}",
        f"phone_setting.active_backlight_level = {prefs['backlight_active']}",
        f"phone_setting.inactive_backlight_level = {prefs['backlight_inactive']}",
        f"phone_setting.backlight_time = {prefs['backlight_timeout']}",
        f"screensaver.wait_time = {prefs['screensaver_wait'] if prefs['screensaver_wait'] > 0 else 0}",
        f"local_time.time_format = {yl_time_fmt}",
        f"local_time.date_format = {yl_date_fmt}",
        "",
        "# --- Dil, Saat Dilimi ve Uzaktan Senkronizasyon (Zero-Reboot check-sync) ---",
        f"lang.gui = {lang_val}",
        f"lang.wui = {lang_val}",
        f"local_time.time_zone = {tz_val}",
        "local_time.time_zone_name = Turkey(Ankara)" if tz_val in ("+3", "3", "UTC+3") else f"local_time.time_zone_name = GMT{tz_val}",
        f"local_time.ntp_server1 = {ntp_val}",
        "local_time.summer_time = 0",
        f"features.direct_ip_call_enable = {0 if direct_ip_call_block else 1}",
        *yealink_sync_lines,
        *fw_yealink_lines,
        "",
        "# --- Programlanabilir Yan Tuslar / BLF / Hizli Arama (DSS Keys) ---",
    ]

    yealink_type_map = {
        "none": 0,
        "conference": 1,
        "forward": 2,
        "transfer": 3,
        "hold": 4,
        "dnd": 5,
        "pickup": 23,
        "park": 10,
        "dtmf": 11,
        "speed_dial": 13,
        "intercom": 14,
        "line": 15,
        "blf": 16,
        "voicemail": 13,
    }
    if not dss_list:
        lines.append("linekey.1.type = 15")
        lines.append("linekey.1.line = 1")
        lines.append(f"linekey.1.label = {line_label}")
    else:
        for k in dss_list:
            idx = int(k.get("key_index") or 1)
            ktype = str(k.get("type") or "none")
            label = str(k.get("label") or "")
            val = str(k.get("value") or ("*97" if ktype == "voicemail" else (pickup_group if ktype == "pickup" else "")))
            pickup = str(k.get("pickup_code") or pickup_directed)
            yl_code = yealink_type_map.get(ktype, 0)

            lines.append(f"linekey.{idx}.type = {yl_code}")
            lines.append(f"linekey.{idx}.line = 1")
            lines.append(f"linekey.{idx}.value = {val}")
            lines.append(f"linekey.{idx}.label = {label}")
            if ktype == "blf":
                lines.append(f"linekey.{idx}.extension = {pickup}")

    # Daisy-chained Yealink Expansion Modules (EXP40 / EXP43 / EXP50 — Modules 1..4, up to 60 keys each)
    if exp_list:
        lines.append("")
        lines.append("# --- Zincirleme Mesguliyet Modulleri (Expansion Modules 1-4) ---")
        for mod in exp_list[:4]:
            m_idx = int(mod.get("module_index") or 1)
            m_model = str(mod.get("model") or "EXP43")
            lines.append(f"# Modul #{m_idx} ({m_model})")
            for ek in (mod.get("keys") or [])[:60]:
                ek_idx = int(ek.get("key_index") or 1)
                ek_type = str(ek.get("type") or "none")
                ek_lbl = str(ek.get("label") or "")
                ek_val = str(ek.get("value") or ("*97" if ek_type == "voicemail" else (pickup_group if ek_type == "pickup" else "")))
                ek_pu = str(ek.get("pickup_code") or pickup_directed)
                yl_code = yealink_type_map.get(ek_type, 0)
                lines.append(f"expansion_module.{m_idx}.key.{ek_idx}.type = {yl_code}")
                lines.append(f"expansion_module.{m_idx}.key.{ek_idx}.line = 1")
                lines.append(f"expansion_module.{m_idx}.key.{ek_idx}.value = {ek_val}")
                lines.append(f"expansion_module.{m_idx}.key.{ek_idx}.label = {ek_lbl}")
                if ek_type == "blf":
                    lines.append(f"expansion_module.{m_idx}.key.{ek_idx}.extension = {ek_pu}")

    lines.append("")
    lines.append("# --- Ekran Alti Softkey Tuslari (F1-F4) ---")
    soft_type_map = {
        "history": 28,
        "directory": 22,
        "dnd": 5,
        "transfer": 3,
        "forward": 2,
        "speed_dial": 13,
        "redial": 27,
        "voicemail": 13,
        "pickup": 23,
        "menu": 30,
    }
    for sk in soft_list:
        sidx = int(sk.get("key_index") or 1)
        stype = str(sk.get("type") or "history")
        slabel = str(sk.get("label") or "")
        sval = str(sk.get("value") or ("*97" if stype == "voicemail" else (pickup_group if stype == "pickup" else "")))
        lines.append(f"programablekey.{sidx}.type = {soft_type_map.get(stype, 0)}")
        lines.append(f"programablekey.{sidx}.line = 1")
        lines.append(f"programablekey.{sidx}.value = {sval}")
        lines.append(f"programablekey.{sidx}.label = {slabel}")

    lines.append("")
    lines.append("# --- Uzak XML Telefon Rehberi (Remote Phonebook) ---")
    lines.append("features.remote_phonebook.enable = 1")
    lines.append("features.remote_phonebook.flash_time = 3600")
    lines.append("directory_setting.remote_phone_book.enable = 1")
    lines.append("directory_setting.remote_phone_book.priority = 1")
    if pb_list:
        for pb_idx, pb_item in enumerate(pb_list[:5], start=1):
            pb_id = str(pb_item.get("id"))
            pb_nm = str(pb_item.get("name") or f"Rehber {pb_idx}")
            lines.append(f"remote_phonebook.data.{pb_idx}.url = {pb_base}/{pb_id}/yealink.xml")
            lines.append(f"remote_phonebook.data.{pb_idx}.name = {pb_nm}")
    else:
        lines.append(f"remote_phonebook.data.1.url = {pb_base}/{ext_s or 'all'}/yealink.xml")
        lines.append("remote_phonebook.data.1.name = Telefon Rehberi")

    fname = f"{mac_hex}.cfg" if mac_hex else f"deskphone_{ext_s}.cfg"
    return "\n".join(lines) + "\n", "text/plain; charset=utf-8", fname


def get_provision_snapshots_dir() -> str:
    """Returns `/opt/ai-project/backend/data/provision_snapshots` (auto-created)."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    snap_dir = os.path.join(base_dir, "data", "provision_snapshots")
    os.makedirs(snap_dir, exist_ok=True)
    return snap_dir


def save_provision_snapshot(
    mac_hex: str,
    filename: str,
    content_text: str,
    meta: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Persists the exact provisioning file last served to a physical phone as
    `backend/data/provision_snapshots/<mac_hex>_last.<xml|cfg>` + `.meta.json`.
    """
    import hashlib as _hl
    import json as _js

    _, mh = normalize_mac_address(mac_hex or "")
    if not mh:
        return None
    try:
        snap_dir = get_provision_snapshots_dir()
        is_xml = str(filename or "").strip().lower().endswith(".xml") or str(content_text or "").lstrip().startswith("<")
        ext_sfx = "xml" if is_xml else "cfg"
        # Clean up opposite extension if device brand was ever changed
        other_path = os.path.join(snap_dir, f"{mh}_last.{'cfg' if ext_sfx == 'xml' else 'xml'}")
        if os.path.isfile(other_path):
            try:
                os.remove(other_path)
            except Exception:
                pass
        file_path = os.path.join(snap_dir, f"{mh}_last.{ext_sfx}")
        meta_path = os.path.join(snap_dir, f"{mh}_last.meta.json")
        raw_bytes = (content_text or "").encode("utf-8")
        with open(file_path, "wb") as f_out:
            f_out.write(raw_bytes)
        meta_obj = dict(meta or {})
        meta_obj.update({
            "mac_hex": mh,
            "filename": str(filename or f"{mh}.{ext_sfx}"),
            "disk_path": file_path,
            "size_bytes": len(raw_bytes),
            "line_count": len((content_text or "").splitlines()),
            "sha256": _hl.sha256(raw_bytes).hexdigest(),
        })
        with open(meta_path, "w", encoding="utf-8") as f_meta:
            _js.dump(meta_obj, f_meta, ensure_ascii=False, indent=2)
        return file_path
    except Exception as e_snap:
        print(f"[Provision Snapshot Save Warning]: {e_snap}")
        return None


def read_provision_snapshot(mac_hex: str) -> Dict[str, Any]:
    """Reads the last real provisioning snapshot served to `mac_hex`, if any."""
    import json as _js

    _, mh = normalize_mac_address(mac_hex or "")
    if not mh:
        return {"exists": False, "content": "", "meta": {}, "disk_path": ""}
    snap_dir = get_provision_snapshots_dir()
    meta_path = os.path.join(snap_dir, f"{mh}_last.meta.json")
    meta_obj: Dict[str, Any] = {}
    if os.path.isfile(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as fm:
                meta_obj = _js.load(fm)
        except Exception:
            meta_obj = {}
    cand_paths = [
        meta_obj.get("disk_path") or "",
        os.path.join(snap_dir, f"{mh}_last.xml"),
        os.path.join(snap_dir, f"{mh}_last.cfg"),
    ]
    for cp in cand_paths:
        if cp and os.path.isfile(cp):
            try:
                with open(cp, "r", encoding="utf-8", errors="replace") as fp:
                    txt = fp.read()
                return {
                    "exists": True,
                    "content": txt,
                    "line_count": len(txt.splitlines()),
                    "size_bytes": len(txt.encode("utf-8")),
                    "disk_path": cp,
                    "meta": meta_obj,
                }
            except Exception:
                pass
    return {"exists": False, "content": "", "line_count": 0, "size_bytes": 0, "disk_path": "", "meta": {}}
