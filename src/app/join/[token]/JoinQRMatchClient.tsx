"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingRing from "@/components/LoadingRing";
import { createClient } from "@/lib/supabase";
import {
  acceptQRMatch,
  getOrCreateAnonymousToken,
  storeAnonymousGuestId,
  type QRMatchPublic,
} from "@/lib/qr-match";
import { generateAnonymousName } from "@/lib/generateAnonymousName";

type Props = {
  token: string;
  initialMatch: QRMatchPublic;
};

type JoinPhase = "loading" | "joining" | "redirecting" | "error" | "unavailable";

function parseErrorMessage(message: string): string {
  if (message.includes("QR_EXPIRED") || message.includes("expired")) {
    return "this code went stale.";
  }
  if (message.includes("QR_NOT_AVAILABLE") || message.includes("already")) {
    return "this match was already claimed.";
  }
  if (message.includes("CANNOT_PLAY_SELF")) {
    return "you can't join your own match.";
  }
  return message;
}

export default function JoinQRMatchClient({ token, initialMatch }: Props) {
  const router = useRouter();
  const [match] = useState(initialMatch);
  const [phase, setPhase] = useState<JoinPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const joinStarted = useRef(false);

  const runJoin = useCallback(async () => {
    setPhase("joining");
    setError(null);
    try {
      const supabase = createClient();
      let sessionUserId: string | null = null;
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        sessionUserId = session?.user?.id ?? null;
      }

      let opponentUserId: string | null = sessionUserId;
      let anonymousToken: string | null = null;
      let anonymousDisplayName: string | null = null;

      if (!opponentUserId) {
        anonymousToken = getOrCreateAnonymousToken();
        anonymousDisplayName = generateAnonymousName();
        opponentUserId = null;
      }

      const result = await acceptQRMatch(token, {
        opponentUserId,
        anonymousSessionToken: anonymousToken,
        anonymousDisplayName,
      });

      if (result.anonymous_guest_id) {
        storeAnonymousGuestId(result.anonymous_guest_id);
      }

      setPhase("redirecting");
      const guestParam = result.opponent_is_anonymous ? "?guest=1" : "";
      router.replace(`/qr/${result.qr_match_id}/negotiate${guestParam}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not join match";
      setError(parseErrorMessage(msg));
      setPhase("error");
    }
  }, [token, router]);

  useEffect(() => {
    if (!match.found) {
      setPhase("unavailable");
      return;
    }

    if (match.status === "in_progress" && match.match_id) {
      router.replace(`/match/${match.match_id}`);
      return;
    }

    if (match.status === "accepted" && match.id) {
      setPhase("redirecting");
      void (async () => {
        const supabase = createClient();
        let guestSuffix = "?guest=1";
        if (supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user?.id) guestSuffix = "";
        }
        router.replace(`/qr/${match.id}/negotiate${guestSuffix}`);
      })();
      return;
    }

    const isExpired =
      match.status === "expired" ||
      (match.status === "pending" &&
        match.expires_at &&
        new Date(match.expires_at).getTime() <= Date.now());

    if (isExpired) {
      setPhase("unavailable");
      setError("this code went stale.");
      return;
    }

    if (match.status !== "pending") {
      setPhase("unavailable");
      setError("this match is no longer available.");
      return;
    }

    if (joinStarted.current) return;
    joinStarted.current = true;
    void runJoin();
  }, [match, router, runJoin]);

  if (!match.found) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <p className="text-xl font-bold">match not found</p>
        <p className="mt-2 text-sm text-[#9CA3AF]">this link may be invalid or expired.</p>
        <Link href="/" className="mt-6 text-sm text-[#FFFF00] hover:underline">
          Go to SkillFlow
        </Link>
      </div>
    );
  }

  if (phase === "unavailable" || phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
        <p className="text-xl font-bold">{error ?? "this match is no longer available"}</p>
        {phase === "error" && error !== "this code went stale." ? (
          <p className="mt-2 text-sm text-[#9CA3AF]">try scanning a fresh code from the host.</p>
        ) : null}
        <Link href="/" className="mt-6 text-sm text-[#FFFF00] hover:underline">
          Go to SkillFlow
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E12] px-4 text-center text-white">
      <LoadingRing size={36} />
      <p className="mt-4 text-sm font-semibold text-[#9CA3AF]">
        {phase === "redirecting" ? "heading to stake negotiation…" : "joining match…"}
      </p>
    </div>
  );
}
