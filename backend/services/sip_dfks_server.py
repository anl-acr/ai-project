"""
Nornia BroadWorks Device Feature Key Synchronization (DFKS — RFC 6665 / ECMA-323 CSTA `as-feature-event`)
Lightweight Pure-Python Asyncio UDP SIP Server (Port 5068).

Enables native, instant (<50ms), zero-reboot, bi-directional Call Forwarding (Always / Busy / No Answer)
and Do Not Disturb (DND) icon & menu synchronization for Grandstream (GRP26xx / GXP21xx), Yealink,
Fanvil, Polycom, Cisco MPP, and Snom desk phones behind Kamailio SIP Edge or on LAN.

Protocol Flow:
  1. Phone (e.g. Grandstream with `<P2325>1</P2325>`) sends `SUBSCRIBE` (`Event: as-feature-event`).
  2. Kamailio SIP Edge routes `SUBSCRIBE Event: as-feature-event` to PBX UDP `5068` with double `Record-Route`.
  3. This server replies `200 OK`, stores the active dialog + Route set, and immediately sends in-dialog
     `NOTIFY` (`Event: as-feature-event`, `Content-Type: application/x-as-feature-event+xml`) with CSTA XML:
       - `<DoNotDisturbEvent>`
       - `<ForwardingEvent>` (`forwardImmediate`, `forwardBusy`, `forwardNoAns`)
  4. When the user changes DND or Call Forwarding from Nornia Web UI (or a peer phone like Yealink),
     `push_dfks_state_for_user()` immediately sends in-dialog `NOTIFY` packets -> Grandstream lights up /
     clears its native LCD Forwarding & DND icons instantaneously with zero reboot.
  5. When the user toggles DND or Call Forwarding from the Grandstream phone's native menu/softkeys
     (no `*21*` dialing needed!), Grandstream sends `SUBSCRIBE` with `<SetDoNotDisturb>` or `<SetForwarding>`
     XML -> this server updates Nornia PBX, syncs peer phones (e.g. Yealink), and sends confirming `NOTIFY`.
"""

from __future__ import annotations

import asyncio
import html
import ipaddress
import os
import re
import secrets
import socket
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set, Tuple

DFKS_UDP_PORT = int(os.environ.get("NORNIA_DFKS_PORT", "5068"))
CSTA_NS = "http://www.ecma-international.org/standards/ecma-323/csta/ed3"


@dataclass
class DFKSDialog:
    sip_username: str
    extension: str
    call_id: str
    remote_uri: str           # Phone's Contact URI (Request-URI for NOTIFY)
    local_uri: str            # Server's AOR URI (From URI in NOTIFY, e.g. <sip:0Tf1TSUx@app.nornia.com.tr>)
    remote_aor: str           # Phone's AOR URI (To URI in NOTIFY)
    remote_tag: str           # Phone's From tag (becomes To tag in NOTIFY)
    local_tag: str            # Server's To tag (becomes From tag in NOTIFY)
    route_set: List[str]      # Record-Route headers in UAS order for outbound NOTIFY Route: headers
    peer_addr: Tuple[str, int]
    local_ip: str
    local_port: int
    expires_at: float
    cseq_out: int = 1
    user_agent: str = ""
    tenant_id: str = "tenant-default"
    updated_at: float = field(default_factory=time.time)


def _is_trusted_sip_source(ip_str: str) -> bool:
    """Allows WireGuard (10.200.x.x), RFC1918 LAN, and localhost sources."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except Exception:
        return False


def _detect_local_ip_for_peer(peer_ip: str, peer_port: int = 5060) -> str:
    """Determines the local interface IP used to reach `peer_ip` without sending packets."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect((peer_ip, peer_port or 5060))
            return s.getsockname()[0]
        finally:
            s.close()
    except Exception:
        return "127.0.0.1"


def _strip_xml_ns(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _clean_sip_number(raw: str) -> str:
    s = str(raw or "").strip()
    if not s:
        return ""
    if s.lower().startswith("sip:") or s.lower().startswith("sips:") or s.lower().startswith("tel:"):
        s = s.split(":", 1)[1]
    if "@" in s:
        s = s.split("@", 1)[0]
    if ";" in s:
        s = s.split(";", 1)[0]
    return re.sub(r"[^\d+*#]", "", s)


def _extract_uri_from_header(hdr_val: str) -> str:
    """Extracts the SIP URI from `<sip:user@host:port;params>` or bare `sip:user@host`."""
    m = re.search(r"<([^>]+)>", hdr_val or "")
    if m:
        return m.group(1).strip()
    return str(hdr_val or "").split(";", 1)[0].strip()


def _extract_user_from_uri(uri: str) -> str:
    m = re.search(r"sips?:([^@;>\s]+)@", uri or "", re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return ""


def _extract_tag(hdr_val: str) -> str:
    m = re.search(r";\s*tag=([^;\s>]+)", hdr_val or "", re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _parse_sip_message(raw_bytes: bytes) -> Optional[Dict[str, Any]]:
    """Parses a raw UDP SIP packet into start_line, headers (lowercased list map), and body."""
    try:
        text = raw_bytes.decode("utf-8", errors="replace")
    except Exception:
        return None
    if "\r\n\r\n" in text:
        head, body = text.split("\r\n\r\n", 1)
        lines = head.split("\r\n")
    elif "\n\n" in text:
        head, body = text.split("\n\n", 1)
        lines = head.split("\n")
    else:
        head, body = text, ""
        lines = head.splitlines()

    if not lines:
        return None
    start_line = lines[0].strip()
    if not start_line:
        return None

    is_response = start_line.upper().startswith("SIP/2.0")
    method = ""
    request_uri = ""
    status_code = 0
    if is_response:
        parts = start_line.split(None, 2)
        if len(parts) >= 2 and parts[1].isdigit():
            status_code = int(parts[1])
    else:
        parts = start_line.split(None, 2)
        if len(parts) < 3 or not parts[2].upper().startswith("SIP/2.0"):
            return None
        method = parts[0].upper()
        request_uri = parts[1].strip()

    # Compact SIP header expansion
    compact_map = {
        "v": "via",
        "f": "from",
        "t": "to",
        "i": "call-id",
        "m": "contact",
        "l": "content-length",
        "c": "content-type",
        "o": "event",
    }
    headers: Dict[str, List[str]] = {}
    last_key = ""
    for line in lines[1:]:
        if not line:
            continue
        if line[0] in (" ", "\t") and last_key:
            headers[last_key][-1] += " " + line.strip()
            continue
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        kl = k.strip().lower()
        kl = compact_map.get(kl, kl)
        headers.setdefault(kl, []).append(v.strip())
        last_key = kl

    return {
        "is_response": is_response,
        "method": method,
        "request_uri": request_uri,
        "status_code": status_code,
        "headers": headers,
        "body": body.strip(),
    }


def _split_route_headers(rr_list: List[str]) -> List[str]:
    """Splits comma-separated Record-Route headers while preserving angle-bracketed URIs."""
    out: List[str] = []
    for raw in rr_list or []:
        # Split on commas outside <...>
        cur = []
        in_angle = False
        for ch in raw:
            if ch == "<":
                in_angle = True
                cur.append(ch)
            elif ch == ">":
                in_angle = False
                cur.append(ch)
            elif ch == "," and not in_angle:
                item = "".join(cur).strip()
                if item:
                    out.append(item)
                cur = []
            else:
                cur.append(ch)
        tail = "".join(cur).strip()
        if tail:
            out.append(tail)
    return out


def build_csta_dnd_xml(dnd_enabled: bool, device: str = "") -> str:
    val = "true" if dnd_enabled else "false"
    dev_esc = html.escape(str(device or ""))
    return (
        '<?xml version="1.0" encoding="ISO-8859-1"?>\r\n'
        f'<DoNotDisturbEvent xmlns="{CSTA_NS}">\r\n'
        f"  <device>{dev_esc}</device>\r\n"
        f"  <doNotDisturbOn>{val}</doNotDisturbOn>\r\n"
        "</DoNotDisturbEvent>\r\n"
    )


def build_csta_forwarding_xml(
    fwd_type: str,
    enabled: bool,
    target: str = "",
    ring_count: Optional[int] = None,
    device: str = "",
) -> str:
    """
    `fwd_type`: `forwardImmediate` | `forwardBusy` | `forwardNoAns`
    """
    status_str = "true" if (enabled and str(target or "").strip()) else "false"
    target_esc = html.escape(str(target or "").strip() if status_str == "true" else "")
    dev_esc = html.escape(str(device or ""))
    ring_line = ""
    if fwd_type == "forwardNoAns" and ring_count is not None:
        rc = max(1, min(20, int(ring_count)))
        ring_line = f"  <ringCount>{rc}</ringCount>\r\n"
    return (
        '<?xml version="1.0" encoding="ISO-8859-1"?>\r\n'
        f'<ForwardingEvent xmlns="{CSTA_NS}">\r\n'
        f"  <device>{dev_esc}</device>\r\n"
        f"  <forwardingType>{fwd_type}</forwardingType>\r\n"
        f"  <forwardStatus>{status_str}</forwardStatus>\r\n"
        f"  <forwardTo>{target_esc}</forwardTo>\r\n"
        f"{ring_line}"
        "</ForwardingEvent>\r\n"
    )


def parse_csta_subscribe_xml(body: str) -> Optional[Dict[str, Any]]:
    """
    Parses incoming `<SetDoNotDisturb>` or `<SetForwarding>` CSTA XML from a desk phone.
    Returns:
      - `{"action": "dnd", "enabled": bool}`
      - `{"action": "forwarding", "rule": "always"|"busy"|"no_answer", "enabled": bool, "target": str, "timeout": Optional[int]}`
      - or `None` if body is empty / unrecognized.
    """
    raw = str(body or "").strip()
    if not raw or "<" not in raw:
        return None
    try:
        root = ET.fromstring(raw)
    except Exception:
        return None

    root_name = _strip_xml_ns(root.tag)
    children: Dict[str, str] = {}
    for ch in root:
        children[_strip_xml_ns(ch.tag)] = (ch.text or "").strip()

    if root_name == "SetDoNotDisturb":
        val = children.get("doNotDisturbOn", "").lower()
        if val in ("true", "1", "yes", "on"):
            return {"action": "dnd", "enabled": True}
        if val in ("false", "0", "no", "off"):
            return {"action": "dnd", "enabled": False}
        return None

    if root_name == "SetForwarding":
        ft_raw = children.get("forwardingType", "").strip()
        ft_low = ft_raw.lower()
        if ft_low in ("forwardimmediate", "forwardall", "unconditional", "always"):
            rule = "always"
        elif ft_low in ("forwardbusy", "busy"):
            rule = "busy"
        elif ft_low in ("forwardnoans", "forwardnoreply", "forwardnoanswer", "noanswer", "delayed"):
            rule = "no_answer"
        else:
            rule = "always"

        en_raw = (children.get("activateForward") or children.get("forwardStatus") or "").lower()
        enabled = en_raw in ("true", "1", "yes", "on")
        target = _clean_sip_number(children.get("forwardDN") or children.get("forwardTo") or "")
        timeout_val: Optional[int] = None
        if rule == "no_answer" and children.get("ringCount", "").isdigit():
            rings = int(children["ringCount"])
            timeout_val = max(5, min(120, rings * 5))
        return {
            "action": "forwarding",
            "rule": rule,
            "enabled": enabled,
            "target": target,
            "timeout": timeout_val,
        }

    return None


class _DFKSUDPProtocol(asyncio.DatagramProtocol):
    def __init__(self, server: "NorniaDFKSServer"):
        self.server = server

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self.server._transport = transport  # type: ignore[assignment]

    def datagram_received(self, data: bytes, addr: Tuple[str, int]) -> None:
        asyncio.create_task(self.server._handle_datagram(data, addr))

    def error_received(self, exc: Exception) -> None:
        print(f"[SIP DFKS UDP Error] {exc}")


class NorniaDFKSServer:
    """Singleton BroadWorks `as-feature-event` UDP SIP responder & notifier."""

    def __init__(self, port: int = DFKS_UDP_PORT):
        self.port = port
        self._transport: Optional[asyncio.DatagramTransport] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        # Active dialogs keyed by call_id
        self._dialogs: Dict[str, DFKSDialog] = {}
        # Callbacks wired by backend/main.py on startup
        self._resolve_sip_username_fn: Optional[Callable[[str], Awaitable[Optional[Dict[str, Any]]]]] = None
        self._get_live_state_fn: Optional[Callable[[str], Awaitable[Optional[Dict[str, Any]]]]] = None
        self._apply_phone_change_fn: Optional[Callable[[str, str, Dict[str, Any]], Awaitable[Optional[Dict[str, Any]]]]] = None

    def configure_callbacks(
        self,
        resolve_sip_username_fn: Callable[[str], Awaitable[Optional[Dict[str, Any]]]],
        get_live_state_fn: Callable[[str], Awaitable[Optional[Dict[str, Any]]]],
        apply_phone_change_fn: Callable[[str, str, Dict[str, Any]], Awaitable[Optional[Dict[str, Any]]]],
    ) -> None:
        self._resolve_sip_username_fn = resolve_sip_username_fn
        self._get_live_state_fn = get_live_state_fn
        self._apply_phone_change_fn = apply_phone_change_fn

    async def start(self) -> None:
        if self._transport is not None:
            return
        self._loop = asyncio.get_running_loop()
        transport, _ = await self._loop.create_datagram_endpoint(
            lambda: _DFKSUDPProtocol(self),
            local_addr=("0.0.0.0", self.port),
        )
        self._transport = transport  # type: ignore[assignment]
        print(f"[SIP DFKS] BroadWorks as-feature-event UDP Sunucusu başlatıldı (0.0.0.0:{self.port}).")

    def _prune_expired(self) -> None:
        now = time.time()
        expired = [cid for cid, dlg in self._dialogs.items() if dlg.expires_at <= now]
        for cid in expired:
            self._dialogs.pop(cid, None)

    def get_active_dialogs_summary(self) -> List[Dict[str, Any]]:
        self._prune_expired()
        now = time.time()
        return [
            {
                "sip_username": d.sip_username,
                "extension": d.extension,
                "call_id": d.call_id,
                "remote_uri": d.remote_uri,
                "peer_addr": f"{d.peer_addr[0]}:{d.peer_addr[1]}",
                "user_agent": d.user_agent,
                "ttl_seconds": max(0, int(d.expires_at - now)),
            }
            for d in self._dialogs.values()
        ]

    def get_subscribed_sip_usernames_for_ext(self, ext: str) -> Set[str]:
        self._prune_expired()
        ext_s = str(ext or "").strip()
        return {d.sip_username for d in self._dialogs.values() if d.extension == ext_s}

    def _send_raw(self, payload: str, addr: Tuple[str, int]) -> None:
        if not self._transport:
            return
        try:
            self._transport.sendto(payload.encode("utf-8"), addr)
        except Exception as exc:
            print(f"[SIP DFKS Send Error] -> {addr}: {exc}")

    def _build_response(
        self,
        status_code: int,
        reason: str,
        msg: Dict[str, Any],
        local_tag: str = "",
        local_ip: str = "127.0.0.1",
        expires: Optional[int] = None,
    ) -> str:
        hdrs = msg["headers"]
        lines = [f"SIP/2.0 {status_code} {reason}"]
        for v in hdrs.get("via", []):
            lines.append(f"Via: {v}")
        for rr in hdrs.get("record-route", []):
            lines.append(f"Record-Route: {rr}")
        from_h = (hdrs.get("from") or [""])[0]
        to_h = (hdrs.get("to") or [""])[0]
        if local_tag and ";tag=" not in to_h.lower():
            to_h = f"{to_h};tag={local_tag}"
        call_id = (hdrs.get("call-id") or [""])[0]
        cseq = (hdrs.get("cseq") or [""])[0]
        lines.append(f"From: {from_h}")
        lines.append(f"To: {to_h}")
        lines.append(f"Call-ID: {call_id}")
        lines.append(f"CSeq: {cseq}")
        lines.append(f"Contact: <sip:dfks@{local_ip}:{self.port}>")
        if expires is not None:
            lines.append(f"Expires: {expires}")
        lines.append("User-Agent: Nornia-DFKS")
        lines.append("Content-Length: 0")
        return "\r\n".join(lines) + "\r\n\r\n"

    def _send_notify_xml(
        self,
        dlg: DFKSDialog,
        xml_body: str,
        terminated: bool = False,
    ) -> None:
        body_bytes = xml_body.encode("utf-8") if xml_body else b""
        branch = f"z9hG4bK-dfks-{secrets.token_hex(6)}"
        cseq_num = dlg.cseq_out
        dlg.cseq_out += 1

        rem_sec = max(0, int(dlg.expires_at - time.time()))
        sub_state = "terminated;reason=timeout" if (terminated or rem_sec <= 0) else f"active;expires={rem_sec}"

        lines = [
            f"NOTIFY {dlg.remote_uri} SIP/2.0",
            f"Via: SIP/2.0/UDP {dlg.local_ip}:{dlg.local_port};branch={branch};rport",
            "Max-Forwards: 70",
        ]
        # UAS sends Route headers in exact Record-Route order received on SUBSCRIBE
        for r in dlg.route_set:
            lines.append(f"Route: {r}")

        from_uri = dlg.local_uri if dlg.local_uri.startswith("<") else f"<{dlg.local_uri}>"
        to_uri = dlg.remote_aor if dlg.remote_aor.startswith("<") else f"<{dlg.remote_aor}>"
        lines.extend([
            f"From: {from_uri};tag={dlg.local_tag}",
            f"To: {to_uri};tag={dlg.remote_tag}",
            f"Call-ID: {dlg.call_id}",
            f"CSeq: {cseq_num} NOTIFY",
            f"Contact: <sip:dfks@{dlg.local_ip}:{dlg.local_port}>",
            "Event: as-feature-event",
            f"Subscription-State: {sub_state}",
            "User-Agent: Nornia-DFKS",
        ])
        if body_bytes:
            lines.append("Content-Type: application/x-as-feature-event+xml")
        lines.append(f"Content-Length: {len(body_bytes)}")
        pkt = "\r\n".join(lines) + "\r\n\r\n" + (xml_body if body_bytes else "")
        self._send_raw(pkt, dlg.peer_addr)

    async def _send_full_state_notifies(
        self,
        dlg: DFKSDialog,
        live_state: Dict[str, Any],
        only_feature: Optional[str] = None,
    ) -> None:
        """
        Pushes individual single-body `application/x-as-feature-event+xml` NOTIFY packets
        (avoids multipart/mixed parser bugs on older Grandstream GRP2602P 1.0.3.x firmware!).
        """
        st = live_state if isinstance(live_state, dict) else {}
        dnd_on = bool(st.get("dnd_enabled", False))
        f_alw = st.get("fwd_always") or {}
        f_bsy = st.get("fwd_busy") or {}
        f_noa = st.get("fwd_no_answer") or {}
        noa_timeout = max(5, min(120, int(f_noa.get("timeout") or 30)))
        ring_count = max(1, min(20, round(noa_timeout / 5)))

        chunks: List[str] = []
        if only_feature in (None, "dnd"):
            chunks.append(build_csta_dnd_xml(dnd_on, device=""))
        if only_feature in (None, "always", "forwarding"):
            chunks.append(
                build_csta_forwarding_xml(
                    "forwardImmediate",
                    bool(f_alw.get("active") and f_alw.get("target")),
                    str(f_alw.get("target") or ""),
                    device="",
                )
            )
        if only_feature in (None, "busy", "forwarding"):
            chunks.append(
                build_csta_forwarding_xml(
                    "forwardBusy",
                    bool(f_bsy.get("active") and f_bsy.get("target")),
                    str(f_bsy.get("target") or ""),
                    device="",
                )
            )
        if only_feature in (None, "no_answer", "forwarding"):
            chunks.append(
                build_csta_forwarding_xml(
                    "forwardNoAns",
                    bool(f_noa.get("active") and f_noa.get("target")),
                    str(f_noa.get("target") or ""),
                    ring_count=ring_count,
                    device="",
                )
            )

        for idx, xml_body in enumerate(chunks):
            self._send_notify_xml(dlg, xml_body, terminated=False)
            if idx + 1 < len(chunks):
                await asyncio.sleep(0.05)

    async def _handle_datagram(self, data: bytes, addr: Tuple[str, int]) -> None:
        if not _is_trusted_sip_source(addr[0]):
            return
        msg = _parse_sip_message(data)
        if not msg:
            return
        if msg["is_response"]:
            # 200 OK / error reply to our NOTIFY
            if msg["status_code"] >= 400:
                cid = (msg["headers"].get("call-id") or [""])[0]
                if msg["status_code"] in (404, 481) and cid in self._dialogs:
                    self._dialogs.pop(cid, None)
                print(f"[SIP DFKS] NOTIFY reply {msg['status_code']} from {addr} (Call-ID={cid})")
            return

        method = msg["method"]
        hdrs = msg["headers"]
        local_ip = _detect_local_ip_for_peer(addr[0], addr[1])

        if method == "OPTIONS":
            self._send_raw(self._build_response(200, "OK", msg, local_ip=local_ip), addr)
            return

        if method != "SUBSCRIBE":
            self._send_raw(self._build_response(405, "Method Not Allowed", msg, local_ip=local_ip), addr)
            return

        ev_hdr = (hdrs.get("event") or [""])[0].lower()
        if "as-feature-event" not in ev_hdr:
            self._send_raw(self._build_response(489, "Bad Event", msg, local_ip=local_ip), addr)
            return

        from_h = (hdrs.get("from") or [""])[0]
        to_h = (hdrs.get("to") or [""])[0]
        call_id = (hdrs.get("call-id") or [""])[0]
        contact_h = (hdrs.get("contact") or [""])[0]
        ua_h = (hdrs.get("user-agent") or [""])[0]
        exp_raw = (hdrs.get("expires") or ["3600"])[0]
        try:
            expires = max(0, min(7200, int(re.sub(r"[^\d]", "", exp_raw) or "3600")))
        except Exception:
            expires = 3600

        from_uri = _extract_uri_from_header(from_h)
        to_uri = _extract_uri_from_header(to_h)
        contact_uri = _extract_uri_from_header(contact_h) or from_uri
        from_tag = _extract_tag(from_h)
        to_tag = _extract_tag(to_h)

        sip_user = _extract_user_from_uri(from_uri) or _extract_user_from_uri(msg["request_uri"]) or _extract_user_from_uri(to_uri)
        if not sip_user or not call_id:
            self._send_raw(self._build_response(400, "Bad Request", msg, local_ip=local_ip), addr)
            return

        # Verify SIP username against Nornia users / sip_devices
        resolved: Optional[Dict[str, Any]] = None
        if self._resolve_sip_username_fn:
            try:
                resolved = await self._resolve_sip_username_fn(sip_user)
            except Exception as exc:
                print(f"[SIP DFKS Resolve Error] {sip_user}: {exc}")
        if not resolved or not resolved.get("extension"):
            print(f"[SIP DFKS] Rejecting unknown SIP user '{sip_user}' from {addr}")
            self._send_raw(self._build_response(403, "Forbidden", msg, local_ip=local_ip), addr)
            return

        ext_s = str(resolved["extension"]).strip()
        existing = self._dialogs.get(call_id)
        local_tag = to_tag or (existing.local_tag if existing else f"dfks-{secrets.token_hex(5)}")
        rr_list = _split_route_headers(hdrs.get("record-route", []))
        if not rr_list and existing:
            rr_list = list(existing.route_set)

        # Immediately answer 200 OK to phone
        self._send_raw(
            self._build_response(200, "OK", msg, local_tag=local_tag, local_ip=local_ip, expires=expires),
            addr,
        )

        # Unsubscribe (Expires: 0)
        if expires == 0:
            dlg_end = self._dialogs.pop(call_id, existing)
            if dlg_end:
                dlg_end.expires_at = 0
                self._send_notify_xml(dlg_end, "", terminated=True)
            print(f"[SIP DFKS] Unsubscribed: ext={ext_s}, sip={sip_user}, Call-ID={call_id}")
            return

        # Keep at most 1 active dialog per (sip_username) to avoid stale duplicate dialogs after phone reboot
        stale_cids = [
            cid for cid, d in self._dialogs.items()
            if d.sip_username.lower() == sip_user.lower() and cid != call_id
        ]
        for scid in stale_cids:
            self._dialogs.pop(scid, None)

        dlg = DFKSDialog(
            sip_username=sip_user,
            extension=ext_s,
            call_id=call_id,
            remote_uri=contact_uri,
            local_uri=to_uri or from_uri,
            remote_aor=from_uri,
            remote_tag=from_tag,
            local_tag=local_tag,
            route_set=rr_list,
            peer_addr=addr,
            local_ip=local_ip,
            local_port=self.port,
            expires_at=time.time() + expires,
            cseq_out=(existing.cseq_out if existing else 1),
            user_agent=ua_h,
            tenant_id=str(resolved.get("tenant_id") or "tenant-default").strip() or "tenant-default",
            updated_at=time.time(),
        )
        self._dialogs[call_id] = dlg

        parsed_cmd = parse_csta_subscribe_xml(msg.get("body", ""))
        if parsed_cmd:
            print(
                f"[SIP DFKS Phone->PBX] ext={ext_s}, sip={sip_user}, cmd={parsed_cmd}, ua={ua_h or '-'}"
            )
            fresh_state: Optional[Dict[str, Any]] = None
            if self._apply_phone_change_fn:
                try:
                    fresh_state = await self._apply_phone_change_fn(ext_s, sip_user, parsed_cmd)
                except Exception as exc:
                    print(f"[SIP DFKS Apply Change Error] ext={ext_s}: {exc}")
            if not fresh_state and self._get_live_state_fn:
                try:
                    fresh_state = await self._get_live_state_fn(ext_s)
                except Exception:
                    fresh_state = None
            if fresh_state is not None:
                only_feat = "dnd" if parsed_cmd["action"] == "dnd" else parsed_cmd.get("rule")
                await self._send_full_state_notifies(dlg, fresh_state, only_feature=only_feat)
            return

        # Initial / refresh SUBSCRIBE with empty body -> push full live state immediately
        print(
            f"[SIP DFKS Subscribed] ext={ext_s}, sip={sip_user}, expires={expires}s, "
            f"contact={contact_uri}, routes={len(rr_list)}, ua={ua_h or '-'}"
        )
        if self._get_live_state_fn:
            try:
                cur_state = await self._get_live_state_fn(ext_s)
                if cur_state is not None:
                    await asyncio.sleep(0.05)
                    await self._send_full_state_notifies(dlg, cur_state, only_feature=None)
            except Exception as exc:
                print(f"[SIP DFKS Initial Notify Error] ext={ext_s}: {exc}")

    def push_live_state_sync(
        self,
        ext: str,
        live_state: Dict[str, Any],
        exclude_sip_username: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Set[str]:
        """
        Thread-safe push of live DND + 3-level Call Forwarding state to all active DFKS
        subscriptions belonging to `ext` (scoped to `tenant_id` when provided).
        """
        self._prune_expired()
        ext_s = str(ext or "").strip()
        excl = str(exclude_sip_username or "").strip().lower()
        t_filter = str(tenant_id or "").strip()
        if not ext_s or not self._loop or not self._transport:
            return set()

        def _tid_matches(d_tid: str) -> bool:
            if not t_filter or t_filter in ("all", "global"):
                return True
            if t_filter in ("tenant-default", "default"):
                return d_tid in ("", "tenant-default", "default")
            return d_tid == t_filter

        matched_dialogs = [
            d for d in self._dialogs.values()
            if d.extension == ext_s
            and _tid_matches(str(getattr(d, "tenant_id", "tenant-default") or "tenant-default"))
            and (not excl or d.sip_username.lower() != excl)
        ]
        if not matched_dialogs:
            return set()

        notified_users: Set[str] = set()
        state_copy = dict(live_state or {})
        for dlg in matched_dialogs:
            notified_users.add(dlg.sip_username)
            try:
                asyncio.run_coroutine_threadsafe(
                    self._send_full_state_notifies(dlg, state_copy, only_feature=None),
                    self._loop,
                )
            except Exception as exc:
                print(f"[SIP DFKS Push Error] ext={ext_s}, sip={dlg.sip_username}: {exc}")
        if notified_users:
            print(
                f"[SIP DFKS PBX->Phone] Dahili {ext_s} anlık as-feature-event NOTIFY gönderildi: "
                f"{', '.join(sorted(notified_users))}"
            )
        return notified_users


_DFKS_SINGLETON: Optional[NorniaDFKSServer] = None


def get_dfks_server() -> NorniaDFKSServer:
    global _DFKS_SINGLETON
    if _DFKS_SINGLETON is None:
        _DFKS_SINGLETON = NorniaDFKSServer(port=DFKS_UDP_PORT)
    return _DFKS_SINGLETON
