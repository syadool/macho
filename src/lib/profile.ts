import { requireUser } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";

type EditableProfileInput = Partial<
  Omit<
    UserProfile,
    | "user_id"
    | "onboarding_completed"
    | "ai_suggestion_enabled"
    | "subscription_tier"
    | "stripe_customer_id"
    | "subscription_status"
    | "subscription_id"
    | "current_period_end"
    | "stripe_subscription_event_created"
  >
>;

export async function getUserProfile(): Promise<UserProfile | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();

  if (error) throw new Error(error.message);
  return (data as UserProfile | null) ?? null;
}

export async function upsertUserProfile(input: EditableProfileInput): Promise<void> {
  const { supabase, user } = await requireUser();
  const payload: EditableProfileInput & { user_id: string } = {
    user_id: user.id,
    ...input,
  };

  const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function markOnboardingCompleted(): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
}
