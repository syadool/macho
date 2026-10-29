import { randomBytes } from "crypto";
import { requireOnboardedUser } from "@/lib/auth/session";
import { countApiKeys, deleteApiKey, insertApiKey, listApiKeys } from "@/lib/db/api-keys";
import { hashGptApiKey } from "@/lib/gpt/auth";

export type { ApiKeySummary } from "@/lib/db/api-keys";

const MAX_GPT_API_KEYS_PER_USER = 5;

export async function listGptApiKeys() {
  const { user } = await requireOnboardedUser();
  return listApiKeys(user.id);
}

export async function createGptApiKey(name: string) {
  const { user } = await requireOnboardedUser();
  if ((await countApiKeys(user.id)) >= MAX_GPT_API_KEYS_PER_USER) {
    throw new Error("GPT_API_KEY_LIMIT_EXCEEDED");
  }

  const token = `macho_${randomBytes(16).toString("hex")}`;
  await insertApiKey(user.id, {
    keyHash: hashGptApiKey(token),
    keyPrefix: token.slice(0, 12),
    name: normalizeApiKeyName(name),
  });
  return token;
}

export async function revokeGptApiKey(id: string) {
  const { user } = await requireOnboardedUser();
  await deleteApiKey(user.id, id);
}

function normalizeApiKeyName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "ChatGPT";
  return trimmed.slice(0, 40);
}
