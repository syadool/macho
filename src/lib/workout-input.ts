import type { ExerciseType, NewExercisePayload } from "@/lib/types";

export type WorkoutRpcSetPayload = {
  set_number: number;
  weight_kg: number;
  reps: number;
};

export type WorkoutRpcExercisePayload = {
  exercise_type: ExerciseType;
  exercise_name: string;
  muscle_group_id: string | null;
  muscle_sub_group_ids: string[];
  equipment_id: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  calories: number | null;
  sets: WorkoutRpcSetPayload[];
};

export type WorkoutInputValidationResult =
  | { ok: true; payload: WorkoutRpcExercisePayload[] }
  | { ok: false; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EXERCISES = 30;
const MAX_SETS = 20;

export function validateWorkoutInput(date: string, exercises: NewExercisePayload[]): WorkoutInputValidationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "トレーニング日を選択してください。" };
  }

  if (!Array.isArray(exercises) || exercises.length === 0) {
    return { ok: false, message: "エクササイズを追加してください。" };
  }

  if (exercises.length > MAX_EXERCISES) {
    return { ok: false, message: `エクササイズは${MAX_EXERCISES}件以内で入力してください。` };
  }

  const payload: WorkoutRpcExercisePayload[] = [];

  for (const [index, exercise] of exercises.entries()) {
    const itemNumber = index + 1;
    const exerciseType = exercise.exercise_type;
    if (exerciseType !== "strength" && exerciseType !== "cardio") {
      return { ok: false, message: `${itemNumber}件目の種目タイプが不正です。` };
    }

    const exerciseName = typeof exercise.exercise_name === "string" ? exercise.exercise_name.trim() : "";
    if (!exerciseName) return { ok: false, message: `${itemNumber}件目のエクササイズ名を入力してください。` };
    if (exerciseName.length > 80) return { ok: false, message: `${itemNumber}件目のエクササイズ名は80文字以内で入力してください。` };

    if (exerciseType === "strength") {
      const muscleGroupId = normalizeUuid(exercise.muscle_group_id);
      if (!muscleGroupId) return { ok: false, message: `${itemNumber}件目の部位を選択してください。` };

      const muscleSubGroupIds = normalizeUuidList(exercise.muscle_sub_group_ids, 10);
      if (muscleSubGroupIds === null) return { ok: false, message: `${itemNumber}件目のサブカテゴリが不正です。` };

      const equipmentId = normalizeOptionalUuid(exercise.equipment_id);
      if (equipmentId === undefined) return { ok: false, message: `${itemNumber}件目の器具が不正です。` };

      const sets = normalizeStrengthSets(exercise, itemNumber);
      if (!sets.ok) return sets;

      payload.push({
        exercise_type: "strength",
        exercise_name: exerciseName,
        muscle_group_id: muscleGroupId,
        muscle_sub_group_ids: muscleSubGroupIds,
        equipment_id: equipmentId,
        duration_minutes: null,
        distance_km: null,
        calories: null,
        sets: sets.payload,
      });
    } else {
      const durationMinutes = readInteger(exercise.duration_minutes, 1, 1440);
      if (durationMinutes === null) return { ok: false, message: `${itemNumber}件目の時間は1〜1440分で入力してください。` };

      const distanceKm = readNumber(exercise.distance_km, 0, 1000);
      if (distanceKm === null) return { ok: false, message: `${itemNumber}件目の距離は0〜1000kmで入力してください。` };

      const calories = readInteger(exercise.calories, 0, 10000);
      if (calories === null) return { ok: false, message: `${itemNumber}件目の消費カロリーは0〜10000kcalで入力してください。` };

      payload.push({
        exercise_type: "cardio",
        exercise_name: exerciseName,
        muscle_group_id: null,
        muscle_sub_group_ids: [],
        equipment_id: null,
        duration_minutes: durationMinutes,
        distance_km: distanceKm,
        calories,
        sets: [],
      });
    }
  }

  return { ok: true, payload };
}

function normalizeStrengthSets(
  exercise: NewExercisePayload,
  itemNumber: number,
): { ok: true; payload: WorkoutRpcSetPayload[] } | { ok: false; message: string } {
  const rawSets =
    Array.isArray(exercise.workout_sets) && exercise.workout_sets.length > 0
      ? exercise.workout_sets
      : Array.from({ length: exercise.sets }, () => ({
          weight_kg: exercise.weight_kg,
          reps: exercise.reps,
        }));

  if (rawSets.length < 1 || rawSets.length > MAX_SETS) {
    return { ok: false, message: `${itemNumber}件目のセット数は1〜${MAX_SETS}で入力してください。` };
  }

  const sets = rawSets.map((set, index) => {
    const weightKg = readNumber(set.weight_kg, 0, 1000);
    const reps = readInteger(set.reps, 0, 200);
    return {
      set_number: index + 1,
      weight_kg: weightKg,
      reps,
    };
  });

  const invalidSetIndex = sets.findIndex((set) => set.weight_kg === null || set.reps === null);
  if (invalidSetIndex >= 0) {
    return { ok: false, message: `${itemNumber}件目の${invalidSetIndex + 1}セット目の重量/回数が不正です。` };
  }

  return {
    ok: true,
    payload: sets.map((set) => ({
      set_number: set.set_number,
      weight_kg: set.weight_kg as number,
      reps: set.reps as number,
    })),
  };
}

function normalizeUuid(value: string | null | undefined) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function normalizeOptionalUuid(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  return UUID_PATTERN.test(value) ? value : undefined;
}

function normalizeUuidList(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];

  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !UUID_PATTERN.test(item)) return null;
    if (!ids.includes(item)) ids.push(item);
    if (ids.length > maxItems) return null;
  }

  return ids;
}

function readNumber(value: unknown, min: number, max: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) return null;
  return numberValue;
}

function readInteger(value: unknown, min: number, max: number) {
  const numberValue = readNumber(value, min, max);
  if (numberValue === null || !Number.isInteger(numberValue)) return null;
  return numberValue;
}
