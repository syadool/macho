export type MuscleGroup = {
  id: string;
  name: string;
  name_en: string;
  color: string;
  sort_order: number;
  muscle_sub_groups?: MuscleSubGroup[];
};

export type MuscleSubGroup = {
  id: string;
  muscle_group_id: string;
  name: string;
  sort_order: number;
};

export type Equipment = {
  id: string;
  name: string;
  sort_order: number;
};

export type WorkoutSet = {
  id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
};

export type NewWorkoutSetPayload = {
  weight_kg: number;
  reps: number;
};

export type ExerciseType = "strength" | "cardio";

export type WorkoutExercise = {
  id: string;
  exercise_name: string;
  exercise_type: ExerciseType;
  sort_order: number;
  muscle_groups: MuscleGroup | null;
  muscle_sub_groups?: MuscleSubGroup[];
  equipment: Equipment | null;
  duration_minutes: number | null;
  distance_km: number | null;
  calories: number | null;
  workout_sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  date: string;
  created_at: string;
  workout_exercises: WorkoutExercise[];
};

export type NewExercisePayload = {
  exercise_type: ExerciseType;
  exercise_name: string;
  muscle_group_id: string | null;
  muscle_sub_group_ids: string[];
  equipment_id: string | null;
  weight_kg: number;
  reps: number;
  sets: number;
  workout_sets?: NewWorkoutSetPayload[];
  duration_minutes: number | null;
  distance_km: number | null;
  calories: number | null;
};

export type TrainingGoal = "hypertrophy" | "strength" | "fat_loss" | "maintenance";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type UserProfile = {
  user_id: string;
  training_goal: TrainingGoal | null;
  experience_level: ExperienceLevel | null;
  weekly_frequency: number | null;
  focus_muscle_group_ids: string[];
  ai_suggestion_enabled: boolean;
  onboarding_completed: boolean;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_id: string | null;
  current_period_end: string | null;
  stripe_subscription_event_created: number | null;
};

export type SubscriptionTier = "free" | "go" | "plus" | "pro";

export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled";

export type TemplateSource = "ai_suggestion" | "manual";

export type TemplateExercise = {
  id: string;
  exercise_name: string;
  muscle_group_id: string | null;
  muscle_sub_group_id: string | null;
  equipment_id: string | null;
  target_sets: number | null;
  target_reps: number | null;
  target_weight_kg: number | null;
  notes: string | null;
  sort_order: number;
  muscle_groups?: MuscleGroup | null;
  muscle_sub_groups?: MuscleSubGroup | null;
  equipment?: Equipment | null;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  source: TemplateSource;
  source_log_id: string | null;
  created_at: string;
  template_exercises: TemplateExercise[];
};

export type SuggestionExercise = Omit<TemplateExercise, "id" | "sort_order" | "muscle_groups" | "muscle_sub_groups" | "equipment"> & {
  muscle_group_id: string;
};

export type SuggestionResult = {
  suggestion_id: string;
  overall_comment: string;
  exercises: SuggestionExercise[];
  usage: AIUsage;
};

export type AIUsage = {
  used_today: number;
  limit_today: number;
  remaining_today: number;
  used_this_month: number;
  limit_this_month: number;
  remaining_this_month: number;
  reset_at: string;
};
