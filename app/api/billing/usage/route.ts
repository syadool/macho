import { NextResponse } from "next/server";
import { getRemainingUsage } from "@/lib/ai/suggest";
import { requireApiOnboardedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiOnboardedUser();
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "unauthorized" : "not_onboarded" }, { status: auth.status });

  const usage = await getRemainingUsage(auth.user.id, auth.profile.subscription_tier, auth.profile.subscription_status);
  return NextResponse.json({
    tier: auth.profile.subscription_tier,
    status: auth.profile.subscription_status,
    usage: {
      used_this_month: usage.used_this_month,
      limit_this_month: usage.limit_this_month,
      used_today: usage.used_today,
      limit_today: usage.limit_today,
      reset_at: usage.reset_at,
    },
    current_period_end: auth.profile.current_period_end,
  });
}
