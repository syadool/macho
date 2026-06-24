"use server";

import { revalidatePath } from "next/cache";
import { upsertUserProfile } from "@/lib/profile";
import { validateEditableProfile } from "@/lib/profile-validation";
import type { ExperienceLevel, TrainingGoal } from "@/lib/types";

export async function saveProfile(input: {
  training_goal: TrainingGoal;
  experience_level: ExperienceLevel;
  weekly_frequency: number;
  focus_muscle_group_ids: string[];
}): Promise<{ ok: boolean; message?: string }> {
  const validated = validateEditableProfile(input);
  if (!validated.ok) return validated;

  try {
    await upsertUserProfile(validated.payload);
    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "保存に失敗しました。" };
  }
}
