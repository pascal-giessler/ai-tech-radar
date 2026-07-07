import Link from "next/link";

/** Header for the server-rendered content pages (the home page uses the app shell). */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-hairline px-[30px] py-4">
      <Link href="/" className="flex items-center gap-3.5">
        <span aria-hidden className="relative block h-[30px] w-[30px] flex-none">
          <span className="absolute inset-0 rounded-full border border-[rgba(116,224,255,0.4)] shadow-[0_0_12px_rgba(116,224,255,0.4)]" />
          <span className="absolute inset-2 rounded-full border border-[rgba(116,224,255,0.28)]" />
          <span className="absolute left-1/2 top-1/2 -ml-[2.5px] -mt-[2.5px] h-[5px] w-[5px] rounded-full bg-sweep shadow-[0_0_12px_var(--color-sweep)]" />
        </span>
        <span className="flex items-baseline gap-3">
          <span className="text-base font-medium tracking-[0.04em] text-starlight">AI&nbsp;RADAR</span>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.24em] text-muted sm:inline">tech tracker</span>
        </span>
      </Link>
      <nav className="flex items-center gap-[22px] font-mono text-[11.5px] tracking-[0.04em]">
        <Link href="/" className="text-muted transition-colors hover:text-sweep">
          radar
        </Link>
        <Link href="/tools" className="text-muted transition-colors hover:text-sweep">
          catalog
        </Link>
        <a href="/llms.txt" className="text-muted transition-colors hover:text-sweep">
          llms.txt
        </a>
      </nav>
    </header>
  );
}
