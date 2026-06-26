export function PhoneShell({
  children,
  nav,
}: Readonly<{
  children: React.ReactNode;
  nav?: React.ReactNode;
}>) {
  return (
    <main className="flex h-dvh overflow-hidden justify-center bg-[#111] text-macho-text sm:px-6 sm:py-6 lg:px-10">
      <div className="flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden bg-macho-black sm:h-[calc(100dvh-3rem)] sm:rounded-[28px] sm:border sm:border-[#333]">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-5 pt-6 sm:px-7 sm:pb-7 sm:pt-8 md:px-9">
          {children}
        </div>
        {nav}
      </div>
    </main>
  );
}
