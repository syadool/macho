import { getDb, parseJson } from "@/lib/db";
import type { TemplateExercise, TemplateSource, WorkoutTemplate } from "@/lib/types";

type TemplateRow = Omit<WorkoutTemplate, "template_exercises"> & { template_exercises: string };

const TEMPLATE_COLUMNS = `
  t.id, t.name, t.source, t.source_log_id, t.created_at,
  (
    select json_group_array(json(ex.item)) from (
      select json_object(
        'id', e.id,
        'exercise_name', e.exercise_name,
        'muscle_group_id', e.muscle_group_id,
        'muscle_sub_group_id', e.muscle_sub_group_id,
        'equipment_id', e.equipment_id,
        'target_sets', e.target_sets,
        'target_reps', e.target_reps,
        'target_weight_kg', e.target_weight_kg,
        'notes', e.notes,
        'sort_order', e.sort_order,
        'muscle_groups', json((
          select json_object('id', g.id, 'name', g.name, 'name_en', g.name_en, 'color', g.color, 'sort_order', g.sort_order)
          from muscle_groups g where g.id = e.muscle_group_id
        )),
        'muscle_sub_groups', json((
          select json_object('id', s.id, 'muscle_group_id', s.muscle_group_id, 'name', s.name, 'sort_order', s.sort_order)
          from muscle_sub_groups s where s.id = e.muscle_sub_group_id
        )),
        'equipment', json((
          select json_object('id', q.id, 'name', q.name, 'sort_order', q.sort_order)
          from equipment q where q.id = e.equipment_id
        ))
      ) as item
      from template_exercises e
      where e.template_id = t.id
      order by e.sort_order
    ) ex
  ) as template_exercises`;

export async function listTemplates(userId: string, source?: TemplateSource) {
  const sourceClause = source ? "and t.source = ?" : "";
  const { results } = await getDb()
    .prepare(`select ${TEMPLATE_COLUMNS} from workout_templates t where t.user_id = ? ${sourceClause} order by t.created_at desc`)
    .bind(...(source ? [userId, source] : [userId]))
    .all<TemplateRow>();

  return results.map(toTemplate);
}

export async function getTemplate(userId: string, templateId: string) {
  const row = await getDb()
    .prepare(`select ${TEMPLATE_COLUMNS} from workout_templates t where t.user_id = ? and t.id = ?`)
    .bind(userId, templateId)
    .first<TemplateRow>();

  return row ? toTemplate(row) : null;
}

export async function deleteTemplate(userId: string, templateId: string) {
  await getDb().prepare("delete from workout_templates where id = ? and user_id = ?").bind(templateId, userId).run();
}

function toTemplate(row: TemplateRow): WorkoutTemplate {
  return {
    ...row,
    source: row.source as TemplateSource,
    template_exercises: parseJson<TemplateExercise[]>(row.template_exercises, [])
      .map((exercise) => ({
        ...exercise,
        muscle_groups: exercise.muscle_groups ?? null,
        muscle_sub_groups: exercise.muscle_sub_groups ?? null,
        equipment: exercise.equipment ?? null,
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}
