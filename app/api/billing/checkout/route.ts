import { NextResponse } from "next/server";
import { getConfiguredAppUrl } from "@/lib/app-url";
import { getTierForStripePriceId } from "@/lib/billing/plans";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiOnboardedUser } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiOnboardedUser();
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "unauthorized" : "not_onboarded" }, { status: auth.status });
  if (!(await checkRateLimit({ scope: "billing_checkout", identifier: auth.user.id, limit: 10, windowSeconds: 60 }))) {
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const priceId = getPriceId(body);
  const tier = priceId ? getTierForStripePriceId(priceId) : null;
  if (!priceId || !tier) return NextResponse.json({ error: "invalid_price_id" }, { status: 400 });

  if (auth.profile.subscription_id && ["active", "past_due"].includes(auth.profile.subscription_status)) {
    return NextResponse.json({ error: "subscription_exists" }, { status: 409 });
  }

  const stripe = getStripeClient();
  const admin = createAdminClient();
  const customerId =
    auth.profile.stripe_customer_id ??
    (
      await stripe.customers.create(
        {
          email: auth.user.email ?? undefined,
          metadata: { supabase_user_id: auth.user.id },
        },
        { idempotencyKey: `macho_customer_${auth.user.id}` },
      )
    ).id;

  if (!auth.profile.stripe_customer_id) {
    const { error } = await admin.from("user_profiles").update({ stripe_customer_id: customerId }).eq("user_id", auth.user.id);
    if (error) throw new Error(error.message);
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  const existingSubscription = subscriptions.data.find((subscription) =>
    ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(subscription.status),
  );
  if (existingSubscription) {
    return NextResponse.json({ error: "subscription_exists" }, { status: 409 });
  }

  const openSessions = await stripe.checkout.sessions.list({
    customer: customerId,
    status: "open",
    limit: 10,
  });
  const existingSession = openSessions.data.find(
    (session) => session.mode === "subscription" && session.metadata?.supabase_user_id === auth.user.id && session.url,
  );
  if (existingSession?.url) return NextResponse.json({ url: existingSession.url });

  const origin = getConfiguredAppUrl();
  if (!origin) return NextResponse.json({ error: "app_url_not_configured" }, { status: 500 });
  const idempotencyWindow = Math.floor(Date.now() / (15 * 60 * 1000));
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      client_reference_id: auth.user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings/billing`,
      subscription_data: {
        metadata: { supabase_user_id: auth.user.id },
      },
      metadata: {
        supabase_user_id: auth.user.id,
        subscription_tier: tier,
      },
      locale: "ja",
    },
    { idempotencyKey: `macho_checkout_${auth.user.id}_${priceId}_${idempotencyWindow}` },
  );

  if (!session.url) return NextResponse.json({ error: "checkout_url_missing" }, { status: 502 });
  return NextResponse.json({ url: session.url });
}

function getPriceId(body: unknown) {
  if (typeof body !== "object" || body === null) return null;
  const priceId = (body as Record<string, unknown>).price_id;
  return typeof priceId === "string" && priceId.startsWith("price_") ? priceId : null;
}
