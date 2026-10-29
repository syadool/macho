import { requireOnboardedUser } from "@/lib/auth/session";
import { deleteTemplate as removeTemplate, getTemplate, listTemplates } from "@/lib/db/templates";
import type { TemplateSource } from "@/lib/types";

export async function getTemplates(source?: TemplateSource) {
  const { user } = await requireOnboardedUser();
  return listTemplates(user.id, source);
}

export async function getTemplateById(id: string) {
  const { user } = await requireOnboardedUser();
  return getTemplate(user.id, id);
}

export async function deleteTemplate(id: string) {
  const { user } = await requireOnboardedUser();
  await removeTemplate(user.id, id);
}
