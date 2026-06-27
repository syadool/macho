"use client";

import { useState } from "react";
import { GoogleIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

export function LoginButton({ disabled }: { disabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (disabled) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signInError) setError("Googleログインを開始できませんでした。");
    } catch {
      setError("Googleログインを開始できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleLogin}
        disabled={disabled || loading}
        className="flex w-[280px] items-center justify-center gap-2.5 rounded-[14px] bg-white px-8 py-[15px] text-[15px] font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? "接続中..." : "Googleでログイン"}
      </button>
      {error && <p className="w-[280px] text-center text-xs text-[#FF6B6B]">{error}</p>}
    </div>
  );
}
