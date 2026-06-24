import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PhoneShell } from "@/components/phone-shell";
import { PageTitle } from "@/components/ui";
import { getMasterData } from "@/lib/data";
import { getUserProfile } from "@/lib/profile";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  await requireOnboardedUser();
  const [profile, { muscleGroups }] = await Promise.all([getUserProfile(), getMasterData()]);

  return (
    <PhoneShell>
      <section className="pt-2">
        <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-macho-muted">
          <ArrowLeft size={14} />
          ホームへ戻る
        </Link>
        <PageTitle>
          プロフィール<span className="text-macho-lime">設定</span>
        </PageTitle>
      </section>
      <ProfileForm profile={profile} muscleGroups={muscleGroups} />
    </PhoneShell>
  );
}
