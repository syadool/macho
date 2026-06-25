import type Stripe from "stripe";
import { getTierForStripePriceId } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionStatus, SubscriptionTier } from "@/lib/types";

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = await findUserIdForSubscription(subscription, customerId);
  if (!userId) return null;

  const tier = getTierForSubscription(subscription);
  const status = getSubscriptionStatus(subscription.status);
  const isDeleted = subscription.status === "canceled";
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({
      subscription_tier: isDeleted ? "free" : tier,
      subscription_status: isDeleted ? "canceled" : status,
      subscription_id: isDeleted ? null : subscription.id,
      stripe_customer_id: customerId,
      current_period_end: isDeleted ? null : getCurrentPeriodEnd(subscription),
      ai_suggestion_enabled: true,
    })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return userId;
}

export async function markSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = await findUserIdForSubscription(subscription, customerId);
  if (!userId) return null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "canceled",
      subscription_id: null,
      stripe_customer_id: customerId,
      current_period_end: null,
      ai_suggestion_enabled: true,
    })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return userId;
}

async function findUserIdForSubscription(subscription: Stripe.Subscription, customerId: string) {
  const metadataUserId = typeof subscription.metadata.supabase_user_id === "string" ? subscription.metadata.supabase_user_id : null;
  if (metadataUserId) return metadataUserId;

  const admin = createAdminClient();
  const { data, error } = await admin.from("user_profiles").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.user_id as string | undefined) ?? null;
}

function getTierForSubscription(subscription: Stripe.Subscription): SubscriptionTier {
  const priceId = subscription.items.data[0]?.price.id;
  return (priceId ? getTierForStripePriceId(priceId) : null) ?? "free";
}

function getSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "none";
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const record = subscription as unknown as { current_period_end?: number };
  const periodEnd = record.current_period_end ?? subscription.items.data[0]?.current_period_end;
  return typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null;
}
