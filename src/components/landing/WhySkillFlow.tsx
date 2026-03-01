"use client";

const FEATURES = [
  { icon: "🎯", title: "Pure Skill", desc: "No luck, no algorithms against you. Better player wins. Period." },
  { icon: "💸", title: "Low Fees", desc: "Only 5% platform fee. You keep more of your winnings than any competitor." },
  { icon: "⚡", title: "Instant Matches", desc: "Get matched with a real opponent in seconds. No waiting, no bots." },
  { icon: "🔒", title: "Secure & Fair", desc: "Bank-grade security by Stripe. Anti-cheat monitoring. Fair play guaranteed." },
];

export default function WhySkillFlow() {
  return (
    <section id="why-skillflow" className="scroll-mt-20 border-t border-white/5 bg-[#0D1117] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">Why Players Choose SkillFlow</h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:gap-8">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-colors hover:border-teal/30"
            >
              <span className="block text-center text-4xl" aria-hidden>{f.icon}</span>
              <h3 className="mt-4 text-center text-xl font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-center text-body-gray">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
