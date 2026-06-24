import { BottomNav, PageTitle } from "@/components/ui";
import { PhoneShell } from "@/components/phone-shell";
import { getMasterData } from "@/lib/data";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { getTemplateById } from "@/lib/templates";
import { RecordForm } from "./record-form";

export const dynamic = "force-dynamic";

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ template_id?: string }>;
}) {
  await requireOnboardedUser();
  const { template_id: templateId } = await searchParams;
  const [{ muscleGroups, equipment }, template] = await Promise.all([
    getMasterData(),
    templateId ? getTemplateById(templateId) : Promise.resolve(null),
  ]);

  return (
    <PhoneShell nav={<BottomNav active="record" />}>
      <section className="pt-2">
        <PageTitle>
          新規<span className="text-macho-lime">記録</span>
        </PageTitle>
      </section>
      <RecordForm
        muscleGroups={muscleGroups}
        equipment={equipment}
        initialTemplateName={template?.name}
        initialExercises={template?.template_exercises}
      />
    </PhoneShell>
  );
}
