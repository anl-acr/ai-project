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
