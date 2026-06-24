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
    if (isMissingUpdateWorkoutRpcError(error.message)) {
      const fallback = await updateWorkoutWithLegacySchema(supabase, workoutId, date, exercises);
      if (!fallback.ok) return fallback;

      revalidateWorkoutPaths(workoutId);
      return { ok: true };
    }

    return { ok: false, message: error.message };
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

function revalidateWorkoutPaths(workoutId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath(`/history/${workoutId}/edit`);
}

async function updateWorkoutWithLegacySchema(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  workoutId: string,
  date: string,
  exercises: NewExercisePayload[],
): Promise<UpdateWorkoutState> {
  const cardioExercise = exercises.find((exercise) => exercise.exercise_type === "cardio");
  if (cardioExercise) {
    return {
      ok: false,
      message: "有酸素の編集にはDBマイグレーションの適用が必要です。先にSupabaseの更新を反映してください。",
    };
  }

  const missingMuscle = exercises.find((exercise) => !exercise.muscle_group_id);
  if (missingMuscle) {
    return { ok: false, message: "部位を選択してください。" };
  }

  const { error: workoutError } = await supabase.from("workouts").update({ date }).eq("id", workoutId);
  if (workoutError) return { ok: false, message: workoutError.message };

  const { error: deleteError } = await supabase.from("workout_exercises").delete().eq("workout_id", workoutId);
  if (deleteError) return { ok: false, message: deleteError.message };

  const exerciseRows = exercises.map((exercise, index) => ({
    workout_id: workoutId,
    exercise_name: exercise.exercise_name,
    muscle_group_id: exercise.muscle_group_id,
    muscle_sub_group_id: exercise.muscle_sub_group_ids[0] ?? null,
    equipment_id: exercise.equipment_id,
    sort_order: index + 1,
  }));

  const { data: insertedExercises, error: exerciseError } = await supabase
    .from("workout_exercises")
    .insert(exerciseRows)
    .select("id,sort_order");

  if (exerciseError) return { ok: false, message: exerciseError.message };

  const setRows = exercises.flatMap((exercise, exerciseIndex) => {
    const insertedExercise = insertedExercises?.find((row) => row.sort_order === exerciseIndex + 1);
    if (!insertedExercise) return [];

    return Array.from({ length: exercise.sets }, (_, index) => ({
      workout_exercise_id: insertedExercise.id,
      set_number: index + 1,
      weight_kg: exercise.weight_kg,
      reps: exercise.reps,
    }));
  });

  if (setRows.length === 0) return { ok: true };

  const { error: setError } = await supabase.from("workout_sets").insert(setRows);
  if (setError) return { ok: false, message: setError.message };

  return { ok: true };
}
