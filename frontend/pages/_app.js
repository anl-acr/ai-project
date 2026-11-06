import '../styles/globals.css'
import { useEffect } from 'react'
import Head from 'next/head'
import { getSafeThemeColor, applyDocumentUiTemplate, readDocumentUiTemplate } from '../utils/theme'
import { ErrorBoundary } from '../components/ErrorBoundary'
import SystemInfoHintManager from '../components/common/SystemInfoHintManager'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const savedColor = localStorage.getItem('theme_primary_color');
    if (savedColor) {
      document.documentElement.style.setProperty('--color-primary', getSafeThemeColor(savedColor));
    }
    applyDocumentUiTemplate(readDocumentUiTemplate());

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

    // Single unified global fetch interceptor: appends X-User-ID, X-Tenant-ID, and X-Client-IP
    // to backend API calls and notifies settings mutation listeners without stacked wrappers
    window.fetch = async (...args) => {
      let [resource, config] = args;
      const urlStr = typeof resource === 'string' ? resource : (resource?.url || '');
      const isApiCall =
        Boolean(urlStr) &&
        !urlStr.includes('ipify.org') &&
        (urlStr.includes('/api/') || urlStr.includes('/settings/'));

      if (isApiCall) {
        config = config ? { ...config } : {};
        const userId = sessionStorage.getItem('current_user_id') || localStorage.getItem('current_user_id') || 'System';
        const activeTenantId = localStorage.getItem('active_tenant_id') || 'tenant-default';
        const clientIp = cachedClientIp || localStorage.getItem('client_public_ip') || '';
        const headers = new Headers(config.headers || {});
        if (!headers.has('X-User-ID') || headers.get('X-User-ID') === 'System') {
          headers.set('X-User-ID', String(userId));
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

      const response = await originalFetch(...args);

      if (
        isApiCall &&
        response.ok &&
        urlStr.includes('/api/settings/') &&
        !urlStr.includes('/api/settings/apply')
      ) {
        const method = String(config?.method || (typeof resource === 'object' && resource?.method) || 'GET').toUpperCase();
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          window.dispatchEvent(new CustomEvent('AIDA_SETTINGS_MUTATED'));
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <ErrorBoundary>
      <Head>
        <title>AIDA PBX</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>
      <Component {...pageProps} />
      <SystemInfoHintManager />
    </ErrorBoundary>
  );
}

export default MyApp
