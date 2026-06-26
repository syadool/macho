import type { Equipment, MuscleGroup, SuggestionExercise } from "@/lib/types";

export type AiSuggestionPayload = {
  overall_comment: string;
  exercises: SuggestionExercise[];
};

export function validateSuggestionPayload(
  raw: unknown,
  muscleGroups: MuscleGroup[],
  equipment: Equipment[],
  options: { targetMuscleGroupIds?: string[] } = {},
): AiSuggestionPayload {
  if (!isRecord(raw)) throw new Error("AI response must be an object");
  const overallComment = readOptionalString(raw.overall_comment, 240) ?? "";
  const rawExercises = Array.isArray(raw.exercises) ? raw.exercises : [];

  if (rawExercises.length < 3 || rawExercises.length > 5) {
    throw new Error("AI response must include 3 to 5 exercises");
  }

  return {
    overall_comment: overallComment || "次回メニューを提案しました。",
    exercises: validateSuggestionExercises(rawExercises, muscleGroups, equipment, options),
  };
}

export function validateSuggestionExercises(
  rawExercises: unknown[],
  muscleGroups: MuscleGroup[],
  equipment: Equipment[],
  options: { targetMuscleGroupIds?: string[] } = {},
) {
  const muscleIds = new Set(muscleGroups.map((group) => group.id));
  const subGroupToMuscleId = new Map(
    muscleGroups.flatMap((group) => (group.muscle_sub_groups ?? []).map((subGroup) => [subGroup.id, group.id] as const)),
  );
  const equipmentIds = new Set(equipment.map((item) => item.id));
  const targetMuscleIds = options.targetMuscleGroupIds ? new Set(options.targetMuscleGroupIds) : null;

  return rawExercises.map((exercise, index) => {
    if (!isRecord(exercise)) throw new Error(`Exercise ${index + 1} must be an object`);
    const exerciseName = readRequiredString(exercise.exercise_name, `Exercise ${index + 1} name is required`, 80);
    const muscleGroupId = readRequiredString(exercise.muscle_group_id, `Exercise ${index + 1} muscle group is required`, 80);
    const muscleSubGroupId = readOptionalString(exercise.muscle_sub_group_id, 80);
    const equipmentId = readOptionalString(exercise.equipment_id, 80);
    const targetSets = readIntegerInRange(exercise.target_sets, 1, 20, `Exercise ${index + 1} sets must be 1 to 20`);
    const targetReps = readIntegerInRange(exercise.target_reps, 1, 200, `Exercise ${index + 1} reps must be 1 to 200`);
    const targetWeightKg = readOptionalNumberInRange(exercise.target_weight_kg, 0, 1000);
    const notes = readOptionalString(exercise.notes, 400);

    if (!muscleIds.has(muscleGroupId)) throw new Error(`Unknown muscle_group_id: ${muscleGroupId}`);
    if (targetMuscleIds && !targetMuscleIds.has(muscleGroupId)) throw new Error(`Unexpected muscle_group_id: ${muscleGroupId}`);
    if (muscleSubGroupId && !subGroupToMuscleId.has(muscleSubGroupId)) throw new Error(`Unknown muscle_sub_group_id: ${muscleSubGroupId}`);
    if (muscleSubGroupId && subGroupToMuscleId.get(muscleSubGroupId) !== muscleGroupId) {
      throw new Error(`muscle_sub_group_id does not belong to muscle_group_id: ${muscleSubGroupId}`);
    }
    if (equipmentId && !equipmentIds.has(equipmentId)) throw new Error(`Unknown equipment_id: ${equipmentId}`);

    return {
      exercise_name: exerciseName,
      muscle_group_id: muscleGroupId,
      muscle_sub_group_id: muscleSubGroupId,
      equipment_id: equipmentId,
      target_sets: targetSets,
      target_reps: targetReps,
      target_weight_kg: targetWeightKg,
      notes,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown, message: string, maxLength: number) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(message);
  return value.trim().slice(0, maxLength);
}

function readOptionalString(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function readIntegerInRange(value: unknown, min: number, max: number, message: string) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) throw new Error(message);
  return numberValue;
}

function readOptionalNumberInRange(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    throw new Error(`Number must be ${min} to ${max}`);
  }
  return numberValue;
}
