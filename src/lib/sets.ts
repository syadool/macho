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
