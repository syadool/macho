import { requireUser } from "@/lib/supabase/server";
import type { ExerciseHistoryEntry, ExerciseType, Workout, WorkoutExercise } from "@/lib/types";

export function isCardioExercise(exercise: WorkoutExercise) {
  return exercise.exercise_type === "cardio";
}

export function exerciseSetCount(exercise: WorkoutExercise) {
  if (isCardioExercise(exercise)) return 0;
  return exercise.workout_sets.length;
}

export function exerciseVolume(exercise: WorkoutExercise) {
  if (isCardioExercise(exercise)) return 0;
  return exercise.workout_sets.reduce((total, set) => total + Number(set.weight_kg) * set.reps, 0);
}

export function workoutSetCount(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + exerciseSetCount(exercise), 0);
}

export function workoutVolume(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + exerciseVolume(exercise), 0);
}

export function workoutCardioMinutes(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + Number(exercise.duration_minutes ?? 0), 0);
}

export function workoutCardioDistance(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + Number(exercise.distance_km ?? 0), 0);
}

export function workoutCardioCalories(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + Number(exercise.calories ?? 0), 0);
}

export function workoutTitle(workout: Workout) {
  if (workout.workout_exercises.length > 0 && workout.workout_exercises.every(isCardioExercise)) {
    return "有酸素ワークアウト";
  }

  const names = Array.from(
    new Set(workout.workout_exercises.map((exercise) => exercise.muscle_groups?.name).filter(Boolean)),
  );

  if (names.length === 0) return "ワークアウト";
  return `${names.slice(0, 2).join(" + ")}トレーニング`;
}

export function workoutSummary(workout: Workout) {
  const names = workout.workout_exercises.map((exercise) => exercise.exercise_name);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} 他`;
}

export function primaryMuscle(workout: Workout) {
  return workout.workout_exercises.find((exercise) => exercise.muscle_groups)?.muscle_groups ?? null;
}

type ExerciseHistoryWorkoutRow = {
  date: string;
  workout_exercises: Array<{
    exercise_name: string;
    exercise_type: ExerciseType | null;
    muscle_group_id: string | null;
    duration_minutes: number | null;
    workout_sets: Array<{ set_number: number; weight_kg: number; reps: number }> | null;
  }> | null;
};

const EXERCISE_HISTORY_SELECT =
  "date,workout_exercises(exercise_name,exercise_type,muscle_group_id,duration_minutes,workout_sets(set_number,weight_kg,reps))";

/**
 * ログインユーザーの過去のエクササイズ名を直近使用順で集約し、
 * 各種目名について最後に使ったときの部位・セット内容を添えて返す。
 * 同名種目が複数回登場する場合は最も新しい記録を採用する。
 */
export async function getExerciseHistory(limit = 20): Promise<ExerciseHistoryEntry[]> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("workouts")
    .select(EXERCISE_HISTORY_SELECT)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const workoutRows = ((data as unknown) as ExerciseHistoryWorkoutRow[] | null) ?? [];
  const seen = new Map<string, ExerciseHistoryEntry>();

  for (const workout of workoutRows) {
    for (const row of workout.workout_exercises ?? []) {
      const key = row.exercise_name.trim().toLowerCase();
      if (!key) continue;

      const existing = seen.get(key);
      if (existing) {
        existing.use_count += 1;
        continue;
      }

      seen.set(key, {
        exercise_name: row.exercise_name,
        exercise_type: row.exercise_type ?? "strength",
        muscle_group_id: row.muscle_group_id,
        last_used_at: workout.date,
        last_duration_minutes: row.duration_minutes,
        last_sets: (row.workout_sets ?? [])
          .slice()
          .sort((a, b) => a.set_number - b.set_number)
          .map((set) => ({ weight_kg: Number(set.weight_kg), reps: set.reps })),
        use_count: 1,
      });
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b.use_count - a.use_count || (a.last_used_at < b.last_used_at ? 1 : -1))
    .slice(0, limit);
}
