"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Card, OutlineButton, Pill, PrimaryButton } from "@/components/ui";
import { EXPERIENCE_LEVEL_LABELS, TRAINING_GOAL_LABELS } from "@/lib/constants";
import type { ExperienceLevel, MuscleGroup, TrainingGoal, UserProfile } from "@/lib/types";
import { saveOnboarding } from "./actions";

const TRAINING_GOALS: TrainingGoal[] = ["hypertrophy", "strength", "fat_loss", "maintenance"];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];

export function OnboardingForm({
  profile,
  muscleGroups,
}: {
  profile: UserProfile | null;
  muscleGroups: MuscleGroup[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [trainingGoal, setTrainingGoal] = useState<TrainingGoal>(profile?.training_goal ?? "hypertrophy");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(profile?.experience_level ?? "beginner");
  const [weeklyFrequency, setWeeklyFrequency] = useState(profile?.weekly_frequency ?? 3);
  const [focusIds, setFocusIds] = useState<string[]>(profile?.focus_muscle_group_ids ?? []);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleFocus(id: string) {
    setFocusIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function submit() {
    setMessage("");
    startTransition(async () => {
      const result = await saveOnboarding({
        training_goal: trainingGoal,
        experience_level: experienceLevel,
        weekly_frequency: weeklyFrequency,
        focus_muscle_group_ids: focusIds,
      });
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setMessage(result.message ?? "保存に失敗しました。");
      }
    });
  }

  return (
    <section className="pt-2">
      <p className="text-xs font-semibold text-macho-lime">STEP {step}/4</p>
      <h1 className="mt-2 font-display text-[34px] leading-none tracking-[0.04em]">
        {step === 1 && <>目的を<span className="text-macho-lime">設定</span></>}
        {step === 2 && <>レベルを<span className="text-macho-lime">確認</span></>}
        {step === 3 && <>頻度を<span className="text-macho-lime">選択</span></>}
        {step === 4 && <>重点部位を<span className="text-macho-lime">選ぶ</span></>}
      </h1>

      {step === 1 && (
        <div className="mt-5 grid gap-2">
          {TRAINING_GOALS.map((goal) => (
            <ChoiceCard key={goal} active={trainingGoal === goal} onClick={() => setTrainingGoal(goal)}>
              <p className="text-sm font-semibold">{TRAINING_GOAL_LABELS[goal]}</p>
              <p className="mt-1 text-xs text-macho-muted">{describeGoal(goal)}</p>
            </ChoiceCard>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="mt-5 grid gap-2">
          {EXPERIENCE_LEVELS.map((level) => (
            <ChoiceCard key={level} active={experienceLevel === level} onClick={() => setExperienceLevel(level)}>
              <p className="text-sm font-semibold">{EXPERIENCE_LEVEL_LABELS[level]}</p>
              <p className="mt-1 text-xs text-macho-muted">{describeLevel(level)}</p>
            </ChoiceCard>
          ))}
        </div>
      )}

      {step === 3 && (
        <Card className="mt-5">
          <p className="mb-3 text-sm font-medium">週に何回トレーニングしますか？</p>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, index) => index + 1).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setWeeklyFrequency(count)}
                className={`h-12 rounded-[12px] border font-display text-[24px] leading-none tracking-[0.04em] transition ${
                  weeklyFrequency === count ? "border-macho-lime bg-macho-lime/10 text-macho-lime" : "border-macho-border bg-macho-surface text-macho-muted"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="mt-5">
          <p className="mb-3 text-sm font-medium">特に鍛えたい部位</p>
          <div className="flex flex-wrap gap-1.5">
            {muscleGroups.map((group) => (
              <Pill key={group.id} active={focusIds.includes(group.id)} onClick={() => toggleFocus(group.id)}>
                {group.name}
              </Pill>
            ))}
          </div>
        </Card>
      )}

      {message && <p className="mt-3 text-xs text-[#FF6B6B]">{message}</p>}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <OutlineButton onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || isPending}>
          <ArrowLeft size={14} className="mr-1 inline align-[-2px]" />
          戻る
        </OutlineButton>
        {step < 4 ? (
          <PrimaryButton onClick={() => setStep((current) => current + 1)}>次へ</PrimaryButton>
        ) : (
          <PrimaryButton onClick={submit} disabled={isPending}>
            <Check size={16} className="mr-1 inline align-[-3px]" />
            {isPending ? "保存中..." : "はじめる"}
          </PrimaryButton>
        )}
      </div>
    </section>
  );
}

function ChoiceCard({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border p-4 text-left transition ${
        active ? "border-macho-lime bg-macho-lime/10 text-macho-text" : "border-macho-border bg-macho-card text-macho-text hover:border-macho-border-hover"
      }`}
    >
      {children}
    </button>
  );
}

function describeGoal(goal: TrainingGoal) {
  const descriptions: Record<TrainingGoal, string> = {
    hypertrophy: "見た目と筋量を伸ばしたい",
    strength: "扱える重量を伸ばしたい",
    fat_loss: "消費量を意識して絞りたい",
    maintenance: "習慣化して体調を整えたい",
  };
  return descriptions[goal];
}

function describeLevel(level: ExperienceLevel) {
  const descriptions: Record<ExperienceLevel, string> = {
    beginner: "フォームと継続を優先",
    intermediate: "分割やボリュームを調整",
    advanced: "強度管理まで踏み込む",
  };
  return descriptions[level];
}
