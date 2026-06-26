"use server";

import { revalidatePath } from "next/cache";
import { createGptApiKey, revokeGptApiKey } from "@/lib/gpt/api-keys";

export async function issueGptApiKey(input: { name: string }): Promise<{ ok: boolean; key?: string; message?: string }> {
  try {
    const key = await createGptApiKey(input.name);
    revalidatePath("/settings/api-keys");
    return { ok: true, key };
  } catch (error) {
    console.error("Failed to issue GPT API key", error);
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
