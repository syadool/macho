"use client";

import { Minus, Plus, X } from "lucide-react";
import { Card, OutlineButton } from "@/components/ui";
import type { NewWorkoutSetPayload } from "@/lib/types";

export function formatSetsSummary(sets: NewWorkoutSetPayload[] | undefined) {
  if (!sets || sets.length === 0) return "";
  const allSame = sets.every((set) => set.weight_kg === sets[0].weight_kg && set.reps === sets[0].reps);
  if (allSame) {
    return `${formatWeight(sets[0].weight_kg)}kg x ${sets[0].reps}回 x ${sets.length}set`;
  }
  return sets.map((set) => `${formatWeight(set.weight_kg)}kg×${set.reps}`).join(" / ");
}

export function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

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
    <Card className="flex items-center gap-2 p-2.5">
      <span className="w-7 shrink-0 text-center text-[13px] font-semibold text-macho-muted">{index + 1}</span>
      <div className="flex-1">
        <MiniStepper label="kg" value={row.weight_kg} min={0} step={2.5} onChange={(value) => onChange({ weight_kg: value })} />
      </div>
      <div className="flex-1">
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
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-macho-border bg-macho-surface text-macho-muted hover:text-macho-text"
        aria-label={`${label}を減らす`}
      >
        <Minus size={14} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          className="w-full min-w-0 bg-transparent text-center font-display text-[20px] leading-none tracking-[0.04em] text-macho-lime outline-none"
          aria-label={label}
        />
        <span className="text-[10px] text-macho-muted">{label}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-macho-border bg-macho-surface text-macho-muted hover:text-macho-text"
        aria-label={`${label}を増やす`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
