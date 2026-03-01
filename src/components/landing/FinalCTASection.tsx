"use client";

import Link from "next/link";

export default function FinalCTASection() {
  return (
    <section className="border-t border-white/5 bg-gradient-to-b from-[#0A0E17] to-[#05070A] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to Prove Your Skill?</h2>
        <p className="mt-4 text-body-gray">Join thousands of players competing for real money.</p>
        <Link
          href="/signup"
          className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-lg bg-teal px-10 py-4 text-lg font-semibold text-charcoal transition-all hover:shadow-teal-glow animate-cta-pulse"
        >
          🎮 Create Free Account
        </Link>
        <p className="mt-6 text-sm text-body-gray">
          Already have an account?{" "}
          <Link href="/login" className="text-teal hover:underline">Sign in</Link>
        </p>
      </div>
    </section>
  );
}
