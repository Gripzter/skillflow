"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, QrCode, X } from "lucide-react";
import LoadingRing from "@/components/LoadingRing";
import { createClient } from "@/lib/supabase";
import {
  QR_GAMES,
  cancelQRMatch,
  createQRMatch,
  expireQRMatch,
  formatGameName,
  getJoinUrl,
  lookupQRMatchByShortCode,
  type CreateQRMatchResult,
} from "@/lib/qr-match";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => <div className="aspect-square w-full max-w-[280px] animate-pulse rounded-xl bg-white/5" />,
});

export type QRMatchModalMode = "select" | "instant";

type ModalView = "qr" | "join-code";

type Props = {
  open: boolean;
  onClose: () => void;
  onNegotiationStarted?: (qrMatchId: string) => void;
  onMatchStarted?: (matchId: string) => void;
  onError?: (message: string) => void;
  mode?: QRMatchModalMode;
  presetGame?: string | null;
};

export default function CreateQRMatch({
  open,
  onClose,
  onNegotiationStarted,
  onMatchStarted,
  mode = "select",
  presetGame = null,
  onError,
}: Props) {
  const router = useRouter();
  const [game, setGame] = useState(QR_GAMES[0].slug);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<CreateQRMatchResult | null>(null);
  const [expired, setExpired] = useState(false);
  const [view, setView] = useState<ModalView>("qr");
  const [codeInput, setCodeInput] = useState("");
  const [codeJoining, setCodeJoining] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isInstant = mode === "instant";
  const activeGame = isInstant && presetGame ? presetGame : game;

  const runGenerate = useCallback(
    async (targetGame: string) => {
      setLoading(true);
      setError(null);
      setExpired(false);
      try {
        const result = await createQRMatch(targetGame);
        setQrData(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create QR match";
        setError(msg);
        if (isInstant) {
          onError?.(msg);
          onClose();
        }
      } finally {
        setLoading(false);
      }
    },
    [isInstant, onClose, onError]
  );

  useEffect(() => {
    if (!open) {
      setQrData(null);
      setError(null);
      setLoading(false);
      setExpired(false);
      setView("qr");
      setCodeInput("");
      setCodeError(null);
      setCopied(false);
      return;
    }

    if (isInstant && presetGame && !qrData && !loading) {
      void runGenerate(presetGame);
    }
  }, [open, isInstant, presetGame, qrData, loading, runGenerate]);

  useEffect(() => {
    if (!qrData || expired) return;
    const expiresAtMs = new Date(qrData.expires_at).getTime();

    const checkExpiry = () => {
      if (Date.now() >= expiresAtMs) {
        setExpired(true);
        void expireQRMatch(qrData.id).catch(() => {});
      }
    };

    checkExpiry();
    const t = window.setInterval(checkExpiry, 1000);
    return () => window.clearInterval(t);
  }, [qrData, expired]);

  useEffect(() => {
    if (!qrData || expired) return;
    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`qr-host:${qrData.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "qr_matches",
          filter: `id=eq.${qrData.id}`,
        },
        (payload) => {
          const row = payload.new as { status?: string; match_id?: string | null; id?: string };
          if (row.status === "accepted" && row.id) {
            onNegotiationStarted?.(row.id);
            router.push(`/qr/${row.id}/negotiate`);
            onClose();
          } else if (row.status === "in_progress" && row.match_id) {
            onMatchStarted?.(row.match_id);
            router.push(`/match/${row.match_id}`);
            onClose();
          }
        }
      )
      .subscribe();

    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("qr_matches")
        .select("status, match_id")
        .eq("id", qrData.id)
        .maybeSingle();
      if (data?.status === "accepted") {
        onNegotiationStarted?.(qrData.id);
        router.push(`/qr/${qrData.id}/negotiate`);
        onClose();
      } else if (data?.status === "in_progress" && data.match_id) {
        onMatchStarted?.(data.match_id as string);
        router.push(`/match/${data.match_id}`);
        onClose();
      }
    }, 2000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [qrData, expired, onNegotiationStarted, onMatchStarted, onClose, router]);

  const handleCancel = useCallback(async () => {
    if (qrData && !expired) {
      try {
        await cancelQRMatch(qrData.id);
      } catch {
        /* best effort */
      }
    }
    setQrData(null);
    onClose();
  }, [qrData, expired, onClose]);

  const handleCopyCode = useCallback(async () => {
    if (!qrData?.short_code) return;
    try {
      await navigator.clipboard.writeText(qrData.short_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [qrData?.short_code]);

  const handleJoinCode = useCallback(async () => {
    setCodeJoining(true);
    setCodeError(null);
    try {
      const result = await lookupQRMatchByShortCode(codeInput);
      if (!result.found) {
        setCodeError(result.expired ? "this code went stale." : "code not found.");
        return;
      }
      if (result.unavailable) {
        setCodeError("this match was already claimed.");
        return;
      }
      if (result.qr_token) {
        onClose();
        router.push(`/join/${result.qr_token}`);
      }
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Could not look up code");
    } finally {
      setCodeJoining(false);
    }
  }, [codeInput, onClose, router]);

  if (!open) return null;

  const joinUrl = qrData ? getJoinUrl(qrData.qr_token) : "";
  const showSelection = !isInstant && !qrData;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#1F1F26] bg-[#0E0E12] shadow-2xl"
        role="dialog"
        aria-labelledby="qr-match-title"
      >
        <button
          type="button"
          onClick={() => (view === "join-code" ? setView("qr") : void handleCancel())}
          className="absolute right-3 top-3 rounded-lg p-2 text-[#9CA3AF] hover:bg-white/5 hover:text-white"
          aria-label={view === "join-code" ? "Back" : "Close"}
        >
          {view === "join-code" ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>

        <div className="p-6">
          <h2 id="qr-match-title" className="text-xl font-black tracking-tight text-white">
            Play In Person
          </h2>

          {view === "join-code" ? (
            <div className="mt-6">
              <p className="text-sm text-[#9CA3AF]">enter the 6-character code from your opponent.</p>
              <input
                type="text"
                value={codeInput}
                onChange={(e) =>
                  setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
                }
                placeholder="Z6JZCB"
                maxLength={6}
                className="mt-4 w-full rounded-xl border border-[#1F1F26] bg-[#16161C] px-4 py-3 text-center font-mono text-lg tracking-[0.25em] text-white placeholder:text-[#6B7280] focus:border-[#FFFF00] focus:outline-none"
              />
              {codeError ? <p className="mt-3 text-sm text-red-400">{codeError}</p> : null}
              <button
                type="button"
                disabled={codeInput.length < 4 || codeJoining}
                onClick={() => void handleJoinCode()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFF00] py-3.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {codeJoining ? <LoadingRing size={20} /> : null}
                Join
              </button>
            </div>
          ) : showSelection ? (
            <>
              <p className="mt-1 text-sm text-[#9CA3AF]">
                Generate a QR code. Your opponent scans to join — no account needed.
              </p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">
                Choose game
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {QR_GAMES.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setGame(g.slug)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors ${
                      game === g.slug
                        ? "border-[#FFFF00] bg-[#FFFF00]/10 text-white"
                        : "border-[#1F1F26] bg-[#16161C] text-[#9CA3AF] hover:text-white"
                    }`}
                  >
                    <span className="text-2xl">{g.icon}</span>
                    <span className="text-[10px] font-semibold leading-tight">{g.name}</span>
                  </button>
                ))}
              </div>

              {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

              <button
                type="button"
                disabled={loading}
                onClick={() => void runGenerate(game)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFF00] py-3.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? <LoadingRing size={20} /> : null}
                Generate QR Code
              </button>

              <button
                type="button"
                onClick={() => setView("join-code")}
                className="mt-4 w-full text-center text-xs text-[#9CA3AF] hover:text-[#FFFF00] transition-colors"
              >
                Joining from another device? Enter a code
              </button>
            </>
          ) : loading && !qrData ? (
            <div className="mt-10 flex flex-col items-center gap-3 py-8">
              <LoadingRing size={32} />
              <p className="text-sm text-[#9CA3AF]">generating code…</p>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </div>
          ) : qrData ? (
            <div className="mt-5 flex flex-col items-center">
              {!expired ? (
                <div className="w-full rounded-2xl bg-[#0a0a0a] p-5">
                  <p className="text-center text-sm font-bold uppercase tracking-widest text-[#9CA3AF]">
                    {formatGameName(qrData.game)}
                  </p>
                  <div className="mx-auto mt-3 flex w-[65%] max-w-[280px] justify-center">
                    <QRCodeSVG
                      value={joinUrl}
                      size={256}
                      level="M"
                      bgColor="#0a0a0a"
                      fgColor="#FFFF00"
                      className="h-auto w-full"
                      includeMargin
                    />
                  </div>
                  {qrData.short_code ? (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">
                        Code
                      </span>
                      <span className="font-mono text-base font-bold tracking-[0.2em] text-white">
                        {qrData.short_code}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyCode()}
                        className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-white/5 hover:text-white"
                        aria-label="Copy code"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {copied ? (
                        <span className="text-[10px] text-[#FFFF00]">copied</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-[#9CA3AF]">nobody scanned in time. try again.</p>
                </div>
              )}

              <p className="mt-4 text-xs text-[#9CA3AF]">
                {expired ? null : "Waiting for opponent to scan…"}
              </p>

              <div className="mt-4 flex w-full gap-2">
                {expired ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQrData(null);
                      setExpired(false);
                      if (isInstant && presetGame) {
                        void runGenerate(presetGame);
                      }
                    }}
                    className="flex-1 rounded-xl bg-[#FFFF00] py-3 text-sm font-bold text-black"
                  >
                    New QR Code
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCancel()}
                    className="flex-1 rounded-xl border border-[#1F1F26] py-3 text-sm font-semibold text-[#9CA3AF] hover:text-white"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {!expired ? (
                <button
                  type="button"
                  onClick={() => setView("join-code")}
                  className="mt-4 text-xs text-[#9CA3AF] hover:text-[#FFFF00] transition-colors"
                >
                  Joining from another device? Enter a code
                </button>
              ) : null}
            </div>
          ) : (
            error && <p className="mt-6 text-center text-sm text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact QR icon button for game cards */
export function GameCardQRButton({
  onClick,
  loading,
  error,
}: {
  onClick: () => void;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        disabled={loading}
        className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-white/[0.15] px-3 py-2.5 text-left text-xs font-semibold text-white/90 transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out hover:scale-[1.02] hover:border-[#FFFF00] hover:bg-white/[0.21] hover:shadow-[0_0_12px_rgba(255,255,0,0.3)] active:scale-[1.02] active:border-[#FFFF00] active:bg-white/[0.21] active:shadow-[0_0_12px_rgba(255,255,0,0.3)] disabled:opacity-60"
        style={{ background: "rgba(255, 255, 255, 0.16)" }}
      >
        {loading ? (
          <LoadingRing size={16} />
        ) : (
          <QrCode className="h-4 w-4 shrink-0 text-white/70" strokeWidth={2} />
        )}
        <span>Quick Match</span>
      </button>
      {error ? <p className="mt-1 px-1 text-[10px] leading-tight text-red-400">{error}</p> : null}
    </div>
  );
}
