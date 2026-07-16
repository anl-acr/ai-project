with open("frontend/components/settings/UserSettings.js", "r") as f:
    content = f.read()

import re
content = re.sub(r'\? `bg-white dark:bg-slate-800 \$\{text\} shadow-sm border border-slate-200 dark:border-slate-700`',
                 r'? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700")', content)

# I should also fix the other transport active tab
content = re.sub(r'\? `\$\{lightBg\} \$\{border\} \$\{text\}`',
                 r'? (lightBg + " " + border + " " + text)', content)

# Avatar active
content = re.sub(r'\? `\$\{border\} shadow-md scale-105`',
                 r'? (border + " shadow-md scale-105")', content)

with open("frontend/components/settings/UserSettings.js", "w") as f:
    f.write(content)
