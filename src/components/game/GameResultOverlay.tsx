"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import SPIcon from "@/components/SPIcon";

const AUTO_REDIRECT_SEC = 8;

interface GameResultOverlayProps {
  outcome: "victory" | "defeat" | "draw";
  isPractice: boolean;
  stakeAmount: number;
  winnerPayout: number;
  payoutOverride?: number;
  stakeLostOverride?: number;
  newBalance?: number | null;
  gameType: string;
  opponentUsername: string;
  wonByForfeit?: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export default function GameResultOverlay({
  outcome,
  isPractice,
  stakeAmount,
  winnerPayout,
  payoutOverride,
  stakeLostOverride,
  newBalance,
  opponentUsername,
  wonByForfeit,
  onPlayAgain,
  onLeave,
}: GameResultOverlayProps) {
  const [countdown, setCountdown] = useState(AUTO_REDIRECT_SEC);
  const [visible, setVisible] = useState(false);
  const cancelledRef = useRef(false);

  // Preload all assets
  useEffect(() => {
    const srcs = [
      "/results/defeat-bg.png",
      "/results/defeat-text.png",
      "/results/victory-bg.png",
      "/results/victory-text.png",
    ];
    let loaded = 0;
    srcs.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === srcs.length) setVisible(true);
      };
      img.onerror = () => {
        loaded++;
        if (loaded === srcs.length) setVisible(true);
      };
      img.src = src;
    });
    // Fallback — show after 800ms even if images haven't loaded
    const fallback = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (outcome !== "victory") return;
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#FFFF00", "#ffffff", "#aaaaaa"],
      scalar: 0.9,
      gravity: 1.4,
      zIndex: 60,
    });
  }, [outcome]);

  useEffect(() => {
    const t = setInterval(() => {
      if (cancelledRef.current) return;
      setCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(t);
          window.location.href = "/play";
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const handlePlayAgain = useCallback(() => {
    cancelledRef.current = true;
    onPlayAgain();
  }, [onPlayAgain]);

  const handleLeave = useCallback(() => {
    cancelledRef.current = true;
    onLeave();
  }, [onLeave]);

  const isVictory = outcome === "victory";
  const isDefeat = outcome === "defeat";
  const isDraw = outcome === "draw";

  const bgSrc = isVictory ? "/results/victory-bg.png" : "/results/defeat-bg.png";
  const textSrc = isVictory
    ? "/results/victory-text.png"
    : isDefeat
      ? "/results/defeat-text.png"
      : null;

  const payoutAmount = payoutOverride ?? winnerPayout;
  const lostAmount = stakeLostOverride ?? stakeAmount;

  const accentColor = isVictory ? "#facc15" : isDefeat ? "#ef4444" : "rgba(255,255,255,0.6)";
  const cardBorder = isVictory
    ? "1px solid rgba(234,179,8,0.4)"
    : isDefeat
      ? "1px solid rgba(239,68,68,0.3)"
      : "1px solid rgba(255,255,255,0.15)";

  const subtitle = isVictory
    ? wonByForfeit ? "Opponent forfeited — you win" : "You outplayed your opponent"
    : isDefeat
      ? "You lost the match"
      : isPractice ? "Even match" : "Stake returned";

  const cardLabel = isVictory
    ? "— SP EARNED —"
    : isDefeat
      ? "— ENTRY LOST —"
      : "— STAKE RETURNED —";

  const spAmount = isVictory
    ? `+${payoutAmount.toLocaleString()}`
    : isDefeat
      ? `−${lostAmount.toLocaleString()}`
      : stakeAmount.toLocaleString();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      {/* ── BACKGROUND LAYER ── */}
      <img
        src={bgSrc}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          zIndex: 0,
        }}
      />

      {/* ── TEXT IMAGE — top portion, never clips on any screen ── */}
      {textSrc ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            height: isDefeat ? "48vw" : "30vw",
            maxHeight: isDefeat ? "52%" : "38%",
            minHeight: isDefeat ? "220px" : "140px",
            overflow: "hidden",
          }}
        >
          <img
            src={textSrc}
            alt=""
            style={{
              width: "100%",
              maxWidth: isDefeat ? "860px" : "760px",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center top",
            }}
          />
        </div>
      ) : null}

      {/* ── UI CONTENT — bottom half ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top: isDefeat ? "42%" : "32%",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))",
          paddingLeft: "20px",
          paddingRight: "20px",
          gap: "10px",
        }}
      >
        {/* Subtitle */}
        <p style={{
          margin: 0,
          textAlign: "center",
          fontSize: "14px",
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.03em",
        }}>
          {subtitle}
        </p>

        {/* SP Card */}
        {!isPractice ? (
          <div style={{
            width: "100%",
            maxWidth: "400px",
            borderRadius: "14px",
            border: cardBorder,
            background: "rgba(0,0,0,0.65)",
            padding: "18px 28px",
            textAlign: "center",
            backdropFilter: "blur(8px)",
          }}>
            <p style={{
              margin: 0,
              marginBottom: "6px",
              fontSize: "11px",
              letterSpacing: "0.18em",
              color: accentColor,
              fontWeight: 600,
            }}>
              {cardLabel}
            </p>
            <div style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: "6px",
              fontSize: "38px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1,
            }}>
              <span>{spAmount}</span>
              <span style={{ fontSize: "17px", color: accentColor, fontWeight: 700 }}>SP</span>
              <SPIcon size={20} />
            </div>
            {typeof newBalance === "number" ? (
              <div style={{
                marginTop: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                fontSize: "13px",
                color: "#6b7280",
              }}>
                Balance: {newBalance.toLocaleString()} SP
                <SPIcon size={13} />
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{
            width: "100%",
            maxWidth: "400px",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.65)",
            padding: "18px 28px",
            textAlign: "center",
            backdropFilter: "blur(8px)",
          }}>
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
              {isVictory
                ? wonByForfeit ? "Practice win — opponent forfeited" : "Practice win"
                : isDefeat
                  ? `${opponentUsername} won this one`
                  : "Practice draw"}
            </p>
          </div>
        )}

        {/* Rematch */}
        <button
          type="button"
          onClick={handlePlayAgain}
          style={{
            width: "100%",
            maxWidth: "400px",
            borderRadius: "12px",
            padding: "15px",
            fontSize: "15px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            cursor: "pointer",
            border: `1px solid ${accentColor}`,
            background: isVictory ? "#facc15" : "#dc2626",
            color: isVictory ? "#000000" : "#ffffff",
            transition: "opacity 0.15s",
          }}
        >
          REMATCH
        </button>

        {/* Back to lobby */}
        <button
          type="button"
          onClick={handleLeave}
          style={{
            width: "100%",
            maxWidth: "400px",
            borderRadius: "12px",
            padding: "15px",
            fontSize: "15px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(0,0,0,0.3)",
            color: "#ffffff",
            transition: "opacity 0.15s",
          }}
        >
          BACK TO LOBBY
        </button>

        {/* Countdown */}
        {countdown > 0 ? (
          <p style={{
            margin: 0,
            textAlign: "center",
            fontSize: "12px",
            color: "#4b5563",
            fontVariantNumeric: "tabular-nums",
          }}>
            Returning to lobby in {countdown}s…
          </p>
        ) : null}
      </div>
    </div>
  );
}
