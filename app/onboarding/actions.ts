"use server";

import { revalidatePath } from "next/cache";
import { getMasterData } from "@/lib/data";
import { markOnboardingCompleted, upsertUserProfile } from "@/lib/profile";
import { validateEditableProfile, validateProfileFocusMuscleIds } from "@/lib/profile-validation";
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
    const { muscleGroups } = await getMasterData();
    const focusValidation = validateProfileFocusMuscleIds(
      validated.payload,
      muscleGroups.map((group) => group.id),
    );
    if (!focusValidation.ok) return focusValidation;

    await upsertUserProfile(focusValidation.payload);
    await markOnboardingCompleted();
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("Failed to save onboarding", error);
    return { ok: false, message: "保存に失敗しました。" };
  }
}
