import os
import re

MAIN_PY = os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")

with open(MAIN_PY, "r", encoding="utf-8") as f:
    content = f.read()

# Append needs-apply endpoints
needs_apply_endpoints = """

@app.get("/api/settings/needs-apply")
async def get_needs_apply():
    return {"needs_apply": settings_db.get("needs_apply", False)}

@app.post("/api/settings/needs-apply")
async def set_needs_apply(status: dict):
    settings_db["needs_apply"] = status.get("needs_apply", True)
    save_settings(settings_db)
    return {"status": "success"}
"""

if "/api/settings/needs-apply" not in content:
    content += needs_apply_endpoints

# Modify save_settings_endpoint, save_users_endpoint, etc to set needs_apply
# Actually, the user only cares if they do an action. I can just have the frontend set it!
# When the frontend saves something, it can call POST /api/settings/needs-apply {needs_apply: true}.
# But the backend doing it automatically is better.
# Let's just modify the POST /api/settings/apply endpoint to set it to False!

apply_endpoint_modified = """@app.post("/api/settings/apply")
async def apply_settings_endpoint(background_tasks: BackgroundTasks, user_info: dict = Depends(get_user_info)):
    settings_db["needs_apply"] = False
    save_settings(settings_db)
    regenerate_pjsip_custom_conf(background_tasks)
    regenerate_queues_conf(background_tasks)
    return {"status": "success", "message": "Değişiklikler başarıyla uygulandı."}
"""

content = re.sub(r'@app\.post\("/api/settings/apply"\)[\s\S]*?return \{"status": "success", "message": "Değişiklikler[^}]*\}', apply_endpoint_modified, content)

with open(MAIN_PY, "w", encoding="utf-8") as f:
    f.write(content)

print("Applied needs_apply endpoints successfully.")
