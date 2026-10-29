import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { markSubscriptionDeleted, syncStripeSubscription } from "@/lib/billing/stripe-sync";
import { getStripeClient } from "@/lib/stripe/client";
import { findUserIdByStripeCustomerId, updateSubscriptionFields } from "@/lib/db/profiles";
import { claimSubscriptionEvent, markSubscriptionEventProcessed, recordSubscriptionEvent } from "@/lib/db/subscription-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  await recordSubscriptionEvent({ stripeEventId: event.id, eventType: event.type, payload: event });
  if (!(await claimSubscriptionEvent(event.id))) return NextResponse.json({ received: true });

  const userId = await processBillingEvent(event);
  await markSubscriptionEventProcessed(event.id, userId);
  return NextResponse.json({ received: true });
}

async function processBillingEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.created);
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return syncStripeSubscription(event.data.object as Stripe.Subscription, { eventCreated: event.created });
    case "customer.subscription.deleted":
      return markSubscriptionDeleted(event.data.object as Stripe.Subscription, { eventCreated: event.created });
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      return findUserIdFromInvoice(event.data.object as Stripe.Invoice);
    default:
      return null;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventCreated: number) {
  const userId = session.metadata?.supabase_user_id ?? null;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  if (!userId || !customerId) return null;

  await updateSubscriptionFields(userId, { stripe_customer_id: customerId });

  if (subscriptionId) {
    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
    return syncStripeSubscription(subscription, { eventCreated });
  }

  return userId;
}

async function findUserIdFromInvoice(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  if (!customerId) return null;

  return findUserIdByStripeCustomerId(customerId);
}
