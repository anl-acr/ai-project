#!/usr/bin/env bash
# Idempotently updates /etc/kamailio/kamailio.cfg with:
#  1) nornia_user_routes htable (SIP username fallback for legacy Cisco 3905/79xx raw-IP REGISTER)
#  2) Safe "" + $sht(...) != $null checks (avoids Kamailio $var(x)=$null -> integer 0 quirk!)
#  3) Core {uri.host} port-5160/5068 rewrite
#  4) UFW UDP 69 (Hub TFTP proxy)
set -euo pipefail

CFG="/etc/kamailio/kamailio.cfg"
if [ ! -f "$CFG" ]; then
  echo "HATA: $CFG bulunamadı." >&2
  exit 1
fi

cp -a "$CFG" "${CFG}.bak.$(date +%Y%m%d%H%M%S)"

python3 - "$CFG" <<'PYEOF'
import re
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

safe_route_block = """    $var(target_pbx) = "";
    if ($sht(nornia_routes=>$rd) != $null) {
        $var(target_pbx) = $sht(nornia_routes=>$rd);
    }
    if ($var(target_pbx) == "" && $fU != $null && $sht(nornia_user_routes=>$fU) != $null) {
        $var(target_pbx) = $sht(nornia_user_routes=>$fU);
    }
    if ($var(target_pbx) == "" && $tU != $null && $sht(nornia_user_routes=>$tU) != $null) {
        $var(target_pbx) = $sht(nornia_user_routes=>$tU);
    }
    if ($var(target_pbx) == "" && $(ru{uri.param,line}) != "" && $sht(nornia_line_routes=>$(ru{uri.param,line})) != $null) {
        $var(target_pbx) = $sht(nornia_line_routes=>$(ru{uri.param,line}));
    }
    if ($var(target_pbx) == "" && $rU != $null && $sht(nornia_did_routes=>$rU) != $null) {
        $var(target_pbx) = $sht(nornia_did_routes=>$rU);
    }
    if ($var(target_pbx) == "" && $tU != $null && $sht(nornia_did_routes=>$tU) != $null) {
        $var(target_pbx) = $sht(nornia_did_routes=>$tU);
    }
    if ($var(target_pbx) == "") {
        xlog("L_WARN", "NORNIA_SEC_DROP unknown_domain src=$si method=$rm rd=$rd ru=$rU\\n");
        exit;
    }"""

# Replace old `$var(target_pbx) = $sht(nornia_routes=>$rd); ... if ($var(target_pbx) == $null) { ... exit; }`
old_pattern = re.compile(
    r'    \$var\(target_pbx\)\s*=\s*\$sht\(nornia_routes=>\$rd\);.*?if\s*\(\$var\(target_pbx\)\s*==\s*\$null\)\s*\{.*?exit;\s*\}',
    re.DOTALL,
)
if old_pattern.search(txt):
    txt = old_pattern.sub(lambda _m: safe_route_block, txt, count=1)
    changed = True

for old_expr in (
    '$(var(target_pbx){s.replace,:5060,:5160})',
    '$(var(target_pbx){s.replace,5060,5160})',
):
    if old_expr in txt:
        txt = txt.replace(old_expr, '"sip:" + $(var(target_pbx){uri.host}) + ":5160"')
        changed = True
for old_expr2 in (
    '$(var(target_pbx){s.replace,:5060,:5068})',
    '$(var(target_pbx){s.replace,5060,5068})',
):
    if old_expr2 in txt:
        txt = txt.replace(old_expr2, '"sip:" + $(var(target_pbx){uri.host}) + ":5068"')
        changed = True

if changed:
    with open(cfg_path, "w", encoding="utf-8") as f:
        f.write(txt)
    print("OK: kamailio.cfg güncellendi (safe null-check + nornia_user_routes + uri.host).")
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
grep -n 'target_pbx' "$CFG" | head -n 20
