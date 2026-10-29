// Supabase(Postgres) のデータを Cloudflare D1 用の INSERT 文に書き出す。
//
//   SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@<host>:5432/postgres" \
//     node scripts/migrate-from-supabase.mjs migration-data.sql
//   npx wrangler d1 execute macho --remote --file migration-data.sql
//
// - ユーザーIDは auth.users.id をそのまま使う（Stripeのメタデータや既存データと一致させるため）
// - Googleの identity を Better Auth の account 行にするので、既存ユーザーは同じアカウントで再ログインできる
// - セッションとレート制限カウンタは移行しない（全員一度だけ再ログインが必要）
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
const outputPath = process.argv[2] ?? "migration-data.sql";
if (!connectionString) {
  console.error("SUPABASE_DB_URL を設定してください（Supabase Dashboard > Connect > Session pooler の接続文字列）");
  process.exit(1);
}

const ts = (column) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// D1側のテーブルごとに、列をSQLite向けの値へ変換して読み出すクエリ。挿入順は外部キーの依存順。
const TABLES = [
  {
    table: '"user"',
    sql: `select u.id::text as "id",
        coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), u.email) as "name",
        u.email as "email",
        (u.email_confirmed_at is not null)::int as "emailVerified",
        nullif(u.raw_user_meta_data->>'avatar_url', '') as "image",
        ${ts("u.created_at")} as "createdAt",
        ${ts("coalesce(u.updated_at, u.created_at)")} as "updatedAt"
      from auth.users u order by u.created_at`,
  },
  {
    table: "account",
    sql: `select i.provider_id as "accountId", i.provider as "providerId", i.user_id::text as "userId",
        ${ts("coalesce(i.created_at, now())")} as "createdAt", ${ts("coalesce(i.updated_at, i.created_at, now())")} as "updatedAt"
      from auth.identities i where i.provider = 'google' order by i.created_at`,
    map: (row) => ({ id: randomUUID(), ...row }),
  },
  {
    table: "user_profiles",
    sql: `select user_id::text, training_goal, experience_level, weekly_frequency,
        to_json(coalesce(focus_muscle_group_ids, '{}'))::text as focus_muscle_group_ids,
        ai_suggestion_enabled::int, onboarding_completed::int, ${ts("created_at")} as created_at, ${ts("updated_at")} as updated_at,
        subscription_tier, stripe_customer_id, subscription_status, subscription_id,
        ${ts("current_period_end")} as current_period_end, stripe_subscription_event_created
      from public.user_profiles`,
  },
  {
    table: "workouts",
    sql: `select id::text, user_id::text, to_char(date, 'YYYY-MM-DD') as date, ${ts("created_at")} as created_at, ${ts("updated_at")} as updated_at
      from public.workouts order by created_at`,
  },
  {
    table: "workout_exercises",
    sql: `select id::text, workout_id::text, exercise_name, muscle_group_id::text, muscle_sub_group_id::text, equipment_id::text,
        sort_order, exercise_type, duration_minutes, distance_km::float8 as distance_km, calories
      from public.workout_exercises`,
  },
  {
    table: "workout_exercise_sub_groups",
    sql: `select workout_exercise_id::text, muscle_sub_group_id::text, ${ts("created_at")} as created_at from public.workout_exercise_sub_groups`,
  },
  {
    table: "workout_sets",
    sql: `select id::text, workout_exercise_id::text, set_number, weight_kg::float8 as weight_kg, reps, ${ts("created_at")} as created_at
      from public.workout_sets`,
  },
  {
    table: "ai_suggestion_logs",
    sql: `select id::text, user_id::text, input_hash, request_payload::text, response_payload::text, prompt_tokens, completion_tokens,
        total_tokens, cost_usd::float8 as cost_usd, status, error_message, ${ts("created_at")} as created_at
      from public.ai_suggestion_logs order by created_at`,
  },
  {
    table: "workout_templates",
    sql: `select id::text, user_id::text, name, source, source_log_id::text, ${ts("created_at")} as created_at from public.workout_templates`,
  },
  {
    table: "template_exercises",
    sql: `select id::text, template_id::text, exercise_name, muscle_group_id::text, muscle_sub_group_id::text, equipment_id::text,
        target_sets, target_reps, target_weight_kg::float8 as target_weight_kg, notes, sort_order
      from public.template_exercises`,
  },
  {
    table: "subscription_events",
    sql: `select id::text, stripe_event_id, event_type, user_id::text, payload::text, ${ts("processed_at")} as processed_at,
        ${ts("created_at")} as created_at, ${ts("processing_started_at")} as processing_started_at
      from public.subscription_events order by created_at`,
  },
  {
    table: "api_keys",
    sql: `select id::text, user_id::text, key_hash, key_prefix::text, name, ${ts("created_at")} as created_at, ${ts("last_used_at")} as last_used_at
      from public.api_keys`,
  },
];

function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number: ${value}`);
    return String(value);
  }
  if (typeof value === "bigint") return value.toString();
  return `'${String(value).replaceAll("'", "''")}'`;
}

const client = new pg.Client({ connectionString });
// int8 (stripe_subscription_event_created) を数値として受け取る
pg.types.setTypeParser(20, (value) => Number(value));
await client.connect();

try {
  const missingEmail = await client.query("select id from auth.users where email is null or email = ''");
  if (missingEmail.rowCount > 0) {
    throw new Error(`メールアドレスの無いユーザーがいます（Better Authでは必須）: ${missingEmail.rows.map((row) => row.id).join(", ")}`);
  }

  const lines = [
    "-- Generated by scripts/migrate-from-supabase.mjs",
    `-- ${new Date().toISOString()}`,
    "-- 空のD1（migrations/適用済み）に対して実行してください。",
    "",
  ];

  for (const { table, sql, map } of TABLES) {
    const { rows } = await client.query(sql);
    console.log(`${table}: ${rows.length} rows`);
    for (const rawRow of rows) {
      const row = map ? map(rawRow) : rawRow;
      const columns = Object.keys(row);
      lines.push(
        `INSERT INTO ${table} (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns.map((column) => literal(row[column])).join(", ")});`,
      );
    }
    lines.push("");
  }

  writeFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log(`\nWrote ${outputPath}`);
} finally {
  await client.end();
}
