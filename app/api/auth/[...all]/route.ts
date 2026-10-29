import { getAuth } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getAuth().handler(request);
}

export function POST(request: Request) {
  return getAuth().handler(request);
}
