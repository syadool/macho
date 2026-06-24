import { MUSCLE_GROUPS, EQUIPMENT } from "@/lib/constants";
import type { Equipment, MuscleGroup, MuscleSubGroup, Workout } from "@/lib/types";
import { requireUser } from "@/lib/supabase/server";

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
  "id,date,created_at,workout_exercises(id,exercise_name,exercise_type,duration_minutes,distance_km,calories,sort_order,muscle_groups(id,name,name_en,color,sort_order),workout_exercise_sub_groups(muscle_sub_groups(id,muscle_group_id,name,sort_order)),equipment(id,name,sort_order),workout_sets(id,set_number,weight_kg,reps))";

const LEGACY_WORKOUT_SELECT =
  "id,date,created_at,workout_exercises(id,exercise_name,sort_order,muscle_groups(id,name,name_en,color,sort_order),muscle_sub_groups!workout_exercises_muscle_sub_group_id_fkey(id,muscle_group_id,name,sort_order),equipment(id,name,sort_order),workout_sets(id,set_number,weight_kg,reps))";

export async function getMasterData() {
  const { supabase } = await requireUser();

  const [muscles, equipment] = await Promise.all([
    supabase
      .from("muscle_groups")
      .select("id,name,name_en,color,sort_order,muscle_sub_groups(id,muscle_group_id,name,sort_order)")
      .order("sort_order")
      .order("sort_order", { referencedTable: "muscle_sub_groups" }),
    supabase.from("equipment").select("id,name,sort_order").order("sort_order"),
  ]);

  return {
    muscleGroups: (muscles.data as MuscleGroup[] | null) ?? MUSCLE_GROUPS,
    equipment: (equipment.data as Equipment[] | null) ?? EQUIPMENT,
  };
}

export async function getWorkouts(limit = 30) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isLegacyWorkoutSchemaError(error)) {
    const legacy = await supabase
      .from("workouts")
      .select(LEGACY_WORKOUT_SELECT)
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (legacy.error) throw new Error(legacy.error.message);
    return normalizeWorkouts((legacy.data as SupabaseWorkout[] | null) ?? []);
  }

  if (error) throw new Error(error.message);
  return normalizeWorkouts((data as SupabaseWorkout[] | null) ?? []);
}

export async function getAllWorkouts() {
  const { supabase, user } = await requireUser();
  const pageSize = 1000;
  const workouts: SupabaseWorkout[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("workouts")
      .select(WORKOUT_SELECT)
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (isLegacyWorkoutSchemaError(error)) {
      return getAllLegacyWorkouts(user.id);
    }

    if (error) throw new Error(error.message);

    const page = (data as SupabaseWorkout[] | null) ?? [];
    workouts.push(...page);
    if (page.length < pageSize) break;
  }

  return normalizeWorkouts(workouts);
}

export async function getWorkoutById(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  if (isLegacyWorkoutSchemaError(error)) {
    const legacy = await supabase
      .from("workouts")
      .select(LEGACY_WORKOUT_SELECT)
      .eq("user_id", user.id)
      .eq("id", id)
      .single();

    if (legacy.error) return null;
    const [workout] = normalizeWorkouts(legacy.data ? [legacy.data as SupabaseWorkout] : []);
    return workout ?? null;
  }

  if (error) return null;
  const [workout] = normalizeWorkouts(data ? [data as SupabaseWorkout] : []);
  return workout ?? null;
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
  }));
}

function normalizeExerciseSubGroups(exercise: SupabaseWorkout["workout_exercises"][number]) {
  const groups = (exercise.workout_exercise_sub_groups ?? [])
    .map((row) =>
      Array.isArray(row.muscle_sub_groups) ? row.muscle_sub_groups[0] ?? null : row.muscle_sub_groups,
    );
  const legacyGroup = Array.isArray(exercise.muscle_sub_groups)
    ? exercise.muscle_sub_groups[0] ?? null
    : exercise.muscle_sub_groups;

  return [...(groups ?? []), legacyGroup]
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

async function getAllLegacyWorkouts(userId: string) {
  const { supabase } = await requireUser();
  const pageSize = 1000;
  const workouts: SupabaseWorkout[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("workouts")
      .select(LEGACY_WORKOUT_SELECT)
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);

    const page = (data as SupabaseWorkout[] | null) ?? [];
    workouts.push(...page);
    if (page.length < pageSize) break;
  }

  return normalizeWorkouts(workouts);
}
