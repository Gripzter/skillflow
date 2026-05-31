"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AppNavbar, { dispatchWalletUpdated } from "@/components/AppNavbar";
import {
  getCurrentUser,
} from "@/lib/api";
import {
  createExternalMatch,
  generateFakeSteamOpponent,
} from "@/lib/external-matches";
import LoadingRing from "@/components/LoadingRing";
import SkilliesIcon from "@/components/SkilliesIcon";
import { creditSP, getUserSPData, spendSP } from "@/lib/skillpoints";

const STAKE_PRESETS = [100, 200, 500, 1000, 2500, 5000];
const SEARCH_TIMEOUT_SECONDS = 10;
const CS2_MAPS = ["Any", "Dust 2", "Mirage", "Inferno", "Nuke", "Anubis", "Ancient", "Overpass"];
const MODES = [
  {
    id: "1v1-aim-duel",
    title: "1v1 Aim Duel",
    description: "1v1 on aim map. First to 16 kills wins.",
    recommended: "Quick matches, aim practice",
    duration: "10-15 min",
    active: true,
  },
  {
    id: "1v1-competitive-mr12",
    title: "1v1 Competitive (MR12)",
    description: "Standard competitive rules. Best of 24 rounds.",
    recommended: "Serious competition",
    duration: "30-45 min",
    active: true,
  },
  {
    id: "5v5-competitive",
    title: "5v5 Competitive",
    description: "Full team competitive match. MR12 rules.",
    recommended: "Team play",
    duration: "45-60 min",
    active: false,
  },
];

export default function CS2LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const gameSlug = (params?.game as string) || "cs2";

  const [username, setUsername] = useState<string>("Player");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [balance, setBalance] = useState(0);

  const [selectedMode, setSelectedMode] = useState("1v1-aim-duel");
  const [stake, setStake] = useState(500);
  const [selectedMap, setSelectedMap] = useState("Any");
  const [matchmaking, setMatchmaking] = useState(false);
  const [matchmakingElapsed, setMatchmakingElapsed] = useState(0);
  const [opponentFound, setOpponentFound] = useState<{ username: string; rating: number } | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const findMatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stakeAmount = stake;
  const insufficientBalance = balance < stakeAmount;

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUsername(user.username);
        setUserId(user.id);
        setIsDevMode(user.isDevMode ?? false);
        const spData = await getUserSPData(user.id);
        setBalance(Number(spData?.balanceSp ?? 0));
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
    const handleUpdate = () =>
      void (userId
        ? getUserSPData(userId).then((spData) => setBalance(Number(spData?.balanceSp ?? 0)))
        : Promise.resolve());
    window.addEventListener("skillflow_wallet_updated", handleUpdate);
    return () => window.removeEventListener("skillflow_wallet_updated", handleUpdate);
  }, [router, userId]);

  const handleFindMatch = useCallback(async () => {
    if (insufficientBalance || stakeAmount < 1) return;
    const activeMode = MODES.find((m) => m.id === selectedMode);
    if (!activeMode?.active) return;

    try {
      const spendResult = await spendSP(
        userId,
        stakeAmount,
        "match_entry",
        `CS2 match – ${activeMode.title}`
      );
      if (!spendResult.success) return;
      const spData = await getUserSPData(userId);
      setBalance(Number(spData?.balanceSp ?? 0));
      dispatchWalletUpdated();
    } catch {
      return;
    }

    setMatchmaking(true);
    setMatchmakingElapsed(0);

    const timer = setInterval(() => {
      setMatchmakingElapsed((e) => e + 1);
    }, 1000);
    elapsedTimerRef.current = timer;

    const delay = 5000;
    findMatchTimeoutRef.current = setTimeout(async () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;

      const opponent = generateFakeSteamOpponent("CS_Warrior_2847", 1000);
      setOpponentFound({ username: opponent.username, rating: opponent.rating });

      const match = createExternalMatch({
        game: "cs2",
        mode: selectedMode,
        map: selectedMap === "Any" ? "random" : selectedMap.toLowerCase().replace(/\s/g, ""),
        player1: {
          username,
          rating: 1000,
          steamId: "Developer_Steam",
        },
        player2: opponent,
        stakeAmount,
      });
      setMatchId(match.id);
      setTimeout(() => router.push(`/external/match/${match.id}`), 2000);
    }, delay);
  }, [balance, stakeAmount, selectedMode, selectedMap, insufficientBalance, username, router]);

  const handleCancelMatchmaking = useCallback(async () => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = null;
    if (findMatchTimeoutRef.current) {
      clearTimeout(findMatchTimeoutRef.current);
      findMatchTimeoutRef.current = null;
    }
    setMatchmaking(false);
    setOpponentFound(null);
    setMatchId(null);
    setMatchmakingElapsed(0);
    try {
      await creditSP(userId, stakeAmount, "match_refund", "Match cancelled – stake refunded");
      const spData = await getUserSPData(userId);
      setBalance(Number(spData?.balanceSp ?? 0));
      dispatchWalletUpdated();
    } catch {
      dispatchWalletUpdated();
    }
  }, [stakeAmount]);

  useEffect(() => {
    return () => {
      if (findMatchTimeoutRef.current) clearTimeout(findMatchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (stake <= balance) return;
    const highestAffordable = [...STAKE_PRESETS].reverse().find((amt) => amt <= balance);
    if (highestAffordable) {
      setStake(highestAffordable);
    }
  }, [balance, stake]);

  if (loading) {
    return <LoadingRing />;
  }

  const formatTime = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-yellow-950/10 via-transparent" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={isDevMode}
        onLogout={async () => {
          setLoggingOut(true);
          try {
            const { logout } = await import("@/lib/api");
            await logout();
          } catch {
            setLoggingOut(false);
          }
        }}
        loggingOut={loggingOut}
        currentPage="external"
      />

      <main className="relative mx-auto max-w-[800px] px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/external"
            className="flex items-center gap-2 text-body-gray transition-colors hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Counter-Strike 2
          </Link>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-card/50 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-medium text-white inline-flex items-center gap-1">
              {Math.floor(balance).toLocaleString()} Skillies <SkilliesIcon size={14} />
            </span>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-white">Choose Match Type</h2>
          <div className="mt-4 space-y-3">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => mode.active && setSelectedMode(mode.id)}
                disabled={!mode.active}
                className={`card-border w-full rounded-card p-4 text-left transition-all ${
                  !mode.active ? "cursor-not-allowed opacity-50" : ""
                } ${
                  selectedMode === mode.id
                    ? "border-teal bg-teal/10 shadow-teal-glow/20"
                    : "hover:border-teal/30"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white">{mode.title}</p>
                    <p className="mt-1 text-sm text-body-gray">{mode.description}</p>
                    <p className="mt-1 text-xs text-body-gray">
                      Recommended for: {mode.recommended} • Avg: {mode.duration}
                    </p>
                  </div>
                  {!mode.active && (
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-body-gray">
                      Coming Soon
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-white">Stake Selection</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {STAKE_PRESETS.map((amt) => {
              const affordable = amt <= balance;
              return (
              <button
                key={amt}
                type="button"
                onClick={() => setStake(amt)}
                disabled={!affordable}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  !affordable
                    ? "cursor-not-allowed border-white/10 bg-white/5 text-body-gray opacity-60"
                    : stake === amt
                    ? "border-teal bg-teal text-charcoal shadow-teal-glow/30"
                    : "border-teal/50 bg-[#1A1D27] text-white hover:border-teal"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {amt.toLocaleString()} Skillies <SkilliesIcon size={14} />
                </span>
              </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-white">Preferred Map</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {CS2_MAPS.map((map) => (
              <button
                key={map}
                type="button"
                onClick={() => setSelectedMap(map)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  selectedMap === map
                    ? "border-teal bg-teal/20 text-teal"
                    : "border-white/10 bg-card text-body-gray hover:border-white/30 hover:text-white"
                }`}
              >
                {map}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-body-gray">
            Default: Any (both players vote; if no agreement = random)
          </p>
        </section>

        <section className="mt-8">
          <div className="card-border rounded-card bg-card/50 p-4">
            <h3 className="font-semibold text-white">Platform Requirements</h3>
            <ul className="mt-3 space-y-2 text-sm text-body-gray">
              <li className="flex items-center gap-2">
                <span className="text-teal">✅</span> You need CS2 installed on Steam
              </li>
              <li className="flex items-center gap-2">
                <span className="text-teal">✅</span> Both players must have Prime status
              </li>
              <li className="flex items-center gap-2">
                <span className="text-teal">✅</span> Match will be played on a private server
              </li>
              <li className="flex items-center gap-2">
                <span className="text-teal">✅</span> Screenshots or demo file required as proof
              </li>
            </ul>
          </div>
        </section>

        <div className="mt-10">
          <button
            type="button"
            onClick={handleFindMatch}
            disabled={insufficientBalance || stakeAmount < 1}
            className="h-14 w-full rounded-lg bg-teal text-lg font-bold text-charcoal transition-all hover:shadow-teal-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              Play - {stakeAmount.toLocaleString()} Skillies <SkilliesIcon size={18} />
            </span>
          </button>
        </div>
      </main>

      {matchmaking && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/95 px-4">
          {!opponentFound ? (
            <>
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div className="absolute h-20 w-20 animate-ping rounded-full border-2 border-teal/40" />
                <div className="absolute h-16 w-16 animate-pulse rounded-full border-2 border-teal" />
                <div className="h-3 w-3 rounded-full bg-teal" />
              </div>
              <p className="mt-6 text-xl font-semibold text-white">Looking for opponent...</p>
              <p className="mt-2 text-body-gray">
                CS2 • {MODES.find((m) => m.id === selectedMode)?.title}
              </p>
              <p className="mt-2 text-sm text-body-gray">
                Searching... {formatTime(matchmakingElapsed)} / {formatTime(SEARCH_TIMEOUT_SECONDS)}
              </p>
              <button
                type="button"
                onClick={handleCancelMatchmaking}
                className="mt-8 rounded-lg border border-white/30 px-6 py-2 text-white hover:bg-white/10"
              >
                Cancel
              </button>
            </>
          ) : opponentFound && matchId ? (
            <>
              <p className="text-2xl font-bold text-teal">Opponent Found!</p>
              <div className="mt-8 flex w-full max-w-md items-center justify-center gap-4">
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal/40 to-purple/40 text-lg font-bold text-white">
                    {username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{username}</p>
                  <p className="text-xs text-body-gray">Rating 1000</p>
                </div>
                <span className="text-2xl font-bold text-teal drop-shadow-teal-glow">VS</span>
                <div className="card-border flex flex-1 flex-col items-center rounded-card bg-card p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500/40 to-red-500/40 text-lg font-bold text-white">
                    {opponentFound.username.charAt(0)}
                  </div>
                  <p className="mt-2 font-medium text-white">{opponentFound.username}</p>
                  <p className="text-xs text-body-gray">Rating {opponentFound.rating}</p>
                </div>
              </div>
              <p className="mt-6 text-body-gray">Starting match...</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
