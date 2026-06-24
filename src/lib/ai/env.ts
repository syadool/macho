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

export function getMonthlyCallLimit() {
  return Number(process.env.MONTHLY_AI_CALL_LIMIT ?? 3000);
}

export function getCacheTtlHours() {
  return Number(process.env.AI_CACHE_TTL_HOURS ?? 1);
}

export function getAIMaxTokens() {
  return Number(process.env.AI_MAX_TOKENS ?? 1000);
}
