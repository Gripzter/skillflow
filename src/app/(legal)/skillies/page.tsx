export const metadata = { title: 'About Skillies — SkillFlow' };

export default function SkilliesPage() {
  return (
    <>
      <h1>About Skillies</h1>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '48px' }}>Last updated: May 26, 2026</p>

      <p>
        Skillies (also called &quot;SkillPoints&quot; or &quot;SP&quot;) are SkillFlow&apos;s in-platform virtual currency. This page explains exactly what Skillies are, how they work, and what they are not.
      </p>

      <h2>What Skillies are</h2>
      <ul>
        <li>An in-platform virtual currency used for match entry fees, daily challenges, case openings, and cosmetic purchases</li>
        <li>Earned by winning matches, daily login rewards, completing challenges, and the referral program</li>
        <li>Tracked in two balances: <strong>Lifetime SP</strong> (used to determine your rank tier — never decreases) and <strong>Balance SP</strong> (your spendable currency)</li>
      </ul>

      <h2>What Skillies are not</h2>
      <ul>
        <li><strong>Skillies have no real-world monetary value.</strong> They cannot be exchanged for cash, gift cards, cryptocurrency, or any other thing of value outside the SkillFlow platform.</li>
        <li>Skillies are not redeemable for refunds or withdrawals.</li>
        <li>Skillies cannot be transferred between user accounts under any circumstances.</li>
        <li>Skillies are not an investment, security, financial instrument, or property.</li>
        <li>Possession of Skillies does not entitle you to any equity, share, or financial interest in SkillFlow or Xmas Group.</li>
      </ul>

      <h2>How you earn Skillies</h2>
      <ul>
        <li><strong>Match wins:</strong> +100 SP per win (base reward, may vary with multipliers)</li>
        <li><strong>Match losses:</strong> +25 SP consolation reward</li>
        <li><strong>Daily first match:</strong> +50 SP bonus the first time you complete a match each day</li>
        <li><strong>Three-win streak:</strong> +50 SP bonus</li>
        <li><strong>Referrals:</strong> +200 SP when a friend you refer plays their first match</li>
        <li><strong>Daily login rewards:</strong> Variable amounts for consecutive daily logins</li>
      </ul>

      <h2>How you spend Skillies</h2>
      <ul>
        <li>Match entry fees (chosen at match-start, e.g. 50, 100, 200, 500, 1000 SP)</li>
        <li>Case openings — Bronze (200 SP), Gold (500 SP), Diamond (1000 SP)</li>
        <li>Cosmetic purchases (borders, badges, profile customization)</li>
      </ul>

      <h2>Match betting mechanics</h2>
      <p>
        When two players agree to a match at a chosen Skillie stake, both players commit equal amounts. The winner receives both stakes (minus a small platform fee). For example: in a 100 SP match, both players stake 100 SP. The winner receives 195 SP (with a 5% platform fee). The loser receives 25 SP as a consolation reward.
      </p>

      <h2>Skillie balance and account closure</h2>
      <p>
        If your account is suspended or terminated for any reason, your Skillie balance is forfeited and not recoverable. We may also adjust Skillie balances at our discretion to correct errors, refund canceled matches, or address economy issues. We reserve the right to modify reward amounts, fees, and economy mechanics at any time.
      </p>

      <h2>Future real-money features</h2>
      <p>
        SkillFlow may, in the future, launch a real-money version of the platform (referred to as &quot;v2&quot; or &quot;real-money launch&quot;). This is a separate product offering that has not launched. Skillies earned during the current free-to-play platform may be eligible for promotional credit at real-money launch under terms to be defined at that time. <strong>No commitment is made about future product launches, conversion rates, or eligibility.</strong>
      </p>

      <h2>Questions</h2>
      <p>
        If you have questions about Skillies, contact <a href="mailto:admin@skillflow.gg">admin@skillflow.gg</a>.
      </p>
    </>
  );
}
