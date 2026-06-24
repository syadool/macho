import OpenAI from "openai";
import { getOpenAIApiKey } from "@/lib/ai/env";

export function getOpenAIClient() {
  return new OpenAI({ apiKey: getOpenAIApiKey() });
}
