"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import { Card, OutlineButton, Pill, PrimaryButton } from "@/components/ui";
import type { Equipment, MuscleGroup, NewExercisePayload } from "@/lib/types";
import { shortMuscleName } from "@/lib/constants";
import { saveWorkout } from "./actions";

export function RecordForm({
  muscleGroups,
  equipment,
}: {
  muscleGroups: MuscleGroup[];
  equipment: Equipment[];
}) {
  const router = useRouter();
  const [selectedMuscleId, setSelectedMuscleId] = useState(muscleGroups[0]?.id ?? "");
  const selectedMuscle = useMemo(
    () => muscleGroups.find((group) => group.id === selectedMuscleId) ?? muscleGroups[0],
    [muscleGroups, selectedMuscleId],
  );
  const subGroups = selectedMuscle?.muscle_sub_groups ?? [];
  const [selectedSubId, setSelectedSubId] = useState<string | null>(subGroups[0]?.id ?? null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(equipment[0]?.id ?? null);
  const [exerciseName, setExerciseName] = useState("インクラインベンチプレス");
  const [weight, setWeight] = useState(60);
  const [reps, setReps] = useState(10);
  const [sets, setSets] = useState(3);
  const [exercises, setExercises] = useState<NewExercisePayload[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function chooseMuscle(id: string) {
    const group = muscleGroups.find((item) => item.id === id);
    setSelectedMuscleId(id);
    setSelectedSubId(group?.muscle_sub_groups?.[0]?.id ?? null);
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
        muscle_sub_group_id: selectedSubId,
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
      const result = await saveWorkout(exercises);
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
          <Pill key={subGroup.id} active={selectedSubId === subGroup.id} onClick={() => setSelectedSubId(subGroup.id)}>
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
        <Stepper label="回数" value={reps} min={1} step={1} onChange={setReps} />
        <Stepper label="セット" value={sets} min={1} step={1} onChange={setSets} />
      </div>

      <div className="mt-3.5">
        {exercises.map((exercise, index) => {
          const muscle = muscleGroups.find((group) => group.id === exercise.muscle_group_id);
          const tool = equipment.find((item) => item.id === exercise.equipment_id);
          return (
            <Card key={`${exercise.exercise_name}-${index}`} className="mb-2.5 flex items-center gap-3">
              <div className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: muscle?.color ?? "#D4FF00" }} />
              <div className="flex-1">
                <p className="text-[13px] font-medium">{exercise.exercise_name}</p>
                <p className="text-[11px] text-macho-muted">
                  {tool?.name ?? "器具なし"} ・ {exercise.weight_kg}kg x {exercise.reps}回 x {exercise.sets}set
                </p>
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
        <span className="min-w-7 font-display text-[26px] leading-none tracking-[0.04em] text-macho-lime">{value}</span>
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
