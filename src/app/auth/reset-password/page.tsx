"use client";

import { Suspense, useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import AuthLayout from "@/components/AuthLayout";
import LoadingRing from "@/components/LoadingRing";
import { createClient } from "@/lib/supabase";

function ResetPasswordContent() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) {
      setResendDisabled(false);
      return;
    }
    const t = setInterval(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCountdown]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setError("Authentication is not configured.");
      setLoading(false);
      return;
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/update-password`,
    });
    if (err) setError(err.message);
    setShowSuccess(true);
    setResendDisabled(true);
    setResendCountdown(60);
    setLoading(false);
  }

  async function handleResend() {
    if (!email.trim() || resendDisabled) return;
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/update-password`,
    });
    setResendDisabled(true);
    setResendCountdown(60);
  }

  if (showSuccess) {
    return (
      <AuthLayout heading="Check Your Email" subtitle="Password reset">
        <div className="rounded-xl border border-white/10 bg-card p-8 text-center">
          <span className="text-5xl" aria-hidden />
          <h2 className="mt-4 text-xl font-bold text-white">Check Your Email</h2>
          <p className="mt-2 text-body-gray">
            If an account exists for <strong className="text-white">{email}</strong>, we&apos;ve sent a password reset link.
          </p>
          <p className="mt-2 text-sm text-body-gray">The link expires in 1 hour.</p>
          <p className="mt-6 text-sm text-body-gray">Didn&apos;t receive it?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendDisabled}
            className="mt-2 rounded-lg border border-teal/50 bg-teal/10 px-4 py-2 text-sm font-medium text-teal hover:bg-teal/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendDisabled && resendCountdown > 0 ? `Resend available in ${resendCountdown}s` : "Resend Reset Email"}
          </button>
          <Link href="/login" className="mt-6 inline-block text-sm text-teal hover:underline">
            ← Back to Login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout heading="Reset Your Password" subtitle="Enter your email and we'll send you a link to reset your password.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            className={`w-full rounded-lg border bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray focus:outline-none ${
              error ? "border-red-500/50" : "border-white/10 focus:border-teal focus:ring-1 focus:ring-teal"
            }`}
          />
          {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-teal py-3 font-semibold text-charcoal hover:shadow-teal-glow disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send Reset Link"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-body-gray">
        <Link href="/login" className="text-teal hover:underline">
          ← Back to Login
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingRing />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
