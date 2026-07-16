import re
with open("frontend/components/settings/UserSettings.js", "r") as f:
    content = f.read()

# Replace className=`}${variable}` with className={variable}
new_content = re.sub(r'className=`\}\$\{([^\}]+)\}`', r'className={\1}', content)
# Wait, let's just do a generic replace for className=`...` where ... is not valid JSX
# Let's replace `\$\{text\}` with {text}
new_content = re.sub(r'className=`\}\$\{([^}]+)\}`', r'className={\1}', new_content)
# Let's also replace any className={`}${text}`} if it exists
new_content = re.sub(r'className=\{\`\}\$\{([^\}]+)\}\`\}', r'className={\1}', new_content)
# Let's also check for className={`...`} without errors
# If there are any `}${text}` strings let's just fix them
new_content = re.sub(r'`\}\$\{([^}]+)\}`', r'{\1}', new_content)

with open("frontend/components/settings/UserSettings.js", "w") as f:
    f.write(new_content)
