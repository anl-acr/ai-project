with open("frontend/components/settings/UserSettings.js", "r") as f:
    lines = f.readlines()

def fix(i, find, repl):
    lines[i] = lines[i].replace(find, repl)

fix(102, 'method: `POST",', 'method: "POST",')
fix(348, 'placeholder="Kullanıcı ara...`}', 'placeholder="Kullanıcı ara..."')
fix(359, 'title=`Yeni Kullanıcı Ekle"', 'title="Yeni Kullanıcı Ekle"')
fix(421, ': "bg-blue-50 dark:bg-blue-950/20 text-primary dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30`;', ': "bg-blue-50 dark:bg-blue-950/20 text-primary dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30";')
fix(507, 'onClick={() => setActiveTab("login_sip`})}', 'onClick={() => setActiveTab("login_sip")}')
fix(514, 'type=`button"', 'type="button"')
fix(515, 'onClick={() => setActiveTab("forwarding`)}', 'onClick={() => setActiveTab("forwarding")}')
fix(522, 'type=`button"', 'type="button"')
fix(523, 'onClick={() => setActiveTab("features`)}', 'onClick={() => setActiveTab("features")}')
fix(530, 'type=`button"', 'type="button"')
fix(531, 'onClick={() => setActiveTab("avatar`)}', 'onClick={() => setActiveTab("avatar")}')

with open("frontend/components/settings/UserSettings.js", "w") as f:
    f.writelines(lines)
