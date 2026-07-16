import re

with open("frontend/components/settings/UserSettings.js", "r") as f:
    content = f.read()

def replacer(match):
    s = match.group(0)
    # Be careful not to replace things indiscriminately if they have other quotes inside
    return "`" + s[1:-1] + "`"

new_content = re.sub(r'\"[^\"]*\$\{.*?\}[^\"]*\"', replacer, content)

with open("frontend/components/settings/UserSettings.js", "w") as f:
    f.write(new_content)
