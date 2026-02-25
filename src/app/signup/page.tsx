"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase";

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  dob?: string;
  terms?: string;
}

export default function SignUpPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dob, setDob] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

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

    if (!dob) {
      newErrors.dob = "Date of birth is required";
    } else {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        newErrors.dob = "You must be at least 18 years old to use SkillFlow";
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
            date_of_birth: dob,
          },
        },
      });

      if (error) {
        showToast(error.message, "error");
      } else {
        showToast("Check your email to verify your account!", "success");
        setUsername("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setDob("");
        setTermsAccepted(false);
        setErrors({});
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout heading="Create your account" subtitle="Join the arena. Bet on yourself.">
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
            className={`w-full rounded-lg border bg-[#1A1D27] px-4 py-3 text-white placeholder:text-body-gray transition-colors focus:outline-none ${
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
            placeholder="Create a password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
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
          />
          {errors.confirmPassword && (
            <p className="mt-1.5 text-sm text-red-400">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Date of Birth */}
        <div>
          <label className="mb-1.5 block text-sm text-body-gray">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => {
              setDob(e.target.value);
              if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
            }}
            className={`w-full rounded-lg border bg-[#1A1D27] px-4 py-3 text-white transition-colors focus:outline-none [color-scheme:dark] ${
              errors.dob
                ? "border-red-500/50 focus:border-red-500"
                : "border-white/10 focus:border-teal focus:ring-1 focus:ring-teal"
            }`}
          />
          {errors.dob && <p className="mt-1.5 text-sm text-red-400">{errors.dob}</p>}
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
              className="mt-1 h-4 w-4 shrink-0 appearance-none rounded border border-white/20 bg-[#1A1D27] checked:border-teal checked:bg-teal transition-colors focus:ring-1 focus:ring-teal focus:ring-offset-0"
            />
            <span className="text-sm text-body-gray">
              I confirm that I am at least 18 years old and agree to the{" "}
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
          disabled={loading || !termsAccepted}
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
