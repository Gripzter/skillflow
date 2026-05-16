"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  stake: number;
  gameName: string;
  opponentName: string;
  onReady: () => void;
};

const PHASES = [
  { ms: 0, label: "Searching for opponent..." },
  { ms: 1400, label: "Matching by skill rating..." },
  { ms: 2400, label: "Opponent found" },
];

export default function MatchmakingScreen({ stake, gameName, opponentName, onReady }: Props) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [showOpponent, setShowOpponent] = useState(false);

  useEffect(() => {
    const timers = PHASES.map((phase, i) =>
      setTimeout(() => {
        setPhaseIndex(i);
        if (i === PHASES.length - 1) setShowOpponent(true);
      }, phase.ms)
    );

    const readyTimer = setTimeout(onReady, 3500);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(readyTimer);
    };
  }, [onReady]);

  return (
    <div className="min-h-screen bg-[#0E0E12] flex items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="text-center mb-12">
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2">
            {gameName} · Ranked 1v1
          </div>
          <div className="text-2xl font-bold text-white">
            {stake.toLocaleString()} <span className="text-[#FFFF00]">Skillies</span> at stake
          </div>
        </div>

        <div className="relative w-32 h-32 mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-[#FFFF00]/30"
              animate={{
                scale: [1, 1.8],
                opacity: [0.6, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.6,
                ease: "easeOut",
              }}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[#FFFF00]" />
          </div>
        </div>

        <div className="text-white text-lg font-medium mb-8 h-7">{PHASES[phaseIndex].label}</div>

        {showOpponent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-xl border border-[#FFFF00]/30 bg-[#FFFF00]/[0.04] px-6 py-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-full bg-[#16161C] border border-white/10 flex items-center justify-center text-white font-bold">
              {opponentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-semibold">{opponentName}</div>
              <div className="text-xs text-white/50">Matched · skill rating in range</div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
