"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Card, PrimaryButton } from "@/components/ui";
import { PhoneShell } from "@/components/phone-shell";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route crashed", error);
  }, [error]);

  return (
    <PhoneShell>
      <section className="flex min-h-[60dvh] items-center">
        <Card className="w-full text-center">
          <p className="font-display text-[30px] leading-none tracking-[0.04em] text-macho-lime">ERROR</p>
          <h1 className="mt-3 text-base font-semibold">画面を読み込めませんでした</h1>
          <p className="mt-2 text-xs leading-relaxed text-macho-muted">一時的な通信エラーの可能性があります。</p>
          <PrimaryButton onClick={reset} className="mt-5">
            <RotateCcw size={15} className="mr-1 inline align-[-2px]" />
            再読み込み
          </PrimaryButton>
        </Card>
      </section>
    </PhoneShell>
  );
}
