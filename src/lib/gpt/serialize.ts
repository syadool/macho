import { getPeriodForDays } from "@/lib/gpt/data";
import type { Equipment, MuscleGroup, UserProfile, Workout, WorkoutExercise } from "@/lib/types";

export function serializeGptProfile(
  profile: Pick<
    UserProfile,
    "user_id" | "training_goal" | "experience_level" | "weekly_frequency" | "focus_muscle_group_ids" | "onboarding_completed"
  >,
  muscleGroups: MuscleGroup[],
) {
  const focusIds = profile.focus_muscle_group_ids ?? [];

  return {
    training_goal: profile.training_goal,
    experience_level: profile.experience_level,
    weekly_frequency: profile.weekly_frequency,
    onboarding_completed: profile.onboarding_completed,
    focus_muscle_group_ids: focusIds,
    focus_muscle_groups: muscleGroups
      .filter((group) => focusIds.includes(group.id))
      .map((group) => ({
        id: group.id,
        name: group.name,
        name_en: group.name_en,
      })),
  };
}

export function serializeGptMasterData(muscleGroups: MuscleGroup[], equipment: Equipment[]) {
  return {
    muscle_groups: muscleGroups.map((group) => ({
      id: group.id,
      name: group.name,
      name_en: group.name_en,
      sub_groups: (group.muscle_sub_groups ?? []).map((subGroup) => ({
        id: subGroup.id,
        name: subGroup.name,
      })),
    })),
    equipment: equipment.map((item) => ({
      id: item.id,
      name: item.name,
    })),
  };
}

export function serializeGptWorkouts(workouts: Workout[], options: { days: number; limit: number }) {
  return {
    period: getPeriodForDays(options.days),
    limit: options.limit,
    count: workouts.length,
    workouts: workouts.map((workout) => ({
      id: workout.id,
      date: workout.date,
      exercises: workout.workout_exercises.map(serializeExercise),
    })),
  };
}

export function buildGptStats(workouts: Workout[], days: number) {
  const strengthExercises = workouts.flatMap((workout) =>
    workout.workout_exercises
      .filter((exercise) => exercise.exercise_type === "strength")
      .map((exercise) => ({ workout, exercise })),
  );
  const cardioExercises = workouts.flatMap((workout) =>
    workout.workout_exercises
      .filter((exercise) => exercise.exercise_type === "cardio")
      .map((exercise) => ({ workout, exercise })),
  );
  const totalSets = strengthExercises.reduce((total, { exercise }) => total + exercise.workout_sets.length, 0);
  const totalExercises = workouts.reduce((total, workout) => total + workout.workout_exercises.length, 0);

  return {
    period: getPeriodForDays(days),
    summary: {
      total_sessions: workouts.length,
      avg_sessions_per_week: round((workouts.length / getEffectiveStatsDays(workouts, days)) * 7, 1),
      total_sets: totalSets,
      total_exercises: totalExercises,
    },
    volume_by_muscle_group: buildVolumeByMuscleGroup(strengthExercises),
    progression: buildProgression(strengthExercises),
    cardio_summary: {
      total_sessions: cardioExercises.length,
      total_duration_minutes: cardioExercises.reduce((total, { exercise }) => total + Number(exercise.duration_minutes ?? 0), 0),
      total_distance_km: round(cardioExercises.reduce((total, { exercise }) => total + Number(exercise.distance_km ?? 0), 0), 2),
      total_calories: cardioExercises.reduce((total, { exercise }) => total + Number(exercise.calories ?? 0), 0),
    },
  };
}

function serializeExercise(exercise: WorkoutExercise) {
  const base = {
    id: exercise.id,
    exercise_name: exercise.exercise_name,
    exercise_type: exercise.exercise_type,
    muscle_group: exercise.muscle_groups
      ? {
          id: exercise.muscle_groups.id,
          name: exercise.muscle_groups.name,
          name_en: exercise.muscle_groups.name_en,
        }
      : null,
    muscle_sub_groups: (exercise.muscle_sub_groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
    })),
    equipment: exercise.equipment
      ? {
          id: exercise.equipment.id,
          name: exercise.equipment.name,
        }
      : null,
  };

  if (exercise.exercise_type === "cardio") {
    return {
      ...base,
      duration_minutes: exercise.duration_minutes,
      distance_km: exercise.distance_km,
      calories: exercise.calories,
    };
  }

  return {
    ...base,
    sets: exercise.workout_sets.map((set) => ({
      set_number: set.set_number,
      weight_kg: Number(set.weight_kg),
      reps: set.reps,
      volume_kg: round(Number(set.weight_kg) * set.reps, 2),
    })),
  };
}

function buildVolumeByMuscleGroup(
  rows: Array<{
    exercise: WorkoutExercise;
  }>,
) {
  const map = new Map<string, { id: string; name: string; name_en: string; total_sets: number; total_reps: number; total_volume_kg: number }>();

  for (const { exercise } of rows) {
    if (!exercise.muscle_groups) continue;
    const key = exercise.muscle_groups.id;
    const current =
      map.get(key) ??
      {
        id: exercise.muscle_groups.id,
        name: exercise.muscle_groups.name,
        name_en: exercise.muscle_groups.name_en,
        total_sets: 0,
        total_reps: 0,
        total_volume_kg: 0,
      };

    current.total_sets += exercise.workout_sets.length;
    current.total_reps += exercise.workout_sets.reduce((total, set) => total + set.reps, 0);
    current.total_volume_kg += exercise.workout_sets.reduce((total, set) => total + Number(set.weight_kg) * set.reps, 0);
    map.set(key, current);
  }

  return Array.from(map.values())
    .map((item) => ({ ...item, total_volume_kg: round(item.total_volume_kg, 2) }))
    .sort((a, b) => b.total_sets - a.total_sets);
}

function buildProgression(
  rows: Array<{
    workout: Workout;
    exercise: WorkoutExercise;
  }>,
) {
  const map = new Map<string, Array<{ date: string; max_weight_kg: number; max_reps_at_max_weight: number }>>();

  for (const { workout, exercise } of rows) {
    if (exercise.workout_sets.length === 0) continue;
    const maxSet = [...exercise.workout_sets].sort((a, b) => Number(b.weight_kg) - Number(a.weight_kg) || b.reps - a.reps)[0];
    const dataPoints = map.get(exercise.exercise_name) ?? [];
    dataPoints.push({
      date: workout.date,
      max_weight_kg: Number(maxSet.weight_kg),
      max_reps_at_max_weight: maxSet.reps,
    });
    map.set(exercise.exercise_name, dataPoints);
  }

  return Array.from(map.entries())
    .map(([exerciseName, dataPoints]) => ({
      exercise_name: exerciseName,
      data_points: dataPoints.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => b.data_points.length - a.data_points.length);
}

function round(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function getEffectiveStatsDays(workouts: Workout[], requestedDays: number) {
  if (workouts.length === 0) return Math.max(requestedDays, 1);

  const oldestWorkout = workouts.reduce((oldest, workout) => (workout.date < oldest.date ? workout : oldest));
  const today = new Date();
  const oldestDate = new Date(`${oldestWorkout.date}T00:00:00.000Z`);
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const elapsedDays = Math.floor((todayDate.getTime() - oldestDate.getTime()) / 86_400_000) + 1;

  return Math.max(1, Math.min(requestedDays, elapsedDays));
}
