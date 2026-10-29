const FALLBACK_SUPABASE_URL = "https://example.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "anon-key";

export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
}

export function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
}

const SUPABASE_FETCH_TIMEOUT_MS = 5000;
const SUPABASE_AUTH_TIMEOUT_MS = 4000;

// Abort hung requests so an unreachable Supabase cannot stall middleware past Vercel's 25s limit.
export const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS) });

// supabase-js retries failed token refreshes, so cap the whole auth call as well as each fetch.
export function withAuthTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Supabase auth request timed out")), SUPABASE_AUTH_TIMEOUT_MS),
    ),
  ]);
}
