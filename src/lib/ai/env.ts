import type { SubscriptionTier } from "@/lib/types";

export function getOpenAIApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL ?? "gpt-5-mini";
}

export function getAILimitsForTier(tier: SubscriptionTier | null | undefined) {
  const limits: Record<SubscriptionTier, { daily: number; monthly: number }> = {
    free: { daily: 5, monthly: 10 },
    go: { daily: 10, monthly: 40 },
    plus: { daily: 20, monthly: 100 },
    pro: { daily: 30, monthly: 200 },
  };

  return limits[tier ?? "free"] ?? limits.free;
}

export function getMonthlyCallLimit() {
  return readIntegerEnv("MONTHLY_AI_CALL_LIMIT", 3000, 1);
}

export function getCacheTtlHours() {
  return readNumberEnv("AI_CACHE_TTL_HOURS", 1, 0);
}

export function getAIMaxTokens() {
  return Math.max(readIntegerEnv("AI_MAX_TOKENS", 3000, 1), 3000);
}

export function getPendingReservationTtlMinutes() {
  return readIntegerEnv("AI_PENDING_RESERVATION_TTL_MINUTES", 15, 1);
}

function readIntegerEnv(name: string, fallback: number, min: number) {
  const value = readNumberEnv(name, fallback, min);
  return Number.isInteger(value) ? value : fallback;
}

function readNumberEnv(name: string, fallback: number, min: number) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < min) return fallback;
  return value;
}
