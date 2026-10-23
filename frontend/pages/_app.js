import '../styles/globals.css'
import { useEffect } from 'react'
import { getSafeThemeColor } from '../utils/theme'
import { ErrorBoundary } from '../components/ErrorBoundary'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const savedColor = localStorage.getItem('theme_primary_color');
    if (savedColor) {
      document.documentElement.style.setProperty('--color-primary', getSafeThemeColor(savedColor));
    }

    // Global fetch interceptor to append X-User-ID and X-Tenant-ID without wiping Headers instances
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let [resource, config] = args;
      if (typeof resource === 'string' && (resource.startsWith('http://') || resource.startsWith('https://') || resource.startsWith('/'))) {
        config = config || {};
        const userId = sessionStorage.getItem('current_user_id') || localStorage.getItem('current_user_id') || 'System';
        const activeTenantId = localStorage.getItem('active_tenant_id') || 'tenant-default';
        const headers = new Headers(config.headers || {});
        if (!headers.has('X-User-ID') || headers.get('X-User-ID') === 'System') {
          headers.set('X-User-ID', userId);
        }
        if (!headers.has('X-Tenant-ID')) {
          headers.set('X-Tenant-ID', activeTenantId);
        }
        config.headers = headers;
        args = [resource, config];
      }
      return originalFetch(...args);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}

export default MyApp
