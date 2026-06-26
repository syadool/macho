import type { ExperienceLevel, TrainingGoal } from "@/lib/types";

export type EditableProfilePayload = {
  training_goal: TrainingGoal;
  experience_level: ExperienceLevel;
  weekly_frequency: number;
  focus_muscle_group_ids: string[];
};

const TRAINING_GOALS: TrainingGoal[] = ["hypertrophy", "strength", "fat_loss", "maintenance"];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateEditableProfile(input: EditableProfilePayload): { ok: true; payload: EditableProfilePayload } | { ok: false; message: string } {
  if (!TRAINING_GOALS.includes(input.training_goal)) return { ok: false, message: "目的を選択してください。" };
  if (!EXPERIENCE_LEVELS.includes(input.experience_level)) return { ok: false, message: "レベルを選択してください。" };
  if (!Number.isInteger(input.weekly_frequency) || input.weekly_frequency < 1 || input.weekly_frequency > 7) {
    return { ok: false, message: "頻度は1〜7回で選択してください。" };
  }

  const focusMuscleGroupIds = Array.isArray(input.focus_muscle_group_ids) ? input.focus_muscle_group_ids : [];

  return {
    ok: true,
    payload: {
      training_goal: input.training_goal,
      experience_level: input.experience_level,
      weekly_frequency: input.weekly_frequency,
      focus_muscle_group_ids: Array.from(
        new Set(focusMuscleGroupIds.filter((id) => typeof id === "string" && UUID_PATTERN.test(id))),
      ),
    },
  };
}

export function validateProfileFocusMuscleIds(
  payload: EditableProfilePayload,
  validMuscleGroupIds: string[],
): { ok: true; payload: EditableProfilePayload } | { ok: false; message: string } {
  const validIds = new Set(validMuscleGroupIds);
  if (payload.focus_muscle_group_ids.some((id) => !validIds.has(id))) {
    return { ok: false, message: "重点部位の指定が不正です。" };
  }

  return { ok: true, payload };
}
