"use client";

import { useState, FormEvent } from "react";

export default function FinalCTA() {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log("Waitlist email:", email);
    setEmail("");
  };

  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Ready to prove your skill?
        </h2>
        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:gap-2"
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
            className="rounded-card bg-gradient-to-r from-teal to-purple px-6 py-3.5 font-semibold text-white transition-all hover:shadow-teal-glow"
          >
            Join the Waitlist
          </button>
        </form>
        <p className="mt-6 text-body-gray">No luck. No house edge. Just skill.</p>
      </div>
    </section>
  );
}
