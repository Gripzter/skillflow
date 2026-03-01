import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Responsible Gaming | SkillFlow",
  description:
    "SkillFlow is committed to providing a safe and enjoyable gaming experience. Set limits, take breaks, and get help.",
};

const HELPLINE = "1-800-522-4700";
const HELPLINE_TEL = "18005224700";
const HELPLINE_CHAT = "https://ncpgambling.org/chat";
const NCPG = "https://ncpgambling.org";
const GA = "https://www.gamblersanonymous.org";

export default function ResponsibleGamingPage() {
  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <header className="border-b border-white/5 bg-charcoal/80 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-lg font-bold text-white">
            SkillFlow
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white hover:bg-white/5"
          >
            Log in
          </Link>
        </div>
      </header>
      <main className="relative mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-white">Responsible Gaming</h1>
        <p className="mt-2 text-lg text-body-gray">
          SkillFlow is committed to providing a safe and enjoyable gaming experience.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">Stay in Control</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-body-gray">
            <li>Set deposit limits to manage your spending</li>
            <li>Take a cool-off break if you need time away</li>
            <li>Self-exclude if you feel gaming is becoming a problem</li>
            <li>Review your gaming history regularly</li>
          </ul>
          <p className="mt-4">
            <Link href="/settings/responsible-gaming" className="font-medium text-teal hover:underline">
              Manage your limits in Settings →
            </Link>
            {" "}(requires login)
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">Warning Signs</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-body-gray">
            <li>Spending more than you can afford</li>
            <li>Chasing losses by playing more</li>
            <li>Neglecting responsibilities due to gaming</li>
            <li>Borrowing money to play</li>
            <li>Feeling anxious or irritable when not playing</li>
          </ul>
        </section>

        <section className="mt-10 rounded-xl border-2 border-teal/40 bg-teal/5 p-6">
          <h2 className="text-xl font-semibold text-white">Get Help</h2>
          <p className="mt-2 text-body-gray">
            24/7, free, and confidential support for problem gambling:
          </p>
          <p className="mt-4 text-2xl font-bold tracking-wide text-teal">
            <a href={`tel:${HELPLINE_TEL}`} className="hover:underline">
              📞 {HELPLINE}
            </a>
          </p>
          <p className="mt-2 text-lg font-medium text-white">
            National Problem Gambling Helpline
          </p>
          <ul className="mt-4 space-y-2 text-body-gray">
            <li>
              💬 Chat:{" "}
              <a href={HELPLINE_CHAT} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                ncpgambling.org/chat
              </a>
            </li>
            <li>📱 Text: {HELPLINE}</li>
            <li>
              National Council on Problem Gambling:{" "}
              <a href={NCPG} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                ncpgambling.org
              </a>
            </li>
            <li>
              Gamblers Anonymous:{" "}
              <a href={GA} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                gamblersanonymous.org
              </a>
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">Our Commitment</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-body-gray">
            <li>All players must be 18+</li>
            <li>We provide deposit limits, cool-off periods, and self-exclusion tools</li>
            <li>We never target self-excluded players with promotions</li>
            <li>We monitor for signs of problematic behavior</li>
            <li>We train our team on responsible gaming practices</li>
          </ul>
        </section>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/"
            className="rounded-lg border border-white/20 px-4 py-2.5 font-medium text-white hover:bg-white/5"
          >
            Back to Home
          </Link>
          <Link
            href="/terms"
            className="rounded-lg border border-white/20 px-4 py-2.5 font-medium text-white hover:bg-white/5"
          >
            Terms of Service
          </Link>
        </div>
      </main>
    </div>
  );
}
