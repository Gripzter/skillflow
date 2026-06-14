export default function CreatorTermsPage() {
  return (
    <div className="min-h-screen bg-[#0E0E12] text-[#F0F0F4]">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 text-center">
          <div className="text-xl font-bold text-[#FFFF00]">SkillFlow</div>
          <h1 className="mt-4 text-3xl font-semibold lowercase text-white">creator terms</h1>
          <p className="mt-2 text-sm text-[#7A7A8E]">Last updated: June 2026</p>
        </div>

        <div className="space-y-8 rounded-xl border border-white/5 bg-[#1A1A1F] p-6 sm:p-10 text-sm leading-relaxed text-[#C8C8D4]">
          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">parties</h2>
            <p>
              This Creator Agreement (&quot;Agreement&quot;) is between SkillFlow, operated by Xmas
              Group (&quot;SkillFlow,&quot; &quot;we,&quot; &quot;us&quot;), and you, the game
              creator (&quot;Creator,&quot; &quot;you&quot;).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">license</h2>
            <p>
              You grant SkillFlow a non-exclusive, worldwide license to host, distribute, and
              monetize your game on the SkillFlow platform. You retain full intellectual property
              ownership of your game at all times. SkillFlow does not acquire ownership of your
              game, code, assets, or brand.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">revenue share</h2>
            <p>
              SkillFlow collects a 12% platform rake on each match pot. You receive 20% of that
              rake (2.4% of the total pot) for every completed match played through your game.
              Payouts are processed monthly via Xsolla. Minimum payout threshold: $50 USD.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">
              payment processor
            </h2>
            <p>
              All player deposits, withdrawals, and creator payouts are handled by Xsolla. SkillFlow
              is not a bank or money transmitter. You are responsible for any tax obligations on
              your earnings.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">
              material breach
            </h2>
            <p className="mb-3">A Material Breach includes, but is not limited to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                SkillFlow reducing match liquidity for your game by 40% or more without 30 days
                written notice and a commercially reasonable cure period.
              </li>
              <li>
                Critical bugs in the SkillFlow SDK or match infrastructure that prevent fair play
                and remain uncured for more than 72 hours after written notice.
              </li>
              <li>
                SkillFlow converting your skill-based game mechanics to chance-based outcomes
                without your consent.
              </li>
              <li>
                SkillFlow unilaterally reducing your revenue share below the agreed rate without
                30 days notice.
              </li>
            </ul>
            <p className="mt-3">
              Upon Material Breach, you may terminate this Agreement immediately and SkillFlow will
              pay all earned but unpaid revenue within 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">termination</h2>
            <p>
              Either party may terminate this Agreement with 30 days written notice. SkillFlow may
              suspend your game immediately (without notice) if we reasonably believe you have
              committed fraud, manipulated match outcomes, or misrepresented your game as
              skill-based when it is primarily luck-based.
            </p>
            <p className="mt-3">
              Upon termination for cause by SkillFlow due to your breach, we may withhold revenue
              until the breach is cured. Upon termination without cause, all earned revenue will
              be paid out per the normal payment schedule.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">
              skill-based requirement
            </h2>
            <p>
              Your game must be predominantly skill-based. Games where outcomes are primarily
              determined by random chance, loot boxes, or undisclosed RNG are not permitted.
              SkillFlow reserves the right to reject or suspend games that fail skill verification.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">
              ip ownership
            </h2>
            <p>
              Creator retains full ownership of all intellectual property in the game. SkillFlow
              receives only the limited license described above for platform operation.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">
              governing law
            </h2>
            <p>
              This Agreement is governed by the laws of the State of Delaware, without regard to
              conflict of law principles. Disputes will be resolved in the courts of Delaware.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold lowercase text-[#FFFF00]">contact</h2>
            <p>
              Questions about these terms:{" "}
              <a href="mailto:ax@skillflow.gg" className="text-[#FFFF00] underline">
                ax@skillflow.gg
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
