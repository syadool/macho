"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, Dumbbell, Plus, X } from "lucide-react";
import { Card, OutlineButton, PrimaryButton } from "@/components/ui";
import { SetRowsEditor } from "@/components/workout-sets";
import { DurationStepper, ExerciseSuggestionList, ModeButton, MuscleGroupGrid } from "@/components/workout-form";
import { formatSetsSummary } from "@/lib/sets";
import type {
  Equipment,
  ExerciseHistoryEntry,
  ExerciseType,
  MuscleGroup,
  NewExercisePayload,
  NewWorkoutSetPayload,
  WorkoutTemplate,
} from "@/lib/types";
import { saveWorkout } from "./actions";
import { useToast } from "@/components/toast";

type SetRow = NewWorkoutSetPayload;

const DEFAULT_SET_ROW: SetRow = { weight_kg: 20, reps: 10 };

export function RecordForm({
  muscleGroups,
  initialTemplateName,
  initialExercises,
  initialDate,
  exerciseHistory,
}: {
  muscleGroups: MuscleGroup[];
  equipment: Equipment[];
  initialTemplateName?: string;
  initialExercises?: WorkoutTemplate["template_exercises"];
  initialDate: string;
  exerciseHistory: ExerciseHistoryEntry[];
}) {
  const router = useRouter();
  const { show, dismiss } = useToast();
  const [workoutDate, setWorkoutDate] = useState(initialDate);
  const [exerciseType, setExerciseType] = useState<ExerciseType>("strength");
  const [selectedMuscleId, setSelectedMuscleId] = useState(muscleGroups[0]?.id ?? "");
  const selectedMuscle = useMemo(
    () => muscleGroups.find((group) => group.id === selectedMuscleId) ?? muscleGroups[0],
    [muscleGroups, selectedMuscleId],
  );
  const [exerciseName, setExerciseName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [setRows, setSetRows] = useState<SetRow[]>([{ ...DEFAULT_SET_ROW }]);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [exercises, setExercises] = useState<NewExercisePayload[]>(() => templateExercisesToPayload(initialExercises));
  const [isPending, startTransition] = useTransition();
  const pendingDeletionRef = useRef<{ token: string; toastId: string; expiresAt: number } | null>(null);
  useEffect(() => {
    return () => {
      const pending = pendingDeletionRef.current;
      if (pending) {
        pendingDeletionRef.current = null;
        dismiss(pending.toastId);
      }
    };
  }, [dismiss]);

  function scheduleUndo(message: string, restore: () => void) {
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 5000;
    const toastId = show({
      kind: "undo",
      message,
      onUndo: () => {
        const pending = pendingDeletionRef.current;
        if (pending?.token !== token || Date.now() >= pending.expiresAt) return;
        restore();
        pendingDeletionRef.current = null;
      },
    });
    const previous = pendingDeletionRef.current;
    if (previous) dismiss(previous.toastId);
    pendingDeletionRef.current = { token, toastId, expiresAt };
  }

  const filteredSuggestions = useMemo(() => {
    const query = exerciseName.trim().toLowerCase();
    const candidates = exerciseHistory.filter((entry) => entry.exercise_type === exerciseType);
    if (!query) return candidates.slice(0, 20);
    return candidates.filter((entry) => entry.exercise_name.toLowerCase().includes(query)).slice(0, 20);
  }, [exerciseHistory, exerciseName, exerciseType]);

  function chooseMuscle(id: string) {
    setSelectedMuscleId(id);
  }

  function chooseExerciseType(type: ExerciseType) {
    setExerciseType(type);
    setExerciseName("");
    setShowSuggestions(false);
  }

  function applySuggestion(entry: ExerciseHistoryEntry) {
    setExerciseName(entry.exercise_name);
    if (entry.muscle_group_id) setSelectedMuscleId(entry.muscle_group_id);
    if (entry.exercise_type === "strength") {
      setSetRows(entry.last_sets.length > 0 ? entry.last_sets.map((set) => ({ ...set })) : [{ ...DEFAULT_SET_ROW }]);
    } else if (entry.last_duration_minutes) {
      setDurationMinutes(entry.last_duration_minutes);
    }
    setShowSuggestions(false);
  }

  function addSetRow() {
    setSetRows((current) => {
      const last = current[current.length - 1] ?? DEFAULT_SET_ROW;
      return [...current, { ...last }];
    });
  }

  function removeSetRow(index: number) {
    const item = setRows[index];
    if (!item || setRows.length <= 1) return;
    setSetRows((current) => current.filter((_, i) => i !== index));
    scheduleUndo("セットを削除しました", () => {
      setSetRows((current) => {
        const next = [...current];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
    });
  }

  function updateSetRow(index: number, patch: Partial<SetRow>) {
    setSetRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function buildPendingExercise(): NewExercisePayload | null {
    if (!exerciseName.trim()) return null;
    if (exerciseType === "strength" && !selectedMuscle) return null;

    if (exerciseType === "strength") {
      return {
        exercise_type: "strength",
        exercise_name: exerciseName.trim(),
        muscle_group_id: selectedMuscle?.id ?? null,
        muscle_sub_group_ids: [],
        equipment_id: null,
        weight_kg: setRows[0]?.weight_kg ?? 0,
        reps: setRows[0]?.reps ?? 0,
        sets: setRows.length,
        workout_sets: setRows.map((row) => ({ weight_kg: row.weight_kg, reps: row.reps })),
        duration_minutes: null,
        distance_km: null,
        calories: null,
      };
    }

    return {
      exercise_type: "cardio",
      exercise_name: exerciseName.trim(),
      muscle_group_id: null,
      muscle_sub_group_ids: [],
      equipment_id: null,
      weight_kg: 0,
      reps: 0,
      sets: 0,
      duration_minutes: durationMinutes,
      distance_km: null,
      calories: null,
    };
  }

  function addExercise() {
    if (!exerciseName.trim()) {
      show({ kind: "error", message: "エクササイズ名を入力してください。" });
      return;
    }

    if (exerciseType === "strength" && !selectedMuscle) {
      show({ kind: "error", message: "部位を選択してください。" });
      return;
    }

    const pending = buildPendingExercise();
    if (!pending) return;

    setExercises((current) => [...current, pending]);
    if (exerciseType === "strength") setSetRows([{ ...DEFAULT_SET_ROW }]);
    setExerciseName("");
  }

  function submitWorkout() {
    const pending = buildPendingExercise();
    const exercisesToSave = pending ? [...exercises, pending] : exercises;
    if (exercisesToSave.length === 0) {
      show({ kind: "error", message: "エクササイズを追加してください。" });
      return;
    }

    startTransition(async () => {
      const result = await saveWorkout(workoutDate, exercisesToSave);
      if (result.ok) {
        show({ kind: "success", message: "ワークアウトを保存しました" });
        router.push("/dashboard");
        router.refresh();
      } else {
        show({ kind: "error", message: result.message ?? "保存に失敗しました。" });
      }
    });
  }

  function handleNameFocus() {
    setShowSuggestions(true);
  }

  function removeExercise(index: number) {
    const item = exercises[index];
    if (!item) return;
    setExercises((current) => current.filter((_, i) => i !== index));
    scheduleUndo("エクササイズを削除しました", () => {
      setExercises((current) => {
        const next = [...current];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
    });
  }

  return (
    <>
      <Card className="mt-4">
        <label htmlFor="workout-date" className="mb-1.5 block text-[11px] text-macho-muted">
          トレーニング日
        </label>
        <input
          id="workout-date"
          type="date"
          value={workoutDate}
          max={initialDate}
          onChange={(event) => setWorkoutDate(event.target.value)}
          className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-base text-macho-text outline-none transition focus:border-macho-lime"
        />
      </Card>

      {initialExercises && initialExercises.length > 0 && (
        <Card className="mt-3 border-macho-lime/50 bg-macho-lime/5">
          <p className="text-sm font-medium">テンプレート「{initialTemplateName ?? "メニュー"}」を読み込みました</p>
          <p className="mt-1 text-xs text-macho-muted">重量や回数を調整して保存できます。</p>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ModeButton active={exerciseType === "strength"} icon={<Dumbbell size={16} />} onClick={() => chooseExerciseType("strength")}>
          筋トレ
        </ModeButton>
        <ModeButton active={exerciseType === "cardio"} icon={<Activity size={16} />} onClick={() => chooseExerciseType("cardio")}>
          有酸素
        </ModeButton>
      </div>

      {exerciseType === "strength" && (
        <>
          <p className="mb-2 mt-4 text-xs font-medium text-macho-muted">部位を選択</p>
          <MuscleGroupGrid groups={muscleGroups} selectedId={selectedMuscleId} onSelect={chooseMuscle} />
        </>
      )}

      <Card className="relative mt-4">
        <label htmlFor="exercise-name" className="mb-1.5 block text-[11px] text-macho-muted">
          {exerciseType === "strength" ? "エクササイズ名" : "有酸素種目"}
        </label>
        <input
          id="exercise-name"
          value={exerciseName}
          onChange={(event) => setExerciseName(event.target.value)}
          onFocus={handleNameFocus}
          onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setShowSuggestions(false); }}
          placeholder={exerciseType === "strength" ? "ベンチプレス" : "ランニング"}
          autoComplete="off"
          className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-base text-macho-text outline-none transition placeholder:text-macho-muted focus:border-macho-lime"
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <ExerciseSuggestionList entries={filteredSuggestions} onSelect={applySuggestion} className="left-4 right-4" />
        )}
      </Card>

      {exerciseType === "strength" ? (
        <div className="mt-3.5">
          <SetRowsEditor rows={setRows} onAdd={addSetRow} onRemove={removeSetRow} onChange={updateSetRow} />
        </div>
      ) : (
        <div className="mt-3.5">
          <DurationStepper label="時間 (分)" value={durationMinutes} min={1} step={5} onChange={setDurationMinutes} />
        </div>
      )}

      <div className="mt-3.5">
        {exercises.map((exercise, index) => {
          const isCardio = exercise.exercise_type === "cardio";
          const muscle = muscleGroups.find((group) => group.id === exercise.muscle_group_id);
          return (
            <Card key={`${exercise.exercise_name}-${index}`} className="mb-2.5 flex items-center gap-3">
              <div className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: muscle?.color ?? "#D4FF00" }} />
              <div className="flex-1">
                <p className="text-[13px] font-medium">{exercise.exercise_name}</p>
                {isCardio ? (
                  <p className="text-[11px] text-macho-muted">{exercise.duration_minutes}分</p>
                ) : (
                  <p className="text-[11px] text-macho-muted">{formatSetsSummary(exercise.workout_sets)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeExercise(index)}
                className="flex min-h-11 min-w-11 items-center justify-center text-macho-muted transition hover:text-macho-danger"
                aria-label="削除"
              >
                <X size={16} />
              </button>
            </Card>
          );
        })}
      </div>


      <OutlineButton onClick={addExercise} className="mb-2.5">
        <Plus size={14} className="mr-1 inline align-[-2px]" />
        エクササイズを追加
      </OutlineButton>
      <PrimaryButton onClick={submitWorkout} disabled={isPending || (exercises.length === 0 && !exerciseName.trim())}>
        <Check size={16} className="mr-1 inline align-[-3px]" />
        {isPending ? "保存中..." : "ワークアウトを保存"}
      </PrimaryButton>
    </>
  );
}

function templateExercisesToPayload(initialExercises?: WorkoutTemplate["template_exercises"]): NewExercisePayload[] {
  return (initialExercises ?? []).map((exercise) => {
    const isStrength = Boolean(exercise.muscle_group_id);
    const weight = Number(exercise.target_weight_kg ?? 0);
    const reps = exercise.target_reps ?? 0;
    const sets = isStrength ? exercise.target_sets ?? 1 : 0;
    return {
      exercise_type: isStrength ? "strength" : "cardio",
      exercise_name: exercise.exercise_name,
      muscle_group_id: exercise.muscle_group_id,
      muscle_sub_group_ids: [],
      equipment_id: null,
      weight_kg: weight,
      reps,
      sets,
      workout_sets: isStrength ? Array.from({ length: sets }, () => ({ weight_kg: weight, reps })) : undefined,
      duration_minutes: isStrength ? null : 30,
      distance_km: null,
      calories: null,
    };
  });
}
