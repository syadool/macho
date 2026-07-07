"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, Dumbbell, Minus, Plus, X } from "lucide-react";
import { Card, OutlineButton, PrimaryButton } from "@/components/ui";
import { SetRowsEditor } from "@/components/workout-sets";
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
import { shortMuscleName } from "@/lib/constants";
import { saveWorkout } from "./actions";

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
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setSetRows((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
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
      setMessage("エクササイズ名を入力してください。");
      return;
    }

    if (exerciseType === "strength" && !selectedMuscle) {
      setMessage("部位を選択してください。");
      return;
    }

    const pending = buildPendingExercise();
    if (!pending) return;

    setExercises((current) => [...current, pending]);
    if (exerciseType === "strength") setSetRows([{ ...DEFAULT_SET_ROW }]);
    setMessage("");
    setExerciseName("");
  }

  function submitWorkout() {
    const pending = buildPendingExercise();
    const exercisesToSave = pending ? [...exercises, pending] : exercises;
    if (exercisesToSave.length === 0) {
      setMessage("エクササイズを追加してください。");
      return;
    }

    startTransition(async () => {
      const result = await saveWorkout(workoutDate, exercisesToSave);
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setMessage(result.message ?? "保存に失敗しました。");
      }
    });
  }

  function handleNameBlur() {
    blurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 120);
  }

  function handleNameFocus() {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setShowSuggestions(true);
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
          <div className="grid grid-cols-3 gap-2">
            {muscleGroups.map((group) => {
              const active = group.id === selectedMuscleId;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => chooseMuscle(group.id)}
                  className={`rounded-[14px] border p-3.5 text-center transition active:scale-[0.97] ${
                    active ? "border-macho-lime bg-macho-lime/5" : "border-macho-border bg-macho-card hover:border-[#555]"
                  }`}
                >
                  <span className="mb-1 block text-[22px] font-semibold" style={{ color: group.color }}>
                    {shortMuscleName(group.name)}
                  </span>
                  <span className={`text-[11px] ${active ? "text-macho-lime" : "text-macho-muted"}`}>{group.name_en}</span>
                </button>
              );
            })}
          </div>
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
          onBlur={handleNameBlur}
          placeholder={exerciseType === "strength" ? "ベンチプレス" : "ランニング"}
          autoComplete="off"
          className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-base text-macho-text outline-none transition placeholder:text-macho-muted focus:border-macho-lime"
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul className="absolute left-4 right-4 top-[calc(100%-4px)] z-20 max-h-64 overflow-y-auto rounded-[12px] border border-macho-border bg-macho-surface shadow-lg">
            {filteredSuggestions.map((entry) => (
              <li key={entry.exercise_name}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySuggestion(entry)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-macho-border/60 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-macho-card"
                >
                  <span className="text-sm text-macho-text">{entry.exercise_name}</span>
                  <span className="text-[11px] text-macho-muted">{suggestionSubtitle(entry)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {exerciseType === "strength" ? (
        <div className="mt-3.5">
          <SetRowsEditor rows={setRows} onAdd={addSetRow} onRemove={removeSetRow} onChange={updateSetRow} />
        </div>
      ) : (
        <div className="mt-3.5">
          <Stepper label="時間 (分)" value={durationMinutes} min={1} step={5} onChange={setDurationMinutes} />
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
                onClick={() => setExercises((current) => current.filter((_, i) => i !== index))}
                className="text-macho-muted transition hover:text-[#FF6B6B]"
                aria-label="削除"
              >
                <X size={16} />
              </button>
            </Card>
          );
        })}
      </div>

      {message && <p className="mb-2 text-xs text-[#FF6B6B]">{message}</p>}

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

function suggestionSubtitle(entry: ExerciseHistoryEntry) {
  if (entry.exercise_type === "cardio") {
    return entry.last_duration_minutes ? `前回: ${entry.last_duration_minutes}分` : "前回の記録なし";
  }
  if (entry.last_sets.length === 0) return "前回の記録なし";
  return `前回: ${formatSetsSummary(entry.last_sets)}`;
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
      className={`flex h-12 items-center justify-center gap-2 rounded-[14px] border text-sm font-medium transition active:scale-[0.97] ${
        active
          ? "border-macho-lime bg-macho-lime/10 text-macho-lime"
          : "border-macho-border bg-macho-card text-macho-muted hover:text-macho-text"
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
    <Card className="px-1.5 py-3 text-center">
      <p className="mb-1.5 text-[11px] text-macho-muted">{label}</p>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-macho-border bg-macho-surface text-macho-muted hover:text-macho-text"
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
          className="min-w-0 flex-1 bg-transparent text-center font-display text-[26px] leading-none tracking-[0.04em] text-macho-lime outline-none"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-macho-border bg-macho-surface text-macho-muted hover:text-macho-text"
        >
          <Plus size={14} />
        </button>
      </div>
    </Card>
  );
}
