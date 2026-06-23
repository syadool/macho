import type { Equipment, MuscleGroup } from "@/lib/types";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "胸",
    name_en: "Chest",
    color: "#FF6B6B",
    sort_order: 1,
    muscle_sub_groups: [
      { id: "11111111-1111-1111-1111-111111111101", muscle_group_id: "11111111-1111-1111-1111-111111111111", name: "大胸筋上部", sort_order: 1 },
      { id: "11111111-1111-1111-1111-111111111102", muscle_group_id: "11111111-1111-1111-1111-111111111111", name: "大胸筋中部", sort_order: 2 },
      { id: "11111111-1111-1111-1111-111111111103", muscle_group_id: "11111111-1111-1111-1111-111111111111", name: "大胸筋下部", sort_order: 3 },
    ],
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "背中",
    name_en: "Back",
    color: "#4ECDC4",
    sort_order: 2,
    muscle_sub_groups: [
      { id: "22222222-2222-2222-2222-222222222201", muscle_group_id: "22222222-2222-2222-2222-222222222222", name: "広背筋", sort_order: 1 },
      { id: "22222222-2222-2222-2222-222222222202", muscle_group_id: "22222222-2222-2222-2222-222222222222", name: "僧帽筋", sort_order: 2 },
      { id: "22222222-2222-2222-2222-222222222203", muscle_group_id: "22222222-2222-2222-2222-222222222222", name: "脊柱起立筋", sort_order: 3 },
    ],
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "肩",
    name_en: "Shoulder",
    color: "#A78BFA",
    sort_order: 3,
    muscle_sub_groups: [
      { id: "33333333-3333-3333-3333-333333333301", muscle_group_id: "33333333-3333-3333-3333-333333333333", name: "三角筋前部", sort_order: 1 },
      { id: "33333333-3333-3333-3333-333333333302", muscle_group_id: "33333333-3333-3333-3333-333333333333", name: "三角筋中部", sort_order: 2 },
      { id: "33333333-3333-3333-3333-333333333303", muscle_group_id: "33333333-3333-3333-3333-333333333333", name: "三角筋後部", sort_order: 3 },
    ],
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "腕",
    name_en: "Arms",
    color: "#F59E0B",
    sort_order: 4,
    muscle_sub_groups: [
      { id: "44444444-4444-4444-4444-444444444401", muscle_group_id: "44444444-4444-4444-4444-444444444444", name: "上腕二頭筋", sort_order: 1 },
      { id: "44444444-4444-4444-4444-444444444402", muscle_group_id: "44444444-4444-4444-4444-444444444444", name: "上腕三頭筋", sort_order: 2 },
      { id: "44444444-4444-4444-4444-444444444403", muscle_group_id: "44444444-4444-4444-4444-444444444444", name: "前腕", sort_order: 3 },
    ],
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    name: "脚",
    name_en: "Legs",
    color: "#34D399",
    sort_order: 5,
    muscle_sub_groups: [
      { id: "55555555-5555-5555-5555-555555555501", muscle_group_id: "55555555-5555-5555-5555-555555555555", name: "大腿四頭筋", sort_order: 1 },
      { id: "55555555-5555-5555-5555-555555555502", muscle_group_id: "55555555-5555-5555-5555-555555555555", name: "ハムストリング", sort_order: 2 },
      { id: "55555555-5555-5555-5555-555555555503", muscle_group_id: "55555555-5555-5555-5555-555555555555", name: "臀筋", sort_order: 3 },
      { id: "55555555-5555-5555-5555-555555555504", muscle_group_id: "55555555-5555-5555-5555-555555555555", name: "ふくらはぎ", sort_order: 4 },
    ],
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    name: "腹",
    name_en: "Abs",
    color: "#60A5FA",
    sort_order: 6,
    muscle_sub_groups: [
      { id: "66666666-6666-6666-6666-666666666601", muscle_group_id: "66666666-6666-6666-6666-666666666666", name: "腹直筋", sort_order: 1 },
      { id: "66666666-6666-6666-6666-666666666602", muscle_group_id: "66666666-6666-6666-6666-666666666666", name: "腹斜筋", sort_order: 2 },
    ],
  },
];

export const EQUIPMENT: Equipment[] = [
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", name: "バーベル", sort_order: 1 },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", name: "ダンベル", sort_order: 2 },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", name: "マシン", sort_order: 3 },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4", name: "ケーブル", sort_order: 4 },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5", name: "自重", sort_order: 5 },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6", name: "EZバー", sort_order: 6 },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7", name: "スミスマシン", sort_order: 7 },
];

export function shortMuscleName(name: string) {
  return name === "背中" ? "背" : name;
}
