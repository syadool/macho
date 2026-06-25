"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Loader2 } from "lucide-react";
import { OutlineButton, PrimaryButton } from "@/components/ui";

export function BillingActions({ hasCustomer }: { hasCustomer: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      if (!response.ok) throw new Error("portal_failed");
      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new Error("portal_url_missing");
      window.location.href = payload.url;
    } catch {
      setError("Stripe管理画面を開けませんでした。");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {hasCustomer ? (
        <PrimaryButton onClick={openPortal} disabled={loading}>
          {loading ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Loader2 size={14} className="animate-spin" />
              接続中
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-1.5">
              <CreditCard size={15} />
              プランと支払いを管理
            </span>
          )}
        </PrimaryButton>
      ) : (
        <Link href="/pricing">
          <PrimaryButton>プランを見る</PrimaryButton>
        </Link>
      )}
      <Link href="/pricing">
        <OutlineButton>プランを比較</OutlineButton>
      </Link>
      {error && <p className="text-xs text-[#FF6B6B]">{error}</p>}
    </div>
  );
}
