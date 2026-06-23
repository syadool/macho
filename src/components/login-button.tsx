"use client";

import { useState } from "react";
import { GoogleIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

export function LoginButton({ disabled }: { disabled: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (disabled) return;
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={disabled || loading}
      className="flex w-[280px] items-center justify-center gap-2.5 rounded-[14px] bg-white px-8 py-[15px] text-[15px] font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <GoogleIcon />
      {loading ? "接続中..." : "Googleでログイン"}
    </button>
  );
}
