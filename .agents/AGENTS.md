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
  - **PJSIP Dynamic NAT & External IP Configuration Rule**: NAT settings (`enabled`, `extern_ip`, `local_nets`) managed via `GET/POST /api/settings/nat` dynamically inject `external_media_address`, `external_signaling_address`, and `local_net` entries into all PJSIP transports (`[transport-udp]`, `[transport-tcp]`, `[transport-ws]`, `[transport-wss]`) in `pjsip_custom.conf`. This ensures SIP trunks behind NAT/WAN register and initiate calls with the server's public IP address instead of unreachable internal local IPs.
  - **WebRTC SIP.js Contact Rewriting Rule**: PJSIP WebRTC endpoints MUST set `rewrite_contact=no`. If set to `yes`, Asterisk rewrites the `Contact` header in `SIP/2.0 200 OK` to the server's public IP, causing SIP.js (`No Contact header pointing to us`) to reject `200 OK` and abort registration. In SIP.js options, `contactURI: uri` must be explicitly defined so SIP.js sends the exact domain URI in the Contact header instead of RFC 5737 dummy IPs (`192.0.2.x`). In SIP.js 0.20.1 options, `viaHost: IP` MUST be a valid IPv4 address (resolved via `/api/webrtc/config` backend endpoint); if passed a string domain name, `SIP.Utils.isIP` fails and SIP.js defaults back to dummy `192.0.2.x` IPs.
  - **WebRTC WebSocket 200 OK Interceptor**: To bypass SIP.js's strict client-side Contact matching drops, `ua.transport.onMessage` intercepts Asterisk's incoming `SIP/2.0 200 OK` REGISTER response directly over WebSocket and sets `setRegistered(true)`, guaranteeing instant online state in UI.
  - **Outbound Trunk Dialplan & CallerID Rule**: WebRTC outbound calls in `webrtc_agents` context MUST set `CALLERID(num)=908503607390` and `CALLERID(name)=908503607390` and route via `Operator_Trunk` (`PJSIP/Operator_Trunk/sip:90507...`) to avoid `Everyone is busy/congested` rejection errors from SIP operators like Ikon Telekom.
  - **Asterisk SSL Permissions**: Let's Encrypt certificates copied to `/etc/asterisk/keys/` must be combined (`fullchain.pem` + `privkey.pem` -> `asterisk.pem`) with `chmod 644` permissions so non-root Asterisk process can open WSS TLS on port 8089.
  - **Web Phone Live Presence & IP Address Tracking**: `registered_endpoints` dictionary in `backend/services/ami_manager.py` tracks active registered endpoints and client IP addresses (extracted from AMI `ContactStatus` events or `/api/webrtc/register_notify` HTTP headers `X-Forwarded-For` / `X-Real-IP`). Upon user logout (`handleLogout` in `index.js`), `/api/webrtc/unregister_notify` removes the user's extension from `registered_endpoints` and sets presence to offline. System `admin` accounts do not auto-register agent extensions. `new_get_users_endpoint` returns `ip_address` field for each user, displayed on hover over status LED in `UserSettings.js` (e.g. `Web Phone Bağlı (78.189.210.15)`).
- **RAG & Web Crawler / Gemini Live Architecture**:
  - `index_website_url` uses `verify=False` and standard User-Agent header to handle self-signed or expired SSL certificates.
  - Gemini Multimodal Live API WebSocket (`responseModalities: ["AUDIO"]`) does not support function calling (`tools` array with `functionDeclarations`) during live audio streams. Declaring `tools` causes `1007 (invalid frame payload data)` protocol crashes whenever Gemini attempts binary tool execution.
  - Resolution: Knowledge Base (RAG) chunks are dynamically injected directly into Gemini's `systemInstruction` at call initialization (`get_all_knowledge_base_context()`), and operational actions (hangup, transfer, abuse) are handled cleanly via STT text markers (`[ACTION: HANGUP]`, `[ACTION: TRANSFER]`), completely eliminating WebSocket 1007 crashes.
- **AI Agent Visual Scenario & Prompt Compiler Architecture**:
  - Visual node-based scenario workflow designer (`<AIAgentScenarioEditor />`) allows configuring AI Agent dialogue trees, opening greetings, intent branching, KVKK consent, form data capture, transfer targets, and hangup farewells.
  - Saved scenario JSON flows (`scenario_flow`) are fetched/saved via `GET/POST /api/settings/ai-agents/{agent_id}/scenario` and automatically compiled by `compile_agent_scenario_to_instruction()` into structured natural language instructions (`compiled_scenario_instruction`) injected directly into Gemini system prompts during live AudioSocket calls.
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
- **Gemini Live Async Tool Execution Engine Architecture**:
  - `execute_async_tool_and_feed_context` (`backend/audiosocket_server.py`) handles real-time background tool calls (appointment creation, CRM lookup, webhooks) during active Gemini Live WebSocket audio streams without incurring 1007 protocol crashes.
  - When AI emits `[ACTION: TOOL_CALL name="..." ...]` markers, arguments are extracted via regex, executed asynchronously against PostgreSQL or external REST APIs, and injected back into Gemini Live stream context as `[SYSTEM TOOL RESULT]` user turns for immediate natural speech reporting.
- **AI Agent Dynamic Name-based Extension Transfer Architecture**:
  - Visual node `directory_lookup` ("İsimle Dahili / Personel Transferi") in `<AIAgentScenarioEditor />` enables dynamic name-to-extension routing.
  - Active system user directory (`system_users` / `SystemUser` SQLAlchemy model & `settings.json`) is dynamically loaded in `compile_system_prompt()` in `backend/services/prompt_manager.py` and injected into Gemini Live system instructions with name-extension maps.
  - Action tags `[ACTION: TRANSFER:1000]` or `[ACTION: TRANSFER:ext]` are parsed via regex in `backend/audiosocket_server.py` and executed via Asterisk AMI `redirect_call_to_human(call_id, extension=target_ext, context="webrtc_agents")`.
  - Dialplan pattern `exten => _[1-9]X.` in `backend/main.py` handles internal routing to 3-digit and 4-digit extensions (1000, 1001, 2000, etc.) upon AMI Redirect.
- **AI Scenario Assistant Popup Modal & NLP Generator Architecture**:
  - `<AIAgentScenarioEditor />` includes a dedicated AI Scenario Assistant Modal (`isAiModalOpen`) featuring a spacious multi-line textarea and preset buttons for natural language scenario design.
  - Backend endpoint `POST /api/settings/ai-agents/generate-scenario` processes Turkish natural language prompts via Gemini API or semantic regex fallback parser (`parse_scenario_semantically()`), mapping sentences, intent branches (`eğer/ise`), directory lookups, forms, numbers (`1000/2000`), and hangups directly into structured visual nodes and connection lines.
  - Process reloads incorporate 2-second timeouts on Asterisk/Docker subprocess calls (`timeout=2.0`) to avoid server startup blocking on local environments.
- **Omnichannel Multi-Channel Integration Architecture (WhatsApp, Telegram, Meta Direct, Email)**:
  - **WhatsApp Business Cloud API**: Verified via `GET/POST /api/webhooks/whatsapp`. Outbound messages dispatched via `backend/services/whatsapp_service.py` (`send_whatsapp_message`).
  - **Telegram Bot API**: Inbound messages handled via `POST /api/webhooks/telegram`. Outbound messages dispatched via `backend/services/telegram_service.py` (`send_telegram_message`).
  - **Meta Direct (Instagram & Facebook Messenger)**: Webhook endpoints `GET/POST /api/webhooks/meta`, `/api/webhooks/instagram`, `/api/webhooks/facebook`. Outbound messages dispatched via `backend/services/meta_service.py` (`send_meta_message`) using Meta Graph API `v18.0`.
  - **E-Posta (SMTP & IMAP Polling)**: Outbound emails sent via `backend/services/email_service.py` (`send_email_message` - SMTP SSL/TLS). Background poller worker `poll_imap_inbox()` fetches unread emails every 30 seconds and feeds incoming messages into `handle_inbound_chat_message`.
- **System Versioning & Deployment Verification Architecture (v2.4.8)**:
  - Central version registry endpoint `GET /api/settings/version` (and `/api/version`) returns current version code (`v2.4.8`), release date, and detailed version changelog history.
  - System Settings includes a dedicated visual panel `<ChangelogPanel />` under **Sistem Ayarları > Sistem Versiyonu & Günlük** (`?subtab=sistem-versiyonu`).
  - Features a one-click **Versiyon Kodu Kopyala** button allowing quick comparison between local and remote production server deployments.
- **Visual CallFlow Evaluator Engine, 3-Level Subscriber Forwarding Resolver & Dynamic Timeout**:
  - Asterisk `exten => s` dialplan dynamically extracts `REAL_DID` via `PJSIP_HEADER(read,To)` and `CHANNEL(name)`, preventing dummy `"s"` DIDs from being sent to `/api/calls/register`.
  - `/api/subscriber/resolve_forwarding` endpoint evaluates all 3 UI forwarding rules: `forwarding_always` (Her Zaman), `forwarding_busy` (Meşgul Durumda), and `forwarding_no_answer` (Zaman Aşımında/Cevapsız) with toggle state (`active: true/false`) and dynamic timeout (e.g. 15-30-60s).
  - Resolved `SystemUser.username` `AttributeError` exception inside `resolve_subscriber_forwarding` endpoint where non-existent column was queried, causing fallback exception handling to return `DENY:NONE:30` on every call.
  - Added robust stringified JSON dictionary handling for `forwarding_always`, `forwarding_busy`, and `forwarding_no_answer` fields.
  - If Dahili `1000` is offline (not SIP registered) or busy/unreachable/NOANSWER, Asterisk `webrtc_agents` dialplan automatically routes the call to the user's configured GSM mobile phone or forwarding number via `Operator_Trunk`.
  - AMI `get_ami_manager()` automatically registers `Newchannel`, `Hangup`, and `ContactStatus` event handlers on startup, maintaining real-time Asterisk channel tracking with `CoreShowChannels` fallback.
- **WhatsApp Cloud API 0850 Business Number Integration & Session Resolver**:
  - Registered 0850 business number `+90 850 360 7390` (`Phone Number ID: 1391907340666153`) under Meta WhatsApp Business Account (`1401185855534577`).
  - Added robust `re` regex and `or_` SQLAlchemy imports in `backend/services/chat_service.py` to prevent silent `NameError` exceptions during active session resolution.
  - Added top-level `try...except` wrapper around `handle_inbound_chat_message` to capture, log, and audit all inbound message processing errors to PostgreSQL `EventLog` (`PROCESS_ERROR`) and memory logs.
- **WhatsApp Advanced Features (Missed Call Auto-responder, Bulk Campaign Broadcast, Buttons & Media)**:
  - **Missed Call Auto-responder**: Integrated `send_whatsapp_missed_call_autoresponder()` into `end_call_endpoint` (`backend/main.py`). Whenever an inbound call ends as `no_answer`, `busy`, `failed`, or `cancelled`, an automated polite greeting is dispatched via WhatsApp to the caller's mobile number.
  - **Bulk Campaign Broadcast & CSV File Importer**: Created `POST /api/omnichannel/whatsapp/broadcast` and UI Modal (`<WhatsAppBroadcastModal />`) with an integrated **"CSV / TXT Dosyası Seç"** file reader (`FileReader`) that parses, cleans, and deduplicates phone numbers automatically.
  - **Interactive Buttons & Media**: Added `send_whatsapp_buttons()` (quick reply buttons) and `send_whatsapp_media()` (image/document/audio) in `backend/services/whatsapp_service.py`.
  - **Quick Add Contact Prop Synchronization & Flexible Phone Matching**: Fixed `<AddContactModal />` state initialization using `useEffect` and introduced `resolve_contact_name_by_phone()` in `main.py` and `chat_service.py`. Matches contacts by last 10 digits or cleaned phone strings so numbers formatted with `+90`, `0`, or spaces resolve contact names (e.g. `"Anıl Özel"`) and automatically hide the "Rehbere Kaydet" button.
  - **WhatsApp AI Persona Selector, Interactive Welcome Menu & After-Hours Auto-Responder**:
    - **Persona Selector**: `whatsapp_persona` (`samimi`, `satis`, `destek`, `kurumsal`) dynamically instructs Gemini's tone, empathy level, sales push, or corporate formality in `chat_service.py`.
    - **Interactive 3-Button Welcome Menu**: Automatically dispatches Meta interactive quick reply buttons `[Fiyat ve Bilgi]`, `[Randevu Al]`, `[Canlı Temsilci]` on new WhatsApp customer sessions (`is_new == True`).
    - **Representative Handoff**: Intercepts `Canlı Temsilci` button clicks or user text, switching `ChatSession.assigned_agent` to `human` and sending immediate confirmation.
    - **After-Hours Auto-Responder**: Evaluates Turkey UTC+3 local time and weekend status against configured work hours (`whatsapp_work_hours_start` to `whatsapp_work_hours_end`), dynamically injecting after-hours prompts into Gemini's system instructions.
  - **Multi-Number WhatsApp Architecture & Line Matching**:
    - `whatsapp_accounts` list in `channels` settings allows managing multiple WhatsApp phone lines per tenant (e.g. Satış Hattı `+90 850 360 7390`, Destek Hattı `+90 850 360 7391`).
    - Webhook extracts Meta `metadata.phone_number_id` and matches the incoming line account in `chat_service.py`, automatically applying that specific line's AI Persona, welcome menu, and access token.
    - Added `recipient_info` column to `ChatSession` PostgreSQL table and models (`chat_sessions.recipient_info`).
    - Omnichannel Panel renders clear line badges (e.g. `[Satış Hattı - 0850 360 7390]`) for representatives and displays line details in chat headers.
  - **On-Premise Tamper-Proof Cryptographic License Verification & Machine-Binding (Anti-Cloning) Architecture**:
    - `backend/services/hardware_info.py` extracts host DMI/Motherboard product UUID, Linux `/etc/machine-id`, disk volume UUID, and primary NIC MAC address to generate unique hardware fingerprint (`HW-361B-F973`).
    - `backend/services/license_service.py` computes 8-char HMAC-SHA256 signatures (`compute_license_signature`) mapping `(tenant_code, expiry_date_str, hardware_id)` with a secure master secret.
    - Key format: `AIDA-{TENANT_CODE}-{YYYYMMDD}-{HW8}-{SIG8}` (e.g. `AIDA-NOLTO-20271231-361BF973-4C24CE3A`). If a VM, disk image, or directory is cloned/copied to a new server or hypervisor, hardware ID mismatch causes immediate license validation rejection (`Lisans bu donanıma ait değildir`).
    - `check_and_update_tenant_expiration()` in `main.py` checks cryptographic validity on startup and request cycles, setting tenant `status = "passive"` if expired, tampered, or hardware mismatched.
    - CLI tools `backend/scripts/get_machine_id.py` (extracts client hardware ID during setup) and `backend/scripts/generate_client_license.py` (generates signed machine-bound license keys for vendor) provide easy deployment management.
    - AudioSocket engine (`audiosocket_server.py`) verifies license signature on incoming TCP calls and terminates calls immediately if license is invalid or passive (`[AudioSocket License Block]`).
    - Endpoints `GET /api/settings/license/status`, `POST /api/tenant/license/renew`, and `POST /api/settings/tenants/generate-license-key` provide live license status, server hardware ID display, automated HMAC key generation, and seamless UI key renewal modal (`<LicenseModal />`). Registered under `SYSTEM_FEATURES` (`tenant_license`) in `RoleSettings.js`.

## Automatic Project Memory Update Rule
- Antigravity AI MUST automatically record all major architectural decisions, server deployment steps, environment configurations, PM2 process commands, key API ports, and troubleshooting insights directly into [AGENTS.md](file:///Users/anilacar/ai-project/.agents/AGENTS.md) as they are resolved during a task.
- Do not wait for explicit user prompt to update memory when a critical workflow or server insight is discovered.


