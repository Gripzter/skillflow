"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Admin access is now gated by Supabase auth.
    // Users must sign in with the authorized account at /login, then visit /admin.
    router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080A0E] px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#12131A] p-8 text-center">
        <span className="text-2xl font-bold text-white">SkillFlow</span>
        <p className="mt-4 text-sm text-[#9CA3AF]">
          Admin access requires signing in with an authorized account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg px-6 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
          style={{ background: "#FFFF00" }}
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
