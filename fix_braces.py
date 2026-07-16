import re

with open("frontend/components/settings/UserSettings.js", "r") as f:
    content = f.read()

# Replace className=`...` with className={`...`}
new_content = re.sub(r'className=`([^`]+)`', r'className={`\1`}', content)

with open("frontend/components/settings/UserSettings.js", "w") as f:
    f.write(new_content)
