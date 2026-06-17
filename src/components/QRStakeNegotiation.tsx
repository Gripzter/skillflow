"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingRing from "@/components/LoadingRing";
import SkilliesIcon from "@/components/SkilliesIcon";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { createClient } from "@/lib/supabase";
import {
  QR_MAX_STAKE,
  QR_MIN_STAKE,
  QR_STAKE_PRESETS,
  fetchNegotiationState,
  formatGameName,
  getAnonymousTokenFromCookie,
  getOrCreateAnonymousToken,
  proposeStake,
  respondToStake,
  type QRNegotiationState,
} from "@/lib/qr-match";

type Props = {
  qrMatchId: string;
  isGuest: boolean;
  balanceSp?: number;
};

function applyRowToState(
  prev: QRNegotiationState,
  row: Record<string, unknown>
): QRNegotiationState {
  return {
    ...prev,
    status: row.status as string,
    stake_status: row.stake_status as string,
    stake_sk: row.stake_sk as number | null,
    proposed_stake_sk: row.proposed_stake_sk as number | null,
    match_id: row.match_id as string | null,
  };
}

export default function QRStakeNegotiation({ qrMatchId, isGuest, balanceSp = 0 }: Props) {
  const router = useRouter();
  const [state, setState] = useState<QRNegotiationState>({ found: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stake, setStake] = useState<number>(25);
  const [customStake, setCustomStake] = useState("");
  const [proposing, setProposing] = useState(false);
  const [responding, setResponding] = useState(false);
  const [acceptedFlash, setAcceptedFlash] = useState(false);
  const [editingProposal, setEditingProposal] = useState(false);

  const anonToken = useMemo(
    () => (isGuest ? getOrCreateAnonymousToken() : getAnonymousTokenFromCookie()),
    [isGuest]
  );

  const effectiveStake = useMemo(() => {
    if (customStake.trim()) {
      const n = parseInt(customStake, 10);
      if (!Number.isNaN(n)) return n;
    }
    return stake;
  }, [customStake, stake]);

  const stakeValid = effectiveStake >= QR_MIN_STAKE && effectiveStake <= QR_MAX_STAKE;
  const canAfford = balanceSp >= effectiveStake;

  const loadState = useCallback(async () => {
    try {
      const data = await fetchNegotiationState(qrMatchId, isGuest ? anonToken : null);
      setState(data);
      setError(data.found ? null : "match not found");
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not load match");
    } finally {
      setLoading(false);
    }
  }, [qrMatchId, isGuest, anonToken]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (state.status === "in_progress" && state.match_id) {
      if (acceptedFlash) {
        const t = window.setTimeout(() => {
          router.push(`/match/${state.match_id}${isGuest ? "?guest=1" : ""}`);
        }, 600);
        return () => window.clearTimeout(t);
      }
      router.push(`/match/${state.match_id}${isGuest ? "?guest=1" : ""}`);
    }
  }, [state.status, state.match_id, acceptedFlash, isGuest, router]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`qr-negotiation:${qrMatchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "qr_matches",
          filter: `id=eq.${qrMatchId}`,
        },
        (payload) => {
          setState((prev) => applyRowToState(prev, payload.new as Record<string, unknown>));
          if ((payload.new as { stake_status?: string }).stake_status === "pending") {
            setEditingProposal(false);
          }
        }
      )
      .subscribe();

    const poll = isGuest
      ? window.setInterval(() => {
          void loadState();
        }, 1500)
      : null;

    return () => {
      if (poll) window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [qrMatchId, isGuest, loadState]);

  const handlePropose = useCallback(async () => {
    if (!stakeValid || !canAfford) return;
    setProposing(true);
    setError(null);
    try {
      await proposeStake(qrMatchId, effectiveStake);
      setEditingProposal(false);
      await loadState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not propose stake");
    } finally {
      setProposing(false);
    }
  }, [qrMatchId, effectiveStake, stakeValid, canAfford, loadState]);

  const handleRespond = useCallback(
    async (accept: boolean) => {
      setResponding(true);
      setError(null);
      try {
        const result = await respondToStake(qrMatchId, accept, isGuest ? anonToken : null);
        if (result.accepted && result.match_id) {
          setAcceptedFlash(true);
          setState((prev) => ({
            ...prev,
            status: "in_progress",
            match_id: result.match_id,
            stake_sk: result.stake_sk,
            stake_status: "accepted",
          }));
        } else {
          await loadState();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not respond");
      } finally {
        setResponding(false);
      }
    },
    [qrMatchId, isGuest, anonToken, loadState]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
        <LoadingRing size={32} />
      </div>
    );
  }

  if (!state.found) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <p className="text-xl font-bold">match not found</p>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      </div>
    );
  }

  if (acceptedFlash) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <p className="text-2xl font-black text-[#FFFF00]">locked in.</p>
        <p className="mt-2 text-sm text-[#9CA3AF]">starting match…</p>
      </div>
    );
  }

  const isHost = state.role === "host";
  const isOpponent = state.role === "opponent";
  const stakePending = state.stake_status === "pending";
  const stakeProposed = state.stake_status === "proposed";
  const proposedAmount = state.proposed_stake_sk ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#0E0E12] text-white">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">
          {formatGameName(state.game ?? "")}
        </p>

        {isHost ? (
          <>
            <h1 className="mt-3 text-center text-xl font-black">you&apos;re matched! propose your stake.</h1>
            <div className="mt-6 flex flex-col items-center">
              <AvatarWithBorder
                src={state.opponent_avatar_url}
                fallbackInitial={(state.opponent_username ?? "A").charAt(0).toUpperCase()}
                size="lg"
              />
              <p className="mt-2 text-sm font-semibold">{state.opponent_username ?? "Anonymous Player"}</p>
            </div>

            {(stakePending || (stakeProposed && editingProposal)) ? (
              <div className="mt-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">Stake (SK)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {QR_STAKE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setStake(preset);
                        setCustomStake("");
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                        stake === preset && !customStake
                          ? "border-[#FFFF00] bg-[#FFFF00] text-black"
                          : "border-[#1F1F26] bg-[#16161C] text-[#9CA3AF] hover:text-white"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={QR_MIN_STAKE}
                  max={QR_MAX_STAKE}
                  placeholder={`Custom (${QR_MIN_STAKE}–${QR_MAX_STAKE})`}
                  value={customStake}
                  onChange={(e) => setCustomStake(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#1F1F26] bg-[#16161C] px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:border-[#FFFF00] focus:outline-none"
                />
                <p className="mt-3 flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                  Your balance: {balanceSp.toLocaleString()} <SkilliesIcon className="h-3.5 w-3.5" />
                </p>
                {!canAfford && stakeValid ? (
                  <p className="mt-2 text-sm text-amber-400">insufficient SkillPoints for this stake.</p>
                ) : null}
                {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
                <button
                  type="button"
                  disabled={proposing || !stakeValid || !canAfford}
                  onClick={() => void handlePropose()}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFF00] py-3.5 text-sm font-bold text-black disabled:opacity-40"
                >
                  {proposing ? <LoadingRing size={20} /> : null}
                  Propose Stake
                </button>
              </div>
            ) : stakeProposed && !editingProposal ? (
              <div className="mt-8 rounded-2xl border border-[#1F1F26] bg-[#16161C] p-6 text-center">
                <p className="text-sm text-[#9CA3AF]">
                  waiting for {state.opponent_username ?? "opponent"} to respond…
                </p>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-3xl font-black text-[#FFFF00]">
                  {proposedAmount} <SkilliesIcon className="h-7 w-7" />
                </p>
                <button
                  type="button"
                  onClick={() => setEditingProposal(true)}
                  className="mt-4 text-xs font-semibold text-[#FFFF00] hover:underline"
                >
                  Change amount
                </button>
              </div>
            ) : null}
          </>
        ) : isOpponent ? (
          <>
            {stakeProposed ? (
              <>
                <h1 className="mt-3 text-center text-xl font-black leading-snug">
                  {state.host_username ?? "Host"} wants to play for{" "}
                  <span className="text-[#FFFF00]">{proposedAmount} SK</span>
                </h1>
                <div className="mt-6 flex flex-col items-center">
                  <AvatarWithBorder
                    src={state.host_avatar_url}
                    fallbackInitial={(state.host_username ?? "H").charAt(0).toUpperCase()}
                    size="lg"
                  />
                </div>
                {error ? <p className="mt-4 text-center text-sm text-red-400">{error}</p> : null}
                <div className="mt-8 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={responding}
                    onClick={() => void handleRespond(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFF00] py-4 text-base font-black text-black disabled:opacity-50"
                  >
                    {responding ? <LoadingRing size={22} /> : null}
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={responding}
                    onClick={() => void handleRespond(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1F1F26] py-4 text-base font-semibold text-[#9CA3AF] hover:text-white disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-12 text-center">
                <p className="text-lg font-bold text-[#9CA3AF]">waiting for a new offer…</p>
                <p className="mt-2 text-sm text-[#6B7280]">
                  {state.host_username ?? "Host"} is setting the stake.
                </p>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
