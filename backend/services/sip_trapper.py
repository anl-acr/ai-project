import os
import sys
import time
import select
import datetime
import asyncio
import threading
import subprocess
import shutil
import socket
import re
import struct
from typing import List, Dict, Any, Optional


def _detect_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.3)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


PJSIP_LOGGER_HDR_RE = re.compile(
    r"<---\s*(Received|Transmitting)\s+SIP\s+(request|response)\s+\(\d+\s+bytes\)\s+(?:from|to)\s+([A-Za-z0-9]+):\[?([0-9a-fA-F.:]+)\]?:(\d+)\s*--->",
    re.IGNORECASE,
)

AST_LOG_LINE_PREFIX_RE = re.compile(r"^\[?\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}")


class SipTrapper:
    """
    Real-Time Multi-Source SIP Packet Trapper & Parser Engine.
    Sources (automatically deduplicated):
      1. Asterisk live console PJSIP logger (`asterisk -r -n -vvvv` + `pjsip set logger on`)
         — captures plaintext UDP, TCP, TLS, AND decrypted WebRTC WSS (8089) SIP frames.
      2. Asterisk log file tailer (`/var/log/asterisk/full` or `/var/log/asterisk/messages`).
      3. Wire-level `tcpdump` sniffer with instant 80ms timeout packet flush.
      4. Browser WebRTC SIP.js transport relay (`POST /api/sip-debugger/ingest`) &
         Asterisk AMI live channel signalling fallback (`register_ami_hooks`).
    """

    def __init__(self):
        self.is_running = True
        self.local_ip = _detect_local_ip()
        self.packet_seq = 0
        self.calls: Dict[str, Dict[str, Any]] = {}
        self.packets: List[Dict[str, Any]] = []
        self.max_packets = 2500
        self.max_calls = 500
        self.subscribers = set()
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()

        # Sliding deduplication cache: fingerprint -> monotonic timestamp
        self._recent_fps: Dict[str, float] = {}
        # Track recent call endpoints seen via raw verbatim SIP so AMI fallback never duplicates them
        self._recent_raw_endpoints: Dict[str, float] = {}
        # Track AMI synthesized dialog state keyed by Linkedid/Uniqueid
        self._ami_dialogs: Dict[str, Dict[str, Any]] = {}

        self.capture_proc: Optional[subprocess.Popen] = None
        self.ast_cli_proc: Optional[subprocess.Popen] = None
        self._tcpdump_thread: Optional[threading.Thread] = None
        self._ast_cli_thread: Optional[threading.Thread] = None
        self._ast_log_thread: Optional[threading.Thread] = None
        self.active_sources: set = set(["webrtc_ingest", "ami_live"])

        self.pcap_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data",
            "pcaps",
        )
        os.makedirs(self.pcap_dir, exist_ok=True)
        self._start_background_collectors()

    def bind_event_loop(self, loop: Optional[asyncio.AbstractEventLoop] = None):
        if loop is not None:
            self.loop = loop
            return
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

    def _enable_asterisk_pjsip_logger_cli(self, enable: bool = True):
        ast_bin = shutil.which("asterisk")
        if not ast_bin:
            return
        cmd_str = "pjsip set logger on" if enable else "pjsip set logger off"
        try:
            subprocess.run(
                [ast_bin, "-rx", cmd_str],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=1.8,
                check=False,
            )
        except Exception:
            pass

    def _start_background_collectors(self):
        self._enable_asterisk_pjsip_logger_cli(True)
        self._try_start_asterisk_cli_stream()
        self._try_start_asterisk_log_tailer()
        self._try_start_live_sniffer()

    def _parse_pjsip_logger_block(self, meta: Dict[str, Any], lines: List[str]):
        if not lines or not self.is_running:
            return
        raw_block = "\r\n".join(lines).strip()
        if not raw_block:
            return
        direction = meta.get("direction", "Received")
        proto = (meta.get("proto") or "UDP").upper()
        remote_ip = meta.get("ip") or "127.0.0.1"
        remote_port = int(meta.get("port") or 5060)
        local_port = 8089 if proto in ("WSS", "WS") else (5061 if proto == "TLS" else 5060)

        if direction.lower() == "received":
            src_ip, src_port = remote_ip, remote_port
            dst_ip, dst_port = self.local_ip, local_port
        else:
            src_ip, src_port = self.local_ip, local_port
            dst_ip, dst_port = remote_ip, remote_port

        self.parse_raw_sip(
            raw_block,
            src_ip=src_ip,
            src_port=src_port,
            dst_ip=dst_ip,
            dst_port=dst_port,
            protocol=proto,
            source="pjsip_logger",
        )

    def _try_start_asterisk_cli_stream(self):
        """
        Streams real-time PJSIP logger frames directly from `asterisk -r -n -vvvv`.
        Captures plaintext UDP, TCP, TLS, and decrypted WebRTC WSS SIP packets on production PBX.
        """
        if self._ast_cli_thread and self._ast_cli_thread.is_alive():
            return
        ast_bin = shutil.which("asterisk")
        if not ast_bin:
            return

        def _cli_worker():
            while True:
                if not self.is_running:
                    time.sleep(2.0)
                    continue
                proc = None
                try:
                    self._enable_asterisk_pjsip_logger_cli(True)
                    proc = subprocess.Popen(
                        [ast_bin, "-r", "-n", "-vvvv"],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.DEVNULL,
                        bufsize=0,
                    )
                    self.ast_cli_proc = proc
                    self.active_sources.add("asterisk_pjsip_cli")

                    fd = proc.stdout.fileno()
                    text_buf = ""
                    cur_meta: Optional[Dict[str, Any]] = None
                    sip_lines: List[str] = []

                    while proc.poll() is None:
                        rlist, _, _ = select.select([fd], [], [], 0.08)
                        if not rlist:
                            # 80ms quiet period -> flush completed SIP message immediately!
                            if cur_meta and sip_lines:
                                self._parse_pjsip_logger_block(cur_meta, sip_lines)
                                cur_meta = None
                                sip_lines = []
                            continue

                        chunk = os.read(fd, 8192)
                        if not chunk:
                            break
                        text_buf += chunk.decode("utf-8", errors="replace")
                        while "\n" in text_buf:
                            raw_line, text_buf = text_buf.split("\n", 1)
                            line = raw_line.rstrip("\r")
                            clean_line = re.sub(r"\x1b\[[0-9;]*m", "", line)

                            m = PJSIP_LOGGER_HDR_RE.search(clean_line)
                            if m:
                                if cur_meta and sip_lines:
                                    self._parse_pjsip_logger_block(cur_meta, sip_lines)
                                cur_meta = {
                                    "direction": m.group(1),
                                    "kind": m.group(2),
                                    "proto": m.group(3),
                                    "ip": m.group(4),
                                    "port": int(m.group(5)),
                                }
                                sip_lines = []
                                continue

                            if cur_meta is not None:
                                if (
                                    AST_LOG_LINE_PREFIX_RE.match(clean_line)
                                    or "VERBOSE[" in clean_line
                                    or "NOTICE[" in clean_line
                                    or "WARNING[" in clean_line
                                    or "ERROR[" in clean_line
                                    or clean_line.startswith("    -- ")
                                    or clean_line.startswith("  == ")
                                ):
                                    if sip_lines:
                                        self._parse_pjsip_logger_block(cur_meta, sip_lines)
                                    cur_meta = None
                                    sip_lines = []
                                else:
                                    sip_lines.append(clean_line)
                except Exception:
                    pass
                finally:
                    self.active_sources.discard("asterisk_pjsip_cli")
                    if proc is not None:
                        try:
                            proc.terminate()
                        except Exception:
                            pass
                time.sleep(5.0)

        self._ast_cli_thread = threading.Thread(target=_cli_worker, daemon=True)
        self._ast_cli_thread.start()

    def _try_start_asterisk_log_tailer(self):
        """
        Fallback live tailer for `/var/log/asterisk/full` or `/var/log/asterisk/messages`
        in case `asterisk.ctl` socket permissions restrict non-root CLI attach.
        """
        if self._ast_log_thread and self._ast_log_thread.is_alive():
            return
        candidates = ["/var/log/asterisk/full", "/var/log/asterisk/messages"]
        log_path = next((p for p in candidates if os.path.isfile(p) and os.access(p, os.R_OK)), None)
        if not log_path:
            return

        def _log_worker():
            cur_meta: Optional[Dict[str, Any]] = None
            sip_lines: List[str] = []
            try:
                self.active_sources.add("asterisk_log_file")
                with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                    f.seek(0, os.SEEK_END)
                    last_activity = time.monotonic()
                    while True:
                        if not self.is_running:
                            time.sleep(1.0)
                            f.seek(0, os.SEEK_END)
                            continue
                        line = f.readline()
                        if not line:
                            if cur_meta and sip_lines and (time.monotonic() - last_activity) > 0.08:
                                self._parse_pjsip_logger_block(cur_meta, sip_lines)
                                cur_meta = None
                                sip_lines = []
                            try:
                                if os.path.getsize(log_path) < f.tell():
                                    f.seek(0, os.SEEK_END)
                            except Exception:
                                pass
                            time.sleep(0.05)
                            continue

                        last_activity = time.monotonic()
                        clean_line = line.rstrip("\r\n")
                        m = PJSIP_LOGGER_HDR_RE.search(clean_line)
                        if m:
                            if cur_meta and sip_lines:
                                self._parse_pjsip_logger_block(cur_meta, sip_lines)
                            cur_meta = {
                                "direction": m.group(1),
                                "kind": m.group(2),
                                "proto": m.group(3),
                                "ip": m.group(4),
                                "port": int(m.group(5)),
                            }
                            sip_lines = []
                            continue

                        if cur_meta is not None:
                            if AST_LOG_LINE_PREFIX_RE.match(clean_line) or "VERBOSE[" in clean_line:
                                if sip_lines:
                                    self._parse_pjsip_logger_block(cur_meta, sip_lines)
                                cur_meta = None
                                sip_lines = []
                            else:
                                sip_lines.append(clean_line)
            except Exception:
                self.active_sources.discard("asterisk_log_file")

        self._ast_log_thread = threading.Thread(target=_log_worker, daemon=True)
        self._ast_log_thread.start()

    def _try_start_live_sniffer(self):
        """
        Wire-level `tcpdump` sniffer on ports 5060/5061 with 80ms `select` flush
        so the final packet in any burst is emitted immediately without 1-packet lag.
        """
        if self._tcpdump_thread and self._tcpdump_thread.is_alive():
            return
        tcpdump_bin = shutil.which("tcpdump")
        if not tcpdump_bin:
            return

        def _sniffer_worker():
            proc = None
            try:
                cmd = [
                    tcpdump_bin,
                    "-l",
                    "-n",
                    "-s",
                    "0",
                    "-A",
                    "-i",
                    "any",
                    "port 5060 or port 5061",
                ]
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    bufsize=0,
                )
                time.sleep(0.25)
                if proc.poll() is not None:
                    return
                self.capture_proc = proc
                self.active_sources.add("tcpdump")

                fd = proc.stdout.fileno()
                text_buf = ""
                buf_lines: List[str] = []
                cur_meta = {
                    "src_ip": "127.0.0.1",
                    "src_port": 5060,
                    "dst_ip": "127.0.0.1",
                    "dst_port": 5060,
                    "protocol": "UDP",
                }
                hdr_re = re.compile(
                    r"IP\s+(\d+\.\d+\.\d+\.\d+)\.(\d+)\s*>\s*(\d+\.\d+\.\d+\.\d+)\.(\d+):"
                )

                def _flush_buf():
                    if buf_lines and self.is_running:
                        raw_candidate = "\n".join(buf_lines)
                        self.parse_raw_sip(
                            raw_candidate,
                            cur_meta["src_ip"],
                            cur_meta["src_port"],
                            cur_meta["dst_ip"],
                            cur_meta["dst_port"],
                            protocol=cur_meta["protocol"],
                            source="tcpdump",
                        )
                    buf_lines.clear()

                while proc.poll() is None:
                    rlist, _, _ = select.select([fd], [], [], 0.08)
                    if not rlist:
                        if buf_lines:
                            _flush_buf()
                        continue
                    chunk = os.read(fd, 8192)
                    if not chunk:
                        break
                    text_buf += chunk.decode("utf-8", errors="replace")
                    while "\n" in text_buf:
                        raw_line, text_buf = text_buf.split("\n", 1)
                        line = raw_line.rstrip("\r")
                        if not self.is_running:
                            buf_lines.clear()
                            continue
                        m = hdr_re.search(line)
                        if m:
                            _flush_buf()
                            cur_meta = {
                                "src_ip": m.group(1),
                                "src_port": int(m.group(2)),
                                "dst_ip": m.group(3),
                                "dst_port": int(m.group(4)),
                                "protocol": "TCP" if "Flags [" in line else "UDP",
                            }
                        else:
                            buf_lines.append(line)
                            if len(buf_lines) > 140:
                                _flush_buf()
            except Exception:
                pass
            finally:
                self.active_sources.discard("tcpdump")

        self._tcpdump_thread = threading.Thread(target=_sniffer_worker, daemon=True)
        self._tcpdump_thread.start()

    def register_ami_hooks(self, manager):
        """
        Attaches lightweight AMI event listeners (`Newchannel`, `Newstate`, `Hangup`)
        so that even when backend connects to a remote Asterisk without root/log access,
        real-time call flows appear instantaneously in sngrep & SIP Capture.
        Automatically yields whenever verbatim raw SIP was already captured for the call.
        """
        self.bind_event_loop()
        try:
            asyncio.create_task(
                asyncio.wait_for(
                    manager.send_action({"Action": "Command", "Command": "pjsip set logger on"}),
                    timeout=1.5,
                )
            )
        except Exception:
            pass

        @manager.register_event("Newchannel")
        def _on_ami_newchannel(m, event):
            try:
                self.ingest_ami_event("Newchannel", event)
            except Exception:
                pass

        @manager.register_event("Newstate")
        def _on_ami_newstate(m, event):
            try:
                self.ingest_ami_event("Newstate", event)
            except Exception:
                pass

        @manager.register_event("Hangup")
        def _on_ami_hangup(m, event):
            try:
                self.ingest_ami_event("Hangup", event)
            except Exception:
                pass

    def _has_recent_raw_endpoint_activity(self, caller: str, callee: str) -> bool:
        now_m = time.monotonic()
        for k in (str(caller or "").strip(), str(callee or "").strip()):
            if not k or k in ("unknown", "s"):
                continue
            ts = self._recent_raw_endpoints.get(k)
            if ts is not None and (now_m - ts) < 5.0:
                return True
        return False

    def ingest_ami_event(self, event_type: str, event: Any):
        """Synthesizes real-time SIP dialog packets from AMI events if raw PJSIP capture isn't active for that leg."""
        if not self.is_running or not hasattr(event, "get"):
            return
        ch = str(event.get("Channel") or "").strip()
        if not ch or ch.lower().startswith("local/") or ch.lower().startswith("audiosocket/"):
            return

        uid = str(event.get("Uniqueid") or "").strip()
        lid = str(event.get("Linkedid") or uid).strip()
        if not lid:
            return

        caller = str(event.get("CallerIDNum") or "").strip() or "unknown"
        caller_name = str(event.get("CallerIDName") or "").strip()
        exten = str(event.get("Exten") or event.get("ConnectedLineNum") or "").strip() or "s"

        call_id = f"ami-{lid}@{self.local_ip}"
        if call_id in self.calls and self.calls[call_id].get("source") not in (None, "ami"):
            return

        peer_match = re.match(r"^(?:PJSIP|SIP)/([^-\;@/]+)", ch, re.IGNORECASE)
        peer_name = peer_match.group(1) if peer_match else "endpoint"
        is_internal = peer_name.isdigit() and len(peer_name) <= 6
        remote_ip = "192.168.1.100" if is_internal else "185.88.12.10"

        dlg = self._ami_dialogs.get(lid)
        if event_type == "Newchannel":
            if dlg is not None:
                return
            # Skip if raw verbatim SIP (WebRTC relay / PJSIP logger / tcpdump) already captured this endpoint
            if self._has_recent_raw_endpoint_activity(caller, exten):
                return
            dlg = {
                "call_id": call_id,
                "caller": caller,
                "caller_name": caller_name,
                "callee": exten,
                "remote_ip": remote_ip,
                "cseq": 1,
                "answered": False,
                "ringing_sent": False,
                "ended": False,
            }
            self._ami_dialogs[lid] = dlg
            if len(self._ami_dialogs) > 500:
                for old_k in list(self._ami_dialogs.keys())[:150]:
                    self._ami_dialogs.pop(old_k, None)

            disp = f'"{caller_name}" ' if caller_name and caller_name != caller else ""
            inv_raw = (
                f"INVITE sip:{exten}@{self.local_ip}:5060 SIP/2.0\r\n"
                f"Via: SIP/2.0/UDP {remote_ip}:5060;rport;branch=z9hG4bK-{uid.replace('.', '')}\r\n"
                f"From: {disp}<sip:{caller}@{remote_ip}>;tag=as{uid[-6:]}\r\n"
                f"To: <sip:{exten}@{self.local_ip}>\r\n"
                f"Call-ID: {call_id}\r\n"
                f"CSeq: 1 INVITE\r\n"
                f"Channel: {ch}\r\n"
                f"User-Agent: Asterisk-AMI-LiveMonitor\r\n"
                f"Content-Type: application/sdp\r\n"
                f"Content-Length: 118\r\n\r\n"
                f"v=0\r\n"
                f"c=IN IP4 {remote_ip}\r\n"
                f"t=0 0\r\n"
                f"m=audio 16400 RTP/AVP 8 0 101\r\n"
                f"a=rtpmap:8 PCMA/8000\r\n"
            )
            try_raw = (
                f"SIP/2.0 100 Trying\r\n"
                f"Via: SIP/2.0/UDP {remote_ip}:5060;rport=5060\r\n"
                f"From: {disp}<sip:{caller}@{remote_ip}>;tag=as{uid[-6:]}\r\n"
                f"To: <sip:{exten}@{self.local_ip}>\r\n"
                f"Call-ID: {call_id}\r\n"
                f"CSeq: 1 INVITE\r\n"
                f"Server: Asterisk PBX\r\n"
                f"Content-Length: 0\r\n\r\n"
            )
            self.parse_raw_sip(inv_raw, remote_ip, 5060, self.local_ip, 5060, protocol="UDP", source="ami")
            self.parse_raw_sip(try_raw, self.local_ip, 5060, remote_ip, 5060, protocol="UDP", source="ami")

        elif event_type == "Newstate" and dlg and not dlg["ended"]:
            st_desc = str(event.get("ChannelStateDesc") or "").strip().lower()
            st_code = str(event.get("ChannelState") or "").strip()
            if (st_desc == "ringing" or st_code == "5") and not dlg["ringing_sent"]:
                dlg["ringing_sent"] = True
                ring_raw = (
                    f"SIP/2.0 180 Ringing\r\n"
                    f"From: <sip:{dlg['caller']}@{dlg['remote_ip']}>\r\n"
                    f"To: <sip:{dlg['callee']}@{self.local_ip}>;tag=pbx{lid[-5:]}\r\n"
                    f"Call-ID: {call_id}\r\n"
                    f"CSeq: 1 INVITE\r\n"
                    f"Channel: {ch}\r\n"
                    f"Content-Length: 0\r\n\r\n"
                )
                self.parse_raw_sip(ring_raw, self.local_ip, 5060, dlg["remote_ip"], 5060, protocol="UDP", source="ami")
            elif (st_desc == "up" or st_code == "6") and not dlg["answered"]:
                dlg["answered"] = True
                ok_raw = (
                    f"SIP/2.0 200 OK\r\n"
                    f"From: <sip:{dlg['caller']}@{dlg['remote_ip']}>\r\n"
                    f"To: <sip:{dlg['callee']}@{self.local_ip}>;tag=pbx{lid[-5:]}\r\n"
                    f"Call-ID: {call_id}\r\n"
                    f"CSeq: 1 INVITE\r\n"
                    f"Channel: {ch}\r\n"
                    f"Content-Type: application/sdp\r\n"
                    f"Content-Length: 92\r\n\r\n"
                    f"v=0\r\n"
                    f"c=IN IP4 {self.local_ip}\r\n"
                    f"m=audio 14200 RTP/AVP 8 101\r\n"
                )
                ack_raw = (
                    f"ACK sip:{dlg['callee']}@{self.local_ip}:5060 SIP/2.0\r\n"
                    f"From: <sip:{dlg['caller']}@{dlg['remote_ip']}>\r\n"
                    f"To: <sip:{dlg['callee']}@{self.local_ip}>;tag=pbx{lid[-5:]}\r\n"
                    f"Call-ID: {call_id}\r\n"
                    f"CSeq: 1 ACK\r\n"
                    f"Content-Length: 0\r\n\r\n"
                )
                self.parse_raw_sip(ok_raw, self.local_ip, 5060, dlg["remote_ip"], 5060, protocol="UDP", source="ami")
                self.parse_raw_sip(ack_raw, dlg["remote_ip"], 5060, self.local_ip, 5060, protocol="UDP", source="ami")

        elif event_type == "Hangup" and dlg and not dlg["ended"]:
            dlg["ended"] = True
            cause = str(event.get("Cause") or "16").strip()
            cause_txt = str(event.get("Cause-txt") or "").strip()
            if dlg["answered"]:
                bye_raw = (
                    f"BYE sip:{dlg['callee']}@{self.local_ip}:5060 SIP/2.0\r\n"
                    f"From: <sip:{dlg['caller']}@{dlg['remote_ip']}>\r\n"
                    f"To: <sip:{dlg['callee']}@{self.local_ip}>;tag=pbx{lid[-5:]}\r\n"
                    f"Call-ID: {call_id}\r\n"
                    f"CSeq: 2 BYE\r\n"
                    f"Reason: Q.850;cause={cause};text=\"{cause_txt}\"\r\n"
                    f"Content-Length: 0\r\n\r\n"
                )
                ok_bye = (
                    f"SIP/2.0 200 OK\r\n"
                    f"From: <sip:{dlg['caller']}@{dlg['remote_ip']}>\r\n"
                    f"To: <sip:{dlg['callee']}@{self.local_ip}>;tag=pbx{lid[-5:]}\r\n"
                    f"Call-ID: {call_id}\r\n"
                    f"CSeq: 2 BYE\r\n"
                    f"Content-Length: 0\r\n\r\n"
                )
                self.parse_raw_sip(bye_raw, dlg["remote_ip"], 5060, self.local_ip, 5060, protocol="UDP", source="ami")
                self.parse_raw_sip(ok_bye, self.local_ip, 5060, dlg["remote_ip"], 5060, protocol="UDP", source="ami")
            else:
                sip_err = "487 Request Terminated"
                if cause == "17":
                    sip_err = "486 Busy Here"
                elif cause in ("18", "19", "20"):
                    sip_err = "480 Temporarily Unavailable"
                elif cause == "21":
                    sip_err = "603 Decline"
                elif cause in ("1", "28"):
                    sip_err = "404 Not Found"
                err_raw = (
                    f"SIP/2.0 {sip_err}\r\n"
                    f"From: <sip:{dlg['caller']}@{dlg['remote_ip']}>\r\n"
                    f"To: <sip:{dlg['callee']}@{self.local_ip}>;tag=pbx{lid[-5:]}\r\n"
                    f"Call-ID: {call_id}\r\n"
                    f"CSeq: 1 INVITE\r\n"
                    f"Reason: Q.850;cause={cause};text=\"{cause_txt}\"\r\n"
                    f"Content-Length: 0\r\n\r\n"
                )
                self.parse_raw_sip(err_raw, self.local_ip, 5060, dlg["remote_ip"], 5060, protocol="UDP", source="ami")

    def _is_duplicate_frame(self, call_id: str, cseq: str, first_line: str) -> bool:
        now_m = time.monotonic()
        if len(self._recent_fps) > 1200:
            cutoff = now_m - 4.0
            self._recent_fps = {k: ts for k, ts in self._recent_fps.items() if ts > cutoff}
        fp = f"{call_id}|{cseq}|{first_line}"
        prev_ts = self._recent_fps.get(fp)
        if prev_ts is not None and (now_m - prev_ts) < 2.2:
            return True
        self._recent_fps[fp] = now_m
        return False

    def _serialize_call_summary(self, c: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "call_id": c["call_id"],
            "start_time": c["start_time"],
            "last_time": c["last_time"],
            "updated_seq": c.get("updated_seq", 0),
            "caller": c["caller"],
            "callee": c["callee"],
            "initial_method": c["initial_method"],
            "last_status": c["last_status"],
            "packet_count": c["packet_count"],
            "source": c.get("source", "live"),
            "nodes": list(c["nodes"]),
        }

    def _broadcast_packet(self, packet: Dict[str, Any], call_summary: Dict[str, Any]):
        if not self.subscribers or self.loop is None:
            return
        payload = {
            "type": "sip_packet",
            "is_running": self.is_running,
            "total_buffered": len(self.packets),
            "packet": packet,
            "call": call_summary,
        }

        async def _push_all():
            stale = []
            for ws in list(self.subscribers):
                try:
                    await ws.send_json(payload)
                except Exception:
                    stale.append(ws)
            for ws in stale:
                self.subscribers.discard(ws)

        try:
            self.loop.call_soon_threadsafe(lambda: asyncio.create_task(_push_all()))
        except Exception:
            pass

    def _process_packet(self, packet: Dict[str, Any]):
        """Store packet in chronological capture buffer, update Call-ID session, and broadcast over WebSocket."""
        with self._lock:
            self.packet_seq += 1
            seq = self.packet_seq
            packet["id"] = seq
            packet.setdefault("protocol", "UDP")
            raw_bytes = (packet.get("raw") or "").encode("utf-8", errors="replace")
            packet["length"] = len(raw_bytes)

            self.packets.append(packet)
            if len(self.packets) > self.max_packets:
                self.packets.pop(0)

            call_id = packet["call_id"]
            if call_id not in self.calls:
                if len(self.calls) >= self.max_calls:
                    oldest_key = min(
                        self.calls.keys(),
                        key=lambda k: self.calls[k].get("updated_seq", 0),
                    )
                    self.calls.pop(oldest_key, None)
                self.calls[call_id] = {
                    "call_id": call_id,
                    "start_time": packet["timestamp"],
                    "last_time": packet["timestamp"],
                    "updated_seq": seq,
                    "caller": packet.get("caller", "Bilinmeyen"),
                    "callee": packet.get("callee", "Bilinmeyen"),
                    "initial_method": packet["method"],
                    "last_status": packet["status"],
                    "packet_count": 0,
                    "source": packet.get("source", "live"),
                    "messages": [],
                    "nodes": set(
                        [
                            f"{packet['src_ip']}:{packet['src_port']}",
                            f"{packet['dst_ip']}:{packet['dst_port']}",
                        ]
                    ),
                }

            call = self.calls[call_id]
            call["packet_count"] += 1
            call["last_time"] = packet["timestamp"]
            call["updated_seq"] = seq
            call["last_status"] = packet["status"]
            if packet.get("source") and packet.get("source") != "ami":
                call["source"] = packet["source"]
            call["nodes"].add(f"{packet['src_ip']}:{packet['src_port']}")
            call["nodes"].add(f"{packet['dst_ip']}:{packet['dst_port']}")
            call["messages"].append(packet)
            call_summary = self._serialize_call_summary(call)

        self._broadcast_packet(packet, call_summary)

    def parse_raw_sip(
        self,
        raw_text: str,
        src_ip: str,
        src_port: int,
        dst_ip: str,
        dst_port: int,
        timestamp: str = None,
        protocol: str = "UDP",
        source: str = "live",
    ) -> Optional[Dict[str, Any]]:
        """Parses raw text SIP packet into structured dictionary and deduplicates."""
        if not self.is_running or not raw_text:
            return None

        sip_start = -1
        for kw in (
            "INVITE sip:",
            "INVITE sips:",
            "REGISTER sip:",
            "REGISTER sips:",
            "OPTIONS sip:",
            "BYE sip:",
            "CANCEL sip:",
            "ACK sip:",
            "SUBSCRIBE sip:",
            "NOTIFY sip:",
            "MESSAGE sip:",
            "INFO sip:",
            "REFER sip:",
            "UPDATE sip:",
            "PRACK sip:",
            "SIP/2.0 ",
        ):
            idx = raw_text.find(kw)
            if idx != -1 and (sip_start == -1 or idx < sip_start):
                sip_start = idx
        if sip_start == -1:
            return None

        clean_sip = raw_text[sip_start:].strip()
        if not timestamp:
            timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]

        lines = clean_sip.split("\r\n") if "\r\n" in clean_sip else clean_sip.split("\n")
        if not lines:
            return None

        first_line = lines[0].strip()
        headers = {}
        sdp_lines = []
        is_sdp = False

        for line in lines[1:]:
            if line == "":
                is_sdp = True
                continue
            if is_sdp:
                sdp_lines.append(line)
            else:
                if ":" in line:
                    k, v = line.split(":", 1)
                    headers[k.strip().lower()] = v.strip()

        call_id = headers.get("call-id") or headers.get("i")
        if not call_id:
            return None

        cseq = headers.get("cseq", "")
        if self._is_duplicate_frame(call_id, cseq, first_line):
            return None

        method = "SIP/2.0"
        status = first_line
        if first_line.startswith("SIP/2.0"):
            status = first_line.replace("SIP/2.0", "").strip()
            cseq_parts = cseq.split()
            if len(cseq_parts) >= 2:
                method = f"SIP/2.0 ({cseq_parts[1]})"
        else:
            parts = first_line.split(" ")
            if parts:
                method = parts[0]
                status = parts[0]

        from_hdr = headers.get("from") or headers.get("f") or ""
        to_hdr = headers.get("to") or headers.get("t") or ""

        caller = from_hdr
        callee = to_hdr
        caller_num_clean = ""
        callee_num_clean = ""

        from_match = re.search(r'["\']?([^"\'<]*)["\']?\s*<sips?:([^@>;]+)', from_hdr, re.IGNORECASE)
        if from_match:
            name, num = from_match.group(1).strip(), from_match.group(2).strip()
            caller_num_clean = num
            caller = f"{num} ({name})" if name and name != num else num

        to_match = re.search(r"<sips?:([^@>;]+)", to_hdr, re.IGNORECASE)
        if to_match:
            callee_num_clean = to_match.group(1).strip()
            callee = callee_num_clean

        if source != "ami":
            now_m = time.monotonic()
            if caller_num_clean:
                self._recent_raw_endpoints[caller_num_clean] = now_m
            if callee_num_clean:
                self._recent_raw_endpoints[callee_num_clean] = now_m

        pkt = {
            "call_id": call_id,
            "timestamp": timestamp,
            "src_ip": src_ip,
            "src_port": int(src_port or 5060),
            "dst_ip": dst_ip,
            "dst_port": int(dst_port or 5060),
            "protocol": protocol,
            "source": source,
            "method": method,
            "status": status,
            "cseq": cseq,
            "caller": caller,
            "callee": callee,
            "raw": clean_sip,
            "headers": headers,
            "sdp": "\n".join(sdp_lines) if sdp_lines else None,
        }

        self._process_packet(pkt)
        return pkt

    def get_packets(
        self,
        ip: str = "",
        port: str = "",
        method: str = "",
        query: str = "",
        limit: int = 300,
    ) -> List[Dict[str, Any]]:
        """Return filtered chronological SIP packets for the SIP Capture tab."""
        ip_q = (ip or "").strip().lower()
        port_q = str(port or "").strip()
        method_q = (method or "").strip().upper()
        text_q = (query or "").strip().lower()

        filtered = []
        with self._lock:
            snapshot = list(self.packets)

        for pkt in reversed(snapshot):
            if ip_q and ip_q not in pkt["src_ip"].lower() and ip_q not in pkt["dst_ip"].lower():
                continue
            if port_q and port_q != str(pkt["src_port"]) and port_q != str(pkt["dst_port"]):
                continue
            if method_q and method_q != "ALL":
                if method_q == "ERROR":
                    st = str(pkt.get("status", "")).strip()
                    if not (st.startswith("4") or st.startswith("5") or st.startswith("6")):
                        continue
                else:
                    if (
                        method_q != str(pkt.get("method", "")).upper()
                        and method_q not in str(pkt.get("status", "")).upper()
                        and method_q not in str(pkt.get("cseq", "")).upper()
                    ):
                        continue
            if text_q:
                haystack = (
                    f"{pkt.get('call_id', '')} {pkt.get('caller', '')} "
                    f"{pkt.get('callee', '')} {pkt.get('status', '')} {pkt.get('raw', '')}"
                ).lower()
                if text_q not in haystack:
                    continue

            filtered.append(pkt)
            if len(filtered) >= max(1, min(limit, 1000)):
                break

        return filtered

    def get_calls(self, query: str = "", method_filter: str = "") -> List[Dict[str, Any]]:
        """Return list of captured SIP dialogs sorted newest-activity first."""
        res = []
        mf = (method_filter or "").strip().upper()
        with self._lock:
            calls_items = list(self.calls.values())

        for c in calls_items:
            init_m = str(c.get("initial_method") or "").upper()
            if mf and mf != "ALL":
                if mf == "CALLS" and init_m != "INVITE":
                    continue
                elif mf in ("INVITE", "REGISTER", "OPTIONS") and init_m != mf:
                    continue

            if query:
                q = query.lower()
                if (
                    q not in c["call_id"].lower()
                    and q not in c["caller"].lower()
                    and q not in c["callee"].lower()
                    and q not in c["last_status"].lower()
                    and q not in init_m.lower()
                ):
                    continue

            res.append(self._serialize_call_summary(c))

        res.sort(key=lambda x: x.get("updated_seq", 0), reverse=True)
        return res

    def get_call_messages(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Return sequence of messages for a specific call session."""
        with self._lock:
            if call_id not in self.calls:
                return None
            c = self.calls[call_id]
            return {
                "call_id": call_id,
                "caller": c["caller"],
                "callee": c["callee"],
                "initial_method": c["initial_method"],
                "start_time": c["start_time"],
                "last_time": c["last_time"],
                "last_status": c["last_status"],
                "nodes": list(c["nodes"]),
                "messages": list(c["messages"]),
            }

    def generate_multi_packet_pcap_bytes(self, messages: List[Dict[str, Any]]) -> bytes:
        """
        Generates a valid binary .pcap file payload from an arbitrary list of SIP packets,
        compatible with Wireshark and sngrep.
        """
        pcap_header = struct.pack("<IHHIIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
        packets_data = bytearray(pcap_header)

        def ip2bytes(ip_str: str) -> bytes:
            try:
                parts = [int(x) for x in str(ip_str).split(".")]
                if len(parts) == 4 and all(0 <= x <= 255 for x in parts):
                    return bytes(parts)
            except Exception:
                pass
            return b"\x7f\x00\x00\x01"

        ordered = list(messages)
        for idx, msg in enumerate(ordered):
            raw_payload = (msg.get("raw") or "").encode("utf-8", errors="replace")

            dst_mac = b"\x00\x11\x22\x33\x44\x55"
            src_mac = b"\x66\x77\x88\x99\xaa\xbb"
            eth_type = b"\x08\x00"
            eth_hdr = dst_mac + src_mac + eth_type

            ip_len = 20 + 8 + len(raw_payload)
            src_ip_b = ip2bytes(msg.get("src_ip", "127.0.0.1"))
            dst_ip_b = ip2bytes(msg.get("dst_ip", "127.0.0.1"))

            ip_hdr = struct.pack(
                ">BBHHHBBH4s4s",
                0x45,
                0,
                min(ip_len, 65535),
                (0x1234 + idx) & 0xFFFF,
                0,
                64,
                17,
                0,
                src_ip_b,
                dst_ip_b,
            )

            udp_len = 8 + len(raw_payload)
            src_port = int(msg.get("src_port") or 5060) & 0xFFFF
            dst_port = int(msg.get("dst_port") or 5060) & 0xFFFF
            udp_hdr = struct.pack(">HHHH", src_port, dst_port, min(udp_len, 65535), 0)

            frame_data = eth_hdr + ip_hdr + udp_hdr + raw_payload

            ts_sec = int(time.time()) - max(0, len(ordered) - idx)
            ts_usec = (1000 * idx) % 1000000
            incl_len = len(frame_data)

            pkt_hdr = struct.pack("<IIII", ts_sec, ts_usec, incl_len, incl_len)
            packets_data.extend(pkt_hdr)
            packets_data.extend(frame_data)

        return bytes(packets_data)

    def generate_pcap_bytes(self, call_id: str) -> bytes:
        """Generates binary .pcap file for a specific SIP Call-ID."""
        with self._lock:
            messages = list(self.calls.get(call_id, {}).get("messages", []))
        return self.generate_multi_packet_pcap_bytes(messages)

    def save_pcap_snapshot(self, label: str, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Saves a .pcap capture snapshot to disk and returns metadata."""
        safe_label = re.sub(r"[^a-zA-Z0-9_\-]", "_", (label or "sip_capture").strip())[:36] or "sip_capture"
        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{safe_label}_{stamp}.pcap"
        filepath = os.path.join(self.pcap_dir, filename)
        pcap_bytes = self.generate_multi_packet_pcap_bytes(messages)
        with open(filepath, "wb") as f:
            f.write(pcap_bytes)
        return {
            "filename": filename,
            "size_bytes": len(pcap_bytes),
            "packet_count": len(messages),
            "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    def list_pcap_snapshots(self) -> List[Dict[str, Any]]:
        """Lists saved .pcap snapshot files in pcap_dir."""
        items = []
        if not os.path.isdir(self.pcap_dir):
            return items
        for fname in os.listdir(self.pcap_dir):
            if not fname.endswith(".pcap"):
                continue
            fpath = os.path.join(self.pcap_dir, fname)
            if not os.path.isfile(fpath):
                continue
            st = os.stat(fpath)
            items.append(
                {
                    "filename": fname,
                    "size_bytes": st.st_size,
                    "created_at": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                }
            )
        items.sort(key=lambda x: x["created_at"], reverse=True)
        return items

    def get_pcap_snapshot_path(self, filename: str) -> Optional[str]:
        safe_name = os.path.basename(filename or "")
        if not safe_name.endswith(".pcap"):
            return None
        fpath = os.path.join(self.pcap_dir, safe_name)
        return fpath if os.path.isfile(fpath) else None

    def delete_pcap_snapshot(self, filename: str) -> bool:
        fpath = self.get_pcap_snapshot_path(filename)
        if not fpath:
            return False
        os.remove(fpath)
        return True

    def start_capture(self):
        """Starts packet trapper engine."""
        self.is_running = True
        self._start_background_collectors()

    def stop_capture(self):
        """Stops packet trapper engine."""
        self.is_running = False

    def clear_traces(self):
        """Clears all captured traces."""
        with self._lock:
            self.calls.clear()
            self.packets.clear()
            self._recent_fps.clear()
            self._ami_dialogs.clear()
            self.packet_seq = 0


sip_trapper = SipTrapper()
