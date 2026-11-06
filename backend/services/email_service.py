import os
import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from typing import Dict, Any, List
import asyncio
from backend.services.audit_logger import log_event

async def send_email_message(to_email: str, subject: str, body_text: str, media_url: str = None, filename: str = None) -> Dict[str, Any]:
    """
    Sends an outbound email via SMTP with optional file attachment.
    """
    try:
        from backend.main import settings_db
        from backend.services.notification_service import normalize_smtp_host_and_port, deliver_mime_message_sync
        channels_cfg = settings_db.get("channels", {})
        
        smtp_user = str(channels_cfg.get("email_smtp_user") or "").strip()
        smtp_pass = str(channels_cfg.get("email_smtp_pass") or "").strip()
        smtp_host, smtp_port = normalize_smtp_host_and_port(
            channels_cfg.get("email_smtp_host", ""),
            channels_cfg.get("email_smtp_port", 587),
            smtp_user
        )
        use_tls = bool(channels_cfg.get("email_use_tls", True))

        if not smtp_host or not smtp_user:
            print("[Email Service] SMTP sunucu veya kullanıcı bilgisi bulunamadı. E-posta gönderilemedi.")
            return {"status": "error", "message": "SMTP server credentials are not configured."}

        msg = MIMEMultipart("mixed")
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg["Subject"] = subject or "AIDA Destek Yanıtı"

        alt_part = MIMEMultipart("alternative")
        part1 = MIMEText(body_text, "plain", "utf-8")
        html_content = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 10px;">
              <h3 style="color: #e11d48;">AIDA Omnichannel Destek</h3>
              <p>{body_text.replace(chr(10), '<br>')}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <small style="color: #888;">Bu e-posta AIDA Akıllı Asistan tarafından otomatik gönderilmiştir.</small>
            </div>
          </body>
        </html>
        """
        part2 = MIMEText(html_content, "html", "utf-8")
        alt_part.attach(part1)
        alt_part.attach(part2)
        msg.attach(alt_part)

        if media_url and "/uploads/" in media_url:
            rel_part = "uploads/" + media_url.split("/uploads/", 1)[1]
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            project_root = os.path.dirname(base_dir)
            for cand in [os.path.join(project_root, rel_part), os.path.join(base_dir, rel_part), rel_part]:
                if os.path.exists(cand) and os.path.isfile(cand):
                    doc_fname = filename or os.path.basename(cand)
                    with open(cand, "rb") as f:
                        att = MIMEApplication(f.read(), Name=doc_fname)
                    att["Content-Disposition"] = f'attachment; filename="{doc_fname}"'
                    msg.attach(att)
                    break

        res = await asyncio.to_thread(
            deliver_mime_message_sync,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_pass,
            use_tls,
            [to_email],
            msg.as_string()
        )
        if res.get("status") != "success":
            log_event("EMAIL_EXCEPTION", "ERROR", f"E-posta gönderme hatası: {res.get('message')}")
            return res
        print(f"[Email Service] E-posta başarıyla gönderildi -> {to_email} ({res.get('used_endpoint')})")
        log_event("EMAIL_SENT", "INFO", f"E-posta yollandı: {to_email}")
        return {"status": "success", "message": f"E-posta gönderildi: {to_email}"}

    except Exception as e:
        print(f"[Email Service Exception]: {e}")
        log_event("EMAIL_EXCEPTION", "ERROR", f"E-posta gönderme hatası: {e}")
        return {"status": "error", "message": str(e)}

async def poll_imap_inbox():
    """
    Background worker loop to poll IMAP inbox for incoming customer emails.
    """
    while True:
        try:
            from backend.main import settings_db, handle_inbound_chat_message
            channels_cfg = settings_db.get("channels", {})
            
            imap_host = channels_cfg.get("email_imap_host", "").strip()
            imap_port = int(channels_cfg.get("email_imap_port", 993))
            imap_user = channels_cfg.get("email_smtp_user", "").strip()
            imap_pass = channels_cfg.get("email_smtp_pass", "").strip()

            if imap_host and imap_user and imap_pass:
                def _fetch_unread():
                    emails_list = []
                    try:
                        mail = imaplib.IMAP4_SSL(imap_host, imap_port)
                        mail.login(imap_user, imap_pass)
                        mail.select("inbox")
                        status, response = mail.search(None, "UNSEEN")
                        if status == "OK" and response[0]:
                            for num in response[0].split():
                                status, data = mail.fetch(num, "(RFC822)")
                                if status == "OK":
                                    for response_part in data:
                                        if isinstance(response_part, tuple):
                                            msg = email.message_from_bytes(response_part[1])
                                            sender = email.utils.parseaddr(msg.get("From"))[1]
                                            subject = msg.get("Subject", "")
                                            
                                            body = ""
                                            if msg.is_multipart():
                                                for part in msg.walk():
                                                    if part.get_content_type() == "text/plain":
                                                        body = part.get_payload(decode=True).decode(errors="ignore")
                                                        break
                                            else:
                                                body = msg.get_payload(decode=True).decode(errors="ignore")
                                            
                                            if sender and body.strip():
                                                emails_list.append({
                                                    "sender": sender,
                                                    "subject": subject,
                                                    "body": body.strip()
                                                })
                        mail.logout()
                    except Exception as ex:
                        print(f"[IMAP Poll Error]: {ex}")
                    return emails_list

                incoming_emails = await asyncio.to_thread(_fetch_unread)
                for item in incoming_emails:
                    print(f"[Email Inbound] Yeni e-posta alındı -> {item['sender']}: {item['subject']}")
                    await handle_inbound_chat_message(
                        sender_info=item["sender"],
                        text=f"E-Posta Konusu: {item['subject']}\n\n{item['body']}",
                        channel="email"
                    )

        except Exception as e:
            print(f"[IMAP Poller Exception]: {e}")

        await asyncio.sleep(30) # Poll every 30 seconds
