"use client";

import { Minus, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Card } from "@/components/ui";
import { PressAndHoldStepperButton } from "@/components/stepper";
import { formatSetsSummary } from "@/lib/sets";
import { shortMuscleName } from "@/lib/constants";
import { transitionFor } from "@/lib/motion";
import type { ExerciseHistoryEntry, MuscleGroup } from "@/lib/types";

export function ModeButton({
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
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      className={`flex h-12 items-center justify-center gap-2 rounded-macho-m border text-sm font-medium transition ${
        active
          ? "border-macho-lime bg-macho-lime/10 text-macho-lime"
          : "border-macho-border bg-macho-card text-macho-muted hover:text-macho-text"
      }`}
    >
      {icon}
      {children}
    </motion.button>
  );
}

export function MuscleGroupGrid({
  groups,
  selectedId,
  onSelect,
}: {
  groups: MuscleGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="grid grid-cols-3 gap-2">
      {groups.map((group) => {
        const active = group.id === selectedId;
        return (
          <motion.button
            key={group.id}
            type="button"
            onClick={() => onSelect(group.id)}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            className={`rounded-macho-m border p-3.5 text-center transition ${
              active ? "border-macho-lime bg-macho-lime/5" : "border-macho-border bg-macho-card hover:border-macho-border-hover"
            }`}
          >
            <span className="mb-1 block text-[22px] font-semibold" style={{ color: group.color }}>
              {shortMuscleName(group.name)}
            </span>
            <span className={`text-[11px] ${active ? "text-macho-lime" : "text-macho-muted"}`}>{group.name_en}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function ExerciseSuggestionList({
  entries,
  onSelect,
  className = "",
}: {
  entries: ExerciseHistoryEntry[];
  onSelect: (entry: ExerciseHistoryEntry) => void;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.ul
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={transitionFor(Boolean(reduced))}
      style={{ transformOrigin: "top" }}
      className={`absolute top-[calc(100%-4px)] z-20 max-h-64 overflow-y-auto rounded-macho-s border border-macho-border bg-macho-surface shadow-lg ${className}`}
    >
      {entries.map((entry) => (
        <li key={entry.exercise_name}>
          <button
            type="button"
            onPointerDown={(event) => { event.preventDefault(); onSelect(entry); }}
            className="flex w-full flex-col items-start gap-0.5 border-b border-macho-border/60 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-macho-card"
          >
            <span className="text-sm text-macho-text">{entry.exercise_name}</span>
            <span className="text-[11px] text-macho-muted">{suggestionSubtitle(entry)}</span>
          </button>
        </li>
      ))}
    </motion.ul>
  );
}

function suggestionSubtitle(entry: ExerciseHistoryEntry) {
  if (entry.exercise_type === "cardio") {
    return entry.last_duration_minutes ? `前回: ${entry.last_duration_minutes}分` : "前回の記録なし";
  }
  if (entry.last_sets.length === 0) return "前回の記録なし";
  return `前回: ${formatSetsSummary(entry.last_sets)}`;
}

export function DurationStepper({
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
        <PressAndHoldStepperButton onStep={() => onChange(Math.max(min, value - step))} ariaLabel={`${label}を減らす`}>
          <Minus size={14} />
        </PressAndHoldStepperButton>
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
        <PressAndHoldStepperButton onStep={() => onChange(value + step)} ariaLabel={`${label}を増やす`}>
          <Plus size={14} />
        </PressAndHoldStepperButton>
      </div>
    </Card>
  );
}
