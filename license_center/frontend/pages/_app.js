import '../styles/globals.css'

if (typeof window !== 'undefined' && !window.__norniaMasterFetchPatched) {
  window.__norniaMasterFetchPatched = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    const isMasterApi = urlStr.includes('/api/v1/');
    if (!isMasterApi) {
      return origFetch(input, init);
    }

    const token = sessionStorage.getItem('master_access_token') || '';
    const nextInit = { ...init };
    const hdrs = new Headers(init?.headers || (typeof input !== 'string' && input?.headers ? input.headers : undefined));
    if (token && !hdrs.has('Authorization')) {
      hdrs.set('Authorization', `Bearer ${token}`);
    }
    nextInit.headers = hdrs;

    const resp = await origFetch(input, nextInit);
    const isAuthCall =
      urlStr.includes('/api/v1/auth/login') ||
      urlStr.includes('/api/v1/auth/verify-2fa') ||
      urlStr.includes('/api/v1/auth/resend-email-2fa');

    if (resp.status === 401 && !isAuthCall) {
      try {
        sessionStorage.removeItem('master_access_token');
        sessionStorage.removeItem('master_user');
      } catch (e) {}
      window.dispatchEvent(new Event('nornia_master_unauthorized'));
    }
    return resp;
  };
}

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
