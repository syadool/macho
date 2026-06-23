export function PhoneShell({
  children,
  nav,
}: Readonly<{
  children: React.ReactNode;
  nav?: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-dvh justify-center bg-[#111] text-macho-text sm:px-6 sm:py-6 lg:px-10">
      <div className="flex min-h-dvh w-full max-w-3xl flex-col bg-macho-black sm:min-h-[calc(100dvh-3rem)] sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-[#333]">
        <div className="flex flex-1 flex-col px-5 pb-5 pt-6 sm:px-7 sm:pb-7 sm:pt-8 md:px-9">{children}</div>
        {nav}
      </div>
    </main>
  );
}
