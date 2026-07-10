export const DASHBOARD_RANGES = ["today", "week", "year", "all"] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
export type HistoryMuscle = "all" | "cardio" | string;

export function parseDashboardRange(value?: string): DashboardRange {
  return DASHBOARD_RANGES.includes(value as DashboardRange) ? (value as DashboardRange) : "today";
}

export function parseHistoryMuscle(value?: string): HistoryMuscle {
  return value && value !== "all" ? value : "all";
}
