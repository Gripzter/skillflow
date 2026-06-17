import { Suspense } from "react";
import type { Metadata } from "next";
import PlayContent from "@/app/(app)/play/PlayContent";

export const metadata: Metadata = {
  title: "SkillFlow — Skill-Based Competitive Gaming",
  description:
    "Play skill-based games, stake Skillies, and compete on the Glicko leaderboard.",
};

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0E0E12]" />}>
      <PlayContent />
    </Suspense>
  );
}
