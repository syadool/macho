import type { SubscriptionTier } from "@/lib/types";

export function getOpenAIApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL ?? "gpt-5-mini";
}

export function getAIRateLimitPerDay() {
  return Number(process.env.AI_RATE_LIMIT_PER_DAY ?? 10);
}

export function getAIRateLimitPerMonth() {
  return Number(process.env.AI_RATE_LIMIT_PER_MONTH ?? 100);
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
  return Number(process.env.MONTHLY_AI_CALL_LIMIT ?? 3000);
}

export function getCacheTtlHours() {
  return Number(process.env.AI_CACHE_TTL_HOURS ?? 1);
}

export function getAIMaxTokens() {
  return Math.max(Number(process.env.AI_MAX_TOKENS ?? 3000), 3000);
}
