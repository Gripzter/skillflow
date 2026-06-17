"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import LoadingRing from "@/components/LoadingRing";
import SkilliesIcon from "@/components/SkilliesIcon";
import { createClient } from "@/lib/supabase";
import {
  QR_GAMES,
  QR_MAX_STAKE,
  QR_MIN_STAKE,
  QR_STAKE_PRESETS,
  cancelQRMatch,
  createQRMatch,
  expireQRMatch,
  formatGameName,
  getJoinUrl,
  type CreateQRMatchResult,
} from "@/lib/qr-match";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => <div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-white/5" />,
});

type Props = {
  open: boolean;
  onClose: () => void;
  balanceSp: number;
  onMatchStarted?: (matchId: string) => void;
};

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CreateQRMatch({ open, onClose, balanceSp, onMatchStarted }: Props) {
  const [game, setGame] = useState(QR_GAMES[0].slug);
  const [stake, setStake] = useState<number>(25);
  const [customStake, setCustomStake] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<CreateQRMatchResult | null>(null);
  const [now, setNow] = useState(Date.now());

  const effectiveStake = useMemo(() => {
    if (customStake.trim()) {
      const n = parseInt(customStake, 10);
      if (!Number.isNaN(n)) return n;
    }
    return stake;
  }, [customStake, stake]);

  const availableBalance = balanceSp;
  const stakeValid = effectiveStake >= QR_MIN_STAKE && effectiveStake <= QR_MAX_STAKE;
  const canAfford = availableBalance >= effectiveStake;

  const expiresAtMs = qrData ? new Date(qrData.expires_at).getTime() : 0;
  const remainingMs = qrData ? expiresAtMs - now : 0;
  const expired = qrData ? remainingMs <= 0 : false;

  useEffect(() => {
    if (!open) {
      setQrData(null);
      setError(null);
      setCustomStake("");
    }
  }, [open]);

  useEffect(() => {
    if (!qrData || expired) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [qrData, expired]);

  useEffect(() => {
    if (!qrData || !expired) return;
    void expireQRMatch(qrData.id).catch(() => {});
  }, [qrData, expired]);

  // Poll for opponent accept → redirect host into match
  useEffect(() => {
    if (!qrData || expired) return;
    const supabase = createClient();
    if (!supabase) return;

    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("qr_matches")
        .select("status, match_id")
        .eq("id", qrData.id)
        .maybeSingle();
      if (data?.status === "in_progress" && data.match_id) {
        window.clearInterval(poll);
        onMatchStarted?.(data.match_id as string);
      }
    }, 2000);

    return () => window.clearInterval(poll);
  }, [qrData, expired, onMatchStarted]);

  const handleGenerate = useCallback(async () => {
    if (!stakeValid || !canAfford) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createQRMatch(game, effectiveStake);
      setQrData(result);
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create QR match");
    } finally {
      setLoading(false);
    }
  }, [game, effectiveStake, stakeValid, canAfford]);

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

  if (!open) return null;

  const joinUrl = qrData ? getJoinUrl(qrData.qr_token) : "";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#1F1F26] bg-[#0E0E12] shadow-2xl"
        role="dialog"
        aria-labelledby="qr-match-title"
      >
        <button
          type="button"
          onClick={() => void handleCancel()}
          className="absolute right-3 top-3 rounded-lg p-2 text-[#9CA3AF] hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          <h2 id="qr-match-title" className="text-xl font-black tracking-tight text-white">
            Play In Person
          </h2>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Generate a QR code. Your opponent scans to join — no account needed.
          </p>

          {!qrData ? (
            <>
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

              <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">
                Stake (SK)
              </p>
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
                Your balance: {availableBalance.toLocaleString()} <SkilliesIcon className="h-3.5 w-3.5" />
              </p>

              {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
              {!canAfford && stakeValid ? (
                <p className="mt-2 text-sm text-amber-400">Insufficient SkillPoints for this stake.</p>
              ) : null}

              <button
                type="button"
                disabled={loading || !stakeValid || !canAfford}
                onClick={() => void handleGenerate()}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFF00] py-3.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? <LoadingRing size={20} /> : null}
                Generate QR Code
              </button>
            </>
          ) : (
            <div className="mt-4 flex flex-col items-center">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{formatGameName(qrData.game)}</p>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-2xl font-black text-[#FFFF00]">
                  {qrData.stake_sk} <SkilliesIcon className="h-6 w-6" />
                </p>
                <p
                  className={`mt-2 font-mono text-sm ${expired ? "text-red-400" : "text-[#9CA3AF]"}`}
                >
                  {expired ? "Expired" : formatCountdown(remainingMs)}
                </p>
              </div>

              {!expired ? (
                <div className="mt-4 rounded-2xl bg-[#0a0a0a] p-4">
                  <QRCodeSVG
                    value={joinUrl}
                    size={220}
                    level="M"
                    bgColor="#0a0a0a"
                    fgColor="#FFFF00"
                    includeMargin
                  />
                </div>
              ) : (
                <p className="mt-6 text-center text-sm text-[#9CA3AF]">
                  This QR code expired. Generate a new one to continue.
                </p>
              )}

              <p className="mt-3 max-w-[280px] break-all text-center text-[10px] text-[#6B7280]">
                {joinUrl}
              </p>

              <div className="mt-5 flex w-full gap-2">
                {expired ? (
                  <button
                    type="button"
                    onClick={() => setQrData(null)}
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

              <p className="mt-3 text-xs text-[#9CA3AF]">Waiting for opponent to scan…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
