"use client";

import { FormEvent, useEffect, useState } from "react";
import PasswordInput from "@/components/PasswordInput";

type InviteDetails = {
  valid: boolean;
  email?: string;
  gameNameHint?: string;
  reason?: string;
};

const PASSWORD_EXISTING_ACCOUNT_HINT =
  "already have a SkillFlow account? use that password.";

const VALUE_PROPS = [
  {
    title: "earn on every match.",
    body: "You get 20% of every pot your game generates — automatically, forever.",
  },
  {
    title: "we handle everything.",
    body: "Payments, players, matchmaking. You just build.",
  },
  {
    title: "your audience, amplified.",
    body: "Your players can now compete for real stakes on SkillFlow.",
  },
];

export default function CreatorInviteApplication({ token }: { token: string }) {
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordHint, setShowPasswordHint] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gameName, setGameName] = useState("");
  const [gameUrl, setGameUrl] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [winCondition, setWinCondition] = useState("");
  const [skillConfirmed, setSkillConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    void fetch(`/api/invite/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: InviteDetails) => {
        if (!data.valid) {
          window.location.href = `/invite/${encodeURIComponent(token)}/expired`;
          return;
        }
        setInvite(data);
        if (data.email) setEmail(data.email);
        if (data.gameNameHint) setGameName(data.gameNameHint);
      })
      .catch(() => {
        window.location.href = `/invite/${encodeURIComponent(token)}/expired`;
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setShowPasswordHint(false);
    setSubmitting(true);

    try {
      const res = await fetch("/api/creator/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name,
          email,
          password,
          gameName,
          gameUrl,
          gameDescription,
          winCondition,
          skillConfirmed,
          termsAccepted,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          setShowPasswordHint(true);
          return;
        }
        setError(data.error ?? "Something went wrong.");
        return;
      }

      window.location.href = "/invite/pending";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  if (!invite?.valid) return null;

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-[#0E0E12] px-4 py-3 text-sm text-white placeholder:text-[#7A7A8E] focus:border-[#FFFF00] focus:outline-none focus:ring-1 focus:ring-[#FFFF00]/30 transition-colors";

  return (
    <div className="min-h-screen bg-[#0E0E12] text-[#F0F0F4]">
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .invite-fade {
          animation: fadeUp 0.7s ease-out forwards;
          opacity: 0;
        }
        .invite-delay-1 { animation-delay: 0.1s; }
        .invite-delay-2 { animation-delay: 0.2s; }
        .invite-delay-3 { animation-delay: 0.3s; }
        .invite-delay-4 { animation-delay: 0.4s; }
      `}</style>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="invite-fade mb-12 text-center">
          <div className="text-2xl font-bold tracking-tight text-[#FFFF00]">SkillFlow</div>
        </div>

        <section className="invite-fade invite-delay-1 mb-12 text-center">
          <h1 className="text-4xl font-semibold lowercase tracking-tight text-white sm:text-5xl">
            you&apos;ve been invited.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#C8C8D4] sm:text-lg">
            SkillFlow selects a small number of game creators to bring their games to our
            real-money skill platform. You&apos;re one of them.
          </p>
        </section>

        <section className="invite-fade invite-delay-2 mb-12 grid gap-4 sm:grid-cols-3">
          {VALUE_PROPS.map((prop) => (
            <div
              key={prop.title}
              className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5 transition-colors hover:border-[#FFFF00]/20"
            >
              <div className="mb-3 h-1 w-8 rounded bg-[#FFFF00]" />
              <h3 className="text-sm font-semibold lowercase text-white">{prop.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#7A7A8E]">{prop.body}</p>
            </div>
          ))}
        </section>

        <section className="invite-fade invite-delay-3 mb-12 rounded-xl border border-[#FFFF00]/30 bg-[#1A1A1F] p-6 sm:p-8">
          <h2 className="mb-4 text-lg font-semibold lowercase text-[#FFFF00]">the deal.</h2>
          <ul className="space-y-3 text-sm leading-relaxed text-[#C8C8D4]">
            <li>Platform takes 12% rake per match.</li>
            <li>You earn 20% of that rake — automatically, every match, forever.</li>
            <li>SkillFlow handles all payments via Xsolla.</li>
            <li>Your game stays yours — we license it, never own it.</li>
            <li>
              Material Breach protection: your earnings are protected if we ever change terms
              unfairly.
            </li>
          </ul>
        </section>

        <section className="invite-fade invite-delay-4 rounded-xl border border-white/5 bg-[#1A1A1F] p-6 sm:p-8">
          <h2 className="mb-6 text-lg font-semibold lowercase text-white">your application</h2>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs lowercase text-[#7A7A8E]">your name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs lowercase text-[#7A7A8E]">your email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={invite.email ? undefined : (e) => setEmail(e.target.value)}
                  readOnly={!!invite.email}
                  tabIndex={invite.email ? -1 : undefined}
                  className={`${inputClass} ${
                    invite.email
                      ? "cursor-not-allowed border-[#FFFF00]/25 bg-[#0E0E12]/90 text-[#C8C8D4] opacity-80 focus:border-[#FFFF00]/25 focus:ring-0"
                      : ""
                  }`}
                />
                {invite.email ? (
                  <p className="mt-1.5 text-xs lowercase text-[#7A7A8E]">
                    this invite is locked to this email address.
                  </p>
                ) : null}
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs lowercase text-[#7A7A8E]">password</span>
              <PasswordInput
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setShowPasswordHint(false);
                }}
                placeholder="min. 8 characters"
                required
              />
              {showPasswordHint ? (
                <p className="mt-1.5 text-xs lowercase text-[#7A7A8E]">
                  {PASSWORD_EXISTING_ACCOUNT_HINT}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs lowercase text-[#7A7A8E]">game name</span>
              <input required value={gameName} onChange={(e) => setGameName(e.target.value)} className={inputClass} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs lowercase text-[#7A7A8E]">
                where can we play your game?
              </span>
              <input
                required
                type="url"
                value={gameUrl}
                onChange={(e) => setGameUrl(e.target.value)}
                placeholder="itch.io, your website, app store link, etc."
                className={inputClass}
              />
              <p className="mt-1.5 text-xs lowercase text-[#7A7A8E]">
                for review only — players will never leave SkillFlow
              </p>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs lowercase text-[#7A7A8E]">
                game description ({gameDescription.length}/500)
              </span>
              <textarea
                required
                maxLength={500}
                rows={4}
                value={gameDescription}
                onChange={(e) => setGameDescription(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs lowercase text-[#7A7A8E]">
                how does a player win? ({winCondition.length}/300)
              </span>
              <textarea
                required
                maxLength={300}
                rows={3}
                value={winCondition}
                onChange={(e) => setWinCondition(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="flex items-start gap-3 text-sm text-[#C8C8D4]">
              <input type="checkbox" checked={skillConfirmed} onChange={(e) => setSkillConfirmed(e.target.checked)} className="mt-1 accent-[#FFFF00]" />
              <span>I confirm this game is skill-based, not luck-based.</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-[#C8C8D4]">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#FFFF00]" />
              <span>
                I agree to the{" "}
                <a href="/creator-terms" target="_blank" rel="noopener noreferrer" className="text-[#FFFF00] underline">
                  SkillFlow Creator Terms
                </a>
                .
              </span>
            </label>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg py-3.5 text-sm font-semibold lowercase text-black disabled:opacity-50"
              style={{ background: "#FFFF00" }}
            >
              {submitting ? "submitting…" : "apply to join skillflow."}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
