import Link from "next/link";
import LegalLayout from "@/components/LegalLayout";

const LEGAL_CARDS = [
  {
    title: "Terms of Service",
    href: "/terms",
    description: "Your agreement with SkillFlow — eligibility, wagering rules, and limitations of liability.",
  },
  {
    title: "Privacy Policy",
    href: "/privacy",
    description: "How we collect, use, and protect your data when you play on SkillFlow.",
  },
  {
    title: "Responsible Play",
    href: "/responsible-play",
    description: "Guidelines, self‑exclusion options, and resources to help you stay in control.",
  },
  {
    title: "Refund Policy",
    href: "/refund",
    description: "How deposits, withdrawals, and match refunds are handled.",
  },
  {
    title: "Fair Play & Anti‑Cheat",
    href: "/fairplay",
    description: "Our zero‑tolerance stance on cheating and how we enforce it.",
  },
];

export default function LegalHubPage() {
  return (
    <LegalLayout title="Legal">
      <p className="mt-6 text-[15px] leading-relaxed text-gray-300">
        This hub brings together all of SkillFlow&apos;s core legal and policy documents. We recommend that every player read
        these pages carefully before depositing funds or joining matches.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {LEGAL_CARDS.map((card) => (
          <article
            key={card.href}
            className="card-border flex flex-col justify-between rounded-card border-l-4 border-l-teal/70 bg-card/80 p-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-white">{card.title}</h2>
              <p className="mt-2 text-sm text-gray-300">{card.description}</p>
            </div>
            <div className="mt-4">
              <Link href={card.href} className="text-sm font-medium text-teal hover:underline">
                Read →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </LegalLayout>
  );
}

