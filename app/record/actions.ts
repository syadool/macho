"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import type { NewExercisePayload } from "@/lib/types";
import { toDateInputValue } from "@/lib/date";

export type SaveWorkoutState = {
  ok: boolean;
  message?: string;
};

export async function saveWorkout(exercises: NewExercisePayload[]): Promise<SaveWorkoutState> {
  if (exercises.length === 0) {
    return { ok: false, message: "エクササイズを追加してください。" };
  }

  const { supabase } = await requireUser();
  const payload = exercises.map((exercise) => ({
    exercise_name: exercise.exercise_name,
    muscle_group_id: exercise.muscle_group_id,
    muscle_sub_group_id: exercise.muscle_sub_group_id,
    equipment_id: exercise.equipment_id,
    sets: Array.from({ length: exercise.sets }, (_, index) => ({
      set_number: index + 1,
      weight_kg: exercise.weight_kg,
      reps: exercise.reps,
    })),
  }));

  const { error } = await supabase.rpc("create_workout_with_details", {
    p_date: toDateInputValue(),
    p_exercises: payload,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { ok: true };
}
