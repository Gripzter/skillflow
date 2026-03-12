"use client";

import { useState, FormEvent, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase";
import { ensureReferralCode } from "@/lib/referrals";

const REFERRAL_STORAGE_KEY = "skillflow_referral_code";

const AGE_CHECK_FAILED_KEY = "skillflow_age_check_failed";
const FORM_DISABLED_KEY = "skillflow_signup_form_disabled";

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function getDaysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  dob?: string;
  terms?: string;
}

function SignupContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [month, setMonth] = useState<number | "">("");
  const [day, setDay] = useState<number | "">("");
  const [year, setYear] = useState<number | "">("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [formDisabled, setFormDisabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(FORM_DISABLED_KEY) === "true";
  });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [showVerificationScreen, setShowVerificationScreen] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get("ref")?.trim()?.toLowerCase();
    if (fromUrl) {
      setReferralCode(fromUrl);
      if (typeof window !== "undefined") window.localStorage.setItem(REFERRAL_STORAGE_KEY, fromUrl);
      return;
    }
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(REFERRAL_STORAGE_KEY)?.trim()?.toLowerCase();
      if (stored) setReferralCode(stored);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!resendDisabled || resendCountdown <= 0) return;
    const t = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          setResendDisabled(false);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resendDisabled, resendCountdown]);

  async function handleResendVerification() {
    const supabase = createClient();
    if (!supabase || !verificationEmail) return;
    setResendMessage(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: verificationEmail,
    });
    if (!error) {
      setResendMessage("Verification email sent! Check your inbox.");
      setResendDisabled(true);
      setResendCountdown(60);
    } else {
      setResendMessage(error.message);
    }
  }

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 100; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const maxDay = useMemo(() => getDaysInMonth(month || 1, year || currentYear), [month, year, currentYear]);
  const dayOptions = useMemo(() => Array.from({ length: maxDay }, (_, i) => i + 1), [maxDay]);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!username.trim()) {
      newErrors.username = "Username is required";
    } else if (username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (month === "" || day === "" || year === "") {
      newErrors.dob = "Date of birth is required";
    } else {
      const birthDate = new Date(year, month - 1, day);
      const age = calculateAge(birthDate);
      if (age < 18) {
        newErrors.dob = "You must be 18 or older to use SkillFlow. This is a legal requirement for skill-based wagering platforms.";
      }
    }

    if (!termsAccepted) {
      newErrors.terms = "You must agree to the Terms of Service and Privacy Policy";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (formDisabled) return;
    if (!validate()) return;

    const birthDate = new Date(year as number, (month as number) - 1, day as number);
    const age = calculateAge(birthDate);
    if (age < 18) {
      const msg = "You must be 18 or older to create an account.";
      setErrors((prev) => ({ ...prev, dob: msg }));
      try {
        localStorage.setItem(AGE_CHECK_FAILED_KEY, JSON.stringify({ at: Date.now() }));
        sessionStorage.setItem(FORM_DISABLED_KEY, "true");
        setFormDisabled(true);
      } catch {
        setFormDisabled(true);
      }
      return;
    }

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

      const dobISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
          data: {
            username: username.trim(),
            date_of_birth: dobISO,
          },
        },
      });

      if (error) {
        showToast(error.message, "error");
        setLoading(false);
        return;
      }

      if (data?.user) {
        const newUserId = data.user.id;
        await supabase
          .from("profiles")
          .update({
            date_of_birth: dobISO,
            age_verified: true,
            age_verified_at: new Date().toISOString(),
          })
          .eq("id", newUserId);
        await ensureReferralCode(supabase, newUserId, username.trim());
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("referred_by")
          .eq("id", newUserId)
          .single();
        if (!existingProfile?.referred_by && referralCode) {
          const { data: referrer } = await supabase
            .from("profiles")
            .select("id")
            .eq("referral_code", referralCode)
            .maybeSingle();
          if (referrer && referrer.id !== newUserId) {
            await supabase
              .from("profiles")
              .update({ referred_by: referralCode })
              .eq("id", newUserId);
            await supabase.from("referrals").insert({
              referrer_id: referrer.id,
              referred_id: newUserId,
              referral_code: referralCode,
              status: "pending",
            });
          }
        }
        if (typeof window !== "undefined") window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
      }

      setVerificationEmail(email);
      setShowVerificationScreen(true);
      showToast("Check your email to verify your account!", "success");
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  const under18Error = errors.dob && (month !== "" && day !== "" && year !== "" && calculateAge(new Date(year as number, (month as number) - 1, day as number)) < 18);

  if (showVerificationScreen) {
    return (
      <AuthLayout heading="Check Your Email" subtitle="Verify your account to get started">
        <div className="rounded-xl border border-white/10 bg-card p-8 text-center">
          <span className="text-5xl" aria-hidden />
          <h2 className="mt-4 text-xl font-bold text-white">Check Your Email</h2>
          <p className="mt-2 text-body-gray">
            We&apos;ve sent a verification link to <strong className="text-white">{verificationEmail}</strong>
          </p>
          <p className="mt-3 text-sm text-body-gray">
            Click the link in the email to verify your account and start playing.
          </p>
          <p className="mt-6 text-sm text-body-gray">Didn&apos;t receive it?</p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendDisabled}
            className="mt-2 rounded-lg border border-teal/50 bg-teal/10 px-4 py-2 text-sm font-medium text-teal hover:bg-teal/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendDisabled && resendCountdown > 0
              ? `Resend available in ${resendCountdown}s`
              : "Resend Verification Email"}
          </button>
          {resendMessage && (
            <p className={`mt-3 text-sm ${resendMessage.startsWith("Verification") ? "text-emerald-400" : "text-red-400"}`}>
              {resendMessage}
            </p>
          )}
          <p className="mt-6 text-xs text-body-gray">
            Check your spam folder if you don&apos;t see it in your inbox.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-body-gray">
          Already have an account?{" "}
          <Link href="/login" className="text-teal font-medium hover:underline">
            Log in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout heading="Create your account" subtitle="Join the arena. Bet on yourself.">
      {referralCode && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          You&apos;ll get a $5 bonus after your first deposit ($5+)!
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Username */}
        <div>
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
            }}
            disabled={formDisabled}
            className={`w-full rounded-lg border bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray transition-colors focus:outline-none disabled:opacity-60 ${
              errors.username
                ? "border-red-500/50 focus:border-red-500"
                : "border-white/10 focus:border-teal focus:ring-1 focus:ring-teal"
            }`}
          />
          {errors.username && <p className="mt-1.5 text-sm text-red-400">{errors.username}</p>}
        </div>

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
            disabled={formDisabled}
            className={`w-full rounded-lg border bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray transition-colors focus:outline-none disabled:opacity-60 ${
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
            placeholder="Create a password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
            disabled={formDisabled}
          />
          {errors.password && <p className="mt-1.5 text-sm text-red-400">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <PasswordInput
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword)
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            error={errors.confirmPassword}
            disabled={formDisabled}
          />
          {errors.confirmPassword && (
            <p className="mt-1.5 text-sm text-red-400">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Date of Birth */}
        <div>
          <label className="mb-1.5 block text-sm text-body-gray">Date of Birth</label>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={month === "" ? "" : month}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setMonth(v);
                if (v && day > getDaysInMonth(v, year || currentYear)) setDay("");
                if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
              }}
              disabled={formDisabled}
              className={`rounded-lg border bg-[#1A1D27] px-3 py-3 text-white focus:outline-none disabled:opacity-60 [color-scheme:dark] ${
                errors.dob
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-white/10 focus:border-teal focus:ring-1 focus:ring-teal"
              }`}
            >
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={day === "" ? "" : day}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setDay(v);
                if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
              }}
              disabled={formDisabled}
              className={`rounded-lg border bg-[#1A1D27] px-3 py-3 text-white focus:outline-none disabled:opacity-60 [color-scheme:dark] ${
                errors.dob
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-white/10 focus:border-teal focus:ring-1 focus:ring-teal"
              }`}
            >
              <option value="">Day</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={year === "" ? "" : year}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setYear(v);
                if (v && month && day > getDaysInMonth(month, v)) setDay("");
                if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
              }}
              disabled={formDisabled}
              className={`rounded-lg border bg-[#1A1D27] px-3 py-3 text-white focus:outline-none disabled:opacity-60 [color-scheme:dark] ${
                errors.dob
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-white/10 focus:border-teal focus:ring-1 focus:ring-teal"
              }`}
            >
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-body-gray">
            You must be 18+ to play. This is required by law.
          </p>
          {errors.dob && (
            <div className="mt-2">
              <p className={`text-sm ${under18Error ? "font-medium text-red-400" : "text-red-400"}`}>
                {errors.dob}
              </p>
              {under18Error && (
                <p className="mt-2 text-sm text-body-gray">
                  If you believe this is an error, please contact support.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Terms checkbox */}
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (errors.terms) setErrors((prev) => ({ ...prev, terms: undefined }));
              }}
              disabled={formDisabled}
              className="mt-1 h-4 w-4 shrink-0 appearance-none rounded border border-white/20 bg-[#1A1D27] checked:border-teal checked:bg-teal transition-colors focus:ring-1 focus:ring-teal focus:ring-offset-0 disabled:opacity-60"
            />
            <span className="text-sm text-body-gray">
              I confirm I am at least 18 years old and agree to the{" "}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.terms && <p className="mt-1.5 text-sm text-red-400">{errors.terms}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !termsAccepted || formDisabled}
          className="w-full rounded-lg bg-teal py-3 font-semibold text-charcoal transition-all hover:shadow-teal-glow disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Creating Account...
            </span>
          ) : formDisabled ? (
            "Registration unavailable"
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-body-gray">
        By creating an account, you confirm you are at least 18 years old and agree to our{" "}
        <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-4 text-center text-sm text-body-gray">
        Already have an account?{" "}
        <Link href="/login" className="text-teal font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-charcoal">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
