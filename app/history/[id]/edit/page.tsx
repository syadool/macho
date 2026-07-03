import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BottomNav, PageTitle } from "@/components/ui";
import { PhoneShell } from "@/components/phone-shell";
import { getMasterData, getWorkoutById } from "@/lib/data";
import { toJstDateInputValue } from "@/lib/date";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { getExerciseHistory } from "@/lib/workouts";
import { EditWorkoutForm } from "./edit-workout-form";

export const dynamic = "force-dynamic";

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOnboardedUser();
  const { id } = await params;
  const [masterData, workout, exerciseHistory] = await Promise.all([
    getMasterData(),
    getWorkoutById(id),
    getExerciseHistory(),
  ]);

  if (!workout) notFound();

  return (
    <PhoneShell nav={<BottomNav active="history" />}>
      <section className="pt-2">
        <Link href="/history" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-macho-muted">
          <ArrowLeft size={14} />
          履歴へ戻る
        </Link>
        <PageTitle>
          記録<span className="text-macho-lime">編集</span>
        </PageTitle>
      </section>

      <EditWorkoutForm
        workout={workout}
        muscleGroups={masterData.muscleGroups}
        equipment={masterData.equipment}
        exerciseHistory={exerciseHistory}
        maxDate={toJstDateInputValue()}
      />
    </PhoneShell>
  );
}
