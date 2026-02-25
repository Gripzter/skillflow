import LegalLayout from "@/components/LegalLayout";

export default function FairPlayPage() {
  return (
    <LegalLayout title="Fair Play &amp; Anti-Cheat Policy">
      <nav className="mt-6 rounded-card border border-white/5 bg-card/60 p-4 text-sm">
        <p className="font-semibold text-white">Table of contents</p>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li><a href="#commitment" className="text-teal hover:underline">Our Commitment</a></li>
          <li><a href="#what-is-cheating" className="text-teal hover:underline">What Counts as Cheating</a></li>
          <li><a href="#detection" className="text-teal hover:underline">How We Detect Cheating</a></li>
          <li><a href="#reporting" className="text-teal hover:underline">Reporting Suspected Cheating</a></li>
          <li><a href="#consequences" className="text-teal hover:underline">Consequences</a></li>
          <li><a href="#appeals" className="text-teal hover:underline">Appeals</a></li>
        </ol>
      </nav>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section id="commitment" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">1. Our Commitment</h2>
          <p className="mt-3">
            SkillFlow is built around fair, skill‑based competition. Every player should feel confident that they are competing on
            a level playing field where outcomes are determined by ability — not by exploits, scripts, or collusion.
          </p>
          <p className="mt-2">
            To protect that experience, we invest in anti‑cheat systems, connection logging, and manual review processes. We have
            zero tolerance for cheating or manipulation of any kind.
          </p>
        </section>

        <section id="what-is-cheating" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">2. What Counts as Cheating</h2>
          <p className="mt-3">
            Cheating includes any behavior that gives you or another player an unfair advantage, or that manipulates match
            outcomes, rankings, or financial results. Examples include, but are not limited to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Using bots, scripts, macros, or automated tools to play on your behalf.</li>
            <li>Using software that alters game behavior or provides unfair information (aimbots, wallhacks, speed hacks, etc.).</li>
            <li>Intentionally exploiting bugs, glitches, or unintended game mechanics for advantage.</li>
            <li>Creating or using multiple accounts to manipulate matchmaking, rankings, or promotions.</li>
            <li>Colluding with other players to fix match outcomes or share winnings.</li>
            <li>Allowing another person to play on your account during matches for money.</li>
            <li>Using VPNs or other tools to falsify location or connection characteristics with the goal of bypassing restrictions.</li>
            <li>Deliberately disconnecting or causing crashes to avoid a loss.</li>
            <li>Screen sharing or receiving real‑time coaching in built‑in games where such help is not allowed.</li>
          </ul>
        </section>

        <section id="detection" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">3. How We Detect Cheating</h2>
          <p className="mt-3">
            We use a combination of automated systems, statistical analysis, and human review to identify potential cheating.
            While we do not disclose every detail of our systems (to prevent circumvention), our methods include:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Behavioral analysis</span>: monitoring for impossible reaction times, inhuman accuracy, or other
              patterns that suggest automated play.
            </li>
            <li>
              <span className="font-semibold">Statistical anomaly detection</span>: identifying unusual win rates, streaks, or match pairings that
              deviate strongly from normal player behavior.
            </li>
            <li>
              <span className="font-semibold">Connection and device logs</span>: using connection telemetry to flag suspicious patterns or abuse of
              network conditions.
            </li>
            <li>
              <span className="font-semibold">Match reviews</span>: manually reviewing replays, result reports, and chat logs when serious
              allegations arise.
            </li>
            <li>
              <span className="font-semibold">Player reports</span>: investigating credible reports from the community about suspected cheating or
              collusion.
            </li>
          </ul>
          <p className="mt-2">
            We may combine these signals when deciding whether to take action on an account.
          </p>
        </section>

        <section id="reporting" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">4. Reporting Suspected Cheating</h2>
          <p className="mt-3">
            If you believe another player is cheating, we encourage you to report it. Your reports help keep the SkillFlow
            community fair and competitive.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Use any in‑game &quot;Report&quot; or &quot;Report Issue&quot; options where available.</li>
            <li>
              Or email <span className="text-teal">support@skillflow.gg</span> with your username, the opponent&#39;s username, match ID,
              date/time, and a clear description of what happened.
            </li>
            <li>Attach screenshots, video clips, or links to external match data when possible.</li>
          </ul>
          <p className="mt-2">
            All reports are reviewed, but not all will result in visible action. For privacy and security reasons, we may not be
            able to share the outcome of our investigation with you in detail.
          </p>
          <p className="mt-2">
            Knowingly submitting false or malicious reports can itself be considered misuse and may lead to warnings or account
            restrictions.
          </p>
        </section>

        <section id="consequences" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">5. Consequences</h2>
          <p className="mt-3">
            When we determine that cheating or serious misconduct has occurred, we may take one or more of the following actions,
            depending on severity and history:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Issue a formal warning and monitor future activity more closely.</li>
            <li>Temporarily suspend your account from playing and/or wagering.</li>
            <li>Revoke recent winnings or void affected matches.</li>
            <li>Forfeit part or all of your wallet balance if it is linked to fraudulent or abusive activity.</li>
            <li>Permanently ban your account and any associated accounts.</li>
          </ul>
          <p className="mt-2">
            In cases of clear match‑fixing, large‑scale cheating, or financial fraud, we may skip intermediate steps and move
            directly to permanent account closure and full forfeiture of funds, as permitted by law.
          </p>
        </section>

        <section id="appeals" className="border-l-4 border-teal/60 pl-4 mb-4">
          <h2 className="text-xl font-semibold text-white">6. Appeals</h2>
          <p className="mt-3">
            We strive to be accurate and fair in our enforcement actions. If you believe we made a mistake in suspending or banning
            your account, you may submit an appeal.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              Email <span className="text-teal">support@skillflow.gg</span> from the email associated with your account.
            </li>
            <li>
              Include your username, any relevant match IDs, the date the action occurred, and a clear explanation of why you
              believe the decision was incorrect.
            </li>
          </ul>
          <p className="mt-2">
            We will review appeals in good faith and typically respond within 7 business days. During this period we may request
            additional information or logs.
          </p>
          <p className="mt-2">
            After a final review, SkillFlow&apos;s decision on an appeal is considered final. Repeated or abusive appeals may not
            receive additional responses.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}

