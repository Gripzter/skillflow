"use client";

import RankProgressBar from "@/components/RankProgressBar";
import SPIcon from "@/components/SPIcon";
import SkilliesIcon from "@/components/SkilliesIcon";
import { useSpTransactions } from "@/hooks/useSpTransactions";

type SkillPointsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  lifetimeSp: number;
  balanceSp: number;
  rankTier: string;
};

function formatTransactionLabel(raw: string | null, type: string) {
  if (raw && raw.trim().length > 0) return raw;
  return type.replaceAll("_", " ");
}

export default function SkillPointsModal({
  isOpen,
  onClose,
  userId,
  lifetimeSp,
  balanceSp,
  rankTier,
}: SkillPointsModalProps) {
  const { transactions, loading } = useSpTransactions({ userId, limit: 10 });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[640px] rounded-2xl border border-[#1F1F26] bg-[#16161C] p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-[28px] font-black tracking-[-0.02em] text-white">SkillPoints</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-white/5 hover:text-white"
            aria-label="Close SkillPoints modal"
          >
            x
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#1F1F26] bg-[#0E0E12] p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">SKILLPOINTS</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xl font-bold text-white">
              {lifetimeSp.toLocaleString()} <SPIcon size={18} />
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">Career score. Determines rank. Never decreases.</p>
          </div>
          <div className="rounded-xl border border-[#1F1F26] bg-[#0E0E12] p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">SKILLIES</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xl font-bold text-[#FFFF00]">
              {balanceSp.toLocaleString()} <SkilliesIcon size={18} />
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">Spendable. Wager in matches, open cases.</p>
          </div>
        </div>

        <div className="mt-4">
          <RankProgressBar lifetimeSp={lifetimeSp} currentTier={rankTier} />
        </div>

        <div className="mt-4 rounded-xl border border-[#1F1F26] bg-[#0E0E12] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FFFF00]">
              BETA FOUNDERS PROGRAM
            </p>
            <span className="text-xs text-[#9CA3AF]">PLATINUM PROGRESS 30%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[30%] rounded-full bg-[#FFFF00]" />
          </div>
          <ul className="mt-3 space-y-1 text-xs text-[#9CA3AF]">
            <li>- Permanent Founders badge on profile</li>
            <li>- Early access to drops and limited cases</li>
            <li>- Priority support during beta</li>
          </ul>
          <p className="mt-2 text-xs text-white/80">Reach Platinum to unlock.</p>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-white">Recent SP transactions</h3>
          <div className="mt-2 max-h-[220px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-sm text-[#9CA3AF]">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No transactions yet.</p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-[#1F1F26] bg-black/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-white">{formatTransactionLabel(tx.description, tx.type)}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-sm font-semibold ${tx.amount >= 0 ? "text-[#FFFF00]" : "text-red-400"}`}>
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
