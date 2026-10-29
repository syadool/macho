import { requireUser } from "@/lib/auth/session";
import { getProfile, markOnboardingCompleted as markCompleted, upsertEditableProfile, type EditableProfileInput } from "@/lib/db/profiles";
import type { UserProfile } from "@/lib/types";

export async function getUserProfile(): Promise<UserProfile | null> {
  const { user } = await requireUser();
  return getProfile(user.id);
}

export async function upsertUserProfile(input: EditableProfileInput): Promise<void> {
  const { user } = await requireUser();
  await upsertEditableProfile(user.id, input);
}

export async function markOnboardingCompleted(): Promise<void> {
  const { user } = await requireUser();
  await markCompleted(user.id);
}
