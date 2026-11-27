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
    if ($var(target_pbx) == "" && $ct != $null && $(ct{nameaddr.uri}{uri.user}) != "" && $sht(nornia_user_routes=>$(ct{nameaddr.uri}{uri.user})) != $null) {
        $var(target_pbx) = $sht(nornia_user_routes=>$(ct{nameaddr.uri}{uri.user}));
    }
    if ($var(target_pbx) == "" && $au != $null && $sht(nornia_user_routes=>$au) != $null) {
        $var(target_pbx) = $sht(nornia_user_routes=>$au);
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

# Replace old or previous safe_route_block cleanly
old_pattern = re.compile(
    r'    \$var\(target_pbx\)\s*=\s*(?:\$sht\(nornia_routes=>\$rd\)|"");.*?if\s*\(\$var\(target_pbx\)\s*==\s*(?:\$null|"")\)\s*\{.*?exit;\s*\}',
    re.DOTALL,
)
if old_pattern.search(txt):
    new_txt = old_pattern.sub(lambda _m: safe_route_block, txt, count=1)
    if new_txt != txt:
        txt = new_txt
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

# 5) TCP NAT keepalive + tcp_accept_aliases + fast timeouts + force_tcp_alias($sp)
if "tcp_keepalive=yes" not in txt and "tcp_reuse_port=yes" in txt:
    txt = txt.replace(
        "tcp_reuse_port=yes",
        "tcp_reuse_port=yes\ntcp_accept_aliases=yes\ntcp_connect_timeout=3\ntcp_send_timeout=3\ntcp_keepalive=yes\ntcp_keepidle=30\ntcp_keepintvl=10\ntcp_keepcnt=3",
        1,
    )
    changed = True
elif "tcp_accept_aliases=yes" not in txt and "tcp_keepalive=yes" in txt:
    txt = txt.replace(
        "tcp_keepalive=yes",
        "tcp_accept_aliases=yes\ntcp_connect_timeout=3\ntcp_send_timeout=3\ntcp_keepalive=yes",
        1,
    )
    changed = True

if "force_tcp_alias();" not in txt:
    anchor_rport = '    force_rport();\n    remove_hf("X-Real-IP");'
    if anchor_rport in txt:
        txt = txt.replace(
            anchor_rport,
            '    force_rport();\n    if ($proto == "tcp" || $proto == "tls") {\n        force_tcp_alias();\n        force_tcp_alias($sp);\n    }\n    remove_hf("X-Real-IP");',
            1,
        )
        changed = True
elif "force_tcp_alias($sp);" not in txt:
    txt = txt.replace(
        "        force_tcp_alias();\n",
        "        force_tcp_alias();\n        force_tcp_alias($sp);\n",
        1,
    )
    changed = True

# 5b) Match exact listening TCP socket (5160 vs 5060) in route[FROM_PBX] so mhomed does NOT pick :5060 when phone is connected on :5160!
m_bind = re.search(r'listen=tcp:([0-9.]+):5160', txt)
hub_bind_ip = m_bind.group(1) if m_bind else ""
if hub_bind_ip:
    old_lr_pat = re.compile(
        r'    if \(loose_route\(\)\) \{\n'
        r'        # For UDP force external UDP socket;[^\n]*\n'
        r'        if \(\$du == \$null \|\| !\(\$du =~ "transport=\(tcp\|TCP\|tls\|TLS\)"\)\) \{\n'
        r'            if \(\$Rp == 5160\) \{\n'
        r'                \$fs = "udp:' + re.escape(hub_bind_ip) + r':5160";\n'
        r'            \} else \{\n'
        r'                \$fs = "udp:' + re.escape(hub_bind_ip) + r':5060";\n'
        r'            \}\n'
        r'        \}\n'
        r'    \}',
    )
    new_lr_block = (
        '    if (loose_route()) {\n'
        '        # Match exact listening socket (5160 vs 5060, TCP vs UDP) to reuse inbound NAT TCP connection\n'
        '        if ($Rp == 5160) {\n'
        '            if ($du != $null && $du =~ "transport=(tcp|TCP)") {\n'
        f'                $fs = "tcp:{hub_bind_ip}:5160";\n'
        '            } else {\n'
        f'                $fs = "udp:{hub_bind_ip}:5160";\n'
        '            }\n'
        '        } else if ($du != $null && $du =~ "transport=(tcp|TCP)") {\n'
        f'            $fs = "tcp:{hub_bind_ip}:5060";\n'
        '        } else if ($du == $null || !($du =~ "transport=(tls|TLS)")) {\n'
        f'            $fs = "udp:{hub_bind_ip}:5060";\n'
        '        }\n'
        '    }'
    )
    if old_lr_pat.search(txt):
        txt = old_lr_pat.sub(lambda _m: new_lr_block, txt, count=1)
        changed = True

# 6) Reply 200 OK to bare Asterisk chan_sip OPTIONS without Path Route header so peers don't go UNREACHABLE
opt_guard = '    if ($du == $null && is_method("OPTIONS")) {\n        sl_send_reply("200", "OK");\n        exit;\n    }\n'
if 'if ($du == $null && is_method("OPTIONS"))' not in txt:
    m_lg = re.search(r'^    # Self-loop guard:.*$', txt, re.MULTILINE)
    if m_lg:
        ins_pos = m_lg.end() + 1
        txt = txt[:ins_pos] + opt_guard + txt[ins_pos:]
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
