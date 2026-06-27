create table if not exists public.api_rate_limits (
  scope text not null,
  identifier text not null,
  window_start timestamptz not null,
  request_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, identifier, window_start)
);

create or replace function public.check_api_rate_limit(
  p_scope text,
  p_identifier text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.api_rate_limits (scope, identifier, window_start, request_count)
  values (p_scope, p_identifier, v_window_start, 1)
  on conflict (scope, identifier, window_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.check_api_rate_limit(text, text, int, int) to authenticated, service_role;

alter table public.subscription_events
  add column if not exists processing_started_at timestamptz;

create or replace function public.claim_subscription_event(p_stripe_event_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.subscription_events
  set processing_started_at = now()
  where stripe_event_id = p_stripe_event_id
    and processed_at is null
    and (
      processing_started_at is null
      or processing_started_at < now() - interval '5 minutes'
    )
  returning id into v_id;

  return v_id is not null;
end;
$$;

grant execute on function public.claim_subscription_event(text) to service_role;

create index if not exists ai_suggestion_logs_user_input_success_created_idx
on public.ai_suggestion_logs(user_id, input_hash, created_at desc)
where status = 'success';

create or replace function public.reserve_ai_suggestion_slot(
  p_user_id uuid,
  p_input_hash text,
  p_request_payload jsonb,
  p_daily_limit int,
  p_monthly_limit int,
  p_global_limit int,
  p_pending_since timestamptz,
  p_day_start timestamptz,
  p_month_start timestamptz
)
returns table(log_id uuid, rate_limited_scope text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_count int;
  v_monthly_count int;
  v_global_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  insert into public.ai_suggestion_logs (
    user_id,
    input_hash,
    request_payload,
    status
  )
  values (
    p_user_id,
    p_input_hash,
    p_request_payload,
    'pending'
  )
  returning id into log_id;

  select count(*) into v_daily_count
  from public.ai_suggestion_logs
  where user_id = p_user_id
    and created_at >= p_day_start
    and (
      status in ('success', 'cached')
      or (status = 'pending' and created_at >= p_pending_since)
      or (status = 'error' and total_tokens is not null)
    );

  select count(*) into v_monthly_count
  from public.ai_suggestion_logs
  where user_id = p_user_id
    and created_at >= p_month_start
    and (
      status in ('success', 'cached')
      or (status = 'pending' and created_at >= p_pending_since)
      or (status = 'error' and total_tokens is not null)
    );

  select count(*) into v_global_count
  from public.ai_suggestion_logs
  where created_at >= p_month_start
    and (
      status = 'success'
      or (status = 'pending' and created_at >= p_pending_since)
      or (status = 'error' and total_tokens is not null)
    );

  if v_daily_count > p_daily_limit then
    rate_limited_scope := 'daily';
  elsif v_monthly_count > p_monthly_limit then
    rate_limited_scope := 'monthly';
  elsif v_global_count > p_global_limit then
    rate_limited_scope := 'global';
  else
    rate_limited_scope := null;
  end if;

  if rate_limited_scope is not null then
    update public.ai_suggestion_logs
    set status = 'rate_limited'
    where id = log_id;
  end if;

  return next;
end;
$$;

grant execute on function public.reserve_ai_suggestion_slot(uuid, text, jsonb, int, int, int, timestamptz, timestamptz, timestamptz) to service_role;

create or replace function public.enforce_api_key_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_key_count int;
begin
  select count(*) into v_key_count
  from public.api_keys
  where user_id = new.user_id;

  if v_key_count >= 5 then
    raise exception 'A user can have at most 5 GPT API keys';
  end if;

  return new;
end;
$$;

drop trigger if exists api_keys_enforce_key_limit on public.api_keys;
create trigger api_keys_enforce_key_limit
before insert on public.api_keys
for each row execute function public.enforce_api_key_limit();

delete from public.workout_sets a
using public.workout_sets b
where a.workout_exercise_id = b.workout_exercise_id
  and a.set_number = b.set_number
  and a.id > b.id;

create unique index if not exists workout_sets_exercise_set_number_uidx
on public.workout_sets(workout_exercise_id, set_number);

alter table public.muscle_sub_groups
  drop constraint if exists muscle_sub_groups_muscle_group_id_fkey,
  add constraint muscle_sub_groups_muscle_group_id_fkey
  foreign key (muscle_group_id) references public.muscle_groups(id) on delete restrict;

alter table public.workout_exercise_sub_groups
  drop constraint if exists workout_exercise_sub_groups_muscle_sub_group_id_fkey,
  add constraint workout_exercise_sub_groups_muscle_sub_group_id_fkey
  foreign key (muscle_sub_group_id) references public.muscle_sub_groups(id) on delete restrict;

create or replace function public.create_template_with_exercises(
  p_name text,
  p_source text,
  p_source_log_id uuid,
  p_exercises jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template_id uuid;
  v_exercise jsonb;
  v_sort_order int := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_source not in ('ai_suggestion', 'manual') then
    raise exception 'Invalid template source';
  end if;

  if jsonb_typeof(p_exercises) <> 'array'
    or jsonb_array_length(p_exercises) = 0
    or jsonb_array_length(p_exercises) > 30 then
    raise exception 'Template must include 1 to 30 exercises';
  end if;

  insert into public.workout_templates (user_id, name, source, source_log_id)
  values (auth.uid(), left(coalesce(nullif(trim(p_name), ''), 'Menu'), 80), p_source, p_source_log_id)
  returning id into v_template_id;

  for v_exercise in select * from jsonb_array_elements(p_exercises)
  loop
    v_sort_order := v_sort_order + 1;

    insert into public.template_exercises (
      template_id,
      exercise_name,
      muscle_group_id,
      muscle_sub_group_id,
      equipment_id,
      target_sets,
      target_reps,
      target_weight_kg,
      notes,
      sort_order
    )
    values (
      v_template_id,
      v_exercise->>'exercise_name',
      nullif(v_exercise->>'muscle_group_id', '')::uuid,
      nullif(v_exercise->>'muscle_sub_group_id', '')::uuid,
      nullif(v_exercise->>'equipment_id', '')::uuid,
      nullif(v_exercise->>'target_sets', '')::int,
      nullif(v_exercise->>'target_reps', '')::int,
      nullif(v_exercise->>'target_weight_kg', '')::decimal,
      nullif(v_exercise->>'notes', ''),
      v_sort_order
    );
  end loop;

  return v_template_id;
end;
$$;

grant execute on function public.create_template_with_exercises(text, text, uuid, jsonb) to authenticated;

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
  v_set_count int;
  v_distinct_set_count int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_date > ((now() at time zone 'Asia/Tokyo')::date) then
    raise exception 'Future workout dates are not allowed';
  end if;

  if jsonb_typeof(p_exercises) <> 'array'
    or jsonb_array_length(p_exercises) = 0
    or jsonb_array_length(p_exercises) > 30 then
    raise exception 'Workout must include 1 to 30 exercises';
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

      select count(*), count(distinct value->>'set_number')
      into v_set_count, v_distinct_set_count
      from jsonb_array_elements(coalesce(v_exercise->'sets', '[]'::jsonb));

      if v_set_count < 1 or v_set_count > 20 or v_set_count <> v_distinct_set_count then
        raise exception 'Strength exercise must include 1 to 20 unique sets';
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

drop function if exists public.update_workout_with_details(uuid, date, jsonb);

create or replace function public.update_workout_with_details(
  p_workout_id uuid,
  p_date date,
  p_exercises jsonb,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current_updated_at timestamptz;
  v_exercise_id uuid;
  v_exercise jsonb;
  v_set jsonb;
  v_sub_group_id text;
  v_primary_sub_group_id uuid;
  v_exercise_type text;
  v_sort_order int := 0;
  v_set_count int;
  v_distinct_set_count int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_date > ((now() at time zone 'Asia/Tokyo')::date) then
    raise exception 'Future workout dates are not allowed';
  end if;

  if jsonb_typeof(p_exercises) <> 'array'
    or jsonb_array_length(p_exercises) = 0
    or jsonb_array_length(p_exercises) > 30 then
    raise exception 'Workout must include 1 to 30 exercises';
  end if;

  select updated_at into v_current_updated_at
  from public.workouts
  where id = p_workout_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Workout not found';
  end if;

  if p_expected_updated_at is not null and v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'Workout has been modified';
  end if;

  update public.workouts
  set date = p_date
  where id = p_workout_id
    and user_id = auth.uid();

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

      select count(*), count(distinct value->>'set_number')
      into v_set_count, v_distinct_set_count
      from jsonb_array_elements(coalesce(v_exercise->'sets', '[]'::jsonb));

      if v_set_count < 1 or v_set_count > 20 or v_set_count <> v_distinct_set_count then
        raise exception 'Strength exercise must include 1 to 20 unique sets';
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
grant execute on function public.update_workout_with_details(uuid, date, jsonb, timestamptz) to authenticated;
