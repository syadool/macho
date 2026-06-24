import { NextResponse } from "next/server";
import { generateSuggestion } from "@/lib/ai/suggest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const targetMuscleGroupIds = Array.isArray(record.target_muscle_group_ids)
    ? record.target_muscle_group_ids.filter((item): item is string => typeof item === "string" && UUID_PATTERN.test(item)).slice(0, 10)
    : [];
  const theme = typeof record.theme === "string" ? record.theme.slice(0, 120) : null;

  if (targetMuscleGroupIds.length === 0) {
    return NextResponse.json({ error: "no_target" }, { status: 400 });
  }

  const result = await generateSuggestion({
    targetMuscleGroupIds,
    theme,
  });

  switch (result.kind) {
    case "success":
    case "cached":
      return NextResponse.json(result.payload);
    case "unauthorized":
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    case "not_onboarded":
      return NextResponse.json({ error: "not_onboarded" }, { status: 403 });
    case "forbidden":
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    case "rate_limited":
      return NextResponse.json(
        { error: "rate_limit_exceeded", scope: result.scope, reset_at: result.resetAt },
        { status: result.scope === "global" ? 503 : 429 },
      );
    case "error":
      return NextResponse.json({ error: "generation_failed", message: result.message }, { status: 500 });
  }
}
