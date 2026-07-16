import re

with open('frontend/components/settings/UserSettings.js', 'r') as f:
    content = f.read()

# Replace button backgrounds: "bg-rose-600 hover:bg-rose-500" -> "${bg} ${hover}"
content = re.sub(r'bg-rose-600 hover:bg-rose-500', '${bg} ${hover}', content)

# active tab style
content = re.sub(r"activeTab === '(.*?)' \? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm border border-slate-200 dark:border-slate-700'",
                 r"activeTab === '\1' ? `bg-white dark:bg-slate-800 ${text} shadow-sm border border-slate-200 dark:border-slate-700`", content)

# specific elements using rose
content = re.sub(r'hover:text-rose-500 dark:hover:text-rose-500', 'hover:text-primary dark:hover:text-primary', content)
content = re.sub(r'text-rose-500', '${text}', content)
content = re.sub(r'text-emerald-500', '${text}', content)

# "SIP AYARLARI" section
content = re.sub(r'border-rose-100 dark:border-rose-900/30', '${borderLight}', content)
content = re.sub(r'bg-rose-50/30 dark:bg-rose-950/10', '${lightBg}', content)
content = re.sub(r'text-rose-700 dark:text-rose-400', '${text}', content)

# Focus ring
content = re.sub(r'dark:focus:ring-rose-400/25', '', content)

# Transport active
content = re.sub(r"'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400'", 
                 r"`${lightBg} ${border} ${text}`", content)

# Avatar selected border
content = re.sub(r'"border-rose-500 shadow-md scale-105"', 
                 r"`${border} shadow-md scale-105`", content)

with open('frontend/components/settings/UserSettings.js', 'w') as f:
    f.write(content)

