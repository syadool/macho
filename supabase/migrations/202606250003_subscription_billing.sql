alter table public.user_profiles
  add column if not exists subscription_tier text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists subscription_id text,
  add column if not exists current_period_end timestamptz;

create unique index if not exists user_profiles_stripe_customer_id_idx
on public.user_profiles(stripe_customer_id)
where stripe_customer_id is not null;

create unique index if not exists user_profiles_subscription_id_idx
on public.user_profiles(subscription_id)
where subscription_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_subscription_tier'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint chk_subscription_tier
      check (subscription_tier in ('free', 'go', 'plus', 'pro'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_subscription_status'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint chk_subscription_status
      check (subscription_status in ('none', 'active', 'past_due', 'canceled'));
  end if;
end;
$$;

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_user_created_idx
on public.subscription_events(user_id, created_at desc);

alter table public.subscription_events enable row level security;

create or replace function public.prevent_ai_suggestion_enabled_self_change()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.ai_suggestion_enabled is distinct from false then
        raise exception 'ai_suggestion_enabled can only be changed by service role';
      end if;

      if new.subscription_tier is distinct from 'free'
        or new.stripe_customer_id is not null
        or new.subscription_status is distinct from 'none'
        or new.subscription_id is not null
        or new.current_period_end is not null then
        raise exception 'subscription fields can only be changed by service role';
      end if;
    end if;

    if tg_op = 'UPDATE' then
      if new.ai_suggestion_enabled is distinct from old.ai_suggestion_enabled then
        raise exception 'ai_suggestion_enabled can only be changed by service role';
      end if;

      if new.subscription_tier is distinct from old.subscription_tier
        or new.stripe_customer_id is distinct from old.stripe_customer_id
        or new.subscription_status is distinct from old.subscription_status
        or new.subscription_id is distinct from old.subscription_id
        or new.current_period_end is distinct from old.current_period_end then
        raise exception 'subscription fields can only be changed by service role';
      end if;
    end if;
  end if;

  return new;
end;
$$;
