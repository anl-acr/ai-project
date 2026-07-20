import os

MAIN_PY = os.path.join(os.path.dirname(os.path.dirname(__file__)), "main.py")

with open(MAIN_PY, "r", encoding="utf-8") as f:
    content = f.read()

# We need to find the specific await db.commit() in the new functions at the bottom.
# There's a marker: # --- REFACTORED ENDPOINTS ---
idx = content.find("# --- REFACTORED ENDPOINTS ---")
if idx != -1:
    before = content[:idx]
    after = content[idx:]
    
    # In the refactored endpoints, replace await db.commit() with setting the flag
    after = after.replace('await db.commit()', 'await db.commit()\n    settings_db["needs_apply"] = True\n    save_settings(settings_db)')
    
    with open(MAIN_PY, "w", encoding="utf-8") as f:
        f.write(before + after)
    print("Modified POST endpoints to trigger needs_apply.")
else:
    print("Could not find REFACTORED ENDPOINTS marker.")
