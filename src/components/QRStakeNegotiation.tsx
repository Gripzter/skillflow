"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingRing from "@/components/LoadingRing";
import SkilliesIcon from "@/components/SkilliesIcon";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { createClient } from "@/lib/supabase";
import {
  QR_STAKE_PRESETS,
  fetchNegotiationState,
  formatGameName,
  getAnonymousTokenFromCookie,
  getOrCreateAnonymousToken,
  setStake,
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
    found: true,
    status: row.status as string,
    stake_sk: row.stake_sk as number | null,
    match_id: row.match_id as string | null,
  };
}

export default function QRStakeNegotiation({ qrMatchId, isGuest, balanceSp = 0 }: Props) {
  const router = useRouter();
  const [state, setState] = useState<QRNegotiationState>({ found: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingStake, setSettingStake] = useState<number | null>(null);

  const anonToken = useMemo(
    () => (isGuest ? getOrCreateAnonymousToken() : getAnonymousTokenFromCookie()),
    [isGuest]
  );

  const loadState = useCallback(async () => {
    try {
      const data = await fetchNegotiationState(qrMatchId, isGuest ? anonToken : null);
      if (data.found) {
        setState(data);
        setError(null);
      } else if (!state.found) {
        setError("couldn't find this match — it may have expired.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "could not load match";
      if (!state.found) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [qrMatchId, isGuest, anonToken, state.found]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const goToMatch = useCallback(
    (matchId: string) => {
      router.push(`/match/${matchId}${isGuest ? "?guest=1" : ""}`);
    },
    [isGuest, router]
  );

  useEffect(() => {
    if (state.status === "in_progress" && state.match_id) {
      goToMatch(state.match_id);
    }
  }, [state.status, state.match_id, goToMatch]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`qr-stake:${qrMatchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "qr_matches",
          filter: `id=eq.${qrMatchId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setState((prev) => applyRowToState(prev, row));
          const matchId = row.match_id as string | null;
          const status = row.status as string;
          if (status === "in_progress" && matchId) {
            goToMatch(matchId);
          }
        }
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void loadState();
    }, isGuest ? 1500 : 2000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [qrMatchId, isGuest, loadState, goToMatch]);

  const handlePickStake = useCallback(
    async (amount: number) => {
      if (balanceSp < amount) {
        setError(`insufficient balance — need ${amount} SK.`);
        return;
      }
      setSettingStake(amount);
      setError(null);
      try {
        const result = await setStake(qrMatchId, amount);
        setState((prev) => ({
          ...prev,
          status: "in_progress",
          stake_sk: result.stake_sk,
          match_id: result.match_id,
        }));
        goToMatch(result.match_id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not start match");
        setSettingStake(null);
      }
    },
    [qrMatchId, balanceSp, goToMatch]
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
        <p className="text-xl font-bold">couldn&apos;t find this match</p>
        <p className="mt-2 text-sm text-[#9CA3AF]">
          {error ?? "it may have expired or been cancelled."}
        </p>
      </div>
    );
  }

  const isHost = state.role === "host";
  const isOpponent = state.role === "opponent";
  const waitingForStake = state.status === "accepted" && !state.match_id;

  if (isOpponent && waitingForStake) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-6 text-center text-white">
        <LoadingRing size={36} />
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">
          {formatGameName(state.game ?? "")}
        </p>
        <h1 className="mt-3 text-xl font-black leading-snug">
          waiting for {state.host_username ?? "host"} to set the stake
        </h1>
        <div className="mt-6">
          <AvatarWithBorder
            src={state.host_avatar_url}
            fallbackInitial={(state.host_username ?? "H").charAt(0).toUpperCase()}
            size="lg"
          />
        </div>
        <p className="mt-6 max-w-xs text-sm text-[#6B7280]">
          hang tight — match starts the moment they pick an amount.
        </p>
      </div>
    );
  }

  if (isHost && waitingForStake) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0E0E12] text-white">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-10">
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">
              {formatGameName(state.game ?? "").toUpperCase()}
            </p>

            <h1 className="mt-4 text-2xl font-black leading-tight">
              you&apos;re matched! pick your stake.
            </h1>

            <div className="mt-8">
              <AvatarWithBorder
                src={state.opponent_avatar_url}
                fallbackInitial={(state.opponent_username ?? "A").charAt(0).toUpperCase()}
                size="lg"
              />
              <p className="mt-3 text-base font-semibold">
                {state.opponent_username ?? "Anonymous Player"}
              </p>
            </div>

            <p className="mt-5 text-sm italic text-[#9CA3AF]">winner takes it all.</p>

            <div className="mt-8 grid w-full grid-cols-2 gap-3">
              {QR_STAKE_PRESETS.map((preset) => {
                const disabled = settingStake !== null || balanceSp < preset;
                const isLoading = settingStake === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={disabled}
                    onClick={() => void handlePickStake(preset)}
                    className="flex min-h-[88px] flex-col items-center justify-center rounded-2xl border border-[#1F1F26] bg-[#16161C] px-4 py-5 transition duration-150 hover:border-[#FFFF00] hover:bg-[#FFFF00]/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isLoading ? (
                      <LoadingRing size={22} />
                    ) : (
                      <>
                        <span className="text-3xl font-black text-[#FFFF00]">{preset}</span>
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
                          SK <SkilliesIcon className="h-3 w-3" />
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-6 flex items-center gap-1.5 text-xs text-[#6B7280]">
              balance: {balanceSp.toLocaleString()} <SkilliesIcon className="h-3.5 w-3.5" />
            </p>

            {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
      <LoadingRing size={32} />
    </div>
  );
}
