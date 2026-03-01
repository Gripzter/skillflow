import Link from "next/link";
import LegalLayout from "@/components/LegalLayout";

export default function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service">
      {/* Table of contents */}
      <nav className="mt-6 rounded-card border border-white/5 bg-card/60 p-4 text-sm">
        <p className="font-semibold text-white">Table of contents</p>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li><a href="#acceptance-of-terms" className="text-teal hover:underline">Acceptance of Terms</a></li>
          <li><a href="#eligibility" className="text-teal hover:underline">Eligibility</a></li>
          <li><a href="#account-registration" className="text-teal hover:underline">Account Registration</a></li>
          <li><a href="#platform-description" className="text-teal hover:underline">Platform Description</a></li>
          <li><a href="#wagering-rules" className="text-teal hover:underline">Wagering Rules</a></li>
          <li><a href="#deposits-withdrawals" className="text-teal hover:underline">Deposits &amp; Withdrawals</a></li>
          <li><a href="#fees" className="text-teal hover:underline">Fees</a></li>
          <li><a href="#match-rules-results" className="text-teal hover:underline">Match Rules &amp; Results</a></li>
          <li><a href="#disputes" className="text-teal hover:underline">Disputes</a></li>
          <li><a href="#connection-technical-issues" className="text-teal hover:underline">Connection &amp; Technical Issues</a></li>
          <li><a href="#fair-play" className="text-teal hover:underline">Fair Play</a></li>
          <li><a href="#prohibited-activities" className="text-teal hover:underline">Prohibited Activities</a></li>
          <li><a href="#intellectual-property" className="text-teal hover:underline">Intellectual Property</a></li>
          <li><a href="#limitation-liability" className="text-teal hover:underline">Limitation of Liability</a></li>
          <li><a href="#indemnification" className="text-teal hover:underline">Indemnification</a></li>
          <li><a href="#termination" className="text-teal hover:underline">Termination</a></li>
          <li><a href="#governing-law" className="text-teal hover:underline">Governing Law</a></li>
          <li><a href="#changes-to-terms" className="text-teal hover:underline">Changes to Terms</a></li>
          <li><a href="#contact-information" className="text-teal hover:underline">Contact Information</a></li>
        </ol>
      </nav>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section id="acceptance-of-terms" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
          <p className="mt-3">
            By accessing or using SkillFlow (the &quot;Platform&quot;, &quot;Service&quot;, &quot;we&quot;, &quot;us&quot;), you agree to be
            bound by these Terms of Service (&quot;Terms&quot;). If you do not agree with these Terms, you must not create an account,
            access the Platform, or participate in any matches.
          </p>
          <p className="mt-2">
            These Terms constitute a legally binding agreement between you (&quot;User&quot;, &quot;Player&quot;, &quot;you&quot;) and SkillFlow. We may
            update or modify these Terms at any time. When we make material changes, we will notify you via email and/or in-app
            notification. Your continued use of the Platform after the effective date of any changes constitutes acceptance of the
            updated Terms.
          </p>
        </section>

        <section id="eligibility" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">2. Eligibility</h2>
          <p className="mt-3">
            You must be at least 18 years of age, or the legal age of majority in your jurisdiction (whichever is higher), to
            use SkillFlow. By creating an account, you represent and warrant that you meet this age requirement and that you are
            legally permitted to participate in skill-based wagering in your jurisdiction.
          </p>
          <p className="mt-2">
            You are solely responsible for determining whether your use of the Platform is legal in the place where you live and
            from which you access SkillFlow. We may restrict, suspend, or block access from any jurisdiction at any time in order
            to comply with applicable laws or our risk policies.
          </p>
          <p className="mt-2">
            SkillFlow may request identity verification (including government-issued identification and proof of address) at any
            time to confirm your eligibility. Employees, contractors, and immediate family members of SkillFlow are strictly
            prohibited from wagering on the Platform.
          </p>
        </section>

        <section id="account-registration" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">3. Account Registration</h2>
          <p className="mt-3">
            To use the Platform, you must create an account and provide accurate, current, and complete information during
            registration. You agree to keep this information up to date at all times.
          </p>
          <p className="mt-2">
            You are solely responsible for maintaining the confidentiality of your login credentials and for all activity that
            occurs under your account. You must notify us immediately at <span className="text-teal">support@skillflow.gg</span>{" "}
            if you suspect any unauthorized use of your account.
          </p>
          <p className="mt-2">
            You may not create more than one account. Multiple accounts, impersonation, or misrepresentation of your identity is
            strictly prohibited and may result in termination and forfeiture of funds. Accounts that remain inactive for 12 months
            or more may be closed and remaining balances handled in accordance with applicable law.
          </p>
        </section>

        <section id="platform-description" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">4. Platform Description</h2>
          <p className="mt-3">
            SkillFlow is a skill-based competitive gaming platform where users compete head-to-head in games of skill for
            monetary prizes. The outcome of each match is determined primarily by player skill and decision-making, not by chance.
          </p>
          <p className="mt-2">
            SkillFlow is not a casino and does not offer games of chance. We act as an intermediary that:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Facilitates matchmaking between players;</li>
            <li>Holds stakes in escrow for the duration of a match; and</li>
            <li>Distributes winnings to the winner based on the final result.</li>
          </ul>
          <p className="mt-2">
            SkillFlow does not participate as a player in any match and does not influence match outcomes.
          </p>
        </section>

        <section id="wagering-rules" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">5. Wagering Rules</h2>
          <p className="mt-3">
            Users may place wagers on matches using funds available in their SkillFlow wallet. All wagers are voluntary and
            initiated by the user.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>By entering a match, you commit to completing the match and accepting the result.</li>
            <li>Minimum and maximum wager amounts are set by SkillFlow and may change at any time.</li>
            <li>
              Once a match begins, wagers are locked and cannot be cancelled except as provided in the{" "}
              <span className="italic">Disputes</span> and{" "}
              <span className="italic">Connection &amp; Technical Issues</span> sections.
            </li>
            <li>In the event of a draw, both players receive their original stake back and no fee is charged.</li>
            <li>
              SkillFlow reserves the right to void any match and refund stakes if irregularities, technical issues, or violations
              of these Terms are detected.
            </li>
          </ul>
        </section>

        <section id="deposits-withdrawals" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">6. Deposits &amp; Withdrawals</h2>
          <p className="mt-3">
            Deposits and withdrawals are processed through approved third‑party payment processors and are subject to their terms
            and conditions.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Minimum deposit amount: <span className="font-semibold">$5.00 USD</span>.</li>
            <li>Minimum withdrawal amount: <span className="font-semibold">$10.00 USD</span>.</li>
            <li>Withdrawals are generally processed within 3–5 business days, subject to verification.</li>
            <li>
              SkillFlow may require identity verification before processing withdrawals exceeding $500 in any rolling 30‑day
              period.
            </li>
            <li>
              We may delay, suspend, or refuse any deposit or withdrawal if we suspect fraud, money laundering, or violation of
              these Terms.
            </li>
            <li>All balances, deposits, and withdrawals are denominated in USD unless otherwise stated in the product.</li>
            <li>You are responsible for any fees charged by your bank, card issuer, or payment provider.</li>
          </ul>
        </section>

        <section id="fees" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">7. Fees</h2>
          <p className="mt-3">
            SkillFlow charges a platform fee on the total pot of each match. Unless otherwise stated in the product, the standard
            fee is <span className="font-semibold">5%</span>.
          </p>
          <p className="mt-2">
            The fee is deducted from the winner’s payout. For example, if two players each wager $10 (total pot $20), the platform
            fee is $0.60 and the winner receives $19.40.
          </p>
          <p className="mt-2">
            We reserve the right to modify fees or introduce promotional discounts. Material changes to fee structures will be
            communicated with at least 30 days notice where required by law.
          </p>
        </section>

        <section id="match-rules-results" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">8. Match Rules &amp; Results</h2>
          <p className="mt-3">
            Each game type available on SkillFlow has its own rules, which are presented before you join a match. By entering a
            match, you agree to abide by those game‑specific rules in addition to these Terms.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>For built‑in games hosted directly on SkillFlow, results are determined automatically by the game engine.</li>
            <li>
              For external games (such as CS2 or other third‑party titles), results may be determined by mutual result reporting,
              official game APIs, or other evidence submitted by the players.
            </li>
            <li>Match results recorded by SkillFlow are considered final unless a timely dispute is filed.</li>
            <li>
              Players must complete matches in good faith. Intentionally losing, stalling, or attempting to manipulate the outcome
              of a match is prohibited and may result in penalties or account closure.
            </li>
          </ul>
        </section>

        <section id="disputes" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">9. Disputes</h2>
          <p className="mt-3">
            If players disagree on the outcome of an external game match, either player may initiate a dispute through the
            Platform.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Disputes must be filed within 24 hours of the match completing.</li>
            <li>
              Both players may be required to submit evidence, including screenshots, match codes, replay files, or other relevant
              information.
            </li>
            <li>
              During a dispute, all stakes are held in escrow and will not be released until a decision is made by SkillFlow’s
              dispute team.
            </li>
            <li>
              SkillFlow will review the evidence, connection logs, and any relevant game data and aim to reach a decision within
              48 hours. In complex cases, this period may be extended and you will be notified.
            </li>
            <li>
              Our dispute resolution decision is final and binding. Frivolous or bad‑faith disputes may result in warnings,
              restrictions, or permanent bans.
            </li>
          </ul>
        </section>

        <section id="connection-technical-issues" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">10. Connection &amp; Technical Issues</h2>
          <p className="mt-3">
            Competitive gameplay requires a stable internet connection. SkillFlow provides a real‑time connection monitor and
            exposes information such as ping, jitter, packet loss, and overall connection rating to help you make informed
            decisions.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              YOU ARE SOLELY RESPONSIBLE for ensuring that your device, network, and connection are suitable for competitive play.
            </li>
            <li>
              If you choose to play when your connection is rated &quot;Warning&quot; or &quot;Unrecommended&quot;, you acknowledge and accept
              all risks associated with poor connectivity, including disconnections and input delay.
            </li>
            <li>
              Match results will not be reversed solely because of your connection quality if you were warned by the connection
              monitor and proceeded anyway.
            </li>
            <li>
              SkillFlow logs connection data during matches and may use these logs to help resolve disputes or investigate abuse.
            </li>
            <li>
              In the rare event of verified server‑side outages or technical failures on SkillFlow’s infrastructure, we may void
              affected matches and refund stakes to all players involved.
            </li>
            <li>
              We are not responsible for outages or issues caused by external game servers, your ISP, hardware failures, or other
              third‑party services outside of our control.
            </li>
          </ul>
        </section>

        <section id="fair-play" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">11. Fair Play</h2>
          <p className="mt-3">
            Fair competition is at the core of SkillFlow. You agree to play honestly and to rely solely on your own skill during
            matches.
          </p>
          <p className="mt-2">
            The use of cheats, unauthorized software, bots, or any unfair advantage is strictly prohibited. We reserve the right
            to monitor gameplay, analyze statistics, and review reports in order to detect and act on unfair play. For more detail,
            please review our{" "}
            <Link href="/fairplay" className="text-teal hover:underline">
              Fair Play &amp; Anti‑Cheat Policy
            </Link>
            .
          </p>
        </section>

        <section id="prohibited-activities" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">12. Prohibited Activities</h2>
          <p className="mt-3">You agree that you will not:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Use the Platform if you are under the legal age requirement or otherwise ineligible.</li>
            <li>Create or use multiple accounts, or sell, rent, or share your account.</li>
            <li>Use bots, scripts, macros, or other automated systems to interact with the Platform.</li>
            <li>Attempt to cheat, hack, reverse‑engineer, or exploit any part of the Platform or our games.</li>
            <li>Collude with other players to manipulate match outcomes or rankings.</li>
            <li>Engage in money laundering or use SkillFlow for any unlawful purpose.</li>
            <li>Harass, threaten, or abuse other players or SkillFlow staff.</li>
            <li>Use VPNs or similar tools to circumvent geographic restrictions or regulatory requirements.</li>
            <li>Intentionally lose matches or engage in &quot;match fixing&quot; schemes.</li>
            <li>Upload or share content that is illegal, hateful, obscene, or infringes on intellectual property rights.</li>
          </ul>
        </section>

        <section id="intellectual-property" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">13. Intellectual Property</h2>
          <p className="mt-3">
            All content on the Platform, including but not limited to software, code, graphics, logos, trademarks, and visual
            design, is owned by SkillFlow or its licensors and is protected by intellectual property laws.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>You may use the Platform solely for personal, non‑commercial purposes.</li>
            <li>
              You may not copy, modify, distribute, sell, lease, or create derivative works from any part of the Platform without
              our prior written consent.
            </li>
            <li>
              User‑generated content (such as usernames, profile information, and chat messages) remains your property, but you
              grant SkillFlow a worldwide, non‑exclusive, royalty‑free license to use, display, and reproduce such content in
              connection with operating the Platform.
            </li>
            <li>
              External game titles and trademarks referenced on SkillFlow are the property of their respective owners. SkillFlow is
              not affiliated with or endorsed by those third‑party game publishers unless explicitly stated.
            </li>
          </ul>
        </section>

        <section id="limitation-liability" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">14. Limitation of Liability</h2>
          <p className="mt-3">
            The Platform is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express
            or implied. To the maximum extent permitted by law, SkillFlow disclaims all warranties, including implied warranties
            of merchantability, fitness for a particular purpose, and non‑infringement.
          </p>
          <p className="mt-2">
            To the fullest extent permitted by law, SkillFlow, its affiliates, and their respective officers, directors, employees,
            and agents will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss
            of profits or revenues, whether incurred directly or indirectly, arising out of or in connection with your use of the
            Platform.
          </p>
          <p className="mt-2">
            In no event will SkillFlow’s aggregate liability to you exceed the total amount of platform fees paid by you to
            SkillFlow in the 12‑month period preceding the event giving rise to the claim.
          </p>
        </section>

        <section id="indemnification" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">15. Indemnification</h2>
          <p className="mt-3">
            You agree to indemnify, defend, and hold harmless SkillFlow, its affiliates, and their respective officers, directors,
            employees, and agents from and against any and all claims, liabilities, damages, losses, and expenses (including
            reasonable attorneys’ fees) arising out of or in any way connected with:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Your access to or use of the Platform;</li>
            <li>Your violation of these Terms; or</li>
            <li>Your violation of any third‑party rights, including intellectual property or privacy rights.</li>
          </ul>
        </section>

        <section id="termination" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">16. Termination</h2>
          <p className="mt-3">
            We may suspend or terminate your account, or restrict your access to certain features, at any time and for any reason,
            including but not limited to suspected fraud, cheating, or violation of these Terms.
          </p>
          <p className="mt-2">
            If your account is terminated for violating these Terms, we may withhold or forfeit some or all of your remaining
            balance to the extent permitted by law. If we terminate your account without cause, we will return any remaining
            balance to you in accordance with our{" "}
            <a href="/refund" className="text-teal hover:underline">
              Refund Policy
            </a>
            .
          </p>
          <p className="mt-2">
            You may close your account at any time by contacting{" "}
            <span className="text-teal">support@skillflow.gg</span>. Account closure will be handled in line with our withdrawal
            and refund processes.
          </p>
        </section>

        <section id="governing-law" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">17. Governing Law</h2>
          <p className="mt-3">
            These Terms and any dispute arising out of or in connection with them will be governed by and construed in accordance
            with the laws of the jurisdiction in which SkillFlow operates, without regard to its conflict of law principles. The
            specific governing jurisdiction will be updated and communicated once SkillFlow’s operating entity is finalized.
          </p>
          <p className="mt-2">
            Any disputes between you and SkillFlow will be resolved through binding arbitration or another dispute resolution
            mechanism as required by applicable law. To the extent permitted, you waive any right to participate in class or
            representative actions against SkillFlow.
          </p>
        </section>

        <section id="changes-to-terms" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">18. Changes to Terms</h2>
          <p className="mt-3">
            We may revise these Terms from time to time to reflect changes in our Platform, legal requirements, or business
            practices. When we make material changes, we will notify you via email and/or in‑app notification and indicate the
            updated effective date.
          </p>
          <p className="mt-2">
            Your continued use of the Platform after the updated Terms become effective constitutes your acceptance of those
            changes. If you do not agree to the revised Terms, you must stop using the Platform and may request closure of your
            account.
          </p>
        </section>

        <section id="contact-information" className="border-l-4 border-teal/60 pl-4 mb-4">
          <h2 className="text-xl font-semibold text-white">19. Contact Information</h2>
          <p className="mt-3">
            If you have questions about these Terms or how they apply to you, please contact us:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Email (support): <span className="text-teal">support@skillflow.gg</span></li>
            <li>Email (disputes): <span className="text-teal">disputes@skillflow.gg</span></li>
            <li>Website: <span className="text-teal">skillflow.gg</span></li>
          </ul>
        </section>
      </div>
    </LegalLayout>
  );
}

