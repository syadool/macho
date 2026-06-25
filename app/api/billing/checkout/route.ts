import { NextResponse } from "next/server";
import { getTierForStripePriceId } from "@/lib/billing/plans";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiOnboardedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiOnboardedUser();
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "unauthorized" : "not_onboarded" }, { status: auth.status });

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
      await stripe.customers.create({
        email: auth.user.email ?? undefined,
        metadata: { supabase_user_id: auth.user.id },
      })
    ).id;

  if (!auth.profile.stripe_customer_id) {
    const { error } = await admin.from("user_profiles").update({ stripe_customer_id: customerId }).eq("user_id", auth.user.id);
    if (error) throw new Error(error.message);
  }

  const origin = getBaseUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
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
  });

  if (!session.url) return NextResponse.json({ error: "checkout_url_missing" }, { status: 502 });
  return NextResponse.json({ url: session.url });
}

function getPriceId(body: unknown) {
  if (typeof body !== "object" || body === null) return null;
  const priceId = (body as Record<string, unknown>).price_id;
  return typeof priceId === "string" && priceId.startsWith("price_") ? priceId : null;
}

function getBaseUrl(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
}
