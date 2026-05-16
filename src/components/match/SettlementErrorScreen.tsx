"use client";

type SettlementErrorScreenProps = {
  message: string;
  onRefresh: () => void;
  onContinue: () => void;
};

export default function SettlementErrorScreen({
  message,
  onRefresh,
  onContinue,
}: SettlementErrorScreenProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-[#1A0F12] p-6 shadow-[0_0_48px_rgba(239,68,68,0.25)]">
        <div className="mb-4 inline-flex items-center rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-300">
          Settlement Failed
        </div>
        <h2 className="text-xl font-bold text-white">Match not finalized</h2>
        <p className="mt-3 text-sm leading-6 text-red-100/90">{message}</p>
        <p className="mt-2 text-xs text-red-200/70">
          No payout is shown until settlement is confirmed on the server.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRefresh}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 font-semibold text-white transition hover:bg-red-400"
          >
            Refresh &amp; check balance
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 rounded-lg border border-white/20 px-4 py-2.5 font-semibold text-white transition hover:bg-white/10"
          >
            Continue
          </button>
        </div>

        <a
          href="mailto:admin@skillflow.gg?subject=Match%20Settlement%20Issue"
          className="mt-4 inline-block text-sm text-white/70 underline hover:text-white"
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
