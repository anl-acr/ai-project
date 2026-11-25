"""
Nornia Omnichannel CSAT (Customer Satisfaction Survey) Engine.
Automatically sends channel-native satisfaction surveys (WhatsApp Interactive Buttons,
Telegram InlineKeyboard, Instagram/Facebook Quick Replies, Email 1-click links)
when an Omnichannel session is closed, intercepts customer replies/low-score feedback,
alerts supervisors in real time, and produces channel & AI-vs-Human CSAT analytics.
"""

import datetime
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select, desc, or_

from backend.database.config import AsyncSessionLocal
from backend.database.models import ChatSession, ChatMessage, OmnichannelCsatSurvey


DEFAULT_OMNICHANNEL_CSAT_CONFIG: Dict[str, Any] = {
    "enabled": True,
    "trigger_on_close": True,
    "cooldown_hours": 24,
    "channels": ["whatsapp", "telegram", "instagram", "facebook", "mail"],
    "question_text": "Görüşmemizi nasıl değerlendirirsiniz? Geri bildiriminiz hizmet kalitemizi artırmamıza yardımcı olur.",
    "low_score_followup_enabled": True,
    "low_score_followup_text": "Yaşadığınız aksaklık için üzgünüz. İyileştirebilmemiz için kısaca nedenini yazar mısınız?",
    "thank_you_text": "Değerlendirmeniz için çok teşekkür ederiz! Size tekrar yardımcı olmaktan mutluluk duyarız.",
    "supervisor_alert_threshold": 2,
    "public_base_url": "",
}

CSAT_BUTTONS = [
    {"id": "csat_5", "title": "Çok Memnun (5)"},
    {"id": "csat_3", "title": "Orta (3)"},
    {"id": "csat_1", "title": "Memnun Değilim (1)"},
]


def _normalize_tenant(tenant_id: Optional[str]) -> str:
    t = str(tenant_id or "tenant-default").strip()
    return "tenant-default" if t in ("", "default") else t


def get_omnichannel_csat_config(tenant_id: str = "tenant-default") -> Dict[str, Any]:
    from backend.main import settings_db
    tid = _normalize_tenant(tenant_id)
    tenant_map = settings_db.get("tenant_omnichannel_csat") or {}
    raw = tenant_map.get(tid)
    if not isinstance(raw, dict):
        if tid == "tenant-default":
            raw = settings_db.get("omnichannel_csat") or {}
        else:
            raw = {}
    merged = dict(DEFAULT_OMNICHANNEL_CSAT_CONFIG)
    merged.update({k: v for k, v in raw.items() if v is not None})
    return merged


def save_omnichannel_csat_config(cfg: Dict[str, Any], tenant_id: str = "tenant-default") -> Dict[str, Any]:
    from backend.main import settings_db, save_settings
    tid = _normalize_tenant(tenant_id)
    merged = dict(DEFAULT_OMNICHANNEL_CSAT_CONFIG)
    merged.update({k: v for k, v in (cfg or {}).items() if k in DEFAULT_OMNICHANNEL_CSAT_CONFIG})
    merged["cooldown_hours"] = max(0, min(720, int(merged.get("cooldown_hours") or 0)))
    merged["supervisor_alert_threshold"] = max(1, min(4, int(merged.get("supervisor_alert_threshold") or 2)))
    if not isinstance(merged.get("channels"), list):
        merged["channels"] = list(DEFAULT_OMNICHANNEL_CSAT_CONFIG["channels"])
    settings_db.setdefault("tenant_omnichannel_csat", {})[tid] = merged
    if tid == "tenant-default":
        settings_db["omnichannel_csat"] = merged
    save_settings(settings_db)
    return merged


def _resolve_wa_account_for_session(recipient_info: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    from backend.main import settings_db
    ch = settings_db.get("channels") or {}
    accs = ch.get("whatsapp_accounts") or []
    rec = str(recipient_info or "").strip().lower()
    if rec and isinstance(accs, list):
        for acc in accs:
            if not isinstance(acc, dict):
                continue
            pid = str(acc.get("phone_number_id") or "").strip()
            pnum = str(acc.get("phone_number") or "").strip()
            aname = str(acc.get("name") or "").strip().lower()
            if (pid and pid.lower() in rec) or (pnum and pnum.lower() in rec) or (aname and aname in rec):
                return (pid or None), (str(acc.get("token") or "").strip() or None)
    return None, None


def _parse_rating_from_text(text: str) -> Optional[Tuple[int, str]]:
    raw = str(text or "").strip()
    low = raw.lower()
    if not low:
        return None
    if low in ("csat_5", "5", "5/5", "çok memnun", "cok memnun", "çok memnun (5)", "cok memnun (5)", "mükemmel", "mukemmel", "harika"):
        return 5, "Çok Memnun"
    if low in ("csat_4", "4", "4/5", "iyi", "memnun", "memnunum"):
        return 4, "Memnun"
    if low in ("csat_3", "3", "3/5", "orta", "orta (3)", "idare eder", "normal"):
        return 3, "Orta"
    if low in ("csat_2", "2", "2/5", "kötü", "kotu"):
        return 2, "Kötü"
    if low in ("csat_1", "1", "1/5", "memnun değilim", "memnun degilim", "memnun değilim (1)", "memnun degilim (1)", "çok kötü", "cok kotu", "berbat"):
        return 1, "Memnun Değilim"
    m = re.match(r"^(?:csat[_\s-]*)?([1-5])(?:\s*[-/]\s*5|\s*y[ıi]ld[ıi]z|\s*puan)?$", low)
    if m:
        sc = int(m.group(1))
        labels = {5: "Çok Memnun", 4: "Memnun", 3: "Orta", 2: "Kötü", 1: "Memnun Değilim"}
        return sc, labels[sc]
    if "çok memnun" in low or "cok memnun" in low:
        return 5, "Çok Memnun"
    if "memnun değil" in low or "memnun degil" in low:
        return 1, "Memnun Değilim"
    return None


async def dispatch_omnichannel_csat_survey(
    session_id: str,
    tenant_id: Optional[str] = None,
    force: bool = False,
) -> Dict[str, Any]:
    """Sends a channel-native CSAT survey for the given Omnichannel ChatSession."""
    async with AsyncSessionLocal() as db:
        chat = await db.get(ChatSession, session_id)
        if not chat:
            return {"status": "error", "message": "Sohbet oturumu bulunamadı."}

        eff_tid = _normalize_tenant(tenant_id or chat.tenant_id)
        cfg = get_omnichannel_csat_config(eff_tid)
        if not force and (not cfg.get("enabled") or not cfg.get("trigger_on_close")):
            return {"status": "skipped", "reason": "csat_disabled"}

        ch_low = str(chat.channel or "").strip().lower()
        allowed_channels = [str(c).lower() for c in (cfg.get("channels") or [])]
        if not force and ch_low not in allowed_channels:
            return {"status": "skipped", "reason": f"channel_not_enabled:{ch_low}"}

        # Cooldown check per sender + channel
        cooldown_h = int(cfg.get("cooldown_hours") or 0)
        if not force and cooldown_h > 0:
            cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=cooldown_h)
            q_recent = await db.execute(
                select(OmnichannelCsatSurvey)
                .where(
                    OmnichannelCsatSurvey.sender_info == chat.sender_info,
                    OmnichannelCsatSurvey.channel == ch_low,
                    OmnichannelCsatSurvey.sent_at >= cutoff,
                )
                .limit(1)
            )
            if q_recent.scalar_one_or_none():
                return {"status": "skipped", "reason": "cooldown_active"}

        survey_id = f"csat-{uuid.uuid4().hex[:12]}"
        survey = OmnichannelCsatSurvey(
            id=survey_id,
            tenant_id=eff_tid,
            session_id=session_id,
            channel=ch_low,
            sender_info=chat.sender_info,
            assigned_agent=str(chat.assigned_agent or "ai"),
            assigned_user=chat.assigned_user,
            status="pending",
            sent_at=datetime.datetime.utcnow(),
        )
        db.add(survey)

        q_text = str(cfg.get("question_text") or DEFAULT_OMNICHANNEL_CSAT_CONFIG["question_text"]).strip()
        dispatch_res: Dict[str, Any] = {"status": "skipped"}

        try:
            if ch_low == "whatsapp":
                from backend.services.whatsapp_service import send_whatsapp_buttons
                pid, tok = _resolve_wa_account_for_session(chat.recipient_info)
                dispatch_res = await send_whatsapp_buttons(
                    chat.sender_info,
                    q_text,
                    CSAT_BUTTONS,
                    phone_number_id=pid,
                    token=tok,
                )
            elif ch_low == "telegram":
                from backend.services.telegram_service import send_telegram_buttons
                dispatch_res = await send_telegram_buttons(chat.sender_info, q_text, CSAT_BUTTONS)
            elif ch_low in ("instagram", "facebook"):
                from backend.services.meta_service import send_meta_quick_replies
                dispatch_res = await send_meta_quick_replies(chat.sender_info, q_text, CSAT_BUTTONS, channel=ch_low)
            elif ch_low == "mail":
                from backend.services.email_service import send_email_message
                from backend.main import settings_db
                ras_sub = str((settings_db.get("ras") or {}).get("subdomain") or "").strip()
                base_url = str(cfg.get("public_base_url") or "").strip().rstrip("/")
                if not base_url and ras_sub:
                    base_url = f"https://{ras_sub}.nornia.com.tr"
                if base_url:
                    rating_links = "\n".join([
                        f"• Çok Memnun (5): {base_url}/api/omnichannel/csat/rate/{survey_id}?score=5",
                        f"• Memnun (4): {base_url}/api/omnichannel/csat/rate/{survey_id}?score=4",
                        f"• Orta (3): {base_url}/api/omnichannel/csat/rate/{survey_id}?score=3",
                        f"• Kötü (2): {base_url}/api/omnichannel/csat/rate/{survey_id}?score=2",
                        f"• Memnun Değilim (1): {base_url}/api/omnichannel/csat/rate/{survey_id}?score=1",
                    ])
                    mail_body = f"{q_text}\n\nTek tıkla puanlamak için aşağıdaki bağlantılardan birine tıklayabilirsiniz:\n{rating_links}"
                else:
                    mail_body = f"{q_text}\n\nBu e-postayı 1 ile 5 arasında bir puan yazarak yanıtlayabilirsiniz (5 = Çok Memnun, 1 = Memnun Değilim)."
                dispatch_res = await send_email_message(
                    chat.sender_info,
                    "Görüşme Memnuniyet Değerlendirmesi",
                    mail_body,
                )
        except Exception as exc:
            print(f"[Omnichannel CSAT] Dispatch error ({ch_low}): {exc}")
            dispatch_res = {"status": "error", "message": str(exc)}

        sys_msg = ChatMessage(
            session_id=session_id,
            direction="outbound",
            sender="system",
            text=f"[CSAT Anketi Gönderildi] {q_text}",
        )
        db.add(sys_msg)
        await db.commit()
        return {"status": "success", "survey_id": survey_id, "dispatch": dispatch_res}


async def _send_channel_text(channel: str, sender_info: str, text: str, recipient_info: Optional[str] = None):
    ch_low = str(channel or "").lower()
    try:
        if ch_low == "whatsapp":
            from backend.services.whatsapp_service import send_whatsapp_message
            pid, tok = _resolve_wa_account_for_session(recipient_info)
            await send_whatsapp_message(sender_info, text, phone_number_id=pid, token=tok)
        elif ch_low == "telegram":
            from backend.services.telegram_service import send_telegram_message
            await send_telegram_message(sender_info, text)
        elif ch_low in ("instagram", "facebook"):
            from backend.services.meta_service import send_meta_message
            await send_meta_message(sender_info, text, channel=ch_low)
        elif ch_low == "mail":
            from backend.services.email_service import send_email_message
            await send_email_message(sender_info, "Değerlendirmeniz Alındı", text)
    except Exception as exc:
        print(f"[Omnichannel CSAT] Reply send warning ({ch_low}): {exc}")


async def _broadcast_csat_alert(survey: OmnichannelCsatSurvey):
    try:
        from backend.services.websocket_manager import ws_manager
        from backend.main import add_system_log
        msg = (
            f"Düşük Omnichannel CSAT Puanı ({survey.score}/5 - {survey.channel.upper()}): "
            f"{survey.sender_info} | Temsilci: {survey.assigned_user or survey.assigned_agent}"
        )
        if survey.feedback_text:
            msg += f" | Yorum: {survey.feedback_text[:160]}"
        add_system_log("CSAT_ALERT", "WARNING", msg)
        await ws_manager.broadcast_omnichannel_event({
            "type": "csat_low_score_alert",
            "survey": {
                "id": survey.id,
                "session_id": survey.session_id,
                "channel": survey.channel,
                "sender_info": survey.sender_info,
                "assigned_agent": survey.assigned_agent,
                "assigned_user": survey.assigned_user,
                "score": survey.score,
                "rating_label": survey.rating_label,
                "feedback_text": survey.feedback_text,
                "responded_at": (survey.responded_at or datetime.datetime.utcnow()).isoformat() + "Z",
            },
        })
    except Exception as exc:
        print(f"[Omnichannel CSAT] Supervisor alert warning: {exc}")


async def try_handle_omnichannel_csat_reply(
    channel: str,
    sender_info: str,
    text: str,
    recipient_phone_id: Optional[str] = None,
) -> bool:
    """
    Checks whether an incoming customer message is answering a pending Omnichannel CSAT survey
    or providing a low-score feedback comment. Returns True if consumed as a CSAT reply.
    """
    ch_low = str(channel or "").strip().lower()
    raw_text = str(text or "").strip()
    if not raw_text:
        return False

    now = datetime.datetime.utcnow()
    pending_cutoff = now - datetime.timedelta(hours=12)
    comment_cutoff = now - datetime.timedelta(minutes=20)

    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(OmnichannelCsatSurvey)
            .where(
                OmnichannelCsatSurvey.sender_info == str(sender_info),
                OmnichannelCsatSurvey.channel == ch_low,
                OmnichannelCsatSurvey.status.in_(["pending", "rated"]),
                OmnichannelCsatSurvey.sent_at >= pending_cutoff,
            )
            .order_by(desc(OmnichannelCsatSurvey.sent_at))
            .limit(1)
        )
        survey = q.scalar_one_or_none()
        if not survey:
            return False

        cfg = get_omnichannel_csat_config(survey.tenant_id)
        threshold = int(cfg.get("supervisor_alert_threshold") or 2)

        # Case 1: Pending rating
        if survey.status == "pending":
            parsed = _parse_rating_from_text(raw_text)
            if not parsed:
                return False
            score, label = parsed
            survey.score = score
            survey.rating_label = label
            survey.responded_at = now
            needs_followup = bool(cfg.get("low_score_followup_enabled", True)) and score <= threshold
            survey.status = "rated" if needs_followup else "commented"
            if score <= threshold:
                survey.supervisor_alerted = True

            db.add(ChatMessage(
                session_id=survey.session_id,
                direction="inbound",
                sender="customer",
                text=f"[CSAT Puanı: {score}/5 — {label}] {raw_text}",
            ))
            await db.commit()

            chat_obj = await db.get(ChatSession, survey.session_id)
            rec_info = (chat_obj.recipient_info if chat_obj else None) or recipient_phone_id
            reply_msg = (
                str(cfg.get("low_score_followup_text") or DEFAULT_OMNICHANNEL_CSAT_CONFIG["low_score_followup_text"])
                if needs_followup
                else str(cfg.get("thank_you_text") or DEFAULT_OMNICHANNEL_CSAT_CONFIG["thank_you_text"])
            )
            await _send_channel_text(ch_low, sender_info, reply_msg, recipient_info=rec_info)
            if score <= threshold:
                await _broadcast_csat_alert(survey)
            return True

        # Case 2: Low-score follow-up comment within 20 minutes
        if (
            survey.status == "rated"
            and survey.score is not None
            and survey.score <= threshold
            and survey.responded_at
            and survey.responded_at >= comment_cutoff
        ):
            survey.feedback_text = raw_text[:1000]
            survey.status = "commented"
            db.add(ChatMessage(
                session_id=survey.session_id,
                direction="inbound",
                sender="customer",
                text=f"[CSAT Geri Bildirim] {raw_text}",
            ))
            await db.commit()

            chat_obj = await db.get(ChatSession, survey.session_id)
            rec_info = (chat_obj.recipient_info if chat_obj else None) or recipient_phone_id
            thanks = str(cfg.get("thank_you_text") or DEFAULT_OMNICHANNEL_CSAT_CONFIG["thank_you_text"])
            await _send_channel_text(ch_low, sender_info, thanks, recipient_info=rec_info)
            await _broadcast_csat_alert(survey)
            return True

    return False


async def rate_survey_by_id(survey_id: str, score: int, feedback: Optional[str] = None) -> Optional[Dict[str, Any]]:
    sc = max(1, min(5, int(score)))
    labels = {5: "Çok Memnun", 4: "Memnun", 3: "Orta", 2: "Kötü", 1: "Memnun Değilim"}
    async with AsyncSessionLocal() as db:
        survey = await db.get(OmnichannelCsatSurvey, survey_id)
        if not survey:
            return None
        cfg = get_omnichannel_csat_config(survey.tenant_id)
        threshold = int(cfg.get("supervisor_alert_threshold") or 2)
        survey.score = sc
        survey.rating_label = labels[sc]
        survey.responded_at = datetime.datetime.utcnow()
        if feedback:
            survey.feedback_text = str(feedback).strip()[:1000]
        survey.status = "commented"
        if sc <= threshold:
            survey.supervisor_alerted = True
        await db.commit()
        if sc <= threshold:
            await _broadcast_csat_alert(survey)
        return {"id": survey.id, "score": sc, "label": labels[sc]}


async def get_omnichannel_csat_stats(tenant_id: str = "tenant-default", days: int = 30) -> Dict[str, Any]:
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=max(1, min(365, int(days or 30))))
    tid = _normalize_tenant(tenant_id)
    async with AsyncSessionLocal() as db:
        stmt = select(OmnichannelCsatSurvey).where(OmnichannelCsatSurvey.sent_at >= cutoff)
        if tid not in ("all", "global"):
            if tid == "tenant-default":
                stmt = stmt.where(
                    or_(
                        OmnichannelCsatSurvey.tenant_id.in_(["tenant-default", "default"]),
                        OmnichannelCsatSurvey.tenant_id.is_(None),
                    )
                )
            else:
                stmt = stmt.where(OmnichannelCsatSurvey.tenant_id == tid)
        stmt = stmt.order_by(desc(OmnichannelCsatSurvey.sent_at))
        rows = (await db.execute(stmt)).scalars().all()

    total_sent = len(rows)
    rated_rows = [r for r in rows if r.score is not None]
    total_responded = len(rated_rows)
    avg_score = round(sum(r.score for r in rated_rows) / total_responded, 2) if total_responded else 0.0
    positive_count = sum(1 for r in rated_rows if r.score >= 4)
    low_score_count = sum(1 for r in rated_rows if r.score <= 2)
    response_rate = round((total_responded / total_sent) * 100, 1) if total_sent else 0.0
    positive_pct = round((positive_count / total_responded) * 100, 1) if total_responded else 0.0

    # Channel breakdown
    by_channel: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        ch = (r.channel or "other").lower()
        bucket = by_channel.setdefault(ch, {"channel": ch, "sent": 0, "responded": 0, "sum_score": 0, "low_count": 0})
        bucket["sent"] += 1
        if r.score is not None:
            bucket["responded"] += 1
            bucket["sum_score"] += r.score
            if r.score <= 2:
                bucket["low_count"] += 1
    channel_breakdown = []
    for b in by_channel.values():
        b["avg_score"] = round(b["sum_score"] / b["responded"], 2) if b["responded"] else 0.0
        b["response_rate"] = round((b["responded"] / b["sent"]) * 100, 1) if b["sent"] else 0.0
        del b["sum_score"]
        channel_breakdown.append(b)

    # AI vs Human & per-agent breakdown
    ai_scores = [r.score for r in rated_rows if str(r.assigned_agent or "ai").lower() == "ai"]
    human_scores = [r.score for r in rated_rows if str(r.assigned_agent or "ai").lower() != "ai"]
    by_agent: Dict[str, Dict[str, Any]] = {}
    for r in rated_rows:
        ag = r.assigned_user if str(r.assigned_agent or "").lower() != "ai" and r.assigned_user else "AI Asistan"
        ab = by_agent.setdefault(ag, {"agent": ag, "is_ai": ag == "AI Asistan", "count": 0, "sum_score": 0, "low_count": 0})
        ab["count"] += 1
        ab["sum_score"] += r.score
        if r.score <= 2:
            ab["low_count"] += 1
    agent_breakdown = []
    for ab in by_agent.values():
        ab["avg_score"] = round(ab["sum_score"] / ab["count"], 2) if ab["count"] else 0.0
        del ab["sum_score"]
        agent_breakdown.append(ab)
    agent_breakdown.sort(key=lambda x: (-x["avg_score"], -x["count"]))

    recent_items = [
        {
            "id": r.id,
            "session_id": r.session_id,
            "channel": r.channel,
            "sender_info": r.sender_info,
            "assigned_agent": r.assigned_agent,
            "assigned_user": r.assigned_user or ("AI Asistan" if r.assigned_agent == "ai" else "Temsilci"),
            "status": r.status,
            "score": r.score,
            "rating_label": r.rating_label,
            "feedback_text": r.feedback_text,
            "supervisor_alerted": bool(r.supervisor_alerted),
            "sent_at": r.sent_at.isoformat() + "Z" if r.sent_at else None,
            "responded_at": r.responded_at.isoformat() + "Z" if r.responded_at else None,
        }
        for r in rows[:50]
    ]

    return {
        "days": days,
        "summary": {
            "total_sent": total_sent,
            "total_responded": total_responded,
            "response_rate": response_rate,
            "avg_score": avg_score,
            "positive_pct": positive_pct,
            "low_score_count": low_score_count,
        },
        "ai_vs_human": {
            "ai_count": len(ai_scores),
            "ai_avg": round(sum(ai_scores) / len(ai_scores), 2) if ai_scores else 0.0,
            "human_count": len(human_scores),
            "human_avg": round(sum(human_scores) / len(human_scores), 2) if human_scores else 0.0,
        },
        "channel_breakdown": channel_breakdown,
        "agent_breakdown": agent_breakdown,
        "recent": recent_items,
    }
