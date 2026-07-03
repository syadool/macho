import Link from "next/link";
import { Pencil } from "lucide-react";
import { BottomNav, Card, Pill, PageTitle } from "@/components/ui";
import { PhoneShell } from "@/components/phone-shell";
import { getMasterData, getWorkouts } from "@/lib/data";
import { formatHistoryDate } from "@/lib/date";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { formatSetsSummary } from "@/lib/sets";
import {
  isCardioExercise,
  primaryMuscle,
  workoutCardioMinutes,
  workoutSetCount,
  workoutTitle,
  workoutVolume,
} from "@/lib/workouts";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ muscle?: string }>;
}) {
  await requireOnboardedUser();
  const [{ muscleGroups }, workouts] = await Promise.all([getMasterData(), getWorkouts(50)]);
  const { muscle } = await searchParams;
  const filteredWorkouts =
    muscle === "cardio"
      ? workouts.filter((workout) => workout.workout_exercises.some(isCardioExercise))
      : muscle && muscle !== "all"
      ? workouts.filter((workout) => workout.workout_exercises.some((exercise) => exercise.muscle_groups?.id === muscle))
      : workouts;

  return (
    <PhoneShell nav={<BottomNav active="history" />}>
      <section className="pt-2">
        <PageTitle>
          トレーニング<span className="text-macho-lime">履歴</span>
        </PageTitle>
      </section>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <Link href="/history" className="shrink-0">
          <Pill active={!muscle || muscle === "all"}>全て</Pill>
        </Link>
        <Link href="/history?muscle=cardio" className="shrink-0">
          <Pill active={muscle === "cardio"}>有酸素</Pill>
        </Link>
        {muscleGroups.map((group) => (
          <Link key={group.id} href={`/history?muscle=${group.id}`} className="shrink-0">
            <Pill active={muscle === group.id}>{group.name}</Pill>
          </Link>
        ))}
      </div>

      <section className="mt-[18px]">
        {filteredWorkouts.map((workout) => {
          const muscle = primaryMuscle(workout);
          return (
            <div key={workout.id}>
              <p className="mb-2 text-xs font-medium text-macho-muted">{formatHistoryDate(workout.date)}</p>
              <Card className="mb-3.5">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: muscle?.color ?? "#D4FF00" }} />
                  <p className="flex-1 text-sm font-medium">{workoutTitle(workout)}</p>
                  <Link
                    href={`/history/${workout.id}/edit`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-macho-border text-macho-muted transition hover:border-macho-lime hover:text-macho-lime"
                    aria-label="記録を編集"
                  >
                    <Pencil size={14} />
                  </Link>
                </div>

                <div className="ml-[3px] border-l-2 border-macho-border pl-3.5">
                  {workout.workout_exercises.map((exercise) => (
                    <div key={exercise.id} className="mb-2.5 last:mb-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px]">{exercise.exercise_name}</p>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {exercise.muscle_sub_groups?.map((subGroup) => (
                            <span key={subGroup.id} className="rounded-lg bg-macho-lime/10 px-2 py-0.5 text-[11px] text-macho-lime">
                              {subGroup.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-macho-lime">
                        {isCardioExercise(exercise) ? describeCardio(exercise) : formatSetsSummary(exercise.workout_sets)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-between border-t border-macho-border pt-2.5 text-xs text-macho-muted">
                  <span>合計 {workoutSetCount(workout)}set</span>
                  <span>
                    {workoutCardioMinutes(workout) > 0
                      ? `${workoutCardioMinutes(workout)}分`
                      : `総ボリューム ${workoutVolume(workout).toLocaleString()}kg`}
                  </span>
                </div>
              </Card>
            </div>
          );
        })}

        {filteredWorkouts.length === 0 && (
          <Card className="text-center">
            <p className="text-sm font-medium">履歴がありません</p>
            <p className="mt-1 text-xs text-macho-muted">条件に一致するワークアウトはまだありません。</p>
          </Card>
        )}
      </section>
    </PhoneShell>
  );
}

function describeCardio(exercise: { duration_minutes: number | null }) {
  return exercise.duration_minutes ? `${exercise.duration_minutes}分` : "有酸素";
}
