create extension if not exists pgcrypto;

create table if not exists public.muscle_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  name_en text not null,
  color text not null,
  sort_order int not null unique
);

create table if not exists public.muscle_sub_groups (
  id uuid primary key default gen_random_uuid(),
  muscle_group_id uuid not null references public.muscle_groups(id) on delete cascade,
  name text not null,
  sort_order int not null,
  unique (muscle_group_id, name),
  unique (muscle_group_id, sort_order)
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null unique
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_name text not null,
  muscle_group_id uuid not null references public.muscle_groups(id),
  muscle_sub_group_id uuid references public.muscle_sub_groups(id),
  equipment_id uuid references public.equipment(id),
  sort_order int not null default 1
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number int not null,
  weight_kg decimal(7, 2) not null default 0,
  reps int not null,
  created_at timestamptz not null default now(),
  check (set_number > 0),
  check (weight_kg >= 0),
  check (reps > 0)
);

create index if not exists workouts_user_date_idx on public.workouts(user_id, date desc);
create index if not exists workout_exercises_workout_idx on public.workout_exercises(workout_id, sort_order);
create index if not exists workout_sets_exercise_idx on public.workout_sets(workout_exercise_id, set_number);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();

alter table public.muscle_groups enable row level security;
alter table public.muscle_sub_groups enable row level security;
alter table public.equipment enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

drop policy if exists "Master muscle groups are readable" on public.muscle_groups;
create policy "Master muscle groups are readable"
on public.muscle_groups for select
using (true);

drop policy if exists "Master muscle sub groups are readable" on public.muscle_sub_groups;
create policy "Master muscle sub groups are readable"
on public.muscle_sub_groups for select
using (true);

drop policy if exists "Master equipment is readable" on public.equipment;
create policy "Master equipment is readable"
on public.equipment for select
using (true);

drop policy if exists "Users can read own workouts" on public.workouts;
create policy "Users can read own workouts"
on public.workouts for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own workouts" on public.workouts;
create policy "Users can insert own workouts"
on public.workouts for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workouts" on public.workouts;
create policy "Users can update own workouts"
on public.workouts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workouts" on public.workouts;
create policy "Users can delete own workouts"
on public.workouts for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own workout exercises" on public.workout_exercises;
create policy "Users can read own workout exercises"
on public.workout_exercises for select
using (
  exists (
    select 1 from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own workout exercises" on public.workout_exercises;
create policy "Users can insert own workout exercises"
on public.workout_exercises for insert
with check (
  exists (
    select 1 from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own workout exercises" on public.workout_exercises;
create policy "Users can update own workout exercises"
on public.workout_exercises for update
using (
  exists (
    select 1 from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own workout exercises" on public.workout_exercises;
create policy "Users can delete own workout exercises"
on public.workout_exercises for delete
using (
  exists (
    select 1 from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own workout sets" on public.workout_sets;
create policy "Users can read own workout sets"
on public.workout_sets for select
using (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_sets.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own workout sets" on public.workout_sets;
create policy "Users can insert own workout sets"
on public.workout_sets for insert
with check (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_sets.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own workout sets" on public.workout_sets;
create policy "Users can update own workout sets"
on public.workout_sets for update
using (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_sets.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_sets.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own workout sets" on public.workout_sets;
create policy "Users can delete own workout sets"
on public.workout_sets for delete
using (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_sets.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
);

insert into public.muscle_groups (id, name, name_en, color, sort_order) values
  ('11111111-1111-1111-1111-111111111111', '胸', 'Chest', '#FF6B6B', 1),
  ('22222222-2222-2222-2222-222222222222', '背中', 'Back', '#4ECDC4', 2),
  ('33333333-3333-3333-3333-333333333333', '肩', 'Shoulder', '#A78BFA', 3),
  ('44444444-4444-4444-4444-444444444444', '腕', 'Arms', '#F59E0B', 4),
  ('55555555-5555-5555-5555-555555555555', '脚', 'Legs', '#34D399', 5),
  ('66666666-6666-6666-6666-666666666666', '腹', 'Abs', '#60A5FA', 6)
on conflict (id) do update set
  name = excluded.name,
  name_en = excluded.name_en,
  color = excluded.color,
  sort_order = excluded.sort_order;

insert into public.muscle_sub_groups (id, muscle_group_id, name, sort_order) values
  ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111111', '大胸筋上部', 1),
  ('11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111111', '大胸筋中部', 2),
  ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111111', '大胸筋下部', 3),
  ('22222222-2222-2222-2222-222222222201', '22222222-2222-2222-2222-222222222222', '広背筋', 1),
  ('22222222-2222-2222-2222-222222222202', '22222222-2222-2222-2222-222222222222', '僧帽筋', 2),
  ('22222222-2222-2222-2222-222222222203', '22222222-2222-2222-2222-222222222222', '脊柱起立筋', 3),
  ('33333333-3333-3333-3333-333333333301', '33333333-3333-3333-3333-333333333333', '三角筋前部', 1),
  ('33333333-3333-3333-3333-333333333302', '33333333-3333-3333-3333-333333333333', '三角筋中部', 2),
  ('33333333-3333-3333-3333-333333333303', '33333333-3333-3333-3333-333333333333', '三角筋後部', 3),
  ('44444444-4444-4444-4444-444444444401', '44444444-4444-4444-4444-444444444444', '上腕二頭筋', 1),
  ('44444444-4444-4444-4444-444444444402', '44444444-4444-4444-4444-444444444444', '上腕三頭筋', 2),
  ('44444444-4444-4444-4444-444444444403', '44444444-4444-4444-4444-444444444444', '前腕', 3),
  ('55555555-5555-5555-5555-555555555501', '55555555-5555-5555-5555-555555555555', '大腿四頭筋', 1),
  ('55555555-5555-5555-5555-555555555502', '55555555-5555-5555-5555-555555555555', 'ハムストリング', 2),
  ('55555555-5555-5555-5555-555555555503', '55555555-5555-5555-5555-555555555555', '臀筋', 3),
  ('55555555-5555-5555-5555-555555555504', '55555555-5555-5555-5555-555555555555', 'ふくらはぎ', 4),
  ('66666666-6666-6666-6666-666666666601', '66666666-6666-6666-6666-666666666666', '腹直筋', 1),
  ('66666666-6666-6666-6666-666666666602', '66666666-6666-6666-6666-666666666666', '腹斜筋', 2)
on conflict (id) do update set
  muscle_group_id = excluded.muscle_group_id,
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.equipment (id, name, sort_order) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'バーベル', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'ダンベル', 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'マシン', 3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'ケーブル', 4),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '自重', 5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'EZバー', 6),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'スミスマシン', 7)
on conflict (id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

create or replace function public.create_workout_with_details(p_date date, p_exercises jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workout_id uuid;
  v_exercise_id uuid;
  v_exercise jsonb;
  v_set jsonb;
  v_sort_order int := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  insert into public.workouts (user_id, date)
  values (auth.uid(), p_date)
  returning id into v_workout_id;

  for v_exercise in select * from jsonb_array_elements(p_exercises)
  loop
    v_sort_order := v_sort_order + 1;

    insert into public.workout_exercises (
      workout_id,
      exercise_name,
      muscle_group_id,
      muscle_sub_group_id,
      equipment_id,
      sort_order
    )
    values (
      v_workout_id,
      v_exercise->>'exercise_name',
      (v_exercise->>'muscle_group_id')::uuid,
      nullif(v_exercise->>'muscle_sub_group_id', '')::uuid,
      nullif(v_exercise->>'equipment_id', '')::uuid,
      v_sort_order
    )
    returning id into v_exercise_id;

    for v_set in select * from jsonb_array_elements(v_exercise->'sets')
    loop
      insert into public.workout_sets (
        workout_exercise_id,
        set_number,
        weight_kg,
        reps
      )
      values (
        v_exercise_id,
        (v_set->>'set_number')::int,
        (v_set->>'weight_kg')::decimal,
        (v_set->>'reps')::int
      );
    end loop;
  end loop;

  return v_workout_id;
end;
$$;

grant execute on function public.create_workout_with_details(date, jsonb) to authenticated;
