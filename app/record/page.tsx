import { BottomNav, PageTitle } from "@/components/ui";
import { PhoneShell } from "@/components/phone-shell";
import { getMasterData } from "@/lib/data";
import { toJstDateInputValue } from "@/lib/date";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { getTemplateById } from "@/lib/templates";
import { getExerciseHistory } from "@/lib/exercise-history";
import { RecordForm } from "./record-form";

export const dynamic = "force-dynamic";

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ template_id?: string }>;
}) {
  await requireOnboardedUser();
  const { template_id: templateId } = await searchParams;
  const [{ muscleGroups, equipment }, template, exerciseHistory] = await Promise.all([
    getMasterData(),
    templateId ? getTemplateById(templateId) : Promise.resolve(null),
    getExerciseHistory(),
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
        initialDate={toJstDateInputValue()}
        exerciseHistory={exerciseHistory}
      />
    </PhoneShell>
  );
}
