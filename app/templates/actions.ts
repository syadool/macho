"use server";

import { revalidatePath } from "next/cache";
import { createTemplate, deleteTemplate } from "@/lib/templates";
import type { SuggestionExercise } from "@/lib/types";

export async function saveSuggestionAsTemplateAction(input: {
  name: string;
  source_log_id: string;
  exercises: SuggestionExercise[];
}): Promise<{ ok: boolean; templateId?: string; message?: string }> {
  if (!input.name.trim()) return { ok: false, message: "テンプレート名を入力してください。" };
  if (input.exercises.length === 0) return { ok: false, message: "種目がありません。" };

  try {
    const templateId = await createTemplate({
      name: input.name.trim().slice(0, 80),
      source: "ai_suggestion",
      source_log_id: input.source_log_id,
      exercises: input.exercises,
    });
    revalidatePath("/templates");
    return { ok: true, templateId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "保存に失敗しました。" };
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
