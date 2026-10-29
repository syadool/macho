import { createHash } from "crypto";
import { touchApiKeyByHash } from "@/lib/db/api-keys";

export function hashGptApiKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type GptAuthContext = {
  userId: string;
  keyHash: string;
};

export async function authenticateGptRequest(req: Request): Promise<GptAuthContext | null> {
  const auth = req.headers.get("authorization");
  const token = auth?.match(/^Bearer (.+)$/)?.[1];
  if (!token?.startsWith("macho_")) return null;

  const keyHash = hashGptApiKey(token);
  const userId = await touchApiKeyByHash(keyHash);
  if (!userId) return null;

  return { userId, keyHash };
}
