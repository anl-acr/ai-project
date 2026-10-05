export function getBackendHost(providedHost) {
  if (typeof window !== "undefined") {
    if (!providedHost || providedHost.includes("localhost") || providedHost.includes("127.0.0.1") || providedHost.startsWith("192.168.") || providedHost.startsWith("10.") || providedHost.startsWith("172.")) {
      return window.location.host;
    }
    return providedHost;
  }
  return providedHost || "localhost:8000";
}

export function getApiBaseUrl(providedHost) {
  if (typeof window !== "undefined") {
    return "";
  }
  const host = getBackendHost(providedHost);
  return `http://${host}`;
}

export function getActiveTenantId() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("active_tenant_id") || "tenant-default";
  }
  return "tenant-default";
}

export async function tenantFetch(url, options = {}) {
  const activeTenantId = getActiveTenantId();
  const headers = {
    ...(options.headers || {}),
    "X-Tenant-ID": activeTenantId
  };
  return await fetch(url, { ...options, headers });
}
