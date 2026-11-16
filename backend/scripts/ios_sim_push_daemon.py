import base64
import hashlib
import json
import os
import random
import re
import socket
import ssl
import struct
import subprocess
import threading
import time
import urllib.request

WAKE_FLAG = "/tmp/aida_sim_wake_lockscreen"
RING_JSON = "/tmp/aida_sim_test_ring.json"
CANCEL_JSON = "/tmp/aida_sim_cancel_ring.json"
REJECT_FLAG = "/tmp/aida_sim_reject_call"
WAS_LOCKED_FILE = "/tmp/aida_sim_was_locked_on_invite"
LOCK_BTN_PRESS_JSON = "/tmp/aida_sim_lock_btn_press.json"
HOMESCREEN_BG = "/tmp/aida_sim_homescreen_bg.png"
HOMESCREEN_BG_TMP = "/tmp/aida_sim_homescreen_bg.tmp.png"
APNS_TMP_FILE = "/tmp/aida_sim_apns_push.apns"
LAST_PUSH_NAV_FILE = "/tmp/aida_sim_last_push_nav.json"
LOG_FILE = "/tmp/aida_voip_push_daemon.log"

ring_state_lock = threading.Lock()
ring_started_ts = 0.0
ring_unlocked_at_ts = 0.0
ring_lock_press_count = 0
last_invite_was_locked = None
last_invite_ts = 0.0
last_homescreen_capture_ts = 0.0

cached_contacts = []
cached_contacts_ts = 0.0
cached_user_dir = {}
cached_user_dir_ts = 0.0

pushed_unanswered_call_ids = set()
apns_push_lock = threading.Lock()
apns_badge_count = 0


def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}\n"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass


def http_get_json(url, tenant_id="tenant-default", ext="1000", timeout=4.5):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "AIDAVoIPPushDaemon/2.0",
            "X-Tenant-ID": tenant_id,
            "X-User-Extension": ext,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8"))


def resolve_contact_name(caller_num):
    global cached_contacts, cached_contacts_ts
    digits = re.sub(r"\D+", "", str(caller_num or ""))
    if len(digits) < 7:
        return ""
    suffix10 = digits[-10:]
    now = time.time()
    if not cached_contacts or (now - cached_contacts_ts) > 30.0:
        try:
            data = http_get_json("https://aida.saphira.com.tr/api/contacts")
            if isinstance(data, list):
                cached_contacts = data
                cached_contacts_ts = now
        except Exception as e:
            log(f"Contacts lookup notice: {e}")

    for item in cached_contacts:
        if not isinstance(item, dict):
            continue
        p_raw = str(item.get("phone_number") or item.get("phone") or "")
        p_digits = re.sub(r"\D+", "", p_raw)
        if not p_digits:
            continue
        if p_digits[-10:] == suffix10 or p_digits == digits:
            first = str(item.get("first_name") or "").strip()
            last = str(item.get("last_name") or "").strip()
            full = f"{first} {last}".strip()
            if not full:
                full = str(item.get("name") or "").strip()
            if full:
                return full
    return ""


def resolve_user_directory_label(raw_label, sender_id):
    global cached_user_dir, cached_user_dir_ts
    now = time.time()
    if not cached_user_dir or (now - cached_user_dir_ts) > 45.0:
        try:
            users = http_get_json("https://aida.saphira.com.tr/api/settings/users?tenant_id=all")
            if isinstance(users, list):
                new_map = {}
                for u in users:
                    if not isinstance(u, dict):
                        continue
                    ext = str(u.get("extension") or "").strip()
                    uid = str(u.get("id") or "").strip()
                    full_name = str(
                        u.get("full_name") or u.get("name") or u.get("username") or ""
                    ).strip()
                    if full_name:
                        if ext:
                            new_map[ext] = full_name if ext in full_name else f"{ext} - {full_name}"
                        if uid:
                            new_map[uid] = (
                                f"{ext} - {full_name}"
                                if (ext and ext not in full_name)
                                else full_name
                            )
                if new_map:
                    cached_user_dir = new_map
                    cached_user_dir_ts = now
        except Exception as e:
            log(f"User directory lookup notice: {e}")

    trimmed = str(raw_label or "").strip()
    sid = str(sender_id or "").strip()
    if " - " in trimmed:
        return trimmed
    if trimmed and trimmed in cached_user_dir:
        return cached_user_dir[trimmed]
    if sid and sid in cached_user_dir:
        return cached_user_dir[sid]
    return trimmed or sid or "Mesaj"


def is_simulator_currently_locked():
    try:
        res = subprocess.check_output(
            ["xcrun", "simctl", "spawn", "booted", "notifyutil", "-g", "com.apple.springboard.lockstate"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return (" 1" in res or "\t1" in res)
    except Exception:
        return False


def is_aida_mobile_running():
    try:
        out = subprocess.check_output(
            ["pgrep", "-f", "AIDAMobile.app/AIDAMobile"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return bool(out.strip())
    except Exception:
        return False


def send_simulator_apns_push(title, body, sub_tab="chat", extra=None, notif_id=None):
    global apns_badge_count
    with apns_push_lock:
        apns_badge_count = min(apns_badge_count + 1, 99)
        detail = {"subTab": sub_tab}
        if isinstance(extra, dict):
            detail.update(extra)
        apns_payload = {
            "Simulator Target Bundle": "com.aida.mobile",
            "id": str(notif_id or f"apns-{int(time.time() * 1000)}"),
            "aps": {
                "alert": {
                    "title": str(title),
                    "body": str(body),
                },
                "sound": "default",
                "badge": apns_badge_count,
                "mutable-content": 1,
            },
            "actionEvent": "SWITCH_AGENT_PANEL_SUBTAB",
            "actionDetailJSON": json.dumps(detail, ensure_ascii=False),
        }
        try:
            nav_record = dict(detail)
            nav_record["id"] = apns_payload["id"]
            nav_record["timestamp"] = time.time()
            with open(LAST_PUSH_NAV_FILE, "w", encoding="utf-8") as nf:
                json.dump(nav_record, nf, ensure_ascii=False)
            with open(APNS_TMP_FILE, "w", encoding="utf-8") as f:
                json.dump(apns_payload, f, ensure_ascii=False)
            subprocess.run(
                ["xcrun", "simctl", "push", "booted", "com.aida.mobile", APNS_TMP_FILE],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=4.0,
            )
            log(f"APNs push delivered -> [{title}] {body} (subTab={sub_tab}, id={apns_payload['id']})")
        except Exception as e:
            log(f"APNs push error: {e}")


def capture_homescreen_snapshot_if_safe(force=False):
    global last_homescreen_capture_ts
    now = time.time()
    if not force and (now - last_homescreen_capture_ts) < 6.0 and os.path.exists(HOMESCREEN_BG):
        return
    if is_aida_mobile_running() or is_simulator_currently_locked():
        return
    try:
        subprocess.run(
            ["xcrun", "simctl", "io", "booted", "screenshot", HOMESCREEN_BG_TMP],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=2.5,
        )
        if os.path.exists(HOMESCREEN_BG_TMP) and os.path.getsize(HOMESCREEN_BG_TMP) > 10000:
            if not is_aida_mobile_running() and not is_simulator_currently_locked():
                os.replace(HOMESCREEN_BG_TMP, HOMESCREEN_BG)
                last_homescreen_capture_ts = time.time()
    except Exception:
        pass


def unlock_and_launch_simulator(record_invite_lock_state=False, forced_was_locked=None, launch_app=True):
    global ring_started_ts, ring_unlocked_at_ts, ring_lock_press_count, last_invite_was_locked, last_invite_ts
    currently_locked = is_simulator_currently_locked()
    now = time.time()
    with ring_state_lock:
        if record_invite_lock_state:
            if forced_was_locked is not None:
                was_locked = forced_was_locked
            elif now - last_invite_ts < 5.0 and last_invite_was_locked is not None:
                was_locked = last_invite_was_locked
            else:
                was_locked = currently_locked
            last_invite_was_locked = was_locked
            last_invite_ts = now
            ring_started_ts = now
            ring_lock_press_count = 0
            try:
                with open(WAS_LOCKED_FILE, "w", encoding="utf-8") as wf:
                    wf.write("1" if was_locked else "0")
            except Exception:
                pass
        else:
            was_locked = (
                last_invite_was_locked
                if (now - last_invite_ts < 35.0 and last_invite_was_locked is not None)
                else currently_locked
            )

    if currently_locked:
        try:
            subprocess.run(
                ["xcrun", "simctl", "spawn", "booted", "notifyutil", "-s", "com.apple.springboard.lockstate", "0"],
                stderr=subprocess.DEVNULL,
            )
            subprocess.run(
                ["xcrun", "simctl", "spawn", "booted", "notifyutil", "-p", "com.apple.springboard.lockstate"],
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            pass
    with ring_state_lock:
        ring_unlocked_at_ts = time.time()
    if launch_app:
        try:
            subprocess.run(["xcrun", "simctl", "launch", "booted", "com.aida.mobile"], stderr=subprocess.DEVNULL)
        except Exception:
            pass
    return was_locked


def wake_and_lock_button_watcher_loop():
    global ring_started_ts, ring_unlocked_at_ts, ring_lock_press_count, apns_badge_count
    while True:
        if os.path.exists(WAKE_FLAG):
            try:
                os.remove(WAKE_FLAG)
            except Exception:
                pass
            app_already_running = is_aida_mobile_running()
            was_locked = unlock_and_launch_simulator(
                record_invite_lock_state=False,
                launch_app=not app_already_running,
            )
            log(f"Wake flag from running app -> unlocked Simulator (was_locked={was_locked}, launched={not app_already_running})")

        if is_aida_mobile_running() and not is_simulator_currently_locked():
            apns_badge_count = 0

        # Detect double-press of iPhone Lock Button (Cmd+L) while ringing
        now = time.time()
        with ring_state_lock:
            is_ringing_window = (
                ring_started_ts > 0
                and (now - ring_started_ts) < 35.0
                and (now - ring_unlocked_at_ts) > 0.45
            )
        if is_ringing_window and is_simulator_currently_locked():
            with ring_state_lock:
                ring_lock_press_count += 1
                cnt = ring_lock_press_count
                ring_unlocked_at_ts = time.time()
                if cnt >= 2:
                    ring_started_ts = 0.0
            log(f"Lock button (Cmd+L) pressed during ringing: count={cnt}")
            try:
                with open(LOCK_BTN_PRESS_JSON, "w", encoding="utf-8") as lf:
                    json.dump({"pressCount": cnt, "timestamp": now}, lf)
            except Exception:
                pass
            if cnt == 1:
                unlock_and_launch_simulator(record_invite_lock_state=False, launch_app=False)

        if not is_ringing_window:
            capture_homescreen_snapshot_if_safe(force=False)

        time.sleep(0.12)


def apns_chat_poller_loop():
    """
    Dedicated fast 0.9s poller for internal chat messages (/api/agent/chat)
    so chat notifications appear in <1 second across all states
    (In-App Foreground, Home Screen background, Lock Screen, and Closed App).
    """
    seen_chat_ids = set()
    seeded_chat = False
    resolve_user_directory_label("1005", "1005")

    while True:
        try:
            chat_list = http_get_json(
                "https://aida.saphira.com.tr/api/agent/chat?extension=1000&user_id=2",
                timeout=3.5,
            )
            if isinstance(chat_list, list):
                if not seeded_chat:
                    for m in chat_list:
                        if isinstance(m, dict) and m.get("id") is not None:
                            seen_chat_ids.add(str(m.get("id")))
                    seeded_chat = True
                else:
                    for m in chat_list:
                        if not isinstance(m, dict) or m.get("id") is None:
                            continue
                        mid = str(m.get("id"))
                        if mid in seen_chat_ids:
                            continue
                        seen_chat_ids.add(mid)
                        sender_id = str(m.get("sender_id") or "").strip()
                        if sender_id in ("1000", "2"):
                            continue
                        raw_sender = str(m.get("sender_name") or sender_id).strip()
                        sender_disp = resolve_user_directory_label(raw_sender, sender_id)
                        msg_text = str(m.get("text") or m.get("message") or "Yeni mesaj").strip()
                        send_simulator_apns_push(
                            title=f"{sender_disp} - Yeni İç Mesaj",
                            body=msg_text,
                            sub_tab="chat",
                            extra={"peerSenderId": sender_id},
                            notif_id=f"int-chat-{mid}",
                        )
        except Exception as e:
            log(f"APNs chat poll notice: {e}")

        time.sleep(0.9)


def apns_push_poller_loop():
    """
    Polls backend endpoints for extension 1000 (user_id=2) and dispatches native iOS APNs
    push notifications via `xcrun simctl push booted com.aida.mobile`:
      1. Kayıp Çağrı (/api/agent/missed_queue_calls)
      2. Yeni Sesli Posta (/api/agent/voicemail)
      3. Yanıtsız Çağrı (/api/calls)
    """
    seen_missed_ids = set()
    seen_voicemail_ids = set()
    seen_call_ids = set()
    seeded_missed = False
    seeded_voicemail = False
    seeded_calls = False

    resolve_contact_name("0000000000")

    while True:
        try:
            should_push = True

            # 1) Kayıp Çağrı (/api/agent/missed_queue_calls)
            try:
                missed_list = http_get_json(
                    "https://aida.saphira.com.tr/api/agent/missed_queue_calls?extension=1000&user_id=2"
                )
                if isinstance(missed_list, list):
                    if not seeded_missed:
                        for item in missed_list:
                            if isinstance(item, dict):
                                cid = str(item.get("id") or item.get("call_id") or "").strip()
                                if cid:
                                    seen_missed_ids.add(cid)
                        seeded_missed = True
                    else:
                        for item in missed_list:
                            if not isinstance(item, dict):
                                continue
                            cid = str(item.get("id") or item.get("call_id") or "").strip()
                            if not cid or cid in seen_missed_ids:
                                continue
                            seen_missed_ids.add(cid)
                            if should_push:
                                caller_num = str(
                                    item.get("caller")
                                    or item.get("caller_number")
                                    or item.get("phone_number")
                                    or "Bilinmeyen Numara"
                                ).strip()
                                caller_name = str(
                                    item.get("caller_name") or item.get("contact_name") or ""
                                ).strip()
                                if not caller_name or caller_name == caller_num:
                                    caller_name = resolve_contact_name(caller_num)
                                disp = (
                                    f"{caller_name} ({caller_num})"
                                    if (caller_name and caller_name != caller_num)
                                    else caller_num
                                )
                                q_name = str(item.get("queue_name") or "").strip()
                                body_txt = (
                                    f"{q_name} kuyruğunda kayıp çağrı. Geri dönüş yapmak için dokunun."
                                    if q_name
                                    else "Kuyrukta bekleyen kayıp çağrı. Geri dönüş yapmak için dokunun."
                                )
                                send_simulator_apns_push(
                                    title=f"{disp} - Kayıp Çağrı",
                                    body=body_txt,
                                    sub_tab="missed",
                                    notif_id=f"missed-q-{cid}",
                                )
            except Exception as e:
                log(f"APNs missed poll notice: {e}")

            # 3) Sesli Posta (/api/agent/voicemail)
            try:
                vm_list = http_get_json(
                    "https://aida.saphira.com.tr/api/agent/voicemail?extension=1000"
                )
                if isinstance(vm_list, list):
                    if not seeded_voicemail:
                        for item in vm_list:
                            if isinstance(item, dict):
                                vid = str(item.get("id") or item.get("filename") or "").strip()
                                if vid:
                                    seen_voicemail_ids.add(vid)
                        seeded_voicemail = True
                    else:
                        for item in vm_list:
                            if not isinstance(item, dict):
                                continue
                            vid = str(item.get("id") or item.get("filename") or "").strip()
                            if not vid or vid in seen_voicemail_ids:
                                continue
                            seen_voicemail_ids.add(vid)
                            if item.get("is_read"):
                                continue
                            if should_push:
                                caller_num = str(
                                    item.get("caller_number")
                                    or item.get("caller_id")
                                    or item.get("caller")
                                    or "Bilinmeyen Numara"
                                ).strip()
                                caller_name = str(
                                    item.get("caller_name") or item.get("contact_name") or ""
                                ).strip()
                                if not caller_name or caller_name == caller_num:
                                    caller_name = resolve_contact_name(caller_num)
                                disp = (
                                    f"{caller_name} ({caller_num})"
                                    if (caller_name and caller_name != caller_num)
                                    else caller_num
                                )
                                dur = item.get("duration")
                                dur_txt = f" ({dur} sn)" if dur else ""
                                send_simulator_apns_push(
                                    title=f"{disp} - Yeni Sesli Posta",
                                    body=f"Yeni bir sesli mesaj bırakıldı{dur_txt}. Dinlemek için dokunun.",
                                    sub_tab="voicemail",
                                    notif_id=f"voicemail-{vid}",
                                )
            except Exception as e:
                log(f"APNs voicemail poll notice: {e}")

            # 4) Yanıtsız Çağrı fallback from /api/calls
            try:
                calls_list = http_get_json(
                    "https://aida.saphira.com.tr/api/calls?tenant_id=tenant-default"
                )
                if isinstance(calls_list, list):
                    if not seeded_calls:
                        for c in calls_list:
                            if isinstance(c, dict):
                                cid = str(c.get("call_id") or c.get("id") or "").strip()
                                if cid:
                                    seen_call_ids.add(cid)
                        seeded_calls = True
                    else:
                        for c in calls_list[:15]:
                            if not isinstance(c, dict):
                                continue
                            cid = str(c.get("call_id") or c.get("id") or "").strip()
                            status = str(c.get("status") or "").strip().lower()
                            if not cid or status in ("ringing", "in_progress", "active", ""):
                                continue
                            if cid in seen_call_ids:
                                continue
                            seen_call_ids.add(cid)
                            if cid in pushed_unanswered_call_ids:
                                continue
                            if status in ("no_answer", "missed", "busy", "cancelled", "failed") and should_push:
                                pushed_unanswered_call_ids.add(cid)
                                caller_num = str(
                                    c.get("caller_number") or c.get("caller") or "Bilinmeyen Numara"
                                ).strip()
                                caller_name = str(c.get("caller_name") or "").strip()
                                if not caller_name or caller_name == caller_num:
                                    caller_name = resolve_contact_name(caller_num)
                                disp = (
                                    f"{caller_name} ({caller_num})"
                                    if (caller_name and caller_name != caller_num)
                                    else caller_num
                                )
                                send_simulator_apns_push(
                                    title=f"{disp} - Yanıtsız Çağrı",
                                    body="Gelen çağrı yanıtlanamadı. Arama geçmişini görüntülemek için dokunun.",
                                    sub_tab="history",
                                    notif_id=f"unanswered-{cid}",
                                )
            except Exception as e:
                log(f"APNs calls poll notice: {e}")

        except Exception as e:
            log(f"APNs poller outer error: {e}")

        time.sleep(1.5)


class SimpleWSSClient:
    def __init__(self, host, port, path="/ws"):
        self.host = host
        self.port = port
        self.path = path
        self.sock = None
        self.lock = threading.Lock()

    def connect(self):
        raw_sock = socket.create_connection((self.host, self.port), timeout=10)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        self.sock = ctx.wrap_socket(raw_sock, server_hostname=self.host)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        req = (
            f"GET {self.path} HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n"
            f"Sec-WebSocket-Protocol: sip\r\n\r\n"
        )
        self.sock.sendall(req.encode("utf-8"))
        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = self.sock.recv(1024)
            if not chunk:
                raise ConnectionError("WSS handshake EOF")
            resp += chunk
        if b"101 " not in resp.split(b"\r\n", 1)[0]:
            raise ConnectionError(f"WSS handshake failed: {resp[:120]}")
        self.sock.settimeout(1.0)

    def send_text(self, text):
        payload = text.encode("utf-8")
        mask_key = os.urandom(4)
        header = bytearray([0x81])
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", length))
        header.extend(mask_key)
        masked = bytearray(length)
        for i in range(length):
            masked[i] = payload[i] ^ mask_key[i % 4]
        with self.lock:
            self.sock.sendall(header + masked)

    def recv_frame(self):
        first2 = self._recv_exact(2)
        if not first2:
            return None
        b1, b2 = first2[0], first2[1]
        opcode = b1 & 0x0F
        masked = (b2 & 0x80) != 0
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._recv_exact(8))[0]
        mask_key = self._recv_exact(4) if masked else None
        data = bytearray(self._recv_exact(length)) if length > 0 else bytearray()
        if masked and mask_key:
            for i in range(length):
                data[i] ^= mask_key[i % 4]
        if opcode == 0x8:
            raise ConnectionError("WSS closed by peer")
        if opcode == 0x9:
            self._send_pong(data)
            return ""
        if opcode in (0x1, 0x2):
            return data.decode("utf-8", errors="ignore")
        return ""

    def _send_pong(self, payload):
        mask_key = os.urandom(4)
        header = bytearray([0x8A, 0x80 | min(len(payload), 125)])
        header.extend(mask_key)
        masked = bytearray(len(payload))
        for i in range(len(payload)):
            masked[i] = payload[i] ^ mask_key[i % 4]
        with self.lock:
            self.sock.sendall(header + masked)

    def _recv_exact(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("Socket EOF")
            buf += chunk
        return buf

    def close(self):
        try:
            if self.sock:
                self.sock.close()
        except Exception:
            pass


def parse_sip_headers(msg):
    lines = msg.split("\r\n")
    first_line = lines[0] if lines else ""
    headers = {}
    vias = []
    for line in lines[1:]:
        if not line.strip():
            break
        if ":" in line:
            k, v = line.split(":", 1)
            kl = k.strip().lower()
            v = v.strip()
            if kl in ("via", "v"):
                vias.append(v)
            headers.setdefault(kl, v)
    return first_line, headers, vias


def compute_digest_auth(username, password, realm, nonce, method, uri, qop=None, nc="00000001", cnonce="aida1234"):
    ha1 = hashlib.md5(f"{username}:{realm}:{password}".encode("utf-8")).hexdigest()
    ha2 = hashlib.md5(f"{method}:{uri}".encode("utf-8")).hexdigest()
    if qop:
        resp = hashlib.md5(f"{ha1}:{nonce}:{nc}:{cnonce}:{qop}:{ha2}".encode("utf-8")).hexdigest()
        return (
            f'Digest username="{username}", realm="{realm}", nonce="{nonce}", '
            f'uri="{uri}", response="{resp}", algorithm=MD5, qop={qop}, nc={nc}, cnonce="{cnonce}"'
        )
    else:
        resp = hashlib.md5(f"{ha1}:{nonce}:{ha2}".encode("utf-8")).hexdigest()
        return (
            f'Digest username="{username}", realm="{realm}", nonce="{nonce}", '
            f'uri="{uri}", response="{resp}", algorithm=MD5'
        )


def fetch_webrtc_config():
    return http_get_json("https://aida.saphira.com.tr/api/webrtc/config?extension=1000", timeout=8.0)


def voip_push_sip_loop():
    global ring_started_ts
    resolve_contact_name("0000000000")
    while True:
        wss = None
        try:
            cfg = fetch_webrtc_config()
            sip_user = cfg.get("sipUsername") or "Wp6Vy9D3"
            sip_pass = cfg.get("password") or ""
            domain = "aida.saphira.com.tr"
            via_host = cfg.get("viaHost") or "213.74.216.246"
            wss = SimpleWSSClient(domain, 8089, "/ws")
            wss.connect()
            log(f"Connected to WSS {domain}:8089/ws as {sip_user} (VoIP Push Listener)")

            reg_call_id = f"voippush-{random.randint(100000, 999999)}@{domain}"
            reg_tag = f"vp{random.randint(10000, 99999)}"
            cseq = 1
            contact_user = f"{sip_user}_voippush"

            def send_register(auth_header=None):
                nonlocal cseq
                branch = f"z9hG4bk{random.randint(1000000, 9999999)}"
                uri = f"sip:{domain}"
                lines = [
                    f"REGISTER {uri} SIP/2.0",
                    f"Via: SIP/2.0/WSS {via_host};branch={branch};rport",
                    f"Max-Forwards: 70",
                    f"To: <sip:{sip_user}@{domain}>",
                    f"From: <sip:{sip_user}@{domain}>;tag={reg_tag}",
                    f"Call-ID: {reg_call_id}",
                    f"CSeq: {cseq} REGISTER",
                    f"Contact: <sip:{contact_user}@{via_host};transport=ws>;expires=300",
                    f"User-Agent: AIDA-iOS-PushKit-Daemon/2.0",
                ]
                if auth_header:
                    lines.append(f"Authorization: {auth_header}")
                lines.append("Content-Length: 0\r\n\r\n")
                cseq += 1
                wss.send_text("\r\n".join(lines))

            send_register()
            last_reg_time = time.time()
            active_invite = None

            while True:
                if os.path.exists(REJECT_FLAG):
                    try:
                        os.remove(REJECT_FLAG)
                    except Exception:
                        pass
                    with ring_state_lock:
                        ring_started_ts = 0.0
                    if active_invite:
                        log(f"Rejecting active INVITE {active_invite['call_id']} with 486 Busy Here")
                        via_hdrs = "\r\n".join(f"Via: {v}" for v in active_invite["vias"])
                        busy_resp = (
                            f"SIP/2.0 486 Busy Here\r\n"
                            f"{via_hdrs}\r\n"
                            f"From: {active_invite['from']}\r\n"
                            f"To: {active_invite['to']};tag={active_invite['to_tag']}\r\n"
                            f"Call-ID: {active_invite['call_id']}\r\n"
                            f"CSeq: {active_invite['cseq']}\r\n"
                            f"Content-Length: 0\r\n\r\n"
                        )
                        wss.send_text(busy_resp)
                        active_invite = None

                if time.time() - last_reg_time > 180:
                    send_register()
                    last_reg_time = time.time()

                try:
                    msg = wss.recv_frame()
                except socket.timeout:
                    continue

                if not msg:
                    continue

                first_line, hdrs, vias = parse_sip_headers(msg)
                if not first_line:
                    continue

                if first_line.startswith("SIP/2.0 401") or first_line.startswith("SIP/2.0 407"):
                    www_auth = hdrs.get("www-authenticate") or hdrs.get("proxy-authenticate") or ""
                    realm_m = re.search(r'realm="([^"]+)"', www_auth)
                    nonce_m = re.search(r'nonce="([^"]+)"', www_auth)
                    qop_m = re.search(r'qop="([^"]+)"', www_auth)
                    if realm_m and nonce_m:
                        qop_val = "auth" if (qop_m and "auth" in qop_m.group(1)) else None
                        auth_str = compute_digest_auth(
                            sip_user,
                            sip_pass,
                            realm_m.group(1),
                            nonce_m.group(1),
                            "REGISTER",
                            f"sip:{domain}",
                            qop=qop_val,
                        )
                        send_register(auth_str)
                        last_reg_time = time.time()

                elif first_line.startswith("SIP/2.0 200") and "REGISTER" in hdrs.get("cseq", ""):
                    log("SIP REGISTER 200 OK (PushKit listener active)")

                elif first_line.startswith("OPTIONS "):
                    via_hdrs = "\r\n".join(f"Via: {v}" for v in vias)
                    to_hdr = hdrs.get("to") or hdrs.get("t") or ""
                    if ";tag=" not in to_hdr:
                        to_hdr += f";tag=opt{random.randint(1000,9999)}"
                    opt_resp = (
                        f"SIP/2.0 200 OK\r\n"
                        f"{via_hdrs}\r\n"
                        f"From: {hdrs.get('from') or hdrs.get('f') or ''}\r\n"
                        f"To: {to_hdr}\r\n"
                        f"Call-ID: {hdrs.get('call-id') or hdrs.get('i') or ''}\r\n"
                        f"CSeq: {hdrs.get('cseq') or ''}\r\n"
                        f"Content-Length: 0\r\n\r\n"
                    )
                    wss.send_text(opt_resp)

                elif first_line.startswith("INVITE "):
                    call_id = hdrs.get("call-id") or hdrs.get("i") or ""
                    from_hdr = hdrs.get("from") or hdrs.get("f") or ""
                    to_hdr = hdrs.get("to") or hdrs.get("t") or ""
                    cseq_hdr = hdrs.get("cseq") or ""
                    if ";tag=" in to_hdr.lower():
                        continue
                    to_tag = f"ring{random.randint(10000, 99999)}"
                    via_hdrs = "\r\n".join(f"Via: {v}" for v in vias)

                    ring_resp = (
                        f"SIP/2.0 180 Ringing\r\n"
                        f"{via_hdrs}\r\n"
                        f"From: {from_hdr}\r\n"
                        f"To: {to_hdr};tag={to_tag}\r\n"
                        f"Call-ID: {call_id}\r\n"
                        f"CSeq: {cseq_hdr}\r\n"
                        f"Contact: <sip:{contact_user}@{via_host};transport=ws>\r\n"
                        f"Content-Length: 0\r\n\r\n"
                    )
                    wss.send_text(ring_resp)

                    caller_num = "Bilinmeyen Numara"
                    caller_name = ""
                    m_name = re.search(r'"([^"]+)"', from_hdr)
                    if m_name:
                        caller_name = m_name.group(1).strip()
                    m_num = re.search(r"sip:([^@>;]+)", from_hdr)
                    if m_num:
                        caller_num = m_num.group(1).strip()

                    if not caller_name or caller_name == caller_num or caller_name.isdigit():
                        crm_name = resolve_contact_name(caller_num)
                        if crm_name:
                            caller_name = crm_name

                    app_running = is_aida_mobile_running()
                    initial_was_locked = is_simulator_currently_locked()

                    active_invite = {
                        "call_id": call_id,
                        "from": from_hdr,
                        "to": to_hdr,
                        "to_tag": to_tag,
                        "cseq": cseq_hdr,
                        "vias": vias,
                        "caller": caller_num,
                        "caller_name": caller_name,
                        "cold_launch": not app_running,
                        "was_locked": initial_was_locked,
                    }

                    if not app_running and not initial_was_locked and not os.path.exists(HOMESCREEN_BG):
                        capture_homescreen_snapshot_if_safe(force=True)

                    for stale_path in (CANCEL_JSON, LOCK_BTN_PRESS_JSON):
                        try:
                            if os.path.exists(stale_path):
                                os.remove(stale_path)
                        except Exception:
                            pass

                    try:
                        with open(WAS_LOCKED_FILE, "w", encoding="utf-8") as wf:
                            wf.write("1" if initial_was_locked else "0")
                    except Exception:
                        pass

                    payload = {
                        "caller": caller_num,
                        "callerName": caller_name or caller_num,
                        "callId": call_id,
                        "coldLaunch": not app_running,
                        "pickupExten": "1000",
                        "wasLocked": initial_was_locked,
                        "timestamp": time.time(),
                    }
                    try:
                        with open(RING_JSON, "w", encoding="utf-8") as rf:
                            json.dump(payload, rf)
                    except Exception:
                        pass

                    was_locked = unlock_and_launch_simulator(
                        record_invite_lock_state=True,
                        forced_was_locked=initial_was_locked,
                        launch_app=True,
                    )
                    log(
                        f"Incoming SIP INVITE from {caller_num} ({caller_name}), app_running={app_running}, was_locked={was_locked} -> wrote {RING_JSON}"
                    )

                elif first_line.startswith("CANCEL ") or first_line.startswith("BYE "):
                    call_id = hdrs.get("call-id") or hdrs.get("i") or ""
                    from_hdr = hdrs.get("from") or hdrs.get("f") or ""
                    to_hdr = hdrs.get("to") or hdrs.get("t") or ""
                    cseq_hdr = hdrs.get("cseq") or ""
                    reason_hdr = hdrs.get("reason") or ""
                    via_hdrs = "\r\n".join(f"Via: {v}" for v in vias)
                    ok_resp = (
                        f"SIP/2.0 200 OK\r\n"
                        f"{via_hdrs}\r\n"
                        f"From: {from_hdr}\r\n"
                        f"To: {to_hdr}\r\n"
                        f"Call-ID: {call_id}\r\n"
                        f"CSeq: {cseq_hdr}\r\n"
                        f"Content-Length: 0\r\n\r\n"
                    )
                    wss.send_text(ok_resp)
                    with ring_state_lock:
                        ring_started_ts = 0.0

                    cancelled_invite = None
                    if first_line.startswith("CANCEL ") and active_invite and active_invite["call_id"] == call_id:
                        cancelled_invite = dict(active_invite)
                        inv_vias = "\r\n".join(f"Via: {v}" for v in active_invite["vias"])
                        term_resp = (
                            f"SIP/2.0 487 Request Terminated\r\n"
                            f"{inv_vias}\r\n"
                            f"From: {active_invite['from']}\r\n"
                            f"To: {active_invite['to']};tag={active_invite['to_tag']}\r\n"
                            f"Call-ID: {call_id}\r\n"
                            f"CSeq: {active_invite['cseq']}\r\n"
                            f"Content-Length: 0\r\n\r\n"
                        )
                        wss.send_text(term_resp)
                        active_invite = None

                    if "cause=200" in reason_hdr.lower() or "completed elsewhere" in reason_hdr.lower():
                        log(f"SIP CANCEL (answered via pickup) for {call_id} -> keeping call active")
                    else:
                        c_num = (cancelled_invite or {}).get("caller") or ""
                        c_name = (cancelled_invite or {}).get("caller_name") or ""
                        if not c_num:
                            m_num = re.search(r"sip:([^@>;]+)", from_hdr)
                            if m_num:
                                c_num = m_num.group(1).strip()
                        if not c_name and c_num:
                            c_name = resolve_contact_name(c_num)

                        with open(CANCEL_JSON, "w", encoding="utf-8") as cf:
                            json.dump(
                                {
                                    "callId": call_id,
                                    "caller": c_num,
                                    "callerName": c_name,
                                    "apnsPushed": True,
                                    "timestamp": time.time(),
                                },
                                cf,
                            )
                        log(f"SIP {first_line.split()[0]} for {call_id} -> wrote {CANCEL_JSON}")

                        if first_line.startswith("CANCEL "):
                            pushed_unanswered_call_ids.add(call_id)
                            disp = (
                                f"{c_name} ({c_num})"
                                if (c_name and c_name != c_num)
                                else (c_num or "Bilinmeyen Numara")
                            )
                            was_cold = bool((cancelled_invite or {}).get("cold_launch"))
                            was_locked_before = bool((cancelled_invite or {}).get("was_locked"))

                            def _restore_and_push_unanswered(disp_text, cold, locked_before):
                                time.sleep(0.35)
                                if cold:
                                    try:
                                        subprocess.run(
                                            ["xcrun", "simctl", "terminate", "booted", "com.aida.mobile"],
                                            stderr=subprocess.DEVNULL,
                                        )
                                    except Exception:
                                        pass
                                if locked_before:
                                    try:
                                        subprocess.run(
                                            [
                                                "xcrun",
                                                "simctl",
                                                "spawn",
                                                "booted",
                                                "notifyutil",
                                                "-s",
                                                "com.apple.springboard.lockstate",
                                                "1",
                                            ],
                                            stderr=subprocess.DEVNULL,
                                        )
                                        subprocess.run(
                                            [
                                                "xcrun",
                                                "simctl",
                                                "spawn",
                                                "booted",
                                                "notifyutil",
                                                "-p",
                                                "com.apple.springboard.lockstate",
                                            ],
                                            stderr=subprocess.DEVNULL,
                                        )
                                    except Exception:
                                        pass
                                    time.sleep(0.35)
                                send_simulator_apns_push(
                                    title=f"{disp_text} - Yanıtsız Çağrı",
                                    body="Gelen çağrı yanıtlanamadı. Arama geçmişini görüntülemek için dokunun.",
                                    sub_tab="history",
                                )

                            threading.Thread(
                                target=_restore_and_push_unanswered,
                                args=(disp, was_cold, was_locked_before),
                                daemon=True,
                            ).start()

        except Exception as e:
            log(f"VoIP Push WSS loop notice: {e}")
        finally:
            if wss:
                wss.close()
        time.sleep(3.0)


if __name__ == "__main__":
    capture_homescreen_snapshot_if_safe(force=True)
    t1 = threading.Thread(target=wake_and_lock_button_watcher_loop, daemon=True)
    t1.start()
    t2 = threading.Thread(target=apns_chat_poller_loop, daemon=True)
    t2.start()
    t3 = threading.Thread(target=apns_push_poller_loop, daemon=True)
    t3.start()
    voip_push_sip_loop()
