"use server";

import { revalidatePath } from "next/cache";
import { markOnboardingCompleted, upsertUserProfile } from "@/lib/profile";
import type { ExperienceLevel, TrainingGoal } from "@/lib/types";

export type SaveOnboardingState = { ok: boolean; message?: string };

const TRAINING_GOALS: TrainingGoal[] = ["hypertrophy", "strength", "fat_loss", "maintenance"];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];

export async function saveOnboarding(input: {
  training_goal: TrainingGoal;
  experience_level: ExperienceLevel;
  weekly_frequency: number;
  focus_muscle_group_ids: string[];
}): Promise<SaveOnboardingState> {
  if (!TRAINING_GOALS.includes(input.training_goal)) return { ok: false, message: "目的を選択してください。" };
  if (!EXPERIENCE_LEVELS.includes(input.experience_level)) return { ok: false, message: "レベルを選択してください。" };
  if (!Number.isInteger(input.weekly_frequency) || input.weekly_frequency < 1 || input.weekly_frequency > 7) {
    return { ok: false, message: "頻度は1〜7回で選択してください。" };
  }

  try {
    await upsertUserProfile({
      training_goal: input.training_goal,
      experience_level: input.experience_level,
      weekly_frequency: input.weekly_frequency,
      focus_muscle_group_ids: input.focus_muscle_group_ids,
    });
    await markOnboardingCompleted();
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "保存に失敗しました。" };
  }
}
