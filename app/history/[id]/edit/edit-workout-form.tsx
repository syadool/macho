"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, Dumbbell, Minus, Plus, Trash2 } from "lucide-react";
import { Card, OutlineButton, Pill, PrimaryButton } from "@/components/ui";
import type { Equipment, ExerciseType, MuscleGroup, NewExercisePayload, Workout } from "@/lib/types";
import { updateWorkout } from "../../actions";

type LocalExercise = NewExercisePayload & {
  local_key: string;
};

export function EditWorkoutForm({
  workout,
  muscleGroups,
  equipment,
}: {
  workout: Workout;
  muscleGroups: MuscleGroup[];
  equipment: Equipment[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(workout.date);
  const [exercises, setExercises] = useState<LocalExercise[]>(() =>
    workout.workout_exercises.map((exercise) => {
      const firstSet = exercise.workout_sets[0];
      return {
        local_key: exercise.id,
        exercise_type: exercise.exercise_type,
        exercise_name: exercise.exercise_name,
        muscle_group_id: exercise.muscle_groups?.id ?? muscleGroups[0]?.id ?? null,
        muscle_sub_group_ids: exercise.muscle_sub_groups?.map((group) => group.id) ?? [],
        equipment_id: exercise.equipment?.id ?? equipment[0]?.id ?? null,
        weight_kg: Number(firstSet?.weight_kg ?? 0),
        reps: Number(firstSet?.reps ?? 0),
        sets: exercise.exercise_type === "strength" ? Math.max(exercise.workout_sets.length, 1) : 0,
        duration_minutes: exercise.duration_minutes ?? 30,
        distance_km: Number(exercise.distance_km ?? 0),
        calories: exercise.calories ?? 0,
      };
    }),
  );
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function patchExercise(index: number, patch: Partial<NewExercisePayload>) {
    setExercises((current) => current.map((exercise, itemIndex) => (itemIndex === index ? { ...exercise, ...patch } : exercise)));
  }

  function setExerciseType(index: number, type: ExerciseType) {
    patchExercise(index, {
      exercise_type: type,
      exercise_name: type === "cardio" ? "ランニング" : "ベンチプレス",
      muscle_group_id: type === "strength" ? muscleGroups[0]?.id ?? null : null,
      muscle_sub_group_ids: [],
      equipment_id: type === "strength" ? equipment[0]?.id ?? null : null,
      sets: type === "strength" ? 3 : 0,
      duration_minutes: type === "cardio" ? 30 : null,
      distance_km: type === "cardio" ? 5 : null,
      calories: type === "cardio" ? 250 : null,
    });
  }

  function toggleSubGroup(index: number, id: string) {
    const exercise = exercises[index];
    if (!exercise) return;

    patchExercise(index, {
      muscle_sub_group_ids: exercise.muscle_sub_group_ids.includes(id)
        ? exercise.muscle_sub_group_ids.filter((item) => item !== id)
        : [...exercise.muscle_sub_group_ids, id],
    });
  }

  function addExercise(type: ExerciseType) {
    setExercises((current) => [
      ...current,
      {
        local_key: `new-${type}-${Date.now()}-${current.length}`,
        exercise_type: type,
        exercise_name: type === "strength" ? "ベンチプレス" : "ランニング",
        muscle_group_id: type === "strength" ? muscleGroups[0]?.id ?? null : null,
        muscle_sub_group_ids: [],
        equipment_id: type === "strength" ? equipment[0]?.id ?? null : null,
        weight_kg: type === "strength" ? 60 : 0,
        reps: type === "strength" ? 10 : 0,
        sets: type === "strength" ? 3 : 0,
        duration_minutes: type === "cardio" ? 30 : null,
        distance_km: type === "cardio" ? 5 : null,
        calories: type === "cardio" ? 250 : null,
      },
    ]);
  }

  function removeExercise(index: number) {
    setExercises((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function submit() {
    setMessage("");
    startTransition(async () => {
      const result = await updateWorkout(workout.id, date, exercises);
      if (result.ok) {
        router.push("/history");
        router.refresh();
      } else {
        setMessage(result.message ?? "更新に失敗しました。");
      }
    });
  }

  return (
    <>
      <Card className="mt-4">
        <label htmlFor="edit-workout-date" className="mb-1.5 block text-[11px] text-macho-muted">
          トレーニング日
        </label>
        <input
          id="edit-workout-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-sm text-macho-text outline-none transition focus:border-macho-lime"
        />
      </Card>

      <section className="mt-4 space-y-3">
        {exercises.map((exercise, index) => {
          const isCardio = exercise.exercise_type === "cardio";
          const selectedMuscle = muscleGroups.find((group) => group.id === exercise.muscle_group_id) ?? muscleGroups[0];
          const subGroups = selectedMuscle?.muscle_sub_groups ?? [];

          return (
            <Card key={exercise.local_key} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="grid flex-1 grid-cols-2 gap-1.5">
                  <ModeButton active={!isCardio} icon={<Dumbbell size={15} />} onClick={() => setExerciseType(index, "strength")}>
                    筋トレ
                  </ModeButton>
                  <ModeButton active={isCardio} icon={<Activity size={15} />} onClick={() => setExerciseType(index, "cardio")}>
                    有酸素
                  </ModeButton>
                </div>
                <button
                  type="button"
                  onClick={() => removeExercise(index)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-macho-border text-macho-muted transition hover:border-[#FF6B6B] hover:text-[#FF6B6B]"
                  aria-label="種目を削除"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11px] text-macho-muted">{isCardio ? "有酸素種目" : "エクササイズ名"}</span>
                <input
                  value={exercise.exercise_name}
                  onChange={(event) => patchExercise(index, { exercise_name: event.target.value })}
                  className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-sm text-macho-text outline-none transition focus:border-macho-lime"
                />
              </label>

              {isCardio ? (
                <div className="grid grid-cols-3 gap-2">
                  <Stepper label="時間 (分)" value={exercise.duration_minutes ?? 0} min={1} step={5} onChange={(value) => patchExercise(index, { duration_minutes: value })} />
                  <Stepper label="距離 (km)" value={exercise.distance_km ?? 0} min={0} step={0.5} onChange={(value) => patchExercise(index, { distance_km: value })} />
                  <Stepper label="kcal" value={exercise.calories ?? 0} min={0} step={25} onChange={(value) => patchExercise(index, { calories: value })} />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    {muscleGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() =>
                          patchExercise(index, {
                            muscle_group_id: group.id,
                            muscle_sub_group_ids: [],
                          })
                        }
                        className={`rounded-[12px] border px-2 py-2.5 text-xs font-medium transition ${
                          group.id === exercise.muscle_group_id
                            ? "border-macho-lime bg-macho-lime/10 text-macho-lime"
                            : "border-macho-border bg-macho-surface text-macho-muted"
                        }`}
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>

                  {subGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {subGroups.map((subGroup) => (
                        <Pill
                          key={subGroup.id}
                          active={exercise.muscle_sub_group_ids.includes(subGroup.id)}
                          onClick={() => toggleSubGroup(index, subGroup.id)}
                        >
                          {subGroup.name}
                        </Pill>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {equipment.map((item) => (
                      <Pill key={item.id} active={exercise.equipment_id === item.id} onClick={() => patchExercise(index, { equipment_id: item.id })}>
                        {item.name}
                      </Pill>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Stepper label="重量 (kg)" value={exercise.weight_kg} min={0} step={2.5} onChange={(value) => patchExercise(index, { weight_kg: value })} />
                    <Stepper label="回数" value={exercise.reps} min={0} step={1} onChange={(value) => patchExercise(index, { reps: value })} />
                    <Stepper label="セット" value={exercise.sets} min={1} step={1} onChange={(value) => patchExercise(index, { sets: value })} />
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </section>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <OutlineButton onClick={() => addExercise("strength")}>
          <Plus size={14} className="mr-1 inline align-[-2px]" />
          筋トレ追加
        </OutlineButton>
        <OutlineButton onClick={() => addExercise("cardio")}>
          <Plus size={14} className="mr-1 inline align-[-2px]" />
          有酸素追加
        </OutlineButton>
      </div>

      {message && <p className="mt-3 text-xs text-[#FF6B6B]">{message}</p>}

      <PrimaryButton onClick={submit} disabled={isPending || exercises.length === 0} className="mt-3">
        <Check size={16} className="mr-1 inline align-[-3px]" />
        {isPending ? "更新中..." : "変更を保存"}
      </PrimaryButton>
    </>
  );
}

function ModeButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center justify-center gap-1.5 rounded-[12px] border text-xs font-medium transition ${
        active
          ? "border-macho-lime bg-macho-lime/10 text-macho-lime"
          : "border-macho-border bg-macho-surface text-macho-muted hover:text-macho-text"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Stepper({
  label,
  value,
  min,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}) {
  function updateValue(rawValue: string) {
    if (rawValue === "") {
      onChange(min);
      return;
    }

    const nextValue = Number(rawValue);
    if (!Number.isNaN(nextValue)) onChange(Math.max(min, nextValue));
  }

  return (
    <div className="rounded-[12px] border border-macho-border bg-macho-surface px-1.5 py-3 text-center">
      <p className="mb-1.5 text-[11px] text-macho-muted">{label}</p>
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-macho-border text-macho-muted hover:text-macho-text"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-center font-display text-[24px] leading-none tracking-[0.04em] text-macho-lime outline-none"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-macho-border text-macho-muted hover:text-macho-text"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
