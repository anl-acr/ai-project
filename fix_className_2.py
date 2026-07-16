import re
with open("frontend/components/settings/UserSettings.js", "r") as f:
    content = f.read()

# Replace className={`something"> with className="something">
new_content = re.sub(r'className=\{\`([^"]*)"\>', r'className="\1">', content)

# Also fix `something"> without className (like placeholder={`Kullanıcı ara..."> or similar)
# Let's just find any ={\`([^"]*)"\> and replace with ="\1">
new_content = re.sub(r'=\{\`([^"]*)"\>', r'="\1">', new_content)

# And if there's any `something" (like type=`button")
new_content = re.sub(r'=\`([^"]*)"', r'="\1"', new_content)

with open("frontend/components/settings/UserSettings.js", "w") as f:
    f.write(new_content)
