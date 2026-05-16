import Link from "next/link";
import LegalLayout from "@/components/LegalLayout";

export default function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund Policy">
      <nav className="mt-6 rounded-card border border-white/5 bg-card/60 p-4 text-sm">
        <p className="font-semibold text-white">Table of contents</p>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li><a href="#deposits" className="text-teal hover:underline">Deposits</a></li>
          <li><a href="#match-wagers" className="text-teal hover:underline">Match Wagers</a></li>
          <li><a href="#withdrawals" className="text-teal hover:underline">Withdrawals</a></li>
          <li><a href="#account-closure" className="text-teal hover:underline">Account Closure</a></li>
          <li><a href="#how-to-request" className="text-teal hover:underline">How to Request a Refund</a></li>
        </ol>
      </nav>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section id="deposits" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">1. Deposits</h2>
          <p className="mt-3">
            Deposits fund your SkillFlow wallet so you can participate in matches and withdraw winnings. In general, deposits are
            <span className="font-semibold"> non‑refundable</span> once successfully credited to your wallet.
          </p>
          <p className="mt-2">Exceptions may apply in the following situations:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Unauthorized transactions</span>: If you believe a deposit was made without your permission
              (for example, due to a compromised payment method), contact us and your payment provider immediately.
            </li>
            <li>
              <span className="font-semibold">Duplicate or mistaken deposits</span>: If you accidentally deposit the wrong amount or duplicate a
              deposit, we may, at our discretion, reverse or partially refund the transaction if funds have not yet been used in
              matches.
            </li>
          </ul>
          <p className="mt-2">
            To qualify for review, you must notify us of any suspected error or unauthorized deposit within 48 hours of it
            appearing in your account.
          </p>
        </section>

        <section id="match-wagers" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">2. Match Wagers</h2>
          <p className="mt-3">
            When you join a match, your stake is locked in escrow until the match result is determined. Once a match has started,
            wagers are <span className="font-semibold">committed and non‑refundable</span> except in clearly defined circumstances.
          </p>
          <p className="mt-2">Refunds or stake returns may occur when:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Match voided by SkillFlow</span>: If a match is voided due to a platform‑side technical error or
              infrastructure outage, all stakes will be returned to the participating players.
            </li>
            <li>
              <span className="font-semibold">Cheating or rule violations</span>: If we determine that a player has cheated or violated our{" "}
              <Link href="/fairplay" className="text-teal hover:underline">
                Fair Play &amp; Anti‑Cheat Policy
              </Link>
              , we may void the match, refund the innocent player&apos;s stake, and forfeit the cheater&apos;s stake.
            </li>
            <li>
              <span className="font-semibold">Draws</span>: For matches that end in a valid draw, each player receives their original stake back.
              No platform fee is charged.
            </li>
            <li>
              <span className="font-semibold">Dispute resolution</span>: If you file a timely dispute and the investigation is resolved in your
              favor, your stake and/or winnings will be credited in accordance with the dispute decision.
            </li>
          </ul>
          <p className="mt-2">
            Losses in fair, completed matches are not eligible for refunds simply because the outcome was not in your favor or
            because of connection issues on your side.
          </p>
        </section>

        <section id="withdrawals" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">3. Withdrawals</h2>
          <p className="mt-3">
            Withdrawal requests move funds from your SkillFlow wallet to your external payment method. Once a withdrawal has been
            fully processed by us and our payment partners, it generally cannot be reversed.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              You may be able to <span className="font-semibold">cancel</span> a withdrawal request from within the app or by contacting support
              as long as it is still in a pending state.
            </li>
            <li>
              After a withdrawal is marked as processed, any issue with the received funds (for example, posting delays or
              reversals) must be addressed with your bank, card issuer, or payment provider.
            </li>
          </ul>
        </section>

        <section id="account-closure" className="border-l-4 border-teal/60 pl-4">
          <h2 className="text-xl font-semibold text-white">4. Account Closure</h2>
          <p className="mt-3">
            If you choose to close your SkillFlow account voluntarily and are not under investigation for policy violations, we
            will attempt to return your remaining wallet balance.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              Refunds for closed accounts are typically processed back to the original deposit method within 5–10 business days,
              subject to verification.
            </li>
            <li>
              If your account is closed or funds are frozen due to confirmed fraud, cheating, chargebacks, or other violations of
              our Terms of Service, some or all of your balance may be forfeited to cover losses, fees, or damages.
            </li>
          </ul>
        </section>

        <section id="how-to-request" className="border-l-4 border-teal/60 pl-4 mb-4">
          <h2 className="text-xl font-semibold text-white">5. How to Request a Refund</h2>
          <p className="mt-3">
            If you believe a deposit, match, or withdrawal qualifies for a refund under this policy, please contact us as soon as
            possible so we can review your case.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              Email: <span className="text-teal">admin@skillflow.gg</span>
            </li>
            <li>
              Include your username, the date and amount of the transaction, and a clear explanation of why you are requesting a
              refund.
            </li>
            <li>
              Attach any supporting evidence you have (e.g., receipts, bank statements with sensitive data redacted, screenshots).
            </li>
          </ul>
          <p className="mt-2">
            We aim to acknowledge refund requests within 48 hours and to resolve most cases within 7 business days. Complex
            investigations may take longer, in which case we will keep you informed of the status.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}

