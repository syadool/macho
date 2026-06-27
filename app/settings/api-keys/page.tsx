import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";
import { PhoneShell } from "@/components/phone-shell";
import { Card, PageTitle } from "@/components/ui";
import { getConfiguredAppUrl } from "@/lib/app-url";
import { listGptApiKeys } from "@/lib/gpt/api-keys";
import { requireOnboardedUser } from "@/lib/supabase/server";
import { ApiKeyManager } from "./api-key-manager";

export const dynamic = "force-dynamic";

export default async function ApiKeysSettingsPage() {
  await requireOnboardedUser();
  const apiKeys = await listGptApiKeys();
  const appUrl = getConfiguredAppUrl();
  const openApiUrl = appUrl ? `${appUrl}/api/gpt/openapi.json` : "/api/gpt/openapi.json";

  return (
    <PhoneShell>
      <section className="pt-2">
        <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-macho-muted">
          <ArrowLeft size={14} />
          ホームへ戻る
        </Link>
        <PageTitle>
          GPT<span className="text-macho-lime">連携</span>
        </PageTitle>
      </section>

      <Card className="mt-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-macho-lime/10 text-macho-lime">
            <Copy size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">OpenAPI URL</p>
            <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-macho-muted">{openApiUrl}</p>
          </div>
        </div>
      </Card>

      <ApiKeyManager apiKeys={apiKeys} />
    </PhoneShell>
  );
}
