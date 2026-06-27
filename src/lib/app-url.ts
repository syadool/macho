const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function getConfiguredAppUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ?? normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

export function getPublicAppUrlForRequest(req: Request) {
  const configured = getConfiguredAppUrl();
  if (configured) return configured;

  const origin = new URL(req.url).origin;
  const hostname = new URL(origin).hostname;
  return LOCAL_HOSTS.has(hostname) ? origin : null;
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
