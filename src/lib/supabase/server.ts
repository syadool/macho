import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl, hasSupabaseEnv } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. Auth callback and actions can.
        }
      },
    },
  });
}

export async function requireUser() {
  if (!hasSupabaseEnv()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  return { supabase, user };
}

export async function requireOnboardedUser() {
  const result = await requireUser();
  const { data: profile } = await result.supabase
    .from("user_profiles")
    .select("onboarding_completed")
    .eq("user_id", result.user.id)
    .maybeSingle();

  if (!profile || profile.onboarding_completed !== true) redirect("/onboarding");

  return result;
}

export async function requireApiOnboardedUser() {
  if (!hasSupabaseEnv()) return { ok: false as const, status: 401 as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, status: 401 as const };

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile || profile.onboarding_completed !== true) return { ok: false as const, status: 403 as const };

  return { ok: true as const, supabase, user, profile };
}
