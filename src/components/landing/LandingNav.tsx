"use client";

import Wordmark from "@/components/Wordmark";

const links = [
  { label: "Games", href: "/#games" },
  { label: "Ranks", href: "/#ranks" },
  { label: "Founders", href: "/#founders" },
  { label: "About", href: "/#about" },
];

function goTo(href: string) {
  window.location.href = href;
}

export default function LandingNav() {
  return (
    <header className="sticky top-0 z-50 h-16 border-b border-[#1a1a22] bg-[#0E0E12]">
      <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-between px-4 md:px-8">
        <div className="flex items-center text-white" aria-label="Go to homepage">
          <Wordmark href="/" size="md" />
        </div>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => goTo(link.href)}
              className="text-[13px] font-normal text-[#888] transition-colors hover:text-white"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => goTo("/login")}
            className="hidden text-[13px] font-normal text-[#888] transition-colors hover:text-white sm:block"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => goTo("/signup")}
            className="rounded-md bg-[#FFFF00] px-4 py-2 text-[13px] font-medium text-[#0E0E12] transition-colors hover:bg-[#E6E600]"
          >
            Play now
          </button>
        </div>
      </div>
    </header>
  );
}
