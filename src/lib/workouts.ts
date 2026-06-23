import type { Workout, WorkoutExercise } from "@/lib/types";

export function exerciseSetCount(exercise: WorkoutExercise) {
  return exercise.workout_sets.length;
}

export function exerciseVolume(exercise: WorkoutExercise) {
  return exercise.workout_sets.reduce((total, set) => total + Number(set.weight_kg) * set.reps, 0);
}

export function workoutSetCount(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + exerciseSetCount(exercise), 0);
}

export function workoutVolume(workout: Workout) {
  return workout.workout_exercises.reduce((total, exercise) => total + exerciseVolume(exercise), 0);
}

export function workoutTitle(workout: Workout) {
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
  return workout.workout_exercises[0]?.muscle_groups ?? null;
}
