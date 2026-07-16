with open("frontend/components/settings/UserSettings.js", "r") as f:
    lines = f.readlines()

def fix(i, find, repl):
    if i < len(lines):
        lines[i] = lines[i].replace(find, repl)

fix(336, 'className={`font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">', 'className="font-bold text-sm text-slate-850 dark:text-white uppercase tracking-wider">')

with open("frontend/components/settings/UserSettings.js", "w") as f:
    f.writelines(lines)
