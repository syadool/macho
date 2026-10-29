import { requireUser } from "@/lib/auth/session";
import { listWorkouts } from "@/lib/db/workouts";
import type { ExerciseHistoryEntry } from "@/lib/types";

/**
 * ログインユーザーの過去のエクササイズ名を直近使用順で集約し、
 * 各種目名について最後に使ったときの部位・セット内容を添えて返す。
 * 同名種目が複数回登場する場合は最も新しい記録を採用する。
 */
export async function getExerciseHistory(limit = 20): Promise<ExerciseHistoryEntry[]> {
  const { user } = await requireUser();
  const workoutRows = await listWorkouts(user.id, { limit: 200 });
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
        exercise_type: row.exercise_type,
        muscle_group_id: row.muscle_groups?.id ?? null,
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
