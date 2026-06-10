"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
  const cancelledRef = useRef(false);

  useEffect(() => {
    const imgs = [
      "/results/defeat-bg.png",
      "/results/defeat-text.png",
      "/results/victory-bg.png",
      "/results/victory-text.png",
    ];
    imgs.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
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

  const subtitle = isVictory
    ? wonByForfeit
      ? "Opponent forfeited — you win"
      : "You outplayed your opponent"
    : isDefeat
      ? "You lost the match"
      : isPractice
        ? "Even match"
        : "Stake returned";

  const contentWidth: CSSProperties = {
    width: "100%",
    maxWidth: "420px",
    marginLeft: "auto",
    marginRight: "auto",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bgSrc}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {textSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={textSrc}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: "900px",
              height: "50%",
              objectFit: "contain",
              objectPosition: "center top",
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: "48px",
          paddingLeft: "24px",
          paddingRight: "24px",
          gap: "12px",
        }}
      >
        <p
          style={{
            margin: 0,
            marginBottom: "4px",
            textAlign: "center",
            fontSize: "15px",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          {subtitle}
        </p>

        {!isPractice && isVictory ? (
          <div
            style={{
              ...contentWidth,
              borderRadius: "12px",
              border: "1px solid rgba(234, 179, 8, 0.4)",
              background: "rgba(0,0,0,0.6)",
              padding: "20px 32px",
              textAlign: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            <p
              style={{
                margin: 0,
                marginBottom: "8px",
                fontSize: "12px",
                letterSpacing: "0.15em",
                color: "#facc15",
              }}
            >
              — SP EARNED —
            </p>
            <p
              style={{
                margin: 0,
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: "8px",
                fontSize: "36px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              <span>+{payoutAmount.toLocaleString()}</span>
              <span style={{ fontSize: "18px", color: "#facc15" }}>SP</span>
              <SPIcon size={22} />
            </p>
            {typeof newBalance === "number" ? (
              <p
                style={{
                  margin: 0,
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  fontSize: "14px",
                  color: "#9ca3af",
                }}
              >
                Balance: {newBalance.toLocaleString()} SP
                <SPIcon size={14} />
              </p>
            ) : null}
          </div>
        ) : null}

        {!isPractice && isDefeat ? (
          <div
            style={{
              ...contentWidth,
              borderRadius: "12px",
              border: "1px solid rgba(127, 29, 29, 0.4)",
              background: "rgba(0,0,0,0.6)",
              padding: "20px 32px",
              textAlign: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            <p
              style={{
                margin: 0,
                marginBottom: "8px",
                fontSize: "12px",
                letterSpacing: "0.15em",
                color: "#ef4444",
              }}
            >
              — ENTRY LOST —
            </p>
            <p
              style={{
                margin: 0,
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: "8px",
                fontSize: "36px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              <span>−{lostAmount.toLocaleString()}</span>
              <span style={{ fontSize: "18px", color: "#ef4444" }}>SP</span>
              <SPIcon size={22} />
            </p>
            {typeof newBalance === "number" ? (
              <p
                style={{
                  margin: 0,
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  fontSize: "14px",
                  color: "#9ca3af",
                }}
              >
                Balance: {newBalance.toLocaleString()} SP
                <SPIcon size={14} />
              </p>
            ) : null}
          </div>
        ) : null}

        {!isPractice && isDraw ? (
          <div
            style={{
              ...contentWidth,
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.6)",
              padding: "20px 32px",
              textAlign: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            <p
              style={{
                margin: 0,
                marginBottom: "8px",
                fontSize: "12px",
                letterSpacing: "0.15em",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              — STAKE RETURNED —
            </p>
            <p
              style={{
                margin: 0,
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: "8px",
                fontSize: "36px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              <span>{stakeAmount.toLocaleString()}</span>
              <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.6)" }}>SP</span>
              <SPIcon size={22} />
            </p>
          </div>
        ) : null}

        {isPractice ? (
          <div
            style={{
              ...contentWidth,
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.6)",
              padding: "20px 32px",
              textAlign: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
              {isVictory
                ? wonByForfeit
                  ? "Practice win — opponent forfeited"
                  : "Practice win"
                : isDefeat
                  ? `${opponentUsername} won this one`
                  : "Practice draw"}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handlePlayAgain}
          style={{
            ...contentWidth,
            borderRadius: "12px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            border: isVictory ? "1px solid #facc15" : "1px solid #f87171",
            background: isVictory ? "#facc15" : "#dc2626",
            color: isVictory ? "#000000" : "#ffffff",
          }}
        >
          REMATCH
        </button>

        <button
          type="button"
          onClick={handleLeave}
          style={{
            ...contentWidth,
            borderRadius: "12px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "#ffffff",
          }}
        >
          BACK TO LOBBY
        </button>

        {countdown > 0 ? (
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontSize: "12px",
              fontVariantNumeric: "tabular-nums",
              color: "#6b7280",
            }}
          >
            Returning to lobby in {countdown}s…
          </p>
        ) : null}
      </div>
    </div>
  );
}
