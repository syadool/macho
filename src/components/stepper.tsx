"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { transitionFor } from "@/lib/motion";

export function PressAndHoldStepperButton({ onStep, disabled, ariaLabel, children }: { onStep: () => void; disabled?: boolean; ariaLabel: string; children: React.ReactNode }) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointerClick = useRef(false);
  const reduced = useReducedMotion();
  const clear = () => { if (hold.current) clearTimeout(hold.current); if (repeat.current) clearInterval(repeat.current); hold.current = null; repeat.current = null; };
  useEffect(() => () => clear(), []);
  return <motion.button type="button" disabled={disabled} aria-label={ariaLabel} whileTap={reduced || disabled ? undefined : { scale: 0.97 }} onPointerDown={(event: PointerEvent<HTMLButtonElement>) => { if (disabled) return; pointerClick.current = true; event.currentTarget.setPointerCapture(event.pointerId); onStep(); hold.current = setTimeout(() => { repeat.current = setInterval(onStep, 120); setTimeout(() => { if (repeat.current) { clearInterval(repeat.current); repeat.current = setInterval(onStep, 60); } }, 700); }, 300); }} onPointerUp={clear} onPointerCancel={clear} onPointerLeave={clear} onClick={(event: MouseEvent<HTMLButtonElement>) => { if (pointerClick.current) { pointerClick.current = false; event.preventDefault(); return; } onStep(); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-macho-border bg-macho-surface text-macho-muted hover:text-macho-text disabled:opacity-30">{children}</motion.button>;
}

export function PulsingNumber({ value, className }: { value: number; className: string }) {
  const reduced = useReducedMotion();
  return <motion.span key={value} initial={reduced ? false : { scale: 1 }} animate={reduced ? undefined : { scale: [1, 1.06, 1] }} transition={transitionFor(Boolean(reduced))} className={className}>{value}</motion.span>;
}
