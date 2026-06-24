alter table public.ai_suggestion_logs
drop constraint if exists ai_suggestion_logs_status_check;

alter table public.ai_suggestion_logs
add constraint ai_suggestion_logs_status_check
check (status in ('pending', 'success', 'cached', 'rate_limited', 'forbidden', 'error'));

alter table public.template_exercises
drop constraint if exists template_exercises_target_sets_check;

alter table public.template_exercises
add constraint template_exercises_target_sets_check
check (target_sets between 1 and 20 or target_sets is null);

alter table public.template_exercises
drop constraint if exists template_exercises_target_reps_check;

alter table public.template_exercises
add constraint template_exercises_target_reps_check
check (target_reps between 1 and 200 or target_reps is null);

alter table public.template_exercises
drop constraint if exists template_exercises_target_weight_kg_check;

alter table public.template_exercises
add constraint template_exercises_target_weight_kg_check
check (target_weight_kg between 0 and 1000 or target_weight_kg is null);

alter table public.template_exercises
drop constraint if exists template_exercises_notes_length_check;

alter table public.template_exercises
add constraint template_exercises_notes_length_check
check (char_length(notes) <= 400 or notes is null);
