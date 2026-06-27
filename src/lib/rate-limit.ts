import { createAdminClient } from "@/lib/supabase/admin";

export async function checkRateLimit(input: {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_api_rate_limit", {
    p_scope: input.scope,
    p_identifier: input.identifier,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });

  if (error) throw new Error(error.message);
  return data === true;
}
