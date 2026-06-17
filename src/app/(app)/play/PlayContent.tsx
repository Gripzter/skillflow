"use client";

import { useEffect, useMemo, useState } from "react";
import type { MouseEventHandler } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import GameCardChallenges from "@/components/play/GameCardChallenges";
import DailyChallenges from "@/components/DailyChallenges";
import PromoCarousel from "@/components/play/PromoCarousel";
import { useDailyChallenges } from "@/hooks/useDailyChallenges";
import { useGames, type GameCategory } from "@/hooks/useGames";
import { useGameOrder } from "@/hooks/useGameOrder";
import { useProfile } from "@/hooks/useProfile";
import { useRecentMatches } from "@/hooks/useRecentMatches";
import { toLegacyChallengeRow, type DailyChallengeRow } from "@/lib/daily-challenges";
import { redirectToAuthAction } from "@/lib/auth-action";
import CreateQRMatch, { GameCardQRButton } from "@/components/CreateQRMatch";
import { DEFAULT_QR_STAKE, isQRSupportedGame, lookupQRMatchByShortCode } from "@/lib/qr-match";

const FILTERS: Array<{ label: string; value: "all" | GameCategory }> = [
  { label: "ALL", value: "all" },
  { label: "STRATEGY", value: "strategy" },
  { label: "REFLEX", value: "reflex" },
  { label: "KNOWLEDGE", value: "knowledge" },
];

type QRModalState =
  | { open: false }
  | { open: true; mode: "select" }
  | { open: true; mode: "instant"; game: string; stake: number };

function PlayGameCard({
  game,
  index,
  challenges,
  isAuthenticated,
  onQuickMatch,
  qrLoading,
  qrError,
  codeExpanded,
  onToggleCode,
  onJoinCode,
  codeError,
  codeJoining,
}: {
  game: {
    slug: string;
    name: string;
    image: string;
    waitSeconds: number;
    status?: "active" | "coming_soon";
    description?: string;
  };
  index: number;
  challenges: DailyChallengeRow[];
  isAuthenticated: boolean;
  onQuickMatch: (slug: string) => void;
  qrLoading?: boolean;
  qrError?: string | null;
  codeExpanded: boolean;
  onToggleCode: () => void;
  onJoinCode: (code: string) => void;
  codeError?: string | null;
  codeJoining?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const isComingSoon = game.status === "coming_soon";
  const supportsQr = isQRSupportedGame(game.slug);
  const scopedChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.game_slug === game.slug || challenge.game_slug == null),
    [challenges, game.slug]
  );

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (isComingSoon) {
      event.preventDefault();
      return;
    }
    if (isAuthenticated) return;
    event.preventDefault();
    redirectToAuthAction();
  };

  const cardContent = (
    <>
      <Link
        href={`/play/${game.slug}`}
        onClick={handleClick}
        className="absolute inset-0 z-0"
        aria-label={`Play ${game.name}`}
      />

      <Image
        src={game.image}
        alt={`${game.name} artwork`}
        fill
        className={`object-cover ${isComingSoon ? "grayscale-[30%]" : ""}`}
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
        priority={index < 2}
      />
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-[50%] bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

      {isComingSoon ? (
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/10 text-white/80 text-[9px] sm:text-[11px] font-bold uppercase tracking-wide rounded">
          Coming Soon
        </div>
      ) : index === 0 ? (
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#FFFF00] text-black text-[9px] sm:text-[11px] font-bold uppercase tracking-wide rounded">
          HOT
        </div>
      ) : null}

      {!isComingSoon ? <GameCardChallenges challenges={scopedChallenges} visible={hovered} /> : null}

      <div className="absolute bottom-0 left-0 right-0 z-10 p-3 sm:p-4">
        <h3 className="text-base sm:text-lg lg:text-xl font-black text-white mb-2 leading-tight pointer-events-none">
          {game.name}
        </h3>

        {isComingSoon && game.description ? (
          <p className="text-[10px] sm:text-xs text-white/60 leading-tight line-clamp-2 pointer-events-none">
            {game.description}
          </p>
        ) : supportsQr ? (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <GameCardQRButton
              onClick={() => {
                if (!isAuthenticated) {
                  redirectToAuthAction();
                  return;
                }
                onQuickMatch(game.slug);
              }}
              loading={qrLoading}
              error={qrError}
            />
            <button
              type="button"
              onClick={onToggleCode}
              className="block w-full text-left text-[10px] font-medium text-white/50 hover:text-[#FFFF00] transition-colors py-1"
            >
              {codeExpanded ? "Hide code entry" : "Have a code? Enter it"}
            </button>
            {codeExpanded ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  maxLength={6}
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-2 font-mono text-xs text-white placeholder:text-white/30 focus:border-[#FFFF00]/50 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={codeInput.length < 4 || codeJoining}
                  onClick={() => onJoinCode(codeInput)}
                  className="shrink-0 rounded-md bg-[#FFFF00] px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            ) : null}
            {codeExpanded && codeError ? (
              <p className="text-[10px] text-red-400">{codeError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );

  if (isComingSoon) {
    return (
      <div
        aria-disabled
        className="group relative block aspect-[2/3] overflow-hidden rounded-xl border border-[#1F1F26] bg-[#16161C] opacity-80 cursor-not-allowed"
      >
        {cardContent}
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group relative block aspect-[2/3] overflow-hidden rounded-xl border border-[#1F1F26] bg-[#16161C] transition duration-150 hover:scale-[1.02] hover:border-[#FFFF00]"
    >
      {cardContent}
    </div>
  );
}

export default function PlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<"all" | GameCategory>("all");
  const [qrModal, setQrModal] = useState<QRModalState>({ open: false });
  const [qrLoadingSlug, setQrLoadingSlug] = useState<string | null>(null);
  const [qrErrorBySlug, setQrErrorBySlug] = useState<Record<string, string>>({});
  const [codeExpandedSlug, setCodeExpandedSlug] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeJoining, setCodeJoining] = useState(false);

  const { profile, loading } = useProfile();
  const isAuthenticated = !!profile.id;
  const { games } = useGames();
  const orderedGames = useGameOrder(games, profile.id || null);
  const { challenges, refresh } = useDailyChallenges(isAuthenticated);
  const legacyChallenges = useMemo(
    () => challenges.map(toLegacyChallengeRow),
    [challenges]
  );
  const { matches } = useRecentMatches({
    limit: 1,
    username: profile.username,
    enabled: isAuthenticated,
  });

  const openSpFromUrl = useMemo(() => searchParams.get("sp") === "1", [searchParams]);

  const filteredGames = useMemo(() => {
    if (activeFilter === "all") return orderedGames;
    return orderedGames.filter((game) => game.category === activeFilter);
  }, [activeFilter, orderedGames]);

  const handleQuickMatch = (slug: string) => {
    setQrErrorBySlug((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
    setQrLoadingSlug(slug);
    setQrModal({ open: true, mode: "instant", game: slug, stake: DEFAULT_QR_STAKE });
  };

  const handleJoinCode = async (code: string) => {
    setCodeJoining(true);
    setCodeError(null);
    try {
      const result = await lookupQRMatchByShortCode(code);
      if (!result.found) {
        setCodeError(result.expired ? "This code has expired." : "Code not found.");
        return;
      }
      if (result.unavailable) {
        setCodeError("This match was already claimed.");
        return;
      }
      if (result.qr_token) {
        router.push(`/join/${result.qr_token}`);
      }
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Could not look up code");
    } finally {
      setCodeJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0E12] pb-24 text-white md:pb-8">
      <AppNavbar currentPage="play" initialOpenSpModal={isAuthenticated && !loading ? openSpFromUrl : false} />

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        <PromoCarousel
          isAuthenticated={isAuthenticated}
          onOpenQrMatch={() => {
            if (!isAuthenticated) {
              redirectToAuthAction();
              return;
            }
            setQrModal({ open: true, mode: "select" });
          }}
        />

        {isAuthenticated && challenges.length > 0 ? (
          <div className="mt-6">
            <DailyChallenges challenges={challenges} onRefresh={refresh} />
          </div>
        ) : null}

        <h1 className="mt-8 text-[32px] font-black tracking-[-0.03em] text-white">
          Play smarter. Match faster. Earn more.
        </h1>
        <p className="mt-2 text-sm text-[#9CA3AF]">Beta · Free to play · Earn SkillPoints</p>

        <CreateQRMatch
          open={qrModal.open}
          onClose={() => {
            setQrModal({ open: false });
            setQrLoadingSlug(null);
          }}
          balanceSp={profile.balanceSp ?? 0}
          mode={qrModal.open && qrModal.mode === "instant" ? "instant" : "select"}
          presetGame={qrModal.open && qrModal.mode === "instant" ? qrModal.game : null}
          presetStake={qrModal.open && qrModal.mode === "instant" ? qrModal.stake : null}
          onMatchStarted={(matchId) => {
            setQrModal({ open: false });
            setQrLoadingSlug(null);
            router.push(`/match/${matchId}`);
          }}
          onError={(msg) => {
            if (qrLoadingSlug) {
              setQrErrorBySlug((prev) => ({ ...prev, [qrLoadingSlug]: msg }));
            }
            setQrModal({ open: false });
            setQrLoadingSlug(null);
          }}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.06em] transition-colors ${
                  active
                    ? "border-[#FFFF00] bg-[#FFFF00] text-black"
                    : "border-[#1F1F26] bg-[#16161C] text-[#9CA3AF] hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {filteredGames.map((game, index) => (
            <PlayGameCard
              key={game.slug}
              game={game}
              index={index}
              challenges={isAuthenticated ? legacyChallenges : []}
              isAuthenticated={isAuthenticated}
              onQuickMatch={handleQuickMatch}
              qrLoading={qrLoadingSlug === game.slug && qrModal.open}
              qrError={qrErrorBySlug[game.slug] ?? null}
              codeExpanded={codeExpandedSlug === game.slug}
              onToggleCode={() =>
                setCodeExpandedSlug((prev) => (prev === game.slug ? null : game.slug))
              }
              onJoinCode={handleJoinCode}
              codeError={codeExpandedSlug === game.slug ? codeError : null}
              codeJoining={codeJoining}
            />
          ))}
        </div>

        <section className="mt-12">
          {isAuthenticated && matches.length > 0 ? (
            <p className="mt-4 text-sm text-[#9CA3AF]">
              Last match: {matches[0].resultLabel} vs {matches[0].opponent} ·
              <span className="text-[#FFFF00]"> +{matches[0].spDelta} SP</span> · {matches[0].timeAgo}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
