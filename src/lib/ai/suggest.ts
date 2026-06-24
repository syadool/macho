import crypto from "node:crypto";
import { getAIMaxTokens, getAIRateLimitPerDay, getAIRateLimitPerMonth, getCacheTtlHours, getMonthlyCallLimit, getOpenAIModel } from "@/lib/ai/env";
import { getOpenAIClient } from "@/lib/ai/client";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { getMasterData, getWorkouts } from "@/lib/data";
import { getUserProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { toDateInputValue } from "@/lib/date";
import type { Equipment, MuscleGroup, SuggestionExercise, SuggestionResult, Workout } from "@/lib/types";

export type GenerateSuggestionInput = {
  targetMuscleGroupIds: string[];
  theme: string | null;
};

export type GenerateSuggestionResult =
  | { kind: "success"; payload: SuggestionResult }
  | { kind: "cached"; payload: SuggestionResult }
  | { kind: "forbidden" }
  | { kind: "rate_limited"; resetAt: string; scope: "daily" | "monthly" | "global" }
  | { kind: "error"; message: string };

type AiSuggestionPayload = {
  overall_comment: string;
  exercises: SuggestionExercise[];
};

type LogInsertInput = {
  userId: string;
  inputHash: string;
  requestPayload: Record<string, unknown>;
  responsePayload?: AiSuggestionPayload | null;
  status: "success" | "cached" | "rate_limited" | "forbidden" | "error";
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  costUsd?: number | null;
};

export async function generateSuggestion(input: GenerateSuggestionInput): Promise<GenerateSuggestionResult> {
  const { user } = await requireOnboardedUser();
  const sanitizedInput = {
    targetMuscleGroupIds: input.targetMuscleGroupIds.filter((id) => typeof id === "string" && id.length > 0),
    theme: input.theme?.trim() ? input.theme.trim().slice(0, 120) : null,
  };
  const inputHash = createInputHash(user.id, sanitizedInput);
  const requestPayload = {
    target_muscle_group_ids: sanitizedInput.targetMuscleGroupIds,
    theme: sanitizedInput.theme,
  };

  try {
    const profile = await getUserProfile();
    if (!profile?.ai_suggestion_enabled) {
      await insertLog({ userId: user.id, inputHash, requestPayload, status: "forbidden" });
      return { kind: "forbidden" };
    }

    const limits = await checkLimits(user.id, inputHash, requestPayload);
    if (limits) return limits;

    const cached = await findCachedSuggestion(user.id, inputHash, requestPayload);
    if (cached) return { kind: "cached", payload: cached };

    const [{ muscleGroups, equipment }, workouts] = await Promise.all([getMasterData(), getWorkouts(20)]);
    const recentWorkoutsSummary = buildRecentWorkoutsSummary(workouts);
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      profile,
      targetMuscleGroupIds: sanitizedInput.targetMuscleGroupIds,
      theme: sanitizedInput.theme,
      recentWorkoutsSummary,
      muscleGroups,
      equipment,
    });

    const response = await getOpenAIClient().chat.completions.create({
      model: getOpenAIModel(),
      response_format: { type: "json_object" },
      max_tokens: getAIMaxTokens(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI response is empty");

    const payload = validateSuggestionPayload(JSON.parse(content) as unknown, muscleGroups, equipment);
    const promptTokens = response.usage?.prompt_tokens ?? null;
    const completionTokens = response.usage?.completion_tokens ?? null;
    const totalTokens = response.usage?.total_tokens ?? null;
    const costUsd = estimateCost(promptTokens, completionTokens);
    const logId = await insertLog({
      userId: user.id,
      inputHash,
      requestPayload,
      responsePayload: payload,
      status: "success",
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
    });
    const usage = await getRemainingUsage(user.id);

    return {
      kind: "success",
      payload: {
        suggestion_id: logId,
        overall_comment: payload.overall_comment,
        exercises: payload.exercises,
        usage,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI suggestion failed";
    await insertLog({
      userId: user.id,
      inputHash,
      requestPayload,
      status: "error",
      errorMessage: message,
    }).catch(() => undefined);
    return { kind: "error", message };
  }
}

function createInputHash(userId: string, input: GenerateSuggestionInput) {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${[...input.targetMuscleGroupIds].sort().join(",")}:${input.theme ?? ""}`)
    .digest("hex");
}

async function checkLimits(
  userId: string,
  inputHash: string,
  requestPayload: Record<string, unknown>,
): Promise<Extract<GenerateSuggestionResult, { kind: "rate_limited" }> | null> {
  const dailyLimit = getAIRateLimitPerDay();
  const monthlyLimit = getAIRateLimitPerMonth();
  const globalLimit = getMonthlyCallLimit();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

  const [dailyCount, monthlyCount, globalCount] = await Promise.all([
    countLogs({ userId, since: startOfDay.toISOString(), statuses: ["success", "cached"] }),
    countLogs({ userId, since: startOfMonth.toISOString(), statuses: ["success", "cached"] }),
    countLogs({ since: startOfMonth.toISOString(), statuses: ["success"] }),
  ]);

  if (dailyCount >= dailyLimit) {
    const resetAt = new Date(startOfDay);
    resetAt.setDate(resetAt.getDate() + 1);
    await insertLog({ userId, inputHash, requestPayload, status: "rate_limited" });
    return { kind: "rate_limited", resetAt: resetAt.toISOString(), scope: "daily" };
  }

  if (monthlyCount >= monthlyLimit) {
    const resetAt = new Date(startOfMonth);
    resetAt.setMonth(resetAt.getMonth() + 1);
    await insertLog({ userId, inputHash, requestPayload, status: "rate_limited" });
    return { kind: "rate_limited", resetAt: resetAt.toISOString(), scope: "monthly" };
  }

  if (globalCount >= globalLimit) {
    const resetAt = new Date(startOfMonth);
    resetAt.setMonth(resetAt.getMonth() + 1);
    await insertLog({ userId, inputHash, requestPayload, status: "rate_limited" });
    return { kind: "rate_limited", resetAt: resetAt.toISOString(), scope: "global" };
  }

  return null;
}

async function findCachedSuggestion(userId: string, inputHash: string, requestPayload: Record<string, unknown>) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - getCacheTtlHours() * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("ai_suggestion_logs")
    .select("response_payload")
    .eq("user_id", userId)
    .eq("input_hash", inputHash)
    .eq("status", "success")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.response_payload) return null;

  const payload = data.response_payload as AiSuggestionPayload;
  const logId = await insertLog({
    userId,
    inputHash,
    requestPayload,
    responsePayload: payload,
    status: "cached",
    costUsd: 0,
  });
  const usage = await getRemainingUsage(userId);

  return {
    suggestion_id: logId,
    overall_comment: payload.overall_comment,
    exercises: payload.exercises,
    usage,
  };
}

async function countLogs(input: { userId?: string; since: string; statuses: string[] }) {
  const admin = createAdminClient();
  let query = admin
    .from("ai_suggestion_logs")
    .select("id", { count: "exact", head: true })
    .in("status", input.statuses)
    .gte("created_at", input.since);

  if (input.userId) query = query.eq("user_id", input.userId);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function insertLog(input: LogInsertInput) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_suggestion_logs")
    .insert({
      user_id: input.userId,
      input_hash: input.inputHash,
      request_payload: input.requestPayload,
      response_payload: input.responsePayload ?? null,
      prompt_tokens: input.promptTokens ?? null,
      completion_tokens: input.completionTokens ?? null,
      total_tokens: input.totalTokens ?? null,
      cost_usd: input.costUsd ?? null,
      status: input.status,
      error_message: input.errorMessage ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

async function getRemainingUsage(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  const [dailyCount, monthlyCount] = await Promise.all([
    countLogs({ userId, since: startOfDay.toISOString(), statuses: ["success", "cached"] }),
    countLogs({ userId, since: startOfMonth.toISOString(), statuses: ["success", "cached"] }),
  ]);

  return {
    remaining_today: Math.max(0, getAIRateLimitPerDay() - dailyCount),
    remaining_this_month: Math.max(0, getAIRateLimitPerMonth() - monthlyCount),
  };
}

function buildRecentWorkoutsSummary(workouts: Workout[]) {
  const threshold = toDateInputValue(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
  const lines = workouts
    .filter((workout) => workout.date >= threshold)
    .map((workout) => {
      const exercises = workout.workout_exercises
        .map((exercise) => {
          if (exercise.exercise_type === "cardio") {
            return `${exercise.exercise_name} ${exercise.duration_minutes ?? 0}分`;
          }

          const firstSet = exercise.workout_sets[0];
          const setText = firstSet ? `${Number(firstSet.weight_kg)}kg x ${firstSet.reps} x ${exercise.workout_sets.length}set` : "セットなし";
          return `${exercise.exercise_name} ${setText}`;
        })
        .join(", ");

      return `${workout.date}: ${exercises}`;
    });

  return lines.join("\n");
}

function validateSuggestionPayload(raw: unknown, muscleGroups: MuscleGroup[], equipment: Equipment[]): AiSuggestionPayload {
  if (!isRecord(raw)) throw new Error("AI response must be an object");
  const overallComment = typeof raw.overall_comment === "string" ? raw.overall_comment : "";
  const rawExercises = Array.isArray(raw.exercises) ? raw.exercises : [];

  if (rawExercises.length < 3 || rawExercises.length > 5) {
    throw new Error("AI response must include 3 to 5 exercises");
  }

  const muscleIds = new Set(muscleGroups.map((group) => group.id));
  const subGroupIds = new Set(muscleGroups.flatMap((group) => group.muscle_sub_groups ?? []).map((group) => group.id));
  const equipmentIds = new Set(equipment.map((item) => item.id));

  const exercises = rawExercises.map((exercise, index) => {
    if (!isRecord(exercise)) throw new Error(`Exercise ${index + 1} must be an object`);
    const exerciseName = readString(exercise.exercise_name, `Exercise ${index + 1} name is required`);
    const muscleGroupId = readString(exercise.muscle_group_id, `Exercise ${index + 1} muscle group is required`);
    const muscleSubGroupId = readNullableString(exercise.muscle_sub_group_id);
    const equipmentId = readNullableString(exercise.equipment_id);
    const targetSets = readPositiveInteger(exercise.target_sets, `Exercise ${index + 1} sets must be positive`);
    const targetReps = readPositiveInteger(exercise.target_reps, `Exercise ${index + 1} reps must be positive`);
    const targetWeightKg = readNullableNumber(exercise.target_weight_kg);
    const notes = readNullableString(exercise.notes);

    if (!muscleIds.has(muscleGroupId)) throw new Error(`Unknown muscle_group_id: ${muscleGroupId}`);
    if (muscleSubGroupId && !subGroupIds.has(muscleSubGroupId)) throw new Error(`Unknown muscle_sub_group_id: ${muscleSubGroupId}`);
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

  return {
    overall_comment: overallComment || "次回メニューを提案しました。",
    exercises,
  };
}

function estimateCost(promptTokens: number | null, completionTokens: number | null) {
  if (promptTokens === null || completionTokens === null) return null;
  return (promptTokens * 0.25 + completionTokens * 2.0) / 1_000_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(message);
  return value.trim();
}

function readNullableString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function readPositiveInteger(value: unknown, message: string) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) throw new Error(message);
  return numberValue;
}

function readNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}
