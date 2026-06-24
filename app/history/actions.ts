"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import type { NewExercisePayload } from "@/lib/types";

export type UpdateWorkoutState = {
  ok: boolean;
  message?: string;
};

export async function updateWorkout(
  workoutId: string,
  date: string,
  exercises: NewExercisePayload[],
): Promise<UpdateWorkoutState> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "トレーニング日を選択してください。" };
  }

  if (exercises.length === 0) {
    return { ok: false, message: "エクササイズを1件以上残してください。" };
  }

  const { supabase } = await requireUser();
  const payload = exercises.map((exercise) => ({
    exercise_type: exercise.exercise_type,
    exercise_name: exercise.exercise_name,
    muscle_group_id: exercise.muscle_group_id,
    muscle_sub_group_ids: exercise.muscle_sub_group_ids,
    equipment_id: exercise.equipment_id,
    duration_minutes: exercise.duration_minutes,
    distance_km: exercise.distance_km,
    calories: exercise.calories,
    sets: Array.from({ length: exercise.sets }, (_, index) => ({
      set_number: index + 1,
      weight_kg: exercise.weight_kg,
      reps: exercise.reps,
    })),
  }));

  const { error } = await supabase.rpc("update_workout_with_details", {
    p_workout_id: workoutId,
    p_date: date,
    p_exercises: payload,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath(`/history/${workoutId}/edit`);
  return { ok: true };
}
