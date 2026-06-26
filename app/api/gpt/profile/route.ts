import { NextResponse } from "next/server";
import { authenticateGptRequest } from "@/lib/gpt/auth";
import { getGptMasterData, getGptProfile } from "@/lib/gpt/data";
import { serializeGptProfile } from "@/lib/gpt/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await authenticateGptRequest(req);
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    const [profile, { muscleGroups }] = await Promise.all([getGptProfile(userId), getGptMasterData()]);
    if (!profile) return jsonError("Profile not found", 404);

    return NextResponse.json(serializeGptProfile(profile, muscleGroups));
  } catch (error) {
    console.error("GPT profile API failed", error);
    return jsonError("Internal Server Error", 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
