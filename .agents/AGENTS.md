# Antigravity Rules

## Custom Delete Confirmation Modal Rule
- Always use the custom application-native Delete Confirmation Modal instead of browser-native `confirm()`.
- The modal must match the premium design system, featuring:
  - A subtle backdrop-blur dark overlay (`bg-slate-950/60 backdrop-blur-sm`).
  - A red warning icon with soft background pulse.
  - "Sil" (Confirm delete - rose red button) and "Vazgeç" (Cancel - soft gray border button) options.
  - Smooth scale and opacity transitions.
- Apply this custom modal for all delete triggers across all dashboard/settings screens (e.g. Users, Breaks, SIP Trunks, etc.).

## Granular Permission Registration Rule
- Whenever a new feature, dashboard, or control panel is added to the system, it MUST be registered under the `SYSTEM_FEATURES` metadata inside [RoleSettings.js](file:///Users/anilacar/ai-project/frontend/components/settings/RoleSettings.js).
- Implement granular action codes (Görüntüleme: `:read`, Ekleme/Düzenleme: `:write`, Silme: `:delete`) for configuration screens.
- Use module access code (`:access`) for view-only sections (logs, panels).
- Strictly enforce the resolved user role's permissions inside the new feature's UI components (e.g., hiding or disabling edit forms, delete buttons, or blocking tab entry based on permission checks).
- Update the backend settings loader `load_settings()` in [main.py](file:///Users/anilacar/ai-project/backend/main.py) to provide seamless data migration for existing role profiles when adding new permission codes.

## Unified Add Button Design Rule
- Always use a unified red plus button (`+`) instead of text-labeled buttons (such as "Yeni Ekle", "Kişi Engelle", etc.) in page/panel headers for item creation or additions.
- The button style must be:
  - Background: `bg-rose-600 hover:bg-rose-500`
  - Shape & Size: `rounded-xl h-8 w-8 flex items-center justify-center shrink-0`
  - Text & Icon: No label text, just a `<Plus size={16} />` icon.
  - Tooltip: A standard `title="..."` attribute describing what is being added (e.g., `title="Yeni Kullanıcı Ekle"`, `title="Yeni Kriter Ekle"`, `title="Kişi Engelle"`, etc.) to show a hover tooltip.
- Apply this rule automatically for all existing screens and future new feature screens without requiring explicit user instruction.

## Dynamic Theme Color Rule
- Never hardcode specific color classes like `rose-500`, `emerald-500`, `blue-500`, etc. for primary interactive elements, active states, tags, backgrounds or borders in new components.
- Always use the `useTheme()` hook from `../../utils/theme.js` to extract dynamic variables: `bg`, `hover`, `text`, `border`, `ring`, `lightBg`, `lightText`, `borderLight`.
- Apply these destructured variables directly in your `className` (e.g., `className={"p-2 rounded " + bg + " " + hover}`).
- If you absolutely must use inline Tailwind classes, use the generic `primary` tailwind color mapped to CSS variables (e.g., `text-primary`, `bg-primary`, `border-primary`).

## Server Architecture & PM2 Process Memory
- **Production Server Directory**: `/opt/ai-project`
- **PM2 Managed Processes**:
  - `aida-app` (ID 0): Frontend web application (Next.js / React)
  - `aida-backend` (ID 2): Python FastAPI Backend & AudioSocket TCP Server
  - Backend Deployment Command: `git pull origin main && pm2 restart aida-backend`
  - Frontend Deployment Command: `cd /opt/ai-project/frontend && git pull origin main && npm run build && pm2 restart aida-app`
- **Virtual Environment**: `/opt/ai-project/venv` (`source venv/bin/activate`)
- **Key Services & Ports**:
  - Web Server / API: Port `8000` (FastAPI / Uvicorn)
  - AI Voice AudioSocket TCP Server: Port `9092` (launched automatically by `main.py` startup event)
  - Asterisk AMI: Port `5038` (`ai_backend_user` / `backend_secure_key_99`)
  - PostgreSQL DB: Port `5444` (`ai_pbx` database)
- **Asterisk Configuration & Sync**:
  - Dialplan dynamically constructs 36-char RFC 4122 compliant UUIDs via MD5 fallback for `AudioSocket`.
  - Dialplan sync command: `python3 backend/scripts/sync_asterisk.py` (zero external python dependencies).
  - PJSIP trunk settings are saved in PostgreSQL / `settings.json` and generated in `/etc/asterisk/pjsip_custom.conf`.
  - **WebRTC SIP.js Contact Rewriting Rule**: PJSIP WebRTC endpoints MUST set `rewrite_contact=no`. If set to `yes`, Asterisk rewrites the `Contact` header in `SIP/2.0 200 OK` to the server's public IP, causing SIP.js (`No Contact header pointing to us`) to reject `200 OK` and abort registration. In SIP.js options, `contactURI: uri` must be explicitly defined so SIP.js sends the exact domain URI in the Contact header instead of RFC 5737 dummy IPs (`192.0.2.x`). In SIP.js 0.20.1 options, `viaHost: IP` MUST be a valid IPv4 address (resolved via `/api/webrtc/config` backend endpoint); if passed a string domain name, `SIP.Utils.isIP` fails and SIP.js defaults back to dummy `192.0.2.x` IPs.
  - **WebRTC WebSocket 200 OK Interceptor**: To bypass SIP.js's strict client-side Contact matching drops, `ua.transport.onMessage` intercepts Asterisk's incoming `SIP/2.0 200 OK` REGISTER response directly over WebSocket and sets `setRegistered(true)`, guaranteeing instant online state in UI.
  - **Outbound Trunk Dialplan & CallerID Rule**: WebRTC outbound calls in `webrtc_agents` context MUST set `CALLERID(num)=908503607390` and `CALLERID(name)=908503607390` and route via `Operator_Trunk` (`PJSIP/Operator_Trunk/sip:90507...`) to avoid `Everyone is busy/congested` rejection errors from SIP operators like Ikon Telekom.
  - **Asterisk SSL Permissions**: Let's Encrypt certificates copied to `/etc/asterisk/keys/` must be combined (`fullchain.pem` + `privkey.pem` -> `asterisk.pem`) with `chmod 644` permissions so non-root Asterisk process can open WSS TLS on port 8089.
  - **Web Phone Live Presence & IP Address Tracking**: `registered_endpoints` dictionary in `backend/services/ami_manager.py` tracks active registered endpoints and client IP addresses (extracted from AMI `ContactStatus` events or `/api/webrtc/register_notify` HTTP headers `X-Forwarded-For` / `X-Real-IP`). Upon user logout (`handleLogout` in `index.js`), `/api/webrtc/unregister_notify` removes the user's extension from `registered_endpoints` and sets presence to offline. System `admin` accounts do not auto-register agent extensions. `new_get_users_endpoint` returns `ip_address` field for each user, displayed on hover over status LED in `UserSettings.js` (e.g. `Web Phone Bağlı (78.189.210.15)`).
- **RAG & Web Crawler / Gemini Live Architecture**:
  - `index_website_url` uses `verify=False` and standard User-Agent header to handle self-signed or expired SSL certificates.
  - Gemini Multimodal Live API WebSocket (`responseModalities: ["AUDIO"]`) does not support function calling (`tools` array with `functionDeclarations`) during live audio streams. Declaring `tools` causes `1007 (invalid frame payload data)` protocol crashes whenever Gemini attempts binary tool execution.
  - Resolution: Knowledge Base (RAG) chunks are dynamically injected directly into Gemini's `systemInstruction` at call initialization (`get_all_knowledge_base_context()`), and operational actions (hangup, transfer, abuse) are handled cleanly via STT text markers (`[ACTION: HANGUP]`, `[ACTION: TRANSFER]`), completely eliminating WebSocket 1007 crashes.
- **AI Voice Audio Cutoff (Barge-in Echo Suppression)**:
  - Low-amplitude background noise/echo (`avg_amplitude < 150`) is suppressed while `model_is_speaking` is True to prevent Gemini's server-side VAD from false-triggering `interrupted: true` and cutting off the AI's voice mid-sentence.
- **Agent Daily Performance Stats & Reset Rule**:
  - `GET /api/agent/stats` dynamically computes today's call counts (inbound, outbound, missed) and total break times (in minutes, with per-break breakdown e.g. Yemek Molası, İhtiyaç Molası) starting strictly from 00:00:00 local time (Turkey UTC+3 / UTC 21:00:00 of previous calendar day).
  - Every night at 00:00:00 local time, `today_start_utc` advances automatically, resetting performance counters to 0 for the new day.
  - Break sessions are tracked in PostgreSQL `agent_break_logs` table (`AgentBreakLog` model) via `POST /api/agent/status`, recording start times, end times, and duration in seconds.
- **Web sngrep & PCAP Downloader Architecture**:
  - `SipTrapper` engine (`backend/services/sip_trapper.py`) captures UDP/TCP SIP frames on ports 5060, 5061, 8089 (WebRTC), parses headers (Method, Status, Call-ID, From, To, User-Agent, SDP), and groups packets chronologically into call sessions.
  - PCAP generator (`SipTrapper.generate_pcap_bytes`) formats raw PCAP Ethernet/IP/UDP headers on-the-fly, serving binary Wireshark and `sngrep` compatible `.pcap` files via `GET /api/sip-debugger/calls/{call_id}/pcap`.
  - Frontend component `<SipDebuggerPanel />` renders a live `sngrep`-style visual ladder flow diagram, raw header inspector, and one-click `.pcap` download. Registered under `SYSTEM_FEATURES` (`sip_debugger`) in `RoleSettings.js`.
- **WhatsApp Meta Business Cloud API Architecture**:
  - Webhook verification: `GET /api/webhooks/whatsapp` & `/api/webhook/whatsapp` validates `hub.verify_token` against `whatsapp_verify_token` (default: `ai_pbx_whatsapp_verify_token_secure`).
  - Inbound messages: `POST /api/webhooks/whatsapp` parses Meta Cloud API payloads and routes messages to `handle_inbound_chat_message`.
  - Outbound messaging: `send_whatsapp_message()` (`backend/services/whatsapp_service.py`) dispatches messages via `POST https://graph.facebook.com/v18.0/{phone_number_id}/messages` using `whatsapp_token`. It is triggered automatically when AI or human representative replies in a WhatsApp channel session.
- **Strict Multi-Tenant Isolation Architecture**:
  - `get_user_info` extracts `X-Tenant-ID` or `Tenant-ID` header / query param (`tenant_id`).
  - Helper functions `is_default_tenant(tenant_id)` and `is_global_tenant(tenant_id)` ensure seamless data preservation for "Ana Müşteri" (`tenant-default` / `default`) while strictly isolating newly created tenants (e.g. `tenant-nolto`).
  - DDL migrations (`ALTER TABLE tbl ADD COLUMN IF NOT EXISTS tenant_id VARCHAR DEFAULT 'tenant-default';`) executed on PostgreSQL startup across all 15 tables (`system_users`, `pbx_queues`, `trunks`, `calls`, `transcripts`, `appointments`, `chat_sessions`, `chat_messages`, `contacts`, `canned_responses`, `blacklist_items`, `block_words`, `system_roles`, `document_chunks`, `rules`).
  - Frontend components use `_app.js` global fetch interceptor to append `X-Tenant-ID` automatically and `key={activeTenantId}` in `index.js` for instant component remounting on tenant switch.

## Automatic Project Memory Update Rule
- Antigravity AI MUST automatically record all major architectural decisions, server deployment steps, environment configurations, PM2 process commands, key API ports, and troubleshooting insights directly into [AGENTS.md](file:///Users/anilacar/ai-project/.agents/AGENTS.md) as they are resolved during a task.
- Do not wait for explicit user prompt to update memory when a critical workflow or server insight is discovered.

