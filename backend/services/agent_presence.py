import datetime

active_agent_status = {}

agent_state = {
    "is_logged_in": False,
    "status": "offline",  # offline, online, break, acw
    "current_break": None, # dict: {"id": 1, "name": "...", "color": "..."} or None
    "user_id": None,
    "extension": None,
    "status_since_utc": None
}

def get_agent_state(user_id=None, extension=None):
    for key in (user_id, extension):
        if key is not None and str(key).strip() != "":
            k_str = str(key).strip()
            if k_str in active_agent_status:
                return active_agent_status[k_str]
    if user_id is not None or extension is not None:
        return {
            "is_logged_in": False,
            "status": "offline",
            "current_break": None,
            "user_id": user_id,
            "extension": extension,
            "status_since_utc": None
        }
    return agent_state

def update_agent_state(is_logged_in: bool, status: str, current_break: dict = None, user_id=None, extension=None, status_since_utc: str = None):
    now_iso = status_since_utc or (datetime.datetime.utcnow().isoformat() + "Z")
    agent_state["is_logged_in"] = is_logged_in
    agent_state["status"] = status
    agent_state["current_break"] = current_break
    agent_state["user_id"] = user_id
    agent_state["extension"] = extension
    agent_state["status_since_utc"] = now_iso

    st_data = {
        "is_logged_in": is_logged_in,
        "status": status,
        "current_break": current_break,
        "user_id": user_id,
        "extension": extension,
        "status_since_utc": now_iso
    }

    for key in (user_id, extension):
        if key is not None and str(key).strip() != "":
            k_str = str(key).strip()
            active_agent_status[k_str] = st_data
            active_agent_status[key] = st_data
            if k_str.isdigit():
                active_agent_status[int(k_str)] = st_data

    return st_data

def is_agent_available(user_id=None, extension=None) -> bool:
    state = get_agent_state(user_id=user_id, extension=extension)
    return state.get("is_logged_in", False) and state.get("status") == "online"


# ============================================================================
# AUTO-PAUSE (OTOMATİK MOLA) ENGINE — RONA (Çağrı Kaçırma) & Bağlantı Kopması
# ============================================================================
import asyncio
import json

AUTO_BREAK_DEFAULT_COLOR = "#334155"  # Antrasit / Siyah
consecutive_missed_calls = {}  # { extension_str: int }
pending_disconnect_tasks = {}  # { extension_str: asyncio.Task }


def is_auto_break_name(break_name: str) -> bool:
    s = str(break_name or "").strip().lower()
    return s.startswith("otomatik mola") or "auto pause" in s or "autopause" in s


def reset_agent_missed_calls(extension: str):
    ext_s = str(extension or "").strip()
    if ext_s:
        consecutive_missed_calls[ext_s] = 0


async def sync_asterisk_queue_pause(extension: str, paused: bool, reason: str = "AutoPause"):
    """Pauses or unpauses PJSIP/{extension} across Asterisk queues via AMI and CLI fallback."""
    ext_s = str(extension or "").strip()
    if not ext_s or not ext_s.isdigit():
        return
    interface_str = f"PJSIP/{ext_s}"
    pause_val = "true" if paused else "false"
    try:
        from backend.services.ami_manager import get_ami_manager
        manager = await get_ami_manager()
        if manager:
            await manager.send_action({
                "Action": "QueuePause",
                "Interface": interface_str,
                "Paused": pause_val,
                "Reason": reason
            })
    except Exception as e_ami:
        print(f"[AutoPause AMI QueuePause Warning]: {e_ami}")

    try:
        import subprocess
        cmd_verb = "pause" if paused else "unpause"
        await asyncio.to_thread(
            subprocess.run,
            ["asterisk", "-rx", f"queue {cmd_verb} member {interface_str}"],
            check=False,
            timeout=1.5
        )
    except Exception:
        pass


def _resolve_user_and_queues_sync(extension_or_uid: str):
    """Synchronously resolves user profile dict and list of queues the user is a member of."""
    from backend.database.config import SyncSessionLocal
    from backend.database.models import PBXQueue, SystemUser, AgentBreakLog
    from backend.main import settings_db, load_settings

    key_s = str(extension_or_uid or "").strip()
    if not key_s:
        return None, [], None

    settings = settings_db if isinstance(settings_db, dict) and settings_db.get("users") else load_settings()
    all_groups = settings.get("subscriber_groups", [])

    user_dict = {}
    queues_list = []
    active_break_row = None
    has_login_today = False
    is_logged_out = False

    now_utc = datetime.datetime.utcnow()
    today_start_utc = (now_utc + datetime.timedelta(hours=3)).replace(hour=0, minute=0, second=0, microsecond=0) - datetime.timedelta(hours=3)

    try:
        with SyncSessionLocal() as session:
            db_users = session.query(SystemUser).all()
            for u in db_users:
                if str(u.extension or "").strip() == key_s or str(u.id) == key_s:
                    user_dict = {col.name: getattr(u, col.name) for col in SystemUser.__table__.columns}
                    break

            db_queues = session.query(PBXQueue).all()
            for q in db_queues:
                queues_list.append({col.name: getattr(q, col.name) for col in PBXQueue.__table__.columns})

            u_id_val = str(user_dict.get("id") or key_s).strip()
            u_ext_val = str(user_dict.get("extension") or key_s).strip()

            today_logs = (
                session.query(AgentBreakLog)
                .filter(
                    AgentBreakLog.start_time >= today_start_utc,
                    (AgentBreakLog.extension == u_ext_val) | (AgentBreakLog.user_id == u_id_val) | (AgentBreakLog.user_id == u_ext_val)
                )
                .order_by(AgentBreakLog.start_time.desc(), AgentBreakLog.id.desc())
                .all()
            )
            if today_logs:
                has_login_today = True
                if str(today_logs[0].break_name or "") == "__LOGOUT__":
                    is_logged_out = True
                for b in today_logs:
                    if b.end_time is None and not str(b.break_name or "").startswith("__"):
                        active_break_row = {
                            "id": b.id,
                            "break_name": b.break_name,
                            "start_time": b.start_time
                        }
                        break
    except Exception as e_db:
        print(f"[AutoPause DB Resolve Warning]: {e_db}")

    for u_disk in settings.get("users", []):
        if str(u_disk.get("extension") or "").strip() == key_s or str(u_disk.get("id") or "").strip() == key_s:
            for k, v in u_disk.items():
                if v not in (None, "") and not user_dict.get(k):
                    user_dict[k] = v
            break

    if not user_dict:
        return None, [], None

    if not queues_list:
        queues_list = settings.get("queues", [])

    u_id_s = str(user_dict.get("id") or "").strip()
    u_ext_s = str(user_dict.get("extension") or "").strip()
    my_keys = {k for k in (u_id_s, u_ext_s, key_s) if k}

    member_queues = []
    for q in queues_list:
        raw_members = q.get("queueMembers") or q.get("members") or []
        if isinstance(raw_members, str):
            try:
                raw_members = json.loads(raw_members)
            except Exception:
                raw_members = []
        matched = False
        for m in raw_members:
            m_val = m.get("user_id") or m.get("extension") or m.get("id") if isinstance(m, dict) else m
            s_val = str(m_val or "").strip()
            if not s_val:
                continue
            if s_val in my_keys:
                matched = True
                break
            if s_val.startswith("group_"):
                gid = s_val.replace("group_", "", 1)
                grp = next((g for g in all_groups if str(g.get("id")) == gid), None)
                if grp:
                    grp_exts = {str(x).strip() for x in (grp.get("extensions") or grp.get("members") or []) if x}
                    if my_keys & grp_exts:
                        matched = True
                        break
        if matched:
            member_queues.append(q)

    user_dict["_has_login_today"] = has_login_today
    user_dict["_is_logged_out"] = is_logged_out
    return user_dict, member_queues, active_break_row


async def _send_auto_pause_user_notification(
    user_dict: dict,
    break_name: str,
    reason_detail: str,
    queue_name: str = "",
    channels_mode: str = "both"
):
    """Dispatches Email and/or WhatsApp notification to the agent (and fallback recipients) when Auto-Pause triggers."""
    try:
        from backend.main import settings_db, add_system_log
        from backend.services.notification_service import get_tenant_notification_settings, _send_notification_email
        from backend.services.whatsapp_service import send_whatsapp_message

        full_name = str(user_dict.get("full_name") or user_dict.get("name") or f"Dahili {user_dict.get('extension')}").strip()
        ext_s = str(user_dict.get("extension") or "").strip()
        tenant_id = str(user_dict.get("tenant_id") or "tenant-default").strip()
        user_email = str(user_dict.get("email") or "").strip()
        user_phone = str(
            user_dict.get("gsm_number")
            or user_dict.get("mobile_number")
            or user_dict.get("phone")
            or ""
        ).strip()

        now_tr = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).strftime("%d.%m.%Y %H:%M:%S")
        q_label = queue_name or "Çağrı Merkezi Kuyruğu"
        mode = str(channels_mode or "both").lower()

        cfg = get_tenant_notification_settings(settings_db, tenant_id)
        channels_cfg = settings_db.get("channels", {})

        # 1. WhatsApp Notification
        if mode in ("both", "whatsapp"):
            wa_targets = []
            if user_phone:
                wa_targets.append(user_phone)
            else:
                raw_wa = str(cfg.get("whatsapp_recipients") or cfg.get("recipient_whatsapp_numbers") or "").strip()
                wa_targets = [n.strip() for n in raw_wa.replace(";", ",").split(",") if n.strip()]

            wa_text = (
                f"⚠️ *AIDA OTOMATİK MOLA BİLDİRİMİ*\n\n"
                f"👤 *Temsilci:* {full_name} (Dahili: `{ext_s}`)\n"
                f"📌 *Durum:* {break_name}\n"
                f"🏢 *Kuyruk:* {q_label}\n"
                f"🕒 *Zaman:* {now_tr}\n\n"
                f"📝 *Detay:*\n{reason_detail}\n\n"
                f"▶️ Çağrı almaya devam edebilmek için lütfen AIDA panelinizden *Molayı Bitir (Müsait)* durumuna geçiniz."
            )
            for num in wa_targets:
                clean_num = "".join(ch for ch in str(num) if ch.isdigit())
                if clean_num.startswith("0") and len(clean_num) == 11:
                    clean_num = "90" + clean_num[1:]
                elif len(clean_num) == 10 and clean_num.startswith("5"):
                    clean_num = "90" + clean_num
                if len(clean_num) >= 10:
                    try:
                        await send_whatsapp_message(to_phone=clean_num, text=wa_text)
                    except Exception as e_wa:
                        print(f"[AutoPause WhatsApp Send Error]: {e_wa}")

        # 2. Email Notification
        if mode in ("both", "email"):
            email_targets = []
            if user_email and "@" in user_email:
                email_targets.append(user_email)
            else:
                raw_em = str(cfg.get("email_recipients") or cfg.get("recipient_emails") or "").strip()
                email_targets = [e.strip() for e in raw_em.replace(";", ",").split(",") if e.strip() and "@" in e]

            if email_targets:
                subject = f"⚠️ [AIDA Otomatik Mola] {full_name} ({ext_s}) — {break_name}"
                plain_body = (
                    f"AIDA OTOMATİK MOLA BİLDİRİMİ\n"
                    f"============================\n"
                    f"Temsilci: {full_name} (Dahili: {ext_s})\n"
                    f"Durum: {break_name}\n"
                    f"Kuyruk: {q_label}\n"
                    f"Tarih/Saat: {now_tr}\n\n"
                    f"Açıklama:\n{reason_detail}\n\n"
                    f"Çağrı almaya devam edebilmek için lütfen AIDA panelinizden 'Molayı Bitir (Müsait)' durumuna geçiniz."
                )
                html_body = f"""
                <html>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
                    <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                      <div style="background: #1e293b; color: #ffffff; padding: 18px 24px; font-weight: 800; font-size: 16px;">
                        ⚠️ AIDA Otomatik Mola Bildirimi
                      </div>
                      <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
                        <p style="margin-top: 0; color: #0f172a; font-size: 15px;">Sayın <strong>{full_name}</strong> (Dahili: <strong>{ext_s}</strong>),</p>
                        <div style="background: #f1f5f9; border-left: 4px solid #334155; padding: 14px 16px; border-radius: 8px; margin: 16px 0; color: #1e293b; font-weight: 500;">
                          <strong>{break_name}</strong><br/>
                          {reason_detail}
                        </div>
                        <p style="color: #334155; font-size: 13px;">
                          Kuyruktan yeni çağrı almaya devam edebilmek için lütfen AIDA Temsilci Paneliniz üzerinden <strong>"Molayı Bitir (Müsait)"</strong> butonuna tıklayınız.
                        </p>
                        <table style="width: 100%; font-size: 12px; color: #64748b; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                          <tr>
                            <td><strong>Kuyruk:</strong> {q_label}</td>
                            <td><strong>Zaman (TR):</strong> {now_tr}</td>
                          </tr>
                        </table>
                      </div>
                    </div>
                  </body>
                </html>
                """
                try:
                    await _send_notification_email(cfg, channels_cfg, email_targets, subject, html_body, plain_body)
                except Exception as e_em:
                    print(f"[AutoPause Email Send Error]: {e_em}")

        try:
            add_system_log("AUTO_PAUSE", "WARNING", f"Otomatik Mola Tetiklendi: {full_name} ({ext_s}) -> {break_name} [{q_label}]")
        except Exception:
            pass
    except Exception as e_not:
        print(f"[AutoPause Notification Error]: {e_not}")


async def trigger_agent_auto_pause(
    extension_or_uid: str,
    reason_type: str,
    queue_cfg: dict = None,
    missed_count: int = 1
) -> bool:
    """
    Places the agent into Automatic Break ('Otomatik Mola (Çağrı Kaçırma)' or 'Otomatik Mola (Bağlantı Koptu)'),
    records it in AgentBreakLog, pauses the PJSIP member in Asterisk queues, and sends Email/WhatsApp alert.
    """
    user_dict, member_queues, active_break_row = await asyncio.to_thread(_resolve_user_and_queues_sync, extension_or_uid)
    if not user_dict:
        return False

    u_id_str = str(user_dict.get("id") or "").strip()
    u_ext_str = str(user_dict.get("extension") or "").strip()
    full_name = str(user_dict.get("full_name") or user_dict.get("name") or f"Dahili {u_ext_str}").strip()

    # Check if already on break in DB or memory
    mem_state = get_agent_state(user_id=u_id_str, extension=u_ext_str)
    if active_break_row is not None or (mem_state and mem_state.get("status") == "break"):
        return False

    # Do not auto-pause if the agent explicitly logged out and is not logged in
    is_mem_logged_in = bool(mem_state and mem_state.get("is_logged_in"))
    if user_dict.get("_is_logged_out") and not is_mem_logged_in:
        return False
    if not is_mem_logged_in and not user_dict.get("_has_login_today"):
        # For missed_call on a queue member, if they were registered and rang, allow auto-pause;
        # for disconnect, only auto-pause if they had an active session
        if reason_type == "disconnect":
            return False

    # Do not auto-pause if currently in an active talking call
    try:
        from backend.services.ami_manager import get_extension_call_state
        if u_ext_str and get_extension_call_state(u_ext_str) == "busy":
            return False
    except Exception:
        pass

    q_name = str((queue_cfg or {}).get("name") or (queue_cfg or {}).get("extension") or "Kuyruk").strip()
    if reason_type == "missed_call":
        break_name = "Otomatik Mola (Çağrı Kaçırma)"
        reason_detail = (
            f"'{q_name}' kuyruğundan gelen {missed_count} çağrıya üst üste yanıt verilmediği için "
            f"hesabınız otomatik olarak mola durumuna alınmıştır."
        )
    else:
        break_name = "Otomatik Mola (Bağlantı Koptu)"
        grace_s = int((queue_cfg or {}).get("auto_pause_disconnect_grace_sec") or 15)
        reason_detail = (
            f"Web Telefon / SIP telefon bağlantınız koptuğu ve {grace_s} saniye içinde yeniden bağlantı sağlanamadığı için "
            f"hesabınız otomatik olarak mola durumuna alınmıştır."
        )

    now_utc = datetime.datetime.utcnow()
    now_iso = now_utc.isoformat() + "Z"

    brk_obj = {
        "id": "auto_pause",
        "name": break_name,
        "color": AUTO_BREAK_DEFAULT_COLOR,
        "is_auto_break": True,
        "auto_reason": reason_type,
        "max_duration_minutes": 0,
        "daily_quota_minutes": 0,
        "start_time_utc": now_iso,
        "elapsed_seconds": 0
    }

    update_agent_state(
        is_logged_in=True,
        status="break",
        current_break=brk_obj,
        user_id=u_id_str,
        extension=u_ext_str,
        status_since_utc=now_iso
    )

    def _insert_break_db():
        from backend.database.config import SyncSessionLocal
        from backend.database.models import AgentBreakLog
        with SyncSessionLocal() as session:
            session.add(AgentBreakLog(
                tenant_id=str(user_dict.get("tenant_id") or "tenant-default"),
                user_id=u_id_str,
                extension=u_ext_str,
                agent_name=full_name,
                break_name=break_name,
                start_time=now_utc,
                end_time=None,
                duration_seconds=0
            ))
            session.commit()

    try:
        await asyncio.to_thread(_insert_break_db)
    except Exception as e_ins:
        print(f"[AutoPause DB Insert Error]: {e_ins}")

    if u_ext_str:
        await sync_asterisk_queue_pause(u_ext_str, True, reason=break_name)

    notify_enabled = True
    notify_channels = "both"
    if isinstance(queue_cfg, dict):
        if "auto_pause_notify_user" in queue_cfg and queue_cfg.get("auto_pause_notify_user") is not None:
            notify_enabled = bool(queue_cfg.get("auto_pause_notify_user"))
        if queue_cfg.get("auto_pause_notify_channels"):
            notify_channels = str(queue_cfg.get("auto_pause_notify_channels"))

    if notify_enabled:
        asyncio.create_task(
            _send_auto_pause_user_notification(
                user_dict=user_dict,
                break_name=break_name,
                reason_detail=reason_detail,
                queue_name=q_name,
                channels_mode=notify_channels
            )
        )

    print(f"[AutoPause] {full_name} ({u_ext_str}) -> {break_name} (Kuyruk: {q_name})")
    return True


async def handle_agent_missed_call_for_auto_pause(extension: str, queue_ext: str = ""):
    """Called when an agent misses/rejects an inbound call. Evaluates queue auto_pause_missed_enabled rules."""
    ext_s = str(extension or "").strip()
    if not ext_s or len(ext_s) > 6:
        return

    user_dict, member_queues, active_break_row = await asyncio.to_thread(_resolve_user_and_queues_sync, ext_s)
    if not user_dict or not member_queues or active_break_row is not None:
        return

    # Filter queues with auto_pause_missed_enabled
    enabled_queues = [
        q for q in member_queues
        if bool(q.get("auto_pause_missed_enabled", False))
        and (not queue_ext or str(q.get("extension") or "") == str(queue_ext) or str(q.get("name") or "") == str(queue_ext))
    ]
    if not enabled_queues:
        enabled_queues = [q for q in member_queues if bool(q.get("auto_pause_missed_enabled", False))]

    if not enabled_queues:
        return

    curr_missed = consecutive_missed_calls.get(ext_s, 0) + 1
    consecutive_missed_calls[ext_s] = curr_missed

    # Pick the queue with the lowest threshold that is now satisfied
    target_q = min(enabled_queues, key=lambda q: max(1, int(q.get("auto_pause_missed_count") or 1)))
    threshold = max(1, int(target_q.get("auto_pause_missed_count") or 1))

    if curr_missed >= threshold:
        consecutive_missed_calls[ext_s] = 0
        await trigger_agent_auto_pause(
            extension_or_uid=ext_s,
            reason_type="missed_call",
            queue_cfg=target_q,
            missed_count=curr_missed
        )


async def schedule_agent_disconnect_auto_pause(extension: str):
    """Schedules a grace-period check when a SIP/WebRTC endpoint becomes Unreachable or Removed."""
    ext_s = str(extension or "").strip()
    if not ext_s:
        return

    # Cancel any existing pending task for this extension
    old_task = pending_disconnect_tasks.pop(ext_s, None)
    if old_task and not old_task.done():
        old_task.cancel()

    user_dict, member_queues, active_break_row = await asyncio.to_thread(_resolve_user_and_queues_sync, ext_s)
    if not user_dict or not member_queues or active_break_row is not None:
        return

    enabled_queues = [q for q in member_queues if bool(q.get("auto_pause_disconnect_enabled", False))]
    if not enabled_queues:
        return

    target_q = min(enabled_queues, key=lambda q: max(3, int(q.get("auto_pause_disconnect_grace_sec") or 15)))
    grace_sec = max(3, int(target_q.get("auto_pause_disconnect_grace_sec") or 15))

    async def _delayed_disconnect_worker():
        try:
            await asyncio.sleep(grace_sec)
            from backend.services.ami_manager import registered_endpoints
            u_id_s = str(user_dict.get("id") or "").strip()
            # If the agent reconnected during the grace period, abort!
            if ext_s in registered_endpoints or (u_id_s and u_id_s in registered_endpoints):
                return
            await trigger_agent_auto_pause(
                extension_or_uid=ext_s,
                reason_type="disconnect",
                queue_cfg=target_q
            )
        except asyncio.CancelledError:
            pass
        except Exception as e_dc:
            print(f"[AutoPause Disconnect Worker Error]: {e_dc}")
        finally:
            pending_disconnect_tasks.pop(ext_s, None)

    pending_disconnect_tasks[ext_s] = asyncio.create_task(_delayed_disconnect_worker())


async def handle_agent_reconnect_auto_pause(extension: str):
    """Cancels pending disconnect timer and optionally auto-unpauses agent if queue is configured for 'auto' reconnect."""
    ext_s = str(extension or "").strip()
    if not ext_s:
        return

    old_task = pending_disconnect_tasks.pop(ext_s, None)
    if old_task and not old_task.done():
        old_task.cancel()

    user_dict, member_queues, active_break_row = await asyncio.to_thread(_resolve_user_and_queues_sync, ext_s)
    if not user_dict or not active_break_row:
        return

    b_name = str(active_break_row.get("break_name") or "")
    if "bağlantı koptu" not in b_name.lower():
        return

    auto_unpause = any(
        bool(q.get("auto_pause_disconnect_enabled", False))
        and str(q.get("auto_pause_reconnect_mode") or "manual").lower() == "auto"
        for q in member_queues
    )
    if not auto_unpause:
        return

    u_id_str = str(user_dict.get("id") or "").strip()
    now_utc = datetime.datetime.utcnow()

    def _end_auto_break_db():
        from backend.database.config import SyncSessionLocal
        from backend.database.models import AgentBreakLog
        with SyncSessionLocal() as session:
            active_logs = (
                session.query(AgentBreakLog)
                .filter(
                    AgentBreakLog.end_time.is_(None),
                    (AgentBreakLog.extension == ext_s) | (AgentBreakLog.user_id == u_id_str)
                )
                .all()
            )
            for al in active_logs:
                al.end_time = now_utc
                al.duration_seconds = max(0, int((now_utc - al.start_time).total_seconds()))
            session.commit()

    try:
        await asyncio.to_thread(_end_auto_break_db)
        update_agent_state(
            is_logged_in=True,
            status="online",
            current_break=None,
            user_id=u_id_str,
            extension=ext_s,
            status_since_utc=now_utc.isoformat() + "Z"
        )
        await sync_asterisk_queue_pause(ext_s, False, reason="AutoReconnect")
        print(f"[AutoPause] {ext_s} bağlantısı geri geldi -> Otomatik Müsait durumuna döndürüldü.")
    except Exception as e_rec:
        print(f"[AutoPause Reconnect Error]: {e_rec}")

