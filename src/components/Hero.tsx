"use client";

import { useState, FormEvent } from "react";

export default function Hero() {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log("Waitlist email:", email);
    setEmail("");
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden px-4 pt-28 pb-20 sm:px-6 sm:pt-36 lg:px-8"
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-mesh-gradient bg-grid-pattern" />

      <div className="relative mx-auto max-w-4xl text-center">
        <h1 className="text-[28px] font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Bet On Yourself.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-body-gray sm:text-xl">
          Compete head-to-head in skill-based games. No luck. No house edge.
          Just you vs your opponent — winner takes all.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row sm:gap-2"
        >
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 rounded-card border border-white/10 bg-card px-4 py-3.5 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <button
            type="submit"
            className="pressable w-full rounded-card bg-teal px-6 py-3.5 font-semibold text-charcoal transition-all hover:shadow-teal-glow sm:w-auto"
          >
            Join the Waitlist
          </button>
        </form>

        <p className="mt-6 text-sm text-body-gray">
           Launching soon — be the first to play
        </p>
      </div>
    </section>
  );
}
