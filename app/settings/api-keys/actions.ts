"use server";

import { revalidatePath } from "next/cache";
import { createGptApiKey, revokeGptApiKey } from "@/lib/gpt/api-keys";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireOnboardedUser } from "@/lib/supabase/server";

export async function issueGptApiKey(input: { name: string }): Promise<{ ok: boolean; key?: string; message?: string }> {
  try {
    const { user } = await requireOnboardedUser();
    const allowed = await checkRateLimit({ scope: "gpt_api_key_issue", identifier: user.id, limit: 5, windowSeconds: 3600 });
    if (!allowed) return { ok: false, message: "APIキーの発行回数が多すぎます。時間をおいて再度お試しください。" };

    const key = await createGptApiKey(input.name);
    revalidatePath("/settings/api-keys");
    return { ok: true, key };
  } catch (error) {
    console.error("Failed to issue GPT API key", error);
    if (error instanceof Error && error.message === "GPT_API_KEY_LIMIT_EXCEEDED") {
      return { ok: false, message: "APIキーは最大5件まで発行できます。不要なキーを失効してください。" };
    }
    return { ok: false, message: "APIキーの発行に失敗しました。" };
  }
}

export async function deleteGptApiKey(id: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await revokeGptApiKey(id);
    revalidatePath("/settings/api-keys");
    return { ok: true };
  } catch (error) {
    console.error("Failed to revoke GPT API key", error);
    return { ok: false, message: "APIキーの失効に失敗しました。" };
  }
}
