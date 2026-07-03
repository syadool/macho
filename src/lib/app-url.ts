const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function getConfiguredAppUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ?? normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

export function getPublicAppUrlForRequest(req: Request) {
  return resolvePublicAppUrl(new URL(req.url).origin);
}

export function resolvePublicAppUrl(requestOrigin: string) {
  const requestIsLocal = LOCAL_HOSTS.has(new URL(requestOrigin).hostname);

  const configured = getConfiguredAppUrl();
  if (configured) {
    const configuredIsLocal = LOCAL_HOSTS.has(new URL(configured).hostname);
    // Ignore a localhost value left over from .env.local when the actual
    // request isn't local (e.g. NEXT_PUBLIC_APP_URL mistakenly copied into
    // production env vars) instead of exposing a broken localhost URL.
    if (!configuredIsLocal || requestIsLocal) return configured;
  }

  return requestIsLocal ? requestOrigin : null;
}

function normalizeUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
