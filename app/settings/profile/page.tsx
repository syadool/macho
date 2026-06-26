import Link from "next/link";
import { ArrowLeft, ChevronRight, KeyRound } from "lucide-react";
import { PhoneShell } from "@/components/phone-shell";
import { Card, PageTitle } from "@/components/ui";
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
      <Link href="/settings/api-keys" className="mt-4 block">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-macho-lime/10 text-macho-lime">
            <KeyRound size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">GPT連携</p>
            <p className="text-[11px] text-macho-muted">Custom GPT Actions 用のAPIキーを管理</p>
          </div>
          <ChevronRight size={16} className="text-macho-muted" />
        </Card>
      </Link>
      <ProfileForm profile={profile} muscleGroups={muscleGroups} />
    </PhoneShell>
  );
}
