"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminLogin } from "@/lib/admin-auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (adminLogin(code)) {
      router.replace("/admin");
      router.refresh();
    } else {
      setError("Invalid admin code");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <span className="text-2xl font-bold text-white">SkillFlow</span>
        </Link>
        <div className="rounded-xl border border-white/10 bg-admin-card p-8">
          <h1 className="text-center text-xl font-bold text-white">Admin Access</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-code" className="sr-only">
                Enter admin code
              </label>
              <input
                id="admin-code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter admin code"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-admin-body focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
                autoComplete="off"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-admin-danger">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-admin-accent py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "..." : "Access Dashboard"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-admin-body">
          Authorized personnel only.
        </p>
      </div>
    </div>
  );
}
