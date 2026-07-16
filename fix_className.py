with open("frontend/components/settings/UserSettings.js", "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab ===" in line:
        tab_name = line.split("activeTab === '")[1].split("'")[0]
        new_line = f'                            className={{"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all " + (activeTab === \'{tab_name}\' ? ("bg-white dark:bg-slate-800 " + text + " shadow-sm border border-slate-200 dark:border-slate-700") : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent")}}\n'
        lines[i] = new_line

with open("frontend/components/settings/UserSettings.js", "w") as f:
    f.writelines(lines)
