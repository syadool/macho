import { getDb, nowIso } from "@/lib/db";

/** 旧 check_api_rate_limit RPC。固定ウィンドウでカウントし、上限以内なら true。 */
export async function checkRateLimit(input: {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}) {
  if (input.limit < 1 || input.windowSeconds < 1) throw new Error("Invalid rate limit configuration");

  const windowMs = input.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const row = await getDb()
    .prepare(
      `insert into api_rate_limits (scope, identifier, window_start, request_count, updated_at) values (?, ?, ?, 1, ?)
      on conflict (scope, identifier, window_start)
      do update set request_count = request_count + 1, updated_at = excluded.updated_at
      returning request_count`,
    )
    .bind(input.scope, input.identifier, windowStart, nowIso())
    .first<{ request_count: number }>();

  return (row?.request_count ?? Number.POSITIVE_INFINITY) <= input.limit;
}
