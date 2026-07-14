"use client";

import { Minus, Plus, X } from "lucide-react";
import { Card, OutlineButton } from "@/components/ui";
import type { NewWorkoutSetPayload } from "@/lib/types";
import { PressAndHoldStepperButton } from "@/components/stepper";

export function SetRowsEditor({
  rows,
  onAdd,
  onRemove,
  onChange,
}: {
  rows: NewWorkoutSetPayload[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<NewWorkoutSetPayload>) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <SetRowInput
          key={index}
          index={index}
          row={row}
          onChange={(patch) => onChange(index, patch)}
          onRemove={() => onRemove(index)}
          removable={rows.length > 1}
        />
      ))}
      <OutlineButton onClick={onAdd} className="!p-2.5 text-[13px]" type="button">
        <Plus size={14} className="mr-1 inline align-[-2px]" />
        セット追加
      </OutlineButton>
    </div>
  );
}

function SetRowInput({
  index,
  row,
  onChange,
  onRemove,
  removable,
}: {
  index: number;
  row: NewWorkoutSetPayload;
  onChange: (patch: Partial<NewWorkoutSetPayload>) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <Card className="grid grid-cols-[1.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 p-2.5">
      <span className="text-center text-[13px] font-semibold text-macho-muted">{index + 1}</span>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <MiniStepper label="kg" value={row.weight_kg} min={0} step={2.5} onChange={(value) => onChange({ weight_kg: value })} />
        <MiniStepper label="回" value={row.reps} min={0} step={1} onChange={(value) => onChange({ reps: value })} />
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!removable}
        aria-label="セットを削除"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-macho-muted transition hover:text-[#FF6B6B] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <X size={16} />
      </button>
    </Card>
  );
}

export function MiniStepper({
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
    <div className="flex min-w-0 items-center justify-center gap-1">
      <PressAndHoldStepperButton onStep={() => onChange(Math.max(min, value - step))} ariaLabel={`${label}を減らす`}>
        <Minus size={14} />
      </PressAndHoldStepperButton>
      <div className="flex shrink-0 flex-col items-center">
        <input type="number" inputMode="decimal" min={min} step={step} value={value} onChange={(event) => updateValue(event.target.value)} className="w-[4.25rem] min-w-[4.25rem] shrink-0 bg-transparent text-center font-display text-display-num text-macho-lime outline-none" aria-label={label} />
        <span className="text-[10px] text-macho-muted">{label}</span>
      </div>
      <PressAndHoldStepperButton onStep={() => onChange(value + step)} ariaLabel={`${label}を増やす`}>
        <Plus size={14} />
      </PressAndHoldStepperButton>
    </div>
  );
}
