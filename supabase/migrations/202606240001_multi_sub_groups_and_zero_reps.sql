create table if not exists public.workout_exercise_sub_groups (
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  muscle_sub_group_id uuid not null references public.muscle_sub_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_exercise_id, muscle_sub_group_id)
);

create index if not exists workout_exercise_sub_groups_sub_group_idx
on public.workout_exercise_sub_groups(muscle_sub_group_id);

insert into public.workout_exercise_sub_groups (workout_exercise_id, muscle_sub_group_id)
select id, muscle_sub_group_id
from public.workout_exercises
where muscle_sub_group_id is not null
on conflict do nothing;

alter table public.workout_sets drop constraint if exists workout_sets_reps_check;
alter table public.workout_sets add constraint workout_sets_reps_check check (reps >= 0);

alter table public.workout_exercise_sub_groups enable row level security;

drop policy if exists "Users can read own workout exercise sub groups" on public.workout_exercise_sub_groups;
create policy "Users can read own workout exercise sub groups"
on public.workout_exercise_sub_groups for select
using (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_exercise_sub_groups.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own workout exercise sub groups" on public.workout_exercise_sub_groups;
create policy "Users can insert own workout exercise sub groups"
on public.workout_exercise_sub_groups for insert
with check (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_exercise_sub_groups.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own workout exercise sub groups" on public.workout_exercise_sub_groups;
create policy "Users can update own workout exercise sub groups"
on public.workout_exercise_sub_groups for update
using (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_exercise_sub_groups.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_exercise_sub_groups.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own workout exercise sub groups" on public.workout_exercise_sub_groups;
create policy "Users can delete own workout exercise sub groups"
on public.workout_exercise_sub_groups for delete
using (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_exercise_sub_groups.workout_exercise_id
      and workouts.user_id = auth.uid()
  )
);

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
  v_sub_group_id text;
  v_primary_sub_group_id uuid;
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
    v_primary_sub_group_id := null;

    if jsonb_typeof(v_exercise->'muscle_sub_group_ids') = 'array' then
      v_primary_sub_group_id := nullif(v_exercise->'muscle_sub_group_ids'->>0, '')::uuid;
    elsif nullif(v_exercise->>'muscle_sub_group_id', '') is not null then
      v_primary_sub_group_id := (v_exercise->>'muscle_sub_group_id')::uuid;
    end if;

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
      v_primary_sub_group_id,
      nullif(v_exercise->>'equipment_id', '')::uuid,
      v_sort_order
    )
    returning id into v_exercise_id;

    if jsonb_typeof(v_exercise->'muscle_sub_group_ids') = 'array' then
      for v_sub_group_id in select * from jsonb_array_elements_text(v_exercise->'muscle_sub_group_ids')
      loop
        if nullif(v_sub_group_id, '') is not null then
          insert into public.workout_exercise_sub_groups (workout_exercise_id, muscle_sub_group_id)
          values (v_exercise_id, v_sub_group_id::uuid)
          on conflict do nothing;
        end if;
      end loop;
    elsif v_primary_sub_group_id is not null then
      insert into public.workout_exercise_sub_groups (workout_exercise_id, muscle_sub_group_id)
      values (v_exercise_id, v_primary_sub_group_id)
      on conflict do nothing;
    end if;

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
