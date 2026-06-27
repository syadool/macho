import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { markSubscriptionDeleted, syncStripeSubscription } from "@/lib/billing/stripe-sync";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();
  const { error: insertError } = await admin
    .from("subscription_events")
    .upsert(
      {
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event as unknown as Record<string, unknown>,
      },
      { onConflict: "stripe_event_id", ignoreDuplicates: true },
    );
  if (insertError) throw new Error(insertError.message);

  const { data: claimed, error: claimError } = await admin.rpc("claim_subscription_event", {
    p_stripe_event_id: event.id,
  });
  if (claimError) throw new Error(claimError.message);
  if (claimed !== true) return NextResponse.json({ received: true });

  const userId = await processBillingEvent(event);
  const { error } = await admin
    .from("subscription_events")
    .update({ user_id: userId, processed_at: new Date().toISOString() })
    .eq("stripe_event_id", event.id);

  if (error) throw new Error(error.message);
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

  const admin = createAdminClient();
  const { error } = await admin.from("user_profiles").update({ stripe_customer_id: customerId }).eq("user_id", userId);
  if (error) throw new Error(error.message);

  if (subscriptionId) {
    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
    return syncStripeSubscription(subscription, { eventCreated });
  }

  return userId;
}

async function findUserIdFromInvoice(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  if (!customerId) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.from("user_profiles").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.user_id as string | undefined) ?? null;
}
