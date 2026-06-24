import { MUSCLE_GROUPS, EQUIPMENT } from "@/lib/constants";
import type { Equipment, MuscleGroup, MuscleSubGroup, Workout } from "@/lib/types";
import { requireUser } from "@/lib/supabase/server";

type SupabaseWorkout = Omit<Workout, "workout_exercises"> & {
  workout_exercises: Array<
    Omit<Workout["workout_exercises"][number], "muscle_groups" | "equipment"> & {
      muscle_groups: MuscleGroup | MuscleGroup[] | null;
      workout_exercise_sub_groups?: Array<{
        muscle_sub_groups: MuscleSubGroup | MuscleSubGroup[] | null;
      }>;
      equipment: Equipment | Equipment[] | null;
    }
  >;
};

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
  const { data } = await supabase
    .from("workouts")
    .select(
      "id,date,created_at,workout_exercises(id,exercise_name,exercise_type,duration_minutes,distance_km,calories,sort_order,muscle_groups(id,name,name_en,color,sort_order),workout_exercise_sub_groups(muscle_sub_groups(id,muscle_group_id,name,sort_order)),equipment(id,name,sort_order),workout_sets(id,set_number,weight_kg,reps))",
    )
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return normalizeWorkouts((data as SupabaseWorkout[] | null) ?? []);
}

export async function getWorkoutById(id: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("workouts")
    .select(
      "id,date,created_at,workout_exercises(id,exercise_name,exercise_type,duration_minutes,distance_km,calories,sort_order,muscle_groups(id,name,name_en,color,sort_order),workout_exercise_sub_groups(muscle_sub_groups(id,muscle_group_id,name,sort_order)),equipment(id,name,sort_order),workout_sets(id,set_number,weight_kg,reps))",
    )
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  const [workout] = normalizeWorkouts(data ? [data as SupabaseWorkout] : []);
  return workout ?? null;
}

function normalizeWorkouts(workouts: SupabaseWorkout[]): Workout[] {
  return workouts.map((workout) => ({
    ...workout,
    workout_exercises: workout.workout_exercises
      .map((exercise) => ({
        ...exercise,
        muscle_groups: Array.isArray(exercise.muscle_groups) ? exercise.muscle_groups[0] ?? null : exercise.muscle_groups,
        muscle_sub_groups: normalizeExerciseSubGroups(exercise.workout_exercise_sub_groups),
        equipment: Array.isArray(exercise.equipment) ? exercise.equipment[0] ?? null : exercise.equipment,
        workout_sets: exercise.workout_sets.sort((a, b) => a.set_number - b.set_number),
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

function normalizeExerciseSubGroups(
  rows: SupabaseWorkout["workout_exercises"][number]["workout_exercise_sub_groups"],
) {
  return (rows ?? [])
    .map((row) =>
      Array.isArray(row.muscle_sub_groups) ? row.muscle_sub_groups[0] ?? null : row.muscle_sub_groups,
    )
    .filter((group): group is MuscleSubGroup => Boolean(group))
    .sort((a, b) => a.sort_order - b.sort_order);
}
