"use server";

import { revalidatePath } from "next/cache";
import { cardioSchemaMigrationMessage, isMissingCardioSchemaError } from "@/lib/supabase/schema-errors";
import { requireOnboardedUser } from "@/lib/supabase/server";
import type { NewExercisePayload } from "@/lib/types";
import { validateWorkoutInput } from "@/lib/workout-input";

export type SaveWorkoutState = {
  ok: boolean;
  message?: string;
};

export async function saveWorkout(date: string, exercises: NewExercisePayload[]): Promise<SaveWorkoutState> {
  const validated = validateWorkoutInput(date, exercises);
  if (!validated.ok) return validated;

  const { supabase } = await requireOnboardedUser();

  const { error } = await supabase.rpc("create_workout_with_details", {
    p_date: date,
    p_exercises: validated.payload,
  });

  if (error) {
    if (hasCardioExercise(exercises) && (isMissingCardioSchemaError(error.message) || isLegacyCardioInsertError(error.message))) {
      return { ok: false, message: cardioSchemaMigrationMessage() };
    }

    console.error("Failed to save workout", error);
    return { ok: false, message: "ワークアウトの保存に失敗しました。" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { ok: true };
}

function hasCardioExercise(exercises: NewExercisePayload[]) {
  return exercises.some((exercise) => exercise.exercise_type === "cardio");
}

function isLegacyCardioInsertError(message: string) {
  return message.includes('null value in column "muscle_group_id"') || message.includes("Muscle group is required for strength exercise");
}
