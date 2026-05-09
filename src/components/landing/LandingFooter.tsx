"use client";

function goTo(href: string) {
  window.location.href = href;
}

export default function LandingFooter() {
  return (
    <footer className="border-t border-[#1a1a22]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-8 py-6 text-[11px] text-[#666] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-[3px] rounded-[2px] bg-[#FF5E00]" />
          <span>skillflow</span>
          <span className="text-[#444]">© 2026 Xmas Group</span>
        </div>

        <div className="flex items-center gap-5">
          <button type="button" onClick={() => goTo("/terms")} className="transition-colors hover:text-white">
            Terms
          </button>
          <button type="button" onClick={() => goTo("/privacy")} className="transition-colors hover:text-white">
            Privacy
          </button>
          <button
            type="button"
            onClick={() => {
              window.open("#", "_blank", "noopener,noreferrer");
            }}
            className="transition-colors hover:text-white"
          >
            Discord
          </button>
          <button
            type="button"
            onClick={() => {
              window.open("#", "_blank", "noopener,noreferrer");
            }}
            className="transition-colors hover:text-white"
          >
            Twitter
          </button>
        </div>
      </div>
    </footer>
  );
}
