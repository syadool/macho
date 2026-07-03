import { requireOnboardedUser } from "@/lib/supabase/server";
import type { Equipment, MuscleGroup, MuscleSubGroup, TemplateExercise, TemplateSource, WorkoutTemplate } from "@/lib/types";

type SupabaseTemplateExercise = Omit<TemplateExercise, "muscle_groups" | "muscle_sub_groups" | "equipment"> & {
  muscle_groups: MuscleGroup | MuscleGroup[] | null;
  muscle_sub_groups: MuscleSubGroup | MuscleSubGroup[] | null;
  equipment: Equipment | Equipment[] | null;
};

type SupabaseTemplate = Omit<WorkoutTemplate, "source" | "template_exercises"> & {
  source: string;
  template_exercises: SupabaseTemplateExercise[];
};

export async function getTemplates(source?: TemplateSource) {
  const { supabase, user } = await requireOnboardedUser();
  let query = supabase
    .from("workout_templates")
    .select(
      "id,name,source,source_log_id,created_at,template_exercises(id,exercise_name,muscle_group_id,muscle_sub_group_id,equipment_id,target_sets,target_reps,target_weight_kg,notes,sort_order,muscle_groups(id,name,name_en,color,sort_order),muscle_sub_groups(id,muscle_group_id,name,sort_order),equipment(id,name,sort_order))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return normalizeTemplates(((data as unknown) as SupabaseTemplate[] | null) ?? []);
}

export async function getTemplateById(id: string) {
  const { supabase, user } = await requireOnboardedUser();
  const { data, error } = await supabase
    .from("workout_templates")
    .select(
      "id,name,source,source_log_id,created_at,template_exercises(id,exercise_name,muscle_group_id,muscle_sub_group_id,equipment_id,target_sets,target_reps,target_weight_kg,notes,sort_order,muscle_groups(id,name,name_en,color,sort_order),muscle_sub_groups(id,muscle_group_id,name,sort_order),equipment(id,name,sort_order))",
    )
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const [template] = normalizeTemplates(data ? [((data as unknown) as SupabaseTemplate)] : []);
  return template ?? null;
}

export async function createTemplate(input: {
  name: string;
  source: TemplateSource;
  source_log_id: string | null;
  exercises: Omit<TemplateExercise, "id" | "sort_order" | "muscle_groups" | "muscle_sub_groups" | "equipment">[];
}) {
  const { supabase } = await requireOnboardedUser();
  const { data, error } = await supabase.rpc("create_template_with_exercises", {
    p_name: input.name,
    p_source: input.source,
    p_source_log_id: input.source_log_id,
    p_exercises: input.exercises,
  });

  if (error) throw new Error(error.message);
  if (typeof data !== "string") throw new Error("テンプレートの作成に失敗しました。");
  return data;
}

export async function deleteTemplate(id: string) {
  const { supabase, user } = await requireOnboardedUser();
  const { error } = await supabase.from("workout_templates").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

function normalizeTemplates(templates: SupabaseTemplate[]): WorkoutTemplate[] {
  return templates.map((template) => ({
    ...template,
    source: template.source as TemplateSource,
    template_exercises: template.template_exercises
      .map((exercise) => ({
        ...exercise,
        muscle_groups: Array.isArray(exercise.muscle_groups) ? exercise.muscle_groups[0] ?? null : exercise.muscle_groups,
        muscle_sub_groups: Array.isArray(exercise.muscle_sub_groups) ? exercise.muscle_sub_groups[0] ?? null : exercise.muscle_sub_groups,
        equipment: Array.isArray(exercise.equipment) ? exercise.equipment[0] ?? null : exercise.equipment,
        target_weight_kg: exercise.target_weight_kg === null ? null : Number(exercise.target_weight_kg),
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}
