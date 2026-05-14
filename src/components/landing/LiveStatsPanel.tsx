"use client";

import { useEffect, useRef, useState } from "react";
import { applyJitter, fetchBlendedLiveStats, type LiveStats } from "@/lib/liveStats";

const INITIAL_STATS: LiveStats = {
  playersOnline: 42,
  matchesToday: 224,
  skilliesInPlay: 12450,
  activeMatches: 12,
};

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export default function LiveStatsPanel() {
  const [displayStats, setDisplayStats] = useState<LiveStats>(INITIAL_STATS);
  const [tickVersion, setTickVersion] = useState(0);
  const isMountedRef = useRef(true);
  const baseStatsRef = useRef<LiveStats>(INITIAL_STATS);

  useEffect(() => {
    isMountedRef.current = true;

    const refreshFromDb = async () => {
      const stats = await fetchBlendedLiveStats();
      if (!isMountedRef.current) return;
      baseStatsRef.current = stats;
      setDisplayStats(stats);
      setTickVersion((prev) => prev + 1);
    };

    void refreshFromDb();

    const dbRefreshInterval = setInterval(() => {
      void refreshFromDb();
    }, 8_000);

    const jitterInterval = setInterval(() => {
      setDisplayStats((current) => {
        const next: LiveStats = {
          playersOnline: applyJitter(current.playersOnline, 0.02),
          matchesToday: current.matchesToday + (Math.floor(Math.random() * 3) + 1),
          skilliesInPlay: applyJitter(current.skilliesInPlay, 0.05),
          activeMatches: Math.max(1, applyJitter(baseStatsRef.current.activeMatches, 0.12)),
        };
        return next;
      });
      setTickVersion((prev) => prev + 1);
    }, 2_000);

    return () => {
      isMountedRef.current = false;
      clearInterval(dbRefreshInterval);
      clearInterval(jitterInterval);
    };
  }, []);

  return (
    <div
      className="w-full rounded-xl border border-[#1a1a22] bg-[#13131a]"
      style={{ padding: "24px" }}
      aria-label="Live platform activity stats"
    >
      <div
        className="flex items-center gap-2 text-[11px] uppercase"
        style={{ color: "#888", letterSpacing: "1.5px" }}
      >
        <span className="live-dot" aria-hidden>
          ●
        </span>
        <span>LIVE NOW</span>
      </div>

      <p className="mt-6 text-[11px] uppercase tracking-[1.5px] text-[#FFFF00]">PLAYERS ONLINE</p>
      <p
        key={`players-${tickVersion}`}
        className="stat-tick mt-1 text-[64px] font-medium leading-none tracking-[-2px] text-white"
      >
        {formatNumber(displayStats.playersOnline)}
      </p>

      <div className="my-6 h-px w-full bg-[#1a1a22]" />

      <p className="text-[11px] uppercase tracking-[1.5px]" style={{ color: "#888" }}>
        MATCHES PLAYED TODAY
      </p>
      <p key={`matches-${tickVersion}`} className="stat-tick mt-1 text-[36px] font-medium tracking-[-1px] text-white">
        {formatNumber(displayStats.matchesToday)}
      </p>

      <div className="mt-6 flex items-start">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.5px]" style={{ color: "#666" }}>
            TOTAL SKILLIES IN PLAY
          </p>
          <p key={`skillies-${tickVersion}`} className="stat-tick mt-1 text-[18px] font-medium text-white">
            {formatNumber(displayStats.skilliesInPlay)} SP
          </p>
        </div>
        <div className="mx-4 h-11 w-px bg-[#1a1a22]" />
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.5px]" style={{ color: "#666" }}>
            ACTIVE MATCHES
          </p>
          <p key={`active-${tickVersion}`} className="stat-tick mt-1 text-[18px] font-medium text-white">
            {formatNumber(displayStats.activeMatches)}
          </p>
        </div>
      </div>

      <p className="mt-6 text-[11px] italic" style={{ color: "#444" }}>
        Updates every few seconds
      </p>

      <style jsx>{`
        .live-dot {
          color: #22c55e;
          animation: pulse 1.5s ease-in-out infinite;
          opacity: 0.4;
        }

        .stat-tick {
          transition:
            transform 300ms ease-out,
            opacity 300ms ease-out;
          animation: statTick 300ms ease-out;
        }

        @keyframes pulse {
          0% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.4;
          }
        }

        @keyframes statTick {
          from {
            opacity: 0.7;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
