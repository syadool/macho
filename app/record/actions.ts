"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import type { NewExercisePayload } from "@/lib/types";

export type SaveWorkoutState = {
  ok: boolean;
  message?: string;
};

export async function saveWorkout(date: string, exercises: NewExercisePayload[]): Promise<SaveWorkoutState> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "トレーニング日を選択してください。" };
  }

  if (exercises.length === 0) {
    return { ok: false, message: "エクササイズを追加してください。" };
  }

  const { supabase } = await requireUser();
  const payload = exercises.map((exercise) => ({
    exercise_name: exercise.exercise_name,
    muscle_group_id: exercise.muscle_group_id,
    muscle_sub_group_ids: exercise.muscle_sub_group_ids,
    equipment_id: exercise.equipment_id,
    sets: Array.from({ length: exercise.sets }, (_, index) => ({
      set_number: index + 1,
      weight_kg: exercise.weight_kg,
      reps: exercise.reps,
    })),
  }));

  const { error } = await supabase.rpc("create_workout_with_details", {
    p_date: date,
    p_exercises: payload,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { ok: true };
}
