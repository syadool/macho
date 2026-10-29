import { getDb, parseJson } from "@/lib/db";
import type { Equipment, MuscleGroup, MuscleSubGroup } from "@/lib/types";

export async function getMasterData(): Promise<{ muscleGroups: MuscleGroup[]; equipment: Equipment[] }> {
  const db = getDb();
  const [muscles, equipment] = await db.batch([
    db.prepare(
      `select g.id, g.name, g.name_en, g.color, g.sort_order,
        (
          select json_group_array(json_object('id', s.id, 'muscle_group_id', s.muscle_group_id, 'name', s.name, 'sort_order', s.sort_order))
          from (select * from muscle_sub_groups where muscle_group_id = g.id order by sort_order) s
        ) as muscle_sub_groups
      from muscle_groups g
      order by g.sort_order`,
    ),
    db.prepare("select id, name, sort_order from equipment order by sort_order"),
  ]);

  return {
    muscleGroups: (muscles.results as Array<Omit<MuscleGroup, "muscle_sub_groups"> & { muscle_sub_groups: string }>).map((group) => ({
      ...group,
      muscle_sub_groups: parseJson<MuscleSubGroup[]>(group.muscle_sub_groups, []).sort((a, b) => a.sort_order - b.sort_order),
    })),
    equipment: equipment.results as Equipment[],
  };
}
