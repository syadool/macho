"use server";

import { revalidatePath } from "next/cache";
import { upsertUserProfile } from "@/lib/profile";
import type { ExperienceLevel, TrainingGoal } from "@/lib/types";

export async function saveProfile(input: {
  training_goal: TrainingGoal;
  experience_level: ExperienceLevel;
  weekly_frequency: number;
  focus_muscle_group_ids: string[];
}): Promise<{ ok: boolean; message?: string }> {
  try {
    await upsertUserProfile(input);
    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "保存に失敗しました。" };
  }
}
