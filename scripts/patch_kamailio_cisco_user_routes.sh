#!/usr/bin/env bash
# Idempotently adds `nornia_user_routes` (SIP username fallback for legacy Cisco 3905/79xx raw-IP REGISTER)
# to /etc/kamailio/kamailio.cfg, validates syntax with `kamailio -c`, restarts Kamailio, and opens UDP 69 (TFTP).
set -euo pipefail

CFG="/etc/kamailio/kamailio.cfg"
if [ ! -f "$CFG" ]; then
  echo "HATA: $CFG bulunamadı." >&2
  exit 1
fi

cp -a "$CFG" "${CFG}.bak.$(date +%Y%m%d%H%M%S)"

python3 - "$CFG" <<'PYEOF'
import sys

cfg_path = sys.argv[1]
with open(cfg_path, "r", encoding="utf-8") as f:
    txt = f.read()

changed = False

htable_line = 'modparam("htable", "htable", "nornia_user_routes=>size=12;autoexpire=0;")'
if "nornia_user_routes" not in txt:
    anchor_ht = 'modparam("htable", "htable", "nornia_did_routes=>size=10;autoexpire=0;")'
    if anchor_ht in txt:
        txt = txt.replace(anchor_ht, anchor_ht + "\n" + htable_line, 1)
        changed = True
    else:
        anchor_ht2 = 'modparam("htable", "htable", "nornia_routes=>size=10;autoexpire=0;")'
        if anchor_ht2 in txt:
            txt = txt.replace(anchor_ht2, anchor_ht2 + "\n" + htable_line, 1)
            changed = True

fallback_block = (
    '    # 1b) Legacy Cisco 3905/79xx raw-IP fallback matched by unique SIP username (From/To user)\n'
    '    if ($var(target_pbx) == $null && $fU != $null) {\n'
    '        $var(target_pbx) = $sht(nornia_user_routes=>$fU);\n'
    '    }\n'
    '    if ($var(target_pbx) == $null && $tU != $null) {\n'
    '        $var(target_pbx) = $sht(nornia_user_routes=>$tU);\n'
    '    }'
)
if "$sht(nornia_user_routes=>" not in txt:
    anchor_rt = '$var(target_pbx) = $sht(nornia_routes=>$rd);'
    if anchor_rt in txt:
        txt = txt.replace(anchor_rt, anchor_rt + "\n" + fallback_block, 1)
        changed = True
    else:
        print("UYARI: nornia_routes=>$rd satırı bulunamadı, kamailio.cfg değiştirilmedi.", file=sys.stderr)
        sys.exit(2)

if "{s.replace,:5060,:5160}" in txt:
    txt = txt.replace("{s.replace,:5060,:5160}", "{s.replace,5060,5160}")
    changed = True
if "{s.replace,:5060,:5068}" in txt:
    txt = txt.replace("{s.replace,:5060,:5068}", "{s.replace,5060,5068}")
    changed = True

if changed:
    with open(cfg_path, "w", encoding="utf-8") as f:
        f.write(txt)
    print("OK: kamailio.cfg güncellendi (nornia_user_routes eklendi).")
else:
    print("OK: kamailio.cfg zaten güncel.")
PYEOF

kamailio -c -f "$CFG"
systemctl restart kamailio

if command -v ufw >/dev/null 2>&1; then
  ufw allow 69/udp comment "Nornia Hub Cisco TFTP Provisioning Proxy" >/dev/null || true
fi

echo "=== DOĞRULAMA ==="
systemctl is-active kamailio
ss -ulnp -tlnp | grep -E ":69 |:5060 |:5160 " || true
