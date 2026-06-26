"use server";

import { revalidatePath } from "next/cache";
import { cardioSchemaMigrationMessage, isMissingCardioSchemaError } from "@/lib/supabase/schema-errors";
import { requireOnboardedUser } from "@/lib/supabase/server";
import type { NewExercisePayload } from "@/lib/types";
import { validateWorkoutInput } from "@/lib/workout-input";

export type UpdateWorkoutState = {
  ok: boolean;
  message?: string;
};

export async function updateWorkout(
  workoutId: string,
  date: string,
  exercises: NewExercisePayload[],
): Promise<UpdateWorkoutState> {
  const validated = validateWorkoutInput(date, exercises);
  if (!validated.ok) return validated;

  const { supabase } = await requireOnboardedUser();

  const { error } = await supabase.rpc("update_workout_with_details", {
    p_workout_id: workoutId,
    p_date: date,
    p_exercises: validated.payload,
  });

  if (error) {
    if (hasCardioExercise(exercises) && isMissingCardioSchemaError(error.message)) {
      return { ok: false, message: cardioSchemaMigrationMessage() };
    }

    if (isMissingUpdateWorkoutRpcError(error.message)) {
      return {
        ok: false,
        message: "履歴編集にはDBマイグレーションの適用が必要です。先にSupabaseの更新を反映してください。",
      };
    }

    console.error("Failed to update workout", error);
    return { ok: false, message: "ワークアウトの更新に失敗しました。" };
  }

  revalidateWorkoutPaths(workoutId);
  return { ok: true };
}

function isMissingUpdateWorkoutRpcError(message: string) {
  return (
    message.includes("Could not find the function public.update_workout_with_details") ||
    message.includes("Could not find function public.update_workout_with_details")
  );
}

function hasCardioExercise(exercises: NewExercisePayload[]) {
  return exercises.some((exercise) => exercise.exercise_type === "cardio");
}

function revalidateWorkoutPaths(workoutId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath(`/history/${workoutId}/edit`);
}
