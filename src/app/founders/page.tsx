"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase";

const TIERS = [
  {
    name: "Early Supporter",
    teaser: "Founding badge, early platform access, and priority product updates.",
  },
  {
    name: "Launch Founder",
    teaser: "Everything above, plus priority event access and bonus launch credit.",
  },
  {
    name: "Omega Founder",
    teaser: "Top-tier status with concierge support and exclusive launch experiences.",
  },
];

export default function FoundersPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      showToast("Please enter your email address.", "error");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        showToast("Waitlist is temporarily unavailable. Please try again shortly.", "error");
        return;
      }

      const { error } = await supabase.from("founders_waitlist").insert({ email: cleanedEmail });

      if (error) {
        if (error.code === "23505") {
          showToast("You are already on the waitlist.", "info");
        } else {
          showToast("Could not join the waitlist right now. Please try again.", "error");
        }
        return;
      }

      setEmail("");
      showToast("You are in. Welcome to the Founders waitlist.", "success");
    } catch {
      showToast("Unexpected error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-charcoal text-primary-text">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
        <div className="space-y-4">
          <p className="inline-flex w-fit rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal">
            Limited pre-launch access
          </p>
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-5xl">
            SkillFlow Founders Program
          </h1>
          <p className="max-w-2xl text-base text-body sm:text-lg">
            Get exclusive perks before real-money launch. Limited spots.
          </p>
        </div>

        <div className="rounded-card border border-teal/20 bg-card/80 p-5 shadow-teal-glow backdrop-blur-sm sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="founders-email" className="text-sm font-medium text-white/90">
              Enter your email
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="founders-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={submitting}
                className="h-12 w-full rounded-lg border border-white/15 bg-charcoal px-4 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:opacity-60"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="h-12 rounded-lg bg-gradient-teal-purple px-6 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Joining..." : "Join the Waitlist"}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">Founder Tier Preview</h2>
          <div className="grid gap-3">
            {TIERS.map((tier) => (
              <article
                key={tier.name}
                className="rounded-card border border-white/10 bg-card/70 p-4 transition hover:border-teal/35 hover:bg-card"
              >
                <h3 className="text-base font-semibold text-teal sm:text-lg">{tier.name}</h3>
                <p className="mt-1 text-sm text-body sm:text-base">{tier.teaser}</p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <Link
            href="/play"
            className="inline-flex items-center gap-2 text-sm font-medium text-body transition hover:text-teal sm:text-base"
          >
            Already have an account? Play now <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
