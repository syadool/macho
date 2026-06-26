create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null unique,
  key_prefix char(12) not null,
  name text not null default 'ChatGPT',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists api_keys_user_created_idx
on public.api_keys(user_id, created_at desc);

alter table public.api_keys enable row level security;

drop policy if exists "Users manage own api keys" on public.api_keys;
drop policy if exists "Users read own api keys" on public.api_keys;
drop policy if exists "Users create own api keys" on public.api_keys;
drop policy if exists "Users delete own api keys" on public.api_keys;

create policy "Users read own api keys"
on public.api_keys for select
using (auth.uid() = user_id);

create policy "Users create own api keys"
on public.api_keys for insert
with check (auth.uid() = user_id);

create policy "Users delete own api keys"
on public.api_keys for delete
using (auth.uid() = user_id);
