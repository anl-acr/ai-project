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
  - Deployment Command: `git pull origin main && pm2 restart aida-backend`
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
- **RAG & Web Crawler**:
  - `index_website_url` uses `verify=False` and standard User-Agent header to handle self-signed or expired SSL certificates.
