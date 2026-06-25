import Link from "next/link";
import { BookOpen, ChevronRight, Settings, Sparkles } from "lucide-react";
import { BottomNav, Card } from "@/components/ui";
import { PhoneShell } from "@/components/phone-shell";
import { getRemainingUsage } from "@/lib/ai/suggest";
import { getAllWorkouts } from "@/lib/data";
import { formatShortDate, toDateInputValue } from "@/lib/date";
import { getUserProfile } from "@/lib/profile";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { primaryMuscle, workoutCardioMinutes, workoutSetCount, workoutSummary, workoutTitle, workoutVolume } from "@/lib/workouts";
import { shortMuscleName } from "@/lib/constants";

const WEEK_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const RANGE_OPTIONS = [
  { value: "today", label: "今日" },
  { value: "week", label: "今週" },
  { value: "year", label: "今年" },
  { value: "all", label: "累計" },
] as const;

type DashboardRange = (typeof RANGE_OPTIONS)[number]["value"];

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { user } = await requireOnboardedUser();
  const [{ range }, workouts, profile] = await Promise.all([searchParams, getAllWorkouts(), getUserProfile()]);
  const aiUsage = await getRemainingUsage(user.id, profile?.subscription_tier ?? "free");
  const activeRange = parseDashboardRange(range);
  const rangeWorkouts = filterWorkoutsByRange(workouts, activeRange);
  const exerciseCount = rangeWorkouts.reduce((total, workout) => total + workout.workout_exercises.length, 0);
  const setCount = rangeWorkouts.reduce((total, workout) => total + workoutSetCount(workout), 0);
  const cardioMinutes = rangeWorkouts.reduce((total, workout) => total + workoutCardioMinutes(workout), 0);
  const volume = rangeWorkouts.reduce((total, workout) => total + workoutVolume(workout), 0);
  const weekly = getWeeklyVolumes(workouts);
  const maxWeekly = Math.max(...weekly.map((item) => item.volume), 1);

  return (
    <PhoneShell nav={<BottomNav active="dashboard" />}>
      <section className="pt-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-[34px] leading-none tracking-[0.04em]">
            今日の<span className="text-macho-lime">ワークアウト</span>
          </h1>
          <Link
            href="/settings/profile"
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-macho-border text-macho-muted transition hover:border-macho-lime hover:text-macho-lime"
            aria-label="プロフィール設定"
          >
            <Settings size={17} />
          </Link>
        </div>
      </section>

      <RangeTabs activeRange={activeRange} />

      <section className="mt-5 grid grid-cols-3 gap-2">
        <StatCard label="記録" value={rangeWorkouts.length || 0} />
        <StatCard label="種目" value={exerciseCount || 0} />
        <StatCard label="セット" value={setCount || 0} />
      </section>

      <Card className="mt-2.5 flex items-center justify-between gap-3 px-3.5 py-3">
        <div>
          <p className="text-[11px] text-macho-muted">{getRangeLabel(activeRange)}のボリューム</p>
          <p className="mt-0.5 font-display text-[32px] leading-none tracking-[0.04em] text-macho-lime">
            {formatVolume(volume)}
            <span className="font-sans text-sm normal-case tracking-normal">kg</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-macho-muted">有酸素</p>
          <p className="mt-1 text-sm font-semibold text-macho-text">{cardioMinutes || 0}min</p>
        </div>
      </Card>

      <Card className="mt-[18px]">
        <p className="mb-3.5 text-[13px] font-medium">今週のアクティビティ</p>
        <div className="flex h-20 items-end gap-1.5">
          {weekly.map((item, index) => {
            const active = item.volume > 0;
            const height = active ? Math.max(18, Math.round((item.volume / maxWeekly) * 68)) : 4;
            return (
              <div key={item.label} className="flex flex-1 flex-col items-center">
                <div
                  className={`mb-1.5 w-full rounded-md ${index % 2 === 0 && active ? "bg-macho-lime" : active ? "bg-macho-lime/25" : "bg-macho-lime/10"}`}
                  style={{ height }}
                />
                <span className="text-[11px] text-macho-muted">{item.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <section className="mt-[18px]">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[13px] font-medium">最近の記録</p>
          <Link href="/history" className="inline-flex items-center text-xs text-macho-lime">
            すべて見る <ChevronRight size={12} />
          </Link>
        </div>

        {workouts.slice(0, 3).map((workout) => {
          const muscle = primaryMuscle(workout);
          return (
            <Card key={workout.id} className="mb-2 flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-base font-semibold"
                style={{ color: muscle?.color ?? "#D4FF00", backgroundColor: `${muscle?.color ?? "#D4FF00"}1f` }}
              >
                {shortMuscleName(muscle?.name ?? "記")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{workoutTitle(workout).replace("トレーニング", "")}</p>
                <p className="truncate text-xs text-macho-muted">{workoutSummary(workout) || "記録なし"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-macho-muted">{formatShortDate(workout.date)}</p>
                <p className="text-xs font-medium text-macho-lime">
                  {workoutSetCount(workout) > 0 ? `${workoutSetCount(workout)}set` : `${workoutCardioMinutes(workout)}min`}
                </p>
              </div>
            </Card>
          );
        })}

        {workouts.length === 0 && <EmptyRecord />}

        <Link href="/templates" className="mt-3 block">
          <Card className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-macho-lime/10 text-macho-lime">
              <BookOpen size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium">テンプレート</p>
              <p className="text-[11px] text-macho-muted">保存したメニューから記録を開始</p>
            </div>
            <ChevronRight size={16} className="text-macho-muted" />
          </Card>
        </Link>

        <Link href="/suggest" className="mt-3 block">
          <Card className={`flex items-center gap-3 ${profile?.ai_suggestion_enabled ? "" : "opacity-55"}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-macho-lime/10 text-macho-lime">
              <Sparkles size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium">AIメニュー提案</p>
              <p className="text-[11px] text-macho-muted">
                {profile?.ai_suggestion_enabled ? "ChatGPTが次回メニューを提案" : "利用準備中"}
              </p>
            </div>
            {profile?.ai_suggestion_enabled && (
              <span className="rounded-full border border-macho-lime/40 px-2 py-1 text-[10px] font-semibold text-macho-lime">
                残り{aiUsage.remaining_this_month}
              </span>
            )}
            <ChevronRight size={16} className="text-macho-muted" />
          </Card>
        </Link>
      </section>
    </PhoneShell>
  );
}

function RangeTabs({ activeRange }: { activeRange: DashboardRange }) {
  return (
    <div className="mt-4 grid grid-cols-4 gap-1 rounded-[14px] border border-macho-border bg-macho-surface p-1">
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={option.value === "today" ? "/dashboard" : `/dashboard?range=${option.value}`}
          className={`flex h-9 items-center justify-center rounded-[10px] text-[12px] font-semibold transition ${
            activeRange === option.value
              ? "bg-macho-lime text-macho-black"
              : "text-macho-muted hover:bg-macho-card hover:text-macho-text"
          }`}
          aria-current={activeRange === option.value ? "page" : undefined}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <Card className="px-1.5 py-3.5 text-center">
      <p className="text-[11px] text-macho-muted">{label}</p>
      <p className="mt-0.5 font-display text-3xl leading-none tracking-[0.04em] text-macho-lime">
        {value}
        {suffix && <span className="font-sans text-sm normal-case tracking-normal">{suffix}</span>}
      </p>
    </Card>
  );
}

function EmptyRecord() {
  return (
    <Card className="mb-2 text-center">
      <p className="text-sm font-medium">まだ記録がありません</p>
      <p className="mt-1 text-xs text-macho-muted">記録タブから今日のワークアウトを保存しましょう。</p>
    </Card>
  );
}

function parseDashboardRange(value: string | undefined): DashboardRange {
  return RANGE_OPTIONS.some((option) => option.value === value) ? (value as DashboardRange) : "today";
}

function getRangeLabel(range: DashboardRange) {
  return RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "今日";
}

function filterWorkoutsByRange(workouts: Awaited<ReturnType<typeof getAllWorkouts>>, range: DashboardRange) {
  const now = new Date();
  const today = toDateInputValue(now);

  if (range === "today") {
    return workouts.filter((workout) => workout.date === today);
  }

  if (range === "week") {
    const monday = getMonday(now);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const start = toDateInputValue(monday);
    const end = toDateInputValue(sunday);
    return workouts.filter((workout) => workout.date >= start && workout.date <= end);
  }

  if (range === "year") {
    return workouts.filter((workout) => workout.date.startsWith(`${now.getFullYear()}-`));
  }

  return workouts;
}

function formatVolume(volume: number) {
  return Number(volume.toFixed(0)).toLocaleString();
}

function getMonday(value: Date) {
  const monday = new Date(value);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return monday;
}

function getWeeklyVolumes(workouts: Awaited<ReturnType<typeof getAllWorkouts>>) {
  const now = new Date();
  const monday = getMonday(now);

  return WEEK_LABELS.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = toDateInputValue(date);
    const volume = workouts.filter((workout) => workout.date === key).reduce((total, workout) => total + workoutVolume(workout), 0);
    return { label, volume };
  });
}
