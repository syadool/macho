import { getMasterData } from "@/lib/db/master";
import { getProfile } from "@/lib/db/profiles";
import { listWorkouts } from "@/lib/db/workouts";

const GPT_STATS_WORKOUT_ROW_CAP = 2000;

export async function getGptProfile(userId: string) {
  const profile = await getProfile(userId);
  if (!profile) return null;

  return {
    user_id: profile.user_id,
    training_goal: profile.training_goal,
    experience_level: profile.experience_level,
    weekly_frequency: profile.weekly_frequency,
    focus_muscle_group_ids: profile.focus_muscle_group_ids,
    onboarding_completed: profile.onboarding_completed,
  };
}

export async function getGptMasterData() {
  return getMasterData();
}

export async function getGptWorkouts(userId: string, options: { days: number; limit: number }) {
  const { from } = getPeriodForDays(options.days);
  return listWorkouts(userId, { fromDate: from, limit: options.limit });
}

export async function getAllGptWorkouts(userId: string, options: { days: number }) {
  const { from } = getPeriodForDays(options.days);
  return listWorkouts(userId, { fromDate: from, limit: GPT_STATS_WORKOUT_ROW_CAP });
}

export function getPeriodForDays(days: number) {
  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setDate(toDate.getDate() - days);

  return {
    from: toDateInputValue(fromDate),
    to: toDateInputValue(toDate),
    days,
  };
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}
