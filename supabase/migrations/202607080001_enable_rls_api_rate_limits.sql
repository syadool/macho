-- Security fix: api_rate_limits was created without RLS
-- (flagged by Supabase Security Advisor as "RLS Disabled in Public").
-- Access goes through the security definer function check_api_rate_limit,
-- so no policies are needed; enabling RLS with zero policies blocks all
-- direct access from anon/authenticated while service_role bypasses RLS.
alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from anon, authenticated;

-- The app only calls this RPC via the service role client (src/lib/rate-limit.ts);
-- the grant to authenticated allowed any signed-in user to inflate arbitrary
-- rate-limit counters directly from the browser.
revoke execute on function public.check_api_rate_limit(text, text, int, int) from anon, authenticated;

-- Pin search_path on set_updated_at (flagged by the advisor as
-- "Function Search Path Mutable"); every other function already pins it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
