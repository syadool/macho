"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Card, Pill, PrimaryButton } from "@/components/ui";
import { EXPERIENCE_LEVEL_LABELS, TRAINING_GOAL_LABELS } from "@/lib/constants";
import type { ExperienceLevel, MuscleGroup, TrainingGoal, UserProfile } from "@/lib/types";
import { saveProfile } from "./actions";

const TRAINING_GOALS: TrainingGoal[] = ["hypertrophy", "strength", "fat_loss", "maintenance"];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];

export function ProfileForm({
  profile,
  muscleGroups,
}: {
  profile: UserProfile | null;
  muscleGroups: MuscleGroup[];
}) {
  const router = useRouter();
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
    startTransition(async () => {
      const result = await saveProfile({
        training_goal: trainingGoal,
        experience_level: experienceLevel,
        weekly_frequency: weeklyFrequency,
        focus_muscle_group_ids: focusIds,
      });
      setMessage(result.ok ? "保存しました。" : result.message ?? "保存に失敗しました。");
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="mt-4 space-y-3">
      <Card>
        <p className="mb-2 text-sm font-medium">目的</p>
        <div className="grid grid-cols-2 gap-1.5">
          {TRAINING_GOALS.map((goal) => (
            <button
              key={goal}
              type="button"
              onClick={() => setTrainingGoal(goal)}
              className={`rounded-[12px] border px-3 py-3 text-sm font-medium transition ${
                trainingGoal === goal ? "border-macho-lime bg-macho-lime/10 text-macho-lime" : "border-macho-border bg-macho-surface text-macho-muted"
              }`}
            >
              {TRAINING_GOAL_LABELS[goal]}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-medium">レベル</p>
        <div className="grid grid-cols-3 gap-1.5">
          {EXPERIENCE_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setExperienceLevel(level)}
              className={`rounded-[12px] border px-2 py-3 text-xs font-medium transition ${
                experienceLevel === level ? "border-macho-lime bg-macho-lime/10 text-macho-lime" : "border-macho-border bg-macho-surface text-macho-muted"
              }`}
            >
              {EXPERIENCE_LEVEL_LABELS[level]}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-medium">週の頻度</p>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, index) => index + 1).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setWeeklyFrequency(count)}
              className={`h-10 rounded-[12px] border text-sm font-semibold transition ${
                weeklyFrequency === count ? "border-macho-lime bg-macho-lime/10 text-macho-lime" : "border-macho-border bg-macho-surface text-macho-muted"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-medium">重点部位</p>
        <div className="flex flex-wrap gap-1.5">
          {muscleGroups.map((group) => (
            <Pill key={group.id} active={focusIds.includes(group.id)} onClick={() => toggleFocus(group.id)}>
              {group.name}
            </Pill>
          ))}
        </div>
      </Card>

      {message && <p className="text-xs text-macho-muted">{message}</p>}

      <PrimaryButton onClick={submit} disabled={isPending}>
        <Check size={16} className="mr-1 inline align-[-3px]" />
        {isPending ? "保存中..." : "保存する"}
      </PrimaryButton>
    </section>
  );
}
