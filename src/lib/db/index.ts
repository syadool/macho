import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getDb(): D1Database {
  return getCloudflareContext().env.DB;
}

export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
