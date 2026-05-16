import LegalLayout from "@/components/LegalLayout";

export default function ResponsiblePlayPage() {
  return (
    <LegalLayout title="Responsible Play">
      <nav className="mt-6 rounded-card border border-white/5 bg-card/60 p-4 text-sm">
        <p className="font-semibold text-white">Table of contents</p>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li><a href="#introduction" className="text-teal hover:underline">Introduction</a></li>
          <li><a href="#guidelines" className="text-teal hover:underline">Responsible Play Guidelines</a></li>
          <li><a href="#self-exclusion" className="text-teal hover:underline">Self‑Exclusion Tools</a></li>
          <li><a href="#warning-signs" className="text-teal hover:underline">Warning Signs</a></li>
          <li><a href="#resources" className="text-teal hover:underline">Support &amp; Resources</a></li>
          <li><a href="#underage-protection" className="text-teal hover:underline">Underage Protection</a></li>
        </ol>
      </nav>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section id="introduction" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">1. Introduction</h2>
          <p className="mt-3">
            SkillFlow is designed to be a fun, competitive, and social experience. While our games are skill‑based rather than
            chance‑based, we recognize that any form of wagering can become problematic if not managed responsibly.
          </p>
          <p className="mt-2">
            This page outlines how we think about responsible play and the tools and resources available to you. Our goal is to
            help you stay in control, enjoy the competition, and protect yourself and those around you.
          </p>
        </section>

        <section id="guidelines" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">2. Responsible Play Guidelines</h2>
          <p className="mt-3">
            The following guidelines can help keep your SkillFlow experience healthy and enjoyable:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Set a budget for how much you are comfortable wagering in a day, week, or month — and stick to it.</li>
            <li>Only use money you can afford to lose. Never use rent, bills, or essential funds for play.</li>
            <li>Take regular breaks, especially during long sessions. Stepping away helps you make clearer decisions.</li>
            <li>Do not chase losses. Losing streaks happen — trying to &quot;win it back&quot; quickly is a red flag.</li>
            <li>Avoid playing when you are tired, stressed, angry, or under the influence of alcohol or drugs.</li>
            <li>Use the transaction history in your wallet to keep track of how much you have deposited and withdrawn.</li>
            <li>Remember that SkillFlow is entertainment. If it stops being fun and starts feeling like pressure, pause and reassess.</li>
          </ul>
        </section>

        <section id="self-exclusion" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">3. Self‑Exclusion Tools</h2>
          <p className="mt-3">
            We are building tools that give you more control over how and when you play. Some of these features may be marked as
            &quot;coming soon&quot; while we finalize implementation.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Deposit limits (coming soon)</span>: configure daily, weekly, or monthly limits on how much you can
              deposit into your SkillFlow wallet.
            </li>
            <li>
              <span className="font-semibold">Session reminders (coming soon)</span>: receive gentle reminders when you&apos;ve been playing for a
              set amount of time.
            </li>
            <li>
              <span className="font-semibold">Self‑exclusion</span>: you can request to be blocked from playing on SkillFlow for a period of
              time.
              <ul className="mt-1 list-disc space-y-1 pl-6">
                <li>Temporary exclusion: 24 hours, 7 days, 30 days, or 90 days.</li>
                <li>Permanent exclusion: your account is closed and cannot be reopened.</li>
              </ul>
            </li>
          </ul>
          <p className="mt-2">
            To request self‑exclusion today, email{" "}
            <span className="text-teal">admin@skillflow.gg</span> from the email address linked to your account. We may ask for
            additional verification to protect your account.
          </p>
          <p className="mt-2">
            During a self‑exclusion period, you must not attempt to create a new account. If we detect attempts to bypass
            self‑exclusion, all related accounts may be closed.
          </p>
        </section>

        <section id="warning-signs" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">4. Warning Signs</h2>
          <p className="mt-3">
            It can be difficult to recognize when play is becoming unhealthy. Consider seeking help if you notice any of the
            following:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Spending more money on SkillFlow than you planned or can afford.</li>
            <li>Playing longer than intended, or feeling unable to stop even when you want to.</li>
            <li>Feeling anxious, irritable, or restless when you are not playing.</li>
            <li>Neglecting work, school, or family responsibilities to continue playing.</li>
            <li>Borrowing money or selling possessions to fund your play.</li>
            <li>Hiding or lying to others about how much time or money you spend on SkillFlow.</li>
            <li>Using SkillFlow primarily to escape problems, stress, or negative emotions.</li>
          </ul>
          <p className="mt-2">
            If any of these feel familiar, we strongly encourage you to pause, consider self‑exclusion, and reach out to a
            professional support organization.
          </p>
        </section>

        <section id="resources" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">5. Support &amp; Resources</h2>
          <p className="mt-3">
            If you are concerned about your play or someone else&apos;s, the following organizations can provide confidential advice
            and support:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">National Council on Problem Gambling (US)</span>: 1‑800‑522‑4700 or{" "}
              <span className="text-teal">www.ncpgambling.org</span>
            </li>
            <li>
              <span className="font-semibold">Gamblers Anonymous</span>: peer support groups worldwide —{" "}
              <span className="text-teal">www.gamblersanonymous.org</span>
            </li>
            <li>
              <span className="font-semibold">SAMHSA National Helpline (US)</span>: 1‑800‑662‑4357 (HELP) —{" "}
              free, confidential treatment referral and information.
            </li>
            <li>
              <span className="font-semibold">BeGambleAware (UK and international resources)</span>:{" "}
              <span className="text-teal">www.begambleaware.org</span>
            </li>
          </ul>
          <p className="mt-2">
            If you are in immediate distress or feel at risk of harming yourself or others, please contact your local emergency
            services immediately.
          </p>
        </section>

        <section id="underage-protection" className="border-l-4 border-teal/60 pl-4 mb-4">
          <h2 className="text-xl font-semibold text-white">6. Underage Protection</h2>
          <p className="mt-3">
            SkillFlow is strictly for adults aged 18 and over. We do not allow minors to create accounts or participate in
            matches.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>We perform age checks during signup and may request identity verification.</li>
            <li>Parents and guardians should keep devices and account credentials secure.</li>
            <li>
              If you suspect that someone under 18 is using SkillFlow, please notify us at{" "}
              <span className="text-teal">admin@skillflow.gg</span> so we can investigate.
            </li>
          </ul>
        </section>
      </div>
    </LegalLayout>
  );
}

