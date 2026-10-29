import type Stripe from "stripe";
import { getEntitledSubscriptionTier, getTierForStripePriceId } from "@/lib/billing/plans";
import { findUserIdByStripeCustomerId, getProfile, updateSubscriptionFields } from "@/lib/db/profiles";
import type { SubscriptionStatus, SubscriptionTier } from "@/lib/types";

type SyncOptions = {
  eventCreated?: number;
};

export async function syncStripeSubscription(subscription: Stripe.Subscription, options: SyncOptions = {}) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = await findUserIdForSubscription(subscription, customerId);
  if (!userId) return null;
  if (await isStaleSubscriptionEvent(userId, options.eventCreated)) return userId;

  const tier = getTierForSubscription(subscription);
  const status = getSubscriptionStatus(subscription.status);
  const isDeleted = status === "canceled";
  const entitledTier = isDeleted ? "free" : getEntitledSubscriptionTier(tier, status);
  await updateSubscriptionFields(userId, {
    subscription_tier: entitledTier,
    subscription_status: isDeleted ? "canceled" : status,
    subscription_id: isDeleted ? null : subscription.id,
    stripe_customer_id: customerId,
    current_period_end: isDeleted ? null : getCurrentPeriodEnd(subscription),
    stripe_subscription_event_created: options.eventCreated ?? null,
  });
  return userId;
}

export async function markSubscriptionDeleted(subscription: Stripe.Subscription, options: SyncOptions = {}) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = await findUserIdForSubscription(subscription, customerId);
  if (!userId) return null;
  if (await isStaleSubscriptionEvent(userId, options.eventCreated)) return userId;

  await updateSubscriptionFields(userId, {
    subscription_tier: "free",
    subscription_status: "canceled",
    subscription_id: null,
    stripe_customer_id: customerId,
    current_period_end: null,
    stripe_subscription_event_created: options.eventCreated ?? null,
  });
  return userId;
}

async function findUserIdForSubscription(subscription: Stripe.Subscription, customerId: string) {
  // メタデータのキー名は既存のStripeサブスクリプションとの互換のため supabase_user_id のまま（ユーザーIDは移行後も同じ）
  const metadataUserId = typeof subscription.metadata.supabase_user_id === "string" ? subscription.metadata.supabase_user_id : null;
  if (metadataUserId) return metadataUserId;

  return findUserIdByStripeCustomerId(customerId);
}

async function isStaleSubscriptionEvent(userId: string, eventCreated: number | undefined) {
  if (typeof eventCreated !== "number") return false;

  const lastEventCreated = (await getProfile(userId))?.stripe_subscription_event_created;
  return typeof lastEventCreated === "number" && lastEventCreated > eventCreated;
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
