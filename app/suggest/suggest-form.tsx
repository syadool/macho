"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save, Sparkles, X } from "lucide-react";
import { Card, OutlineButton, Pill, PrimaryButton } from "@/components/ui";
import type { MuscleGroup, SuggestionResult, UserProfile } from "@/lib/types";
import { saveSuggestionAsTemplateAction } from "../templates/actions";

export function SuggestForm({
  profile,
  muscleGroups,
}: {
  profile: UserProfile;
  muscleGroups: MuscleGroup[];
}) {
  const router = useRouter();
  const [targetIds, setTargetIds] = useState<string[]>(profile.focus_muscle_group_ids.length > 0 ? profile.focus_muscle_group_ids : [muscleGroups[0]?.id ?? ""]);
  const [theme, setTheme] = useState("");
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleTarget(id: string) {
    setTargetIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function generate(confirmRegenerate = false) {
    if (targetIds.length === 0) {
      setError("鍛えたい部位を1つ以上選択してください。");
      return;
    }
    if (confirmRegenerate && !window.confirm("再生成すると利用回数を消費します。続けますか？")) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_muscle_group_ids: targetIds, theme }),
      });

      if (!response.ok) {
        setError(await mapError(response));
        return;
      }

      setSuggestion((await response.json()) as SuggestionResult);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  function saveTemplate() {
    if (!suggestion) return;
    const name = window.prompt("テンプレート名", `AI提案 - ${new Date().toLocaleDateString("ja-JP")}`);
    if (!name) return;

    startTransition(async () => {
      const result = await saveSuggestionAsTemplateAction({
        name,
        source_log_id: suggestion.suggestion_id,
        exercises: suggestion.exercises,
      });

      if (result.ok && result.templateId) {
        router.push(`/templates/${result.templateId}`);
        router.refresh();
      } else {
        setError(result.message ?? "テンプレート保存に失敗しました。");
      }
    });
  }

  return (
    <section className="mt-4 space-y-3">
      <Card>
        <p className="mb-2 text-sm font-medium">鍛えたい部位</p>
        <div className="flex flex-wrap gap-1.5">
          {muscleGroups.map((group) => (
            <Pill key={group.id} active={targetIds.includes(group.id)} onClick={() => toggleTarget(group.id)}>
              {group.name}
            </Pill>
          ))}
        </div>
      </Card>

      <Card>
        <label htmlFor="suggest-theme" className="mb-1.5 block text-[11px] text-macho-muted">
          今日のテーマ
        </label>
        <input
          id="suggest-theme"
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          placeholder="軽め、時間がない、ハードに など"
          className="w-full rounded-[10px] border border-macho-border bg-macho-surface px-3.5 py-3 text-sm text-macho-text outline-none transition placeholder:text-macho-muted focus:border-macho-lime"
        />
      </Card>

      {error && <p className="text-xs text-[#FF6B6B]">{error}</p>}

      <PrimaryButton onClick={() => generate(false)} disabled={loading || targetIds.length === 0}>
        <Sparkles size={16} className="mr-1 inline align-[-3px]" />
        {loading ? "生成中..." : "提案を生成"}
      </PrimaryButton>

      {suggestion && (
        <section className="space-y-2.5">
          <Card>
            <p className="text-sm font-medium">{suggestion.overall_comment}</p>
            <p className="mt-2 text-xs text-macho-muted">
              残り 今日 {suggestion.usage.remaining_today}回 / 月 {suggestion.usage.remaining_this_month}回
            </p>
          </Card>

          {suggestion.exercises.map((exercise, index) => (
            <Card key={`${exercise.exercise_name}-${index}`}>
              <p className="text-sm font-semibold">{exercise.exercise_name}</p>
              <p className="mt-1 text-xs font-medium text-macho-lime">
                {exercise.target_sets}set x {exercise.target_reps}回
                {exercise.target_weight_kg !== null ? ` @ ${exercise.target_weight_kg}kg` : ""}
              </p>
              {exercise.notes && <p className="mt-1 text-xs text-macho-muted">{exercise.notes}</p>}
            </Card>
          ))}

          <div className="grid grid-cols-3 gap-2">
            <OutlineButton onClick={saveTemplate} disabled={isPending}>
              <Save size={14} className="mr-1 inline align-[-2px]" />
              保存
            </OutlineButton>
            <OutlineButton onClick={() => generate(true)} disabled={loading}>
              <RotateCcw size={14} className="mr-1 inline align-[-2px]" />
              再生成
            </OutlineButton>
            <PrimaryButton onClick={() => setSuggestion(null)}>
              <X size={14} className="mr-1 inline align-[-2px]" />
              閉じる
            </PrimaryButton>
          </div>
        </section>
      )}
    </section>
  );
}

async function mapError(response: Response) {
  if (response.status === 403) return "AI提案はまだ利用できません。";
  if (response.status === 429) return "利用上限に達しました。時間をおいて再度お試しください。";
  if (response.status === 503) return "今月の全体利用上限に達しました。";

  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? "提案生成に失敗しました。";
  } catch {
    return "提案生成に失敗しました。";
  }
}
