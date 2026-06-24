"use server";

import { revalidatePath } from "next/cache";
import { markOnboardingCompleted, upsertUserProfile } from "@/lib/profile";
import { validateEditableProfile } from "@/lib/profile-validation";
import type { ExperienceLevel, TrainingGoal } from "@/lib/types";

export type SaveOnboardingState = { ok: boolean; message?: string };

export async function saveOnboarding(input: {
  training_goal: TrainingGoal;
  experience_level: ExperienceLevel;
  weekly_frequency: number;
  focus_muscle_group_ids: string[];
}): Promise<SaveOnboardingState> {
  const validated = validateEditableProfile(input);
  if (!validated.ok) return validated;

  try {
    await upsertUserProfile(validated.payload);
    await markOnboardingCompleted();
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "保存に失敗しました。" };
  }
}
