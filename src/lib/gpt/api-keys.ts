import { randomBytes } from "crypto";
import { hashGptApiKey } from "@/lib/gpt/auth";
import { requireOnboardedUser } from "@/lib/supabase/server";

const MAX_GPT_API_KEYS_PER_USER = 5;

export type ApiKeySummary = {
  id: string;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
};

export async function listGptApiKeys() {
  const { supabase, user } = await requireOnboardedUser();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id,key_prefix,name,created_at,last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as ApiKeySummary[] | null) ?? [];
}

export async function createGptApiKey(name: string) {
  const { supabase, user } = await requireOnboardedUser();
  const { count, error: countError } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= MAX_GPT_API_KEYS_PER_USER) {
    throw new Error("GPT_API_KEY_LIMIT_EXCEEDED");
  }

  const token = `macho_${randomBytes(16).toString("hex")}`;
  const normalizedName = normalizeApiKeyName(name);
  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    key_hash: hashGptApiKey(token),
    key_prefix: token.slice(0, 12),
    name: normalizedName,
  });

  if (error) throw new Error(error.message);
  return token;
}

export async function revokeGptApiKey(id: string) {
  const { supabase, user } = await requireOnboardedUser();
  const { error } = await supabase.from("api_keys").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

function normalizeApiKeyName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "ChatGPT";
  return trimmed.slice(0, 40);
}
