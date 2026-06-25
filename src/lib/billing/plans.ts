import type { SubscriptionTier } from "@/lib/types";

export type BillingPlan = {
  tier: SubscriptionTier;
  name: string;
  priceLabel: string;
  monthlyAiLimit: number;
  dailyAiLimit: number;
  unitPriceLabel: string;
  description: string;
  recommended?: boolean;
  priceEnvKey?: string;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    tier: "free",
    name: "Free",
    priceLabel: "¥0",
    monthlyAiLimit: 10,
    dailyAiLimit: 5,
    unitPriceLabel: "-",
    description: "まずはAI提案を試したい方向け",
  },
  {
    tier: "go",
    name: "Go",
    priceLabel: "¥580",
    monthlyAiLimit: 40,
    dailyAiLimit: 10,
    unitPriceLabel: "¥14.5",
    description: "週数回のトレーニングに",
    priceEnvKey: "STRIPE_PRICE_GO",
  },
  {
    tier: "plus",
    name: "Plus",
    priceLabel: "¥980",
    monthlyAiLimit: 100,
    dailyAiLimit: 20,
    unitPriceLabel: "¥9.8",
    description: "迷ったらこのプラン",
    recommended: true,
    priceEnvKey: "STRIPE_PRICE_PLUS",
  },
  {
    tier: "pro",
    name: "Pro",
    priceLabel: "¥1,280",
    monthlyAiLimit: 200,
    dailyAiLimit: 30,
    unitPriceLabel: "¥6.4",
    description: "高頻度で追い込みたい方向け",
    priceEnvKey: "STRIPE_PRICE_PRO",
  },
];

export function getPlanForTier(tier: SubscriptionTier | null | undefined) {
  return BILLING_PLANS.find((plan) => plan.tier === tier) ?? BILLING_PLANS[0];
}

export function getPaidPlans() {
  return BILLING_PLANS.filter((plan) => plan.tier !== "free");
}

export function getStripePriceIdForTier(tier: SubscriptionTier) {
  const plan = getPlanForTier(tier);
  return plan.priceEnvKey ? process.env[plan.priceEnvKey] ?? null : null;
}

export function getTierForStripePriceId(priceId: string) {
  return getPaidPlans().find((plan) => plan.priceEnvKey && process.env[plan.priceEnvKey] === priceId)?.tier ?? null;
}

export function getCheckoutPlans() {
  return BILLING_PLANS.map((plan) => ({
    ...plan,
    priceId: plan.priceEnvKey ? process.env[plan.priceEnvKey] ?? null : null,
  }));
}
