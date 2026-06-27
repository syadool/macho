import crypto from "node:crypto";
import type { ChatCompletion } from "openai/resources/chat/completions";
import {
  getAIMaxTokens,
  getAILimitsForTier,
  getCacheTtlHours,
  getMonthlyCallLimit,
  getOpenAIModel,
  getPendingReservationTtlMinutes,
} from "@/lib/ai/env";
import { getOpenAIClient } from "@/lib/ai/client";
import { type AiSuggestionPayload, validateSuggestionPayload } from "@/lib/ai/suggestion-validation";
import { SUGGESTION_RESPONSE_SCHEMA, buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { getEntitledSubscriptionTier } from "@/lib/billing/plans";
import { getMasterData, getWorkouts } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiOnboardedUser } from "@/lib/supabase/server";
import { toDateInputValue } from "@/lib/date";
import type { AIUsage, SubscriptionTier, SuggestionResult, Workout } from "@/lib/types";

export type GenerateSuggestionInput = {
  targetMuscleGroupIds: string[];
  theme: string | null;
  forceRegenerate?: boolean;
};

export type GenerateSuggestionResult =
  | { kind: "success"; payload: SuggestionResult }
  | { kind: "cached"; payload: SuggestionResult }
  | { kind: "unauthorized" }
  | { kind: "not_onboarded" }
  | { kind: "forbidden" }
  | { kind: "invalid_input"; message: string }
  | { kind: "rate_limited"; resetAt: string; scope: "daily" | "monthly" | "global" }
  | { kind: "error"; message: string };

type LogStatus = "pending" | "success" | "cached" | "rate_limited" | "forbidden" | "error";

type LogInsertInput = {
  userId: string;
  inputHash: string;
  requestPayload: Record<string, unknown>;
  responsePayload?: AiSuggestionPayload | null;
  status: LogStatus;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  costUsd?: number | null;
};

type LogUpdateInput = {
  responsePayload?: AiSuggestionPayload | null;
  status?: LogStatus;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  costUsd?: number | null;
};

type OpenAIUsageSnapshot = Pick<
  LogUpdateInput,
  "promptTokens" | "completionTokens" | "totalTokens" | "costUsd"
>;

export async function generateSuggestion(input: GenerateSuggestionInput): Promise<GenerateSuggestionResult> {
  const auth = await requireApiOnboardedUser();
  if (!auth.ok) return auth.status === 401 ? { kind: "unauthorized" } : { kind: "not_onboarded" };

  const { user, profile } = auth;
  const sanitizedInput = {
    targetMuscleGroupIds: input.targetMuscleGroupIds.filter((id) => typeof id === "string" && id.length > 0),
    theme: input.theme?.trim() ? input.theme.trim().slice(0, 120) : null,
  };
  const inputHash = createInputHash(user.id, sanitizedInput);
  const requestPayload = {
    target_muscle_group_ids: sanitizedInput.targetMuscleGroupIds,
    theme: sanitizedInput.theme,
  };
  let reservedLogId: string | null = null;
  let billedUsage: OpenAIUsageSnapshot | null = null;

  try {
    if (!profile?.ai_suggestion_enabled) {
      await insertLog({ userId: user.id, inputHash, requestPayload, status: "forbidden" }).catch(() => undefined);
      return { kind: "forbidden" };
    }

    const { muscleGroups, equipment } = await getMasterData();
    const validMuscleIds = new Set(muscleGroups.map((group) => group.id));
    if (sanitizedInput.targetMuscleGroupIds.some((id) => !validMuscleIds.has(id))) {
      return { kind: "invalid_input", message: "指定された部位が見つかりません。" };
    }

    const entitlementTier = getEntitledSubscriptionTier(profile.subscription_tier, profile.subscription_status);
    const reservation = await reserveUsageSlot(user.id, inputHash, requestPayload, entitlementTier);
    if (reservation.kind === "rate_limited") return reservation;
    reservedLogId = reservation.logId;

    const cached = input.forceRegenerate
      ? null
      : await findCachedSuggestion(user.id, inputHash, reservedLogId, entitlementTier);
    if (cached) return { kind: "cached", payload: cached };

    const workouts = await getWorkouts(20);
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

    const maxCompletionTokens = getAIMaxTokens();
    const response = await getOpenAIClient().chat.completions.create({
      model: getOpenAIModel(),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "workout_suggestion",
          schema: SUGGESTION_RESPONSE_SCHEMA,
          strict: true,
        },
      },
      reasoning_effort: "low",
      verbosity: "low",
      max_completion_tokens: maxCompletionTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const choice = response.choices[0];
    const promptTokens = response.usage?.prompt_tokens ?? null;
    const completionTokens = response.usage?.completion_tokens ?? null;
    const totalTokens = response.usage?.total_tokens ?? null;
    const costUsd = estimateCost(promptTokens, completionTokens);
    billedUsage = { promptTokens, completionTokens, totalTokens, costUsd };
    const content = extractMessageContent(choice?.message?.content);
    if (!content) throw new Error(buildEmptyOpenAIResponseMessage(choice, maxCompletionTokens));

    const payload = validateSuggestionPayload(JSON.parse(content) as unknown, muscleGroups, equipment, {
      targetMuscleGroupIds: sanitizedInput.targetMuscleGroupIds,
    });
    await updateLog(reservedLogId, user.id, {
      responsePayload: payload,
      status: "success",
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
    });
    const usage = await getRemainingUsage(user.id, entitlementTier, "active").catch((usageError) => {
      console.error("Failed to load remaining AI usage after successful suggestion", usageError);
      return buildFallbackUsage(entitlementTier);
    });

    return {
      kind: "success",
      payload: {
        suggestion_id: reservedLogId,
        overall_comment: payload.overall_comment,
        exercises: payload.exercises,
        usage,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI suggestion failed";
    if (reservedLogId) {
      await updateLog(reservedLogId, user.id, {
        status: "error",
        errorMessage: message,
        ...(billedUsage ?? {}),
      }).catch(() => undefined);
    } else {
      await insertLog({
        userId: user.id,
        inputHash,
        requestPayload,
        status: "error",
        errorMessage: message,
      }).catch(() => undefined);
    }
    return { kind: "error", message };
  }
}

function createInputHash(userId: string, input: GenerateSuggestionInput) {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${[...input.targetMuscleGroupIds].sort().join(",")}:${input.theme ?? ""}`)
    .digest("hex");
}

async function reserveUsageSlot(
  userId: string,
  inputHash: string,
  requestPayload: Record<string, unknown>,
  tier: SubscriptionTier,
): Promise<{ kind: "reserved"; logId: string } | Extract<GenerateSuggestionResult, { kind: "rate_limited" }>> {
  const { daily: dailyLimit, monthly: monthlyLimit } = getAILimitsForTier(tier);
  const globalLimit = getMonthlyCallLimit();
  const usageWindow = getJstUsageWindow();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reserve_ai_suggestion_slot", {
    p_user_id: userId,
    p_input_hash: inputHash,
    p_request_payload: requestPayload,
    p_daily_limit: dailyLimit,
    p_monthly_limit: monthlyLimit,
    p_global_limit: globalLimit,
    p_pending_since: new Date(Date.now() - getPendingReservationTtlMinutes() * 60 * 1000).toISOString(),
    p_day_start: usageWindow.startOfDay.toISOString(),
    p_month_start: usageWindow.startOfMonth.toISOString(),
  });

  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { log_id?: string; rate_limited_scope?: "daily" | "monthly" | "global" | null }
    | null;
  if (!row?.log_id) throw new Error("Failed to reserve AI usage slot");

  if (row.rate_limited_scope === "daily") {
    return { kind: "rate_limited", resetAt: usageWindow.nextDay.toISOString(), scope: "daily" };
  }

  if (row.rate_limited_scope === "monthly") {
    return { kind: "rate_limited", resetAt: usageWindow.nextMonth.toISOString(), scope: "monthly" };
  }

  if (row.rate_limited_scope === "global") {
    return { kind: "rate_limited", resetAt: usageWindow.nextMonth.toISOString(), scope: "global" };
  }

  return { kind: "reserved", logId: row.log_id };
}

async function findCachedSuggestion(
  userId: string,
  inputHash: string,
  reservedLogId: string,
  tier: SubscriptionTier,
) {
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
  await updateLog(reservedLogId, userId, {
    responsePayload: payload,
    status: "cached",
    costUsd: 0,
  });
  const usage = await getRemainingUsage(userId, tier, "active");

  return {
    suggestion_id: reservedLogId,
    overall_comment: payload.overall_comment,
    exercises: payload.exercises,
    usage,
  };
}

async function countLogs(input: { userId?: string; since: string; statuses: LogStatus[] }): Promise<number> {
  if (input.statuses.includes("pending") && input.statuses.length > 1) {
    const stableStatuses = input.statuses.filter((status) => status !== "pending");
    const pendingSince = new Date(Date.now() - getPendingReservationTtlMinutes() * 60 * 1000).toISOString();
    const [stableCount, pendingCount] = await Promise.all([
      stableStatuses.length > 0 ? countLogs({ ...input, statuses: stableStatuses }) : 0,
      countLogs({
        ...input,
        since: pendingSince > input.since ? pendingSince : input.since,
        statuses: ["pending"],
      }),
    ]);
    return stableCount + pendingCount;
  }

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

async function updateLog(id: string, userId: string, input: LogUpdateInput) {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if ("responsePayload" in input) patch.response_payload = input.responsePayload ?? null;
  if ("promptTokens" in input) patch.prompt_tokens = input.promptTokens ?? null;
  if ("completionTokens" in input) patch.completion_tokens = input.completionTokens ?? null;
  if ("totalTokens" in input) patch.total_tokens = input.totalTokens ?? null;
  if ("costUsd" in input) patch.cost_usd = input.costUsd ?? null;
  if ("status" in input) patch.status = input.status;
  if ("errorMessage" in input) patch.error_message = input.errorMessage ?? null;

  const { error } = await admin
    .from("ai_suggestion_logs")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function getRemainingUsage(
  userId: string,
  tier?: SubscriptionTier,
  status?: "active" | "past_due" | "canceled" | "none",
): Promise<AIUsage> {
  const activeTier = tier ? getEntitledSubscriptionTier(tier, status ?? "active") : await getEntitledTierForUser(userId);
  const { daily: dailyLimit, monthly: monthlyLimit } = getAILimitsForTier(activeTier);
  const usageWindow = getJstUsageWindow();
  const [dailyCount, monthlyCount] = await Promise.all([
    countUsageLogs({ userId, since: usageWindow.startOfDay.toISOString() }),
    countUsageLogs({ userId, since: usageWindow.startOfMonth.toISOString() }),
  ]);

  return {
    used_today: dailyCount,
    limit_today: dailyLimit,
    remaining_today: Math.max(0, dailyLimit - dailyCount),
    used_this_month: monthlyCount,
    limit_this_month: monthlyLimit,
    remaining_this_month: Math.max(0, monthlyLimit - monthlyCount),
    reset_at: usageWindow.nextMonth.toISOString(),
  };
}

async function getEntitledTierForUser(userId: string): Promise<SubscriptionTier> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_profiles")
    .select("subscription_tier,subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const profile = data as { subscription_tier?: SubscriptionTier | null; subscription_status?: "active" | "past_due" | "canceled" | "none" | null } | null;
  return getEntitledSubscriptionTier(profile?.subscription_tier ?? "free", profile?.subscription_status ?? "none");
}

async function countUsageLogs(input: { userId: string; since: string }) {
  const [regularCount, chargedErrorCount] = await Promise.all([
    countLogs({ userId: input.userId, since: input.since, statuses: ["success", "cached", "pending"] }),
    countChargedErrorLogs({ userId: input.userId, since: input.since }),
  ]);
  return regularCount + chargedErrorCount;
}

async function countChargedErrorLogs(input: { userId: string; since: string }) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("ai_suggestion_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("status", "error")
    .gte("created_at", input.since)
    .not("total_tokens", "is", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

function buildFallbackUsage(tier: SubscriptionTier): AIUsage {
  const { daily, monthly } = getAILimitsForTier(tier);
  return {
    used_today: daily,
    limit_today: daily,
    remaining_today: 0,
    used_this_month: monthly,
    limit_this_month: monthly,
    remaining_this_month: 0,
    reset_at: getJstUsageWindow().nextMonth.toISOString(),
  };
}

function getJstUsageWindow() {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const startOfDayJst = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - 9 * 60 * 60 * 1000;
  const startOfMonthJst = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1) - 9 * 60 * 60 * 1000;
  const nextDayJst = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + 1) - 9 * 60 * 60 * 1000;
  const nextMonthJst = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth() + 1, 1) - 9 * 60 * 60 * 1000;

  return {
    startOfDay: new Date(startOfDayJst),
    startOfMonth: new Date(startOfMonthJst),
    nextDay: new Date(nextDayJst),
    nextMonth: new Date(nextMonthJst),
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
            return `${sanitizePromptText(exercise.exercise_name)} ${exercise.duration_minutes ?? 0}分`;
          }

          const firstSet = exercise.workout_sets[0];
          const setText = firstSet ? `${Number(firstSet.weight_kg)}kg x ${firstSet.reps} x ${exercise.workout_sets.length}set` : "セットなし";
          return `${sanitizePromptText(exercise.exercise_name)} ${setText}`;
        })
        .join(", ");

      return `${workout.date}: ${exercises}`;
    });

  return lines.join("\n");
}

function sanitizePromptText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 120);
}

function extractMessageContent(content: unknown) {
  if (typeof content === "string") return content.trim() || null;
  if (!Array.isArray(content)) return null;

  const text = content
    .map((part) => {
      if (!isRecord(part)) return "";
      return typeof part.text === "string" ? part.text : "";
    })
    .join("")
    .trim();

  return text || null;
}

function buildEmptyOpenAIResponseMessage(
  choice: ChatCompletion.Choice | undefined,
  maxCompletionTokens: number,
) {
  if (!choice) return "OpenAI response did not include a choice";
  const refusal = choice.message.refusal?.trim();
  if (refusal) return `OpenAI refused the request: ${refusal}`;
  if (choice.finish_reason === "length") {
    return `OpenAI response was truncated before JSON output. Increase AI_MAX_TOKENS above ${maxCompletionTokens}.`;
  }
  if (choice.finish_reason === "content_filter") return "OpenAI response was blocked by the content filter";
  return `OpenAI response is empty (finish_reason: ${choice.finish_reason})`;
}

function estimateCost(promptTokens: number | null, completionTokens: number | null) {
  if (promptTokens === null || completionTokens === null) return null;
  return (promptTokens * 0.25 + completionTokens * 2.0) / 1_000_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
