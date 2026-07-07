"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, Dumbbell, Minus, Plus, Trash2 } from "lucide-react";
import { Card, OutlineButton, PrimaryButton } from "@/components/ui";
import { SetRowsEditor } from "@/components/workout-sets";
import type {
  ExerciseHistoryEntry,
  ExerciseType,
  MuscleGroup,
  NewExercisePayload,
  NewWorkoutSetPayload,
  Workout,
} from "@/lib/types";
import { shortMuscleName } from "@/lib/constants";
import { updateWorkout } from "../../actions";

const DEFAULT_SET_ROW: NewWorkoutSetPayload = { weight_kg: 20, reps: 10 };

type LocalExercise = NewExercisePayload & {
  local_key: string;
};

export function EditWorkoutForm({
  workout,
  muscleGroups,
  exerciseHistory,
  maxDate,
}: {
  workout: Workout;
  muscleGroups: MuscleGroup[];
  equipment: unknown[];
  exerciseHistory: ExerciseHistoryEntry[];
  maxDate: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(workout.date);
  const [openSuggestionsIndex, setOpenSuggestionsIndex] = useState<number | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exercises, setExercises] = useState<LocalExercise[]>(() =>
    workout.workout_exercises.map((exercise) => {
      const workoutSets = exercise.workout_sets.map((set) => ({
        weight_kg: Number(set.weight_kg),
        reps: Number(set.reps),
      }));
      return {
        local_key: exercise.id,
        exercise_type: exercise.exercise_type,
        exercise_name: exercise.exercise_name,
        muscle_group_id: exercise.muscle_groups?.id ?? muscleGroups[0]?.id ?? null,
        muscle_sub_group_ids: exercise.muscle_sub_groups?.map((group) => group.id) ?? [],
        equipment_id: null,
        weight_kg: workoutSets[0]?.weight_kg ?? 0,
        reps: workoutSets[0]?.reps ?? 0,
        sets: exercise.exercise_type === "strength" ? Math.max(workoutSets.length, 1) : 0,
        workout_sets: exercise.exercise_type === "strength" ? (workoutSets.length > 0 ? workoutSets : [{ ...DEFAULT_SET_ROW }]) : [],
        duration_minutes: exercise.duration_minutes ?? 30,
        distance_km: null,
        calories: null,
      };
    }),
  );
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function patchExercise(index: number, patch: Partial<NewExercisePayload>) {
    setExercises((current) => current.map((exercise, itemIndex) => (itemIndex === index ? { ...exercise, ...patch } : exercise)));
  }

  function suggestionsFor(exercise: LocalExercise) {
    const query = exercise.exercise_name.trim().toLowerCase();
    const candidates = exerciseHistory.filter((entry) => entry.exercise_type === exercise.exercise_type);
    if (!query) return candidates.slice(0, 20);
    return candidates.filter((entry) => entry.exercise_name.toLowerCase().includes(query)).slice(0, 20);
  }

  function applySuggestion(index: number, entry: ExerciseHistoryEntry) {
    if (entry.exercise_type === "strength") {
      const sets = entry.last_sets.length > 0 ? entry.last_sets.map((set) => ({ ...set })) : [{ ...DEFAULT_SET_ROW }];
      patchExercise(index, {
        exercise_name: entry.exercise_name,
        muscle_group_id: entry.muscle_group_id ?? muscleGroups[0]?.id ?? null,
        sets: sets.length,
        workout_sets: sets,
        weight_kg: sets[0]?.weight_kg ?? 0,
        reps: sets[0]?.reps ?? 0,
      });
    } else {
      patchExercise(index, {
        exercise_name: entry.exercise_name,
        duration_minutes: entry.last_duration_minutes ?? 30,
      });
    }
    setOpenSuggestionsIndex(null);
  }

  function handleNameFocus(index: number) {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setOpenSuggestionsIndex(index);
  }

  function handleNameBlur() {
    blurTimeoutRef.current = setTimeout(() => setOpenSuggestionsIndex(null), 120);
  }

  function setExerciseType(index: number, type: ExerciseType) {
    patchExercise(index, {
      exercise_type: type,
      exercise_name: type === "cardio" ? "ランニング" : "ベンチプレス",
      muscle_group_id: type === "strength" ? muscleGroups[0]?.id ?? null : null,
      muscle_sub_group_ids: [],
      equipment_id: null,
      sets: type === "strength" ? 1 : 0,
      workout_sets: type === "strength" ? [{ ...DEFAULT_SET_ROW }] : [],
      duration_minutes: type === "cardio" ? 30 : null,
      distance_km: null,
      calories: null,
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
        equipment_id: null,
        weight_kg: type === "strength" ? DEFAULT_SET_ROW.weight_kg : 0,
        reps: type === "strength" ? DEFAULT_SET_ROW.reps : 0,
        sets: type === "strength" ? 1 : 0,
        workout_sets: type === "strength" ? [{ ...DEFAULT_SET_ROW }] : [],
        duration_minutes: type === "cardio" ? 30 : null,
        distance_km: null,
        calories: null,
      },
    ]);
  }

  function removeExercise(index: number) {
    setExercises((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addSetRow(index: number) {
    setExercises((current) =>
      current.map((exercise, itemIndex) => {
        if (itemIndex !== index) return exercise;
        const sets = getStrengthSets(exercise);
        const last = sets[sets.length - 1] ?? DEFAULT_SET_ROW;
        const nextSets = [...sets, { ...last }];
        return { ...exercise, sets: nextSets.length, workout_sets: nextSets };
      }),
    );
  }

  function removeSetRow(index: number, setIndex: number) {
    setExercises((current) =>
      current.map((exercise, itemIndex) => {
        if (itemIndex !== index) return exercise;
        const sets = getStrengthSets(exercise);
        if (sets.length <= 1) return exercise;
        const nextSets = sets.filter((_, i) => i !== setIndex);
        return { ...exercise, sets: nextSets.length, workout_sets: nextSets };
      }),
    );
  }

  function patchStrengthSet(index: number, setIndex: number, patch: Partial<NewWorkoutSetPayload>) {
    setExercises((current) =>
      current.map((exercise, itemIndex) => {
        if (itemIndex !== index) return exercise;
        const nextSets = getStrengthSets(exercise).map((set, currentSetIndex) =>
          currentSetIndex === setIndex ? { ...set, ...patch } : set,
        );
        return {
          ...exercise,
          sets: nextSets.length,
          workout_sets: nextSets,
          weight_kg: nextSets[0]?.weight_kg ?? exercise.weight_kg,
          reps: nextSets[0]?.reps ?? exercise.reps,
        };
      }),
    );
  }

  function submit() {
    setMessage("");
    startTransition(async () => {
      const result = await updateWorkout(workout.id, date, exercises, workout.updated_at);
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
          max={maxDate}
          onChange={(event) => setDate(event.target.value)}
          className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-base text-macho-text outline-none transition focus:border-macho-lime"
        />
      </Card>

      <section className="mt-4 space-y-3">
        {exercises.map((exercise, index) => {
          const isCardio = exercise.exercise_type === "cardio";
          const strengthSets = getStrengthSets(exercise);

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

              <div className="relative">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-macho-muted">{isCardio ? "有酸素種目" : "エクササイズ名"}</span>
                  <input
                    value={exercise.exercise_name}
                    onChange={(event) => patchExercise(index, { exercise_name: event.target.value })}
                    onFocus={() => handleNameFocus(index)}
                    onBlur={handleNameBlur}
                    autoComplete="off"
                    className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-base text-macho-text outline-none transition focus:border-macho-lime"
                  />
                </label>
                {openSuggestionsIndex === index && suggestionsFor(exercise).length > 0 && (
                  <ul className="absolute left-0 right-0 top-[calc(100%-4px)] z-20 max-h-64 overflow-y-auto rounded-[12px] border border-macho-border bg-macho-surface shadow-lg">
                    {suggestionsFor(exercise).map((entry) => (
                      <li key={entry.exercise_name}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applySuggestion(index, entry)}
                          className="flex w-full flex-col items-start gap-0.5 border-b border-macho-border/60 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-macho-card"
                        >
                          <span className="text-sm text-macho-text">{entry.exercise_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isCardio ? (
                <Stepper
                  label="時間 (分)"
                  value={exercise.duration_minutes ?? 0}
                  min={1}
                  step={5}
                  onChange={(value) => patchExercise(index, { duration_minutes: value })}
                />
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
                        {shortMuscleName(group.name)}
                      </button>
                    ))}
                  </div>

                  <SetRowsEditor
                    rows={strengthSets}
                    onAdd={() => addSetRow(index)}
                    onRemove={(setIndex) => removeSetRow(index, setIndex)}
                    onChange={(setIndex, patch) => patchStrengthSet(index, setIndex, patch)}
                  />
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

function getStrengthSets(exercise: LocalExercise) {
  if (Array.isArray(exercise.workout_sets) && exercise.workout_sets.length > 0) return exercise.workout_sets;
  return [{ ...DEFAULT_SET_ROW }];
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
