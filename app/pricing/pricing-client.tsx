"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Crown, Loader2 } from "lucide-react";
import { Card, OutlineButton, PrimaryButton } from "@/components/ui";
import type { BillingPlan } from "@/lib/billing/plans";
import type { SubscriptionTier } from "@/lib/types";

type CheckoutPlan = BillingPlan & { priceId: string | null };

export function PricingClient({
  plans,
  currentTier,
  hasActiveSubscription,
}: {
  plans: CheckoutPlan[];
  currentTier: SubscriptionTier;
  hasActiveSubscription: boolean;
}) {
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState("");

  async function openCheckout(priceId: string, tier: SubscriptionTier) {
    setLoadingTier(tier);
    setError("");

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_id: priceId }),
      });

      if (response.status === 409) {
        await openPortal(tier);
        return;
      }

      if (!response.ok) throw new Error("checkout_failed");
      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new Error("checkout_url_missing");
      window.location.href = payload.url;
    } catch {
      setError("決済画面を開けませんでした。時間をおいて再度お試しください。");
      setLoadingTier(null);
    }
  }

  async function openPortal(tier: SubscriptionTier) {
    setLoadingTier(tier);
    setError("");

    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      if (!response.ok) throw new Error("portal_failed");
      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new Error("portal_url_missing");
      window.location.href = payload.url;
    } catch {
      setError("管理画面を開けませんでした。時間をおいて再度お試しください。");
      setLoadingTier(null);
    }
  }

  return (
    <section className="mt-4 space-y-3">
      {error && <p className="rounded-[12px] border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-3 py-2 text-xs text-[#FF8B8B]">{error}</p>}

      {plans.map((plan) => {
        const isCurrent = plan.tier === currentTier;
        const isLoading = loadingTier === plan.tier;
        const isPaid = plan.tier !== "free";

        return (
          <Card
            key={plan.tier}
            className={`relative overflow-hidden ${
              plan.recommended
                ? "border-macho-lime shadow-[0_0_24px_rgba(212,255,0,0.2)]"
                : isCurrent
                  ? "border-macho-lime/60"
                  : ""
            }`}
          >
            {plan.recommended && (
              <div className="absolute right-3 top-3 rounded-full bg-macho-lime px-2.5 py-1 text-[10px] font-bold text-macho-black">
                BEST VALUE
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`font-display text-[30px] leading-none tracking-[0.04em] ${plan.recommended ? "text-macho-lime" : ""}`}>
                  {plan.name}
                </p>
                <p className="mt-1 text-xs text-macho-muted">{plan.description}</p>
              </div>
              {isCurrent && (
                <span className="inline-flex items-center gap-1 rounded-full border border-macho-lime/40 px-2 py-1 text-[10px] font-semibold text-macho-lime">
                  <Check size={11} />
                  現在
                </span>
              )}
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className={`font-display text-[40px] leading-none tracking-[0.04em] ${plan.recommended ? "text-macho-lime" : "text-macho-text"}`}>
                  {plan.priceLabel}
                  <span className="ml-1 font-sans text-xs normal-case tracking-normal text-macho-muted">/月</span>
                </p>
                <p className="mt-1 text-xs text-macho-muted">1回あたり {plan.unitPriceLabel}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-semibold ${plan.recommended ? "text-macho-lime" : "text-macho-text"}`}>
                  {plan.monthlyAiLimit}回
                </p>
                <p className="text-[11px] text-macho-muted">AI提案/月</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-macho-muted">
              <PlanPoint label={`日次 ${plan.dailyAiLimit}回`} />
              <PlanPoint label="日本円決済" />
            </div>

            <div className="mt-4">
              {isCurrent ? (
                <OutlineButton disabled>現在のプラン</OutlineButton>
              ) : isPaid && hasActiveSubscription ? (
                <PrimaryButton onClick={() => openPortal(plan.tier)} disabled={isLoading}>
                  {isLoading ? <LoadingLabel /> : "Portalで変更"}
                </PrimaryButton>
              ) : isPaid && plan.priceId ? (
                <PrimaryButton onClick={() => openCheckout(plan.priceId!, plan.tier)} disabled={isLoading}>
                  {isLoading ? <LoadingLabel /> : plan.recommended ? "Plusを始める" : `${plan.name}を始める`}
                </PrimaryButton>
              ) : isPaid ? (
                <OutlineButton disabled>準備中</OutlineButton>
              ) : (
                <Link href="/suggest">
                  <OutlineButton>AI提案へ</OutlineButton>
                </Link>
              )}
            </div>
          </Card>
        );
      })}
    </section>
  );
}

function PlanPoint({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Crown size={12} className="text-macho-lime" />
      {label}
    </span>
  );
}

function LoadingLabel() {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <Loader2 size={14} className="animate-spin" />
      接続中
    </span>
  );
}
