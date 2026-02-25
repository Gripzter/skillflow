import LegalLayout from "@/components/LegalLayout";

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <nav className="mt-6 rounded-card border border-white/5 bg-card/60 p-4 text-sm">
        <p className="font-semibold text-white">Table of contents</p>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li><a href="#information-we-collect" className="text-teal hover:underline">Information We Collect</a></li>
          <li><a href="#how-we-use-information" className="text-teal hover:underline">How We Use Your Information</a></li>
          <li><a href="#how-we-share-information" className="text-teal hover:underline">How We Share Your Information</a></li>
          <li><a href="#data-security" className="text-teal hover:underline">Data Security</a></li>
          <li><a href="#data-retention" className="text-teal hover:underline">Data Retention</a></li>
          <li><a href="#your-rights" className="text-teal hover:underline">Your Rights</a></li>
          <li><a href="#cookies-tracking" className="text-teal hover:underline">Cookies &amp; Tracking</a></li>
          <li><a href="#childrens-privacy" className="text-teal hover:underline">Children&apos;s Privacy</a></li>
          <li><a href="#international-transfers" className="text-teal hover:underline">International Data Transfers</a></li>
          <li><a href="#changes-to-policy" className="text-teal hover:underline">Changes to This Policy</a></li>
          <li><a href="#contact-us" className="text-teal hover:underline">Contact Us</a></li>
        </ol>
      </nav>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section id="information-we-collect" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">1. Information We Collect</h2>
          <p className="mt-3">
            This Privacy Policy explains how SkillFlow (&quot;SkillFlow&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, and protects your
            information when you use our Platform. We collect only the data necessary to operate a secure, fair, and compliant
            skill‑based wagering platform.
          </p>
          <p className="mt-2">We may collect the following categories of information:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Account information</span>: email address, username, date of birth, hashed password, and account
              preferences.
            </li>
            <li>
              <span className="font-semibold">Financial information</span>: deposit and withdrawal amounts, transaction history, wallet balance,
              and currency. Card and bank details are processed by our payment partners and are not stored in plain text by
              SkillFlow.
            </li>
            <li>
              <span className="font-semibold">Gameplay data</span>: match history, game types played, win/loss records, skill rating, and
              achievement progress.
            </li>
            <li>
              <span className="font-semibold">Technical data</span>: IP address, device type, operating system, browser type, screen resolution,
              and approximate location derived from your IP address.
            </li>
            <li>
              <span className="font-semibold">Connection data</span>: ping, jitter, packet loss, connection type, and connection quality logs
              captured by our connection monitoring tools before and during matches.
            </li>
            <li>
              <span className="font-semibold">Usage data</span>: pages visited, features used, time spent in different areas of the Platform,
              clickstream data, and in‑app navigation patterns.
            </li>
            <li>
              <span className="font-semibold">Communications</span>: support requests, emails, and any in‑app messages or reports you send to our
              team.
            </li>
            <li>
              <span className="font-semibold">Match communications</span>: chat messages and match reports submitted during or after a match,
              which may be used for moderation and dispute resolution.
            </li>
          </ul>
        </section>

        <section id="how-we-use-information" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">2. How We Use Your Information</h2>
          <p className="mt-3">
            We process your information only where we have a valid legal basis to do so (such as to perform our contract with you,
            comply with legal obligations, or pursue our legitimate interests in operating a fair and secure platform).
          </p>
          <p className="mt-2">We use your information to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Provide, operate, and maintain the Platform and its features.</li>
            <li>Authenticate you and manage your account, wallet, and match participation.</li>
            <li>Process deposits, withdrawals, and match payouts through our payment partners.</li>
            <li>Compute and display leaderboards, rankings, and statistics.</li>
            <li>Resolve match disputes and investigate suspicious activity.</li>
            <li>Detect, prevent, and respond to fraud, cheating, and security incidents.</li>
            <li>Monitor connection quality to inform you of potential gameplay issues.</li>
            <li>Respond to your questions, support tickets, and feedback.</li>
            <li>Improve and optimize our games, UX, and platform performance.</li>
            <li>Comply with legal and regulatory obligations, including anti‑money‑laundering rules.</li>
          </ul>
          <p className="mt-2">
            We do <span className="font-semibold">not</span> sell your personal information to third parties, and we do <span className="font-semibold">not</span> use your data
            for third‑party advertising.
          </p>
        </section>

        <section id="how-we-share-information" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">3. How We Share Your Information</h2>
          <p className="mt-3">
            We share your information only when necessary to provide the service, comply with the law, or protect the Platform and
            its users.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Payment processors</span>: We share necessary transaction details (such as amount and
              transaction IDs) with our payment partners to process deposits and withdrawals.
            </li>
            <li>
              <span className="font-semibold">Analytics and infrastructure providers</span>: We may share pseudonymous usage or technical
              data with analytics, hosting, and monitoring providers to keep the Platform reliable and performant.
            </li>
            <li>
              <span className="font-semibold">Public profile information</span>: Your username, avatar, rating, and certain gameplay statistics
              may be visible on leaderboards, profiles, and match history views.
            </li>
            <li>
              <span className="font-semibold">Dispute resolution</span>: In case of a dispute, relevant match data, connection logs, and
              communications may be shared with the parties involved and internal reviewers.
            </li>
            <li>
              <span className="font-semibold">Legal and compliance</span>: We may disclose information if required by law, subpoena, court
              order, or government request, or to enforce our Terms of Service.
            </li>
            <li>
              <span className="font-semibold">Business transfers</span>: If SkillFlow is involved in a merger, acquisition, or sale of assets,
              your information may be transferred as part of that transaction, subject to continued protections.
            </li>
          </ul>
          <p className="mt-2">
            We do not publicly expose your email address, real‑world identity, or sensitive financial details.
          </p>
        </section>

        <section id="data-security" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">4. Data Security</h2>
          <p className="mt-3">
            We take security seriously and implement technical and organizational measures to protect your information against
            unauthorized access, loss, or misuse.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>All traffic to and from SkillFlow is encrypted using TLS (HTTPS).</li>
            <li>Passwords are hashed and salted; we never store plain‑text passwords.</li>
            <li>Payment information is handled by PCI‑DSS compliant payment processors.</li>
            <li>Access to production systems and user data is restricted to authorized personnel on a need‑to‑know basis.</li>
            <li>We monitor for suspicious logins, abnormal gameplay patterns, and security anomalies.</li>
          </ul>
          <p className="mt-2">
            Despite these safeguards, no system can be completely secure. You are also responsible for keeping your password
            confidential and for securing your own devices.
          </p>
        </section>

        <section id="data-retention" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">5. Data Retention</h2>
          <p className="mt-3">
            We retain different categories of data for different periods, based on legal, regulatory, and operational needs.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Account information</span>: kept for the life of your account and up to 5 years following
              closure, to comply with legal obligations and to handle potential disputes.
            </li>
            <li>
              <span className="font-semibold">Financial records</span>: retained for at least 7 years for accounting and anti‑money‑laundering
              compliance.
            </li>
            <li>
              <span className="font-semibold">Gameplay and match data</span>: may be retained indefinitely in pseudonymous form for
              leaderboards, statistics, and anti‑cheat analytics.
            </li>
            <li>
              <span className="font-semibold">Connection logs</span>: generally retained for up to 90 days after a match for dispute resolution
              and fraud analysis.
            </li>
            <li>
              <span className="font-semibold">Chat and match communications</span>: typically retained for up to 30 days unless required longer
              for investigations.
            </li>
          </ul>
        </section>

        <section id="your-rights" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">6. Your Rights</h2>
          <p className="mt-3">
            Depending on your jurisdiction, you may have certain rights regarding your personal information. Subject to applicable
            law, these may include:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Access</span>: request a copy of the personal data we hold about you.
            </li>
            <li>
              <span className="font-semibold">Correction</span>: request that we correct inaccurate or incomplete information.
            </li>
            <li>
              <span className="font-semibold">Deletion</span>: request deletion of your personal data, subject to legal retention requirements.
            </li>
            <li>
              <span className="font-semibold">Restriction</span>: request that we limit the processing of your personal data in certain
              circumstances.
            </li>
            <li>
              <span className="font-semibold">Portability</span>: request your data in a machine‑readable format where technically feasible.
            </li>
            <li>
              <span className="font-semibold">Objection</span>: object to certain processing activities, such as profiling, where allowed by
              law.
            </li>
          </ul>
          <p className="mt-2">
            To exercise your rights, contact us at{" "}
            <span className="text-teal">privacy@skillflow.gg</span>. We may need to verify your identity before fulfilling your
            request. We aim to respond within 30 days, subject to extensions permitted by law.
          </p>
        </section>

        <section id="cookies-tracking" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">7. Cookies &amp; Tracking</h2>
          <p className="mt-3">
            SkillFlow uses cookies and similar technologies to provide core functionality, secure your session, and understand how
            the Platform is used.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Essential cookies</span>: required for login, session management, and basic security. The Platform
              will not function correctly without these.
            </li>
            <li>
              <span className="font-semibold">Analytics cookies</span>: help us measure usage, performance, and feature engagement. Where
              required, we will ask for your consent before using these cookies.
            </li>
            <li>
              We do <span className="font-semibold">not</span> use advertising or cross‑site tracking cookies, and we do not allow third‑party ad
              networks to track you on SkillFlow.
            </li>
          </ul>
          <p className="mt-2">
            You can manage cookies via your browser settings. However, blocking certain cookies may impact your ability to use the
            Platform.
          </p>
        </section>

        <section id="childrens-privacy" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">8. Children&apos;s Privacy</h2>
          <p className="mt-3">
            SkillFlow is intended only for users aged 18 and older. We do not knowingly collect personal information from anyone
            under 18 years of age.
          </p>
          <p className="mt-2">
            If we become aware that a minor has created an account or provided personal information, we will take steps to
            terminate the account and delete associated data, subject to any legal retention requirements.
          </p>
          <p className="mt-2">
            If you believe that a child under 18 is using the Platform, please contact us immediately at{" "}
            <span className="text-teal">support@skillflow.gg</span>.
          </p>
        </section>

        <section id="international-transfers" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">9. International Data Transfers</h2>
          <p className="mt-3">
            SkillFlow may process and store your information in countries other than the country in which you reside. These
            countries may have data protection laws that differ from those in your jurisdiction.
          </p>
          <p className="mt-2">
            Where required, we implement safeguards such as standard contractual clauses or similar mechanisms to ensure an
            adequate level of protection for your personal data when it is transferred internationally.
          </p>
        </section>

        <section id="changes-to-policy" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">10. Changes to This Policy</h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, or legal
            requirements. When we make material changes, we will notify you via email and/or in‑app notification and update the
            &quot;Last updated&quot; date at the top of this page.
          </p>
          <p className="mt-2">
            Your continued use of SkillFlow after an updated Privacy Policy becomes effective constitutes your acceptance of the
            revised policy.
          </p>
        </section>

        <section id="contact-us" className="border-l-4 border-teal/60 pl-4 mb-4">
          <h2 className="text-xl font-semibold text-white">11. Contact Us</h2>
          <p className="mt-3">
            If you have questions about this Privacy Policy or how we handle your information, please contact us:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Email (privacy): <span className="text-teal">privacy@skillflow.gg</span></li>
            <li>Email (support): <span className="text-teal">support@skillflow.gg</span></li>
          </ul>
        </section>
      </div>
    </LegalLayout>
  );
}

