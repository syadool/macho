alter table public.user_profiles
  add column if not exists stripe_subscription_event_created bigint;

alter table public.user_profiles
  drop constraint if exists user_profiles_onboarding_completed_requires_profile,
  add constraint user_profiles_onboarding_completed_requires_profile
  check (
    onboarding_completed is not true
    or (
      training_goal is not null
      and experience_level is not null
      and weekly_frequency is not null
    )
  );

alter table public.workout_exercises
  drop constraint if exists workout_exercises_exercise_name_check,
  add constraint workout_exercises_exercise_name_check
  check (char_length(trim(exercise_name)) between 1 and 80),
  drop constraint if exists workout_exercises_duration_minutes_check,
  add constraint workout_exercises_duration_minutes_check
  check (duration_minutes is null or duration_minutes between 1 and 1440),
  drop constraint if exists workout_exercises_distance_km_check,
  add constraint workout_exercises_distance_km_check
  check (distance_km is null or distance_km between 0 and 1000),
  drop constraint if exists workout_exercises_calories_check,
  add constraint workout_exercises_calories_check
  check (calories is null or calories between 0 and 10000);

alter table public.workout_sets
  drop constraint if exists workout_sets_weight_kg_check,
  add constraint workout_sets_weight_kg_check check (weight_kg between 0 and 1000),
  drop constraint if exists workout_sets_reps_check,
  add constraint workout_sets_reps_check check (reps between 0 and 200);

alter table public.template_exercises
  drop constraint if exists template_exercises_exercise_name_check,
  add constraint template_exercises_exercise_name_check
  check (char_length(trim(exercise_name)) between 1 and 80);

create or replace function public.validate_workout_exercise_muscle_relationship()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_muscle_group_id uuid;
begin
  if new.exercise_type = 'strength' and new.muscle_group_id is null then
    raise exception 'Muscle group is required for strength exercise';
  end if;

  if new.exercise_type = 'cardio' and (new.muscle_group_id is not null or new.muscle_sub_group_id is not null) then
    raise exception 'Cardio exercise cannot have muscle group fields';
  end if;

  if new.muscle_sub_group_id is not null then
    select muscle_group_id into v_parent_muscle_group_id
    from public.muscle_sub_groups
    where id = new.muscle_sub_group_id;

    if v_parent_muscle_group_id is distinct from new.muscle_group_id then
      raise exception 'muscle_sub_group_id must belong to muscle_group_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists workout_exercises_validate_muscle_relationship on public.workout_exercises;
create trigger workout_exercises_validate_muscle_relationship
before insert or update on public.workout_exercises
for each row execute function public.validate_workout_exercise_muscle_relationship();

create or replace function public.validate_workout_exercise_sub_group_relationship()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_exercise_muscle_group_id uuid;
  v_sub_group_muscle_group_id uuid;
begin
  select muscle_group_id into v_exercise_muscle_group_id
  from public.workout_exercises
  where id = new.workout_exercise_id;

  select muscle_group_id into v_sub_group_muscle_group_id
  from public.muscle_sub_groups
  where id = new.muscle_sub_group_id;

  if v_exercise_muscle_group_id is null
    or v_sub_group_muscle_group_id is distinct from v_exercise_muscle_group_id then
    raise exception 'muscle_sub_group_id must belong to the exercise muscle_group_id';
  end if;

  return new;
end;
$$;

drop trigger if exists workout_exercise_sub_groups_validate_relationship on public.workout_exercise_sub_groups;
create trigger workout_exercise_sub_groups_validate_relationship
before insert or update on public.workout_exercise_sub_groups
for each row execute function public.validate_workout_exercise_sub_group_relationship();

create or replace function public.validate_strength_exercise_set_count()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_exercise_id uuid;
  v_exercise_type text;
  v_set_count int;
begin
  if tg_table_name = 'workout_sets' then
    if tg_op = 'DELETE' then
      v_exercise_id := old.workout_exercise_id;
    else
      v_exercise_id := new.workout_exercise_id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_exercise_id := old.id;
    else
      v_exercise_id := new.id;
    end if;
  end if;

  select exercise_type into v_exercise_type
  from public.workout_exercises
  where id = v_exercise_id;

  if v_exercise_type = 'strength' then
    select count(*) into v_set_count
    from public.workout_sets
    where workout_exercise_id = v_exercise_id;

    if v_set_count < 1 or v_set_count > 20 then
      raise exception 'Strength exercise must have 1 to 20 sets';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists workout_exercises_validate_strength_set_count on public.workout_exercises;
create constraint trigger workout_exercises_validate_strength_set_count
after insert or update on public.workout_exercises
deferrable initially deferred
for each row execute function public.validate_strength_exercise_set_count();

drop trigger if exists workout_sets_validate_strength_set_count on public.workout_sets;
create constraint trigger workout_sets_validate_strength_set_count
after insert or update or delete on public.workout_sets
deferrable initially deferred
for each row execute function public.validate_strength_exercise_set_count();

create or replace function public.validate_template_exercise_muscle_relationship()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_muscle_group_id uuid;
begin
  if new.muscle_sub_group_id is not null then
    if new.muscle_group_id is null then
      raise exception 'muscle_group_id is required when muscle_sub_group_id is set';
    end if;

    select muscle_group_id into v_parent_muscle_group_id
    from public.muscle_sub_groups
    where id = new.muscle_sub_group_id;

    if v_parent_muscle_group_id is distinct from new.muscle_group_id then
      raise exception 'muscle_sub_group_id must belong to muscle_group_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists template_exercises_validate_muscle_relationship on public.template_exercises;
create trigger template_exercises_validate_muscle_relationship
before insert or update on public.template_exercises
for each row execute function public.validate_template_exercise_muscle_relationship();

create or replace function public.prevent_ai_suggestion_enabled_self_change()
returns trigger
language plpgsql
set search_path = public
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
        or new.current_period_end is not null
        or new.stripe_subscription_event_created is not null then
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
        or new.current_period_end is distinct from old.current_period_end
        or new.stripe_subscription_event_created is distinct from old.stripe_subscription_event_created then
        raise exception 'subscription fields can only be changed by service role';
      end if;
    end if;
  end if;

  return new;
end;
$$;
