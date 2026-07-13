"use client";

import Link from "next/link";
import { Calendar, Home, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { transitionFor } from "@/lib/motion";

export function Card({
  children,
  className = "",
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return <div className={`macho-card rounded-macho-m border border-macho-border bg-macho-card p-4 ${className}`}>{children}</div>;
}

export function Pill({
  children,
  active = false,
  className = "",
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragEnd" | "onDragStart" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"> & {
  active?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      className={`rounded-full border px-3.5 py-[7px] text-caption font-medium transition ${
        active
          ? "border-macho-lime bg-macho-lime/10 text-macho-lime"
          : "border-macho-border bg-macho-surface text-macho-muted hover:border-macho-border-hover hover:text-macho-text active:bg-macho-card"
      } ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function BottomNav({ active }: { active: "dashboard" | "record" | "history" }) {
  const reduced = useReducedMotion();
  return (
    <nav className="bottom-nav grid h-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] grid-cols-3 items-center justify-items-center border-t pb-[env(safe-area-inset-bottom)] pt-2">
      <NavItem href="/dashboard" label="ダッシュボード" active={active === "dashboard"} icon={<Home size={20} />} reduced={Boolean(reduced)} />
      <Link
        href="/record"
        className={`group flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 px-4 py-1.5 text-label transition ${
          active === "record" ? "text-macho-lime" : "text-macho-muted hover:text-macho-text"
        }`}
      >
        <motion.span whileTap={{ scale: 0.97 }} className="-mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-macho-lime text-macho-black shadow-[0_0_24px_rgba(212,255,0,0.2)]">
          <Plus size={24} strokeWidth={2.4} />
        </motion.span>
        <span>記録</span>
      </Link>
      <NavItem href="/history" label="履歴" active={active === "history"} icon={<Calendar size={20} />} reduced={Boolean(reduced)} />
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
  icon,
  reduced,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  reduced: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 px-4 py-1.5 text-label transition ${
        active ? "text-macho-lime" : "text-macho-muted hover:text-macho-text"
      }`}
    >
      <motion.span animate={{ scale: active ? 1.08 : 1 }} transition={transitionFor(reduced)}>{icon}</motion.span>
      <span>{label}</span>
    </Link>
  );
}

export function PageTitle({ children }: Readonly<{ children: React.ReactNode }>) {
  return <h1 className="font-display text-display-xl">{children}</h1>;
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`w-full rounded-macho-m bg-macho-lime p-[15px] text-body font-semibold text-macho-black transition hover:opacity-90 active:scale-[0.98] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`w-full rounded-macho-m border border-macho-lime bg-transparent p-[13px] text-body font-medium text-macho-lime transition hover:bg-macho-lime/10 active:scale-[0.98] active:bg-macho-lime/15 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
