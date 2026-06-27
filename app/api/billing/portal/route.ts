import { NextResponse } from "next/server";
import { getConfiguredAppUrl } from "@/lib/app-url";
import { getStripeClient } from "@/lib/stripe/client";
import { requireApiOnboardedUser } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const auth = await requireApiOnboardedUser();
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "unauthorized" : "not_onboarded" }, { status: auth.status });
  if (!(await checkRateLimit({ scope: "billing_portal", identifier: auth.user.id, limit: 10, windowSeconds: 60 }))) {
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }

  if (!auth.profile.stripe_customer_id) {
    return NextResponse.json({ error: "stripe_customer_not_found" }, { status: 404 });
  }

  const origin = getConfiguredAppUrl();
  if (!origin) return NextResponse.json({ error: "app_url_not_configured" }, { status: 500 });

  const portalConfigurationId = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: auth.profile.stripe_customer_id,
    configuration: portalConfigurationId || undefined,
    return_url: `${origin}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
