import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { requireApiOnboardedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiOnboardedUser();
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "unauthorized" : "not_onboarded" }, { status: auth.status });

  if (!auth.profile.stripe_customer_id) {
    return NextResponse.json({ error: "stripe_customer_not_found" }, { status: 404 });
  }

  const portalConfigurationId = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: auth.profile.stripe_customer_id,
    configuration: portalConfigurationId || undefined,
    return_url: `${getBaseUrl(req)}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}

function getBaseUrl(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
}
