import Link from "next/link";
import { Calendar, Home, Plus } from "lucide-react";

export function Card({
  children,
  className = "",
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return <div className={`rounded-[14px] border border-macho-border bg-macho-card p-4 ${className}`}>{children}</div>;
}

export function Pill({
  children,
  active = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rounded-full border px-3.5 py-[7px] text-[13px] font-medium transition ${
        active
          ? "border-macho-lime bg-macho-lime/10 text-macho-lime"
          : "border-macho-border bg-macho-surface text-macho-muted hover:border-[#555] hover:text-macho-text"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function BottomNav({ active }: { active: "dashboard" | "record" | "history" }) {
  return (
    <nav className="relative z-10 flex shrink-0 items-center justify-around border-t border-macho-border bg-macho-base pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
      <NavItem href="/dashboard" label="ホーム" active={active === "dashboard"} icon={<Home size={20} />} />
      <Link
        href="/record"
        className={`flex flex-col items-center gap-1 px-4 py-1.5 text-[11px] transition ${
          active === "record" ? "text-macho-lime" : "text-macho-muted hover:text-macho-text"
        }`}
      >
        <span className="-mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-macho-lime text-macho-black shadow-[0_0_24px_rgba(212,255,0,0.2)]">
          <Plus size={24} strokeWidth={2.4} />
        </span>
        <span>記録</span>
      </Link>
      <NavItem href="/history" label="履歴" active={active === "history"} icon={<Calendar size={20} />} />
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 px-4 py-1.5 text-[11px] transition ${
        active ? "text-macho-lime" : "text-macho-muted hover:text-macho-text"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export function PageTitle({ children }: Readonly<{ children: React.ReactNode }>) {
  return <h1 className="font-display text-[34px] leading-none tracking-[0.04em]">{children}</h1>;
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`w-full rounded-[14px] bg-macho-lime p-[15px] text-[15px] font-semibold text-macho-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
      className={`w-full rounded-[14px] border border-macho-lime bg-transparent p-[13px] text-sm font-medium text-macho-lime transition hover:bg-macho-lime/10 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
