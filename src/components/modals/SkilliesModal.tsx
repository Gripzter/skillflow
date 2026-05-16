"use client";

import SkilliesIcon from "@/components/SkilliesIcon";
import { useSpTransactions } from "@/hooks/useSpTransactions";

type SkilliesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  balanceSp: number;
};

function formatTransactionLabel(raw: string | null, type: string) {
  if (raw && raw.trim().length > 0) return raw;
  return type.replaceAll("_", " ");
}

export default function SkilliesModal({
  isOpen,
  onClose,
  userId,
  balanceSp,
}: SkilliesModalProps) {
  const { transactions, loading } = useSpTransactions({ userId, limit: 10 });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[480px] rounded-2xl border border-[#1F1F26] bg-[#16161C] p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-[28px] font-black tracking-[-0.02em] text-white">Skillies</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-white/5 hover:text-white"
            aria-label="Close Skillies modal"
          >
            x
          </button>
        </div>

        <div className="rounded-xl border border-[#1F1F26] bg-[#0E0E12] p-4 text-center">
          <p className="inline-flex items-center gap-2 text-5xl font-black tracking-[-0.02em] text-[#FFFF00]">
            {balanceSp.toLocaleString()} <SkilliesIcon size={34} />
          </p>
          <p className="mt-2 text-sm text-[#9CA3AF]">Skillies spendable</p>
        </div>

        <div className="mt-4 rounded-xl border border-[#1F1F26] bg-[#0E0E12] p-4">
          <p className="text-sm font-semibold text-white">How to earn more</p>
          <ul className="mt-2 space-y-1 text-xs text-[#9CA3AF]">
            <li>- Win a match (+100 SP earns you more Skillies)</li>
            <li>- Daily challenges</li>
            <li>- Refer a friend (+200 SP)</li>
          </ul>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-white">Last 10 Skillies transactions</h3>
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
