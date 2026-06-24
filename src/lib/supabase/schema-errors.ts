export function isMissingCardioSchemaError(message: string) {
  return (
    message.includes("workout_exercises.exercise_type does not exist") ||
    message.includes("workout_exercises.duration_minutes does not exist") ||
    message.includes("workout_exercises.distance_km does not exist") ||
    message.includes("workout_exercises.calories does not exist") ||
    message.includes("column \"exercise_type\" of relation \"workout_exercises\" does not exist") ||
    message.includes("column \"duration_minutes\" of relation \"workout_exercises\" does not exist") ||
    message.includes("column \"distance_km\" of relation \"workout_exercises\" does not exist") ||
    message.includes("column \"calories\" of relation \"workout_exercises\" does not exist")
  );
}

export function cardioSchemaMigrationMessage() {
  return "有酸素の記録にはDBマイグレーション supabase/migrations/202606240002_cardio_records_and_workout_updates.sql の適用が必要です。現在接続しているSupabaseには有酸素用カラムがまだ反映されていません。";
}
