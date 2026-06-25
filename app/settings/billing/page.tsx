import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { PhoneShell } from "@/components/phone-shell";
import { Card, PageTitle } from "@/components/ui";
import { getRemainingUsage } from "@/lib/ai/suggest";
import { getPlanForTier } from "@/lib/billing/plans";
import { getUserProfile } from "@/lib/profile";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { BillingActions } from "./billing-actions";

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  const { user } = await requireOnboardedUser();
  const profile = await getUserProfile();
  const tier = profile?.subscription_tier ?? "free";
  const plan = getPlanForTier(tier);
  const usage = await getRemainingUsage(user.id, tier);
  const progress = usage.limit_this_month > 0 ? Math.min(100, Math.round((usage.used_this_month / usage.limit_this_month) * 100)) : 0;

  return (
    <PhoneShell>
      <section className="pt-2">
        <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-macho-muted">
          <ArrowLeft size={14} />
          ホームへ戻る
        </Link>
        <PageTitle>
          課金<span className="text-macho-lime">管理</span>
        </PageTitle>
      </section>

      <section className="mt-4 space-y-3">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-macho-muted">現在のプラン</p>
              <p className="mt-1 font-display text-[38px] leading-none tracking-[0.04em] text-macho-lime">{plan.name}</p>
            </div>
            <StatusBadge status={profile?.subscription_status ?? "none"} />
          </div>
          <p className="mt-2 text-xs text-macho-muted">
            {plan.priceLabel}/月・AI提案 {plan.monthlyAiLimit}回/月
          </p>
        </Card>

        <Card>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-macho-muted">今月のAI利用</p>
              <p className="mt-1 text-xl font-semibold">
                {usage.used_this_month}
                <span className="text-sm text-macho-muted"> / {usage.limit_this_month}回</span>
              </p>
            </div>
            <p className="text-xs font-semibold text-macho-lime">残り {usage.remaining_this_month}回</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-macho-surface">
            <div className="h-full rounded-full bg-macho-lime transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-macho-muted">
            今日 {usage.used_today}/{usage.limit_today}回
          </p>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-macho-lime/10 text-macho-lime">
            <CalendarDays size={18} />
          </div>
          <div>
            <p className="text-xs text-macho-muted">次回請求日</p>
            <p className="text-sm font-medium">{formatDate(profile?.current_period_end)}</p>
          </div>
        </Card>

        <BillingActions hasCustomer={Boolean(profile?.stripe_customer_id)} />
      </section>
    </PhoneShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "active" ? "Active" : status === "past_due" ? "Past Due" : status === "canceled" ? "Canceled" : "Free";
  const tone = status === "past_due" ? "border-[#FFB020]/40 text-[#FFB020]" : status === "canceled" ? "border-[#FF6B6B]/40 text-[#FF8B8B]" : "border-macho-lime/40 text-macho-lime";

  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{label}</span>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "なし";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}
