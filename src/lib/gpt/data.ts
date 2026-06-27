import { createAdminClient } from "@/lib/supabase/admin";
import { MUSCLE_GROUPS, EQUIPMENT } from "@/lib/constants";
import type { Equipment, MuscleGroup, MuscleSubGroup, UserProfile, Workout } from "@/lib/types";

type SupabaseWorkout = Omit<Workout, "workout_exercises"> & {
  workout_exercises: Array<
    Partial<Omit<Workout["workout_exercises"][number], "muscle_groups" | "equipment">> & {
      id: string;
      exercise_name: string;
      sort_order: number;
      muscle_groups: MuscleGroup | MuscleGroup[] | null;
      muscle_sub_groups?: MuscleSubGroup | MuscleSubGroup[] | null;
      workout_exercise_sub_groups?: Array<{
        muscle_sub_groups: MuscleSubGroup | MuscleSubGroup[] | null;
      }>;
      equipment: Equipment | Equipment[] | null;
    }
  >;
};

const WORKOUT_SELECT =
  "id,date,created_at,updated_at,workout_exercises(id,exercise_name,exercise_type,duration_minutes,distance_km,calories,sort_order,muscle_groups(id,name,name_en,color,sort_order),workout_exercise_sub_groups(muscle_sub_groups(id,muscle_group_id,name,sort_order)),equipment(id,name,sort_order),workout_sets(id,set_number,weight_kg,reps))";

const LEGACY_WORKOUT_SELECT =
  "id,date,created_at,updated_at,workout_exercises(id,exercise_name,sort_order,muscle_groups(id,name,name_en,color,sort_order),muscle_sub_groups!workout_exercises_muscle_sub_group_id_fkey(id,muscle_group_id,name,sort_order),equipment(id,name,sort_order),workout_sets(id,set_number,weight_kg,reps))";
const GPT_STATS_WORKOUT_ROW_CAP = 2000;

export async function getGptProfile(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_profiles")
    .select("user_id,training_goal,experience_level,weekly_frequency,focus_muscle_group_ids,onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Pick<
    UserProfile,
    "user_id" | "training_goal" | "experience_level" | "weekly_frequency" | "focus_muscle_group_ids" | "onboarding_completed"
  > | null;
}

export async function getGptMasterData() {
  const admin = createAdminClient();
  const [muscles, equipment] = await Promise.all([
    admin
      .from("muscle_groups")
      .select("id,name,name_en,color,sort_order,muscle_sub_groups(id,muscle_group_id,name,sort_order)")
      .order("sort_order")
      .order("sort_order", { referencedTable: "muscle_sub_groups" }),
    admin.from("equipment").select("id,name,sort_order").order("sort_order"),
  ]);

  if (muscles.error) throw new Error(muscles.error.message);
  if (equipment.error) throw new Error(equipment.error.message);

  return {
    muscleGroups: (muscles.data as MuscleGroup[] | null) ?? MUSCLE_GROUPS,
    equipment: (equipment.data as Equipment[] | null) ?? EQUIPMENT,
  };
}

export async function getGptWorkouts(userId: string, options: { days: number; limit: number }) {
  const admin = createAdminClient();
  const { from } = getPeriodForDays(options.days);
  const { data, error } = await admin
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("user_id", userId)
    .gte("date", from)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (isLegacyWorkoutSchemaError(error)) {
    return getLegacyGptWorkouts(userId, options);
  }

  if (error) throw new Error(error.message);
  return normalizeWorkouts((data as SupabaseWorkout[] | null) ?? []);
}

export async function getAllGptWorkouts(userId: string, options: { days: number }) {
  const admin = createAdminClient();
  const { from } = getPeriodForDays(options.days);
  const pageSize = 1000;
  const workouts: SupabaseWorkout[] = [];

  for (let rangeFrom = 0; rangeFrom < GPT_STATS_WORKOUT_ROW_CAP; rangeFrom += pageSize) {
    const rangeTo = Math.min(rangeFrom + pageSize - 1, GPT_STATS_WORKOUT_ROW_CAP - 1);
    const { data, error } = await admin
      .from("workouts")
      .select(WORKOUT_SELECT)
      .eq("user_id", userId)
      .gte("date", from)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (isLegacyWorkoutSchemaError(error)) {
      return getAllLegacyGptWorkouts(userId, options);
    }

    if (error) throw new Error(error.message);

    const page = (data as SupabaseWorkout[] | null) ?? [];
    workouts.push(...page);
    if (page.length < pageSize || workouts.length >= GPT_STATS_WORKOUT_ROW_CAP) break;
  }

  return normalizeWorkouts(workouts);
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

function normalizeWorkouts(workouts: SupabaseWorkout[]): Workout[] {
  return workouts.map((workout) => ({
    ...workout,
    workout_exercises: workout.workout_exercises
      .map((exercise) => ({
        ...exercise,
        exercise_type: exercise.exercise_type ?? "strength",
        duration_minutes: exercise.duration_minutes ?? null,
        distance_km: exercise.distance_km ?? null,
        calories: exercise.calories ?? null,
        muscle_groups: Array.isArray(exercise.muscle_groups) ? exercise.muscle_groups[0] ?? null : exercise.muscle_groups,
        muscle_sub_groups: normalizeExerciseSubGroups(exercise),
        equipment: Array.isArray(exercise.equipment) ? exercise.equipment[0] ?? null : exercise.equipment,
        workout_sets: (exercise.workout_sets ?? []).sort((a, b) => a.set_number - b.set_number),
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  })) as Workout[];
}

function normalizeExerciseSubGroups(exercise: SupabaseWorkout["workout_exercises"][number]) {
  const groups = (exercise.workout_exercise_sub_groups ?? []).map((row) =>
    Array.isArray(row.muscle_sub_groups) ? row.muscle_sub_groups[0] ?? null : row.muscle_sub_groups,
  );
  const legacyGroup = Array.isArray(exercise.muscle_sub_groups)
    ? exercise.muscle_sub_groups[0] ?? null
    : exercise.muscle_sub_groups;

  return [...groups, legacyGroup]
    .filter((group): group is MuscleSubGroup => Boolean(group))
    .sort((a, b) => a.sort_order - b.sort_order);
}

function isLegacyWorkoutSchemaError(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "42703" || error.code === "PGRST200") &&
      (error.message?.includes("exercise_type") ||
        error.message?.includes("duration_minutes") ||
        error.message?.includes("distance_km") ||
        error.message?.includes("calories") ||
        error.message?.includes("workout_exercise_sub_groups")),
  );
}

async function getLegacyGptWorkouts(userId: string, options: { days: number; limit: number }) {
  const admin = createAdminClient();
  const { from } = getPeriodForDays(options.days);
  const { data, error } = await admin
    .from("workouts")
    .select(LEGACY_WORKOUT_SELECT)
    .eq("user_id", userId)
    .gte("date", from)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (error) throw new Error(error.message);
  return normalizeWorkouts((data as SupabaseWorkout[] | null) ?? []);
}

async function getAllLegacyGptWorkouts(userId: string, options: { days: number }) {
  const admin = createAdminClient();
  const { from } = getPeriodForDays(options.days);
  const pageSize = 1000;
  const workouts: SupabaseWorkout[] = [];

  for (let rangeFrom = 0; rangeFrom < GPT_STATS_WORKOUT_ROW_CAP; rangeFrom += pageSize) {
    const rangeTo = Math.min(rangeFrom + pageSize - 1, GPT_STATS_WORKOUT_ROW_CAP - 1);
    const { data, error } = await admin
      .from("workouts")
      .select(LEGACY_WORKOUT_SELECT)
      .eq("user_id", userId)
      .gte("date", from)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (error) throw new Error(error.message);

    const page = (data as SupabaseWorkout[] | null) ?? [];
    workouts.push(...page);
    if (page.length < pageSize || workouts.length >= GPT_STATS_WORKOUT_ROW_CAP) break;
  }

  return normalizeWorkouts(workouts);
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}
