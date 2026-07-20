import os
import re

INDEX_JS = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pages", "index.js")

with open(INDEX_JS, "r", encoding="utf-8") as f:
    content = f.read()

# Add hasPendingChanges state
state_match = r'const \[isApplying, setIsApplying\] = useState\(false\);'
state_replacement = r'const [isApplying, setIsApplying] = useState(false);\n  const [hasPendingChanges, setHasPendingChanges] = useState(false);'
content = re.sub(state_match, state_replacement, content)

# Add fetch interceptor
interceptor = """  useEffect(() => {
    const saved = localStorage.getItem('hasPendingChanges');
    if (saved === 'true') {
      setHasPendingChanges(true);
    }

    const originalFetch = window.fetch;
    window.fetch = async function() {
      const url = arguments[0];
      const options = arguments[1] || {};
      
      const response = await originalFetch.apply(this, arguments);
      
      if (typeof url === 'string' && url.includes('/api/settings/') && !url.includes('/api/settings/apply')) {
        if (['POST', 'PUT', 'DELETE'].includes(options.method)) {
          if (response.ok) {
            setHasPendingChanges(true);
            localStorage.setItem('hasPendingChanges', 'true');
          }
        }
      }
      return response;
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const handleApplyChanges = async () =>"""

content = re.sub(r'  const handleApplyChanges = async \(\) =>', interceptor, content)

# Update handleApplyChanges to clear state
handle_apply_match = r'alert\("Değişiklikler başarıyla uygulandı."\);'
handle_apply_replacement = """alert("Değişiklikler başarıyla uygulandı.");
        setHasPendingChanges(false);
        localStorage.removeItem('hasPendingChanges');"""
content = re.sub(handle_apply_match, handle_apply_replacement, content)

# Update the button
button_match = r'\{currentUser\?\.role === \'admin\' && \([\s\S]*?Değişiklikleri Uygula\n              </button>\n            \)\}'
button_replacement = """{currentUser?.role === 'admin' && hasPendingChanges && (
              <button
                onClick={handleApplyChanges}
                disabled={isApplying}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold transition-all shadow-sm ${
                  isApplying ? 'bg-slate-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20 animate-pulse'
                }`}
              >
                {isApplying ? <Activity size={16} className="animate-spin" /> : <Layers size={16} />}
                Uygula
              </button>
            )}"""
content = re.sub(button_match, button_replacement, content)

with open(INDEX_JS, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated index.js for Uygula button.")
