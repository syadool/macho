"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, OutlineButton, PrimaryButton } from "@/components/ui";
import type { ApiKeySummary } from "@/lib/gpt/api-keys";
import { deleteGptApiKey, issueGptApiKey } from "./actions";

export function ApiKeyManager({ apiKeys }: { apiKeys: ApiKeySummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("ChatGPT");
  const [revealedKey, setRevealedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function issueKey() {
    setMessage("");
    setCopied(false);
    startTransition(async () => {
      const result = await issueGptApiKey({ name });
      if (!result.ok || !result.key) {
        setMessage(result.message ?? "APIキーの発行に失敗しました。");
        return;
      }
      setRevealedKey(result.key);
      setMessage("APIキーを発行しました。この画面を離れると再表示できません。");
      router.refresh();
    });
  }

  function revokeKey(id: string) {
    setMessage("");
    startTransition(async () => {
      const result = await deleteGptApiKey(id);
      setMessage(result.ok ? "APIキーを失効しました。" : result.message ?? "APIキーの失効に失敗しました。");
      if (result.ok) router.refresh();
    });
  }

  async function copyKey() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
  }

  return (
    <section className="mt-4 space-y-3">
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-macho-lime/10 text-macho-lime">
            <KeyRound size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">ChatGPT Actions 用キー</p>
            <p className="mt-1 text-xs leading-relaxed text-macho-muted">
              Bearer 認証でプロフィール、記録、統計、マスタデータを読み取り専用で公開します。
            </p>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-macho-muted">名前</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-[12px] border border-macho-border bg-macho-surface px-3 py-3 text-sm outline-none transition focus:border-macho-lime"
            maxLength={40}
          />
        </label>

        <PrimaryButton onClick={issueKey} disabled={isPending} className="mt-3">
          {isPending ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Loader2 size={14} className="animate-spin" />
              処理中
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Plus size={15} />
              新しいキーを発行
            </span>
          )}
        </PrimaryButton>
      </Card>

      {revealedKey && (
        <Card className="border-macho-lime/50 bg-macho-lime/5">
          <p className="text-xs font-semibold text-macho-lime">発行済み API キー</p>
          <code className="mt-2 block break-all rounded-[10px] border border-macho-lime/20 bg-macho-black p-3 text-[12px] leading-relaxed text-macho-text">
            {revealedKey}
          </code>
          <OutlineButton onClick={copyKey} className="mt-3">
            <span className="inline-flex items-center justify-center gap-1.5">
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "コピーしました" : "コピー"}
            </span>
          </OutlineButton>
        </Card>
      )}

      {message && <p className="text-xs text-macho-muted">{message}</p>}

      <div className="space-y-2">
        <p className="px-1 text-xs font-medium text-macho-muted">発行済みキー</p>
        {apiKeys.map((apiKey) => (
          <Card key={apiKey.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{apiKey.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-macho-muted">{apiKey.key_prefix}...</p>
              <p className="mt-1 text-[11px] text-macho-muted">
                作成 {formatDateTime(apiKey.created_at)} / 最終利用 {formatDateTime(apiKey.last_used_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => revokeKey(apiKey.id)}
              disabled={isPending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#FF6B6B]/30 text-[#FF8B8B] transition hover:bg-[#FF6B6B]/10 disabled:opacity-50"
              aria-label={`${apiKey.name}を失効`}
              title="失効"
            >
              <Trash2 size={16} />
            </button>
          </Card>
        ))}

        {apiKeys.length === 0 && (
          <Card className="text-center">
            <p className="text-sm font-medium">APIキーはまだありません</p>
            <p className="mt-1 text-xs text-macho-muted">発行すると ChatGPT の Custom GPT Actions から接続できます。</p>
          </Card>
        )}
      </div>
    </section>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "なし";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
