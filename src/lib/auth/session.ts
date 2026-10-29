import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, hasAuthEnv } from "@/lib/auth/config";
import { getProfile } from "@/lib/db/profiles";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!hasAuthEnv()) return null;

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;

  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  return { user };
}

export async function requireOnboardedUser() {
  const result = await requireUser();
  const profile = await getProfile(result.user.id);

  if (!profile || profile.onboarding_completed !== true) redirect("/onboarding");

  return { ...result, profile };
}

export async function requireApiOnboardedUser() {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, status: 401 as const };

  const profile = await getProfile(user.id);
  if (!profile || profile.onboarding_completed !== true) return { ok: false as const, status: 403 as const };

  return { ok: true as const, user, profile };
}
