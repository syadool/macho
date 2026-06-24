import { EXPERIENCE_LEVEL_LABELS, TRAINING_GOAL_LABELS } from "@/lib/constants";
import type { Equipment, MuscleGroup, UserProfile } from "@/lib/types";

export type PromptInput = {
  profile: UserProfile;
  targetMuscleGroupIds: string[];
  theme: string | null;
  recentWorkoutsSummary: string;
  muscleGroups: MuscleGroup[];
  equipment: Equipment[];
};

export const SUGGESTION_RESPONSE_SCHEMA = {
  type: "object",
  required: ["overall_comment", "exercises"],
  properties: {
    overall_comment: { type: "string" },
    exercises: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        required: ["exercise_name", "muscle_group_id", "muscle_sub_group_id", "equipment_id", "target_sets", "target_reps", "target_weight_kg", "notes"],
      },
    },
  },
} as const;

export function buildSystemPrompt() {
  return [
    "あなたは筋トレメニュー提案AIです。",
    "ユーザーの目的・レベル・直近の履歴を踏まえて、安全で効果的な次回メニューを提案してください。",
    "- 初心者には複雑すぎる種目を避ける",
    "- 直近で同じ部位を高強度で鍛えていたら回復を考慮する",
    "- 必ず指定されたJSONスキーマで返答する",
    "- 種目数は3〜5種目に収める",
    "- muscle_group_id / muscle_sub_group_id / equipment_id は提示されたIDから選ぶ",
  ].join("\n");
}

export function buildUserPrompt(input: PromptInput) {
  const focusMuscles = formatMuscleList(input.profile.focus_muscle_group_ids, input.muscleGroups);
  const targetMuscles = formatMuscleList(input.targetMuscleGroupIds, input.muscleGroups);
  const masterData = input.muscleGroups
    .map((group) => {
      const subGroups = (group.muscle_sub_groups ?? [])
        .map((subGroup) => `  - ${subGroup.name} (uuid:${subGroup.id})`)
        .join("\n");
      return `- ${group.name} (uuid:${group.id})\n${subGroups || "  - サブカテゴリなし"}`;
    })
    .join("\n");
  const equipment = input.equipment.map((item) => `- ${item.name} (uuid:${item.id})`).join("\n");

  return [
    "# ユーザープロファイル",
    `- 目的: ${input.profile.training_goal ? TRAINING_GOAL_LABELS[input.profile.training_goal] : "未設定"}`,
    `- レベル: ${input.profile.experience_level ? EXPERIENCE_LEVEL_LABELS[input.profile.experience_level] : "未設定"}`,
    `- 週の頻度: ${input.profile.weekly_frequency ?? "未設定"}回`,
    `- 重点部位: ${focusMuscles || "未設定"}`,
    "",
    "# 今回鍛えたい部位",
    targetMuscles,
    "",
    "# 直近2週間のワークアウト履歴",
    input.recentWorkoutsSummary || "記録なし",
    "",
    "# 今日のテーマ (任意)",
    input.theme?.trim() || "指定なし",
    "",
    "# 利用可能な部位ID / サブカテゴリID 一覧",
    masterData,
    "",
    "# 利用可能な器具ID 一覧",
    equipment,
    "",
    "# レスポンス形式",
    JSON.stringify(SUGGESTION_RESPONSE_SCHEMA),
    "",
    "上記を踏まえ、JSON形式でメニューを提案してください。",
  ].join("\n");
}

function formatMuscleList(ids: string[], muscleGroups: MuscleGroup[]) {
  return ids
    .map((id) => {
      const muscle = muscleGroups.find((group) => group.id === id);
      return muscle ? `${muscle.name} (uuid:${muscle.id})` : null;
    })
    .filter((value): value is string => Boolean(value))
    .join(" / ");
}
