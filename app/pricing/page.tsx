import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PhoneShell } from "@/components/phone-shell";
import { PageTitle } from "@/components/ui";
import { getCheckoutPlans } from "@/lib/billing/plans";
import { getUserProfile } from "@/lib/profile";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { PricingClient } from "./pricing-client";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requireOnboardedUser();
  const profile = await getUserProfile();
  const currentTier = profile?.subscription_tier ?? "free";
  const hasActiveSubscription = Boolean(profile?.subscription_id && ["active", "past_due"].includes(profile.subscription_status));

  return (
    <PhoneShell>
      <section className="pt-2">
        <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-macho-muted">
          <ArrowLeft size={14} />
          ホームへ戻る
        </Link>
        <PageTitle>
          プランを<span className="text-macho-lime">選択</span>
        </PageTitle>
        <p className="mt-2 text-xs leading-5 text-macho-muted">AIメニュー提案の回数を、トレーニング頻度に合わせて増やせます。</p>
      </section>

      <PricingClient plans={getCheckoutPlans()} currentTier={currentTier} hasActiveSubscription={hasActiveSubscription} />
    </PhoneShell>
  );
}
