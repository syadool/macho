import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { LoginButton } from "@/components/login-button";
import { PhoneShell } from "@/components/phone-shell";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) redirect("/dashboard");
  }

  return (
    <PhoneShell>
      <section className="flex flex-1 flex-col items-center justify-center px-0 pb-10 pt-[60px] text-center">
        <div className="mb-11">
          <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[18px] border border-macho-lime/20 bg-macho-lime/10 text-macho-lime">
            <Dumbbell size={32} strokeWidth={2.2} />
          </div>
          <h1 className="font-display text-[64px] leading-[0.9] tracking-[0.04em] text-macho-lime">MACHO</h1>
          <p className="mt-2 text-[13px] font-medium tracking-[0.15em] text-macho-muted">WORKOUT TRACKER</p>
        </div>

        <p className="mb-10 max-w-[260px] text-sm leading-[1.7] text-[#555]">
          トレーニングを記録して
          <br />
          理想のカラダを手に入れよう
        </p>

        <LoginButton disabled={!hasSupabaseEnv()} />
        {!hasSupabaseEnv() && (
          <p className="mt-4 max-w-[280px] text-xs leading-5 text-macho-muted">
            Supabase環境変数を設定するとGoogleログインを開始できます。
          </p>
        )}
        <p className="mt-12 text-[11px] text-[#444]">v1.0.0</p>
      </section>
    </PhoneShell>
  );
}
