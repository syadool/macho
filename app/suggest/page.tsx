import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PhoneShell } from "@/components/phone-shell";
import { Card, PageTitle } from "@/components/ui";
import { getRemainingUsage } from "@/lib/ai/suggest";
import { getMasterData } from "@/lib/data";
import { getUserProfile } from "@/lib/profile";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { SuggestForm } from "./suggest-form";

export const dynamic = "force-dynamic";

export default async function SuggestPage() {
  const { user } = await requireOnboardedUser();
  const [profile, { muscleGroups }, initialUsage] = await Promise.all([
    getUserProfile(),
    getMasterData(),
    getRemainingUsage(user.id),
  ]);

  return (
    <PhoneShell>
      <section className="pt-2">
        <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-macho-muted">
          <ArrowLeft size={14} />
          ホームへ戻る
        </Link>
        <PageTitle>
          AIメニュー<span className="text-macho-lime">提案</span>
        </PageTitle>
      </section>

      {profile?.ai_suggestion_enabled ? (
        <SuggestForm profile={profile} muscleGroups={muscleGroups} initialUsage={initialUsage} />
      ) : (
        <Card className="mt-5 text-center">
          <p className="text-sm font-medium">AI提案は準備中です</p>
          <p className="mt-1 text-xs text-macho-muted">許可されたユーザーから順番に利用できます。</p>
        </Card>
      )}
    </PhoneShell>
  );
}
