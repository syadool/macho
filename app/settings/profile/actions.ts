"use server";

import { revalidatePath } from "next/cache";
import { getMasterData } from "@/lib/data";
import { upsertUserProfile } from "@/lib/profile";
import { validateEditableProfile, validateProfileFocusMuscleIds } from "@/lib/profile-validation";
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
    const { muscleGroups } = await getMasterData();
    const focusValidation = validateProfileFocusMuscleIds(
      validated.payload,
      muscleGroups.map((group) => group.id),
    );
    if (!focusValidation.ok) return focusValidation;

    await upsertUserProfile(focusValidation.payload);
    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("Failed to save profile", error);
    return { ok: false, message: "保存に失敗しました。" };
  }
}
