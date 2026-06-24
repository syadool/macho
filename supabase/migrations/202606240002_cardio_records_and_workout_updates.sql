alter table public.workout_exercises
  add column if not exists exercise_type text not null default 'strength',
  add column if not exists duration_minutes int,
  add column if not exists distance_km decimal(7, 2),
  add column if not exists calories int;

alter table public.workout_exercises
  alter column muscle_group_id drop not null;

alter table public.workout_exercises
  drop constraint if exists workout_exercises_exercise_type_check,
  add constraint workout_exercises_exercise_type_check check (exercise_type in ('strength', 'cardio')),
  drop constraint if exists workout_exercises_duration_minutes_check,
  add constraint workout_exercises_duration_minutes_check check (duration_minutes is null or duration_minutes >= 0),
  drop constraint if exists workout_exercises_distance_km_check,
  add constraint workout_exercises_distance_km_check check (distance_km is null or distance_km >= 0),
  drop constraint if exists workout_exercises_calories_check,
  add constraint workout_exercises_calories_check check (calories is null or calories >= 0);

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
  v_exercise_type text;
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
    v_exercise_type := coalesce(nullif(v_exercise->>'exercise_type', ''), 'strength');

    if v_exercise_type not in ('strength', 'cardio') then
      raise exception 'Invalid exercise type';
    end if;

    if v_exercise_type = 'strength' then
      if nullif(v_exercise->>'muscle_group_id', '') is null then
        raise exception 'Muscle group is required for strength exercise';
      end if;

      if jsonb_typeof(v_exercise->'muscle_sub_group_ids') = 'array' then
        v_primary_sub_group_id := nullif(v_exercise->'muscle_sub_group_ids'->>0, '')::uuid;
      elsif nullif(v_exercise->>'muscle_sub_group_id', '') is not null then
        v_primary_sub_group_id := (v_exercise->>'muscle_sub_group_id')::uuid;
      end if;
    end if;

    insert into public.workout_exercises (
      workout_id,
      exercise_name,
      exercise_type,
      muscle_group_id,
      muscle_sub_group_id,
      equipment_id,
      duration_minutes,
      distance_km,
      calories,
      sort_order
    )
    values (
      v_workout_id,
      v_exercise->>'exercise_name',
      v_exercise_type,
      case when v_exercise_type = 'strength' then (v_exercise->>'muscle_group_id')::uuid else null end,
      v_primary_sub_group_id,
      nullif(v_exercise->>'equipment_id', '')::uuid,
      nullif(v_exercise->>'duration_minutes', '')::int,
      nullif(v_exercise->>'distance_km', '')::decimal,
      nullif(v_exercise->>'calories', '')::int,
      v_sort_order
    )
    returning id into v_exercise_id;

    if v_exercise_type = 'strength' then
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

      for v_set in select * from jsonb_array_elements(coalesce(v_exercise->'sets', '[]'::jsonb))
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
    end if;
  end loop;

  return v_workout_id;
end;
$$;

create or replace function public.update_workout_with_details(p_workout_id uuid, p_date date, p_exercises jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_exercise_id uuid;
  v_exercise jsonb;
  v_set jsonb;
  v_sub_group_id text;
  v_primary_sub_group_id uuid;
  v_exercise_type text;
  v_sort_order int := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  update public.workouts
  set date = p_date
  where id = p_workout_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Workout not found';
  end if;

  delete from public.workout_exercises
  where workout_id = p_workout_id;

  for v_exercise in select * from jsonb_array_elements(p_exercises)
  loop
    v_sort_order := v_sort_order + 1;
    v_primary_sub_group_id := null;
    v_exercise_type := coalesce(nullif(v_exercise->>'exercise_type', ''), 'strength');

    if v_exercise_type not in ('strength', 'cardio') then
      raise exception 'Invalid exercise type';
    end if;

    if v_exercise_type = 'strength' then
      if nullif(v_exercise->>'muscle_group_id', '') is null then
        raise exception 'Muscle group is required for strength exercise';
      end if;

      if jsonb_typeof(v_exercise->'muscle_sub_group_ids') = 'array' then
        v_primary_sub_group_id := nullif(v_exercise->'muscle_sub_group_ids'->>0, '')::uuid;
      elsif nullif(v_exercise->>'muscle_sub_group_id', '') is not null then
        v_primary_sub_group_id := (v_exercise->>'muscle_sub_group_id')::uuid;
      end if;
    end if;

    insert into public.workout_exercises (
      workout_id,
      exercise_name,
      exercise_type,
      muscle_group_id,
      muscle_sub_group_id,
      equipment_id,
      duration_minutes,
      distance_km,
      calories,
      sort_order
    )
    values (
      p_workout_id,
      v_exercise->>'exercise_name',
      v_exercise_type,
      case when v_exercise_type = 'strength' then (v_exercise->>'muscle_group_id')::uuid else null end,
      v_primary_sub_group_id,
      nullif(v_exercise->>'equipment_id', '')::uuid,
      nullif(v_exercise->>'duration_minutes', '')::int,
      nullif(v_exercise->>'distance_km', '')::decimal,
      nullif(v_exercise->>'calories', '')::int,
      v_sort_order
    )
    returning id into v_exercise_id;

    if v_exercise_type = 'strength' then
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

      for v_set in select * from jsonb_array_elements(coalesce(v_exercise->'sets', '[]'::jsonb))
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
    end if;
  end loop;

  return p_workout_id;
end;
$$;

grant execute on function public.create_workout_with_details(date, jsonb) to authenticated;
grant execute on function public.update_workout_with_details(uuid, date, jsonb) to authenticated;
