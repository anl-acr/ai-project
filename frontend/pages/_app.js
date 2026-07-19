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

    // Global fetch interceptor to append X-User-ID
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let [resource, config] = args;
      if (typeof resource === 'string' && (resource.startsWith('http://') || resource.startsWith('https://') || resource.startsWith('/'))) {
        config = config || {};
        const userId = localStorage.getItem('current_user_id') || 'System';
        config.headers = {
          ...config.headers,
          'X-User-ID': userId
        };
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
