"use client";

import { useState } from "react";

const items = [
  {
    q: "Is this gambling?",
    a: "No. SkillFlow is a skill-based competition platform. Unlike casinos, the outcome is determined entirely by your ability — not luck or chance.",
  },
  {
    q: "How does matchmaking work?",
    a: "Our algorithm matches you with players of similar skill rating, so every match is competitive and fair.",
  },
  {
    q: "What's the platform fee?",
    a: "We take a 5% fee from each match pot. That's it. No hidden fees.",
  },
  {
    q: "How do I withdraw my winnings?",
    a: "You can withdraw anytime to your bank account or preferred payment method. Fast and simple.",
  },
  {
    q: "What games are available?",
    a: "We're launching with 8 Ball Pool, Chess, and Mini Golf, with many more games coming soon including PC titles.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">FAQ</h2>
        <div className="mt-14 space-y-2">
          {items.map((item, i) => (
            <div
              key={item.q}
              className="card-border rounded-card overflow-hidden bg-card transition-colors hover:border-white/10"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-6 py-4 text-left font-medium transition-colors hover:text-teal"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                {item.q}
                <span
                  className={`ml-2 shrink-0 text-teal transition-transform duration-200 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </button>
              <div
                className={`grid transition-all duration-200 ${
                  openIndex === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="border-t border-white/5 px-6 py-4 text-body-gray">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
