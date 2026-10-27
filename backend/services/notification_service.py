import os
import time
import asyncio
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional

from backend.services.whatsapp_service import send_whatsapp_message
from backend.services.audit_logger import log_event

# Default critical notification events metadata
DEFAULT_NOTIFICATION_EVENTS: Dict[str, Dict[str, Any]] = {
    "trunk_status_change": {
        "enabled": True,
        "email": True,
        "whatsapp": True,
        "title": "Dış Hat (SIP Trunk) Bağlandığında veya Koptuğunda",
        "description": "Operatör SIP Trunk dış hat bağlantısı kurulduğunda (Registered) veya koptuğunda (Unreachable / Disconnected) anında bildirim gönderir.",
        "category": "Santral & Telekom",
        "severity": "critical"
    },
    "concurrent_channels_full": {
        "enabled": True,
        "email": True,
        "whatsapp": True,
        "title": "Eş Zamanlı Çağrı Kanalı Dolduğunda / Tolerans Kanalı Devreye Girdiğinde",
        "description": "Lisanslı eş zamanlı çağrı kanalı dolup +N Tolerans Kanalı devreye girdiğinde veya maksimum kapasite aşılıp çağrı durdurulduğunda E-Mail ve WhatsApp ile uyarır.",
        "category": "Kapasite & Lisans",
        "severity": "warning"
    },
    "ai_provider_error_or_quota": {
        "enabled": True,
        "email": True,
        "whatsapp": True,
        "title": "AI Agent STT, TTS ve LLM Bağlantı Sorunlarında ve Kotaları Dolduğunda",
        "description": "Google Gemini, ElevenLabs, OpenAI, Deepgram, Anthropic veya Groq servislerinde API bağlantı hatası oluştuğunda veya tanımlı bakiye/kota tükendiğinde bildirim gönderir.",
        "category": "Yapay Zeka (AI)",
        "severity": "critical"
    },
    "system_reboot": {
        "enabled": True,
        "email": True,
        "whatsapp": True,
        "title": "Sistem Reboot Edildiğinde / Servisler Yeniden Başlatıldığında",
        "description": "Sunucu reboot edildiğinde veya AIDA arka plan ses ve santral servisleri yeniden başlatıldığında bilgi mesajı gönderir.",
        "category": "Sistem & Sunucu",
        "severity": "info"
    },
    "license_updated": {
        "enabled": True,
        "email": True,
        "whatsapp": True,
        "title": "Lisans Güncelleme İşlemi Olduğunda",
        "description": "Kriptografik lisans anahtarı yenilendiğinde, merkezi lisans sunucusundan kota/paket değişikliği yapıldığında veya lisans durumu değiştiğinde bildirir.",
        "category": "Kapasite & Lisans",
        "severity": "info"
    },
    "license_limit_reached": {
        "enabled": True,
        "email": True,
        "whatsapp": True,
        "title": "Lisanslar Son Limite Ulaştığında veya Süresi Dolmak Üzereyken",
        "description": "Kullanıcı, AI Temsilci, Kuyruk, Dış Hat vb. lisans kotaları %100 limite ulaştığında veya lisans bitiş süresine 7 günden az kaldığında uyarır.",
        "category": "Kapasite & Lisans",
        "severity": "warning"
    },
    "service_health_error": {
        "enabled": True,
        "email": True,
        "whatsapp": True,
        "title": "Sistem Genelinde Bir Serviste Sorun Oluştuğunda",
        "description": "Asterisk AMI, AudioSocket Ses Sunucusu (Port 9092), PostgreSQL Veritabanı veya Ses Kayıt (NAS) dizininde erişim/çökme sorunu yaşandığında acil bildirim gönderir.",
        "category": "Sistem & Sunucu",
        "severity": "critical"
    },
    "system_resource_high": {
        "enabled": True,
        "email": True,
        "whatsapp": False,
        "title": "Sunucu Disk, CPU veya RAM Kullanımı Kritik Eşiği Aştığında",
        "description": "Sunucu disk doluluk oranı, işlemci (CPU) veya bellek (RAM) kullanımı %90 kritik sınırını aştığında sistem yöneticisini uyarır.",
        "category": "Sistem & Sunucu",
        "severity": "warning"
    },
    "security_login_failed": {
        "enabled": True,
        "email": True,
        "whatsapp": False,
        "title": "Güvenlik İhlali & Başarısız Giriş Denemelerinde",
        "description": "Yönetici veya kullanıcı hesaplarına yönelik art arda başarısız giriş denemeleri veya yetkisiz erişim tespit edildiğinde uyarır.",
        "category": "Güvenlik",
        "severity": "warning"
    },
    "abuse_blacklist_triggered": {
        "enabled": False,
        "email": True,
        "whatsapp": False,
        "title": "Çağrıda Küfür / Suistimal Algılanıp Numara Kara Listeye Alındığında",
        "description": "AI Abuse Shield tarafından görüşme esnasında hakaret/küfür tespit edilip arayan numara otomatik engellendiğinde bilgi verir.",
        "category": "Güvenlik",
        "severity": "info"
    },
    "dialer_campaign_status": {
        "enabled": False,
        "email": True,
        "whatsapp": False,
        "title": "Otomatik Arama (Dialer) Kampanyası Tamamlandığında veya Durduğunda",
        "description": "Başlatılan dış arama kampanyası tamamlandığında veya dış hat hatası nedeniyle duraklatıldığında bildirim gönderir.",
        "category": "Santral & Telekom",
        "severity": "info"
    },
    "emergency_human_transfer": {
        "enabled": False,
        "email": True,
        "whatsapp": True,
        "title": "Kriz / Öfke Algılanıp Acil Canlı Temsilciye Aktarım Yapıldığında",
        "description": "Dinamik duygu analizi müşteride yüksek öfke tespit edip çağrıyı acil olarak insan temsilciye devrettiğinde uyarır.",
        "category": "Yapay Zeka (AI)",
        "severity": "warning"
    }
}

DEFAULT_NOTIFICATION_SETTINGS: Dict[str, Any] = {
    "enabled": True,
    "email_enabled": True,
    "email_recipients": "",
    "recipient_emails": "",
    "whatsapp_enabled": False,
    "whatsapp_recipients": "",
    "recipient_whatsapp_numbers": "",
    "use_custom_smtp": False,
    "smtp_override_enabled": False,
    "smtp_host": "",
    "smtp_port": 587,
    "smtp_user": "",
    "smtp_password": "",
    "smtp_pass": "",
    "smtp_from_name": "AIDA Sistem Bildirimi",
    "smtp_use_tls": True,
    "cooldown_minutes": 5,
    "events": DEFAULT_NOTIFICATION_EVENTS,
    "history": []
}

# Cooldown tracker in memory: { f"{tenant_id}:{event_key}": last_sent_epoch }
_LAST_NOTIFICATION_TIMES: Dict[str, float] = {}
_LAST_TRUNK_STATUS_MAP: Dict[str, bool] = {}
_LAST_AMI_CONNECTED: Optional[bool] = None


def get_tenant_notification_settings(settings_db: dict, tenant_id: str = "tenant-default") -> Dict[str, Any]:
    """Returns merged notification settings for the specified tenant."""
    tenant_map = settings_db.get("tenant_notifications", {})
    if tenant_id and tenant_id in tenant_map and isinstance(tenant_map.get(tenant_id), dict):
        raw = tenant_map.get(tenant_id, {})
    else:
        raw = settings_db.get("notifications") or settings_db.get("system_notifications") or {}

    merged = dict(DEFAULT_NOTIFICATION_SETTINGS)
    if isinstance(raw, dict):
        for k, v in raw.items():
            if k != "events":
                merged[k] = v

    # Synchronize alias fields so both frontend & backend keys always match
    emails_val = str(merged.get("email_recipients") or merged.get("recipient_emails") or "").strip()
    merged["email_recipients"] = emails_val
    merged["recipient_emails"] = emails_val

    wa_val = str(merged.get("whatsapp_recipients") or merged.get("recipient_whatsapp_numbers") or "").strip()
    merged["whatsapp_recipients"] = wa_val
    merged["recipient_whatsapp_numbers"] = wa_val

    custom_smtp = bool(merged.get("use_custom_smtp") or merged.get("smtp_override_enabled"))
    merged["use_custom_smtp"] = custom_smtp
    merged["smtp_override_enabled"] = custom_smtp

    smtp_pw = str(merged.get("smtp_password") or merged.get("smtp_pass") or "").strip()
    merged["smtp_password"] = smtp_pw
    merged["smtp_pass"] = smtp_pw

    # Deep merge events
    merged_events = {}
    raw_events = raw.get("events", {}) if isinstance(raw, dict) else {}
    for ev_key, ev_default in DEFAULT_NOTIFICATION_EVENTS.items():
        ev_copy = dict(ev_default)
        if isinstance(raw_events.get(ev_key), dict):
            user_ev = raw_events[ev_key]
            ev_copy["enabled"] = bool(user_ev.get("enabled", ev_default["enabled"]))
            ev_copy["email"] = bool(user_ev.get("email", ev_default["email"]))
            ev_copy["whatsapp"] = bool(user_ev.get("whatsapp", ev_default["whatsapp"]))
        merged_events[ev_key] = ev_copy

    merged["events"] = merged_events
    if not isinstance(merged.get("history"), list):
        merged["history"] = []
    return merged


async def _send_notification_email(
    cfg: Dict[str, Any],
    channels_cfg: Dict[str, Any],
    recipients: List[str],
    subject: str,
    html_body: str,
    plain_body: str
) -> Dict[str, Any]:
    """Sends notification email using either custom SMTP override or system channels SMTP."""
    use_custom = bool(cfg.get("use_custom_smtp") or cfg.get("smtp_override_enabled"))
    if use_custom and cfg.get("smtp_host") and cfg.get("smtp_user"):
        smtp_host = str(cfg.get("smtp_host", "")).strip()
        smtp_port = int(cfg.get("smtp_port") or 587)
        smtp_user = str(cfg.get("smtp_user", "")).strip()
        smtp_pass = str(cfg.get("smtp_password") or cfg.get("smtp_pass") or "").strip()
        use_tls = bool(cfg.get("smtp_use_tls", True))
    else:
        smtp_host = str(channels_cfg.get("email_smtp_host", "")).strip()
        smtp_port = int(channels_cfg.get("email_smtp_port") or 587)
        smtp_user = str(channels_cfg.get("email_smtp_user", "")).strip()
        smtp_pass = str(channels_cfg.get("email_smtp_pass", "")).strip()
        use_tls = bool(channels_cfg.get("email_use_tls", True))

    if not smtp_host or not smtp_user:
        return {
            "status": "error",
            "message": "SMTP sunucu ayarları yapılandırılmamış. Lütfen E-Mail Bildirimleri içinden Özel SMTP bilgilerini veya Kanal Entegrasyonları > E-Posta ayarlarını giriniz."
        }

    msg = MIMEMultipart("alternative")
    msg["From"] = smtp_user
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject

    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    def _send_sync():
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            if use_tls:
                server.starttls()
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, recipients, msg.as_string())
        server.quit()

    try:
        await asyncio.to_thread(_send_sync)
        return {"status": "success", "message": f"E-posta gönderildi ({', '.join(recipients)})"}
    except Exception as e:
        return {"status": "error", "message": f"SMTP Hatası: {str(e)}"}


async def dispatch_system_notification(
    event_key: str,
    title: str,
    message: str,
    severity: str = "warning",
    tenant_id: str = "tenant-default",
    force: bool = False
) -> Dict[str, Any]:
    """
    Evaluates notification rules for `event_key` and dispatches Email and/or WhatsApp alerts.
    """
    try:
        from backend.main import settings_db, save_settings
        cfg = get_tenant_notification_settings(settings_db, tenant_id)
        if not force and not cfg.get("enabled", True):
            return {"status": "skipped", "reason": "Bildirim motoru devre dışı."}

        events_cfg = cfg.get("events", {})
        ev = events_cfg.get(event_key, DEFAULT_NOTIFICATION_EVENTS.get(event_key, {
            "enabled": True,
            "email": True,
            "whatsapp": True,
            "title": title
        }))

        if not force and not ev.get("enabled", False):
            return {"status": "skipped", "reason": f"'{event_key}' bildirimi devre dışı."}

        # Check anti-spam cooldown (use title hash in key if tolerance vs reject differs)
        cooldown_mins = int(cfg.get("cooldown_minutes") or 5)
        cooldown_key = f"{tenant_id}:{event_key}:{severity}"
        now_ts = time.time()
        if not force and cooldown_mins > 0:
            last_ts = _LAST_NOTIFICATION_TIMES.get(cooldown_key, 0)
            if (now_ts - last_ts) < (cooldown_mins * 60):
                return {"status": "skipped", "reason": "Cooldown süresi içinde."}

        _LAST_NOTIFICATION_TIMES[cooldown_key] = now_ts

        # Turkey local time (UTC+3)
        now_tr = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
        time_str = now_tr.strftime("%d.%m.%Y %H:%M:%S")

        severity_badges = {
            "critical": ("KRİTİK ALARM", "#e11d48", "🚨"),
            "warning": ("UYARI", "#d97706", "⚠️"),
            "info": ("BİLGİ", "#2563eb", "ℹ️"),
            "success": ("ÇÖZÜLDÜ / AKTİF", "#059669", "✅")
        }
        sev_label, sev_color, sev_icon = severity_badges.get(severity, ("BİLDİRİM", "#e11d48", "🔔"))

        results = {"email": None, "whatsapp": None}
        channels_sent = []

        # 1. Dispatch Email if enabled
        raw_emails = str(cfg.get("email_recipients") or cfg.get("recipient_emails") or "").strip()
        email_list = [e.strip() for e in raw_emails.replace(";", ",").split(",") if e.strip() and "@" in e]
        if cfg.get("email_enabled", True) and ev.get("email", True) and email_list:
            subject = f"{sev_icon} [AIDA {sev_label}] {title}"
            plain_body = (
                f"AIDA SİSTEM BİLDİRİMİ\n"
                f"=====================\n"
                f"Olay: {title}\n"
                f"Seviye: {sev_label}\n"
                f"Tarih/Saat: {time_str}\n"
                f"Müşteri/Tenant: {tenant_id}\n\n"
                f"Detay:\n{message}\n"
            )
            html_body = f"""
            <html>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
                <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                  <div style="background: {sev_color}; color: #ffffff; padding: 18px 24px; font-weight: 800; font-size: 16px;">
                    {sev_icon} AIDA Sistem Bildirimi — {sev_label}
                  </div>
                  <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
                    <h3 style="margin-top: 0; color: #0f172a; font-size: 17px;">{title}</h3>
                    <div style="background: #f1f5f9; border-left: 4px solid {sev_color}; padding: 14px 16px; border-radius: 8px; margin: 16px 0; white-space: pre-wrap; color: #1e293b; font-weight: 500;">{message}</div>
                    <table style="width: 100%; font-size: 12px; color: #64748b; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                      <tr>
                        <td><strong>Zaman (TR):</strong> {time_str}</td>
                        <td><strong>Tenant:</strong> {tenant_id}</td>
                        <td><strong>Kod:</strong> {event_key}</td>
                      </tr>
                    </table>
                  </div>
                </div>
              </body>
            </html>
            """
            channels_cfg = settings_db.get("channels", {})
            email_res = await _send_notification_email(cfg, channels_cfg, email_list, subject, html_body, plain_body)
            results["email"] = email_res
            if email_res.get("status") == "success":
                channels_sent.append("email")

        # 2. Dispatch WhatsApp if enabled
        raw_wa = str(cfg.get("whatsapp_recipients") or cfg.get("recipient_whatsapp_numbers") or "").strip()
        wa_list = [n.strip() for n in raw_wa.replace(";", ",").split(",") if n.strip()]
        if cfg.get("whatsapp_enabled", False) and ev.get("whatsapp", True) and wa_list:
            wa_text = (
                f"{sev_icon} *AIDA SİSTEM BİLDİRİMİ ({sev_label})*\n\n"
                f"📌 *Olay:* {title}\n"
                f"🕒 *Zaman:* {time_str}\n"
                f"🏢 *Tenant:* `{tenant_id}`\n\n"
                f"📝 *Detay:*\n{message}"
            )
            wa_results = []
            any_wa_ok = False
            for wa_num in wa_list:
                clean_num = "".join(ch for ch in wa_num if ch.isdigit())
                if clean_num.startswith("0") and len(clean_num) == 11:
                    clean_num = "90" + clean_num[1:]
                elif len(clean_num) == 10 and clean_num.startswith("5"):
                    clean_num = "90" + clean_num
                if len(clean_num) >= 10:
                    w_res = await send_whatsapp_message(clean_num, wa_text)
                    wa_results.append(w_res)
                    if (isinstance(w_res, dict) and w_res.get("status") == "success") or (isinstance(w_res, bool) and w_res):
                        any_wa_ok = True
            if any_wa_ok:
                channels_sent.append("whatsapp")
            results["whatsapp"] = wa_results

        # Record in history (keep last 40 items)
        history_entry = {
            "id": int(time.time() * 1000),
            "timestamp": time_str,
            "event_key": event_key,
            "title": title,
            "message": message,
            "severity": severity,
            "channels": channels_sent,
            "status": "sent" if channels_sent else "no_channel_or_failed"
        }

        cfg_history = cfg.get("history", [])
        cfg_history.insert(0, history_entry)
        cfg["history"] = cfg_history[:40]

        settings_db.setdefault("tenant_notifications", {})[tenant_id] = cfg
        if tenant_id in ["tenant-default", "default", "all", "global"]:
            settings_db["notifications"] = cfg
            settings_db["system_notifications"] = cfg
        save_settings(settings_db)

        return {
            "status": "success" if channels_sent else "warning",
            "channels_sent": channels_sent,
            "results": results,
            "entry": history_entry
        }
    except Exception as e:
        print(f"[Notification Dispatch Error]: {e}")
        return {"status": "error", "message": str(e)}


def trigger_notification_bg(
    event_key: str,
    title: str,
    message: str,
    severity: str = "warning",
    tenant_id: str = "tenant-default",
    force: bool = False
):
    """Fire-and-forget helper usable from both sync and async contexts."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(dispatch_system_notification(event_key, title, message, severity, tenant_id, force))
    except RuntimeError:
        pass


async def monitor_system_health_and_notify():
    """
    Background worker that periodically checks:
    - SIP Trunk connection changes (Connected / Disconnected)
    - Asterisk AMI & Core service health
    - Disk / CPU / RAM critical usage (> 90%)
    - License expiration proximity
    """
    global _LAST_AMI_CONNECTED
    await asyncio.sleep(15)

    while True:
        try:
            import psutil
            from backend.main import settings_db
            from backend.services.ami_manager import get_ami_manager, registered_endpoints

            # 1. Check CPU, RAM, Disk
            cpu_pct = psutil.cpu_percent(interval=1)
            ram_pct = psutil.virtual_memory().percent
            disk_pct = psutil.disk_usage("/").percent

            if cpu_pct >= 90 or ram_pct >= 90 or disk_pct >= 90:
                await dispatch_system_notification(
                    event_key="system_resource_high",
                    title="Sunucu Kaynak Kullanımı Kritik Sede (%90+)",
                    message=f"Anlık Sistem Kaynak Değerleri:\n• CPU Kullanımı: %{cpu_pct}\n• RAM Kullanımı: %{ram_pct}\n• Disk Doluluğu: %{disk_pct}",
                    severity="warning"
                )

            # 2. Check Asterisk AMI connectivity
            ami = await get_ami_manager()
            ami_ok = bool(ami and getattr(ami, "connected", False))
            if _LAST_AMI_CONNECTED is not None and ami_ok != _LAST_AMI_CONNECTED:
                if not ami_ok:
                    await dispatch_system_notification(
                        event_key="service_health_error",
                        title="Asterisk AMI Santral Bağlantısı Koptu!",
                        message="AIDA Backend ile Asterisk AMI (Port 5038) arasındaki bağlantı kesildi. Sistem otomatik yeniden bağlanmayı deniyor.",
                        severity="critical"
                    )
                else:
                    await dispatch_system_notification(
                        event_key="service_health_error",
                        title="Asterisk AMI Santral Bağlantısı Yeniden Kuruldu",
                        message="Asterisk AMI (Port 5038) bağlantısı normale döndü.",
                        severity="success"
                    )
            _LAST_AMI_CONNECTED = ami_ok

            # 3. Check SIP Trunks registration/connection status changes
            trunks = settings_db.get("trunks", [])
            for tr in trunks:
                if not isinstance(tr, dict) or not tr.get("is_active", True):
                    continue
                t_name = tr.get("name") or tr.get("trunk_name") or "Operator_Trunk"
                t_host = tr.get("host") or ""
                t_tenant = tr.get("tenant_id") or "tenant-default"
                is_reg = bool(tr.get("status") in ["registered", "online", "reachable", "active"] or t_name in registered_endpoints)
                prev_reg = _LAST_TRUNK_STATUS_MAP.get(t_name)
                if prev_reg is not None and prev_reg != is_reg:
                    if is_reg:
                        await dispatch_system_notification(
                            event_key="trunk_status_change",
                            title=f"Dış Hat (SIP Trunk) Bağlandı: {t_name}",
                            message=f"'{t_name}' ({t_host}) SIP Trunk dış hattı operatöre başarıyla bağlandı ve çağrı trafiğine hazır.",
                            severity="success",
                            tenant_id=t_tenant,
                            force=True
                        )
                    else:
                        await dispatch_system_notification(
                            event_key="trunk_status_change",
                            title=f"Dış Hat (SIP Trunk) Koptu: {t_name}",
                            message=f"'{t_name}' ({t_host}) SIP Trunk dış hat bağlantısı koptu! Gelen ve giden dış aramalar etkilenebilir.",
                            severity="critical",
                            tenant_id=t_tenant,
                            force=True
                        )
                _LAST_TRUNK_STATUS_MAP[t_name] = is_reg

        except Exception as e:
            print(f"[Health Monitor Notification Loop Error]: {e}")

        await asyncio.sleep(60)
