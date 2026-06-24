"use server";

import { revalidatePath } from "next/cache";
import { createTemplateFromSuggestion, deleteTemplate } from "@/lib/templates";

export async function saveSuggestionAsTemplateAction(input: {
  name: string;
  suggestion_id: string;
}): Promise<{ ok: boolean; templateId?: string; message?: string }> {
  if (!input.name.trim()) return { ok: false, message: "テンプレート名を入力してください。" };
  if (!input.suggestion_id.trim()) return { ok: false, message: "AI提案が見つかりません。" };

  try {
    const templateId = await createTemplateFromSuggestion({
      name: input.name.trim().slice(0, 80),
      suggestionId: input.suggestion_id,
    });
    revalidatePath("/templates");
    return { ok: true, templateId };
  } catch (error) {
    const message = error instanceof Error && error.message === "AI提案が見つかりません。" ? error.message : "保存に失敗しました。";
    return { ok: false, message };
  }
}

export async function deleteTemplateAction(id: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await deleteTemplate(id);
    revalidatePath("/templates");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "削除に失敗しました。" };
  }
}
