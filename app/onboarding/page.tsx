import { redirect } from "next/navigation";
import { PhoneShell } from "@/components/phone-shell";
import { getMasterData } from "@/lib/data";
import { getUserProfile } from "@/lib/profile";
import { requireUser } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireUser();
  const [profile, { muscleGroups }] = await Promise.all([getUserProfile(), getMasterData()]);

  if (profile?.onboarding_completed) redirect("/dashboard");

  return (
    <PhoneShell>
      <OnboardingForm profile={profile} muscleGroups={muscleGroups} />
    </PhoneShell>
  );
}
