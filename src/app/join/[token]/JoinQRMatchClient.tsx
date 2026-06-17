"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingRing from "@/components/LoadingRing";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { createClient } from "@/lib/supabase";
import {
  acceptQRMatch,
  formatGameName,
  getOrCreateAnonymousToken,
  storeAnonymousGuestId,
  type QRMatchPublic,
} from "@/lib/qr-match";

type Props = {
  token: string;
  initialMatch: QRMatchPublic;
};

function gameIcon(slug: string): string {
  const icons: Record<string, string> = {
    chess: "♟️",
    "connect-4": "🔴",
    checkers: "⬛",
    "reaction-duel": "⚡",
    "memory-match": "🧠",
    "spelling-bee": "🐝",
  };
  return icons[slug] ?? "🎮";
}

export default function JoinQRMatchClient({ token, initialMatch }: Props) {
  const router = useRouter();
  const [match, setMatch] = useState(initialMatch);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      if (!supabase) {
        setCheckingSession(false);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSessionUserId(session?.user?.id ?? null);
      setCheckingSession(false);
    }
    void checkSession();
  }, []);

  useEffect(() => {
    if (match.status === "accepted" && match.id) {
      router.replace(`/qr/${match.id}/negotiate${sessionUserId ? "" : "?guest=1"}`);
    }
  }, [match.status, match.id, sessionUserId, router]);

  const handleAccept = useCallback(async () => {
    setAccepting(true);
    setError(null);
    try {
      let opponentUserId: string | null = sessionUserId;
      let anonymousToken: string | null = null;

      if (!opponentUserId) {
        anonymousToken = getOrCreateAnonymousToken();
        opponentUserId = null;
      }

      const result = await acceptQRMatch(token, {
        opponentUserId,
        anonymousSessionToken: anonymousToken,
      });

      if (result.anonymous_guest_id) {
        storeAnonymousGuestId(result.anonymous_guest_id);
      }

      const guestParam = result.opponent_is_anonymous ? "?guest=1" : "";
      router.push(`/qr/${result.qr_match_id}/negotiate${guestParam}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join match");
      setAccepting(false);
    }
  }, [token, sessionUserId, router]);

  if (!match.found) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <p className="text-xl font-bold">Match not found</p>
        <p className="mt-2 text-sm text-[#9CA3AF]">This link may be invalid or expired.</p>
        <Link href="/" className="mt-6 text-sm text-[#FFFF00] hover:underline">
          Go to SkillFlow
        </Link>
      </div>
    );
  }

  if (match.status === "in_progress" && match.match_id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <p className="text-xl font-bold">Match already started</p>
        <Link
          href={`/match/${match.match_id}`}
          className="mt-6 rounded-xl bg-[#FFFF00] px-6 py-3 text-sm font-bold text-black"
        >
          Open match
        </Link>
      </div>
    );
  }

  if (match.status === "accepted" && match.id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
        <LoadingRing size={32} />
      </div>
    );
  }

  const isExpired =
    match.status === "expired" ||
    (match.status === "pending" &&
      match.expires_at &&
      new Date(match.expires_at).getTime() <= Date.now());

  if (isExpired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <p className="text-xl font-bold">this code went stale.</p>
        <p className="mt-2 text-sm text-[#9CA3AF]">ask the host to generate a new one.</p>
        <Link href="/" className="mt-6 text-sm text-[#FFFF00] hover:underline">
          Go to SkillFlow
        </Link>
      </div>
    );
  }

  if (match.status !== "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <p className="text-xl font-bold">This match is no longer available</p>
        <Link href="/" className="mt-6 text-sm text-[#FFFF00] hover:underline">
          Go to SkillFlow
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0E0E12] text-white">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        <div className="flex flex-col items-center text-center">
          <AvatarWithBorder
            src={match.host_avatar_url}
            fallbackInitial={(match.host_username ?? "H").charAt(0).toUpperCase()}
            size="lg"
          />
          <p className="mt-3 text-lg font-bold">{match.host_username ?? "Player"}</p>
          <p className="text-sm text-[#9CA3AF]">invites you to play</p>
        </div>

        <div className="mt-8 rounded-2xl border border-[#1F1F26] bg-[#16161C] p-6 text-center">
          <span className="text-4xl">{gameIcon(match.game ?? "")}</span>
          <p className="mt-3 text-xl font-black">{formatGameName(match.game ?? "")}</p>
        </div>

        {sessionUserId ? (
          <p className="mt-4 text-center text-xs text-[#9CA3AF]">
            signed in — you&apos;ll agree on a stake after joining.
          </p>
        ) : (
          <p className="mt-4 text-center text-xs text-[#9CA3AF]">
            no account needed. win and sign up later to claim your SkillPoints.
          </p>
        )}

        {error ? <p className="mt-4 text-center text-sm text-red-400">{error}</p> : null}

        <button
          type="button"
          disabled={accepting || checkingSession}
          onClick={() => void handleAccept()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFF00] py-4 text-base font-black text-black disabled:opacity-50"
        >
          {accepting || checkingSession ? <LoadingRing size={22} /> : null}
          Join Match
        </button>
      </main>

      <footer className="border-t border-[#1F1F26] py-4 text-center text-xs text-[#6B7280]">
        Powered by <span className="font-semibold text-[#9CA3AF]">SkillFlow</span>
      </footer>
    </div>
  );
}
