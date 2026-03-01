"use client";

import Link from "next/link";

export default function LandingFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#05070A] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xl font-bold">
              <span className="text-white">Skill</span>
              <span className="text-teal">Flow</span>
            </p>
            <p className="mt-2 text-xs text-body-gray">© 2025 SkillFlow Inc. All rights reserved.</p>
            <p className="mt-1 text-xs text-body-gray">Must be 18+ to play.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-body-gray">
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/fairplay" className="hover:text-white">Fair Play Policy</Link>
            <Link href="/refund" className="hover:text-white">Refund Policy</Link>
            <Link href="/responsible-play" className="hover:text-white">Responsible Gaming</Link>
          </nav>
          <div className="text-sm text-body-gray">
            <p className="font-medium text-white">Secured by Stripe</p>
            <a href="mailto:support@skillflow.gg" className="mt-1 block hover:text-teal">support@skillflow.gg</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
