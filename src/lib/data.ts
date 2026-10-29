import { requireUser } from "@/lib/auth/session";
import { getMasterData as loadMasterData } from "@/lib/db/master";
import { getWorkout, listWorkouts } from "@/lib/db/workouts";

export async function getMasterData() {
  await requireUser();
  return loadMasterData();
}

export async function getWorkouts(limit = 30) {
  const { user } = await requireUser();
  return listWorkouts(user.id, { limit });
}

export async function getAllWorkouts() {
  const { user } = await requireUser();
  return listWorkouts(user.id);
}

export async function getWorkoutById(id: string) {
  const { user } = await requireUser();
  return getWorkout(user.id, id);
}
