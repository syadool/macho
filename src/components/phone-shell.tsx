import { BatteryMedium, Wifi } from "lucide-react";

export function PhoneShell({
  children,
  nav,
}: Readonly<{
  children: React.ReactNode;
  nav?: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-[#111] px-0 py-0 text-macho-text sm:px-8 sm:py-8">
      <div className="flex min-h-screen w-full max-w-[500px] flex-col bg-macho-black sm:min-h-[700px] sm:w-[375px] sm:overflow-hidden sm:rounded-[44px] sm:border sm:border-[#333]">
        <StatusBar />
        <div className="flex flex-1 flex-col px-5 pb-5">{children}</div>
        {nav}
      </div>
    </main>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-8 pb-2 pt-3.5 text-[13px] font-semibold">
      <span>9:41</span>
      <div className="mx-auto h-7 w-[120px] rounded-full bg-macho-card" />
      <div className="flex items-center gap-1.5">
        <Wifi size={14} strokeWidth={2.3} />
        <BatteryMedium size={16} strokeWidth={2.3} />
      </div>
    </div>
  );
}
