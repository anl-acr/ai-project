export function getBackendHost(providedHost) {
  if (providedHost && providedHost !== "localhost:8000" && providedHost !== "127.0.0.1:8000") {
    return providedHost;
  }
  if (typeof window !== "undefined") {
    return window.location.host;
  }
  return "localhost:3000";
}

export function getApiBaseUrl(providedHost) {
  const host = getBackendHost(providedHost);
  const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
  return `${protocol}//${host}`;
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
