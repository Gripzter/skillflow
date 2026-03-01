"use client";

import Link from "next/link";

const STEPS = [
  { num: "01", icon: "💰", title: "Deposit", desc: "Add funds instantly with any card. Your money is secured by Stripe." },
  { num: "02", icon: "🎮", title: "Compete", desc: "Pick a game, choose your stake, and get matched with a real opponent." },
  { num: "03", icon: "🏆", title: "Cash Out", desc: "Win and withdraw your earnings. Real money, straight to your account." },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-white/5 bg-[#0D1117] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">Win Money in 3 Steps</h2>

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative text-center">
              <div className="relative inline-block">
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-6xl font-bold text-white/5">
                  {step.num}
                </span>
                <span className="relative block text-5xl" aria-hidden>{step.icon}</span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-body-gray">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
