"use client";

import { useState, FormEvent, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import { createClient } from "@/lib/supabase";
import { getUserFriendlyError } from "@/lib/errorHandler";

function passwordStrength(pwd: string): "weak" | "fair" | "good" | "strong" {
  if (pwd.length < 8) return "weak";
  const hasNum = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
  if (hasNum && hasSpecial) return "strong";
  if (hasNum || hasSpecial) return "good";
  return "fair";
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const strengthClass = {
    weak: "bg-red-500",
    fair: "bg-yellow-500",
    good: "bg-yellow-500",
    strong: "bg-emerald-500",
  };
  const strengthLabel = { weak: "Weak", fair: "Fair", good: "Good", strong: "Strong" };

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setError("Service is temporarily unavailable. Please try again later.");
      setLoading(false);
      return;
    }
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(getUserFriendlyError(err));
      setLoading(false);
      return;
    }
    router.push("/login?message=Password+updated!+Please+log+in+with+your+new+password.");
    router.refresh();
  }

  return (
    <AuthLayout heading="Set New Password" subtitle="Choose a secure password">
      <form onSubmit={handleUpdate} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm text-body-gray">New Password</label>
          <PasswordInput
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error && password.length > 0 && password.length < 8 ? "At least 8 characters" : undefined}
          />
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-all ${strengthClass[strength]} ${
                  strength === "weak" ? "w-1/4" : strength === "fair" ? "w-1/2" : strength === "good" ? "w-3/4" : "w-full"
                }`}
              />
            </div>
            <span className={`text-xs ${strength === "weak" ? "text-red-400" : strength === "fair" ? "text-yellow-400" : strength === "good" ? "text-yellow-400" : "text-emerald-400"}`}>
              {strengthLabel[strength]}
            </span>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-body-gray">Confirm New Password</label>
          <PasswordInput
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmPassword && password !== confirmPassword ? "Passwords do not match" : undefined}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || password.length < 8 || password !== confirmPassword}
          className="w-full rounded-lg bg-teal py-3 font-semibold text-charcoal hover:shadow-teal-glow disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update Password"}
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
