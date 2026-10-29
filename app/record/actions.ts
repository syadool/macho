"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/session";
import { createWorkout } from "@/lib/db/workouts";
import type { NewExercisePayload } from "@/lib/types";
import { validateWorkoutInput } from "@/lib/workout-input";

export type SaveWorkoutState = {
  ok: boolean;
  message?: string;
};

export async function saveWorkout(date: string, exercises: NewExercisePayload[]): Promise<SaveWorkoutState> {
  const validated = validateWorkoutInput(date, exercises);
  if (!validated.ok) return validated;

  const { user } = await requireOnboardedUser();

  try {
    await createWorkout(user.id, date, validated.payload);
  } catch (error) {
    console.error("Failed to save workout", error);
    return { ok: false, message: "ワークアウトの保存に失敗しました。" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { ok: true };
}
