"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/session";
import { updateWorkout as updateWorkoutRecord } from "@/lib/db/workouts";
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
  expectedUpdatedAt: string,
): Promise<UpdateWorkoutState> {
  const validated = validateWorkoutInput(date, exercises);
  if (!validated.ok) return validated;
  if (typeof workoutId !== "string" || typeof expectedUpdatedAt !== "string") {
    return { ok: false, message: "ワークアウトの更新に失敗しました。" };
  }

  const { user } = await requireOnboardedUser();

  try {
    const result = await updateWorkoutRecord(user.id, workoutId, date, validated.payload, expectedUpdatedAt);
    if (result === "modified") {
      return { ok: false, message: "別の画面で更新されています。再読み込みしてから編集してください。" };
    }
  } catch (error) {
    console.error("Failed to update workout", error);
    return { ok: false, message: "ワークアウトの更新に失敗しました。" };
  }

  revalidateWorkoutPaths(workoutId);
  return { ok: true };
}

function revalidateWorkoutPaths(workoutId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath(`/history/${workoutId}/edit`);
}
