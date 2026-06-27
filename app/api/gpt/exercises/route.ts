import { NextResponse } from "next/server";
import { authenticateGptRequest } from "@/lib/gpt/auth";
import { getGptMasterData } from "@/lib/gpt/data";
import { serializeGptMasterData } from "@/lib/gpt/serialize";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await authenticateGptRequest(req);
  if (!userId) return jsonError("Unauthorized", 401);
  if (!(await checkRateLimit({ scope: "gpt", identifier: userId.keyHash, limit: 120, windowSeconds: 60 }))) {
    return jsonError("Rate limit exceeded", 429);
  }

  try {
    const { muscleGroups, equipment } = await getGptMasterData();
    return NextResponse.json(serializeGptMasterData(muscleGroups, equipment));
  } catch (error) {
    console.error("GPT exercises API failed", error);
    return jsonError("Internal Server Error", 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
