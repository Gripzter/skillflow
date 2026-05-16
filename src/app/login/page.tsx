"use client";

import { useState, FormEvent, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import { useToast } from "@/components/Toast";
import LoadingRing from "@/components/LoadingRing";
import { createClient } from "@/lib/supabase";

const DEV_ACCESS_CODE = "6174";

interface FormErrors {
  email?: string;
  password?: string;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [urlMessage, setUrlMessage] = useState<string | null>(null);

  useEffect(() => {
    const message = searchParams.get("message");
    const error = searchParams.get("error");
    if (message) setUrlMessage(decodeURIComponent(message));
    if (error) setUrlMessage(decodeURIComponent(error).replace(/_/g, " "));
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const [devSectionOpen, setDevSectionOpen] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [devError, setDevError] = useState("");
  const [devLoading, setDevLoading] = useState(false);

  if (loading || devLoading) {
    return <LoadingRing />;
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        showToast(
          "Authentication is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
          "error"
        );
        setLoading(false);
        return;
      }
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showToast(error.message, "error");
      } else {
        const user = authData.user;
        const { data: rg } = user
          ? await supabase
              .from("responsible_gaming")
              .select("self_excluded, self_exclusion_until")
              .eq("user_id", user.id)
              .single()
          : { data: null };
        if (user && rg?.self_excluded) {
          const until = rg.self_exclusion_until;
          if (!until || new Date(until) > new Date()) {
            await supabase.auth.signOut();
            showToast(
              `Your account is self-excluded${until ? ` until ${new Date(until).toLocaleDateString()}` : " permanently"}. If you need support, call 1-800-522-4700.`,
              "error"
            );
            setLoading(false);
            return;
          }
          await supabase.from("responsible_gaming").update({
            self_excluded: false,
            self_exclusion_until: null,
            self_exclusion_type: null,
          }).eq("user_id", user.id);
        }
        showToast("Welcome back!", "success");
        router.push("/play");
        router.refresh();
      }
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleDeveloperLogin() {
    setDevError("");
    if (!devCode.trim()) {
      setDevError("Enter developer code");
      return;
    }
    setDevLoading(true);
    if (devCode.trim() === DEV_ACCESS_CODE) {
      if (typeof window !== "undefined") {
        localStorage.setItem("skillflow_dev_mode", "true");
        localStorage.setItem(
          "skillflow_dev_user",
          JSON.stringify({
            username: "Developer",
            email: "dev@skillflow.com",
            role: "developer",
          })
        );
      }
      router.push("/play");
      router.refresh();
    } else {
      setDevError("Invalid developer code");
      setDevLoading(false);
    }
  }

  return (
    <AuthLayout heading="Welcome back" subtitle="Log in to your account">
      {urlMessage && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            urlMessage.includes("error") || urlMessage.includes("failed")
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {urlMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Email */}
        <div>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            className={`w-full rounded-lg border bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray transition-colors focus:outline-none ${
              errors.email
                ? "border-red-500/50 focus:border-red-500"
                : "border-white/10 focus:border-teal focus:ring-1 focus:ring-teal"
            }`}
          />
          {errors.email && <p className="mt-1.5 text-sm text-red-400">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <PasswordInput
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
          />
          {errors.password && <p className="mt-1.5 text-sm text-red-400">{errors.password}</p>}
        </div>

        {/* Forgot password */}
        <div className="text-right">
          <Link href="/auth/reset-password" className="text-sm text-body-gray hover:text-teal transition-colors">
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-teal py-3 font-semibold text-charcoal transition-all hover:shadow-teal-glow disabled:cursor-not-allowed disabled:opacity-60"
        >
          Log In
        </button>
      </form>

      {/* Developer Access — outside form to avoid nested form hydration error */}
      <div className="mt-6 border-t border-white/5 pt-4">
        <button
          type="button"
          onClick={() => {
            setDevSectionOpen((o) => !o);
            setDevError("");
            if (!devSectionOpen) setDevCode("");
          }}
          className="text-xs text-body-gray hover:text-white/80 transition-colors"
        >
          Developer Access
        </button>
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            devSectionOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="mt-3 rounded-lg border border-purple/20 bg-purple/5 px-3 py-3">
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Enter developer code"
                  value={devCode}
                  onChange={(e) => {
                    setDevCode(e.target.value);
                    if (devError) setDevError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleDeveloperLogin();
                    }
                  }}
                  className="w-full rounded border border-white/10 bg-[#1A1D27] px-3 py-2 text-sm text-white placeholder:text-body-gray focus:border-purple focus:outline-none focus:ring-1 focus:ring-purple font-mono"
                />
                {devError && <p className="text-xs text-red-400">{devError}</p>}
                <button
                  type="button"
                  onClick={handleDeveloperLogin}
                  disabled={devLoading}
                  className="w-full rounded-lg bg-purple py-2 text-sm font-medium text-white transition-all hover:shadow-purple-glow disabled:opacity-60"
                >
                  Developer Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-body-gray">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-teal font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<LoadingRing />}
    >
      <LoginContent />
    </Suspense>
  );
}
