"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import { Card, OutlineButton, Pill, PrimaryButton } from "@/components/ui";
import type { Equipment, MuscleGroup, NewExercisePayload } from "@/lib/types";
import { shortMuscleName } from "@/lib/constants";
import { toDateInputValue } from "@/lib/date";
import { saveWorkout } from "./actions";

export function RecordForm({
  muscleGroups,
  equipment,
}: {
  muscleGroups: MuscleGroup[];
  equipment: Equipment[];
}) {
  const router = useRouter();
  const [workoutDate, setWorkoutDate] = useState(toDateInputValue());
  const [selectedMuscleId, setSelectedMuscleId] = useState(muscleGroups[0]?.id ?? "");
  const selectedMuscle = useMemo(
    () => muscleGroups.find((group) => group.id === selectedMuscleId) ?? muscleGroups[0],
    [muscleGroups, selectedMuscleId],
  );
  const subGroups = selectedMuscle?.muscle_sub_groups ?? [];
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(equipment[0]?.id ?? null);
  const [exerciseName, setExerciseName] = useState("インクラインベンチプレス");
  const [weight, setWeight] = useState(60);
  const [reps, setReps] = useState(10);
  const [sets, setSets] = useState(3);
  const [exercises, setExercises] = useState<NewExercisePayload[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function chooseMuscle(id: string) {
    setSelectedMuscleId(id);
    setSelectedSubIds([]);
  }

  function toggleSubGroup(id: string) {
    setSelectedSubIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function addExercise() {
    if (!selectedMuscle || !exerciseName.trim()) {
      setMessage("エクササイズ名を入力してください。");
      return;
    }

    setExercises((current) => [
      ...current,
      {
        exercise_name: exerciseName.trim(),
        muscle_group_id: selectedMuscle.id,
        muscle_sub_group_ids: selectedSubIds,
        equipment_id: selectedEquipmentId,
        weight_kg: weight,
        reps,
        sets,
      },
    ]);
    setMessage("");
    setExerciseName("");
  }

  function submitWorkout() {
    startTransition(async () => {
      const result = await saveWorkout(workoutDate, exercises);
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setMessage(result.message ?? "保存に失敗しました。");
      }
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
          onChange={(event) => setWorkoutDate(event.target.value)}
          className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-sm text-macho-text outline-none transition focus:border-macho-lime"
        />
      </Card>

      <p className="mb-2 mt-4 text-xs font-medium text-macho-muted">部位を選択</p>
      <div className="grid grid-cols-3 gap-2">
        {muscleGroups.map((group) => {
          const active = group.id === selectedMuscleId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => chooseMuscle(group.id)}
              className={`rounded-[14px] border p-3.5 text-center transition ${
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

      <p className="mb-1.5 mt-3.5 text-xs font-medium text-macho-muted">サブカテゴリ</p>
      <div className="flex flex-wrap gap-1.5">
        {subGroups.map((subGroup) => (
          <Pill key={subGroup.id} active={selectedSubIds.includes(subGroup.id)} onClick={() => toggleSubGroup(subGroup.id)}>
            {subGroup.name}
          </Pill>
        ))}
      </div>

      <Card className="mt-4">
        <label htmlFor="exercise-name" className="mb-1.5 block text-[11px] text-macho-muted">
          エクササイズ名
        </label>
        <input
          id="exercise-name"
          value={exerciseName}
          onChange={(event) => setExerciseName(event.target.value)}
          placeholder="ベンチプレス"
          className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-sm text-macho-text outline-none transition placeholder:text-macho-muted focus:border-macho-lime"
        />
      </Card>

      <Card className="mt-2.5">
        <p className="mb-2 text-[11px] text-macho-muted">器具</p>
        <div className="flex flex-wrap gap-1.5">
          {equipment.map((item) => (
            <Pill key={item.id} active={selectedEquipmentId === item.id} onClick={() => setSelectedEquipmentId(item.id)}>
              {item.name}
            </Pill>
          ))}
        </div>
      </Card>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <Stepper label="重量 (kg)" value={weight} min={0} step={2.5} onChange={setWeight} />
        <Stepper label="回数" value={reps} min={0} step={1} onChange={setReps} />
        <Stepper label="セット" value={sets} min={1} step={1} onChange={setSets} />
      </div>

      <div className="mt-3.5">
        {exercises.map((exercise, index) => {
          const muscle = muscleGroups.find((group) => group.id === exercise.muscle_group_id);
          const tool = equipment.find((item) => item.id === exercise.equipment_id);
          const subNames = exercise.muscle_sub_group_ids
            .map((id) => muscle?.muscle_sub_groups?.find((group) => group.id === id)?.name)
            .filter(Boolean);
          return (
            <Card key={`${exercise.exercise_name}-${index}`} className="mb-2.5 flex items-center gap-3">
              <div className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: muscle?.color ?? "#D4FF00" }} />
              <div className="flex-1">
                <p className="text-[13px] font-medium">{exercise.exercise_name}</p>
                <p className="text-[11px] text-macho-muted">
                  {tool?.name ?? "器具なし"} ・ {exercise.weight_kg}kg x {exercise.reps}回 x {exercise.sets}set
                </p>
                {subNames.length > 0 && <p className="mt-0.5 text-[11px] text-macho-muted">{subNames.join(" / ")}</p>}
              </div>
              <Check size={18} className="text-macho-lime" />
            </Card>
          );
        })}
      </div>

      {message && <p className="mb-2 text-xs text-[#FF6B6B]">{message}</p>}

      <OutlineButton onClick={addExercise} className="mb-2.5">
        <Plus size={14} className="mr-1 inline align-[-2px]" />
        エクササイズを追加
      </OutlineButton>
      <PrimaryButton onClick={submitWorkout} disabled={isPending || exercises.length === 0}>
        <Check size={16} className="mr-1 inline align-[-3px]" />
        {isPending ? "保存中..." : "ワークアウトを保存"}
      </PrimaryButton>
    </>
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
          className="flex h-7 w-7 items-center justify-center rounded-full border border-macho-border bg-macho-surface text-macho-muted hover:text-macho-text"
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
          className="flex h-7 w-7 items-center justify-center rounded-full border border-macho-border bg-macho-surface text-macho-muted hover:text-macho-text"
        >
          <Plus size={14} />
        </button>
      </div>
    </Card>
  );
}
