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

# 5) TCP NAT keepalive + tcp_reuse_port=no + tcp_connection_match=0 + tcp_accept_aliases + fast timeouts
if "tcp_reuse_port=yes" in txt:
    txt = txt.replace("tcp_reuse_port=yes", "tcp_reuse_port=no", 1)
    changed = True
if "tcp_connection_match=" not in txt and "tcp_reuse_port=no" in txt:
    txt = txt.replace("tcp_reuse_port=no", "tcp_reuse_port=no\ntcp_connection_match=0", 1)
    changed = True
if "tcp_keepalive=yes" not in txt and "tcp_reuse_port=no" in txt:
    txt = txt.replace(
        "tcp_connection_match=0",
        "tcp_connection_match=0\ntcp_accept_aliases=yes\ntcp_connect_timeout=3\ntcp_send_timeout=3\ntcp_keepalive=yes\ntcp_keepidle=30\ntcp_keepintvl=10\ntcp_keepcnt=3",
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

# 5a) nornia_tcp_nat htable (tracks live NAT ip:port;transport per SIP user for RFC1918 NOTIFY/BYE/INVITE fallback)
nat_ht_line = 'modparam("htable", "htable", "nornia_tcp_nat=>size=10;autoexpire=3600;")'
if "nornia_tcp_nat" not in txt:
    for anchor_nat in (
        'modparam("htable", "htable", "nornia_line_routes=>size=10;autoexpire=86400;")',
        'modparam("htable", "htable", "nornia_user_routes=>size=12;autoexpire=0;")',
    ):
        if anchor_nat in txt:
            txt = txt.replace(anchor_nat, anchor_nat + "\n" + nat_ht_line, 1)
            changed = True
            break

if "        force_tcp_alias($sp);\n" in txt:
    txt = txt.replace("        force_tcp_alias($sp);\n", "")
    changed = True

if "force_tcp_alias();" not in txt:
    anchor_rport = '    force_rport();\n    remove_hf("X-Real-IP");'
    if anchor_rport in txt:
        txt = txt.replace(
            anchor_rport,
            '    force_rport();\n    if ($proto == "tcp" || $proto == "tls") {\n        force_tcp_alias();\n    }\n    remove_hf("X-Real-IP");',
            1,
        )
        changed = True

# Record live NAT endpoint in nornia_tcp_nat on REGISTER
reg_nat_snippet = (
    '    if (is_method("REGISTER")) {\n'
    '        if ($fU != $null && $fU != "") {\n'
    '            $sht(nornia_tcp_nat=>$fU) = "sip:" + $si + ":" + $sp + ";transport=" + $proto;\n'
    '        }\n'
    '        if ($ct != $null && $(ct{nameaddr.uri}{uri.user}) != "") {\n'
    '            $sht(nornia_tcp_nat=>$(ct{nameaddr.uri}{uri.user})) = "sip:" + $si + ":" + $sp + ";transport=" + $proto;\n'
    '        }'
)
if '$sht(nornia_tcp_nat=>$fU)' not in txt:
    anchor_reg = '    if (is_method("REGISTER")) {\n        if (!($hdr(Supported) =~ "path")) {'
    if anchor_reg in txt:
        txt = txt.replace(
            anchor_reg,
            reg_nat_snippet + '\n        if (!($hdr(Supported) =~ "path")) {',
            1,
        )
        changed = True

# Extract external bind IP and WireGuard hub IP
m_bind = re.search(r'listen=tcp:([0-9.]+):5160(?:\s+advertise|\s*$)', txt, re.MULTILINE)
hub_bind_ip = m_bind.group(1) if m_bind else ""
m_wg = re.search(r'listen=tcp:(10\.200\.[0-9.]+):5160', txt)
wg_hub_ip = m_wg.group(1) if m_wg else "10.200.0.1"

# 5b) Preserve port 5160 on in-dialog external -> PBX requests so Kamailio never opens a stray :5060->:5160 socket
if f'$fs = "tcp:{wg_hub_ip}:5160";' in txt and 'if ($Rp == 5160) {\n                if ($proto == "tcp") {\n                    $fs = "tcp:' + wg_hub_ip + ':5160";' not in txt:
    ext_indlg_pat = re.compile(
        r'(    # 3e\. In-dialog requests[^\n]*\n'
        r'    if \(has_totag\(\)\) \{\n'
        r'        if \(loose_route\(\)\) \{\n'
        r'            force_rport\(\);\n'
        r'            if \(nat_uac_test\("19"\)\) \{\n'
        r'                fix_nated_contact\(\);\n'
        r'            \}\n)',
    )
    ext_indlg_repl = (
        r'\1'
        '            if ($proto == "tcp" || $proto == "tls") {\n'
        '                force_tcp_alias();\n'
        '            }\n'
        '            if ($Rp == 5160) {\n'
        '                if ($proto == "tcp") {\n'
        f'                    $fs = "tcp:{wg_hub_ip}:5160";\n'
        '                } else {\n'
        f'                    $fs = "udp:{wg_hub_ip}:5160";\n'
        '                }\n'
        '            }\n'
    )
    if ext_indlg_pat.search(txt):
        txt = ext_indlg_pat.sub(ext_indlg_repl, txt, count=1)
        changed = True

# 5c) Match exact listening TCP socket (5160 vs 5060) + RFC1918 fallback + xlog in route[FROM_PBX]
if hub_bind_ip:
    # Upgrade in-dialog route[FROM_PBX] has_totag()
    if 'NORNIA_FROM_PBX_INDLG' not in txt:
        pbx_indlg_pat = re.compile(
            r'(route\[FROM_PBX\] \{.*?    if \(has_totag\(\)\) \{\n'
            r'        if \(loose_route\(\)\) \{\n)'
            r'(            if \(is_method\("BYE"\)\) \{.*?            t_on_reply\("REPLY_FROM_EXT"\);\n)',
            re.DOTALL,
        )
        pbx_indlg_inject = (
            '            if ($du == $null && $rd =~ "^(10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.|192\\.168\\.)" && $rU != $null && $sht(nornia_tcp_nat=>$rU) != $null) {\n'
            '                $du = $sht(nornia_tcp_nat=>$rU);\n'
            '            }\n'
            '            if ($Rp == 5160 || $sp == 5160) {\n'
            '                if (($du != $null && $du =~ "transport=(tcp|TCP)") || $ru =~ "transport=(tcp|TCP)" || $proto == "tcp") {\n'
            f'                    $fs = "tcp:{hub_bind_ip}:5160";\n'
            '                } else {\n'
            f'                    $fs = "udp:{hub_bind_ip}:5160";\n'
            '                }\n'
            '            }\n'
        )
        m_ind = pbx_indlg_pat.search(txt)
        if m_ind:
            repl_body = m_ind.group(2).replace(
                '            t_on_reply("REPLY_FROM_EXT");\n',
                '            xlog("L_INFO", "NORNIA_FROM_PBX_INDLG method=$rm src=$si:$sp Rp=$Rp ru=$ru du=$du fs=$fs\\n");\n            t_on_reply("REPLY_FROM_EXT");\n',
                1,
            )
            txt = txt[:m_ind.start()] + m_ind.group(1) + pbx_indlg_inject + repl_body + txt[m_ind.end():]
            changed = True

    # Upgrade initial request loose_route() in route[FROM_PBX] (matches both original and previous patch)
    old_lr_pat = re.compile(
        r'^    if \(loose_route\(\)\) \{\n'
        r'        # (?:For UDP force external UDP socket;|Match (?:the )?exact listening socket)[^\n]*\n'
        r'.*?\n    \}$',
        re.DOTALL | re.MULTILINE,
    )
    new_lr_block = (
        '    if (loose_route()) {\n'
        '        # Match exact listening socket (5160 vs 5060, TCP vs UDP) to reuse inbound NAT TCP connection\n'
        '        if ($Rp == 5160 || $sp == 5160) {\n'
        '            if (($du != $null && $du =~ "transport=(tcp|TCP)") || $ru =~ "transport=(tcp|TCP)" || $proto == "tcp") {\n'
        f'                $fs = "tcp:{hub_bind_ip}:5160";\n'
        '            } else {\n'
        f'                $fs = "udp:{hub_bind_ip}:5160";\n'
        '            }\n'
        '        } else if ($du != $null && $du =~ "transport=(tcp|TCP)") {\n'
        f'            $fs = "tcp:{hub_bind_ip}:5060";\n'
        '        } else if ($du == $null || !($du =~ "transport=(tls|TLS)")) {\n'
        f'            $fs = "udp:{hub_bind_ip}:5060";\n'
        '        }\n'
        '    }\n\n'
        '    # Private RFC1918 R-URI fallback (e.g. Asterisk chan_sip NOTIFY/INVITE without Path Route header)\n'
        '    if ($du == $null && $rd =~ "^(10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.|192\\.168\\.)" && $rU != $null && $sht(nornia_tcp_nat=>$rU) != $null) {\n'
        '        $du = $sht(nornia_tcp_nat=>$rU);\n'
        '        if ($Rp == 5160 || $sp == 5160) {\n'
        '            if ($du =~ "transport=(tcp|TCP)") {\n'
        f'                $fs = "tcp:{hub_bind_ip}:5160";\n'
        '            } else {\n'
        f'                $fs = "udp:{hub_bind_ip}:5160";\n'
        '            }\n'
        '        } else if ($du =~ "transport=(tcp|TCP)") {\n'
        f'            $fs = "tcp:{hub_bind_ip}:5060";\n'
        '        } else {\n'
        f'            $fs = "udp:{hub_bind_ip}:5060";\n'
        '        }\n'
        '    }'
    )
    if '# Private RFC1918 R-URI fallback' not in txt and old_lr_pat.search(txt):
        txt = old_lr_pat.sub(lambda _m: new_lr_block, txt, count=1)
        changed = True

    if 'NORNIA_FROM_PBX method=' not in txt:
        rr_anchor = '    if (!is_method("OPTIONS")) {\n        record_route();\n    }'
        if rr_anchor in txt:
            txt = txt.replace(
                rr_anchor,
                '    if (!is_method("OPTIONS")) {\n        xlog("L_INFO", "NORNIA_FROM_PBX method=$rm src=$si:$sp Rp=$Rp ru=$ru du=$du fs=$fs\\n");\n        record_route();\n    }',
                1,
            )
            changed = True

    if 'NORNIA_EXT_ERR' not in txt:
        ext_rep_anchor = 'onreply_route[REPLY_FROM_EXT] {\n    if (nat_uac_test("19")) {'
        if ext_rep_anchor in txt:
            txt = txt.replace(
                ext_rep_anchor,
                'onreply_route[REPLY_FROM_EXT] {\n    if ($rs >= 400) {\n        xlog("L_WARN", "NORNIA_EXT_ERR method=$rm status=$rs reason=$rr src=$si:$sp\\n");\n    }\n    if (nat_uac_test("19")) {',
                1,
            )
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

# Ensure Kamailio startup route loader also hydrates nornia_user_routes.map with s: prefixes (so restarts never wipe Cisco 1000 routes!)
cat > /usr/local/bin/nornia-load-kamailio-routes.sh <<'LOAD_EOF'
#!/usr/bin/env bash
MAP_FILE="/etc/kamailio/nornia_routes.map"
if ! command -v kamcmd >/dev/null 2>&1; then
  exit 0
fi
for _ in 1 2 3 4 5; do
  if kamcmd core.version >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if [[ -f "$MAP_FILE" ]]; then
  kamcmd htable.flush nornia_routes >/dev/null 2>&1 || true
  while read -r domain target _rest; do
    [[ -z "$domain" || "$domain" == \#* || -z "$target" ]] && continue
    kamcmd htable.sets nornia_routes "s:${domain}" "s:sip:${target}" >/dev/null 2>&1 || true
  done < "$MAP_FILE"
fi
DID_MAP_FILE="/etc/kamailio/nornia_did_routes.map"
if [[ -f "$DID_MAP_FILE" ]]; then
  kamcmd htable.flush nornia_did_routes >/dev/null 2>&1 || true
  while read -r did_key target _rest; do
    [[ -z "$did_key" || "$did_key" == \#* || -z "$target" ]] && continue
    kamcmd htable.sets nornia_did_routes "s:${did_key}" "s:sip:${target}" >/dev/null 2>&1 || true
  done < "$DID_MAP_FILE"
fi
USER_MAP_FILE="/etc/kamailio/nornia_user_routes.map"
if [[ -f "$USER_MAP_FILE" ]]; then
  kamcmd htable.flush nornia_user_routes >/dev/null 2>&1 || true
  while read -r u_key target _rest; do
    [[ -z "$u_key" || "$u_key" == \#* || -z "$target" ]] && continue
    kamcmd htable.sets nornia_user_routes "s:${u_key}" "s:sip:${target}" >/dev/null 2>&1 || true
  done < "$USER_MAP_FILE"
fi
exit 0
LOAD_EOF
chmod +x /usr/local/bin/nornia-load-kamailio-routes.sh

systemctl restart kamailio
/usr/local/bin/nornia-load-kamailio-routes.sh || true

if command -v ufw >/dev/null 2>&1; then
  ufw allow 69/udp comment "Nornia Hub Cisco TFTP Provisioning Proxy" >/dev/null || true
fi

echo "=== DOĞRULAMA ==="
systemctl is-active kamailio
grep -n 'target_pbx' "$CFG" | head -n 20
