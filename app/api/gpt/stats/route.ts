import { NextResponse } from "next/server";
import { authenticateGptRequest } from "@/lib/gpt/auth";
import { getAllGptWorkouts } from "@/lib/gpt/data";
import { buildGptStats } from "@/lib/gpt/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await authenticateGptRequest(req);
  if (!userId) return jsonError("Unauthorized", 401);

  const url = new URL(req.url);
  const days = parseBoundedInt(url.searchParams.get("days"), 30, 1, 365);
  if (days === null) return jsonError("Invalid query parameter", 400);

  try {
    const workouts = await getAllGptWorkouts(userId, { days });
    return NextResponse.json(buildGptStats(workouts, days));
  } catch (error) {
    console.error("GPT stats API failed", error);
    return jsonError("Internal Server Error", 500);
  }
}

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
