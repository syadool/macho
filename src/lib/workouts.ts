import type { Workout, WorkoutExercise } from "@/lib/types";

export function isCardioExercise(exercise: WorkoutExercise) {
  return exercise.exercise_type === "cardio";
}

export function exerciseSetCount(exercise: WorkoutExercise) {
  if (isCardioExercise(exercise)) return 0;
  return exercise.workout_sets.length;
}

export function exerciseVolume(exercise: WorkoutExercise) {
  if (isCardioExercise(exercise)) return 0;
  return exercise.workout_sets.reduce((total, set) => total + Number(set.weight_kg) * set.reps, 0);
}

export function workoutSetCount(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + exerciseSetCount(exercise), 0);
}

export function workoutVolume(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + exerciseVolume(exercise), 0);
}

export function workoutCardioMinutes(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + Number(exercise.duration_minutes ?? 0), 0);
}

export function workoutCardioDistance(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + Number(exercise.distance_km ?? 0), 0);
}

export function workoutCardioCalories(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + Number(exercise.calories ?? 0), 0);
}

export function workoutTitle(workout: Workout) {
  if (workout.workout_exercises.length > 0 && workout.workout_exercises.every(isCardioExercise)) {
    return "有酸素ワークアウト";
  }

  const names = Array.from(
    new Set(workout.workout_exercises.map((exercise) => exercise.muscle_groups?.name).filter(Boolean)),
  );

  if (names.length === 0) return "ワークアウト";
  return `${names.slice(0, 2).join(" + ")}トレーニング`;
}

export function workoutSummary(workout: Workout) {
  const names = workout.workout_exercises.map((exercise) => exercise.exercise_name);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} 他`;
}

export function primaryMuscle(workout: Workout) {
  return workout.workout_exercises.find((exercise) => exercise.muscle_groups)?.muscle_groups ?? null;
}
