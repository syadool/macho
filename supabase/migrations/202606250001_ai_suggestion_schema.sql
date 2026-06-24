create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  training_goal text,
  experience_level text,
  weekly_frequency int,
  focus_muscle_group_ids uuid[] not null default '{}',
  ai_suggestion_enabled boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (training_goal in ('hypertrophy', 'strength', 'fat_loss', 'maintenance') or training_goal is null),
  check (experience_level in ('beginner', 'intermediate', 'advanced') or experience_level is null),
  check (weekly_frequency between 1 and 7 or weekly_frequency is null)
);

create table if not exists public.ai_suggestion_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_hash text not null,
  request_payload jsonb not null,
  response_payload jsonb,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  cost_usd decimal(10, 6),
  status text not null check (status in ('success', 'cached', 'rate_limited', 'forbidden', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source text not null check (source in ('ai_suggestion', 'manual')),
  source_log_id uuid references public.ai_suggestion_logs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_name text not null,
  muscle_group_id uuid references public.muscle_groups(id),
  muscle_sub_group_id uuid references public.muscle_sub_groups(id),
  equipment_id uuid references public.equipment(id),
  target_sets int,
  target_reps int,
  target_weight_kg decimal(7, 2),
  notes text,
  sort_order int not null default 1
);

create index if not exists ai_suggestion_logs_user_created_idx on public.ai_suggestion_logs(user_id, created_at desc);
create index if not exists ai_suggestion_logs_input_hash_created_idx on public.ai_suggestion_logs(input_hash, created_at desc);
create index if not exists workout_templates_user_created_idx on public.workout_templates(user_id, created_at desc);
create index if not exists template_exercises_template_sort_idx on public.template_exercises(template_id, sort_order);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.prevent_ai_suggestion_enabled_self_change()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' and new.ai_suggestion_enabled is distinct from false then
      raise exception 'ai_suggestion_enabled can only be changed by service role';
    end if;

    if tg_op = 'UPDATE' and new.ai_suggestion_enabled is distinct from old.ai_suggestion_enabled then
      raise exception 'ai_suggestion_enabled can only be changed by service role';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists user_profiles_prevent_ai_suggestion_enabled_self_change on public.user_profiles;
create trigger user_profiles_prevent_ai_suggestion_enabled_self_change
before insert or update on public.user_profiles
for each row execute function public.prevent_ai_suggestion_enabled_self_change();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.user_profiles enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.ai_suggestion_logs enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
on public.user_profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
on public.user_profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own workout templates" on public.workout_templates;
create policy "Users can read own workout templates"
on public.workout_templates for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own workout templates" on public.workout_templates;
create policy "Users can insert own workout templates"
on public.workout_templates for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workout templates" on public.workout_templates;
create policy "Users can update own workout templates"
on public.workout_templates for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workout templates" on public.workout_templates;
create policy "Users can delete own workout templates"
on public.workout_templates for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own template exercises" on public.template_exercises;
create policy "Users can read own template exercises"
on public.template_exercises for select
using (
  exists (
    select 1 from public.workout_templates
    where workout_templates.id = template_exercises.template_id
      and workout_templates.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own template exercises" on public.template_exercises;
create policy "Users can insert own template exercises"
on public.template_exercises for insert
with check (
  exists (
    select 1 from public.workout_templates
    where workout_templates.id = template_exercises.template_id
      and workout_templates.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own template exercises" on public.template_exercises;
create policy "Users can update own template exercises"
on public.template_exercises for update
using (
  exists (
    select 1 from public.workout_templates
    where workout_templates.id = template_exercises.template_id
      and workout_templates.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workout_templates
    where workout_templates.id = template_exercises.template_id
      and workout_templates.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own template exercises" on public.template_exercises;
create policy "Users can delete own template exercises"
on public.template_exercises for delete
using (
  exists (
    select 1 from public.workout_templates
    where workout_templates.id = template_exercises.template_id
      and workout_templates.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own ai suggestion logs" on public.ai_suggestion_logs;
create policy "Users can read own ai suggestion logs"
on public.ai_suggestion_logs for select
using (auth.uid() = user_id);
