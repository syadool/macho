import { getDb, newId, nowIso, parseJson } from "@/lib/db";
import type { Equipment, MuscleGroup, MuscleSubGroup, Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";
import type { WorkoutRpcExercisePayload } from "@/lib/workout-input";

type WorkoutRow = {
  id: string;
  date: string;
  created_at: string;
  updated_at: string;
  exercises: string;
};

type ExerciseJson = Omit<WorkoutExercise, "muscle_sub_groups" | "workout_sets"> & {
  muscle_sub_groups: MuscleSubGroup[] | null;
  workout_sets: WorkoutSet[] | null;
};

// workouts 1行ごとに、種目・部位・器具・セットをJSONで埋め込んで返す（旧PostgRESTのネストselect相当）。
const WORKOUT_COLUMNS = `
  w.id, w.date, w.created_at, w.updated_at,
  (
    select json_group_array(json(ex.item)) from (
      select json_object(
        'id', e.id,
        'exercise_name', e.exercise_name,
        'exercise_type', e.exercise_type,
        'duration_minutes', e.duration_minutes,
        'distance_km', e.distance_km,
        'calories', e.calories,
        'sort_order', e.sort_order,
        'muscle_groups', json((
          select json_object('id', g.id, 'name', g.name, 'name_en', g.name_en, 'color', g.color, 'sort_order', g.sort_order)
          from muscle_groups g where g.id = e.muscle_group_id
        )),
        'muscle_sub_groups', json((
          select json_group_array(json_object('id', s.id, 'muscle_group_id', s.muscle_group_id, 'name', s.name, 'sort_order', s.sort_order))
          from workout_exercise_sub_groups x join muscle_sub_groups s on s.id = x.muscle_sub_group_id
          where x.workout_exercise_id = e.id
        )),
        'equipment', json((
          select json_object('id', q.id, 'name', q.name, 'sort_order', q.sort_order)
          from equipment q where q.id = e.equipment_id
        )),
        'workout_sets', json((
          select json_group_array(json_object('id', ws.id, 'set_number', ws.set_number, 'weight_kg', ws.weight_kg, 'reps', ws.reps))
          from workout_sets ws where ws.workout_exercise_id = e.id
        ))
      ) as item
      from workout_exercises e
      where e.workout_id = w.id
      order by e.sort_order
    ) ex
  ) as exercises`;

export async function listWorkouts(userId: string, options: { limit?: number; fromDate?: string } = {}) {
  const conditions = ["w.user_id = ?"];
  const params: unknown[] = [userId];

  if (options.fromDate) {
    conditions.push("w.date >= ?");
    params.push(options.fromDate);
  }

  let limitClause = "";
  if (options.limit !== undefined) {
    limitClause = "limit ?";
    params.push(options.limit);
  }

  const { results } = await getDb()
    .prepare(
      `select ${WORKOUT_COLUMNS} from workouts w
      where ${conditions.join(" and ")}
      order by w.date desc, w.created_at desc
      ${limitClause}`,
    )
    .bind(...params)
    .all<WorkoutRow>();

  return results.map(toWorkout);
}

export async function getWorkout(userId: string, workoutId: string) {
  const row = await getDb()
    .prepare(`select ${WORKOUT_COLUMNS} from workouts w where w.user_id = ? and w.id = ?`)
    .bind(userId, workoutId)
    .first<WorkoutRow>();

  return row ? toWorkout(row) : null;
}

/** 旧 create_workout_with_details RPC。D1のbatchは1トランザクションで実行される。 */
export async function createWorkout(userId: string, date: string, exercises: WorkoutRpcExercisePayload[]) {
  const db = getDb();
  const workoutId = newId();
  const now = nowIso();

  await db.batch([
    db
      .prepare("insert into workouts (id, user_id, date, created_at, updated_at) values (?, ?, ?, ?, ?)")
      .bind(workoutId, userId, date, now, now),
    ...buildExerciseStatements(db, workoutId, exercises),
  ]);

  return workoutId;
}

/**
 * 旧 update_workout_with_details RPC。
 * expectedUpdatedAt が一致した場合だけ updated_at を新しい値に書き換え、
 * 以降の削除・挿入はすべて「その新しい値になっていること」を条件にする。
 * 一致しなければ何も変更されない。
 */
export async function updateWorkout(
  userId: string,
  workoutId: string,
  date: string,
  exercises: WorkoutRpcExercisePayload[],
  expectedUpdatedAt: string,
): Promise<"ok" | "modified"> {
  const db = getDb();
  const nextUpdatedAt = uniqueTimestamp(expectedUpdatedAt);
  const guard = { workoutId, userId, updatedAt: nextUpdatedAt };

  const [updateResult] = await db.batch([
    db
      .prepare("update workouts set date = ?, updated_at = ? where id = ? and user_id = ? and updated_at = ?")
      .bind(date, nextUpdatedAt, workoutId, userId, expectedUpdatedAt),
    db
      .prepare(`delete from workout_exercises where workout_id = ? and ${GUARD_SQL}`)
      .bind(workoutId, ...guardParams(guard)),
    ...buildExerciseStatements(db, workoutId, exercises, guard),
  ]);

  return updateResult.meta.changes === 1 ? "ok" : "modified";
}

const GUARD_SQL = "exists (select 1 from workouts where id = ? and user_id = ? and updated_at = ?)";

type Guard = { workoutId: string; userId: string; updatedAt: string };

function guardParams(guard: Guard) {
  return [guard.workoutId, guard.userId, guard.updatedAt];
}

// 行数に関係なく文の数を一定にするため、行データはJSON 1パラメータで渡して json_each で展開する
// （D1は1呼び出しあたりのクエリ数と1文あたりのバインド数に上限がある）。
function buildExerciseStatements(db: D1Database, workoutId: string, exercises: WorkoutRpcExercisePayload[], guard?: Guard) {
  const exerciseRows: unknown[] = [];
  const subGroupRows: unknown[] = [];
  const setRows: unknown[] = [];

  exercises.forEach((exercise, index) => {
    const exerciseId = newId();
    const isStrength = exercise.exercise_type === "strength";
    const subGroupIds = isStrength ? exercise.muscle_sub_group_ids : [];

    exerciseRows.push({
      id: exerciseId,
      exercise_name: exercise.exercise_name,
      exercise_type: exercise.exercise_type,
      muscle_group_id: isStrength ? exercise.muscle_group_id : null,
      muscle_sub_group_id: subGroupIds[0] ?? null,
      equipment_id: exercise.equipment_id,
      duration_minutes: exercise.duration_minutes,
      distance_km: exercise.distance_km,
      calories: exercise.calories,
      sort_order: index + 1,
    });

    for (const subGroupId of subGroupIds) {
      subGroupRows.push({ workout_exercise_id: exerciseId, muscle_sub_group_id: subGroupId });
    }

    if (!isStrength) return;
    for (const set of exercise.sets) {
      setRows.push({ id: newId(), workout_exercise_id: exerciseId, set_number: set.set_number, weight_kg: set.weight_kg, reps: set.reps });
    }
  });

  const where = guard ? `where ${GUARD_SQL}` : "where true";
  const extra = guard ? guardParams(guard) : [];
  const field = (name: string) => `json_extract(value, '$.${name}')`;

  return [
    db
      .prepare(
        `insert into workout_exercises (
          id, workout_id, exercise_name, exercise_type, muscle_group_id, muscle_sub_group_id, equipment_id,
          duration_minutes, distance_km, calories, sort_order
        )
        select ${field("id")}, ?, ${field("exercise_name")}, ${field("exercise_type")}, ${field("muscle_group_id")},
          ${field("muscle_sub_group_id")}, ${field("equipment_id")}, ${field("duration_minutes")}, ${field("distance_km")},
          ${field("calories")}, ${field("sort_order")}
        from json_each(?) ${where}`,
      )
      .bind(workoutId, JSON.stringify(exerciseRows), ...extra),
    db
      .prepare(
        `insert into workout_exercise_sub_groups (workout_exercise_id, muscle_sub_group_id)
        select ${field("workout_exercise_id")}, ${field("muscle_sub_group_id")}
        from json_each(?) ${where}
        on conflict do nothing`,
      )
      .bind(JSON.stringify(subGroupRows), ...extra),
    db
      .prepare(
        `insert into workout_sets (id, workout_exercise_id, set_number, weight_kg, reps)
        select ${field("id")}, ${field("workout_exercise_id")}, ${field("set_number")}, ${field("weight_kg")}, ${field("reps")}
        from json_each(?) ${where}`,
      )
      .bind(JSON.stringify(setRows), ...extra),
  ];
}

/** 楽観ロック用。直前の値と必ず異なり、同一ミリ秒の衝突も避けられるようマイクロ秒部分を乱数で埋める。 */
function uniqueTimestamp(previous: string) {
  for (;;) {
    const micros = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    const value = nowIso().replace("Z", `${micros}Z`);
    if (value !== previous) return value;
  }
}

function toWorkout(row: WorkoutRow): Workout {
  const exercises = parseJson<ExerciseJson[]>(row.exercises, []);

  return {
    id: row.id,
    date: row.date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    workout_exercises: exercises
      .map((exercise) => ({
        ...exercise,
        muscle_groups: (exercise.muscle_groups as MuscleGroup | null) ?? null,
        equipment: (exercise.equipment as Equipment | null) ?? null,
        muscle_sub_groups: (exercise.muscle_sub_groups ?? []).sort((a, b) => a.sort_order - b.sort_order),
        workout_sets: (exercise.workout_sets ?? []).sort((a, b) => a.set_number - b.set_number),
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}
