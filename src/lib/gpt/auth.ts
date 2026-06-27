import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function hashGptApiKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type GptAuthContext = {
  userId: string;
  keyHash: string;
};

export async function authenticateGptRequest(req: Request): Promise<GptAuthContext | null> {
  const auth = req.headers.get("authorization");
  const token = auth?.match(/^Bearer (.+)$/)?.[1];
  if (!token?.startsWith("macho_")) return null;

  const keyHash = hashGptApiKey(token);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("user_id")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data?.user_id) return null;

  const { error: updateError } = await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash);

  if (updateError) {
    console.error("Failed to update GPT API key last_used_at", updateError);
  }

  return {
    userId: data.user_id as string,
    keyHash,
  };
}
