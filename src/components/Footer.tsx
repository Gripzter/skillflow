import Link from "next/link";

export default function Footer() {
  return (
    <footer className="card-border border-t border-white/5 bg-[#05060A]/80 px-4 py-6 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-body-gray md:flex-row">
        <div className="order-3 md:order-1 text-center md:text-left">
          (c) 2026 SkillFlow. All rights reserved.
        </div>
        <nav className="order-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs md:order-2 md:text-sm">
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <span className="hidden text-body-gray/50 sm:inline">•</span>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <span className="hidden text-body-gray/50 sm:inline">•</span>
          <Link href="/acceptable-use" className="hover:text-white">
            Acceptable Use
          </Link>
          <span className="hidden text-body-gray/50 sm:inline">•</span>
          <Link href="/skillies" className="hover:text-white">
            About Skillies
          </Link>
        </nav>
        <div className="order-2 text-center md:order-3 md:text-right">
          <a href="mailto:support@skillflow.gg" className="hover:text-white">
            support@skillflow.gg
          </a>
        </div>
      </div>
    </footer>
  );
}
