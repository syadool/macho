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

export type WorkoutExercise = {
  id: string;
  exercise_name: string;
  sort_order: number;
  muscle_groups: MuscleGroup | null;
  muscle_sub_groups?: MuscleSubGroup[];
  equipment: Equipment | null;
  workout_sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  date: string;
  created_at: string;
  workout_exercises: WorkoutExercise[];
};

export type NewExercisePayload = {
  exercise_name: string;
  muscle_group_id: string;
  muscle_sub_group_ids: string[];
  equipment_id: string | null;
  weight_kg: number;
  reps: number;
  sets: number;
};
