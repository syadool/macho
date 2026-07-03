"use server";

import { revalidatePath } from "next/cache";
import { deleteTemplate } from "@/lib/templates";

export async function deleteTemplateAction(id: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await deleteTemplate(id);
    revalidatePath("/templates");
    return { ok: true };
  } catch (error) {
    console.error("Failed to delete template", error);
    return { ok: false, message: "削除に失敗しました。" };
  }
}
