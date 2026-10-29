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

    // Resolve client's real public IP so backend audit logs & presence never show 127.0.0.1 behind local proxies
    let cachedClientIp = localStorage.getItem('client_public_ip') || '';
    const originalFetch = window.fetch;

    const refreshPublicIp = async () => {
      const endpoints = [
        'https://api.ipify.org?format=json',
        'https://api64.ipify.org?format=json'
      ];
      for (const url of endpoints) {
        try {
          const res = await originalFetch(url, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && data.ip && data.ip !== '127.0.0.1') {
              cachedClientIp = String(data.ip).trim();
              localStorage.setItem('client_public_ip', cachedClientIp);
              break;
            }
          }
        } catch (e) {}
      }
    };
    refreshPublicIp();

    // Global fetch interceptor to append X-User-ID, X-Tenant-ID, and X-Client-IP without wiping Headers instances
    window.fetch = async (...args) => {
      let [resource, config] = args;
      if (typeof resource === 'string' && (resource.startsWith('http://') || resource.startsWith('https://') || resource.startsWith('/'))) {
        const isExternalIpService = resource.includes('ipify.org');
        if (!isExternalIpService) {
          config = config || {};
          const userId = sessionStorage.getItem('current_user_id') || localStorage.getItem('current_user_id') || 'System';
          const activeTenantId = localStorage.getItem('active_tenant_id') || 'tenant-default';
          const clientIp = cachedClientIp || localStorage.getItem('client_public_ip') || '';
          const headers = new Headers(config.headers || {});
          if (!headers.has('X-User-ID') || headers.get('X-User-ID') === 'System') {
            headers.set('X-User-ID', userId);
          }
          if (!headers.has('X-Tenant-ID')) {
            headers.set('X-Tenant-ID', activeTenantId);
          }
          if (clientIp && !headers.has('X-Client-IP')) {
            headers.set('X-Client-IP', clientIp);
          }
          config.headers = headers;
          args = [resource, config];
        }
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
