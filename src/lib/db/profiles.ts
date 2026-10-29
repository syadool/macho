import { getDb, nowIso, parseJson } from "@/lib/db";
import type { UserProfile } from "@/lib/types";

export type EditableProfileInput = Partial<
  Pick<UserProfile, "training_goal" | "experience_level" | "weekly_frequency" | "focus_muscle_group_ids">
>;

export type SubscriptionFields = Partial<
  Pick<
    UserProfile,
    | "subscription_tier"
    | "subscription_status"
    | "subscription_id"
    | "stripe_customer_id"
    | "current_period_end"
    | "stripe_subscription_event_created"
  >
>;

// ユーザー自身が変更できる列。課金・AIフラグ列はここに含めない（旧 prevent_ai_suggestion_enabled_self_change トリガー相当）。
const EDITABLE_COLUMNS = ["training_goal", "experience_level", "weekly_frequency", "focus_muscle_group_ids"] as const;
const SUBSCRIPTION_COLUMNS = [
  "subscription_tier",
  "subscription_status",
  "subscription_id",
  "stripe_customer_id",
  "current_period_end",
  "stripe_subscription_event_created",
] as const;

type ProfileRow = Omit<UserProfile, "focus_muscle_group_ids" | "ai_suggestion_enabled" | "onboarding_completed"> & {
  focus_muscle_group_ids: string;
  ai_suggestion_enabled: number;
  onboarding_completed: number;
};

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const row = await getDb()
    .prepare(
      `select user_id, training_goal, experience_level, weekly_frequency, focus_muscle_group_ids, ai_suggestion_enabled,
        onboarding_completed, subscription_tier, stripe_customer_id, subscription_status, subscription_id,
        current_period_end, stripe_subscription_event_created
      from user_profiles where user_id = ?`,
    )
    .bind(userId)
    .first<ProfileRow>();

  if (!row) return null;
  return {
    ...row,
    focus_muscle_group_ids: parseJson<string[]>(row.focus_muscle_group_ids, []),
    ai_suggestion_enabled: row.ai_suggestion_enabled === 1,
    onboarding_completed: row.onboarding_completed === 1,
  };
}

export async function upsertEditableProfile(userId: string, input: EditableProfileInput) {
  const columns = EDITABLE_COLUMNS.filter((column) => input[column] !== undefined);
  const values = columns.map((column) =>
    column === "focus_muscle_group_ids" ? JSON.stringify(input[column]) : (input[column] ?? null),
  );
  const assignments = [...columns.map((column) => `${column} = excluded.${column}`), "updated_at = excluded.updated_at"];

  await getDb()
    .prepare(
      `insert into user_profiles (user_id, ${[...columns, "updated_at"].join(", ")})
      values (?, ${[...columns, "updated_at"].map(() => "?").join(", ")})
      on conflict (user_id) do update set ${assignments.join(", ")}`,
    )
    .bind(userId, ...values, nowIso())
    .run();
}

// SQLiteは on conflict より先に挿入候補行のCHECK制約を評価するため、upsertではなくupdateにする
// （プロフィール行はサインアップ時と upsertEditableProfile で必ず作られている）。
export async function markOnboardingCompleted(userId: string) {
  await getDb()
    .prepare("update user_profiles set onboarding_completed = 1, updated_at = ? where user_id = ?")
    .bind(nowIso(), userId)
    .run();
}

/** サーバー側（Stripe連携）専用。ユーザー入力から呼ばないこと。 */
export async function updateSubscriptionFields(userId: string, fields: SubscriptionFields) {
  const columns = SUBSCRIPTION_COLUMNS.filter((column) => fields[column] !== undefined);
  if (columns.length === 0) return;

  await getDb()
    .prepare(`update user_profiles set ${columns.map((column) => `${column} = ?`).join(", ")}, updated_at = ? where user_id = ?`)
    .bind(...columns.map((column) => fields[column] ?? null), nowIso(), userId)
    .run();
}

export async function findUserIdByStripeCustomerId(customerId: string) {
  const row = await getDb()
    .prepare("select user_id from user_profiles where stripe_customer_id = ?")
    .bind(customerId)
    .first<{ user_id: string }>();
  return row?.user_id ?? null;
}
