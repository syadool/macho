import OpenAI from "openai";
import { getOpenAIApiKey } from "@/lib/ai/env";

export function getOpenAIClient() {
  return new OpenAI({ apiKey: getOpenAIApiKey(), timeout: 30_000, maxRetries: 1 });
}
