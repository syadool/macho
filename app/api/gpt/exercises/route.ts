import { NextResponse } from "next/server";
import { authenticateGptRequest } from "@/lib/gpt/auth";
import { getGptMasterData } from "@/lib/gpt/data";
import { serializeGptMasterData } from "@/lib/gpt/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await authenticateGptRequest(req);
  if (!userId) return jsonError("Unauthorized", 401);

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
