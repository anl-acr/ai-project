import React, { useEffect, useRef, useState } from "react";
import { Mail, FileText, Download, ChevronDown, ChevronUp, CornerDownRight, Bot, User } from "lucide-react";

const SAFE_EMAIL_ELEMENTS = [
  "div",
  "span",
  "main",
  "section",
  "article",
  "header",
  "footer",
  "figure",
  "figcaption",
  "address",
  "p",
  "br",
  "hr",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "del",
  "ins",
  "mark",
  "abbr",
  "kbd",
  "small",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "blockquote",
  "pre",
  "code",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "a",
];

const SAFE_EMAIL_ELEMENT_SET = new Set(SAFE_EMAIL_ELEMENTS);

export function isEmailChannel(channel) {
  const ch = String(channel || "").trim().toLowerCase();
  return ch === "email" || ch === "mail";
}

function normalizeCharsetLabel(rawCharset) {
  const c = String(rawCharset || "utf-8").trim().toLowerCase();
  if (c === "iso-8859-9" || c === "latin5" || c === "cp1254" || c === "windows-1254") {
    return "windows-1254";
  }
  if (c === "iso-8859-1" || c === "latin1") {
    return "iso-8859-1";
  }
  return "utf-8";
}

function decodeBytesWithCharset(bytes, charset) {
  const normalized = normalizeCharsetLabel(charset);
  if (typeof TextDecoder !== "undefined") {
    for (const candidate of [normalized, "utf-8", "windows-1254", "iso-8859-1"]) {
      try {
        return new TextDecoder(candidate, { fatal: false }).decode(bytes);
      } catch (e) {
        // try next decoder
      }
    }
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

export function decodeRfc2047(input) {
  if (!input || typeof input !== "string" || !input.includes("=?")) {
    return input || "";
  }
  // Join adjacent RFC 2047 encoded-words separated only by linear whitespace
  const collapsed = input.replace(/(\?=)\s+(=\?)/g, "$1$2");
  return collapsed.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (full, charset, encoding, payload) => {
    try {
      const mode = String(encoding || "").toUpperCase();
      if (mode === "B") {
        const cleanB64 = payload.replace(/\s+/g, "");
        const bin = typeof atob === "function" ? atob(cleanB64) : Buffer.from(cleanB64, "base64").toString("binary");
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          bytes[i] = bin.charCodeAt(i) & 0xff;
        }
        return decodeBytesWithCharset(bytes, charset);
      }
      if (mode === "Q") {
        const qNorm = payload.replace(/_/g, " ");
        const bytesArr = [];
        for (let i = 0; i < qNorm.length; i++) {
          if (qNorm[i] === "=" && i + 2 < qNorm.length && /^[0-9A-Fa-f]{2}$/.test(qNorm.slice(i + 1, i + 3))) {
            bytesArr.push(parseInt(qNorm.slice(i + 1, i + 3), 16));
            i += 2;
          } else {
            bytesArr.push(qNorm.charCodeAt(i) & 0xff);
          }
        }
        return decodeBytesWithCharset(new Uint8Array(bytesArr), charset);
      }
    } catch (e) {
      return full;
    }
    return full;
  });
}

export function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";
  const named = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&ndash;": "–",
    "&mdash;": "—",
    "&bull;": "•",
    "&hellip;": "…",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
  };
  return str
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39|ndash|mdash|bull|hellip|copy|reg|trade);/gi, (m) => named[m.toLowerCase()] || m);
}

export function extractMediaTags(rawText, apiBase = "") {
  const str = String(rawText || "");
  const attachments = [];
  const regex = /\[MED(?:IA|YA):([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/gi;
  const cleanedText = str
    .replace(regex, (_, typeRaw, urlRaw, nameRaw) => {
      const mediaType = String(typeRaw || "document").trim().toLowerCase();
      let mediaUrl = String(urlRaw || "").trim();
      if (mediaUrl.startsWith("/") && apiBase) {
        mediaUrl = `${apiBase}${mediaUrl}`;
      }
      const filename = decodeRfc2047(String(nameRaw || "").trim()) || mediaUrl.split("/").pop() || "ek_dosya";
      attachments.push({ mediaType, mediaUrl, filename });
      return "";
    })
    .trim();

  return { cleanedText, attachments };
}

function stripUnsafeEmailHtmlScaffolding(rawHtml) {
  let s = String(rawHtml || "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<!\[[^\]]*\]>/g, "");
  s = s.replace(/<(head|style|script|noscript|title|svg|xml|iframe|object|embed|meta|link|base)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<(meta|link|base)\b[^>]*\/?>/gi, "");
  s = s.replace(/<\/?[a-zA-Z0-9]+:[a-zA-Z0-9_-]+\b[^>]*>/g, "");
  s = s.replace(
    /<(div|span|p|td)\b[^>]*style=["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  // Normalize legacy presentational tags so strict Sanitizer allowlists keep their inner text
  s = s.replace(/<font\b[^>]*>/gi, "<span>").replace(/<\/font>/gi, "</span>");
  s = s.replace(/<center\b[^>]*>/gi, "<div>").replace(/<\/center>/gi, "</div>");
  return s.trim();
}

export function htmlToPlainPreview(rawHtml) {
  const cleaned = stripUnsafeEmailHtmlScaffolding(rawHtml)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(cleaned)
    .replace(/[\u200b\u200c\u200d\ufeff\u00ad\u034f]+/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitPlainEmailQuotedThread(bodyText) {
  const normalized = String(bodyText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return { mainBody: "", quotedHistory: "" };
  }

  const lines = normalized.split("\n");
  const headerQuotePatterns = [
    /^-{2,}\s*(?:Original Message|Özgün İleti|Orijinal İleti|Forwarded message|Yönlendirilen ileti)\s*-{2,}$/i,
    /^On\s+.+\swrote:\s*$/i,
    /^.+tarihinde\s+.+\s(?:şunu\s+)?yazdı:\s*$/i,
    /^(?:From|Kimden)\s*:\s*.+$/i,
  ];

  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (headerQuotePatterns.some((re) => re.test(trimmed))) {
      // For "From:/Kimden:", verify next 1-3 lines also look like email headers (Sent/Date/To/Subject)
      if (/^(?:From|Kimden)\s*:/i.test(trimmed)) {
        const nextChunk = lines.slice(i + 1, i + 5).join("\n");
        if (!/(?:Sent|Date|Tarih|Gönderme|To|Kime|Subject|Konu)\s*:/i.test(nextChunk)) {
          continue;
        }
      }
      const mainPart = lines.slice(0, i).join("\n").trim();
      const quotedPart = lines.slice(i).join("\n").trim();
      if (mainPart) {
        return { mainBody: mainPart, quotedHistory: quotedPart };
      }
    }
  }

  // Also check if trailing block consists of '>' quoted lines
  let firstTrailingQuoteIdx = -1;
  for (let i = lines.length - 1; i >= 1; i--) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t.startsWith(">")) {
      firstTrailingQuoteIdx = i;
    } else {
      break;
    }
  }
  if (firstTrailingQuoteIdx > 0) {
    const mainPart = lines.slice(0, firstTrailingQuoteIdx).join("\n").trim();
    const quotedPart = lines.slice(firstTrailingQuoteIdx).join("\n").trim();
    if (mainPart && quotedPart.length > 20) {
      return { mainBody: mainPart, quotedHistory: quotedPart };
    }
  }

  return { mainBody: normalized, quotedHistory: "" };
}

export function parseEmailMessage(rawText, apiBase = "") {
  const { cleanedText, attachments } = extractMediaTags(rawText, apiBase);
  let working = String(cleanedText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  let subject = "";
  const subjMatch = working.match(/^(?:E-Posta Konusu|Konu|Subject)\s*:\s*([^\n]*)(?:\n+([\s\S]*))?$/i);
  if (subjMatch) {
    subject = decodeRfc2047(subjMatch[1].trim());
    working = (subjMatch[2] || "").trim();
  }

  working = decodeRfc2047(working);

  const looksLikeHtml = /<(?:!doctype|html|head|body|table|tbody|tr|td|div|p|br|span|style|font|center|ul|ol|li|h[1-6]|blockquote|a)\b[^>]*>/i.test(
    working
  );

  if (looksLikeHtml) {
    let htmlBody = stripUnsafeEmailHtmlScaffolding(working);
    let quotedHtml = "";

    // Split Gmail / Outlook quoted reply containers if present
    const quoteSplitMatch = htmlBody.match(
      /(<div\b[^>]*class=["'][^"']*gmail_quote[^"']*["'][\s\S]*$|<div\b[^>]*id=["'](?:appendonsend|divRplyFwdMsg)["'][\s\S]*$|<blockquote\b[^>]*type=["']cite["'][\s\S]*$)/i
    );
    if (quoteSplitMatch && quoteSplitMatch.index > 0) {
      const candidateMain = htmlBody.slice(0, quoteSplitMatch.index).trim();
      if (htmlToPlainPreview(candidateMain).length > 0) {
        quotedHtml = htmlBody.slice(quoteSplitMatch.index).trim();
        htmlBody = candidateMain;
      }
    }

    const plainFallback = htmlToPlainPreview(htmlBody);
    return {
      hasSubjectHeader: Boolean(subjMatch),
      subject: subject || "",
      isHtml: true,
      htmlBody,
      quotedHtml,
      mainBody: plainFallback,
      quotedHistory: quotedHtml ? htmlToPlainPreview(quotedHtml) : "",
      attachments,
    };
  }

  const decodedPlain = decodeHtmlEntities(working)
    .replace(/[\u200b\u200c\u200d\ufeff\u00ad\u034f]+/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const { mainBody, quotedHistory } = splitPlainEmailQuotedThread(decodedPlain);

  return {
    hasSubjectHeader: Boolean(subjMatch),
    subject: subject || "",
    isHtml: false,
    htmlBody: "",
    quotedHtml: "",
    mainBody,
    quotedHistory,
    attachments,
  };
}

export function formatSessionPreviewText(rawText, channel) {
  if (!rawText) return "Mesaj yok";
  const mediaStripped = String(rawText)
    .replace(/\[MED(?:IA|YA):([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/gi, (_, t, _u, fn) => `📎 ${fn || t} `)
    .trim();

  if (isEmailChannel(channel) || /^E-Posta Konusu\s*:/i.test(mediaStripped)) {
    const parsed = parseEmailMessage(rawText);
    const subj = parsed.subject && parsed.subject !== "(Konusuz E-Posta)" ? parsed.subject : "";
    const snippet = (parsed.mainBody || "").replace(/\s+/g, " ").trim();
    const attPrefix = parsed.attachments.length > 0 ? `📎 (${parsed.attachments.length}) ` : "";
    if (subj && snippet) return `${attPrefix}${subj} — ${snippet}`;
    if (subj) return `${attPrefix}${subj}`;
    if (snippet) return `${attPrefix}${snippet}`;
    return attPrefix ? `${attPrefix}Ek Dosya` : "E-Posta";
  }

  return mediaStripped.replace(/\s+/g, " ").trim() || "Mesaj yok";
}

export function extractReplySubjectFromMessages(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const txt = messages[i]?.text || "";
    const m = String(txt).match(/(?:^|\n)E-Posta Konusu\s*:\s*([^\n]+)/i);
    if (m && m[1]) {
      const decoded = decodeRfc2047(m[1].trim());
      if (decoded && decoded !== "(Konusuz E-Posta)") {
        return /^(?:re|ynt|aw)\s*:/i.test(decoded) ? decoded : `Re: ${decoded}`;
      }
    }
  }
  return "";
}

function isSafeHref(rawHref) {
  const val = String(rawHref || "").trim();
  if (!val) return false;
  return /^(https?:\/\/|mailto:|tel:)/i.test(val);
}

function cloneSanitizedDomNode(node, doc) {
  if (node.nodeType === 3) {
    return doc.createTextNode(node.textContent || "");
  }
  if (node.nodeType !== 1) {
    return null;
  }
  const tag = node.tagName.toLowerCase();
  if (["script", "style", "head", "title", "noscript", "iframe", "object", "embed", "svg", "form", "meta", "link"].includes(tag)) {
    return null;
  }

  // Match native Sanitizer API behavior: elements outside the allowlist are removed together with their content
  if (!SAFE_EMAIL_ELEMENT_SET.has(tag)) {
    return null;
  }

  const cleanEl = doc.createElement(tag);
  if (tag === "a") {
    const href = node.getAttribute("href") || "";
    if (isSafeHref(href)) {
      cleanEl.setAttribute("href", href.trim());
      cleanEl.setAttribute("target", "_blank");
      cleanEl.setAttribute("rel", "noopener noreferrer");
    }
  }

  for (const child of Array.from(node.childNodes)) {
    const cleanChild = cloneSanitizedDomNode(child, doc);
    if (cleanChild) cleanEl.appendChild(cleanChild);
  }
  return cleanEl;
}

export function SanitizedEmailHtml({ html, className = "" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;
    const prepared = stripUnsafeEmailHtmlScaffolding(html || "");
    if (!prepared) {
      el.replaceChildren();
      return;
    }

    let renderedViaNative = false;
    if ("setHTML" in Element.prototype) {
      try {
        el.setHTML(prepared, {
          sanitizer: {
            elements: SAFE_EMAIL_ELEMENTS,
            attributes: ["href"],
          },
        });
        renderedViaNative = true;
      } catch (e) {
        renderedViaNative = false;
      }
    }

    if (!renderedViaNative) {
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(prepared, "text/html");
      const safeChildren = [];
      for (const child of Array.from(parsedDoc.body.childNodes)) {
        const cleanNode = cloneSanitizedDomNode(child, document);
        if (cleanNode) safeChildren.push(cleanNode);
      }
      el.replaceChildren(...safeChildren);
    }

    // Ensure every anchor opens safely in a new tab and uses safe URL schemes
    for (const anchor of Array.from(el.querySelectorAll("a"))) {
      const href = anchor.getAttribute("href") || "";
      if (!isSafeHref(href)) {
        anchor.removeAttribute("href");
      } else {
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
      }
    }
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={
        "email-sanitized-body text-[13px] leading-6 font-normal break-words [overflow-wrap:anywhere] " +
        "[&_p]:mb-2.5 [&_p:last-child]:mb-0 " +
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 " +
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 " +
        "[&_li]:mb-1 " +
        "[&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 dark:[&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-slate-500 dark:[&_blockquote]:text-slate-400 " +
        "[&_a]:underline [&_a]:underline-offset-2 [&_a]:font-medium " +
        "[&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_td]:py-1 [&_td]:pr-2 [&_th]:py-1 [&_th]:pr-2 [&_th]:text-left " +
        "[&_hr]:my-3 [&_hr]:border-slate-200 dark:[&_hr]:border-slate-700 " +
        className
      }
    />
  );
}

export function renderLinkifiedPlainText(text, isOutbound = false) {
  const raw = String(text || "");
  if (!raw) return null;
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  const parts = raw.split(urlRegex);
  return parts.map((part, idx) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 break-all ${
            isOutbound ? "text-white/95 hover:text-white" : "text-primary hover:opacity-80"
          }`}
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function formatEmailFullDateTime(ts) {
  if (!ts) return "";
  try {
    let isoString = String(ts);
    if (!isoString.endsWith("Z") && !isoString.includes("+") && !isoString.includes("-", 10)) {
      isoString += "Z";
    }
    const dt = new Date(isoString);
    return dt.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "";
  }
}

export function EmailMessageCard({
  msg,
  session,
  apiBase = "",
  fallbackSubject = "",
}) {
  const [showQuoted, setShowQuoted] = useState(false);
  const isCustomer = msg.direction === "inbound" || msg.sender === "customer";
  const isAi = msg.sender === "ai";
  const parsed = parseEmailMessage(msg.text || "", apiBase);

  const effectiveSubject =
    parsed.subject ||
    (!isCustomer && fallbackSubject ? fallbackSubject : "");

  const fromLabel = isCustomer
    ? session?.sender_name
      ? `${session.sender_name} <${session.sender_info}>`
      : session?.sender_info || "Müşteri"
    : isAi
      ? `AIDA Yapay Zeka Asistanı${session?.recipient_info ? ` <${session.recipient_info}>` : ""}`
      : `Müşteri Temsilcisi${session?.recipient_info ? ` <${session.recipient_info}>` : ""}`;

  const toLabel = isCustomer
    ? session?.recipient_info || "Destek Gelen Kutusu"
    : session?.sender_info || "Müşteri";

  return (
    <div
      className={`w-full max-w-[92%] rounded-2xl border shadow-sm overflow-hidden transition-colors text-left ${
        isCustomer
          ? "mr-auto bg-white dark:bg-slate-800/95 border-slate-200/90 dark:border-slate-700/90 text-slate-800 dark:text-slate-100"
          : "ml-auto bg-slate-50/90 dark:bg-slate-800/70 border-primary/25 dark:border-primary/30 text-slate-800 dark:text-slate-100"
      }`}
    >
      {/* Email Envelope Header */}
      <div
        className={`px-4 py-3 border-b flex flex-col gap-1.5 ${
          isCustomer
            ? "bg-slate-50/90 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-700/70"
            : "bg-primary/5 dark:bg-primary/10 border-primary/15 dark:border-primary/20"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                isCustomer
                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                  : "bg-primary/15 text-primary border border-primary/25"
              }`}
            >
              {isCustomer ? <Mail size={14} /> : isAi ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug break-words">
                {effectiveSubject || "(Konusuz E-Posta)"}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{fromLabel}</span>
                {toLabel && (
                  <span className="ml-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                    → {toLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0 pt-0.5">
            {formatEmailFullDateTime(msg.timestamp)}
          </span>
        </div>
      </div>

      {/* Email Body */}
      <div className="px-4 py-3.5 space-y-3">
        {parsed.isHtml ? (
          <SanitizedEmailHtml
            html={parsed.htmlBody}
            className="text-slate-800 dark:text-slate-100 [&_a]:text-primary"
          />
        ) : parsed.mainBody ? (
          <div className="text-[13px] leading-6 font-normal text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {renderLinkifiedPlainText(parsed.mainBody, false)}
          </div>
        ) : parsed.attachments.length === 0 ? (
          <p className="text-xs italic text-slate-400">(İçerik bulunmuyor)</p>
        ) : null}

        {/* Quoted Previous Email History Toggle */}
        {(parsed.quotedHistory || parsed.quotedHtml) && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowQuoted((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900/80 dark:hover:bg-slate-700/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition"
            >
              {showQuoted ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span>{showQuoted ? "Önceki E-Posta Geçmişini Gizle" : "Önceki E-Posta Geçmişini Göster"}</span>
            </button>
            {showQuoted && (
              <div className="mt-2.5 pl-3 border-l-2 border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                {parsed.quotedHtml ? (
                  <SanitizedEmailHtml
                    html={parsed.quotedHtml}
                    className="text-xs leading-5 text-slate-500 dark:text-slate-400 [&_a]:text-primary"
                  />
                ) : (
                  <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-5">
                    {renderLinkifiedPlainText(parsed.quotedHistory, false)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Email Attachments */}
        {parsed.attachments.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap gap-2">
            {parsed.attachments.map((att, idx) => (
              <div key={idx} className="max-w-full">
                {att.mediaType === "image" ? (
                  <a
                    href={att.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block space-y-1"
                  >
                    <img
                      src={att.mediaUrl}
                      alt={att.filename}
                      className="max-w-xs max-h-56 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:opacity-95 transition object-cover"
                    />
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Download size={11} /> {att.filename}
                    </span>
                  </a>
                ) : att.mediaType === "video" ? (
                  <video
                    src={att.mediaUrl}
                    controls
                    className="max-w-xs max-h-56 rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                ) : att.mediaType === "audio" ? (
                  <audio src={att.mediaUrl} controls className="max-w-xs" />
                ) : (
                  <a
                    href={att.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-900/90 dark:hover:bg-slate-700/80 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
                  >
                    <FileText size={15} className="text-primary shrink-0" />
                    <span className="truncate max-w-[220px]">{att.filename}</span>
                    <Download size={13} className="text-slate-400 shrink-0" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
