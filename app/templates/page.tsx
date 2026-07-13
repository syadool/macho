import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { PhoneShell } from "@/components/phone-shell";
import { Card, PageTitle } from "@/components/ui";
import { formatShortDate } from "@/lib/date";
import { getTemplates } from "@/lib/templates";
import { requireOnboardedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  await requireOnboardedUser();
  const { source: rawSource } = await searchParams;
  const source = rawSource === "ai_suggestion" || rawSource === "manual" ? rawSource : undefined;
  const templates = await getTemplates(source);

  return (
    <PhoneShell>
      <section className="pt-2">
        <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-macho-muted">
          <ArrowLeft size={14} />
          ホームへ戻る
        </Link>
        <PageTitle>
          テンプレート<span className="text-macho-lime">一覧</span>
        </PageTitle>
      </section>

      <div className="mt-3.5 flex gap-1.5 overflow-x-auto pb-0.5">
        <FilterLink href="/templates" active={!source}>全て</FilterLink>
        <FilterLink href="/templates?source=ai_suggestion" active={source === "ai_suggestion"}>AI提案</FilterLink>
        <FilterLink href="/templates?source=manual" active={source === "manual"}>手動</FilterLink>
      </div>

      <section className="mt-[18px] space-y-2.5">
        {templates.map((template) => (
          <Link key={template.id} href={`/templates/${template.id}`} className="block">
            <Card className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-macho-lime/10 text-[11px] font-bold text-macho-lime">
                {template.source === "ai_suggestion" ? "AI" : "手"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{template.name}</p>
                <p className="mt-0.5 text-xs text-macho-muted">
                  {template.template_exercises.length}種目 ・ {formatShortDate(template.created_at.slice(0, 10))}
                </p>
              </div>
              <ChevronRight size={16} className="text-macho-muted" />
            </Card>
          </Link>
        ))}

        {templates.length === 0 && (
          <Card className="text-center">
            <p className="text-sm font-medium">テンプレートがありません</p>
            <p className="mt-1 text-xs text-macho-muted">記録画面から今日のメニューをテンプレートとして保存できます。</p>
          </Card>
        )}
      </section>
    </PhoneShell>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-3.5 py-[7px] text-[13px] font-medium transition ${
        active
          ? "border-macho-lime bg-macho-lime/10 text-macho-lime"
          : "border-macho-border bg-macho-surface text-macho-muted hover:border-macho-border-hover hover:text-macho-text"
      }`}
    >
      {children}
    </Link>
  );
}
