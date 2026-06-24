import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";
import { PhoneShell } from "@/components/phone-shell";
import { Card, PageTitle } from "@/components/ui";
import { formatShortDate } from "@/lib/date";
import { getTemplateById } from "@/lib/templates";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { TemplateActions } from "./template-actions";

export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOnboardedUser();
  const { id } = await params;
  const template = await getTemplateById(id);

  if (!template) notFound();

  return (
    <PhoneShell>
      <section className="pt-2">
        <Link href="/templates" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-macho-muted">
          <ArrowLeft size={14} />
          一覧へ戻る
        </Link>
        <PageTitle>
          テンプレート<span className="text-macho-lime">詳細</span>
        </PageTitle>
      </section>

      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">{template.name}</p>
            <p className="mt-1 text-xs text-macho-muted">{formatShortDate(template.created_at.slice(0, 10))}</p>
          </div>
          <span className="rounded-full border border-macho-lime bg-macho-lime/10 px-2.5 py-1 text-[11px] font-semibold text-macho-lime">
            {template.source === "ai_suggestion" ? "AI提案" : "手動"}
          </span>
        </div>
      </Card>

      <section className="mt-3 space-y-2.5">
        {template.template_exercises.map((exercise) => (
          <Card key={exercise.id}>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-9 w-1 shrink-0 rounded-full bg-macho-lime" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{exercise.exercise_name}</p>
                <p className="mt-0.5 text-xs text-macho-muted">
                  {exercise.muscle_groups?.name ?? "部位なし"} ・ {exercise.equipment?.name ?? "器具なし"}
                </p>
                <p className="mt-1 text-xs font-medium text-macho-lime">
                  {exercise.target_sets ?? 1}set x {exercise.target_reps ?? 1}回
                  {exercise.target_weight_kg !== null ? ` @ ${Number(exercise.target_weight_kg)}kg` : ""}
                </p>
                {exercise.notes && <p className="mt-1 text-xs text-macho-muted">{exercise.notes}</p>}
              </div>
            </div>
          </Card>
        ))}
      </section>

      <div className="mt-4 space-y-2">
        <Link
          href={`/record?template_id=${template.id}`}
          className="flex w-full items-center justify-center rounded-[14px] bg-macho-lime p-[15px] text-[15px] font-semibold text-macho-black transition hover:opacity-90"
        >
          <Play size={16} className="mr-1" />
          このメニューで記録開始
        </Link>
        <TemplateActions templateId={template.id} />
      </div>
    </PhoneShell>
  );
}
