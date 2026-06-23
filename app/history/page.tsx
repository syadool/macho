import Link from "next/link";
import { BottomNav, Card, Pill, PageTitle } from "@/components/ui";
import { PhoneShell } from "@/components/phone-shell";
import { getMasterData, getWorkouts } from "@/lib/data";
import { formatHistoryDate } from "@/lib/date";
import { primaryMuscle, workoutSetCount, workoutTitle, workoutVolume } from "@/lib/workouts";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ muscle?: string }>;
}) {
  const [{ muscleGroups }, workouts] = await Promise.all([getMasterData(), getWorkouts(50)]);
  const { muscle } = await searchParams;
  const filteredWorkouts =
    muscle && muscle !== "all"
      ? workouts.filter((workout) => workout.workout_exercises.some((exercise) => exercise.muscle_groups?.id === muscle))
      : workouts;

  return (
    <PhoneShell nav={<BottomNav active="history" />}>
      <section className="pt-2">
        <PageTitle>
          トレーニング<span className="text-macho-lime">履歴</span>
        </PageTitle>
      </section>

      <div className="mt-3.5 flex gap-1.5 overflow-x-auto pb-0.5">
        <Link href="/history" className="shrink-0">
          <Pill active={!muscle || muscle === "all"}>全て</Pill>
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
                  <p className="text-sm font-medium">{workoutTitle(workout)}</p>
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
                          {exercise.equipment && (
                            <span className="rounded-lg bg-macho-surface px-2 py-0.5 text-[11px] text-macho-muted">
                              {exercise.equipment.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-macho-lime">{describeSets(exercise.workout_sets)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-between border-t border-macho-border pt-2.5 text-xs text-macho-muted">
                  <span>合計 {workoutSetCount(workout)}set</span>
                  <span>総ボリューム {workoutVolume(workout).toLocaleString()}kg</span>
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

function describeSets(sets: { weight_kg: number; reps: number }[]) {
  const first = sets[0];
  if (!first) return "セットなし";
  const same = sets.every((set) => Number(set.weight_kg) === Number(first.weight_kg) && set.reps === first.reps);
  if (same) return `${Number(first.weight_kg)}kg x ${first.reps}回 x ${sets.length}set`;
  return sets.map((set) => `${Number(set.weight_kg)}kg x ${set.reps}回`).join(" / ");
}
