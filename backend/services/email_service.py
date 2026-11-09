import os
import re
import uuid
import html
import smtplib
import imaplib
import email
import email.header
import email.utils
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from typing import Dict, Any, List, Optional
import asyncio
from backend.services.audit_logger import log_event


def decode_mime_header_value(raw_val: Optional[str]) -> str:
    """Decodes RFC 2047 encoded MIME header values (e.g. =?UTF-8?B?...?= or =?iso-8859-9?Q?...?=)."""
    if not raw_val:
        return ""
    try:
        decoded_parts = email.header.decode_header(str(raw_val))
        chunks: List[str] = []
        for content, enc in decoded_parts:
            if isinstance(content, bytes):
                decoded_str = None
                for cand_enc in [enc, "utf-8", "windows-1254", "iso-8859-9", "latin-1"]:
                    if not cand_enc:
                        continue
                    try:
                        decoded_str = content.decode(cand_enc)
                        break
                    except Exception:
                        continue
                if decoded_str is None:
                    decoded_str = content.decode("utf-8", errors="replace")
                chunks.append(decoded_str)
            else:
                chunks.append(str(content))
        joined = "".join(chunks)
        return re.sub(r"[\r\n\t]+", " ", joined).strip()
    except Exception:
        return str(raw_val).strip()


def decode_mime_part_bytes(part) -> str:
    """Decodes a MIME message part payload using declared charset and Turkish-safe fallbacks."""
    raw_bytes = part.get_payload(decode=True)
    if raw_bytes is None:
        raw_payload = part.get_payload()
        return str(raw_payload) if isinstance(raw_payload, str) else ""
    if not isinstance(raw_bytes, (bytes, bytearray)):
        return str(raw_bytes)

    declared_charset = (part.get_content_charset() or "").strip().lower()
    for cand in [declared_charset, "utf-8", "windows-1254", "iso-8859-9", "latin-1"]:
        if not cand:
            continue
        try:
            return raw_bytes.decode(cand)
        except Exception:
            continue
    return raw_bytes.decode("utf-8", errors="replace")


def html_email_to_clean_text(html_str: str) -> str:
    """
    Converts HTML email markup into clean, structured, human-readable plain text
    without leaking <style>, <script>, MSO comments, or raw HTML tags.
    """
    if not html_str:
        return ""
    s = str(html_str)
    # Strip HTML comments (including Outlook MSO conditional blocks)
    s = re.sub(r"<!--[\s\S]*?-->", "", s)
    # Strip non-visible blocks completely with their content
    s = re.sub(r"<(head|style|script|noscript|title|svg|xml)\b[^>]*>[\s\S]*?</\1>", "", s, flags=re.IGNORECASE)
    # Strip hidden preheader divs/spans (display:none / visibility:hidden / mso-hide:all)
    s = re.sub(
        r"<(div|span|p|td)\b[^>]*style=[\"'][^\"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all)[^\"']*[\"'][^>]*>[\s\S]*?</\1>",
        "",
        s,
        flags=re.IGNORECASE,
    )
    # Convert links <a href="URL">Label</a> -> Label (URL) when meaningful
    def _replace_anchor(match):
        href = (match.group(1) or "").strip()
        inner = re.sub(r"<[^>]+>", "", match.group(2) or "").strip()
        inner = html.unescape(inner)
        if not href or href.lower().startswith(("javascript:", "mailto:")):
            return inner
        if not inner or inner == href or href in inner:
            return href
        return f"{inner} ({href})"

    s = re.sub(
        r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)</a>",
        _replace_anchor,
        s,
        flags=re.IGNORECASE,
    )

    # Structural line breaks & list bullets
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.IGNORECASE)
    s = re.sub(r"<hr\s*/?>", "\n────────────────────\n", s, flags=re.IGNORECASE)
    s = re.sub(r"<li\b[^>]*>", "\n• ", s, flags=re.IGNORECASE)
    s = re.sub(r"</(p|div|tr|h[1-6]|blockquote|section|article|header|footer|table|ul|ol)>", "\n", s, flags=re.IGNORECASE)
    s = re.sub(r"</(td|th)>", "  ", s, flags=re.IGNORECASE)

    # Remove remaining tags
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    # Remove zero-width / invisible email tracking spacers
    s = re.sub(r"[\u200b\u200c\u200d\ufeff\u00ad\u034f]+", "", s)
    s = s.replace("\xa0", " ").replace("\r\n", "\n").replace("\r", "\n")

    cleaned_lines: List[str] = []
    for line in s.split("\n"):
        ln = re.sub(r"[ \t]{2,}", " ", line).strip()
        cleaned_lines.append(ln)

    text_out = "\n".join(cleaned_lines)
    text_out = re.sub(r"\n{3,}", "\n\n", text_out).strip()
    return text_out


def extract_email_reply_subject(messages_texts: List[str], default_subject: str = "AIDA Müşteri Hizmetleri Yanıtı") -> str:
    """Extracts the latest email subject from session messages and prefixes with 'Re: '."""
    for txt in reversed(messages_texts or []):
        if not txt:
            continue
        m = re.search(r"(?:^|\n)E-Posta Konusu:\s*(.+)", str(txt))
        if m:
            subj = decode_mime_header_value(m.group(1).strip())
            if subj and subj != "(Konusuz E-Posta)":
                if re.match(r"^(?:re|ynt|aw)\s*:", subj, flags=re.IGNORECASE):
                    return subj
                return f"Re: {subj}"
    return default_subject


def _save_inbound_email_attachment(filename_raw: str, content_type: str, payload_bytes: bytes) -> Optional[str]:
    """Saves an inbound email attachment into /uploads and returns a [MEDIA:type|/uploads/...|filename] tag."""
    if not payload_bytes or len(payload_bytes) > 15 * 1024 * 1024:
        return None
    try:
        decoded_name = decode_mime_header_value(filename_raw) or "ek_dosya"
        safe_base = re.sub(r"[^a-zA-Z0-9_.\-\u00C0-\u024F]", "_", os.path.basename(decoded_name)).strip("._") or "ek_dosya"
        unique_fname = f"email_{uuid.uuid4().hex[:8]}_{safe_base}"

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        uploads_dir = os.path.join(base_dir, "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        full_path = os.path.join(uploads_dir, unique_fname)
        with open(full_path, "wb") as f:
            f.write(payload_bytes)

        ctype = (content_type or "").lower()
        ext_low = os.path.splitext(safe_base)[1].lower()
        if ctype.startswith("image/") or ext_low in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
            m_type = "image"
        elif ctype.startswith("video/") or ext_low in (".mp4", ".mov", ".webm"):
            m_type = "video"
        elif ctype.startswith("audio/") or ext_low in (".mp3", ".wav", ".ogg", ".m4a"):
            m_type = "audio"
        else:
            m_type = "document"
        clean_disp_name = decoded_name.replace("|", "_").replace("]", ")")
        return f"[MEDIA:{m_type}|/uploads/{unique_fname}|{clean_disp_name}]"
    except Exception as e_att:
        print(f"[Email Inbound Attachment Save Warning]: {e_att}")
        return None


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

        safe_html_body = html.escape(body_text or "").replace("\n", "<br>")
        alt_part = MIMEMultipart("alternative")
        part1 = MIMEText(body_text or "", "plain", "utf-8")
        html_content = f"""
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.65; color: #1e293b; background-color: #f8fafc; padding: 20px;">
            <div style="max-width: 620px; margin: 0 auto; padding: 24px 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px;">
              <div style="font-size: 14px; color: #1e293b;">{safe_html_body}</div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 22px 0 14px;" />
              <small style="color: #64748b; font-size: 11px;">Bu e-posta AIDA Omnichannel İletişim Merkezi üzerinden gönderilmiştir.</small>
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


def parse_rfc822_email_bytes(raw_bytes: bytes) -> Optional[Dict[str, Any]]:
    """
    Parses raw RFC822 email bytes into clean sender, sender_name, subject, body, and media_tags.
    """
    msg = email.message_from_bytes(raw_bytes)
    raw_from = msg.get("From", "")
    raw_name, sender_addr = email.utils.parseaddr(raw_from)
    sender_addr = (sender_addr or "").strip()
    if not sender_addr:
        return None

    sender_name = decode_mime_header_value(raw_name).strip(' "\'')
    subject = decode_mime_header_value(msg.get("Subject", "")) or "(Konusuz E-Posta)"

    plain_chunks: List[str] = []
    html_chunks: List[str] = []
    media_tags: List[str] = []

    if msg.is_multipart():
        for part in msg.walk():
            if part.is_multipart():
                continue
            ctype = (part.get_content_type() or "").lower()
            cdisp = str(part.get("Content-Disposition") or "").lower()
            fname = part.get_filename()

            if "attachment" in cdisp or (fname and ctype not in ("text/plain", "text/html")):
                att_bytes = part.get_payload(decode=True)
                if att_bytes:
                    tag = _save_inbound_email_attachment(fname or "ek_dosya", ctype, att_bytes)
                    if tag:
                        media_tags.append(tag)
                continue

            if ctype == "text/plain":
                txt = decode_mime_part_bytes(part)
                if txt and txt.strip():
                    plain_chunks.append(txt)
            elif ctype == "text/html":
                htxt = decode_mime_part_bytes(part)
                if htxt and htxt.strip():
                    html_chunks.append(htxt)
            elif fname:
                att_bytes = part.get_payload(decode=True)
                if att_bytes:
                    tag = _save_inbound_email_attachment(fname, ctype, att_bytes)
                    if tag:
                        media_tags.append(tag)
    else:
        ctype = (msg.get_content_type() or "text/plain").lower()
        decoded_single = decode_mime_part_bytes(msg)
        if ctype == "text/html":
            html_chunks.append(decoded_single)
        else:
            plain_chunks.append(decoded_single)

    body = "\n\n".join(plain_chunks).strip()
    if body:
        # If sender put raw HTML inside text/plain, clean it as well
        if re.search(r"<(?:html|body|table|div|p|br|style|span)\b", body, flags=re.IGNORECASE):
            body = html_email_to_clean_text(body)
        else:
            body = html.unescape(body).replace("\r\n", "\n").replace("\r", "\n")
            body = re.sub(r"\n{3,}", "\n\n", body).strip()
    elif html_chunks:
        body = html_email_to_clean_text("\n".join(html_chunks))

    if not body and not media_tags:
        return None

    return {
        "sender": sender_addr,
        "sender_name": sender_name,
        "subject": subject,
        "body": body,
        "media_tags": media_tags,
    }


async def poll_imap_inbox():
    """
    Background worker loop to poll IMAP inbox for incoming customer emails.
    """
    while True:
        try:
            from backend.main import settings_db
            from backend.services.chat_service import handle_inbound_chat_message
            channels_cfg = settings_db.get("channels", {})

            imap_host = str(channels_cfg.get("email_imap_host") or "").strip()
            imap_port = int(channels_cfg.get("email_imap_port") or 993)
            imap_user = str(channels_cfg.get("email_smtp_user") or "").strip()
            imap_pass = str(channels_cfg.get("email_smtp_pass") or "").strip()

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
                                        if isinstance(response_part, tuple) and response_part[1]:
                                            parsed_mail = parse_rfc822_email_bytes(response_part[1])
                                            if parsed_mail:
                                                emails_list.append(parsed_mail)
                        mail.logout()
                    except Exception as ex:
                        print(f"[IMAP Poll Error]: {ex}")
                    return emails_list

                incoming_emails = await asyncio.to_thread(_fetch_unread)
                for item in incoming_emails:
                    print(f"[Email Inbound] Yeni e-posta alındı -> {item['sender']}: {item['subject']}")
                    msg_parts = []
                    for m_tag in item.get("media_tags", []):
                        msg_parts.append(m_tag)
                    msg_parts.append(f"E-Posta Konusu: {item['subject']}")
                    if item.get("body"):
                        msg_parts.append(item["body"])
                    formatted_text = "\n\n".join(msg_parts)

                    await handle_inbound_chat_message(
                        channel="email",
                        sender_info=item["sender"],
                        text=formatted_text,
                        recipient_phone_num=imap_user,
                        sender_display_name=item.get("sender_name") or None,
                    )

        except Exception as e:
            print(f"[IMAP Poller Exception]: {e}")

        await asyncio.sleep(30)  # Poll every 30 seconds
